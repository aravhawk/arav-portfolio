import { describe, expect, it } from 'vitest';

import {
  addMonthsUtc,
  chunkDateRange,
  NPM_API_MAX_RANGE_MONTHS,
  npmLastMonthUrl,
  npmPackageUrl,
  npmRangeUrl,
  parseIsoDate,
  parseNpmPoint,
  sumNpmRange,
  toIsoDate,
} from '@/lib/metrics/core/npm.mjs';

import { fixture } from './helpers';

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(start: string, end: string): number {
  return (parseIsoDate(end).getTime() - parseIsoDate(start).getTime()) / DAY + 1;
}

/** Every window is at most 18 months, and together they cover each day once. */
function expectCleanCover(start: string, end: string, windows: Array<{ start: string; end: string }>) {
  expect(windows[0].start).toBe(start);
  expect(windows[windows.length - 1].end).toBe(end);
  let covered = 0;
  windows.forEach((window, index) => {
    expect(window.start <= window.end).toBe(true);
    // At most 18 months: the end falls before the start plus 18 calendar months.
    const limit = addMonthsUtc(parseIsoDate(window.start), NPM_API_MAX_RANGE_MONTHS);
    expect(parseIsoDate(window.end).getTime()).toBeLessThan(limit.getTime());
    if (index > 0) {
      // No gap and no overlap: each window starts the day after the previous one ends.
      const previousEnd = parseIsoDate(windows[index - 1].end).getTime();
      expect(parseIsoDate(window.start).getTime()).toBe(previousEnd + DAY);
    }
    covered += daysBetween(window.start, window.end);
  });
  expect(covered).toBe(daysBetween(start, end));
}

describe('chunkDateRange', () => {
  it('keeps a short range as one window', () => {
    expect(chunkDateRange('2026-02-01', '2026-11-15')).toEqual([{ start: '2026-02-01', end: '2026-11-15' }]);
  });

  it('handles a single day', () => {
    expect(chunkDateRange('2026-02-01', '2026-02-01')).toEqual([{ start: '2026-02-01', end: '2026-02-01' }]);
  });

  it('returns nothing when the range has not started yet', () => {
    expect(chunkDateRange('2026-02-02', '2026-02-01')).toEqual([]);
  });

  it('splits a long range into consecutive windows', () => {
    expect(chunkDateRange('2026-02-01', '2029-03-10')).toEqual([
      { start: '2026-02-01', end: '2027-01-31' },
      { start: '2027-02-01', end: '2028-01-31' },
      { start: '2028-02-01', end: '2029-01-31' },
      { start: '2029-02-01', end: '2029-03-10' },
    ]);
  });

  it.each([
    ['2026-02-01', '2026-11-15'],
    ['2026-02-01', '2027-08-01'],
    ['2026-02-01', '2032-06-30'],
    ['2015-01-10', '2026-11-15'],
    ['2023-08-31', '2026-03-01'],
    ['2024-02-29', '2030-02-28'],
    ['2023-12-31', '2026-01-01'],
  ])('covers %s to %s with no gaps or double-counted days', (start, end) => {
    expectCleanCover(start, end, chunkDateRange(start, end));
  });

  it('also covers cleanly at the 18 month maximum and at one month', () => {
    expectCleanCover('2020-08-31', '2026-11-15', chunkDateRange('2020-08-31', '2026-11-15', 18));
    expectCleanCover('2025-01-31', '2026-11-15', chunkDateRange('2025-01-31', '2026-11-15', 1));
    expect(chunkDateRange('2020-08-31', '2026-11-15', 18).length).toBeLessThan(
      chunkDateRange('2020-08-31', '2026-11-15').length,
    );
  });

  it('refuses windows longer than the API allows, and malformed dates', () => {
    expect(() => chunkDateRange('2026-02-01', '2026-11-15', 19)).toThrow();
    expect(() => chunkDateRange('2026-02-01', '2026-11-15', 0)).toThrow();
    expect(() => chunkDateRange('2026-2-1', '2026-11-15')).toThrow();
    expect(() => chunkDateRange('2026-02-30', '2026-11-15')).toThrow();
  });
});

describe('date helpers', () => {
  it('clamps month ends instead of overflowing', () => {
    expect(toIsoDate(addMonthsUtc(parseIsoDate('2024-08-31'), 18))).toBe('2026-02-28');
    expect(toIsoDate(addMonthsUtc(parseIsoDate('2023-08-31'), 6))).toBe('2024-02-29');
    expect(toIsoDate(addMonthsUtc(parseIsoDate('2026-02-01'), 12))).toBe('2027-02-01');
  });
});

describe('sumNpmRange', () => {
  const range = JSON.parse(fixture('npm-range.json'));
  const window = { start: '2026-02-01', end: '2026-02-14' };

  it('sums the saved range fixture', () => {
    const expected = range.downloads.reduce((sum: number, day: { downloads: number }) => sum + day.downloads, 0);
    expect(expected).toBeGreaterThan(0);
    expect(sumNpmRange(range, window)).toBe(expected);
    expect(range.downloads).toHaveLength(14);
  });

  it('sums several windows into one total', () => {
    const windows = chunkDateRange('2026-02-01', '2028-06-30');
    const responses = windows.map((w, index) => ({
      start: w.start,
      end: w.end,
      downloads: [
        { day: w.start, downloads: 100 * (index + 1) },
        { day: w.end, downloads: 1 },
      ],
    }));
    const total = windows.reduce((sum, w, index) => sum + sumNpmRange(responses[index], w), 0);
    expect(windows).toHaveLength(3);
    expect(total).toBe(100 + 200 + 300 + 3);
  });

  it('accepts an end the API pulled back to its latest day', () => {
    const json = { start: '2026-02-01', end: '2026-02-10', downloads: [{ day: '2026-02-01', downloads: 5 }] };
    expect(sumNpmRange(json, window)).toBe(5);
  });

  it('rejects a response whose start was clamped by the API', () => {
    const json = { start: '2026-02-03', end: '2026-02-14', downloads: [{ day: '2026-02-03', downloads: 5 }] };
    expect(() => sumNpmRange(json, window)).toThrow(/clamped/);
  });

  it('rejects days outside the window, repeated days and bad counts', () => {
    const base = { start: '2026-02-01', end: '2026-02-14' };
    expect(() => sumNpmRange({ ...base, downloads: [{ day: '2026-03-01', downloads: 5 }] }, window)).toThrow(/outside/);
    expect(() =>
      sumNpmRange(
        {
          ...base,
          downloads: [
            { day: '2026-02-02', downloads: 5 },
            { day: '2026-02-02', downloads: 5 },
          ],
        },
        window,
      ),
    ).toThrow(/twice/);
    expect(() => sumNpmRange({ ...base, downloads: [{ day: '2026-02-02', downloads: -1 }] }, window)).toThrow();
    expect(() => sumNpmRange({ ...base, downloads: [{ day: '2026-02-02', downloads: '5' }] }, window)).toThrow();
    expect(() => sumNpmRange({ error: 'package not found' }, window)).toThrow(/no downloads array/);
    expect(() => sumNpmRange(null, window)).toThrow();
  });
});

describe('parseNpmPoint', () => {
  it('reads the saved last-month fixture', () => {
    expect(parseNpmPoint(JSON.parse(fixture('npm-point-last-month.json')))).toBe(478);
  });

  it('rejects an error body', () => {
    expect(() => parseNpmPoint({ error: 'package not found' })).toThrow();
    expect(() => parseNpmPoint({ downloads: 1.5 })).toThrow();
  });
});

describe('urls', () => {
  it('keeps the scoped package name readable', () => {
    expect(npmRangeUrl('@aravhawk/cc-switch', { start: '2026-02-01', end: '2026-11-15' })).toBe(
      'https://api.npmjs.org/downloads/range/2026-02-01:2026-11-15/@aravhawk/cc-switch',
    );
    expect(npmLastMonthUrl('@aravhawk/cc-switch')).toBe(
      'https://api.npmjs.org/downloads/point/last-month/@aravhawk/cc-switch',
    );
    expect(npmPackageUrl('@aravhawk/cc-switch')).toBe('https://www.npmjs.com/package/@aravhawk/cc-switch');
    expect(npmPackageUrl('plain-name')).toBe('https://www.npmjs.com/package/plain-name');
  });
});
