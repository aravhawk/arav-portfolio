'use client';

import { useEffect, useRef } from 'react';
import { onFrame, story } from '@/lib/story';

/**
 * A follower, not a replacement: the system cursor stays.
 * Over anything with data-cursor it opens into a small label.
 */
export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const label = labelRef.current;
    if (!el || !label) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let tx = -100;
    let ty = -100;
    let x = tx;
    let y = ty;
    let seen = false;
    let last = performance.now();
    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!seen) {
        seen = true;
        x = tx;
        y = ty;
        el.dataset.on = 'true';
      }
      const target = (e.target as Element | null)?.closest?.('[data-cursor]') as HTMLElement | null;
      const text = target?.dataset.cursor ?? '';
      if (text) {
        if (label.textContent !== text) label.textContent = text;
        el.dataset.label = 'true';
      } else el.dataset.label = 'false';
    };
    const leave = () => {
      el.dataset.on = 'false';
      seen = false;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    const off = onFrame((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = story.reduced ? 1 : 1 - Math.exp(-dt * 18);
      x += (tx - x) * k;
      y += (ty - y) * k;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
    return () => {
      off();
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <div ref={ref} className="cursor" data-on="false" data-label="false" aria-hidden="true">
      <span ref={labelRef} className="cursor-label mono" />
    </div>
  );
}
