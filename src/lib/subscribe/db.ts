import 'server-only';
import { neon } from '@neondatabase/serverless';
import type { Source } from './messages';

/**
 * The one statement the signup runs (the table: db/subscribers.sql). The
 * connection string is read from the environment at the time of the call, so
 * a build without it still builds; a call without it throws, and the route
 * answers that something failed.
 */
export async function insertSubscriber(email: string, source: Source): Promise<'inserted' | 'exists'> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('subscribe: no database is configured');
  const sql = neon(url);
  const rows = await sql`
    INSERT INTO subscribers (email, source)
    VALUES (${email}, ${source})
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0 ? 'inserted' : 'exists';
}
