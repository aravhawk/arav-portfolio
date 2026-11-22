// Makes the newsletter's table if it is not there, then prints the database's own description of it.
//
//   pnpm db:apply
//
// It reads DATABASE_URL from the environment, or from .env.local (git-ignored) if the variable is not set. On Vercel
// the Neon integration sets it for the deployed site; to run this from a machine, put the connection string in
// .env.local yourself (the integration marks it sensitive, so `vercel env pull` does not hand it over: copy it from
// the Neon console). Safe to run again: db/subscribers.sql only creates what is missing. It prints no part of the
// connection string and no stored address.

import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('db:apply: DATABASE_URL is not set (in the environment or in .env.local). Nothing was changed.');
  process.exit(1);
}

const sql = neon(url);
const ddl = readFileSync(new URL('../db/subscribers.sql', import.meta.url), 'utf8');

try {
  await sql.query(ddl);
  console.log('applied db/subscribers.sql (CREATE TABLE IF NOT EXISTS subscribers)');
} catch (e) {
  console.error(`db:apply: the statement failed (${e?.code ?? 'no code'}). Nothing else was done.`);
  process.exit(1);
}

try {
  const columns = await sql.query(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'subscribers' ORDER BY ordinal_position`,
  );
  const constraints = await sql.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'subscribers'::regclass ORDER BY contype, conname`,
  );
  const count = await sql.query('SELECT count(*) AS n FROM subscribers');
  console.log('\ncolumns');
  for (const c of columns) console.log(`  ${c.column_name.padEnd(11)} ${c.data_type.padEnd(26)} ${c.is_nullable === 'YES' ? 'null    ' : 'not null'} ${c.column_default ?? ''}`.trimEnd());
  console.log('constraints');
  for (const c of constraints) console.log(`  ${c.conname.padEnd(26)} ${c.def}`);
  console.log(`rows: ${count[0].n}`);
} catch (e) {
  console.log(`(the table was applied; this database did not describe it: ${e?.code ?? 'no code'})`);
}
