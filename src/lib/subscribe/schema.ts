/**
 * The newsletter's table, as one statement. It is the same statement as
 * db/subscribers.sql (a test holds the two equal): that file is what
 * `pnpm db:apply` runs from a machine; this constant is what the site itself
 * runs once on each warm instance before its first insert, so a deployment
 * whose database has no table yet makes it. The statement only creates what
 * is missing.
 */
export const SUBSCRIBERS_DDL = `CREATE TABLE IF NOT EXISTS subscribers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  source      text,
  confirmed   boolean     NOT NULL DEFAULT false,
  CONSTRAINT subscribers_email_key    UNIQUE (email),
  CONSTRAINT subscribers_email_lower  CHECK (email = lower(email)),
  CONSTRAINT subscribers_email_length CHECK (char_length(email) BETWEEN 3 AND 254)
);`;
