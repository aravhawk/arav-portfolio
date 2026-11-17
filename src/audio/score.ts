/**
 * The bed, composed as it goes: a slow piece in one key that never comes
 * round the same way twice, and follows the flight.
 *
 * Three parts. Upper voices (the pad) move from chord to chord by the
 * smallest steps that keep each chord whole, and a note two chords share
 * is held across the change, not struck again. A bass swells in under them
 * once there is water. A glass bell line speaks in pairs of short phrases,
 * a question and its answer. Where the camera is picks the movement (its
 * chords, its register, how many voices, how often the bells speak); the
 * theme picks the voicing.
 */

import { type Graph, type PadNote, bassTo, bell, padOff, padOn } from './graph';
import { type Chord, MOVEMENTS, type Rng, bassNote, bellPhrase, voiceLead } from './theory';

export interface ScoreState {
  move: number;
  night: number;
  /** 0..1 how much of the bass is let in (it comes with the water) */
  bass: number;
  /** reduced motion: the piece keeps its pace but nothing is hurried by the page */
  calm: boolean;
}

export class Score {
  private notes: PadNote[] = [];
  private move = -1;
  private at = 0;
  private nextChord = 0;
  private nextBell = 0;
  private lastBell = 86;
  private answer = false;
  private night = -1;
  private chordNow: Chord | null = null;
  /** For the checks: every chord as it was voiced. */
  history: { t: number; move: string; chord: string; notes: number[] }[] = [];

  constructor(
    private g: Graph,
    private rng: Rng,
  ) {}

  /** The chord sounding now. */
  get chord(): Chord | null {
    return this.chordNow;
  }

  /** Bring the arrival: the next chord change happens now, and is the movement's first chord. */
  arrive(t: number) {
    this.at = 0;
    this.nextChord = t;
  }

  /** Called every frame with the time the frame's sound is for. */
  advance(t: number, st: ScoreState) {
    const night = st.night > 0.5 ? 1 : 0;
    const moved = st.move !== this.move;
    const turned = night !== this.night && this.night >= 0;
    if (moved) {
      // A new movement begins at the next change, and that change is brought near.
      this.at = 0;
      this.nextChord = this.move < 0 ? t : Math.min(this.nextChord, t + 0.9);
      this.move = st.move;
      this.nextBell = Math.min(this.nextBell, t + 2.5);
      if (this.nextBell < t) this.nextBell = t + 1.5 + 2 * this.rng();
    }
    if (turned) this.nextChord = t;
    this.night = night;
    const mv = MOVEMENTS[this.move];

    if (t >= this.nextChord) {
      const cycle = night ? mv.night : mv.day;
      const chord = cycle[this.at % cycle.length];
      // Before dawn the upper voices sit a little lower.
      const drop = night ? 2 : 0;
      const want = voiceLead(
        this.notes.map((n) => n.midi),
        chord,
        mv.voices,
        mv.lo - drop,
        mv.hi - drop,
      );
      // The theme's turn is a cross-fade between two voicings of the same harmony: every note is taken again.
      const fade = turned ? 1.2 : moved ? 2.6 : 3.4;
      const level = (0.9 * mv.level) / Math.sqrt(mv.voices);
      const keep: PadNote[] = [];
      for (const n of this.notes) {
        if (!turned && want.includes(n.midi) && !keep.some((k) => k.midi === n.midi)) {
          keep.push(n);
          n.gain.gain.setTargetAtTime(level, t, fade / 3);
        } else padOff(n, t, fade * 1.15);
      }
      // Each voice has its place across the field: the lowest a little left, the highest a little right.
      want.forEach((m, i) => {
        if (!keep.some((k) => k.midi === m)) keep.push(padOn(this.g, m, t, level, fade, night, mv.voices > 1 ? (i / (mv.voices - 1) - 0.5) * 0.5 : 0));
      });
      this.notes = keep;
      bassTo(this.g, bassNote(chord), t, 0.5 * mv.bass * st.bass);
      this.chordNow = chord;
      if (this.history.length < 400) this.history.push({ t: +t.toFixed(2), move: mv.name, chord: chord.name, notes: want.slice().sort((a, b) => a - b) });
      this.at++;
      this.nextChord = t + mv.hold * (0.92 + 0.16 * this.rng());
    } else if (this.chordNow) {
      // The bass follows the water in and out between changes.
      this.g.bass.gain.gain.setTargetAtTime(0.5 * mv.bass * st.bass, t, 1.2);
    }

    if (mv.bells > 0 && t >= this.nextBell && this.chordNow) {
      const beat = 1.15;
      const drop = night ? 5 : 0;
      const phrase = bellPhrase(this.rng, this.chordNow, mv.bellLo - drop, mv.bellHi - drop, this.lastBell, this.answer, beat);
      let end = 0;
      for (const n of phrase) {
        // Each bell sits a little to one side, higher notes further right.
        const pan = Math.min(0.6, Math.max(-0.6, (n.midi - (mv.bellLo + mv.bellHi) / 2) / 22 + 0.3 * (this.rng() - 0.5)));
        bell(this.g, n.midi, t + n.at, 0.5 * n.vel, pan, { bright: night ? 0.45 : 0.85, long: night ? 3.6 : 2.8, send: night ? 0.75 : 0.55 });
        end = Math.max(end, n.at);
        this.lastBell = n.midi;
      }
      // An answer follows its question closely; then the line rests, longer where the movement is sparse.
      const rest = this.answer ? 5 + 16 * (1 - mv.bells) * (0.6 + 0.8 * this.rng()) : 1.6 + 1.2 * this.rng();
      this.answer = !this.answer;
      this.nextBell = t + end + rest;
    } else if (mv.bells === 0) {
      this.nextBell = Math.max(this.nextBell, t + 2);
      this.answer = false;
    }
  }
}
