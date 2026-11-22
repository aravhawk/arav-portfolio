import { describe, expect, it, vi } from 'vitest';
import { sourceOf, subscribe, type SubscribeDeps } from '@/lib/subscribe/core';
import { createLimiter } from '@/lib/subscribe/limiter';
import { EMAIL_MAX, isValidEmail, normalizeEmail, OUTCOMES, SAY } from '@/lib/subscribe/messages';

/** A stand-in for the table: a set of addresses, as the unique constraint keeps them. */
function table() {
  const rows = new Map<string, string>();
  const insert = vi.fn(async (email: string, source: string) => {
    if (rows.has(email)) return 'exists' as const;
    rows.set(email, source);
    return 'inserted' as const;
  });
  return { rows, insert };
}
const deps = (over: Partial<SubscribeDeps> = {}): SubscribeDeps => ({ insert: table().insert, limiter: createLimiter({ salt: 's' }), ...over });

describe('an address, normalised', () => {
  it('is trimmed and lower-cased', () => {
    expect(normalizeEmail('  Reader@Example.COM \n')).toBe('reader@example.com');
  });
  it('is empty for anything that is not text', () => {
    for (const v of [undefined, null, 7, {}, ['a@b.co']]) expect(normalizeEmail(v)).toBe('');
  });
});

describe('an address, checked', () => {
  it('takes ordinary addresses', () => {
    for (const ok of ['a@b.co', 'first.last+tag@sub.example.com', 'x_y-z@example.io']) expect(isValidEmail(ok)).toBe(true);
  });
  it('refuses what cannot be one', () => {
    for (const bad of ['', 'plain', '@example.com', 'a@', 'a@b', 'a@b..co', 'a@.co', 'a@example.com.', 'a b@example.com', 'a@b@c.co', 'a@exa mple.com']) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
  it('caps the length at 254', () => {
    const at = '@example.com';
    expect(isValidEmail('a'.repeat(EMAIL_MAX - at.length) + at)).toBe(true);
    expect(isValidEmail('a'.repeat(EMAIL_MAX - at.length + 1) + at)).toBe(false);
  });
});

describe('subscribing', () => {
  it('stores a new address in lower case, with where it came from', async () => {
    const t = table();
    const r = await subscribe({ email: ' New.Reader@Example.com ', source: 'blog', address: '1.1.1.1' }, deps({ insert: t.insert }));
    expect(r).toEqual({ outcome: 'subscribed' });
    expect(t.insert).toHaveBeenCalledWith('new.reader@example.com', 'blog');
    expect([...t.rows.keys()]).toEqual(['new.reader@example.com']);
  });

  it('answers "already" for a duplicate, whatever its case, and keeps one row', async () => {
    const t = table();
    const d = deps({ insert: t.insert });
    await subscribe({ email: 'reader@example.com', address: '1.1.1.1' }, d);
    const again = await subscribe({ email: 'READER@example.com', address: '1.1.1.1' }, d);
    expect(again).toEqual({ outcome: 'already' });
    expect(t.rows.size).toBe(1);
  });

  it('answers "invalid" for a bad address and never reaches the database', async () => {
    for (const email of ['nope', '', undefined, 'a@b', `${'a'.repeat(250)}@example.com`]) {
      const t = table();
      expect(await subscribe({ email, address: '1.1.1.1' }, deps({ insert: t.insert }))).toEqual({ outcome: 'invalid' });
      expect(t.insert).not.toHaveBeenCalled();
    }
  });

  it('gives a filled honeypot the friendly answer and stores nothing', async () => {
    const t = table();
    const r = await subscribe({ email: 'robot@example.com', honeypot: 'https://spam.example', address: '1.1.1.1' }, deps({ insert: t.insert }));
    expect(r).toEqual({ outcome: 'subscribed' });
    expect(t.insert).not.toHaveBeenCalled();
    expect(t.rows.size).toBe(0);
  });

  it('treats an empty or blank honeypot as a reader', async () => {
    const t = table();
    const d = deps({ insert: t.insert });
    await subscribe({ email: 'a@example.com', honeypot: '', address: '1.1.1.1' }, d);
    await subscribe({ email: 'b@example.com', honeypot: '  ', address: '1.1.1.1' }, d);
    expect(t.rows.size).toBe(2);
  });

  it('answers "failed" when the database throws, and says nothing of why', async () => {
    const insert = vi.fn(async () => {
      throw new Error('the database refused: password hunter2');
    });
    const r = await subscribe({ email: 'reader@example.com', address: '1.1.1.1' }, deps({ insert }));
    expect(r).toEqual({ outcome: 'failed' });
    expect(JSON.stringify(r)).not.toMatch(/hunter2|password/);
  });

  it('answers "limited" before anything else once the requester is over the limit', async () => {
    const t = table();
    const d = deps({ insert: t.insert, limiter: createLimiter({ perMinute: 2, salt: 's' }), now: () => 1_000 });
    await subscribe({ email: 'a@example.com', address: '9.9.9.9' }, d);
    await subscribe({ email: 'b@example.com', address: '9.9.9.9' }, d);
    const third = await subscribe({ email: 'c@example.com', address: '9.9.9.9' }, d);
    expect(third.outcome).toBe('limited');
    expect(third.retryAfter).toBe(60);
    expect(t.rows.size).toBe(2);
    // Another requester is not held up.
    expect((await subscribe({ email: 'c@example.com', address: '8.8.8.8' }, d)).outcome).toBe('subscribed');
  });

  it('keeps only the sources it knows', () => {
    expect(sourceOf('home')).toBe('home');
    expect(sourceOf('blog')).toBe('blog');
    for (const v of ['evil', '', null, undefined, 3]) expect(sourceOf(v)).toBe('page');
  });
});

describe('the limiter', () => {
  it('lets a few through a minute, then says how long to wait, then lets through again', () => {
    const l = createLimiter({ perMinute: 3, perDay: 100, salt: 's' });
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(l.take('a', t0 + i * 1000).ok).toBe(true);
    expect(l.take('a', t0 + 3000)).toEqual({ ok: false, retryAfter: 57 });
    // A refused try is not counted: the wait does not grow.
    expect(l.take('a', t0 + 59_999)).toEqual({ ok: false, retryAfter: 1 });
    expect(l.take('a', t0 + 60_000).ok).toBe(true);
  });

  it('holds a requester to the day', () => {
    const l = createLimiter({ perMinute: 2, perDay: 4, salt: 's' });
    const t0 = 5_000_000;
    const minute = 60_000;
    for (let i = 0; i < 4; i++) expect(l.take('a', t0 + i * minute).ok).toBe(true);
    const over = l.take('a', t0 + 10 * minute);
    expect(over.ok).toBe(false);
    expect(over).toMatchObject({ retryAfter: 24 * 3600 - 600 });
    expect(l.take('a', t0 + 24 * 60 * minute).ok).toBe(true);
  });

  it('counts each requester apart', () => {
    const l = createLimiter({ perMinute: 1, salt: 's' });
    expect(l.take('a', 1).ok).toBe(true);
    expect(l.take('b', 1).ok).toBe(true);
    expect(l.take('a', 2).ok).toBe(false);
  });

  it('forgets the stalest requester when it is full', () => {
    const l = createLimiter({ perMinute: 1, maxTracked: 2, salt: 's' });
    l.take('a', 1);
    l.take('b', 2);
    l.take('c', 3);
    expect(l.size()).toBe(2);
    // `a` was forgotten, so it passes again; `c` is still held.
    expect(l.take('a', 4).ok).toBe(true);
    expect(l.take('c', 5).ok).toBe(false);
  });
});

describe('the sentences', () => {
  it('has one for every answer, in plain punctuation', () => {
    for (const o of OUTCOMES) {
      expect(SAY[o].length).toBeGreaterThan(10);
      expect(SAY[o]).not.toMatch(/[–—]/);
    }
  });
});
