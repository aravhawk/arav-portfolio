/**
 * The flight's pace: how much of the screen's resolution the scene is drawn
 * at, and how often, so that it holds the display's rate.
 *
 * Two rules, in this order:
 *
 *  - At rest every frame is drawn at the screen's own resolution with full
 *    shading. Where such a frame does not fit one interval of a fast display
 *    (120 Hz), the scene is drawn every other interval: slow water and slow
 *    light at 60 a second, while the page itself, and the camera the moment
 *    it moves, keep the display's rate.
 *  - While the camera travels the scene is drawn at a lower resolution and
 *    brought to the screen's by one sharpening pass (see RECONSTRUCT), never
 *    under FLOOR of the screen's on a desktop. Motion hides it; when the
 *    camera settles the resolution comes back over a fifth of a second.
 *
 * What a frame costs is not asked of the GPU while it runs: a GPU slows its
 * clock under a light load, so a timer reads 12 ms for a frame that would
 * take 5 at full speed, and a governor that trusts it lowers the resolution
 * for nothing (measured: that is what an earlier one did). It is worked out:
 * the cost of a frame at each quarter screen of the flight was measured on
 * one GPU (cost-map.json, made by scripts/flight-frame-cost.mjs), and how
 * fast this device is against that one is measured once, behind the still,
 * by drawing the scene a few times and waiting for the GPU (`speed`). After
 * that only missed frames correct it.
 *
 * A device that still cannot hold its frame is given, in this order: the
 * leaner shading (the engine's own steps), the scene at half the rate again
 * at rest (30 a second), and only then a lower resolution at rest (never
 * under REST_FLOOR): a soft resting picture is the last thing given up.
 *
 * Everything here is a pure function of its arguments, so it can be run at
 * any display rate (tests/water/pace.test.ts).
 */
import map from './cost-map.json';

/** The share of a display interval a travelling frame may take of the GPU: the rest is the page's own compositing, and room. */
export const TRAVEL_SHARE = 0.65;
/**
 * The share the resolution on the move is worked out for: a little under the budget, because the map says what a
 * frame costs to within a tenth (measured: frames chosen for 65 percent landed at 62 to 73).
 */
export const TRAVEL_AIM = 0.6;
/** The share of its interval (or its two) a frame at rest may take. */
export const REST_SHARE = 0.85;
/** The lowest resolution on the move, as a share of the screen's, a side: a desktop's, a phone's. */
export const FLOOR = { desktop: 0.7, phone: 0.6 } as const;
/** The lowest at rest, for a device that cannot hold a full frame even at 30 a second with the leanest shading. */
export const REST_FLOOR = { desktop: 0.8, phone: 0.6 } as const;
/**
 * What each step of leaner shading leaves of a frame's cost. Measured at ten stops of the flight (3456 by 2234, M4):
 * the first step saves 0 to 2 percent, the second 0 to 18, 7 at the median. It is little, so a device that cannot
 * hold a frame is soon past these steps and at a lower resolution.
 */
export const LEAN_KEEPS = [1, 0.99, 0.93] as const;
/** What a piece costs when a stretch's broad variant draws it instead of its own (see coverFlight). */
export const BROAD_COSTS = 1.4;
/**
 * The copy and the sharpening pass a lower resolution adds, ms per megapixel of the screen on the reference GPU
 * (measured at 7.7 megapixels: the copy 0.27 ms, the pass 0.5).
 */
export const RECONSTRUCT_MS = 0.1;
/**
 * The part of a frame that does not shrink with the scene: the simulation's passes and the glow's, ms on the
 * reference GPU, and ms more per megapixel of the screen. (Measured: a scene at 0.7 of the screen's side is half
 * the pixels and 56 to 60 percent of the frame.)
 */
export const FIXED_MS = { flat: 1.0, perMpx: 0.03 } as const;
/** A resolution this near the screen's is the screen's: the last step is not worth a pass. */
export const NEAR_FULL = 0.94;

type Theme = 'light' | 'dark';
const MAP = map as { step: number; wide: Record<Theme, number[]>; tall: Record<Theme, number[]> };

/** What a full frame costs on the reference GPU at a place in the flight, ms per megapixel. */
export function costAt(s: number, night: boolean, aspect: number): number {
  const row = (aspect >= 1 ? MAP.wide : MAP.tall)[night ? 'dark' : 'light'];
  const x = Math.min(row.length - 1, Math.max(0, s / MAP.step));
  const i = Math.floor(x);
  const j = Math.min(row.length - 1, i + 1);
  // (The dearer of the two stops it lies between, and of the one ahead: a stretch is met at its cost, not on the way to it.)
  return Math.max(row[i] + (row[j] - row[i]) * (x - i), row[Math.min(row.length - 1, Math.round(x))]);
}

export interface PaceInput {
  /** the display's interval, ms */
  base: number;
  /** the screen, in megapixels of device pixels */
  mpx: number;
  /** what a full frame costs here on the reference GPU, ms per megapixel (costAt) */
  cost: number;
  /** how slow this device is against the reference: 1 the same, 2 half as fast */
  speed: number;
  /** the frame's largest piece is drawn by a broad variant */
  broad: boolean;
  phone: boolean;
}
export interface Pace {
  /** the scene's resolution as a share of the screen's, a side */
  scale: number;
  /** the scene is drawn every this many display intervals */
  every: number;
  /** the shading step it asks for: 0 full */
  lean: number;
  /** what the frame is then expected to cost, ms */
  ms: number;
}

/** A full frame's cost here, ms, as the part that does not shrink with the scene and the part that does. */
function parts(i: PaceInput, lean: number): { fixed: number; scene: number } {
  const full = i.speed * i.cost * i.mpx;
  const fixed = Math.min(0.6 * full, i.speed * (FIXED_MS.flat + FIXED_MS.perMpx * i.mpx));
  return { fixed, scene: (full - fixed) * (i.broad ? BROAD_COSTS : 1) * LEAN_KEEPS[lean] };
}
/** What a frame is expected to cost here at a resolution and a shading step, ms. */
export function expect(i: PaceInput, scale: number, lean: number): number {
  const p = parts(i, lean);
  return p.fixed + p.scene * scale * scale + (scale < 1 ? i.speed * RECONSTRUCT_MS * i.mpx : 0);
}

/** The pace while the camera travels. */
export function travelPace(i: PaceInput): Pace {
  const floor = i.phone ? FLOOR.phone : FLOOR.desktop;
  // (A display faster than 120 Hz is drawn for at 120: every other interval of 240.)
  const every = Math.max(1, Math.round(8 / i.base));
  const room = TRAVEL_SHARE * i.base * every;
  const over = i.speed * RECONSTRUCT_MS * i.mpx;
  const aim = TRAVEL_AIM * i.base * every;
  const fit = (lean: number) => {
    if (expect(i, 1, lean) <= aim) return 1;
    const p = parts(i, lean);
    return Math.sqrt(Math.max(aim - over - p.fixed, 0.1 * aim) / p.scene);
  };
  let lean = 0;
  let scale = fit(0);
  // The shading is made leaner only where the lowest resolution would still miss the interval itself, not merely its
  // margin: a frame that is late is seen, a frame that uses its margin is not. (A phone's leaner shading comes first.)
  const late = (l: number) => expect(i, Math.max(floor, Math.min(1, fit(l))), l) > (i.phone ? room : 0.92 * i.base * every);
  while (lean < 2 && scale < floor && late(lean)) scale = fit(++lean);
  scale = Math.min(1, Math.max(floor, scale));
  // (A resolution that near the screen's is the screen's, where the whole frame is then inside the budget.)
  if (scale >= NEAR_FULL) scale = expect(i, 1, lean) <= room ? 1 : NEAR_FULL - 0.02;
  return { scale, every, lean, ms: expect(i, scale, lean) };
}

/** The pace at rest. */
export function restPace(i: PaceInput): Pace {
  const floor = i.phone ? REST_FLOOR.phone : REST_FLOOR.desktop;
  // The scene is never drawn less often than 60 a second while a full frame fits that.
  const slowest = Math.max(1, Math.round(16.7 / i.base));
  // (On a fast display a frame every interval has the margin a travelling frame has: 7 ms of an 8.3 ms interval is a
  // frame that is late half the time. Every other interval, and on a 60 Hz display, it has the larger share.)
  const room = (every: number) => (every === 1 && slowest > 1 ? TRAVEL_SHARE : REST_SHARE) * i.base * every;
  for (let every = 1; every <= slowest; every++) if (expect(i, 1, 0) <= room(every)) return { scale: 1, every, lean: 0, ms: expect(i, 1, 0) };
  for (const lean of [1, 2]) if (expect(i, 1, lean) <= room(slowest)) return { scale: 1, every: slowest, lean, ms: expect(i, 1, lean) };
  // Before any resolution is given up: the leanest shading at half the rate again (30 a second). A resting picture
  // that is soft is seen; slow water drawn half as often is not.
  const half = slowest * 2;
  if (expect(i, 1, 2) <= room(half)) return { scale: 1, every: half, lean: 2, ms: expect(i, 1, 2) };
  // (Only a device that cannot hold a full frame even so is drawn lower at rest, never under the floor.)
  const p = parts(i, 2);
  const over = i.speed * RECONSTRUCT_MS * i.mpx;
  let scale = Math.sqrt(Math.max(room(half) - over - p.fixed, 0.1 * room(half)) / p.scene);
  scale = Math.min(NEAR_FULL - 0.02, Math.max(floor, scale));
  return { scale, every: half, lean: 2, ms: expect(i, scale, 2) };
}

/** How fast the picture is moving, in screen heights a second, above which the camera is travelling; and under which, held for SETTLE_MS, it has come to rest. */
export const TRAVEL_FLOW = { from: 0.035, to: 0.018 } as const;
export const SETTLE_MS = 150;
/** How fast the resolution comes back when the camera settles, and how fast it is let go when it sets off (shares of the screen's a second). */
export const RAMP = { up: 1.5, down: 9 } as const;

/**
 * Whether the camera is travelling, from how fast the picture moves.
 * `flow` in screen heights a second; returns the new state: when it was last seen moving, and whether it travels.
 */
export function travelling(was: { on: boolean; movedAt: number }, flow: number, now: number): { on: boolean; movedAt: number } {
  if (flow > TRAVEL_FLOW.from) return { on: true, movedAt: now };
  if (was.on && flow > TRAVEL_FLOW.to) return { on: true, movedAt: now };
  return { on: was.on && now - was.movedAt < SETTLE_MS, movedAt: was.movedAt };
}

/** The resolution this frame is drawn at, on its way to the one wanted: `dt` in seconds. */
export function easeScale(now: number, want: number, dt: number): number {
  if (want < now) return Math.max(want, now - RAMP.down * dt);
  const next = Math.min(want, now + RAMP.up * dt);
  return next >= NEAR_FULL && want >= 1 ? 1 : next;
}
