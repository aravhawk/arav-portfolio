/**
 * Callouts: captions tied to points in the flight's world. Each frame every
 * point is projected through the camera; the ring sits on the point, the
 * label above it to one side, and a hairline joins them. Only transforms and
 * opacity are written. Labels are kept clear of each other (a label that
 * would overlap one already placed is lifted above it; a row of points
 * close together is captioned as a fan, so no leader crosses a caption) and
 * a callout fades when its point leaves the frame or its stretch of scroll.
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
      // (The caption's own size: what lies under it, where anything does, is not part of it.)
      const cs = getComputedStyle(c.label);
      c.w = c.label.offsetWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      c.h = c.label.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) + 2;
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
    // A row of points close together (a callout whose lift is negative belongs to one) is captioned as a fan:
    // each caption stands straight over its own point and runs out to one side of it, on a line of its own
    // choosing. A caption that passes over another point must stand above that point's caption, so no leader
    // ever crosses a caption and none needs a plate. Every way of siding the captions is tried; the lowest
    // arrangement is kept.
    const fanned = live.filter((l) => l.c.lift < 0);
    const spot = new Map<Call, [number, number]>();
    if (fanned.length) {
      for (const l of fanned) if (!l.c.w) measure();
      const n = fanned.length;
      const scale = Math.min(1, viewW / 900);
      const rowH = fanned[0].c.h + 1;
      const top = Math.min(...fanned.map((l) => l.y)) + fanned[0].c.lift * (0.7 + 0.3 * scale) - fanned[0].c.h;
      const rows = Math.max(1, Math.min(9, Math.floor((top - 58) / rowH) + 1));
      let best: { cost: number; x0: number[]; level: number[] } | null = null;
      const x0 = new Array<number>(n);
      const level = new Array<number>(n);
      // (Where the frame is too small for that, a leader may pass behind a caption: captions still never touch.)
      for (let strict = 1; strict >= 0 && !best; strict--) {
        for (let m = 0; m < 1 << n; m++) {
          let ok = true;
          let inward = 0;
          for (let i = 0; i < n && ok; i++) {
            const right = (m >> i) & 1;
            const { c, x } = fanned[i];
            x0[i] = right ? x - 7 : x + 7 - c.w;
            if (x0[i] < 12 || x0[i] + c.w > viewW - 12) ok = false;
            if (right !== (x > viewW / 2 ? 1 : 0)) inward++;
            level[i] = 0;
          }
          if (!ok) continue;
          // Raise captions until each stands above every point it passes over and beside no other on its line.
          for (let pass = 0; pass < 24 && ok; pass++) {
            let moved = false;
            for (let i = 0; i < n; i++) {
              const wi = fanned[i].c.w;
              for (let j = 0; j < n; j++) {
                if (j === i) continue;
                const over = strict === 1 && fanned[j].x > x0[i] - 5 && fanned[j].x < x0[i] + wi + 5;
                const beside = level[j] === level[i] && j < i && x0[i] < x0[j] + fanned[j].c.w + 9 && x0[i] + wi + 9 > x0[j];
                if ((over && level[i] <= level[j]) || beside) {
                  level[i] = level[j] + 1;
                  moved = true;
                }
              }
              if (level[i] >= rows) ok = false;
            }
            if (!moved) break;
            if (pass === 23) ok = false;
          }
          if (!ok) continue;
          const cost = Math.max(...level) * 16 + inward;
          if (!best || cost < best.cost) best = { cost, x0: x0.slice(), level: level.slice() };
        }
      }
      fanned.forEach((l, i) => {
        // (Where no arrangement is clean the captions go up a line each, left to right.)
        const lx = best ? best.x0[i] : Math.min(viewW - l.c.w - 12, Math.max(12, l.x - 7));
        const lv = best ? best.level[i] : i % rows;
        spot.set(l.c, [lx, Math.max(58, top - lv * rowH)]);
      });
    }
    for (const { c, x, y } of live) {
      if (!c.w) measure();
      const scale = Math.min(1, viewW / 900);
      let lx = 0;
      let ly = 0;
      const fan = spot.get(c);
      if (fan) {
        [lx, ly] = fan;
      } else {
        const dx = 26 * scale * c.side;
        // The label keeps inside the frame's sides.
        lx = c.side > 0 ? x + dx : x + dx - c.w;
        lx = Math.min(viewW - c.w - 14, Math.max(14, lx));
        ly = y - c.lift * (0.7 + 0.3 * scale) - c.h;
        // A label that would overlap one already placed is lifted above it; at the top of the frame it is
        // set below instead, so two never share a place.
        let down = false;
        for (let n = 0; n < 8; n++) {
          if (ly < 64) {
            ly = 64;
            down = true;
          }
          const hit = placed.find((r) => lx < r[0] + r[2] + 16 && lx + c.w + 16 > r[0] && ly < r[1] + r[3] + 5 && ly + c.h + 5 > r[1]);
          if (!hit) break;
          ly = down ? hit[1] + hit[3] + 6 : hit[1] - c.h - 6;
        }
      }
      placed.push([lx, ly, c.w, c.h]);
      // The leader runs from the ring to the label's near foot.
      const fx = fan ? Math.min(lx + c.w - 3, Math.max(lx + 3, x)) : lx + (lx + c.w / 2 > x ? 0 : c.w);
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
