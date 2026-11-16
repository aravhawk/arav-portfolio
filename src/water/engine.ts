/**
 * The water engine: a small fluid simulation and one shading pass.
 *
 * Rules it keeps (see docs/redesign-v4/perf.md):
 *  - The canvas always renders at full device pixel ratio (capped at 2).
 *    Quality is stepped in discrete tiers that change simulation resolution,
 *    solver iterations and sample counts. It never renders soft.
 *  - It does not own a frame loop. The page's single RAF calls `tick`.
 *  - No React state, no layout reads: the caller passes scroll and size in.
 */

import type { BedData } from './bed';
import { type GL, type Program, type Target, Swap, bindTex, bindTriangle, compile, drawTo, freeTarget, makeTarget, makeTexture } from './gl';
import { RENDER } from './shaders/render';
import { BED_A, BED_B, DETAIL, DETAIL_CURV, DYE, GRAIN, SD_BLUR, SD_DOWN, VEL_ADVECT, VEL_DIV, VEL_PRESSURE, VEL_PROJECT, WAVE, WAVE_GRAD } from './shaders/sim';

export interface Palette {
  land: [number, number, number];
  bed: [number, number, number];
  absorb: [number, number, number];
  scatter: [number, number, number];
  sky: [number, number, number];
  foam: [number, number, number];
  ice: [number, number, number];
  /** ambient, key, caustic gain, glint gain */
  light: [number, number, number, number];
  /** speckle, mottling, vignette */
  grain: [number, number, number];
}

const srgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return [c[0], c[1], c[2]];
};

/** Both themes are first class: the same world under two lights. */
export const PALETTES: Record<'light' | 'dark', Palette> = {
  light: {
    land: srgb('#E4E7E8'),
    bed: srgb('#D9E2E4'),
    absorb: [0.04, 0.0135, 0.0082],
    scatter: [0.003, 0.05, 0.108],
    sky: [1.0, 1.0, 1.0],
    foam: [1.0, 1.0, 1.0],
    ice: srgb('#F2F9FC'),
    light: [0.5, 0.78, 1.5, 1.25],
    grain: [0.05, 0.05, 0.2],
  },
  dark: {
    land: srgb('#15181B'),
    bed: srgb('#5E8496'),
    absorb: [0.046, 0.0165, 0.0098],
    scatter: [0.003, 0.046, 0.105],
    sky: [0.78, 0.92, 1.0],
    foam: [0.6, 0.76, 0.82],
    ice: srgb('#E4F3F9'),
    light: [0.22, 1.08, 2.1, 1.8],
    grain: [0.12, 0.12, 0.42],
  },
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

export interface IceInput {
  sd: Float32Array;
  w: number;
  h: number;
  /** signed distance in world px, negative inside the letters */
  /** most negative distance in world px (half the thickest stroke) */
  minSd: number;
}

export interface EngineOpts {
  /** 0 light .. 1 dark */
  theme: number;
  /** No time, no simulation: a still world that only redraws on scroll. */
  still: boolean;
  coarse: boolean;
}

interface Tier {
  simDiv: number;
  jacobi: number;
  quality: number;
}

const TIERS: Tier[] = [
  { simDiv: 3, jacobi: 12, quality: 2 },
  { simDiv: 4, jacobi: 8, quality: 1 },
  { simDiv: 5, jacobi: 5, quality: 1 },
  { simDiv: 6, jacobi: 3, quality: 0 },
];

export class WaterEngine {
  readonly gl: GL;
  readonly canvas: HTMLCanvasElement;
  /** Largest texture side this device allows. */
  readonly maxTexture: number;
  private p: Record<string, Program> = {};
  private detail!: Target;
  private curv!: Target;
  private grain!: Target;
  private bedA: Target | null = null;
  private bedB: Target | null = null;
  private bedMeta = { w: 1, h: 1, div: 4 };
  private iceTex: Target | null = null;
  private iceLow: Target | null = null;
  private iceMeta: IceInput | null = null;
  private heat: Swap;
  private ready = false;
  private wave: Swap | null = null;
  private waveOut: Target | null = null;
  private vel: Swap | null = null;
  private dye: Swap | null = null;
  private maskTarget: Target | null = null;
  private hf: number;

  // view
  private cssW = 1;
  private cssH = 1;
  private margin = 0;
  private dpr = 1;
  private simW = 1;
  private simH = 1;
  private simTop = 0;
  private hasSimTop = false;

  // state
  tier = 0;
  private theme: number;
  private themeTarget: number;
  private still: boolean;
  private time = 0;
  private last = 0;
  private dirty = true;
  private lastScroll = -1;

  // pointer (world px)
  private ptr = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0, active: false, fresh: false };
  private drop = { x: 0, y: 0, r: 0, s: 0 };

  // ice
  /** Where the ice name rests at scroll 0, in world px. */
  iceRect = { x: 0, y: 0, w: 0, h: 0 };
  /** Scroll distance over which the name melts. */
  meltRange = 600;
  private melt = 0;
  private meltRate = 0;
  /** Called once when the melt completes going down, and when it resets. */
  onMelt: ((done: boolean) => void) | null = null;
  private meltDone = false;

  // governor
  private slow = 0;
  private fast = 0;
  private base = 16.7;
  private samples: number[] = [];
  /** Frame intervals in ms, for the perf harness. */
  frameLog: number[] | null = null;

  constructor(canvas: HTMLCanvasElement, opts: EngineOpts) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('webgl2 unavailable');
    const cbf = gl.getExtension('EXT_color_buffer_float');
    const cbh = gl.getExtension('EXT_color_buffer_half_float');
    if (!cbf && !cbh) throw new Error('float render targets unavailable');
    this.gl = gl;
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    this.hf = gl.HALF_FLOAT;
    this.theme = this.themeTarget = opts.theme;
    this.still = opts.still;
    if (opts.coarse) this.tier = 1;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    bindTriangle(gl);

    this.heat = new Swap(gl, 256, 64, this.f16());
  }

  /**
   * Compile the shaders and bake the two tileable textures. One program per
   * task, so the page stays responsive while the world is being prepared.
   */
  async prepare(): Promise<void> {
    const gl = this.gl;
    const src: Record<string, string> = {
      render: RENDER,
      bedA: BED_A,
      bedB: BED_B,
      sdBlur: SD_BLUR,
      sdDown: SD_DOWN,
      wave: WAVE,
      waveGrad: WAVE_GRAD,
      velAdvect: VEL_ADVECT,
      velDiv: VEL_DIV,
      velPressure: VEL_PRESSURE,
      velProject: VEL_PROJECT,
      dye: DYE,
      detail: DETAIL,
      detailCurv: DETAIL_CURV,
      grain: GRAIN,
      heat: HEAT,
    };
    for (const k of Object.keys(src)) {
      this.p[k] = compile(gl, src[k], k);
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    // Baked tileable textures.
    const rep = { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, wrap: gl.REPEAT };
    this.detail = makeTarget(gl, 512, 512, rep);
    this.grain = makeTarget(gl, 256, 256, rep);
    gl.useProgram(this.p.detail.prog);
    drawTo(gl, this.detail);
    gl.useProgram(this.p.grain.prog);
    drawTo(gl, this.grain);
    this.curv = makeTarget(gl, 512, 512, { ...this.f16(), wrap: gl.REPEAT });
    gl.useProgram(this.p.detailCurv.prog);
    drawTo(gl, this.curv);
    for (const t of [this.detail, this.grain]) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    this.ready = true;
  }

  private f16() {
    const gl = this.gl;
    return { internal: gl.RGBA16F, format: gl.RGBA, type: this.hf };
  }

  /* ---------- inputs ---------- */

  setBed(bed: BedData) {
    const gl = this.gl;
    const sdTex = makeTexture(gl, bed.w, bed.h, {
      internal: gl.R32F,
      format: gl.RED,
      type: gl.FLOAT,
      filter: gl.NEAREST,
      data: bed.sd,
    });
    const flowTex = makeTexture(gl, bed.w, bed.h, {
      internal: gl.RGBA8,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      data: new Uint8Array(bed.flow.buffer, bed.flow.byteOffset, bed.flow.byteLength),
    });
    freeTarget(gl, this.bedA);
    freeTarget(gl, this.bedB);
    this.bedA = makeTarget(gl, bed.w, bed.h, this.f16());
    this.bedB = makeTarget(gl, bed.w, bed.h, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE });
    gl.useProgram(this.p.bedA.prog);
    bindTex(gl, 0, sdTex, this.p.bedA.u.uSd);
    drawTo(gl, this.bedA);
    gl.useProgram(this.p.bedB.prog);
    bindTex(gl, 0, flowTex, this.p.bedB.u.uRaw);
    drawTo(gl, this.bedB);
    gl.deleteTexture(sdTex);
    gl.deleteTexture(flowTex);
    this.bedMeta = { w: bed.w, h: bed.h, div: bed.div };
    this.dirty = true;
  }

  setIce(ice: IceInput | null) {
    const gl = this.gl;
    freeTarget(gl, this.iceTex);
    freeTarget(gl, this.iceLow);
    this.iceTex = null;
    this.iceLow = null;
    this.iceMeta = ice;
    if (!ice) return;
    const sdTex = makeTexture(gl, ice.w, ice.h, {
      internal: gl.R32F,
      format: gl.RED,
      type: gl.FLOAT,
      filter: gl.NEAREST,
      data: ice.sd,
    });
    // Letters need cleaner normals than banks do: smooth the field first.
    const soft = makeTarget(gl, ice.w, ice.h, { ...this.f16(), filter: gl.NEAREST });
    gl.useProgram(this.p.sdBlur.prog);
    bindTex(gl, 0, sdTex, this.p.sdBlur.u.uSd);
    drawTo(gl, soft);
    this.iceTex = makeTarget(gl, ice.w, ice.h, this.f16());
    gl.useProgram(this.p.bedA.prog);
    bindTex(gl, 0, soft.tex, this.p.bedA.u.uSd);
    drawTo(gl, this.iceTex);
    // The same field smoothed across about half a stroke: the shape a
    // melting edge rounds toward, so strokes soften instead of thinning to
    // hairlines.
    const texel = this.iceRect.w > 0 ? this.iceRect.w / ice.w : 1;
    const k = Math.min(12, Math.max(2, Math.round(-ice.minSd / texel / 3)));
    const lw = Math.max(2, Math.ceil(ice.w / k));
    const lh = Math.max(2, Math.ceil(ice.h / k));
    const down = makeTarget(gl, lw, lh, { ...this.f16(), filter: gl.NEAREST });
    gl.useProgram(this.p.sdDown.prog);
    bindTex(gl, 0, sdTex, this.p.sdDown.u.uSd);
    gl.uniform1i(this.p.sdDown.u.uK, k);
    drawTo(gl, down);
    this.iceLow = makeTarget(gl, lw, lh, this.f16());
    gl.useProgram(this.p.sdBlur.prog);
    bindTex(gl, 0, down.tex, this.p.sdBlur.u.uSd);
    drawTo(gl, this.iceLow);
    freeTarget(gl, down);
    gl.deleteTexture(sdTex);
    freeTarget(gl, soft);
    this.dirty = true;
  }

  setTheme(t: number, instant = false) {
    this.themeTarget = t;
    if (instant) this.theme = t;
    this.dirty = true;
  }

  setStill(still: boolean) {
    this.still = still;
    this.dirty = true;
  }

  /** Size of the canvas in CSS px, and how much of it is off-screen margin. */
  resize(cssW: number, cssH: number, margin: number, dpr: number) {
    const gl = this.gl;
    this.cssW = cssW;
    this.cssH = cssH;
    this.margin = margin;
    this.dpr = Math.min(Math.max(dpr, 1), 2);
    const bw = Math.max(2, Math.round(cssW * this.dpr));
    const bh = Math.max(2, Math.round(cssH * this.dpr));
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.allocSim();
    freeTarget(gl, this.maskTarget);
    this.maskTarget = null;
    this.dirty = true;
  }

  private allocSim() {
    const gl = this.gl;
    const dx = TIERS[this.tier].simDiv;
    const w = Math.max(4, Math.ceil(this.cssW / dx));
    const h = Math.max(4, Math.ceil(this.cssH / dx) + 2);
    if (this.wave && w === this.simW && h === this.simH) return;
    this.simW = w;
    this.simH = h;
    this.wave?.free(gl);
    this.vel?.free(gl);
    this.dye?.free(gl);
    freeTarget(gl, this.waveOut);
    const o = { ...this.f16(), filter: gl.LINEAR };
    this.wave = new Swap(gl, w, h, { ...this.f16(), filter: gl.NEAREST });
    this.waveOut = makeTarget(gl, w, h, o);
    this.vel = new Swap(gl, w, h, o);
    this.dye = new Swap(gl, w, h, o);
    this.hasSimTop = false;
  }

  /* ---------- pointer ---------- */

  pointerMove(worldX: number, worldY: number) {
    const p = this.ptr;
    if (!p.active) {
      p.px = worldX;
      p.py = worldY;
    }
    p.x = worldX;
    p.y = worldY;
    p.active = true;
    p.fresh = true;
  }

  pointerLeave() {
    this.ptr.active = false;
  }

  /** One discrete splash, e.g. a tap on water. */
  splash(worldX: number, worldY: number, radius = 16, strength = 0.9) {
    this.drop = { x: worldX, y: worldY, r: radius, s: strength };
    this.dirty = true;
  }

  /* ---------- frame ---------- */

  /**
   * @param now ms
   * @param scrollY document scroll
   * @param viewH visible viewport height in CSS px
   * @returns the world y the canvas top should sit at (for the CSS transform)
   */
  tick(now: number, scrollY: number, viewH: number): number {
    const gl = this.gl;
    const top = scrollY - this.margin;
    if (!this.ready || !this.bedA || !this.bedB || !this.wave || gl.isContextLost()) return top;

    let dt = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    if (this.frameLog && dt < 1) this.frameLog.push(dt * 1000);
    this.govern(dt * 1000);
    dt = Math.min(dt, 1 / 20);

    // Theme eases between the two palettes.
    if (this.theme !== this.themeTarget) {
      const k = 1 - Math.exp(-dt * 9);
      this.theme += (this.themeTarget - this.theme) * k;
      if (Math.abs(this.theme - this.themeTarget) < 0.002) this.theme = this.themeTarget;
      this.dirty = true;
    }

    // Melt follows scroll. It is a function of position, so it reverses exactly.
    const m = this.iceTex ? Math.min(1, Math.max(0, scrollY / this.meltRange)) : 0;
    const rate = Math.abs(m - this.melt) / Math.max(dt, 1e-3);
    this.meltRate += (Math.min(rate, 1.1) - this.meltRate) * (1 - Math.exp(-dt * 6));
    this.melt = m;
    if (m >= 1 && !this.meltDone) {
      this.meltDone = true;
      this.onMelt?.(true);
    } else if (m < 0.9 && this.meltDone) {
      this.meltDone = false;
      this.onMelt?.(false);
    }

    if (scrollY !== this.lastScroll) {
      this.lastScroll = scrollY;
      this.dirty = true;
    }
    if (this.still) {
      if (!this.dirty) return top;
      this.render(top, scrollY, viewH);
      this.dirty = false;
      return top;
    }

    this.time += dt;
    this.simulate(dt, top);
    this.render(top, scrollY, viewH);
    this.dirty = false;
    return top;
  }

  private iceUniforms(scrollY: number) {
    const ice = this.iceMeta;
    if (!ice || !this.iceTex) return { rect: [0, 0, 0, 0], state: [0, 0, 0, 0], alive: 0, erode: 0 };
    // The floe drifts with the camera while it melts, so it stays in view.
    const drift = Math.min(scrollY, this.meltRange) * 0.74;
    const r = this.iceRect;
    const m = this.melt;
    const half = -ice.minSd;
    // Ice in water does not get thinner strokes, it gets lower and clearer.
    // The letters keep nearly their whole outline (so the name reads to the
    // end), sink to the waterline, lose their frost, and are last seen as
    // clear glass bending the light under them before that goes too.
    const erode = Math.pow(m, 1.5) * half * 0.26;
    const round = 0.4 * smooth(0.05, 0.8, m);
    const height = 1 - smooth(0.04, 0.72, m);
    const frost = 1 - smooth(0.18, 0.84, m);
    const alive = 1 - smooth(0.8, 0.985, m);
    return { rect: [r.x, r.y + drift, r.w, r.h], state: [erode, height, round, frost], alive, erode };
  }

  private simulate(dt: number, top: number) {
    const gl = this.gl;
    const tier = TIERS[this.tier];
    const dx = tier.simDiv;
    const newTop = Math.floor(top / dx) * dx - dx;
    let shift = 0;
    if (this.hasSimTop) shift = Math.round((newTop - this.simTop) / dx);
    this.simTop = newTop;
    this.hasSimTop = true;
    const sim = [this.simTop, dx, this.simW, this.simH];
    const bed = this.bedMeta;
    const ice = this.iceUniforms(this.lastScroll);

    // Pointer segment and speed.
    const p = this.ptr;
    let speed = 0;
    if (p.active && p.fresh) {
      const vx = (p.x - p.px) / dt;
      const vy = (p.y - p.py) / dt;
      p.vx += (vx - p.vx) * 0.5;
      p.vy += (vy - p.vy) * 0.5;
      speed = Math.hypot(p.vx, p.vy);
    } else {
      p.vx *= 0.8;
      p.vy *= 0.8;
    }
    const moving = p.active && p.fresh && speed > 12;
    const seg = [p.px, p.py, p.x, p.y];

    const common = (prog: Program, unit: number) => {
      gl.uniform4fv(prog.u.uSim, sim);
      gl.uniform2f(prog.u.uBedSize, bed.w, bed.h);
      gl.uniform1f(prog.u.uBedDiv, bed.div);
      bindTex(gl, unit, this.bedA!.tex, prog.u.uBedA);
      bindTex(gl, unit + 1, this.bedB!.tex, prog.u.uBedB);
    };

    // Heat the ice where the pointer rests on it.
    {
      const pr = this.p.heat;
      gl.useProgram(pr.prog);
      bindTex(gl, 0, this.heat.read.tex, pr.u.uHeat);
      const r = ice.rect;
      const on = p.active && r[2] > 0;
      gl.uniform3f(pr.u.uPtr, on ? (p.x - r[0]) / r[2] : -9, on ? (p.y - r[1]) / r[3] : -9, r[2] > 0 ? r[3] / r[2] : 1);
      gl.uniform1f(pr.u.uDt, dt);
      drawTo(gl, this.heat.write);
      this.heat.swap();
    }

    // Waves: fixed substeps of 1/120 s keep the wave speed frame-rate independent.
    const steps = Math.max(1, Math.min(3, Math.round(dt * 120)));
    const sub = dt / steps;
    const w = this.p.wave;
    gl.useProgram(w.prog);
    common(w, 1);
    gl.uniform1f(w.u.uDt, sub);
    gl.uniform4fv(w.u.uPtr, seg);
    gl.uniform4f(w.u.uIce, ice.rect[0], ice.rect[1], ice.rect[2], ice.rect[3]);
    gl.uniform2f(w.u.uIceMelt, ice.erode, ice.rect[2] > 0 ? this.meltRate : 0);
    gl.uniform1f(w.u.uAmbient, 1);
    if (this.iceTex) bindTex(gl, 3, this.iceTex.tex, w.u.uIceSdf);
    bindTex(gl, 4, this.detail.tex, w.u.uDetail);
    for (let i = 0; i < steps; i++) {
      bindTex(gl, 0, this.wave!.read.tex, w.u.uWave);
      gl.uniform2f(w.u.uShift, 0, i === 0 ? shift : 0);
      gl.uniform1f(w.u.uTime, this.time + i * sub);
      gl.uniform2f(w.u.uPtrForce, moving ? (0.25 + 0.75 * Math.min(speed / 700, 1)) * 0.17 : 0, 15);
      const d = this.drop;
      gl.uniform4f(w.u.uDrop, d.x, d.y, d.r, i === 0 ? d.s : 0);
      drawTo(gl, this.wave!.write);
      this.wave!.swap();
    }
    this.drop.s = 0;
    const g = this.p.waveGrad;
    gl.useProgram(g.prog);
    bindTex(gl, 0, this.wave!.read.tex, g.u.uWave);
    drawTo(gl, this.waveOut);

    // Pointer-driven velocity, kept divergence free.
    const va = this.p.velAdvect;
    gl.useProgram(va.prog);
    common(va, 1);
    bindTex(gl, 0, this.vel!.read.tex, va.u.uVel);
    gl.uniform2f(va.u.uShift, 0, shift);
    gl.uniform1f(va.u.uDt, dt);
    gl.uniform1f(va.u.uFlowSpeed, FLOW_SPEED);
    gl.uniform4fv(va.u.uPtr, seg);
    gl.uniform3f(va.u.uPtrVel, moving ? p.vx : 0, moving ? p.vy : 0, moving ? 22 : 0);
    drawTo(gl, this.vel!.write);
    this.vel!.swap();

    const vd = this.p.velDiv;
    gl.useProgram(vd.prog);
    bindTex(gl, 0, this.vel!.read.tex, vd.u.uVel);
    drawTo(gl, this.vel!.write);
    this.vel!.swap();
    const vp = this.p.velPressure;
    gl.useProgram(vp.prog);
    for (let i = 0; i < tier.jacobi; i++) {
      bindTex(gl, 0, this.vel!.read.tex, vp.u.uVel);
      drawTo(gl, this.vel!.write);
      this.vel!.swap();
    }
    const vj = this.p.velProject;
    gl.useProgram(vj.prog);
    bindTex(gl, 0, this.vel!.read.tex, vj.u.uVel);
    drawTo(gl, this.vel!.write);
    this.vel!.swap();

    // Foam and silt.
    const dy = this.p.dye;
    gl.useProgram(dy.prog);
    common(dy, 3);
    bindTex(gl, 0, this.dye!.read.tex, dy.u.uDye);
    bindTex(gl, 1, this.vel!.read.tex, dy.u.uVel);
    bindTex(gl, 2, this.waveOut!.tex, dy.u.uWave);
    if (this.iceTex) bindTex(gl, 5, this.iceTex.tex, dy.u.uIceSdf);
    bindTex(gl, 6, this.detail.tex, dy.u.uDetail);
    gl.uniform2f(dy.u.uShift, 0, shift);
    gl.uniform1f(dy.u.uDt, dt);
    gl.uniform1f(dy.u.uTime, this.time);
    gl.uniform1f(dy.u.uFlowSpeed, FLOW_SPEED);
    gl.uniform4fv(dy.u.uPtr, seg);
    gl.uniform2f(dy.u.uPtrForce, moving ? Math.min(speed / 700, 1) * 0.05 : 0, 12);
    gl.uniform4f(dy.u.uIce, ice.rect[0], ice.rect[1], ice.rect[2], ice.rect[3]);
    gl.uniform2f(dy.u.uIceMelt, ice.erode, ice.rect[2] > 0 ? this.meltRate : 0);
    drawTo(gl, this.dye!.write);
    this.dye!.swap();

    p.px = p.x;
    p.py = p.y;
    p.fresh = false;
  }

  private bindRender(top: number, scrollY: number, viewH: number, mode: number) {
    const gl = this.gl;
    const r = this.p.render;
    const tier = TIERS[this.tier];
    gl.useProgram(r.prog);
    const pal = this.palette();
    const ice = this.iceUniforms(scrollY);
    if (!this.hasSimTop) {
      this.simTop = Math.floor(top / tier.simDiv) * tier.simDiv - tier.simDiv;
    }
    gl.uniform2f(r.u.uView, this.cssW, this.cssH);
    gl.uniform1f(r.u.uTop, top);
    gl.uniform4f(r.u.uSim, this.simTop, tier.simDiv, this.simW, this.simH);
    gl.uniform2f(r.u.uBedSize, this.bedMeta.w, this.bedMeta.h);
    gl.uniform1f(r.u.uBedDiv, this.bedMeta.div);
    // The eye stands above the middle of the view. Its height sets how
    // much the walls and the bed slide as the page scrolls.
    gl.uniform3f(r.u.uCam, this.cssW / 2, scrollY + viewH / 2, Math.max(1500, this.cssW * 1.25));
    gl.uniform1f(r.u.uTime, this.time);
    gl.uniform1f(r.u.uFlowSpeed, FLOW_SPEED);
    gl.uniform1f(r.u.uQuality, tier.quality);
    gl.uniform1i(r.u.uMode, mode);
    gl.uniform1f(r.u.uScale, this.cssW < 860 ? 0.5 : 1);
    gl.uniform4f(r.u.uIce, ice.rect[0], ice.rect[1], ice.rect[2], ice.rect[3]);
    gl.uniform4f(r.u.uIceState, ice.state[0], ice.state[1], ice.state[2], ice.state[3]);
    gl.uniform1f(r.u.uIceAlive, ice.alive);
    gl.uniform3fv(r.u.uLand, pal.land);
    gl.uniform3fv(r.u.uBed, pal.bed);
    gl.uniform3fv(r.u.uAbsorb, pal.absorb);
    gl.uniform3fv(r.u.uScatter, pal.scatter);
    gl.uniform3fv(r.u.uSky, pal.sky);
    gl.uniform3fv(r.u.uFoam, pal.foam);
    gl.uniform3fv(r.u.uIceCol, pal.ice);
    gl.uniform4fv(r.u.uLight, pal.light);
    gl.uniform3fv(r.u.uGrainAmt, pal.grain);
    bindTex(gl, 0, this.bedA!.tex, r.u.uBedA);
    bindTex(gl, 1, this.bedB!.tex, r.u.uBedB);
    bindTex(gl, 2, this.waveOut!.tex, r.u.uWave);
    bindTex(gl, 3, this.vel!.read.tex, r.u.uVel);
    bindTex(gl, 4, this.dye!.read.tex, r.u.uDye);
    bindTex(gl, 5, this.detail.tex, r.u.uDetail);
    bindTex(gl, 6, this.grain.tex, r.u.uGrain);
    bindTex(gl, 7, (this.iceTex ?? this.grain).tex, r.u.uIceSdf);
    bindTex(gl, 8, this.heat.read.tex, r.u.uHeat);
    bindTex(gl, 9, (this.iceLow ?? this.grain).tex, r.u.uIceLow);
    bindTex(gl, 10, this.curv.tex, r.u.uCurv);
  }

  private render(top: number, scrollY: number, viewH: number) {
    this.bindRender(top, scrollY, viewH, 0);
    drawTo(this.gl, null, this.canvas.width, this.canvas.height);
  }

  private palette(): Palette {
    const a = PALETTES.light;
    const b = PALETTES.dark;
    const t = this.theme;
    if (t <= 0) return a;
    if (t >= 1) return b;
    const out: Record<string, number[]> = {};
    for (const k of Object.keys(a) as (keyof Palette)[]) out[k] = mix3(a[k] as number[], b[k] as number[], t);
    return out as unknown as Palette;
  }

  /**
   * Where the effect is, for the overlap test: 1 px per 2 CSS px, covering
   * the visible viewport at the given scroll. Water and ice are 255.
   */
  readMask(scrollY: number, viewH: number): { w: number; h: number; scale: number; data: Uint8Array } {
    const gl = this.gl;
    const scale = 2;
    const w = Math.ceil(this.cssW / scale);
    const h = Math.ceil(this.cssH / scale);
    if (!this.maskTarget || this.maskTarget.w !== w || this.maskTarget.h !== h) {
      freeTarget(gl, this.maskTarget);
      this.maskTarget = makeTarget(gl, w, h, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE });
    }
    const top = scrollY - this.margin;
    this.bindRender(top, scrollY, viewH, 1);
    drawTo(gl, this.maskTarget);
    const px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskTarget.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Flip to top-down rows and keep one channel.
    const data = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4;
      for (let x = 0; x < w; x++) data[y * w + x] = px[src + x * 4];
    }
    this.dirty = true;
    return { w, h, scale, data };
  }

  /** Step quality down when frames run long. Resolution is never touched. */
  private govern(ms: number) {
    if (ms > 250) return; // tab switch or a stall, not a signal
    const s = this.samples;
    s.push(ms);
    if (s.length < 30) return;
    const sorted = s.slice().sort((a, b) => a - b);
    const med = sorted[15];
    s.length = 0;
    // The display's own interval: the fastest steady median seen so far.
    if (med < this.base * 0.9 && med > 5) this.base = med;
    if (med > this.base * 1.45 && med > 12) {
      this.slow++;
      this.fast = 0;
    } else {
      this.fast++;
      this.slow = 0;
    }
    if (this.slow >= 3 && this.tier < TIERS.length - 1) {
      this.tier++;
      this.slow = 0;
      this.allocSim();
    }
  }

  get info() {
    return {
      tier: this.tier,
      dpr: this.dpr,
      backing: [this.canvas.width, this.canvas.height],
      sim: [this.simW, this.simH],
      melt: this.melt,
      margin: this.margin,
      cssH: this.cssH,
    };
  }

  destroy() {
    const gl = this.gl;
    this.wave?.free(gl);
    this.vel?.free(gl);
    this.dye?.free(gl);
    this.heat.free(gl);
    for (const t of [this.waveOut, this.bedA, this.bedB, this.iceTex, this.maskTarget, this.detail, this.grain]) freeTarget(gl, t);
    for (const k of Object.keys(this.p)) gl.deleteProgram(this.p[k].prog);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** Speed of the current where the flow map is 1, in CSS px per second. */
const FLOW_SPEED = 78;

/** Warmth left by the pointer on the ice. It soaks in, then refreezes. */
const HEAT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uHeat;
uniform vec3 uPtr;   // xy: pointer in ice uv, z: aspect (h / w)
uniform float uDt;
void main() {
  float h = texture(uHeat, vUv).r;
  h *= exp(-uDt * 0.45);
  vec2 d = (vUv - uPtr.xy) * vec2(1.0, uPtr.z);
  float g = exp(-dot(d, d) / 0.0009);
  h = min(h + g * uDt * 1.3, 1.0);
  o = vec4(h, 0.0, 0.0, 1.0);
}`;
