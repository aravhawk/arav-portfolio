/**
 * The sound control's behaviour. Sound is on unless the reader mutes it,
 * and the choice is kept.
 *
 * The control itself is a few elements in the nav (Nav.tsx), drawn by
 * sound.css from two marks on <html>: `data-sound` (the choice: the page's
 * first script sets it before anything is painted, layout.tsx) and
 * `data-sound-live` (sound is really coming out). This file keeps those
 * marks true, names the control for what a press will do, and starts the
 * sound. It rides in the home page's own script (FlightPlayer.tsx mounts
 * it): the nav's script is in every page, and a few hundred bytes more of
 * it is one more request on all of them (docs/site-system/performance.md).
 *
 * A browser lets sound start only inside an event it counts as the
 * reader's own act: a press, a key, the end of a touch; not a wheel, a
 * scroll or a pointer's move. So every such event is listened for, the
 * audio context is made or woken inside it, and that goes on until the
 * context really runs. Where the browser says whether an event counts
 * (`navigator.userActivation`) it is asked first, so a context is never
 * made where it would be refused (a refusal is a warning in the console);
 * elsewhere only the events every browser counts are tried. The sound's
 * own code (src/audio) is a script of its own, fetched once the page has
 * painted and the thread is idle, and never for a reader who has muted.
 */

import { haptic } from './haptics';

const KEY = 'sound';
type Ctor = typeof AudioContext;

let on = true;
let home = false;
let ready = false;
let live = false;
let ctx: AudioContext | null = null;
let mod: Promise<typeof import('@/audio')> | null = null;

/** Say what is true now, on <html> and on the control: the choice, whether sound is really playing, what a press will do. */
function sync() {
  live = on && home && ready && ctx?.state === 'running';
  const d = document.documentElement;
  d.dataset.sound = on ? 'on' : 'off';
  d.toggleAttribute('data-sound-live', live);
  const b = d.querySelector('.nav-sound');
  if (!b) return;
  b.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
  // (The two other names are also in Nav.tsx, which writes the control's first paint.)
  b.setAttribute('title', !on ? 'Turn sound on (M)' : live ? 'Mute sound (M)' : 'Sound is on and starts at your first click or key. Mute (M)');
}

const load = () => (mod ??= import('@/audio'));

/**
 * A browser's first audio context can hold the page for a tenth of a second
 * while its audio service starts (120 to 180 ms in Chromium, 5 ms once it
 * is up). Asking which devices there are starts the service off the page's
 * thread, with no prompt: it is asked when the page is idle, or as the
 * pointer comes onto the control of a reader who had muted.
 */
let warming: Promise<unknown> | null = null;
let warm = false;
function warmUp() {
  try {
    warming ??= (navigator.mediaDevices?.enumerateDevices?.() ?? Promise.resolve()).catch(() => {}).then(() => (warm = true));
  } catch {
    warm = true;
  }
}

/** Make the context (or wake it) and hand it to the sound. Inside a gesture, or after one the browser remembers. */
function make(C: Ctor) {
  if (!on || !home) return;
  try {
    if (!ctx) {
      ctx = new C({ latencyHint: 'interactive' });
      ctx.addEventListener('statechange', sync);
    }
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  } catch {
    return;
  }
  const c = ctx;
  load()
    .then((m) => (on && home ? m.soundOn(c) : false))
    .then((ok) => {
      ready ||= ok;
      sync();
    })
    .catch(() => (mod = null));
}

/** Try to start. `type` is the event's, or '' for the control's own press. */
function start(type = '') {
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!C) return;
  const ua = navigator.userActivation;
  // (Where the browser cannot be asked, only the events every browser counts.)
  if (ua ? !ua.isActive && !ua.hasBeenActive : type === 'wheel' || type === 'pointerdown' || type === 'pointerover') return;
  // (The service is not up yet and the browser remembers the gesture: the context is made the moment it is, or a third of a second on.)
  if (!ctx && !warm && warming && ua) {
    let done = false;
    const go = () => {
      if (!done) make(C);
      done = true;
    };
    void warming.then(go);
    window.setTimeout(go, 320);
  } else make(C);
}

/** The reader's press on the control, or the M key. From the keys nothing is in transition. */
function toggle(instant: boolean) {
  haptic('light');
  const d = document.documentElement;
  d.querySelector('.nav-sound')?.toggleAttribute('data-instant', instant);
  on = !on;
  // (Said to assistive technology: the control's name has just changed under it.)
  const status = d.querySelector('.nav-sound-status');
  if (status) status.textContent = on ? 'Sound on' : 'Sound muted';
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: the choice lasts for this page */
  }
  if (on) start();
  else void mod?.then((m) => m.soundOff()).catch(() => {});
  sync();
}

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown', 'wheel', 'pointerover'] as const;
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

function gesture(e: Event) {
  const own = e.target instanceof Element && !!e.target.closest('.nav-sound');
  if (e.type === 'pointerover') {
    // (Not a gesture: the pointer coming onto the control of a reader who had muted is notice that a press may follow.)
    if (own && !on) warmUp();
    return;
  }
  if (e instanceof KeyboardEvent && (e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) {
    if (e.type === 'keydown' && !e.repeat) toggle(true);
    return;
  }
  // The control's own press is its own business: a first press on it mutes, and nothing ever sounds.
  if (own) {
    if (e.type === 'click') toggle((e as MouseEvent).detail === 0);
    return;
  }
  if (on && !live) start(e.type);
}

/** The home page is up: keep the control true and start the sound when the browser allows. Returns what undoes it. */
export function mountSoundControl(): () => void {
  home = true;
  on = document.documentElement.dataset.sound !== 'off';
  sync();
  // (Back on the home page with a context already made, or come to it by a press on another page: it starts at once
  // where the browser remembers the press, and at the next one where it does not.)
  if (on && (ctx || navigator.userActivation?.hasBeenActive)) start();
  // The sound's script, once the page has painted and is idle.
  const idle = () => {
    if (!on || !home) return;
    warmUp();
    void load().catch(() => (mod = null));
  };
  let timer = 0;
  let frame = 0;
  const arm = () => (timer = window.requestIdleCallback ? window.requestIdleCallback(idle, { timeout: 3000 }) : window.setTimeout(idle, 1200));
  const loaded = () => (frame = requestAnimationFrame(arm));
  if (document.readyState === 'complete') loaded();
  else window.addEventListener('load', loaded, { once: true });
  for (const g of GESTURES) window.addEventListener(g, gesture, { capture: true, passive: true });
  return () => {
    home = false;
    window.removeEventListener('load', loaded);
    cancelAnimationFrame(frame);
    (window.cancelIdleCallback ?? window.clearTimeout)(timer);
    for (const g of GESTURES) window.removeEventListener(g, gesture, { capture: true });
    // (An inner page has no sound: it fades as the home page is left.)
    void mod?.then((m) => m.soundOff(0.3)).catch(() => {});
    sync();
  };
}
