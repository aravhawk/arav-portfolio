'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { clamp, story } from '@/lib/story';
import { ventures } from '@/lib/content';
import { Arrow } from './Arrow';

export default function Timeline() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const years = useRef<HTMLDivElement>(null);

  // Vertical scroll becomes a sideways run along the years. The numerals sit behind the band and lag the cards.
  useFrame(() => {
    const el = root.current;
    const tr = track.current;
    const yr = years.current;
    if (!el || !tr || !yr || story.reduced || story.vw < 900) return;
    const r = el.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - story.vh));
    const max = Math.max(0, tr.scrollWidth - story.vw);
    const x = -p * max;
    tr.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    yr.style.transform = `translate3d(${(x * 0.86).toFixed(1)}px, 0, 0)`;
  });

  return (
    <section
      ref={root}
      className="timeline"
      data-chapter="timeline"
      data-ground="#f2f2f2"
      aria-labelledby="timeline-title"
      style={{ height: `${ventures.length * 100 + 60}svh` }}
    >
      <div className="pin behind timeline-back" aria-hidden="true">
        <div className="timeline-track" ref={years}>
          {ventures.map((v) => (
            <div className="venture" key={v.name}>
              <p className="venture-year">{v.year}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="pin front timeline-front">
        <div className="timeline-head mono">
          <h2 id="timeline-title" className="label mono">
            Ventures
          </h2>
          <span>2020 to now</span>
        </div>
        <div className="timeline-track" ref={track}>
          {ventures.map((v) => (
            <article className="venture" key={v.name}>
              <p className="venture-year venture-year-inline" aria-hidden="true">
                {v.year}
              </p>
              <div className="venture-body">
                <div className="venture-row mono">
                  <span className="tag" data-live={v.state === 'Building' ? '' : undefined}>
                    {v.state}
                  </span>
                  <span>Est. {v.year}</span>
                </div>
                <h3 className="venture-name">{v.name}</h3>
                <p className="venture-line">{v.line}</p>
                {v.href ? (
                  <div className="venture-row mono">
                    <a className="link" href={v.href} target="_blank" rel="noopener noreferrer">
                      {v.hrefLabel}
                    </a>
                    <Arrow out />
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
