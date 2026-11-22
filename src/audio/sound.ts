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
 * What a visitor causes (a press, the wake, the ice cracking and the name's
 * blocks going under as the page is scrolled, the switch's latch, a tick of
 * the rail) cannot be known ahead: it is asked for at once, and the page
 * gives the sound its turn before the picture draws.
 *
 * It keeps no clock of its own. On the page the time is the audio
 * context's; in the checks it is the frame's place in an offline render.
 * The same calls make the same sound in both.
 */

import { groundUnder, rayThrough } from '@/water/camera';
import { DAWN, GATE, LAP, PULSE } from '@/water/moments';
import { LAKE, LATTICE, SHARDS, SLAB, SLUICES } from '@/water/world';
import { ClockMap, LOOK, SLACK, frameFor, startAt } from './clock';
import { type Graph, LEVEL, bell, bloom, clink, drip, drop, gateLift, gateSet, groan, hush, iceCrack, pluck, shard, tick, whoosh } from './graph';
import {
  ARRIVE_AT,
  BLOCK_EARS,
  LIGHT,
  type Mix,
  NAME_NEAR,
  RING_DARK,
  SHEET_BREAKS,
  arrivalOf,
  arrivalTime,
  climbTime,
  climbVoice,
  crackVoice,
  dripVoice,
  dropVoice,
  gatherTime,
  gatherVoice,
  landings,
  latticeTime,
  latticeVoice,
  lightPan,
  lineTime,
  mixOf,
  nameLetters,
  nameMelt,
  place,
  railVoice,
  ringNear,
  ringVoice,
  shardVoice,
  sinkAt,
  sinkOrder,
  sinkVoice,
  surgeRing,
  uiVoice,
} from './mapping';
import { type Scene, heard, sat, seenAt, smooth, wetUnder } from './scene';
import { Score } from './score';
import { ARRIVAL, BEAT, CLIMB, GATHER, LATTICE_START, MOVE, type Rng, hz, makeRng } from './theory';

/** How loud each of the world's sounds is at its fullest, within the world bus. */
const TRIM = { wind: 0.3, whistle: 0.035, wake: 0.14, aurora: 0.0075 };

/** After the page has gone somewhere in one frame: how long the world is steered slowly into its new place, seconds. */
const SETTLE = 1.2;

/** How long after its moment a note of the arrival is still played, where the picture's frames come too far apart to set it ahead, seconds. */
const LATE = 0.4;

/** How long the dominant is held before a resolution that no light event prepares: two beats. */
const PREPARE = 2 * BEAT;

/** The mix's fade in and out: how many straight pieces its curve is laid in, and the curve (no speed at either end). */
const FADE_STEPS = 12;
const ease = (x: number) => x * x * (3 - 2 * x);

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
  private ringAcc = 0;
  private ringNext = 0.7;
  private ringLast = -1;
  private melting = false;
  private brokeAt = -1e9;
  private firstAt = -1e9;
  private meltWas = -1;
  private leftWas = -1;
  private letters: { aspect: number; at: { x: number; y: number }[]; order: number[] } | null = null;
  private jumpAt = -1e9;
  private dawnAt = -1;
  private dawnClock = -1;
  private dawnTop = 0.24;
  private riseDone = -1;
  private atRest = false;
  private restAt = -1;
  private resolvedAt = -1e9;
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
  private drips: { tau: number; x: number; y: number; h: number }[] = [];
  private keys = new Map<string, number>();
  private pc = { clock: 0, at: 0, ok: false };
  private frameMs = 1000 / 60;
  private slowFrames = 0;
  private roughUntil = 0;
  private hitches: number[] = [];
  private shows = 0;
  private lastFrameAt = 0;
  private times: Times = { now: 0, frameAt: 0, map: ClockMap.fixed(0) };
  private power = { t: 0, d: 1, from: 0, to: 0 };
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

  /**
   * Fade the whole mix in or out, over exactly `seconds`, from wherever it is at `t` (a fade may be turned round part
   * way). The level follows an eased curve laid as straight pieces, so it starts from rest, ends at rest and ends
   * exactly at silence or at full: nothing steps, so nothing clicks, and what rests the context after a fade out
   * rests it on true silence.
   */
  setOn(on: boolean, t: number, seconds: number) {
    const from = this.powerAt(t);
    const to = on ? 1 : 0;
    const p = this.g.on;
    p.cancelScheduledValues(t);
    p.setValueAtTime(from, t);
    const d = Math.max(0.02, seconds);
    for (let i = 1; i <= FADE_STEPS; i++) p.linearRampToValueAtTime(from + (to - from) * ease(i / FADE_STEPS), t + (d * i) / FADE_STEPS);
    this.power = { t, d, from, to };
  }

  /** Whether the mix is on, or on its way there. */
  get rising(): boolean {
    return this.power.to === 1;
  }

  /** Where the fade stands at `t`: the same straight pieces the audio thread is following. */
  powerAt(t: number): number {
    const { t: t0, d, from, to } = this.power;
    const x = Math.min(1, Math.max(0, (t - t0) / d)) * FADE_STEPS;
    const i = Math.min(FADE_STEPS - 1, Math.floor(x));
    const a = ease(i / FADE_STEPS);
    return from + (to - from) * (a + (ease((i + 1) / FADE_STEPS) - a) * (x - i));
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
    // (Set in the very frame that shows it: that frame is its cause.)
    this.pend.push({ key, tau, T, heads: made ? (Array.isArray(made) ? made : [made]) : [], ev: this.note(type, this.shows >= tau - SLACK ? this.times.frameAt : NaN, T, tau), ok });
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
    // (The page went somewhere in one frame: the world is brought round to the new place over a breath, not at once.)
    if (sc.jump) this.jumpAt = times.now;
    const m = mixOf(sc, times.now);
    this.steer(sc, m, times.now);
    this.clockwork(sc, times);
    this.moments(sc, m, times.now);
    return m;
  }

  /** The continuous part: every level, colour and place. */
  private steer(sc: Scene, m: Mix, t: number) {
    const g = this.g;
    // Reduced motion: the same places, reached slowly. And after a jump the new place is come to slowly too: the
    // world dips for a tenth of a second as the page goes, and comes back up where it has arrived.
    const since = t - this.jumpAt;
    const settling = since < SETTLE;
    const slow = sc.calm ? 5 : settling ? 4 : 1;
    this.scene = sc;
    const arrival = this.arrival;
    g.bed.to(m.bed * (1 + 0.4 * arrival), t, settling ? 4 : 1);
    g.padCut.to(m.bedCut * (1 + 0.35 * arrival), t, settling ? 4 : 1);
    g.air.to(m.air, t);
    g.world.to(LEVEL.world * (since < 0.12 ? 0.3 : 1), t, since < 0.12 ? 0.35 : 8);

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
    g.worldCut.to(m.worldCut, t, settling ? 4 : 1);
    g.rooms(m.rooms, t, settling ? 3 : 1);
    g.echo.to(m.echo, t, settling ? 4 : 1);
    g.fxEcho.to(0.7 * m.echo, t, settling ? 4 : 1);
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
      // Once is a hitch: the clock is taken up again from where it now is. Three times in a second is a picture that
      // cannot keep its beat (a slow device, a busy one): for a while nothing is set further ahead than the frame
      // being made, and the picture is followed frame by frame instead of being guessed at.
      this.hitches = this.hitches.filter((at) => times.frameAt - at < 1000);
      this.hitches.push(times.frameAt);
      if (this.hitches.length >= 3) this.roughUntil = times.frameAt + 1500;
    }
    pc.clock = sc.clock;
    pc.at = sc.clockAt;
    pc.ok = sc.home;

    // The clock this frame will draw, and the frames that show what was set.
    const shows = sc.clock + Math.min(0.05, Math.max(0, (times.frameAt - sc.clockAt) / 1000));
    this.shows = shows;
    for (const p of this.pend) {
      if (p.ev && Number.isNaN(p.ev.cause) && shows >= p.tau - SLACK) p.ev.cause = times.frameAt;
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
    const rough = times.frameAt < this.roughUntil;
    // (Rough: only as far ahead as the device's latency and a couple of frames, so a sound can still be heard on its frame.)
    const lag = Math.max(0, times.map.lag);
    const until = rough ? Math.max(shows, sc.clock + lag + 0.012 + (2 * this.frameMs) / 1000) : sc.clock + LOOK + lag + this.frameMs / 1000;
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

    // The columns' drips, each chosen by the picture ahead of its time.
    // (The picture drips whenever the columns are near; a drip is heard when its column is in frame.)
    this.drips = this.drips.filter((d) => d.tau > from - 0.2);
    for (const d of this.drips) {
      if (d.tau <= from || d.tau > until) continue;
      // (Where it lands, wide of its serac's foot: the picture says.)
      const see = seenAt(sc.cam, sc.aspect, d.x, d.y, 0);
      const lvl = sc.cols * see.k;
      if (lvl <= 0.1) continue;
      const v = dripVoice(d.h, see.pan);
      this.ahead(
        'drip',
        `dr${d.tau.toFixed(4)}`,
        d.tau,
        sc,
        (T) => {
          g.water.burst(T + 0.012, 2, 1500, 4200, 0.3 * lvl, v.pan, 0.03, 0.03, 0.4);
          return drip(g, T, v.midi, v.gain * lvl, v.pan, v.send);
        },
        (s) => s.cols > 0.5,
      );
    }

    // The basin's sea: each crest that lands on the block's weather face, on the picture's own clock. They come in
    // sets (a strong one is heard, a weak one is not), and a crest lands on one end of the face before the other.
    const slab = heard(sc.slab);
    if (sc.basin > 0.2 && slab > 0.08) {
      const c = Math.cos(SLAB.turn);
      const sn = Math.sin(SLAB.turn);
      BLOCK_EARS.forEach((ear, e) => {
        for (const l of landings(ear.along, from, until)) {
          if (l.hard < 0.14) continue;
          const at = seenAt(sc.cam, sc.aspect, SLAB.x + c * ear.x, SLAB.y - sn * ear.x, SLAB.lift);
          this.ahead(
            'slap',
            `sl${e}.${l.n}`,
            l.tau,
            sc,
            (T) => g.water.burst(T, Math.round(6 + 13 * l.hard), 230, 1500 + 700 * l.hard, sat((0.45 + 1.15 * slab) * (0.25 + 0.75 * l.hard)), 0.9 * at.pan, 0.14, 0.1 + 0.1 * l.hard, 0.85),
            (s) => s.basin > 0.15,
          );
        }
      });
    }

    // The arrival, on the light event's own clock. As the line of light runs out across the sea the theme gathers:
    // its first three notes, twice, the second time an octave up, each two soft bells that close on the line as it
    // narrows toward the far shore, softer and further into the place the further it has gone, with the air moving
    // out under them. Where the line ends the ribbon leaves the water: there the theme is stated whole, harmonised,
    // from the ribbon's first light to the end of its rise, and over it the ladder climbs with the ribbon's head, a
    // rung for each sixth of the way to the top of the frame, the last as it leaves it.
    // (These are the piece's one arrival: where the picture cannot keep time and a frame comes later than the look
    // ahead reaches, a note whose moment has just gone by is still played, at once, and not left out of the theme.)
    if (this.dawnClock >= 0 && sc.clock < this.dawnClock + DAWN.over + 1) {
      const d0 = this.dawnClock;
      const tan = sc.cam.tan;
      const since = from - LATE;
      const tau0 = d0 + lineTime(0.01);
      if (tau0 > from && tau0 <= until) {
        this.ahead('air', 'air', tau0, sc, (T) => whoosh(g, T, lineTime(1) - lineTime(0.01), 420, 2500, 0.05, lightPan(LIGHT.foot * 0.5, sc.aspect, tan)));
      }
      for (let i = 0; i < GATHER.length; i++) {
        const tau = d0 + gatherTime(i);
        if (tau <= since || tau > until) continue;
        const v = gatherVoice(i, sc.aspect, tan, sc.night);
        this.ahead('gather', `ga${i}`, tau, sc, (T) => [-1, 1].map((side) => bell(g, v.midi, T + (side > 0 ? 0.009 : 0), 0.5 * v.gain, v.pan + side * v.width, { bright: v.bright, long: v.long, send: v.send })));
      }
      for (let i = 0; i < ARRIVAL.length; i++) {
        const tau = d0 + arrivalTime(i);
        if (tau <= since || tau > until) continue;
        const last = i === ARRIVAL.length - 1;
        const pan = lightPan(LIGHT.base, sc.aspect, tan);
        this.ahead('arrival', `ar${i}`, tau, sc, (T) => {
          const heads = ARRIVAL[i].map((midi, n) =>
            // The theme on top, clear, where the ribbon stands; what harmonises it under, softer, a little later and to either side.
            bell(g, midi, T + (n ? 0.012 * n : 0), n ? 0.26 : 0.62 + 0.04 * i, n ? pan + (n % 2 ? -0.42 : 0.3) * (1 + 0.25 * n) : pan, { bright: (n ? 0.5 : 0.95) - 0.4 * sc.night, long: last ? 5.6 : 3.4, send: 0.7 }),
          );
          // (The ribbon's first light is the arrival itself: the low swell under it.)
          if (i === 0) heads.push(bloom(g, T, 38, 0.9, 2.4));
          return heads;
        });
      }
      for (let j = 0; j < CLIMB.length; j++) {
        const tau = d0 + climbTime(j, this.dawnTop);
        if (tau <= since || tau > until) continue;
        const v = climbVoice(j, this.dawnTop, sc.aspect, tan, sc.night);
        this.ahead('climb', `cl${j}`, tau, sc, (T) => bell(g, v.midi, T, v.gain, v.pan, { bright: v.bright, long: v.long, send: v.send }));
      }
    }
  }

  /** The moments this frame's state gives rise to that cannot be known ahead, each starting at `t`. */
  private moments(sc: Scene, m: Mix, t: number) {
    const g = this.g;
    const frameAt = this.times.frameAt;

    // The arrival: the bed leans in as the sun lifts, swells as the ribbon climbs, and lets go once it stands.
    if (this.dawnAt >= 0 && this.riseDone < 0 && sc.rise >= 1) this.riseDone = t;
    this.arrival = this.dawnAt >= 0 && sc.home ? arrivalOf(sc.lift, sc.rise, this.riseDone >= 0 ? t - this.riseDone : 0) : 0;

    // The harmony at the ending. While the light event runs the camera at rest still waits on the dominant (through
    // the sun's lift and the line's run out), and the tonic comes as the ribbon leaves the water, on the event's clock.
    let move = sc.move;
    const event = this.dawnClock >= 0 && sc.clock < this.dawnClock + DAWN.over + 1;
    if (sc.home && sc.rest && this.dawnClock >= 0 && (move === MOVE.rest || move === MOVE.approach)) move = sc.clock >= this.dawnClock + ARRIVE_AT - 0.03 ? MOVE.rest : MOVE.approach;

    // Where no light event runs (motion is reduced, or the sun is already up from an earlier visit to the ending)
    // the ribbon simply stands: the resolution, and one soft saying of the theme's last note with its chord. No
    // sweep. The tonic is still arrived at: if the piece was not on its dominant when the camera came to rest (a
    // still flight goes from one composed frame to the next; a tick of the rail goes straight there), it takes the
    // dominant first, for two beats.
    if (!sc.home || !sc.rest) {
      this.atRest = false;
      this.restAt = -1;
    } else if (!event && move === MOVE.rest) {
      if (this.restAt < 0) this.restAt = this.score.movement === MOVE.approach || this.score.movement === MOVE.rest ? t - PREPARE - 1 : t;
      if (t - this.restAt < PREPARE) move = MOVE.approach;
      else if (!this.atRest) {
        this.atRest = true;
        if (t - this.resolvedAt > 12) {
          this.resolvedAt = t;
          const pan = sc.cam ? lightPan(LIGHT.base, sc.aspect, sc.cam.tan) : 0;
          ARRIVAL[ARRIVAL.length - 1].forEach((midi, n) => bell(g, midi, t + 0.9 + 0.014 * n, n ? 0.16 : 0.36, n ? pan + (n % 2 ? -0.4 : 0.3) : pan, { bright: (n ? 0.4 : 0.7) - 0.3 * sc.night, long: 5.2, send: 0.75 }));
          this.note('resolve', frameAt, t + 0.9);
        }
      }
    }
    this.score.advance(t, { move, night: sc.night, bass: m.bass, calm: sc.calm });

    // The theme: air moves through and one bell marks it, as the two mixes cross.
    const night = sc.night > 0.5 ? 1 : 0;
    if (this.night >= 0 && night !== this.night) {
      // (Reduced motion: the bell marks the turn; the sweep of air is left out.)
      if (!sc.calm) whoosh(g, t, 0.9, night ? 2600 : 520, night ? 480 : 2800, 0.1, 0);
      bell(g, night ? 78 : 81, t + 0.05, 0.5, 0, { bright: night ? 0.3 : 0.9, long: 3.2, send: 0.7 });
      this.note('theme', frameAt, t);
    }
    this.night = night;

    // The ice, in the order the picture melts it. First the ice under the name's blocks takes the meltwater at
    // their feet: small cracks, near, where the letters stand. Then, as leads open across the sheet, larger ones out
    // on the lake. When the last block has gone under and the sheet lets go in plates, the one great crack and the
    // run that races away from it. After that the plates are floes: they knock, they do not sing.
    const settled = t - this.jumpAt > 0.4;
    if (m.cracks > 0 && settled) {
      const begun = !this.melting;
      this.melting = true;
      this.crackAcc += m.cracks * sc.dt;
      const out = smooth(0.12, 0.44, sc.melt);
      if (begun && sc.melt < 0.14 && t - this.firstAt > 20) {
        this.firstAt = t;
        this.crackAcc = 0;
        this.crackNext = 0.5 + this.rng();
        this.firstCracks(sc, t);
        this.note('crack', frameAt, t);
      } else if (begun || this.crackAcc >= this.crackNext) {
        this.crackAcc = 0;
        this.crackNext = -Math.log(1 - this.rng() * 0.98);
        // (A crack is as large as the leads have grown: hairlines under the letters at first, the sheet's own later.)
        const size = Math.pow(this.rng(), 1.6) * (0.55 + 0.45 * sat(m.cracks / 6)) * (0.42 + 0.58 * smooth(0.12, 0.55, sc.melt));
        const floes = smooth(0.6, 0.85, sc.melt);
        const at = this.rng() < 1 - out ? this.underName(sc) : this.onLake(sc);
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

    // The ring: one of its lit stones rings, faintly, now and then, from where it stands; never the same stone twice
    // running, never the dark one. (It is the place's own stillness, not a thing the page's motion drives: it is
    // there with motion reduced too.)
    if (m.rings > 0 && settled && sc.stones.length) {
      this.ringAcc += m.rings * sc.dt;
      if (this.ringAcc >= this.ringNext) {
        this.ringAcc = 0;
        this.ringNext = 0.55 + 0.9 * this.rng();
        let i = Math.floor(this.rng() * sc.stones.length) % sc.stones.length;
        while (i === RING_DARK || i === this.ringLast) i = (i + 1) % sc.stones.length;
        this.ringLast = i;
        const see = sc.stones[i];
        if (see.k > 0.05) {
          const v = ringVoice(i, see.pan, sc.night);
          bell(g, v.midi, t, v.gain * ringNear(sc) * (0.6 + 0.4 * see.k), v.pan, { bright: v.bright, long: v.long, send: v.send, bus: g.fx });
          this.note('stone', frameAt, t);
        }
      }
    }

    // The name's blocks: the last of each goes under, a small low drop where its letter stood. The picture lets
    // them all go across one stretch of the melt; each has its turn in it. Only as the melt passes that stretch
    // going down the page: not on the way back up, and not on arriving somewhere it is long past.
    const left = sc.home ? nameMelt(sc.melt).left : -1;
    if (sc.home && !sc.calm && settled && this.leftWas >= 0 && left < this.leftWas && sc.name.k > 0.05) {
      const L = this.lettersFor(sc.aspect);
      const n = L.at.length;
      let k = 0;
      L.order.forEach((letter, turn) => {
        const at = sinkAt(turn, n);
        if (at < left || at >= this.leftWas) return;
        const see = seenAt(sc.cam, sc.aspect, L.at[letter].x, L.at[letter].y);
        const v = sinkVoice(turn, n, see.pan);
        // (Several in one frame, under a fast page, still go one after another.)
        const T = t + 0.05 * k;
        drop(g, T, hz(v.midi), v.gain, v.pan, v.cut, v.send);
        g.water.burst(T + 0.03, 4, 300, 1500, 0.4, v.pan, 0.06, 0.16, 0.75);
        // (Only the first of a frame starts on that frame: the rest are held back on purpose, and are noted as such.)
        this.note(k++ ? 'letter+' : 'letter', frameAt, T);
      });
    }
    this.leftWas = left;

    // The sheet lets go: as the melt passes the point where the last block has gone, going down the page.
    if (sc.home && !sc.calm && settled && this.meltWas >= 0 && this.meltWas < SHEET_BREAKS && sc.melt >= SHEET_BREAKS && sc.melt < SHEET_BREAKS + 0.1 && t - this.brokeAt > 20) {
      this.brokeAt = t;
      this.breakIce(sc, t);
      this.note('break', frameAt, t);
    }
    this.meltWas = sc.home ? sc.melt : -1;
  }

  /** The letters of the name as this frame's shape lays them, and the order they go under in. */
  private lettersFor(aspect: number) {
    if (!this.letters || Math.abs(this.letters.aspect - aspect) > 0.004) {
      const at = nameLetters(aspect);
      this.letters = { aspect, at, order: sinkOrder(at.length) };
    }
    return this.letters;
  }

  /** A place under the name for a crack to open at: where across the frame it is, and how near it is heard. */
  private underName(sc: Scene): { u: number; far: number } {
    const L = this.lettersFor(sc.aspect);
    const at = L.at[Math.floor(this.rng() * L.at.length) % L.at.length];
    const see = seenAt(sc.cam, sc.aspect, at.x + 60 * (this.rng() - 0.5), at.y - 40 * this.rng());
    if (see.k <= 0.05) return this.onLake(sc);
    return { u: (see.pan + 1) / 2, far: see.far * NAME_NEAR };
  }

  /**
   * The first of the melt: the ice under the name's blocks takes water. A
   * handful of small cracks at the letters' feet, one after another along the
   * name, each a short bright ping, and the sheet settling under them.
   */
  private firstCracks(sc: Scene, t: number) {
    const g = this.g;
    const L = this.lettersFor(sc.aspect);
    const n = L.at.length;
    const dir = this.rng() < 0.5 ? -1 : 1;
    const start = Math.floor(this.rng() * n);
    const run = g.tier.lean ? 3 : 5;
    let at = t;
    let pan = 0;
    for (let k = 0; k < run; k++) {
      const letter = L.at[(((start + dir * k * 2) % n) + n) % n];
      const see = seenAt(sc.cam, sc.aspect, letter.x, letter.y - 30);
      const u = see.k > 0.05 ? (see.pan + 1) / 2 : 0.2 + 0.6 * this.rng();
      const far = see.k > 0.05 ? see.far * NAME_NEAR : 420;
      if (k === 0) pan = u * 2 - 1;
      iceCrack(g, at, crackVoice(u, far * (0.8 + 0.5 * this.rng()), k === 0 ? 0.52 : 0.2 + 0.25 * this.rng(), sc.melt), k === 0 ? 0.8 : 0.62);
      at += 0.07 + 0.13 * this.rng() + 0.03 * k;
    }
    groan(g, t + 0.05, -0.5 * pan, 0);
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
   * The sheet lets go, in plates. One great crack near the lens, a run of
   * smaller ones racing away from it across the lake, each further off and
   * so longer in its fall, the sheet's low body under them and the far
   * shore's answer.
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
  fire(type: string, a: number, b: number, c: number, t: number, cause: number, d = 0) {
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
        // (A tick of the rail is tuned to its section, `b` of `c`: the rail plays down the flight.)
        const v = c > 0 ? railVoice(type, b, c, a) : uiVoice(type, a);
        tick(g, t, v.midi, v.gain, v.pan, v.cut, v.send, type === 'tap');
        if (type === 'tap') this.tapAt = cause;
        this.note(type, cause, t);
        return;
      }
      case 'jump':
        // A tick of the rail takes the page to another part of the flight: a route within it. The smallest sound
        // for that is air, moving the way the page goes (down the flight it falls, up it rises), under which the
        // world is brought round to the new place.
        this.jumpAt = t;
        // (Reduced motion: the world is still brought round, with no sweep of air over it.)
        if (!sc?.calm) whoosh(g, t, 0.5, a >= 0 ? 1500 : 620, a >= 0 ? 620 : 1500, 0.055, 0);
        this.note('jump', cause, t);
        return;
      case 'switch': {
        // The latch lets go and the chosen gate begins to lift. What follows is in the gates' own time (see the
        // clockwork): the knocks as each gate comes to rest, the surge's rings, and the rush, steered by the surge itself.
        const line = SLUICES[Math.min(2, Math.max(0, Math.round(a)))];
        gateLift(g, t, sc ? seenAt(sc.cam, sc.aspect, line[0].x, line[0].y, 40).pan * 0.8 : 0);
        this.note('switch', cause, t);
        return;
      }
      case 'drip':
        // The picture says where a drip will land, when, and how tall its column is, ahead of the drip: it is kept, and set with the rest of the clockwork.
        if (this.drips.length < 16) this.drips.push({ tau: c, x: a, y: b, h: d });
        return;
      case 'dawn': {
        // The camera has come to rest and the sun's edge begins to clear the ranges: the light event's clock starts
        // here. One low bell on the dominant marks it; the harmony holds where it is until the ribbon leaves the
        // water (see the clockwork: every note of what follows is set from this clock).
        this.dawnAt = t;
        this.dawnClock = sc ? sc.clock : -1;
        this.riseDone = -1;
        this.atRest = true;
        // (How high the top of the frame stands over the horizon where the ribbon climbs: the ladder's last rung is there.)
        if (sc?.cam) {
          const d = rayThrough(sc.cam, 0.5 + lightPan(0.24, sc.aspect, sc.cam.tan) / 2, 0, sc.aspect);
          this.dawnTop = Math.min(0.3, Math.max(0.12, d[2] / Math.hypot(d[0], d[1])));
        }
        this.score.hold(t, t + ARRIVE_AT + 0.5);
        bell(g, 57, t, 0.34, 0, { bright: 0.3 - 0.15 * (sc?.night ?? 0), long: 4.2, send: 0.8 });
        this.note('dawn', cause, t);
        return;
      }
      case 'melt':
        if (a < 1) return;
        // (Not when the page has just gone there in one frame: nothing was seen to melt.)
        if (t - this.jumpAt < 0.6) return;
        // The last of the ice has gone.
        // (Reduced motion: the bell alone, without the swell under it.)
        if (!sc?.calm) bloom(g, t, 50, 0.55, 1.5);
        bell(g, 86, t + 0.08, 0.5, 0, { bright: 0.8, long: 3.4, send: 0.7 });
        this.note('melt', cause, t);
        return;
      case 'route':
        if (sc?.calm) return;
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
