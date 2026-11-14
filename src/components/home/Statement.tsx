'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { clamp, smooth, span, story } from '@/lib/story';
import { interests, statement } from '@/lib/content';

const words = statement.split(' ');

export default function Statement() {
  const root = useRef<HTMLElement>(null);
  const lit = useRef(-1);
  const pin = useRef<HTMLDivElement>(null);

  // The paragraph is held in place while its words light up in reading order.
  useFrame(() => {
    const el = root.current;
    if (!el || story.reduced) return;
    const r = el.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - story.vh));
    // far below the fold the paragraph stays fully lit; it only dims once it is about to arrive
    const n = r.top > story.vh * 1.15 ? words.length : Math.round(span(p, 0.06, 0.7) * words.length);
    // the paragraph is gone before the camera leaves for the next chapter
    if (pin.current) pin.current.style.opacity = (1 - smooth(span(p, 0.86, 0.98))).toFixed(3);
    if (n === lit.current) return;
    lit.current = n;
    el.querySelectorAll<HTMLSpanElement>('[data-w]').forEach((s, i) => {
      const on = i < n ? 'true' : 'false';
      if (s.dataset.on !== on) s.dataset.on = on;
    });
  });

  return (
    <section ref={root} className="statement g-yellow" data-chapter="statement" data-ground="#ffd60a" aria-label="About">
      <div className="pin front statement-pin" ref={pin}>
        <p className="sr-only">{statement}</p>
        <p className="statement-text" aria-hidden="true">
          {words.map((w, i) => (
            <span key={i} data-w>
              {w}{' '}
            </span>
          ))}
        </p>
        <dl className="into mono">
          {interests.map((it) => (
            <div key={it.label}>
              <dt>{it.label}</dt>
              <dd>{it.proof}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
