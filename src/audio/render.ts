/**
 * A scripted scene, rendered to samples through the same graph, the same
 * conductor and the same mapping the page uses. The checks call this
 * (scripts/audio-check.mjs); the page never loads it.
 *
 * A scene is a script of what the visitor does: where the scroll is over
 * time, where the pointer goes, what is pressed, when the theme turns.
 * From that this file plays the picture's part in the picture's own order
 * (the real camera path, the melt and the day; then the gates, the surge,
 * the drips and the dawn by the flight's own rules, from moments.ts) and
 * publishes it, sixty times a second, to the conductor.
 */

import { MELT, SETTLE_AT, basisOf, dayAt, flightKeys, poseAt, stillScroll } from '@/water/camera';
import { dawnLight, nextDrip, stationsNear, stepGates } from '@/water/moments';
import { ClockMap } from './clock';
import { FULL, LEAN, buildGraph } from './graph';
import type { Mix } from './mapping';
import { type Scene, SceneReader, type SignalsLike } from './scene';
import { type Phrase } from './score';
import { Sound, type SoundEvent } from './sound';
import { makeRng } from './theory';

export interface SceneSpec {
  seconds: number;
  /** false: an inner page, with no flight under it */
  home?: boolean;
  /** scroll: [seconds, screens], joined in straight lines and eased as the page's smooth scroll eases */
  scroll?: [number, number][];
  /** the theme: [seconds, 0 or 1] */
  night?: [number, number][];
  /** reduced motion */
  calm?: boolean;
  /** the pointer: [seconds, x, y, far]; far is 0 when it is not over water */
  pointer?: [number, number, number, number][];
  /** moments: [seconds, type, a, b, c] */
  events?: [number, string, number?, number?, number?][];
  /** sound turned on and off: [seconds, 1 or 0, fade seconds]. Default: on at 0 over two seconds. */
  power?: [number, number, number][];
  seed?: number;
  /** hear one bus alone (its reverb with it) */
  solo?: 'bed' | 'world' | 'fx' | 'ui';
  aspect?: number;
  /** the picture's clock at the start */
  clock0?: number;
  /** the phone's tier */
  lean?: boolean;
  /** a frame this long, in ms, at each of these seconds: the picture's clock is disturbed there */
  stalls?: [number, number][];
}

export interface Rendered {
  sampleRate: number;
  channels: Float32Array[];
  chords: { t: number; move: string; chord: string; notes: number[] }[];
  phrases: Phrase[];
  trace: SoundEvent[];
  /** the scene and the mix, four times a second */
  series: { t: number; scene: Partial<Scene>; mix: Partial<Mix>; water: number[] }[];
  /** whether the water model ran, and how often what was set ahead was taken back */
  water: boolean;
  disturbed: number;
}

const at = (keys: number[][], t: number, col = 1): number => {
  if (t <= keys[0][0]) return keys[0][col];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t <= keys[i + 1][0]) {
      const k = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0] || 1);
      return keys[i][col] + (keys[i + 1][col] - keys[i][col]) * k;
    }
  }
  return keys[keys.length - 1][col];
};
const step = (keys: number[][], t: number): number => {
  let v = keys[0][1];
  for (const k of keys) if (t >= k[0]) v = k[1];
  return v;
};

export async function renderScene(spec: SceneSpec, sampleRate = 48000): Promise<Rendered> {
  const ctx = new OfflineAudioContext(2, Math.round(spec.seconds * sampleRate), sampleRate);
  const graph = await buildGraph(ctx, makeRng(20261117), spec.lean ? LEAN : FULL);
  if (spec.solo) for (const [name, nodes] of Object.entries(graph.buses)) if (name !== spec.solo) nodes.forEach((n) => n.disconnect());
  const sound = new Sound(graph, spec.seed ?? 7);
  sound.trace = [];
  const reader = new SceneReader();
  const rng = makeRng((spec.seed ?? 7) + 31);
  const home = spec.home !== false;
  const aspect = spec.aspect ?? 1.6;
  const keys = flightKeys(aspect);
  const scroll = spec.scroll ?? [[0, 0]];
  const night = spec.night ?? [[0, 0]];
  const power = spec.power ?? [[0, 1, 2]];
  const events = (spec.events ?? []).slice().sort((a, b) => a[0] - b[0]);
  const stalls = (spec.stalls ?? []).slice().sort((a, b) => a[0] - b[0]);
  const calm = !!spec.calm;
  // The page's clock begins a second before the audio's, and the two then run together: no device, no latency.
  const map = ClockMap.fixed(1000);

  const sig: SignalsLike = { at: 0, s: 0, cam: null, aspect, melt: 0, day: 0, rest: false, clock: spec.clock0 ?? 0, clockAt: 0, st: [0, 0, 0, 0], gate: [1, 0, 0], surge: [0, 0, 0], ray: 0, lift: 0, px: 0.5, py: 0.5, far: 0, moved: -1e9, scrollY: 0, tribs: null };
  const gate = [1, 0, 0];
  const surge = [0, 0, 0];
  const colH = [1, 0.75, 0.2, 0.065];
  let clock = spec.clock0 ?? 0;
  let open = 0;
  let s = scroll[0][1];
  let dawnT = -1;
  let melted = false;
  let drip: { at: number; i: number } | null = null;
  let dripAt = 0;
  let ev = 0;
  let pw = 0;
  let st = 0;
  let last = -1;
  const series: Rendered['series'] = [];
  const fps = 60;
  const frames = Math.floor(spec.seconds * fps);
  for (let i = 0; i < frames; i++) {
    // (A stalled frame: the page did nothing for a while, and this frame is that much longer.)
    while (st < stalls.length && i / fps >= stalls[st][0]) {
      i += Math.round((stalls[st][1] / 1000) * fps);
      st++;
    }
    const t = i / fps;
    const now = 1000 + (i * 1000) / fps;
    const dt = last < 0 ? 1 / fps : (now - last) / 1000;
    last = now;
    while (pw < power.length && t >= power[pw][0]) {
      sound.setOn(power[pw][1] > 0, t, power[pw][2]);
      pw++;
    }
    // The page's smooth scroll eases toward where the wheel has put it.
    const target = at(scroll, t);
    s += (target - s) * (1 - Math.exp(-dt / 0.136));
    if (Math.abs(target - s) < 1e-5) s = target;
    let rest = false;
    let melt = 0;
    if (home) {
      // The flight's frame, first half: where the camera is, published before the draw.
      const sNow = calm ? stillScroll(s) : s;
      const pose = poseAt(keys, sNow);
      if (calm) pose.roll = 0;
      melt = (sNow - MELT.from) / (MELT.to - MELT.from);
      rest = sNow >= SETTLE_AT - 0.02;
      sig.at = now;
      sig.s = sNow;
      sig.cam = basisOf(pose);
      sig.melt = melt;
      sig.day = dayAt(sNow);
      sig.rest = rest;
    } else {
      sig.scrollY = s * 900;
    }
    if (spec.pointer) {
      const x = at(spec.pointer, t, 1);
      const y = at(spec.pointer, t, 2);
      if (x !== sig.px || y !== sig.py) sig.moved = now;
      sig.px = x;
      sig.py = y;
      sig.far = step(
        spec.pointer.map((k) => [k[0], k[3]]),
        t,
      );
    }
    // What a visitor did since the last frame, in its handlers.
    while (ev < events.length && t >= events[ev][0]) {
      const [, type, a = 0, b = 0, c = 0] = events[ev++];
      if (type === 'switch') open = Math.round(a);
      sound.fire(type, a, b, c, t, now);
    }
    // The sound's turn.
    const scene = reader.read(sig, now, { night: step(night, t), calm, viewW: 1440, viewH: 900 });
    const mix = sound.frame(scene, { now: t, frameAt: now, map });
    if (home && sig.cam) {
      // The flight's frame, second half: the picture's own clockwork, in the order the flight runs it.
      // (A scene that begins past the lake begins with its ice long gone: that is not a moment.)
      if (i === 0) melted = melt >= 1;
      if (melt >= 1 && !melted) {
        melted = true;
        sound.fire('melt', 1, 0, 0, t, now);
      } else if (melt < 0.9 && melted) melted = false;
      if (calm) {
        sig.lift = sig.ray = rest ? 1 : 0;
      } else {
        if (rest && dawnT < 0) {
          dawnT = clock;
          sound.fire('dawn', 0, 0, 0, t, now);
        }
        clock += Math.min(dt, 1 / 20);
        if (dawnT >= 0) ({ lift: sig.lift, ray: sig.ray } = dawnLight(clock - dawnT));
      }
      const near = stationsNear(sig.cam.pos);
      stepGates(gate, surge, open, Math.min(0.05, dt), calm);
      sig.clock = clock;
      sig.clockAt = now;
      sig.st = near;
      sig.gate = gate;
      sig.surge = surge;
      if (near[0] > 0.5 && !calm) {
        if (!drip) {
          drip = nextDrip(Math.max(clock, dripAt), colH, rng);
          sound.fire('drip', drip.i, colH[drip.i], drip.at, t, now);
        }
        if (clock >= drip.at) {
          dripAt = clock;
          drip = null;
        }
      } else drip = null;
    }
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4) || i === 0) {
      const { cam: _cam, gate: _g, surge: _s, falls: _f, arms: _a, ...rest0 } = scene;
      void _cam;
      void _g;
      void _s;
      void _f;
      void _a;
      const { water, shimmer: _sh, ...mix0 } = mix;
      void _sh;
      series.push({ t: +t.toFixed(2), scene: rest0, mix: mix0, water: water.map((v) => +v[0].toFixed(3)) });
    }
  }
  // (Everything the water was told has reached the audio thread before the render begins.)
  await graph.water.flush();
  const buf = await ctx.startRendering();
  return { sampleRate, channels: [buf.getChannelData(0), buf.getChannelData(1)], chords: sound.score.history, phrases: sound.score.phrases, trace: sound.trace ?? [], series, water: graph.water.live, disturbed: sound.disturbed };
}
