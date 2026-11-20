/**
 * "Calm": the page has presented its first frame and the browser is idle.
 *
 * Work that is not needed for that first frame waits for it: the scene
 * band's engine, smooth scrolling on an inner page, and the fetching of
 * pages a link leads to. Asked for earlier, each is a download that
 * competes with the page's own picture and words on a slow line. (A link
 * to the home page, fetched ahead, brought some 70 kB of the flight's code
 * with it: most of that is the engine the band itself asks for later, but
 * it arrived before the first frame.)
 *
 * After a route change the first frame is long past, so this is only the
 * wait for an idle moment.
 */

let painted: Promise<void> | null = null;

/** Resolves once the document's first contentful paint has been reported (or after 3 s where a browser never reports one). */
function firstPaint(): Promise<void> {
  if (painted) return painted;
  painted = new Promise<void>((resolve) => {
    const shown = () => performance.getEntriesByName?.('first-contentful-paint').length > 0;
    if (typeof PerformanceObserver !== 'function' || shown()) return resolve();
    let observer: PerformanceObserver | null = null;
    // (A browser that never reports a paint, or a tab opened in the background: do not wait for ever.)
    const giveUp = window.setTimeout(done, 3000);
    function done() {
      observer?.disconnect();
      window.clearTimeout(giveUp);
      resolve();
    }
    try {
      observer = new PerformanceObserver(() => {
        if (shown()) done();
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch {
      done();
    }
  });
  return painted;
}

let calm = false;
const watchers = new Set<() => void>();

/**
 * Run `fn` at the first idle moment after the page's first frame. Returns a
 * function that calls it off.
 */
export function whenCalm(fn: () => void, timeout = 500): () => void {
  let cancelled = false;
  let idle = 0;
  void firstPaint().then(() => {
    if (cancelled) return;
    const run = () => {
      if (cancelled) return;
      if (!calm) {
        calm = true;
        watchers.forEach((w) => w());
      }
      fn();
    };
    idle = window.requestIdleCallback ? window.requestIdleCallback(run, { timeout }) : window.setTimeout(run, 40);
  });
  return () => {
    cancelled = true;
    if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
  };
}

/** Has the page reached its first calm moment? (For useSyncExternalStore: false on the server and until then.) */
export const isCalm = () => calm;
export function onCalm(watch: () => void): () => void {
  watchers.add(watch);
  // (Whoever asks starts the wait, so a page with links and nothing else still gets there.)
  const off = calm ? () => {} : whenCalm(() => {});
  return () => {
    watchers.delete(watch);
    off();
  };
}
