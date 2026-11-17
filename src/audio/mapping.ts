/**
 * From the scene to the sound's parameters. Pure functions, every one:
 * the same scene always gives the same numbers, so they can be tested and
 * a render can be repeated.
 *
 * Levels here are 0..1 within each sound; how loud each sound is in the mix
 * is set once, in the graph.
 */

import { type Scene, sat, smooth } from './scene';
import { ARRIVAL, SHARD_NOTES, ladder, latticeNote, snap } from './theory';

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
  /** running water: level, pitch (playback rate), brightness (low-pass, Hz), side */
  stream: number;
  streamRate: number;
  streamCut: number;
  streamPan: number;
  /** white water: level, colour (band centre, Hz), side */
  rush: number;
  rushHz: number;
  rushPan: number;
  /** the sea: level and brightness, both breathing with the swell */
  sea: number;
  seaCut: number;
  /** the pointer's wake: level, colour, side */
  wake: number;
  wakeHz: number;
  wakePan: number;
  /** the place: the low-pass the whole world is heard through (Hz), the canyon's echo, the world's reverb */
  worldCut: number;
  echo: number;
  worldSend: number;
  /** the ice working: cracks a second, and groans a second */
  cracks: number;
  groans: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** How much of a sweep is left when motion is reduced. */
export const CALM = 0.3;

/** Scroll speed, 0..1: a slow read is about 0.15, a flick is 1. */
export const scrollN = (sv: number, calm: boolean) => sat(sv / 2.5) * (calm ? CALM : 1);
/** Camera speed, 0..1. The camera covers about a thousand world units a screen. */
export const camN = (camV: number, calm: boolean) => sat(camV / 2400) * (calm ? CALM : 1);

/** The wind's gusts: slow, never still, the same for the same moment. */
export const gust = (t: number, calm: boolean) => 1 - (calm ? 0.12 : 0.26) * (0.5 + 0.3 * Math.sin(0.23 * t) + 0.2 * Math.sin(0.61 * t + 1.3));
/** The sea's swell: a wave that rises quickly and draws back slowly, about every eight seconds. */
export const swell = (t: number) => {
  const p = (t / 8.2) % 1;
  return p < 0.3 ? smooth(0, 0.3, p) : 1 - smooth(0.3, 1, p);
};

/**
 * Every continuous parameter, from the scene.
 * @param t the sound's own time in seconds: what the gusts and the swell are counted from
 */
export function mixOf(sc: Scene, t: number): Mix {
  const walls = sc.walls;
  const sN = scrollN(sc.sv, sc.calm);
  const cN = camN(sc.camV, sc.calm);
  const hush = sc.tarn;
  // (A river that is a seventh of the ground in frame is already most of what is heard there.)
  const wN = sat(Math.sqrt(sc.water) * 1.25);
  const exposure = smooth(100, 650, sc.camH);

  // Wind: over the ice, and wherever the camera is high or fast.
  const windBase = sc.home ? 0.2 + 0.5 * sc.ice + 0.3 * exposure + 0.25 * sc.sea * wN : 0.1;
  const wind = sat((windBase + 0.55 * cN + 0.25 * sN) * (1 - 0.75 * hush) * (1 - 0.6 * walls) * gust(t, sc.calm));
  const windHz = 260 + 240 * exposure + 520 * cN + 200 * sc.ice - 120 * walls;
  const whistle = sat(0.2 * sc.ice + 0.5 * cN - 0.1) * (1 - hush) * (1 - walls);

  // Water: what is in frame, how near, how fast it runs, and how fast the page is moving over it.
  const quiet = 1 - 0.92 * hush;
  const stream = sat(wN * (0.25 + 0.75 * sc.near) * (0.35 + 0.65 * sc.flow) * (1 - 0.8 * sc.sea) * quiet);
  const streamRate = 0.82 + 0.3 * sc.flow + 0.22 * sN + 0.1 * cN;
  const streamCut = 700 + 6500 * sc.near * (0.4 + 0.6 * sc.flow) + 1500 * sN;
  // The open sluice: a rush that swells as the surge runs down the channel and settles as it passes.
  let surge = 0;
  for (let i = 0; i < 3; i++) {
    const g = sc.surge[i] ?? 0;
    if (g > 0 && g < 1) surge = Math.max(surge, Math.sin(Math.PI * g));
  }
  const rush = sat((wN * sc.white * (0.5 + 0.5 * sc.near) * 1.2 + 0.55 * wN * sN + 0.35 * wN * cN + 0.9 * surge * sc.dam) * quiet);
  const rushHz = 900 + 1400 * sN + 900 * cN + 500 * sc.white - 300 * walls;
  const sw = swell(t);
  const sea = sat(sc.sea * wN * 1.3 + (sc.rest ? 0.3 : 0)) * (0.55 + 0.45 * sw);
  const seaCut = 420 + 900 * sw + 300 * sN;

  // The pointer through water: faster is louder and brighter; farther is softer and duller.
  const pN = sat(sc.pv / 2.4);
  const wake = sc.over ? Math.pow(pN, 0.8) * (0.35 + 0.65 / (1 + sc.far / 40)) * (sc.calm ? 0.5 : 1) : 0;
  const wakeHz = Math.max(300, 500 + 2600 * pN - 600 * sat(sc.far / 70));
  const wakePan = clamp((sc.px - 0.5) * 1.7, -0.9, 0.9);

  // The bed: brighter as the ice goes and the day comes round, darker before dawn and between walls.
  const bright = sat(0.3 + 0.3 * sc.melt + 0.25 * sc.day + 0.15 * (1 - sc.ice));
  const bedCut = lerp(lerp(1100, 3800, bright), lerp(700, 2300, bright), sc.night) * (1 - 0.4 * walls);
  const bass = sc.home ? smooth(0.12, 0.9, sc.melt) : 1;

  // The ice: it cracks as fast as it is melting, and groans now and then while it lies whole.
  const melting = sc.home && sc.melt > 0.04 && sc.melt < 0.985 && !sc.calm;
  const act = melting ? sat(sc.meltRate * 2.4) : 0;

  return {
    bed: sc.home ? 1 : 0.62,
    bedCut,
    air: sat(0.28 + 0.2 * sc.night + 0.2 * sc.ice + 0.25 * walls),
    bass,
    wind,
    windHz,
    whistle,
    windPan: sc.calm ? 0 : 0.25 * Math.sin(0.11 * t),
    stream,
    streamRate,
    streamCut,
    streamPan: 0.85 * sc.pan,
    rush,
    rushHz,
    rushPan: 0.7 * sc.pan,
    sea,
    seaCut,
    wake,
    wakeHz,
    wakePan,
    worldCut: 18000 * Math.pow(1400 / 18000, walls),
    echo: 0.4 * walls,
    worldSend: sat(0.1 + 0.25 * walls + 0.1 * sc.ice),
    cracks: 12 * Math.pow(act, 1.1),
    groans: sc.home && !sc.calm ? 0.07 * sc.ice * (1 - sat(sc.meltRate * 4)) : 0,
  };
}

/** The arrival: the swell that rises with the sun's last lift and lets go slowly after it. `since` is seconds after the lift is complete. */
export const arrivalOf = (lift: number, since: number) => (lift < 1 ? smooth(0, 1, lift) : Math.exp(-Math.max(0, since) / 6));

/** Which of the arrival's notes the line of light has reached: the note sounds when the light passes it. */
export function arrivalIndex(ray: number): number {
  // Six notes, the first as the line sets out and the last as it comes to the eye.
  return ray <= 0.01 ? -1 : Math.min(ARRIVAL.length - 1, Math.floor(ray * (ARRIVAL.length - 0.02)));
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

export interface Crack extends Voice {
  /** 0..1: how much of a low body the crack has (the big ones) */
  body: number;
  /** 0..1: how much it rings on as a falling chirp (the far ones, heard through the sheet) */
  ring: number;
}

/**
 * A crack in the ice.
 * @param u where across the frame the fracture opens, 0..1
 * @param depth how far up the lake, 0 at the lens to 1 at the far shore
 * @param size 0..1
 */
export function crackVoice(u: number, depth: number, size: number): Crack {
  return {
    midi: 0,
    gain: (0.25 + 0.75 * size) * (1 - 0.55 * depth),
    pan: clamp((u - 0.5) * 1.8, -0.95, 0.95),
    // Small and near is a high tick; large and far is lower.
    cut: 5400 - 2600 * depth - 1300 * size,
    send: 0.2 + 0.55 * depth,
    body: size > 0.55 ? (size - 0.55) / 0.45 : 0,
    ring: smooth(0.35, 0.9, depth) * (0.4 + 0.6 * size),
  };
}

/** A shard's note: the first calls, the second answers; each sounds from where it stands. */
export function shardVoice(which: number, pan: number, night: number): Voice {
  return { midi: SHARD_NOTES[which & 1], gain: which & 1 ? 0.8 : 1, pan: clamp(pan * 0.8, -0.8, 0.8), cut: lerp(5200, 3000, night), send: 0.6 + 0.2 * night };
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

/** The lattice's light: where along its thread it is, as the picture works it out. Returns the cube it has just reached, or -1. */
export function latticeAt(clock: number, pitch: number): { lap: number; cube: number } {
  const lead = Math.hypot(2 * pitch, 110);
  const lapLen = 4 * pitch + (Math.PI * pitch) / 2;
  const pos = ((clock / 9) % 1) * (lead * 2 + 3 * lapLen + 4 * pitch + 500) - 250;
  // Cube n (row j, place `along` in the order the light meets them) is lit when the light is at lead + j * lap + (along + 0.5) * pitch.
  let cube = -1;
  for (let n = 0; n < 16; n++) {
    const j = n >> 2;
    const along = n & 3;
    if (pos >= lead + j * lapLen + (along + 0.5) * pitch) cube = n;
  }
  return { lap: Math.floor(clock / 9), cube };
}
