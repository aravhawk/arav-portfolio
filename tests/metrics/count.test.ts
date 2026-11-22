import { describe, expect, it } from 'vitest';

import { checkLive, parseCount, pickCumulative, pickRolling } from '@/lib/metrics/core/count.mjs';

describe('parseCount', () => {
  it.each([
    ['9,441', 9441],
    ['12.3K', 12300],
    ['1.2M', 1200000],
    ['198', 198],
    ['0', 0],
    ['1,234,567', 1234567],
    ['12.3k', 12300],
    ['7K', 7000],
    ['2.5B', 2500000000],
    ['1,234.5K', 1234500],
    ['  9,441 ', 9441],
    ['9,441&nbsp;', 9441],
    ['12.3 K', 12300],
  ])('reads %j as %d', (text, expected) => {
    expect(parseCount(text)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'abc',
    'N/A',
    '-5',
    '12.5',
    '1.2.3K',
    '9,44',
    '9,4411',
    '1e3',
    'K',
    '12K pulls',
    'Infinity',
    'NaN',
  ])('rejects %j', (text) => {
    expect(parseCount(text)).toBeNull();
  });

  it('rejects values that are not text or whole numbers', () => {
    expect(parseCount(null)).toBeNull();
    expect(parseCount(undefined)).toBeNull();
    expect(parseCount({})).toBeNull();
    expect(parseCount(1.5)).toBeNull();
    expect(parseCount(-1)).toBeNull();
    expect(parseCount(Number.NaN)).toBeNull();
    expect(parseCount(42)).toBe(42);
  });
});

describe('checkLive', () => {
  it('accepts a positive integer', () => {
    expect(checkLive(21)).toEqual({ ok: true, value: 21 });
  });

  it.each<[unknown, string]>([
    [0, 'zero'],
    [-3, 'negative'],
    [1.5, 'fractional'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'infinite'],
    ['21', 'text'],
    [null, 'null'],
    [undefined, 'undefined'],
  ])('rejects %s (%s)', (value) => {
    expect(checkLive(value).ok).toBe(false);
  });

  it('allows zero only when asked', () => {
    expect(checkLive(0, { allowZero: true })).toEqual({ ok: true, value: 0 });
    expect(checkLive(-1, { allowZero: true }).ok).toBe(false);
  });

  it('requires a cumulative value to be at least 0.9 x the snapshot', () => {
    expect(checkLive(900, { baseline: 1000 }).ok).toBe(true);
    expect(checkLive(899, { baseline: 1000 }).ok).toBe(false);
    expect(checkLive(5000, { baseline: 1000 }).ok).toBe(true);
    expect(checkLive(18, { baseline: 21 }).ok).toBe(false);
    expect(checkLive(19, { baseline: 21 }).ok).toBe(true);
  });
});

describe('pickCumulative', () => {
  it('shows the live value when it is valid and not below the snapshot', () => {
    expect(pickCumulative(1010, 1000)).toEqual({ value: 1010, live: true, reason: null });
    expect(pickCumulative(1000, 1000)).toEqual({ value: 1000, live: true, reason: null });
  });

  it('shows max(live, snapshot) when the live value dipped a little', () => {
    expect(pickCumulative(950, 1000)).toEqual({ value: 1000, live: false, reason: null });
  });

  it('falls back to the snapshot when the live value is implausibly low', () => {
    const picked = pickCumulative(500, 1000);
    expect(picked.value).toBe(1000);
    expect(picked.live).toBe(false);
    expect(picked.reason).toMatch(/below 0\.9 x the snapshot value 1000/);
  });

  it.each([0, -1, 2.5, Number.NaN, null, undefined, '1000'])('falls back to the snapshot for %s', (bad) => {
    const picked = pickCumulative(bad, 1000);
    expect(picked.value).toBe(1000);
    expect(picked.live).toBe(false);
    expect(picked.reason).toBeTruthy();
  });

  it('takes a valid live value when there is no snapshot value yet', () => {
    expect(pickCumulative(7, null)).toEqual({ value: 7, live: true, reason: null });
    expect(pickCumulative(null, null).value).toBeNull();
  });

  it('lets --force accept a lower live value, but never an invalid one', () => {
    expect(pickCumulative(500, 1000, { force: true })).toEqual({ value: 500, live: true, reason: null });
    expect(pickCumulative(0, 1000, { force: true }).value).toBe(1000);
  });
});

describe('pickRolling', () => {
  it('takes any valid live value, lower or higher, with no max', () => {
    expect(pickRolling(280, 478)).toEqual({ value: 280, live: true, reason: null });
    expect(pickRolling(900, 478)).toEqual({ value: 900, live: true, reason: null });
  });

  it('falls back to the snapshot when the live value is invalid', () => {
    expect(pickRolling(0, 478)).toMatchObject({ value: 478, live: false });
    expect(pickRolling(Number.NaN, 478)).toMatchObject({ value: 478, live: false });
    expect(pickRolling(null, 478)).toMatchObject({ value: 478, live: false });
  });
});
