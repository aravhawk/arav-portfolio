/**
 * The flight's camera: a short list of key poses at scroll positions, joined
 * smoothly. It is a pure function of scroll, so it reverses exactly.
 *
 * Scroll is measured in screens (scrollY over the viewport's height). Each
 * station is held for a stretch of scroll by two keys that differ a little,
 * so a held frame still drifts.
 */

import { NAME, SLAB, nameLayout } from './world';

export type V3 = [number, number, number];

export interface Pose {
  pos: V3;
  aim: V3;
  /** vertical field of view, degrees */
  fov: number;
}

export interface Key extends Pose {
  /** scroll position in screens */
  s: number;
}

/** How long each section of the page is, in screens. */
export const SECTIONS = { hero: 2.4, say: 2.2, infiniview: 2.6, runout: 2.0 };
/** The whole flight's length in screens. The last screen of it is the hand-over to the ending. */
export const FLIGHT_SCREENS = SECTIONS.hero + SECTIONS.say + SECTIONS.infiniview + SECTIONS.runout;
/** Scroll (in screens) over which the lake's ice melts. */
export const MELT = { from: 0.12, to: 1.95 };

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * A camera that looks along +y and down by `pitch`, placed so a target on
 * the ground is seen `sight` degrees below the horizon and a width there
 * fills `share` of the frame's width.
 */
function fit(target: [number, number], width: number, share: number, sight: number, pitch: number, fov: number, aspect: number): Pose {
  const th = Math.tan(rad(fov / 2));
  // Across the frame at the target's range, measured square to the view axis.
  const off = rad(sight - pitch);
  const range = width / share / (2 * th * aspect * Math.cos(off));
  const d = range * Math.cos(rad(sight));
  const z = range * Math.sin(rad(sight));
  const pos: V3 = [target[0], target[1] - d, z];
  const reach = z / Math.tan(rad(pitch));
  return { pos, aim: [target[0], pos[1] + reach, 0], fov };
}

/** The key poses for a screen of this shape. */
export function flightKeys(aspect: number): Key[] {
  const tall = aspect < 0.7;
  const name = nameLayout(aspect);
  const h = SECTIONS.hero;
  const s1 = h + SECTIONS.say;
  const s2 = s1 + SECTIONS.infiniview;
  const end = FLIGHT_SCREENS - 1;

  // High above the lake. The name sits a little below the middle, the far
  // shore, the ranges and a band of sky across the top.
  const hero = tall
    ? fit([NAME.x, NAME.y], name.width, 0.68, 44, 37.5, 64, aspect)
    : fit([NAME.x, NAME.y + 10], name.width, Math.min(0.64, 0.4 * aspect), 36, 26.5, 58, aspect);
  if (!tall) {
    // The sky needs room for the ranges: from the same place, a wider lens
    // held a little higher. The name stays where it was in the frame.
    hero.fov = 64;
    hero.aim = [hero.pos[0], hero.pos[1] + hero.pos[2] / Math.tan(rad(23)), 0];
  }
  const hero2: Pose = { pos: [hero.pos[0], hero.pos[1] + 60, hero.pos[2] * 0.94], aim: [hero.aim[0], hero.aim[1] + 40, 0], fov: hero.fov };

  const wideFov = tall ? 62 : 50;
  const slabAim: V3 = [SLAB.x, SLAB.y, SLAB.h * 0.5];
  const keys: Key[] = tall
    ? [
        { s: 0, ...hero },
        { s: 0.3, ...hero2 },
        // Low over the lake's south end, looking down the river.
        { s: h - 0.25, pos: [1440, 1560, 250], aim: [1530, 2200, 0], fov: wideFov },
        // The statement: the near bank fills the foot of the frame, the river crosses beyond it.
        { s: h + 0.75, pos: [1180, 2180, 250], aim: [1470, 2820, 0], fov: wideFov },
        { s: s1 - 0.5, pos: [1200, 2400, 240], aim: [1500, 3020, 0], fov: wideFov },
        // The basin: the slab stands above the middle, bank at the foot.
        { s: s1 + 1.0, pos: [1010, 3450, 460], aim: [slabAim[0] - 20, slabAim[1] - 60, 40], fov: 50 },
        { s: s2 - 0.55, pos: [1030, 3530, 445], aim: [slabAim[0] - 10, slabAim[1] - 40, 40], fov: 50 },
        // Out past the island's left side, so the slab is never flown through.
        { s: s2 - 0.1, pos: [1120, 4860, 330], aim: [1330, 5900, 0], fov: 54 },
        { s: s2 + 0.45, pos: [1380, 5950, 420], aim: [1330, 6700, 0], fov: 50 },
        { s: end, pos: [1300, 7300, 1300], aim: [1300, 7300 + 1300 / Math.tan(rad(57)), 0], fov: 40 },
      ]
    : [
        { s: 0, ...hero },
        { s: 0.3, ...hero2 },
        // Low over the lake's south end, looking down the river toward the ranges.
        { s: h - 0.25, pos: [1380, 1640, 200], aim: [1500, 2190, 0], fov: wideFov },
        // The statement: gliding down the first reach, river on the right, the bank on the left.
        { s: h + 0.7, pos: [1080, 2250, 158], aim: [1320, 2740, 0], fov: 48 },
        { s: s1 - 0.5, pos: [1090, 2440, 152], aim: [1325, 2930, 0], fov: 48 },
        // The basin: slab and island right of centre, the bank at lower left.
        { s: s1 + 1.0, pos: [930, 4110, 300], aim: [slabAim[0] - 250, slabAim[1], 30], fov: 42 },
        { s: s2 - 0.55, pos: [955, 4180, 288], aim: [slabAim[0] - 235, slabAim[1] + 20, 30], fov: 42 },
        // Out past the island's left side, so the slab is never flown through.
        { s: s2 - 0.1, pos: [1150, 4880, 240], aim: [1340, 5900, 0], fov: 42 },
        { s: s2 + 0.45, pos: [1380, 5950, 300], aim: [1330, 6800, 0], fov: 40 },
        // Open water seen from above: the ending's first frame.
        { s: end, pos: [1300, 7300, 1100], aim: [1300, 7300 + 1100 / Math.tan(rad(57)), 0], fov: 36 },
      ];
  return keys;
}

/** The scroll position of each section's composed frame, for a still (reduced motion) flight. */
export function stillStops(): number[] {
  const h = SECTIONS.hero;
  const s1 = h + SECTIONS.say;
  const s2 = s1 + SECTIONS.infiniview;
  return [0, h + 0.7, s1 + 1.0, FLIGHT_SCREENS - 1];
}

/** Which composed frame a scroll position shows when nothing may glide. */
export function stillScroll(s: number): number {
  const stops = stillStops();
  const edges = [SECTIONS.hero, SECTIONS.hero + SECTIONS.say, SECTIONS.hero + SECTIONS.say + SECTIONS.infiniview];
  let i = 0;
  while (i < edges.length && s >= edges[i] - 0.5) i++;
  return stops[i];
}

/**
 * The pose at a scroll position: a cubic through the keys whose slope at
 * each key is the mean of the slopes either side (zero at the two ends and
 * wherever the path turns back), so it eases through every station and
 * never overshoots one.
 */
export function poseAt(keys: Key[], s: number): Pose {
  const n = keys.length;
  if (s <= keys[0].s) return keys[0];
  if (s >= keys[n - 1].s) return keys[n - 1];
  let i = 0;
  while (i < n - 2 && s > keys[i + 1].s) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.s - a.s;
  const t = (s - a.s) / span;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const slope = (k: number, get: (p: Key) => number) => {
    if (k === 0 || k === n - 1) return 0;
    const d0 = (get(keys[k]) - get(keys[k - 1])) / (keys[k].s - keys[k - 1].s);
    const d1 = (get(keys[k + 1]) - get(keys[k])) / (keys[k + 1].s - keys[k].s);
    if (d0 * d1 <= 0) return 0;
    // Harmonic mean: gentle into a hold, never past it.
    return (2 * d0 * d1) / (d0 + d1);
  };
  const at = (get: (p: Key) => number) => h00 * get(a) + h10 * span * slope(i, get) + h01 * get(b) + h11 * span * slope(i + 1, get);
  const v3 = (get: (p: Key) => V3): V3 => [at((p) => get(p)[0]), at((p) => get(p)[1]), at((p) => get(p)[2])];
  return { pos: v3((p) => p.pos), aim: v3((p) => p.aim), fov: at((p) => p.fov) };
}

export interface Basis {
  pos: V3;
  /** forward, right and up, unit length */
  f: V3;
  r: V3;
  u: V3;
  /** tangent of half the vertical field of view */
  tan: number;
}

export function basisOf(p: Pose): Basis {
  let fx = p.aim[0] - p.pos[0];
  let fy = p.aim[1] - p.pos[1];
  let fz = p.aim[2] - p.pos[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl;
  fy /= fl;
  fz /= fl;
  // Right is level; with y forward and z up it is (fy, -fx).
  const rl = Math.hypot(fx, fy) || 1;
  const r: V3 = [fy / rl, -fx / rl, 0];
  // Up is what is left of z once forward is taken out.
  let ux = -fz * fx;
  let uy = -fz * fy;
  let uz = 1 - fz * fz;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  return { pos: p.pos, f: [fx, fy, fz], r, u: [ux, uy, uz], tan: Math.tan(rad(p.fov / 2)) };
}

/** The ray through a point of the screen (x right, y down, both 0..1). */
export function rayThrough(b: Basis, sx: number, sy: number, aspect: number): V3 {
  const nx = (sx * 2 - 1) * aspect * b.tan;
  const ny = (1 - sy * 2) * b.tan;
  const d: V3 = [b.f[0] + b.r[0] * nx + b.u[0] * ny, b.f[1] + b.r[1] * nx + b.u[1] * ny, b.f[2] + b.r[2] * nx + b.u[2] * ny];
  const l = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / l, d[1] / l, d[2] / l];
}

/** Where on a level plane at height z a screen point looks, or null above the horizon. */
export function groundUnder(b: Basis, sx: number, sy: number, aspect: number, z = 0): { x: number; y: number; t: number } | null {
  const d = rayThrough(b, sx, sy, aspect);
  if (d[2] > -1e-3) return null;
  const t = (b.pos[2] - z) / -d[2];
  return { x: b.pos[0] + d[0] * t, y: b.pos[1] + d[1] * t, t };
}

/** The slab's four corners on screen (0..1), for the bounds its work is kept inside. */
export function projectPoint(b: Basis, p: V3, aspect: number): [number, number, number] {
  const dx = p[0] - b.pos[0];
  const dy = p[1] - b.pos[1];
  const dz = p[2] - b.pos[2];
  const z = dx * b.f[0] + dy * b.f[1] + dz * b.f[2];
  const x = dx * b.r[0] + dy * b.r[1] + dz * b.r[2];
  const y = dx * b.u[0] + dy * b.u[1] + dz * b.u[2];
  const zz = Math.max(z, 1e-3);
  return [0.5 + x / (zz * b.tan * aspect) / 2, 0.5 - y / (zz * b.tan) / 2, z];
}
