/**
 * A scripted scene, rendered to samples through the same graph, the same
 * conductor and the same mapping the page uses. The checks call this
 * (scripts/audio-check.mjs); the page never loads it.
 *
 * A scene is a script of what the visitor does: where the scroll is over
 * time, where the pointer goes, what is pressed, when the theme turns.
 * From that this file plays the picture's part exactly as the flight does
 * (the real camera path, the melt, the day, the stations, the gates' and
 * the dawn's own clocks) and publishes it, sixty times a second, to the
 * conductor.
 */

import { MELT, SETTLE_AT, basisOf, dayAt, flightKeys, poseAt, stillScroll } from '@/water/camera';
import { CANYON, COLS, DAM, LATTICE } from '@/water/world';
import { buildGraph } from './graph';
import type { Mix } from './mapping';
import { type Scene, SceneReader, type SignalsLike, smooth } from './scene';
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
}

export interface Rendered {
  sampleRate: number;
  channels: Float32Array[];
  chords: { t: number; move: string; chord: string; notes: number[] }[];
  trace: SoundEvent[];
  /** the scene and the mix, four times a second */
  series: { t: number; scene: Partial<Scene>; mix: Mix }[];
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
  const graph = await buildGraph(ctx, makeRng(20261117));
  if (spec.solo) for (const [name, node] of Object.entries(graph.buses)) if (name !== spec.solo) node.disconnect();
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
  const calm = !!spec.calm;
  const near = (pos: number[], x: number, y: number, a: number, b: number) => 1 - smooth(a, b, Math.hypot(pos[0] - x, pos[1] - y));

  const sig: SignalsLike = { at: 0, s: 0, cam: null, aspect, melt: 0, day: 0, rest: false, clock: spec.clock0 ?? 0, st: [0, 0, 0, 0], gate: [1, 0, 0], surge: [0, 0, 0], ray: 0, lift: 0, px: 0.5, py: 0.5, far: 0, moved: -1e9, scrollY: 0 };
  const gate = [1, 0, 0];
  const surge = [0, 0, 0];
  let open = 0;
  let s = scroll[0][1];
  let dawnT = -1;
  let melted = false;
  let dripAt = 0;
  let ev = 0;
  let pw = 0;
  const series: Rendered['series'] = [];
  const fps = 60;
  const frames = Math.floor(spec.seconds * fps);
  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    const now = 1000 + (i * 1000) / fps;
    const dt = 1 / fps;
    while (pw < power.length && t >= power[pw][0]) {
      sound.setOn(power[pw][1] > 0, t, power[pw][2]);
      pw++;
    }
    // The page's smooth scroll eases toward where the wheel has put it.
    const target = at(scroll, t);
    s += (target - s) * (1 - Math.exp(-dt / 0.136));
    if (Math.abs(target - s) < 1e-5) s = target;
    if (home) {
      const sNow = calm ? stillScroll(s) : s;
      const pose = poseAt(keys, sNow);
      if (calm) pose.roll = 0;
      const cam = basisOf(pose);
      const melt = (sNow - MELT.from) / (MELT.to - MELT.from);
      const rest = sNow >= SETTLE_AT - 0.02;
      if (!calm) sig.clock += dt;
      // The stations' nearness, the gates and the surge, the drips and the dawn: each as the flight runs it.
      const p = cam.pos;
      const st = [near(p, 1340, COLS.y, 1750, 2350), near(p, 1300, DAM.y, 2300, 2900), near(p, LATTICE.x, LATTICE.y, 2300, 2900), near(p, 1700, (CANYON.y0 + CANYON.y1) / 2, 3700, 4600)];
      for (let k = 0; k < 3; k++) {
        const on = k === open;
        gate[k] = calm ? (on ? 1 : 0) : Math.min(1, Math.max(0, gate[k] + (on ? dt / 0.45 : -dt / 0.6)));
        if (!on) surge[k] = 0;
        else if (calm) surge[k] = 1;
        else if (surge[k] < 1) surge[k] = Math.min(1, surge[k] + dt / 1.15);
      }
      if (st[0] > 0.5 && !calm && sig.clock > dripAt) {
        dripAt = sig.clock + 0.22 + 0.3 * rng();
        const h = [1, 0.75, 0.2, 0.065];
        let pick = rng() * (h[0] + h[1] + h[2] + h[3]);
        let c = 0;
        while (c < 3 && pick > h[c]) pick -= h[c++];
        sound.fire('drip', c, h[c], 0, t, now);
      }
      if (calm) {
        sig.lift = sig.ray = rest ? 1 : 0;
      } else {
        if (rest && dawnT < 0) {
          dawnT = t;
          sound.fire('dawn', 0, 0, 0, t, now);
        }
        if (dawnT >= 0) {
          sig.lift = smooth(0, 2.6, t - dawnT);
          sig.ray = smooth(0.7, 2.9, t - dawnT);
        }
      }
      if (melt >= 1 && !melted) {
        melted = true;
        sound.fire('melt', 1, 0, 0, t, now);
      } else if (melt < 0.9 && melted) melted = false;
      sig.at = now;
      sig.s = sNow;
      sig.cam = cam;
      sig.melt = melt;
      sig.day = dayAt(sNow);
      sig.rest = rest;
      sig.st = st;
      sig.gate = gate;
      sig.surge = surge;
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
    while (ev < events.length && t >= events[ev][0]) {
      const [, type, a = 0, b = 0, c = 0] = events[ev++];
      if (type === 'switch') open = Math.round(a);
      sound.fire(type, a, b, c, t, now);
    }
    sound.frameAt = now;
    const scene = reader.read(sig, now, { night: step(night, t), calm, viewW: 1440, viewH: 900 });
    const mix = sound.frame(scene, t);
    if (i % 15 === 0) {
      const { cam: _cam, gate: _g, surge: _s, ...rest } = scene;
      void _cam;
      void _g;
      void _s;
      series.push({ t: +t.toFixed(2), scene: rest, mix });
    }
  }
  const buf = await ctx.startRendering();
  return { sampleRate, channels: [buf.getChannelData(0), buf.getChannelData(1)], chords: sound.score.history, trace: sound.trace ?? [], series };
}
