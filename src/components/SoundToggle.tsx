'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { whenCalm } from '@/lib/calm';
import { haptic } from '@/lib/haptics';
import './sound.css';

/**
 * The sound control. Sound is on unless the reader mutes it, and the choice
 * is kept.
 *
 * What the control shows is drawn by sound.css from two marks on <html>:
 * `data-sound` (the choice: the page's first script sets it before anything
 * is painted, layout.tsx) and `data-sound-live` (sound is really coming
 * out). This file keeps those marks true, says the control's state to
 * assistive technology, and starts the sound.
 *
 * A browser lets sound start only inside an event it counts as the reader's
 * own act: a press, a key, the end of a touch; not a wheel, a scroll or a
 * pointer's move. So every such event is listened for, the audio context is
 * made or woken inside it, and that goes on until the context really runs.
 * Where the browser says whether an event counts (`navigator.userActivation`)
 * it is asked first, so a context is never made where it would be refused
 * (a refusal is a warning in the console); elsewhere only the events every
 * browser counts are tried. A first press on the control itself mutes, and
 * nothing ever sounds.
 *
 * The sound's own code (src/audio) is a script of its own. It is fetched a
 * second after the page's load has ended, when the thread is idle (the one
 * gate: src/lib/calm.ts), or at the reader's first gesture if that comes
 * sooner; never in a page's first load, and not at all for a reader who has
 * muted until they turn sound on.
 */

const KEY = 'sound';
type Ctor = typeof AudioContext;
type State = 'off' | 'waiting' | 'playing';
/** (What the server's markup stands for: on, with no title yet. The title comes with this file's script.) */
type Shown = State | 'unread';

let read = false;
let on = true;
let ready = false;
let ctx: AudioContext | null = null;
let mod: Promise<typeof import('@/audio')> | null = null;
const subs = new Set<() => void>();

/** The reader's choice, as the page's first script wrote it on <html>. */
function choice(): boolean {
  if (!read) {
    read = true;
    on = document.documentElement.dataset.sound !== 'off';
  }
  return on;
}
const state = (): State => (!choice() ? 'off' : ready && ctx?.state === 'running' ? 'playing' : 'waiting');

/** Say what is true now, on <html> (the control is drawn from it) and to whoever reads the state. */
function sync() {
  const d = document.documentElement;
  d.dataset.sound = on ? 'on' : 'off';
  d.toggleAttribute('data-sound-live', state() === 'playing');
  subs.forEach((cb) => cb());
}
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => void subs.delete(cb);
};

const load = () => (mod ??= import('@/audio'));

/** The line that says a change aloud. It is made here, not in the page's markup: it has nothing to say until the first change. */
let status: HTMLElement | null = null;
function statusLine() {
  if (status) return;
  status = document.createElement('span');
  status.className = 'nav-sound-status sr-only';
  status.setAttribute('role', 'status');
  document.body.appendChild(status);
}

/**
 * A browser's first audio context can hold the page for a tenth of a second
 * or more while its audio service starts (measured: 120 to 180 ms in
 * Chromium, 5 ms once the service is up). Asking the browser which devices
 * it has starts that service without making a context, without a prompt
 * and off the page's thread. It is asked when the page is idle, or as the
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
  if (!on) return;
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
    .then((m) => (on ? m.soundOn(c) : false))
    .then((ok) => {
      ready ||= ok;
      sync();
    })
    .catch(() => (mod = null));
}

/** Try to start. `type` is the event's, or '' for the control's own press and its key. */
function start(type = '') {
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!C) return;
  const ua = navigator.userActivation;
  // (Where the browser cannot be asked, only the events every browser counts.)
  if (ua ? !ua.isActive && !ua.hasBeenActive : type === 'pointerdown' || type === 'wheel') return;
  // (The audio service is not up yet and the browser remembers the gesture: the context is made the moment it is,
  // or a third of a second on, so the gesture itself is not held for it.)
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
  on = !choice();
  // (Said to assistive technology wherever its attention is: the key works from anywhere on the page.)
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

/** (A wheel is listened for too: no browser a reader has counts it, and the browser is asked before anything is made of it.) */
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown', 'wheel'] as const;
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

function gesture(e: Event) {
  if (e instanceof KeyboardEvent && (e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) {
    if (!e.repeat) toggle(true);
    return;
  }
  // The control's own press is its own business: a first press on it mutes, and nothing ever sounds.
  if (e.target instanceof Element && e.target.closest('.nav-sound')) return;
  if (choice() && state() !== 'playing') start(e.type);
}

const TITLE: Record<State, string> = {
  playing: 'Sound is on. Mute (M)',
  waiting: 'Sound is on and starts at your first click or key. Mute (M)',
  off: 'Sound is muted. Turn it on (M)',
};

/**
 * The control's state said right as it is parsed, for a reader who had muted: before this file's script has run, the
 * markup would say "on". (Kept to one short line, and the mark is drawn in CSS: this markup is in every page, and an
 * inner page's HTML has to fit what a new connection sends before it waits. See docs/site-system/performance.md.)
 */
const SAID_AT_ONCE = `document.documentElement.dataset.sound=='off'&&document.currentScript.previousSibling.setAttribute('aria-checked',!1)`;

export function SoundToggle() {
  const now = useSyncExternalStore<Shown>(subscribe, state, () => 'unread');

  useEffect(() => {
    choice();
    statusLine();
    sync();
    // The sound's script: a second after the page's own load has ended, at the first idle moment (the one gate,
    // calm.ts); never for a reader who has muted. (The second is for the page's largest picture: it is painted a
    // frame or more after the load ends, and a script asked for in between is counted against that paint. A reader
    // who presses or types sooner is not kept waiting: the gesture asks for the script itself.)
    let off = () => {};
    let wait = 0;
    const arm = () => {
      wait = window.setTimeout(() => {
        off = whenCalm(() => {
          if (!on) return;
          warmUp();
          // A flight can use the synth throughout its trip. On an inner page the
          // first accepted gesture loads it through make(), with the context already awake.
          if (window.location.pathname === '/') void load().catch(() => (mod = null));
        });
      }, 1000);
    };
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    for (const g of GESTURES) window.addEventListener(g, gesture, { capture: true, passive: true });
    return () => {
      window.removeEventListener('load', arm);
      window.clearTimeout(wait);
      off();
      for (const g of GESTURES) window.removeEventListener(g, gesture, { capture: true });
    };
  }, []);

  // (A reader who had muted shows, by coming onto the control, that a press may follow: the audio service is started for it.)
  const near = () => {
    if (!on) warmUp();
  };

  return (
    <>
      <button
        type="button"
        role="switch"
        className="nav-sound"
        onClick={(e) => toggle(e.detail === 0)}
        onPointerEnter={near}
        onFocus={near}
        aria-label="Sound"
        aria-checked={now !== 'off'}
        aria-keyshortcuts="M"
        title={now === 'unread' ? undefined : TITLE[now]}
        suppressHydrationWarning
      >
        {/* A speaker and, beside it, what the sound is doing: standing bars (faint and still while it waits, full and
            moving while it plays) or a cross when muted. The speaker and the cross are drawn in sound.css. */}
        <span className="nav-sound-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
      <script dangerouslySetInnerHTML={{ __html: SAID_AT_ONCE }} />
    </>
  );
}
