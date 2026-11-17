/**
 * Haptics, through the web-haptics library.
 *
 * Rules (section H of the brief):
 *  - Client only. The library is imported on first use, never on the server.
 *  - Fail closed: any missing piece is a silent no-op. Every haptic is paired
 *    with a visible change by its caller.
 *  - Never gated on `isSupported`: that flag is false on iOS even though the
 *    library still tries its switch fallback there. The gates are reduced
 *    motion, the user's setting, and "is this a touch device at all", so
 *    desktops never get the library's hidden switch injected.
 *  - The hidden nodes the library adds are kept out of the tab order and the
 *    accessibility tree.
 */

import type { WebHaptics } from 'web-haptics';
import { emit } from './signals';

export type Haptic = 'light' | 'selection' | 'medium' | 'success' | 'error' | 'soft';

const KEY = 'haptics';
let instance: WebHaptics | null = null;
let loading: Promise<WebHaptics | null> | null = null;

function touchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export function hapticsAvailable(): boolean {
  return touchDevice();
}

export function hapticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: the setting lasts for this page only */
  }
  if (!on) instance?.cancel();
}

function allowed(): boolean {
  if (!touchDevice()) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return hapticsEnabled();
}

function hideInjected() {
  // The library adds a visually hidden <label><input type="checkbox"></label>
  // for its iOS path. Keep it away from keyboards and screen readers.
  document.querySelectorAll<HTMLElement>('label[for^="web-haptics"], input[id^="web-haptics"]').forEach((n) => {
    n.setAttribute('aria-hidden', 'true');
    n.setAttribute('tabindex', '-1');
    if (n instanceof HTMLInputElement) n.setAttribute('inert', '');
  });
}

function load(): Promise<WebHaptics | null> {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = import('web-haptics')
      .then(({ WebHaptics: Ctor }) => {
        instance = new Ctor({ debug: false, showSwitch: false });
        return instance;
      })
      .catch(() => null);
  }
  return loading;
}

/** Warm the library on the first touch so the first real haptic is on time. */
export function primeHaptics() {
  if (allowed()) void load();
}

/**
 * Fire one haptic. Call it in the same handler that makes the visual change.
 * Safe to call anywhere on the client; it does nothing where it should not.
 */
export function haptic(kind: Haptic = 'light') {
  if (typeof window === 'undefined') return;
  emit('haptic:' + kind);
  if (!allowed()) return;
  const fire = (h: WebHaptics | null) => {
    if (!h) return;
    try {
      void h.trigger(kind).catch(() => {});
      hideInjected();
    } catch {
      /* never let feedback break the action it accompanies */
    }
  };
  if (instance) fire(instance);
  else void load().then(fire);
}
