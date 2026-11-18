/**
 * The opening: the first seconds of a visit to the home page, from the
 * moment the live picture stands over its still to the moment the first
 * screen is at rest (the eye has settled, the light has arrived, the words
 * are set).
 *
 * This is the seam between whatever a first visit has to make ready and the
 * entrance. The entrance waits on `ready` before it begins and calls `over`
 * when it has run. Today nothing holds it: `ready` is already resolved. A
 * task that builds a first visit's shader programs during the opening hands
 * its own promise to `holdOpening` before the flight mounts, and may listen
 * for the end with `whenOpened`.
 */

let held: Promise<void> = Promise.resolve();
let opened = false;
const after = new Set<() => void>();

/** Hold the opening until this resolves (called before the flight mounts; a rejection does not hold it). */
export function holdOpening(until: Promise<unknown>) {
  held = Promise.all([held, until.catch(() => {})]).then(() => {});
}

/** What the entrance waits on: `ready` says the opening may begin, `over` says it is over. */
export function opening(): { ready: Promise<void>; over: () => void } {
  return {
    ready: held,
    over() {
      if (opened) return;
      opened = true;
      if (typeof document !== 'undefined') document.documentElement.dataset.opened = '';
      for (const cb of after) cb();
      after.clear();
    },
  };
}

/** Called once the opening is over (at once if it already is). */
export function whenOpened(cb: () => void) {
  if (opened) cb();
  else after.add(cb);
}
