/**
 * Callouts: captions tied to points in the flight's world. Each frame every
 * point is projected through the camera; the ring sits on the point, the
 * label above it to one side (or under it), and a hairline joins them. Only
 * transforms and opacity are written. Labels are kept clear of each other (a
 * label that would overlap one already placed is lifted above it) and a
 * callout fades when its point leaves the frame or its stretch of scroll.
 *
 * One system at every width and in both themes: the whole name as its own
 * project writes it, in small mono type, a hairline leader, a ring on the
 * thing it names. On a wide screen a station with many captions sets them
 * as a fan: one row over the points, in the points' order. On a narrow
 * screen up to four captions stand stepped over their points; a station
 * with more sets them all as one list, a name to a line, in the streams'
 * order, in the room its block of words keeps for it (`data-calls-slot`:
 * beside the count they itemise, on the same ground as the words). The
 * geometry is in words.ts, where it is tested.
 */

import { type Basis, projectPoint, type V3 } from './camera';
import { NAV_CLEAR, layoutCaptions, layoutList, layoutStepped } from './words';

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
  /** Sets every caption for this frame. Returns where the captions tied to their points stand (x0, y0, x1, y1 in px), or null when there are none. */
  frame(cam: Basis, aspect: number, viewW: number, viewH: number, s: number): [number, number, number, number] | null;
}

/** The most captions a narrow screen ties to their points; a station with more sets them all as one list. */
const MANY = 4;

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
  /** Where each station's list of captions stands on a narrow screen: in the room its block of words keeps for it (left, top; px in the frame), or -1 where it keeps none. */
  const lineY = new Map<HTMLElement, number>();
  const lineX = new Map<HTMLElement, number>();

  const measure = () => {
    for (const c of calls) {
      c.w = c.label.offsetWidth;
      c.h = c.label.offsetHeight;
    }
    lineY.clear();
    lineX.clear();
    for (const c of calls) {
      if (!c.group || lineY.has(c.group)) continue;
      // (The room is a part of the block's own layout, which no transform moves: read against the frame the captions are set in.)
      const slot = c.group.parentElement?.querySelector<HTMLElement>('[data-calls-slot]');
      const r = slot?.getBoundingClientRect();
      const host = c.group.getBoundingClientRect();
      lineY.set(c.group, r && r.width > 2 && r.height > 2 ? r.top - host.top : -1);
      lineX.set(c.group, r ? r.left - host.left : 16);
    }
  };

  const frame = (cam: Basis, aspect: number, viewW: number, viewH: number, s: number) => {
    const wide = aspect >= 0.9;
    // (A tablet held upright flies the phone's path and sets its words at the foot the same way.)
    const narrow = viewW < 720 || (viewW < 900 && !wide);
    // (The rail keeps the frame's right edge on a wide screen.)
    const edge = narrow ? 18 : 48;
    const live: { c: Call; x: number; y: number }[] = [];
    const lists = new Map<HTMLElement, Call[]>();
    for (const c of calls) {
      const inStretch = s >= c.from && s < c.to;
      // A station with more captions than a narrow frame can tie to their points sets them all as one list.
      const loose = narrow && !!c.group && c.group.children.length > MANY && (lineY.get(c.group) ?? -1) >= 0;
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
        on = p[2] > 1 && x > 24 && x < viewW - 24 && y > NAV_CLEAR + 30 && y < viewH - 24;
      }
      if (on !== c.on) {
        c.on = on;
        c.el.toggleAttribute('data-on', on);
      }
      if (!on) continue;
      if (!c.w) measure();
      if (loose) {
        const list = lists.get(c.group!) ?? [];
        list.push(c);
        lists.set(c.group!, list);
        continue;
      }
      live.push({ c, x, y });
    }
    // The list: a name to a line, in the streams' own order, in the room the station's block keeps for it.
    // (The streams run right to left in the page's order: the list reads as they stand in the frame, left to right.)
    for (const [group, all] of lists) {
      const list = all.slice().reverse();
      const top = lineY.get(group)!;
      const at = layoutList(list, lineX.get(group) ?? 16, top + list.reduce((sum, c) => sum + c.h, 0) + (list.length - 1) * 5, 5);
      list.forEach((c, i) => {
        c.label.style.transform = `translate3d(${at[i].lx.toFixed(1)}px,${at[i].ly.toFixed(1)}px,0)`;
      });
    }
    if (!live.length) return null;
    const draw = (c: Call, x: number, y: number, p: { lx: number; ly: number; fx: number; fy: number }) => {
      const len = Math.hypot(p.fx - x, p.fy - y);
      const ang = Math.atan2(p.fy - y, p.fx - x);
      c.ring.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      c.line.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${ang.toFixed(4)}rad) scaleX(${Math.max(0, len - 5).toFixed(1)})`;
      c.label.style.transform = `translate3d(${p.lx.toFixed(1)}px,${p.ly.toFixed(1)}px,0)`;
    };
    const caps = live.map(({ c, x, y }) => ({ x, y, w: c.w, h: c.h, lift: wide && c.atWide ? c.liftWide : c.lift, side: c.side }));
    const at = narrow ? layoutStepped(caps, viewW, edge) : layoutCaptions(caps, viewW, edge);
    live.forEach(({ c, x, y }, i) => draw(c, x, y, at[i]));
    // Where the captions stand, taken together: the picture keeps itself readable behind them, as it does behind the words.
    const span: [number, number, number, number] = [1e9, 1e9, -1e9, -1e9];
    live.forEach(({ c }, i) => {
      span[0] = Math.min(span[0], at[i].lx);
      span[1] = Math.min(span[1], at[i].ly);
      span[2] = Math.max(span[2], at[i].lx + c.w);
      span[3] = Math.max(span[3], at[i].ly + c.h);
    });
    return span;
  };

  return { measure, frame };
}
