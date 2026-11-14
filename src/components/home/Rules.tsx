'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { clamp, smooth, span, story } from '@/lib/story';
import { rules } from '@/lib/content';
import TLink from '@/components/shell/TLink';
import { Arrow } from './Arrow';

export default function Rules() {
  const root = useRef<HTMLElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const shown = useRef(-1);

  // One rule on screen at a time. Scroll hands over from one to the next.
  useFrame(() => {
    const el = root.current;
    if (!el || story.reduced) return;
    const r = el.getBoundingClientRect();
    const total = r.height - story.vh;
    const p = clamp(-r.top / Math.max(1, total));
    const items = el.querySelectorAll<HTMLElement>('.rule');
    const n = items.length;
    items.forEach((it, i) => {
      const local = p * n - i;
      const enter = i === 0 ? span(r.top, story.vh * 0.55, story.vh * 0.1) : smooth(span(local, -0.12, 0.1));
      const exit = i === n - 1 ? 0 : smooth(span(local, 0.84, 1.0));
      const o = enter * (1 - exit);
      it.style.opacity = o.toFixed(3);
      it.style.transform = `translate3d(0, ${((1 - enter) * 56 - exit * 56).toFixed(1)}px, 0)`;
      it.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    });
    const idx = Math.min(n - 1, Math.max(0, Math.floor(p * n + 0.12)));
    if (idx !== shown.current && count.current) {
      shown.current = idx;
      count.current.textContent = String(idx + 1).padStart(2, '0');
    }
  });

  return (
    <section
      ref={root}
      className="rules"
      data-chapter="rules"
      data-ground="#0a0a0a"
      aria-labelledby="rules-title"
      style={{ height: `${(rules.length + 1) * 90}svh` }}
    >
      <div className="pin front rules-pin">
        <div className="rules-head mono">
          <h2 id="rules-title" className="label mono">
            Rules I build by
          </h2>
          <span aria-hidden="true">
            <span ref={count}>01</span> / {String(rules.length).padStart(2, '0')}
          </span>
        </div>
        {rules.map((rule) => {
          const internal = rule.href.startsWith('/');
          return (
            <article className="rule" key={rule.text}>
              <p className="rule-text">{rule.text}</p>
              <div className="rule-foot">
                <p className="rule-note">{rule.note}</p>
                {internal ? (
                  <TLink className="rule-src mono" href={rule.href}>
                    {rule.from} <Arrow />
                  </TLink>
                ) : (
                  <a className="rule-src mono" href={rule.href} target="_blank" rel="noopener noreferrer">
                    {rule.from} <Arrow out />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
