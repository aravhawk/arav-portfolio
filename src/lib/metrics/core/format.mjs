// @ts-check
// Display helpers. Pure and dependency-free, so they are safe to import from
// client components as well as the server.

const AS_OF = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/**
 * Format an ISO time in Central Time, for example "Nov 15, 2026, 4:40 AM CT".
 * Returns an empty string for anything that is not a date.
 *
 * @param {string} iso
 * @returns {string}
 */
export function formatAsOf(iso) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  // Some ICU versions put a narrow no-break space before AM/PM.
  return `${AS_OF.format(new Date(time)).replace(/[  ]/g, ' ')} CT`;
}

const COUNT = new Intl.NumberFormat('en-US');

/**
 * Format a count with thousands separators, for example 18284 -> "18,284".
 *
 * @param {number} value
 * @returns {string}
 */
export function formatCount(value) {
  return COUNT.format(value);
}
