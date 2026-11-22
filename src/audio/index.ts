/**
 * Sound on the page. This module, and everything it imports, is fetched by
 * the control (SoundToggle.tsx) once the home page has painted and the
 * thread is idle, or at the press that turns sound on for a reader who had
 * muted it; never in a page's first load and never on an inner page.
 *
 * On the home page it takes its turn inside the flight's frame, as soon as
 * that frame's state is known and before the picture is drawn, so a long
 * draw never holds a sound back; on other pages it has a turn of its own
 * in the one frame loop. Each turn it reads what the picture published,
 * steers the sound to it, and sets ahead whatever the picture's own clock
 * will do in the next quarter of a second (see sound.ts and clock.ts).
 * Moments a visitor causes are handed over the instant they are published.
 */

import { onFrame } from '@/lib/frame';
import { listen, onFlightFrame, signals } from '@/lib/signals';
import { ClockMap } from './clock';
import { FULL, LEAN, type Tier, buildGraph } from './graph';
import { type Env, SceneReader } from './scene';
import { Sound } from './sound';
import { makeRng } from './theory';
import { waterKernel } from './water';

declare global {
  interface Window {
    /** For the checks: the context, the conductor, the clocks' map, the tier and how it was chosen, and what the picture last published. */
    __sound?: { ctx: AudioContext; sound: Sound; map: ClockMap; tier: Tier; cost: Cost; signals: typeof signals; lead: () => number };
  }
}

/**
 * How far past the render head a sound asked for at once is set, so it
 * starts on the sample it was asked for with its attack whole. The head is
 * read from the clocks' map, not from one reading of the context's clock
 * (which may be a device buffer stale), so this need only cover the hop to
 * the audio thread. That hop is measured, twice a second: the water's
 * worklet is sent a word and sends it back with the audio thread's own time
 * (on a quiet machine a millisecond or two; on a loaded one ten or more).
 * The lead is the longest hop of the last few seconds and what new nodes
 * need on top of it, kept between these two.
 */
const LEAD_MIN = 0.009;
const LEAD_MAX = 0.018;
/** What it takes, over and above a word's hop, for new nodes to be taken up by the audio thread (measured: with a lead of the hop and 3 ms, sounds began 4 to 5 ms after they were asked for). */
const TAKE_UP = 0.006;

/** What counts as a control: its hover and its press are heard. */
const CONTROL = 'a[href], button, [role="radio"], [role="button"], summary, select, input';

interface Running {
  ctx: AudioContext;
  sound: Sound;
}

export interface Cost {
  /** ms this device took to make a fifth of a second of busy water in the page's own thread */
  water: number;
  /** ms it took to render a second of a small graph of oscillators, filters and a room, off the page's thread */
  graph: number;
  /** a phone: a coarse pointer and a small screen */
  phone: boolean;
  /** asked for by name (the checks do) */
  forced: string | null;
  /** once running: what the sound's turn in a frame takes, ms, on average and at worst */
  turn?: number;
  turnMax?: number;
}

/** Measure what sound will cost here, before any of it is built. Two short renders; neither holds a frame. */
async function measure(): Promise<Cost> {
  let forced: string | null = null;
  try {
    forced = new URLSearchParams(location.search).get('soundtier') ?? localStorage.getItem('sound-tier');
  } catch {
    /* no storage: measured */
  }
  const phone = window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 600;
  // The water model itself, as the worklet will run it: a stream and a fall, a fifth of a second of them.
  const k = waterKernel()(48000, 72, 7, 20);
  k.set(0, [1, 220, 400, 5200, 0.7, 1, 0, 0.7, 0.3, 250, 3200]);
  k.set(1, [1, 430, 240, 4600, 0.95, 1, 0, 0.25, 0.85, 300, 4200]);
  const L = new Float32Array(128);
  const R = new Float32Array(128);
  const t0 = performance.now();
  for (let i = 0; i < 75; i++) k.render(L, R, 128);
  const water = performance.now() - t0;
  await new Promise<void>((r) => setTimeout(r, 0));
  // And a second of ordinary nodes.
  let graph = 0;
  try {
    const off = new OfflineAudioContext(2, 48000, 48000);
    const room = off.createConvolver();
    const imp = off.createBuffer(2, 24000, 48000);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < d.length; i += 7) d[i] = ((i * 2654435761) % 1000) / 1e6;
    }
    room.buffer = imp;
    room.connect(off.destination);
    for (let i = 0; i < 24; i++) {
      const o = off.createOscillator();
      o.frequency.value = 110 * (i + 1);
      const f = off.createBiquadFilter();
      f.frequency.value = 2000;
      const g = off.createGain();
      g.gain.value = 0.01;
      o.connect(f).connect(g).connect(room);
      o.start();
    }
    const t1 = performance.now();
    await off.startRendering();
    graph = performance.now() - t1;
  } catch {
    graph = 0;
  }
  return { water: +water.toFixed(2), graph: +graph.toFixed(1), phone, forced };
}

/**
 * The lean tier is for a device that would otherwise be working hard:
 * a phone that is not a fast one, or anything slow. (A fast desktop makes
 * the fifth of a second of water in about a millisecond and the second of
 * nodes in a few.)
 */
export function tierFor(c: Cost): Tier {
  if (c.forced === 'lean') return LEAN;
  if (c.forced === 'full') return FULL;
  const slow = c.water > 9 || c.graph > 90;
  const modest = c.water > 3 || c.graph > 35;
  return slow || (c.phone && modest) ? LEAN : FULL;
}

let run: Running | null = null;
let building: Promise<Running | null> | null = null;
let wanted = false;
let sleep = 0;
let begun = false;

async function build(ctx: AudioContext): Promise<Running | null> {
  const cost = await measure();
  const tier = tierFor(cost);
  const graph = await buildGraph(ctx, makeRng(20261117), tier);
  const sound = new Sound(graph, (Date.now() & 0xffff) + 1);
  const map = new ClockMap();
  const html = document.documentElement;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const env: Env = { night: html.dataset.theme === 'dark' ? 1 : 0, calm: mq.matches, viewW: window.innerWidth, viewH: window.innerHeight };
  const reader = new SceneReader();
  const live = () => wanted && ctx.state === 'running';

  // The two clocks, read together: every frame and at every moment.
  const stamp = typeof ctx.getOutputTimestamp === 'function';
  let lead = 0.01;
  const read = () => {
    const perf = performance.now();
    map.feed({ perf, audio: ctx.currentTime, out: stamp ? ctx.getOutputTimestamp() : null, latency: (ctx.baseLatency || 0) + (ctx.outputLatency || 0) });
    // (Nothing is asked for before the render head, wherever one reading of the clock puts it.)
    return Math.max(ctx.currentTime, map.headAt(perf)) + lead;
  };
  // The hop to the audio thread, measured.
  const hops: number[] = [];
  let asked = 0;
  const hop = () => {
    if (!graph.water.live || !live() || !map.ready) return;
    const sent = map.headAt(performance.now());
    void graph.water.flush().then((got) => {
      if (!Number.isFinite(got)) return;
      hops.push(Math.max(0, got - sent));
      if (hops.length > 10) hops.shift();
      lead = Math.min(LEAD_MAX, Math.max(LEAD_MIN, Math.max(...hops) + TAKE_UP));
    });
  };

  mq.addEventListener('change', () => {
    env.calm = mq.matches;
    sound.cancelAhead(read());
  });
  window.addEventListener('themechange', () => (env.night = html.dataset.theme === 'dark' ? 1 : 0));
  window.addEventListener(
    'resize',
    () => {
      env.viewW = window.innerWidth;
      env.viewH = window.innerHeight;
    },
    { passive: true },
  );

  // The frame. Over the flight the sound's turn comes before the picture's draw; elsewhere it has its own.
  let ranAt = -1;
  const turn = (now: number) => {
    if (!live() || ranAt === now) return;
    ranAt = now;
    if (now - asked > 500) {
      asked = now;
      hop();
    }
    const t0 = performance.now();
    const at = read();
    sound.frame(reader.read(signals, now, env), { now: at, frameAt: now, map });
    // (What the sound's own turn costs the frame, for the checks.)
    const took = performance.now() - t0;
    cost.turn = cost.turn ? cost.turn + (took - cost.turn) * 0.02 : took;
    cost.turnMax = Math.max(cost.turnMax ?? 0, took);
  };
  onFlightFrame(turn);
  onFrame(turn, 30);

  // Moments, the instant they are published: by the picture inside its frame, or by a handler.
  listen((type, a, b, c, at, d) => {
    if (live()) sound.fire(type, a, b, c, read(), at, d);
  });

  // Links and controls: a hover is heard once as the pointer comes onto one, a press as it lands.
  // A hover is the pointer's doing. When the page moves a control under a pointer that is standing still (the nav
  // coming back as the scroll rests, a link carried past by the scroll) the browser reports the pointer over it
  // all the same, at the place it already was: that is not a hover, and nothing sounds.
  let over: Element | null = null;
  let lastX = NaN;
  let lastY = NaN;
  const control = (e: Event) => (e.target instanceof Element ? e.target.closest(CONTROL) : null);
  // A tick of the rail: which it is, of how many, and which way the page will go if it is pressed.
  const railOf = (el: Element | null) => {
    const rail = el?.closest('.fl-rail');
    if (!el || !rail) return null;
    const ticks = Array.from(rail.querySelectorAll('a'));
    const i = ticks.indexOf(el as HTMLAnchorElement);
    if (i < 0) return null;
    const now = ticks.findIndex((a) => a.getAttribute('aria-current') === 'true');
    return { i, n: ticks.length, dir: Math.sign(i - now) };
  };
  const press = (el: Element, x: number) => {
    const r = railOf(el);
    sound.fire('tap', x, r ? r.i : 0, r ? r.n : 0, read(), performance.now());
  };
  document.addEventListener(
    'pointermove',
    (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = control(e);
      const came = e.clientX !== lastX || e.clientY !== lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (el === over) return;
      over = el;
      if (!el || !came || !live()) return;
      const r = railOf(el);
      sound.fire('hover', e.clientX / env.viewW, r ? r.i : 0, r ? r.n : 0, read(), performance.now());
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = control(e);
      if (el && live()) press(el, e.clientX / env.viewW);
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'click',
    (e) => {
      const any = control(e);
      if (!any || !live()) return;
      // (A control worked from the keyboard has no pointer press: its click is its press.)
      if (e.detail === 0) {
        const r = any.getBoundingClientRect();
        press(any, (r.left + r.width / 2) / env.viewW);
      }
      // A tick of the rail takes the page to its section: a route within the flight.
      const rail = railOf(any);
      if (rail && rail.dir !== 0) sound.fire('jump', rail.dir, 0, 0, read(), performance.now());
    },
    { capture: true, passive: true },
  );

  // A hidden tab is silent: what was set ahead is taken back, the mix fades, then the context rests. A page put away
  // (another page opened over it, the tab closed) rests the same way, and wakes if it is brought back.
  const away = () => {
    if (!wanted) return;
    sound.cancelAhead(ctx.currentTime);
    rest(HIDE);
  };
  const back = () => {
    if (wanted && !document.hidden) wake(SHOW);
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? away() : back()));
  window.addEventListener('pagehide', away);
  window.addEventListener('pageshow', back);

  window.__sound = { ctx, sound, map, tier, cost, signals, lead: () => lead };
  return { ctx, sound };
}

/** The fades, in seconds: in from silence at the start, out when muted, in again when turned back on, out and in as the tab is hidden and shown. */
const START = 1.5;
const MUTE = 0.2;
const UNMUTE = 0.4;
const HIDE = 0.3;
const SHOW = 0.8;

/** Fade out, and rest the context once the fade has reached silence. */
function rest(seconds: number) {
  if (!run) return;
  const { ctx, sound } = run;
  sound.setOn(false, ctx.currentTime, seconds);
  window.clearTimeout(sleep);
  sleep = window.setTimeout(() => void ctx.suspend().catch(() => {}), seconds * 1000 + 80);
}

/**
 * Wake the context and fade in. Where the browser will not let the context run yet (no gesture it accepts), the fade
 * waits with it: it begins from silence at the moment the context really starts.
 */
function wake(seconds: number): Promise<boolean> {
  if (!run) return Promise.resolve(false);
  const { ctx, sound } = run;
  window.clearTimeout(sleep);
  return ctx
    .resume()
    .then(() => {
      if (!wanted || document.hidden) return false;
      // (Already on its way in or there: a second asking does not start the fade again.)
      if (!sound.rising) sound.setOn(true, ctx.currentTime, seconds);
      return ctx.state === 'running';
    })
    .catch(() => false);
}

/**
 * Turn sound on. `ctx` was made inside the reader's gesture by the control, which is what browsers ask for; the
 * graph is built here, once, in pieces, and the mix fades in from silence over a second and a half. Asking again is
 * harmless (the control asks at every gesture until the context really runs). Says whether the sound is built and
 * the context running.
 */
export async function soundOn(ctx: AudioContext): Promise<boolean> {
  wanted = true;
  building ??= build(ctx).catch(() => null);
  run = await building;
  if (!run) return false;
  // (Muted, or the home page left, while it was being built: the context is not left running in silence.)
  if (!wanted) return void ctx.suspend().catch(() => {}), false;
  if (document.hidden) return false;
  const first = !begun;
  begun = true;
  return wake(first ? START : UNMUTE);
}

/** Turn sound off: a short fade to silence, then the context rests. */
export function soundOff(seconds = MUTE) {
  wanted = false;
  rest(seconds);
}
