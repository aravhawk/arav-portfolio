// @ts-check
// Pure helpers for reading and validating counts. No imports, no I/O:
// shared by the Next runtime, scripts/refresh-metrics.mjs and the tests.

/** @type {Record<string, number>} */
const MULTIPLIERS = { k: 1e3, m: 1e6, b: 1e9 };

/** Reason given when there was simply nothing fetched to validate. */
export const NO_LIVE_VALUE = 'no live value';

const SPACE_ENTITIES = /&nbsp;|&#160;|&#xa0;|[   ]/gi;

/**
 * Parse a human formatted count such as "9,441", "12.3K" or "1.2M".
 *
 * @param {unknown} input
 * @returns {number | null} A non-negative integer, or null when the text is not a count.
 */
export function parseCount(input) {
  if (typeof input === 'number') {
    return Number.isSafeInteger(input) && input >= 0 ? input : null;
  }
  if (typeof input !== 'string') return null;
  const text = input.replace(SPACE_ENTITIES, ' ').trim();
  const match = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*([kmb])?$/i.exec(text);
  if (!match) return null;
  const whole = match[1].replace(/,/g, '');
  const fraction = match[2] ?? '';
  const suffix = match[3] ? match[3].toLowerCase() : '';
  // "12.5" with no suffix is not a whole count.
  if (fraction && !suffix) return null;
  const value = Math.round(Number(whole + fraction) * (suffix ? MULTIPLIERS[suffix] : 1));
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validate one freshly fetched value.
 * Rules: a finite integer, greater than zero (or zero when `allowZero`), and,
 * when a snapshot baseline is given, at least `minRatio` times that baseline.
 *
 * @param {unknown} live
 * @param {{ baseline?: number | null, minRatio?: number, allowZero?: boolean }} [options]
 * @returns {{ ok: true, value: number } | { ok: false, reason: string }}
 */
export function checkLive(live, options = {}) {
  const { baseline = null, minRatio = 0.9, allowZero = false } = options;
  if (live === null || live === undefined) return { ok: false, reason: NO_LIVE_VALUE };
  if (typeof live !== 'number' || !Number.isFinite(live)) {
    return { ok: false, reason: `not a finite number (${String(live)})` };
  }
  if (!Number.isSafeInteger(live)) return { ok: false, reason: `not an integer (${live})` };
  if (live < 0 || (live === 0 && !allowZero)) {
    return { ok: false, reason: `not greater than zero (${live})` };
  }
  if (baseline !== null && live < minRatio * baseline) {
    return {
      ok: false,
      reason: `${live} is below ${minRatio} x the snapshot value ${baseline}`,
    };
  }
  return { ok: true, value: live };
}

/**
 * Resolve a cumulative counter: the shown value is max(live, snapshot), and
 * any invalid live value falls back to the snapshot.
 *
 * @param {unknown} live
 * @param {number | null | undefined} snapshotValue
 * @param {{ minRatio?: number, allowZero?: boolean, force?: boolean }} [options]
 * @returns {{ value: number | null, live: boolean, reason: string | null }}
 *   `live` is true only when the shown value is the live one. `value` is null
 *   when there is neither a valid live value nor a snapshot value.
 */
export function pickCumulative(live, snapshotValue, options = {}) {
  const { minRatio = 0.9, allowZero = false, force = false } = options;
  const baseline = isNonNegativeInteger(snapshotValue) ? snapshotValue : null;
  const check = checkLive(live, { baseline: force ? null : baseline, minRatio, allowZero });
  if (!check.ok) return { value: baseline, live: false, reason: check.reason };
  if (force || baseline === null || check.value >= baseline) {
    return { value: check.value, live: true, reason: null };
  }
  return { value: baseline, live: false, reason: null };
}

/**
 * Resolve a rolling (non cumulative) value: live when valid, else the snapshot.
 *
 * @param {unknown} live
 * @param {number | null | undefined} snapshotValue
 * @returns {{ value: number | null, live: boolean, reason: string | null }}
 */
export function pickRolling(live, snapshotValue) {
  const baseline = isNonNegativeInteger(snapshotValue) ? snapshotValue : null;
  const check = checkLive(live);
  if (!check.ok) return { value: baseline, live: false, reason: check.reason };
  return { value: check.value, live: true, reason: null };
}
