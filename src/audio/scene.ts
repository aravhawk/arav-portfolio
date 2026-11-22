import { starts } from '@/water/registry';
/**
 * From what the picture publishes to what the sound needs to know.
 *
 * The picture says where the camera is and how far the page has come. This
 * works out the rest once a frame: how fast the camera and the scroll are
 * moving, how much of the frame is water, how near it is and on which side,
 * how fast that water runs, where each station's own water stands in the
 * frame, how the camera banks and turns, how much sky it sees. The world is
 * the flight's own: its plan is read from the calls that carve the bed
 * (plan.ts) and its places from world.ts, so the sound hears what the
 * picture shows and follows it when it moves.
 */

import { type Basis, SETTLE_AT, groundUnder, projectPoint } from '@/water/camera';
import { skyAt } from '@/water/sky';
import { BASIN, BENDS, CANYON, CANYON_LINE, COLS, DAM, ISLAND, LATTICE, NAME, RING, SHARDS, SLUICES, ringStones } from '@/water/world';
import { type Ground, type Reach, arms, groundAt, spills, tribs } from './plan';
import { MOVE } from './theory';

export type { Ground } from './plan';
export { groundAt } from './plan';

export interface SignalsLike {
  at: number;
  s: number;
  cam: { pos: number[]; f: number[]; r: number[]; u: number[]; tan: number } | null;
  aspect: number;
  melt: number;
  day: number;
  rest: boolean;
  clock: number;
  clockAt: number;
  st: ArrayLike<number>;
  gate: ArrayLike<number>;
  surge: ArrayLike<number>;
  ray: number;
  lift: number;
  rise?: number;
  px: number;
  py: number;
  far: number;
  moved: number;
  scrollY: number;
  tribs: ArrayLike<number> | null;
}

/** How a point of the world is seen: how well inside the frame (0 out of it, 1 well inside), where across it (-1 left, 1 right), how far off. */
export interface Seen {
  k: number;
  pan: number;
  far: number;
}

/** A stretch of water that has a voice of its own: how it is seen, and how big it is (0..1). */
export interface Source extends Seen {
  size: number;
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
  /** 0 by day, 1 before dawn, and everything between while the theme turns */
  night: number;
  /** reduced motion: sweeps are calmed */
  calm: boolean;
  /** the camera's height over the water and its speed, world units and units a second */
  camH: number;
  camV: number;
  /** how it banks (-1 left side down, 1 right side down) and how fast it turns (radians a second, to the right positive) */
  bank: number;
  turn: number;
  /** 0..1 how much of the upper frame is sky, how squarely the lens faces north, how much aurora this hour has, and the bearing the first light stands on (radians from +y toward +x) */
  sky: number;
  north: number;
  aurora: number;
  dawnAz: number;
  /** 0..1 how much of the ground in frame is open water, how near the nearest of it is, and which side it is on (-1 left, 1 right) */
  water: number;
  near: number;
  pan: number;
  /** 0..1 how fast that water runs, and how much of it is white */
  flow: number;
  white: number;
  /** 0..1 how much of the ground in frame is ice, how much is open sea, how much is the basin's water, how much is a pool that barely moves */
  ice: number;
  sea: number;
  basin: number;
  pool: number;
  /** 0..1 how much of the frame is the still tarn */
  tarn: number;
  /** 0..1 how near the columns, the dam, the lattice and the canyon are (the picture's own measure) */
  cols: number;
  dam: number;
  lattice: number;
  canyon: number;
  /** 0..1 how closed in the camera is by the canyon's walls, and how far off the nearer wall stands (world units) */
  walls: number;
  wallD: number;
  /** 0..1 how far along the run out to sea the camera is (the piece waits on its dominant there) */
  approach: number;
  /** which movement of the piece this place belongs to */
  move: number;
  /** the pointer: over water or not, where across the frame (0..1), how fast (frame widths a second), how far off the water under it is (world units, about 12 near to 70 far) */
  over: boolean;
  px: number;
  pv: number;
  far: number;
  /** the page went somewhere in one frame (a tick of the rail, a link to an anchor, a restored position): nothing was passed on the way */
  jump: boolean;
  /** the picture's clock as last drawn, and the time (ms) of the frame that drew it; the sluices; the ending's light (the sun's lift, the line's run, the ribbon's rise) */
  clock: number;
  clockAt: number;
  gate: ArrayLike<number>;
  surge: ArrayLike<number>;
  ray: number;
  lift: number;
  rise: number;
  /** each station's own water, as it stands in the frame */
  falls: Source[];
  spill: Source;
  slab: Seen;
  shallows: Seen;
  sluice: Seen;
  thread: Seen;
  lanes: Seen;
  bend: Seen;
  arms: Source[];
  /** the name on the lake: its middle, as it stands in the frame */
  name: Seen;
  /** the ring of standing stones round its pool: the ring as a whole, and each of its stones in the plan's own order */
  ring: Seen;
  stones: Seen[];
  /** the camera and the frame's shape, for placing a sound where its cause is seen */
  cam: Basis | null;
  aspect: number;
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const sat = (x: number) => Math.min(1, Math.max(0, x));

/** How far a point is from a line of points. */
function toLine(x: number, y: number, line: { x: number; y: number }[]): number {
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

/** The screen points the frame's ground is sampled at: across, and from the middle of the frame to its foot. */
const US = [0.08, 0.29, 0.5, 0.71, 0.92];
const VS = [0.56, 0.7, 0.84, 0.97];

/**
 * Which movement of the piece a place in the flight belongs to.
 * @param risen the ribbon of light has left the water (or stands already): until then the camera at rest still waits on the dominant
 */
export function movementAt(home: boolean, s: number, melt: number, rest: boolean, risen = true): number {
  if (!home) return MOVE.page;
  const { say, bridge, models, bench, lattice, canyon, delta, sea } = starts;
  if (rest) return risen ? MOVE.rest : MOVE.approach;
  if (s < say) return melt > 0.06 ? MOVE.melt : MOVE.ice;
  // (Each movement begins as the camera leaves for its first station, half a screen before the section's own start.)
  // (The places stand in the owner's order, so the piece comes back to two of its movements: the river's again at the
  // rock pool and the ring, the works' again at the lattice.)
  if (s < models - 0.2) return MOVE.river;
  if (s < bench - 0.2) return MOVE.works;
  if (s < canyon + 0.25) return MOVE.river;
  if (s < bridge + 0.45) return MOVE.canyon;
  if (s < lattice - 0.2) return MOVE.tarn;
  if (s < delta - 0.35) return MOVE.works;
  // The run out to sea: the dominant is taken up as the camera leaves the delta, and held.
  if (s < sea - APPROACH) return MOVE.delta;
  return MOVE.approach;
}
/** How long before the sea's own section the run out to it begins, in screens. */
export const APPROACH = 0.6;

/** Whether a point of the frame (0..1 each way) is over open water, 0..1: the lake's ice and the land are not water. */
export function wetUnder(cam: Basis | null, aspect: number, x: number, y: number, melt: number, gate: ArrayLike<number>): number {
  const hit = cam ? groundUnder(cam, x, y, aspect) : null;
  return hit ? groundAt(hit.x, hit.y, melt, gate).wet : 0;
}

/**
 * How a point of the world is seen: how well inside the frame it is (0 out
 * of frame or behind the camera, 1 well inside), where it stands across
 * the frame as a pan, and how far off it is. A sound whose cause cannot be
 * seen is not made.
 */
export function seenAt(cam: Basis | null, aspect: number, x: number, y: number, z = 0): Seen {
  if (!cam) return { k: 0, pan: 0, far: 0 };
  const p = projectPoint(cam, [x, y, z], aspect);
  if (p[2] < 1) return { k: 0, pan: 0, far: p[2] };
  const inside = (u: number) => smooth(-0.1, 0.05, u) * (1 - smooth(0.95, 1.1, u));
  return { k: inside(p[0]) * inside(p[1]), pan: Math.min(1, Math.max(-1, p[0] * 2 - 1)), far: p[2] };
}

/** How much of a seen thing is heard: all of it at the lens, half at about eleven hundred units, next to nothing from a station away (where it is a few pixels of the frame), nothing out of frame. */
export const heard = (s: Seen) => {
  const h = (s.k / (1 + (s.far / 1100) * (s.far / 1100))) * (1 - smooth(2400, 3400, s.far));
  return h < 0.02 ? 0 : h;
};

/** The ribbon is first seen at this much of its rise (the shading pass's own number: see `LIGHT` in mapping.ts). */
const RISEN = 0.04;

export interface Env {
  /** 0 by day, 1 before dawn */
  night: number;
  calm: boolean;
  /** the viewport's size in px, for the pointer's and the page's speeds */
  viewW: number;
  viewH: number;
}

const UNSEEN: Seen = { k: 0, pan: 0, far: 0 };
/** The ring's stones, found once (the plan's own: where each foot stands and how tall it is). */
let stonesAt: ReturnType<typeof ringStones> | null = null;
const NO_SOURCE: Source = { ...UNSEEN, size: 0 };

/** The world's places that have a voice, found once. */
interface Places {
  falls: Reach[];
  fallW: number;
  spill: Reach;
  arms: Reach[];
  armW: number;
}
let places: Places | null = null;
function placesOf(): Places {
  if (places) return places;
  const falls = tribs();
  // (The delta's five broadest channels: its arms and the widest braids between them.)
  const all = arms();
  const keep = all
    .slice()
    .sort((a, b) => b.w - a.w)
    .slice(0, 5)
    .sort((a, b) => a.x - b.x);
  places = { falls, fallW: Math.max(1, ...falls.map((f) => f.w)), spill: spills()[0], arms: keep, armW: Math.max(1, ...keep.map((a) => a.w)) };
  return places;
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
  private head = 0;
  private turn = 0;
  private night = -1;

  read(sig: SignalsLike, now: number, env: Env): Scene {
    const dt = this.last ? Math.min(0.1, Math.max(1e-3, (now - this.last) / 1000)) : 1 / 60;
    this.last = now;
    // A flight is running if it published within the last few frames.
    const home = !!sig.cam && sig.at > 0 && now - sig.at < 400;
    const cam = home ? (sig.cam as Basis) : null;
    const k = (tau: number) => 1 - Math.exp(-dt / tau);

    // The theme turns over about a second: the two mixes cross-fade.
    this.night = this.night < 0 ? env.night : this.night + Math.sign(env.night - this.night) * Math.min(Math.abs(env.night - this.night), dt / 1.4);

    // Speeds, each smoothed a little so a single long frame is not a spike.
    let sv = 0;
    let camV = 0;
    let meltRate = 0;
    let turn = 0;
    if (home && cam) {
      const head = Math.atan2(cam.f[0], cam.f[1]);
      if (this.seen && this.pos) {
        sv = Math.abs(sig.s - this.s) / dt;
        camV = Math.hypot(cam.pos[0] - this.pos[0], cam.pos[1] - this.pos[1], cam.pos[2] - this.pos[2]) / dt;
        // (The melt as the picture uses it: it stops at nothing left and at all gone.)
        meltRate = Math.abs(sat(sig.melt) - this.melt) / dt;
        let dh = head - this.head;
        if (dh > Math.PI) dh -= 2 * Math.PI;
        if (dh < -Math.PI) dh += 2 * Math.PI;
        turn = dh / dt;
      }
      this.head = head;
      this.pos = [cam.pos[0], cam.pos[1], cam.pos[2]];
      this.s = sig.s;
      this.melt = sat(sig.melt);
      this.seen = true;
    } else {
      // Away from the flight the page's own scroll is what moves.
      if (this.seen) sv = Math.abs(sig.scrollY - this.y) / Math.max(1, env.viewH) / dt;
      this.pos = null;
      this.seen = true;
    }
    this.y = sig.scrollY;
    // (A jump, a tick of the rail, a link to an anchor or a restored position, is not speed: nothing between was passed.)
    const jump = sv > 12;
    if (jump) {
      sv = camV = meltRate = turn = 0;
      this.meltRate = 0;
    }
    if (camV > 30000) camV = 0;
    if (Math.abs(turn) > 6) turn = 0;
    this.sv += (Math.min(sv, 8) - this.sv) * k(0.09);
    this.camV += (Math.min(camV, 9000) - this.camV) * k(0.09);
    this.turn += (turn - this.turn) * k(0.25);
    // (The picture smooths the melt's rate the same way: a sixth of a second.)
    this.meltRate += (Math.min(meltRate, 1.1) - this.meltRate) * k(1 / 6);
    if (this.sv < 1e-4) this.sv = 0;
    if (this.camV < 0.05) this.camV = 0;
    if (this.meltRate < 1e-4) this.meltRate = 0;
    if (Math.abs(this.turn) < 1e-4) this.turn = 0;

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
    let basin = 0;
    let pool = 0;
    let walls = 0;
    let wallD = CANYON.w / 2;
    let sky = 0;
    let falls: Source[] = [];
    let armsSeen: Source[] = [];
    let spill = NO_SOURCE;
    let slab = UNSEEN;
    let shallows = UNSEEN;
    let sluice = UNSEEN;
    let thread = UNSEEN;
    let lanes = UNSEEN;
    let bend = UNSEEN;
    let name = UNSEEN;
    let ring = UNSEEN;
    let stones: Seen[] = [];
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
          const g: Ground = groundAt(hit.x, hit.y, melt, sig.gate);
          ice += w * g.ice;
          if (g.wet <= 0) continue;
          const ww = w * g.wet;
          wWet += ww;
          pan += ww * (u * 2 - 1);
          flow += ww * g.flow;
          white += ww * g.white;
          sea += ww * g.sea;
          tarn += w * (g.still ?? 0);
          if (hit.x > BASIN.x && hit.x < BASIN.x + BASIN.w && hit.y > BASIN.y && hit.y < BASIN.y + BASIN.h) basin += ww;
          else if (g.flow <= 0.13 && !g.sea && !g.ice && !g.still) pool += ww;
          near = Math.max(near, g.wet / (1 + hit.t / 700));
        }
      }
      water = wAll ? wWet / wAll : 0;
      ice = wAll ? ice / wAll : 0;
      basin = wAll ? sat((basin / wAll) * 2.2) : 0;
      pool = wAll ? sat((pool / wAll) * 2.2) : 0;
      if (wWet > 0) {
        pan /= wWet;
        flow /= wWet;
        white /= wWet;
        sea /= wWet;
      }
      // The tarn is where the frame is mostly its still water, or where both its shards stand in it from near by
      // (an upright screen holds them against the sky, over a foot of bank, and little of the tarn is under the frame's foot).
      const shards = Math.min(...SHARDS.map((sh) => heard(seenAt(cam, sig.aspect, sh.x, sh.y, sh.h * 0.5))));
      tarn = Math.max(wAll ? smooth(0.12, 0.5, tarn / wAll) : 0, smooth(0.28, 0.4, shards));
      // Between the canyon's walls: inside its length and below its rim (an eye above the rim is in open air).
      walls = smooth(CANYON.y0 - 500, CANYON.y0 + 150, cam.pos[1]) * (1 - smooth(CANYON.y1 - 100, CANYON.y1 + 500, cam.pos[1])) * (1 - smooth(CANYON.h - 120, CANYON.h + 60, cam.pos[2]));
      if (walls > 0) wallD = Math.max(12, CANYON.w / 2 - toLine(cam.pos[0], cam.pos[1], CANYON_LINE));
      // The sky: how much of the frame's upper half looks out above the land.
      for (const v of [0.06, 0.2, 0.34, 0.48]) if (!groundUnder(cam, 0.5, v, sig.aspect)) sky += 0.25;

      // Each station's own water, where it stands in the frame.
      const pl = placesOf();
      const live = sig.tribs;
      // (Published widths take over from the plan's: each stream is sized against the widest there is to see.)
      let fallW = live ? 0 : pl.fallW;
      if (live) for (let i = 0; i < pl.falls.length; i++) fallW = Math.max(fallW, live[i] ?? pl.falls[i].w);
      fallW = Math.max(fallW, 1e-6);
      falls = pl.falls.map((f, i) => ({ ...seenAt(cam, sig.aspect, f.x, f.y), size: sat((live?.[i] ?? f.w) / fallW) }));
      armsSeen = pl.arms.map((a) => ({ ...seenAt(cam, sig.aspect, a.x, a.y), size: sat(a.w / pl.armW) }));
      spill = { ...seenAt(cam, sig.aspect, pl.spill.x, pl.spill.y), size: 0.3 };
      slab = seenAt(cam, sig.aspect, ISLAND.x, ISLAND.y);
      shallows = seenAt(cam, sig.aspect, (COLS.xs[0] + COLS.xs[COLS.xs.length - 1]) / 2, COLS.y);
      let open = 0;
      for (let i = 1; i < 3; i++) if ((sig.gate[i] ?? 0) > (sig.gate[open] ?? 0)) open = i;
      sluice = seenAt(cam, sig.aspect, SLUICES[open][1].x, SLUICES[open][1].y);
      // (The sluices' water falls on the wall's downstream side: from upstream, where the columns stand, the wall hides it.)
      sluice.k *= smooth(DAM.y - 200, DAM.y + 150, cam.pos[1]);
      thread = seenAt(cam, sig.aspect, LATTICE.x, LATTICE.y - LATTICE.pitch * 2 - 110);
      lanes = seenAt(cam, sig.aspect, LATTICE.x, LATTICE.y);
      name = seenAt(cam, sig.aspect, NAME.x, NAME.y);
      // The ring: the middle of its pool at the stones' shoulder, and each stone half way up.
      ring = seenAt(cam, sig.aspect, RING.x, RING.y, RING.h * 0.4);
      stones = (stonesAt ??= ringStones()).map((st) => seenAt(cam, sig.aspect, st.x, st.y, st.h * 0.5));
      for (const b of BENDS) {
        const s = seenAt(cam, sig.aspect, b.x, b.y);
        if (heard(s) >= heard(bend)) bend = s;
      }
    }
    const { sea: seaAt } = starts;
    const hour = home ? skyAt(1, sig.day, 0, 0.62, 0.03) : null;
    const rise = home ? (sig.rise ?? sig.ray) : 0;

    return {
      home,
      dt,
      s: home ? sig.s : 0,
      sv: this.sv,
      melt: home ? melt : 1,
      meltRate: home ? this.meltRate : 0,
      day: home ? sig.day : 0,
      rest: home && sig.rest && sig.s >= SETTLE_AT - 0.05,
      night: this.night,
      calm: env.calm,
      camH: cam ? cam.pos[2] : 0,
      camV: this.camV,
      bank: cam ? Math.min(1, Math.max(-1, -cam.r[2] * 2.5)) : 0,
      turn: this.turn,
      sky,
      north: cam ? sat(cam.f[1]) : 0,
      aurora: hour ? hour.aurora : 0,
      dawnAz: hour ? Math.atan2(hour.sun[0], hour.sun[1]) : 0,
      water,
      near,
      pan,
      flow,
      white,
      ice,
      sea,
      basin,
      pool,
      tarn,
      cols: home ? sig.st[0] : 0,
      dam: home ? sig.st[1] : 0,
      lattice: home ? sig.st[2] : 0,
      canyon: home ? sig.st[3] : 0,
      walls,
      wallD,
      approach: home ? smooth(seaAt - APPROACH, SETTLE_AT, sig.s) : 0,
      // (With motion reduced no light event runs: the ribbon simply stands, and the piece does not wait for it.)
      move: movementAt(home, sig.s, melt, home && sig.rest, env.calm || rise >= RISEN),
      // (Over the flight the picture says the pointer's ray meets the ground, and whether that ground is open water is
      // read from the plan. On an inner page the picture's own bed says whether it is water.)
      over: sig.far > 0 && now - sig.moved < 4000 && (!home || wetUnder(cam, sig.aspect, sig.px, sig.py, melt, sig.gate) > 0.4),
      px: sig.px,
      pv: this.pv,
      far: sig.far,
      jump: home && jump,
      clock: sig.clock,
      clockAt: sig.clockAt,
      gate: sig.gate,
      surge: sig.surge,
      ray: home ? sig.ray : 0,
      lift: home ? sig.lift : 0,
      rise,
      falls,
      spill,
      slab,
      shallows,
      sluice,
      thread,
      lanes,
      bend,
      arms: armsSeen,
      name,
      ring,
      stones,
      cam,
      aspect: sig.aspect,
    };
  }
}
