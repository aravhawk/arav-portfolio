/**
 * The flight's camera: a short list of key poses at scroll positions, joined
 * smoothly. It is a pure function of scroll, so it reverses exactly.
 *
 * Scroll is measured in screens (scrollY over the viewport's height). Each
 * station is held for a stretch of scroll by two keys that differ a little,
 * so a held frame still drifts.
 */

import { BENDS, CANYON, DY, FACE, NAME, type NameLayout, REST, SLAB, T2 } from './world';

export type V3 = [number, number, number];

export interface Pose {
  pos: V3;
  aim: V3;
  /** vertical field of view, degrees */
  fov: number;
  /** degrees the camera leans about its line of sight: positive banks to the right */
  roll?: number;
}

export interface Key extends Pose {
  /** scroll position in screens */
  s: number;
}

/** How long each section of the page is, in screens. */
export const SECTIONS = { hero: 2.4, say: 2.2, infiniview: 2.6, upstream: 2.8, bench: 2.6, bridge: 2.8, models: 2.8, fork: 2.8, lattice: 2.6, canyon: 3.6, delta: 2.6, sea: 2.3 };
/** The whole flight's length in screens. The page scrolls one screen less than this: the last screen is the ending, at rest. */
export const FLIGHT_SCREENS = Object.values(SECTIONS).reduce((a, b) => a + b, 0);
/** Where the scroll ends, and where the camera has come to rest over the sea (a little before it, so the last of the scroll is the ending held). */
export const END_AT = FLIGHT_SCREENS - 1;
export const SETTLE_AT = END_AT - 0.3;
/** Where the sun rises at the end of the flight when nothing has measured the ranges: bearing from +y toward +x, radians. */
export const SUN_END_AZ = 0.62;
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
  // (A phone's frame is tall: it keeps a real band of sky and ranges over the lake.)
  const horizon = tall ? 0.235 : 0.21;
  const middle = tall ? 0.565 : 0.585;
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
export function flightKeys(aspect: number, sunAz = SUN_END_AZ): Key[] {
  const h = SECTIONS.hero;
  const s1 = h + SECTIONS.say;
  const s2 = s1 + SECTIONS.infiniview;
  const s3 = s2 + SECTIONS.upstream;
  const s4 = s3 + SECTIONS.bench;
  const s5 = s4 + SECTIONS.bridge;
  const s6 = s5 + SECTIONS.models;
  const s7 = s6 + SECTIONS.fork;
  const s8 = s7 + SECTIONS.lattice;
  const s9 = s8 + SECTIONS.canyon;
  const s10 = s9 + SECTIONS.delta;
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
        { s: s2 + 1.25, pos: [1700, 5760 + Y, 590], aim: [1730, 7090 + Y, 0], fov: 60 },
        { s: s3 - 0.6, pos: [1704, 5810 + Y, 578], aim: [1732, 7120 + Y, 0], fov: 60 },
        { s: s3 + 0.3, pos: [900, 7700 + Y, 380], aim: [1100, 8500 + Y, 0], fov: 58 },
        // The pool, looked down into from its rim.
        { s: s3 + 1.15, pos: [1780, 8620 + Y, 760], aim: [1780, 9060 + Y, 0], fov: 52 },
        { s: s4 - 0.6, pos: [1780, 8644 + Y, 748], aim: [1780, 9070 + Y, 0], fov: 52 },
        { s: s4 + 0.3, pos: [1200, 9650 + Y, 360], aim: [1300, 10500 + Y, 0], fov: 58 },
        // The tarn: both shards, the far shore, the ranges.
        // The tarn, from low over its water: both shards stand against the sky above the middle, the words below on still water.
        { s: s4 + 1.2, pos: [1560, 9750 + Y, 70], aim: [1580, 10900 + Y, -25], fov: 58 },
        { s: s5 - 0.6, pos: [1562, 9790 + Y, 68], aim: [1581, 10920 + Y, -25], fov: 58 },
        { s: s5 + 0.3, pos: [1300, T2 - 250, 400], aim: [1300, T2 + 600, 0], fov: 56 },
        ...laterKeys(true, s5, s6, s7, s8),
        ...seaKeys(aspect, sunAz, s9, s10),
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
        { s: s2 - 0.1, pos: [780, 4950 + DY, 250], aim: [1180, 5900 + DY, 0], fov: 42 },
        { s: s2 + 0.4, pos: [1400, 5720 + Y, 230], aim: [1620, 6350 + Y, 0], fov: 46 },
        // The confluence: the river crosses the frame, the streams fan down to it from the snowfield.
        // The confluence: the cliff and its seven falls across the frame, the river along its foot, the near bank below.
        { s: s2 + 1.25, pos: [1380, 5950 + Y, 330], aim: [1730, 7000 + Y, -118], fov: 52 },
        { s: s3 - 0.6, pos: [1392, 5990 + Y, 322], aim: [1735, 7020 + Y, -118], fov: 52 },
        // Down the bigger river.
        { s: s3 + 0.3, pos: [860, 7650 + Y, 300], aim: [1000, 8500 + Y, 0], fov: 46 },
        // The pool, looked down into from its rim.
        { s: s3 + 1.15, pos: [1780, 8700 + Y, 600], aim: [1780, 9090 + Y, 0], fov: 46 },
        { s: s4 - 0.6, pos: [1780, 8722 + Y, 590], aim: [1780, 9100 + Y, 0], fov: 46 },
        { s: s4 + 0.3, pos: [1150, 9700 + Y, 300], aim: [1300, 10500 + Y, 0], fov: 46 },
        // The tarn: one shard near on the left, one far on the right, the ranges beyond.
        { s: s4 + 1.2, pos: [1120, 9900 + Y, 250], aim: [1400, 10950 + Y, 105], fov: 46 },
        { s: s5 - 0.6, pos: [1135, 9950 + Y, 242], aim: [1405, 10975 + Y, 105], fov: 46 },
        { s: s5 + 0.3, pos: [1300, T2 - 300, 300], aim: [1300, T2 + 600, 0], fov: 44 },
        ...laterKeys(false, s5, s6, s7, s8),
        ...seaKeys(aspect, sunAz, s9, s10),
      ];
  return keys;
}

/** The last four stations' keys: the columns, the dam, the lattice, the canyon. */
function laterKeys(upright: boolean, s5: number, s6: number, s7: number, s8: number): Key[] {
  const T = T2;
  return upright
    ? [
        // Down the row from its tall end, so all four stand in an upright frame.
        { s: s5 + 1.2, pos: [420, T + 380, 430], aim: [1235, T + 1110, 0], fov: 58 },
        { s: s6 - 0.6, pos: [440, T + 400, 420], aim: [1240, T + 1115, 0], fov: 58 },
        { s: s6 + 0.3, pos: [1300, T + 1500, 380], aim: [1300, T + 2300, 0], fov: 58 },
        // From over the west bank: the dam across the frame, the three channels beyond it, the bank at the foot.
        { s: s6 + 1.2, pos: [640, T + 1300, 820], aim: [1090, T + 3000, 0], fov: 62 },
        { s: s7 - 0.6, pos: [646, T + 1330, 810], aim: [1093, T + 3012, 0], fov: 62 },
        { s: s7 + 0.3, pos: [1300, T + 3300, 380], aim: [1300, T + 4100, 0], fov: 58 },
        // The lattice from up the west bank: all sixteen above the middle, the bank at the foot.
        { s: s7 + 1.15, pos: [640, T + 3200, 760], aim: [1270, T + 4470, 0], fov: 58 },
        { s: s8 - 0.6, pos: [646, T + 3228, 750], aim: [1272, T + 4480, 0], fov: 58 },
        { s: s8 + 0.3, pos: [1300, T + 4900, 230], aim: [1300, T + 5700, 70], fov: 60 },
        ...canyonKeys(s8, 66),
      ]
    : [
        { s: s5 + 1.2, pos: [760, T + 60, 250], aim: [1310, T + 1080, 70], fov: 42 },
        { s: s6 - 0.6, pos: [772, T + 95, 243], aim: [1316, T + 1090, 68], fov: 42 },
        { s: s6 + 0.3, pos: [1260, T + 1500, 260], aim: [1300, T + 2300, 0], fov: 46 },
        // Over the head pond's west bank: the dam below, the three channels fanning away.
        { s: s6 + 1.2, pos: [740, T + 2020, 500], aim: [1445, T + 3420, 0], fov: 46 },
        { s: s7 - 0.6, pos: [749, T + 2048, 493], aim: [1448, T + 3434, 0], fov: 46 },
        { s: s7 + 0.3, pos: [1300, T + 3350, 280], aim: [1300, T + 4100, 0], fov: 46 },
        // The lattice from over its west bank, corner on: every cube and its mirror image.
        { s: s7 + 1.15, pos: [450, T + 3690, 420], aim: [1200, T + 4500, 20], fov: 42 },
        { s: s8 - 0.6, pos: [462, T + 3718, 412], aim: [1203, T + 4510, 20], fov: 42 },
        { s: s8 + 0.3, pos: [1300, T + 4960, 170], aim: [1300, T + 5700, 70], fov: 48 },
        ...canyonKeys(s8, 50),
      ];
}

/** The ending's lens, and where its horizon and its sun stand in the frame (the old ending's composition). */
export function endLens(aspect: number) {
  const narrow = aspect < 0.8;
  const fov = 36;
  const th = Math.tan(rad(fov / 2));
  return {
    fov,
    /** the horizon, in v from -1 (foot) to 1 (top) */
    horizon: narrow ? 0.3 : 0.24,
    /** how far right of the frame's middle the sun stands, radians */
    sunOff: Math.atan((narrow ? 0.7 : 0.46) * aspect * th),
    pitch: Math.atan((narrow ? 0.3 : 0.24) * th),
  };
}

/**
 * Out of the canyon, over the delta, and out to sea. The delta is held from
 * over its west bank, looking across the channels toward the light; then
 * the camera goes on, low, and comes to rest on the ending's frame: the
 * horizon above the middle and the sun off to the right, wherever in the
 * world the sun has been found to rise.
 */
function seaKeys(aspect: number, sunAz: number, s9: number, s10: number): Key[] {
  const T = T2;
  const upright = aspect < 0.9;
  const L = endLens(aspect);
  const head = sunAz - L.sunOff;
  const fx = Math.sin(head);
  const fy = Math.cos(head);
  const z = 60;
  const far = 4000;
  const rest: Pose = { pos: [REST.x, REST.y, z], aim: [REST.x + fx * far, REST.y + fy * far, z - far * Math.tan(L.pitch)], fov: L.fov };
  // (The last of the scroll is the same frame, a breath nearer.)
  const held: Pose = { pos: [REST.x + fx * 14, REST.y + fy * 14, z], aim: [rest.aim[0] + fx * 14, rest.aim[1] + fy * 14, rest.aim[2]], fov: L.fov };
  // The run in: along the last heading, coming down.
  const back = (d: number, h: number, fov: number, drop: number): Pose => ({
    pos: [REST.x - fx * d, REST.y - fy * d, h],
    aim: [REST.x - fx * d + fx * 1600, REST.y - fy * d + fy * 1600, h - drop],
    fov,
  });
  return upright
    ? [
        // Out of the glacier and up over the west bank.
        { s: s9 + 0.25, pos: [1900, T + 7300, 260], aim: [1800, T + 8200, 0], fov: 60 },
        // The delta, looked at across its west shore: the bank fills the foot of the frame, the channels fan away above it.
        { s: s9 + 1.1, pos: [700, T + 7500, 500], aim: [1458, T + 8258, 0], fov: 60 },
        { s: s10 - 0.55, pos: [716, T + 7522, 492], aim: [1468, T + 8274, 0], fov: 60 },
        { s: s10 + 0.35, ...back(1750, 250, 52, 330) },
        { s: s10 + 0.95, ...back(620, 105, 42, 90) },
        { s: SETTLE_AT, ...rest },
        { s: END_AT, ...held },
      ]
    : [
        { s: s9 + 0.25, pos: [1960, T + 7330, 210], aim: [1800, T + 8200, 0], fov: 48 },
        // The delta from over its west bank: the bank at lower left, the channels to the right, the light beyond them.
        { s: s9 + 1.1, pos: [1100, T + 7450, 400], aim: [1500, T + 8750, 0], fov: 46 },
        { s: s10 - 0.55, pos: [1112, T + 7480, 393], aim: [1508, T + 8772, 0], fov: 46 },
        { s: s10 + 0.35, ...back(1750, 230, 42, 250) },
        { s: s10 + 0.95, ...back(620, 100, 38, 78) },
        { s: SETTLE_AT, ...rest },
        { s: END_AT, ...held },
      ];
}

/**
 * How far the day has come round, 0..1, at a scroll position. The flight
 * begins in the morning (or, in the dark theme, in the polar night) and
 * ends at the ending's light. It moves a little all the way down, most of
 * it inside the canyon and over the sea, where no words depend on it.
 */
export function dayAt(s: number): number {
  const h = SECTIONS.hero;
  const s9 = FLIGHT_SCREENS - SECTIONS.sea - SECTIONS.delta;
  const s8 = s9 - SECTIONS.canyon;
  const keys: [number, number][] = [
    [0, 0],
    [h, 0],
    // (Through the canyon's hold, where the app's picture and its words are read, the light is still the day's.)
    [s8 + 2.75, 0.1],
    [s9 + 0.45, 0.42],
    [s9 + 1.1, 0.55],
    [s9 + SECTIONS.delta - 0.55, 0.6],
    [SETTLE_AT - 0.25, 1],
    [END_AT, 1],
  ];
  if (s <= 0) return 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, va] = keys[i];
    const [b, vb] = keys[i + 1];
    if (s <= b) {
      // Slopes: the mean of the two sides, flat at a level stretch, so it eases through every key.
      const slope = (k: number) => {
        if (k === 0 || k === keys.length - 1) return 0;
        const d0 = (keys[k][1] - keys[k - 1][1]) / (keys[k][0] - keys[k - 1][0]);
        const d1 = (keys[k + 1][1] - keys[k][1]) / (keys[k + 1][0] - keys[k][0]);
        return d0 * d1 <= 0 ? 0 : (2 * d0 * d1) / (d0 + d1);
      };
      const span = b - a;
      const t = (s - a) / span;
      const t2 = t * t;
      const t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * va + (t3 - 2 * t2 + t) * span * slope(i) + (-2 * t3 + 3 * t2) * vb + (t3 - t2) * span * slope(i + 1);
    }
  }
  return 1;
}

/** A place on the canyon's middle line, d along it from the glacier's front. */
function canyonAt(d: number): [number, number] {
  const r = CANYON.r;
  const q = (Math.PI * r) / 2;
  const a = BENDS[0].y - CANYON.y0;
  const b = BENDS[1].x - BENDS[0].x;
  if (d < a) return [1300, CANYON.y0 + d];
  d -= a;
  if (d < q) return [BENDS[0].x - r * Math.cos(d / r), BENDS[0].y + r * Math.sin(d / r)];
  d -= q;
  if (d < b) return [BENDS[0].x + d, BENDS[0].y + r];
  d -= b;
  if (d < q) return [BENDS[1].x + r * Math.sin(d / r), BENDS[1].y - r * Math.cos(d / r)];
  return [BENDS[1].x + r, BENDS[1].y + d - q];
}

/**
 * The flight through the canyon: low on its middle line, looking down it,
 * banking into each bend; held on the straight between them, where the
 * polished face is seen whole.
 */
function canyonKeys(s8: number, fov: number): Key[] {
  // (An upright screen keeps its words at the foot: the face is held above the middle.)
  const tall = fov > 60;
  const face: V3 = [FACE.x, FACE.y, FACE.z + FACE.h * 0.5 - (tall ? 44 : 4)];
  //            scroll, along, height, bank, looks at the face
  const run: [number, number, number, number, boolean][] = [
    [0.8, 40, 100, 0, false],
    [1.05, 300, 86, 0, false],
    [1.25, 500, 82, 4, false],
    [1.45, 690, 82, 5, false],
    [1.7, tall ? 770 : 800, 84, 0, true],
    [2.2, tall ? 792 : 850, 86, 0, true],
    [2.65, tall ? 812 : 880, 86, 0, true],
    [2.9, 1100, 84, -4, false],
    [3.1, 1290, 84, -5, false],
    [3.35, 1500, 105, 0, false],
  ];
  return run.map(([ds, d, z, roll, toFace]) => {
    const [x, y] = canyonAt(d);
    const [ax, ay] = canyonAt(d + 230);
    return { s: s8 + ds, pos: [x, y, z] as V3, aim: toFace ? face : ([ax, ay, z - 12] as V3), fov, roll };
  });
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
  const [, say, view, up, bench, bridge, models, fork, lattice, canyon, delta] = sectionStarts();
  return [0, say + 0.7, view + 1.0, up + 1.25, bench + 1.15, bridge + 1.2, models + 1.2, fork + 1.2, lattice + 1.15, canyon + 2.2, delta + 1.1, END_AT];
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
  return { pos: v3((p) => p.pos), aim: v3((p) => p.aim), fov: at((p) => p.fov), roll: at((p) => p.roll ?? 0) };
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
  // A bank: right and up turn together about the line of sight.
  const roll = rad(p.roll ?? 0);
  const c = Math.cos(roll);
  const sn = Math.sin(roll);
  const u: V3 = [ux, uy, uz];
  return {
    pos: p.pos,
    f: [fx, fy, fz],
    r: [r[0] * c - u[0] * sn, r[1] * c - u[1] * sn, r[2] * c - u[2] * sn],
    u: [u[0] * c + r[0] * sn, u[1] * c + r[1] * sn, u[2] * c + r[2] * sn],
    tan: Math.tan(rad(p.fov / 2)),
  };
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
