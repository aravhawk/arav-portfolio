import 'server-only';
import { neon } from '@neondatabase/serverless';
import type { Source } from './messages';
import { SUBSCRIBERS_DDL } from './schema';

/**
 * The table is made if it is not there, once for each warm instance (the
 * connection string is a sensitive value on the host and cannot be pulled to
 * a machine, so the site applies its own table). A failure is not kept: the
 * next call tries again.
 */
let tableReady: Promise<void> | null = null;
function ensureTable(sql: { query: (text: string) => PromiseLike<unknown> }): Promise<void> {
  tableReady ??= Promise.resolve(sql.query(SUBSCRIBERS_DDL)).then(
    () => undefined,
    (e: unknown) => {
      tableReady = null;
      throw e;
    },
  );
  return tableReady;
}

/**
 * The statement the signup runs (the table: db/subscribers.sql, made first if it is missing). The
 * connection string is read from the environment at the time of the call, so
 * a build without it still builds; a call without it throws, and the route
 * answers that something failed.
 */
export async function insertSubscriber(email: string, source: Source): Promise<'inserted' | 'exists'> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('subscribe: no database is configured');
  const sql = neon(url);
  await ensureTable(sql);
  const rows = await sql`
    INSERT INTO subscribers (email, source)
    VALUES (${email}, ${source})
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0 ? 'inserted' : 'exists';
}
