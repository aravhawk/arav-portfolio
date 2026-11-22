import { events } from './registry';
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
import { boardMask, boardReady } from './board';
import { makeCallouts } from './callouts';
import { type Basis, END_AT, HOLDS, MELT, SECTIONS, SETTLE_AT, SUN_END_AZ, basisOf, dayAt, endLens, flightKeys, groundUnder, heroDesign, heroStart, moved, poseAt, posterBand, posterBands, stillScroll, type Key, type Pose, type V3 } from './camera';
import { type EngineOpts, FLOW_SPEED, ICE_GONE, TIERS, WaterEngine } from './engine';
import { type Pending, type Program, type Target, bindTex, compileBegin, compileDone, compileEnd, drawTo, freeTarget, makeTarget } from './gl';
import { DAWN, ENTER, GATE, LAP, PULSE, RIBBON, breathAt, dawnLight, enterAt, firstLight, heroLight, heroLightAt, nextDrip, stationsNear, stepGates } from './moments';
import { iceInclusions } from './ice-inclusions';
import { opening } from './opening';
import { BLOOM_DOWN, BLOOM_KEEP, BLOOM_UP, RECONSTRUCT } from './shaders/finish';
import { NEAR_FULL, type Pace, costAt, easeScale, restPace, travelPace, travelling } from './pace';
import { FLIGHT_FREEBOARD, flightSource, freeboardAt, snowShadowBearing } from './shaders/flight';
import { GROUND, MOUNT_EDGE, MOUNT_H, MOUNT_PANO, PANO, SHADE_DIRS, SNOW_H } from './shaders/terrain';
import { skyAt } from './sky';
import { makeSolver } from './stage';
import { type Box, type Cover, F, type Mode, NO_ICE, type Tile, bits, coverFlight, frameTiles, iceParts, maskName, passNeeds, seaNear, slabInFrame, tarnNear } from './variants';
import { CELL as GLYPH_CELL, FOUNDER, NAME_CUT, PLATES, type NameCut, type Plate, type PlatePose, founderAt, layoutName, plateAt, rasterGlyphs } from './name';
import { COLS, LAKE, LATTICE, NAME, OUTLET, REST, SHARDS, SHOAL_Y, SLAB, SLUICES, TRIBS, WORLD, paintWorld, tribWidth } from './world';

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
/** How far toward the eye from a plate its image in the ice is looked for, world units (the name's own shader looks no further). */
const NAME_SHADE = 300;
/** How far the water under the name has spread from where its rows stood at a point in the melt, world units: it opens as the plates founder. */
const nameReach = (m: number) => 150 * smooth(0.52, 0.74, m) + 120 * smooth(0.7, 0.9, m);

/** The light event at the ending happens once in a visit: after it, the sun stays up and the line of light holds. */
let dawned = false;

/** From here down the first screen its words are given a lee: the lake is breaking under them (screens of scroll). */
const HERO_LEE = 0.35;

/** What the page tells the picture each frame, beyond the camera. */
/** No rectangle: nothing in the frame is calmed. */
const NO_BOX = new Float32Array(4);

export interface FlightMoment {
  /** 0..1, how far the lake's ice has melted */
  melt: number;
  /** 0..1, how far the day has come round */
  day: number;
  /** the scroll position, in screens, whose hour lights the picture (where it is not said, the hour the day's clock stands for) */
  hour?: number;
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
  /** where the captions tied to their points stand, in the frame (u, v from the foot), and 0..1 how much the picture is calmed behind them */
  cap?: [number, number, number, number];
  capK?: number;
  /** the camera moves only as the first screen breathes: the page is at rest all the same */
  idle?: boolean;
  /** the camera moves by the first screen's entrance: the reader is not travelling */
  entering?: boolean;
}

/**
 * The scene's own cut of each picture. A page shows a picture whole, at
 * the page's width; the scene shows it a few hundred pixels wide inside
 * ice or under water, where small type would be a few pixels tall. So the
 * scene is given the same real material cut for that size, each from its
 * public source at the source's own resolution (nothing is redrawn):
 *  - the block: Infiniview's own card (infiniview.dev/opengraph-image.jpg,
 *    1200 x 630), its headline and its mark and nothing smaller;
 *  - the pool: no picture. Its results are set as type (board.ts), from
 *    the published picture's own words and figures;
 *  - the hall: the top of rydar.org/iphone-app, cut to the page's column
 *    (1680 x 1050 of the 2880 x 1800 capture).
 */
const SCENE_PICS: Record<string, string> = {
  '/media/infiniview-hero.webp': '/media/infiniview-card.jpg',
  '/media/rydar-app.webp': '/media/rydar-app-hero.webp',
};
export const scenePicture = (src: string) => SCENE_PICS[src] ?? src;

/**
 * Whether the pass is compiled for one theme at a time. The theme is in
 * nearly every line of it (two lightings, not two tints), so a variant that
 * knows the theme when it is compiled carries half the work.
 */
const THEMED = true;
const MODE_DEFS: Record<Mode, string[]> = { day: ['DAY'], night: ['NIGHT'], any: [] };
interface Variant {
  mask: number;
  mode: Mode;
  pending: Pending | null;
  prog: Program | null;
  failed: boolean;
  began: number;
  took: number;
  /**
   * Whether it has drawn yet. The driver builds a program for good the first time it draws (and again for every
   * other state it is drawn in: with blending on, into another kind of target), and that takes it from a tenth of a
   * second to more than one, during which no frame is shown. So a program's first draw is made on purpose, of one
   * pixel, before the picture comes on or while the page is at rest (see `warmOne`), and until it has been made the
   * program is not used where a warm one can draw the same pixels.
   */
  warm: boolean;
  /** The driver has finished that first draw: from here on the program draws the picture without holding it. */
  live: boolean;
}

/** How long the reader must have left the page alone before a program is built (ms): no scroll, no pointer, no key. */
const IDLE_MS = 450;

export class FlightEngine extends WaterEngine {
  private slabTex: WebGLTexture | null = null;
  private slabTint: V3 = [0.2, 0.2, 0.2];
  private sheetTex: WebGLTexture | null = null;
  private pulseHalf = -1;
  private camKey = '';

  constructor(canvas: HTMLCanvasElement, opts: EngineOpts) {
    super(canvas, opts);
    this.crackCell = 700;
    this.phone = opts.coarse;
    this.firstMode = this.mode();
    // The world does not scroll under the sheet: it melts where it lies.
    this.meltRange = 0;
    this.lastScroll = 0;
  }

  protected sources() {
    const s = super.sources();
    delete s.render;
    s.ground = GROUND;
    s.snowH = SNOW_H;
    s.mountH = MOUNT_H;
    s.mountPano = MOUNT_PANO;
    s.mountEdge = MOUNT_EDGE;
    s.bloomDown = BLOOM_DOWN;
    s.bloomUp = BLOOM_UP;
    s.bloomKeep = BLOOM_KEEP;
    s.reconstruct = RECONSTRUCT;
    return s;
  }

  /**
   * Start-up, in pieces no longer than a frame or two each. Every program
   * is handed to the driver at once and taken when the driver says it is
   * done (so the long shading program never holds the page), and the baked
   * textures are made one to a task. All of it is behind the still: the
   * pass's variants for where the page opens, and on the home page the few
   * that between them can draw any stretch (`cover`), are built and have
   * drawn their first pixel before this is over (see `stand`).
   */
  async prepare(): Promise<void> {
    const gl = this.gl;
    const tick = () => new Promise<void>((r) => setTimeout(r, 0));
    const src = this.sources();
    const pending = Object.keys(src).map((k) => [k, compileBegin(gl, src[k], k)] as const);
    const firsts = [...new Set([...this.firstNeeds, ...this.cover.map((c) => c.mask)])];
    for (const mask of firsts) this.begin(mask, this.firstMode);
    await tick();
    for (const [k, p] of pending) {
      for (let n = 0; n < 400 && !compileDone(gl, p); n++) await new Promise<void>((r) => setTimeout(r, 8));
      this.p[k] = compileEnd(gl, p);
      await tick();
    }
    super.bake();
    this.inclusions = iceInclusions(gl);
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
    await this.stand(firsts);
  }

  /**
   * Build these variants of the pass for the theme the picture is in, and wait for each to have drawn its first
   * pixel: what the page does behind its still. One at a time; the driver cannot be hurried.
   */
  async stand(masks: number[]): Promise<void> {
    const gl = this.gl;
    const wait = () => new Promise<void>((r) => setTimeout(r, 8));
    const mode = this.variants.size ? this.mode() : this.firstMode;
    for (const mask of masks) this.begin(mask, mode);
    for (const mask of masks) {
      const v = this.variants.get(`${mask}:${mode}`);
      if (!v || v.live || v.failed) continue;
      for (let n = 0; n < 1500 && v.pending && !compileDone(gl, v.pending) && !gl.isContextLost(); n++) await wait();
      this.take();
      if (!v.prog) continue;
      for (let n = 0; n < 1500 && this.warming(); n++) await wait();
      this.warmOne(v);
      for (let n = 0; n < 1500 && this.warming(); n++) await wait();
    }
  }

  /**
   * The pass's variants (see variants.ts and the shading pass). Each carries
   * only some of the flight's subjects, and is compiled for one theme or
   * for the turn between the two; a frame is drawn by the smallest one that
   * has drawn before and carries all it can show.
   *
   * Building one is the dearest thing a first visit does: the driver takes
   * from a tenth of a second to more than two over a program's first draw,
   * and shows no frame meanwhile. So none is ever built in a frame the
   * reader is moving through. Behind the still the page builds the variants
   * for where it opens and (the home page) a few broad ones that between
   * them can draw any piece of any frame of the flight (`cover`: see
   * coverFlight), at a somewhat higher cost a frame. After that a piece's
   * own variant is built only while the reader has left the page alone for
   * a moment (`build`), nearest first, and until it is there the broad one
   * for that stretch draws it.
   */
  /** What the frame the page opens on is drawn in: each piece's subjects. Set before `prepare`. */
  firstNeeds: number[] = [F.ICE | F.FIELD | F.NAME];
  /** The flight's stretches, each with the broad variant that can draw all of it (the home page: it flies the whole flight). Set before `prepare`. */
  private cover: Cover[] = [];
  /** For the checks: what `setCover` was given. */
  coverNeeds: { s: number; need: number }[] = [];
  setCover(needs: { s: number; need: number }[]) {
    this.coverNeeds = needs;
    this.cover = coverFlight(needs);
  }
  private firstMode: Mode = 'any';
  private variants = new Map<string, Variant>();
  /** Every program that is the shading pass, whichever variant. */
  private shading = new Set<Program>();
  /** Every stretch's pieces, each with the scroll position it is first needed at (see `setPlan`). */
  private plan: { s: number; mask: number }[] = [];
  /** The variant that drew the last frame, and what that frame needed. */
  private drawn: Variant | null = null;
  private needed = -1;

  /** The theme the picture is drawn in: the day's or the night's. (It turns from one to the other at once, under a dissolve: see `turnTheme`.) */
  private mode(): Mode {
    if (!THEMED) return 'any';
    return this.theme >= 0.5 ? 'night' : 'day';
  }

  /** Hand a variant to the driver. Nothing here waits for it. */
  private begin(mask: number, mode: Mode) {
    const key = `${mask}:${mode}`;
    if (this.variants.has(key) || this.gl.isContextLost()) return;
    const now = performance.now();
    this.note('link', key);
    this.variants.set(key, { mask, mode, pending: compileBegin(this.gl, flightSource(mask, MODE_DEFS[mode]), `flight:${maskName(mask)}:${mode}`), prog: null, failed: false, began: now, took: 0, warm: false, live: false });
  }

  /** Take what the driver has finished. True when a variant has arrived. */
  private take(): boolean {
    let got = false;
    for (const v of this.variants.values()) {
      if (!v.pending || !compileDone(this.gl, v.pending)) continue;
      try {
        v.prog = compileEnd(this.gl, v.pending);
        this.shading.add(v.prog);
        got = true;
      } catch (err) {
        v.failed = true;
        if (process.env.NODE_ENV !== 'production') console.warn(err);
      }
      v.took = performance.now() - v.began;
      v.pending = null;
    }
    return got;
  }

  /** The pieces the flight will be drawn in: each one's subjects, and where along the scroll it is first met. */
  setPlan(plan: { s: number; mask: number }[]) {
    this.plan = plan.slice();
  }
  /**
   * For the checks: when each variant was handed to the driver (`link`), drew its first pixel (`draw`) and was done
   * with (`live`), in ms of the page's clock, with how long the reader had then left the page alone.
   */
  buildLog: { t: number; what: string; key: string; quiet: number }[] = [];
  private note(what: string, key: string) {
    const t = performance.now();
    if (this.buildLog.length < 400) this.buildLog.push({ t: Math.round(t), what, key, quiet: Math.round(t - Math.max(this.stillSince, this.inputAt)) });
  }
  /** Where the page is, in screens of scroll: what "nearest" is measured from. */
  private here = 0;
  /** When the reader last did anything (ms): scrolled, moved the pointer, pressed a key. */
  private inputAt = 0;
  /** The page tells the engine the reader has done something: no program is built for a moment after. */
  input() {
    this.inputAt = performance.now();
  }

  /** When the camera last moved (ms): the page is at rest once it has not for a moment. */
  private stillSince = 0;
  /** The fence behind the last program's first draw: until the GPU has passed it, the driver is still building that program. */
  private warmFence: WebGLSync | null = null;
  private warmBegan = 0;
  /** How long a frame takes here, of late (ms): what a first draw's time is measured against. */
  private frameMs = 16.7;
  /** A variant drew for the first time in the frame now being drawn, as a piece of the picture: that first draw is timed too. */
  private coldDrew = false;
  private warmedAt = 0;
  /**
   * Whether a first draw holds the picture on this visit. A reader who has been here before has the driver's own
   * store of these programs, and a first draw is then over within a frame: it need not wait for the page to rest.
   * It is known from how long the last one took.
   */
  private warmHolds = true;
  private heldOnce = false;
  /** The programs whose first draw the driver is at. */
  private warmingNow: Variant[] = [];
  /** Whether the driver is still at a program's first draw. */
  private warming(): boolean {
    const gl = this.gl;
    if (!this.warmFence) return false;
    if (!gl.isContextLost() && gl.getSyncParameter(this.warmFence, gl.SYNC_STATUS) !== gl.SIGNALED) return true;
    gl.deleteSync(this.warmFence);
    this.warmFence = null;
    this.warmedAt = performance.now();
    for (const v of this.warmingNow) {
      v.live = true;
      this.note('live', `${v.mask}:${v.mode}`);
    }
    this.warmingNow.length = 0;
    // (A leaner program may draw the picture from here: a still picture is drawn again with it.)
    this.dirty = true;
    // (A first draw the driver has in store is over within a few frames, however long this GPU's frames are; one it
    // must build takes a quarter of a second and more on top of that. One that held is enough: on this visit the
    // driver is building them, and the picture runs a while between two.)
    if (this.warmedAt - this.warmBegan > 150 + 3 * this.frameMs) this.warmHolds = true;
    else if (!this.heldOnce) this.warmHolds = false;
    this.heldOnce = this.heldOnce || this.warmHolds;
    return false;
  }
  /**
   * A program's first draw: one pixel in a corner of the frame, in the very state the picture is drawn in (the driver
   * builds a program anew for any other), before the frame's own pieces, which cover it. Nothing waits for it here.
   */
  private warmOne(v: Variant) {
    const gl = this.gl;
    if (v.warm || !v.prog || gl.isContextLost()) return;
    v.warm = true;
    this.warmingNow.push(v);
    this.note('draw', `${v.mask}:${v.mode}`);
    gl.useProgram(v.prog.prog);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, 1, 1);
    drawTo(gl, null, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    // (The screen has been drawn on: the frame's own pieces must cover it before it is shown.)
    this.dirty = true;
    if (this.warmFence) gl.deleteSync(this.warmFence);
    this.warmFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.warmBegan = performance.now();
    gl.flush();
  }
  /**
   * While the reader has left the page alone, the variants the flight will want are built, one at a time with a breath
   * between them: handed to the driver, and when it has linked one, given its first draw. Each holds the picture for as
   * long as the driver takes over it; with the page at rest that is a still frame held a moment, where on the move it
   * would be a jolt. The moment the reader scrolls, moves the pointer or presses a key, nothing more is begun.
   *
   * In order: the pieces now on the screen; the pieces of the stretches within three screens of here, nearest first;
   * once the page has rested a while, the other theme's for the pieces on the screen and its broad ones (the switch is
   * under the reader's hand); then the rest of the flight, nearest first.
   */
  private build(now: number) {
    if (this.warming()) return;
    // (Not for the checks' held clock: there a frame is wanted as it will stand, at once.)
    const quiet = now - Math.max(this.stillSince, this.inputAt);
    // (A reader who has been here before has some of these programs in the driver's store, and a build is then a
    // matter of a frame. But not all of them, and which cannot be told before the draw: measured, a program whose
    // link came back in 70 ms still held the picture 0.4 s. So a returning reader's wait for the page to rest too;
    // only the breath between two builds is shorter while none has held.)
    if (this.held === null && (quiet < IDLE_MS || now - this.warmedAt < (this.warmHolds ? 350 : 60))) return;
    for (const v of this.variants.values()) if (v.pending) return;
    const mode = this.mode();
    const other: Mode = mode === 'day' ? 'night' : 'day';
    const next = (mask: number, m: Mode): boolean => {
      const v = this.variants.get(`${mask}:${m}`);
      if (v?.live || v?.failed) return false;
      if (!v) this.begin(mask, m);
      else if (v.prog && !v.warm) this.warmOne(v);
      return true;
    };
    for (const t of this.drawnTiles) if ((t.area >= 0.04 || this.held !== null) && next(t.mask, mode)) return;
    // (The checks' held frame wants its own pieces and nothing else: the rest of the flight is not built under it.)
    if (this.held !== null) return;
    // (The broad ones stand from the start in the theme the page opened in: after the theme has turned, the new
    // theme's come before anything else.)
    for (const c of this.coverNear()) if (next(c.mask, mode)) return;
    const near = this.plan.slice().sort((a, b) => Math.abs(a.s - this.here) - Math.abs(b.s - this.here));
    for (const p of near) if (Math.abs(p.s - this.here) <= 3 && next(p.mask, mode)) return;
    if (THEMED && quiet > 1500) {
      for (const t of this.drawnTiles) if (t.area >= 0.04 && next(t.mask, other)) return;
      for (const c of this.coverNear()) if (next(c.mask, other)) return;
    }
    for (const p of near) if (next(p.mask, mode)) return;
  }
  /** The flight's stretches, the one the page is in first, then outward. */
  private coverNear(): Cover[] {
    const off = (c: Cover) => Math.max(c.from - this.here, this.here - c.to, 0);
    return this.cover.slice().sort((a, b) => off(a) - off(b));
  }

  /** For the checks: a variant held in place of the engine's own choice. */
  private forced: Variant | null = null;
  /**
   * For the checks: compile a variant on the spot (this waits for the driver)
   * and draw every frame with it, whatever the frame needs; null hands the
   * choice back. `defines`: further names to define in its source.
   */
  holdVariant(mask: number | null, defines: string[] = []): { ms: number; error: string | null } {
    this.forced = null;
    this.dirty = true;
    if (mask === null) return { ms: 0, error: null };
    const key = `${mask}:${defines.join(',')}`;
    const had = this.heldProgs.get(key);
    if (had) {
      this.forced = had;
      return { ms: had.took, error: null };
    }
    const t0 = performance.now();
    try {
      const prog = compileEnd(this.gl, compileBegin(this.gl, flightSource(mask, defines), 'flight:held'));
      this.shading.add(prog);
      this.forced = { mask, mode: 'any', pending: null, prog, failed: false, began: t0, took: performance.now() - t0, warm: true, live: true };
      this.heldProgs.set(key, this.forced);
      return { ms: performance.now() - t0, error: null };
    } catch (err) {
      return { ms: performance.now() - t0, error: String(err) };
    }
  }
  private heldProgs = new Map<string, Variant>();
  /**
   * For the checks: the frame as it is drawn now, read back (the clock must
   * be held, so the frame depends on the camera alone). Two variants of the
   * pass can then be compared in one visit, pixel for pixel.
   */
  grab(): Uint8Array | null {
    const a = this.lastArgs;
    if (this.held === null || !a) return null;
    const gl = this.gl;
    this.drawHeld(a.cam, a.aspect, a.at, a.top);
    const px = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  }
  private lastArgs: { cam: Basis; aspect: number; at: FlightMoment; top: number } | null = null;

  /**
   * The variant to draw a piece of the frame with: the leanest of the theme that has drawn before (see Variant.live)
   * and carries all that is needed there. On the home page there is always one, the stretch's broad one; a piece's
   * own is built when the reader next leaves the page alone (`build`). Nothing is built here.
   */
  private pick(need: number): Variant {
    if (this.forced) return this.forced;
    const mode = this.mode();
    const fits = (v: Variant) => !!v.prog && (v.mode === mode || v.mode === 'any');
    let best: Variant | null = null;
    for (const v of this.variants.values()) {
      if (!v.live || !fits(v) || (v.mask & need) !== need) continue;
      if (!best || bits(v.mask) < bits(best.mask)) best = v;
    }
    if (best) return best;
    // Nothing that has drawn carries it all (a page without the broad variants, shown before its own is ready; a piece
    // no stretch foresaw). Its own is asked for, and until it has come: one that is linked and carries it
    // all draws (the driver takes its moment then and there), or else the one that carries most of it.
    this.begin(need, mode);
    let most: Variant | null = null;
    const better = (v: Variant, than: Variant | null) => {
      if (!than) return true;
      const a = (v.mask & need) === need;
      const b = (than.mask & need) === need;
      if (a !== b) return a;
      if (v.live !== than.live) return v.live;
      return bits(v.mask & need) > bits(than.mask & need) || (bits(v.mask & need) === bits(than.mask & need) && bits(v.mask) < bits(than.mask));
    };
    for (const v of this.variants.values()) if (fits(v) && better(v, most)) most = v;
    // (Nothing for this theme at all: whatever is ready draws, for the moment it takes the driver.)
    if (!most) for (const v of this.variants.values()) if (v.prog && better(v, most)) most = v;
    if (!most!.warm) this.warmingNow.push(most!);
    most!.warm = true;
    this.coldDrew = this.coldDrew || !most!.live;
    return most!;
  }

  /**
   * The theme turns at once, under a dissolve. The pass is compiled for one
   * theme at a time, so the turn is from one finished picture to another:
   * when the switch is pressed, the other theme's variants for the pieces
   * now on the screen are asked for (they usually stand ready: see `pump`
   * and `rest`); the moment they have all drawn their first pixel, the
   * frame as it stands is copied to a canvas laid over this one, the theme
   * changes, and the copy fades out over the new picture. No program is
   * told the theme each frame, none draws with blending on, and no frame is
   * held: until the other theme is ready the picture keeps the one it has.
   */
  private themeWant: number | null = null;
  private themeAsked = 0;
  setTheme(t: number, instant = false) {
    if (!THEMED || instant || !this.variants.size) {
      super.setTheme(t, true);
      return;
    }
    this.themeWant = t;
    this.themeAsked = performance.now();
    this.dirty = true;
  }
  /** Whether the theme is to change with this frame: the frame is then drawn in the old theme once more, and copied. */
  private turnTheme(now: number): boolean {
    if (this.themeWant === null) return false;
    if (this.themeWant === this.themeTarget) {
      this.themeWant = null;
      return false;
    }
    const other: Mode = this.themeWant >= 0.5 ? 'night' : 'day';
    let ready = this.drawnTiles.length > 0;
    const busy = this.warming();
    // (The other theme's broad variants for the stretches within reach too, on the home page: once the theme has
    // turned the reader may scroll on at once, and every piece must have something that has drawn before to draw it.)
    const reach = this.cover.filter((c) => c.from - this.here < 6 && this.here - c.to < 6).map((c) => c.mask);
    for (const mask of [...this.drawnTiles.map((t) => t.mask), ...reach]) {
      const v = this.variants.get(`${mask}:${other}`);
      if (!v) this.begin(mask, other);
      else if (v.prog && !v.warm && !busy) this.warmOne(v);
      if (!v?.live && !v?.failed) ready = false;
    }
    // (Still at the driver's: the picture waits in the theme it has. A driver that never answers is not waited for.)
    if ((!ready || this.warming()) && now - this.themeAsked < 6000) {
      this.dirty = true;
      return false;
    }
    return true;
  }
  /** The frame just drawn, copied to a canvas laid over this one, which then fades out: what the new theme's picture comes in under. */
  private dissolve() {
    const host = this.canvas.parentElement;
    if (!host || this.still || this.held !== null || typeof document === 'undefined') return;
    this.veil?.remove();
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(this.canvas, 0, 0);
    c.setAttribute('aria-hidden', 'true');
    const at = getComputedStyle(this.canvas);
    c.style.cssText = `position:${at.position};top:${at.top};left:${at.left};width:${this.canvas.style.width || at.width};height:${this.canvas.style.height || at.height};pointer-events:none;opacity:1;transition:opacity 480ms cubic-bezier(0.3,0,0.2,1);`;
    this.canvas.after(c);
    this.veil = c;
    // (Two frames on: the copy has been shown once at full strength before it starts to go.)
    requestAnimationFrame(() => requestAnimationFrame(() => (c.style.opacity = '0')));
    window.setTimeout(() => {
      c.remove();
      if (this.veil === c) this.veil = null;
    }, 700);
  }
  private veil: HTMLCanvasElement | null = null;

  /** The snow's relief, baked once. */
  private ground!: Target;
  private inclusions!: WebGLTexture;
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
  /**
   * The first screen's light: how far it has arrived (0: the first frame, before it; 1: the day's own), and how
   * the light breathes at rest, -1..1. The page sets both each frame (see the entrance); everywhere but the first
   * screen they are 1 and 0, and the light is the hour's own.
   */
  first = 1;
  breath = 0;
  /** Whether a frame of the picture has been drawn. */
  drew = false;
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
   *
   * It keeps to the stretch of the flight it is in. Each stretch is drawn
   * by its own variant of the pass and costs what that variant costs, so a
   * step taken for one says nothing of the next. A stretch that has been
   * visited is entered at the step it last held. One that has not is
   * entered at the step the last one needed and tried a step richer after
   * a second and a half without a miss (and again, down to full shading):
   * so one heavy stretch does not leave the rest of the page lean, and no
   * stretch is ever jumped to a richer picture it cannot hold. Where two
   * stretches meet the camera may cross back and forth: a stretch counts
   * once it has held for half a second.
   */
  private lean = 0;
  private leanNow = 0;
  private gov = { n: 0, missed: 0, prev: 0, clean: 0, need: 10000, lastUp: -1e9, age: 0, stretch: -1, cand: -1, candAge: 0, quick: false, early: [] as number[], sized: false };

  /**
   * The step the picture begins at, by how many pixels it has to fill: a large screen does not begin with a second
   * of missed frames while the governor finds out what the size alone could have told it. (A GPU that can do better
   * is given the richer picture a second and a half later, a step at a time: see `govern`.)
   */
  resize(cssW: number, cssH: number, margin: number, dpr: number) {
    super.resize(cssW, cssH, margin, dpr);
    if (this.gov.sized || this.gov.age < 0) return;
    this.gov.sized = true;
    // (A page whose pace is worked out from this device's measured speed asks for no step by size: see `pace`.)
    if (this.paced) return;
    const px = this.canvas.width * this.canvas.height;
    this.lean = this.leanNow = px > 6.5e6 ? 2 : px > 4.5e6 ? 1 : 0;
    this.gov.quick = this.lean > 0;
  }
  /** The step each stretch last held, by the subjects it shows. */
  private leanAt = new Map<number, number>();
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
    // (A page whose pace is worked out takes its step from that: see `pace`.)
    if (this.paced) return;
    g.age += ms;
    // (The first seconds are the page settling, not the picture's cost: only a picture that misses most of its frames
    // is answered that early, and at once.)
    if (g.age < 2500) {
      if (g.age < 900 || this.lean >= 2) return;
      g.early.push(ms > Math.max(this.base * 1.45, 12) ? 1 : 0);
      if (g.early.length < 24) return;
      const late = g.early.reduce((x: number, y: number) => x + y, 0);
      g.early.length = 0;
      if (late >= 16) {
        this.lean = 2;
        this.leanLog.push([+this.time.toFixed(1), this.lean]);
      }
      return;
    }
    const s = this.samples;
    if (this.needed !== g.stretch) {
      if (this.needed !== g.cand) {
        g.cand = this.needed;
        g.candAge = 0;
      }
      g.candAge += ms;
      if (g.candAge > 500) {
        // A new stretch: what was settled for the last is kept. One that has been visited is entered at the step it
        // held; one that has not keeps the step it is handed, and tries a richer one soon.
        if (g.stretch >= 0) this.leanAt.set(g.stretch, this.lean);
        g.stretch = this.needed;
        const held = this.leanAt.get(this.needed);
        if (held !== undefined && held !== this.lean) {
          this.lean = held;
          this.leanLog.push([+this.time.toFixed(1), this.lean]);
        }
        g.quick = held === undefined && this.lean > 0;
        g.missed = g.prev = g.clean = 0;
        s.length = 0;
      }
    } else g.cand = g.stretch;
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
      // (Most of half a second's frames late: one step will not do, and the leanest is taken at once.)
      this.lean = missed >= 20 ? 2 : this.lean + 1;
      this.leanLog.push([+this.time.toFixed(1), this.lean]);
      g.clean = 0;
      g.quick = false;
      // Stepped back up not long ago and it did not hold: wait longer before trying again.
      if (this.time - g.lastUp < 40) g.need = Math.min(g.need * 2, 80000);
      g.prev = 0;
      return;
    }
    g.prev = missed;
    if (missed === 0) g.clean += span;
    else g.clean = 0;
    if (g.clean >= (g.quick ? 1500 : g.need) && this.lean > 0) {
      this.lean--;
      this.leanLog.push([+this.time.toFixed(1), this.lean]);
      g.clean = 0;
      // (A quick trial in a new stretch that does not hold is not held against the next one.)
      if (!g.quick) g.lastUp = this.time;
    }
  }

  /** For the checks: hold a shading step (null hands it back to the governor). */
  holdLean(step: number | null) {
    this.leanHeld = step !== null;
    if (step === null) {
      this.gov.age = 2500;
      return;
    }
    this.lean = Math.min(2, Math.max(0, step));
    this.gov.age = -1e12;
  }
  private leanHeld = false;

  /**
   * The pace (see pace.ts): the resolution the scene is drawn at and how often, worked out each frame from where the
   * flight is, how fast this device is and whether the camera travels. Only a page that has measured its device is
   * paced (the home page: `calibrate`); an inner page's band is drawn every frame at the screen's resolution.
   */
  paced = false;
  /** How slow this device is against the cost map's: 1 the same. As measured, and as corrected since by missed frames. */
  speed = 1;
  private speed0 = 1;
  private phone = false;
  private trip = { on: false, movedAt: 0 };
  /** The resolution the frame now being drawn has, as a share of the screen's a side; and how many display intervals a frame at rest is shown for. */
  private scaleNow = 1;
  private every = 1;
  private sinceDrawn = 0;
  private lastCam: { pos: V3; f: V3 } | null = null;
  private lastHour: number | undefined = undefined;
  private lastBeat = 0;
  private beats: number[] = [];
  private late = { n: 0, missed: 0, clean: 0 };
  private paceNow: { travel: Pace; rest: Pace } | null = null;
  /** For the checks: hold the resolution, the rate, or the travelling state (null hands each back). */
  private paceHeld: { scale?: number; every?: number; travel?: boolean } = {};
  holdPace(hold: { scale?: number; every?: number; travel?: boolean } | null) {
    this.paceHeld = hold ?? {};
    this.dirty = true;
  }

  /**
   * One interval of the display. The page calls it every frame from the moment it mounts (a frame of the picture or
   * not), so the display's own rate is known before the picture loads it: the fastest steady median seen.
   */
  beat(now: number) {
    if (now === this.lastBeat) return 0;
    const ms = this.lastBeat ? now - this.lastBeat : 0;
    this.lastBeat = now;
    if (ms <= 0 || ms > 250) return ms;
    const b = this.beats;
    b.push(ms);
    if (b.length >= 30) {
      const med = b.slice().sort((x, y) => x - y)[15];
      b.length = 0;
      if (med < this.base * 0.9 && med > 3.5) this.base = med;
    }
    if (!this.paced) return ms;
    // Missed frames on the move say the device is slower than it measured (heat, another window): the pace is told.
    // Half a second with a quarter of its frames late; and a long run of clean travel gives a correction back.
    const l = this.late;
    if (this.trip.on) {
      l.n++;
      if (ms > this.base * this.every * 1.5 + 1) l.missed++;
      if (l.n >= 30) {
        if (l.missed >= 8) {
          this.speed = Math.min(this.speed * 1.15, this.speed0 * 3);
          l.clean = 0;
        } else if (l.missed === 0 && ++l.clean >= 20 && this.speed > this.speed0) {
          this.speed = Math.max(this.speed0, this.speed * 0.95);
          l.clean = 0;
        }
        l.n = l.missed = 0;
      }
    }
    return ms;
  }

  /** This frame's pace: sets the resolution it is drawn at and the shading step, and says whether it is drawn at all. */
  private pace(now: number, ms: number, cam: Basis, aspect: number, at: FlightMoment, ground: number, forced: boolean): boolean {
    const h = this.paceHeld;
    if (!this.paced || this.quiet) {
      this.scaleNow = h.scale ?? 1;
      this.lastCam = null;
      return true;
    }
    // How fast the picture moves, in screen heights a second: the eye's own travel against how far off the near
    // ground is, and its turning. (The first screen's entrance and its breathing are its own life, not travel.)
    let flow = 0;
    const lc = this.lastCam;
    // (They are told from travel by the scroll: while it has not moved, the camera's motion is the first screen's own.)
    const own = (at.idle || at.entering) && at.hour === this.lastHour;
    this.lastHour = at.hour;
    if (lc && ms > 2 && !own) {
      const dp = Math.hypot(cam.pos[0] - lc.pos[0], cam.pos[1] - lc.pos[1], cam.pos[2] - lc.pos[2]);
      const df = Math.hypot(cam.f[0] - lc.f[0], cam.f[1] - lc.f[1], cam.f[2] - lc.f[2]);
      flow = ((dp / Math.max(ground, 40) + df) / (2 * cam.tan)) / (ms / 1000);
    }
    this.lastCam = { pos: [cam.pos[0], cam.pos[1], cam.pos[2]], f: [cam.f[0], cam.f[1], cam.f[2]] };
    const was = this.trip.on;
    this.trip = travelling(this.trip, flow, now);
    const moving = h.travel ?? this.trip.on;
    const input = {
      base: this.base,
      mpx: (this.canvas.width * this.canvas.height) / 1e6,
      cost: costAt(at.hour ?? 0, this.theme >= 0.5, aspect),
      speed: this.speed,
      broad: this.drawnTiles.length > 0 && this.drawnTiles[0].by.mask !== this.drawnTiles[0].mask,
      phone: this.phone,
    };
    const p = (this.paceNow = { travel: travelPace(input), rest: restPace(input) });
    const want = moving ? p.travel : p.rest;
    if (!this.leanHeld) this.lean = Math.max(p.travel.lean, p.rest.lean);
    this.every = h.every ?? want.every;
    this.scaleNow = h.scale ?? easeScale(this.scaleNow, want.scale, Math.min(ms, 100) / 1000);
    // A frame at rest may be shown for more than one interval. The first frame of travel never waits, nor does one
    // something else has asked for (a press, a theme, a program that has just drawn for the first time).
    if (forced || (moving && !was) || ++this.sinceDrawn >= this.every) {
      this.sinceDrawn = 0;
      return true;
    }
    return false;
  }

  /**
   * For the checks: hold the clock (null lets it run again). While it is
   * held the picture depends on the camera and nothing else: the water is
   * run from rest for the same short while before every frame drawn, and
   * nothing happens by chance or by the pointer. Two visits then draw the
   * same frame at the same place, so a change to the picture can be measured.
   */
  private held: number | null = null;
  holdClock(t: number | null) {
    this.held = t;
    if (t === null) this.last = 0;
    this.dirty = true;
  }
  /** Nothing moves by the clock: motion is reduced, or the clock is held. */
  private get quiet() {
    return this.still || this.held !== null;
  }
  private drawHeld(cam: Basis, aspect: number, at: FlightMoment, top: number) {
    const gl = this.gl;
    const held = this.held ?? 0;
    for (const t of [this.wave!.a, this.wave!.b, this.waveOut!, this.vel!.a, this.vel!.b, this.heat.a, this.heat.b]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.hasSimTop = false;
    this.ptr.active = false;
    this.ptr.vx = this.ptr.vy = 0;
    this.meltRate = this.meltAct = 0;
    this.lift = this.ray = this.rise = at.rest ? 1 : 0;
    const steps = 48;
    for (let i = steps - 1; i >= 0; i--) {
      this.drop.s = 0;
      this.time = held - i / 60;
      this.simulate(1 / 60, top);
    }
    // (The glow is the frame before's: drawn until it has settled.)
    for (let i = 0; i < 4; i++) this.draw(cam, aspect, at);
    this.drop.s = 0;
  }

  get info() {
    return {
      ...super.info,
      tier: Math.max(this.tier, this.lean),
      simTier: this.tier,
      lean: this.lean,
      leanLog: this.leanLog.slice(-12),
      // The pace: the resolution the last frame was drawn at, how many of the display's intervals a frame stands
      // for, whether the camera travels, the display's interval, this device's speed against the cost map's, and
      // what a frame is expected to cost on the move and at rest.
      scale: +this.scaleNow.toFixed(3),
      every: this.every,
      travelling: this.paceHeld.travel ?? this.trip.on,
      paced: this.paced,
      base: +this.base.toFixed(2),
      speed: +this.speed.toFixed(3),
      pace: this.paceNow,
      // The variant of the pass that drew the last frame, what that frame needed, and every variant asked for so far
      // (how long the driver took over it, in ms; 'pending' while it is still at it).
      variant: this.drawn ? `${maskName(this.drawn.mask)}:${this.drawn.mode}` : '',
      // (The pieces the last frame was drawn in: what each needed, what drew it, and the share of the frame it covers.)
      tiles: this.drawnTiles.map((t) => `${maskName(t.mask)} by ${maskName(t.by.mask)}:${t.by.mode} ${Math.round(t.area * 100)}%`),
      // (The flight's stretches, each with the broad variant that can draw all of it.)
      cover: this.cover.map((c) => `${c.from.toFixed(2)}-${c.to.toFixed(2)} ${maskName(c.mask)}`),
      // (Whether every piece was drawn by its very own variant; a sliver, by one that carries all of it.)
      settled: this.drawnTiles.length > 0 && this.drawnTiles.every((t) => t.by.mask === t.mask || (t.area < 0.04 && (t.by.mask & t.mask) === t.mask)),
      needed: maskName(this.needed),
      variants: Array.from(this.variants.values(), (v) => `${maskName(v.mask)}:${v.mode}:${v.failed ? 'failed' : v.pending ? 'pending' : Math.round(v.took)}`),
    };
  }

  /** Station 5: each column's height. */
  colH = new Float32Array([COLS.hMax, COLS.hMax * 0.75, COLS.hMax * 0.2, COLS.hMin]);
  /** Station 6: which sluice is open, how far open each is, and the surge down each. */
  gate = 0;
  private gateNow = new Float32Array([1, 0, 0]);
  private surge = new Float32Array(3);
  private dripAt = 0;
  private drip: { at: number; i: number; x: number; y: number } | null = null;
  private gateT = 0;
  private latLap = -1;
  /** The sluices follow the chosen gate: one lifts, the others drop, and a surge runs down the opened channel. */
  private runGates() {
    const dt = Math.min(0.05, Math.max(0, this.time - this.gateT));
    this.gateT = this.time;
    const i = this.gate;
    const at = this.surge[i];
    stepGates(this.gateNow, this.surge, i, dt, this.quiet);
    // The surge's head is real water: it throws rings as it goes.
    if (!this.quiet && at < 1 && Math.floor(at * GATE.rings) !== Math.floor(this.surge[i] * GATE.rings)) {
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
   * The name as plates standing on the sheet (see name.ts, the ice field and the name's own shader): the eight
   * plates as they stand, the rows they stand in (each a strip of the lake: its middle and half size), the name's
   * box in the first camera's picture (the height of its middle, its half width and half height, as tangents), the
   * raster's measures (uv to a capital's height, and how far from a cell's middle an outline is looked for), and
   * where the lead that carries the lake's water off leaves the name.
   */
  nameStand: { plates: Plate[]; rows: [number, number, number, number][]; seat: [number, number, number]; tex: [number, number, number, number]; cells: [number, number][]; lead: [number, number]; frac: Float32Array; fracL: Float32Array; strips: [number, number, number, number][] } | null = null;
  /**
   * Where the first frame's words stand, as shares of the frame: the right end of the left block, the left end of the
   * right one (both 1 when they are stacked), and how far up the frame their top is. The bare ice round the name keeps clear of them.
   */
  nameWords: [number, number, number] = [1, 1, 0.2];
  /** The tangent of half the first camera's field of view (the first frame's words are measured in its picture). */
  nameTan = 0.466;
  /** Something the picture depends on has changed: draw again, even when nothing moves. */
  touch() {
    this.dirty = true;
  }

  /** When the next drop falls from the melting letters. */
  private nameDripAt = 0;
  /** The rings a foundering plate leaves, each with its own moment. */
  private ringQ: { at: number; x: number; y: number }[] = [];
  /** Plate `i` goes down into the water: a ring where it stood, and a second as it rolls. */
  private nameRings(i: number) {
    const st = this.nameStand;
    if (!st) return;
    const p = st.plates[i];
    this.ringQ.push({ at: this.time + 0.02, x: p.x, y: p.y + p.d * 0.5 }, { at: this.time + 0.34, x: p.x + p.hw * 0.4, y: p.y + p.h * 0.3 });
    this.ringQ.sort((a, b) => a.at - b.at);
  }

  /** The name's plates are laid out anew (a new shape of screen): the stretch of the lake they stand on, as the sheet's own frame has it, and the half size of the ground their rows cover. */
  private nameSerial = 0;
  setNameRect(rect: { x: number; y: number; w: number; h: number }, half: [number, number]) {
    this.iceRect = rect;
    this.iceBox = [0.5, 0.5, half[0] / rect.w, half[1] / rect.h];
    this.nameSerial++;
    this.dirty = true;
  }

  /** The plates at this frame's melt, worked out once a frame (and once more, without the swell, for what the simulation is given). */
  private poseKey = '';
  private poses: PlatePose[] = [];
  private posesStill: PlatePose[] = [];
  private ltA = new Float32Array(PLATES * 4);
  private ltQ = new Float32Array(PLATES * 4);
  private ltM = [new Float32Array(PLATES * 4), new Float32Array(PLATES * 4), new Float32Array(PLATES * 4)];
  private ltG = new Float32Array(PLATES * 4);
  private ltF = new Float32Array(PLATES * 4);
  private ltR = new Float32Array(PLATES * 4);
  private ltFS = new Float32Array(PLATES * 4);
  private ltRS = new Float32Array(PLATES * 4);
  private nameBounds = new Float32Array(4);
  private namePoses() {
    const st = this.nameStand;
    if (!st) return;
    const key = `${this.melt}|${this.quiet ? 0 : this.time}|${this.nameSerial}`;
    if (key === this.poseKey) return;
    this.poseKey = key;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < PLATES; i++) {
      const p = st.plates[i];
      const a = plateAt(p, i, this.melt, this.quiet ? 0 : this.time, st.lead);
      const b = plateAt(p, i, this.melt, 0, st.lead);
      this.poses[i] = a;
      this.posesStill[i] = b;
      this.ltA.set([a.pos[0], a.pos[1], a.pos[2], p.h], i * 4);
      this.ltQ.set(a.q, i * 4);
      // (The world in the plate's own frame: the turn undone, as three rows, each with what the plate's place adds.)
      {
        const [x, y, z, w] = a.q;
        const rows = [
          [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)],
          [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)],
          [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)],
        ];
        rows.forEach((r, k) => this.ltM[k].set([r[0], r[1], r[2], -(r[0] * a.pos[0] + r[1] * a.pos[1] + r[2] * a.pos[2])], i * 4));
      }
      this.ltG.set([st.cells[i][0], st.cells[i][1], p.hw, p.d / 2], i * 4);
      this.ltF.set(a.foot, i * 4);
      // (w: how much of it stands in the light, to throw a shade and have an image in the ice: less once it has foundered, none afloat.)
      this.ltR.set([Math.cos(a.yaw), Math.sin(a.yaw), a.open, (1 - a.flat) * (1 - 0.8 * a.down)], i * 4);
      this.ltFS.set(b.foot, i * 4);
      this.ltRS.set([Math.cos(b.yaw), Math.sin(b.yaw), b.open, (1 - b.flat) * (1 - 0.8 * b.down)], i * 4);
      // (How far the turned plate reaches from its middle, across the lake and along it.)
      {
        const [x, y, z, w] = a.q;
        const rx = Math.abs(1 - 2 * (y * y + z * z)) * p.hw + (Math.abs(2 * (x * y - w * z)) * p.d) / 2 + (Math.abs(2 * (x * z + w * y)) * p.h) / 2 + 6;
        const ry = Math.abs(2 * (x * y + w * z)) * p.hw + (Math.abs(1 - 2 * (x * x + z * z)) * p.d) / 2 + (Math.abs(2 * (y * z - w * x)) * p.h) / 2 + 6;
        x0 = Math.min(x0, a.pos[0] - rx);
        x1 = Math.max(x1, a.pos[0] + rx);
        y0 = Math.min(y0, a.pos[1] - ry);
        y1 = Math.max(y1, a.pos[1] + ry);
      }
    }
    this.nameBounds.set([x0, y0, x1, y1]);
  }

  protected bindIce(prog: Parameters<WaterEngine['bindIce']>[0], ice: Parameters<WaterEngine['bindIce']>[1], sdfUnit: number, snowUnit: number) {
    super.bindIce(prog, ice, sdfUnit, snowUnit);
    // (The cut is a hair wider than the drawn letter: its edge is blended over a pixel, and the blend belongs to the ice.)
    if (ice.rect[2] > 0) this.gl.uniform4f(prog.u.uIceA, ice.a[0] + 3, ice.a[1], ice.a[2], ice.a[3]);
    if (prog.u.uIceP) this.gl.uniform4fv(prog.u.uIceP, this.nameCut);
    if (prog.u.uIceLean) this.gl.uniform1f(prog.u.uIceLean, this.leanNow);
    const st = this.nameStand;
    const gl = this.gl;
    if (prog.u.uNameW) gl.uniform3fv(prog.u.uNameW, this.nameWords);
    if (prog.u.uNameT) gl.uniform1f(prog.u.uNameT, this.nameTan);
    if (!prog.u.uNameG) return;
    if (!st || !this.iceMeta || ice.rect[2] <= 0) {
      gl.uniform4f(prog.u.uNameG, 0, 0, -1e4, 0);
      if (prog.u.uNameS) gl.uniform1f(prog.u.uNameS, 0);
      // (Once the sheet has gone, the lead its water left by is still where the lake's current is drawn from: these
      // stand as the last frame of the melt left them, whichever variant of the pass draws.)
      if (st && this.iceMeta && this.iceTex && prog.u.uNameL) {
        gl.uniform2f(prog.u.uNameL, 1, 220);
        if (prog.u.uNameB) gl.uniform4f(prog.u.uNameB, st.lead[0], st.lead[1], st.plates[PLATES - 1].h, st.plates[PLATES - 1].d);
      }
      return;
    }
    // The plates, as the sheet's melt is: every number a function of the melt alone, so it reverses exactly.
    const m = this.melt;
    this.namePoses();
    const shade = this.shading.has(prog);
    const near = st.plates[PLATES - 1];
    const two = st.plates[0].row !== near.row;
    // How many of them still stand: the stretch of the melt in which they founder, one by one.
    const left = 1 - smooth(0.5, 0.586, m);
    gl.uniform4f(prog.u.uNameG, st.plates[0].y, near.y, two ? 1 : -1e4, 1);
    gl.uniform4f(prog.u.uNameB, st.lead[0], st.lead[1], near.h, near.d);
    // (z: something of them stands under the water; w: how much of them stands, of all eight.)
    // (x: how high the tallest of them stands; z: something of them stands under the water; w: how much of them stands, of all eight.)
    if (prog.u.uNameM) gl.uniform4f(prog.u.uNameM, st.plates[0].h * 1.1 + 12, near.d, m > FOUNDER.from - 0.26 ? 1 : 0, left);
    if (prog.u.uNameV) gl.uniform4f(prog.u.uNameV, st.seat[0], st.seat[1], st.seat[2], 0);
    if (prog.u.uRowA) gl.uniform4fv(prog.u.uRowA, st.rows[0]);
    if (prog.u.uRowB) gl.uniform4fv(prog.u.uRowB, st.rows[1]);
    if (prog.u.uLtA) gl.uniform4fv(prog.u.uLtA, this.ltA);
    if (prog.u.uLtQ) gl.uniform4fv(prog.u.uLtQ, this.ltQ);
    if (prog.u.uLtM0) gl.uniform4fv(prog.u.uLtM0, this.ltM[0]);
    if (prog.u.uLtM1) gl.uniform4fv(prog.u.uLtM1, this.ltM[1]);
    if (prog.u.uLtM2) gl.uniform4fv(prog.u.uLtM2, this.ltM[2]);
    if (prog.u.uLtG) gl.uniform4fv(prog.u.uLtG, this.ltG);
    if (prog.u.uLtT) gl.uniform4fv(prog.u.uLtT, st.tex);
    if (prog.u.uNameBx) gl.uniform4fv(prog.u.uNameBx, this.nameBounds);
    if (prog.u.uRowT) gl.uniform4fv(prog.u.uRowT, [...st.strips[0], ...st.strips[1]]);
    // (Each row's capitals' height, and how much of each still stands in the light: its plates' own, taken together.)
    if (prog.u.uRowH) {
      const stands = (r: number) => {
        let sum = 0;
        let n = 0;
        st.plates.forEach((p, i) => {
          if (p.row !== r) return;
          sum += this.ltR[i * 4 + 3];
          n++;
        });
        return n ? sum / n : 0;
      };
      gl.uniform4f(prog.u.uRowH, st.plates[0].h, near.h, stands(0), stands(near.row));
    }
    if (prog.u.uFrac) gl.uniform4fv(prog.u.uFrac, st.frac);
    if (prog.u.uFracL) gl.uniform1fv(prog.u.uFracL, st.fracL);
    // The sheet under them. First meltwater lies on the ice round their feet and spreads (the simulation takes all
    // of that film for open water, so the pointer wakes it and shakes their image in it); then, plate by plate,
    // the ice under each goes and it founders; the water under the rows joins and spreads; and from there on
    // the sheet's own breaking is the story.
    const hole = -30 + 78 * smooth(0.3, 0.5, m);
    const pond = 32 + 34 * smooth(0.04, 0.45, m);
    const film = smooth(0.02, 0.5, m);
    if (shade) {
      if (prog.u.uLtF) gl.uniform4fv(prog.u.uLtF, this.ltF);
      if (prog.u.uLtR) gl.uniform4fv(prog.u.uLtR, this.ltR);
    } else {
      // (What the simulation is given: the plates without the swell they ride on, and the film as water.)
      const r = this.ltRS.slice();
      for (let i = 0; i < PLATES; i++) r[i * 4 + 2] = Math.max(r[i * 4 + 2], pond * 5 * film * r[i * 4 + 3]);
      if (prog.u.uLtF) gl.uniform4fv(prog.u.uLtF, this.ltFS);
      if (prog.u.uLtR) gl.uniform4fv(prog.u.uLtR, r);
    }
    gl.uniform4f(prog.u.uIceA, hole, ice.a[1], ice.a[2], ice.a[3]);
    gl.uniform4f(prog.u.uIceC, ice.c[0], ice.c[1], smooth(0.36, 0.57, m), ice.c[3]);
    // x: how far from their feet the meltwater lies on the sheet, y: 0..1 how wet the plates and the ice round them are, z: 0..1 the
    // first fractures have run out from their feet, w: 0..1 the sheet has begun to open under them.
    if (prog.u.uNameP) gl.uniform4f(prog.u.uNameP, pond * 3 * film, smooth(0, 0.3, m), smooth(0.16, 0.5, m), smooth(0.44, 0.56, m));
    // The water spreads from where the rows stood (see the ice field), and leaves by one lead down the lake to the
    // outlet: how far along the lake that lead has opened, and how wide it has become. (It is wide enough for the
    // plates to ride down.)
    const reach = nameReach(m);
    if (prog.u.uNameS) gl.uniform1f(prog.u.uNameS, reach);
    if (prog.u.uNameL) gl.uniform2f(prog.u.uNameL, smooth(0.4, 0.66, m), 26 + 70 * smooth(0.46, 0.6, m) + near.h * 0.9 * smooth(0.54, 0.74, m) + 60 * smooth(0.6, 0.9, m));
  }

  /** What this engine's own part of the ice field depends on (see bindIce): the melt, the name as it stands, the first frame's words, the governor's step. */
  protected iceKey() {
    const st = this.nameStand;
    return `${this.melt}|${this.nameCut.join()}|${this.nameWords.join()}|${this.nameTan}|${this.leanNow}|${st ? `${st.plates.map((p) => `${p.x},${p.y},${p.h}`).join()}` : ''}`;
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

  /**
   * The results that lie on the pool's bed: their type, as a mask (see board.ts). One channel, with its chain of
   * smaller copies, read along the tilt, so the type keeps its counters when it is seen small and at an angle.
   */
  setBoard(mask: HTMLCanvasElement) {
    const gl = this.gl;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    let src = mask;
    if (mask.width > max) {
      // (A device with small textures is given the same mask, smaller.)
      src = document.createElement('canvas');
      src.width = max;
      src.height = Math.max(1, Math.round((mask.height * max) / mask.width));
      const ctx = src.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(mask, 0, 0, src.width, src.height);
    }
    if (this.sheetTex) gl.deleteTexture(this.sheetTex);
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number));
    this.sheetTex = tex;
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

  /** Whether the block has its picture (it is not drawn without one). */
  get hasSlab() {
    return !!this.slabTex;
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

    const beat = this.beat(now) || (this.last ? now - this.last : 16.7);
    if (beat < 250) this.frameMs += (beat - this.frameMs) * 0.1;
    if (this.frameLog && beat < 1000) this.frameLog.push(beat);
    this.govern(beat);
    // The pace: at rest a frame may stand for two of the display's intervals (see `pace`); then nothing below runs,
    // and the clock is not read, so the next frame's step of time covers both.
    {
      const under = groundUnder(cam, 0.5, 0.9, aspect);
      if (!this.pace(now, beat, cam, aspect, at, under ? under.t : 1e4, this.dirty)) return;
    }
    let dt = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    dt = Math.min(dt, 1 / 20);

    // Melt follows scroll, so it reverses exactly.
    const m = this.iceTex ? Math.min(1, Math.max(0, melt)) : 0;
    const rate = Math.abs(m - this.melt) / Math.max(dt, 1e-3);
    this.meltRate += (Math.min(rate, 1.1) - this.meltRate) * (1 - Math.exp(-dt * 6));
    // While the letters melt, water runs off them and falls into the pool at their feet: a small ring, here and there,
    // every little while. (They are real rings in the simulation, and only while there is water there for them.)
    if (this.nameStand && !this.quiet && m > 0.035 && m < FOUNDER.to && this.time >= this.nameDripAt) {
      const st = this.nameStand;
      const i = Math.floor(Math.random() * PLATES);
      const p = st.plates[i];
      // (Only from a plate that still stands, into the water at its own foot.)
      if (m < founderAt(i)) this.splash(p.x + (Math.random() - 0.5) * 1.6 * p.hw, p.y - 5 - 14 * Math.random(), 9 + 6 * Math.random(), 0.28 + 0.3 * Math.random());
      this.nameDripAt = this.time + 0.16 + 0.5 * Math.random();
    }
    // A plate founders: real rings where it goes down. (Scrolled back, it comes up through the same water.)
    if (this.nameStand && !this.quiet && Math.abs(m - this.melt) < 0.08) {
      for (let i = 0; i < PLATES; i++) {
        const at = founderAt(i) + 0.3 * FOUNDER.each;
        if (this.melt < at !== m < at) this.nameRings(i);
      }
    }
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

    const key = `${cam.pos.join(',')}|${cam.f.join(',')}|${cam.tan}|${m}|${at.settle}|${at.calm}|${at.near}|${at.boxK}|${at.box.join(',')}|${at.capK ?? 0}|${at.cap ? at.cap.join(',') : ''}`;
    const clock = performance.now();
    if (key !== this.camKey) {
      this.camKey = key;
      this.dirty = true;
      if (!at.idle) this.stillSince = clock;
    }

    // The simulation's window follows where the camera looks: from a little
    // behind the foot of the frame to well beyond its middle.
    const near = groundUnder(cam, 0.5, 0.9, aspect) ?? { x: cam.pos[0], y: cam.pos[1], t: 0 };
    // (Past the world's last row the bed repeats, which is open sea: the window follows the camera out over it.)
    const top = Math.min(REST.y + SPAN * 0.5, Math.max(-SPAN * 0.5, near.y - SPAN * 0.14));
    // (A still picture is drawn only when something changes. A variant of the pass arriving is such a change: without
    // this a reader who has asked for no motion and reaches a subject before its variant is ready would not see it.)
    if (this.take()) this.dirty = true;
    if (at.hour !== undefined) this.here = at.hour;
    // (The theme changes with this frame if the other theme stands ready: this frame is the last of the old one, and is copied.)
    const turn = this.turnTheme(clock);
    const turned = () => {
      if (!turn || this.themeWant === null) return;
      this.dissolve();
      super.setTheme(this.themeWant, true);
      this.themeWant = null;
      this.dirty = true;
    };
    if (this.held !== null) {
      this.lastArgs = { cam, aspect, at: { ...at, box: [...at.box], cap: at.cap ? [...at.cap] : undefined }, top };
      this.build(clock);
      if (!this.dirty && !this.building()) return;
      this.drawHeld(cam, aspect, at, top);
      this.dirty = false;
      turned();
      return;
    }
    this.runDawn(at.rest);

    if (this.still) {
      // (A still picture is drawn only when something changes: a program that has drawn its first pixel is such a
      // change, and marks the picture so.)
      this.build(clock);
      if (!this.dirty && this.drew) return;
      if (!this.hasSimTop) {
        const dx = this.simCell();
        this.simTop = Math.floor(top / dx) * dx - dx;
      }
      this.draw(cam, aspect, at);
      // (A still frame has no frame before it to glow from: it is drawn twice.)
      this.draw(cam, aspect, at);
      this.dirty = false;
      turned();
      return;
    }
    this.time += dt;
    while (this.ringQ.length && this.ringQ[0].at <= this.time) {
      const r = this.ringQ.shift()!;
      this.splash(r.x, r.y, 24, 0.85);
    }
    this.simulate(dt, top);
    this.build(clock);
    this.draw(cam, aspect, at);
    this.dirty = false;
    turned();
  }

  /** Whether a program is at the driver's, being linked or drawing its first pixel: the checks' held frame is drawn again when it has come. */
  private building(): boolean {
    for (const v of this.variants.values()) if (v.pending || (v.warm && !v.live)) return true;
    return false;
  }

  /** What the pass must carry to draw a frame from this camera whole (see variants.ts). */
  needs(cam: Basis, aspect: number): number {
    return passNeeds(cam, aspect, this.iceTex ? iceParts(this.melt, this.theme, !!this.nameStand) : NO_ICE, !!this.slabTex);
  }
  /**
   * Whether every piece of a frame from this camera (which needs `need`: see passNeeds) has a variant of its own that has drawn already (the pieces' own
   * are asked for, and draw their first pixel, as they come): until then a page that shows a still in the picture's
   * place keeps it, so the moment the driver takes over a program is never seen.
   */
  standsReady(cam: Basis, aspect: number, need: number): boolean {
    const mode = this.mode();
    let ready = true;
    this.take();
    const busy = this.warming();
    for (const t of this.tiles(cam, aspect, need)) {
      const v = this.variants.get(`${t.mask}:${mode}`);
      if (!v) this.begin(t.mask, mode);
      else if (v.prog && !v.warm && !busy) this.warmOne(v);
      if (!v?.live) ready = false;
    }
    return ready;
  }

  /** The pieces the last frame was drawn in, and what drew each: for the checks. */
  private drawnTiles: { mask: number; area: number; by: Variant }[] = [];

  /**
   * Where in the frame the name's own code is needed: the box the plates are in, standing or afloat (the pass's own
   * test of it), and the ground toward the eye from them, where their image in the ice and their shade lie.
   */
  private nameBox(): Box[] | null {
    const st = this.nameStand;
    if (!st) return null;
    this.namePoses();
    const b = this.nameBounds;
    let top = 0;
    for (const p of st.plates) top = Math.max(top, p.h);
    return [
      [
        [b[0] - 12, b[1] - 12, -FLIGHT_FREEBOARD - top * 0.5],
        [b[2] + 12, b[3] + 12, top * 1.04 + 8],
      ],
      // (Their image in the ice lies toward the eye from their feet, as far as the pass looks for it: NAME_SHADE.)
      [
        [b[0] - 12 - NAME_SHADE * 0.25, b[1] - 12 - NAME_SHADE, -FLIGHT_FREEBOARD - 4],
        [b[2] + 12 + NAME_SHADE * 0.25, b[3] + 12, 4],
      ],
    ];
  }

  /** What the pieces of a frame from this camera need, the largest first (slivers left out): the programs a first frame waits for. */
  firstPieces(cam: Basis, aspect: number, need: number): number[] {
    return this.tiles(cam, aspect, need)
      .filter((t, i) => i === 0 || t.area >= 0.04)
      .map((t) => t.mask);
  }
  /** The pieces a frame from this camera is drawn in, each with what it needs (see frameTiles). */
  tiles(cam: Basis, aspect: number, need: number, w = this.canvas.width, h = this.canvas.height): Tile[] {
    return frameTiles(cam, aspect, need, need & F.NAME ? this.nameBox() : null, w, h);
  }

  /** All tiles see the same hour and atmospheric column. */
  private frameLight(cam: Basis, aspect: number, at: FlightMoment, night: number) {
    const sky = skyAt(night, at.day, this.lift, this.sunAz, this.ridge, at.hour);
    // (The first screen has its own sun and moon, behind the name: let go as the eye leaves the lake.)
    const heroK = heroLightAt(MELT.from + at.melt * (MELT.to - MELT.from));
    heroLight(sky, heroK, night);
    // The moon stands where the night's light comes from: the first screen's own while the name stands, then the hour's, until it sets.
    const moon = [...sky.keyDir, night * Math.max(heroK, sky.moon)];
    if (this.first < 1 || this.breath !== 0) firstLight(sky, this.first, night, this.breath);
    // Integrated density of each atmospheric layer from this camera height.
    const depth = cam.pos[2] / 320;
    const mistDepth = cam.pos[2] / 70;
    const extinction = 0.00021 * sky.haze * -Math.expm1(-depth) / Math.max(depth, 0.001);
    // The thicker valley air begins beyond the foreground. Keep the opening lake and final sea clear.
    const hour = at.hour ?? 0;
    const valley = smooth(2, 3.1, hour) * (1 - smooth(28.3, 30.1, hour));
    const blueHour = night * smooth(13.8, 16.6, hour) * (1 - smooth(19.4, 22.15, hour));
    const extra = (0.00027 + 0.00007 * night) * sky.haze * valley * (1 - 0.55 * sky.dusk - 0.50 * blueHour);
    const distanceAir = [extinction + extra, -(300 + 0.95 * cam.pos[2]) * extra, blueHour];
    const rangeToScreen = Math.hypot(cam.pos[0] - SLAB.x, cam.pos[1] - SLAB.y, cam.pos[2] - (SLAB.lift + SLAB.h / 2));
    const emission = 1 - smooth(1750, 2140, rangeToScreen);
    const lowExtinction = 0.0022 * -Math.expm1(-mistDepth) / Math.max(mistDepth, 0.001);
    const sunLength = Math.hypot(sky.sun[0], sky.sun[1]) || 1;
    const keyLength = Math.hypot(sky.keyDir[0], sky.keyDir[1]) || 1;
    const bearings = [sky.sun[0] / sunLength, sky.sun[1] / sunLength, sky.keyDir[0] / keyLength, sky.keyDir[1] / keyLength];
    const elevation = sky.keyDir[2];
    const shadow = [
      elevation / Math.max(keyLength, 0.05), snowShadowBearing(bearings[2], bearings[3]),
      Math.atan2(sky.sun[0], sky.sun[1]), elevation > 0 ? Math.min(keyLength / elevation, 2.6) : 0,
    ];
    const grainPhase = this.time * 0.73;
    const film = [0.42 + 0.08 * at.settle, grainPhase - Math.floor(grainPhase), 0.020 * (1 - 0.6 * at.settle), moon[3] * smooth(-0.05, 0.05, moon[2])];
    const [left, bottom, right, top] = at.box;
    const lee = [(left + right) / 2, (bottom + top) / 2, 1 / ((right - left) / 2 + 0.15 / aspect), 1 / ((top - bottom) / 2 + 0.19)];
    const [x0, y0, x1, y1] = at.cap ?? NO_BOX;
    const captionLee = [(x0 + x1) / 2, (y0 + y1) / 2, 1 / (Math.max(x1 - x0, 0) * 0.5 + 0.16 / aspect), 1 / (Math.max(y1 - y0, 0) * 0.5 + 0.16)];
    return { sky, moon, extinction, distanceAir, emission, lowExtinction, bearings, shadow, film, lee, captionLee };
  }

  private draw(cam: Basis, aspect: number, at: FlightMoment) {
    const gl = this.gl;
    const need = this.needs(cam, aspect);
    this.needed = need;
    const night = Math.min(1, Math.max(0, this.theme));
    this.drawnTiles = [];
    const light = this.frameLight(cam, aspect, at, night);
    // The scene's size in pixels: the screen's own, or less while the camera travels (see `pace`). A smaller scene is
    // drawn in the corner of the screen's own buffer, by the same programs in the same state as a full one (the
    // driver builds a program anew for every kind of target), and then brought to the screen's size (`reconstruct`).
    const small = this.scaleNow < 1;
    const sw = small ? Math.max(2, Math.round(this.canvas.width * this.scaleNow)) : this.canvas.width;
    const sh = small ? Math.max(2, Math.round(this.canvas.height * this.scaleNow)) : this.canvas.height;
    this.view = [0, 0, sw, sh];
    // Every tile will be replaced. Discarding the old colour lets tile-based
    // GPUs open this render pass without loading last frame's full-size colour.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.COLOR]);
    if (this.forced) {
      this.drawn = this.forced;
      this.drawnTiles.push({ mask: this.forced.mask, area: 1, by: this.forced });
      this.scene(this.forced, cam, aspect, at, light, null);
      if (small) this.reconstruct(light);
      this.glow(night);
      return;
    }
    // Each piece of the frame by the leanest variant that carries what stands in that piece.
    const tiles = this.tiles(cam, aspect, need, sw, sh);
    for (const t of tiles) {
      const by = this.pick(t.mask);
      this.drawnTiles.push({ mask: t.mask, area: t.area, by });
      this.scene(by, cam, aspect, at, light, tiles.length === 1 ? null : t.px);
    }
    this.drawn = this.drawnTiles[0].by;
    // (A program that drew its first pixels as part of this frame: how long the GPU takes over it says, as a first
    // draw made on purpose does, whether the driver had it in store.)
    if (this.coldDrew && !this.warmFence && !gl.isContextLost()) {
      this.warmFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      this.warmBegan = performance.now();
    }
    this.coldDrew = false;
    if (small) this.reconstruct(light);
    this.glow(night);
    // The first frame is drawn behind the still, and stands once the GPU has finished it: every pass in it has then
    // drawn for the first time (the simulation's, the copy to the screen, the glow's), and the page may show it.
    if (!this.drew) {
      if (!this.firstFence) {
        this.firstFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
      } else if (gl.isContextLost() || gl.getSyncParameter(this.firstFence, gl.SYNC_STATUS) === gl.SIGNALED) {
        gl.deleteSync(this.firstFence);
        this.firstFence = null;
        this.drew = true;
      }
      this.dirty = true;
    }
  }
  private firstFence: WebGLSync | null = null;
  /** Where in the screen's buffer the scene is being drawn: x, y, width, height in device pixels. */
  private view: [number, number, number, number] = [0, 0, 2, 2];

  /** Where a smaller scene is kept while it is brought to the screen's size: a texture a little under the screen's. */
  private stage: Target | null = null;
  private stageFor(): Target {
    const gl = this.gl;
    const w = Math.ceil(this.canvas.width * NEAR_FULL) + 2;
    const h = Math.ceil(this.canvas.height * NEAR_FULL) + 2;
    if (this.stage && this.stage.w === w && this.stage.h === h) return this.stage;
    freeTarget(gl, this.stage);
    // (Making a texture binds it: on a unit the scene does not use, and it is let go again.)
    gl.activeTexture(gl.TEXTURE15);
    this.stage = makeTarget(gl, w, h, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE, filter: gl.LINEAR });
    gl.bindTexture(gl.TEXTURE_2D, null);
    return this.stage;
  }
  /**
   * A scene drawn smaller than the screen, brought to the screen's size: it is copied out of the corner it was drawn
   * in, and one pass reads it back over the whole screen, sharpened, with the grain at the screen's resolution.
   */
  private reconstruct(light: ReturnType<FlightEngine['frameLight']>) {
    const gl = this.gl;
    const [, , sw, sh] = this.view;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const stage = this.stageFor();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, stage.fbo);
    gl.blitFramebuffer(0, 0, sw, sh, 0, 0, sw, sh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.COLOR]);
    const r = this.p.reconstruct;
    gl.useProgram(r.prog);
    bindTex(gl, 0, stage.tex, r.u.uSrc);
    gl.uniform2f(r.u.uSceneSize, sw, sh);
    gl.uniform2f(r.u.uInvTarget, 1 / stage.w, 1 / stage.h);
    // (The nearer the scene's size to the screen's, the less there is to sharpen.)
    gl.uniform1f(r.u.uStrength, Math.min(0.86, 2.9 * (1 - sh / h)));
    gl.uniform2f(r.u.uGrain, light.film[1], light.film[2]);
    drawTo(gl, null, w, h);
    // (The texture is let go of its unit: the next frame's passes bind their own there.)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * How fast this device draws the scene, against the GPU the cost map was measured on: measured once, behind the
   * still. The frame the page opens on is drawn at half size in each quarter of the screen's buffer (a whole frame's
   * pixels, none drawn twice: a pass nothing reads is dropped by the GPU), three times over with a read between, and
   * the GPU is waited for; the first round is its clock coming up to speed, the other two are timed. Then one frame
   * is drawn small and brought to size, so the passes that does have drawn before the reader's first scroll.
   */
  async calibrate(cam: Basis, aspect: number, at: FlightMoment): Promise<void> {
    const gl = this.gl;
    if (!this.ready || !this.bedA || !this.bedB || !this.wave || this.still || gl.isContextLost()) return;
    // (No timer, no zero-delay timeout clamp: a message is the shortest wait the page has.)
    const chan = new MessageChannel();
    const yieldNow = () =>
      new Promise<void>((res) => {
        chan.port1.onmessage = () => res();
        chan.port2.postMessage(0);
      });
    const done = async (fence: WebGLSync | null) => {
      if (!fence) return;
      const t0 = performance.now();
      while (!gl.isContextLost() && gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED && performance.now() - t0 < 3000) await yieldNow();
      gl.deleteSync(fence);
    };
    const w = this.canvas.width;
    const h = this.canvas.height;
    const hw = w >> 1;
    const hh = h >> 1;
    const night = Math.min(1, Math.max(0, this.theme));
    this.melt = this.iceTex ? Math.min(1, Math.max(0, at.melt)) : 0;
    const need = this.needs(cam, aspect);
    const light = this.frameLight(cam, aspect, at, night);
    const round = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.COLOR]);
      for (let q = 0; q < 4; q++) {
        this.view = [(q & 1) * hw, (q >> 1) * hh, hw, hh];
        for (const t of this.tiles(cam, aspect, need, hw, hh)) this.scene(this.pick(t.mask), cam, aspect, at, light, t.area >= 1 ? null : t.px);
      }
      // (Read: the round before cannot be dropped.)
      this.glow(night);
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      return fence;
    };
    if (!this.hasSimTop) this.simTop = 0;
    await done(round());
    const t0 = performance.now();
    await done(round());
    await done(round());
    const ms = (performance.now() - t0) / 2;
    const mpx = (w * h) / 1e6;
    const expected = costAt(at.hour ?? 0, this.theme >= 0.5, aspect) * mpx;
    if (ms > 0.2 && expected > 0.2 && !gl.isContextLost()) {
      // (Four half frames cost a little more than one whole: 1.1 times, measured on the map's own GPU.)
      this.speed = this.speed0 = Math.min(12, Math.max(0.15, ms / (expected * 1.1)));
      this.paced = true;
    }
    chan.port1.close();
    // A frame through the smaller path, so its copy and its pass are not first met on the first scroll.
    this.scaleNow = 0.8;
    this.draw(cam, aspect, at);
    this.scaleNow = 1;
    this.drew = false;
  }

  /** The scene, drawn by one variant: the whole frame, or only the given parts of it. */
  private scene(variant: Variant, cam: Basis, aspect: number, at: FlightMoment, light: ReturnType<FlightEngine['frameLight']>, parts: [number, number, number, number][] | null) {
    const gl = this.gl;
    // (The open sea is only worked out when the camera is near enough to see it, and by a variant that carries it.)
    const seaOn = variant.mask & F.SEA ? seaNear(cam) : 0;
    const r = variant.prog!;
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
    const [vx, vy, vw, vh] = this.view;
    gl.uniform1f(r.u.uPxAng, (2 * cam.tan) / vh);
    gl.uniform4f(r.u.uSim, this.simTop, this.simCell(), this.simW, this.simH);
    gl.uniform2f(r.u.uBedSize, this.bedMeta.w, this.bedMeta.h);
    gl.uniform1f(r.u.uBedDiv, this.bedMeta.div);
    gl.uniform1f(r.u.uTime, this.time);
    for (const event of events) {
      const location = r.u[event.uniform];
      if (location) gl.uniform1f(location, smooth(event.from, event.to, at.hour ?? 0));
    }
    // The tarn's shards are only worked out from near by.
    const nearTarn = tarnNear(cam);
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
    if (st[0] > 0.5 && !this.quiet) {
      // Meltwater drips from the columns into the shallows: real rings, most from the tallest.
      // (Each is chosen ahead of its time and published then, so its sound can be set for the frame that shows it.)
      if (!this.drip) {
        this.drip = nextDrip(Math.max(this.time, this.dripAt), this.colH, Math.random);
        emit('drip', this.drip.x, this.drip.y, this.drip.at, this.colH[this.drip.i] / COLS.hMax);
      }
      if (this.time >= this.drip.at) {
        const { x, y } = this.drip;
        this.dripAt = this.time;
        this.drip = null;
        this.splash(x, y, 12 + 8 * Math.random(), 0.5);
      }
    } else this.drip = null;
    if (st[2] > 0.5 && !this.quiet) {
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
    // The light: the hour's keys.
    const { sky, moon, extinction, lowExtinction } = light;
    if (r.u.uMoon) gl.uniform4fv(r.u.uMoon, moon);
    gl.uniform4fv(r.u.uBearings, light.bearings);
    gl.uniform4fv(r.u.uShadow, light.shadow);
    // (A scene smaller than the screen leaves its grain to the pass that brings it to size.)
    if (vw < this.canvas.width) gl.uniform4f(r.u.uFilm, light.film[0], light.film[1], -1, light.film[3]);
    else gl.uniform4fv(r.u.uFilm, light.film);
    gl.uniform4fv(r.u.uLee, light.lee);
    gl.uniform3fv(r.u.uSkyZen, sky.zen);
    gl.uniform3fv(r.u.uSkyMid, sky.mid);
    gl.uniform3fv(r.u.uSkyHor, sky.hor);
    gl.uniform3fv(r.u.uSkyBand, sky.band);
    gl.uniform3fv(r.u.uSunDir, sky.sun);
    gl.uniform3fv(r.u.uKeyCol, sky.key);
    gl.uniform3fv(r.u.uKeyDir, sky.keyDir);
    gl.uniform3fv(r.u.uAmbCol, sky.amb);
    gl.uniform4f(r.u.uSkyK, sky.haze, sky.aurora * sky.air[3], sky.dusk, sky.under);
    if (r.u.uAir) gl.uniform4f(r.u.uAir, sky.air[0], sky.air[1], sky.air[2], extinction);
    if (r.u.uDistanceAir) gl.uniform3fv(r.u.uDistanceAir, light.distanceAir);
    if (r.u.uRange) gl.uniform4fv(r.u.uRange, sky.range);
    if (r.u.uArrive) gl.uniform1f(r.u.uArrive, this.first);
    if (r.u.uHour) gl.uniform4f(r.u.uHour, sky.ground[0], sky.ground[1], sky.ground[2], lowExtinction);
    this.dusk = sky.dusk;
    gl.uniform4f(r.u.uSea, seaOn, at.settle, at.calm, at.near);
    gl.uniform4fv(r.u.uCalmBox, at.box);
    gl.uniform2f(r.u.uCalmK, at.boxK, at.boxLight ? 1 : 0);
    if (r.u.uCapBox) gl.uniform4fv(r.u.uCapBox, light.captionLee);
    if (r.u.uCapK) gl.uniform1f(r.u.uCapK, at.capK ?? 0);
    this.setRibbon(r, cam, aspect, seaOn, at.settle);
    this.bindIce(r, ice, 7, 9);
    gl.uniform1f(r.u.uIceH, ICE_H);
    gl.uniform1f(r.u.uIceOn, this.iceTex && this.melt < 0.999 ? 1 : 0);
    gl.uniform1f(r.u.uGlow, this.iceTex ? 1 - smooth(0.5, 1, this.melt) : 0);
    gl.uniform1f(r.u.uMeltAct, this.meltAct);
    // The water's own body takes the hour's light: its colour, how milky it is, how deep it reads, how its surface nets the light.
    const wt = sky.water;
    gl.uniform3f(r.u.uBed, pal.bed[0] * wt.tint[0], pal.bed[1] * wt.tint[1], pal.bed[2] * wt.tint[2]);
    gl.uniform3f(r.u.uAbsorb, pal.absorb[0] * wt.clear, pal.absorb[1] * wt.clear, pal.absorb[2] * wt.clear);
    gl.uniform3f(r.u.uScatter, pal.scatter[0] * wt.tint[0] * wt.milk, pal.scatter[1] * wt.tint[1] * wt.milk, pal.scatter[2] * wt.tint[2] * wt.milk);
    gl.uniform3fv(r.u.uIceCol, pal.ice);
    gl.uniform4f(r.u.uLight, pal.light[0], pal.light[1], pal.light[2] * wt.caust, pal.light[3]);

    // The slab, and the part of the screen it can be on.
    const sl = slabInFrame(cam, aspect);
    const on = this.slabTex && sl.behind < 8;
    gl.uniform3f(r.u.uSlabPos, SLAB.x, SLAB.y, SLAB.lift);
    gl.uniform4f(r.u.uSlabDir, sl.nx, sl.ny, sl.rx, sl.ry);
    gl.uniform3f(r.u.uSlabSize, on ? SLAB.w : 0, SLAB.h, SLAB.thick);
    gl.uniform4fv(r.u.uSlabBox, sl.box);
    if (r.u.uSlabTint) gl.uniform4f(r.u.uSlabTint, this.slabTint[0] * light.emission, this.slabTint[1] * light.emission, this.slabTint[2] * light.emission, light.emission);
    if (r.u.uTribW) gl.uniform1fv(r.u.uTribW, this.tribW);

    bindTex(gl, 0, this.bedA!.tex, r.u.uBedA);
    bindTex(gl, 1, this.bedB!.tex, r.u.uBedB);
    bindTex(gl, 2, this.waveOut!.tex, r.u.uWave);
    bindTex(gl, 3, this.vel!.read.tex, r.u.uVel);
    if (r.u.uIceInclusions) bindTex(gl, 4, this.inclusions, r.u.uIceInclusions);
    bindTex(gl, 5, this.detail.tex, r.u.uDetail);
    bindTex(gl, 6, this.grain.tex, r.u.uGrain);
    bindTex(gl, 8, this.heat.read.tex, r.u.uHeat);
    bindTex(gl, 10, this.curv.tex, r.u.uCurv);
    bindTex(gl, 11, ((this.faceOn ? this.faceTex : null) ?? this.slabTex ?? this.grain.tex) as WebGLTexture, r.u.uSlabTex);
    bindTex(gl, 12, this.ground.tex, r.u.uGround);
    bindTex(gl, 13, this.pano.tex, r.u.uPano);
    const w = this.canvas.width;
    const h = this.canvas.height;
    // (Making a texture binds it: on a unit the scene does not use.)
    gl.activeTexture(gl.TEXTURE15);
    this.filmTargets(w, h);
    bindTex(gl, 14, this.film[3].tex, r.u.uGlowTex);
    // (Unit 15 is the scratch unit: the pool's picture is put back on it for each draw.)
    bindTex(gl, 15, (this.sheetTex ?? this.grain.tex) as WebGLTexture, r.u.uSheetTex);
    gl.uniform1f(r.u.uSheetOn, this.sheetTex ? 1 : 0);
    gl.uniform1f(r.u.uBloom, this.bloomNow(night));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vx, vy, vw, vh);
    if (!parts) {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    // (In whole pixels of the scene, x, y, width, height, y up.)
    gl.enable(gl.SCISSOR_TEST);
    for (const q of parts) {
      gl.scissor(vx + q[0], vy + q[1], q[2], q[3]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  /** How much of the last frame's glow this frame adds. */
  private bloomNow(night: number) {
    // Leanest: by day, when only the sun blooms, the halo is let go.
    const l2 = Math.min(1, Math.max(0, this.leanNow - 1));
    // (At the ending the sun itself is in the frame: its own skirts carry it, and the glow is held back.)
    return 0.55 * (1 - l2 * (1 - night)) * (1 - 0.45 * this.dusk);
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
   * The scene is drawn straight to the screen, finished, in one full-size
   * pass (see `scene`). This then takes the frame's highlights, small, for
   * the next frame's glow: a frame's delay in a soft halo is not seen.
   */
  private glow(night: number) {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const f = this.film;
    if (this.bloomNow(night) <= 0.001) return;
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
    if (this.inclusions) this.gl.deleteTexture(this.inclusions);
    for (const t of this.film) freeTarget(this.gl, t);
    freeTarget(this.gl, this.stage);
    if (this.slabTex) this.gl.deleteTexture(this.slabTex);
    if (this.faceTex) this.gl.deleteTexture(this.faceTex);
    if (this.sheetTex) this.gl.deleteTexture(this.sheetTex);
    for (const v of this.variants.values()) {
      if (v.prog) this.gl.deleteProgram(v.prog.prog);
      if (v.pending) {
        this.gl.deleteShader(v.pending.vs);
        this.gl.deleteShader(v.pending.fs);
        this.gl.deleteProgram(v.pending.prog);
      }
    }
    this.variants.clear();
    for (const v of this.heldProgs.values()) if (v.prog) this.gl.deleteProgram(v.prog.prog);
    this.heldProgs.clear();
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
  /** For the checks: the pose the flight has at a scroll position on this screen, and a pose held in place of the flight's own (null hands it back). */
  poseAt(s: number): Pose;
  holdPose(pose: Pose | null): void;
  /** Each station's hold: where its move begins, stands composed and ends, in screens. */
  holds: ReturnType<typeof HOLDS>;
  /** For the checks and the stills: hold the entrance at `t` seconds into it (0: its first frame; null lets it run from where it is). */
  holdEntrance(t: number | null): void;
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
  {
    // The variants of the pass the first frame waits for are those for where the page now is (a reload may open it
    // anywhere), and the one that can draw any stretch.
    const a0 = html.clientWidth / Math.max(window.innerHeight, html.clientHeight, 1);
    const first = document.querySelector<HTMLElement>('[data-fl]');
    const u0 = first ? first.offsetHeight / (SECTIONS.hero + 1) : window.innerHeight;
    const s0 = window.scrollY / Math.max(u0, 1);
    const at = mqStill.matches ? stillScroll(s0) : s0;
    // (The block's picture has not been asked for yet: the first frame is drawn without it.)
    const pose0 = basisOf(poseAt(flightKeys(a0), at));
    const need0 = passNeeds(pose0, a0, iceParts((at - MELT.from) / (MELT.to - MELT.from), themeNow(), true), false);
    // (The name has not been laid out yet, so its piece of the frame is not known: where the name can be seen at all,
    // the variant that carries it is asked for with the rest. The pieces are settled once it stands: see below.)
    engine.firstNeeds = [...engine.firstPieces(pose0, a0, need0), ...(need0 & F.NAME ? [F.ICE | F.FIELD | F.NAME] : [])];
    // What the whole frame needs all down the flight: the engine cuts it into a few stretches, each with one broad
    // variant that can draw all of it, and builds those with the first.
    const keys0 = flightKeys(a0);
    const needs: { s: number; need: number }[] = [];
    for (let s = 0; s <= END_AT + 1e-6; s += 0.05) {
      const q = mqStill.matches ? stillScroll(s) : s;
      const pose = basisOf(poseAt(keys0, q));
      needs.push({ s, need: passNeeds(pose, a0, iceParts((q - MELT.from) / (MELT.to - MELT.from), themeNow(), true), true) });
    }
    engine.setCover(needs);
  }
  // (The display's own rate is learnt from the first frame on, while the still stands and nothing loads the GPU.)
  const offBeat = onFrame((now) => engine.beat(now), 9);
  await engine.prepare();
  if (isCancelled()) {
    offBeat();
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
  let heldPose: Pose | null = null;
  // The entrance (see ENTER): it begins once the live picture stands over its still and the opening lets it.
  const gate = opening();
  const bands = posterBands();
  /** The band of first-frame stills this window is in: the page's first script chose it, so the still and the picture agree. */
  const bandNow = () => bands.find((b) => b.id === html.dataset.poster) ?? posterBand(aspect, bands);
  let pictureUp = false;
  let enterT0 = -1;
  let enterHeld: number | null = null;
  let opened = false;

  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-fl]'));
  // The words. A block is on for a stretch of scroll (from, to), and builds
  // in steps: each of its pieces has a scroll position of its own (`data-at`,
  // in screens) past which it is in. A piece is only ever out or in, at its
  // own size and in its own place; the stylesheet makes the short transition
  // between the two. The first frame's pieces are the opening's: they wait
  // for its cue, not for scroll.
  interface Piece {
    el: HTMLElement;
    at: number;
    in: boolean | null;
  }
  interface Words {
    el: HTMLElement;
    from: number;
    to: number;
    on: boolean | null;
    hero: boolean;
    pieces: Piece[];
    /** a block that sets as one at a later point than it comes on (the ending: its small line leads): that point, and whether it is past */
    setAt: number;
    set: boolean | null;
  }
  const words: Words[] = Array.from(document.querySelectorAll<HTMLElement>('[data-fl-from]')).map((el) => ({
    el,
    from: Number(el.dataset.flFrom),
    to: Number(el.dataset.flTo),
    on: null,
    hero: el.dataset.hero !== undefined,
    pieces: Array.from(el.querySelectorAll<HTMLElement>('[data-at]')).map((piece) => ({ el: piece, at: Number(piece.dataset.at), in: null })),
    setAt: el.dataset.flSet === undefined ? NaN : Number(el.dataset.flSet),
    set: null,
  }));
  /** Lines that leave before their block does: each is gone from its own point of the scroll on. */
  const early = Array.from(document.querySelectorAll<HTMLElement>('[data-fl-until]')).map((el) => ({ el, until: Number(el.dataset.flUntil), gone: false }));
  const heroWords = document.querySelector<HTMLElement>('.fl-hero-words');
  /** Whether the first frame's words may set: the opening says when (see `enter`). */
  let heroIn = html.dataset.heroWords !== undefined;

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
  // The captions' lee: the same, behind the captions that are tied to their points.
  const cap: [number, number, number, number] = [0, 0, 0, 0];
  let capK = 0;
  let capLast = 0;
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
  /** Where the block the lee stands behind has its words now: the pieces that are in (or, for a block that does not build, its ink). */
  const measureBox = () => {
    const w = leeFor;
    if (!w) return;
    let u: { x0: number; y0: number; x1: number; y1: number } | null = null;
    if (!w.pieces.length) u = inkOf(w.el);
    else {
      for (const it of w.pieces) {
        if (!it.in || it.el.dataset.gone !== undefined) continue;
        const r = it.el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        u = u ? { x0: Math.min(u.x0, r.left), y0: Math.min(u.y0, r.top), x1: Math.max(u.x1, r.right), y1: Math.max(u.y1, r.bottom) } : { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
      }
      // (On a narrow frame a station with many captions sets them as a list just over its words: the lee takes the list in.)
      const list = Array.from(w.el.parentElement?.querySelectorAll<HTMLElement>('.fl-call[data-loose][data-on] .fl-call-label') ?? []);
      for (const el of list) {
        const r = el.getBoundingClientRect();
        if (u && r.width > 2) u = { x0: Math.min(u.x0, r.left), y0: Math.min(u.y0, r.top), x1: Math.max(u.x1, r.right), y1: Math.max(u.y1, r.bottom) };
      }
    }
    boxOn = !!u && w.on === true;
    // (And room for the short rise a step arrives with.)
    if (u) setBox(u.x0, u.y0, u.x1, u.y1, 12);
  };
  const scheduleBox = () => {
    measureBox();
    window.clearTimeout(boxTimer);
    // Again once the step has set.
    boxTimer = window.setTimeout(measureBox, 420);
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

  /** How far up the frame the first frame's words reach: with both lines standing, and once the second has gone. */
  let wordsTop: [number, number] = [0.2, 0.2];
  let secondGone = false;
  /** Where the first frame's words stand (measured while the page is at its top, where they are): one block at the foot on the left, his line and the sentence under it. */
  function measureHero() {
    if (destroyed) return;
    const role = document.querySelector<HTMLElement>('.fl-hero-words .fl-role');
    const intro = document.querySelector<HTMLElement>('.fl-hero-words .fl-intro');
    if (!role || !intro || window.scrollY > 4) return;
    const a = role.getBoundingClientRect();
    const b = intro.getBoundingClientRect();
    if (a.width < 2 || b.width < 2) return;
    // (The line settles to the foot of the frame once the sentence has gone: the water the letters stand in has that
    // much more room to spread toward the eye.)
    const drop = Math.max(0, b.bottom - a.bottom);
    heroWords?.style.setProperty('--role-drop', `${drop.toFixed(1)}px`);
    wordsTop = [1 - Math.min(a.top, b.top) / viewH, 1 - (a.top + drop) / viewH];
    // (Right of the block the frame is the picture's: the bare ice comes on to the frame's foot there.)
    const right = Math.max(a.right, b.right) / viewW;
    engine.nameWords = [right < 0.82 ? right : 1, right < 0.82 ? 1.2 : 1, wordsTop[secondGone ? 1 : 0]];
    engine.touch();
  }

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
    scheduleBox();
    measureHero();
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

  /** The letters' outlines, drawn once: the display face's capitals, each in its own cell of one raster. */
  let glyphs: ReturnType<typeof rasterGlyphs> | null = null;
  /** The cut the letters are given (the checks may set another before the page starts, to compare). */
  const cut: NameCut = { ...NAME_CUT, ...((window as unknown as { __nameCut?: Partial<NameCut> }).__nameCut ?? {}) };
  /** The name is one row of eight plates on a wide screen and two rows of four on an upright one: where each stands, for this screen's first camera. */
  async function buildName() {
    const token = ++buildToken;
    if (!glyphs) {
      const family = getComputedStyle(document.documentElement).getPropertyValue('--f-orbiter').trim() || getComputedStyle(document.body).fontFamily;
      const g = rasterGlyphs(family, cut);
      // (Distances in capitals' heights.)
      const sd = await solver.solve({ alpha: g.alpha, w: g.tw, h: g.th, clamp: g.cap * 0.6, scale: 1 / g.cap });
      if (destroyed || token !== buildToken) return;
      glyphs = g;
      engine.setIce({ sd: sd.sd, w: g.tw, h: g.th, minSd: sd.min });
    }
    const g = glyphs;
    const hero = heroDesign(aspect);
    const plates = layoutName(hero.rows, g, cut);
    engine.nameCut = hero.cut;
    engine.nameTan = Math.tan((hero.pose.fov * Math.PI) / 360);
    // The rows, each as a strip of the lake; and the name's box in the first camera's picture.
    const [cy, ch, cc, cs] = hero.cut;
    const rowOf = (r: number): [number, number, number, number] => {
      const ps = plates.filter((p) => p.row === r);
      const x0 = Math.min(...ps.map((p) => p.x - p.hw));
      const x1 = Math.max(...ps.map((p) => p.x + p.hw));
      return [(x0 + x1) / 2, ps[0].y + ps[0].d / 2, (x1 - x0) / 2, ps[0].d / 2];
    };
    const rows: [number, number, number, number][] = [rowOf(0), rowOf(plates[PLATES - 1].row)];
    const seen = (y: number, z: number) => {
      const depth = (y - cy) * cc - (z - ch) * cs;
      return { depth, ty: ((y - cy) * cs + (z - ch) * cc) / depth };
    };
    const foot = seen(plates[PLATES - 1].y, 0);
    const top = seen(plates[0].y, plates[0].h);
    const halfX = Math.max(rows[0][2] / seen(plates[0].y, plates[0].h / 2).depth, rows[1][2] / seen(plates[PLATES - 1].y, plates[PLATES - 1].h / 2).depth);
    const far = plates[0];
    // The fractures that run out from the rows as the sheet weakens: where each leaves, the way it runs, how long it is.
    const hash = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const frac = new Float32Array(PLATES * 4);
    const fracL = new Float32Array(PLATES);
    for (let i = 0; i < PLATES; i++) {
      const row = rows[i < 4 ? 0 : 1];
      const fx = (i - (i < 4 ? 1.5 : 5.5)) / 1.5;
      const ang = fx * 0.75 + (hash(i * 3.7 + 1.3) - 0.5) * 1.1;
      // (Most run toward the eye; one from each row runs back up the lake.)
      frac.set([row[0] + fx * row[2] * 0.86, row[1], Math.sin(ang), (i === 2 || i === 5 ? 1 : -1) * Math.cos(ang)], i * 4);
      fracL[i] = 0.5 + 0.7 * hash(i * 5.1 + 2.2);
    }
    // Each row whole, in the raster (see rasterGlyphs): where its middle and its baseline lie, and half its width in capitals' heights.
    const stripOf = (text: string): [number, number, number, number] => {
      const st = g.strips[text];
      return [st.x / g.tw, st.y / g.th, st.half + 0.18, 0];
    };
    const strips: [number, number, number, number][] = [stripOf(hero.rows[0].text), stripOf(hero.rows[hero.rows.length - 1].text)];
    engine.nameStand = {
      plates,
      frac,
      fracL,
      strips,
      rows,
      seat: [(foot.ty + top.ty) / 2, halfX, (top.ty - foot.ty) / 2],
      tex: [g.cap / g.tw, g.cap / g.th, GLYPH_CELL.w / 2 - 0.03, 0.5 + Math.min(GLYPH_CELL.foot, GLYPH_CELL.h - 1 - GLYPH_CELL.foot) - 0.03],
      cells: plates.map((_, i) => [(((i % GLYPH_CELL.cols) + 0.5) * GLYPH_CELL.w * g.cap) / g.tw, ((Math.floor(i / GLYPH_CELL.cols) * GLYPH_CELL.h + GLYPH_CELL.foot + 0.5) * g.cap) / g.th]),
      // (The lead leaves from behind the far row, between the two words where they stand side by side.)
      lead: [far.y + far.d, NAME.x + (rows[0] === rows[1] || plates[0].row === plates[PLATES - 1].row ? (plates[3].x + plates[3].hw + plates[4].x - plates[4].hw) / 2 - NAME.x : 0)],
    };
    // The stretch of the lake the name stands on, as the sheet's own frame has it: the rows, with room round them.
    const padX = 0.5 * plates[PLATES - 1].h;
    const y0 = rows[1][1] - rows[1][3];
    const y1 = rows[0][1] + rows[0][3];
    const hx = Math.max(rows[0][2], rows[1][2]);
    engine.setNameRect({ x: NAME.x - hx - padX, y: y0 - padX, w: 2 * (hx + padX), h: y1 - y0 + 2 * padX }, [hx, (y1 - y0) / 2]);
  }

  let boardFor = '';
  function buildBoard() {
    if (!root.dataset.sheet || destroyed) return;
    const key = `${aspect.toFixed(3)}:${canvas.width}`;
    if (key === boardFor) return;
    boardFor = key;
    engine.setBoard(boardMask(aspect, canvas.width));
  }

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      measureView();
      // The name is laid out for this screen's first camera: a new shape, a new layout.
      if (Math.abs(aspect - cutFor) > 0.004) {
        cutFor = aspect;
        void buildName();
      }
      // (And the frame is cut into other pieces: the flight's plan is worked out again.)
      if (built && Math.abs(aspect - planFor) > 0.004) void planFlight();
      buildBoard();
    }, 120);
  };

  measureView();
  if (document.fonts?.status !== 'loaded') {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  }
  // The name's own face may not have been asked for yet: ask.
  try {
    const host = document.querySelector<HTMLElement>('[data-ice]');
    const face = getComputedStyle(document.documentElement).getPropertyValue('--f-orbiter').trim();
    if (host && face) await Promise.race([document.fonts.load(`${cut.weight} 100px ${face}`, 'ARAVJIN'), new Promise((r) => setTimeout(r, 1500))]);
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
  /**
   * Each stretch's pieces, each with the scroll position it is first needed at: what the engine builds, nearest first,
   * while the reader leaves the page alone. Worked out a few positions to a task, so it never holds a frame.
   */
  let planToken = 0;
  let planFor = 0;
  const planFlight = async () => {
    const token = ++planToken;
    planFor = aspect;
    const out: { s: number; mask: number }[] = [];
    let t0 = performance.now();
    for (let s = 0; s <= END_AT + 1e-6; s += 0.05) {
      const at = mqStill.matches ? stillScroll(s) : s;
      const pose = basisOf(poseAt(keys, at));
      const need = passNeeds(pose, aspect, iceParts((at - MELT.from) / (MELT.to - MELT.from), themeNow(), true), true);
      // (Each piece's own, the largest first. A sliver's is left out: there are many of them along the flight, each
      // for a moment, and the variant that carries everything draws them.)
      for (const t of engine.tiles(pose, aspect, need)) if (t.area >= 0.04 && !out.some((o) => o.mask === t.mask)) out.push({ s, mask: t.mask });
      if (performance.now() - t0 > 2.5) {
        await new Promise<void>((res) => setTimeout(res, 0));
        if (destroyed || token !== planToken) return;
        t0 = performance.now();
      }
    }
    engine.setPlan(out);
  };
  {
    // Behind the still: the pieces of the frame the page opens on, now that the name stands, each by a variant of
    // its own that has drawn before; and the flight's plan.
    const at0 = mqStill.matches ? stillScroll(window.scrollY / unit) : window.scrollY / unit;
    const pose0 = basisOf(poseAt(keys, at0));
    const planning = planFlight();
    await engine.stand(engine.firstPieces(pose0, aspect, passNeeds(pose0, aspect, iceParts((at0 - MELT.from) / (MELT.to - MELT.from), themeNow(), true), false)));
    await planning;
    // And how fast this device draws the scene is measured, on the frame the page opens on: the pace is set by it.
    if (!mqStill.matches && !isCancelled() && !destroyed) {
      await engine.calibrate(pose0, aspect, { melt: (at0 - MELT.from) / (MELT.to - MELT.from), day: dayAt(at0), hour: at0, settle: smooth(END_AT - SECTIONS.sea + 0.9, SETTLE_AT, at0), rest: at0 >= SETTLE_AT - 0.02, calm, near: nearV, box, boxK: 0, boxLight: false });
    }
    if (isCancelled() || destroyed) {
      solver.dispose();
      engine.destroy();
      canvas.remove();
      return null;
    }
  }
  built = true;
  html.dataset.flight = 'on';
  // (The first frame's words take their places once the flight is on, and settle a moment later: they are measured then.)
  const heroTimers = [0, 450, 1300].map((ms) => window.setTimeout(measureHero, ms));

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
  // The results on the pool's bed are set as type, for this screen (see board.ts): again when the screen changes.
  if (root.dataset.sheet) void boardReady().then(buildBoard);

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
  // (A theme's variants are its own: the engine builds the plan's again for the theme it is in.)
  const onTheme = () => engine.setTheme(themeNow());
  window.addEventListener('themechange', onTheme);
  // Whatever the reader does: no program is built for a moment after (see the engine's `build`).
  const onInput = () => engine.input();
  const INPUTS = ['wheel', 'scroll', 'touchstart', 'touchmove', 'pointerdown', 'pointermove', 'keydown'] as const;
  for (const type of INPUTS) window.addEventListener(type, onInput, { passive: true });
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

  let canvasVisible = false;
  const visibility = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    canvasVisible = entry.isIntersecting && entry.intersectionRatio > 0;
    if (canvasVisible) engine.touch();
  }, { threshold: Number.EPSILON });
  visibility.observe(canvas);

  const off = onFrame((now) => {
    if (!built) return;
    const raw = window.scrollY / unit;
    // Nothing may glide when motion is reduced: each section shows its
    // composed frame, and its words stand with it for the whole of its
    // stretch (they are set for that frame, so nothing is ever hidden).
    const s = mqStill.matches ? stillScroll(raw) : raw;
    sNow = s;
    // Each block of words is on for its stretch of scroll, and each of its
    // pieces is in from its own position in it. (When nothing may glide a
    // block stands whole for the whole of its stretch.)
    let active: Words | null = null;
    let stepped = false;
    for (const w of words) {
      const on = s >= w.from && s < w.to;
      if (on !== w.on) {
        w.on = on;
        w.el.toggleAttribute('data-on', on);
        if (w === leeFor) stepped = true;
      }
      if (!Number.isNaN(w.setAt)) {
        const set = on && s >= w.setAt;
        if (set !== w.set) {
          w.set = set;
          w.el.toggleAttribute('data-set', set);
        }
      }
      for (const it of w.pieces) {
        // (A block that has left keeps its pieces as they stood: it goes as one.)
        const is = w.hero ? heroIn : s >= w.to ? it.in === true : mqStill.matches ? on : s >= it.at;
        if (is !== it.in) {
          it.in = is;
          it.el.toggleAttribute('data-in', is);
          if (w === leeFor || !leeFor) stepped = true;
        }
      }
      // (The first frame's words stand on the near snow, which is calm of itself: they are given a lee only once the
      // lake is breaking under them.)
      if (on && !active && (!w.hero || s > HERO_LEE)) active = w;
    }
    for (const e of early) {
      const gone = s >= e.until;
      if (gone !== e.gone) {
        e.gone = gone;
        e.el.toggleAttribute('data-gone', gone);
        stepped = true;
        if (e.el.parentElement === heroWords) {
          secondGone = gone;
          heroWords?.toggleAttribute('data-second-gone', gone);
        }
      }
    }
    // (The snow left for those words follows them, over a moment: the bare ice comes on toward the eye as the line settles.)
    const topNow = wordsTop[secondGone ? 1 : 0];
    if (Math.abs(engine.nameWords[2] - topNow) > 1e-4) {
      const kTop = mqStill.matches ? 1 : 1 - Math.exp(-Math.min(0.1, boxLast ? (now - boxLast) / 1000 : 0) * 4);
      engine.nameWords[2] += (topNow - engine.nameWords[2]) * kTop;
      if (Math.abs(engine.nameWords[2] - topNow) <= 1e-4) engine.nameWords[2] = topNow;
      engine.touch();
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
      if (active) scheduleBox();
    } else if (stepped && leeFor === active && active) scheduleBox();
    if (leeFor !== active) boxOn = false;
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
    let pose = heldPose ?? poseAt(keys, s);
    // (Nothing banks when motion is reduced.)
    if (mqStill.matches) pose.roll = 0;
    // The first screen's own life, by the clock: the entrance (the eye comes forward from where the still was taken,
    // the light arrives, the words set), and after it the frame breathes. All of it is let go as the page scrolls.
    let idle = false;
    let entering = false;
    {
      const t = mqStill.matches ? ENTER.over : (enterHeld ?? (enterT0 < 0 ? 0 : Math.max(0, (now - enterT0) / 1000)));
      const live = heldPose ? 0 : 1 - smooth(0.02, 0.45, s);
      const en = enterAt(t);
      // (When nothing may move, the first screen stands where its still was taken and only the light is the day's own:
      // the picture comes up over the still with nothing in it changing place.)
      if (mqStill.matches) en.eye = 0;
      const rest = Math.max(0, t - ENTER.over);
      const br = breathAt(rest);
      const brK = mqStill.matches ? 0 : smooth(0, 4, rest) * live;
      engine.first = 1 - (1 - en.light) * live;
      engine.breath = br.light * brK;
      if (live > 0) {
        const k = (1 - en.eye) * live;
        if (k > 0) {
          const from = heroStart(bandNow(), ENTER.back, ENTER.high);
          const mix = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
          pose = { pos: mix(pose.pos, from.pos), aim: mix(pose.aim, from.aim), fov: pose.fov + (from.fov - pose.fov) * k };
        }
        if (brK > 0) pose = moved({ at: pose, pivot: [NAME.x, NAME.y, 0], push: 0.02 * br.near * brK, arc: 0.9 * br.sway * brK, rise: 0 }, 1);
        idle = t >= ENTER.over;
        entering = !idle;
      }
      if (!heroIn && (t >= ENTER.words || html.dataset.heroWords !== undefined)) {
        heroIn = true;
        html.dataset.heroWords = '';
      }
      if (!opened && t >= ENTER.over) {
        opened = true;
        gate.over();
      }
    }
    cam = basisOf(pose);
    const melt = (s - MELT.from) / (MELT.to - MELT.from);
    dayNow = dayAt(s);
    const rest = s >= SETTLE_AT - 0.02;
    // (Published before the draw: whoever follows the picture takes its turn ahead of the picture's own work.)
    flightSignal(now, s, cam, aspect, melt, dayNow, rest);
    const span = callouts.frame(cam, aspect, viewW, viewH, s);
    // (It comes in where the captions stand and goes out where they last stood.)
    const dtCap = Math.min(0.1, Math.max(0, (now - capLast) / 1000));
    capLast = now;
    if (span) {
      const pad = 5;
      cap[0] = (span[0] - pad) / viewW;
      cap[1] = 1 - (span[3] + pad) / viewH;
      cap[2] = (span[2] + pad) / viewW;
      cap[3] = 1 - (span[1] - pad) / viewH;
    }
    capK = span ? Math.min(1, capK + dtCap / (mqStill.matches ? 0.001 : 0.3)) : Math.max(0, capK - dtCap / (mqStill.matches ? 0.001 : 0.25));
    if (canvasVisible) engine.frame(now, cam, aspect, { melt, day: dayNow, hour: s, settle: smooth(END_AT - SECTIONS.sea + 0.9, SETTLE_AT, s), rest, calm, near: nearV, box, boxK, boxLight, cap, capK, idle, entering });
    // The live picture stands over its still once a frame of it is drawn; the entrance begins when the dissolve is done.
    if (!pictureUp && engine.drew) {
      pictureUp = true;
      html.dataset.picture = '';
      void gate.ready.then(() => {
        enterT0 = performance.now() + (mqStill.matches ? 0 : 440);
      });
    }
  }, 10);

  return {
    engine,
    rebuild: onResize,
    state: () => ({ s: sNow, pos: cam.pos, unit, day: dayNow }),
    holds: HOLDS(),
    holdEntrance(t) {
      enterHeld = t;
      engine.touch();
    },
    poseAt: (s) => poseAt(keys, s),
    holdPose(pose) {
      heldPose = pose ? { ...pose } : null;
      engine.touch();
    },
    destroy() {
      destroyed = true;
      off();
      offBeat();
      ro.disconnect();
      forkWatch.disconnect();
      visibility.disconnect();
      railEl?.removeEventListener('click', onRail);
      window.clearTimeout(boxTimer);
      heroTimers.forEach((t) => window.clearTimeout(t));
      planToken++;
      for (const type of INPUTS) window.removeEventListener(type, onInput);
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
      delete html.dataset.picture;
    },
  };
}
