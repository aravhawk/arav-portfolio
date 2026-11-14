'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { span, story } from '@/lib/story';
import { statement } from '@/lib/content';

const words = statement.split(' ');

export default function Statement() {
  const root = useRef<HTMLElement>(null);
  const lit = useRef(-1);

  // Words light up one at a time as they cross a line two thirds down the screen.
  useFrame(() => {
    const el = root.current;
    if (!el || story.reduced) return;
    const r = el.getBoundingClientRect();
    const p = span(story.vh * 0.72 - r.top, r.height * 0.2, r.height * 0.62);
    const n = Math.round(p * words.length);
    if (n === lit.current) return;
    lit.current = n;
    const spans = el.querySelectorAll<HTMLSpanElement>('[data-w]');
    spans.forEach((s, i) => {
      const on = i < n ? 'true' : 'false';
      if (s.dataset.on !== on) s.dataset.on = on;
    });
  });

  return (
    <section ref={root} className="statement wrap front" data-chapter="statement" data-ground="#ffd60a" aria-label="About">
      <p className="statement-text" aria-label={statement}>
        {words.map((w, i) => (
          <span key={i} data-w aria-hidden="true">
            {w}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}
