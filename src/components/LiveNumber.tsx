'use client';

import { useEffect, useRef } from 'react';

import { countAt } from '@/lib/count-up';

interface Props {
  /** The value to show (already max(live, snapshot) on the server). */
  value: number;
  /** The committed snapshot value: where the readout starts counting from. */
  from: number;
  /** Public page the number was read from. */
  source: string;
  /** e.g. "Nov 15, 2026, 4:40 AM CT" */
  asOf: string;
  /** What the number counts, for assistive tech and the tooltip. */
  what: string;
  /**
   * Whether hovering shows the "as of" note. It is drawn from an attribute, never a text node, so the words around
   * the number read as one phrase to anything that extracts text. Off inside a heading or a line of words: the
   * time the numbers were read is said once, in the small line at the foot of the page.
   */
  tip?: boolean;
  className?: string;
}

const fmt = new Intl.NumberFormat('en-US');

/** Each digit sits in a 1ch cell, so the readout never changes width. */
function cells(n: number): string {
  return fmt
    .format(n)
    .split('')
    .map((c) => (c >= '0' && c <= '9' ? `<span class="digit">${c}</span>` : `<span class="sep">${c}</span>`))
    .join('');
}

/**
 * An instrument readout. The server renders the final value, so there is no
 * layout shift and no empty state. When it first comes into view it counts
 * once from the snapshot value to the live one, then never moves again.
 */
export function LiveNumber({ value, from, source, asOf, what, className, tip = true }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || from === value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const dur = 1100;
        const step = (now: number) => {
          const t = (now - t0) / dur;
          el.innerHTML = cells(countAt(from, value, t));
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [from, value]);

  return (
    <a
      className={`metric ${className ?? ''}`}
      href={source}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={tip ? `${fmt.format(value)} ${what}, as of ${asOf}. Opens the source.` : `${fmt.format(value)} ${what}. Opens the source.`}
      data-tip={tip ? `as of ${asOf}` : undefined}
    >
      <span ref={ref} className="metric-value" aria-hidden="true" dangerouslySetInnerHTML={{ __html: cells(value) }} />
    </a>
  );
}
