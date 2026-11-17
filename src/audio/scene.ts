/**
 * From what the picture publishes to what the sound needs to know.
 *
 * The picture says where the camera is and how far the page has come. This
 * works out the rest once a frame: how fast the camera and the scroll are
 * moving, how much of the frame is water, how near it is and on which side,
 * how fast that water runs, and how near each station is. The world is the
 * flight's own (`world.ts`), so the sound hears what the picture shows.
 */

import { type Basis, SETTLE_AT, groundUnder, projectPoint, sectionStarts } from '@/water/camera';
import { BASIN, CANYON, CANYON_LINE, CONF_Y, DAM, DELTA, ISLAND, LAKE, LATTICE, POOL, SLUICES, STREAM, TARN, TRIBS, T2 } from '@/water/world';
import { MOVE } from './theory';

export interface SignalsLike {
  at: number;
  s: number;
  cam: { pos: number[]; f: number[]; r: number[]; u: number[]; tan: number } | null;
  aspect: number;
  melt: number;
  day: number;
  rest: boolean;
  clock: number;
  st: ArrayLike<number>;
  gate: ArrayLike<number>;
  surge: ArrayLike<number>;
  ray: number;
  lift: number;
  px: number;
  py: number;
  far: number;
  moved: number;
  scrollY: number;
}

export interface Scene {
  /** a flight is running under the page (the home page) */
  home: boolean;
  /** seconds since the last frame */
  dt: number;
  /** scroll in screens, and how fast it is moving (screens a second, never negative) */
  s: number;
  sv: number;
  /** 0..1 the lake's melt, and how fast it is changing (per second) */
  melt: number;
  meltRate: number;
  day: number;
  rest: boolean;
  /** 0 by day, 1 before dawn */
  night: number;
  /** reduced motion: sweeps are calmed */
  calm: boolean;
  /** the camera's height over the water and its speed, world units and units a second */
  camH: number;
  camV: number;
  /** 0..1 how much of the ground in frame is open water, how near the nearest of it is, and which side it is on (-1 left, 1 right) */
  water: number;
  near: number;
  pan: number;
  /** 0..1 how fast that water runs, and how much of it is white */
  flow: number;
  white: number;
  /** 0..1 how much of the ground in frame is ice, and how much is open sea */
  ice: number;
  sea: number;
  /** 0..1 how much of the frame is the still tarn */
  tarn: number;
  /** 0..1 how near the columns, the dam, the lattice and the canyon are (the picture's own measure) */
  cols: number;
  dam: number;
  lattice: number;
  canyon: number;
  /** 0..1 how closed in the camera is by the canyon's walls */
  walls: number;
  /** which movement of the piece this place belongs to */
  move: number;
  /** the pointer: over water or not, where across the frame (0..1), how fast (frame widths a second), how far off the water under it is (world units, about 12 near to 70 far) */
  over: boolean;
  px: number;
  pv: number;
  far: number;
  /** the picture's clock, the sluices, the ending's light */
  clock: number;
  gate: ArrayLike<number>;
  surge: ArrayLike<number>;
  ray: number;
  lift: number;
  /** the camera and the frame's shape, for placing a sound where its cause is seen */
  cam: Basis | null;
  aspect: number;
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const sat = (x: number) => Math.min(1, Math.max(0, x));

interface Pt {
  x: number;
  y: number;
}

/** How far a point is from a line of points. */
function toLine(x: number, y: number, line: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
    if (d < best) best = d;
  }
  return best;
}

const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

/** What lies at a point of the world: open water or not, how fast it runs, how white it is, whether it is the sea. */
export interface Ground {
  wet: number;
  flow: number;
  white: number;
  ice: number;
  sea: number;
  /** the tarn: water that does not move */
  still?: number;
}

const DRY: Ground = { wet: 0, flow: 0, white: 0, ice: 0, sea: 0 };
const COL_POOL = { x: 880, y: T2 + 640, w: 1080, h: 820 };
const LAT_HALF = LATTICE.pitch * 2 + 110;
const TAIL: Pt[] = [
  { x: 1300, y: T2 - 120 },
  { x: 1300, y: T2 + 640 },
];
const TO_DAM: Pt[] = [
  { x: 1300, y: T2 + 1400 },
  { x: 1240, y: T2 + 1850 },
  { x: 1300, y: T2 + 2300 },
  { x: 1300, y: DAM.y - 200 },
];
const TO_LATTICE: Pt[] = [
  { x: 1300, y: DAM.y + 960 },
  { x: 1300, y: LATTICE.y - LAT_HALF },
];
const TO_CANYON: Pt[] = [
  { x: 1300, y: LATTICE.y + LAT_HALF - 40 },
  { x: 1300, y: T2 + 5360 },
];
const TO_DELTA: Pt[] = [
  { x: 2020, y: T2 + 7100 },
  { x: 1990, y: T2 + 7330 },
  { x: 1800, y: T2 + 7560 },
  { x: DELTA.apex.x, y: DELTA.apex.y },
];

/**
 * The world's water, read from the same plan the bed is carved from. It is
 * a plan, not the carved bed: banks are taken at the channel's nominal
 * width, which is near enough for how loud a river is.
 */
export function groundAt(x: number, y: number, melt: number, gate: ArrayLike<number>): Ground {
  // The lake: ice until it melts, then still water.
  if (y < LAKE.y1) return { wet: melt, flow: 0.06, white: 0, ice: 1 - melt, sea: 0 };
  // The open sea, and the delta's arms running out to it.
  if (y > DELTA.sea) return { wet: 1, flow: 0.18, white: 0, ice: 0, sea: 1 };
  if (y > DELTA.apex.y) {
    const fan = (y - DELTA.apex.y) / (DELTA.sea - DELTA.apex.y);
    return Math.abs(x - (DELTA.apex.x + 260 * fan)) < 160 + 620 * fan ? { wet: 0.55, flow: 0.4, white: 0, ice: 0, sea: 0.4 * fan } : DRY;
  }
  if (y < T2 - 120) {
    // The first reach: the river, the basin, the confluence, the pool, the tarn.
    const dx = x - TARN.x;
    const dy = y - TARN.y;
    if ((dx * dx) / (TARN.rx * TARN.rx) + (dy * dy) / (TARN.ry * TARN.ry) < 1) return { wet: 1, flow: 0.02, white: 0, ice: 0, sea: 0, still: 1 };
    if (inRect(x, y, POOL)) return { wet: 1, flow: 0.05, white: 0, ice: 0, sea: 0 };
    if (inRect(x, y, BASIN)) {
      const ix = (x - ISLAND.x) / ISLAND.rx;
      const iy = (y - ISLAND.y) / ISLAND.ry;
      const r = ix * ix + iy * iy;
      if (r < 1) return DRY;
      // (Waves strike the island from every side.)
      return { wet: 1, flow: 0.3, white: r < 3.4 ? 0.5 : 0.12, ice: 0, sea: 0 };
    }
    for (const t of TRIBS) {
      if (toLine(x, y, [t.head, t.mid, t.mouth]) < 60) return { wet: 1, flow: 1, white: Math.hypot(x - t.mouth.x, y - t.mouth.y) < 170 ? 0.9 : 0.35, ice: 0, sea: 0 };
    }
    if (toLine(x, y, STREAM) < 165) return { wet: 1, flow: 0.62, white: Math.abs(y - CONF_Y) < 260 ? 0.55 : 0.1, ice: 0, sea: 0 };
    return DRY;
  }
  // The second reach: the shallows, the dam, the lattice's pool, the canyon.
  if (inRect(x, y, COL_POOL)) return { wet: 1, flow: 0.1, white: 0, ice: 0, sea: 0 };
  if (toLine(x, y, TAIL) < 170 || toLine(x, y, TO_DAM) < 170) return { wet: 1, flow: 0.45, white: 0.05, ice: 0, sea: 0 };
  if (y > DAM.y - 250 && y < DAM.y && x > DAM.x0 && x < DAM.x1) return { wet: 1, flow: 0.08, white: 0, ice: 0, sea: 0 };
  for (let i = 0; i < SLUICES.length; i++) {
    if (toLine(x, y, SLUICES[i]) < 70) {
      const open = gate[i] ?? 0;
      return { wet: 0.3 + 0.7 * open, flow: open, white: 0.75 * open * (y < DAM.y + 420 ? 1 : 0.4), ice: 0, sea: 0 };
    }
  }
  if (toLine(x, y, TO_LATTICE) < 150) return { wet: 1, flow: 0.5, white: 0.08, ice: 0, sea: 0 };
  if (Math.abs(x - LATTICE.x) < LAT_HALF && Math.abs(y - LATTICE.y) < LAT_HALF) return { wet: 1, flow: 0.03, white: 0, ice: 0, sea: 0 };
  if (toLine(x, y, TO_CANYON) < 120) return { wet: 1, flow: 0.6, white: 0.15, ice: 0, sea: 0 };
  if (toLine(x, y, CANYON_LINE) < CANYON.w / 2 + 10) return { wet: 1, flow: 0.95, white: 0.5, ice: 0, sea: 0 };
  if (toLine(x, y, TO_DELTA) < 130) return { wet: 1, flow: 0.7, white: 0.2, ice: 0, sea: 0 };
  return DRY;
}

/** The screen points the frame's ground is sampled at: across, and from the middle of the frame to its foot. */
const US = [0.08, 0.29, 0.5, 0.71, 0.92];
const VS = [0.56, 0.7, 0.84, 0.97];

/** Which movement of the piece a place in the flight belongs to. */
export function movementAt(home: boolean, s: number, melt: number, rest: boolean): number {
  if (!home) return MOVE.page;
  const [, say, , , , bridge, models, , , canyon, delta] = sectionStarts();
  if (rest) return MOVE.rest;
  if (s < say) return melt > 0.06 ? MOVE.melt : MOVE.ice;
  // (Each movement begins as the camera leaves for its first station, half a screen before the section's own start.)
  if (s < bridge + 0.45) return MOVE.river;
  if (s < models - 0.2) return MOVE.tarn;
  if (s < canyon + 0.25) return MOVE.works;
  if (s < delta - 0.35) return MOVE.canyon;
  return MOVE.delta;
}

/**
 * How a point of the world is seen: how well inside the frame it is (0 out
 * of frame or behind the camera, 1 well inside), where it stands across
 * the frame as a pan, and how far off it is. A sound whose cause cannot be
 * seen is not made.
 */
export function seenAt(cam: Basis | null, aspect: number, x: number, y: number, z = 0): { k: number; pan: number; far: number } {
  if (!cam) return { k: 0, pan: 0, far: 0 };
  const p = projectPoint(cam, [x, y, z], aspect);
  if (p[2] < 1) return { k: 0, pan: 0, far: p[2] };
  const inside = (u: number) => smooth(-0.1, 0.05, u) * (1 - smooth(0.95, 1.1, u));
  return { k: inside(p[0]) * inside(p[1]), pan: Math.min(1, Math.max(-1, p[0] * 2 - 1)), far: p[2] };
}

export interface Env {
  night: number;
  calm: boolean;
  /** the viewport's size in px, for the pointer's and the page's speeds */
  viewW: number;
  viewH: number;
}

/** Reads the published state once a frame and keeps what it needs between frames. */
export class SceneReader {
  private last = 0;
  private pos: number[] | null = null;
  private s = 0;
  private y = 0;
  private melt = 0;
  private px = 0.5;
  private py = 0.5;
  private sv = 0;
  private camV = 0;
  private meltRate = 0;
  private pv = 0;
  private seen = false;

  read(sig: SignalsLike, now: number, env: Env): Scene {
    const dt = this.last ? Math.min(0.1, Math.max(1e-3, (now - this.last) / 1000)) : 1 / 60;
    this.last = now;
    // A flight is running if it published within the last few frames.
    const home = !!sig.cam && sig.at > 0 && now - sig.at < 400;
    const cam = home ? (sig.cam as Basis) : null;
    const k = (tau: number) => 1 - Math.exp(-dt / tau);

    // Speeds, each smoothed a little so a single long frame is not a spike.
    let sv = 0;
    let camV = 0;
    let meltRate = 0;
    if (home && cam) {
      if (this.seen && this.pos) {
        sv = Math.abs(sig.s - this.s) / dt;
        camV = Math.hypot(cam.pos[0] - this.pos[0], cam.pos[1] - this.pos[1], cam.pos[2] - this.pos[2]) / dt;
        meltRate = Math.abs(sig.melt - this.melt) / dt;
      }
      this.pos = [cam.pos[0], cam.pos[1], cam.pos[2]];
      this.s = sig.s;
      this.melt = sig.melt;
      this.seen = true;
    } else {
      // Away from the flight the page's own scroll is what moves.
      if (this.seen) sv = Math.abs(sig.scrollY - this.y) / Math.max(1, env.viewH) / dt;
      this.pos = null;
      this.seen = true;
    }
    this.y = sig.scrollY;
    // (A jump, a link to an anchor or a restored position, is not speed.)
    if (sv > 12) sv = 0;
    if (camV > 30000) camV = 0;
    this.sv += (Math.min(sv, 8) - this.sv) * k(0.09);
    this.camV += (Math.min(camV, 9000) - this.camV) * k(0.09);
    // (The picture smooths the melt's rate the same way: a sixth of a second.)
    this.meltRate += (Math.min(meltRate, 1.1) - this.meltRate) * k(1 / 6);
    if (this.sv < 1e-4) this.sv = 0;
    if (this.camV < 0.05) this.camV = 0;
    if (this.meltRate < 1e-4) this.meltRate = 0;

    // The pointer: how fast it crosses the frame, falling away when it stops.
    const moved = Math.hypot((sig.px - this.px) * (env.viewW / Math.max(1, env.viewH)), sig.py - this.py) / dt;
    this.px = sig.px;
    this.py = sig.py;
    const fresh = now - sig.moved < 120;
    this.pv += ((fresh ? Math.min(moved, 6) : 0) - this.pv) * k(fresh && moved > this.pv ? 0.05 : 0.16);
    if (this.pv < 1e-3) this.pv = 0;

    const melt = sat(sig.melt);
    let water = 0;
    let near = 0;
    let pan = 0;
    let flow = 0;
    let white = 0;
    let ice = 0;
    let sea = 0;
    let tarn = 0;
    let walls = 0;
    if (cam) {
      let wAll = 0;
      let wWet = 0;
      for (const v of VS) {
        for (const u of US) {
          const hit = groundUnder(cam, u, v, sig.aspect);
          // (Nearer ground counts for more: it is more of the frame and it is what is heard.)
          const w = hit ? 1 / (1 + hit.t / 900) : 0.3;
          wAll += w;
          if (!hit) continue;
          const g = groundAt(hit.x, hit.y, melt, sig.gate);
          ice += w * g.ice;
          if (g.wet <= 0) continue;
          const ww = w * g.wet;
          wWet += ww;
          pan += ww * (u * 2 - 1);
          flow += ww * g.flow;
          white += ww * g.white;
          sea += ww * g.sea;
          tarn += w * (g.still ?? 0);
          near = Math.max(near, g.wet / (1 + hit.t / 700));
        }
      }
      water = wAll ? wWet / wAll : 0;
      ice = wAll ? ice / wAll : 0;
      if (wWet > 0) {
        pan /= wWet;
        flow /= wWet;
        white /= wWet;
        sea /= wWet;
      }
      // The tarn is where the frame is mostly its still water.
      tarn = wAll ? smooth(0.12, 0.5, tarn / wAll) : 0;
      // Between the canyon's walls: inside its length and below its rim.
      walls = smooth(CANYON.y0 - 500, CANYON.y0 + 150, cam.pos[1]) * (1 - smooth(CANYON.y1 - 100, CANYON.y1 + 500, cam.pos[1])) * (1 - smooth(CANYON.h - 20, CANYON.h + 220, cam.pos[2]));
    }

    return {
      home,
      dt,
      s: home ? sig.s : 0,
      sv: this.sv,
      melt: home ? melt : 1,
      meltRate: home ? this.meltRate : 0,
      day: home ? sig.day : 0,
      rest: home && sig.rest && sig.s >= SETTLE_AT - 0.05,
      night: env.night,
      calm: env.calm,
      camH: cam ? cam.pos[2] : 0,
      camV: this.camV,
      water,
      near,
      pan,
      flow,
      white,
      ice,
      sea,
      tarn,
      cols: home ? sig.st[0] : 0,
      dam: home ? sig.st[1] : 0,
      lattice: home ? sig.st[2] : 0,
      canyon: home ? sig.st[3] : 0,
      walls,
      move: movementAt(home, sig.s, melt, home && sig.rest),
      over: home && sig.far > 0 && now - sig.moved < 4000,
      px: sig.px,
      pv: this.pv,
      far: sig.far,
      clock: sig.clock,
      gate: sig.gate,
      surge: sig.surge,
      ray: home ? sig.ray : 0,
      lift: home ? sig.lift : 0,
      cam,
      aspect: sig.aspect,
    };
  }
}
