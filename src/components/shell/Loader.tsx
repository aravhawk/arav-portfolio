'use client';

import { useEffect, useRef, useState } from 'react';

const MIN_MS = 900;
const MAX_MS = 4200;

/**
 * The loading moment: a count and a hairline. When the fonts and the first 3D frame are in,
 * the sheet lifts and the page takes over. Skipped entirely under reduced motion.
 */
export default function Loader({ ready, onRevealed }: { ready: boolean; onRevealed: () => void }) {
  const [gone, setGone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const readyRef = useRef(ready);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onRevealed();
      const t = window.setTimeout(() => setGone(true), 0);
      return () => window.clearTimeout(t);
    }
    const start = performance.now();
    let shown = 0;
    let raf = 0;
    let done = false;
    let timer = 0;
    const tick = (now: number) => {
      const t = now - start;
      const isReady = readyRef.current || t > MAX_MS;
      // creep toward 86 while waiting, then run to 100
      const target = isReady && t > MIN_MS * 0.6 ? 100 : Math.min(86, (t / MIN_MS) * 70);
      shown += (target - shown) * (target === 100 ? 0.16 : 0.08);
      if (target === 100 && shown > 99.4) shown = 100;
      if (numRef.current) numRef.current.textContent = String(Math.round(shown)).padStart(3, '0');
      if (lineRef.current) lineRef.current.style.transform = `scaleX(${(shown / 100).toFixed(4)})`;
      if (shown >= 100 && t > MIN_MS && !done) {
        done = true;
        if (rootRef.current) rootRef.current.dataset.state = 'out';
        onRevealed();
        timer = window.setTimeout(() => setGone(true), 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [onRevealed]);

  if (gone) return null;
  return (
    <div ref={rootRef} className="loader" data-state="in" aria-hidden="true">
      <div className="loader-top">
        <div className="loader-row mono">
          <span>Arav Jain</span>
          <span>Loop 01</span>
        </div>
        <span className="loader-track">
          <span ref={lineRef} className="loader-line" />
        </span>
      </div>
      <div className="loader-num">
        <span ref={numRef}>000</span>
      </div>
    </div>
  );
}
