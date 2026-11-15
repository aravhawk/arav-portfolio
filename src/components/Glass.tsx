'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { buildGlassMap, isBlink } from '@/lib/glassmap';

type Props = {
  as?: 'div' | 'li' | 'a' | 'article' | 'nav' | 'label' | 'section';
  className?: string;
  children?: ReactNode;
  /** Bend the backdrop at the edges (Blink only). Small chips skip it. */
  refract?: boolean;
  radius?: number;
  style?: CSSProperties;
  [key: string]: unknown;
};

/* One pointer listener for every pane on the page. */
const panes = new Set<HTMLElement>();
let bound = false;
let px = -1;
let py = -1;
let queued = false;
const angles = new WeakMap<HTMLElement, number>();

function update() {
  queued = false;
  panes.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < -100 || r.top > window.innerHeight + 100) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // Conic gradients measure from 12 o'clock, clockwise.
    let a = (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI;
    const prev = angles.get(el) ?? -45;
    // Unwrap so the light takes the short way round.
    a += Math.round((prev - a) / 360) * 360;
    angles.set(el, a);
    const dist = Math.hypot(px - cx, py - cy);
    const near = Math.max(0, 1 - dist / 900);
    el.style.setProperty('--rim-a', `${a.toFixed(1)}deg`);
    el.style.setProperty('--rim-o', (0.55 + near * 0.45).toFixed(2));
    el.style.setProperty('--mx', `${(px - r.left).toFixed(0)}px`);
    el.style.setProperty('--my', `${(py - r.top).toFixed(0)}px`);
  });
}

function bind() {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  window.addEventListener(
    'pointermove',
    (e) => {
      px = e.clientX;
      py = e.clientY;
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
}

export default function Glass({ as = 'div', className = '', children, refract = false, radius = 28, style, ...rest }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [map, setMap] = useState<{ url: string; w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    bind();
    panes.add(el);
    return () => {
      panes.delete(el);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !refract || !isBlink()) return;
    if (window.matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)').matches) return;
    let t = 0;
    const make = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w < 40 || h < 40) return;
      const rad = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || radius, h / 2);
      setMap({ url: buildGlassMap(w, h, rad, Math.min(34, h / 2.4)), w, h });
    };
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(make, 120);
    });
    ro.observe(el);
    make();
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [refract, radius]);

  const filterId = `lg${id}`;
  const scale = 66;
  const Tag = as as 'div';
  const cls = `glass ${map ? 'glass--svg' : ''} ${className}`.trim();
  const st = map ? ({ ...style, '--lg': `url(#${filterId})` } as CSSProperties) : style;

  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} data-glass="" className={cls} style={st} {...rest}>
      {map ? (
      <svg className="glass-defs" aria-hidden="true" focusable="false">
        <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
          <feImage href={map.url} x="0" y="0" width={map.w} height={map.h} preserveAspectRatio="none" result="m" />
          {/* One displacement per channel, each a little stronger: that spread is the dispersion at the rim. */}
          <feDisplacementMap in="b" in2="m" scale={scale} xChannelSelector="R" yChannelSelector="G" result="dr" />
          <feColorMatrix in="dr" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feDisplacementMap in="b" in2="m" scale={scale * 1.14} xChannelSelector="R" yChannelSelector="G" result="dg" />
          <feColorMatrix in="dg" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feDisplacementMap in="b" in2="m" scale={scale * 1.28} xChannelSelector="R" yChannelSelector="G" result="db" />
          <feColorMatrix in="db" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bl" />
          <feBlend in="r" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="bl" mode="screen" />
        </filter>
      </svg>
    ) : null}
      {children}
    </Tag>
  );
}
