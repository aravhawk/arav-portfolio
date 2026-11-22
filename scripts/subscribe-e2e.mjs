// The newsletter's signup, end to end, against a running site and (unless --no-db) its database.
//
//   node scripts/subscribe-e2e.mjs <base> [--no-db] [--keep]
//
//   <base>     the site: http://localhost:3184, or a deployed preview's address
//   --no-db    only what can be seen from outside: the answers. For a preview when this machine has no DATABASE_URL.
//              The test row then STAYS in the database: the script prints the one statement that deletes it.
//   --keep     with the database: do not delete the test row at the end
//
// With the database (DATABASE_URL in the environment or in .env.local, the same database the site writes to) it
// counts the rows before, looks for the test row after each step, deletes it at the end and counts again.
// A preview behind Vercel's login: set VERCEL_AUTOMATION_BYPASS_SECRET to the project's existing bypass secret (it is
// sent as a header and never printed), or run each request with `vercel curl` as .tools/out/n1/REPORT.md describes.
//
// It subscribes ONE made-up address at the reserved domain example.com (nothing can be delivered there), and never
// prints any stored address but that one. Run it once a minute at most: its last step is to meet the limiter (five
// tries a minute for one requester), and a second run inside the minute meets it at once.

import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const noDb = args.includes('--no-db');
const keep = args.includes('--keep');
const base = (args.find((a) => !a.startsWith('--')) || 'http://localhost:3184').replace(/\/$/, '');
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

let sql = null;
if (!noDb) {
  if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
  if (!process.env.DATABASE_URL) {
    console.error('subscribe-e2e: DATABASE_URL is not set. Use --no-db to test the answers only.');
    process.exit(2);
  }
  sql = (await import('@neondatabase/serverless')).neon(process.env.DATABASE_URL);
}

const local = `n1-test-${randomBytes(5).toString('hex')}`;
const typed = `  ${local.toUpperCase()}@Example.com `; // as a reader might type it: capitals and stray spaces
const stored = `${local}@example.com`;
const robot = `n1-robot-${randomBytes(5).toString('hex')}@example.com`;

const post = (body, { form = false } = {}) =>
  fetch(`${base}/api/subscribe`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json', ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}) },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
// (Before the first signup the table may not be there yet: the site makes it on its first insert. That counts as no rows.)
const total = async () => {
  if (!sql) return null;
  try {
    return Number((await sql.query('SELECT count(*) AS n FROM subscribers'))[0].n);
  } catch (e) {
    if (e?.code === '42P01') return 0;
    throw e;
  }
};
const rowsOf = async (email) => (sql ? await sql.query('SELECT email, source, confirmed FROM subscribers WHERE email = $1', [email]) : null);

let failed = 0;
const step = (name, ok, got) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}\n        ${got}`);
};
const said = async (res) => `${res.status} ${JSON.stringify(await res.json().catch(() => null))}`;

console.log(`site: ${base}\ndatabase: ${sql ? 'yes' : 'no (--no-db)'}\ntest address: ${stored}\n`);
const before = await total();
if (sql) console.log(`rows before: ${before}\n`);

let res = await fetch(`${base}/api/subscribe`, { headers: bypass ? { 'x-vercel-protection-bypass': bypass } : {} });
step('GET is refused', res.status === 405, `${res.status}, Allow: ${res.headers.get('allow')}`);

res = await post({ email: typed, source: 'home' });
let got = await said(res);
let rows = await rowsOf(stored);
step('1. a new address is subscribed', res.status === 200 && got.includes('"subscribed"') && (!rows || rows.length === 1), `${got}, cache-control: ${res.headers.get('cache-control')}${rows ? `; rows for the test address: ${rows.length}${rows[0] ? ` (stored as ${rows[0].email}, source ${rows[0].source}, confirmed ${rows[0].confirmed})` : ''}` : ''}`);
if (rows) step('   it is stored trimmed and in lower case', rows[0]?.email === stored, `typed "${typed}", stored "${rows[0]?.email}"`);

res = await post({ email: stored.toUpperCase(), source: 'blog' });
got = await said(res);
rows = await rowsOf(stored);
step('2. the same address again is "already", and there is still one row', res.status === 200 && got.includes('"already"') && (!rows || rows.length === 1), `${got}${rows ? `; rows for the test address: ${rows.length}` : ''}`);

res = await post({ email: 'not-an-address', source: 'home' });
got = await said(res);
step('3. a bad address "looks wrong"', res.status === 400 && got.includes('"invalid"'), got);

res = await post({ email: robot, source: 'home', homepage_url: 'https://example.com/' });
got = await said(res);
rows = await rowsOf(robot);
step('4. a filled honeypot gets the friendly answer and stores nothing', res.status === 200 && got.includes('"subscribed"') && (!rows || rows.length === 0), `${got}${rows ? `; rows for the robot's address: ${rows.length}` : ''}`);

res = await post({ email: stored, source: 'blog', homepage_url: '' }, { form: true });
step('5. the plain form (scripts off) is sent to the page for its answer', res.status === 303 && res.headers.get('location') === '/newsletter/already', `${res.status}, Location: ${res.headers.get('location')}`);

res = await post({ email: stored, source: 'home' });
got = await said(res);
step('6. the sixth try inside a minute meets the limiter', res.status === 429 && got.includes('"limited"') && Number(res.headers.get('retry-after')) > 0, `${got}, Retry-After: ${res.headers.get('retry-after')} s`);

if (sql) {
  const mid = await total();
  console.log(`\nrows with the test row: ${mid}`);
  if (keep) console.log('(--keep: the test row was left)');
  else {
    const gone = await sql.query('DELETE FROM subscribers WHERE email = $1 RETURNING id', [stored]);
    const after = await total();
    step('7. the test row is deleted and the count is what it was', gone.length === 1 && after === before, `deleted ${gone.length}; rows before ${before}, with the test row ${mid}, after ${after}`);
  }
} else {
  console.log(`\nThe test row is still in the database. Delete it there with:\n  DELETE FROM subscribers WHERE email = '${stored}';`);
}
console.log(failed ? `\n${failed} step(s) FAILED` : '\nall steps passed');
process.exit(failed ? 1 : 0);
