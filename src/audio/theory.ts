/**
 * The piece's harmony, as plain data and pure functions.
 *
 * One key signature for the whole site: two sharps. The flight begins in B
 * minor's cold end of it (stacked fifths, no bass) and ends in D major: the
 * relative major, reached at the dawn. Every tuned effect on the site is
 * drawn from D major's pentatonic (D E F sharp A B), which sits inside every
 * chord below, so nothing an interaction plays can be out of key.
 */

/** A seeded generator, so a render of the same scene is the same sound. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = () => number;

/** Pitch classes: C is 0. */
const D = 2;
const E = 4;
const FS = 6;
const G = 7;
const A = 9;
const B = 11;
const CS = 1;

export const PENTA = [D, E, FS, A, B];

/** Frequency of a MIDI note number (A4 = 69 = 440 Hz). */
export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Every pentatonic note from `lo` to `hi`, rising. */
export function ladder(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (PENTA.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

/** The pentatonic note nearest a pitch. */
export function snap(midi: number): number {
  let best = midi;
  let d = 99;
  for (let m = Math.floor(midi) - 3; m <= Math.ceil(midi) + 3; m++) {
    if (!PENTA.includes(((m % 12) + 12) % 12)) continue;
    const dist = Math.abs(m - midi);
    if (dist < d) {
      d = dist;
      best = m;
    }
  }
  return best;
}

export interface Chord {
  name: string;
  /** the bass note's pitch class */
  bass: number;
  /** the upper voices' pitch classes, the ones that make the chord what it is first */
  tones: number[];
}

const chord = (name: string, bass: number, ...tones: number[]): Chord => ({ name, bass, tones });

export const CHORDS = {
  /** Fifths stacked on B: no third, so neither major nor minor. The ice. */
  Bq: chord('B5add9', B, FS, CS, B),
  /** The same shape a fourth lower. */
  Fq: chord('F#sus4add7', FS, B, E, FS),
  Gmaj7: chord('Gmaj7', G, B, FS, D, G),
  Gmaj9: chord('Gmaj9', G, B, FS, A, D),
  Bm9: chord('Bm9', B, D, CS, FS, A),
  Bm7: chord('Bm7', B, D, A, FS, B),
  DoverFs: chord('D/F#', FS, D, A, E, FS),
  Bm7overFs: chord('Bm7/F#', FS, D, A, B, FS),
  Dadd9: chord('Dadd9', D, FS, E, A, D),
  Dsus2: chord('Dsus2', D, E, A, D),
  Dmaj9: chord('Dmaj9', D, FS, CS, E, A),
  D69: chord('D6/9', D, FS, B, E, A),
  /** The arrival: D major with its ninth, the tonic itself in the upper voices. */
  Dhome: chord('Dadd9', D, FS, D, A, E),
  GoverD: chord('G/D', D, B, G, D, FS),
  Em9: chord('Em9', E, G, FS, D, B),
  A7sus: chord('A7sus4', A, D, G, E, A),
  A6: chord('A6', A, CS, FS, E, A),
  Fsm7: chord('F#m7', FS, A, E, CS, FS),
} satisfies Record<string, Chord>;

export interface Movement {
  name: string;
  /** the cycle of chords by day and before dawn */
  day: Chord[];
  night: Chord[];
  /** how many upper voices sound, and the range they keep to (MIDI) */
  voices: number;
  lo: number;
  hi: number;
  /** 0..1: how much of the bass is there */
  bass: number;
  /** seconds a chord is held */
  hold: number;
  /** 0..1: how often the bell line speaks, and the range it keeps to */
  bells: number;
  bellLo: number;
  bellHi: number;
  /** 0..1: the pad's level in this movement */
  level: number;
}

const C = CHORDS;

/**
 * The piece, as the flight passes through it. Each movement is a short
 * cycle; the upper voices move from chord to chord by the smallest steps
 * that keep each chord whole (see `voiceLead`), common notes are held.
 */
export const MOVEMENTS: Movement[] = [
  // 0 The frozen lake: three high voices, open fifths, no bass.
  { name: 'ice', day: [C.Bq, C.Gmaj7, C.Bq, C.Fq], night: [C.Bq, C.Fq, C.Bq, C.Gmaj7], voices: 3, lo: 59, hi: 85, bass: 0, hold: 11, bells: 0.22, bellLo: 83, bellHi: 98, level: 0.7 },
  // 1 The melt: a fourth voice and the bass come in with the water.
  { name: 'melt', day: [C.Bm9, C.Gmaj9, C.DoverFs, C.A7sus], night: [C.Bm9, C.Gmaj9, C.Bm7overFs, C.A7sus], voices: 4, lo: 54, hi: 83, bass: 0.55, hold: 8.5, bells: 0.5, bellLo: 78, bellHi: 95, level: 0.85 },
  // 2 The river, down to the pool: the piece opens out and moves.
  { name: 'river', day: [C.Gmaj9, C.DoverFs, C.Em9, C.A7sus, C.Dadd9, C.Bm7, C.Gmaj9, C.A6], night: [C.Gmaj9, C.Bm7overFs, C.Em9, C.A7sus, C.Dsus2, C.Bm7, C.Gmaj9, C.A7sus], voices: 4, lo: 52, hi: 81, bass: 0.85, hold: 7.5, bells: 0.62, bellLo: 74, bellHi: 93, level: 1 },
  // 3 The tarn: almost nothing. One open chord, held; the shards speak.
  { name: 'tarn', day: [C.Dsus2, C.Dsus2], night: [C.Dsus2, C.Dsus2], voices: 3, lo: 57, hi: 78, bass: 0.25, hold: 14, bells: 0, bellLo: 74, bellHi: 90, level: 0.34 },
  // 4 The columns, the dam, the lattice: the fullest writing, in D.
  { name: 'works', day: [C.Dmaj9, C.Bm7, C.Gmaj7, C.A6, C.Fsm7, C.Gmaj9, C.Em9, C.A7sus], night: [C.Dsus2, C.Bm9, C.Gmaj7, C.A7sus, C.Fsm7, C.Gmaj9, C.Em9, C.A7sus], voices: 4, lo: 50, hi: 81, bass: 1, hold: 7.5, bells: 0.55, bellLo: 74, bellHi: 93, level: 1 },
  // 5 The canyon: the minor side of the key, lower, closed in.
  { name: 'canyon', day: [C.Bm9, C.Gmaj7, C.Em9, C.Fsm7], night: [C.Bm9, C.Gmaj7, C.Em9, C.Fsm7], voices: 4, lo: 47, hi: 74, bass: 1, hold: 9, bells: 0.28, bellLo: 69, bellHi: 86, level: 0.9 },
  // 6 The delta and the run out to sea: toward the dominant, and waiting on it.
  { name: 'delta', day: [C.Gmaj9, C.A6, C.Fsm7, C.Bm7, C.Em9, C.A7sus], night: [C.Gmaj9, C.A7sus, C.Fsm7, C.Bm7, C.Em9, C.A7sus], voices: 4, lo: 52, hi: 83, bass: 0.9, hold: 8, bells: 0.5, bellLo: 76, bellHi: 95, level: 1 },
  // 7 The sea at rest: the arrival, D major, rocking between the tonic and the chord a fourth above it.
  { name: 'rest', day: [C.Dhome, C.GoverD, C.D69, C.GoverD], night: [C.Dhome, C.GoverD, C.Dhome, C.Bm7], voices: 4, lo: 50, hi: 86, bass: 1, hold: 12, bells: 0.4, bellLo: 78, bellHi: 98, level: 0.95 },
  // 8 Away from the flight (the inner pages): the river's first four chords, quietly.
  { name: 'page', day: [C.Gmaj9, C.DoverFs, C.Em9, C.A7sus], night: [C.Gmaj9, C.Bm7overFs, C.Em9, C.A7sus], voices: 3, lo: 55, hi: 79, bass: 0.5, hold: 10, bells: 0.3, bellLo: 76, bellHi: 91, level: 0.6 },
];

export const MOVE = { ice: 0, melt: 1, river: 2, tarn: 3, works: 4, canyon: 5, delta: 6, rest: 7, page: 8 } as const;

/**
 * The next chord's voicing: each voice goes to the nearest note that keeps
 * the chord whole. Voices never cross and never double at the unison, the
 * chord's defining notes are all there, and the total movement is the
 * least possible. `prev` may be empty (the first chord) or a different
 * length (a voice coming in or leaving).
 */
export function voiceLead(prev: number[], next: Chord, voices: number, lo: number, hi: number): number[] {
  const mid = (lo + hi) / 2;
  // Where each voice is coming from: its old note, or an even spread to start from.
  const from: number[] = [];
  const old = prev.slice().sort((a, b) => a - b);
  for (let i = 0; i < voices; i++) {
    if (old.length === voices) from.push(old[i]);
    else if (old.length > voices) from.push(old[Math.round((i * (old.length - 1)) / Math.max(1, voices - 1))]);
    else if (i < old.length) from.push(old[i]);
    else from.push(old.length ? old[old.length - 1] + 4 * (i - old.length + 1) : mid - 7 + (14 * i) / Math.max(1, voices - 1));
  }
  const pcs = next.tones;
  const cand: number[][] = from.map((f) => {
    const out: number[] = [];
    for (let m = Math.max(lo, Math.round(f) - 7); m <= Math.min(hi, Math.round(f) + 7); m++) if (pcs.includes(m % 12)) out.push(m);
    if (!out.length) for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) out.push(m);
    return out;
  });
  const need = pcs.slice(0, Math.min(voices, pcs.length));
  let best: number[] = [];
  let bestCost = Infinity;
  const pick = new Array<number>(voices);
  const walk = (i: number, cost: number) => {
    if (cost >= bestCost) return;
    if (i === voices) {
      let c = cost;
      // Every defining note present.
      for (const pc of need) if (!pick.some((m) => m % 12 === pc)) c += 9;
      // Not too tight and not too wide.
      const span = pick[voices - 1] - pick[0];
      if (span < 7) c += (7 - span) * 1.5;
      if (span > 21) c += (span - 21) * 1.5;
      // No voice left alone far below or above the rest.
      for (let k = 1; k < voices; k++) if (pick[k] - pick[k - 1] > 9) c += (pick[k] - pick[k - 1] - 9) * 1.3;
      // The whole chord keeps to the middle of its range.
      c += Math.abs((pick[0] + pick[voices - 1]) / 2 - mid) * 0.15;
      if (c < bestCost) {
        bestCost = c;
        best = pick.slice();
      }
      return;
    }
    for (const m of cand[i]) {
      // No crossing, no unison, and no semitone rub between neighbours.
      if (i > 0 && m - pick[i - 1] < 2) continue;
      pick[i] = m;
      const step = Math.abs(m - from[i]);
      // (The top voice is the one that is heard as a line: it is kept to small steps.)
      walk(i + 1, cost + step + (i === voices - 1 && step > 4 ? 2 : 0));
    }
  };
  walk(0, 0);
  if (!best.length) {
    // Nothing fits (a range too narrow for the rules): stack the chord's notes from the bottom.
    let m = lo;
    for (let i = 0; i < voices; i++) {
      while (!pcs.includes(m % 12)) m++;
      best.push(m);
      m += 2;
    }
  }
  return best;
}

/** The bass note for a chord: its root's pitch class in the octave above `floor`. */
export function bassNote(c: Chord, floor = 35): number {
  let m = floor;
  while (m % 12 !== c.bass) m++;
  return m;
}

export interface BellNote {
  /** seconds after the phrase begins */
  at: number;
  midi: number;
  /** 0..1 */
  vel: number;
}

/** Contours in pentatonic steps. A question rises and ends off the root; an answer comes back down to rest. */
const ASK = [
  [0, 1, 2],
  [0, 2, 1, 3],
  [0, -1, 1, 2],
  [0, 1, 3],
  [0, 2, 3, 2, 4],
];
const TELL = [
  [2, 1, 0],
  [3, 1, 2, 0],
  [1, 2, 0],
  [2, 0, -1, 0],
  [4, 2, 3, 1, 0],
];
/** When each note of a phrase falls, in beats, by how many notes it has. */
const RHYTHM: Record<number, number[][]> = {
  3: [
    [0, 1, 2.5],
    [0, 1.5, 2],
    [0, 0.5, 2],
  ],
  4: [
    [0, 1, 1.5, 3],
    [0, 0.5, 1.5, 2.5],
    [0, 1, 2, 3.5],
  ],
  5: [
    [0, 0.5, 1, 2, 3.5],
    [0, 1, 1.5, 2.5, 3],
  ],
};

/**
 * One phrase of the bell line. Phrases come in pairs: a question, then its
 * answer starting where the question stopped. The last note of each is a
 * note of the chord under it.
 */
export function bellPhrase(rng: Rng, c: Chord, lo: number, hi: number, last: number, answer: boolean, beat: number): BellNote[] {
  const rungs = ladder(lo, hi);
  if (rungs.length < 4) return [];
  const shapes = answer ? TELL : ASK;
  const shape = shapes[Math.floor(rng() * shapes.length)];
  const rh = RHYTHM[shape.length][Math.floor(rng() * RHYTHM[shape.length].length)];
  // Begin near where the last phrase ended (an answer exactly there), kept inside the range.
  let start = 0;
  let d = 99;
  const want = answer ? last : last + (rng() < 0.5 ? -3 : 4);
  rungs.forEach((m, i) => {
    if (Math.abs(m - want) < d) {
      d = Math.abs(m - want);
      start = i;
    }
  });
  const top = Math.max(...shape);
  const bottom = Math.min(...shape);
  start = Math.min(rungs.length - 1 - top + shape[0], Math.max(shape[0] - bottom, start));
  const notes = shape.map((st, i) => ({ at: rh[i] * beat, midi: rungs[Math.min(rungs.length - 1, Math.max(0, start + st - shape[0]))], vel: 0.55 + 0.45 * rng() }));
  // The last note comes to rest on a note of the chord: an answer on its root or fifth, a question on its colour.
  const end = notes[notes.length - 1];
  const rest = answer ? [c.bass, c.tones[c.tones.length - 1], c.tones[0]] : [c.tones[0], c.tones[1], c.tones[2] ?? c.tones[0]];
  let bestM = end.midi;
  let bestD = 99;
  for (let m = end.midi - 4; m <= end.midi + 4; m++) {
    if (m < lo || m > hi || !rest.includes(((m % 12) + 12) % 12)) continue;
    const dist = Math.abs(m - end.midi) + (m === notes[notes.length - 2].midi ? 3 : 0);
    if (dist < bestD) {
      bestD = dist;
      bestM = m;
    }
  }
  end.midi = bestM;
  end.vel = Math.min(1, end.vel + 0.1);
  return notes;
}

/** The lattice: sixteen cubes, four to a row. Each row climbs the pentatonic ladder, and each row starts a step above the last. */
export function latticeNote(row: number, along: number): number {
  const rungs = ladder(62, 96);
  return rungs[Math.min(rungs.length - 1, row + along)];
}

/** The two shards: a call, and its answer a minor third below (D major's fifth, then its third). */
export const SHARD_NOTES = [81, 78];

/** The arrival: D major opening upward as the line of light runs in. */
export const ARRIVAL = [62, 69, 74, 78, 81, 86];
