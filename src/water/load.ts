/**
 * The loading sequence's progress: what the flight reports as it makes itself ready, written to the ice core the
 * page drew in its first paint (`.fl-load`: page.tsx, flight.css; the steps: load-steps.ts).
 *
 * The page is busy while this runs: the driver holds the main thread for a tenth to four tenths of a second at
 * a time, and while it builds a program nothing on the page is presented at all (up to 1.7 s: pitfalls.md). So
 * nothing here runs per frame and nothing creeps: each report is one write, a stratum set to the share of its step
 * that is done, through one short transition. (A long transition that crept between reports was tried. It kept the
 * compositor presenting frames beside the engine's own GL calls, which then waited on it: one more task of 30 ms
 * in most Lighthouse runs, 98 to 96 on a phone.) Progress never goes back, a stratum is whole only when its step
 * is, and the sequence ends the moment the picture is up (`loadOver`).
 *
 * This module is in the flight's own script, not the page's first.
 */

import { LOAD_KEY, LOAD_STEPS, type LoadId } from './load-steps';

const SET = 'cubic-bezier(0.23, 1, 0.32, 1)';

let at = -1;
let part = 0;
let over = true;
let dog = 0;
let fills: HTMLElement[] = [];
let says: HTMLElement | null = null;
let count: HTMLElement | null = null;
let piece: HTMLElement | null = null;
let still: HTMLElement | null = null;
/** How much of the wait is behind each step's start, 0..1, by what the steps were measured to take. */
const TOTAL = LOAD_STEPS.reduce((sum, s) => sum + s.ms, 0);
const BEFORE = LOAD_STEPS.map((_, i) => LOAD_STEPS.slice(0, i).reduce((sum, s) => sum + s.ms, 0) / TOTAL);

/** For the checks: every report, in ms of the page's clock. */
export const loadLog: { t: number; id: string; k: number; n: number }[] = [];

const html = () => document.documentElement;

function fill(el: HTMLElement | undefined, to: number, ms: number, ease: string) {
  if (!el) return;
  el.style.animation = 'none';
  el.style.transition = `transform ${Math.round(ms)}ms ${ease}, opacity 200ms linear`;
  el.style.transform = `scaleX(${to.toFixed(4)})`;
  if (to >= 1) el.parentElement?.setAttribute('data-done', '');
}

/** The grade over the still, 1 (the hour before the light) to 0 (the still as the picture's first frame). */
function grade(to: number) {
  still?.style.setProperty('--fl-grade', Math.max(0, to).toFixed(3));
}

/** Let the page go: the sequence is not shown and the page scrolls. */
function release() {
  window.clearTimeout(dog);
  html().removeAttribute('data-load');
}

/** The flight's script has arrived and begins its work. */
export function loadBegin() {
  (window as unknown as { __flLoad?: boolean }).__flLoad = true;
  at = -1;
  part = 0;
  over = html().dataset.load === undefined;
  loadLog.length = 0;
  const root = document.querySelector<HTMLElement>('.fl-load');
  fills = Array.from(root?.querySelectorAll<HTMLElement>('.fl-load-fill') ?? []);
  says = root?.querySelector<HTMLElement>('.fl-load-says') ?? null;
  count = root?.querySelector<HTMLElement>('.fl-load-at') ?? null;
  piece = root?.querySelector<HTMLElement>('.fl-load-piece') ?? null;
  still = document.querySelector<HTMLElement>('.flight-root > .fl-poster');
}

/** `k` of this step's `n` pieces are done, and the next is in hand. */
export function loadStep(id: LoadId, k = 0, n = 1) {
  if (over) return;
  const i = LOAD_STEPS.findIndex((s) => s.id === id);
  const done = n > 0 ? Math.min(1, k / n) : 1;
  if (i < at || (i === at && done <= part)) return;
  loadLog.push({ t: Math.round(performance.now()), id, k, n });
  for (let j = Math.max(at, 0); j < i; j++) fill(fills[j], 1, 220, SET);
  if (done >= 1) fill(fills[i], 1, 220, SET);
  else fill(fills[i], k / n, 220, SET);
  // (The long step, the river's programs, says which of them is in hand.)
  const pieces = id === 'build' && n > 1 && done < 1 ? `${k + 1} of ${n}` : '';
  if (piece && piece.textContent !== pieces) piece.textContent = pieces;
  if (i !== at) {
    if (says) says.textContent = LOAD_STEPS[i].says;
    if (count) count.textContent = String(i + 1);
  }
  // The hour before the light: the grade over the still lifts by as much of the wait as is behind (flight.css). Set
  // when a step or one of the long step's pieces is done, not at every report: a dozen states, each eased by CSS.
  if (i !== at || id === 'build') grade(1 - (BEFORE[i] + (done * LOAD_STEPS[i].ms) / TOTAL));
  at = i;
  part = done;
  // (If nothing more is reported for a long while, something has failed without saying so: the page is let go.)
  window.clearTimeout(dog);
  dog = window.setTimeout(release, 15000);
}

/** The picture is up: the core is whole and leaves with the still, and the page is the reader's. */
export function loadOver() {
  if (over) return;
  over = true;
  window.clearTimeout(dog);
  for (const el of fills) fill(el, 1, 160, SET);
  grade(0);
  html().setAttribute('data-load', 'over');
  try {
    localStorage.setItem(LOAD_KEY, '1');
  } catch {
    // No storage: the next visit is told as a first one.
  }
  window.setTimeout(() => {
    if (html().dataset.load === 'over') html().removeAttribute('data-load');
  }, 900);
}

/** The flight will not come up (no WebGL2, a lost context, the page left): nothing is shown and the page scrolls. */
export function loadDrop() {
  over = true;
  release();
}
