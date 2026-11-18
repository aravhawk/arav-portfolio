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
import { CONF_Y, DELTA, LIP, POOL, SLAB, TARN, lipY } from './world';

/** The theme a variant is compiled for: the day's, the night's, or neither (it is told each frame, and draws the turn between them). */
export type Mode = 'day' | 'night' | 'any';

/** One bit to a subject. The ground, the water, the sky and the ranges are in every variant. */
export const F = {
  /** the lake's sheet of ice and the name standing on it */
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
} as const;
export const F_ALL = 1023;
/** The name each bit is known by in the pass's source. */
export const F_DEFINES = ['F_ICE', 'F_SLAB', 'F_CONF', 'F_POOL', 'F_SHARDS', 'F_COLS', 'F_DAM', 'F_LAT', 'F_CANYON', 'SEA'];

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

type Box = [V3, V3];
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
 * The subjects a frame needs only in a small part of itself: a subject the
 * pass looks for by place (the block and what it does to the ground and
 * water round it, the confluence's trails, the pool's water) and that is
 * far enough off to stand in a small rectangle of the frame. The frame is
 * then drawn by a variant without them (`lean`), and only those rectangles
 * again by the variant that carries them: every pixel is still drawn by a
 * variant that carries all it can show.
 * @param need what the whole frame needs (passNeeds)
 */
export function farParts(cam: Basis, aspect: number, need: number): { lean: number; rects: Rect[] } {
  let lean = need;
  const rects: Rect[] = [];
  const take = (bit: number, r: Rect | null) => {
    if (!r) return;
    const x0 = Math.max(0, r[0]);
    const y0 = Math.max(0, r[1]);
    const x1 = Math.min(1, r[2]);
    const y1 = Math.min(1, r[3]);
    // (A subject that fills much of the frame is the frame's own.)
    if (x1 <= x0 || y1 <= y0 || (x1 - x0) * (y1 - y0) > 0.3) return;
    lean &= ~bit;
    rects.push([x0, y0, x1, y1]);
  };
  if (need & F.SLAB) {
    const s = slabInFrame(cam, aspect);
    const g = boxRect(cam, aspect, SLAB_GROUND);
    if (s.behind === 0 && g) take(F.SLAB, [Math.min(s.box[0], g[0]), Math.min(s.box[1], g[1]), Math.max(s.box[2], g[2]), Math.max(s.box[3], g[3])]);
  }
  if (need & F.CONF && !confNearCam(cam)) take(F.CONF, boxRect(cam, aspect, CONF_RIVER_BOX));
  if (need & F.POOL && !poolNearCam(cam)) take(F.POOL, boxRect(cam, aspect, POOL_BOX));
  return { lean, rects };
}

/**
 * What the pass needs to carry to draw this frame whole.
 * @param ice the lake's sheet is still there in any part (melt under 1, or its meltwater still running)
 * @param slab the block has its picture and is drawn
 */
export function passNeeds(cam: Basis, aspect: number, ice: boolean, slab: boolean): number {
  let need = 0;
  const cx = cam.pos[0];
  const cy = cam.pos[1];
  // The sheet and the name: `hasIce`, `uGlow`, `uNameG.w` in the pass are all nothing once the melt is done.
  if (ice) need |= F.ICE;
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
