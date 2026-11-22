/**
 * The geometry of the home page's captions, kept free of the DOM so it can
 * be tested across the whole scroll range (tests/water/words.test.ts).
 *
 * A station's captions are one system: the whole name in small mono type, a
 * hairline leader and a ring on the thing it names, laid out so that no
 * caption meets another, no leader crosses another or runs behind a
 * caption, and all of it stands clear of the nav. (How a station's block of
 * words builds, step by step, is in src/app/page.tsx and flight.css.)
 */

import { TRIBS, tribPoint } from './world';
import type { V3 } from './camera';

/** The nav is 44 px tall, 14 px from the top of the frame: nothing of the words' layer stands nearer than 24 px under it. */
export const NAV_CLEAR = 84;

/** Where each stream's caption lands: on the stream itself as it is drawn (the world says where: tribPoint). */
export const streamAnchors = (): V3[] => TRIBS.map((_, i) => tribPoint(i));
/** A caption to place: its point in the frame, its label's size, and how its station wants it set. */
export interface Cap {
  x: number;
  y: number;
  w: number;
  h: number;
  /** how far above its point the label stands, px; negative: that far under it */
  lift: number;
  /** 1: the label runs to the right of its point, -1: to the left */
  side: number;
}
/** A caption placed: its label's corner, and where its leader meets the label. */
export interface Placed {
  lx: number;
  ly: number;
  fx: number;
  fy: number;
}

/** True when a wide frame's captions stand as a fan: one row over their points, in the points' order. */
export const isFan = (caps: Cap[]) => caps.length > 4 && !caps.some((c) => c.lift < 0);

/**
 * Captions on a wide frame. Given in any order; returned in the same order.
 * `edge` is the room kept at the frame's sides.
 */
export function layoutCaptions(caps: Cap[], viewW: number, edge: number): Placed[] {
  const out: Placed[] = new Array(caps.length);
  const order = caps.map((_, i) => i).sort((a, b) => caps[a].x - caps[b].x);
  const n = order.length;
  if (!n) return out;
  if (isFan(caps)) {
    // Many captions stand in one row over their points, in the points' own order, each as near over its
    // point as its neighbours allow. Every leader runs up to its own caption and the captions share a
    // line, so no leader crosses another or runs behind a caption.
    const gap = 14;
    const h = caps[order[0]].h;
    const ly = Math.max(NAV_CLEAR, Math.min(...caps.map((c) => c.y)) - 58 - h);
    const xs = order.map((i) => caps[i].x - caps[i].w / 2);
    const w = (k: number) => caps[order[k]].w;
    for (let k = 1; k < n; k++) xs[k] = Math.max(xs[k], xs[k - 1] + w(k - 1) + gap);
    // (Pushed apart, the row has drifted right of its points: it is set back over them.)
    const drift = xs.reduce((sum, v, k) => sum + v - (caps[order[k]].x - w(k) / 2), 0) / n;
    for (let k = 0; k < n; k++) xs[k] -= drift;
    xs[n - 1] = Math.min(xs[n - 1], viewW - edge - w(n - 1));
    for (let k = n - 2; k >= 0; k--) xs[k] = Math.min(xs[k], xs[k + 1] - gap - w(k));
    xs[0] = Math.max(xs[0], 14);
    for (let k = 1; k < n; k++) xs[k] = Math.max(xs[k], xs[k - 1] + w(k - 1) + gap);
    order.forEach((i, k) => {
      const c = caps[i];
      out[i] = { lx: xs[k], ly, fx: Math.min(xs[k] + c.w - 8, Math.max(xs[k] + 8, c.x)), fy: ly + h + 3 };
    });
    return out;
  }
  const scale = Math.min(1, viewW / 900);
  const placed: [number, number, number, number][] = [];
  for (const i of order) {
    const c = caps[i];
    let lx: number;
    let ly: number;
    let down = c.lift < 0;
    if (down) {
      // Under its point, beginning at it: the label reads on from its own leader.
      lx = c.x - 8;
      ly = c.y - c.lift;
    } else {
      const dx = 26 * scale * c.side;
      lx = c.side > 0 ? c.x + dx : c.x + dx - c.w;
      ly = c.y - c.lift * (0.7 + 0.3 * scale) - c.h;
    }
    // The label keeps inside the frame's sides.
    lx = Math.min(viewW - c.w - edge, Math.max(14, lx));
    // A label that would meet one already placed is lifted above it; under the nav it is set below
    // instead, so two never share a place.
    for (let k = 0; k < 8; k++) {
      if (ly < NAV_CLEAR) {
        ly = NAV_CLEAR;
        down = true;
      }
      const hit = placed.find((r) => lx < r[0] + r[2] + 16 && lx + c.w + 16 > r[0] && ly < r[1] + r[3] + 5 && ly + c.h + 5 > r[1]);
      if (!hit) break;
      ly = down ? hit[1] + hit[3] + 6 : hit[1] - c.h - 6;
    }
    placed.push([lx, ly, c.w, c.h]);
    // The leader runs from the ring to the label's near foot (to its top when it stands under its point).
    const under = ly > c.y;
    out[i] = {
      lx,
      ly,
      fx: under ? Math.min(lx + c.w - 6, Math.max(lx + 6, c.x)) : lx + (lx + c.w / 2 > c.x ? 0 : c.w),
      fy: under ? ly - 3 : ly + c.h + 3,
    };
  }
  return out;
}

/**
 * Captions on a narrow frame: one list, a name to a line, in the streams' own
 * order, standing just over the station's words (`left`, `bottom`: its lower
 * left corner). No rings and no leaders: the order is the key.
 */
export function layoutList(sizes: { w: number; h: number }[], left: number, bottom: number, gap = 4): Placed[] {
  const out: Placed[] = new Array(sizes.length);
  let y = bottom;
  for (let i = sizes.length - 1; i >= 0; i--) {
    y -= sizes[i].h;
    out[i] = { lx: left, ly: y, fx: left, fy: y };
    y -= gap;
  }
  return out;
}

/**
 * Up to four captions on a narrow frame, stepped: each stands over its own
 * point on a line of its own, a hairline straight up to it. Which caption
 * takes which line is tried every way; the one that leaves no leader behind
 * a caption is used, the shortest leaders among those.
 */
export function layoutStepped(caps: Cap[], viewW: number, edge: number): Placed[] {
  const n = caps.length;
  const out: Placed[] = new Array(n);
  if (!n) return out;
  const h = caps[0].h + 7;
  const top = Math.max(NAV_CLEAR + n * h, Math.min(...caps.map((c) => c.y)) - 26);
  const lxs = caps.map((c) => Math.min(viewW - edge - c.w, Math.max(14, c.x - c.w / 2)));
  let best: number[] = [];
  let least = Infinity;
  const order = caps.map((_, i) => i);
  const tryOrder = (lv: number[]) => {
    let cost = 0;
    for (let i = 0; i < n; i++) {
      const ay = top - (lv[i] + 1) * h;
      cost += (caps[i].y - ay) * 0.001;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const by = top - (lv[j] + 1) * h;
        // leader i (straight up from its point) behind caption j
        if (by > ay && caps[i].x > lxs[j] - 3 && caps[i].x < lxs[j] + caps[j].w + 3) cost += 10;
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
  if (n <= 5) permute(0);
  else best = order;
  caps.forEach((c, i) => {
    const ly = top - (best[i] + 1) * h;
    out[i] = { lx: lxs[i], ly, fx: c.x, fy: ly + c.h + 2 };
  });
  return out;
}
