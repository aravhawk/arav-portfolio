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

/** Make (or wake) the context inside the gesture, then load the sound and hand it over. */
function start(): boolean {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
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
    const first = (e: Event) => {
      // (The control's own press is its own business.)
      if (e.target instanceof Element && e.target.closest('.nav-sound')) return;
      done();
      if (on && !start()) set(false);
    };
    const done = () => {
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
    <button type="button" className="nav-sound" onClick={toggle} aria-label={active ? 'Turn sound off' : 'Turn sound on'} aria-pressed={active} data-on={active ? '' : undefined}>
      <span className="nav-sound-bars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
