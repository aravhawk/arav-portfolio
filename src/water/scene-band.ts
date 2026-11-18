/**
 * A scene band: the flight's own engine and world, held at one composed
 * frame at the head of an inner page. Nothing scrolls the camera here. It
 * stands where the home page stands for that subject (the same key poses,
 * read from camera.ts, so a station that moves moves here too), drifts a
 * little by the clock, and the water answers the pointer.
 *
 * One engine serves every inner page: the canvas is handed from the page
 * that is leaving to the page that is arriving, so the world is carved
 * once per visit and a route change only moves the camera. It is let go a
 * few seconds after the last band has gone, or at once on the home page,
 * which runs its own.
 */

import { onFrame } from '@/lib/frame';
import { BedPainter } from './bed';
import { type Basis, type Key, type Pose, basisOf, dayAt, flightKeys, groundUnder, poseAt, stillStops } from './camera';
import { boardMask, boardReady } from './board';
import { FlightEngine, scenePicture } from './flight';
import { freeboardAt } from './shaders/flight';
import { makeSolver } from './stage';
import { type IceParts, NO_ICE, passNeeds } from './variants';
import { LAKE, NAME, OUTLET, SHOAL_Y, TRIBS, WORLD, paintWorld, tribWidth } from './world';

/** An inner page's lake: the sheet whole, and no name on it (the name in ice is the home page's alone). */
const LAKE_ICE: IceParts = { on: true, blocks: false, field: false };

export type SceneId = 'infiniview' | 'open-source' | 'kilo-bench' | 'agent-bridge' | 'ollama' | 'cc-switch' | 'tensorpow' | 'rydar' | 'delta' | 'lake' | 'snow';

/** Which of the flight's composed frames each subject is (see stillStops in camera.ts). */
const STOP: Partial<Record<SceneId, number>> = {
  infiniview: 2,
  'open-source': 3,
  'kilo-bench': 4,
  'agent-bridge': 5,
  ollama: 6,
  'cc-switch': 7,
  tensorpow: 8,
  rydar: 9,
  delta: 10,
};

/**
 * On the home page a station's words are a few short lines at the foot of
 * a tall frame. A page's title block is taller and its band is lower, so
 * where the subject stands low in the frame the camera looks down a little
 * more and the subject rises clear of the words: this much of the frame's
 * height, on a wide band only (an upright one keeps its bank at the foot).
 */
const LIFT: Partial<Record<SceneId, number>> = { ollama: 0.1, tensorpow: 0.05 };

/**
 * The two frames that are not stations. Each is a pair of poses the camera
 * drifts between, for a wide band and for an upright one.
 *  - lake: the frozen lake the home page begins on, whole (the name in
 *    ice is the home page's alone), looking down its length to the far
 *    shore and the ranges: ice and sky, and nothing else.
 *  - snow: out on the snowfield west of everything, looking away from the
 *    river: drifts, the ranges, no water in sight.
 */
function ownPoses(scene: SceneId, aspect: number): [Pose, Pose] | null {
  const tall = aspect < 0.9;
  if (scene === 'lake') {
    const y = LAKE.y1 - 3300;
    // (A low, wide band, a post's head, looks down a little more: the horizon stands above the title, not behind it.)
    const az = aspect > 2.25 ? -30 : 78;
    return tall
      ? [
          { pos: [1300, y, 150], aim: [1340, y + 1500, 60], fov: 60 },
          { pos: [1310, y + 90, 146], aim: [1352, y + 1590, 60], fov: 60 },
        ]
      : [
          { pos: [1300, y, 120], aim: [1380, y + 1500, az], fov: 44 },
          { pos: [1316, y + 110, 116], aim: [1398, y + 1610, az], fov: 44 },
        ];
  }
  if (scene === 'snow') {
    const y = LAKE.y1 + 2500;
    return tall
      ? [
          { pos: [-900, y, 190], aim: [-2300, y + 1500, 60], fov: 60 },
          { pos: [-930, y + 40, 186], aim: [-2330, y + 1540, 60], fov: 60 },
        ]
      : [
          { pos: [-900, y, 150], aim: [-2300, y + 1500, 82], fov: 44 },
          { pos: [-940, y + 50, 146], aim: [-2340, y + 1550, 82], fov: 44 },
        ];
  }
  return null;
}

export interface BandOpts {
  scene: SceneId;
  /** merged pull requests per repository: how wide each stream at the confluence runs */
  tribs?: number[];
  /** each column's height at the shallows */
  cols?: number[];
  /** the pictures the stations carry */
  slab?: string;
  sheet?: string;
  face?: string;
}

export interface BandHandle {
  detach(): void;
}

interface Shared {
  engine: FlightEngine;
  canvas: HTMLCanvasElement;
  solver: ReturnType<typeof makeSolver>;
  tribKey: string;
  off: () => void;
  dispose: () => void;
}

interface Active {
  host: HTMLElement;
  opts: BandOpts;
  visible: boolean;
  drawn: boolean;
  w: number;
  h: number;
  dpr: number;
  aspect: number;
  keys: Key[];
  box: [number, number, number, number];
  boxOn: boolean;
  t0: number;
  clean: () => void;
}

let shared: Shared | null = null;
let starting: Promise<Shared | null> | null = null;
let active: Active | null = null;
let failed = false;
let killTimer = 0;
/** For the capture tools: a pose held in place of the scene's own, and the words' calm switched off (a still is taken without it). */
let heldPose: Pose | null = null;
let calmOff = false;

const smooth01 = (t: number) => t * t * (3 - 2 * t);

async function carve(s: Shared, tribs: number[] | undefined, isDead: () => boolean) {
  const { engine, solver } = s;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const rows = Math.min(engine.maxTexture, coarse ? 4096 : 8192) - 8;
  const cells = (coarse ? 1.2e6 : 3.0e6) * (WORLD.h / 12400);
  const div = Math.max(3, WORLD.h / rows, Math.sqrt((WORLD.w * WORLD.h) / cells));
  const painter = new BedPainter(WORLD.w, WORLD.h, div);
  const tick = () => new Promise<void>((res) => setTimeout(res, 0));
  paintWorld(painter, tribs && tribs.length ? tribs : undefined, engine.gate);
  await tick();
  const r = painter.rasters();
  const sd = await solver.solve({ alpha: r.mask, w: painter.w, h: painter.h, clamp: r.clampTexels, scale: painter.div });
  if (isDead()) return false;
  await tick();
  const bed = painter.assemble(sd.sd, r.flow);
  await tick();
  if (isDead()) return false;
  engine.setBed(bed);
  engine.shoalY = SHOAL_Y;
  (tribs && tribs.length ? tribs : [9, 5, 3, 2, 1, 1, 1]).slice(0, TRIBS.length).forEach((n, i) => (engine.tribW[i] = tribWidth(n)));
  engine.lake = { y0: LAKE.y0, y1: LAKE.y1 };
  engine.meltPath = { x: OUTLET.x, y: OUTLET.y, reach: 900, w: OUTLET.w };
  return true;
}

/** The pose a scene is first seen from (its own first pose, or its station's composed frame). */
function firstPose(scene: SceneId, aspect: number): Pose {
  const own = ownPoses(scene, aspect);
  return own ? own[0] : poseAt(flightKeys(aspect), stillStops()[STOP[scene] ?? 0]);
}

function start(first: BandOpts, aspect: number): Promise<Shared | null> {
  if (shared) return Promise.resolve(shared);
  if (failed) return Promise.resolve(null);
  if (starting) return starting;
  starting = (async () => {
    const html = document.documentElement;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'band-canvas';
    const mqStill = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const themeNow = () => (html.dataset.theme === 'dark' ? 1 : 0);
    let dead = false;
    let engine: FlightEngine;
    try {
      // Throws when WebGL2 or float targets are missing: the still stays.
      engine = new FlightEngine(canvas, { theme: themeNow(), still: mqStill.matches, coarse });
      // The one variant of the pass this start waits for is the first scene's own: its station and nothing else.
      const pose0 = basisOf(firstPose(first.scene, aspect));
      engine.firstNeed = engine.firstPiece(pose0, aspect, passNeeds(pose0, aspect, first.scene === 'lake' ? LAKE_ICE : NO_ICE, false));
      await engine.prepare();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn(err);
      failed = true;
      return null;
    }
    const solver = makeSolver();
    const s: Shared = { engine, canvas, solver, tribKey: (first.tribs ?? []).join(','), off: () => {}, dispose: () => {} };
    if (!(await carve(s, first.tribs, () => dead))) {
      solver.dispose();
      engine.destroy();
      return null;
    }
    // The lake's sheet, with nothing cut in it: a field that is far from any letter everywhere.
    engine.iceRect = { x: NAME.x - 750, y: NAME.y - 300, w: 1500, h: 600 };
    engine.setIce({ sd: new Float32Array(64 * 64).fill(400), w: 64, h: 64, minSd: -1 });

    // A lost context draws nothing: the still comes back in its place.
    canvas.addEventListener('webglcontextlost', () => {
      if (active) {
        active.drawn = false;
        active.host.removeAttribute('data-band');
        active.visible = false;
      }
    });
    const onTheme = () => engine.setTheme(themeNow());
    const onStill = () => engine.setStill(mqStill.matches);
    window.addEventListener('themechange', onTheme);
    mqStill.addEventListener('change', onStill);

    // The pointer meets the water where its ray meets the water's plane.
    let cam: Basis | null = null;
    const toWater = (e: PointerEvent) => {
      const a = active;
      if (!a || !cam || !a.visible) return null;
      const r = a.host.getBoundingClientRect();
      const sx = (e.clientX - r.left) / r.width;
      const sy = (e.clientY - r.top) / r.height;
      if (sx < 0 || sx > 1 || sy < 0 || sy > 1) return null;
      const land = groundUnder(cam, sx, sy, a.aspect, 0);
      if (!land) return null;
      const hit = groundUnder(cam, sx, sy, a.aspect, -freeboardAt(land.y));
      if (!hit || hit.t > 6000) return null;
      return { x: hit.x, y: hit.y, reach: 15 * hit.t * ((2 * cam.tan) / r.height) };
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

    const box: [number, number, number, number] = [0, 0, 0, 0];
    s.off = onFrame((now) => {
      const a = active;
      if (!a || !a.visible || a.w < 2) return;
      let pose: Pose;
      const still = mqStill.matches;
      // A slow there-and-back between the two ends of the held frame.
      const swing = still ? 0 : smooth01(0.5 - 0.5 * Math.cos(((now - a.t0) / 1000) * ((2 * Math.PI) / 46)));
      const own = ownPoses(a.opts.scene, a.aspect);
      let s0 = 0;
      if (heldPose) pose = heldPose;
      else if (own) {
        const [p, q] = own;
        const mix = (x: number, y: number) => x + (y - x) * swing;
        pose = { pos: [mix(p.pos[0], q.pos[0]), mix(p.pos[1], q.pos[1]), mix(p.pos[2], q.pos[2])], aim: [mix(p.aim[0], q.aim[0]), mix(p.aim[1], q.aim[1]), mix(p.aim[2], q.aim[2])], fov: mix(p.fov, q.fov) };
      } else {
        const stop = stillStops()[STOP[a.opts.scene] ?? 0];
        // The hold runs from the frame's own key to the next one.
        let next = stop + 0.4;
        for (const k of a.keys) {
          if (k.s > stop + 1e-3) {
            next = k.s;
            break;
          }
        }
        s0 = stop;
        pose = poseAt(a.keys, stop + Math.min(0.5, next - stop) * swing);
        pose.roll = 0;
        const lift = a.aspect >= 0.9 ? (LIFT[a.opts.scene] ?? 0) : 0;
        if (lift) {
          // Raising the picture by a share of the frame is a turn of the sight line downward.
          const far = Math.hypot(pose.aim[0] - pose.pos[0], pose.aim[1] - pose.pos[1], pose.aim[2] - pose.pos[2]);
          pose.aim = [pose.aim[0], pose.aim[1], pose.aim[2] - far * 2 * lift * Math.tan((pose.fov * Math.PI) / 360)];
        }
      }
      cam = basisOf(pose);
      // (A scene is not shown until a variant of the pass that carries all of it is ready: until then the still stays.)
      if (!a.drawn && !engine.standsReady(cam, a.aspect, passNeeds(cam, a.aspect, a.opts.scene === 'lake' ? LAKE_ICE : NO_ICE, engine.hasSlab))) return;
      const b = a.boxOn ? a.box : box;
      engine.frame(now, cam, a.aspect, {
        // Only the lake's own frame shows the sheet; from every station it has long gone.
        melt: a.opts.scene === 'lake' ? 0 : 1,
        day: own ? 0 : dayAt(s0),
        settle: 0,
        rest: false,
        calm: 0.6,
        near: 0,
        box: b,
        boxK: a.boxOn && !calmOff ? 1 : 0,
        boxLight: false,
      });
      if (!a.drawn) {
        a.drawn = true;
        a.host.setAttribute('data-band', 'on');
      }
    }, 10);

    s.dispose = () => {
      dead = true;
      s.off();
      window.removeEventListener('themechange', onTheme);
      mqStill.removeEventListener('change', onStill);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      solver.dispose();
      engine.destroy();
      canvas.remove();
    };
    shared = s;
    return s;
  })();
  void starting.finally(() => (starting = null));
  return starting;
}

/** What this module put on the window for the checks and the capture tools, so only that is taken away again. */
let ownWater: unknown = null;

function release() {
  window.clearTimeout(killTimer);
  if (active) return;
  shared?.dispose();
  shared = null;
  pictures.clear();
  // (The home page's flight puts its own handle here: that one is not ours to remove.)
  if (ownWater && window.__water === ownWater) delete window.__water;
  ownWater = null;
  delete window.__band;
}

/** Let the engine go now (the home page is opening and runs its own). */
export function dropBand() {
  release();
}

const pictures = new Map<string, string>();
const boards = new WeakMap<FlightEngine, string>();
function picture(kind: 'slab' | 'face', src: string | undefined, engine: FlightEngine, alive: () => boolean) {
  if (!src || pictures.get(kind) === src) return;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (!alive()) return;
    pictures.set(kind, src);
    if (kind === 'slab') engine.setSlab(img);
    else engine.setFace(img);
  };
  // (The scene has its own cut of each picture, made for the size it is seen at.)
  img.src = scenePicture(src);
}

/**
 * Put the world's canvas in `host` and hold it on this page's scene.
 * Resolves to null where the engine cannot run: the page keeps its still.
 */
export async function attachBand(host: HTMLElement, opts: BandOpts, isCancelled: () => boolean = () => false): Promise<BandHandle | null> {
  window.clearTimeout(killTimer);
  const s = await start(opts, host.clientWidth / Math.max(host.clientHeight, 1) || 1.8);
  if (!s || isCancelled()) {
    if (!active && s) scheduleKill();
    return null;
  }
  window.clearTimeout(killTimer);
  active?.clean();
  const { engine, canvas } = s;

  const a: Active = {
    host,
    opts,
    visible: true,
    drawn: false,
    w: 0,
    h: 0,
    dpr: 0,
    aspect: 1.8,
    keys: [],
    box: [0, 0, 0, 0],
    boxOn: false,
    t0: performance.now(),
    clean: () => {},
  };
  const words = host.parentElement?.querySelector<HTMLElement>('[data-band-words]') ?? null;

  /** Where the words really are: the union of their lines, in the frame (u, v from the foot). */
  const measureBox = () => {
    if (!words || a.w < 2) return;
    const r = host.getBoundingClientRect();
    let x0 = 1e9;
    let y0 = 1e9;
    let x1 = -1e9;
    let y1 = -1e9;
    for (const el of words.querySelectorAll<HTMLElement>('h1, p, a, button, li, .switch')) {
      const q = el.getBoundingClientRect();
      if (q.width < 2 || q.height < 2) continue;
      x0 = Math.min(x0, q.left);
      y0 = Math.min(y0, q.top);
      x1 = Math.max(x1, q.right);
      y1 = Math.max(y1, q.bottom);
    }
    a.boxOn = x1 > x0;
    if (!a.boxOn) return;
    const pad = 14;
    a.box = [(x0 - pad - r.left) / r.width, 1 - (y1 + pad - r.top) / r.height, (x1 + pad - r.left) / r.width, 1 - (y0 - pad - r.top) / r.height];
  };
  const measure = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 2 || h < 2) return;
    const dpr = window.devicePixelRatio || 1;
    // (A window moved to a screen of another density keeps its size and changes its pixels.)
    if (w !== a.w || h !== a.h || dpr !== a.dpr) {
      a.w = w;
      a.h = h;
      a.dpr = dpr;
      a.aspect = w / h;
      engine.resize(w, h, 0, dpr);
      a.keys = flightKeys(a.aspect, engine.sunAz);
    }
    measureBox();
  };

  host.appendChild(canvas);
  measure();
  const again = window.setTimeout(measureBox, 800);
  void document.fonts?.ready.then(() => active === a && measureBox());

  let resizeTimer = 0;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(measure, 100);
  });
  ro.observe(host);
  if (words) ro.observe(words);
  const io = new IntersectionObserver((e) => {
    a.visible = e.some((x) => x.isIntersecting);
    if (!a.visible) engine.pointerLeave();
  });
  io.observe(host);

  // What the stations carry.
  if (opts.cols && opts.cols.length === 4) engine.colH.set(opts.cols);
  const alive = () => shared === s;
  picture('slab', opts.slab, engine, alive);
  // (The pool's results are set as type, for this band's own shape and size.)
  if (opts.sheet) {
    void boardReady().then(() => {
      if (!alive()) return;
      const key = `${a.aspect.toFixed(3)}:${canvas.width}`;
      if (boards.get(engine) === key) return;
      boards.set(engine, key);
      engine.setBoard(boardMask(a.aspect, canvas.width));
    });
  }
  picture('face', opts.face, engine, alive);
  const tribKey = (opts.tribs ?? []).join(',');
  let recarve = 0;
  let carving = false;
  const carveSoon = (wait: number) => {
    window.clearTimeout(recarve);
    const go = async () => {
      if (!alive() || active !== a) return;
      if (carving) {
        recarve = window.setTimeout(go, 200);
        return;
      }
      carving = true;
      await carve(s, a.opts.tribs, () => !alive());
      carving = false;
    };
    recarve = window.setTimeout(go, wait);
  };
  if (tribKey && tribKey !== s.tribKey) {
    s.tribKey = tribKey;
    carveSoon(0);
  }

  // The switch on the cc-switch page: the chosen sluice opens at once, and the bed is carved again behind it.
  const fork = host.parentElement?.querySelector<HTMLElement>('[data-bed^="feat:fork"]') ?? null;
  const onGate = () => {
    const g = Math.min(2, Math.max(0, Number(fork?.dataset.active) || 0));
    if (g === engine.gate) return;
    engine.gate = g;
    carveSoon(700);
  };
  const forkWatch = new MutationObserver(onGate);
  if (fork) forkWatch.observe(fork, { attributes: true, attributeFilter: ['data-active'] });
  // (A page without the switch sees the first sluice open, as the home page first shows it.)
  if (!fork && engine.gate !== 0) {
    engine.gate = 0;
    carveSoon(0);
  } else onGate();

  a.clean = () => {
    window.clearTimeout(again);
    window.clearTimeout(resizeTimer);
    window.clearTimeout(recarve);
    ro.disconnect();
    io.disconnect();
    forkWatch.disconnect();
    host.removeAttribute('data-band');
    if (active === a) active = null;
  };
  active = a;
  ownWater = { engine, rebuild: measure, destroy: () => {} };
  window.__water = ownWater as Window['__water'];
  window.__band = {
    engine,
    state: () => ({ scene: a.opts.scene, aspect: a.aspect, box: a.box, drawn: a.drawn }),
    hold: (p: Pose | null) => {
      heldPose = p;
    },
    calm: (on: boolean) => {
      calmOff = !on;
    },
  };

  return {
    detach() {
      a.clean();
      if (!active) scheduleKill();
    },
  };
}

function scheduleKill() {
  window.clearTimeout(killTimer);
  killTimer = window.setTimeout(release, 4000);
}

declare global {
  interface Window {
    __band?: {
      engine: FlightEngine;
      state(): { scene: SceneId; aspect: number; box: number[]; drawn: boolean };
      /** For the capture tools: hold a pose in place of the scene's own (null hands it back). */
      hold(p: Pose | null): void;
      /** For the stills: switch the words' calm off, or back on. */
      calm(on: boolean): void;
    };
  }
}
