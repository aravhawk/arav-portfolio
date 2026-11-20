/**
 * From where the picture is to what the graph is told. Pure: no audio, no
 * document, no clock. Everything written goes into an object the caller
 * keeps, so a tick allocates nothing.
 */
import type { SceneSound } from './scenes';

/** What the graph is steered by. Gains are linear; `tone` is in hertz; `rate` is ice events a minute. */
export interface Targets {
  wind: number;
  tone: number;
  drift: number;
  run: number;
  fall: number;
  lap: number;
  ice: number;
  rate: number;
}

/** The loudest and the quietest each may ever be told to be. */
export const LIMIT: { readonly [K in keyof Targets]: readonly [number, number] } = {
  wind: [0.05, 0.45],
  tone: [240, 1400],
  drift: [0, 0.3],
  run: [0, 0.5],
  fall: [0, 0.5],
  lap: [0, 0.5],
  ice: [0.1, 1],
  rate: [0.8, 4.5],
};

/** How loud a full measure of each is. Set by ear and by the meter (see .tools/out/s1/REPORT.md). */
export const LEVEL = { wind: 0.36, drift: 0.2, run: 0.5, fall: 0.5, lap: 0.5 };

/** Before dawn everything is a little lower and stiller. */
const NIGHT = { wind: 0.84, tone: 0.84, drift: 0.6, water: 0.82, ice: 0.9, rate: 0.75 };

export const targets = (): Targets => ({ wind: 0, tone: 0, drift: 0, run: 0, fall: 0, lap: 0, ice: 0, rate: 0 });

const clamp = (v: number, [lo, hi]: readonly [number, number]) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Into 0 to 1; a number that is no number is 0. */
const unit = (x: number) => (x > 0 ? (x > 1 ? 1 : x) : 0);

/** How much of the whiteout stands between the two scenes at `mix`: nothing at either end, everything in the middle. */
export function veil(mix: number) {
  const m = unit(mix);
  return smooth(1 - Math.abs(2 * m - 1));
}

/**
 * The picture shows scene `a` with `b` brought in by `mix` through the
 * whiteout, the camera `progress` of the way into `a`. `night`: the dark
 * theme. `still`: reduced motion, where one scene gives way to the next
 * without the wind rising.
 */
export function steer(out: Targets, a: SceneSound, b: SceneSound, mix: number, progress: number, night: boolean, still: boolean): Targets {
  const m = unit(mix);
  const s = smooth(m);
  const v = still ? 0 : veil(m);
  const at = (k: keyof SceneSound) => a[k] + (b[k] - a[k]) * s;
  // The camera's push brings the water a little nearer; the whiteout closes over it.
  const near = (0.82 + 0.18 * unit(progress) * (1 - s)) * (1 - 0.92 * v) * (night ? NIGHT.water : 1);
  const drift = at('drift');
  out.wind = clamp(LEVEL.wind * at('wind') * (1 + 0.9 * v) * (night ? NIGHT.wind : 1), LIMIT.wind);
  out.tone = clamp((330 + 260 * drift + 620 * v) * (night ? NIGHT.tone : 1), LIMIT.tone);
  out.drift = clamp(LEVEL.drift * (drift + (1 - drift) * 0.9 * v) * (night ? NIGHT.drift : 1), LIMIT.drift);
  out.run = clamp(LEVEL.run * at('run') * near, LIMIT.run);
  out.fall = clamp(LEVEL.fall * at('fall') * near, LIMIT.fall);
  out.lap = clamp(LEVEL.lap * at('lap') * near, LIMIT.lap);
  out.ice = clamp((1 - 0.85 * v) * (night ? NIGHT.ice : 1), LIMIT.ice);
  out.rate = clamp((1.1 + 3.2 * at('ice')) * (night ? NIGHT.rate : 1), LIMIT.rate);
  return out;
}

/** Seconds until the ice next speaks, at `rate` events a minute: never soon, never on a beat. `u` is a random number in [0, 1). */
export const gap = (rate: number, u: number) => (60 / rate) * (0.5 + 1.1 * u);

/** A small seeded generator (mulberry32): the same walk renders the same file. */
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
