/**
 * Shared, non-reactive state for the one animation loop.
 * The scroll reader writes it, the 3D engine and DOM effects read it.
 * Nothing here goes through React state: it changes every frame.
 */
export const story = {
  /** Chapter under the middle of the viewport. */
  chapter: 'hero',
  /** 0..1 progress of the viewport middle through that chapter. */
  local: 0,
  /** Page ground colour under the middle of the viewport, as #rrggbb. */
  ground: '#ffd60a',
  scrollY: 0,
  vh: 1,
  vw: 1,
  /** True when an opaque sheet fully covers the canvas. */
  covered: false,
  /** Screen positions of three probe rings, written by the 3D engine. */
  anchors: [
    { x: 0, y: 0, on: 0 },
    { x: 0, y: 0, on: 0 },
    { x: 0, y: 0, on: 0 },
  ],
  reduced: false,
};

export type FrameFn = (now: number) => void;
const subs = new Set<FrameFn>();

export function onFrame(fn: FrameFn) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function runFrame(now: number) {
  subs.forEach((fn) => fn(now));
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
/** Progress of v between a and b, clamped. */
export const span = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

export function luminance(hex: string) {
  const p = parseInt(hex.slice(1), 16);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f((p >> 16) & 255) + 0.7152 * f((p >> 8) & 255) + 0.0722 * f(p & 255);
}
