/**
 * The number a readout shows `t` of the way through its count from `from` to `value` (t is 0 to 1).
 *
 * It never leaves the two ends and never goes below zero. A frame's own timestamp can be earlier than the time
 * the count started (a page measured with a different clock, or a frame already queued), which makes `t` negative;
 * with the quartic ease that once drew a download count of -571 on its way to 712.
 */
export function countAt(from: number, value: number, t: number): number {
  const p = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  const eased = 1 - Math.pow(1 - p, 4);
  const n = Math.round(from + (value - from) * eased);
  return Math.max(0, Math.min(Math.max(from, value), Math.max(Math.min(from, value), n)));
}
