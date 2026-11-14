'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { clamp, smooth, story } from '@/lib/story';

export default function Hero() {
  const a = useRef<HTMLSpanElement>(null);
  const b = useRef<HTMLSpanElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const last = useRef(-1);

  // The two halves of the name part like doors as the camera drops toward the band.
  useFrame(() => {
    if (story.reduced) return;
    const p = smooth(clamp(story.scrollY / (story.vh * 0.9)));
    if (Math.abs(p - last.current) < 0.0005) return;
    last.current = p;
    if (a.current) a.current.style.transform = `translate3d(${(-p * 22).toFixed(2)}vw, 0, 0)`;
    if (b.current) b.current.style.transform = `translate3d(${(p * 22).toFixed(2)}vw, 0, 0)`;
    if (hud.current) hud.current.style.opacity = p > 0.001 ? String(1 - clamp(p * 2.4)) : '';
  });

  return (
    <section className="hero g-yellow" data-chapter="hero" data-ground="#ffd60a" aria-label="Introduction">
      <div className="pin behind">
        <h1 className="hero-name" aria-label="Arav Jain">
          <span className="hero-line" ref={a} aria-hidden="true">
            <span>Arav</span>
          </span>
          <span className="hero-line" ref={b} aria-hidden="true">
            <span>Jain</span>
          </span>
        </h1>
      </div>
      <div className="pin front">
        <div className="hero-hud" ref={hud}>
          <p className="hero-role">Co-founder of Infiniflop Labs, est. 2026. I build AI agents and dev tools.</p>
          <div className="hero-meta mono">
            <span>Now: building Infiniview</span>
            <span>Scroll</span>
          </div>
        </div>
      </div>
    </section>
  );
}
