/**
 * The flight's camera: a short list of key poses at scroll positions, joined
 * smoothly. It is a pure function of scroll, so it reverses exactly.
 *
 * Scroll is measured in screens (scrollY over the viewport's height). Each
 * station is held for a stretch of scroll by two keys that differ a little,
 * so a held frame still drifts.
 */

import { DY, EXT, NAME, type NameLayout, SLAB } from './world';

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
export const SECTIONS = { hero: 2.4, say: 2.2, infiniview: 2.6, upstream: 2.8, bench: 2.6, bridge: 2.8, runout: 2.0 };
/** The whole flight's length in screens. The last screen of it is the hand-over to the ending. */
export const FLIGHT_SCREENS = SECTIONS.hero + SECTIONS.say + SECTIONS.infiniview + SECTIONS.upstream + SECTIONS.bench + SECTIONS.bridge + SECTIONS.runout;
/** Scroll (in screens) over which the lake's ice melts. */
export const MELT = { from: 0.1, to: 2.0 };
/** Until here the first camera only drifts: the name is still letters. */
// (The name is cut for that camera alone, so the camera stays with it until the letters have run together into one pool.)
const HOLD = 1.22;

/** Where the descent from the hero arrives low over the outlet: while the last plates are still adrift, so no stretch of scroll is plain water. */
const OUTLET_AT = 1.82;

const rad = (d: number) => (d * Math.PI) / 180;

export interface Hero {
  pose: Pose;
  name: NameLayout;
  /** the camera the name is cut for: its y, its height, and the cosine and sine of its pitch */
  cut: [number, number, number, number];
}

/**
 * The first frame, composed from the picture backwards: the horizon a fifth
 * of the way down, the name a set share of the frame's width with its middle
 * below the frame's. The camera looks straight along +y, and the name is cut
 * for exactly this camera (see the ice field), so it reads square-on.
 */
export function heroDesign(aspect: number): Hero {
  const tall = aspect < 0.7;
  const fov = tall ? 64 : aspect >= 1.2 ? 50 : 56;
  const horizon = tall ? 0.19 : 0.21;
  const middle = tall ? 0.55 : 0.585;
  const share = tall ? 0.72 : Math.min(0.62, Math.max(0.56, 0.3 + 0.19 * aspect));
  const width = tall ? 860 : 1500;
  const th = Math.tan(rad(fov / 2));
  const pitch = Math.atan((1 - 2 * horizon) * th);
  const sight = pitch + Math.atan((2 * middle - 1) * th);
  // The name's depth along the view axis, then its range and the camera's height.
  const depth = width / (share * 2 * th * aspect);
  const range = depth / Math.cos(sight - pitch);
  const z = range * Math.sin(sight);
  const y = NAME.y - range * Math.cos(sight);
  const pose: Pose = { pos: [NAME.x, y, z], aim: [NAME.x, y + z / Math.tan(pitch), 0], fov };
  return {
    pose,
    name: { lines: tall ? ['Arav', 'Jain'] : ['Arav Jain'], width, stretch: depth / z },
    cut: [y, z, Math.cos(pitch), Math.sin(pitch)],
  };
}

/** The key poses for a screen of this shape. */
export function flightKeys(aspect: number): Key[] {
  const h = SECTIONS.hero;
  const s1 = h + SECTIONS.say;
  const s2 = s1 + SECTIONS.infiniview;
  const s3 = s2 + SECTIONS.upstream;
  const s4 = s3 + SECTIONS.bench;
  const s5 = s4 + SECTIONS.bridge;
  const end = FLIGHT_SCREENS - 1;
  const Y = DY;

  // The poster, held (with a slow push) until the letters have run together.
  const hero = heroDesign(aspect).pose;
  const hero2: Pose = { pos: [hero.pos[0], hero.pos[1] + 26, hero.pos[2] * 0.988], aim: [hero.aim[0], hero.aim[1] + 24, 0], fov: hero.fov };

  // An upright screen that is not a phone (a tablet held tall) flies the
  // phone's path after the hero: its copy sits at the foot, where that
  // path keeps a bank.
  const upright = aspect < 0.9;
  const wideFov = upright ? 62 : 50;
  const slabAim: V3 = [SLAB.x, SLAB.y, SLAB.h * 0.5];
  const keys: Key[] = upright
    ? [
        { s: 0, ...hero },
        { s: HOLD, ...hero2 },
        // Low over the lake's south end, looking down the river.
        { s: OUTLET_AT, pos: [1440, 1560 + DY, 250], aim: [1530, 2200 + DY, 0], fov: wideFov },
        // The statement: the near bank fills the foot of the frame, the river crosses beyond it.
        { s: h + 0.75, pos: [1180, 2180 + DY, 250], aim: [1470, 2820 + DY, 0], fov: wideFov },
        { s: s1 - 0.5, pos: [1200, 2400 + DY, 240], aim: [1500, 3020 + DY, 0], fov: wideFov },
        // The basin: the slab stands above the middle, bank at the foot.
        { s: s1 + 1.0, pos: [1010, 3450 + DY, 460], aim: [slabAim[0] - 20, slabAim[1] - 60, 40], fov: 50 },
        { s: s2 - 0.55, pos: [1030, 3530 + DY, 445], aim: [slabAim[0] - 10, slabAim[1] - 40, 40], fov: 50 },
        // Out past the island's left side, so the slab is never flown through.
        { s: s2 - 0.1, pos: [900, 4900 + DY, 330], aim: [1250, 5900 + DY, 0], fov: 54 },
        { s: s2 + 0.4, pos: [1380, 5700 + Y, 330], aim: [1560, 6300 + Y, 0], fov: 56 },
        // The confluence: streams above, the river across the middle, the bank at the foot.
        { s: s2 + 1.25, pos: [1600, 5800 + Y, 560], aim: [1650, 7200 + Y, 0], fov: 60 },
        { s: s3 - 0.6, pos: [1606, 5850 + Y, 548], aim: [1652, 7230 + Y, 0], fov: 60 },
        { s: s3 + 0.3, pos: [900, 7700 + Y, 380], aim: [1100, 8500 + Y, 0], fov: 58 },
        // The pool, looked down into from its rim.
        { s: s3 + 1.15, pos: [1770, 8400 + Y, 900], aim: [1770, 9080 + Y, 0], fov: 52 },
        { s: s4 - 0.6, pos: [1770, 8440 + Y, 880], aim: [1770, 9095 + Y, 0], fov: 52 },
        { s: s4 + 0.3, pos: [1200, 9650 + Y, 360], aim: [1300, 10500 + Y, 0], fov: 58 },
        // The tarn: both shards, the far shore, the ranges.
        { s: s4 + 1.2, pos: [1900, 9300 + Y, 500], aim: [1740, 10000 + Y, 0], fov: 58 },
        { s: s5 - 0.6, pos: [1896, 9340 + Y, 490], aim: [1740, 10030 + Y, 0], fov: 58 },
        { s: s5 + 0.35, pos: [1300, 11300 + Y, 420], aim: [1300, 12100 + Y, 0], fov: 50 },
        { s: end, pos: [1300, 7300 + DY + EXT, 1300], aim: [1300, 7300 + 1300 / Math.tan(rad(57)) + DY + EXT, 0], fov: 40 },
      ]
    : [
        { s: 0, ...hero },
        { s: HOLD, ...hero2 },
        // Low over the lake's south end, looking down the river toward the ranges.
        { s: OUTLET_AT, pos: [1380, 1640 + DY, 200], aim: [1500, 2190 + DY, 0], fov: wideFov },
        // The statement: gliding down the first reach, river on the right, the bank on the left.
        { s: h + 0.7, pos: [1080, 2250 + DY, 158], aim: [1320, 2740 + DY, 0], fov: 48 },
        { s: s1 - 0.5, pos: [1090, 2440 + DY, 152], aim: [1325, 2930 + DY, 0], fov: 48 },
        // The basin: slab and island right of centre, the bank at lower left.
        { s: s1 + 1.0, pos: [930, 4110 + DY, 300], aim: [slabAim[0] - 250, slabAim[1], 105], fov: 42 },
        { s: s2 - 0.55, pos: [955, 4180 + DY, 288], aim: [slabAim[0] - 235, slabAim[1] + 20, 105], fov: 42 },

        // Out wide of the island's left side: the slab leaves the frame whole
        // and at a distance, never as an edge sliding past the lens.
        { s: s2 - 0.1, pos: [900, 4950 + DY, 250], aim: [1250, 5900 + DY, 0], fov: 42 },
        { s: s2 + 0.4, pos: [1400, 5720 + Y, 230], aim: [1620, 6350 + Y, 0], fov: 46 },
        // The confluence: the river crosses the frame, the streams fan down to it from the snowfield.
        { s: s2 + 1.25, pos: [1300, 5770 + Y, 470], aim: [1680, 7010 + Y, 0], fov: 52 },
        { s: s3 - 0.6, pos: [1314, 5820 + Y, 458], aim: [1686, 7040 + Y, 0], fov: 52 },
        // Down the bigger river.
        { s: s3 + 0.3, pos: [860, 7650 + Y, 300], aim: [1000, 8500 + Y, 0], fov: 46 },
        // The pool, looked down into from its rim.
        { s: s3 + 1.15, pos: [1490, 8470 + Y, 575], aim: [1540, 9080 + Y, 0], fov: 46 },
        { s: s4 - 0.6, pos: [1496, 8495 + Y, 565], aim: [1543, 9090 + Y, 0], fov: 46 },
        { s: s4 + 0.3, pos: [1150, 9700 + Y, 300], aim: [1300, 10500 + Y, 0], fov: 46 },
        // The tarn: one shard near on the left, one far on the right, the ranges beyond.
        { s: s4 + 1.2, pos: [1120, 9900 + Y, 250], aim: [1400, 10950 + Y, 130], fov: 46 },
        { s: s5 - 0.6, pos: [1135, 9950 + Y, 242], aim: [1405, 10975 + Y, 130], fov: 46 },
        { s: s5 + 0.35, pos: [1300, 11300 + Y, 320], aim: [1300, 12200 + Y, 0], fov: 40 },
        // Open water seen from above: the ending's first frame.
        { s: end, pos: [1300, 7300 + DY + EXT, 1100], aim: [1300, 7300 + 1100 / Math.tan(rad(57)) + DY + EXT, 0], fov: 36 },
      ];
  return keys;
}

/** Where each section begins, in screens. */
export function sectionStarts(): number[] {
  const out: number[] = [];
  let at = 0;
  for (const v of Object.values(SECTIONS)) {
    out.push(at);
    at += v;
  }
  return out;
}

/** The scroll position of each section's composed frame, for a still (reduced motion) flight. */
export function stillStops(): number[] {
  const [, say, view, up, bench, bridge] = sectionStarts();
  return [0, say + 0.7, view + 1.0, up + 1.25, bench + 1.15, bridge + 1.2, FLIGHT_SCREENS - 1];
}

/** Which composed frame a scroll position shows when nothing may glide. */
export function stillScroll(s: number): number {
  const stops = stillStops();
  const edges = sectionStarts().slice(1);
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
