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
    // far below the fold the paragraph stays fully lit; it only dims once it is about to arrive
    const n = r.top > story.vh * 1.15 ? words.length : Math.round(p * words.length);
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
      <p className="sr-only">{statement}</p>
      <p className="statement-text" aria-hidden="true">
        {words.map((w, i) => (
          <span key={i} data-w>
            {w}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}
