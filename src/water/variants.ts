/**
 * Which parts of the flight's shading pass a frame needs.
 *
 * The pass is one long program, and the GPU driver's cost follows the whole
 * program's shape: code that never runs still slows every pixel. So the pass
 * is compiled in variants, each carrying only some of the flight's subjects
 * (see `flightSource`), and each frame is drawn by the smallest variant that
 * carries everything that frame can show.
 *
 * What a frame can show is worked out here from the camera, by the very
 * rules the pass itself uses to decide whether to look for a subject (each
 * rule below names the line of the pass it mirrors). Where the pass decides
 * by a place on the ground instead, the rule is whether that place can be in
 * the frame at all. So a variant that leaves a subject out draws, for every
 * frame it is chosen for, exactly the picture the whole pass would: the
 * switch from one variant to the next cannot be seen.
 */

import { type Basis, type V3, projectPoint } from './camera';
import { stationsNear } from './moments';
import { CANYON, COLS, CONF_Y, DAM, DELTA, LAKE, LATTICE, LIP, POOL, SHARDS, SLAB, TARN, TARN_BAY, lipY } from './world';

/** The theme a variant is compiled for: the day's, the night's, or neither (it is told each frame, and draws the turn between them). */
export type Mode = 'day' | 'night' | 'any';

/** One bit to a subject. The ground, the water, the sky and the ranges are in every variant. */
export const F = {
  /** the lake's sheet of ice */
  ICE: 1,
  /** the block with the product picture, its shade, its image and the white water at its foot */
  SLAB: 2,
  /** the confluence: the snowfield, the cliff and its falls, the trails in the river */
  CONF: 4,
  /** the rock pool: its bed and plates, its rim, its boulders */
  POOL: 8,
  /** the tarn's two shards */
  SHARDS: 16,
  /** the seracs */
  COLS: 32,
  /** the dam and its sluices */
  DAM: 64,
  /** the lattice of cubes */
  LAT: 128,
  /** the canyon */
  CANYON: 256,
  /** the delta's light, the open sea, the ending */
  SEA: 512,
  /** the name's letters standing on the sheet: the blocks, their shade, their image, what stands under the water, the pieces that come away (only with FIELD) */
  NAME: 1024,
  /** the stretch of bare swept ice the name stands on (only with ICE) */
  FIELD: 2048,
} as const;
export const F_ALL = 4095;
/** The name each bit is known by in the pass's source. */
export const F_DEFINES = ['F_ICE', 'F_SLAB', 'F_CONF', 'F_POOL', 'F_SHARDS', 'F_COLS', 'F_DAM', 'F_LAT', 'F_CANYON', 'SEA', 'F_NAME', 'F_FIELD'];

/** For the checks: a mask as words. */
export const maskName = (mask: number) =>
  F_DEFINES.filter((_, i) => mask & (1 << i))
    .map((n) => n.replace('F_', '').toLowerCase())
    .join('+') || 'plain';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Whether any of a box of the world can be in the frame. It errs toward
 * yes: a box is ruled out only when all of it lies behind the eye or beyond
 * one side of the frame (with a little room, for the four rays a pixel may
 * be looked at through).
 */
export function boxInView(cam: Basis, aspect: number, lo: V3, hi: V3): boolean {
  const tx = cam.tan * aspect * 1.03 + 0.002;
  const ty = cam.tan * 1.03 + 0.002;
  let behind = 0;
  let left = 0;
  let right = 0;
  let below = 0;
  let above = 0;
  for (let i = 0; i < 8; i++) {
    const dx = (i & 1 ? hi[0] : lo[0]) - cam.pos[0];
    const dy = (i & 2 ? hi[1] : lo[1]) - cam.pos[1];
    const dz = (i & 4 ? hi[2] : lo[2]) - cam.pos[2];
    const z = dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2];
    const x = dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2];
    const y = dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2];
    if (z <= 0) behind++;
    if (x < -z * tx) left++;
    if (x > z * tx) right++;
    if (y < -z * ty) below++;
    if (y > z * ty) above++;
  }
  return !(behind === 8 || left === 8 || right === 8 || below === 8 || above === 8);
}

/** The block's place in the frame: the part of the screen it can be on (vUv: x0, y0, x1, y1), and how many of its corners are behind the eye. */
export function slabInFrame(cam: Basis, aspect: number) {
  const sin = Math.sin(SLAB.turn);
  const cos = Math.cos(SLAB.turn);
  const nx = -sin;
  const ny = -cos;
  const rx = cos;
  const ry = -sin;
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  let behind = 0;
  for (let i = 0; i < 8; i++) {
    const side = (i & 1 ? 0.5 : -0.5) * SLAB.w;
    const back = i & 2 ? SLAB.thick : 0;
    const z = SLAB.lift + (i & 4 ? SLAB.h : 0);
    const pr = projectPoint(cam, [SLAB.x + rx * side - nx * back, SLAB.y + ry * side - ny * back, z], aspect);
    if (pr[2] < 1) behind++;
    x0 = Math.min(x0, pr[0]);
    x1 = Math.max(x1, pr[0]);
    y0 = Math.min(y0, 1 - pr[1]);
    y1 = Math.max(y1, 1 - pr[1]);
  }
  const box: [number, number, number, number] = behind > 0 ? [0, 0, 1, 1] : [x0 - 0.01, y0 - 0.01, x1 + 0.01, y1 + 0.01];
  return { nx, ny, rx, ry, behind, box };
}

/** How near the open sea is: 0 too far to be seen, 1 over it (the pass's uSea.x). */
export function seaNear(cam: Basis): number {
  const toSea = Math.hypot(cam.pos[0] - 1900, cam.pos[1] - DELTA.sea);
  return cam.pos[1] > DELTA.sea ? 1 : 1 - smooth(2600, 3400, toSea);
}

/** Whether the tarn's shards are near enough to be looked for (the pass's uShardOn). */
export const tarnNear = (cam: Basis) => Math.hypot(cam.pos[0] - TARN.x, cam.pos[1] - TARN.y) < 3200 && cam.pos[2] < 700;

/** The water lies at most this far below the land (the walled basin's freeboard, with room). */
const WATER_LOW = -64;
/**
 * The ground under a ray can stand this far above the land: at the confluence the pass takes the place where the ray
 * comes down on the snowfield for the ground's (confLift), and looks for whatever lies by place from there. So a
 * subject near the snowfield can be found by a ray that is still this high over it.
 */
const FIELD_HIGH = LIP.h * 3.3;

export type Box = [V3, V3];
/** Where the block's shade, its light, its image and its white water can lie: the ground and water within four widths of it. */
const SLAB_REACH = SLAB.w * 4 + 8;
const SLAB_GROUND: Box = [
  [SLAB.x - SLAB_REACH, SLAB.y - SLAB_REACH, WATER_LOW],
  [SLAB.x + SLAB_REACH, SLAB.y + SLAB_REACH, 2],
];
/** Where the confluence's trails lie in the river (the water looks for them by place). */
const CONF_RIVER_BOX: Box = [
  [700, lipY(LIP.x0) - 900, WATER_LOW],
  [2500, lipY(700) + 40, FIELD_HIGH],
];
/** Where the pool's water is (the bed under a ray lies up to a few hundred units on). */
const POOL_BOX: Box = [
  [POOL.x - 560, POOL.y - 560, WATER_LOW],
  [POOL.x + POOL.w + 560, POOL.y + POOL.h + 560, FIELD_HIGH],
];
const confNearCam = (cam: Basis) => cam.pos[1] > CONF_Y - 3300 && cam.pos[1] < CONF_Y + 1500;
const poolNearCam = (cam: Basis) => Math.abs(cam.pos[0] - (POOL.x + POOL.w / 2)) < 2300 && Math.abs(cam.pos[1] - (POOL.y + POOL.h / 2)) < 2300;

/**
 * What of the lake's ice there is to draw at a point in its melt.
 *  - on: the sheet, in any part. From the melt at which the last floe has gone (the engine's ICE_GONE) the pass asks
 *    nothing of the ice field: `hasIce` is false everywhere, the name's pond and the sheet's own water are nothing
 *    (`sheetK`, `pondK` and `gDeep` in the water are all 0 by then). What the melt still does to the lake's water after
 *    that (`uGlow`, `uMeltAct`) is told to every variant.
 *  - blocks: the letters. They have gone under when `uNameM.w` is 0 (bindIce: `left`), and with it their shade, their
 *    image, what stands under the water and the pieces afloat are all nothing.
 *  - field: the swept ice. By day it lies on whatever of the sheet is left; before dawn it is rimed over once the sheet
 *    is plates (nameCover: `K *= 1.0 - uNight * smoothstep(0.5, 0.64, uIceA.z)`).
 */
export interface IceParts {
  on: boolean;
  blocks: boolean;
  field: boolean;
}
export const NO_ICE: IceParts = { on: false, blocks: false, field: false };
/** The melt at which the last floe is gone (the engine's ICE_GONE). */
const MELT_GONE = 0.9;
/**
 * @param melt 0..1
 * @param night 0 by day, 1 before dawn, between while the theme turns
 * @param stands whether the name stands on the sheet as blocks (the home page; an inner page's lake has none)
 */
export function iceParts(melt: number, night: number, stands: boolean): IceParts {
  const on = melt < MELT_GONE;
  // (The plates founder one by one and then ride on as bergs while any of the sheet is left: they are there as long as it is.)
  return { on, blocks: on && stands, field: on && stands };
}

/**
 * Where anything of the lake's ice can be, along the valley: the sheet lies on the lake (`hasIce`: within 80 units of
 * its two shores), the water it shades or stands in is the lake's (`lakeK`: to 290 units past the south shore, found
 * up to a few hundred units on under a bent ray), and the letters stand on it. Across the valley it has no end.
 */
const LAKE_Y: [number, number] = [LAKE.y0 - 600, LAKE.y1 + 900];
/**
 * Whether any ray of the frame can reach a stretch of the valley (all that lies between two distances down it, at any
 * height, however far to either side). From inside it, yes. From outside, only if some ray of the frame heads back
 * toward it: the frame's rays are spanned by its four corners, so if none of those does, none does.
 */
export function reachInView(cam: Basis, aspect: number, y0: number, y1: number): boolean {
  const cy = cam.pos[1];
  if (cy >= y0 && cy <= y1) return true;
  const tx = cam.tan * aspect * 1.03 + 0.002;
  const ty = cam.tan * 1.03 + 0.002;
  const side = Math.abs(cam.r[1]) * tx + Math.abs(cam.u[1]) * ty;
  return cy > y1 ? cam.f[1] - side < 0 : cam.f[1] + side > 0;
}

/** A part of the frame, in the pass's own vUv (u right, v up): x0, y0, x1, y1. */
export type Rect = [number, number, number, number];
/**
 * The part of the frame a box of the world can be seen in, with a little
 * room; null when any of it is behind the eye (then it is not known).
 */
export function boxRect(cam: Basis, aspect: number, [lo, hi]: Box): Rect | null {
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;
  for (let i = 0; i < 8; i++) {
    const pr = projectPoint(cam, [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]], aspect);
    if (pr[2] < 1) return null;
    x0 = Math.min(x0, pr[0]);
    x1 = Math.max(x1, pr[0]);
    y0 = Math.min(y0, 1 - pr[1]);
    y1 = Math.max(y1, 1 - pr[1]);
  }
  return [x0 - 0.004, y0 - 0.004, x1 + 0.004, y1 + 0.004];
}

/**
 * The part of the frame a box of the world can be seen in, whatever of it is behind the eye: the box is cut at the
 * eye's own plane first, so what is left of it is all in front and its corners can be projected. null: none of it is
 * in front of the eye. (It errs wide: where the box runs past the eye the rectangle runs off the frame on that side.)
 */
export function boxRectCut(cam: Basis, aspect: number, [lo, hi]: Box): Rect | null {
  const NEAR = 0.5;
  const tx = cam.tan * aspect;
  const ty = cam.tan;
  // The corners, in the eye's frame: across, up, forward.
  const c: V3[] = [];
  for (let i = 0; i < 8; i++) {
    const dx = (i & 1 ? hi[0] : lo[0]) - cam.pos[0];
    const dy = (i & 2 ? hi[1] : lo[1]) - cam.pos[1];
    const dz = (i & 4 ? hi[2] : lo[2]) - cam.pos[2];
    c.push([dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2], dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2], dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2]]);
  }
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;
  let any = false;
  const put = (x: number, y: number, z: number) => {
    const u = 0.5 + x / (z * tx) / 2;
    const v = 0.5 + y / (z * ty) / 2;
    x0 = Math.min(x0, u);
    x1 = Math.max(x1, u);
    y0 = Math.min(y0, v);
    y1 = Math.max(y1, v);
    any = true;
  };
  for (let i = 0; i < 8; i++) {
    const a = c[i];
    if (a[2] >= NEAR) put(a[0], a[1], a[2]);
    // Each of the box's twelve edges that crosses the eye's plane is cut there.
    for (let k = 1; k < 8; k <<= 1) {
      if (i & k) continue;
      const b = c[i | k];
      if (a[2] >= NEAR === b[2] >= NEAR) continue;
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      put(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR);
    }
  }
  return any ? [x0 - 0.004, y0 - 0.004, x1 + 0.004, y1 + 0.004] : null;
}

/** Where the sheet, its water and what lies on it can be in the frame: the lake's own ground and water, from side to side of the world and beyond. */
const LAKE_GROUND: Box = [
  [-60000, LAKE_Y[0], WATER_LOW],
  [60000, LAKE_Y[1], 24],
];
/**
 * Where the swept field can be. It is laid out in the first camera's picture of the name (nameSwept), up to about
 * four of the name's half heights above its middle, and the far shore and the horizon stand about there in that
 * picture: so its faint far end lies on all the ground from the lake to the horizon, the land beyond the lake too.
 */
const FIELD_GROUND: Box = [
  [-400000, LAKE_Y[0], WATER_LOW],
  [400000, 400000, 24],
];

/**
 * Where each of the later stations' subjects can be: what the pass's own tests admit (each names the test it mirrors).
 * All of a subject's own ice is inside its box, and so is every place on the water or the ground where its image, its
 * shade or its light is looked for: a ray that meets such a place passes through the box's foot.
 */
// The seracs: themselves, and the water and bank within `rect` of them (columns: `abs(pwp.x - 1340.0) < 800.0 && abs(pwp.y - COL_Y) < 560.0`).
const COLS_BOX: Box = [
  [1340 - 830, COLS.y - 590, WATER_LOW],
  [1340 + 830, COLS.y + 590, COLS.hMax * 1.25 + 40],
];
// (And a serac is looked for along the whole of a ray, under the water too: a ray that would meet one below the water
// is given the seracs' long shade on the water it meets first, wherever that is (columns: `best > tw`). So every pixel
// under a serac in the frame can need them: the box they stand in, carried down out of sight.)
const COL_REACH = 2.7 * COLS.r + 40;
const COLS_DEEP: Box = [
  [COLS.xs[0] - COL_REACH, COLS.y - 26 - COL_REACH, -1e5],
  [COLS.xs[3] + COL_REACH, COLS.y + 26 + COL_REACH, COLS.hMax * 1.25 + 40],
];
// The dam: its wall and hips, its pond behind it and its three channels below it (dam: `d < -pond - 120 || d > 1010 || abs(pwp.x - 1300) > 640`).
const DAM_BOX: Box = [
  [Math.min(DAM.x0 - 180, 1300 - 660), DAM.y - DAM.pond - 150, WATER_LOW],
  [Math.max(DAM.x1 + 180, 1300 + 660), DAM.y + 1040, DAM.h + 40],
];
// The lattice: its cubes, and the pool's water round them (lattice: `max(abs(q.x), abs(q.y)) > 2.0 * LAT_P + 300.0`).
const LAT_REACH = 2 * LATTICE.pitch + 330;
const LAT_BOX: Box = [
  [LATTICE.x - LAT_REACH, LATTICE.y - LAT_REACH, WATER_LOW],
  [LATTICE.x + LAT_REACH, LATTICE.y + LAT_REACH, LATTICE.h * 3 + 60],
];
// The canyon: the glacier's own box (glacierHit's), which its water lies in too.
const CANYON_BOX: Box = [
  [CANYON.x0 - 4, CANYON.y0 - 4, WATER_LOW],
  [CANYON.x1 + 4, CANYON.y1 + 4, CANYON.h + 6],
];
// The tarn's shards: the tarn and its bay (their image, their rings, the pulse), and the light each throws into the
// air and onto the water round it, which dies away with distance (to a three-thousandth of itself, eight of its own
// lengths off: far under one step of the screen's 255).
const SHARD_GLOW = 8 * 1.9 * Math.max(SHARDS[0].r, SHARDS[1].r);
const SHARDS_BOX: Box = [
  [Math.min(TARN.x - TARN.rx - 20, TARN_BAY.x - TARN_BAY.r - 20, SHARDS[0].x - SHARD_GLOW, SHARDS[1].x - SHARD_GLOW), Math.min(TARN.y - TARN.ry - 20, TARN_BAY.y - TARN_BAY.r - 20, SHARDS[0].y - SHARD_GLOW, SHARDS[1].y - SHARD_GLOW), -SHARD_GLOW],
  [Math.max(TARN.x + TARN.rx + 20, TARN_BAY.x + TARN_BAY.r + 20, SHARDS[0].x + SHARD_GLOW, SHARDS[1].x + SHARD_GLOW), Math.max(TARN.y + TARN.ry + 20, TARN_BAY.y + TARN_BAY.r + 20, SHARDS[0].y + SHARD_GLOW, SHARDS[1].y + SHARD_GLOW), Math.max(SHARDS[0].h, SHARDS[1].h) + SHARD_GLOW],
];

/**
 * A frame, cut into parts that each need less than the whole.
 *
 * A subject the pass looks for by place stands in a part of the frame: the lake's sheet and the name on it (the
 * lake's own ground and water, and the letters' box), the block and what it does to the ground and water round it,
 * the confluence's trails in the river, the pool's water. Outside that part the pass with the subject and the pass
 * without it draw the same pixel, and the one without it is the cheaper (a subject's code slows a pixel that never
 * runs it, and two subjects in one program cost more than the two apart). So each such subject is given its
 * rectangle, the frame is cut along the rectangles' edges, and every piece is drawn once, by a variant that carries
 * what stands in that piece and nothing else. A subject that fills nearly all of the frame is the frame's own.
 * @param need what the whole frame needs (passNeeds)
 * @param nameBox the box the letters stand in, while they stand
 * @param w, h the frame's size in device pixels
 * @returns each different need, with the pieces of the frame that have it (x, y, width, height in device pixels, y up)
 */
export interface Tile {
  mask: number;
  px: [number, number, number, number][];
  /** the share of the frame these pieces cover */
  area: number;
}
export function frameTiles(cam: Basis, aspect: number, need: number, nameBox: Box | null, w: number, h: number): Tile[] {
  const whole: Tile[] = [{ mask: need, px: [[0, 0, w, h]], area: 1 }];
  const parts: { bits: number; r: [number, number, number, number] }[] = [];
  const take = (bits: number, r: Rect | null) => {
    if (!bits) return;
    if (!r) return;
    // (In whole pixels, with a little room; a part that is nearly the frame is not cut out of it.)
    const x0 = Math.max(0, Math.floor(r[0] * w) - 2);
    const y0 = Math.max(0, Math.floor(r[1] * h) - 2);
    const x1 = Math.min(w, Math.ceil(r[2] * w) + 2);
    const y1 = Math.min(h, Math.ceil(r[3] * h) + 2);
    if (x1 <= x0 || y1 <= y0) {
      // (Looked for by place, and that place is not in the frame: no piece of the frame needs it.)
      need &= ~bits;
      return;
    }
    if ((x1 - x0) * (y1 - y0) > 0.86 * w * h) return;
    parts.push({ bits, r: [x0, y0, x1, y1] });
  };
  const NONE: Rect = [0, 0, 0, 0];
  const join = (a: Rect | null, b: Rect | null): Rect | null => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const lake = need & (F.ICE | F.FIELD | F.NAME);
  if (lake) take(lake, join(boxRectCut(cam, aspect, need & F.FIELD ? FIELD_GROUND : LAKE_GROUND), need & F.NAME && nameBox ? boxRectCut(cam, aspect, nameBox) : null) ?? NONE);
  if (need & F.SLAB) {
    const s = slabInFrame(cam, aspect);
    if (s.behind === 0) take(F.SLAB, join(s.box, boxRectCut(cam, aspect, SLAB_GROUND)));
  }
  const conf = need & F.CONF && !confNearCam(cam) ? (boxRectCut(cam, aspect, CONF_RIVER_BOX) ?? NONE) : null;
  const pool = need & F.POOL && !poolNearCam(cam) ? (boxRectCut(cam, aspect, POOL_BOX) ?? NONE) : null;
  const both = join(conf, pool)!;
  // (Two small far subjects side by side are one piece: a variant and a draw for each sliver between them would cost more than it saved.)
  if (conf && pool && conf !== NONE && pool !== NONE && (both[2] - both[0]) * (both[3] - both[1]) < 0.06) take(F.CONF | F.POOL, both);
  else {
    if (conf) take(F.CONF, conf);
    if (pool) take(F.POOL, pool);
  }
  if (need & F.SHARDS) take(F.SHARDS, boxRectCut(cam, aspect, SHARDS_BOX) ?? NONE);
  if (need & F.COLS) take(F.COLS, join(boxRectCut(cam, aspect, COLS_BOX), boxRectCut(cam, aspect, COLS_DEEP)) ?? NONE);
  if (need & F.DAM) take(F.DAM, boxRectCut(cam, aspect, DAM_BOX) ?? NONE);
  if (need & F.LAT) take(F.LAT, boxRectCut(cam, aspect, LAT_BOX) ?? NONE);
  if (need & F.CANYON) take(F.CANYON, boxRectCut(cam, aspect, CANYON_BOX) ?? NONE);
  if (!parts.length) {
    whole[0].mask = need;
    return whole;
  }
  let base = need;
  for (const q of parts) base &= ~q.bits;
  // The frame is cut along every edge of every part; each piece then lies wholly inside or outside each part.
  const xs = [...new Set([0, w, ...parts.flatMap((q) => [q.r[0], q.r[2]])])].sort((a, b) => a - b);
  const ys = [...new Set([0, h, ...parts.flatMap((q) => [q.r[1], q.r[3]])])].sort((a, b) => a - b);
  const maskAt = (x: number, y: number) => {
    let m = base;
    for (const q of parts) if (x >= q.r[0] && x < q.r[2] && y >= q.r[1] && y < q.r[3]) m |= q.bits;
    return m;
  };
  // Pieces side by side with the same need are one piece; so are pieces one over the other with the same span.
  const open = new Map<string, [number, number, number, number]>();
  const tiles = new Map<number, Tile>();
  const close = (mask: number, r: [number, number, number, number]) => {
    let t = tiles.get(mask);
    if (!t) tiles.set(mask, (t = { mask, px: [], area: 0 }));
    t.px.push(r);
    t.area += (r[2] * r[3]) / (w * h);
  };
  for (let j = 0; j < ys.length - 1; j++) {
    const row: [number, number, number][] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const m = maskAt(xs[i], ys[j]);
      const last = row[row.length - 1];
      if (last && last[2] === m) last[1] = xs[i + 1];
      else row.push([xs[i], xs[i + 1], m]);
    }
    const seen = new Set<string>();
    for (const [a, b, m] of row) {
      const key = `${a}:${b}:${m}`;
      seen.add(key);
      const up = open.get(key);
      if (up) up[3] += ys[j + 1] - ys[j];
      else open.set(key, [a, ys[j], b - a, ys[j + 1] - ys[j]]);
    }
    for (const [key, r] of open) {
      if (seen.has(key)) continue;
      close(Number(key.split(':')[2]), r);
      open.delete(key);
    }
  }
  for (const [key, r] of open) close(Number(key.split(':')[2]), r);
  // (The largest first: it is the frame's own.)
  return [...tiles.values()].sort((a, b) => b.area - a.area);
}

/**
 * What the pass needs to carry to draw this frame whole.
 * @param ice what of the lake's ice there is to draw (iceParts)
 * @param slab the block has its picture and is drawn
 */
export function passNeeds(cam: Basis, aspect: number, ice: IceParts, slab: boolean): number {
  let need = 0;
  const cx = cam.pos[0];
  const cy = cam.pos[1];
  // The sheet, the swept field and the letters: each while it is there, and only while the lake can be in the frame.
  if (ice.on && reachInView(cam, aspect, LAKE_Y[0], LAKE_Y[1])) {
    need |= F.ICE;
    if (ice.field) need |= F.FIELD;
    if (ice.field && ice.blocks) need |= F.NAME;
  }
  // The block (main: `slabNear`, the ground's `uSlabSize.x > 0.0 && length(uCamPos.xy - uSlabPos.xy) < 5200.0`).
  if (slab) {
    const s = slabInFrame(cam, aspect);
    const dist = Math.hypot(cx - SLAB.x, cy - SLAB.y);
    if (s.behind < 8) {
      // Itself: inside its box of the screen, and near enough not to be lost in the air (it is gone past 2500 units).
      const onScreen = s.box[0] < 1 && s.box[2] > 0 && s.box[1] < 1 && s.box[3] > 0;
      const reachOut = Math.hypot(SLAB.w * 0.5 + SLAB.thick, SLAB.thick, SLAB.h + SLAB.lift);
      if (onScreen && Math.hypot(dist, cam.pos[2]) < 2500 + reachOut) need |= F.SLAB;
      // Its shade, its light, its image and its white water: on the ground and water within four widths of it.
      if (dist < 5200 && boxInView(cam, aspect, SLAB_GROUND[0], SLAB_GROUND[1])) need |= F.SLAB;
    }
  }
  // The confluence (`confNear`), and its trails in the river, which the water looks for by place.
  if (confNearCam(cam)) need |= F.CONF;
  else if (boxInView(cam, aspect, CONF_RIVER_BOX[0], CONF_RIVER_BOX[1])) need |= F.CONF;
  // The rock pool (`poolNear`), and its water, looked for by place (the bed under a ray lies up to a few hundred units on).
  if (poolNearCam(cam)) need |= F.POOL;
  else if (boxInView(cam, aspect, POOL_BOX[0], POOL_BOX[1])) need |= F.POOL;
  if (tarnNear(cam)) need |= F.SHARDS;
  // The last four stations (`uSt`).
  const st = stationsNear(cam.pos);
  if (st[0] > 0) need |= F.COLS;
  if (st[1] > 0) need |= F.DAM;
  if (st[2] > 0) need |= F.LAT;
  if (st[3] > 0) need |= F.CANYON;
  if (seaNear(cam) > 0) need |= F.SEA;
  return need;
}

/** How many subjects a mask carries. */
export function bits(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}
