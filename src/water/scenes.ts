/**
 * Scenes: how each page's layout becomes a river bed.
 *
 * A scene reads named anchors from the DOM (elements with `data-bed`) and
 * paints pools and channels through them. Layout is decided by CSS; the
 * scene only connects what the layout placed, so the bed reflows with the
 * page at every width.
 *
 * Each project's bed is its diagram. The water is the same water all the
 * way down; the ground it runs through is what changes.
 */

import { type BedPainter, type Pt, type Rect, cx, cy, lerp, pt } from './bed';

export interface Anchor {
  name: string;
  rect: Rect;
  el: HTMLElement;
}

export interface Anchors {
  rect(name: string): Rect | null;
  all(prefix: string): Anchor[];
  viewW: number;
  viewH: number;
  docH: number;
}

export type Scene = (b: BedPainter, a: Anchors) => void;

interface Ctx {
  b: BedPainter;
  a: Anchors;
  /** main stream width */
  w: number;
  /** narrow layout: features stack and the stream keeps to a side lane */
  narrow: boolean;
  /** x of the side lane on narrow layouts */
  lane: number;
}

interface Ports {
  in: Pt;
  out: Pt;
}

type Feature = (c: Ctx, r: Rect, el: HTMLElement) => Ports;

/**
 * The main stream: about a twelfth of a desktop viewport. A narrow layout
 * keeps the slim lane it had, so the stream never takes reading width.
 */
const streamW = (viewW: number) =>
  viewW < 860 ? Math.round(Math.max(30, Math.min(42, viewW * 0.055))) : Math.round(Math.max(72, Math.min(130, viewW * 0.085)));

/** A stream is never one width for long: it swells and narrows a little. */
const vary = (w: number): number[] => [w, w * 1.1, w * 0.95, w * 1.07, w];

/** The rect of a child of a feature, in the same world space as the feature's own rect. */
function inner(el: HTMLElement, r: Rect, sel: string): Rect | null {
  const s = el.querySelector<HTMLElement>(sel);
  if (!s) return null;
  const e = el.getBoundingClientRect();
  const q = s.getBoundingClientRect();
  if (q.width < 2 || q.height < 2) return null;
  return { x: r.x + q.left - e.left, y: r.y + q.top - e.top, w: q.width, h: q.height };
}

function within(a: Anchors, prefix: string, r: Rect): Anchor[] {
  return a.all(prefix).filter((x) => cy(x.rect) >= r.y - 2 && cy(x.rect) <= r.y + r.h + 2);
}

/** Join two points with an S that crosses sideways halfway down. */
function connect(c: Ctx, from: Pt, to: Pt, width = c.w) {
  const { b } = c;
  if (to.y <= from.y + 4) return;
  if (Math.abs(to.x - from.x) < 10) {
    b.channel([pt(from.x, from.y - 6), pt(to.x, to.y + 6)], { width: vary(width), straight: true });
    return;
  }
  const mid = (from.y + to.y) / 2;
  const k = Math.min(38, (to.y - from.y) / 5);
  b.channel(
    [pt(from.x, from.y - 6), pt(from.x, mid - k * 1.6), pt(lerp(from.x, to.x, 0.5), mid), pt(to.x, mid + k * 1.6), pt(to.x, to.y + 6)],
    { width: vary(width) },
  );
}

/* ---------- features ---------- */

/** Infiniview: the app sits on an island in a sealed basin, and gets hit. */
const sandbox: Feature = (c, r) => {
  const { b } = c;
  const xin = c.narrow ? c.lane : r.x + r.w * 0.5;
  b.pool(r, 30);
  b.channel([pt(xin, r.y + 16), pt(lerp(xin, cx(r), 0.3), r.y + r.h * 0.08)], { width: c.w * 1.6, speed: 0.5, flowOnly: true });
  // Attacks: the water around the island is never quite still.
  for (const [tx, ty] of [
    [0.06, 0.2],
    [0.94, 0.3],
    [0.08, 0.8],
    [0.92, 0.82],
    [0.5, 0.04],
    [0.5, 0.96],
  ]) {
    b.agitate(pt(r.x + r.w * tx, r.y + r.h * ty), Math.min(70, r.w * 0.12), 0.55);
  }
  return { in: pt(xin, r.y), out: pt(xin, r.y + r.h) };
};

/** Upstream: tributaries merge into the main stream, wide as their count. */
const tributaries: Feature = (c, r) => {
  const { b, a } = c;
  const tribs = within(a, 'trib:', r);
  const leftSide = tribs.length ? cx(tribs[0].rect) < cx(r) : true;
  const xm = c.narrow ? c.lane : leftSide ? r.x + r.w * 0.86 : r.x + r.w * 0.14;
  const top = pt(xm, r.y);
  const bot = pt(xm, r.y + r.h);
  b.channel([pt(xm, r.y - 6), pt(xm, r.y + r.h + 6)], { width: c.w * 1.15, straight: true });
  for (const t of tribs) {
    const n = Number(t.el.dataset.n || 1);
    const tw = Math.round((c.narrow ? 11 : 15) + Math.sqrt(n) * (c.narrow ? 9 : 12));
    const y = cy(t.rect);
    // The head of each tributary sits just past its label.
    // It keeps more than a label's height of dry stone between the two.
    const gap = (c.narrow ? 24 : 30) + tw * 0.5 + 5;
    const hx = leftSide ? t.rect.x + t.rect.w + gap : t.rect.x - gap;
    const dir = xm > hx ? 1 : -1;
    const span = Math.abs(xm - hx);
    b.disc(pt(hx, y), tw * 0.5 + 5);
    b.channel(
      [pt(hx, y), pt(hx + dir * span * 0.45, y), pt(xm - dir * span * 0.16, y + Math.min(46, span * 0.2)), pt(xm, y + Math.min(84, span * 0.36))],
      { width: tw, speed: 0.75 },
    );
    b.agitate(pt(xm, y + Math.min(84, span * 0.36)), tw, 0.5);
  }
  return { in: top, out: bot };
};

/**
 * Kilo Bench: one wide pool, with the benchmark's real results standing in
 * it on a pier that runs out from the bank. The stream fills the pool and
 * leaves by the far corner.
 */
const lanes: Feature = (c, r) => {
  const { b } = c;
  const xin = c.narrow ? c.lane : r.x + r.w * 0.26;
  const xout = c.narrow ? c.lane : r.x + r.w * 0.2;
  const x0 = r.x + r.w * (c.narrow ? 0.06 : 0.02);
  const x1 = c.narrow ? c.lane + c.w / 2 : r.x + r.w * 0.88;
  const body = { x: x0, y: r.y + r.h * 0.06, w: x1 - x0, h: r.h * 0.88 };
  const m = Math.min(body.w, body.h);
  // Three bodies that overlap: a shore with a bay and a point, not a tank.
  b.pool(body, m * 0.3);
  b.disc(pt(body.x + body.w * 0.2, body.y + body.h * 0.2), m * 0.24);
  b.disc(pt(body.x + body.w * 0.72, body.y + body.h * 0.84), m * 0.2);
  b.channel([pt(xin, r.y - 6), pt(xin, body.y + m * 0.2)], { width: c.w, straight: true });
  b.channel([pt(xout, body.y + body.h - m * 0.2), pt(xout, r.y + r.h + 6)], { width: c.w, straight: true });
  b.channel(
    [pt(xin, body.y + 10), pt(lerp(body.x, xin, 0.5), cy(body)), pt(xout, body.y + body.h - 10)],
    { width: m * 0.5, speed: 0.45, flowOnly: true },
  );
  b.agitate(pt(xin, body.y + m * 0.16), c.w * 1.3, 0.5);
  return { in: pt(xin, r.y), out: pt(xout, r.y + r.h) };
};

/** Agent Bridge: two pools, one canal, traffic both ways. */
const bridge: Feature = (c, r) => {
  const { b, a } = c;
  const peers = within(a, 'peer:', r);
  if (peers.length < 2) {
    const x = c.narrow ? c.lane : cx(r);
    b.channel([pt(x, r.y - 6), pt(x, r.y + r.h + 6)], { width: c.w, straight: true });
    return { in: pt(x, r.y), out: pt(x, r.y + r.h) };
  }
  const [p0, p1] = peers;
  const c0 = pt(cx(p0.rect), cy(p0.rect));
  const c1 = pt(cx(p1.rect), cy(p1.rect));
  const r0 = Math.min(p0.rect.w, p0.rect.h) / 2;
  const r1 = Math.min(p1.rect.w, p1.rect.h) / 2;
  b.disc(c0, r0);
  b.disc(c1, r1);
  const sag = Math.min(90, Math.abs(c1.x - c0.x) * 0.22 + Math.abs(c1.y - c0.y) * 0.1);
  b.channel([c0, pt(lerp(c0.x, c1.x, 0.5), lerp(c0.y, c1.y, 0.5) + sag), c1], { width: Math.max(18, c.w * 0.7), speed: 0.5 });
  const xin = c.narrow ? c.lane : c0.x;
  const xout = c.narrow ? c.lane : c1.x;
  connectInto(c, pt(xin, r.y), c0);
  connectOut(c, c1, pt(xout, r.y + r.h));
  return { in: pt(xin, r.y), out: pt(xout, r.y + r.h) };
};

function connectInto(c: Ctx, from: Pt, centre: Pt) {
  c.b.channel([pt(from.x, from.y - 6), pt(from.x, lerp(from.y, centre.y, 0.5)), centre], { width: c.w });
}
function connectOut(c: Ctx, centre: Pt, to: Pt) {
  c.b.channel([centre, pt(to.x, lerp(centre.y, to.y, 0.5)), pt(to.x, to.y + 6)], { width: c.w });
}

/** Open models: one basin per model, its area set by its pulls. */
const basins: Feature = (c, r) => {
  const { b, a } = c;
  const models = within(a, 'model:', r);
  const xin = c.narrow ? c.lane : models.length ? cx(models[0].rect) : cx(r);
  let from = pt(xin, r.y);
  let first = true;
  for (const m of models) {
    const centre = pt(cx(m.rect), cy(m.rect));
    const rad = Math.min(m.rect.w, m.rect.h) / 2;
    b.disc(centre, rad);
    if (first) connectInto(c, from, centre);
    else b.channel([from, pt(lerp(from.x, centre.x, 0.5), lerp(from.y, centre.y, 0.5) + 18), centre], { width: Math.max(16, c.w * 0.62), speed: 0.7 });
    b.agitate(centre, rad * 0.5, 0.25);
    from = centre;
    first = false;
  }
  const xout = c.narrow ? c.lane : from.x;
  const out = pt(xout, r.y + r.h);
  if (models.length) connectOut(c, from, out);
  else b.channel([pt(xin, r.y - 6), pt(xin, r.y + r.h + 6)], { width: c.w, straight: true });
  return { in: pt(xin, r.y), out };
};

/**
 * cc-switch: the stream meets a header, three straight branches drop from
 * it, one above each option of the switch, and a collector carries the
 * water on. Only the selected branch is open to the header and runs; the
 * other two are dammed at the top and stand still.
 */
const fork: Feature = (c, r, el) => {
  const { b, a } = c;
  const branches = within(a, 'branch:', r);
  const active = Number(el.dataset.active || 0);
  if (!branches.length) return pass(c, r, el);
  const xs = branches.map((x) => cx(x.rect));
  const left = Math.min(...branches.map((x) => x.rect.x));
  const right = Math.max(...branches.map((x) => x.rect.x + x.rect.w));
  const top = Math.min(...branches.map((x) => x.rect.y));
  const pitch = xs.length > 1 ? Math.abs(xs[1] - xs[0]) : 90;
  const bw = Math.max(20, Math.min(c.w * 0.62, pitch - 30));
  // The stream passes the switch on its open side.
  const roomRight = r.x + r.w - right;
  const side = c.narrow || roomRight >= left - r.x ? 1 : -1;
  const xm = c.narrow ? c.lane : side > 0 ? Math.max(right + 30 + c.w / 2, r.x + r.w * 0.8) : Math.min(left - 30 - c.w / 2, r.x + r.w * 0.2);
  const y0 = r.y + Math.max(bw * 0.5 + 12, r.h * 0.1);
  const y1 = top - 24 - bw * 0.5;
  const far = side > 0 ? Math.min(...xs) : Math.max(...xs);
  b.channel([pt(xm, r.y - 6), pt(xm, y0)], { width: c.w, straight: true });
  b.channel([pt(xm, y0), pt(far, y0)], { width: bw, straight: true, speed: 0.8 });
  b.channel([pt(far, y1), pt(xm, y1)], { width: bw, straight: true, speed: 0.8 });
  b.channel([pt(xm, y1), pt(xm, r.y + r.h + 6)], { width: c.w, straight: true });
  xs.forEach((x, i) => {
    const open = i === active;
    // A closed branch starts below a dam of dry stone.
    const ya = open ? y0 : y0 + bw * 0.5 + 16;
    b.channel([pt(x, ya), pt(x, y1)], { width: bw, straight: true, speed: open ? 1 : 0 });
    if (open) b.agitate(pt(x, y0 + bw), bw, 0.6);
  });
  return { in: pt(xm, r.y), out: pt(xm, r.y + r.h) };
};

/** TensorPoW: a tensor. A grid of cells the water fills in order. */
const grid: Feature = (c, r) => {
  const { b } = c;
  const n = 3;
  const size = Math.min(r.w * (c.narrow ? 0.74 : 0.8), r.h * 0.8);
  const gap = size * 0.06;
  const cell = (size - gap * (n - 1)) / n;
  const ox = c.narrow ? r.x + r.w * 0.04 : cx(r) - size / 2;
  const oy = cy(r) - size / 2;
  const centre = (i: number, j: number) => pt(ox + i * (cell + gap) + cell / 2, oy + j * (cell + gap) + cell / 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      b.pool({ x: ox + i * (cell + gap), y: oy + j * (cell + gap), w: cell, h: cell }, cell * 0.16);
    }
  }
  // Boustrophedon: the stream threads every cell, row by row.
  const order: Pt[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) order.push(centre(j % 2 ? n - 1 - i : i, j));
  }
  b.channel(order, { width: Math.max(14, cell * 0.3), straight: true, speed: 0.8 });
  const xin = c.narrow ? c.lane : order[0].x;
  const xout = c.narrow ? c.lane : order[order.length - 1].x;
  connectInto(c, pt(xin, r.y), order[0]);
  connectOut(c, order[order.length - 1], pt(xout, r.y + r.h));
  return { in: pt(xin, r.y), out: pt(xout, r.y + r.h) };
};

/**
 * RydAR: the stream becomes the road. One wide meander, two tight bends,
 * and the app stands on the dry ground inside them.
 */
const bends: Feature = (c, r, el) => {
  const { b } = c;
  const slab = inner(el, r, '.slab');
  const w = c.w * (c.narrow ? 1.2 : 1.12);
  const rt = c.narrow ? c.lane : r.x + r.w * 0.86;
  const h = r.h;
  const lim = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const yT = slab ? lim((r.y + slab.y) / 2, r.y + w * 0.5 + 4, r.y + h * 0.3) : r.y + h * 0.16;
  const yB = slab ? lim((slab.y + slab.h + r.y + h) / 2, r.y + h * 0.7, r.y + h - w * 0.5 - 4) : r.y + h * 0.84;
  const xl = slab ? Math.max(r.x + w * 0.5 + 2, (r.x + slab.x) / 2) : r.x + r.w * (c.narrow ? 0.1 : 0.14);
  const span = rt - xl;
  const pts = [
    pt(rt, r.y - 6),
    pt(rt - span * 0.06, yT - (yT - r.y) * 0.3),
    pt(rt - span * 0.3, yT),
    pt(xl + span * 0.3, yT),
    pt(xl + span * 0.04, lerp(yT, yB, 0.14)),
    pt(xl, lerp(yT, yB, 0.5)),
    pt(xl + span * 0.04, lerp(yT, yB, 0.86)),
    pt(xl + span * 0.3, yB),
    pt(rt - span * 0.3, yB),
    pt(rt - span * 0.06, yB + (r.y + h - yB) * 0.3),
    pt(rt, r.y + h + 6),
  ];
  b.channel(pts, { width: [w, w * 1.08, w * 0.96, w * 1.1, w * 0.96, w * 1.08, w] });
  b.agitate(pts[4], w * 1.2, 0.5);
  b.agitate(pts[6], w * 1.2, 0.5);
  return { in: pt(rt, r.y), out: pt(rt, r.y + r.h) };
};

/** A plain run: the stream passes straight through a section. */
const pass: Feature = (c, r) => {
  const x = c.narrow ? c.lane : cx(r);
  c.b.channel([pt(x, r.y - 6), pt(x, r.y + r.h + 6)], { width: c.w, straight: true });
  return { in: pt(x, r.y), out: pt(x, r.y + r.h) };
};

/** A still pool the stream runs through (project pages, the archive). */
const basin: Feature = (c, r) => {
  const { b } = c;
  const x = c.narrow ? c.lane : cx(r);
  b.pool(r, 30);
  b.channel([pt(x, r.y + 14), pt(cx(r), cy(r)), pt(x, r.y + r.h - 14)], { width: c.w * 2, speed: 0.4, flowOnly: true });
  b.agitate(pt(x, r.y + 20), c.w * 1.2, 0.5);
  return { in: pt(x, r.y), out: pt(x, r.y + r.h) };
};

const FEATURES: Record<string, Feature> = { sandbox, tributaries, lanes, bridge, basins, fork, grid, bends, pass, basin };

/* ---------- scenes ---------- */

function ctx(b: BedPainter, a: Anchors): Ctx {
  const narrow = a.viewW < 860;
  const w = streamW(a.viewW);
  const gutter = Math.max(16, Math.min(40, a.viewW * 0.026));
  return { b, a, w, narrow, lane: a.viewW - gutter - w / 2 - 6 };
}

/** Paint every `feat:<kind>` anchor in document order and join them up. */
function run(c: Ctx, start: Pt | null) {
  const { a } = c;
  let from = start;
  for (const f of a.all('feat:')) {
    const kind = f.name.slice(5).split(':')[0];
    const feature = FEATURES[kind];
    // A feature the layout has hidden at this width takes no part.
    if (!feature || f.rect.w < 2 || f.rect.h < 2) continue;
    const ports = feature(c, f.rect, f.el);
    if (from) connect(c, from, ports.in);
    from = ports.out;
  }
  const delta = a.rect('delta');
  if (delta) {
    // The mouth: the stream opens out into the water of the ending.
    if (from) connect(c, from, pt(c.narrow ? c.lane : from.x, delta.y + 8));
    c.b.pool({ x: -120, y: delta.y, w: a.viewW + 240, h: delta.h + 200 }, 0);
  } else if (from) {
    c.b.channel([pt(from.x, from.y - 6), pt(from.x, a.docH + 40)], { width: c.w, straight: true });
  }
}

const home: Scene = (b, a) => {
  const c = ctx(b, a);
  const lake = a.rect('lake');
  let from: Pt | null = null;
  if (lake) {
    // The lake runs off both sides of the page: only its north and south
    // shores are land.
    b.pool({ x: -120, y: lake.y, w: a.viewW + 240, h: lake.h }, 0);
    // The outlet lines up with the first feature below, so the stream runs
    // down beside the statement instead of through it.
    const first = a.all('feat:').find((f) => f.rect.w > 2);
    const outX = c.narrow ? c.lane : first ? cx(first.rect) : lake.x + lake.w * 0.78;
    // A slow current gathers toward the outlet, so meltwater leaves the lake.
    for (const t of [0.18, 0.5, 0.82]) {
      b.channel(
        [
          pt(lake.x + lake.w * t, lake.y + lake.h * 0.1),
          pt(lerp(lake.x + lake.w * t, outX, 0.45), lake.y + lake.h * 0.62),
          pt(outX, lake.y + lake.h - 26),
        ],
        { width: lake.w * 0.36, speed: 0.34, flowOnly: true },
      );
    }
    b.agitate(pt(outX, lake.y + lake.h - 10), c.w * 1.6, 0.7);
    from = pt(outX, lake.y + lake.h);
  }
  run(c, from);
};

/** Inner pages: a head pool if the page has one, then the stream. */
const page: Scene = (b, a) => {
  const c = ctx(b, a);
  const head = a.rect('head');
  let from: Pt | null = null;
  if (head) {
    b.pool(head, c.narrow ? 22 : 32);
    const outX = c.narrow ? c.lane : head.x + head.w * 0.5;
    b.channel([pt(head.x + head.w * 0.2, cy(head)), pt(outX, head.y + head.h - 16)], { width: head.h * 0.5, speed: 0.3, flowOnly: true });
    b.agitate(pt(outX, head.y + head.h - 8), c.w * 1.4, 0.6);
    from = pt(outX, head.y + head.h);
  } else {
    // No pool: the stream simply runs in from above the page.
    const spring = a.rect('spring');
    if (spring && spring.w > 2) {
      const x = c.narrow ? c.lane : cx(spring);
      b.channel([pt(x, -60), pt(x, spring.y + spring.h + 6)], { width: c.w, straight: true });
      from = pt(x, spring.y + spring.h);
    }
  }
  run(c, from);
};

export const SCENES: Record<string, Scene> = { home, page };
