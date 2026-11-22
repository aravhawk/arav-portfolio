// @ts-check
// npm download counts: date range chunking, URLs and response parsing. Pure.

/**
 * The npm downloads API serves at most 18 months per range request (it moves
 * the start forward when asked for more).
 */
export const NPM_API_MAX_RANGE_MONTHS = 18;

/**
 * Window size used here. A year stays well inside the API limit however the
 * API counts month ends, and every response is still checked for clamping.
 */
export const NPM_WINDOW_MONTHS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD in UTC.
 */
export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * @param {string} text YYYY-MM-DD
 * @returns {Date} Midnight UTC of that day.
 */
export function parseIsoDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error(`not a YYYY-MM-DD date: ${text}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (toIsoDate(date) !== text) throw new Error(`not a real date: ${text}`);
  return date;
}

/**
 * Add calendar months in UTC, clamping to the last day of the target month
 * (Aug 31 plus 6 months is Feb 28 or 29, never Mar 3).
 *
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
export function addMonthsUtc(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

/**
 * Split [start, end] (inclusive days) into consecutive windows of at most
 * `maxMonths` calendar months. The windows cover every day exactly once.
 *
 * @param {string} start YYYY-MM-DD
 * @param {string} end YYYY-MM-DD
 * @param {number} [maxMonths]
 * @returns {Array<{ start: string, end: string }>}
 */
export function chunkDateRange(start, end, maxMonths = NPM_WINDOW_MONTHS) {
  if (!Number.isInteger(maxMonths) || maxMonths < 1 || maxMonths > NPM_API_MAX_RANGE_MONTHS) {
    throw new Error(`maxMonths must be 1 to ${NPM_API_MAX_RANGE_MONTHS}`);
  }
  const last = parseIsoDate(end).getTime();
  let cursor = parseIsoDate(start);
  /** @type {Array<{ start: string, end: string }>} */
  const windows = [];
  while (cursor.getTime() <= last) {
    const windowEnd = Math.min(addMonthsUtc(cursor, maxMonths).getTime() - DAY_MS, last);
    windows.push({ start: toIsoDate(cursor), end: toIsoDate(new Date(windowEnd)) });
    cursor = new Date(windowEnd + DAY_MS);
  }
  return windows;
}

/** @param {string} name */
function packagePath(name) {
  // Scoped names keep their "@scope/name" form in the downloads API path.
  return name.split('/').map(encodeURIComponent).join('/').replace(/^%40/, '@');
}

/**
 * @param {string} name
 * @param {{ start: string, end: string }} window
 */
export function npmRangeUrl(name, window) {
  return `https://api.npmjs.org/downloads/range/${window.start}:${window.end}/${packagePath(name)}`;
}

/** @param {string} name */
export function npmLastMonthUrl(name) {
  return `https://api.npmjs.org/downloads/point/last-month/${packagePath(name)}`;
}

/** @param {string} name */
export function npmPackageUrl(name) {
  return `https://www.npmjs.com/package/${packagePath(name)}`;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

/**
 * Sum one range response, refusing anything that would miscount: a clamped
 * start, days outside the window, a day listed twice or a non-integer count.
 *
 * @param {unknown} json
 * @param {{ start: string, end: string }} window The window that was requested.
 * @returns {number}
 */
export function sumNpmRange(json, window) {
  if (!isRecord(json) || !Array.isArray(json.downloads)) {
    throw new Error('npm range response has no downloads array');
  }
  if (json.start !== window.start) {
    throw new Error(`npm clamped the range start to ${String(json.start)} (asked for ${window.start})`);
  }
  const seen = new Set();
  let sum = 0;
  for (const entry of json.downloads) {
    if (!isRecord(entry) || typeof entry.day !== 'string') {
      throw new Error('npm range response has a malformed day');
    }
    const { day, downloads } = entry;
    if (typeof downloads !== 'number' || !Number.isSafeInteger(downloads) || downloads < 0) {
      throw new Error(`npm range response has a bad count for ${day}`);
    }
    if (day < window.start || day > window.end) {
      throw new Error(`npm range response has ${day}, outside ${window.start}:${window.end}`);
    }
    if (seen.has(day)) throw new Error(`npm range response lists ${day} twice`);
    seen.add(day);
    sum += downloads;
  }
  return sum;
}

/**
 * @param {unknown} json
 * @returns {number}
 */
export function parseNpmPoint(json) {
  if (!isRecord(json) || typeof json.downloads !== 'number' || !Number.isSafeInteger(json.downloads) || json.downloads < 0) {
    throw new Error('npm point response has no downloads count');
  }
  return json.downloads;
}
