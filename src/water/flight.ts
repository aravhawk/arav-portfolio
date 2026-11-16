/**
 * The flight: the water engine behind a fixed, full-viewport canvas, seen
 * through a camera that scroll moves through an authored world.
 *
 * The engine is the page's own (same simulation, same ice field, same
 * governor and quality tiers). What differs is kept here: the shading pass
 * is the perspective one, the simulation covers a window of the world that
 * follows where the camera looks, and the bed comes from world.ts instead
 * of the DOM.
 */

import { onFrame } from '@/lib/frame';
import { haptic } from '@/lib/haptics';
import { BedPainter } from './bed';
import { type Basis, FLIGHT_SCREENS, MELT, SECTIONS, basisOf, flightKeys, groundUnder, heroDesign, poseAt, projectPoint, stillScroll, type Key, type V3 } from './camera';
import { type EngineOpts, FLOW_SPEED, ICE_GONE, TIERS, WaterEngine } from './engine';
import { type Target, bindTex, drawTo, freeTarget, makeTarget } from './gl';
import { BLOOM_DOWN, BLOOM_UP, FINISH } from './shaders/finish';
import { FLIGHT, FLIGHT_FREEBOARD } from './shaders/flight';
import { GROUND, MOUNT_EDGE, MOUNT_H, MOUNT_PANO, PANO } from './shaders/terrain';
import { makeSolver } from './stage';
import { LAKE, OUTLET, SHOAL_Y, SLAB, WORLD, paintWorld, rasterName } from './world';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The simulation's cell in world units, per quality tier. */
const CELL = [4, 5, 6, 8];
/** How much of the world, along the flight, the simulation covers. */
const SPAN = 2300;
/** How thick the lake's sheet stands above the water, world units. */
const ICE_H = 11;

export class FlightEngine extends WaterEngine {
  private slabTex: WebGLTexture | null = null;
  private slabTint: V3 = [0.2, 0.2, 0.2];
  private camKey = '';

  constructor(canvas: HTMLCanvasElement, opts: EngineOpts) {
    super(canvas, opts);
    this.crackCell = 700;
    // The world does not scroll under the sheet: it melts where it lies.
    this.meltRange = 0;
    this.lastScroll = 0;
  }

  protected sources() {
    const s = super.sources();
    delete s.render;
    s.flight = FLIGHT;
    s.ground = GROUND;
    s.mountH = MOUNT_H;
    s.mountPano = MOUNT_PANO;
    s.mountEdge = MOUNT_EDGE;
    s.bloomDown = BLOOM_DOWN;
    s.bloomUp = BLOOM_UP;
    s.finish = FINISH;
    return s;
  }

  /** The snow's relief, baked once. */
  private ground!: Target;
  /** The ranges, marched once into a panorama and lit each frame. */
  private pano!: Target;

  /**
   * Trilinear, and as anisotropic as the device allows: a ground seen at a
   * low angle is long and thin under each pixel, and this is what keeps it
   * both sharp and still. Without the extension it is plain trilinear.
   */
  private filterGround(t: Target) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) {
      const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
    }
  }

  protected bake() {
    super.bake();
    const gl = this.gl;
    this.ground = makeTarget(gl, 1024, 1024, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, wrap: gl.REPEAT });
    gl.useProgram(this.p.ground.prog);
    drawTo(gl, this.ground);
    this.filterGround(this.ground);
    this.filterGround(this.grain);
    this.filterGround(this.detail);
    this.bakeRanges();
  }

  private bakeRanges() {
    const gl = this.gl;
    const rgba8 = { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    const country = makeTarget(gl, 1024, 1024, { ...this.f16(), wrap: gl.REPEAT });
    gl.useProgram(this.p.mountH.prog);
    drawTo(gl, country);
    const w = Math.min(PANO.w, this.maxTexture);
    const raw = makeTarget(gl, w, PANO.h, { ...rgba8, filter: gl.NEAREST });
    gl.useProgram(this.p.mountPano.prog);
    bindTex(gl, 0, country.tex, this.p.mountPano.u.uH);
    drawTo(gl, raw);
    this.pano = makeTarget(gl, w, PANO.h, { ...rgba8, wrap: gl.MIRRORED_REPEAT });
    gl.useProgram(this.p.mountEdge.prog);
    bindTex(gl, 0, raw.tex, this.p.mountEdge.u.uPano);
    drawTo(gl, this.pano);
    gl.bindTexture(gl.TEXTURE_2D, this.pano.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    freeTarget(gl, country);
    freeTarget(gl, raw);
  }

  /** The camera the name is cut for (see the ice field). */
  nameCut: [number, number, number, number] = [0, 0, 1, 0];

  protected bindIce(prog: Parameters<WaterEngine['bindIce']>[0], ice: Parameters<WaterEngine['bindIce']>[1], sdfUnit: number, snowUnit: number) {
    super.bindIce(prog, ice, sdfUnit, snowUnit);
    // (The cut is a hair wider than the drawn letter: its edge is blended over a pixel, and the blend belongs to the ice.)
    if (ice.rect[2] > 0) this.gl.uniform4f(prog.u.uIceA, ice.a[0] + 3, ice.a[1], ice.a[2], ice.a[3]);
    if (prog.u.uIceP) this.gl.uniform4fv(prog.u.uIceP, this.nameCut);
  }

  protected simCell() {
    return CELL[this.tier];
  }

  protected simSpan(): [number, number] {
    return [WORLD.w, SPAN];
  }

  protected get fieldW() {
    return WORLD.w;
  }

  /** How far the pointer's push reaches: about the same on screen wherever it lands. */
  setReach(units: number) {
    this.ptrRadius = Math.min(70, Math.max(12, units));
  }

  /** The product picture the slab carries. */
  setSlab(img: HTMLImageElement) {
    const gl = this.gl;
    if (this.slabTex) gl.deleteTexture(this.slabTex);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.slabTex = tex;
    // The light it throws is its own mean colour.
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, 8, 8);
      const d = ctx.getImageData(0, 0, 8, 8).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += Math.pow(d[i + k] / 255, 2.2);
      this.slabTint = [sum[0] / 64, sum[1] / 64, sum[2] / 64];
    } catch {
      // A tainted canvas only costs the tint.
    }
    this.dirty = true;
  }

  /**
   * One frame.
   * @param cam the camera
   * @param aspect the canvas's width over its height
   * @param melt 0..1, how far the lake's ice has melted (a function of scroll)
   * @param end 0..1, the last move over open water
   */
  frame(now: number, cam: Basis, aspect: number, melt: number, end: number) {
    const gl = this.gl;
    if (!this.ready || !this.bedA || !this.bedB || !this.wave || gl.isContextLost()) return;

    let dt = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    if (this.frameLog && dt < 1) this.frameLog.push(dt * 1000);
    this.govern(dt * 1000);
    dt = Math.min(dt, 1 / 20);

    if (this.theme !== this.themeTarget) {
      const k = 1 - Math.exp(-dt * 9);
      this.theme += (this.themeTarget - this.theme) * k;
      if (Math.abs(this.theme - this.themeTarget) < 0.002) this.theme = this.themeTarget;
      this.dirty = true;
    }

    // Melt follows scroll, so it reverses exactly.
    const m = this.iceTex ? Math.min(1, Math.max(0, melt)) : 0;
    const rate = Math.abs(m - this.melt) / Math.max(dt, 1e-3);
    this.meltRate += (Math.min(rate, 1.1) - this.meltRate) * (1 - Math.exp(-dt * 6));
    this.melt = m;
    const want = this.iceTex && !this.still && m > 0.12 && m < ICE_GONE ? Math.min(1, this.meltRate * 2.4) : 0;
    this.meltAct += (want - this.meltAct) * (1 - Math.exp(-dt * (want > this.meltAct ? 9 : 4.2)));
    if (this.meltAct < 0.004 && want === 0) this.meltAct = 0;
    if (m >= 1 && !this.meltDone) {
      this.meltDone = true;
      this.onMelt?.(true);
    } else if (m < 0.9 && this.meltDone) {
      this.meltDone = false;
      this.onMelt?.(false);
    }

    const key = `${cam.pos.join(',')}|${cam.f.join(',')}|${cam.tan}|${m}`;
    if (key !== this.camKey) {
      this.camKey = key;
      this.dirty = true;
    }

    // The simulation's window follows where the camera looks: from a little
    // behind the foot of the frame to well beyond its middle.
    const near = groundUnder(cam, 0.5, 0.9, aspect) ?? { x: cam.pos[0], y: cam.pos[1], t: 0 };
    const top = Math.min(WORLD.h - SPAN * 0.5, Math.max(-SPAN * 0.5, near.y - SPAN * 0.14));

    if (this.still) {
      if (!this.dirty) return;
      if (!this.hasSimTop) {
        const dx = this.simCell();
        this.simTop = Math.floor(top / dx) * dx - dx;
      }
      this.draw(cam, aspect, end);
      this.dirty = false;
      return;
    }
    this.time += dt;
    this.simulate(dt, top);
    this.draw(cam, aspect, end);
    this.dirty = false;
  }

  private draw(cam: Basis, aspect: number, end: number) {
    const gl = this.gl;
    const r = this.p.flight;
    const tier = TIERS[this.tier];
    gl.useProgram(r.prog);
    const pal = this.palette();
    const ice = this.iceUniforms(0);
    const night = Math.min(1, Math.max(0, this.theme));
    gl.uniform3fv(r.u.uCamPos, cam.pos);
    gl.uniform3fv(r.u.uCamF, cam.f);
    gl.uniform3fv(r.u.uCamR, cam.r);
    gl.uniform3fv(r.u.uCamU, cam.u);
    gl.uniform2f(r.u.uLens, cam.tan, aspect);
    gl.uniform1f(r.u.uPxAng, (2 * cam.tan) / this.canvas.height);
    gl.uniform4f(r.u.uSim, this.simTop, this.simCell(), this.simW, this.simH);
    gl.uniform2f(r.u.uBedSize, this.bedMeta.w, this.bedMeta.h);
    gl.uniform1f(r.u.uBedDiv, this.bedMeta.div);
    gl.uniform1f(r.u.uTime, this.time);
    gl.uniform1f(r.u.uFlowSpeed, FLOW_SPEED);
    gl.uniform1f(r.u.uQuality, tier.quality);
    gl.uniform1f(r.u.uNight, night);
    gl.uniform1f(r.u.uWorldW, WORLD.w);
    gl.uniform1f(r.u.uShoal, this.shoalY);
    gl.uniform1f(r.u.uEnd, end);
    this.bindIce(r, ice, 7, 9);
    gl.uniform1f(r.u.uIceH, ICE_H);
    gl.uniform1f(r.u.uIceOn, this.iceTex && this.melt < 0.999 ? 1 : 0);
    gl.uniform1f(r.u.uGlow, this.iceTex ? 1 - smooth(0.5, 1, this.melt) : 0);
    gl.uniform1f(r.u.uMeltAct, this.meltAct);
    gl.uniform3fv(r.u.uBed, pal.bed);
    gl.uniform3fv(r.u.uAbsorb, pal.absorb);
    gl.uniform3fv(r.u.uScatter, pal.scatter);
    gl.uniform3fv(r.u.uIceCol, pal.ice);
    gl.uniform4fv(r.u.uLight, pal.light);

    // The slab, and the part of the screen it can be on.
    const sin = Math.sin(SLAB.turn);
    const cos = Math.cos(SLAB.turn);
    const nx = -sin;
    const ny = -cos;
    const rx = cos;
    const ry = -sin;
    let x0 = 1;
    let y0 = 1;
    let x1 = 0;
    let y1 = 0;
    let behind = 0;
    for (let i = 0; i < 8; i++) {
      const side = (i & 1 ? 0.5 : -0.5) * SLAB.w;
      const back = i & 2 ? SLAB.thick : 0;
      const z = SLAB.lift + (i & 4 ? SLAB.h : 0);
      const pr = projectPoint(cam, [SLAB.x + rx * side - nx * back, SLAB.y + ry * side - ny * back, z], aspect);
      if (pr[2] < 1) behind++;
      x0 = Math.min(x0, pr[0]);
      x1 = Math.max(x1, pr[0]);
      y0 = Math.min(y0, 1 - pr[1]);
      y1 = Math.max(y1, 1 - pr[1]);
    }
    const on = this.slabTex && behind < 8;
    gl.uniform3f(r.u.uSlabPos, SLAB.x, SLAB.y, SLAB.lift);
    gl.uniform4f(r.u.uSlabDir, nx, ny, rx, ry);
    gl.uniform3f(r.u.uSlabSize, on ? SLAB.w : 0, SLAB.h, SLAB.thick);
    if (behind > 0) gl.uniform4f(r.u.uSlabBox, 0, 0, 1, 1);
    else gl.uniform4f(r.u.uSlabBox, x0 - 0.01, y0 - 0.01, x1 + 0.01, y1 + 0.01);
    gl.uniform3fv(r.u.uSlabTint, this.slabTint);

    bindTex(gl, 0, this.bedA!.tex, r.u.uBedA);
    bindTex(gl, 1, this.bedB!.tex, r.u.uBedB);
    bindTex(gl, 2, this.waveOut!.tex, r.u.uWave);
    bindTex(gl, 3, this.vel!.read.tex, r.u.uVel);
    bindTex(gl, 5, this.detail.tex, r.u.uDetail);
    bindTex(gl, 6, this.grain.tex, r.u.uGrain);
    bindTex(gl, 8, this.heat.read.tex, r.u.uHeat);
    bindTex(gl, 10, this.curv.tex, r.u.uCurv);
    bindTex(gl, 11, (this.slabTex ?? this.grain.tex) as WebGLTexture, r.u.uSlabTex);
    bindTex(gl, 12, this.ground.tex, r.u.uGround);
    bindTex(gl, 13, this.pano.tex, r.u.uPano);
    this.finish(night, end);
  }

  /** The scene in linear light, and its highlights at a half, a quarter and an eighth. */
  private film: Target[] = [];

  private filmTargets(w: number, h: number) {
    const gl = this.gl;
    if (this.film.length && this.film[0].w === w && this.film[0].h === h) return;
    for (const t of this.film) freeTarget(gl, t);
    this.film = [];
    for (let i = 0; i < 4; i++) {
      const tw = Math.max(1, Math.round(w / (1 << i)));
      const th = Math.max(1, Math.round(h / (1 << i)));
      this.film.push(makeTarget(gl, tw, th, { ...this.f16(), filter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE }));
    }
    // Two more, at a quarter and a half, to gather the levels into one.
    for (const i of [2, 1]) this.film.push(makeTarget(gl, this.film[i].w, this.film[i].h, { ...this.f16(), filter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE }));
  }

  /** Draw the scene to the float target, gather its highlights, and make the picture. */
  private finish(night: number, end: number) {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    // (Making a texture binds it: on a unit the scene does not use.)
    gl.activeTexture(gl.TEXTURE15);
    this.filmTargets(w, h);
    const f = this.film;
    drawTo(gl, f[0]);
    const d = this.p.bloomDown;
    gl.useProgram(d.prog);
    for (let i = 1; i < 4; i++) {
      bindTex(gl, 0, f[i - 1].tex, d.u.uSrc);
      gl.uniform2f(d.u.uTexel, 0.5 / f[i - 1].w, 0.5 / f[i - 1].h);
      // By day only what outshines sunlit snow blooms; before dawn, the aurora and its mirror.
      gl.uniform1f(d.u.uCut, i === 1 ? 1.9 - 1.5 * night : 0);
      drawTo(gl, f[i]);
    }
    // Gathered back up at small sizes, so the full-size pass reads the glow once.
    const up = this.p.bloomUp;
    gl.useProgram(up.prog);
    bindTex(gl, 0, f[2].tex, up.u.uA);
    bindTex(gl, 1, f[3].tex, up.u.uB);
    gl.uniform2f(up.u.uTexelB, 1 / f[3].w, 1 / f[3].h);
    gl.uniform2f(up.u.uW, 0.5, 0.5);
    drawTo(gl, f[4]);
    bindTex(gl, 0, f[1].tex, up.u.uA);
    bindTex(gl, 1, f[4].tex, up.u.uB);
    gl.uniform2f(up.u.uTexelB, 1 / f[4].w, 1 / f[4].h);
    gl.uniform2f(up.u.uW, 0.34, 0.66);
    drawTo(gl, f[5]);
    const p = this.p.finish;
    gl.useProgram(p.prog);
    bindTex(gl, 0, f[0].tex, p.u.uScene);
    bindTex(gl, 1, f[5].tex, p.u.uGlow);
    gl.uniform1f(p.u.uBloom, 0.55);
    gl.uniform1f(p.u.uTime, this.time);
    gl.uniform1f(p.u.uEnd, end);
    drawTo(gl, null, w, h);
  }

  destroy() {
    for (const t of this.film) freeTarget(this.gl, t);
    if (this.slabTex) this.gl.deleteTexture(this.slabTex);
    freeTarget(this.gl, this.ground);
    freeTarget(this.gl, this.pano);
    super.destroy();
  }
}

export interface FlightHandle {
  destroy(): void;
  engine: FlightEngine;
  rebuild(): void;
  /** The camera's scroll position in screens and where it is, for the checks. */
  state(): { s: number; pos: V3; unit: number };
}

/**
 * Mount the flight on a page. `root` holds the canvas; the page's sections
 * (elements with `data-fl`) give the scroll its length and carry the words.
 * Throws when WebGL2 or float targets are missing: the caller keeps the
 * plain page.
 */
export async function mountFlight(root: HTMLElement, isCancelled: () => boolean = () => false): Promise<FlightHandle | null> {
  const html = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'flight-canvas';

  const mqStill = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const themeNow = () => (html.dataset.theme === 'dark' ? 1 : 0);

  const engine = new FlightEngine(canvas, { theme: themeNow(), still: mqStill.matches, coarse });
  await engine.prepare();
  if (isCancelled()) {
    engine.destroy();
    return null;
  }
  root.appendChild(canvas);
  const solver = makeSolver();

  let viewW = 1;
  let viewH = 1;
  let aspect = 1.6;
  /** One screen of scroll, in px: what the sections are sized in. */
  let unit = 1;
  let keys: Key[] = flightKeys(aspect);
  let cutFor = 0;
  let built = false;
  let destroyed = false;
  let buildToken = 0;
  let cam: Basis = basisOf(keys[0]);
  let sNow = 0;

  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-fl]'));
  const words = Array.from(document.querySelectorAll<HTMLElement>('[data-fl-from]')).map((el) => ({
    el,
    from: Number(el.dataset.flFrom),
    to: Number(el.dataset.flTo),
    on: false as boolean | null,
  }));
  words.forEach((w) => (w.on = null));

  let meltFelt = false;
  engine.onMelt = (done) => {
    if (done && !meltFelt) {
      meltFelt = true;
      haptic('soft');
    }
  };

  function measureView() {
    viewW = html.clientWidth;
    viewH = Math.max(window.innerHeight, html.clientHeight);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    engine.resize(viewW, viewH, 0, window.devicePixelRatio || 1);
    aspect = viewW / viewH;
    keys = flightKeys(aspect);
    const first = sections[0];
    // (Each section but the last is one screen longer than its stretch of scroll, so its words can stay pinned to the end of it.)
    unit = first ? first.offsetHeight / (SECTIONS.hero + 1) : viewH;
  }

  /** The bed is the same for every screen; it is carved once. */
  async function buildBed() {
    const rows = Math.min(engine.maxTexture, coarse ? 4096 : 8192) - 8;
    const cells = coarse ? 1.2e6 : 3.0e6;
    const div = Math.max(3, WORLD.h / rows, Math.sqrt((WORLD.w * WORLD.h) / cells));
    const painter = new BedPainter(WORLD.w, WORLD.h, div);
    paintWorld(painter);
    const r = painter.rasters();
    const sd = await solver.solve({ alpha: r.mask, w: painter.w, h: painter.h, clamp: r.clampTexels, scale: painter.div });
    if (destroyed) return false;
    engine.setBed(painter.assemble(sd.sd, r.flow));
    engine.shoalY = SHOAL_Y;
    engine.lake = { y0: LAKE.y0, y1: LAKE.y1 };
    engine.meltPath = { x: OUTLET.x, y: OUTLET.y, reach: 900, w: OUTLET.w };
    return true;
  }

  /** The name is one line on a wide screen and two on a tall one. */
  async function buildName() {
    const token = ++buildToken;
    const host = document.querySelector<HTMLElement>('[data-ice]');
    const family = host ? getComputedStyle(host).fontFamily : 'system-ui, sans-serif';
    const hero = heroDesign(aspect);
    const ice = rasterName(hero.name, family);
    const sd = await solver.solve({ alpha: ice.alpha, w: ice.tw, h: ice.th, clamp: 400, scale: ice.scale });
    if (destroyed || token !== buildToken) return;
    engine.iceRect = ice.rect;
    engine.nameCut = hero.cut;
    engine.setIce({ sd: sd.sd, w: ice.tw, h: ice.th, minSd: sd.min });
  }

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      measureView();
      // The name is cut for this screen's first camera: a new shape, a new cut.
      if (Math.abs(aspect - cutFor) > 0.004) {
        cutFor = aspect;
        void buildName();
      }
    }, 120);
  };

  measureView();
  if (document.fonts?.status !== 'loaded') {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  }
  // The name's own face may not have been asked for yet: ask.
  try {
    const host = document.querySelector<HTMLElement>('[data-ice]');
    if (host) await Promise.race([document.fonts.load(`800 100px ${getComputedStyle(host).fontFamily}`, 'Arav Jain'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    // The fallback face is drawn instead.
  }
  if (isCancelled() || !(await buildBed())) {
    solver.dispose();
    engine.destroy();
    canvas.remove();
    return null;
  }
  cutFor = aspect;
  await buildName();
  measureView();
  built = true;
  html.dataset.flight = 'on';

  // The product picture: the slab appears when it has loaded.
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (!destroyed) engine.setSlab(img);
  };
  img.src = root.dataset.slab || '/media/infiniview-hero.webp';

  const ro = new ResizeObserver(onResize);
  ro.observe(document.body);
  window.addEventListener('resize', onResize);
  const onTheme = () => engine.setTheme(themeNow());
  window.addEventListener('themechange', onTheme);
  const onStill = () => engine.setStill(mqStill.matches);
  mqStill.addEventListener('change', onStill);

  // The pointer meets the water where its ray meets the water's plane.
  const toWater = (e: PointerEvent) => {
    const hit = groundUnder(cam, e.clientX / viewW, e.clientY / viewH, aspect, -FLIGHT_FREEBOARD);
    if (!hit || hit.t > 6000) return null;
    return { x: hit.x, y: hit.y, reach: 15 * hit.t * ((2 * cam.tan) / viewH) };
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const hit = toWater(e);
    if (!hit) {
      engine.pointerLeave();
      return;
    }
    engine.setReach(hit.reach);
    engine.pointerMove(hit.x, hit.y);
  };
  const onDown = (e: PointerEvent) => {
    const hit = toWater(e);
    if (hit) engine.splash(hit.x, hit.y, Math.min(90, Math.max(16, hit.reach * 1.5)), 1.5);
  };
  const onLeave = () => engine.pointerLeave();
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  const off = onFrame((now) => {
    if (!built) return;
    const raw = window.scrollY / unit;
    // Each block of words comes in and goes out with its stretch of scroll.
    for (const w of words) {
      const on = raw >= w.from && raw < w.to;
      if (on !== w.on) {
        w.on = on;
        w.el.toggleAttribute('data-on', on);
      }
    }
    // Under the ending's picture there is nothing of the flight to see.
    if (raw > FLIGHT_SCREENS + 0.25) return;
    // Nothing may glide when motion is reduced: each section shows its
    // composed frame.
    const s = mqStill.matches ? stillScroll(raw) : raw;
    sNow = s;
    cam = basisOf(poseAt(keys, s));
    const melt = (s - MELT.from) / (MELT.to - MELT.from);
    const end = smooth(FLIGHT_SCREENS - 1.7, FLIGHT_SCREENS - 1, s);
    engine.frame(now, cam, aspect, melt, end);
  }, 10);

  return {
    engine,
    rebuild: onResize,
    state: () => ({ s: sNow, pos: cam.pos, unit }),
    destroy() {
      destroyed = true;
      off();
      ro.disconnect();
      solver.dispose();
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('themechange', onTheme);
      mqStill.removeEventListener('change', onStill);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      engine.destroy();
      canvas.remove();
      delete html.dataset.flight;
    },
  };
}
