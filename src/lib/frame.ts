/**
 * The one frame loop. Smooth scroll, the water engine and any scroll-linked
 * reveal subscribe here, so there is a single requestAnimationFrame owner and
 * everything reads the same clock. It stops while the tab is hidden.
 */

type FrameFn = (now: number) => void;

const subs: { fn: FrameFn; order: number }[] = [];
let raf = 0;
let listening = false;

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  for (let i = 0; i < subs.length; i++) subs[i].fn(now);
}

function start() {
  if (raf || !subs.length || document.hidden) return;
  raf = requestAnimationFrame(loop);
}

function stop() {
  if (!raf) return;
  cancelAnimationFrame(raf);
  raf = 0;
}

/**
 * Subscribe to the frame loop. Lower `order` runs first (scroll before
 * rendering). Returns an unsubscribe function.
 */
export function onFrame(fn: FrameFn, order = 0): () => void {
  if (!listening) {
    listening = true;
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }
  const sub = { fn, order };
  subs.push(sub);
  subs.sort((a, b) => a.order - b.order);
  start();
  return () => {
    const i = subs.indexOf(sub);
    if (i >= 0) subs.splice(i, 1);
    if (!subs.length) stop();
  };
}
