/**
 * Formations: where every light in the swarm stands for each beat of the story.
 * Each generator fills three float buffers (N x 4):
 *   pos = x, y, z, size
 *   aux = flow vector (x, y, z) and flow speed. A light slides back and forth along its flow vector.
 *   col = r, g, b (HDR) and a random phase
 */

export type V3 = [number, number, number];
export type Formation = { pos: Float32Array; aux: Float32Array; col: Float32Array };

const WHITE: V3 = [0.78, 0.89, 1.0];
const WARM: V3 = [1.0, 0.8, 0.55];
const FLARE: V3 = [1.0, 0.3, 0.07];
const STEEL: V3 = [0.3, 0.52, 0.9];
const ICE: V3 = [0.55, 0.8, 1.0];

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

class Builder {
  pos: number[] = [];
  aux: number[] = [];
  col: number[] = [];
  r: () => number;
  constructor(seed: number, private o: V3) { this.r = mulberry(seed); }
  get count() { return this.pos.length / 4; }

  pt(p: V3, size: number, c: V3, k = 1, flow: V3 = [0, 0, 0], speed = 0) {
    this.pos.push(p[0] + this.o[0], p[1] + this.o[1], p[2] + this.o[2], size);
    this.aux.push(flow[0], flow[1], flow[2], speed);
    this.col.push(c[0] * k, c[1] * k, c[2] * k, this.r());
  }

  /** Evenly spaced lights from a to b. flowLen > 0 makes them stream along the line. */
  line(a: V3, b: V3, n: number, size: number, c: V3, k = 1, speed = 0, flowLen = 0, jitter = 0) {
    const d = sub(b, a); const L = len(d) || 1; const dir = mul(d, 1 / L);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const p = lerp3(a, b, t);
      if (jitter) { p[0] += (this.r() - 0.5) * jitter; p[1] += (this.r() - 0.5) * jitter; p[2] += (this.r() - 0.5) * jitter; }
      this.pt(p, size, c, k, mul(dir, flowLen), speed);
    }
  }

  /** Lights along a parametric curve, streaming along its tangent. */
  curve(fn: (t: number) => V3, n: number, size: number, c: V3 | ((t: number) => V3), k: number | ((t: number) => number) = 1, speed = 0, flowLen = 0, jitter = 0) {
    for (let i = 0; i < n; i++) {
      const t = (i + this.r()) / n;
      const p = fn(t); const q = fn(Math.min(1, t + 0.004)); const q0 = fn(Math.max(0, t - 0.004));
      const d = sub(q, q0); const L = len(d) || 1;
      if (jitter) { p[0] += (this.r() - 0.5) * jitter; p[1] += (this.r() - 0.5) * jitter; p[2] += (this.r() - 0.5) * jitter; }
      this.pt(p, size, typeof c === 'function' ? c(t) : c, typeof k === 'function' ? k(t) : k, mul(d, flowLen / L), speed);
    }
  }

  ring(center: V3, radius: number, n: number, size: number, c: V3, k = 1, axis: 'x' | 'y' | 'z' = 'y', speed = 0, flowLen = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const cs = Math.cos(a) * radius; const sn = Math.sin(a) * radius;
      let p: V3; let tan: V3;
      if (axis === 'y') { p = [center[0] + cs, center[1], center[2] + sn]; tan = [-Math.sin(a), 0, Math.cos(a)]; }
      else if (axis === 'x') { p = [center[0], center[1] + cs, center[2] + sn]; tan = [0, -Math.sin(a), Math.cos(a)]; }
      else { p = [center[0] + cs, center[1] + sn, center[2]]; tan = [-Math.sin(a), Math.cos(a), 0]; }
      this.pt(p, size, c, k, mul(tan, flowLen), speed);
    }
  }

  /** Lattice of lights on a rectangle spanned by u and v from origin. */
  grid(origin: V3, u: V3, v: V3, nu: number, nv: number, size: number, c: V3, k = 1) {
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const s = nu === 1 ? 0.5 : i / (nu - 1); const t = nv === 1 ? 0.5 : j / (nv - 1);
      this.pt(add(origin, add(mul(u, s), mul(v, t))), size, c, k);
    }
  }

  /** Pad with a low drifting haze of lights, or thin out, then shuffle so neighbours in the buffer are not neighbours in space. */
  finish(N: number, spread = 240, hazeK = 0.5): Formation {
    const r = this.r;
    while (this.count < N) {
      const a = r() * Math.PI * 2; const d = 14 + Math.pow(r(), 0.7) * spread;
      const h = 0.4 + Math.pow(r(), 5) * 46;
      const fa = r() * Math.PI * 2;
      this.pt([Math.cos(a) * d, h, Math.sin(a) * d * 0.85 + 20], 0.55 + r() * 0.5, r() < 0.2 ? WARM : STEEL, hazeK * 0.5 * (0.25 + r() * 0.6), [Math.cos(fa) * 7, (r() - 0.5) * 1.2, Math.sin(fa) * 7], 0.015 + r() * 0.03);
    }
    const have = this.count;
    const idx = new Uint32Array(N);
    if (have > N) { for (let i = 0; i < N; i++) idx[i] = Math.floor((i * have) / N); } else { for (let i = 0; i < N; i++) idx[i] = i; }
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    const pos = new Float32Array(N * 4); const aux = new Float32Array(N * 4); const col = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const s = idx[i] * 4; const d = i * 4;
      for (let k = 0; k < 4; k++) { pos[d + k] = this.pos[s + k]; aux[d + k] = this.aux[s + k]; col[d + k] = this.col[s + k]; }
    }
    return { pos, aux, col };
  }
}

/* 0. Drift: the swarm asleep, a long seam of lights on the far horizon. */
export function drift(N: number, o: V3): Formation {
  const b = new Builder(11, o); const r = b.r;
  const n = Math.floor(N * 0.9);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 1400;
    const z = -520 - r() * 520;
    const y = 0.4 + Math.pow(r(), 6) * 30;
    b.pt([x, y, z], 0.9 + r() * 0.8, r() < 0.12 ? WARM : WHITE, 0.5 + r() * 0.9, [3 + r() * 3, 0, 0], 0.02 + r() * 0.03);
  }
  return b.finish(N, 500, 0.4);
}

/* 1. Name: ARAV as a monument, extruded letters standing in the water. */
export function name(N: number, o: V3, family: string): Formation {
  const b = new Builder(21, o); const r = b.r;
  const W = 1200; const H = 340;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  ctx.font = `900 300px ${family}`;
  // Widen by hand so the result does not depend on canvas font-stretch support.
  const m = ctx.measureText('ARAV');
  const sx = (W * 0.97) / Math.max(1, m.width);
  ctx.save(); ctx.translate(W / 2, H * 0.84); ctx.scale(sx, 1.12); ctx.fillText('ARAV', 0, 0); ctx.restore();
  const data = ctx.getImageData(0, 0, W, H).data;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4] > 128;
  // Bounds
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (on(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const width = 88; const s = width / Math.max(1, x1 - x0); const height = (y1 - y0) * s; const depth = 7;
  const toW = (x: number, y: number, z: number): V3 => [(x - (x0 + x1) / 2) * s, 0.7 + (y1 - y) * s, z];
  // Front and back faces on a lattice, like stadium lights.
  const faceBudget = Math.floor(N * 0.4);
  let area = 0; for (let y = y0; y <= y1; y += 3) for (let x = x0; x <= x1; x += 3) if (on(x, y)) area++;
  const step = Math.max(1.2, 3 * Math.sqrt(area / faceBudget));
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) {
    const xi = Math.round(x), yi = Math.round(y);
    if (!on(xi, yi)) continue;
    const up = 1 - (yi - y0) / (y1 - y0);
    b.pt(toW(x, y, depth / 2), 1.05, WHITE, 0.85 + up * 0.5);
    if (r() < 0.28) b.pt(toW(x, y, -depth / 2), 0.9, STEEL, 0.7);
  }
  // Edges carry the extrusion.
  const edges: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (on(x, y) && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1))) edges.push(x, y);
  const en = edges.length / 2; const sideBudget = Math.floor(N * 0.42);
  for (let i = 0; i < sideBudget; i++) {
    const e = Math.floor(r() * en) * 2; const z = (r() - 0.5) * depth;
    const front = r() < 0.4;
    b.pt(toW(edges[e] + r() - 0.5, edges[e + 1] + r() - 0.5, front ? depth / 2 : z), front ? 1.15 : 0.85, front ? WARM : ICE, front ? 1.5 : 0.55 + r() * 0.3);
  }
  // A waterline of lights under the letters.
  for (let i = 0; i < Math.floor(N * 0.04); i++) b.pt([(r() - 0.5) * (width + 30), 0.25, (r() - 0.5) * 16], 0.8, WARM, 0.5 + r() * 0.6);
  void height;
  return b.finish(N, 260, 0.55);
}

/* 2. Sandbox: a cage of light around pages of code. Probes circle it; found lines burn. */
export function sandbox(N: number, o: V3): Formation {
  const b = new Builder(31, o); const r = b.r;
  const w = 20, h = 13, d = 15, cy = 15;
  const corners: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push([sx * w, cy + sy * h, sz * d]);
  const edgeN = Math.floor((N * 0.16) / 12);
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const a = corners[i], c = corners[j];
    const diff = (a[0] !== c[0] ? 1 : 0) + (a[1] !== c[1] ? 1 : 0) + (a[2] !== c[2] ? 1 : 0);
    if (diff !== 1) continue;
    b.line(a, c, edgeN, 1.0, ICE, 1.1);
    b.line(a, c, Math.floor(edgeN * 0.25), 0.8, WHITE, 0.5, 0, 0, 0.5);
  }
  for (const c of corners) for (let i = 0; i < Math.floor(N * 0.0016); i++) b.pt([c[0] + (r() - 0.5) * 0.8, c[1] + (r() - 0.5) * 0.8, c[2] + (r() - 0.5) * 0.8], 1.5, WHITE, 2.2);
  // Glass: sparse lattice on the faces.
  const g = Math.floor(Math.sqrt((N * 0.05) / 6));
  b.grid([-w, cy - h, d], [2 * w, 0, 0], [0, 2 * h, 0], g, g, 0.6, STEEL, 0.28);
  b.grid([-w, cy - h, -d], [2 * w, 0, 0], [0, 2 * h, 0], g, g, 0.6, STEEL, 0.22);
  b.grid([-w, cy - h, -d], [0, 0, 2 * d], [0, 2 * h, 0], g, g, 0.6, STEEL, 0.22);
  b.grid([w, cy - h, -d], [0, 0, 2 * d], [0, 2 * h, 0], g, g, 0.6, STEEL, 0.22);
  b.grid([-w, cy + h, -d], [2 * w, 0, 0], [0, 0, 2 * d], g, g, 0.6, STEEL, 0.25);
  // Code: three pages, rows of tokens.
  const pages = [-6, 0, 6]; const rows = 22; const flagged: V3[] = [];
  const codeBudget = N * 0.36; const perUnit = codeBudget / (pages.length * rows * 20);
  pages.forEach((pz, pi) => {
    let indent = 0;
    for (let row = 0; row < rows; row++) {
      const y = cy + h - 2.4 - row * ((2 * h - 4.8) / (rows - 1));
      if (r() < 0.3) indent = Math.max(0, Math.min(4, indent + (r() < 0.5 ? 1 : -1)));
      if (r() < 0.08) continue;
      let x = -w + 3 + indent * 2.2; const end = -w + 3 + 8 + r() * (2 * w - 16);
      const hot = (pi === 1 && (row === 5 || row === 13)) || (pi === 0 && row === 9) || (pi === 2 && row === 16);
      if (hot) flagged.push([x, y, pz]);
      while (x < end) {
        const L = 1.2 + r() * 5; const x2 = Math.min(end, x + L);
        const c = hot ? FLARE : r() < 0.22 ? STEEL : r() < 0.1 ? WARM : WHITE;
        b.line([x, y, pz], [x2, y, pz], Math.max(2, Math.floor((x2 - x) * perUnit * (hot ? 2.2 : 1))), hot ? 1.25 : 0.85, c, hot ? 2.6 : pi === 1 ? 0.95 : 0.6);
        x = x2 + 0.9 + r() * 0.8;
      }
    }
  });
  // Probes: beams from the cage roof into each finding, and rings that scan the slab.
  flagged.forEach((f, i) => {
    const from: V3 = [i % 2 ? w : -w, cy + h, i < 2 ? d : -d];
    b.line(from, f, Math.floor(N * 0.014), 0.9, FLARE, 1.4, 0.35 + r() * 0.2, 5);
    for (let k = 0; k < Math.floor(N * 0.003); k++) b.pt([f[0] - 1.4 + (r() - 0.5) * 1.2, f[1] + (r() - 0.5) * 1.2, f[2] + (r() - 0.5) * 1.2], 1.6, FLARE, 3);
  });
  for (let i = 0; i < 5; i++) {
    const y = cy - h + 2 + i * ((2 * h - 4) / 4);
    b.ring([0, y, 0], Math.hypot(w, d) + 3 + (i % 2) * 2.5, Math.floor(N * 0.022), 0.85, i === 2 ? WARM : ICE, i === 2 ? 1.3 : 0.8, 'y', (i % 2 ? 1 : -1) * (0.05 + r() * 0.05), 9);
  }
  // Footprint on the water.
  b.ring([0, 0.3, 0], Math.hypot(w, d) + 8, Math.floor(N * 0.02), 0.8, STEEL, 0.6);
  return b.finish(N, 230, 0.5);
}

/* 3. One of 74: a field of 74 pillars. 73 stay low. One goes up out of frame. */
export function one(N: number, o: V3): Formation {
  const b = new Builder(41, o); const r = b.r;
  const cells: V3[] = [];
  const cols = 10; const sp = 8.5;
  for (let i = 0; i < 74; i++) {
    const cx = (i % cols) - (cols - 1) / 2; const cz = Math.floor(i / cols) - 3.5;
    cells.push([cx * sp + (r() - 0.5) * 1.6, 0, cz * sp + (r() - 0.5) * 1.6]);
  }
  const winner = 34; // near the middle of the field
  const lowBudget = Math.floor((N * 0.34) / 73);
  cells.forEach((c, i) => {
    if (i === winner) return;
    const hgt = 1.6 + r() * 5.5;
    const per = Math.floor(lowBudget / 4);
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.line([c[0] + dx, 0.3, c[2] + dz], [c[0] + dx, hgt, c[2] + dz], per, 0.8, STEEL, 0.55 + r() * 0.25);
    b.pt([c[0], hgt + 0.3, c[2]], 1.3, WHITE, 1.2);
  });
  const c = cells[winner];
  const beamN = Math.floor(N * 0.42);
  for (let i = 0; i < beamN; i++) {
    const t = Math.pow(r(), 1.5); const y = 0.3 + t * 620;
    const rad = 0.9 + 0.5 * r() + t * 1.5; const a = r() * Math.PI * 2;
    const core = r() < 0.5;
    b.pt([c[0] + Math.cos(a) * rad * (core ? 0.35 : 1), y, c[2] + Math.sin(a) * rad * (core ? 0.35 : 1)], core ? 1.3 : 0.95, core ? WHITE : WARM, (core ? 2.4 : 1.3) * (1 - t * 0.5), [0, 26, 0], 0.3 + r() * 0.35);
  }
  for (let k = 0; k < 4; k++) b.ring([c[0], 0.3, c[2]], 3 + k * 2.6, Math.floor(N * 0.012), 0.9, WARM, 1.5 - k * 0.3, 'y', 0.06, 5);
  return b.finish(N, 250, 0.5);
}

/* 4. Bridge: two assistants, one inbox between them, packets crossing. */
export function bridge(N: number, o: V3): Formation {
  const b = new Builder(51, o); const r = b.r;
  const L: V3 = [-30, 15, 0], R: V3 = [30, 15, 0]; const rad = 9.5;
  // Left: a dense shell (the Dot).
  const nL = Math.floor(N * 0.2);
  for (let i = 0; i < nL; i++) {
    const y = 1 - (i / (nL - 1)) * 2; const rr = Math.sqrt(1 - y * y); const a = i * 2.399963;
    b.pt([L[0] + Math.cos(a) * rr * rad, L[1] + y * rad, L[2] + Math.sin(a) * rr * rad], 0.95, WHITE, 0.9 + (y + 1) * 0.25);
  }
  for (let i = 0; i < Math.floor(N * 0.02); i++) { const v: V3 = [r() - 0.5, r() - 0.5, r() - 0.5]; const l = len(v) || 1; const k = (Math.pow(r(), 0.5) * 3.2) / l; b.pt([L[0] + v[0] * k, L[1] + v[1] * k, L[2] + v[2] * k], 1.3, WARM, 2.2); }
  // Right: a wire frame of great circles (the Bot).
  const rings = 9;
  for (let i = 0; i < rings; i++) {
    const tilt = (i / rings) * Math.PI;
    const n = Math.floor((N * 0.18) / rings);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2; const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      b.pt([R[0] + x * Math.cos(tilt), R[1] + y, R[2] + x * Math.sin(tilt)], 0.95, ICE, 1.0, [-Math.sin(a) * Math.cos(tilt) * 4, Math.cos(a) * 4, -Math.sin(a) * Math.sin(tilt) * 4], (i % 2 ? 1 : -1) * 0.06);
    }
  }
  for (let i = 0; i < Math.floor(N * 0.02); i++) { const v: V3 = [r() - 0.5, r() - 0.5, r() - 0.5]; const l = len(v) || 1; const k = (Math.pow(r(), 0.5) * 3.2) / l; b.pt([R[0] + v[0] * k, R[1] + v[1] * k, R[2] + v[2] * k], 1.3, STEEL, 2.6); }
  // Inbox: a gate in the middle every message passes through.
  for (let k = 0; k < 3; k++) b.ring([0, 30, 0], 5.5 - k * 1.3, Math.floor(N * 0.014), 1.0, k === 0 ? WARM : WHITE, 1.6 - k * 0.3, 'x', 0.08, 3);
  // Arcs: outbound over the top through the gate, replies underneath.
  const arcs = 7;
  for (let i = 0; i < arcs; i++) {
    const spread = (i - (arcs - 1) / 2) * 1.5; const dir = i % 2 ? 1 : -1;
    const top = 30 + spread * 0.25;
    b.curve((t) => {
      const u = dir > 0 ? t : 1 - t; const x = L[0] + rad * 0.9 + u * (R[0] - L[0] - rad * 1.8);
      const lift = Math.sin(u * Math.PI); return [x, 15 + (top - 15) * lift, spread * lift * 1.2];
    }, Math.floor(N * 0.03), 0.9, i % 3 === 0 ? WARM : WHITE, 1.25, 0.22 + r() * 0.14, 7, 0.25);
  }
  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * 2.4;
    b.curve((t) => { const x = R[0] - rad * 0.9 - t * (R[0] - L[0] - rad * 1.8); const dip = Math.sin(t * Math.PI); return [x, 15 - 9.5 * dip, spread * dip]; }, Math.floor(N * 0.02), 0.85, STEEL, 0.9, 0.16 + r() * 0.1, 6, 0.2);
  }
  // Pedestal rings on the water.
  b.ring([L[0], 0.3, 0], rad + 2, Math.floor(N * 0.014), 0.8, WHITE, 0.6);
  b.ring([R[0], 0.3, 0], rad + 2, Math.floor(N * 0.014), 0.8, ICE, 0.6);
  return b.finish(N, 240, 0.5);
}

/* 5. Merge: branches from everywhere fold into one trunk that runs to the horizon. */
export function merge(N: number, o: V3): Formation {
  const b = new Builder(61, o); const r = b.r;
  const z0 = 36, z1 = -230; const y = 7;
  const trunkN = Math.floor(N * 0.2);
  for (let i = 0; i < trunkN; i++) {
    const t = r(); const z = z0 + (z1 - z0) * t; const core = r() < 0.6;
    const a = r() * Math.PI * 2; const rad = core ? r() * 0.5 : 0.6 + r() * 1.3;
    b.pt([Math.cos(a) * rad, y + Math.sin(a) * rad, z], core ? 1.2 : 0.85, core ? WHITE : WARM, (core ? 1.2 : 0.7) * (1 - t * 0.35), [0, 0, -16], 0.28 + r() * 0.25);
  }
  const branches = 20; const per = Math.floor((N * 0.5) / branches);
  for (let i = 0; i < branches; i++) {
    const side = i % 2 ? 1 : -1; const t3 = i < 8; // eight warm branches
    const jz = z0 - 18 - (i / branches) * 190 + (r() - 0.5) * 8;
    const sx = side * (26 + r() * 62); const sz = jz + 26 + r() * 34; const sy = 1.5 + r() * 22;
    const p0: V3 = [sx, sy, sz], p1: V3 = [sx * 0.75, sy * 0.8 + 3, jz + 26], p2: V3 = [side * 3.5, y, jz + 14], p3: V3 = [0, y, jz];
    b.curve((t) => {
      const u = 1 - t; const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      return [p0[0] * w0 + p1[0] * w1 + p2[0] * w2 + p3[0] * w3, p0[1] * w0 + p1[1] * w1 + p2[1] * w2 + p3[1] * w3, p0[2] * w0 + p1[2] * w1 + p2[2] * w2 + p3[2] * w3];
    }, per, 0.9, t3 ? WARM : ICE, (t) => (t3 ? 1.5 : 0.95) * (0.5 + t * 0.7), 0.2 + r() * 0.16, 6, 0.3);
    // Commit node at the origin of the branch, and a merge node where it joins.
    for (let k = 0; k < Math.floor(N * 0.0012); k++) b.pt([p0[0] + (r() - 0.5) * 1.3, p0[1] + (r() - 0.5) * 1.3, p0[2] + (r() - 0.5) * 1.3], 1.5, t3 ? WARM : WHITE, 2.4);
    b.ring([0, y, jz], 2.6, Math.floor(N * 0.002), 1.0, t3 ? FLARE : WHITE, t3 ? 2.2 : 1.4, 'z');
  }
  return b.finish(N, 250, 0.45);
}

/* 6. Market: a skyline of candles, and fourteen forecast lines ahead of the last one. */
export function market(N: number, o: V3): Formation {
  const b = new Builder(71, o); const r = b.r;
  const n = 44; const x0 = -62; const dx = 2.5; let price = 9;
  const budget = Math.floor((N * 0.56) / n);
  let last: V3 = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const drift = 0.42 + Math.sin(i * 0.37) * 0.5; const move = (r() - 0.42) * 5.2 + drift * 0.6;
    const open = price; const close = Math.max(3, Math.min(40, price + move)); price = close;
    const hi = Math.max(open, close) + r() * 2.6; const lo = Math.max(1.2, Math.min(open, close) - r() * 2.6);
    const up = close >= open; const x = x0 + i * dx; const z = -i * 0.35;
    const c = up ? WHITE : FLARE; const k = up ? 1.0 : 1.15;
    const b0 = Math.min(open, close), b1 = Math.max(open, close) + 0.35; const hw = 0.72;
    const rowsN = Math.max(2, Math.floor((b1 - b0) / 0.42)); const perRow = Math.max(4, Math.floor((budget * 0.82) / rowsN / 4) * 4);
    for (let j = 0; j < rowsN; j++) {
      const y = b0 + ((b1 - b0) * j) / Math.max(1, rowsN - 1); const q = perRow / 4;
      b.line([x - hw, y, z + hw], [x + hw, y, z + hw], q, 0.9, c, k * 1.1);
      b.line([x - hw, y, z - hw], [x + hw, y, z - hw], q, 0.8, c, k * 0.5);
      b.line([x - hw, y, z - hw], [x - hw, y, z + hw], q, 0.8, c, k * 0.6);
      b.line([x + hw, y, z - hw], [x + hw, y, z + hw], q, 0.8, c, k * 0.6);
    }
    b.line([x, lo, z], [x, hi, z], Math.floor(budget * 0.18), 0.75, c, k * 0.8);
    last = [x, close, z];
  }
  // Fourteen strategies: a fan of forecasts from the last close.
  for (let i = 0; i < 14; i++) {
    const end: V3 = [last[0] + 34 + r() * 8, last[1] + (i - 4.5) * 2.5 + (r() - 0.5) * 2, last[2] - 6 + (i - 6.5) * 1.4];
    const bend = (r() - 0.5) * 5;
    b.curve((t) => [last[0] + 1.4 + (end[0] - last[0]) * t, last[1] + (end[1] - last[1]) * t + Math.sin(t * Math.PI) * bend, last[2] + (end[2] - last[2]) * t], Math.floor(N * 0.014), 0.85, i < 9 ? WARM : STEEL, i < 9 ? 1.4 : 0.9, 0.2 + r() * 0.2, 5, 0.15);
    for (let k = 0; k < 6; k++) b.pt([end[0] + (r() - 0.5) * 0.6, end[1] + (r() - 0.5) * 0.6, end[2] + (r() - 0.5) * 0.6], 1.4, i < 9 ? WARM : STEEL, 2.2);
  }
  // Axis: ticks on the water and faint price levels.
  for (let i = 0; i <= 12; i++) b.line([x0 - 4, 0.3, 8 - i * 3], [x0 + n * dx + 46, 0.3, 8 - i * 3], Math.floor(N * 0.004), 0.6, STEEL, 0.3);
  for (const lv of [10, 20, 30, 40]) b.line([x0 - 4, lv, -18], [x0 + n * dx + 46, lv, -18], Math.floor(N * 0.006), 0.6, STEEL, 0.32);
  return b.finish(N, 250, 0.45);
}

/* 7. Engine: a Merlin-class engine as wire, hung nozzle down. Local to a pivot so it can be spun. */
export const ENGINE_PIVOT: V3 = [0, 34, 0];
export function engine(N: number, o: V3): Formation {
  const b = new Builder(81, o); const r = b.r; const P = ENGINE_PIVOT;
  // Profile: radius as a function of height (y from -19 bottom of bell to +12 top of injector).
  const prof = (y: number) => {
    if (y < -3) { const t = (y + 19) / 16; return 2.3 + (11.5 - 2.3) * Math.pow(1 - t, 0.62); } // bell
    if (y < -1) { const t = (y + 3) / 2; return 2.3 + t * 1.9; } // throat to chamber
    if (y < 5) return 4.2; // chamber
    if (y < 8) { const t = (y - 5) / 3; return 4.2 * Math.sqrt(Math.max(0, 1 - t * t * 0.86)); } // dome
    return 1.5;
  };
  const meridians = 40; const perM = Math.floor((N * 0.2) / meridians);
  for (let m = 0; m < meridians; m++) {
    const a = (m / meridians) * Math.PI * 2;
    b.curve((t) => { const y = -19 + t * 27; const rr = prof(y); return [P[0] + Math.cos(a) * rr, P[1] + y, P[2] + Math.sin(a) * rr]; }, perM, 0.75, m % 4 === 0 ? WHITE : ICE, m % 4 === 0 ? 0.4 : 0.16);
  }
  const ringYs: number[] = []; for (let y = -19; y <= 8; y += y < -3 ? 1.0 : 0.75) ringYs.push(y);
  const perR = Math.floor((N * 0.2) / ringYs.length);
  ringYs.forEach((y, i) => { const rim = i === 0; b.ring([P[0], P[1] + y, P[2]], prof(y), rim ? perR * 3 : perR, rim ? 1.2 : 0.75, rim ? WARM : WHITE, rim ? 2.0 : 0.28); });
  // Stiffener hoops on the bell.
  for (const y of [-15, -11, -7]) b.ring([P[0], P[1] + y, P[2]], prof(y) + 0.35, Math.floor(N * 0.01), 1.0, WARM, 1.3);
  // Turbopump beside the chamber, with its exhaust duct running down past the bell.
  const tp: V3 = [P[0] + 7.6, P[1] + 3, P[2] + 1];
  for (let y = -3; y <= 4; y += 0.6) b.ring([tp[0], tp[1] + y, tp[2]], 2.3, Math.floor(N * 0.0045), 0.8, WHITE, 0.85);
  for (let m = 0; m < 12; m++) { const a = (m / 12) * Math.PI * 2; b.line([tp[0] + Math.cos(a) * 2.3, tp[1] - 3, tp[2] + Math.sin(a) * 2.3], [tp[0] + Math.cos(a) * 2.3, tp[1] + 4, tp[2] + Math.sin(a) * 2.3], Math.floor(N * 0.0016), 0.75, ICE, 0.6); }
  const duct = (t: number): V3 => [tp[0] + 1.6 + Math.sin(t * Math.PI) * 4.6, tp[1] - 3 - t * 17, tp[2] + t * 2];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.curve((t) => { const c = duct(t); return [c[0] + Math.cos(a) * 1.05, c[1], c[2] + Math.sin(a) * 1.05]; }, Math.floor(N * 0.006), 0.75, WARM, 0.9, 0.2, 3); }
  // Feed lines from the pump over the dome, and a manifold torus at the throat.
  for (let k = 0; k < 3; k++) b.curve((t) => { const a = t * Math.PI; return [tp[0] - (tp[0] - P[0]) * t, P[1] + 6 + Math.sin(a) * (4 + k * 1.1), tp[2] + (k - 1) * 1.6 * (1 - t)]; }, Math.floor(N * 0.006), 0.85, STEEL, 1.1, 0.25, 3);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; b.ring([P[0], P[1] - 2.2 + Math.sin(a) * 0.7, P[2]], 4.9 + Math.cos(a) * 0.7, Math.floor(N * 0.003), 0.75, STEEL, 0.9); }
  // Gimbal mount and thrust frame.
  const top = P[1] + 14;
  b.ring([P[0], top, P[2]], 5.4, Math.floor(N * 0.012), 0.9, WHITE, 1.2);
  b.ring([P[0], top, P[2]], 2.2, Math.floor(N * 0.006), 0.9, WHITE, 1.0);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const a2 = ((k + 0.5) / 6) * Math.PI * 2; b.line([P[0] + Math.cos(a) * 5.4, top, P[2] + Math.sin(a) * 5.4], [P[0] + Math.cos(a2) * 3.4, P[1] + 6.5, P[2] + Math.sin(a2) * 3.4], Math.floor(N * 0.004), 0.8, ICE, 0.9); b.line([P[0] + Math.cos(a + 1.047) * 5.4, top, P[2] + Math.sin(a + 1.047) * 5.4], [P[0] + Math.cos(a2) * 3.4, P[1] + 6.5, P[2] + Math.sin(a2) * 3.4], Math.floor(N * 0.004), 0.8, ICE, 0.9); }
  b.line([P[0], P[1] + 8, P[2]], [P[0], top, P[2]], Math.floor(N * 0.004), 1.0, WARM, 1.5);
  void r;
  return b.finish(N, 240, 0.42);
}

/* 8. Launch: the swarm leaves as one column toward the sun. */
export function launch(N: number, o: V3): Formation {
  const b = new Builder(91, o); const r = b.r;
  const path = (t: number): V3 => [8 + Math.pow(t, 1.6) * 330, 0.4 + Math.pow(t, 0.8) * 330, -40 - t * 420]; // a gravity turn toward the sun
  const colN = Math.floor(N * 0.62);
  for (let i = 0; i < colN; i++) {
    const t = Math.pow(r(), 1.35); const c = path(t); const q = path(Math.min(1, t + 0.01));
    const d = sub(q, c); const L = len(d) || 1;
    const core = r() < 0.45; const rad = (core ? 0.5 : 1.6 + (1 - t) * 3.2) * (0.3 + r());
    const a = r() * Math.PI * 2;
    b.pt([c[0] + Math.cos(a) * rad, c[1] + (r() - 0.5) * 2, c[2] + Math.sin(a) * rad], core ? 1.3 : 0.9, core ? WHITE : t < 0.25 ? FLARE : WARM, (core ? 1.7 : 0.9) * (0.55 + t * 0.6), mul(d, 34 / L), 0.3 + r() * 0.4);
  }
  // Exhaust rolling out across the water.
  const base = path(0);
  for (let i = 0; i < Math.floor(N * 0.2); i++) {
    const a = r() * Math.PI * 2; const d = 3 + Math.pow(r(), 0.6) * 58; const h = 0.3 + Math.pow(r(), 3) * (9 - d * 0.1);
    b.pt([base[0] + Math.cos(a) * d, Math.max(0.3, h), base[2] + Math.sin(a) * d], 0.9, d < 16 ? FLARE : WARM, d < 16 ? 0.9 : 0.4, [Math.cos(a) * 9, 0, Math.sin(a) * 9], 0.1 + r() * 0.12);
  }
  for (let k = 0; k < 5; k++) b.ring([base[0], 0.3, base[2]], 10 + k * 11, Math.floor(N * 0.01), 0.85, WARM, 1.1 - k * 0.15, 'y', 0.04, 6);
  return b.finish(N, 300, 0.5);
}

/* Calm: a low field of lights for the archive and the blog, quiet enough to read over. */
export function calm(N: number, o: V3): Formation {
  const b = new Builder(101, o); const r = b.r;
  for (let i = 0; i < Math.floor(N * 0.55); i++) {
    const x = (r() - 0.5) * 900; const z = -60 - Math.pow(r(), 0.8) * 900;
    b.pt([x, 0.4 + Math.pow(r(), 4) * 60, z], 0.8 + r() * 0.6, r() < 0.15 ? WARM : WHITE, 0.35 + r() * 0.7, [5 + r() * 4, 0, 0], 0.02 + r() * 0.02);
  }
  return b.finish(N, 520, 0.4);
}
