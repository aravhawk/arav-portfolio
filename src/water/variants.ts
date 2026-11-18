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
 * What the pass needs to carry to draw this frame whole.
 * @param ice the lake's sheet is still there in any part (melt under 1, or its meltwater still running)
 * @param slab the block has its picture and is drawn
 */
export function passNeeds(cam: Basis, aspect: number, ice: boolean, slab: boolean): number {
  let need = 0;
  const [cx, cy] = cam.pos;
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
      const reach = SLAB.w * 4 + 8;
      if (dist < 5200 && boxInView(cam, aspect, [SLAB.x - reach, SLAB.y - reach, WATER_LOW], [SLAB.x + reach, SLAB.y + reach, 2])) need |= F.SLAB;
    }
  }
  // The confluence (`confNear`), and its trails in the river, which the water looks for by place.
  if (cy > CONF_Y - 3300 && cy < CONF_Y + 1500) need |= F.CONF;
  else if (boxInView(cam, aspect, [700, lipY(LIP.x0) - 900, WATER_LOW], [2500, lipY(700) + 40, 2])) need |= F.CONF;
  // The rock pool (`poolNear`), and its water, looked for by place (the bed under a ray lies up to a few hundred units on).
  const pcx = POOL.x + POOL.w / 2;
  const pcy = POOL.y + POOL.h / 2;
  if (Math.abs(cx - pcx) < 2300 && Math.abs(cy - pcy) < 2300) need |= F.POOL;
  else if (boxInView(cam, aspect, [POOL.x - 560, POOL.y - 560, WATER_LOW], [POOL.x + POOL.w + 560, POOL.y + POOL.h + 560, 2])) need |= F.POOL;
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
