/**
 * What a visit to the home page waits for before its picture is live, as the reader is told it: the steps the
 * flight really takes behind its still (`prepare` and `mountFlight` in flight.ts), in order, each with the words
 * it is named by and what it was measured to take on a first visit (ms, an Apple M4, a 1440 by 900 window:
 * `.tools/out/l1/REPORT.md` of the L1 task). The page draws one stratum of its ice core to a step, as wide as
 * the step is long (page.tsx, `.fl-load` in flight.css); load.ts fills them as the engine reports.
 *
 * This file is in the page's first script, so it holds no more than the table and the few lines that arm the
 * sequence before the first paint.
 */

export const LOAD_STEPS = [
  { id: 'fetch', says: 'Fetching the flight', ms: 350 },
  { id: 'shaders', says: 'Compiling shaders', ms: 550 },
  { id: 'bake', says: 'Baking snow and ranges', ms: 600 },
  { id: 'build', says: 'Building the river', ms: 4200 },
  { id: 'bed', says: 'Carving the riverbed', ms: 280 },
  { id: 'name', says: 'Cutting the name', ms: 140 },
  { id: 'first', says: 'Drawing the first frame', ms: 120 },
] as const;

export type LoadId = (typeof LOAD_STEPS)[number]['id'];

/** Where the page remembers that this browser's driver has built the flight's programs before. */
export const LOAD_KEY = 'fl-built';

/**
 * Arm the sequence: self-contained, so it can be written into the page as text and run before the first paint.
 * `cold` is a first visit (the core is in the first paint); `warm` is a reader who has been here, whose wait is
 * about a second (the core stays out unless the wait turns out long: see flight.css). While either stands the
 * page is held at its top, where the picture will come up (`overflow` in flight.css; `prevent` for the smooth
 * scrolling in Runtime.tsx). If the flight's script never arrives, the page is let go.
 */
export function armLoad(key: string) {
  const d = document.documentElement;
  let seen = null;
  try {
    seen = localStorage.getItem(key);
  } catch {
    // No storage: a first visit.
  }
  d.setAttribute('data-load', seen ? 'warm' : 'cold');
  setTimeout(function () {
    if (!(window as unknown as { __flLoad?: boolean }).__flLoad) d.removeAttribute('data-load');
  }, 10000);
}
