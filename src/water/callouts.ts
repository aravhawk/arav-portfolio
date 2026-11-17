/**
 * Callouts: captions tied to points in the flight's world. Each frame every
 * point is projected through the camera; the ring sits on the point, the
 * label above it to one side (or under it), and a hairline joins them. Only
 * transforms and opacity are written. Labels are kept clear of each other (a
 * label that would overlap one already placed is lifted above it) and a
 * callout fades when its point leaves the frame or its stretch of scroll.
 *
 * On a wide screen a station with many captions sets them as a fan: one row
 * over the points, in the points' order. On a narrow screen a station shows
 * its first three captions on their points, stepped so that no leader runs
 * behind a caption, and sets the rest as one line of captions over its words.
 */

import { type Basis, projectPoint, type V3 } from './camera';

interface Call {
  el: HTMLElement;
  ring: HTMLElement;
  line: HTMLElement;
  label: HTMLElement;
  at: V3;
  atWide: V3 | null;
  from: number;
  to: number;
  lift: number;
  liftWide: number;
  side: number;
  w: number;
  h: number;
  on: boolean | null;
  /** its place among its station's captions, and (narrow screens) whether it is one of the line */
  n: number;
  group: HTMLElement | null;
  loose: boolean | null;
}

export interface Callouts {
  measure(): void;
  frame(cam: Basis, aspect: number, viewW: number, viewH: number, s: number): void;
}

/** How many captions a station keeps on their points on a narrow screen. */
const KEEP = 3;

export function makeCallouts(): Callouts {
  const v3 = (str: string | undefined) => (str ? (str.split(',').map(Number) as V3) : null);
  const calls: Call[] = Array.from(document.querySelectorAll<HTMLElement>('[data-call]')).map((el) => ({
    el,
    ring: el.querySelector<HTMLElement>('.fl-call-ring')!,
    line: el.querySelector<HTMLElement>('.fl-call-line')!,
    label: el.querySelector<HTMLElement>('.fl-call-label')!,
    at: v3(el.dataset.call) ?? [0, 0, 0],
    atWide: v3(el.dataset.callWide),
    from: Number(el.dataset.callFrom),
    to: Number(el.dataset.callTo),
    lift: Number(el.dataset.callLift || 56),
    liftWide: Number(el.dataset.callWideLift || 0),
    side: Number(el.dataset.callSide || 1),
    w: 0,
    h: 0,
    on: null,
    n: el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0,
    group: el.parentElement,
    loose: null,
  }));
  /** Where each station's line of captions stands on a narrow screen: just over its words. */
  const lineY = new Map<HTMLElement, number>();

  const measure = () => {
    for (const c of calls) {
      c.w = c.label.offsetWidth;
      c.h = c.label.offsetHeight;
    }
    lineY.clear();
    for (const c of calls) {
      if (!c.group || lineY.has(c.group)) continue;
      // (The first line of the words that share this frame: its place in the layout, which no transform moves.)
      const first = c.group.parentElement?.querySelector<HTMLElement>('.fl-words > *');
      lineY.set(c.group, first ? first.offsetTop : -1);
    }
  };

  const placed: [number, number, number, number][] = [];

  const frame = (cam: Basis, aspect: number, viewW: number, viewH: number, s: number) => {
    placed.length = 0;
    const wide = aspect >= 0.9;
    // (A tablet held upright flies the phone's path and sets its words at the foot the same way.)
    const narrow = viewW < 720 || (viewW < 900 && !wide);
    // (The rail keeps the frame's right edge on a wide screen.)
    const edge = narrow ? 18 : 34;
    // Left to right, so a lifted label is always lifted over its left neighbour.
    const live: { c: Call; x: number; y: number }[] = [];
    const rows = new Map<HTMLElement, { x: number; y: number }>();
    for (const c of calls) {
      const inStretch = s >= c.from && s < c.to;
      // (A station with one caption more than that keeps them all on their points.)
      const loose = narrow && c.n >= KEEP && !!c.group && c.group.children.length > KEEP + 1 && (lineY.get(c.group) ?? -1) > 0;
      if (loose !== c.loose) {
        c.loose = loose;
        c.el.toggleAttribute('data-loose', loose);
      }
      let on = inStretch;
      let x = 0;
      let y = 0;
      if (on && !loose) {
        const p = projectPoint(cam, wide && c.atWide ? c.atWide : c.at, aspect);
        x = p[0] * viewW;
        y = p[1] * viewH;
        on = p[2] > 1 && x > 24 && x < viewW - 24 && y > 70 && y < viewH - 24;
      }
      if (on !== c.on) {
        c.on = on;
        c.el.toggleAttribute('data-on', on);
      }
      if (!on) continue;
      if (!c.w) measure();
      if (loose) {
        // One line of captions, wrapped if the screen is too narrow for it, standing just over the words.
        const top = lineY.get(c.group!)!;
        const row = rows.get(c.group!) ?? { x: 16, y: top - c.h - 12 };
        if (row.x + c.w > viewW - 16 && row.x > 16) {
          // (A second row goes above the first: the words keep their place.)
          row.x = 16;
          row.y -= c.h + 5;
        }
        c.label.style.transform = `translate3d(${row.x.toFixed(1)}px,${row.y.toFixed(1)}px,0)`;
        placed.push([row.x, row.y, c.w, c.h]);
        row.x += c.w + 5;
        rows.set(c.group!, row);
        continue;
      }
      live.push({ c, x, y });
    }
    live.sort((a, b) => a.x - b.x);
    const draw = (c: Call, x: number, y: number, lx: number, ly: number) => {
      // The leader runs from the ring to the label's near foot (to the middle of its top when it stands under its point).
      const under = ly > y;
      const fx = under ? Math.min(lx + c.w - 6, Math.max(lx + 6, x)) : lx + (lx + c.w / 2 > x ? 0 : c.w);
      const fy = under ? ly - 3 : ly + c.h + 3;
      const len = Math.hypot(fx - x, fy - y);
      const ang = Math.atan2(fy - y, fx - x);
      c.ring.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      c.line.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${ang.toFixed(4)}rad) scaleX(${Math.max(0, len - 5).toFixed(1)})`;
      c.label.style.transform = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0)`;
    };
    if (narrow) {
      // Stepped: each caption stands over its own point, on a line of its own, a hairline straight up to it.
      // Which caption takes which line is tried every way (there are at most four): the one that leaves no
      // leader behind a caption and no two captions touching is used, the shortest leaders among those.
      const n = Math.min(live.length, 4);
      if (!n) return;
      const h = live[0].c.h + 7;
      const top = Math.max(64 + n * h, Math.min(...live.map((l) => l.y)) - 26);
      const lxs = live.map(({ c, x }) => Math.min(viewW - edge - c.w, Math.max(14, x - c.w / 2)));
      let best: number[] = [];
      let least = Infinity;
      const order = Array.from({ length: n }, (_, i) => i);
      const tryOrder = (lv: number[]) => {
        let cost = 0;
        for (let i = 0; i < n; i++) {
          const a = live[i];
          const ay = top - (lv[i] + 1) * h;
          cost += (a.y - ay) * 0.001;
          for (let j = 0; j < n; j++) {
            if (j === i) continue;
            const b = live[j];
            const by = top - (lv[j] + 1) * h;
            // leader i (straight up from its point) behind caption j
            if (by > ay && a.x > lxs[j] - 3 && a.x < lxs[j] + b.c.w + 3) cost += 10;
            if (j > i && lv[i] === lv[j]) cost += 100;
          }
        }
        if (cost < least) {
          least = cost;
          best = lv.slice();
        }
      };
      const permute = (k: number) => {
        if (k === n) return tryOrder(order);
        for (let i = k; i < n; i++) {
          [order[k], order[i]] = [order[i], order[k]];
          permute(k + 1);
          [order[k], order[i]] = [order[i], order[k]];
        }
      };
      permute(0);
      for (let i = 0; i < n; i++) {
        const { c, x, y } = live[i];
        const ly = top - (best[i] + 1) * h;
        const fy = ly + c.h + 2;
        c.ring.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        c.line.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(-1.5708rad) scaleX(${Math.max(0, y - fy - 5).toFixed(1)})`;
        c.label.style.transform = `translate3d(${lxs[i].toFixed(1)}px,${ly.toFixed(1)}px,0)`;
      }
      return;
    }
    if (live.length > 4 && !live.some(({ c }) => (wide && c.atWide ? c.liftWide : c.lift) < 0)) {
      // A fan: many captions stand in one row over their points, in the points' own order, each as near
      // over its point as its neighbours allow. Every leader runs up to its own caption and the captions
      // share a line, so no leader crosses another or runs behind a caption.
      const n = live.length;
      const gap = 10;
      const h = live[0].c.h;
      const ly = Math.max(66, Math.min(...live.map((l) => l.y)) - 56 - h);
      const xs = live.map(({ c, x }) => x - c.w / 2);
      for (let i = 1; i < n; i++) xs[i] = Math.max(xs[i], xs[i - 1] + live[i - 1].c.w + gap);
      // (Pushed apart, the row has drifted right of its points: it is set back over them.)
      const drift = xs.reduce((sum, v, i) => sum + v - (live[i].x - live[i].c.w / 2), 0) / n;
      for (let i = 0; i < n; i++) xs[i] -= drift;
      xs[n - 1] = Math.min(xs[n - 1], viewW - edge - live[n - 1].c.w);
      for (let i = n - 2; i >= 0; i--) xs[i] = Math.min(xs[i], xs[i + 1] - gap - live[i].c.w);
      xs[0] = Math.max(xs[0], 14);
      for (let i = 1; i < n; i++) xs[i] = Math.max(xs[i], xs[i - 1] + live[i - 1].c.w + gap);
      live.forEach(({ c, x, y }, i) => {
        const fx = Math.min(xs[i] + c.w - 8, Math.max(xs[i] + 8, x));
        const fy = ly + h + 3;
        const len = Math.hypot(fx - x, fy - y);
        c.ring.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        c.line.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${Math.atan2(fy - y, fx - x).toFixed(4)}rad) scaleX(${Math.max(0, len - 5).toFixed(1)})`;
        c.label.style.transform = `translate3d(${xs[i].toFixed(1)}px,${ly.toFixed(1)}px,0)`;
      });
      return;
    }
    for (const { c, x, y } of live) {
      const scale = Math.min(1, viewW / 900);
      const lift = wide && c.atWide ? c.liftWide : c.lift;
      let lx: number;
      let ly: number;
      let down = lift < 0;
      if (down) {
        // Under its point, centred on it.
        lx = x - c.w / 2;
        ly = y - lift;
      } else {
        const dx = 26 * scale * c.side;
        lx = c.side > 0 ? x + dx : x + dx - c.w;
        ly = y - lift * (0.7 + 0.3 * scale) - c.h;
      }
      // The label keeps inside the frame's sides.
      lx = Math.min(viewW - c.w - edge, Math.max(14, lx));
      // A label that would overlap one already placed is lifted above it; at the top of the frame it is
      // set below instead, so two never share a place.
      for (let n = 0; n < 8; n++) {
        if (ly < 64) {
          ly = 64;
          down = true;
        }
        const hit = placed.find((r) => lx < r[0] + r[2] + 16 && lx + c.w + 16 > r[0] && ly < r[1] + r[3] + 5 && ly + c.h + 5 > r[1]);
        if (!hit) break;
        ly = down ? hit[1] + hit[3] + 6 : hit[1] - c.h - 6;
      }
      placed.push([lx, ly, c.w, c.h]);
      draw(c, x, y, lx, ly);
    }
  };

  return { measure, frame };
}
