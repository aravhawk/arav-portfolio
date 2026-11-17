/**
 * The sound, conducted: once a frame it is handed the scene and the time
 * that frame's sound is for, and it steers every parameter there; moments
 * (a press, the switch, a drip, the dawn) are handed to it as they happen.
 *
 * Two kinds of moment, two ways of being on time.
 *
 * What the picture does by its own clock (the shards' pulse, the lattice's
 * light, the gates' travel, the surge, the drips, the dawn's line of light)
 * is known before it is seen. Each such moment is set ahead, a quarter of a
 * second, at the audio time it will be heard on the frame that shows it,
 * whatever that frame's own length (see clock.ts). If the picture's clock
 * is disturbed, or the thing goes out of sight, what was set is taken back.
 *
 * What a visitor causes (a press, the wake, the ice breaking as the page is
 * scrolled, the switch's latch) cannot be known ahead: it is asked for at
 * once, and the page gives the sound its turn before the picture draws.
 *
 * It keeps no clock of its own. On the page the time is the audio
 * context's; in the checks it is the frame's place in an offline render.
 * The same calls make the same sound in both.
 */

import { groundUnder } from '@/water/camera';
import { GATE, LAP, PULSE } from '@/water/moments';
import { COLS, LAKE, LATTICE, SHARDS, SLUICES } from '@/water/world';
import { ClockMap, LOOK, frameFor, startAt } from './clock';
import { type Graph, bell, bloom, clink, drip, drop, gateLift, gateSet, groan, hush, iceCrack, pluck, shard, tick, whoosh } from './graph';
import { type Mix, arrivalOf, arrivalTime, crackVoice, dripVoice, dropVoice, latticeTime, latticeVoice, mixOf, place, shardVoice, surgeRing, uiVoice } from './mapping';
import { type Scene, heard, sat, seenAt, smooth, wetUnder } from './scene';
import { Score } from './score';
import { ARRIVAL, LATTICE_START, type Rng, hz, makeRng } from './theory';

/** How loud each of the world's sounds is at its fullest, within the world bus. */
const TRIM = { wind: 0.3, whistle: 0.035, wake: 0.14, aurora: 0.0075 };

/** The melt at which the letters' ponds run together into one (the picture eases it from 0.505 to 0.57). */
const JOIN = 0.54;

export interface SoundEvent {
  type: string;
  /** when its cause happened: the time of the frame that shows it, or the handler's, in performance ms. NaN for a moment set ahead whose frame has not come. */
  cause: number;
  /** when its sound starts, in the audio context's seconds */
  audio: number;
  /** when that start was asked for, in performance ms */
  made: number;
  /** set ahead on the picture's clock: its time there */
  tau?: number;
}

/** When a frame's sound is for. */
export interface Times {
  /** the audio time continuous parameters glide from, and moments asked for at once start at */
  now: number;
  /** the time of the frame being made, performance ms */
  frameAt: number;
  /** the map between the page's clock and the audio clock */
  map: ClockMap;
}

interface Ahead {
  key: string;
  tau: number;
  T: number;
  heads: GainNode[];
  ev: SoundEvent | null;
  ok: ((sc: Scene) => boolean) | null;
}

export class Sound {
  readonly score: Score;
  private rng: Rng;
  private scene: Scene | null = null;
  private crackAcc = 0;
  private crackNext = 0.4;
  private groanAcc = 0;
  private groanNext = 0.6;
  private slapAcc = 0;
  private slapNext = 1.2;
  private melting = false;
  private brokeAt = -1e9;
  private joined = false;
  private meltWas = -1;
  private dawnAt = -1;
  private dawnClock = -1;
  private liftDone = -1;
  private night = -1;
  private tapAt = -1e9;
  private gates = [1, 0, 0];
  private gateDir = [0, 0, 0];
  private gateEpoch = [0, 0, 0];
  private surges = [0, 0, 0];
  private surgeEpoch = [0, 0, 0];
  private gatesSeen = false;
  private arrival = 0;
  private pend: Ahead[] = [];
  private keys = new Map<string, number>();
  private pc = { clock: 0, at: 0, ok: false };
  private frameMs = 1000 / 60;
  private slowFrames = 0;
  private lastFrameAt = 0;
  private times: Times = { now: 0, frameAt: 0, map: ClockMap.fixed(0) };
  /** How often the picture's clock was found disturbed and what was set ahead taken back. */
  disturbed = 0;
  /** When set, every moment's cause and start are kept here (the sync check reads it). */
  trace: SoundEvent[] | null = null;

  constructor(
    readonly g: Graph,
    seed = 7,
  ) {
    this.rng = makeRng(seed);
    this.score = new Score(g, makeRng(seed + 101));
  }

  private note(type: string, cause: number, audio: number, tau?: number): SoundEvent | null {
    if (!this.trace || this.trace.length >= 6000) return null;
    const ev: SoundEvent = { type, cause, audio, made: typeof performance !== 'undefined' ? performance.now() : 0, tau };
    this.trace.push(ev);
    return ev;
  }

  /** Fade the whole mix in or out. `seconds` is how long until it is as good as there. */
  setOn(on: boolean, t: number, seconds: number) {
    this.g.on.cancelScheduledValues(t);
    this.g.on.setTargetAtTime(on ? 1 : 0, t, seconds / 3);
  }

  /** Take back everything set ahead that has not begun (the picture's clock was disturbed, or the page is going out of sight). */
  cancelAhead(t: number) {
    for (const p of this.pend) {
      if (p.T <= t) continue;
      for (const h of p.heads) hush(h, t);
      if (p.ev) p.ev.type += ':taken-back';
    }
    this.pend = this.pend.filter((p) => p.T <= t);
    this.keys.clear();
    for (const p of this.pend) this.keys.set(p.key, p.tau);
  }

  /**
   * Set a moment ahead.
   * @param tau when it happens on the picture's clock
   * @param make builds its sound to start at the audio time it is given
   */
  private ahead(type: string, key: string, tau: number, sc: Scene, make: (T: number) => GainNode | GainNode[] | void, ok: ((sc: Scene) => boolean) | null = null) {
    if (this.keys.has(key)) return;
    const { map, now } = this.times;
    const T = startAt(map.heardAt(frameFor(tau, sc.clock, sc.clockAt, this.frameMs, this.times.frameAt)), now);
    const made = make(T);
    this.keys.set(key, tau);
    this.pend.push({ key, tau, T, heads: made ? (Array.isArray(made) ? made : [made]) : [], ev: this.note(type, NaN, T, tau), ok });
  }

  /** One frame: steer everything to where the scene says. Returns what it steered to. */
  frame(sc: Scene, times: Times): Mix {
    this.times = times;
    if (this.lastFrameAt) {
      // How long a frame is here: learned from frames that kept their length. (A long frame is a missed beat, not a
      // slower display; but if frames stay long, that is the display.)
      const d = times.frameAt - this.lastFrameAt;
      if (d > 3 && d < this.frameMs * 1.3) {
        this.frameMs += (d - this.frameMs) * 0.1;
        this.slowFrames = 0;
      } else if (d < 60 && ++this.slowFrames > 20) this.frameMs += (d - this.frameMs) * 0.1;
    }
    this.lastFrameAt = times.frameAt;
    const m = mixOf(sc, times.now);
    this.steer(sc, m, times.now);
    this.clockwork(sc, times);
    this.moments(sc, m, times.now);
    return m;
  }

  /** The continuous part: every level, colour and place. */
  private steer(sc: Scene, m: Mix, t: number) {
    const g = this.g;
    // Reduced motion: the same places, reached slowly.
    const slow = sc.calm ? 5 : 1;
    this.scene = sc;
    const arrival = this.arrival;
    g.bed.to(m.bed * (1 + 0.4 * arrival), t);
    g.padCut.to(m.bedCut * (1 + 0.35 * arrival), t);
    g.air.to(m.air, t);

    g.wind.to(TRIM.wind * m.wind, t, slow);
    g.windHz.to(m.windHz, t, slow);
    g.whistle.to(TRIM.whistle * m.whistle, t, slow);
    g.whistleHz.to(m.windHz * 3.1, t, slow);
    g.windPan.to(m.windPan, t, slow);
    for (let i = 0; i < m.water.length; i++) g.water.set(i, m.water[i], t);
    g.wake.to(TRIM.wake * m.wake, t);
    g.wakeHz.to(m.wakeHz, t);
    g.wakePan.to(m.wakePan, t);
    g.aurora.to(TRIM.aurora * m.aurora, t);
    g.shimmer.forEach((s, i) => {
      s.gain.to(m.shimmer[i][0], t);
      s.pan.to(m.shimmer[i][1], t);
    });
    g.worldCut.to(m.worldCut, t);
    g.rooms(m.rooms, t);
    g.echo.to(m.echo, t);
    g.fxEcho.to(0.7 * m.echo, t);
    g.echoTime.to(m.echoTime, t);
    g.worldSend.to(m.worldSend, t);
  }

  /** What the picture does by its own clock, set ahead. */
  private clockwork(sc: Scene, times: Times) {
    const g = this.g;
    const t = times.now;

    // The picture's clock: it must have run on by exactly the time between the two frames that drew it. If it has
    // not (a long frame, a hidden tab, reduced motion, a still picture), whatever was set by it is taken back.
    const pc = this.pc;
    if (pc.ok && sc.clockAt !== pc.at && Math.abs(sc.clock - pc.clock - (sc.clockAt - pc.at) / 1000) > 0.0006) {
      this.disturbed++;
      this.cancelAhead(t);
    }
    pc.clock = sc.clock;
    pc.at = sc.clockAt;
    pc.ok = sc.home;

    // The clock this frame will draw, and the frames that show what was set.
    const shows = sc.clock + Math.min(0.05, Math.max(0, (times.frameAt - sc.clockAt) / 1000));
    for (const p of this.pend) {
      if (p.ev && Number.isNaN(p.ev.cause) && shows >= p.tau) p.ev.cause = times.frameAt;
      if (p.ok && p.T > t + 0.012 && !p.ok(sc)) {
        for (const h of p.heads) hush(h, t);
        if (p.ev) p.ev.type += ':taken-back';
        p.T = -1;
      }
    }
    if (this.pend.length && (this.pend[0].T < t - 1 || this.pend.length > 64)) this.pend = this.pend.filter((p) => p.T >= t - 1);
    for (const [k, tau] of this.keys) if (tau < sc.clock - 4) this.keys.delete(k);

    // The sluices are remembered whether or not anything may sound, so a gate that moved while out of sight is not heard later.
    const gate = [sc.gate[0] ?? 0, sc.gate[1] ?? 0, sc.gate[2] ?? 0];
    for (let i = 0; i < 3; i++) {
      const dir = Math.sign(gate[i] - this.gates[i]);
      if (dir !== 0 && dir !== this.gateDir[i]) {
        this.gateDir[i] = dir;
        this.gateEpoch[i]++;
      }
      const sg = sc.surge[i] ?? 0;
      if (sg > 0 && this.surges[i] <= 0) this.surgeEpoch[i]++;
      this.surges[i] = sg;
      this.gates[i] = gate[i];
    }
    const seenBefore = this.gatesSeen;
    this.gatesSeen = true;

    if (!sc.home || sc.calm || !sc.cam) return;
    const until = sc.clock + LOOK + Math.max(0, times.map.lag) + this.frameMs / 1000;
    const from = sc.clock;

    // The tarn's two shards, in the picture's own time. Round by round they share the theme: the first calls as the
    // pulse leaves it, the second answers as the pulse leaves it in turn; each landing is a soft note an octave down.
    if (sc.tarn > 0.15) {
      const stops: [number, boolean, number][] = [
        [0, true, 0],
        [3, false, 1],
        [3.5, true, 1],
        [6.5, false, 0],
      ];
      for (let r = Math.floor(from / PULSE); r <= Math.floor(until / PULSE); r++) {
        stops.forEach(([off, leaving, which], i) => {
          const tau = r * PULSE + off;
          if (tau <= from || tau > until) return;
          this.ahead(
            leaving ? 'pulse' : 'landing',
            `sh${r}.${i}`,
            tau,
            sc,
            (T) => {
              const at = SHARDS[which];
              const see = seenAt(sc.cam, sc.aspect, at.x, at.y, at.h * 0.5);
              const v = shardVoice(r, which, see.pan, sc.night);
              // (A shard out of frame is still heard across the tarn, softer.)
              const lvl = sc.tarn * (0.45 + 0.55 * see.k);
              if (!leaving) return bell(g, v.midi - 12, T, 0.22 * lvl, v.pan, { bright: 0.15, long: 2.2, send: v.send, bus: g.fx });
              // (The pulse leaves with a real splash at the shard's foot.)
              g.water.burst(T, 5, 700, 2600, 0.5 * lvl, v.pan, 0.06, 0.09, 0.5);
              return shard(g, v.midi, T, v.gain * lvl, v.pan, v.cut, v.send, sc.night);
            },
            (s) => s.tarn > 0.1,
          );
        });
      }
    }

    // The lattice: a note for each cube as the travelling light reaches it, and the lap's own first note where the thread enters.
    if (sc.lattice > 0.5) {
      for (let lap = Math.floor(from / LAP); lap <= Math.floor(until / LAP); lap++) {
        for (let n = -1; n < 16; n++) {
          const tau = lap * LAP + (n < 0 ? 0 : latticeTime(n, LATTICE.pitch));
          if (tau <= from || tau > until) continue;
          const row = n >> 2;
          const along = n & 3;
          const col = row % 2 === 0 ? along : 3 - along;
          const see = n < 0 ? sc.thread : seenAt(sc.cam, sc.aspect, LATTICE.x + (col - 1.5) * LATTICE.pitch, LATTICE.y + (row - 1.5) * LATTICE.pitch, LATTICE.h);
          // (From the dam the lattice is a far glint: its notes are for when the cubes themselves are in front of the lens.)
          const k = see.k * (1 - smooth(1500, 2300, see.far));
          if (k <= 0.1) continue;
          this.ahead(
            n < 0 ? 'lap' : 'lattice',
            `la${lap}.${n}`,
            tau,
            sc,
            (T) => {
              if (n < 0) {
                g.water.burst(T, 5, 900, 3200, 0.45 * k, 0.9 * see.pan, 0.05, 0.08, 0.5);
                return pluck(g, LATTICE_START, T, 0.5 * k, 0.9 * see.pan, 2400, 0.4);
              }
              const v = latticeVoice(row, along, see.pan);
              return pluck(g, v.midi, T, v.gain * k, v.pan, v.cut, v.send);
            },
            (s) => s.lattice > 0.4,
          );
        }
      }
    }

    // The sluices, in the gates' own time: a lighter knock as the opening gate comes home, a low one as the closing gate is set down.
    if (seenBefore) {
      for (let i = 0; i < 3; i++) {
        const see = seenAt(sc.cam, sc.aspect, SLUICES[i][0].x, SLUICES[i][0].y, 40);
        const dir = this.gateDir[i];
        const epoch = this.gateEpoch[i];
        if (dir > 0 && gate[i] < 1) {
          const tau = sc.clock + (1 - gate[i]) * GATE.up;
          if (tau <= until && see.k >= 0.1) this.ahead('gate-up', `gu${i}.${epoch}`, tau, sc, (T) => gateSet(g, T, see.pan * 0.8, false), () => this.gateEpoch[i] === epoch);
        } else if (dir < 0 && gate[i] > 0) {
          const tau = sc.clock + gate[i] * GATE.down;
          if (tau <= until && see.k >= 0.1) this.ahead('gate-down', `gd${i}.${epoch}`, tau, sc, (T) => gateSet(g, T, see.pan * 0.8, true), () => this.gateEpoch[i] === epoch);
        }
        // The surge's head: the rings it throws on its way down the channel, and its meeting the pool below.
        const sg = sc.surge[i] ?? 0;
        if (sg > 0 && sg < 1) {
          const t0 = sc.clock - sg * GATE.surge;
          const se = this.surgeEpoch[i];
          const line = SLUICES[i];
          for (let k = 1; k <= GATE.rings; k++) {
            const tau = surgeRing(t0, k);
            if (tau <= from || tau > until) continue;
            const f = (k / GATE.rings) * (line.length - 1);
            const a = line[Math.min(line.length - 2, Math.floor(f))];
            const b = line[Math.min(line.length - 1, Math.floor(f) + 1)];
            const w = f - Math.floor(f);
            const at = place(seenAt(sc.cam, sc.aspect, a.x + (b.x - a.x) * w, a.y + (b.y - a.y) * w));
            if (at.k <= 0.03) continue;
            const last = k === GATE.rings;
            this.ahead(
              last ? 'surge' : 'ring',
              `sg${i}.${se}.${k}`,
              tau,
              sc,
              (T) => {
                if (last) g.water.burst(T, 22, 180, 2400, sat(1.6 * at.k + 0.2), at.pan, 0.25, 0.3, 0.9);
                else g.water.burst(T, 7, 420, 3200, sat(1.2 * at.k + 0.1), at.pan, 0.08, 0.07, 0.7);
              },
              () => this.surgeEpoch[i] === se && this.surges[i] > 0,
            );
          }
        }
      }
    }

    // The arrival: the theme whole, harmonised, each chord as the line of light passes its place.
    if (this.dawnClock >= 0) {
      for (let i = 0; i < ARRIVAL.length; i++) {
        const tau = this.dawnClock + arrivalTime(i);
        if (tau <= from || tau > until) continue;
        this.ahead('ray', `ar${i}`, tau, sc, (T) =>
          ARRIVAL[i].map((midi, n) =>
            // The theme on top, clear; what harmonises it under, softer, a little later and to the other side.
            bell(g, midi, T + (n ? 0.012 * n : 0), n ? 0.26 : 0.6 + 0.05 * i, n ? -0.3 + 0.2 * n : 0.4 - 0.16 * i, { bright: (n ? 0.5 : 0.95) - 0.4 * sc.night, long: i === ARRIVAL.length - 1 ? 5.2 : 3.6, send: 0.7 }),
          ),
        );
      }
    }
  }

  /** The moments this frame's state gives rise to that cannot be known ahead, each starting at `t`. */
  private moments(sc: Scene, m: Mix, t: number) {
    const g = this.g;
    const frameAt = this.times.frameAt;

    // The arrival: the bed swells with the sun's last lift, then lets go.
    if (this.dawnAt >= 0 && this.liftDone < 0 && sc.lift >= 1) this.liftDone = t;
    this.arrival = this.dawnAt >= 0 && sc.home ? arrivalOf(sc.lift, this.liftDone >= 0 ? t - this.liftDone : 0) : 0;

    this.score.advance(t, { move: sc.move, night: sc.night, bass: m.bass, calm: sc.calm });

    // The theme: air moves through and one bell marks it, as the two mixes cross.
    const night = sc.night > 0.5 ? 1 : 0;
    if (this.night >= 0 && night !== this.night) {
      whoosh(g, t, 0.9, night ? 2600 : 520, night ? 480 : 2800, 0.1, 0);
      bell(g, night ? 78 : 81, t + 0.05, 0.5, 0, { bright: night ? 0.3 : 0.9, long: 3.2, send: 0.7 });
      this.note('theme', frameAt, t);
    }
    this.night = night;

    // The ice. It breaks as the page begins to move, and then cracks as fast as it is melting.
    if (m.cracks > 0) {
      const begun = !this.melting;
      this.melting = true;
      this.crackAcc += m.cracks * sc.dt;
      if (begun && sc.melt < 0.14 && t - this.brokeAt > 20) {
        this.brokeAt = t;
        this.crackAcc = 0;
        this.crackNext = 0.5 + this.rng();
        this.breakIce(sc, t);
        this.note('crack', frameAt, t);
      } else if (begun || this.crackAcc >= this.crackNext) {
        this.crackAcc = 0;
        this.crackNext = -Math.log(1 - this.rng() * 0.98);
        const size = Math.pow(this.rng(), 1.6) * (0.55 + 0.45 * sat(m.cracks / 6));
        const floes = smooth(0.55, 0.85, sc.melt);
        const at = this.onLake(sc);
        if (this.rng() < 0.7 * floes) {
          // Late in the melt the sheet is floes: they knock, they do not sing.
          clink(g, t, 1700 + 2600 * this.rng(), 0.4 + 0.6 * size, (at.u - 0.5) * 1.8, 0.25 + 0.4 * sat(at.far / 3000));
        } else {
          iceCrack(g, t, crackVoice(at.u, at.far, size, sc.melt), 0.35 + 0.65 * sc.ice);
        }
        this.note('crack', frameAt, t);
      }
    } else {
      this.melting = false;
    }
    if (m.groans > 0) {
      this.groanAcc += m.groans * sc.dt;
      if (this.groanAcc >= this.groanNext) {
        this.groanAcc = 0;
        this.groanNext = 0.5 + this.rng();
        groan(g, t, this.rng() * 1.4 - 0.7, this.rng() < 0.6 ? 0.5 + 0.5 * this.rng() : 0);
        if (this.rng() < 0.5) iceCrack(g, t + 0.3 + 0.8 * this.rng(), crackVoice(this.rng(), 2500 + 3000 * this.rng(), 0.2 + 0.3 * this.rng(), 0), 0.5);
      }
    }

    // The letters' ponds run together into one: the water takes a breath.
    if (sc.home && !sc.calm) {
      // (Only as the melt passes that point: not on arriving somewhere it is long past.)
      if (this.meltWas >= 0 && this.meltWas < JOIN && sc.melt >= JOIN && sc.melt < JOIN + 0.08 && !this.joined) {
        this.joined = true;
        g.water.burst(t, 9, 170, 560, 0.9, 0, 0.3, 0.3, 0.9);
        drop(g, t + 0.02, hz(50), 0.45, 0, 900, 0.5);
        this.note('join', frameAt, t);
      } else if (this.joined && sc.melt < JOIN - 0.1) this.joined = false;
    }
    this.meltWas = sc.home ? sc.melt : -1;

    // The basin: every so often a wave slaps the block. Never at the same interval twice.
    const slab = heard(sc.slab);
    if (sc.home && !sc.calm && sc.basin > 0.2 && slab > 0.08) {
      this.slapAcc += sc.dt;
      if (this.slapAcc >= this.slapNext) {
        this.slapAcc = 0;
        this.slapNext = 1.5 + 3.4 * this.rng();
        const hard = 0.5 + 0.5 * this.rng();
        g.water.burst(t, Math.round(8 + 10 * hard), 230, 1500 + 600 * hard, sat((0.5 + 1.2 * slab) * hard), 0.6 * sc.slab.pan + 0.4 * (this.rng() - 0.5), 0.15, 0.1 + 0.08 * hard, 0.85);
        this.note('slap', frameAt, t);
      }
    }
  }

  /** A point of the lake in frame for a crack to open at: where across the frame it is, and how far off. */
  private onLake(sc: Scene): { u: number; far: number } {
    for (let n = 0; n < 3; n++) {
      const u = 0.04 + 0.92 * this.rng();
      const hit = sc.cam ? groundUnder(sc.cam, u, 0.5 + 0.48 * Math.pow(this.rng(), 0.7), sc.aspect) : null;
      if (hit && hit.y < LAKE.y1) return { u, far: hit.t };
    }
    return { u: 0.04 + 0.92 * this.rng(), far: 300 + 3200 * this.rng() };
  }

  /**
   * The sheet lets go. One great crack near the lens, a run of smaller ones
   * racing away from it across the lake, each further off and so longer in
   * its fall, the sheet's low body under them and the far shore's answer.
   */
  private breakIce(sc: Scene, t: number) {
    const g = this.g;
    const u0 = 0.34 + 0.32 * this.rng();
    const dir = this.rng() < 0.5 ? -1 : 1;
    iceCrack(g, t, crackVoice(u0, 260, 1, sc.melt), 0.82);
    const run = g.tier.lean ? 4 : 7;
    for (let k = 1; k <= run; k++) {
      const at = t + 0.05 * Math.pow(k, 1.4) * (0.85 + 0.3 * this.rng());
      iceCrack(g, at, crackVoice(Math.min(0.97, Math.max(0.03, u0 + dir * 0.09 * k)), 260 * Math.pow(1.6, k), 0.72 - 0.08 * k, sc.melt), 0.74 - 0.06 * k);
    }
    groan(g, t + 0.04, -dir * 0.3, 0.7);
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
        // (Not on the lake's ice and not on land: nothing is seen to happen there.)
        // (On an inner page the picture's own bed says whether the press fell on water.)
        if (c <= 0 || !sc || (sc.home && wetUnder(sc.cam, sc.aspect, a, b, sc.melt, sc.gate) < 0.4)) return;
        const v = dropVoice(a, c);
        // (A press that is also a press on a control keeps its tick in front.)
        const k = Math.abs(cause - this.tapAt) < 40 ? 0.4 : 1;
        drop(g, t, hz(v.midi), v.gain * k, v.pan, v.cut, v.send);
        // The water it throws up.
        g.water.burst(t + 0.02, 7, 520, 3400, 0.5 * v.gain * k, v.pan, 0.06, 0.14, 0.55);
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
        // The latch lets go and the chosen gate begins to lift. What follows is in the gates' own time (see the
        // clockwork): the knocks as each gate comes to rest, the surge's rings, and the rush, steered by the surge itself.
        const line = SLUICES[Math.min(2, Math.max(0, Math.round(a)))];
        gateLift(g, t, sc ? seenAt(sc.cam, sc.aspect, line[0].x, line[0].y, 40).pan * 0.8 : 0);
        this.note('switch', cause, t);
        return;
      }
      case 'drip': {
        // The picture says which column will drip and when, ahead of the drip: it is set for the frame that shows it.
        // (The picture drips whenever the columns are near; a drip is heard when its column is in frame.)
        const col = Math.min(3, Math.max(0, Math.round(a)));
        const see = sc ? seenAt(sc.cam, sc.aspect, COLS.xs[col], COLS.y, 0) : null;
        if (!sc || !see || see.k * sc.cols <= 0.1 || sc.calm) return;
        const v = dripVoice(b, see.pan);
        const lvl = sc.cols * see.k;
        this.ahead(
          'drip',
          `dr${c.toFixed(4)}`,
          c,
          sc,
          (T) => {
            g.water.burst(T + 0.012, 2, 1500, 4200, 0.3 * lvl, v.pan, 0.03, 0.03, 0.4);
            return drip(g, T, v.midi, v.gain * lvl, v.pan, v.send);
          },
          (s) => s.cols > 0.5,
        );
        return;
      }
      case 'dawn': {
        // The sun's edge clears the ranges: the piece resolves on the event itself.
        this.dawnAt = t;
        this.dawnClock = sc ? sc.clock : -1;
        this.liftDone = -1;
        this.score.arrive(t);
        bloom(g, t, 38, 0.9, 2.4);
        this.note('dawn', cause, t);
        return;
      }
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
