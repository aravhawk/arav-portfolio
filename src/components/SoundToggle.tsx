'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { haptic } from '@/lib/haptics';
import './sound.css';

/**
 * The sound control. Off until the visitor turns it on, and the choice is
 * remembered. Nothing about sound is loaded before then: this file holds
 * the control and one audio context made inside the gesture (browsers
 * only let sound start from one); the rest arrives on the first turn-on.
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

let ctx: AudioContext | null = null;

/**
 * A browser's first audio context can hold the page for a tenth of a second
 * or more while its audio service starts (measured: 120 to 180 ms in
 * Chromium, 5 ms once the service is up). Asking the browser which devices
 * it has starts that service without making a context, without a prompt
 * and off the page's thread. It is asked when the visitor shows they are
 * about to turn sound on (the pointer comes onto the control, a finger
 * lands on it, it takes focus), so the click itself is short.
 */
let warming: Promise<unknown> | null = null;
let warm = false;
function warmUp() {
  if (warming) return;
  try {
    warming = (navigator.mediaDevices?.enumerateDevices?.() ?? Promise.resolve()).catch(() => {}).then(() => (warm = true));
  } catch {
    warming = Promise.resolve();
    warm = true;
  }
}

/** Make (or wake) the context, then load the sound and hand it over. */
function make(Ctor: typeof AudioContext): boolean {
  try {
    ctx ??= new Ctor({ latencyHint: 'interactive' });
    void ctx.resume();
  } catch {
    return false;
  }
  const c = ctx;
  void import('@/audio').then((m) => m.soundOn(c)).catch(() => set(false));
  return true;
}

/**
 * Turn sound on, from inside the visitor's gesture. The context is made
 * there and then, which is what browsers ask for. One exception: a touch
 * can land before the audio service has had time to start (a finger gives
 * a tenth of a second's notice, a pointer much more); where the browser
 * remembers the gesture for the page (`navigator.userActivation`), the
 * context is then made the moment the service is up instead of holding the
 * page for it, and never more than a third of a second later.
 */
function start(): boolean {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  if (ctx || warm || !warming || !('userActivation' in navigator)) return make(Ctor);
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    if (on && !make(Ctor)) set(false);
  };
  void warming.then(go);
  window.setTimeout(go, 320);
  return true;
}

function stop() {
  void import('@/audio').then((m) => m.soundOff()).catch(() => {});
}

function remember(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off');
  } catch {
    /* private mode: the choice lasts for this page */
  }
}

export function SoundToggle() {
  const active = useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  );

  // A visitor who chose sound before gets it back at their first gesture
  // here: a browser will not start sound without one.
  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(KEY) === 'on';
    } catch {
      /* no storage: off */
    }
    if (!stored || on) return;
    set(true);
    // (They chose sound before: the audio service is started while the page is idle, ahead of their first gesture.)
    const idle = window.setTimeout(warmUp, 1200);
    const first = (e: Event) => {
      // (The control's own press is its own business.)
      if (e.target instanceof Element && e.target.closest('.nav-sound')) return;
      done();
      if (on && !start()) set(false);
    };
    const done = () => {
      window.clearTimeout(idle);
      window.removeEventListener('pointerup', first, true);
      window.removeEventListener('keydown', first, true);
    };
    window.addEventListener('pointerup', first, true);
    window.addEventListener('keydown', first, true);
    return done;
  }, []);

  const toggle = useCallback(() => {
    // Haptic, sound and the control's own change, in the one handler.
    haptic('light');
    const next = !on;
    if (next) {
      if (!start()) return;
    } else if (ctx) stop();
    set(next);
    remember(next);
  }, []);

  return (
    <button
      type="button"
      className="nav-sound"
      onClick={toggle}
      onPointerEnter={warmUp}
      onPointerDown={warmUp}
      onFocus={warmUp}
      aria-label={active ? 'Turn sound off' : 'Turn sound on'}
      aria-pressed={active}
      title={active ? 'Sound: on' : 'Sound: off'}
      data-on={active ? '' : undefined}
    >
      {/* A speaker and the level beside it: a flat line when off, a moving wave when on. */}
      <span className="nav-sound-mark" aria-hidden="true">
        <svg className="nav-sound-cone" width="8" height="12" viewBox="0 0 8 12">
          <path d="M0.6 4.1h2.1L6.9 0.9a0.4 0.4 0 0 1 0.6 0.3v9.6a0.4 0.4 0 0 1-0.6 0.3L2.7 7.9H0.6a0.6 0.6 0 0 1-0.6-0.6V4.7a0.6 0.6 0 0 1 0.6-0.6z" fill="currentColor" />
        </svg>
        <span className="nav-sound-bars">
          <span />
          <span />
          <span />
        </span>
      </span>
    </button>
  );
}
