// The site carries no email address. This searches everything a build makes and everything a server gives for one.
//
//   node scripts/address-search.mjs [base] [--out file.md]
//
// After `pnpm build` (from an empty `.next`, so no earlier build's cache is searched in its place) and with the
// production server up at `base` (default http://localhost:3184). It reads:
//
//   every file under `.next/` and `public/`, whatever its kind, as bytes
//   every served route: each page of the sitemap and a page that does not exist, as HTML and as the data a link
//   fetches ahead; the feed, the sitemap, robots.txt; every share card and icon a page names; every script and
//   stylesheet a page loads
//
// and looks, in each, for his address (plain, and with its sign written as a URL, an HTML entity or a script escape),
// for any address at a mail host or one of his domains, and for the scheme that opens a mail program. It prints
// what it searched and every place it found something.
//
// It exits 1 if his address is anywhere at all, or if any address or the scheme is in something a browser can be
// given: a served response, `public/`, `.next/static/`, a page or its data as the build rendered it. What is left
// can only be in the server's own program (`.next/server/chunks`, source maps, a package the server loads): text
// that other people's libraries carry, such as an author's address in a licence line, or the markdown library's
// code for turning an address in a post into a link (which the post's own link component then refuses:
// src/components/blog/MDXComponents.tsx). Those are listed, by name, and do not fail the search.
//
// Nothing here spells the address or the scheme whole: the script passes its own search (tests/content/address.test.ts).

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? null : args.splice(i, 2)[1];
};
const outFile = flag('out');
const base = (args[0] || 'http://localhost:3184').replace(/\/$/, '');
const root = join(fileURLToPath(import.meta.url), '..', '..');

const AT = String.fromCharCode(64);
const NAME = ['arav', 'hawk'].join('');
const HOST = ['g', 'mail', '.com'].join('');
/** The sign, every way a page can carry it. */
const SIGNS = [AT, '%40', '&#64;', '&#x40;', '&commat;', '\\u0040', '\\x40', ' at ', ' [at] ', '(at)'];
const NEEDLES = [
  ...SIGNS.map((s) => ({ what: 'his address', bytes: Buffer.from(NAME + s + HOST, 'latin1') })),
  { what: 'his address, in base64', bytes: Buffer.from(Buffer.from(NAME + AT + HOST).toString('base64').slice(0, 20), 'latin1') },
  { what: 'the mail scheme', bytes: Buffer.from(['mail', 'to'].join(''), 'latin1'), anyCase: true },
];
/** Any address at a mail host or at one of his domains (text only). */
const ANY = new RegExp(`[A-Za-z0-9._%+-]+${AT}(?:g(?:oogle)?mail|outlook|hotmail|live|icloud|proton(?:mail)?|yahoo|fastmail|arav|aravjain|infiniflop|infiniview)\\.[a-z]{2,}`, 'i');

/** Server-only program text: never sent to a browser. */
const serverOnly = (where) => /^\.next\/(server\/chunks\/|node_modules\/|cache\/|build\/|types\/|dev\/|diagnostics\/|trace)/.test(where) || /^\.next\/.*\.map$/.test(where) || /^\.next\/server\/[^/]+\.(js|json)$/.test(where);
const hits = [];
function search(where, buf) {
  const lower = Buffer.from(buf.toString('latin1').toLowerCase(), 'latin1');
  for (const n of NEEDLES) {
    const hay = n.anyCase ? lower : buf;
    const at = hay.indexOf(n.bytes);
    if (at >= 0) hits.push({ where, what: n.what, near: buf.subarray(Math.max(0, at - 30), at).toString('latin1').replace(/\s+/g, ' ') });
  }
  const m = buf.toString('latin1').match(ANY);
  if (m) hits.push({ where, what: `an address at ${m[0].split(AT)[1]}`, near: '' });
}

// ---- the files
let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (st.isFile()) {
      files++;
      bytes += st.size;
      search(relative(root, p), readFileSync(p));
    }
  }
};
const count = {};
for (const dir of ['.next', 'public']) {
  const before = files;
  walk(join(root, dir));
  count[dir] = files - before;
}

// ---- the served routes
const seen = new Map();
async function get(path, headers) {
  const key = path + (headers ? ' (as data)' : '');
  if (seen.has(key)) return seen.get(key);
  const res = await fetch(base + path, { headers, redirect: 'follow' });
  const buf = Buffer.from(await res.arrayBuffer());
  const got = { status: res.status, type: res.headers.get('content-type') ?? '', buf };
  seen.set(key, got);
  search(`${key} [${got.status} ${got.type.split(';')[0]}]`, buf);
  return got;
}
const local = (url) => {
  try {
    const u = new URL(url, base);
    return u.pathname + u.search;
  } catch {
    return null;
  }
};
const sitemap = (await get('/sitemap.xml')).buf.toString('utf8');
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
for (const fixed of ['/', '/work', '/blog']) if (!pages.includes(fixed)) pages.push(fixed);
pages.push('/a-page-that-does-not-exist');
for (const path of ['/feed.xml', '/robots.txt', '/icon.svg', '/apple-icon', '/favicon.ico', '/opengraph-image', '/work/opengraph-image', '/blog/opengraph-image']) await get(path);
for (const page of pages) {
  const html = (await get(page)).buf.toString('utf8');
  // (What a link to this page fetches ahead: the same page as data.)
  await get(page, { RSC: '1' });
  // Its share cards and icons, wherever its head names them (on the canonical host: asked for here).
  for (const m of html.matchAll(/<(?:meta|link)\b[^>]*?(?:content|href)="([^"]+)"/g)) {
    const url = m[1].replace(/&amp;/g, '&');
    if (/opengraph-image|twitter-image|apple-icon|icon\.svg|favicon|feed\.xml/.test(url)) await get(local(url));
  }
  // Its scripts and stylesheets.
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) await get(m[1].replace(/&amp;/g, '&'));
}

// ---- say it
const his = hits.filter((h) => h.what.startsWith('his address'));
const given = hits.filter((h) => !h.what.startsWith('his address') && !serverOnly(h.where));
const kept = hits.filter((h) => !h.what.startsWith('his address') && serverOnly(h.where));
const say = (h) => `- ${h.where}: ${h.what}${h.near ? ` (after "...${h.near}")` : ''}`;
const lines = [
  `Searched for: his address (with its sign plain, as a URL, as an HTML entity, as a script escape, spelled out and in base64), any address at a mail host or at one of his domains, and the mail scheme.`,
  ``,
  `Files: ${files} (${(bytes / 1048576).toFixed(1)} MB): .next ${count['.next']}, public ${count.public}.`,
  `Served from ${base}: ${seen.size} responses: ${pages.length} pages as HTML and as data, the feed, the sitemap, robots.txt, the icons, ${[...seen.keys()].filter((k) => /opengraph-image/.test(k)).length} share cards, ${[...seen.keys()].filter((k) => k.startsWith('/_next/static/')).length} scripts and stylesheets.`,
  `Not 200: ${[...seen].filter(([, v]) => v.status !== 200).map(([k, v]) => `${k} ${v.status}`).join(', ') || 'none'}.`,
  ``,
  `His address, anywhere (files and responses): ${his.length ? `FOUND in ${his.length} place${his.length === 1 ? '' : 's'}` : 'nothing'}.`,
  ...his.map(say),
  `Any address or the mail scheme, in anything a browser can be given: ${given.length ? `FOUND in ${given.length} place${given.length === 1 ? '' : 's'}` : 'nothing'}.`,
  ...given.map(say),
  `Other people's text in the server's own program (never sent to a browser): ${kept.length ? `${kept.length} place${kept.length === 1 ? '' : 's'}` : 'nothing'}.`,
  ...kept.map(say),
];
console.log(lines.join('\n'));
if (outFile) writeFileSync(outFile, lines.join('\n') + '\n');
process.exit(his.length || given.length ? 1 : 0);
