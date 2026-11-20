/**
 * The checks' side of the sound: the same graph and the same stepping as
 * the page (src/sound), run on an OfflineAudioContext through a scripted
 * visit, so what a visitor would hear comes out as a file to be measured.
 * Bundled and run in a headless page by render.mjs.
 */
import { position, scenes, starts } from '../../src/scene/flight/scenes';
import { build, FADE } from '../../src/sound/graph';
import { random } from '../../src/sound/mapping';
import { Place } from '../../src/sound/place';
import { BARE, SOUND, type SceneSound } from '../../src/sound/scenes';

const RATE = 48000;
const STEP = 0.15;
const sounds = scenes.map((s) => SOUND[s.id] ?? BARE);

type Where = { from: number; to: number; mix: number; progress: number; only?: SceneSound };
type Script = {
  seconds: number;
  /** Where the picture is at time t. */
  where(t: number): Where;
  /** Times the sound is turned on and off (the control, or the tab), in order: [time, on]. */
  power: [number, boolean][];
};

const at = (screens: number): Where => {
  const p = position(screens);
  return { from: p.index, to: Math.min(p.index + 1, scenes.length - 1), mix: p.mix, progress: p.progress };
};
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Every scene and every whiteout, at a reader's pace: 5.5 s in a scene, 1.8 s through the snow. */
function walk(): Script {
  const PUSH = 5.5,
    SNOW = 1.8,
    LEAD = 1;
  return {
    seconds: LEAD + scenes.length * PUSH + (scenes.length - 1) * SNOW + 2,
    where(t) {
      let u = t - LEAD;
      if (u <= 0) return at(0);
      for (let i = 0; i < scenes.length; i++) {
        if (u < PUSH) return at(starts[i] + (scenes[i].screens * u) / PUSH);
        u -= PUSH;
        if (i + 1 === scenes.length) break;
        if (u < SNOW) return at(starts[i] + scenes[i].screens + (scenes[i].exit * u) / SNOW);
        u -= SNOW;
      }
      return at(starts[scenes.length - 1] + scenes[scenes.length - 1].screens);
    },
    power: [[0.2, true]],
  };
}

/** The control pressed ten times on and ten times off, at a person's pace and faster than one, over the loudest scene. */
function toggle(): Script {
  const power: [number, boolean][] = [];
  let t = 0.3;
  for (const [on, off] of [[2.5, 1], [1.2, 0.6], [0.6, 0.3], [0.3, 0.15], [0.12, 0.08], [0.05, 0.05], [0.02, 0.4], [1, 0.02], [0.3, 0.3], [3, 1.5]]) {
    power.push([t, true]);
    t += on;
    power.push([t, false]);
    t += off;
  }
  return { seconds: t + 0.5, where: () => at(starts[1] + 1), power };
}

/**
 * The first scene to the last in one cut (the scene system's own jump: one
 * whiteout of 0.72 s), a wait, back up through the last whiteout by hand
 * and down again, then the cut home; and once a cut with no whiteout at
 * all, as a page without the canvas makes it.
 */
function jump(): Script {
  const last = scenes.length - 1;
  const leap = (t: number, t0: number, from: number, to: number): Where => ({ from, to, mix: Math.min(1, (t - t0) / 0.72), progress: 1 });
  const end = starts[last];
  return {
    seconds: 30,
    where(t) {
      if (t < 4) return at(1.2);
      if (t < 4.72) return leap(t, 4, 0, last);
      if (t < 9) return at(end + 0.4);
      // Up into the whiteout before the last scene, a pause in the thick of it, on up, and back down.
      if (t < 11) return at(end - 0.3 * ease((t - 9) / 2));
      if (t < 12.5) return at(end - 0.3);
      if (t < 14) return at(end - 0.3 - 0.3 * ease((t - 12.5) / 1.5));
      if (t < 17) return at(end - 0.6 + 1 * ease((t - 14) / 3));
      if (t < 20) return at(end + 0.4);
      if (t < 20.72) return leap(t, 20, last, 0);
      if (t < 24) return at(0.5);
      // No whiteout: the scene is simply another scene between two steps.
      if (t < 27) return { from: 5, to: 5, mix: 0, progress: 0.5 };
      return { from: 1, to: 1, mix: 0, progress: 0.5 };
    },
    power: [[0.2, true]],
  };
}

/** The tab hidden and shown: for a while, for a moment, and twice in a breath. */
function hidden(): Script {
  return {
    seconds: 20,
    where: () => at(starts[3] + 1),
    power: [[0.2, true], [5, false], [7, true], [11, false], [11.2, true], [14, false], [14.03, true], [14.06, false], [15, true]],
  };
}

/** Each thing the place is made of, alone, six seconds each: for setting their levels against one another. */
function parts(): Script {
  const none = { wind: 0, drift: 0, run: 0, fall: 0, lap: 0, ice: 0 };
  const each: SceneSound[] = [{ ...none, wind: 0.5 }, { ...none, drift: 0.5 }, { ...none, run: 0.5 }, { ...none, fall: 0.7 }, { ...none, lap: 0.5 }];
  return { seconds: each.length * 6, where: (t) => ({ from: 0, to: 0, mix: 0, progress: 0.5, only: each[Math.min(each.length - 1, Math.floor(t / 6))] }), power: [[0.1, true]] };
}

const SCRIPTS = { walk, toggle, jump, hidden, parts };

export async function render(kind: keyof typeof SCRIPTS, night: boolean, seed: number) {
  const script = SCRIPTS[kind]();
  const ctx = new OfflineAudioContext(2, Math.round(script.seconds * RATE), RATE);
  const rng = random(seed);
  const graph = await build(ctx, rng);
  const place = new Place(graph, rng);
  const timeline: (Where & { t: number })[] = [];
  const cracks: number[] = [];
  const crack = graph.crack;
  graph.crack = (t, ...rest) => {
    cracks.push(t);
    crack(t, ...rest);
  };
  // What happens when, in the order it happens: the page's steps and the presses between them.
  const events: [number, (() => void)][] = [];
  for (const [t, on] of script.power)
    events.push([
      t,
      () => {
        if (on) place.rest();
        graph.power(on, ctx.currentTime, on ? FADE.up : FADE.down);
      },
    ]);
  for (let t = 0; t < script.seconds - 0.01; t += STEP)
    events.push([
      t,
      () => {
        const w = script.where(t);
        timeline.push({ t, ...w });
        place.step(ctx.currentTime, w.only ?? sounds[w.from], w.only ?? sounds[w.to], w.mix, w.progress, night, false);
      },
    ]);
  events.sort((a, b) => a[0] - b[0]);
  // The context stops at each moment (to the nearest block of 128 frames) for what is due then.
  const due = new Map<number, (() => void)[]>();
  for (const [t, run] of events) {
    const frame = Math.ceil((t * RATE) / 128) * 128;
    due.set(frame, [...(due.get(frame) ?? []), run]);
  }
  for (const [frame, runs] of due) {
    if (frame === 0) runs.forEach((run) => run());
    else
      void ctx.suspend(frame / RATE).then(() => {
        runs.forEach((run) => run());
        void ctx.resume();
      });
  }
  const buffer = await ctx.startRendering();
  const l = buffer.getChannelData(0),
    r = buffer.getChannelData(1);
  const both = new Float32Array(l.length * 2);
  for (let i = 0; i < l.length; i++) {
    both[2 * i] = l[i];
    both[2 * i + 1] = r[i];
  }
  const bytes = new Uint8Array(both.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { rate: RATE, pcm: btoa(binary), timeline, cracks, scenes: scenes.map((s) => s.id) };
}
