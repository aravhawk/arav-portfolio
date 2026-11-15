// @ts-check
// Ollama profile and model page parsers. Pure: HTML text in, plain data out.

import { parseCount } from './count.mjs';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** @param {string} user */
export function ollamaProfileUrl(user) {
  return `https://ollama.com/${encodeURIComponent(user)}`;
}

/**
 * @param {string} user
 * @param {string} model
 */
export function ollamaModelUrl(user, model) {
  return `${ollamaProfileUrl(user)}/${encodeURIComponent(model)}`;
}

/** @param {string} text */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reduce an HTML fragment to its visible text.
 * @param {string} html
 */
export function htmlToText(html) {
  return html
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;| /gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse the absolute time Ollama puts in a title attribute,
 * for example "Apr 11, 2025 2:23 AM UTC".
 *
 * @param {string} text
 * @returns {string | null} ISO 8601 time, or null when the text is not such a date.
 */
export function parseOllamaDate(text) {
  const match =
    /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})(?:,? (\d{1,2}):(\d{2})(?: ?([AP]M))?)?(?: UTC)?$/i.exec(
      text.trim(),
    );
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase());
  if (month < 0) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  let hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  const meridiem = match[6] ? match[6].toUpperCase() : null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  const date = new Date(Date.UTC(year, month, day, hour, minute));
  // Reject overflow such as "Feb 31".
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date.toISOString();
}

/**
 * Find the pull count in a fragment. Today the count is the span right before
 * "&nbsp;Pulls" (profile rows) or "&nbsp;Downloads" (model pages); if that
 * structure changes, fall back to the visible text "<count> Pulls".
 *
 * @param {string} html
 * @returns {number | null}
 */
export function extractPulls(html) {
  const structured =
    /<span\b[^>]*>\s*([^<>]+?)\s*<\/span>\s*<span\b[^>]*>(?:\s|&nbsp;|&#160;| )*(?:Pulls?|Downloads?)\s*<\/span>/i.exec(
      html,
    );
  if (structured) {
    const count = parseCount(structured[1]);
    if (count !== null) return count;
  }
  const loose = /(\d[\d.,]*\s?[KMB]?)\s+(?:Pulls?|Downloads?)\b/i.exec(htmlToText(html));
  return loose ? parseCount(loose[1]) : null;
}

/**
 * Find the first title attribute that holds an absolute date.
 *
 * @param {string} html
 * @returns {string | null}
 */
export function extractUpdatedAt(html) {
  for (const match of html.matchAll(/\btitle="([^"]*)"/g)) {
    const iso = parseOllamaDate(match[1]);
    if (iso) return iso;
  }
  return null;
}

/**
 * Parse a profile page (https://ollama.com/<user>) into its models.
 * Every link to /<user>/<model> is a model, so new models appear on their own.
 *
 * @param {string} html
 * @param {string} user
 * @returns {Array<{ name: string, pulls: number | null, updatedAt: string | null }>}
 */
export function parseOllamaProfile(html, user) {
  const link = new RegExp(
    `<a\\b[^>]*\\bhref="(?:https?://(?:www\\.)?ollama\\.com)?/${escapeRegExp(user)}/([^"/?#:]+)/?"[^>]*>([\\s\\S]*?)</a>`,
    'gi',
  );
  /** @type {Map<string, { name: string, pulls: number | null, updatedAt: string | null }>} */
  const models = new Map();
  for (const match of html.matchAll(link)) {
    let name;
    try {
      name = decodeURIComponent(match[1]).trim();
    } catch {
      continue;
    }
    if (!name) continue;
    const pulls = extractPulls(match[2]);
    const updatedAt = extractUpdatedAt(match[2]);
    const known = models.get(name);
    if (!known) {
      models.set(name, { name, pulls, updatedAt });
    } else {
      if (known.pulls === null) known.pulls = pulls;
      if (known.updatedAt === null) known.updatedAt = updatedAt;
    }
  }
  return [...models.values()];
}

/**
 * Parse one model page (https://ollama.com/<user>/<model>).
 *
 * @param {string} html
 * @returns {{ pulls: number | null, updatedAt: string | null }}
 */
export function parseOllamaModelPage(html) {
  return { pulls: extractPulls(html), updatedAt: extractUpdatedAt(html) };
}

/**
 * Cross-check the profile row against the model page. Both read the same
 * cumulative counter, so when they differ (a cache a few minutes apart, or
 * one page abbreviating to "12.3K") the larger one is the better reading.
 *
 * @param {number | null} profilePulls
 * @param {number | null} pagePulls
 * @returns {{ pulls: number | null, agrees: boolean, checked: boolean }}
 *   `checked` is true when both pages gave a count; `agrees` when they match
 *   exactly or to the precision of an abbreviated count (within 5%).
 */
export function crossCheckPulls(profilePulls, pagePulls) {
  const a = typeof profilePulls === 'number' && profilePulls > 0 ? profilePulls : null;
  const b = typeof pagePulls === 'number' && pagePulls > 0 ? pagePulls : null;
  if (a === null || b === null) {
    return { pulls: a ?? b, agrees: false, checked: false };
  }
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return { pulls: high, agrees: high - low <= high * 0.05, checked: true };
}
