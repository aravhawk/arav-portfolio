/**
 * The one smoothing the picture follows the scroll through: a critically
 * damped spring, stepped in closed form, so where it stands after a second
 * is the same whether that second was 60 frames or 120 (or three long
 * ones). It starts gently, never overshoots, and has covered nine tenths
 * of a step after `SETTLE_90` seconds.
 */

/** Seconds for nine tenths of a step. */
export const SETTLE_90 = 0.55;
/** The spring's natural frequency for that: (1 + wt) e^(-wt) = 0.1 at wt = 3.8897. */
export const OMEGA = 3.8897 / SETTLE_90;

export interface Follow {
  x: number;
  v: number;
}

/** Step `f` toward `goal` over `dt` seconds. Changes `f` in place. */
export function follow(f: Follow, goal: number, dt: number, omega = OMEGA) {
  const d = f.x - goal;
  const e = Math.exp(-omega * dt);
  const c = f.v + omega * d;
  f.x = goal + (d + c * dt) * e;
  f.v = (f.v - omega * c * dt) * e;
}
