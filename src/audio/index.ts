/**
 * Sound on the page. This module, and everything it imports, is loaded the
 * first time the visitor turns sound on, and never before.
 *
 * It joins the site's one frame loop after the picture (order 30: the
 * flight draws at 10, the page's own frame runs at 20), reads what the
 * picture published for this frame, and steers the sound to it at the
 * audio clock's present. Moments are handed over the instant they are
 * published, inside the handler or the frame that caused them.
 */

import { onFrame } from '@/lib/frame';
import { listen, signals } from '@/lib/signals';
import { buildGraph } from './graph';
import { type Env, SceneReader } from './scene';
import { Sound } from './sound';
import { makeRng } from './theory';

declare global {
  interface Window {
    /** For the checks: the context, the conductor and what the picture last published. */
    __sound?: { ctx: AudioContext; sound: Sound; signals: typeof signals };
  }
}

/**
 * A moment's sound is asked for a little ahead of the audio clock as the
 * page reads it, so it starts on the sample it was asked for with its
 * attack whole, not at the next render quantum with its first milliseconds
 * gone. Inside the frame loop the clock reads about a quantum (128
 * samples) behind; inside an input handler it reads further behind
 * (measured: about 7 ms), so a press is asked for further ahead and
 * starts no later for it.
 */
const LEAD_FRAME = 0.004;
const LEAD_INPUT = 0.012;

/** What counts as a control: its hover and its press are heard. */
const CONTROL = 'a[href], button, [role="radio"], [role="button"], summary, select, input';

interface Running {
  ctx: AudioContext;
  sound: Sound;
}

let run: Running | null = null;
let building: Promise<Running | null> | null = null;
let wanted = false;
let sleep = 0;

async function build(ctx: AudioContext): Promise<Running | null> {
  const graph = await buildGraph(ctx, makeRng(20261117));
  const sound = new Sound(graph, (Date.now() & 0xffff) + 1);
  const html = document.documentElement;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const env: Env = { night: html.dataset.theme === 'dark' ? 1 : 0, calm: mq.matches, viewW: window.innerWidth, viewH: window.innerHeight };
  const reader = new SceneReader();
  const live = () => wanted && ctx.state === 'running';

  mq.addEventListener('change', () => (env.calm = mq.matches));
  window.addEventListener('themechange', () => (env.night = html.dataset.theme === 'dark' ? 1 : 0));
  window.addEventListener(
    'resize',
    () => {
      env.viewW = window.innerWidth;
      env.viewH = window.innerHeight;
    },
    { passive: true },
  );

  // The frame: after the picture has drawn and published.
  let inFrame = false;
  onFrame(() => (inFrame = true), -1000);
  onFrame((now) => {
    if (!live()) return;
    sound.frameAt = now;
    sound.frame(reader.read(signals, now, env), ctx.currentTime, LEAD_FRAME);
  }, 30);
  onFrame(() => (inFrame = false), 1000);
  const soon = () => ctx.currentTime + (inFrame ? LEAD_FRAME : LEAD_INPUT);

  // Moments, the instant they are published: by the picture inside its frame, or by a handler.
  listen((type, a, b, c, at) => {
    if (live()) sound.fire(type, a, b, c, soon(), at);
  });

  // Links and controls: a hover is heard once as the pointer comes onto one, a press as it lands.
  let over: Element | null = null;
  const control = (e: Event) => (e.target instanceof Element ? e.target.closest(CONTROL) : null);
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = control(e);
      if (el === over) return;
      over = el;
      if (el && live()) sound.fire('hover', e.clientX / env.viewW, 0, 0, soon(), performance.now());
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (control(e) && live()) sound.fire('tap', e.clientX / env.viewW, 0, 0, soon(), performance.now());
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'click',
    (e) => {
      // (A control worked from the keyboard has no pointer press: its click is its press.)
      const el = e.detail === 0 ? control(e) : null;
      if (!el || !live()) return;
      const r = el.getBoundingClientRect();
      sound.fire('tap', (r.left + r.width / 2) / env.viewW, 0, 0, soon(), performance.now());
    },
    { capture: true, passive: true },
  );

  // A hidden tab is silent: the mix fades, then the context rests.
  document.addEventListener('visibilitychange', () => {
    if (!wanted) return;
    if (document.hidden) rest(1);
    else wake(1.2);
  });

  window.__sound = { ctx, sound, signals };
  return { ctx, sound };
}

function rest(seconds: number) {
  if (!run) return;
  const { ctx, sound } = run;
  sound.setOn(false, ctx.currentTime, seconds);
  window.clearTimeout(sleep);
  sleep = window.setTimeout(() => void ctx.suspend().catch(() => {}), seconds * 1000 + 250);
}

function wake(seconds: number) {
  if (!run) return;
  const { ctx, sound } = run;
  window.clearTimeout(sleep);
  void ctx
    .resume()
    .then(() => sound.setOn(true, ctx.currentTime, seconds))
    .catch(() => {});
}

/**
 * Turn sound on. `ctx` was made inside the visitor's gesture by the
 * control, which is what browsers ask for; the graph is built here, in
 * pieces, and the mix fades in over about two seconds.
 */
export async function soundOn(ctx: AudioContext): Promise<void> {
  wanted = true;
  building ??= build(ctx).catch(() => null);
  run = await building;
  if (!run || !wanted) return;
  if (!document.hidden) wake(2);
}

/** Turn sound off: a short fade, then the context rests. */
export function soundOff() {
  wanted = false;
  rest(0.5);
}
