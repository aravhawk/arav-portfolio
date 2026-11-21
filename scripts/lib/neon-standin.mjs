// A local stand-in for the Neon database, for running the newsletter's signup end to end on a machine that cannot
// read the real connection string (Vercel keeps it as a sensitive value and does not hand it to `vercel env pull`).
//
// It is loaded before the program it stands under:
//
//   STANDIN_FILE=.tools/out/n1/standin.json DATABASE_URL=postgresql://standin:standin@db.standin.invalid/arav \
//     NODE_OPTIONS="--import $PWD/scripts/lib/neon-standin.mjs" pnpm exec next start -p 3184
//
// The Neon serverless driver sends each statement as an HTTPS POST to its host's `/sql`. This file answers those
// requests itself, for the host `*.standin.invalid` only (a name that can never resolve), from a small table kept in
// STANDIN_FILE, so the server and a test script started the same way see the same rows. Nothing leaves the machine.
//
// It is NOT Postgres. It knows the four statements the signup and its scripts send, and it keeps the two rules of
// db/subscribers.sql that the signup leans on: an address is unique, and it is stored in lower case. It proves the
// route, the driver's call and the form work together; it does not prove the SQL against a real server. That is
// what `pnpm db:apply` and `scripts/subscribe-e2e.mjs` are for, with the real DATABASE_URL.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const FILE = process.env.STANDIN_FILE;
const real = globalThis.fetch;

const load = () => (FILE && existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { created: false, rows: [] });
const save = (db) => FILE && writeFileSync(FILE, JSON.stringify(db, null, 1));

const TEXT = 25;
const INT8 = 20;
const UUID = 2950;
const result = (command, fields, rows, rowCount = rows.length) =>
  Response.json({ command, rowCount, rowAsArray: true, fields: fields.map(([name, dataTypeID]) => ({ name, dataTypeID, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: 'text' })), rows });
const error = (message, code) => Response.json({ message, code, severity: 'ERROR' }, { status: 400 });

function run(query, params) {
  const q = query.replace(/\s+/g, ' ').trim();
  const db = load();
  if (/^CREATE TABLE IF NOT EXISTS subscribers\b/i.test(q) || /^--.*CREATE TABLE IF NOT EXISTS subscribers\b/is.test(query)) {
    db.created = true;
    save(db);
    return result('CREATE TABLE', [], [], null);
  }
  if (!/\bsubscribers\b/i.test(q)) return error('the stand-in knows only the subscribers table', '0A000');
  if (!db.created) return error('relation "subscribers" does not exist', '42P01');
  if (/^INSERT INTO subscribers \(email, source\) VALUES \(\$1, \$2\) ON CONFLICT \(email\) DO NOTHING RETURNING id$/i.test(q)) {
    const [email, source] = params;
    if (email !== email.toLowerCase()) return error('new row for relation "subscribers" violates check constraint "subscribers_email_lower"', '23514');
    if (db.rows.some((r) => r.email === email)) return result('INSERT', [['id', UUID]], [], 0);
    const row = { id: randomUUID(), email, created_at: new Date().toISOString(), source, confirmed: false };
    db.rows.push(row);
    save(db);
    return result('INSERT', [['id', UUID]], [[row.id]], 1);
  }
  if (/^SELECT count\(\*\) AS n FROM subscribers$/i.test(q)) return result('SELECT', [['n', INT8]], [[String(db.rows.length)]]);
  if (/^SELECT email, source, confirmed FROM subscribers WHERE email = \$1$/i.test(q)) {
    return result('SELECT', [['email', TEXT], ['source', TEXT], ['confirmed', 16]], db.rows.filter((r) => r.email === params[0]).map((r) => [r.email, r.source, r.confirmed ? 't' : 'f']));
  }
  if (/^DELETE FROM subscribers WHERE email = \$1 RETURNING id$/i.test(q)) {
    const gone = db.rows.filter((r) => r.email === params[0]);
    db.rows = db.rows.filter((r) => r.email !== params[0]);
    save(db);
    return result('DELETE', [['id', UUID]], gone.map((r) => [r.id]));
  }
  return error(`the stand-in does not know this statement: ${q.slice(0, 80)}`, '0A000');
}

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {}
  if (!host.endsWith('standin.invalid')) return real(input, init);
  const body = JSON.parse(typeof init?.body === 'string' ? init.body : await new Request(input, init).text());
  return run(body.query, body.params ?? []);
};
