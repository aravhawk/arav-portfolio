/**
 * The bed, composed as it goes: a slow piece in one key that never comes
 * round the same way twice, and follows the flight.
 *
 * Three parts. Upper voices (the pad) move from chord to chord by the
 * smallest steps that keep each chord whole, and a note two chords share
 * is held across the change, not struck again. A bass swells in under them
 * once there is water. A glass bell line says the piece's one theme: whole
 * as each movement begins, in that movement's own way (plain, upside down,
 * backwards, drawn out), then in halves that answer each other.
 *
 * Everything keeps to one grid of beats. A chord is held for a whole number
 * of them and a bell phrase is said inside one chord, so the harmony moves
 * between phrases and never under one. When the camera reaches a new place
 * the new movement waits for the phrase being said to end. Two things do
 * not wait: the run out to sea takes its dominant at once and holds it, and
 * the dawn resolves it on the event itself.
 */

import { type Graph, type PadNote, bassTo, bell, hush, padOff, padOn } from './graph';
import { BEAT, type Chord, MOVE, MOVEMENTS, type Rng, type Variation, bassNote, motifBeats, motifPhrase, voiceLead } from './theory';

export interface ScoreState {
  move: number;
  /** 0..1: by day, before dawn, or turning */
  night: number;
  /** 0..1 how much of the bass is let in (it comes with the water) */
  bass: number;
  /** reduced motion: the piece keeps its pace but nothing is hurried by the page */
  calm: boolean;
}

export interface Phrase {
  t: number;
  move: string;
  form: Variation;
  notes: number[];
}

/** How long a new movement will wait for the phrase being said, in seconds: past this the phrase is ended where it is. */
const PATIENCE = 4.6;

export class Score {
  private notes: PadNote[] = [];
  private move = -1;
  private want = -1;
  private at = 0;
  private said = 0;
  private nextChord = 0;
  private phraseEnd = 0;
  private night = -1;
  private chordNow: Chord | null = null;
  private rung: { t: number; head: GainNode }[] = [];
  private bassLevel = -1;
  /** For the checks: every chord as it was voiced, and every phrase the bells said. */
  history: { t: number; move: string; chord: string; notes: number[] }[] = [];
  phrases: Phrase[] = [];

  constructor(
    private g: Graph,
    private rng: Rng,
  ) {}

  /** The chord sounding now. */
  get chord(): Chord | null {
    return this.chordNow;
  }

  /** Bells set for later than `t` are taken back: a phrase is ended, never talked over. */
  private cut(t: number) {
    for (const b of this.rung) if (b.t > t) hush(b.head, t);
    this.rung = this.rung.filter((b) => b.t <= t);
    this.phraseEnd = Math.min(this.phraseEnd, t);
  }

  /** Bring the arrival: the piece goes to its tonic now. (If the frame that brought the dawn has already taken it there, it stays: the harmony does not move twice.) */
  arrive(t: number) {
    this.cut(t);
    if (this.move === MOVE.rest) return;
    this.want = MOVE.rest;
    this.nextChord = t;
  }

  /** Called every frame with the time the frame's sound is for. */
  advance(t: number, st: ScoreState) {
    const night = st.night > 0.5 ? 1 : 0;
    const turned = night !== this.night && this.night >= 0;
    if (st.move !== this.want) {
      this.want = st.move;
      if (this.move < 0) this.nextChord = t;
      else if (st.move === MOVE.approach || st.move === MOVE.rest) {
        // The dominant, and the tonic it resolves to, are taken at once.
        this.cut(t);
        this.nextChord = t;
      } else {
        // The new movement begins when the phrase being said is over, or at the chord's own end if that is sooner.
        const wait = Math.max(t + 0.9, Math.min(this.phraseEnd + BEAT, t + PATIENCE));
        if (wait < this.nextChord) {
          this.nextChord = wait;
          this.cut(wait - 0.3);
        }
      }
    }
    // (The theme's turn is the visitor's own: the two voicings cross-fade as it happens.)
    if (turned) this.nextChord = Math.min(this.nextChord, t);
    this.night = night;

    if (t >= this.nextChord && this.want >= 0) {
      const moved = this.move !== this.want;
      if (moved) {
        this.move = this.want;
        this.at = 0;
        this.said = 0;
      }
      const mv = MOVEMENTS[this.move];
      const cycle = night ? mv.night : mv.day;
      // (A turn of the theme takes the chord that is sounding again; it does not move the harmony on.)
      if (turned && !moved && this.at > 0) this.at--;
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
      this.bassLevel = 0.5 * mv.bass * st.bass;
      bassTo(this.g, bassNote(chord), t, this.bassLevel);
      this.chordNow = chord;
      if (this.history.length < 400) this.history.push({ t: +t.toFixed(2), move: mv.name, chord: chord.name, notes: want.slice().sort((a, b) => a - b) });
      this.at++;

      // How long it is held: whole beats, now and then one more.
      let beats = Math.round(mv.hold / BEAT) + (this.rng() < 0.3 ? 1 : 0);
      // The bells: one phrase to a chord. The first on entering a movement is its saying of the whole theme.
      const first = this.said === 0;
      const form = first ? mv.first : mv.then.length ? mv.then[(this.said - 1) % mv.then.length] : null;
      const speak = !!form && mv.bells > 0 && !turned && (first || this.rng() < Math.min(0.95, mv.bells * 1.25));
      if (form && speak) {
        const len = motifBeats(form);
        // (After the arrival the line waits for the arrival's own saying of the theme to be over.)
        const lead = this.move === MOVE.rest && first ? 5 : first ? 2 : 1 + Math.floor(this.rng() * 2);
        beats = Math.max(beats, Math.ceil(lead + len + 1.5));
        const phrase = motifPhrase(form, mv.bellLo, mv.bellHi, night);
        const t0 = t + lead * BEAT;
        for (const n of phrase) {
          // Each bell sits a little to one side, higher notes further right.
          const pan = Math.min(0.6, Math.max(-0.6, (n.midi - (mv.bellLo + mv.bellHi) / 2) / 22 + 0.3 * (this.rng() - 0.5)));
          const head = bell(this.g, n.midi, t0 + n.at, 0.5 * n.vel, pan, { bright: night ? 0.45 : 0.85, long: night ? 4.4 : 2.8, send: night ? 0.75 : 0.55 });
          this.rung.push({ t: t0 + n.at, head });
        }
        this.phraseEnd = t0 + len * BEAT;
        if (this.phrases.length < 400) this.phrases.push({ t: +t0.toFixed(2), move: mv.name, form, notes: phrase.map((n) => n.midi) });
        this.said++;
      } else if (!turned) this.phraseEnd = t;
      this.rung = this.rung.filter((b) => b.t > t - 1);
      this.nextChord = t + beats * BEAT;
    } else if (this.chordNow && this.move >= 0) {
      // The bass follows the water in and out between changes.
      const level = 0.5 * MOVEMENTS[this.move].bass * st.bass;
      if (Math.abs(level - this.bassLevel) > 0.004) {
        this.bassLevel = level;
        this.g.bass.gain.gain.setTargetAtTime(level, t, 1.2);
      }
    }
  }
}
