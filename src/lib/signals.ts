/**
 * The picture's state, published for whoever follows it (the sound does).
 *
 * Writers set plain fields here from where the state is already known: the
 * flight's frame loop, its pointer handlers, the page's own frame. Nothing
 * allocates and nothing runs unless someone listens, so publishing costs a
 * page without sound a handful of assignments a frame.
 *
 * Continuous state is read by the listener once per animation frame.
 * Moments (a press, the switch, a drip, the dawn) are handed over at once,
 * with the time they happened.
 */

type V3 = [number, number, number];

/** The camera, as the flight holds it: where it is and its three axes. */
export interface SignalCam {
  pos: V3;
  f: V3;
  r: V3;
  u: V3;
  tan: number;
}

export const signals = {
  /** the frame time (ms) of the flight's last frame; 0 when no flight has run */
  at: 0,
  /** scroll through the flight, in screens */
  s: 0,
  cam: null as SignalCam | null,
  aspect: 1.6,
  /** 0..1, how far the lake's ice has melted, and how far the day has come round */
  melt: 0,
  day: 0,
  /** true once the camera has come to rest over the sea */
  rest: false,
  /** the picture's own running time in seconds: what its pulses and laps are counted from */
  clock: 0,
  /** how near the columns, the dam, the lattice and the canyon are, 0..1 each */
  st: [0, 0, 0, 0] as ArrayLike<number>,
  /** how far open each sluice is, and how far the surge has run down each */
  gate: [1, 0, 0] as ArrayLike<number>,
  surge: [0, 0, 0] as ArrayLike<number>,
  /** the ending's light: the line of light and the sun's last lift, 0..1 each */
  ray: 0,
  lift: 0,
  /** the pointer in the frame (0..1 each way), how far off the water under it lies (0 when it is not over water), and when it last moved */
  px: 0.5,
  py: 0.5,
  far: 0,
  moved: 0,
  /** the page's scroll in px, on every route */
  scrollY: 0,
};

export type SignalListener = (type: string, a: number, b: number, c: number, at: number) => void;

let hear: SignalListener | null = null;

/** One listener at a time: the sound, once it has been turned on. */
export function listen(fn: SignalListener | null) {
  hear = fn;
}

/** A moment, with up to three numbers that say where or which. */
export function emit(type: string, a = 0, b = 0, c = 0) {
  if (hear) hear(type, a, b, c, performance.now());
}

/** The flight's frame: where the camera is and how far the page has come. */
export function flightSignal(at: number, s: number, cam: SignalCam, aspect: number, melt: number, day: number, rest: boolean) {
  signals.at = at;
  signals.s = s;
  signals.cam = cam;
  signals.aspect = aspect;
  signals.melt = melt;
  signals.day = day;
  signals.rest = rest;
}

/** What the picture itself is doing this frame. */
export function pictureSignal(clock: number, st: ArrayLike<number>, gate: ArrayLike<number>, surge: ArrayLike<number>, ray: number, lift: number) {
  signals.clock = clock;
  signals.st = st;
  signals.gate = gate;
  signals.surge = surge;
  signals.ray = ray;
  signals.lift = lift;
}

/** The pointer: where it is in the frame, and how far away the water under it is (0: not over water). */
export function pointerSignal(x: number, y: number, far: number) {
  signals.px = x;
  signals.py = y;
  signals.far = far;
  signals.moved = performance.now();
}
