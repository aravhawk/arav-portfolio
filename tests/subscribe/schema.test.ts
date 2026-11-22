import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUBSCRIBERS_DDL } from '@/lib/subscribe/schema';

/** The statement the site runs for itself and the one `pnpm db:apply` runs must be the same statement. */
describe('the subscribers table', () => {
  const squeeze = (s: string) =>
    s
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('--'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

  it('is the same in db/subscribers.sql and in the site', () => {
    expect(squeeze(SUBSCRIBERS_DDL)).toBe(squeeze(readFileSync('db/subscribers.sql', 'utf8')));
  });

  it('only creates what is missing, and holds the address unique and lower-case', () => {
    expect(SUBSCRIBERS_DDL).toMatch(/^CREATE TABLE IF NOT EXISTS subscribers \(/);
    expect(SUBSCRIBERS_DDL).toMatch(/UNIQUE \(email\)/);
    expect(SUBSCRIBERS_DDL).toMatch(/CHECK \(email = lower\(email\)\)/);
    expect(SUBSCRIBERS_DDL).toMatch(/confirmed\s+boolean\s+NOT NULL DEFAULT false/);
  });
});
