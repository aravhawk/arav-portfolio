'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * The sound control on the home page. Off until it is pressed. Nothing of
 * the sound is loaded before then: this file holds the control and makes
 * the audio context inside the press (a browser lets sound start only from
 * one); everything that is heard arrives in its own chunk on the first
 * press (src/sound).
 *
 * The choice lasts for the visit (a reload, a way to a project and back),
 * not beyond it: a new visit opens silent.
 */

const KEY = 'sound';

let on = false;
const subs = new Set<() => void>();
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => void subs.delete(cb);
};
const set = (next: boolean) => {
  if (next === on) return;
  on = next;
  subs.forEach((cb) => cb());
};

let ctx: AudioContext | undefined;
const load = () => import('@/sound');

/**
 * A browser's first audio context can hold the page for a tenth of a second
 * while its audio service starts (measured here: 85 ms in Chromium, under
 * 1 ms once the service is up). Asking which devices there are starts that
 * service without a context, without a prompt and off the page's thread.
 * It is asked when the visitor shows they are about to press (the pointer
 * comes onto the control, a finger lands on it, it takes focus), so the
 * press itself is short. Nothing is asked of a visitor who never goes near.
 */
let warmed = false;
function warm() {
  if (warmed) return;
  warmed = true;
  try {
    void navigator.mediaDevices?.enumerateDevices?.().catch(() => {});
  } catch {
    /* nothing to warm */
  }
}

/** Make (or wake) the context inside the visitor's gesture, then fetch the sound and hand it over. */
function start() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  try {
    ctx ??= new Ctor({ latencyHint: 'playback' });
    void ctx.resume();
  } catch {
    return false;
  }
  const c = ctx;
  void load()
    .then((m) => m.soundOn(c))
    .catch(() => set(false));
  return true;
}

function remember(value: boolean) {
  try {
    sessionStorage.setItem(KEY, value ? 'on' : 'off');
  } catch {
    /* no storage: the choice lasts for this page */
  }
}

function toggle() {
  const next = !on;
  if (next) {
    if (!start()) return;
  } else if (ctx) void load().then((m) => m.soundOff());
  set(next);
  remember(next);
}

export function SoundToggle() {
  const active = useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  );

  useEffect(() => {
    // Back on the home page with the sound already made: it is told the page is here again, and told when it is left.
    if (ctx) void load().then((m) => m.soundHere(true));
    const leave = () => {
      if (ctx) void load().then((m) => m.soundHere(false));
    };
    // Chosen earlier in this visit, and the page was loaded again: a browser
    // will not start sound without a gesture, so it comes back at the first press anywhere.
    let stored = false;
    try {
      stored = sessionStorage.getItem(KEY) === 'on';
    } catch {
      /* no storage: off */
    }
    if (!stored || on) return leave;
    set(true);
    const first = (e: Event) => {
      // (The control's own press is its own business.)
      if (e.target instanceof Element && e.target.closest('.in-sound')) return;
      // Not every key or touch is one a browser starts sound for: this listens until one was.
      if (on && ctx?.state !== 'running' && !start()) set(false);
      if (!on || ctx?.state === 'running') done();
    };
    const done = () => {
      removeEventListener('pointerdown', warm, true);
      removeEventListener('pointerup', first, true);
      removeEventListener('keydown', first, true);
    };
    addEventListener('pointerdown', warm, true);
    addEventListener('pointerup', first, true);
    addEventListener('keydown', first, true);
    return () => {
      done();
      leave();
    };
  }, []);

  return (
    <button type="button" className="in-sound" onClick={toggle} onPointerEnter={warm} onPointerDown={warm} onFocus={warm} aria-label="Sound" aria-pressed={active}>
      {/* A level: four short marks at rest, four standing bars when the place is heard. */}
      <span className="in-sound-mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
