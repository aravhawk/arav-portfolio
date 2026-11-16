/**
 * Callouts: captions tied to points in the flight's world. Each frame every
 * point is projected through the camera; the ring sits on the point, the
 * label above it to one side, and a hairline joins them. Only transforms and
 * opacity are written. Labels are kept clear of each other (a label that
 * would overlap one already placed is lifted above it) and a callout fades
 * when its point leaves the frame or its stretch of scroll.
 */

import { type Basis, projectPoint, type V3 } from './camera';

interface Call {
  el: HTMLElement;
  ring: HTMLElement;
  line: HTMLElement;
  label: HTMLElement;
  at: V3;
  from: number;
  to: number;
  lift: number;
  side: number;
  w: number;
  h: number;
  on: boolean | null;
}

export interface Callouts {
  measure(): void;
  frame(cam: Basis, aspect: number, viewW: number, viewH: number, s: number): void;
}

export function makeCallouts(): Callouts {
  const calls: Call[] = Array.from(document.querySelectorAll<HTMLElement>('[data-call]')).map((el) => ({
    el,
    ring: el.querySelector<HTMLElement>('.fl-call-ring')!,
    line: el.querySelector<HTMLElement>('.fl-call-line')!,
    label: el.querySelector<HTMLElement>('.fl-call-label')!,
    at: (el.dataset.call || '0,0,0').split(',').map(Number) as V3,
    from: Number(el.dataset.callFrom),
    to: Number(el.dataset.callTo),
    lift: Number(el.dataset.callLift || 56),
    side: Number(el.dataset.callSide || 1),
    w: 0,
    h: 0,
    on: null,
  }));

  const measure = () => {
    for (const c of calls) {
      c.w = c.label.offsetWidth;
      c.h = c.label.offsetHeight;
    }
  };

  const placed: [number, number, number, number][] = [];

  const frame = (cam: Basis, aspect: number, viewW: number, viewH: number, s: number) => {
    placed.length = 0;
    // Left to right, so a lifted label is always lifted over its left neighbour.
    const live: { c: Call; x: number; y: number }[] = [];
    for (const c of calls) {
      let on = s >= c.from && s < c.to;
      let x = 0;
      let y = 0;
      if (on) {
        const p = projectPoint(cam, c.at, aspect);
        x = p[0] * viewW;
        y = p[1] * viewH;
        on = p[2] > 1 && x > 24 && x < viewW - 24 && y > 70 && y < viewH - 24;
      }
      if (on !== c.on) {
        c.on = on;
        c.el.toggleAttribute('data-on', on);
      }
      if (on) live.push({ c, x, y });
    }
    live.sort((a, b) => a.x - b.x);
    for (const { c, x, y } of live) {
      if (!c.w) measure();
      const scale = Math.min(1, viewW / 900);
      const dx = 26 * scale * c.side;
      // The label keeps inside the frame's sides.
      let lx = c.side > 0 ? x + dx : x + dx - c.w;
      lx = Math.min(viewW - c.w - 14, Math.max(14, lx));
      let ly = y - c.lift * (0.7 + 0.3 * scale) - c.h;
      for (let n = 0; n < 6; n++) {
        const hit = placed.find((r) => lx < r[0] + r[2] + 10 && lx + c.w + 10 > r[0] && ly < r[1] + r[3] + 5 && ly + c.h + 5 > r[1]);
        if (!hit) break;
        ly = hit[1] - c.h - 6;
      }
      ly = Math.max(64, ly);
      placed.push([lx, ly, c.w, c.h]);
      // The leader runs from the ring to the label's near foot.
      const fx = lx + (lx + c.w / 2 > x ? 0 : c.w);
      const fy = ly + c.h + 3;
      const len = Math.hypot(fx - x, fy - y);
      const ang = Math.atan2(fy - y, fx - x);
      c.ring.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      c.line.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${ang.toFixed(4)}rad) scaleX(${Math.max(0, len - 5).toFixed(1)})`;
      c.label.style.transform = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0)`;
    }
  };

  return { measure, frame };
}
