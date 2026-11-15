// @ts-check
// GitHub contributions calendar parser. Pure: HTML text in, plain data out.

import { parseCount } from './count.mjs';

/**
 * URL of the contributions fragment GitHub serves for a profile.
 *
 * @param {string} user
 * @param {number | null} [year] A calendar year, or null for the rolling last year.
 */
export function contributionsUrl(user, year = null) {
  const base = `https://github.com/users/${encodeURIComponent(user)}/contributions`;
  return year === null ? base : `${base}?from=${year}-01-01&to=${year}-12-31`;
}

/**
 * Public page a person can open to see the same calendar.
 *
 * @param {string} user
 */
export function contributionsProfileUrl(user) {
  return `https://github.com/${encodeURIComponent(user)}`;
}

/**
 * @typedef {{ kind: 'year', year: number } | { kind: 'last-year' }} ContributionsPeriod
 */

const HEADING = /(\d[\d,.]*\s?[KMB]?)\s+contributions?\s+in\s+(the\s+last\s+year|\d{4})\b/i;

/** @param {string} html */
function toText(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Read the "N contributions in 2026" / "N contributions in the last year" heading.
 *
 * @param {string} html
 * @returns {{ total: number, period: ContributionsPeriod } | null}
 */
export function parseContributionsHeading(html) {
  const candidates = [];
  for (const match of html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)) {
    candidates.push(toText(match[1]));
  }
  // If the heading stops being an h2, look at the whole text before the calendar.
  candidates.push(toText(html.split(/<table\b/i)[0]));
  for (const text of candidates) {
    const match = HEADING.exec(text);
    if (!match) continue;
    const total = parseCount(match[1]);
    if (total === null) continue;
    /** @type {ContributionsPeriod} */
    const period = /^\d{4}$/.test(match[2])
      ? { kind: 'year', year: Number(match[2]) }
      : { kind: 'last-year' };
    return { total, period };
  }
  return null;
}

/**
 * Sum the per-day tooltips ("6 contributions on January 18th.",
 * "1 contribution on October 16th.", "No contributions on January 4th.").
 *
 * @param {string} html
 * @returns {{ sum: number, days: number, activeDays: number }}
 */
export function sumContributionDays(html) {
  let sum = 0;
  let days = 0;
  let activeDays = 0;
  for (const match of html.matchAll(/<tool-tip\b[^>]*>([\s\S]*?)<\/tool-tip>/gi)) {
    const text = toText(match[1]);
    const counted = /^(\d[\d,]*)\s+contributions?\s+on\s/i.exec(text);
    if (counted) {
      const count = parseCount(counted[1]);
      if (count === null) continue;
      sum += count;
      days += 1;
      if (count > 0) activeDays += 1;
    } else if (/^No\s+contributions?\s+on\s/i.test(text)) {
      days += 1;
    }
  }
  return { sum, days, activeDays };
}

/**
 * Parse a contributions fragment and cross-check the heading against the sum
 * of the per-day tooltips. Throws when the heading is missing, when there are
 * no per-day tooltips to check against, or when the two numbers disagree.
 *
 * @param {string} html
 * @returns {{ total: number, period: ContributionsPeriod, daySum: number, days: number, activeDays: number }}
 */
export function parseContributions(html) {
  const heading = parseContributionsHeading(html);
  if (!heading) throw new Error('contributions heading not found');
  const { sum, days, activeDays } = sumContributionDays(html);
  if (days === 0) throw new Error('no per-day contribution tooltips found');
  if (sum !== heading.total) {
    throw new Error(`heading says ${heading.total} but the per-day counts sum to ${sum}`);
  }
  return { total: heading.total, period: heading.period, daySum: sum, days, activeDays };
}

/**
 * Parse a fragment and check it is for the period that was asked for.
 *
 * @param {string} html
 * @param {number | null} year A calendar year, or null for the rolling last year.
 * @returns {number}
 */
export function parseContributionsFor(html, year) {
  const parsed = parseContributions(html);
  if (year === null) {
    if (parsed.period.kind !== 'last-year') {
      throw new Error('expected the "in the last year" heading');
    }
  } else if (parsed.period.kind !== 'year' || parsed.period.year !== year) {
    throw new Error(`expected the heading for ${year}`);
  }
  return parsed.total;
}

/**
 * Calendar years in the lifetime sum, oldest first.
 *
 * @param {number} startYear
 * @param {Date} now
 * @returns {number[]}
 */
export function lifetimeYears(startYear, now) {
  const years = [];
  for (let year = startYear; year <= now.getUTCFullYear(); year += 1) years.push(year);
  return years;
}

/**
 * A past year is immutable once the snapshot was taken safely after it ended
 * (a day and a half of margin covers every time zone).
 *
 * @param {number} year
 * @param {string} snapshotRetrievedAt ISO time of the snapshot section.
 * @returns {boolean}
 */
export function isYearFinalInSnapshot(year, snapshotRetrievedAt) {
  const taken = Date.parse(snapshotRetrievedAt);
  if (!Number.isFinite(taken)) return false;
  return taken >= Date.UTC(year + 1, 0, 2, 12);
}
