'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { clamp, smooth, span, story } from '@/lib/story';
import { ventures } from '@/lib/content';
import { useShell } from '@/components/shell/Shell';
import { Arrow } from './Arrow';

export default function Timeline() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const years = useRef<HTMLDivElement>(null);
  const { scrollTo } = useShell();

  // Keyboard focus on a venture that is off to the side scrolls the run to it.
  const reveal = (i: number) => {
    const el = root.current;
    if (!el || story.reduced || story.vw < 900) return;
    const r = el.getBoundingClientRect();
    scrollTo(r.top + window.scrollY + (i / Math.max(1, ventures.length - 1)) * (r.height - story.vh));
  };

  // Vertical scroll becomes a sideways run along the years. The run rests with one venture squared to the
  // left margin, moves, then rests on the next. The numerals sit behind the band and travel slower than the cards.
  useFrame(() => {
    const el = root.current;
    const tr = track.current;
    const yr = years.current;
    if (!el || !tr || !yr || story.reduced || story.vw < 900) return;
    const r = el.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - story.vh));
    const first = tr.children[0] as HTMLElement | undefined;
    if (!first) return;
    const w = first.offsetWidth;
    const f = p * (ventures.length - 1);
    const i = Math.min(ventures.length - 2, Math.floor(f));
    const x = -(i + smooth(span(f - i, 0.28, 0.72))) * w;
    tr.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    yr.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    for (let k = 0; k < yr.children.length; k++) {
      const y = yr.children[k].firstElementChild as HTMLElement;
      y.style.transform = `translate3d(${((x + k * w) * -0.16).toFixed(1)}px, 0, 0)`;
    }
  });

  return (
    <section
      ref={root}
      className="timeline g-paper"
      data-chapter="timeline"
      data-ground="#f2f2f2"
      aria-labelledby="timeline-title"
      style={{ height: `${ventures.length * 110 + 40}svh` }}
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
          {ventures.map((v, i) => (
            <article className="venture" key={v.name} onFocus={() => reveal(i)}>
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
                    <a className="link tap" href={v.href} target="_blank" rel="noopener noreferrer">
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
