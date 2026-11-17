/**
 * The piece's harmony, as plain data and pure functions.
 *
 * One key signature for the whole site: two sharps. The flight begins in B
 * minor's cold end of it (stacked fifths, no bass) and ends in D major: the
 * relative major, reached at the dawn. Every tuned effect on the site is
 * drawn from D major's pentatonic (D E F sharp A B), which sits inside every
 * chord below, so nothing an interaction plays can be out of key.
 *
 * And one theme: five notes (MOTIF), stated plainly once by the bells over
 * the frozen lake, where it ends on B minor's third and hangs, and whole and
 * harmonised at the dawn, where the same five notes end on D major's tonic
 * and rest. Between the two every movement's material is made from it.
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

/** A pulse of the piece, in seconds. Chords are held, and bells fall, on this grid. */
export const BEAT = 1.15;

/**
 * The theme. F sharp, A, B, E, D: up a step, up a step, down a fourth, down
 * a step (steps of the pentatonic ladder). Over B it is the fifth, the
 * seventh, the root, the fourth and the minor third: a question. In D it is
 * the third, the fifth, the sixth, the second and the tonic: the answer.
 */
export const MOTIF = [78, 81, 83, 76, 74];
/** When each of its notes falls, in beats. */
export const MOTIF_BEATS = [0, 1, 2, 3.5, 5];

const LADDER = ladder(0, 127);
/** A pentatonic note's place on the ladder (the nearest rung for a note off it). */
export const rung = (midi: number) => LADDER.indexOf(snap(midi));
/** The note `steps` rungs of the ladder above a pentatonic note. */
export const climb = (midi: number, steps: number) => LADDER[Math.min(LADDER.length - 1, Math.max(0, rung(midi) + steps))];

/** The theme as rungs from its first note: 0, 1, 2, -1, -2. */
export const MOTIF_STEPS = MOTIF.map((m) => rung(m) - rung(MOTIF[0]));

/** One way of saying the theme. */
export interface Variation {
  /** as it is, upside down, or backwards */
  form: 'plain' | 'invert' | 'retro';
  /** all five notes, its first three, or its last three */
  part?: 'whole' | 'head' | 'tail';
  /** 2: every note twice as long (augmented) */
  stretch?: number;
  /** moved this many rungs of the ladder (a sequence) */
  shift?: number;
}

/** A variation as rungs from the theme's own first note, and the beat each note falls on (the first on 0). */
export function vary(v: Variation): { steps: number[]; beats: number[] } {
  let steps = MOTIF_STEPS.slice();
  let gaps = MOTIF_BEATS.slice(1).map((b, i) => b - MOTIF_BEATS[i]);
  if (v.form === 'invert') steps = steps.map((x) => -x);
  if (v.form === 'retro') {
    steps.reverse();
    gaps.reverse();
  }
  if (v.part === 'head') {
    steps = steps.slice(0, 3);
    gaps = gaps.slice(0, 2);
  } else if (v.part === 'tail') {
    steps = steps.slice(2);
    gaps = gaps.slice(2);
  }
  const beats = [0];
  for (const g of gaps) beats.push(beats[beats.length - 1] + g * (v.stretch ?? 1));
  return { steps: steps.map((x) => x + (v.shift ?? 0)), beats };
}

/**
 * The notes of a variation. `anchor` is where the theme's own first note (F
 * sharp) stands for this statement; the whole statement is moved by octaves
 * until it lies inside `lo`..`hi`, if it can.
 */
export function motifNotes(v: Variation, anchor: number, lo = 0, hi = 127): number[] {
  const { steps } = vary(v);
  let notes = steps.map((x) => climb(anchor, x));
  for (let n = 0; n < 4 && Math.min(...notes) < lo; n++) notes = notes.map((m) => m + 12);
  for (let n = 0; n < 4 && Math.max(...notes) > hi; n++) notes = notes.map((m) => m - 12);
  return notes;
}

/** Whether a run of notes is the theme, or a stretch of it (two notes or more), in any of its forms, at any height. */
export function derives(notes: number[]): boolean {
  if (notes.length < 2) return false;
  const gaps = notes.slice(1).map((m, i) => rung(m) - rung(notes[i]));
  // (A note off the ladder is not the theme.)
  if (notes.some((m) => snap(m) !== m)) return false;
  for (const form of ['plain', 'invert', 'retro'] as const) {
    const s = vary({ form }).steps;
    const g = s.slice(1).map((x, i) => x - s[i]);
    for (let at = 0; at + gaps.length <= g.length; at++) if (gaps.every((x, i) => x === g[at + i])) return true;
  }
  return false;
}

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
  /** seconds a chord is held (kept to whole beats) */
  hold: number;
  /** 0..1: how often the bell line speaks, and the range it keeps to */
  bells: number;
  bellLo: number;
  bellHi: number;
  /** 0..1: the pad's level in this movement */
  level: number;
  /** how this movement says the theme: once on entering, then these in turn */
  first: Variation | null;
  then: Variation[];
}

const C = CHORDS;
const P: Variation = { form: 'plain' };
const head = (form: Variation['form'] = 'plain', more: Partial<Variation> = {}): Variation => ({ form, part: 'head', ...more });
const tail = (form: Variation['form'] = 'plain', more: Partial<Variation> = {}): Variation => ({ form, part: 'tail', ...more });
/** The canyon's chords stand on the theme itself, one note to a chord: F sharp, A, B, E, D in the bass. */
const UNDER = [C.Fsm7, C.A7sus, C.Bm9, C.Em9, C.GoverD];

/**
 * The piece, as the flight passes through it. Each movement is a short
 * cycle; the upper voices move from chord to chord by the smallest steps
 * that keep each chord whole (see `voiceLead`), common notes are held.
 */
export const MOVEMENTS: Movement[] = [
  // 0 The frozen lake: three high voices, open fifths, no bass. The theme, plainly, once.
  { name: 'ice', day: [C.Bq, C.Gmaj7, C.Bq, C.Fq], night: [C.Bq, C.Fq, C.Bq, C.Gmaj7], voices: 3, lo: 59, hi: 85, bass: 0, hold: 11.5, bells: 0.22, bellLo: 83, bellHi: 98, level: 0.7, first: P, then: [head(), tail()] },
  // 1 The melt: a fourth voice and the bass come in with the water. The theme upside down: it falls where it rose, and ends on B.
  { name: 'melt', day: [C.Bm9, C.Gmaj9, C.DoverFs, C.A7sus], night: [C.Bm9, C.Gmaj9, C.Bm7overFs, C.A7sus], voices: 4, lo: 54, hi: 83, bass: 0.55, hold: 9.2, bells: 0.5, bellLo: 78, bellHi: 97, level: 0.85, first: { form: 'invert' }, then: [head('invert'), tail('invert')] },
  // 2 The river, down to the pool: the piece opens out and moves. The theme in the middle of the bells, then passed back and forth in halves.
  { name: 'river', day: [C.Gmaj9, C.DoverFs, C.Em9, C.A7sus, C.Dadd9, C.Bm7, C.Gmaj9, C.A6], night: [C.Gmaj9, C.Bm7overFs, C.Em9, C.A7sus, C.Dsus2, C.Bm7, C.Gmaj9, C.A7sus], voices: 4, lo: 52, hi: 81, bass: 0.85, hold: 8.05, bells: 0.62, bellLo: 74, bellHi: 93, level: 1, first: P, then: [head(), tail(), head('plain', { shift: 1 }), tail()] },
  // 3 The tarn: almost nothing. One open chord, held; the two shards share the theme between them.
  { name: 'tarn', day: [C.Dsus2, C.Dsus2], night: [C.Dsus2, C.Dsus2], voices: 3, lo: 57, hi: 78, bass: 0.25, hold: 13.8, bells: 0, bellLo: 74, bellHi: 90, level: 0.34, first: null, then: [] },
  // 4 The columns, the dam, the lattice: the fullest writing, in D. The theme backwards (the lattice's rows begin on its notes).
  { name: 'works', day: [C.Dmaj9, C.Bm7, C.Gmaj7, C.A6, C.Fsm7, C.Gmaj9, C.Em9, C.A7sus], night: [C.Dsus2, C.Bm9, C.Gmaj7, C.A7sus, C.Fsm7, C.Gmaj9, C.Em9, C.A7sus], voices: 4, lo: 50, hi: 81, bass: 1, hold: 8.05, bells: 0.55, bellLo: 74, bellHi: 93, level: 1, first: { form: 'retro' }, then: [head('retro'), tail('retro'), head()] },
  // 5 The canyon: the minor side of the key, lower, closed in. The theme is in the bass, a note to a chord; the bells only begin it, slowly.
  { name: 'canyon', day: UNDER, night: UNDER, voices: 4, lo: 47, hi: 74, bass: 1, hold: 9.2, bells: 0.28, bellLo: 69, bellHi: 86, level: 0.9, first: head('plain', { stretch: 2 }), then: [tail('plain', { stretch: 2 }), head('plain', { stretch: 2 })] },
  // 6 The delta: the theme in sequence, each saying a step lower than the last.
  { name: 'delta', day: [C.Gmaj9, C.A6, C.Fsm7, C.Bm7, C.Em9, C.A7sus], night: [C.Gmaj9, C.A7sus, C.Fsm7, C.Bm7, C.Em9, C.A7sus], voices: 4, lo: 52, hi: 83, bass: 0.9, hold: 8.05, bells: 0.5, bellLo: 76, bellHi: 95, level: 1, first: P, then: [{ form: 'plain', shift: -1 }, { form: 'plain', shift: -2 }, head()] },
  // 7 The sea at rest: the arrival, D major, rocking between the tonic and the chord a fourth above it.
  { name: 'rest', day: [C.Dhome, C.GoverD, C.D69, C.GoverD], night: [C.Dhome, C.GoverD, C.Dhome, C.Bm7], voices: 4, lo: 50, hi: 86, bass: 1, hold: 12.65, bells: 0.4, bellLo: 74, bellHi: 98, level: 0.95, first: tail(), then: [{ form: 'plain', stretch: 2 }, head(), tail()] },
  // 8 Away from the flight (the inner pages): the river's first four chords, quietly, and the theme in halves.
  { name: 'page', day: [C.Gmaj9, C.DoverFs, C.Em9, C.A7sus], night: [C.Gmaj9, C.Bm7overFs, C.Em9, C.A7sus], voices: 3, lo: 55, hi: 79, bass: 0.5, hold: 10.35, bells: 0.3, bellLo: 76, bellHi: 91, level: 0.6, first: head(), then: [tail(), head()] },
  // 9 The run out to sea: the dominant, held, with the theme begun and not finished, until the dawn resolves it.
  { name: 'approach', day: [C.A7sus, C.A6], night: [C.A7sus, C.A7sus], voices: 4, lo: 52, hi: 83, bass: 1, hold: 13.8, bells: 0.5, bellLo: 76, bellHi: 95, level: 1, first: head(), then: [head('plain', { shift: 1 }), head()] },
];

export const MOVE = { ice: 0, melt: 1, river: 2, tarn: 3, works: 4, canyon: 5, delta: 6, rest: 7, page: 8, approach: 9 } as const;

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

/**
 * One phrase of the bell line: a saying of the theme. Before dawn it stands
 * two rungs of the ladder lower (about a fourth), still the same shape.
 * @param anchor where the theme's first note stands: 78 is its own place
 */
export function motifPhrase(v: Variation, lo: number, hi: number, night: number, beat = BEAT, anchor = 78): BellNote[] {
  const shifted: Variation = { ...v, shift: (v.shift ?? 0) - (night ? 2 : 0) };
  const notes = motifNotes(shifted, anchor, lo, hi);
  const { beats } = vary(v);
  // The line leans on its first note and comes to rest on its last.
  return notes.map((midi, i) => ({ at: beats[i] * beat, midi, vel: i === 0 ? 0.85 : i === notes.length - 1 ? 0.95 : 0.7 }));
}

/** How long a variation takes to say, in beats, from its first note to its last. */
export const motifBeats = (v: Variation) => vary(v).beats[vary(v).beats.length - 1];

/** The lattice: sixteen cubes, four to a row. Each row begins on the theme's next note (F sharp, A, B, E) and climbs the ladder from it. */
const LATTICE_ROWS = [66, 69, 71, 64];
export function latticeNote(row: number, along: number): number {
  return climb(LATTICE_ROWS[Math.min(3, Math.max(0, row))], along);
}
/** The lap's own first sound, the ring where the thread enters the pool: the theme's last note, D. */
export const LATTICE_START = 62;

/**
 * The two shards share the theme: round by round the first calls with one
 * of its notes and the second answers with the next. F sharp and A; B and
 * E; then D, answered by itself an octave down. Three rounds say it whole.
 */
export const SHARD_ROUNDS = [
  [MOTIF[0], MOTIF[1]],
  [MOTIF[2], MOTIF[3]],
  [MOTIF[4], MOTIF[4] - 12],
];
export const shardNote = (round: number, which: number) => SHARD_ROUNDS[((round % 3) + 3) % 3][which & 1];

/**
 * The arrival, on the light event's own clock, in three parts.
 *
 * While the line of light runs out across the sea the theme gathers: its
 * first three notes, then the same three an octave up, each further off
 * than the last (GATHER). Where the line ends a ribbon of light leaves the
 * water, and there the theme is stated whole, each note harmonised below
 * (ARRIVAL: I, I, IV, V, I); `ARRIVAL_AT` is the theme's own rhythm, laid
 * from the ribbon's first light to the end of its rise. Over it the ribbon's
 * own climb: the ladder, a rung for each sixth of its way to the top of the
 * frame, the last as it leaves it (CLIMB).
 */
export const GATHER = [...MOTIF.slice(0, 3).map((m) => m - 12), ...MOTIF.slice(0, 3)];
export const ARRIVAL = [
  [78, 74, 69],
  [81, 78, 74],
  [83, 79, 74],
  [76, 73, 69],
  [74, 69, 66, 62],
];
export const ARRIVAL_AT = MOTIF_BEATS.map((b) => b / MOTIF_BEATS[MOTIF_BEATS.length - 1]);
export const CLIMB = ladder(86, 98);
