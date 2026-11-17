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
import { emit, flightSignal, pictureSignal, pointerSignal, signals } from '@/lib/signals';
import { BedPainter } from './bed';
import { makeCallouts } from './callouts';
import { type Basis, END_AT, MELT, SECTIONS, SETTLE_AT, SUN_END_AZ, basisOf, dayAt, endLens, flightKeys, groundUnder, heroDesign, poseAt, projectPoint, stillScroll, type Key, type V3 } from './camera';
import { type EngineOpts, FLOW_SPEED, ICE_GONE, TIERS, WaterEngine } from './engine';
import { type Pending, type Program, type Target, bindTex, compileBegin, compileDone, compileEnd, drawTo, freeTarget, makeTarget } from './gl';
import { DAWN, GATE, LAP, PULSE, dawnLight, nextDrip, stationsNear, stepGates } from './moments';
import { BLOOM_DOWN, BLOOM_KEEP, BLOOM_UP } from './shaders/finish';
import { flightSource, freeboardAt } from './shaders/flight';
import { GROUND, MOUNT_EDGE, MOUNT_H, MOUNT_PANO, PANO, SHADE_DIRS, SNOW_H } from './shaders/terrain';
import { skyAt } from './sky';
import { makeSolver } from './stage';
import { CANYON, COLS, DAM, DELTA, LAKE, LATTICE, OUTLET, REST, SHARDS, SHOAL_Y, SLAB, SLUICES, TARN, TRIBS, WORLD, paintWorld, rasterName, tribWidth } from './world';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The simulation's cell in world units, per quality tier. */
const CELL = [4, 5, 6, 8];
/** How much of the world, along the flight, the simulation covers. */
const SPAN = 2300;
/** How thick the lake's sheet stands above the water, world units. */
const ICE_H = 16;
/** The melt at which the last of the name's blades goes under (see bindIce: they fade from 0.5 to 0.57). */
const NAME_GONE = 0.555;

/**
 * The ribbon of light at the ending. `at`: where its foot stands in the
 * frame, as a share of half the frame's width right of its middle (the sun
 * stands at 0.46, or 0.7 on an upright screen). `lean`: how far it leans
 * toward the sun as it climbs. `e0` and `reach` are the shading pass's own
 * (RIB_E0, RIB_REACH).
 */
const RIBBON = { at: (aspect: number) => (aspect < 0.8 ? 0.16 : 0.2), lean: 0.5, e0: 0.1, reach: 0.13 };

/** The light event at the ending happens once in a visit: after it, the sun stays up and the line of light holds. */
let dawned = false;

/** What the page tells the picture each frame, beyond the camera. */
export interface FlightMoment {
  /** 0..1, how far the lake's ice has melted */
  melt: number;
  /** 0..1, how far the day has come round */
  day: number;
  /** 0..1, how far the camera has settled on the ending */
  settle: number;
  /** true once it has come to rest there */
  rest: boolean;
  /** where the ending's words end, in u, and (narrow screens) how high they reach, in v from the foot; 0 when unused */
  calm: number;
  near: number;
  /** where the words now showing stand, in the frame (u, v from the foot): x0, y0, x1, y1 */
  box: [number, number, number, number];
  /** 0..1, how much the picture is calmed behind them, and whether they are light in both themes */
  boxK: number;
  boxLight: boolean;
}

/**
 * The scene's own cut of each picture. A page shows a picture whole, at
 * the page's width; the scene shows it a few hundred pixels wide inside
 * ice or under water, where small type would be a few pixels tall. So the
 * scene is given the same real material cut for that size, each from its
 * public source at the source's own resolution (nothing is redrawn):
 *  - the block: Infiniview's own card (infiniview.dev/opengraph-image.jpg,
 *    1200 x 630), its headline and its mark and nothing smaller;
 *  - the pool: the results at the size they were published (2324 x 1264;
 *    the page's copy is the same picture at 2000);
 *  - the hall: the top of rydar.org/iphone-app, cut to the page's column
 *    (1680 x 1050 of the 2880 x 1800 capture).
 */
const SCENE_PICS: Record<string, string> = {
  '/media/infiniview-hero.webp': '/media/infiniview-card.jpg',
  '/media/kilo-bench-results.webp': '/media/kilo-bench-results-2324.webp',
  '/media/rydar-app.webp': '/media/rydar-app-hero.webp',
};
export const scenePicture = (src: string) => SCENE_PICS[src] ?? src;

export class FlightEngine extends WaterEngine {
  private slabTex: WebGLTexture | null = null;
  private slabTint: V3 = [0.2, 0.2, 0.2];
  private sheetTex: WebGLTexture | null = null;
  private pulseHalf = -1;
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
    s.flight = flightSource(false);
    s.ground = GROUND;
    s.snowH = SNOW_H;
    s.mountH = MOUNT_H;
    s.mountPano = MOUNT_PANO;
    s.mountEdge = MOUNT_EDGE;
    s.bloomDown = BLOOM_DOWN;
    s.bloomUp = BLOOM_UP;
    s.bloomKeep = BLOOM_KEEP;
    return s;
  }

  /**
   * Start-up, in pieces no longer than a frame or two each. Every program
   * is handed to the driver at once and taken when the driver says it is
   * done (so the long shading program never holds the page), and the baked
   * textures are made one to a task.
   */
  async prepare(): Promise<void> {
    const gl = this.gl;
    const tick = () => new Promise<void>((r) => setTimeout(r, 0));
    const src = this.sources();
    const pending = Object.keys(src).map((k) => [k, compileBegin(gl, src[k], k)] as const);
    await tick();
    for (const [k, p] of pending) {
      for (let n = 0; n < 400 && !compileDone(gl, p); n++) await new Promise<void>((r) => setTimeout(r, 8));
      this.p[k] = compileEnd(gl, p);
      await tick();
    }
    super.bake();
    await tick();
    // The snow: its cut forms first, then (a task later) its slope and the shade those forms throw.
    // Half floats: an edge is cut from these values in the picture, and eight bits would show as steps along it.
    const cutH = makeTarget(gl, 1024, 1024, { ...this.f16(), wrap: gl.REPEAT });
    gl.useProgram(this.p.snowH.prog);
    drawTo(gl, cutH);
    await tick();
    this.ground = makeTarget(gl, 1024, 1024, { ...this.f16(), wrap: gl.REPEAT });
    gl.useProgram(this.p.ground.prog);
    bindTex(gl, 0, cutH.tex, this.p.ground.u.uH);
    gl.uniform4fv(this.p.ground.u.uDirs, SHADE_DIRS);
    drawTo(gl, this.ground);
    freeTarget(gl, cutH);
    this.filterGround(this.ground);
    await tick();
    this.filterGround(this.grain);
    this.filterGround(this.detail);
    await tick();
    await this.bakeRanges(tick);
    await tick();
  }

  /**
   * The pass's second variant, with the sea in it (see the shading pass).
   * It is handed to the driver once the page is running and taken when the
   * driver has finished; until then, and wherever the sea is far off, the
   * first variant draws.
   */
  private seaPending: Pending | null = null;
  private seaProg: Program | null = null;
  warmSea() {
    if (this.seaPending || this.seaProg || this.gl.isContextLost()) return;
    this.seaPending = compileBegin(this.gl, flightSource(true), 'flightSea');
  }
  private seaReady(): Program | null {
    if (!this.seaProg && this.seaPending && compileDone(this.gl, this.seaPending)) {
      try {
        this.seaProg = compileEnd(this.gl, this.seaPending);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') console.warn(err);
      }
      this.seaPending = null;
    }
    return this.seaProg;
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

  /** The panorama's size on this device. */
  private panoH: number = PANO.hSmall;

  /**
   * The ranges. On a full screen the country is cut finer and the panorama
   * is drawn finer than a pixel of the picture, so a ridge is as sharp as
   * the screen can show; it is marched in strips, a task apart, so no one
   * of them holds the page.
   */
  private async bakeRanges(tick: () => Promise<void>) {
    const gl = this.gl;
    const big = this.tier === 0 && this.maxTexture >= PANO.w;
    const rgba8 = { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    const side = big ? 2048 : 1024;
    const country = makeTarget(gl, side, side, { ...this.f16(), wrap: gl.REPEAT });
    gl.useProgram(this.p.mountH.prog);
    drawTo(gl, country);
    await tick();
    const w = big ? PANO.w : Math.min(PANO.wSmall, this.maxTexture);
    const h = big ? PANO.h : PANO.hSmall;
    this.panoH = h;
    const raw = makeTarget(gl, w, h, { ...rgba8, filter: gl.NEAREST });
    const strips = big ? 6 : 2;
    for (let i = 0; i < strips; i++) {
      if (gl.isContextLost()) break;
      gl.useProgram(this.p.mountPano.prog);
      bindTex(gl, 0, country.tex, this.p.mountPano.u.uH);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.floor((i * w) / strips), 0, Math.ceil(w / strips) + 1, h);
      drawTo(gl, raw);
      gl.disable(gl.SCISSOR_TEST);
      await tick();
    }
    this.pano = makeTarget(gl, w, h, { ...rgba8, wrap: gl.MIRRORED_REPEAT });
    gl.useProgram(this.p.mountEdge.prog);
    bindTex(gl, 0, raw.tex, this.p.mountEdge.u.uPano);
    drawTo(gl, this.pano);
    gl.bindTexture(gl.TEXTURE_2D, this.pano.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    this.findSunrise(w);
    freeTarget(gl, country);
    freeTarget(gl, raw);
  }

  /** Where the sun stands at the end of the flight, and how high the ranges are there. */
  sunAz = SUN_END_AZ;
  ridge = 0.03;

  /**
   * The ranges are cut from noise the device works out for itself, so their
   * skyline is read back once: the sun rises in the lowest saddle within a
   * few degrees of where the picture wants it, and it is known how high the
   * crest there stands, so its edge can be made to clear it.
   */
  private findSunrise(w: number) {
    const gl = this.gl;
    const col = (az: number) => Math.round((az / (2 * PANO.az) + 0.5) * w);
    const x0 = col(SUN_END_AZ - 0.2);
    const x1 = col(SUN_END_AZ + 0.2);
    const n = x1 - x0 + 1;
    const px = new Uint8Array(n * this.panoH * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pano.fbo);
    gl.readPixels(x0, 0, n, this.panoH, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // The skyline: the highest row in each column that is not open sky.
    const sky = new Float32Array(n);
    for (let x = 0; x < n; x++) {
      let top = 0;
      for (let y = this.panoH - 1; y >= 0; y--) {
        if (px[(y * n + x) * 4 + 3] < 235) {
          top = y + 1;
          break;
        }
      }
      sky[x] = (top / this.panoH) * PANO.el;
    }
    const perRad = w / (2 * PANO.az);
    const gap = Math.round(0.045 * perRad);
    const disc = Math.round(0.014 * perRad);
    let best = Infinity;
    let at = Math.round(n / 2);
    for (let x = gap; x < n - gap; x++) {
      let hi = 0;
      for (let k = -gap; k <= gap; k++) hi = Math.max(hi, sky[x + k] * (Math.abs(k) <= disc ? 1 : 0.7));
      // (A saddle nearer the wanted bearing wins over one a hair lower far from it.)
      const az = ((x0 + x) / w - 0.5) * 2 * PANO.az;
      const cost = hi + 0.03 * Math.abs(az - SUN_END_AZ);
      if (cost < best) {
        best = cost;
        at = x;
      }
    }
    let crest = 0;
    for (let k = -disc; k <= disc; k++) crest = Math.max(crest, sky[at + k]);
    this.sunAz = ((x0 + at) / w - 0.5) * 2 * PANO.az;
    this.ridge = Math.min(0.075, Math.max(0.012, crest));
  }

  /** How far the sky has come to the ending's, as last drawn. */
  private dusk = 0;

  /**
   * The light event: the sun's last lift, the line of light and the ribbon's
   * rise, each 0..1, run once by the clock when the camera first comes to
   * rest. The line runs out across the water; where it meets the far shore
   * it leaves the water and climbs, about two seconds from the sea to the
   * top of the frame.
   */
  private lift = dawned ? 1 : 0;
  private ray = dawned ? 1 : 0;
  private rise = dawned ? 1 : 0;
  private dawnT = -1;
  /** Called once, when the sun's edge first clears the ranges. */
  onDawn: (() => void) | null = null;
  private runDawn(rest: boolean) {
    if (this.still) {
      // Nothing moves by the clock: at the ending the light is simply there.
      this.lift = this.ray = this.rise = rest || dawned ? 1 : 0;
      if (rest) dawned = true;
      return;
    }
    if (rest && this.dawnT < 0 && !dawned) {
      this.dawnT = this.time;
      dawned = true;
      this.onDawn?.();
    }
    if (this.dawnT < 0) return;
    const t = this.time - this.dawnT;
    // (The line of light runs out over the first two thirds of `ray`; the ribbon climbs from where it ends.)
    ({ lift: this.lift, ray: this.ray, rise: this.rise } = dawnLight(t));
    if (t < DAWN.over) this.dirty = true;
  }

  /**
   * The ribbon of light: where its foot stands, how far it has come, and the
   * strip of the frame it can be in (the pass looks for it nowhere else).
   * Its foot is on the far waterline, right of the frame's middle and left
   * of the sun; it leans toward the sun as it climbs.
   */
  private setRibbon(r: Program, cam: Basis, aspect: number, seaOn: number, settle: number) {
    const gl = this.gl;
    const L = endLens(aspect);
    const th = Math.tan((L.fov * Math.PI) / 360);
    const az = this.sunAz - L.sunOff + Math.atan(RIBBON.at(aspect) * aspect * th);
    const fx = Math.sin(az);
    const fy = Math.cos(az);
    // (It belongs to the ending's frame: once it stands it holds there, and on the way back up the page it thins out
    // with the camera's leaving, so it is neither drawn nor paid for over the delta.)
    const on = seaOn > 0 && this.ray > 0 ? seaOn * Math.min(1, this.ray * 8) * smooth(0.2, 0.8, settle) : 0;
    let u0 = 1;
    let u1 = 0;
    if (on > 0) {
      // Points along it and along its image in the water, as the camera sees them now.
      for (let i = -6; i <= 6; i++) {
        const e = (i / 6) * 0.72;
        const q = Math.abs(e) / RIBBON.e0;
        const a = az + Math.asin(Math.min(0.9, RIBBON.lean * RIBBON.e0 * (Math.sqrt(1 + q * q) - 1)));
        const d: V3 = [Math.sin(a), Math.cos(a), e];
        const z = d[0] * cam.f[0] + d[1] * cam.f[1] + d[2] * cam.f[2];
        if (z < 0.2) continue;
        const u = 0.5 + (d[0] * cam.r[0] + d[1] * cam.r[1] + d[2] * cam.r[2]) / (z * cam.tan * aspect) / 2;
        u0 = Math.min(u0, u);
        u1 = Math.max(u1, u);
      }
      // (Room for its glow and dust, and for what the ripples do to its image.)
      const room = (RIBBON.reach + 0.05) / (2 * cam.tan * aspect);
      u0 -= room;
      u1 += room;
    }
    gl.uniform4f(r.u.uRay, this.ray, this.rise, on, RIBBON.lean);
    gl.uniform4f(r.u.uRib, fx, fy, u0, u1);
  }

  /**
   * The flight's governor. When frames are missed the shading gets leaner by
   * a step; nothing is resized and the simulation's grid is left alone, so
   * nothing jumps. `lean` is the step asked for, `leanNow` what is drawn:
   * the dropped terms are cross-faded over a few hundred milliseconds.
   *
   * Step 1 drops: the thin cloud and the aurora's rays in the water's mirror
   * (it keeps the curtain's wash), the ice's hairlines and the sheet's cast
   * shade, the second layer of current threads, the widest bloom level, and
   * a third of the pressure solve's rounds.
   * Step 2 also drops: the focused net of light on the bed (the baked net
   * stands in), the drift edges' lit lip and lee, and more of the pressure
   * solve. (The snow is never made leaner: it is the largest surface in the
   * frame, and all of it is baked, so there is nothing in it to drop that
   * would not show as softness.)
   */
  private lean = 0;
  private leanNow = 0;
  private gov = { n: 0, missed: 0, prev: 0, clean: 0, need: 10000, lastUp: -1e9, age: 0 };
  /** When the governor stepped, and to what: seconds of running time, step. */
  private leanLog: [number, number][] = [];

  protected jacobi() {
    const full = super.jacobi();
    return this.lean >= 2 ? Math.min(full, 5) : this.lean >= 1 ? Math.min(full, 8) : full;
  }

  protected govern(ms: number) {
    if (ms > 250) return; // a tab switch or a stall, not a signal
    const g = this.gov;
    // The dropped terms fade; they do not switch.
    if (this.leanNow !== this.lean) {
      const step = ms / 400;
      this.leanNow = this.leanNow < this.lean ? Math.min(this.lean, this.leanNow + step) : Math.max(this.lean, this.leanNow - step);
      this.dirty = true;
    }
    g.age += ms;
    // (The first seconds are the page settling, not the picture's cost.)
    if (g.age < 2500) return;
    const s = this.samples;
    s.push(ms);
    if (ms > Math.max(this.base * 1.45, 12)) g.missed++;
    // Looked at twice a second.
    if (s.length < 30) return;
    const med = s.slice().sort((x, y) => x - y)[15];
    const span = s.reduce((x, y) => x + y, 0);
    s.length = 0;
    // The display's own interval: the fastest steady median seen so far.
    if (med < this.base * 0.9 && med > 5) this.base = med;
    const missed = g.missed;
    g.missed = 0;
    // About a second of misses (two half-seconds running, each with two or
    // more), or half a second in which a quarter of the frames were late.
    if (((missed >= 2 && g.prev >= 2) || missed >= 8) && this.lean < 2) {
      this.lean++;
      this.leanLog.push([+this.time.toFixed(1), this.lean]);
      g.clean = 0;
      // Stepped back up not long ago and it did not hold: wait longer before trying again.
      if (this.time - g.lastUp < 40) g.need = Math.min(g.need * 2, 80000);
      g.prev = 0;
      return;
    }
    g.prev = missed;
    if (missed === 0) g.clean += span;
    else g.clean = 0;
    if (g.clean >= g.need && this.lean > 0) {
      this.lean--;
      this.leanLog.push([+this.time.toFixed(1), this.lean]);
      g.clean = 0;
      g.lastUp = this.time;
    }
  }

  /** For the checks: hold a shading step (null hands it back to the governor). */
  holdLean(step: number | null) {
    if (step === null) {
      this.gov.age = 2500;
      return;
    }
    this.lean = Math.min(2, Math.max(0, step));
    this.gov.age = -1e12;
  }

  get info() {
    return { ...super.info, tier: Math.max(this.tier, this.lean), simTier: this.tier, lean: this.lean, leanLog: this.leanLog.slice(-12) };
  }

  /** Station 5: each column's height. */
  colH = new Float32Array([COLS.hMax, COLS.hMax * 0.75, COLS.hMax * 0.2, COLS.hMin]);
  /** Station 6: which sluice is open, how far open each is, and the surge down each. */
  gate = 0;
  private gateNow = new Float32Array([1, 0, 0]);
  private surge = new Float32Array(3);
  private dripAt = 0;
  private drip: { at: number; i: number } | null = null;
  private gateT = 0;
  private latLap = -1;
  /** The sluices follow the chosen gate: one lifts, the others drop, and a surge runs down the opened channel. */
  private runGates() {
    const dt = Math.min(0.05, Math.max(0, this.time - this.gateT));
    this.gateT = this.time;
    const i = this.gate;
    const at = this.surge[i];
    stepGates(this.gateNow, this.surge, i, dt, this.still);
    // The surge's head is real water: it throws rings as it goes.
    if (!this.still && at < 1 && Math.floor(at * GATE.rings) !== Math.floor(this.surge[i] * GATE.rings)) {
      const line = SLUICES[i];
      const k = Math.min(line.length - 2, Math.floor(at * (line.length - 1)));
      const f = at * (line.length - 1) - k;
      this.splash(line[k].x + (line[k + 1].x - line[k].x) * f, line[k].y + (line[k + 1].y - line[k].y) * f, 46, 1.4);
    }
  }
  /** How much of each later station's subject is there to see from this camera. */
  private stations(cam: Basis): [number, number, number, number] {
    return stationsNear(cam.pos);
  }

  /** Each stream's width at the confluence. */
  tribW = new Float32Array(TRIBS.length);

  /** The camera the name is cut for (see the ice field). */
  nameCut: [number, number, number, number] = [0, 0, 1, 0];
  /**
   * The name as blocks standing on the sheet (see the ice field and the
   * name's own shader): the upright plane each line's faces stand in, each
   * line's baseline and the height that parts the two lines in the raster,
   * the capitals' height, and a block's depth.
   */
  nameStand: { yf: [number, number]; base: [number, number]; split: number; cap: number; depth: number } | null = null;

  /** The rings the last blades leave, each with its own moment. */
  private ringQ: { at: number; x: number; y: number }[] = [];
  private nameRings() {
    const st = this.nameStand;
    const r = this.iceRect;
    if (!st || r.w <= 0) return;
    const two = st.split > -5e3;
    const per = two ? 4 : 8;
    this.ringQ.length = 0;
    for (let row = 0; row < (two ? 2 : 1); row++) {
      for (let i = 0; i < per; i++) {
        // (Across the letters' own width: the raster has room round them.)
        const x = r.x + r.w * (0.14 + (0.72 * (i + 0.5)) / per);
        this.ringQ.push({ at: this.time + 0.05 + 0.11 * ((i * 5 + row * 3) % per) + 0.04 * row, x, y: st.yf[row] + st.depth * 0.5 });
      }
    }
    this.ringQ.sort((a, b) => a.at - b.at);
  }

  protected bindIce(prog: Parameters<WaterEngine['bindIce']>[0], ice: Parameters<WaterEngine['bindIce']>[1], sdfUnit: number, snowUnit: number) {
    super.bindIce(prog, ice, sdfUnit, snowUnit);
    // (The cut is a hair wider than the drawn letter: its edge is blended over a pixel, and the blend belongs to the ice.)
    if (ice.rect[2] > 0) this.gl.uniform4f(prog.u.uIceA, ice.a[0] + 3, ice.a[1], ice.a[2], ice.a[3]);
    if (prog.u.uIceP) this.gl.uniform4fv(prog.u.uIceP, this.nameCut);
    if (prog.u.uIceLean) this.gl.uniform1f(prog.u.uIceLean, this.leanNow);
    const st = this.nameStand;
    const gl = this.gl;
    if (!prog.u.uNameG) return;
    if (!st || !this.iceMeta || ice.rect[2] <= 0) {
      gl.uniform4f(prog.u.uNameG, 0, 0, -1e4, 0);
      if (prog.u.uNameS) gl.uniform1f(prog.u.uNameS, 0);
      return;
    }
    // The blocks' melt, as the sheet's is: every number a function of the melt alone, so it reverses exactly.
    // They sweat, then thin evenly from every face and through their depth, sink into the water that has
    // opened under them, and the last of each is a thin clear blade.
    const m = this.melt;
    const half = -this.iceMeta.minSd;
    // (Whole, a face is cut a hair outside the drawn letter: its lit arris is the hair, and the letter itself is all deep ice.)
    const back = -1.4 + half * 0.4 * smooth(0.1, 0.52, m);
    // (They keep most of their depth, and so their colour, until dark water has opened behind them; then they thin fast.)
    const depth = st.depth * (1 - 0.3 * smooth(0.12, 0.4, m) - 0.58 * smooth(0.4, 0.55, m));
    // (They go down steadily, a little with every step of the scroll: a sixth of a capital's height by the end. More, and the foot of the J would be lost.)
    const sink = 0.16 * st.cap * Math.min(1, Math.max(0, (m - 0.12) / 0.44));
    const left = 1 - smooth(0.5, 0.57, m);
    gl.uniform4f(prog.u.uNameG, st.yf[0], st.yf[1], st.split, 1);
    gl.uniform4f(prog.u.uNameB, st.base[0], st.base[1], st.cap, st.depth);
    gl.uniform4f(prog.u.uNameM, back, depth, sink, left);
    // The sheet opens from under their feet. First the meltwater lies on the ice round them (the simulation
    // takes that for open water, so the pointer wakes it); then the ice under it goes, the pools join, and
    // from half way the one pool they have become is the sheet's own.
    const shade = prog === this.p.flight || prog === this.seaProg;
    const old = ice.a[0] + 3;
    const hole = -30 + 78 * smooth(0.1, 0.47, m);
    const pond = 32 + 34 * smooth(0.04, 0.45, m);
    const k = smooth(0.5, 0.6, m);
    gl.uniform4f(prog.u.uIceA, (shade ? hole : pond) * (1 - k) + old * k, ice.a[1], ice.a[2], ice.a[3]);
    gl.uniform4f(prog.u.uIceC, ice.c[0], ice.c[1], smooth(0.36, 0.57, m), ice.c[3]);
    if (prog.u.uNameP) gl.uniform4f(prog.u.uNameP, pond * (1 - k), smooth(0, 0.14, m), smooth(0.12, 0.3, m), smooth(0.41, 0.49, m));
    // The swept field they stand on is the thinnest ice: it goes to open water from under them outward, and all of it is gone soon after they are.
    if (prog.u.uNameS) gl.uniform1f(prog.u.uNameS, m < 0.14 ? 0 : 0.7 + 1.36 * Math.min(1, (m - 0.14) / 0.46));
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

  /**
   * A picture's texture. Its whole chain of smaller copies is made, it is
   * read between two of them, and along the tilt of a face seen at an angle
   * it is read as many times as the device allows (up to sixteen): small
   * type on a leaning face stays type. The shading pass says how large the
   * picture is on screen (see picRead), so the right copy is always the one
   * read.
   */
  private pictureTex(img: HTMLImageElement): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    // (Making a texture binds it: on a unit the scene does not use.)
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) {
      const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, max));
    }
    return tex;
  }

  /** The picture that lies on the pool's bed. */
  setSheet(img: HTMLImageElement) {
    if (this.sheetTex) this.gl.deleteTexture(this.sheetTex);
    this.sheetTex = this.pictureTex(img);
    this.dirty = true;
  }

  /** The app's picture, seen in the canyon's polished wall. (It takes the slab's unit: the two are never in one frame.) */
  private faceTex: WebGLTexture | null = null;
  private faceOn = false;
  setFace(img: HTMLImageElement) {
    if (this.faceTex) this.gl.deleteTexture(this.faceTex);
    this.faceTex = this.pictureTex(img);
    this.dirty = true;
  }

  /** The product picture the slab carries. */
  setSlab(img: HTMLImageElement) {
    if (this.slabTex) this.gl.deleteTexture(this.slabTex);
    this.slabTex = this.pictureTex(img);
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
   * @param at where the page is: the melt, the time of day, the settle on the ending
   */
  frame(now: number, cam: Basis, aspect: number, at: FlightMoment) {
    const melt = at.melt;
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
    // The last of the letters goes under: a ring leaves where each blade stood.
    if (this.nameStand && !this.still && this.melt < NAME_GONE && m >= NAME_GONE && this.melt > NAME_GONE - 0.08) this.nameRings();
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

    const key = `${cam.pos.join(',')}|${cam.f.join(',')}|${cam.tan}|${m}|${at.settle}|${at.calm}|${at.near}|${at.boxK}|${at.box.join(',')}`;
    if (key !== this.camKey) {
      this.camKey = key;
      this.dirty = true;
    }

    // The simulation's window follows where the camera looks: from a little
    // behind the foot of the frame to well beyond its middle.
    const near = groundUnder(cam, 0.5, 0.9, aspect) ?? { x: cam.pos[0], y: cam.pos[1], t: 0 };
    // (Past the world's last row the bed repeats, which is open sea: the window follows the camera out over it.)
    const top = Math.min(REST.y + SPAN * 0.5, Math.max(-SPAN * 0.5, near.y - SPAN * 0.14));
    this.runDawn(at.rest);
    // (A still picture is drawn only when something changes. The sea's variant of the pass arriving is such a change:
    // without this a reader who has asked for no motion and reaches the sea before it is ready keeps the river's water.)
    if (this.still && this.seaPending && compileDone(gl, this.seaPending)) this.dirty = true;

    if (this.still) {
      if (!this.dirty) return;
      if (!this.hasSimTop) {
        const dx = this.simCell();
        this.simTop = Math.floor(top / dx) * dx - dx;
      }
      this.draw(cam, aspect, at);
      // (A still frame has no frame before it to glow from: it is drawn twice.)
      this.draw(cam, aspect, at);
      this.dirty = false;
      return;
    }
    this.time += dt;
    while (this.ringQ.length && this.ringQ[0].at <= this.time) {
      const r = this.ringQ.shift()!;
      this.splash(r.x, r.y, 24, 0.85);
    }
    this.simulate(dt, top);
    this.draw(cam, aspect, at);
    this.dirty = false;
  }

  private draw(cam: Basis, aspect: number, at: FlightMoment) {
    const gl = this.gl;
    // The open sea is only worked out when the camera is near enough to see
    // it: from inside the canyon on. Further off the first variant draws.
    const toSea = Math.hypot(cam.pos[0] - 1900, cam.pos[1] - DELTA.sea);
    let seaOn = cam.pos[1] > DELTA.sea ? 1 : 1 - smooth(2600, 3400, toSea);
    const sea = seaOn > 0 ? this.seaReady() : null;
    if (!sea) seaOn = 0;
    const r = sea ?? this.p.flight;
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
    // The tarn's shards are only worked out from near by.
    const nearTarn = Math.hypot(cam.pos[0] - TARN.x, cam.pos[1] - TARN.y) < 3200 && cam.pos[2] < 700;
    gl.uniform1f(r.u.uShardOn, nearTarn ? 1 : 0);
    if (nearTarn) {
      // A pulse leaving a shard is a real splash at its foot.
      const half = Math.floor(this.time / (PULSE / 2));
      if (half !== this.pulseHalf) {
        this.pulseHalf = half;
        const from = SHARDS[half % 2];
        this.splash(from.x, from.y - from.r * 1.6, 34, 0.9);
      }
    }
    const st = this.stations(cam);
    gl.uniform4f(r.u.uSt, st[0], st[1], st[2], st[3]);
    this.faceOn = st[3] > 0;
    gl.uniform4fv(r.u.uColH, this.colH);
    this.runGates();
    gl.uniform3fv(r.u.uGate, this.gateNow);
    gl.uniform3fv(r.u.uSurge, this.surge);
    pictureSignal(this.time, st, this.gateNow, this.surge, this.ray, this.lift, this.rise);
    if (st[0] > 0.5 && !this.still) {
      // Meltwater drips from the columns into the shallows: real rings, most from the tallest.
      // (Each is chosen ahead of its time and published then, so its sound can be set for the frame that shows it.)
      if (!this.drip) {
        this.drip = nextDrip(Math.max(this.time, this.dripAt), this.colH, Math.random);
        emit('drip', this.drip.i, this.colH[this.drip.i] / COLS.hMax, this.drip.at);
      }
      if (this.time >= this.drip.at) {
        const i = this.drip.i;
        this.dripAt = this.time;
        this.drip = null;
        const a = Math.random() * Math.PI * 2;
        // (Each serac is as wide as it is tall, in proportion: the drop lands at its own foot, clear of its shoulder and its fallen block.)
        const r = COLS.r * (this.colH[i] / COLS.hMax) * 2.0;
        this.splash(COLS.xs[i] + Math.cos(a) * r, COLS.y + 26 * Math.sin(i * 2.3) + Math.sin(a) * r, 12 + 8 * Math.random(), 0.5);
      }
    } else this.drip = null;
    if (st[2] > 0.5 && !this.still) {
      // The light sets out with a real ring where the thread enters the pool.
      const lap = Math.floor(this.time / LAP);
      if (lap !== this.latLap) {
        this.latLap = lap;
        this.splash(LATTICE.x, LATTICE.y - LATTICE.pitch * 2 - 90, 30, 0.8);
      }
    }
    gl.uniform1f(r.u.uFlowSpeed, FLOW_SPEED);
    gl.uniform1f(r.u.uQuality, tier.quality);
    gl.uniform1f(r.u.uLean, this.leanNow);
    gl.uniform1f(r.u.uNight, night);
    gl.uniform1f(r.u.uWorldW, WORLD.w);
    gl.uniform1f(r.u.uShoal, this.shoalY);
    // The light: the hour's keys, worked out here once a frame.
    const sky = skyAt(night, at.day, this.lift, this.sunAz, this.ridge);
    gl.uniform3fv(r.u.uSkyZen, sky.zen);
    gl.uniform3fv(r.u.uSkyMid, sky.mid);
    gl.uniform3fv(r.u.uSkyHor, sky.hor);
    gl.uniform3fv(r.u.uSkyBand, sky.band);
    gl.uniform3fv(r.u.uSunDir, sky.sun);
    gl.uniform3fv(r.u.uKeyCol, sky.key);
    gl.uniform3fv(r.u.uKeyDir, sky.keyDir);
    gl.uniform3fv(r.u.uAmbCol, sky.amb);
    gl.uniform4f(r.u.uSkyK, sky.haze, sky.aurora, sky.dusk, sky.under);
    this.dusk = sky.dusk;
    gl.uniform4f(r.u.uSea, seaOn, at.settle, at.calm, at.near);
    gl.uniform4fv(r.u.uCalmBox, at.box);
    gl.uniform2f(r.u.uCalmK, at.boxK, at.boxLight ? 1 : 0);
    this.setRibbon(r, cam, aspect, seaOn, at.settle);
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
    if (r.u.uTribW) gl.uniform1fv(r.u.uTribW, this.tribW);

    bindTex(gl, 0, this.bedA!.tex, r.u.uBedA);
    bindTex(gl, 1, this.bedB!.tex, r.u.uBedB);
    bindTex(gl, 2, this.waveOut!.tex, r.u.uWave);
    bindTex(gl, 3, this.vel!.read.tex, r.u.uVel);
    bindTex(gl, 5, this.detail.tex, r.u.uDetail);
    bindTex(gl, 6, this.grain.tex, r.u.uGrain);
    bindTex(gl, 8, this.heat.read.tex, r.u.uHeat);
    bindTex(gl, 10, this.curv.tex, r.u.uCurv);
    bindTex(gl, 11, ((this.faceOn ? this.faceTex : null) ?? this.slabTex ?? this.grain.tex) as WebGLTexture, r.u.uSlabTex);
    bindTex(gl, 12, this.ground.tex, r.u.uGround);
    bindTex(gl, 13, this.pano.tex, r.u.uPano);
    this.finish(r, night);
  }

  /**
   * The glow. [0] the finished frame at a quarter size, [1] its highlights
   * at an eighth, [2] those at a sixteenth, [3] the two gathered at an
   * eighth: what the next frame's scene pass adds.
   */
  private film: Target[] = [];

  private filmTargets(w: number, h: number) {
    const gl = this.gl;
    const q = Math.max(1, Math.round(w / 4));
    if (this.film.length && this.film[0].w === q) return;
    for (const t of this.film) freeTarget(gl, t);
    const at = (d: number, o: Parameters<typeof makeTarget>[3]) => makeTarget(gl, Math.max(1, Math.round(w / d)), Math.max(1, Math.round(h / d)), { ...o, filter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
    this.film = [at(4, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE }), at(8, this.f16()), at(16, this.f16()), at(8, this.f16())];
  }

  /**
   * Draw the scene straight to the screen, finished, in one full-size pass.
   * Then take this frame's highlights, small, for the next frame's glow: a
   * frame's delay in a soft halo is not seen.
   */
  private finish(r: Program, night: number) {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    // (Making a texture binds it: on a unit the scene does not use.)
    gl.activeTexture(gl.TEXTURE15);
    this.filmTargets(w, h);
    const f = this.film;
    // Leanest: by day, when only the sun blooms, the halo is let go.
    const l2 = Math.min(1, Math.max(0, this.leanNow - 1));
    // (At the ending the sun itself is in the frame: its own skirts carry it, and the glow is held back.)
    const bloom = 0.55 * (1 - l2 * (1 - night)) * (1 - 0.45 * this.dusk);
    gl.useProgram(r.prog);
    bindTex(gl, 14, f[3].tex, r.u.uGlowTex);
    // (Unit 15 is the scratch unit: the pool's picture is put back on it for each draw.)
    bindTex(gl, 15, (this.sheetTex ?? this.grain.tex) as WebGLTexture, r.u.uSheetTex);
    gl.uniform1f(r.u.uSheetOn, this.sheetTex ? 1 : 0);
    gl.uniform1f(r.u.uBloom, bloom);
    drawTo(gl, null, w, h);
    if (bloom <= 0.001) return;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, f[0].fbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, f[0].w, f[0].h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    const k = this.p.bloomKeep;
    gl.useProgram(k.prog);
    bindTex(gl, 0, f[0].tex, k.u.uSrc);
    // By day only what outshines sunlit snow blooms; before dawn, the aurora and its mirror.
    gl.uniform1f(k.u.uCut, 0.86 - 0.36 * night);
    gl.uniform1f(k.u.uGain, 3.2 - 2.65 * night);
    drawTo(gl, f[1]);
    const d = this.p.bloomDown;
    gl.useProgram(d.prog);
    bindTex(gl, 0, f[1].tex, d.u.uSrc);
    gl.uniform2f(d.u.uTexel, 0.5 / f[1].w, 0.5 / f[1].h);
    gl.uniform1f(d.u.uCut, 0);
    drawTo(gl, f[2]);
    const up = this.p.bloomUp;
    gl.useProgram(up.prog);
    bindTex(gl, 0, f[1].tex, up.u.uA);
    bindTex(gl, 1, f[2].tex, up.u.uB);
    gl.uniform2f(up.u.uTexelB, 1 / f[2].w, 1 / f[2].h);
    gl.uniform2f(up.u.uW, 0.4, 0.6);
    drawTo(gl, f[3]);
  }

  destroy() {
    for (const t of this.film) freeTarget(this.gl, t);
    if (this.slabTex) this.gl.deleteTexture(this.slabTex);
    if (this.faceTex) this.gl.deleteTexture(this.faceTex);
    if (this.sheetTex) this.gl.deleteTexture(this.sheetTex);
    if (this.seaProg) this.gl.deleteProgram(this.seaProg.prog);
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
  state(): { s: number; pos: V3; unit: number; day: number };
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
  const tribCounts = (root.dataset.tribs || '').split(',').map(Number).filter((n) => n > 0);
  const colH = (root.dataset.cols || '').split(',').map(Number).filter((n) => n > 0);
  if (colH.length === 4) engine.colH.set(colH);

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
  // The words. A block is on for a stretch of scroll (from, to). A block that
  // travels (it has `in` and `out`) stands at its composed place between
  // those two and, either side of them, is a small tag in a corner of the
  // frame: its label, its name or figure and its line, set small. It grows
  // from the one to the other with the scroll (transform only), so a
  // station is named from the moment it is in view until the camera has
  // left it.
  type Box4 = [number, number, number, number];
  interface Piece {
    el: HTMLElement;
    /** where it stands at rest, in the block: left, top, width, height */
    x: number;
    y: number;
    w: number;
    h: number;
    /** as a tag: its scale, and how far its corner moves */
    k: number;
    dx: number;
    dy: number;
  }
  interface Words {
    el: HTMLElement;
    from: number;
    to: number;
    inAt: number;
    outAt: number;
    moves: boolean;
    on: boolean | null;
    /** 0: the tag, 1: composed */
    p: number;
    pieces: Piece[];
    /** the ink's bounds at rest and as a tag, px in the frame: x0, y0, x1, y1 */
    rest: Box4 | null;
    tag: Box4 | null;
  }
  const words: Words[] = Array.from(document.querySelectorAll<HTMLElement>('[data-fl-from]')).map((el) => ({
    el,
    from: Number(el.dataset.flFrom),
    to: Number(el.dataset.flTo),
    inAt: Number(el.dataset.flIn),
    outAt: Number(el.dataset.flOut),
    moves: el.dataset.flIn !== undefined,
    on: null,
    p: -1,
    pieces: Array.from(el.querySelectorAll<HTMLElement>('[data-w]')).map((piece) => ({ el: piece, x: 0, y: 0, w: 0, h: 0, k: 1, dx: 0, dy: 0 })),
    rest: null,
    tag: null,
  }));
  /** How much scroll, in screens, a block takes to grow from its tag to its composed place, and to shrink back. */
  const GROW = 0.55;
  const SHRINK = 0.35;
  const heroWords = document.querySelector<HTMLElement>('.fl-hero-words');

  // The rail: one tick to a section, the current one marked.
  const railEl = document.querySelector<HTMLElement>('.fl-rail');
  const rail = Array.from(railEl?.querySelectorAll<HTMLAnchorElement>('a') ?? []).map((el) => ({ el, from: Number(el.dataset.from), at: Number(el.dataset.at) }));
  let railNow = -1;
  let railOff: boolean | null = null;

  const callouts = makeCallouts();
  const endBlock = document.querySelector<HTMLElement>('.fl-end-block');
  const endPin = endBlock?.closest<HTMLElement>('.fl-pin') ?? null;
  let calm = 0.6;
  let nearV = 0;
  let dayNow = 0;
  // The words' lee: where the block of words now showing stands, so the
  // picture can keep itself readable behind it (see the shading pass).
  /** Where a block's words really are: the union of its lines, which can run wider than the block that holds them. */
  const inkOf = (host: HTMLElement) => {
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    for (const el of host.querySelectorAll<HTMLElement>('p, h2, li, a, button, .fl-film, .switch, .fl-gates')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      x0 = Math.min(x0, r.left);
      y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right);
      y1 = Math.max(y1, r.bottom);
    }
    return x1 < x0 ? null : { x0, y0, x1, y1 };
  };
  const box: [number, number, number, number] = [0, 0, 0, 0];
  let boxK = 0;
  let boxOn = false;
  let boxLight = false;
  let boxTimer = 0;
  let boxLast = 0;
  /** The block the lee now stands behind. It goes out behind one block before it comes in behind the next. */
  let leeFor: Words | null = null;
  const setBox = (x0: number, y0: number, x1: number, y1: number, rise: number) => {
    // (A little room all round.)
    const pad = 12;
    box[0] = (x0 - pad) / viewW;
    box[1] = 1 - (y1 + pad) / viewH;
    box[2] = (x1 + pad) / viewW;
    box[3] = 1 - (y0 - pad - rise) / viewH;
  };
  /** A block that stays where it is set: its ink is read where it stands. */
  const measureBox = () => {
    const w = leeFor;
    if (!w || w.moves) return;
    const u = inkOf(w.el);
    boxOn = !!u && w.on === true;
    // (And room for the short rise such a block arrives with.)
    if (u) setBox(u.x0, u.y0, u.x1, u.y1, 16);
  };
  const scheduleBox = () => {
    measureBox();
    window.clearTimeout(boxTimer);
    // Again once the words have arrived where they rest.
    boxTimer = window.setTimeout(measureBox, 760);
  };
  /** A block that travels: its ink is known at both ends of its travel, and it moves in a straight line between them. */
  const leeOf = (w: Words) => {
    const a = w.tag;
    const b = w.rest;
    if (!a || !b) return false;
    const p = Math.max(0, w.p);
    setBox(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p, a[3] + (b[3] - a[3]) * p, 0);
    return true;
  };
  /** Put a travelling block's pieces where they stand at p (transform only). */
  const place = (w: Words, p: number) => {
    const k = 1 - p;
    for (const it of w.pieces) {
      it.el.style.transform = k < 0.0005 ? '' : `translate3d(${(it.dx * k).toFixed(1)}px,${(it.dy * k).toFixed(1)}px,0) scale(${(1 + (it.k - 1) * k).toFixed(4)})`;
    }
    // (What is not part of the tag goes as soon as the block begins to move: it does not travel, and the lee does.)
    w.el.toggleAttribute('data-tag', p < 0.985);
    w.p = p;
  };
  /**
   * Where every travelling block's pieces stand at rest, and where they
   * stand as a tag: stacked in the corner the block names (`--tag-at`: bl,
   * br, tl or tr), each at the size its `--tag` gives (px of type at the
   * reader's own text size; none: as set). Read on resize, never per frame.
   */
  const measureWords = () => {
    const root = parseFloat(getComputedStyle(html).fontSize) / 16 || 1;
    const foot = (heroWords && parseFloat(getComputedStyle(heroWords).paddingBottom)) || 40;
    for (const w of words) {
      if (!w.moves) continue;
      for (const it of w.pieces) it.el.style.transform = '';
      const host = w.el.getBoundingClientRect();
      const cs = getComputedStyle(w.el);
      const gutter = parseFloat(cs.paddingLeft) || 16;
      const at = cs.getPropertyValue('--tag-at').trim() || 'bl';
      const top = at[0] === 't';
      const right = at[1] === 'r';
      const ink = inkOf(w.el);
      w.rest = ink ? [ink.x0 - host.left, ink.y0 - host.top, ink.x1 - host.left, ink.y1 - host.top] : null;
      // (Under the nav at the top; on the first frame's own foot at the bottom.)
      let cursor = top ? 78 : host.height - foot;
      const tag: Box4 = [1e9, 1e9, -1e9, -1e9];
      for (const it of top ? w.pieces : w.pieces.slice().reverse()) {
        const r = it.el.getBoundingClientRect();
        const st = getComputedStyle(it.el);
        const want = (parseFloat(st.getPropertyValue('--tag')) || 0) * root;
        it.x = r.left - host.left;
        it.y = r.top - host.top;
        it.w = r.width;
        it.h = r.height;
        it.k = want > 0 ? Math.min(1, want / (parseFloat(st.fontSize) || 16)) : 1;
        const tw = it.w * it.k;
        const th = it.h * it.k;
        const x = right ? host.width - gutter - tw : gutter;
        const y = top ? cursor : cursor - th;
        cursor = top ? y + th + 7 : y - 7;
        it.dx = x - it.x;
        it.dy = y - it.y;
        tag[0] = Math.min(tag[0], x);
        tag[1] = Math.min(tag[1], y);
        tag[2] = Math.max(tag[2], x + tw);
        tag[3] = Math.max(tag[3], y + th);
      }
      w.tag = tag[2] > tag[0] ? tag : null;
      if (w.p >= 0) place(w, w.p);
    }
  };
  // One light tick, once, when the camera settles and the sun's edge clears the ranges.
  engine.onDawn = () => {
    haptic('light');
    emit('dawn');
  };

  let meltFelt = false;
  engine.onMelt = (done) => {
    emit('melt', done ? 1 : 0);
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
    keys = flightKeys(aspect, engine.sunAz);
    const first = sections[0];
    // (Each section but the last is one screen longer than its stretch of scroll, so its words can stay pinned to the end of it.)
    unit = first ? first.offsetHeight / (SECTIONS.hero + 1) : viewH;
    callouts.measure();
    measureWords();
    scheduleBox();
    // The ending's words keep to the left (on a narrow screen, to the foot): the water there is kept calm for them.
    const b = endBlock ? inkOf(endBlock) : null;
    const narrow = viewW < 720;
    const pinTop = endPin?.getBoundingClientRect().top ?? 0;
    calm = b ? Math.min(0.9, b.x1 / viewW + 0.03) : 0.6;
    // (On a wide screen the same height is passed below zero: the lee is shaped to it, but the words are not at the foot.)
    nearV = b ? (narrow ? 1 : -1) * Math.min(0.6, 1 - (b.y0 - pinTop) / viewH + 0.02) : 0;
  }

  /** The bed is the same for every screen; it is carved once. */
  async function buildBed() {
    const rows = Math.min(engine.maxTexture, coarse ? 4096 : 8192) - 8;
    // (As many cells to a stretch of river as when the world was shorter.)
    const cells = (coarse ? 1.2e6 : 3.0e6) * (WORLD.h / 12400);
    const div = Math.max(3, WORLD.h / rows, Math.sqrt((WORLD.w * WORLD.h) / cells));
    const painter = new BedPainter(WORLD.w, WORLD.h, div);
    const tick = () => new Promise<void>((res) => setTimeout(res, 0));
    paintWorld(painter, tribCounts.length ? tribCounts : undefined, engine.gate);
    await tick();
    const r = painter.rasters();
    const sd = await solver.solve({ alpha: r.mask, w: painter.w, h: painter.h, clamp: r.clampTexels, scale: painter.div });
    if (destroyed) return false;
    await tick();
    const bed = painter.assemble(sd.sd, r.flow);
    await tick();
    if (destroyed) return false;
    engine.setBed(bed);
    engine.shoalY = SHOAL_Y;
    (tribCounts.length ? tribCounts : [9, 5, 3, 2, 1, 1, 1]).slice(0, TRIBS.length).forEach((n, i) => (engine.tribW[i] = tribWidth(n)));
    signals.tribs = engine.tribW;
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
    // The blocks: each line stands where the first camera sees its baseline meet the sheet.
    const [cy, ch, cc, cs] = hero.cut;
    const dy0 = ice.rect.y + ice.rect.h / 2 - cy;
    const z0 = dy0 * cc + ch * cs;
    const ty0 = (dy0 * cs - ch * cc) / z0;
    const footOf = (base: number) => {
      const ty = base / z0 + ty0;
      return cy + (ch * (cc + ty * cs)) / (cs - ty * cc);
    };
    const far = ice.lines[0];
    const near = ice.lines[ice.lines.length - 1];
    const cap = near.cap - near.base;
    const yf: [number, number] = [footOf(far.base), footOf(near.base)];
    // (A block is about a third as deep as its capitals are tall, in the world's own units at the plane it stands in;
    // less on a tall screen, where the far line's feet stand just over the near line's tops.)
    const scale = ((yf[1] - cy) * cc + ch * cs) / z0;
    engine.nameStand = { yf, base: [far.base, near.base], split: ice.lines.length > 1 ? (far.base + near.cap) / 2 : -1e4, cap, depth: (ice.lines.length > 1 ? 0.22 : 0.3) * cap * scale };
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
  // (Each station's composition is set once the picture is there: its words are read where they then stand.)
  measureWords();
  // The sea's variant of the pass is compiled once the first frames are out.
  const warm = window.setTimeout(() => engine.warmSea(), 900);

  // The product picture: the slab appears when it has loaded.
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (!destroyed) engine.setSlab(img);
  };
  img.src = scenePicture(root.dataset.slab || '/media/infiniview-hero.webp');
  if (root.dataset.face) {
    const pic = new Image();
    pic.decoding = 'async';
    pic.onload = () => {
      if (!destroyed) engine.setFace(pic);
    };
    pic.src = scenePicture(root.dataset.face);
  }
  if (root.dataset.sheet) {
    const pic = new Image();
    pic.decoding = 'async';
    pic.onload = () => {
      if (!destroyed) engine.setSheet(pic);
    };
    pic.src = scenePicture(root.dataset.sheet);
  }

  // The switch: the chosen option's sluice opens at once (the gates, the surge and each channel's water are drawn).
  // Nothing is carved again: every channel's bed already runs, so a change costs no frame.
  const fork = document.querySelector<HTMLElement>('.fl-fork');
  const onGate = () => {
    engine.gate = Math.min(2, Math.max(0, Number(fork?.dataset.active) || 0));
  };
  const forkWatch = new MutationObserver(onGate);
  if (fork) forkWatch.observe(fork, { attributes: true, attributeFilter: ['data-active'] });

  // A tick of the rail takes the page to that section's composed frame.
  const onRail = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a');
    const hit = a && rail.find((r) => r.el === a);
    if (!hit) return;
    // (Stopped here: the smooth scroll takes a same-page link for itself and would glide to the link's own target.)
    e.preventDefault();
    e.stopPropagation();
    window.scrollTo(0, Math.round(hit.at * unit));
  };
  railEl?.addEventListener('click', onRail);

  const ro = new ResizeObserver(onResize);
  ro.observe(document.body);
  window.addEventListener('resize', onResize);
  const onTheme = () => engine.setTheme(themeNow());
  window.addEventListener('themechange', onTheme);
  const onStill = () => engine.setStill(mqStill.matches);
  mqStill.addEventListener('change', onStill);

  // The pointer meets the water where its ray meets the water's plane.
  const toWater = (e: PointerEvent) => {
    // (The water lies lower in the basin: found where the ray meets the land, then met again at that depth.)
    const land = groundUnder(cam, e.clientX / viewW, e.clientY / viewH, aspect, 0);
    if (!land) return null;
    const hit = groundUnder(cam, e.clientX / viewW, e.clientY / viewH, aspect, -freeboardAt(land.y));
    if (!hit || hit.t > 6000) return null;
    return { x: hit.x, y: hit.y, reach: 15 * hit.t * ((2 * cam.tan) / viewH) };
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const hit = toWater(e);
    pointerSignal(e.clientX / viewW, e.clientY / viewH, hit ? hit.reach : 0);
    if (!hit) {
      engine.pointerLeave();
      return;
    }
    engine.setReach(hit.reach);
    engine.pointerMove(hit.x, hit.y);
  };
  const onDown = (e: PointerEvent) => {
    const hit = toWater(e);
    emit('press', e.clientX / viewW, e.clientY / viewH, hit ? hit.reach : 0);
    if (hit) engine.splash(hit.x, hit.y, Math.min(90, Math.max(16, hit.reach * 1.5)), 1.5);
  };
  const onLeave = () => {
    engine.pointerLeave();
    pointerSignal(0.5, 0.5, 0);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  const off = onFrame((now) => {
    if (!built) return;
    const raw = window.scrollY / unit;
    // Nothing may glide when motion is reduced: each section shows its
    // composed frame, and its words stand with it for the whole of its
    // stretch (they are set for that frame, so nothing is ever hidden).
    const s = mqStill.matches ? stillScroll(raw) : raw;
    sNow = s;
    // Each block of words comes in and goes out with its stretch of scroll,
    // and a travelling block grows and shrinks with it.
    let active: Words | null = null;
    for (const w of words) {
      const on = s >= w.from && s < w.to;
      if (on !== w.on) {
        w.on = on;
        w.el.toggleAttribute('data-on', on);
      }
      if (w.moves) {
        const p = smooth(w.inAt - GROW, w.inAt, s) * (1 - smooth(w.outAt, w.outAt + SHRINK, s));
        if (Math.abs(p - w.p) > 0.0008 || (p !== w.p && (p === 0 || p === 1))) place(w, p);
      }
      // (The first frame's two lines stand at opposite ends of the near ice, which is calm already.)
      if (on && !active && w.el !== heroWords) active = w;
    }
    // The lee comes in with the words and goes out with them; between two
    // blocks it goes out where the first stood before it comes in behind
    // the second, so it is never seen to jump.
    const dtBox = boxLast ? Math.min(0.1, (now - boxLast) / 1000) : 0;
    boxLast = now;
    if (active !== leeFor && (boxK <= 0.02 || !leeFor)) {
      leeFor = active;
      boxOn = false;
      boxLight = !!active && active.el.classList.contains('fl-end-words');
      if (active && !active.moves) scheduleBox();
    }
    if (leeFor && leeFor === active && leeFor.moves) boxOn = leeOf(leeFor);
    else if (leeFor !== active) boxOn = false;
    boxK = boxOn ? Math.min(1, boxK + dtBox / (mqStill.matches ? 0.001 : 0.35)) : Math.max(0, boxK - dtBox / (mqStill.matches ? 0.001 : 0.25));
    // The rail: which section this is; out of the way on the first frame and at the ending.
    if (rail.length) {
      let i = 0;
      while (i < rail.length - 1 && s >= rail[i + 1].from) i++;
      if (i !== railNow) {
        rail[railNow]?.el.removeAttribute('aria-current');
        rail[i].el.setAttribute('aria-current', 'true');
        railNow = i;
      }
      const off = s < 0.45 || s > SETTLE_AT - 0.6;
      if (off !== railOff) {
        railOff = off;
        railEl?.toggleAttribute('data-off', off);
      }
    }
    const pose = poseAt(keys, s);
    // (Nothing banks when motion is reduced.)
    if (mqStill.matches) pose.roll = 0;
    cam = basisOf(pose);
    const melt = (s - MELT.from) / (MELT.to - MELT.from);
    dayNow = dayAt(s);
    const rest = s >= SETTLE_AT - 0.02;
    // (Published before the draw: whoever follows the picture takes its turn ahead of the picture's own work.)
    flightSignal(now, s, cam, aspect, melt, dayNow, rest);
    callouts.frame(cam, aspect, viewW, viewH, s);
    engine.frame(now, cam, aspect, { melt, day: dayNow, settle: smooth(END_AT - SECTIONS.sea + 0.9, SETTLE_AT, s), rest, calm, near: nearV, box, boxK, boxLight });
  }, 10);

  return {
    engine,
    rebuild: onResize,
    state: () => ({ s: sNow, pos: cam.pos, unit, day: dayNow }),
    destroy() {
      destroyed = true;
      off();
      ro.disconnect();
      forkWatch.disconnect();
      railEl?.removeEventListener('click', onRail);
      for (const w of words) for (const it of w.pieces) it.el.style.transform = '';
      window.clearTimeout(boxTimer);
      window.clearTimeout(warm);
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
