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

import { byId, SECTIONS, timeline } from './registry';
import type { NameRow } from './name';
import { DY, NAME, REST, RIVER, T2 } from './world';

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

export { SECTIONS } from './registry';
/** The whole flight's length in screens. The page scrolls one screen less than this: the last screen is the ending, at rest. */
export const FLIGHT_SCREENS = Object.values(SECTIONS).reduce((a, b) => a + b, 0);
/** Where the scroll ends, and where the camera has come to rest over the sea (a little before it, so the last of the scroll is the ending held). */
export const END_AT = FLIGHT_SCREENS - 1;
export const SETTLE_AT = END_AT - 0.3;
/**
 * The light's own clock. The hours were calibrated station by station on the flight as it was first laid out, and a
 * station laid in later (`added` in the registry) must not move them: every station after it keeps its own hour, that
 * much further down the page. So the light reads the scroll through this: the position on the flight without the
 * added stations. Through an added station the hour still goes on, slowly (it takes that station and a fifth of its
 * length either side to pass what it used to pass in two fifths of its length), and its pace never jumps: it eases
 * down to that slow pace over the first quarter of the stretch and back up over the last. The stretch ends before
 * the next station's move begins and starts after the last one's words have left, so neither is touched.
 */
const ADDED = timeline.filter((entry) => 'added' in entry && entry.added).map((entry) => ({ from: entry.start, length: entry.length }));
export function lightAt(s: number): number {
  let out = s;
  for (const { from, length } of ADDED) {
    const lead = length * 0.2;
    const t = Math.min(1, Math.max(0, (s - (from - lead)) / (length + 2 * lead)));
    // (A straight run with a quarter of the stretch eased at either end: steep enough nowhere to turn the hour back.)
    const w = 0.25;
    const g = t < w ? (t * t) / (2 * w * (1 - w)) : t > 1 - w ? 1 - ((1 - t) * (1 - t)) / (2 * w * (1 - w)) : (t - w / 2) / (1 - w);
    out -= length * g;
  }
  return out;
}
/** Where the light's clock ends and where it settles: the flight's own end and rest, on that clock. */
export const LIGHT_END = END_AT - ADDED.reduce((sum, a) => sum + a.length, 0);
export const LIGHT_SETTLE = LIGHT_END - 0.3;
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
  const g = band ? 0.1 : 1;
  /** A station's move: its composed frame, the place in that frame that holds still, and how the eye goes. */
  const move = (at: Pose, sx: number, sy: number, push: number, arc: number, rise: number, z = 0): Move => ({ at, pivot: under(at, aspect, sx, sy, z), push: push * g, arc: arc * g, rise: rise * g });
  const hero = heroDesign(aspect).pose;
  // (On an upright frame the far row stands a long way behind the near one: the eye goes round less there, so the two keep in line.)
  const first: Move = { at: hero, pivot: [NAME.x, NAME.y, 0], push: (aspect < 0.9 ? 0.15 : HERO_PUSH) * g, arc: (aspect < 0.9 ? -1.5 : HERO_ARC) * g, rise: HERO_RISE * g };

  // An upright screen that is not a phone (a tablet held tall) flies the
  // phone's path after the hero: its copy sits at the foot, where that
  // path keeps a bank.
  const upright = aspect < 0.9;

  const wideFov = upright ? 62 : 50;
  const reach = (s: number, y: number): Key =>
    upright
      ? { s, pos: [reachBank(y + 390) - 300, y + DY, 250 - (y - 2180) * 0.012], aim: [reachBank(y + 390) - 10, y + 640 + DY, 0], fov: wideFov }
      : { s, pos: [reachBank(y + 500) - 350, y + DY, 158 - (y - 2250) * 0.012], aim: [reachBank(y + 500) - 110, y + 490 + DY, 0], fov: 48 };
  const opening = (): Key[] => upright ? [
      ...moveKeys(first, HOLD, [0, HOLD], (s) => s),
      // Up over the two rows as they founder: the plates afloat below and ahead, the far shore beyond.
      { s: 1.5, pos: [1320, 900, 1200], aim: [1400, 3500, 0], fov: wideFov },
      { s: 1.61, pos: [1380, 2900, 800], aim: [1450, 5200, 0], fov: wideFov },
      // Low over the lake's south end, looking down the river.
      { s: OUTLET_AT - 0.12, pos: [1440, 1560 + DY, 250], aim: [1530, 2200 + DY, 0], fov: wideFov },
  ] : [
      ...moveKeys(first, HOLD, [0, HOLD], (s) => s),
      // Up and out over the breaking lake: the name's plates have foundered and lie afloat among the floes just
      // ahead and below, riding down the lead toward the outlet; the far shore beyond them.
      { s: 1.5, pos: [1330, 700, 700], aim: [1400, 2500, 0], fov: wideFov },
      // Down the lake after them: the plates ride the current ahead, the outlet beyond.
      { s: 1.61, pos: [1350, 2500, 560], aim: [1450, 5000, 0], fov: wideFov },
      // Low over the lake's south end, looking down the river toward the ranges.
      { s: OUTLET_AT - 0.12, pos: [1380, 1640 + DY, 200], aim: [1500, 2190 + DY, 0], fov: wideFov },
  ];
  return timeline.flatMap(({ camera, start, stop, end }) => camera({
    aspect, upright, band, g, start, stop, end, move, holdKeys, opening, reach,
    ending: sea => seaKeys(aspect, sunAz, start, g, sea),
  }));
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
function seaKeys(aspect: number, sunAz: number, start: number, g: number, sea: boolean): Key[] {
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
  if (sea) return [
    { s: start + 0.35, ...(upright ? back(1750, 250, 52, 330) : back(1750, 230, 42, 250)) },
    { s: start + 0.95, ...(upright ? back(620, 105, 42, 90) : back(620, 100, 38, 78)) },
    { s: SETTLE_AT, ...rest },
    { s: END_AT, ...held },
  ];
  return upright
    ? [
        // Out of the glacier and up over the west bank.
        { s: start + 0.2, pos: [1900, T + 7300, 260], aim: [1800, T + 8200, 0], fov: 60 },
        // The delta, looked at across its west shore: the bank fills the foot of the frame, the channels fan away above it.
        ...holdKeys(move({ pos: [700, T + 7500, 500], aim: [1458, T + 8258, 0], fov: 60 }, 0.5, 0.6, 0.125, 3, 2), start + 1.1),
      ]
    : [
        { s: start + 0.2, pos: [1960, T + 7330, 210], aim: [1800, T + 8200, 0], fov: 48 },
        // The delta from over its west bank: the bank at lower left, the channels to the right, the light beyond them.
        // The eye rises over the bank and closes on the channels, toward the light.
        ...holdKeys(move({ pos: [1100, T + 7450, 400], aim: [1500, T + 8750, 0], fov: 46 }, 0.44, 0.7, 0.132, 4, 2), start + 1.1),
      ];
}

/**
 * How far the day has come round, 0..1, at a scroll position. The flight
 * begins in the morning (or, in the dark theme, in the polar night) and
 * ends at the ending's light. It moves a little all the way down, most of
 * it inside the canyon and over the sea, where no words depend on it.
 */
export function dayAt(s: number): number {
  return dayOnLight(lightAt(s));
}
/** The same, at a position on the light's own clock (see `lightAt`). */
export function dayOnLight(s: number): number {
  const h = SECTIONS.hero;
  const s9 = lightAt(byId.delta.start);
  const s8 = 23.6 * (LIGHT_END / 31.1);
  const keys: [number, number][] = [
    [0, 0],
    [h, 0],
    // (Through the canyon's hold, where the app's picture and its words are read, the light is still the day's.)
    [s8 + 2.75, 0.1],
    [s9 + 0.45, 0.42],
    [s9 + 1.1, 0.55],
    [s9 + SECTIONS.delta - 0.55, 0.6],
    [LIGHT_SETTLE - 0.25, 1],
    [LIGHT_END, 1],
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
/**
 * Each station's hold: the stretch of scroll its move takes, and where in it the station stands composed.
 * (The dam is come at round its east end, a long way: its move begins later. The canyon's hall is its own run of keys.)
 */
export function HOLDS(): { name: string; from: number; stop: number; to: number }[] {
  return timeline.flatMap(({ hold, stop }) => hold ? [{
    name: hold.name, from: stop - (hold.before ?? MOVE.before), stop, to: stop + (hold.after ?? MOVE.after),
  }] : []);
}

/** Where each section begins, in screens. */
export function sectionStarts(): number[] {
  return timeline.map(entry => entry.start);
}

/** The scroll position of each section's composed frame, for a still (reduced motion) flight. */
export function stillStops(): number[] {
  return timeline.map(entry => entry.stop);
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

export { projectPoint } from './projection';
