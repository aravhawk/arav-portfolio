'use client';

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** A real number that ticks up once when it comes into view. The final value is in the HTML from the server. */
export default function Counter({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    let done = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || done) return;
        done = true;
        const t0 = performance.now();
        const d = 1100;
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / d);
          const k = 1 - Math.pow(1 - t, 4);
          el.textContent = fmt(value * k);
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = fmt(value);
    };
  }, [value]);

  return (
    <b ref={ref} className={className}>
      {fmt(value)}
    </b>
  );
}
