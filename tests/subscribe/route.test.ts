import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HONEYPOT } from '@/lib/subscribe/messages';

// The database call is replaced: no test touches the network.
const insert = vi.hoisted(() => vi.fn());
vi.mock('@/lib/subscribe/db', () => ({ insertSubscriber: insert }));

import { GET, POST } from '@/app/api/subscribe/route';

const URL_ = 'https://arav.pro/api/subscribe';
let n = 0;
/** Each test is its own requester, so the route's one limiter does not carry from test to test. */
const who = () => `10.0.0.${++n}`;

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': who(), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const form = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-real-ip': who(), ...headers }, body: new URLSearchParams(fields).toString() });

beforeEach(() => {
  const rows = new Set<string>();
  insert.mockReset();
  insert.mockImplementation(async (email: string) => {
    if (rows.has(email)) return 'exists';
    rows.add(email);
    return 'inserted';
  });
});

describe('POST /api/subscribe, scripts on (JSON)', () => {
  it('stores a new address and says so, uncached', async () => {
    const res = await POST(json({ email: ' Reader@Example.com ', source: 'home' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true, outcome: 'subscribed' });
    expect(insert).toHaveBeenCalledWith('reader@example.com', 'home');
  });

  it('answers "already" for a duplicate and nothing more', async () => {
    await POST(json({ email: 'reader@example.com' }));
    const res = await POST(json({ email: 'Reader@EXAMPLE.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outcome: 'already' });
  });

  it('answers "invalid" for a bad address, a body that is not JSON, and a body that is too large', async () => {
    for (const req of [json({ email: 'nope' }), json({}), json('{not json'), json('"text"'), json({ email: `${'a'.repeat(3000)}@example.com` })]) {
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false, outcome: 'invalid' });
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it('gives a filled honeypot the friendly answer and stores nothing', async () => {
    const res = await POST(json({ email: 'robot@example.com', [HONEYPOT]: 'x' }));
    expect(await res.json()).toEqual({ ok: true, outcome: 'subscribed' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('answers "failed" when the database cannot be used, without saying why', async () => {
    insert.mockRejectedValue(new Error('the database refused: password hunter2'));
    const res = await POST(json({ email: 'reader@example.com' }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, outcome: 'failed' });
    expect(text).not.toMatch(/hunter2|password/);
  });

  it('holds one requester to five tries a minute and says when to come back', async () => {
    const ip = who();
    for (let i = 0; i < 5; i++) expect((await POST(json({ email: `r${i}@example.com` }, { 'x-real-ip': ip }))).status).toBe(200);
    const res = await POST(json({ email: 'r6@example.com' }, { 'x-real-ip': ip }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await res.json()).toEqual({ ok: false, outcome: 'limited' });
    expect(insert).toHaveBeenCalledTimes(5);
  });
});

describe('POST /api/subscribe, scripts off (a form post)', () => {
  it('sends the browser to the page for the answer', async () => {
    const ok = await POST(form({ email: 'reader@example.com', source: 'blog', [HONEYPOT]: '' }));
    expect(ok.status).toBe(303);
    expect(ok.headers.get('location')).toBe('/newsletter/subscribed');
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(insert).toHaveBeenCalledWith('reader@example.com', 'blog');

    const again = await POST(form({ email: 'reader@example.com' }));
    expect(again.headers.get('location')).toBe('/newsletter/already');
    const bad = await POST(form({ email: 'nope' }));
    expect(bad.headers.get('location')).toBe('/newsletter/invalid');
  });

  it('never puts the address in the address bar', async () => {
    const res = await POST(form({ email: 'reader@example.com' }));
    expect(res.headers.get('location')).not.toMatch(/reader|@|%40/);
  });
});

describe('what the route refuses', () => {
  it('anything but POST', async () => {
    const res = GET();
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });

  it('a body of another kind', async () => {
    const res = await POST(new Request(URL_, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"email":"reader@example.com"}' }));
    expect(res.status).toBe(415);
    expect(insert).not.toHaveBeenCalled();
  });

  it('a post from another site', async () => {
    const res = await POST(form({ email: 'reader@example.com' }, { 'sec-fetch-site': 'cross-site' }));
    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
    expect((await POST(form({ email: 'reader@example.com' }, { 'sec-fetch-site': 'same-origin' }))).status).toBe(303);
  });
});
