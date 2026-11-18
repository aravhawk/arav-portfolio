/**
 * The flight's camera: a short list of key poses at scroll positions, joined
 * smoothly. It is a pure function of scroll, so it reverses exactly.
 *
 * Scroll is measured in screens (scrollY over the viewport's height). The
 * eye never stands still. Between stations it travels; at a station it
 * slows to one authored move (a push toward the subject, an arc round it, a
 * rise over it: see `Move`) that runs the whole time the station's words
 * stand, and its composed frame is one moment of that move.
 */

import type { NameRow } from './name';
import { BENDS, BOARD_DEPTH, CANYON, DY, FACE, NAME, REST, RIVER, SHARDS, SHEET, SLAB, T2, TARN_BAY, boardSpan, sheetCols } from './world';

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
  /** how the pose is changing here, per screen of scroll, where the key says so itself (a station's move); otherwise the path works it out */
  v?: Pose;
}

/**
 * A station's move. The eye turns about one point of the world and closes
 * on it, so that point keeps its place in the frame for the whole of the
 * move. The point is chosen where the ground the words stand on meets the
 * subject: the subject then grows and turns away from the words and never
 * comes under them.
 */
export interface Move {
  /** the composed frame */
  at: Pose;
  /** the point that keeps its place */
  pivot: V3;
  /** how far the eye closes on it over the whole move, as a share of its distance (negative: it draws back) */
  push: number;
  /** degrees the eye goes round it, to its own right (so what lies beyond the point slides right in the frame) */
  arc: number;
  /** degrees the eye rises over it (so what lies beyond the point climbs the frame) */
  rise: number;
}

/** How long before its composed frame a station's move begins, and how long after it ends, in screens. */
export const MOVE = { before: 0.55, after: 0.75 };

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
/** Until here the first camera only closes on the name: the name is still letters. */
// (The name is cut for that camera alone, so the camera stays with it until the letters have run together into one pool.)
const HOLD = 1.22;

/** Where the descent from the hero arrives low over the outlet: while the last plates are still adrift, so no stretch of scroll is plain water. */
const OUTLET_AT = 1.82;

const rad = (d: number) => (d * Math.PI) / 180;

export interface Hero {
  pose: Pose;
  /** the name's rows as the frame composes them, the far one first (see name.ts) */
  rows: NameRow[];
  /** the name as it is read, a line to a row, and the near row's width in world units */
  name: { lines: string[]; width: number };
  /** the first camera, in whose picture the swept ice and the first frame's words are measured: its y, its height, and the cosine and sine of its pitch */
  cut: [number, number, number, number];
}

/** How wide a row of the name is for its capitals' height: near enough to compose the frame with (the plates are then laid to the row's width exactly). */
const ROW_WIDE = { one: 6.6, far: 3.45, near: 2.65 };

/**
 * The first frame, composed from the picture backwards: the horizon a fifth
 * of the way down, the name a set share of the frame's width, its feet a set
 * way down the frame. The camera looks straight along +y. The name is eight
 * upright plates on the lake, so the eye can move on them.
 *
 * On a wide frame the name is one row. On an upright one it is two rows of
 * four: JAIN in front, ARAV behind and above it, further off and larger, so
 * the two stand as wide as each other in the frame and the far one's feet
 * and its image in the ice stand clear over the near one's tops. The rows'
 * places on the lake are the same for every upright frame of a kind (they
 * are composed for one, `canon`): only the camera differs.
 */
export function heroDesign(aspect: number): Hero {
  const two = aspect < 0.9;
  const tall = aspect < 0.7;
  const fov = tall ? 64 : aspect >= 1.2 ? 50 : 56;
  // (A phone's frame is tall: it keeps a real band of sky and ranges over the lake.)
  const horizon = tall ? 0.235 : 0.21;
  const th = Math.tan(rad(fov / 2));
  const pitch = Math.atan((1 - 2 * horizon) * th);
  /** The camera whose frame holds a row `width` wide at `share` of its width, with the row's feet `foot` of the way down it. */
  const eye = (a: number, width: number, share: number, foot: number) => {
    const depth = width / (share * 2 * th * a);
    const under = pitch + Math.atan((2 * foot - 1) * th);
    const z = depth / (Math.cos(pitch) / Math.tan(under) + Math.sin(pitch));
    return { z, ground: z / Math.tan(under) };
  };
  let rows: NameRow[];
  let width: number;
  let at: { z: number; ground: number };
  if (two) {
    width = 860;
    const canon = tall ? 0.46 : 0.78;
    const share = tall ? 0.7 : 0.6;
    const near = tall ? 0.652 : 0.7;
    const far = tall ? 0.425 : 0.425;
    const c = eye(canon, width, share, near);
    // The far row: where its feet stand in that frame, and how wide it must be on the lake to stand as wide in the frame.
    const underF = pitch + Math.atan((2 * far - 1) * th);
    const groundF = c.z / Math.tan(underF);
    const depthF = groundF * Math.cos(pitch) + c.z * Math.sin(pitch);
    rows = [
      { text: 'ARAV', y: NAME.y + groundF - c.ground, width: share * 2 * th * canon * depthF },
      { text: 'JAIN', y: NAME.y, width },
    ];
    // (A phone that is squat for its width leaves the words less room under the name: it stands a little higher.)
    const squat = tall ? Math.min(1, Math.max(0, (aspect - 0.465) / 0.035)) : 0;
    at = eye(aspect, width, share, near - 0.03 * squat);
  } else {
    width = 1500;
    // (A frame far wider than it is tall leaves the first frame's words no room under the letters: the name stands a
    // little higher and smaller there, so bare ice lies under the letters' feet and snow under the words.)
    const shallow = Math.min(1, Math.max(0, (aspect - 2.1) / 0.7));
    const share = Math.min(0.72, Math.max(0.6, 0.37 + 0.2 * aspect)) - 0.16 * shallow;
    rows = [{ text: 'ARAV JAIN', y: NAME.y, width }];
    at = eye(aspect, width, share, 0.672 - 0.05 * shallow);
  }
  const y = NAME.y - at.ground;
  const pose: Pose = { pos: [NAME.x, y, at.z], aim: [NAME.x, y + at.z / Math.tan(pitch), 0], fov };
  return { pose, rows, name: { lines: rows.map((r) => r.text), width }, cut: [y, at.z, Math.cos(pitch), Math.sin(pitch)] };
}

/** The capitals' height of a row, near enough (see ROW_WIDE). */
export function rowHeight(rows: NameRow[], i: number): number {
  return rows[i].width / (rows.length > 1 ? (i === 0 ? ROW_WIDE.far : ROW_WIDE.near) : ROW_WIDE.one);
}

/**
 * A station's move at t. 0 is its composed frame, and the whole move is one
 * unit of t long: it begins at a negative t and ends at a positive one.
 */
export function moved(m: Move, t: number): Pose {
  if (t === 0) return m.at;
  const a = rad(m.arc * t);
  const b = -rad(m.rise * t);
  const k = 1 - m.push * t;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  // The level line across the line of sight, once the eye has gone round.
  const fx = m.at.aim[0] - m.at.pos[0];
  const fy = m.at.aim[1] - m.at.pos[1];
  const fl = Math.hypot(fx, fy) || 1;
  const rx = (fy / fl) * ca + (fx / fl) * sa;
  const ry = (fy / fl) * sa - (fx / fl) * ca;
  const turn = (p: V3): V3 => {
    const x0 = p[0] - m.pivot[0];
    const y0 = p[1] - m.pivot[1];
    const z = p[2] - m.pivot[2];
    // Round the upright through the point, then over that level line, then nearer.
    const x = x0 * ca - y0 * sa;
    const y = x0 * sa + y0 * ca;
    const along = (rx * x + ry * y) * (1 - cb);
    return [m.pivot[0] + k * (x * cb + ry * z * sb + rx * along), m.pivot[1] + k * (y * cb - rx * z * sb + ry * along), m.pivot[2] + k * (z * cb + (rx * y - ry * x) * sb)];
  };
  return { pos: turn(m.at.pos), aim: turn(m.at.aim), fov: m.at.fov };
}

/**
 * A move's keys: one at each of the scroll positions `at`, each with the move's own speed there. `when` says how far
 * through the move the eye is at a scroll position (in screens of the move's steady pace, 0 at its composed frame), and
 * `len` is how many such screens make the whole move.
 */
function moveKeys(m: Move, len: number, at: number[], when: (s: number) => number): Key[] {
  const e = 1e-3;
  return at.map((s) => {
    const a = moved(m, when(s - e) / len);
    const b = moved(m, when(s + e) / len);
    const d = (i: number, get: (p: Pose) => V3) => (get(b)[i] - get(a)[i]) / (2 * e);
    const v3 = (get: (p: Pose) => V3): V3 => [d(0, get), d(1, get), d(2, get)];
    return { s, ...moved(m, when(s) / len), v: { pos: v3((p) => p.pos), aim: v3((p) => p.aim), fov: 0 } };
  });
}
/**
 * A station's hold: its move from `MOVE.before` its composed frame to `MOVE.after` it. The eye is still slowing as
 * the move begins (it comes in at `1 + SLOW.by` times the move's steady pace and has settled to that pace within
 * about `SLOW.in` screens), so the last of its arrival and the first of its move are one motion.
 */
const SLOW = { by: 1.2, in: 0.22 };
function holdKeys(m: Move, stop: number, before = MOVE.before, after = MOVE.after): Key[] {
  const from = stop - before;
  const lead = (s: number) => SLOW.by * SLOW.in * Math.exp(-(s - from) / SLOW.in);
  const when = (s: number) => s - stop - (lead(s) - lead(stop));
  return moveKeys(m, before + after, [from, from + before * 0.4, stop, stop + after], when);
}

/** The point of the level ground (at height z) that a place in a pose's frame looks at: where a move turns. */
function under(at: Pose, aspect: number, sx: number, sy: number, z = 0): V3 {
  const g = groundUnder(basisOf(at), sx, sy, aspect, z);
  return g ? [g.x, g.y, z] : at.aim;
}

/** The west bank of the river's first reach at y: where the snow meets the water. */
function reachBank(y: number): number {
  const w = [300, 250, 285, 240, 280, 300];
  let i = 0;
  while (i < RIVER.length - 2 && y > RIVER[i + 1].y) i++;
  const t = Math.min(1, Math.max(0, (y - RIVER[i].y) / (RIVER[i + 1].y - RIVER[i].y)));
  return RIVER[i].x + (RIVER[i + 1].x - RIVER[i].x) * t - (w[i] + (w[i + 1] - w[i]) * t) / 2;
}

/**
 * The key poses for a screen of this shape. `band`: for an inner page's
 * scene, which stands at one station and only drifts: each move is a tenth
 * of itself, and the two stations the home page has recomposed for its own
 * words keep the frames those pages were laid out on.
 */
export function flightKeys(aspect: number, sunAz = SUN_END_AZ, band = false): Key[] {
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
  const g = band ? 0.1 : 1;
  /** A station's move: its composed frame, the place in that frame that holds still, and how the eye goes. */
  const move = (at: Pose, sx: number, sy: number, push: number, arc: number, rise: number, z = 0): Move => ({ at, pivot: under(at, aspect, sx, sy, z), push: push * g, arc: arc * g, rise: rise * g });
  /** The same, about a named point of the world. */
  const about = (at: Pose, pivot: V3, push: number, arc: number, rise: number): Move => ({ at, pivot, push: push * g, arc: arc * g, rise: rise * g });

  // The first frame, and the slow push toward the name it begins: the foot of the letters keeps its place.
  const hero = heroDesign(aspect).pose;
  // (On an upright frame the far row stands a long way behind the near one: the eye goes round less there, so the two keep in line.)
  const first: Move = { at: hero, pivot: [NAME.x, NAME.y, 0], push: (aspect < 0.9 ? 0.15 : HERO_PUSH) * g, arc: (aspect < 0.9 ? -1.5 : HERO_ARC) * g, rise: HERO_RISE * g };

  // An upright screen that is not a phone (a tablet held tall) flies the
  // phone's path after the hero: its copy sits at the foot, where that
  // path keeps a bank.
  const upright = aspect < 0.9;
  const squat = 250 * Math.min(1, Math.max(0, (aspect - 0.465) / 0.035));
  const wideFov = upright ? 62 : 50;
  const slabAim: V3 = [SLAB.x, SLAB.y, SLAB.h * 0.5];
  // Down the first reach, low along its west bank: the river runs past on the right, the bank his sentence stands on
  // keeps the lower left (the foot, on an upright screen), and the ranges rise ahead.
  const reach = (s: number, y: number): Key =>
    upright
      ? { s, pos: [reachBank(y + 390) - 300, y + DY, 250 - (y - 2180) * 0.012], aim: [reachBank(y + 390) - 10, y + 640 + DY, 0], fov: wideFov }
      : { s, pos: [reachBank(y + 500) - 350, y + DY, 158 - (y - 2250) * 0.012], aim: [reachBank(y + 500) - 110, y + 490 + DY, 0], fov: 48 };
  const keys: Key[] = upright
    ? [
        ...moveKeys(first, HOLD, [0, HOLD], (s) => s),
        // Up over the two rows as they founder: the plates afloat below and ahead, the far shore beyond.
        { s: 1.5, pos: [1320, 900, 1200], aim: [1400, 3500, 0], fov: wideFov },
        { s: 1.61, pos: [1380, 2900, 800], aim: [1450, 5200, 0], fov: wideFov },
        // Low over the lake's south end, looking down the river.
        { s: OUTLET_AT - 0.12, pos: [1440, 1560 + DY, 250], aim: [1530, 2200 + DY, 0], fov: wideFov },
        // The statement: the near bank fills the foot of the frame, the river crosses beyond it; the eye goes on down the reach.
        reach(1.98, 2060),
        reach(h + 0.7, 2640),
        reach(s1 - 0.5, 3150),
        // The basin: the slab stands above the middle, bank at the foot.
        ...holdKeys(move({ pos: [1010, 3450 + DY, 460], aim: [slabAim[0] - 20, slabAim[1] - 60, 40], fov: 50 }, 0.5, 0.6, 0.14, 3, 2), s1 + 1.0),
        // Out past the island's left side, so the slab is never flown through.
        { s: s2 - 0.1, pos: [900, 4900 + DY, 330], aim: [1250, 5900 + DY, 0], fov: 54 },
        { s: s2 + 0.35, pos: [1380, 5700 + Y, 330], aim: [1560, 6300 + Y, 0], fov: 56 },
        // The confluence, from over the west bank of the river that comes to it: the streams above, the river across the
        // middle, and the bank at the foot wide enough for the count and, beside it, the seven names.
        // (A squarer upright screen has less height for the bank: it looks down a little more, so the words keep clear of the river.)
        ...holdKeys(band ? move({ pos: [1700, 5760 + Y, 590], aim: [1730, 7090 + Y - squat, 0], fov: 60 }, 0.5, 0.6, 0.15, 2, 3) : move({ pos: [1000, 5500 + Y, 700], aim: [1750, 6930 + Y - squat, 0], fov: 58 }, 0.5, 0.53, 0.15, 2, 2), s2 + 1.25),
        { s: s3 + 0.25, pos: [900, 7700 + Y, 380], aim: [1100, 8500 + Y, 0], fov: 58 },
        // The rock pool, looked down into from over its near bank: the plates across the frame, the bank at the foot.
        ...holdKeys(move(benchPose(aspect), 0.5, 0.62, 0.13, 0, -2, -36), s3 + 1.15),
        { s: s4 + 0.3, pos: [1200, 9650 + Y, 360], aim: [1300, 10500 + Y, 0], fov: 58 },
        // The tarn, from low over its near shore: both shards stand against the sky above the middle, the words below on the bank.
        // (The eye closes on the point of the shore nearest the name, which keeps its place: the water never comes under the words.)
        ...holdKeys(move({ pos: [1560, 9750 + Y, 70], aim: [1580, 10900 + Y, -25], fov: 58 }, 0.56, 0.65, 0.3, -4.5, 0), s4 + 1.2),
        { s: s5 + 0.3, pos: [1300, T2 - 250, 400], aim: [1300, T2 + 600, 0], fov: 56 },
        ...laterKeys(aspect, band, s5, s6, s7, s8),
        ...seaKeys(aspect, sunAz, s9, s10, g),
      ]
    : [
        ...moveKeys(first, HOLD, [0, HOLD], (s) => s),
        // Up and out over the breaking lake: the name's plates have foundered and lie afloat among the floes just
        // ahead and below, riding down the lead toward the outlet; the far shore beyond them.
        { s: 1.5, pos: [1330, 700, 700], aim: [1400, 2500, 0], fov: wideFov },
        // Down the lake after them: the plates ride the current ahead, the outlet beyond.
        { s: 1.61, pos: [1350, 2500, 560], aim: [1450, 5000, 0], fov: wideFov },
        // Low over the lake's south end, looking down the river toward the ranges.
        { s: OUTLET_AT - 0.12, pos: [1380, 1640 + DY, 200], aim: [1500, 2190 + DY, 0], fov: wideFov },
        // Over the river's mouth, already turned to the first reach: the bank his sentence stands on fills the lower
        // left of the frame from here, so the sentence can begin this early; and the eye goes on down the reach the
        // whole time the sentence sets, the river running past on its right.
        reach(1.96, 2140),
        reach(h + 0.7, 2720),
        reach(s1 - 0.5, 3230),
        // The basin: slab and island right of centre, the bank at lower left. The eye closes on the block and goes a little round it.
        ...holdKeys(move({ pos: [930, 4110 + DY, 300], aim: [slabAim[0] - 250, slabAim[1], 105], fov: 42 }, 0.4, 0.72, 0.14, 4.5, 0), s1 + 1.0),

        // Out wide of the island's left side: the slab leaves the frame whole
        // and at a distance, never as an edge sliding past the lens.
        { s: s2 - 0.1, pos: [780, 4950 + DY, 250], aim: [1180, 5900 + DY, 0], fov: 42 },
        { s: s2 + 0.35, pos: [1400, 5720 + Y, 230], aim: [1620, 6350 + Y, 0], fov: 46 },
        // The confluence: the cliff and its seven falls across the frame, the river along its foot, the near bank below.
        // The eye rises over the bank and closes on the cliff: the snowfield and its streams open out above the falls.
        ...holdKeys(move({ pos: [1380, 5950 + Y, 330], aim: [1730, 7000 + Y, -118], fov: 52 }, 0.48, 0.52, 0.18, 2, 3), s2 + 1.25),
        // Down the bigger river.
        { s: s3 + 0.25, pos: [860, 7650 + Y, 300], aim: [1000, 8500 + Y, 0], fov: 46 },
        // The rock pool from low over its near bank: the plates right of the words, the far shore, the tarn and the ranges above.
        ...holdKeys(move(benchPose(aspect), 0.44, 0.8, 0.128, 3, 0), s3 + 1.15),
        { s: s4 + 0.3, pos: [1150, 9700 + Y, 300], aim: [1300, 10500 + Y, 0], fov: 46 },
        // The tarn, from low on its south-west bank (see tarnPose).
        // (The eye goes round the edge of the bank the words stand on, which keeps its place: the two shards and the ranges slide across the water, away from the words.)
        ...holdKeys(band ? move(tarnBand(aspect), 0.3, 0.8, 0.1, 2, 0) : move(tarnPose(), 0.5, 0.51, 0.1, 9, 0), s4 + 1.2),
        { s: s5 + 0.3, pos: [1300, T2 - 300, 300], aim: [1300, T2 + 600, 0], fov: 44 },
        ...laterKeys(aspect, band, s5, s6, s7, s8),
        ...seaKeys(aspect, sunAz, s9, s10, g),
      ];
  return keys;
}

/**
 * The first frame's stills (see scripts/capture-poster.mjs). The first camera
 * stands nearer the name the wider the window is, so one still cannot be the
 * first frame of every window. There is one to a band of window shapes: it is
 * taken from the band's own first camera (the camera of the band's narrowest
 * window, a little back and high: where the entrance begins) on a frame as
 * wide as the band's widest window, so every window in the band sees a part
 * of that very frame, cut at its sides, and the live picture's first frame
 * is drawn from that same camera. The entrance then brings the eye forward
 * to the window's own first camera. Each band is `POSTER_STEP` times nearer
 * than the one before.
 */
export const POSTER_STEP = 1.1;
export interface PosterBand {
  /** the still's name: its shape and its place among that shape's bands */
  id: string;
  /** the narrowest window of the band (its camera is the band's), and the widest (the still is this wide) */
  lo: number;
  hi: number;
}
export function posterBands(): PosterBand[] {
  const out: PosterBand[] = [];
  // How large the name stands against the frame's height: the camera's distance goes as one over this.
  const size = (a: number) => (heroDesign(a).name.width / (heroDesign(a).pose.pos[2] || 1)) * 1;
  const cut = (shape: string, from: number, to: number) => {
    let lo = from;
    for (let n = 0; lo < to - 1e-6 && n < 40; n++) {
      // The next edge: where the name stands POSTER_STEP larger (found by halving; the size only grows with the width).
      let a = lo;
      let b = to;
      const want = size(lo) * POSTER_STEP;
      if (size(to - 1e-6) <= want) a = to;
      else {
        for (let i = 0; i < 40; i++) {
          const m = (a + b) / 2;
          if (size(m) < want) a = m;
          else b = m;
        }
        a = Math.round(a * 1000) / 1000;
      }
      // (A last sliver is not a band of its own: the band before it runs on to the end.)
      if (out.length && out[out.length - 1].id.startsWith(shape) && a >= to - 1e-6 && size(to - 1e-6) < size(lo) * Math.sqrt(POSTER_STEP)) out[out.length - 1].hi = to;
      else out.push({ id: `${shape}-${n}`, lo, hi: a });
      lo = a;
    }
  };
  // (Each kind of frame has its own first frame: two rows on an upright one, composed for a phone and for a tablet held
  // tall; one row from there on, through two lenses.)
  cut('tall', 0.4, 0.7);
  cut('mid', 0.7, 0.9);
  cut('square', 0.9, 1.2);
  cut('wide', 1.2, 3.2);
  return out;
}
/** The band a window of this shape is in. */
export function posterBand(aspect: number, bands = posterBands()): PosterBand {
  return bands.find((b) => aspect >= b.lo && aspect < b.hi) ?? (aspect < bands[0].lo ? bands[0] : bands[bands.length - 1]);
}
/**
 * Where the entrance begins on a window of this shape: its band's first camera, a little back from the name and
 * high over it. `back` and `high`: how far back (a share of the distance) and how high (degrees).
 */
export function heroStart(band: PosterBand, back: number, high: number): Pose {
  const at = heroDesign(band.lo).pose;
  return moved({ at, pivot: [NAME.x, NAME.y, 0], push: back, arc: 0, rise: -high }, -1);
}

/**
 * The first screen's move, over its hold: the eye closes on the name's foot by this share of its distance, goes round
 * it to its own left (toward the low sun, so the plates' lit flanks and their depth come into view) and rises a
 * little over it. The plates are true objects: the eye can move on them.
 */
const HERO_PUSH = 0.16;
const HERO_ARC = -7;
const HERO_RISE = 1.5;

/**
 * Station 3's frame, composed from the plates backwards: they are set a
 * share of the frame's width, so the table's rows are a known size on any
 * screen. A wide screen looks across the pool from low over its near bank
 * (the plates right of the words, the tarn and the ranges above); an
 * upright one looks down into it (the plates above the middle, the bank at
 * the foot).
 */
function benchPose(aspect: number): Pose {
  const upright = aspect < 0.9;
  const fov = upright ? 52 : 62;
  const th = Math.tan(rad(fov / 2));
  const n = sheetCols(aspect);
  const w = boardSpan(n);
  const half = BOARD_DEPTH / 2;
  // (The plates lie under the water: this far below the land.)
  const bed = 36;
  if (upright) {
    const pitch = rad(76);
    const share = 0.9;
    // The plates' middle stands this far above the frame's.
    const lift = Math.atan(0.2 * th);
    const range = w / (2 * aspect * th * share) / Math.cos(lift);
    const z = range * Math.sin(pitch - lift) - bed;
    const back = range * Math.cos(pitch - lift);
    const x = SHEET.x0 + w / 2;
    const y = SHEET.y - back;
    return { pos: [x, y, z], aim: [x, y + z / Math.tan(pitch), 0], fov };
  }
  const pitch = rad(28);
  // The plates' near edge takes this share of the frame's width, and stands this far in from its left side.
  // (It leaves the bank at lower left wide enough for the station's name, its arrow and its lines to stand on snow alone.)
  const share = Math.min(0.51, Math.max(0.36, 0.9 - 0.69 / aspect));
  const left = 1 - share - 0.03;
  const depth = w / (2 * aspect * th * share);
  // (The camera stands a little further back from the plates' middle than it is high.)
  const BACK = 1.07;
  const z = (depth + half * Math.cos(pitch) - bed * Math.sin(pitch)) / (BACK * Math.cos(pitch) + Math.sin(pitch));
  const x = SHEET.x0 - (left - 0.5) * 2 * aspect * th * depth;
  const y = SHEET.y - z * BACK;
  return { pos: [x, y, z], aim: [x, y + z / Math.tan(pitch), 0], fov };
}

/**
 * Station 4's frame as an inner page's scene keeps it (the home page set its
 * words in the sky here until its fourth round): the eye a man's height over
 * the water of the tarn's near bay, looking a little up, so the horizon lies
 * six tenths of the way down the frame and the two shards stand whole
 * against the sky to the right.
 */
function tarnBand(aspect: number): Pose {
  const fov = 44;
  const th = Math.tan(rad(fov / 2));
  const pos: V3 = [TARN_BAY.x - 100, TARN_BAY.y - 140, 40];
  // (The nearer shard's middle stands a third of the frame's width right of the frame's middle.)
  const near = SHARDS[0];
  const to = Math.atan2(near.x - TARN_BAY.x + 100, near.y - TARN_BAY.y + 140);
  const head = Math.min(rad(21), Math.max(rad(13), to - Math.atan(0.33 * 2 * th * aspect)));
  // (Looking up by this much puts the horizon 0.6 of the way down.)
  const up = 0.2 * th;
  const far = 1000;
  return { pos, aim: [pos[0] + Math.sin(head) * far, pos[1] + Math.cos(head) * far, pos[2] + up * far], fov };
}

/**
 * Station 4's wide frame on the home page. The words stand at lower left,
 * as at every station, so the lower left must be one calm surface: here it
 * is the snow of the tarn's south-west bank. The eye stands on that bank, a
 * man's height over it, and looks north-east across the water: from that
 * low the bank fills the frame's lower left as far up as the words reach,
 * and over it the tarn is a mirror that holds the ranges, the sky and the
 * two shards, each whole over its own image.
 */
function tarnPose(): Pose {
  // (This near the water the tarn is most of what the frame holds, and the sound reads it so: see the scene reader's `tarn`.)
  const pos: V3 = [TARN_BAY.x - 350, TARN_BAY.y - 170, 42];
  // (It looks down a little: the bank's far edge stands well over the name, with room to spare through the whole move.)
  return { pos, aim: [pos[0] + 700, pos[1] + 720, pos[2] - 165], fov: 44 };
}

/** The last four stations' keys: the columns, the dam, the lattice, the canyon. */
function laterKeys(aspect: number, band: boolean, s5: number, s6: number, s7: number, s8: number): Key[] {
  const T = T2;
  const upright = aspect < 0.9;
  const g = band ? 0.1 : 1;
  const move = (at: Pose, sx: number, sy: number, push: number, arc: number, rise: number, z = 0): Move => ({ at, pivot: under(at, aspect, sx, sy, z), push: push * g, arc: arc * g, rise: rise * g });
  return upright
    ? [
        // Down the row from its tall end, so all four stand in an upright frame.
        ...holdKeys(move({ pos: [420, T + 380, 470], aim: [1235, T + 1110, 60], fov: 58 }, 0.46, 0.72, 0.18, -3, 0), s5 + 1.2),
        // Past the dam's east end, turning to look back at it.
        { s: s6 - 0.1, pos: [1560, T + 1750, 420], aim: [1300, T + 2550, 20], fov: 58 },
        // (Wide of its east end and well over it, already looking back: the wall is never an edge sliding past the lens.)
        { s: s6 + 0.38, pos: [2330, T + 3420, 720], aim: [1340, T + 2850, 0], fov: 60 },
        // From the east bank below it: the dam across the frame, its three sluices, the channels running out toward the eye; the bank at the foot.
        // (Further out on the bank, so the running channel passes above the words and snow lies under them.)
        ...holdKeys(move({ pos: [2520, T + 4380, 900], aim: [1330, T + 2960, 0], fov: 62 }, 0.5, 0.56, 0.145, 3, 0), s6 + 1.2, FORK_BEFORE),
        // Across the three channels where they meet, turning with the water to look down the river again.
        { s: s7 - 0.2, pos: [1400, T + 3620, 700], aim: [700, T + 3720, 0], fov: 60 },
        // The lattice from up the west bank: all sixteen above the middle, the bank at the foot.
        ...holdKeys(move({ pos: [500, T + 2930, 930], aim: [1350, T + 4480, 0], fov: 58 }, 0.5, 0.62, 0.14, 4, 0), s7 + 1.15),
        { s: s8 + 0.3, pos: [1300, T + 4900, 230], aim: [1300, T + 5700, 90], fov: 60 },
        ...canyonKeys(s8, 66, g),
      ]
    : [
        // The four seracs from over the shallows' west bank; the eye goes round the row, so each stands clear of the next.
        ...holdKeys(band ? move({ pos: [760, T + 60, 250], aim: [1310, T + 1080, 96], fov: 42 }, 0.3, 0.8, 0.1, 2, 0) : move(colsPose(), 0.46, 0.62, 0.175, 5, 0), s5 + 1.2),
        // Past the dam's east end, turning to look back at it.
        { s: s6 - 0.1, pos: [1520, T + 1720, 280], aim: [1300, T + 2520, 20], fov: 46 },
        // (Wide of its east end and well over it, already looking back: the wall is never an edge sliding past the lens.)
        { s: s6 + 0.38, pos: [2200, T + 3150, 500], aim: [1420, T + 2810, 10], fov: 45 },
        // From the east bank below it: the dam across the frame, the open sluice's water coming toward the eye, the bank at lower left.
        ...holdKeys(move({ pos: [2130, T + 3800, 640], aim: [1520, T + 2900, 0], fov: 42 }, 0.45, 0.58, 0.175, -4, 0), s6 + 1.2, FORK_BEFORE),
        // Across the three channels where they meet, turning with the water to look down the river again.
        { s: s7 - 0.25, pos: [1620, T + 3560, 400], aim: [1120, T + 3840, 0], fov: 45 },
        { s: s7 + 0.3, pos: [800, T + 3660, 420], aim: [920, T + 4380, 10], fov: 44 },
        // The lattice from over its west bank, corner on: every cube and its mirror image. The eye goes round it, and the rows open and close.
        // (Turned a little to the left, so the bank at lower left is wide enough for the name to stand on snow alone.)
        ...holdKeys(move({ pos: [500, T + 3800, 640], aim: [1085, T + 4625, 0], fov: 45 }, 0.4, 0.7, 0.14, 6, 0), s7 + 1.15),
        { s: s8 + 0.3, pos: [1300, T + 4960, 170], aim: [1300, T + 5700, 90], fov: 48 },
        ...canyonKeys(s8, 50, g),
      ];
}

/**
 * Station 5's wide frame on the home page: the four seracs across the middle and right, each with its name over it, the
 * shallows running out to the right, and the west bank's snow filling the lower left, where the count stands.
 */
function colsPose(): Pose {
  return { pos: [640, T2 - 20, 300], aim: [1260, T2 + 1090, 20], fov: 42 };
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
function seaKeys(aspect: number, sunAz: number, s9: number, s10: number, g = 1): Key[] {
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
  const move = (at: Pose, sx: number, sy: number, push: number, arc: number, rise: number): Move => ({ at, pivot: under(at, aspect, sx, sy), push: push * g, arc: arc * g, rise: rise * g });
  return upright
    ? [
        // Out of the glacier and up over the west bank.
        { s: s9 + 0.2, pos: [1900, T + 7300, 260], aim: [1800, T + 8200, 0], fov: 60 },
        // The delta, looked at across its west shore: the bank fills the foot of the frame, the channels fan away above it.
        ...holdKeys(move({ pos: [700, T + 7500, 500], aim: [1458, T + 8258, 0], fov: 60 }, 0.5, 0.6, 0.125, 3, 2), s9 + 1.1),
        { s: s10 + 0.35, ...back(1750, 250, 52, 330) },
        { s: s10 + 0.95, ...back(620, 105, 42, 90) },
        { s: SETTLE_AT, ...rest },
        { s: END_AT, ...held },
      ]
    : [
        { s: s9 + 0.2, pos: [1960, T + 7330, 210], aim: [1800, T + 8200, 0], fov: 48 },
        // The delta from over its west bank: the bank at lower left, the channels to the right, the light beyond them.
        // The eye rises over the bank and closes on the channels, toward the light.
        ...holdKeys(move({ pos: [1100, T + 7450, 400], aim: [1500, T + 8750, 0], fov: 46 }, 0.44, 0.7, 0.132, 4, 2), s9 + 1.1),
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

/** How far along the canyon the eye goes toward the face for each screen of scroll while its hall is held. */
const PAST = 54;

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
 * The flight through the canyon: low on its middle line, looking well down
 * it (so the water leads away, both walls stand in the frame and the day
 * shows at the far end), banking into each bend; held on the straight
 * between them, where the polished face is seen whole.
 */
function canyonKeys(s8: number, fov: number, g = 1): Key[] {
  // (An upright screen keeps its words at the foot: the face is held above the middle, from further back so it is seen whole.)
  const tall = fov > 60;
  // (On a wide screen the eye looks up a little: the wall's foot is under the frame, so the lower left, where the words stand, is the wall's own ice alone.)
  const face: V3 = tall ? [FACE.x, FACE.y, FACE.z + FACE.h * 0.5 - 44] : [FACE.x, FACE.y + 105, FACE.z + FACE.h * 0.5 + (g < 1 ? -24 : 36)];
  const past = tall ? 75 : PAST;
  //            scroll, along, height, bank, looks at the face, how far left of the middle line (the outside of a bend sees furthest down the next reach)
  const run: [number, number, number, number, boolean, number][] = [
    [0.8, 40, 112, 0, false, 0],
    [1.05, 300, 98, 0, false, 20],
    [1.25, 500, 96, 4, false, 46],
    [1.45, 700, 94, 5, false, 30],
    // (Through the hall the eye goes on toward the face the whole time its words stand: the picture in the wall grows.)
    [1.65, (tall ? 796 : 972) - past * 0.55 * g, 93, 0, true, 0],
    [2.2, tall ? 796 : 972, 94, 0, true, 0],
    [2.8, (tall ? 796 : 972) + past * 0.6 * g, 94, 0, true, 0],
    [2.98, 1200, 94, -4, false, -40],
    [3.15, 1380, 94, -5, false, -24],
    [3.35, 1580, 112, 0, false, 0],
  ];
  return run.map(([ds, d, z, roll, toFace, left]) => {
    const [x0, y0] = canyonAt(d);
    const [x1, y1] = canyonAt(d + 2);
    const x = x0 - ((y1 - y0) / 2) * left;
    const y = y0 + ((x1 - x0) / 2) * left;
    const [ax, ay] = canyonAt(d + 340);
    const key: Key = { s: s8 + ds, pos: [x, y, z] as V3, aim: toFace ? face : ([ax, ay, z - 4] as V3), fov, roll };
    // (In the hall the eye goes at one steady pace toward the face: these keys say so themselves, as a station's move does.)
    if (toFace) key.v = { pos: [((x1 - x0) / 2) * past * g, ((y1 - y0) / 2) * past * g, 0], aim: [0, 0, 0], fov: 0, roll: 0 };
    return key;
  });
}

/**
 * Each station's hold: the stretch of scroll its move takes, and where in it the station stands composed.
 * (The dam is come at round its east end, a long way: its move begins later. The canyon's hall is its own run of keys.)
 */
export function HOLDS(): { name: string; from: number; stop: number; to: number }[] {
  const [, , view, up, bench, bridge, models, fork, lattice, canyon, delta] = sectionStarts();
  const hold = (name: string, stop: number, before = MOVE.before, after = MOVE.after) => ({ name, from: stop - before, stop, to: stop + after });
  return [
    hold('Infiniview', view + 1.0),
    hold('Upstream', up + 1.25),
    hold('Kilo Bench', bench + 1.15),
    hold('Agent Bridge', bridge + 1.2),
    hold('Open models', models + 1.2),
    hold('cc-switch', fork + 1.2, FORK_BEFORE),
    hold('TensorPoW', lattice + 1.15),
    hold('RydAR', canyon + 2.2, 0.55, 0.6),
    hold('Interests', delta + 1.1),
  ];
}
/** The dam's move begins this long before its composed frame. */
const FORK_BEFORE = 0.45;

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
 * The pose at a scroll position: one cubic through all the keys, so the
 * eye's speed never jumps. At a station's keys the speed is the move's own
 * (so the eye arrives already going the way the move goes, slows to it and
 * leaves from it, and never stops); at every other key it is the mean of
 * the slopes either side that cannot overshoot (zero only where a
 * coordinate turns back, and at the flight's last frame, where it rests).
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
    const own = keys[k].v;
    if (own) return get(own as Key);
    if (k === 0 || k === n - 1) return 0;
    const d0 = (get(keys[k]) - get(keys[k - 1])) / (keys[k].s - keys[k - 1].s);
    const d1 = (get(keys[k + 1]) - get(keys[k])) / (keys[k + 1].s - keys[k].s);
    if (d0 * d1 <= 0) return 0;
    // (The harmonic mean: between two unequal slopes it keeps nearer the gentler, and so never carries past a key.)
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
