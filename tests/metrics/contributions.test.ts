import { describe, expect, it } from 'vitest';

import {
  contributionsUrl,
  isYearFinalInSnapshot,
  lifetimeYears,
  parseContributions,
  parseContributionsFor,
  parseContributionsHeading,
  sumContributionDays,
} from '@/lib/metrics/core/contributions.mjs';

import { contributionsHtml, fixture } from './helpers';

describe('parseContributions (saved fixtures)', () => {
  it('reads a calendar year: heading and per-day sum agree', () => {
    const parsed = parseContributions(fixture('contributions-2022.html'));
    expect(parsed.total).toBe(16);
    expect(parsed.period).toEqual({ kind: 'year', year: 2022 });
    expect(parsed.daySum).toBe(16);
    expect(parsed.activeDays).toBeGreaterThan(0);
    expect(parsed.days).toBeGreaterThan(parsed.activeDays);
  });

  it('reads the rolling last year, with a thousands separator in the heading', () => {
    const html = fixture('contributions-last-year.html');
    expect(parseContributionsHeading(html)).toEqual({ total: 2729, period: { kind: 'last-year' } });
    const parsed = parseContributions(html);
    expect(parsed.total).toBe(2729);
    expect(parsed.daySum).toBe(2729);
  });

  it('counts "1 contribution", "N contributions" and "No contributions" days', () => {
    const { sum, days, activeDays } = sumContributionDays(fixture('contributions-last-year.html'));
    expect(sum).toBe(2729);
    expect(days).toBe(activeDays + 3);
  });

  it('checks the fixture is for the period that was asked for', () => {
    expect(parseContributionsFor(fixture('contributions-2022.html'), 2022)).toBe(16);
    expect(parseContributionsFor(fixture('contributions-last-year.html'), null)).toBe(2729);
    expect(() => parseContributionsFor(fixture('contributions-2022.html'), 2026)).toThrow(/2026/);
    expect(() => parseContributionsFor(fixture('contributions-2022.html'), null)).toThrow(/last year/);
    expect(() => parseContributionsFor(fixture('contributions-last-year.html'), 2026)).toThrow(/2026/);
  });
});

describe('parseContributions (cross-check and failures)', () => {
  it('accepts a heading that matches the per-day sum', () => {
    expect(parseContributions(contributionsHtml(2612, 2026)).total).toBe(2612);
    expect(parseContributions(contributionsHtml(1, 2023)).total).toBe(1);
    expect(parseContributions(contributionsHtml(0, 2027)).total).toBe(0);
  });

  it('rejects a heading that disagrees with the per-day sum', () => {
    expect(() => parseContributions(contributionsHtml(2612, 2026, 2000))).toThrow(
      /heading says 2612 but the per-day counts sum to 2000/,
    );
  });

  it('rejects a page with no heading', () => {
    expect(() => parseContributions('<html><body>Sign in to GitHub</body></html>')).toThrow(/heading not found/);
  });

  it('rejects a page with a heading but nothing to cross-check it against', () => {
    const html = '<h2 id="js-contribution-activity-description">2,612 contributions in 2026</h2>';
    expect(() => parseContributions(html)).toThrow(/no per-day contribution tooltips/);
  });

  it('is not fooled by a per-day tooltip when the heading is missing', () => {
    const html = '<table><tr><tool-tip for="x">6 contributions on January 18th.</tool-tip></tr></table>';
    expect(parseContributionsHeading(html)).toBeNull();
  });

  it('finds the heading even if it stops being an h2', () => {
    const html = `<div class="title">1,234 contributions in 2026</div>
      <table><tr><tool-tip for="x">1,234 contributions on March 3rd.</tool-tip></tr></table>`;
    expect(parseContributions(html).total).toBe(1234);
  });
});

describe('contributionsUrl', () => {
  it('builds the year and rolling URLs', () => {
    expect(contributionsUrl('aravhawk', 2026)).toBe(
      'https://github.com/users/aravhawk/contributions?from=2026-01-01&to=2026-12-31',
    );
    expect(contributionsUrl('aravhawk')).toBe('https://github.com/users/aravhawk/contributions');
    expect(contributionsUrl('aravhawk', null)).toBe('https://github.com/users/aravhawk/contributions');
  });
});

describe('lifetime years', () => {
  it('lists every year from the account creation year to now', () => {
    expect(lifetimeYears(2021, new Date('2026-11-15T12:00:00Z'))).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    expect(lifetimeYears(2021, new Date('2027-01-01T00:00:01Z'))).toHaveLength(7);
  });

  it('treats a past year as final only once the snapshot was taken after it ended', () => {
    expect(isYearFinalInSnapshot(2025, '2026-11-09T11:00:00Z')).toBe(true);
    expect(isYearFinalInSnapshot(2026, '2026-11-09T11:00:00Z')).toBe(false);
    expect(isYearFinalInSnapshot(2026, '2026-12-28T11:00:00Z')).toBe(false);
    expect(isYearFinalInSnapshot(2026, '2027-01-01T06:00:00Z')).toBe(false);
    expect(isYearFinalInSnapshot(2026, '2027-01-04T11:00:00Z')).toBe(true);
    expect(isYearFinalInSnapshot(2026, 'not a date')).toBe(false);
  });
});
