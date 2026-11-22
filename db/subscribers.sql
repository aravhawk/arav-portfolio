-- The newsletter's list. Nothing is sent from it yet: an address is stored, and that is all.
-- Safe to run again: it makes the table only if it is not there. Apply with `pnpm db:apply`.
CREATE TABLE IF NOT EXISTS subscribers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  source      text,
  confirmed   boolean     NOT NULL DEFAULT false,
  CONSTRAINT subscribers_email_key    UNIQUE (email),
  CONSTRAINT subscribers_email_lower  CHECK (email = lower(email)),
  CONSTRAINT subscribers_email_length CHECK (char_length(email) BETWEEN 3 AND 254)
);
