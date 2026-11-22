import { subscribe } from '@/lib/subscribe/core';
import { insertSubscriber } from '@/lib/subscribe/db';
import { createLimiter } from '@/lib/subscribe/limiter';
import { HONEYPOT, type Outcome } from '@/lib/subscribe/messages';

/**
 * The newsletter's signup. POST only. The form posts JSON when scripts are
 * on and gets small JSON back; with scripts off the browser posts the form
 * itself and is sent (303) to a page that says what happened
 * (src/app/newsletter/[state]). An address is stored and nothing else
 * happens: nothing is sent to anyone. No address and no secret is logged.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2048;
const NO_STORE = { 'Cache-Control': 'no-store' };
const STATUS: Record<Outcome, number> = { subscribed: 200, already: 200, invalid: 400, limited: 429, failed: 500 };

// One limiter for each warm instance (its limits: src/lib/subscribe/limiter.ts).
const limiter = createLimiter();

const notAllowed = () => Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405, headers: { ...NO_STORE, Allow: 'POST' } });
export { notAllowed as GET, notAllowed as HEAD, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };

/** At most MAX_BODY_BYTES are read: a body with no length said must not be taken whole before it is measured. */
async function readLimited(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

type Fields = { email: unknown; honeypot: unknown; source: unknown };

function fieldsOf(raw: string, json: boolean): Fields | null {
  if (json) {
    try {
      const body: unknown = JSON.parse(raw);
      if (typeof body !== 'object' || body === null) return null;
      const b = body as Record<string, unknown>;
      return { email: b.email, honeypot: b[HONEYPOT], source: b.source };
    } catch {
      return null;
    }
  }
  const form = new URLSearchParams(raw);
  return { email: form.get('email'), honeypot: form.get(HONEYPOT), source: form.get('source') };
}

export async function POST(request: Request) {
  const h = request.headers;
  const type = (h.get('content-type') ?? '').toLowerCase();
  const json = type.startsWith('application/json');
  const plain = type.startsWith('application/x-www-form-urlencoded');

  const answer = (outcome: Outcome, retryAfter?: number) => {
    const headers: Record<string, string> = { ...NO_STORE };
    if (retryAfter) headers['Retry-After'] = String(retryAfter);
    // The plain form: to a page, by GET, so a reload does not post the address again.
    if (plain) return new Response(null, { status: 303, headers: { ...headers, Location: `/newsletter/${outcome}` } });
    return Response.json({ ok: outcome === 'subscribed' || outcome === 'already', outcome }, { status: STATUS[outcome], headers });
  };

  try {
    // Only the two bodies the form sends, and only from this site's own pages.
    if (!json && !plain) return Response.json({ ok: false, error: 'unsupported_media_type' }, { status: 415, headers: NO_STORE });
    const site = h.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') return Response.json({ ok: false, error: 'cross_site' }, { status: 403, headers: NO_STORE });

    const raw = await readLimited(request);
    const fields = raw === null ? null : fieldsOf(raw, json);

    // On Vercel the platform writes these from the connection and overwrites what a client sent, so they can be keyed
    // on there. Behind a proxy that only appends, the first entry is the client's to choose: the limiter means little.
    const address = h.get('x-real-ip')?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const { outcome, retryAfter } = await subscribe(
      { email: fields?.email, honeypot: fields?.honeypot, source: fields?.source, address },
      { insert: insertSubscriber, limiter },
    );
    return answer(outcome, retryAfter);
  } catch {
    return answer('failed');
  }
}
