/**
 * The sound, conducted: once a frame it is handed the scene and the time
 * that frame's sound is for, and it steers every parameter there; moments
 * (a press, the switch, a drip, the dawn) are handed to it as they happen.
 *
 * It keeps no clock of its own. On the page the time is the audio
 * context's; in the checks it is the frame's place in an offline render.
 * The same calls make the same sound in both.
 */

import { COLS, LATTICE, SHARDS, SLUICES } from '@/water/world';
import { type Graph, bell, bloom, crack, drip, drop, gate, groan, pluck, shard, tick, whoosh } from './graph';
import { type Mix, arrivalIndex, arrivalOf, crackVoice, dripVoice, dropVoice, latticeAt, latticeVoice, mixOf, shardVoice, uiVoice } from './mapping';
import { type Scene, panOf, sat } from './scene';
import { Score } from './score';
import { ARRIVAL, type Rng, hz, makeRng } from './theory';

/** How loud each of the world's sounds is at its fullest, within the world bus. */
const TRIM = { wind: 0.3, whistle: 0.035, stream: 0.95, rush: 0.34, sea: 0.23, wake: 0.42 };

export interface SoundEvent {
  type: string;
  /** when its cause happened: the frame's time, or the handler's, in performance ms */
  cause: number;
  /** when its sound starts, in the audio context's seconds */
  audio: number;
  /** when that start was asked for, in performance ms */
  made: number;
}

export class Sound {
  readonly score: Score;
  private rng: Rng;
  private scene: Scene | null = null;
  private crackAcc = 0;
  private crackNext = 0.4;
  private groanAcc = 0;
  private groanNext = 0.6;
  private melting = false;
  private phase = -1;
  private lap = -1;
  private cube = -1;
  private arrived = 99;
  private dawn = false;
  private dawnCause = 0;
  private dawnAt = -1;
  private liftDone = -1;
  private night = -1;
  private tapAt = -1e9;
  /** Set by the page: the time (performance ms) of the frame being made. */
  frameAt = 0;
  /** When set, every moment's cause and start are kept here (the sync check reads it). */
  trace: SoundEvent[] | null = null;

  constructor(
    readonly g: Graph,
    seed = 7,
  ) {
    this.rng = makeRng(seed);
    this.score = new Score(g, makeRng(seed + 101));
  }

  private note(type: string, cause: number, audio: number) {
    if (this.trace && this.trace.length < 4000) this.trace.push({ type, cause, audio, made: performance.now() });
  }

  /** Fade the whole mix in or out. `seconds` is how long until it is as good as there. */
  setOn(on: boolean, t: number, seconds: number) {
    this.g.on.cancelScheduledValues(t);
    this.g.on.setTargetAtTime(on ? 1 : 0, t, seconds / 3);
  }

  /** One frame: steer everything to where the scene says, for time `t`. Returns what it steered to. */
  frame(sc: Scene, t: number): Mix {
    const g = this.g;
    const m = mixOf(sc, t);
    // Reduced motion: the same places, reached slowly.
    const slow = sc.calm ? 5 : 1;
    this.scene = sc;

    // The arrival: the bed swells with the sun's last lift, then lets go.
    if (this.dawn) {
      this.dawn = false;
      this.dawnAt = t;
      this.liftDone = -1;
      this.arrived = -1;
      this.score.arrive(t);
      bloom(g, t, 38, 0.9, 2.4);
      this.note('dawn', this.dawnCause, t);
    }
    if (this.dawnAt >= 0 && this.liftDone < 0 && sc.lift >= 1) this.liftDone = t;
    const arrival = this.dawnAt >= 0 && sc.home ? arrivalOf(sc.lift, this.liftDone >= 0 ? t - this.liftDone : 0) : 0;
    if (sc.home && this.dawnAt >= 0) {
      // The line of light: each of the arrival's notes sounds as the light reaches it.
      const idx = arrivalIndex(sc.ray);
      if (idx > this.arrived && this.arrived < ARRIVAL.length - 1) {
        this.arrived = idx;
        bell(g, ARRIVAL[idx], t, 0.5 + 0.06 * idx, 0.45 - 0.09 * idx, { bright: 0.9 - 0.5 * sc.night, long: 3.6, send: 0.7 });
        this.note('ray', this.frameAt, t);
      }
    }

    g.bed.to(m.bed * (1 + 0.4 * arrival), t);
    g.padCut.to(m.bedCut * (1 + 0.35 * arrival), t);
    g.air.to(m.air, t);

    g.wind.to(TRIM.wind * m.wind, t, slow);
    g.windHz.to(m.windHz, t, slow);
    g.whistle.to(TRIM.whistle * m.whistle, t, slow);
    g.whistleHz.to(m.windHz * 3.1, t, slow);
    g.windPan.to(m.windPan, t, slow);
    g.stream.to(TRIM.stream * m.stream, t, slow);
    g.streamRate[0].to(m.streamRate, t, slow);
    g.streamRate[1].to(m.streamRate * 0.94, t, slow);
    g.streamCut.to(m.streamCut, t, slow);
    g.streamPan.to(m.streamPan, t, slow);
    g.rush.to(TRIM.rush * m.rush, t, slow);
    g.rushHz.to(m.rushHz, t, slow);
    g.rushPan.to(m.rushPan, t, slow);
    g.sea.to(TRIM.sea * m.sea, t);
    g.seaCut.to(m.seaCut, t);
    g.wake.to(TRIM.wake * m.wake, t);
    g.wakeHz.to(m.wakeHz, t);
    g.wakePan.to(m.wakePan, t);
    g.worldCut.to(m.worldCut, t);
    g.echo.to(m.echo, t);
    g.worldSend.to(m.worldSend, t);

    this.score.advance(t, { move: sc.move, night: sc.night, bass: m.bass, calm: sc.calm });

    // The theme: air moves through, one bell marks it, and the score takes every note again in the other voicing.
    if (this.night >= 0 && sc.night !== this.night) {
      whoosh(g, t, 0.9, sc.night ? 2600 : 520, sc.night ? 480 : 2800, 0.1, 0);
      bell(g, sc.night ? 78 : 81, t + 0.05, 0.5, 0, { bright: sc.night ? 0.3 : 0.9, long: 3.2, send: 0.7 });
      this.note('theme', this.frameAt, t);
    }
    this.night = sc.night;

    // The ice. It cracks as fast as it is melting: the first crack in the frame the melt begins to move.
    if (m.cracks > 0) {
      const begun = !this.melting;
      this.melting = true;
      this.crackAcc += m.cracks * sc.dt;
      if (begun || this.crackAcc >= this.crackNext) {
        this.crackAcc = 0;
        this.crackNext = -Math.log(1 - this.rng() * 0.98);
        // Where it opens: anywhere across the lake in frame, more often near; most are small.
        const u = 0.04 + 0.92 * this.rng();
        const depth = Math.pow(this.rng(), 1.4);
        const size = begun ? 0.75 : Math.pow(this.rng(), 1.6) * (0.55 + 0.45 * sat(m.cracks / 6));
        const v = crackVoice(u, depth, size);
        crack(g, t, v.gain * (0.35 + 0.65 * sc.ice), v.pan, v.cut, v.send, v.body, v.ring);
        this.note('crack', this.frameAt, t);
      }
    } else {
      this.melting = false;
    }
    if (m.groans > 0) {
      this.groanAcc += m.groans * sc.dt;
      if (this.groanAcc >= this.groanNext) {
        this.groanAcc = 0;
        this.groanNext = 0.5 + this.rng();
        groan(g, t, this.rng() * 1.4 - 0.7);
        if (this.rng() < 0.5) {
          const v = crackVoice(this.rng(), 0.6 + 0.4 * this.rng(), 0.3 + 0.4 * this.rng());
          crack(g, t + 0.2 + 0.5 * this.rng(), v.gain * 0.5, v.pan, v.cut, v.send, 0, 1);
        }
      }
    }

    // The tarn's two shards, in the picture's own time: the first calls as the pulse leaves it,
    // the second answers as the pulse leaves it in turn; each landing is a soft note an octave down.
    const c = sc.clock % 7;
    const phase = c < 3 ? 0 : c < 3.5 ? 1 : c < 6.5 ? 2 : 3;
    if (sc.home && sc.tarn > 0.15 && this.phase >= 0 && phase !== this.phase && !sc.calm) {
      const leaving = phase === 0 || phase === 2;
      const which = phase === 0 || phase === 3 ? 0 : 1;
      const at = SHARDS[which];
      const v = shardVoice(which, panOf(sc.cam, sc.aspect, at.x, at.y, at.h * 0.5), sc.night);
      if (leaving) shard(g, v.midi, t, v.gain * sc.tarn, v.pan, v.cut, v.send, sc.night);
      else bell(g, v.midi - 12, t, 0.22 * sc.tarn, v.pan, { bright: 0.15, long: 2.2, send: v.send, bus: g.fx });
      this.note(leaving ? 'pulse' : 'landing', this.frameAt, t);
    }
    this.phase = phase;

    // The lattice: a note for each cube as the travelling light reaches it.
    const lat = latticeAt(sc.clock, LATTICE.pitch);
    if (lat.lap !== this.lap) {
      this.lap = lat.lap;
      this.cube = lat.cube;
    } else if (lat.cube > this.cube) {
      this.cube = lat.cube;
      if (sc.home && sc.lattice > 0.5 && !sc.calm) {
        const row = lat.cube >> 2;
        const along = lat.cube & 3;
        const col = row % 2 === 0 ? along : 3 - along;
        const v = latticeVoice(row, along, panOf(sc.cam, sc.aspect, LATTICE.x + (col - 1.5) * LATTICE.pitch, LATTICE.y + (row - 1.5) * LATTICE.pitch, LATTICE.h));
        pluck(g, v.midi, t, v.gain * sc.lattice, v.pan, v.cut, v.send);
        this.note('lattice', this.frameAt, t);
      }
    }
    return m;
  }

  /**
   * A moment, as it happens.
   * @param t when its sound starts, audio seconds
   * @param cause when it happened, performance ms
   */
  fire(type: string, a: number, b: number, c: number, t: number, cause: number) {
    const g = this.g;
    const sc = this.scene;
    switch (type) {
      case 'press': {
        // A press on water: a drop, pitched by how far off the water is, placed where it fell.
        if (c <= 0) return;
        const v = dropVoice(a, c);
        // (A press that is also a press on a control keeps its tick in front.)
        drop(g, t, hz(v.midi), v.gain * (Math.abs(cause - this.tapAt) < 40 ? 0.4 : 1), v.pan, v.cut, v.send);
        this.note('press', cause, t);
        return;
      }
      case 'hover':
      case 'tap': {
        const v = uiVoice(type, a);
        tick(g, t, v.midi, v.gain, v.pan, v.cut, v.send, type === 'tap');
        if (type === 'tap') this.tapAt = cause;
        this.note(type, cause, t);
        return;
      }
      case 'switch': {
        // The gates: the old one is set down as the new one lifts. The rush that follows is steered by the surge itself.
        const line = SLUICES[Math.min(2, Math.max(0, Math.round(a)))];
        gate(g, t, sc ? panOf(sc.cam, sc.aspect, line[0].x, line[0].y, 40) * 0.8 : 0);
        this.note('switch', cause, t);
        return;
      }
      case 'drip': {
        if (!sc || sc.cols <= 0.05) return;
        const v = dripVoice(b, panOf(sc.cam, sc.aspect, COLS.xs[Math.min(3, Math.max(0, Math.round(a)))], COLS.y, 0));
        drip(g, t, v.midi, v.gain * sc.cols, v.pan, v.send);
        this.note('drip', cause, t);
        return;
      }
      case 'dawn':
        // Taken up in this frame's steering, with the sun's lift.
        this.dawn = true;
        this.dawnCause = cause;
        return;
      case 'melt':
        if (a < 1) return;
        // The last of the ice has gone.
        bloom(g, t, 50, 0.55, 1.5);
        bell(g, 86, t + 0.08, 0.5, 0, { bright: 0.8, long: 3.4, send: 0.7 });
        this.note('melt', cause, t);
        return;
      case 'route':
        whoosh(g, t, 0.7, 640, 1900, 0.085, 0);
        this.note('route', cause, t);
        return;
      case 'haptic:success':
        tick(g, t, 81, 0.9, 0, 5000, 0.2, false);
        tick(g, t + 0.09, 86, 0.9, 0, 5000, 0.2, false);
        return;
      case 'haptic:error':
        tick(g, t, 66, 0.9, 0, 2400, 0.1, true);
        return;
      default:
        return;
    }
  }
}
