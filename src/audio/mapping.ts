/**
 * From the scene to the sound's parameters. Pure functions, every one:
 * the same scene always gives the same numbers, so they can be tested and
 * a render can be repeated.
 *
 * Levels here are 0..1 within each sound; how loud each sound is in the mix
 * is set once, in the graph.
 */

import { DAWN, GATE, LAP } from '@/water/moments';
import { type Scene, type Seen, heard, sat, smooth } from './scene';
import { ARRIVAL_AT, ladder, latticeNote, shardNote, snap } from './theory';
import type { WaterVoice } from './water';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Which voice of the water model each stretch of water speaks through. */
export const W = { stream: 0, white: 1, falls: 2, thin: 9, lap: 10, sluice: 11, wall: 12, arms: 13, sea: 18, wake: 19 } as const;

/**
 * The four kinds of water, as the model is asked for them. Everything the
 * stations sound like is one of these, or lies between two of them.
 * (gain, rate, lo, hi, tilt, rise, pan, spread, noise, nLo, nHi)
 */
export const WATER = {
  /** a thread of water: a few small bubbles a second, no body */
  trickle: [1, 24, 1500, 6200, 0.35, 1, 0, 0.08, 0.02, 400, 3000],
  /** a stream: hundreds of bubbles of every size, a little body */
  stream: [1, 190, 420, 5200, 0.7, 1, 0, 0.7, 0.22, 250, 3200],
  /** a fall: more of them, larger ones among them, and the water's own roar */
  fall: [1, 430, 240, 4600, 0.95, 1, 0, 0.25, 0.85, 300, 4200],
  /** a pool: one bubble now and then, low, and nothing else */
  pool: [1, 0.6, 320, 1100, 0.5, 1, 0, 0.6, 0, 200, 800],
} satisfies Record<string, WaterVoice>;

const OFF: WaterVoice = [0, 0, 400, 4000, 0.6, 1, 0, 0.5, 0, 200, 3000];

export interface Mix {
  /** the bed: its level, its brightness (the pad's low-pass, Hz), how much reverb it sits in, how much of the bass is let in */
  bed: number;
  bedCut: number;
  air: number;
  bass: number;
  /** wind over the ice: level, colour (band centre, Hz), the thin whistle on top, where it sits */
  wind: number;
  windHz: number;
  whistle: number;
  windPan: number;
  /** every voice of the water */
  water: WaterVoice[];
  /** the pointer's wake as moving air over the water: level, colour, side */
  wake: number;
  wakeHz: number;
  wakePan: number;
  /** the aurora's voice: its level, and each of its partials' level and place */
  aurora: number;
  shimmer: [number, number][];
  /** the place: the low-pass the whole world is heard through (Hz); how much of each room (open, canyon, still); the canyon's slap, its level and its time (seconds); the world's reverb */
  worldCut: number;
  rooms: [number, number, number];
  echo: number;
  echoTime: number;
  worldSend: number;
  /** the ice working: cracks a second, and groans a second */
  cracks: number;
  groans: number;
}

/** How much of a sweep is left when motion is reduced. */
export const CALM = 0.3;

/** Scroll speed, 0..1: a slow read is about 0.15, a flick is 1. */
export const scrollN = (sv: number, calm: boolean) => sat(sv / 2.5) * (calm ? CALM : 1);
/** Camera speed, 0..1. The camera covers about a thousand world units a screen. */
export const camN = (camV: number, calm: boolean) => sat(camV / 2400) * (calm ? CALM : 1);

const hash = (k: number, i: number, seed: number) => {
  const x = Math.sin(k * 127.1 + i * 311.7 + seed * 74.7) * 43758.5453;
  return x - Math.floor(x);
};

export interface Swell {
  /** 0..1: how high the water stands */
  level: number;
  /** 0..1: how much of it is drawing back over the shingle (the hiss after a wave) */
  wash: number;
  /** -1..1: the side the wave now passing came in on */
  side: number;
}

/**
 * A train of swells that is never the same twice: each has its own moment,
 * its own time to rise, its own time to fall away, its own height and its
 * own side. `period` is how far apart they are on average. The wind's
 * gusts and the sea's waves are both read from this, and the basin's.
 */
export function swellAt(t: number, period: number, seed: number): Swell {
  const cell = Math.floor(t / period);
  let level = 0;
  let wash = 0;
  let side = 0;
  let w = 0;
  for (let k = cell - 2; k <= cell + 1; k++) {
    const start = (k + 0.1 + 0.8 * hash(k, 1, seed)) * period;
    const rise = (0.16 + 0.22 * hash(k, 2, seed)) * period;
    const fall = (0.45 + 1.0 * hash(k, 3, seed)) * period;
    const peak = 0.4 + 0.6 * hash(k, 4, seed);
    const age = t - start;
    if (age <= 0 || age >= rise + fall) continue;
    const up = age < rise;
    const e = peak * (up ? smooth(0, rise, age) : 1 - smooth(0, fall, age - rise));
    level = Math.max(level, e);
    if (!up) wash = Math.max(wash, peak * smooth(0, fall * 0.25, age - rise) * (1 - smooth(fall * 0.3, fall, age - rise)));
    side += e * (hash(k, 5, seed) * 2 - 1);
    w += e;
  }
  return { level, wash, side: w > 0 ? side / w : 0 };
}

/** The wind's gusts: each with a shape of its own. Before dawn the wind is steadier. */
export const gust = (t: number, calm: boolean, night = 0) => {
  const depth = (calm ? 0.12 : 0.34) * (1 - 0.6 * night);
  return 1 - depth + depth * swellAt(t, 9.5, 3).level;
};
/** The sea: waves that are not all the same length. */
export const seaAt = (t: number) => swellAt(t, 8.4, 11);

/** Where the wind sits: it comes round with the camera's bank and against its turn, and wanders a little of itself. */
export const windPanOf = (sc: Scene, t: number) => (sc.calm ? 0 : clamp(-1.3 * sc.bank - 0.9 * sc.turn + 0.18 * Math.sin(0.11 * t), -0.85, 0.85));

/** How much of each room the place is: the open lake and sea, the canyon, the still pools. */
export function roomsOf(sc: Scene): [number, number, number] {
  if (!sc.home) return [0.6, 0, 0.4];
  const canyon = sat(sc.walls);
  const still = (1 - canyon) * sat(Math.max(sc.tarn, 0.8 * sc.pool));
  return [Math.max(0, 1 - canyon - still), canyon, still];
}

/** The canyon's slap: sound goes to the nearer wall and back, so its time follows how far off that wall stands (world units). */
export const slapTime = (wallD: number) => clamp(0.03 + wallD * 0.0019, 0.04, 0.24);

const voice = (base: WaterVoice, gain: number, pan: number, more: Partial<Record<'rate' | 'lo' | 'hi' | 'tilt' | 'spread' | 'noise' | 'nLo' | 'nHi', number>> = {}): WaterVoice => {
  if (gain < 1e-4) return OFF;
  return [sat(gain), more.rate ?? base[1], more.lo ?? base[2], more.hi ?? base[3], more.tilt ?? base[4], base[5], clamp(pan, -1, 1), more.spread ?? base[7], more.noise ?? base[8], more.nLo ?? base[9], more.nHi ?? base[10]];
};

/**
 * Every voice of the water, from the scene: the river in frame, and each
 * station's own behaviour.
 * @param t the sound's own time in seconds: what the swells are counted from
 */
export function waterOf(sc: Scene, t: number): WaterVoice[] {
  const out: WaterVoice[] = Array.from({ length: 20 }, () => OFF);
  if (!sc.home) return out;
  const sN = scrollN(sc.sv, sc.calm);
  const cN = camN(sc.camV, sc.calm);
  const quiet = 1 - 0.94 * sc.tarn;
  // (A river that is a seventh of the ground in frame is already most of what is heard there.)
  const wN = sat(Math.sqrt(sc.water) * 1.25);
  // Before dawn the water is darker and closer.
  const dark = 1 - 0.3 * sc.night;
  const close = 1 + 0.18 * sc.night;

  // The river in frame: more bubbles and larger ones the nearer and the faster it runs.
  const run = wN * (0.25 + 0.75 * sc.near) * (0.3 + 0.7 * sc.flow) * (1 - 0.85 * sc.sea) * (1 - 0.7 * sc.pool) * quiet;
  out[W.stream] = voice(WATER.stream, run * close, 0.85 * sc.pan, {
    rate: 30 + 250 * sc.flow * (0.35 + 0.65 * sc.near) + 130 * sN,
    lo: lerp(900, 380, sc.near),
    hi: (2400 + 3600 * sc.near * (0.4 + 0.6 * sc.flow) + 1500 * sN) * dark,
    noise: 0.12 + 0.3 * sc.flow,
    nHi: (900 + 2300 * sc.flow + 1400 * sN) * dark,
  });

  // White water wherever the plan marks it, and under a fast camera or a fast page.
  const rough = wN * (sc.white * (0.5 + 0.5 * sc.near) * 1.2 + 0.5 * sN + 0.3 * cN) * quiet * (1 - 0.8 * sc.sea);
  out[W.white] = voice(WATER.fall, rough * close, 0.7 * sc.pan, { rate: 200 + 260 * sat(sc.white + sN), spread: 0.85, nHi: (2300 + 1500 * sN + 900 * cN + 600 * sc.white) * dark });

  // The confluence: a fall for each stream, where it stands, as big as it is.
  sc.falls.forEach((f, i) => {
    const a = heard(f);
    out[W.falls + i] = voice(WATER.fall, 0.75 * a * (0.3 + 0.7 * f.size) * close, 0.95 * f.pan, {
      rate: 110 + 360 * f.size,
      lo: lerp(720, 250, f.size),
      hi: lerp(5400, 3600, f.size) * dark,
      tilt: 0.55 + 0.5 * f.size,
      spread: 0.1,
      noise: 0.25 + 0.6 * f.size,
      nHi: (2000 + 2400 * f.size) * dark,
    });
  });

  // The clear pool's one spill, and the lattice's thread: a trickle, where it enters.
  const spill = heard(sc.spill);
  const thread = heard(sc.thread) * sat(sc.lattice * 2 - 0.6);
  out[W.thin] = spill >= thread ? voice(WATER.trickle, 0.7 * spill * sat(sc.pool * 3), 0.95 * sc.spill.pan, { rate: 30, hi: 5200 * dark }) : voice(WATER.trickle, 0.6 * thread, 0.95 * sc.thread.pan, { rate: 17, lo: 1900, hi: 5800 * dark });

  // Water that only laps: the basin against its block, the shallows round the columns, and the tarn, which is almost silent.
  const basin = 0.8 * sc.basin * (0.4 + 0.6 * heard(sc.slab));
  const cols = 0.62 * sc.cols * (0.3 + 0.7 * heard(sc.shallows));
  const tarn = 0.22 * sc.tarn;
  out[W.lap] =
    basin >= cols && basin >= tarn
      ? voice(WATER.stream, basin, 0.6 * sc.slab.pan, { rate: 13, lo: 300, hi: 1500 * dark, tilt: 0.5, spread: 0.5, noise: 0.06, nHi: 900 })
      : cols >= tarn
        ? voice(WATER.stream, cols, 0.6 * sc.shallows.pan, { rate: 8, lo: 520, hi: 2600 * dark, tilt: 0.45, spread: 0.6, noise: 0.03, nHi: 1200 })
        : voice(WATER.pool, tarn, 0, { rate: 0.35 });

  // The open sluice: a rush that swells as the surge runs down the channel and settles as it passes.
  let surge = 0;
  let open = 0;
  for (let i = 0; i < 3; i++) {
    const g = sc.surge[i] ?? 0;
    if (g > 0 && g < 1) surge = Math.max(surge, Math.sin(Math.PI * g));
    open = Math.max(open, sc.gate[i] ?? 0);
  }
  out[W.sluice] = voice(WATER.fall, sc.dam * heard(sc.sluice) * (0.3 * open + 0.9 * surge), 0.8 * sc.sluice.pan, { rate: 330 + 150 * surge, lo: 220, hi: 4800 * dark, spread: 0.3, noise: 0.7 + 0.3 * surge, nHi: (2400 + 1200 * surge) * dark });

  // The canyon: fast water against the wall, heard from close under it.
  out[W.wall] = voice(WATER.fall, 0.5 * sc.walls * (0.45 + 0.55 * heard(sc.bend)) * (0.5 + 0.5 * wN), 0.6 * sc.bend.pan, { rate: 280, lo: 230, hi: 3000 * dark, tilt: 1, spread: 0.8, noise: 0.95, nLo: 160, nHi: 1500 * dark });

  // The delta: many small channels, each its own size and its own place.
  sc.arms.forEach((a, i) => {
    out[W.arms + i] = voice(WATER.trickle, 0.5 * heard(a) * (0.35 + 0.65 * a.size), 0.95 * a.pan, {
      rate: 20 + 70 * a.size,
      lo: lerp(1500, 620, a.size) * (1 + 0.07 * i),
      hi: lerp(6200, 4200, a.size) * dark,
      tilt: 0.4 + 0.3 * a.size,
      noise: 0.04 + 0.16 * a.size,
      nHi: 2400 * dark,
    });
  });

  // The sea: the swell's own body, and the hiss as each wave draws back.
  const sw = seaAt(t);
  const sea = sat(sc.sea * wN * 1.3 + (sc.rest ? 0.3 : 0));
  // (It is nearly all body: the bubbles are only the fizz at the wave's edge, many and small.)
  out[W.sea] = voice(WATER.fall, 0.16 * sea * (0.3 + 0.7 * sw.level), sc.calm ? 0 : 0.5 * sw.side, { rate: 40 + 420 * sw.wash, lo: 1700, hi: 6200 * dark, tilt: 0.3, spread: 1, noise: 6, nLo: 55, nHi: (300 + 1100 * sw.level + 900 * sw.wash + 300 * sN) * dark });

  // The pointer through water: bubbles turned over where it passes, more of them and brighter the faster it goes.
  const pN = sat(sc.pv / 2.4);
  const wake = sc.over ? Math.pow(pN, 0.8) * (0.35 + 0.65 / (1 + sc.far / 40)) * (sc.calm ? 0.5 : 1) : 0;
  out[W.wake] = voice(WATER.stream, wake, clamp((sc.px - 0.5) * 1.7, -0.9, 0.9), { rate: 30 + 260 * pN, lo: 480 + 480 * sat(sc.far / 70), hi: 2400 + 3800 * pN, tilt: 0.5, spread: 0.12, noise: 0.1 + 0.25 * pN, nLo: 300, nHi: 800 + 2400 * pN });
  return out;
}

/**
 * Every continuous parameter, from the scene.
 * @param t the sound's own time in seconds: what the gusts and the swell are counted from
 */
export function mixOf(sc: Scene, t: number): Mix {
  const walls = sc.walls;
  const sN = scrollN(sc.sv, sc.calm);
  const cN = camN(sc.camV, sc.calm);
  const hush = sc.tarn;
  const wN = sat(Math.sqrt(sc.water) * 1.25);
  const exposure = smooth(100, 650, sc.camH);

  // Wind: over the ice, and wherever the camera is high or fast. Before dawn it is steadier and lower.
  const windBase = sc.home ? 0.2 + 0.5 * sc.ice + 0.3 * exposure + 0.25 * sc.sea * wN : 0.1;
  const wind = sat((windBase + 0.55 * cN + 0.25 * sN) * (1 - 0.75 * hush) * (1 - 0.6 * walls) * gust(t, sc.calm, sc.night));
  const windHz = (260 + 240 * exposure + 520 * cN + 200 * sc.ice - 120 * walls) * (1 - 0.28 * sc.night);
  const whistle = sat(0.2 * sc.ice + 0.5 * cN - 0.1) * (1 - hush) * (1 - walls) * (1 - 0.5 * sc.night);

  // The pointer's wake, as air: faster is louder and brighter; farther is softer and duller.
  const pN = sat(sc.pv / 2.4);
  const wake = sc.over ? Math.pow(pN, 0.8) * (0.35 + 0.65 / (1 + sc.far / 40)) * (sc.calm ? 0.5 : 1) : 0;
  const wakeHz = Math.max(300, 500 + 2600 * pN - 600 * sat(sc.far / 70));
  const wakePan = clamp((sc.px - 0.5) * 1.7, -0.9, 0.9);

  // The bed: brighter as the ice goes and the day comes round, darker before dawn and between walls.
  // On the run out to sea it leans in: the dominant swells as the camera nears where it will rest.
  const bright = sat(0.3 + 0.3 * sc.melt + 0.25 * sc.day + 0.15 * (1 - sc.ice));
  const bedCut = lerp(lerp(1100, 3800, bright), lerp(700, 2300, bright), sc.night) * (1 - 0.4 * walls);
  const bass = sc.home ? smooth(0.12, 0.9, sc.melt) : 1;
  const lean = sc.move === 9 ? 1 + 0.22 * sc.approach : 1;

  // The ice: it cracks as fast as it is melting, and groans now and then while it lies whole.
  const melting = sc.home && sc.melt > 0.008 && sc.melt < 0.985 && !sc.calm;
  const act = melting ? sat(sc.meltRate * 2.4) : 0;

  // The aurora: a high shimmer, there only before dawn, while the hour still has it and the lens is on the northern sky.
  // Its partials come and go at the rates the curtains' rays drift at in the picture, on the picture's own clock.
  const aurora = sc.home && !sc.rest ? sc.night * sc.aurora * (0.25 + 0.75 * sc.sky) * (0.4 + 0.6 * sc.north) : 0;
  const shimmer: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const ray = 0.5 + 0.5 * Math.sin(2 * Math.PI * (sc.clock * 0.05 + i * 0.31));
    const fine = 0.6 + 0.4 * Math.sin(2 * Math.PI * (-sc.clock * 0.08 + i * 0.57));
    shimmer.push([ray * fine, sc.calm ? (i - 2) * 0.3 : 0.8 * Math.sin(sc.clock * 0.02 * 2 * Math.PI + i * 1.9)]);
  }

  return {
    bed: (sc.home ? 1 : 0.62) * lean,
    bedCut,
    air: sat(0.28 + 0.2 * sc.night + 0.2 * sc.ice + 0.25 * walls),
    bass,
    wind,
    windHz,
    whistle,
    windPan: windPanOf(sc, t),
    water: waterOf(sc, t),
    wake,
    wakeHz,
    wakePan,
    aurora,
    shimmer,
    worldCut: 18000 * Math.pow(1400 / 18000, walls),
    rooms: roomsOf(sc),
    echo: 0.42 * walls,
    echoTime: slapTime(sc.wallD),
    // (Before dawn the world is closer: less of the room on it.)
    worldSend: sat((0.1 + 0.25 * walls + 0.1 * sc.ice) * (1 - 0.35 * sc.night)),
    cracks: 9 * Math.pow(act, 1.1),
    groans: sc.home && !sc.calm ? 0.07 * sc.ice * (1 - sat(sc.meltRate * 4)) : 0,
  };
}

/** The arrival: the swell that rises with the sun's last lift and lets go slowly after it. `since` is seconds after the lift is complete. */
export const arrivalOf = (lift: number, since: number) => (lift < 1 ? smooth(0, 1, lift) : Math.exp(-Math.max(0, since) / 6));

/** Where along its run (0..1) the line of light is when each of the arrival's chords sounds. */
export const arrivalRay = (i: number) => 0.01 + 0.98 * ARRIVAL_AT[i];

/** Which of the arrival's chords the line of light has reached: a chord sounds when the light passes its place. */
export function arrivalIndex(ray: number): number {
  let idx = -1;
  for (let i = 0; i < ARRIVAL_AT.length; i++) if (ray >= arrivalRay(i)) idx = i;
  return idx;
}

/** Seconds after the dawn at which the line of light reaches the arrival's chord `i`: the picture's own easing, turned round. */
export function arrivalTime(i: number): number {
  const y = arrivalRay(i);
  // smooth(x) = 3x^2 - 2x^3, solved for x.
  const x = 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3);
  return DAWN.ray[0] + (DAWN.ray[1] - DAWN.ray[0]) * x;
}

export interface Voice {
  midi: number;
  /** 0..1 */
  gain: number;
  /** -1..1 */
  pan: number;
  /** Hz: how bright */
  cut: number;
  /** 0..1 into the reverb */
  send: number;
}

/**
 * A press on water: a drop. Near water is a high, bright, close drop; far
 * water a lower, softer one with more of the place round it.
 * @param x where across the frame, 0..1
 * @param far how far off the water under the pointer is: about 12 (at the lens) to 70 (at the horizon)
 */
export function dropVoice(x: number, far: number): Voice {
  const d = sat((far - 12) / 58);
  return {
    midi: snap(86 - 24 * d),
    gain: 0.4 + 0.6 * (1 - d),
    pan: clamp((x - 0.5) * 1.6, -0.9, 0.9),
    cut: 7000 - 4200 * d,
    send: 0.18 + 0.5 * d,
  };
}

export interface Crack {
  /** 0..1 */
  gain: number;
  pan: number;
  /** how far the sheet has drawn the crack out: seconds times root hertz. The further off, the longer the chirp. */
  disp: number;
  /** where the chirp begins and where it dies, Hz */
  top: number;
  foot: number;
  /** 0..1: the crack itself, heard only from near */
  tick: number;
  /** 0..1: the low body of a large one */
  body: number;
  /** 0..1: how much comes back from the far shore, later and longer */
  echo: number;
  send: number;
}

/**
 * A crack in the ice. Lake ice carries high notes faster than low ones, so
 * a crack arrives as a chirp that falls, and the further it has come the
 * longer the fall: near, a snap with a short bright ping after it; far, a
 * soft descending call.
 * @param u where across the frame the crack opens, 0..1
 * @param far how far off, world units (about 150 at the lens to 6000 at the far shore)
 * @param size 0..1
 * @param melt 0..1: a whole sheet sings; one that is going to floes only clicks
 */
export function crackVoice(u: number, far: number, size: number, melt = 0): Crack {
  const d = sat(Math.log(Math.max(far, 150) / 150) / Math.log(40));
  const sheet = 1 - smooth(0.5, 0.9, melt);
  return {
    gain: (0.22 + 0.78 * size) * (1 - 0.6 * d),
    pan: clamp((u - 0.5) * 1.8, -0.95, 0.95),
    disp: lerp(1.1, 13, Math.pow(d, 1.25)) * (0.6 + 0.4 * sheet),
    top: lerp(9000, 5200, d),
    foot: lerp(520, 170, size),
    tick: (1 - smooth(0.15, 0.7, d)) * (0.5 + 0.5 * size),
    body: size > 0.55 ? (size - 0.55) / 0.45 : 0,
    echo: sheet * (0.25 + 0.75 * size) * (0.4 + 0.6 * d),
    send: 0.2 + 0.55 * d,
  };
}

/** The pitch of a crack's chirp `t` seconds after it arrives: the top comes first, and the rest follows as one over the square of time. */
export const chirpAt = (t: number, disp: number, top: number) => 1 / Math.pow(t / disp + 1 / Math.sqrt(top), 2);
/** How long the chirp takes to fall from its top to `foot`. */
export const chirpLen = (disp: number, top: number, foot: number) => disp * (1 / Math.sqrt(foot) - 1 / Math.sqrt(top));

/** A shard's note for this round of the pulse: the first calls, the second answers; each sounds from where it stands. */
export function shardVoice(round: number, which: number, pan: number, night: number): Voice {
  return { midi: shardNote(round, which), gain: which & 1 ? 0.8 : 1, pan: clamp(pan * 0.8, -0.8, 0.8), cut: lerp(5200, 3000, night), send: 0.6 + 0.2 * night };
}

/** One cube of the lattice as the light reaches it. */
export function latticeVoice(row: number, along: number, pan: number): Voice {
  return { midi: latticeNote(row, along), gain: 0.55 + 0.1 * along, pan: clamp(pan * 0.9, -0.85, 0.85), cut: 3200, send: 0.35 };
}

/** A drip from a column: the taller the column, the lower and fuller its drip. `h` is its height over the tallest's. */
export function dripVoice(h: number, pan: number): Voice {
  const rungs = ladder(81, 93);
  return { midi: rungs[Math.round((1 - sat(h)) * (rungs.length - 1))], gain: 0.45 + 0.55 * sat(h), pan: clamp(pan * 0.9, -0.85, 0.85), cut: 6000, send: 0.3 };
}

/** A link or a control: where it stands across the page picks its note, so the nav plays left to right. */
export function uiVoice(kind: 'hover' | 'tap', x: number): Voice {
  const rungs = ladder(81, 90);
  const m = rungs[Math.round(sat(x) * (rungs.length - 1))];
  return kind === 'hover' ? { midi: m, gain: 0.5, pan: clamp((x - 0.5) * 0.9, -0.5, 0.5), cut: 5000, send: 0.12 } : { midi: m - 12, gain: 1, pan: clamp((x - 0.5) * 0.9, -0.5, 0.5), cut: 3600, send: 0.16 };
}

/** When, in a lap of the lattice's light, it reaches cube `n` (row n >> 2, place n & 3 in the order the light meets them): seconds after the lap begins. */
export function latticeTime(n: number, pitch: number): number {
  const lead = Math.hypot(2 * pitch, 110);
  const lapLen = 4 * pitch + (Math.PI * pitch) / 2;
  const run = lead * 2 + 3 * lapLen + 4 * pitch + 500;
  // The light is at `fract(clock / LAP) * run - 250`; cube n is lit when it is at lead + row * lap + (along + 0.5) * pitch.
  return (LAP * (lead + (n >> 2) * lapLen + ((n & 3) + 0.5) * pitch + 250)) / run;
}

/** The lattice's light: the cube it has just reached in this lap, or -1. */
export function latticeAt(clock: number, pitch: number): { lap: number; cube: number } {
  const lap = Math.floor(clock / LAP);
  const into = clock - lap * LAP;
  let cube = -1;
  for (let n = 0; n < 16; n++) if (into >= latticeTime(n, pitch)) cube = n;
  return { lap, cube };
}

/** When a sluice's surge, begun at `t0` on the picture's clock, throws its ring `k` (1 to GATE.rings; the last is its head meeting the pool below). */
export const surgeRing = (t0: number, k: number) => t0 + (GATE.surge * k) / GATE.rings;

/** Where a seen thing is placed and how loud, for a moment that happens at it. */
export const place = (s: Seen, width = 0.9) => ({ pan: clamp(s.pan * width, -0.95, 0.95), k: heard(s) });
