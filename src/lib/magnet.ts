import { Spring, spring } from '@/lib/motion';

/**
 * Magnetic hover for anything marked data-magnet. The element leans toward the
 * pointer on a spring and returns on a spring; it uses the `translate` property
 * so press feedback on `transform` is left alone.
 */
export function bindMagnets() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const live = new Map<HTMLElement, { x: Spring; y: Spring }>();
  let raf = 0;
  let current: HTMLElement | null = null;

  const loop = (t0: number) => {
    let last = t0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      live.forEach((s, el) => {
        s.x.step(dt);
        s.y.step(dt);
        el.style.translate = `${s.x.x.toFixed(2)}px ${s.y.x.toFixed(2)}px`;
        if (el !== current && s.x.resting && s.y.resting) {
          el.style.translate = '';
          live.delete(el);
        }
      });
      raf = live.size ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  };

  const move = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-magnet]') ?? null;
    if (current && current !== el) {
      const s = live.get(current);
      if (s) {
        s.x.target = 0;
        s.y.target = 0;
      }
    }
    current = el;
    if (!el) return;
    let s = live.get(el);
    if (!s) {
      s = { x: new Spring(0, spring.ui), y: new Spring(0, spring.ui) };
      live.set(el, s);
    }
    const r = el.getBoundingClientRect();
    const k = Math.min(0.3, 14 / Math.max(r.width, r.height) + 0.12);
    s.x.target = (e.clientX - (r.left + r.width / 2)) * k;
    s.y.target = (e.clientY - (r.top + r.height / 2)) * k;
    if (!raf) loop(performance.now());
  };
  window.addEventListener('pointermove', move, { passive: true });
  return () => {
    window.removeEventListener('pointermove', move);
    cancelAnimationFrame(raf);
  };
}
