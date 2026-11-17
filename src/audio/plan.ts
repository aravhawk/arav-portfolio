/**
 * The world's plan, as the sound knows it.
 *
 * Nothing here repeats a coordinate. The bed is carved by `paintWorld`
 * (world.ts) drawing channels, pools, discs and shapes on a painter; this
 * file hands that same function a painter that only writes down what it is
 * asked to draw. What lies at a point of the world (water or land, how fast
 * it runs, how broken it is) is then read from those calls, in the order
 * they were made. Whatever moves in world.ts moves here with it.
 *
 * It is a plan, not the carved bed: a channel's bank is taken at its drawn
 * width and corners are not rounded, which is near enough for how loud a
 * river is and where it lies.
 */

import type { BedPainter, ChannelOpts, Pt, Rect } from '@/water/bed';
import { DELTA, LAKE, POOL, SLUICES, TARN, TRIBS, WORLD, paintWorld } from '@/water/world';

type Shape = { k: 'rect'; x: number; y: number; w: number; h: number } | { k: 'disc'; x: number; y: number; r: number } | { k: 'ellipse'; x: number; y: number; rx: number; ry: number } | { k: 'poly'; pts: Pt[] };

type Box = [number, number, number, number];

interface Area {
  chan: false;
  wet: boolean;
  shape: Shape;
  box: Box;
}

export interface Chan {
  chan: true;
  /** the line as drawn: the points it was given, and the width at each */
  raw: Pt[];
  rawW: number[];
  /** the line it follows between them, and the width at each of those */
  pts: Pt[];
  w: number[];
  speed: number;
  flowOnly: boolean;
  /** which sluice's channel this is, or -1 */
  sluice: number;
  box: Box;
}

export interface Plan {
  ops: (Area | Chan)[];
  /** where the water is marked as broken: x, y, radius, how much */
  agit: [number, number, number, number][];
}

/** Stands in for Path2D while the world is drawn: it keeps the shape instead of rasterising it. */
class PathRec {
  shapes: Shape[] = [];
  private run: Pt[] = [];
  moveTo(x: number, y: number) {
    this.run = [{ x, y }];
    this.shapes.push({ k: 'poly', pts: this.run });
  }
  lineTo(x: number, y: number) {
    if (!this.run.length) this.moveTo(x, y);
    else this.run.push({ x, y });
  }
  /** A curve is noted as eight straight pieces, and so is any other the world may draw. */
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    if (!this.run.length) this.moveTo(cx, cy);
    const a = this.run[this.run.length - 1];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const u = 1 - t;
      this.run.push({ x: u * u * a.x + 2 * u * t * cx + t * t * x, y: u * u * a.y + 2 * u * t * cy + t * t * y });
    }
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    if (!this.run.length) this.moveTo(c1x, c1y);
    const a = this.run[this.run.length - 1];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const u = 1 - t;
      this.run.push({ x: u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, y: u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y });
    }
  }
  closePath() {}
  ellipse(x: number, y: number, rx: number, ry: number) {
    this.shapes.push({ k: 'ellipse', x, y, rx, ry });
  }
  arc(x: number, y: number, r: number) {
    this.shapes.push({ k: 'disc', x, y, r });
  }
  rect(x: number, y: number, w: number, h: number) {
    this.shapes.push({ k: 'rect', x, y, w, h });
  }
  roundRect(x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h);
  }
}

const boxOf = (s: Shape): Box => {
  if (s.k === 'rect') return [s.x, s.y, s.x + s.w, s.y + s.h];
  if (s.k === 'disc') return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
  if (s.k === 'ellipse') return [s.x - s.rx, s.y - s.ry, s.x + s.rx, s.y + s.ry];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of s.pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return [x0, y0, x1, y1];
};

function inside(s: Shape, x: number, y: number): boolean {
  if (s.k === 'rect') return x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h;
  if (s.k === 'disc') return (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y) < s.r * s.r;
  if (s.k === 'ellipse') return ((x - s.x) * (x - s.x)) / (s.rx * s.rx) + ((y - s.y) * (y - s.y)) / (s.ry * s.ry) < 1;
  // A closed outline: a point is inside when a line from it crosses the outline an odd number of times.
  let odd = false;
  const p = s.pts;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (p[i].y > y !== p[j].y > y && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) odd = !odd;
  }
  return odd;
}

/** The curve the painter draws through a channel's points (the same spline, sampled more coarsely), or the straight line. */
function follow(points: Pt[], straight: boolean, step: number): Pt[] {
  const out: Pt[] = [];
  const p = straight || points.length === 2 ? points : [points[0], ...points, points[points.length - 1]];
  const curved = p !== points;
  for (let i = curved ? 1 : 0; i < p.length - (curved ? 2 : 1); i++) {
    const p1 = p[i];
    const p2 = p[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      if (!curved) {
        out.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
        continue;
      }
      const p0 = p[i - 1];
      const p3 = p[i + 2];
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Draw the world on a painter that only takes notes. */
export function recordPlan(): Plan {
  const plan: Plan = { ops: [], agit: [] };
  const area = (wet: boolean, shape: Shape) => plan.ops.push({ chan: false, wet, shape, box: boxOf(shape) });
  const rec = {
    outlet: null,
    shoal: null,
    fill(path: unknown) {
      for (const s of (path as PathRec).shapes ?? []) area(true, s);
    },
    pool(r: Rect) {
      area(true, { k: 'rect', ...r });
    },
    disc(c: Pt, radius: number) {
      area(true, { k: 'disc', x: c.x, y: c.y, r: radius });
    },
    dry(r: Rect, pad = 0) {
      area(false, { k: 'rect', x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 });
    },
    agitate(c: Pt, radius: number, amount = 1) {
      if (amount > 0) plan.agit.push([c.x, c.y, radius, Math.min(1, amount)]);
    },
    channel(points: Pt[], opts: ChannelOpts) {
      if (points.length < 2) return;
      const pts = follow(points, !!opts.straight, 45);
      const ws = typeof opts.width === 'number' ? points.map(() => opts.width as number) : opts.width;
      const w = pts.map((_, i) => {
        const f = ((i + 0.5) / Math.max(1, pts.length - 1)) * (ws.length - 1);
        const k = Math.min(ws.length - 2, Math.max(0, Math.floor(f)));
        return ws.length < 2 ? ws[0] : ws[k] + (ws[k + 1] - ws[k]) * Math.min(1, Math.max(0, f - k));
      });
      const half = Math.max(...w) / 2;
      const b = boxOf({ k: 'poly', pts });
      plan.ops.push({ chan: true, raw: points, rawW: ws, pts, w, speed: opts.speed ?? 1, flowOnly: !!opts.flowOnly, sluice: SLUICES.indexOf(points), box: [b[0] - half, b[1] - half, b[2] + half, b[3] + half] });
    },
  };
  // (world.ts makes its free shapes with Path2D; while it draws, that name means the note-taker.)
  const g = globalThis as { Path2D?: unknown };
  const real = g.Path2D;
  g.Path2D = PathRec;
  try {
    paintWorld(rec as unknown as BedPainter);
  } finally {
    if (real) g.Path2D = real;
    else delete g.Path2D;
  }
  return plan;
}

let made: Plan | null = null;
/** The plan, drawn once. */
export const plan = () => (made ??= recordPlan());

/** What lies at a point of the world: open water or not, how fast it runs, how white it is, whether it is the sea. */
export interface Ground {
  wet: number;
  flow: number;
  white: number;
  ice: number;
  sea: number;
  /** the tarn: water that does not move */
  still?: number;
}

const DRY: Ground = { wet: 0, flow: 0, white: 0, ice: 0, sea: 0 };

/** Whether a point is on a channel, by its drawn width. */
function onChannel(c: Chan, x: number, y: number): boolean {
  const p = c.pts;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i];
    const b = p[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const ex = x - a.x - dx * t;
    const ey = y - a.y - dy * t;
    const half = c.w[i] / 2;
    if (ex * ex + ey * ey < half * half) return true;
  }
  return false;
}

/**
 * The world's water at a point.
 * @param melt 0..1 how far the lake's ice has gone
 * @param gate how far open each sluice is
 */
export function groundAt(x: number, y: number, melt: number, gate: ArrayLike<number>, pl: Plan = plan()): Ground {
  // Past the world's sides the bed repeats its last column, and past its last row its last row, which is open sea.
  x = Math.min(WORLD.w - 1, Math.max(1, x));
  y = Math.max(1, y);
  if (y >= WORLD.h - 40) return { wet: 1, flow: 0.18, white: 0, ice: 0, sea: 1 };
  let wet = false;
  let flow = 0;
  let sluice = -1;
  for (const op of pl.ops) {
    const b = op.box;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    if (op.chan) {
      if (!onChannel(op, x, y)) continue;
      // (Later strokes paint over earlier ones, as on the bed.)
      sluice = op.sluice;
      flow = op.speed;
      if (!op.flowOnly) wet = true;
    } else if (inside(op.shape, x, y)) {
      wet = op.wet;
      if (!op.wet) {
        flow = 0;
        sluice = -1;
      }
    }
  }
  if (!wet) return DRY;
  // The lake: ice until it melts, then all but still water.
  if (y < LAKE.y1) return { wet: melt, flow: 0.06, white: 0, ice: 1 - melt, sea: 0 };
  if (sluice >= 0) {
    // A sluice's channel carries what its gate lets through.
    const open = gate[sluice] ?? 0;
    return { wet: 0.3 + 0.7 * open, flow: open, white: 0.75 * open * (y < SLUICES[sluice][0].y + 450 ? 1 : 0.4), ice: 0, sea: 0 };
  }
  let white = 0;
  for (const a of pl.agit) {
    const d = Math.hypot(x - a[0], y - a[1]);
    if (d < a[2]) white += a[3] * (1 - d / a[2]);
  }
  // (Fast water breaks of its own accord.)
  white = Math.min(1, white + 0.25 * Math.max(0, flow - 0.6));
  if (y > DELTA.sea) return { wet: 1, flow: Math.max(flow, 0.18), white: 0, ice: 0, sea: 1 };
  const dx = (x - TARN.x) / TARN.rx;
  const dy = (y - TARN.y) / TARN.ry;
  if (dx * dx + dy * dy < 1) return { wet: 1, flow: 0.02, white: 0, ice: 0, sea: 0, still: 1 };
  const fan = y > DELTA.apex.y ? (y - DELTA.apex.y) / (DELTA.sea - DELTA.apex.y) : 0;
  return { wet: 1, flow: flow || 0.05, white, ice: 0, sea: 0.4 * fan };
}

export interface Reach {
  /** a point on it, how wide it runs there, and how fast */
  x: number;
  y: number;
  w: number;
  speed: number;
}

/** The streams that fall into the river at the confluence: each one's mouth and its width there. */
export function tribs(pl: Plan = plan()): Reach[] {
  return TRIBS.map((t) => {
    const c = pl.ops.find((op): op is Chan => op.chan && op.raw[0] === t.head);
    return { x: t.mouth.x, y: t.mouth.y, w: c ? c.rawW[Math.min(2, c.rawW.length - 1)] : 0, speed: c ? c.speed : 1 };
  });
}

/** The thin spills that feed and drain the clear pool: where each meets it. */
export function spills(pl: Plan = plan()): Reach[] {
  const near = (p: Pt) => p.x > POOL.x - 90 && p.x < POOL.x + POOL.w + 90 && p.y > POOL.y - 90 && p.y < POOL.y + POOL.h + 90;
  const out: Reach[] = [];
  for (const op of pl.ops) {
    if (!op.chan || op.flowOnly || Math.max(...op.rawW) > 90) continue;
    const a = op.raw[0];
    const b = op.raw[op.raw.length - 1];
    if (near(b) && !near(a)) out.push({ x: b.x, y: b.y, w: op.rawW[op.rawW.length - 1], speed: op.speed });
    else if (near(a) && !near(b)) out.push({ x: a.x, y: a.y, w: op.rawW[0], speed: op.speed });
  }
  if (!out.length) out.push({ x: POOL.x, y: POOL.y + POOL.h * 0.4, w: 50, speed: 0.7 });
  return out;
}

/** The delta's channels, west to east: the middle of each and how wide it runs. */
export function arms(pl: Plan = plan()): Reach[] {
  const out: Reach[] = [];
  for (const op of pl.ops) {
    if (!op.chan || op.flowOnly) continue;
    if (op.raw.some((p) => p.y < DELTA.apex.y - 5 || p.y > DELTA.sea + 320)) continue;
    const mid = op.pts[op.pts.length >> 1];
    out.push({ x: mid.x, y: mid.y, w: op.w[op.w.length >> 1], speed: op.speed });
  }
  return out.sort((a, b) => a.x - b.x);
}
