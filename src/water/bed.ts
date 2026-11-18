/**
 * The bed: where water can be.
 *
 * The page layout carves it. Painters draw channels and pools in document
 * coordinates (CSS px), every registered text rect is then raised back to dry
 * land, and the result becomes a signed distance field the shaders read.
 * Because text removes water from the bed itself, water can never sit under a
 * word at any scroll position.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChannelOpts {
  /** Width in CSS px, or one width per point for a taper. */
  width: number | number[];
  /** Flow speed 0..1 written to the flow map. */
  speed?: number;
  /** Paint flow only (a current through an existing pool). */
  flowOnly?: boolean;
  /** Straight segments instead of a smooth curve. */
  straight?: boolean;
}

export interface BedData {
  /** texels */
  w: number;
  h: number;
  /** CSS px per texel */
  div: number;
  /** signed distance in CSS px, negative in water */
  sd: Float32Array;
  /** RGBA8: R,G signed flow (128 centred), B agitation, A 255 */
  flow: Uint8ClampedArray;
  /** document size in CSS px */
  docW: number;
  docH: number;
}

/** Far enough that a lake keeps deepening well out from its shore. */
const SD_CLAMP_PX = 360;

export class BedPainter {
  readonly div: number;
  readonly w: number;
  readonly h: number;
  readonly docW: number;
  readonly docH: number;
  /** Where a lake drains (world px) and how wide the stream that leaves it is. Set by a scene. */
  outlet: { x: number; y: number; w: number } | null = null;
  /** World y where the stream opens into the wide shallows before the ending, if the page has them. */
  shoal: number | null = null;
  private mask: CanvasRenderingContext2D;
  private flow: CanvasRenderingContext2D;

  constructor(docW: number, docH: number, div: number) {
    this.div = div;
    this.docW = docW;
    this.docH = docH;
    this.w = Math.max(8, Math.ceil(docW / div));
    this.h = Math.max(8, Math.ceil(docH / div));
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = this.w;
      c.height = this.h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.setTransform(1 / div, 0, 0, 1 / div, 0, 0);
      return ctx;
    };
    this.mask = mk();
    this.flow = mk();
    this.mask.fillStyle = '#000';
    this.mask.fillRect(0, 0, docW, docH);
    this.flow.fillStyle = 'rgb(128,128,0)';
    this.flow.fillRect(0, 0, docW, docH);
    this.mask.lineCap = this.flow.lineCap = 'round';
    this.mask.lineJoin = this.flow.lineJoin = 'round';
  }

  /** Fill an arbitrary closed path with water. */
  fill(path: Path2D) {
    this.mask.fillStyle = '#fff';
    this.mask.fill(path);
  }

  /** A rounded rectangular pool. */
  pool(r: Rect, radius = 24) {
    const p = new Path2D();
    const rr = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
    p.roundRect(r.x, r.y, r.w, r.h, rr);
    this.fill(p);
  }

  /** A round pool. */
  disc(c: Pt, radius: number) {
    const p = new Path2D();
    p.arc(c.x, c.y, radius, 0, Math.PI * 2);
    this.fill(p);
  }

  /** A stream through the given points, with flow written along it. */
  channel(points: Pt[], opts: ChannelOpts) {
    if (points.length < 2) return;
    const pts = opts.straight ? densify(points, 10) : smooth(points, 10);
    const speed = opts.speed ?? 1;
    const widthAt = (t: number): number => {
      if (typeof opts.width === 'number') return opts.width;
      const ws = opts.width;
      const f = t * (ws.length - 1);
      const i = Math.min(ws.length - 2, Math.floor(f));
      const k = f - i;
      return ws[i] * (1 - k) + ws[i + 1] * k;
    };
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const w = widthAt((i + 0.5) / (n - 1));
      if (!opts.flowOnly) {
        this.mask.strokeStyle = '#fff';
        this.mask.lineWidth = w;
        this.mask.beginPath();
        this.mask.moveTo(a.x, a.y);
        this.mask.lineTo(b.x, b.y);
        this.mask.stroke();
      }
      // Flow uses the tangent over a wider window so bends turn smoothly.
      const p0 = pts[Math.max(0, i - 2)];
      const p1 = pts[Math.min(n - 1, i + 3)];
      let dx = p1.x - p0.x;
      let dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      dx = (dx / len) * speed;
      dy = (dy / len) * speed;
      const r = Math.round(128 + dx * 127);
      const g = Math.round(128 + dy * 127);
      this.flow.strokeStyle = `rgb(${r},${g},0)`;
      this.flow.lineWidth = w + this.div * 2;
      this.flow.beginPath();
      this.flow.moveTo(a.x, a.y);
      this.flow.lineTo(b.x, b.y);
      this.flow.stroke();
    }
  }

  /** Mark turbulence: ripples and foam are injected here. */
  agitate(c: Pt, radius: number, amount = 1) {
    const ctx = this.flow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius);
    const v = Math.round(255 * Math.min(1, amount));
    g.addColorStop(0, `rgb(0,0,${v})`);
    g.addColorStop(1, 'rgb(0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Raise a rect back to dry land (used for every text block). */
  dry(r: Rect, pad = 0, radius = 12) {
    const ctx = this.mask;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, radius + pad * 0.5);
    ctx.fill();
  }

  /** The painted rasters, ready for the distance transform. */
  rasters(): { mask: Uint8ClampedArray; flow: Uint8ClampedArray; clampTexels: number } {
    return {
      mask: this.mask.getImageData(0, 0, this.w, this.h).data,
      flow: this.flow.getImageData(0, 0, this.w, this.h).data,
      clampTexels: SD_CLAMP_PX / this.div,
    };
  }

  /** Assemble the bed once the signed distance (CSS px) has been computed. */
  assemble(sd: Float32Array, flow: Uint8ClampedArray): BedData {
    return { w: this.w, h: this.h, div: this.div, sd, flow, docW: this.docW, docH: this.docH };
  }
}

function densify(points: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Centripetal Catmull-Rom through the points, sampled about every `step` px. */
function smooth(points: Pt[], step: number): Pt[] {
  if (points.length === 2) return densify(points, step);
  const p = [points[0], ...points, points[points.length - 1]];
  const out: Pt[] = [];
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const n = Math.max(2, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/* ---------- geometry helpers for painters ---------- */

export const pt = (x: number, y: number): Pt => ({ x, y });
