'use client';

import { useEffect, useRef } from 'react';
import { onFrame } from '@/lib/frame';

/**
 * The statement lights up word by word as it crosses the middle of the
 * view. It is a function of scroll position, so it reverses exactly and
 * never plays on its own. Under reduced motion every word is simply lit.
 */
export function Statement({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(' ');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>('[data-w]'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spans.forEach((s) => s.setAttribute('data-lit', ''));
      return;
    }
    let top = 0;
    let height = 1;
    let lit = -1;
    let visible = false;
    const measure = () => {
      const r = el.getBoundingClientRect();
      top = r.top + window.scrollY;
      height = r.height;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)), { rootMargin: '20% 0px' });
    io.observe(el);
    const off = onFrame(() => {
      if (!visible) return;
      const vh = window.innerHeight;
      // 0 when the block's top reaches 82% of the view, 1 when its bottom
      // passes 46%.
      const start = top - vh * 0.82;
      const end = top + height - vh * 0.46;
      const p = Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, end - start)));
      const n = Math.round(p * spans.length);
      if (n === lit) return;
      lit = n;
      for (let i = 0; i < spans.length; i++) spans[i].toggleAttribute('data-lit', i < n);
    }, 30);
    return () => {
      off();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <p ref={ref} className={`say-text ${className ?? ''}`}>
      {words.map((w, i) => (
        <span key={i} data-w className="say-word">
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
