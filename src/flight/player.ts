/**
 * The flight, played.
 *
 * The home page's picture is the engine's own, rendered ahead of time
 * (tools/flight) and played here by the reader's scroll: a frame for every
 * thirtieth of a screen, drawn into one canvas behind the words. No shader
 * is built on the reader's machine and nothing of the engine is loaded.
 *
 * What this file does, each frame, from one clock (the page's frame loop):
 *
 *  1. reads the scroll and follows it through one spring (spring.ts): `s`,
 *     the place in the flight that the picture, the words and the captions
 *     all take this frame;
 *  2. sets the words (each block is on for a stretch of scroll, each piece
 *     in from its own position: the same thresholds the engine used), the
 *     rail, and the captions tied to points of the world, projected through
 *     the camera the shown frame was rendered from and through the cut the
 *     window makes of that frame;
 *  3. tells the decoder's worker (decode.worker.ts) which frame it is on,
 *     and draws the frame for that exact place: the two frames either side
 *     of it, the second over the first by how far between them the reader
 *     is. At rest the spring's goal is a whole frame, so a resting picture
 *     is one frame, sharp.
 *
 * Three things in the picture happen by time, not by scroll, as they did
 * live: the first screen's entrance (once, on a load at the top), the
 * ending's light (once, when the camera first comes to rest there), and
 * the sluices' answer to the switch. Each is a track of the same stream
 * (see types.ts).
 *
 * Where there is no decoder for either stream, or the reader has asked for
 * less motion, the page shows a still for each section (made by the same
 * renderer) with the section's words whole, and changes between stills
 * with a fade.
 */

import { onFrame } from '@/lib/frame';
import { haptic } from '@/lib/haptics';
import { emit, flightSignal, pictureSignal, pointerSignal, type SignalCam } from '@/lib/signals';
import { makeCallouts } from '@/water/callouts';
import { type Follow, follow } from './spring';
import { AHEAD, BEHIND, CAM_STRIDE, TALL_BELOW, type Plan, type Shape, type Theme, type Track } from './types';
import { type Warp, makeWarp } from './warp';

const DIR = '/flight';
/** What each shape was rendered at: its width over its height. */
const ASPECT: Record<Shape, number> = { wide: 16 / 9, tall: 780 / 1688 };
/** A jump further than this (screens) is not flown: the picture cuts to where the page now is, under a dissolve. */
const CUT = 2.5;
/** How long one picture takes to give way to another where they are not neighbours (a cut, the theme, the switch), ms. */
const DISSOLVE = 260;
/** From here down the first screen the entrance is let go (screens). */
const ENTER_UNTIL = 0.02;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface TrackInfo {
  id: Track['id'];
  from?: number;
  per?: number;
  fps?: number;
  n: number;
  key: number;
}

export interface PlayerHandle {
  destroy(): void;
  /** For the checks: where the picture is (screens), and one screen of scroll in px. */
  state(): { s: number; unit: number; day: number; pos: number[] };
  /** For the checks that also run against the engine: nothing to hold here. */
  engine: { holdLean(step: number | null): void; info: Record<string, unknown> };
  /** For the checks: whether the picture stands where the page is, on that place's own frame (or its still). */
  settled(): boolean;
  /** For the checks: hold the picture at a place in the flight (screens), between frames too; null hands it back to the scroll. */
  hold(s: number | null): void;
  /** For the measurements: what the player has fetched, decoded and holds. */
  stats(): Record<string, unknown>;
}

export function mountPlayer(root: HTMLElement, plan: Plan): PlayerHandle {
  const html = document.documentElement;
  const mqStill = window.matchMedia('(prefers-reduced-motion: reduce)');
  const themeNow = (): Theme => (html.dataset.theme === 'dark' ? 'night' : 'day');

  let viewW = 1;
  let viewH = 1;
  /** One screen of scroll, in px: what the sections are sized in. */
  let unit = 1;
  let shape: Shape = 'wide';
  let theme: Theme = themeNow();
  let destroyed = false;
  /** Nothing glides: motion is reduced, or no stream can be decoded here. Each section then shows its still. */
  let noDecoder = false;
  const still = () => mqStill.matches || noDecoder;

  /* ---------- the words (the same rules the engine's own page loop keeps: see mountFlight) ---------- */

  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-fl]'));
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
  const early = Array.from(document.querySelectorAll<HTMLElement>('[data-fl-until]')).map((el) => ({ el, until: Number(el.dataset.flUntil), gone: false }));
  const heroWords = document.querySelector<HTMLElement>('.fl-hero-words');
  let heroIn = html.dataset.heroWords !== undefined;
  const railEl = document.querySelector<HTMLElement>('.fl-rail');
  const rail = Array.from(railEl?.querySelectorAll<HTMLAnchorElement>('a') ?? []).map((el) => ({ el, from: Number(el.dataset.from), at: Number(el.dataset.at) }));
  let railNow = -1;
  let railOff: boolean | null = null;
  const callouts = makeCallouts();

  /** Which composed frame a scroll position shows when nothing may glide (stillScroll in camera.ts). */
  const stillAt = (s: number) => {
    let i = 0;
    while (i < plan.starts.length - 1 && s >= plan.starts[i + 1] - 0.5) i++;
    return i;
  };

  /** The line settles to the foot of the frame once the sentence under it has gone: by how far, the stylesheet is told. */
  function measureHero() {
    if (destroyed) return;
    const role = document.querySelector<HTMLElement>('.fl-hero-words .fl-role');
    const intro = document.querySelector<HTMLElement>('.fl-hero-words .fl-intro');
    if (!role || !intro || window.scrollY > 4) return;
    const a = role.getBoundingClientRect();
    const b = intro.getBoundingClientRect();
    if (a.width < 2 || b.width < 2) return;
    heroWords?.style.setProperty('--role-drop', `${Math.max(0, b.bottom - a.bottom).toFixed(1)}px`);
  }

  function setWords(s: number) {
    for (const w of words) {
      const on = s >= w.from && s < w.to;
      if (on !== w.on) {
        w.on = on;
        w.el.toggleAttribute('data-on', on);
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
        const is = w.hero ? heroIn : s >= w.to ? it.in === true : still() ? on : s >= it.at;
        if (is !== it.in) {
          it.in = is;
          it.el.toggleAttribute('data-in', is);
        }
      }
    }
    for (const e of early) {
      const gone = s >= e.until;
      if (gone !== e.gone) {
        e.gone = gone;
        e.el.toggleAttribute('data-gone', gone);
        if (e.el.parentElement === heroWords) heroWords?.toggleAttribute('data-second-gone', gone);
      }
    }
    if (rail.length) {
      let i = 0;
      while (i < rail.length - 1 && s >= rail[i + 1].from) i++;
      if (i !== railNow) {
        rail[railNow]?.el.removeAttribute('aria-current');
        rail[i].el.setAttribute('aria-current', 'true');
        railNow = i;
      }
      const off = s < 0.45 || s > plan.settle - 0.6;
      if (off !== railOff) {
        railOff = off;
        railEl?.toggleAttribute('data-off', off);
      }
    }
  }

  /* ---------- the picture ---------- */

  let canvas = document.createElement('canvas');
  canvas.className = 'flight-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  // The place between two frames is drawn through their cameras (warp.ts). Where that cannot be, whole frames are
  // drawn with a 2D canvas, each standing until the next.
  const warpT0 = performance.now();
  let warp: Warp | null = makeWarp(canvas);
  const warpMs = performance.now() - warpT0;
  let ctx = warp ? null : canvas.getContext('2d', { alpha: false, desynchronized: true });
  /** The warp has failed on this browser (a frame it will not take as a texture): a new canvas, drawn in 2D. */
  function plain() {
    warp?.destroy();
    warp = null;
    const c = document.createElement('canvas');
    c.className = canvas.className;
    c.setAttribute('aria-hidden', 'true');
    c.width = canvas.width;
    c.height = canvas.height;
    c.style.objectPosition = canvas.style.objectPosition;
    canvas.replaceWith(c);
    canvas = c;
    ctx = c.getContext('2d', { alpha: false, desynchronized: true });
    shownKey = '';
  }
  const stillA = document.createElement('div');
  const stillB = document.createElement('div');
  stillA.className = stillB.className = 'fl-still-pic';
  let stillTop = stillA;
  let stillNow = '';

  let worker: Worker | null = null;
  let gen = 0;
  /** The stream now playing: its tracks, and whether it is this theme's and shape's (it may be the one being left). */
  let tracks: TrackInfo[] = [];
  let readyGen = -1;
  const track = (id: string) => (readyGen === gen ? tracks.find((t) => t.id === id) : undefined);
  /** Decoded frames, by the worker's key. */
  const frames = new Map<number, VideoFrame>();
  const orderOf = new Map<string, number>();
  const keyOf = (id: string, i: number) => (orderOf.get(id) ?? 0) * 100000 + i;
  let cams: Record<Shape, Float32Array | null> = { wide: null, tall: null };
  let stillCams: Record<Shape, Float32Array | null> = { wide: null, tall: null };
  const stats = { codec: '', fetched: 0, decoded: 0, decodeMs: 0, held: 0, peakHeld: 0, bytesLog: [] as [number, number][], firstFrameAt: 0, readyAt: 0, drawn: 0, missed: 0 };

  function openStream() {
    if (still()) return;
    gen++;
    // (The stream being left gives its frames back at once: the canvas keeps the picture it has until the new one's first frame is in.)
    for (const f of frames.values()) f.close();
    frames.clear();
    warp?.clear();
    exact = false;
    lastWant = '';
    if (!worker) {
      try {
        worker = new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        return fallBack();
      }
      worker.onmessage = onWorker;
      worker.onerror = () => fallBack();
    }
    // (`__flightCodec`: the checks ask for one stream, or for none, to see each path a browser can take.)
    worker.postMessage({ type: 'open', base: `${DIR}/${shape}-${theme}`, gen, only: (window as unknown as { __flightCodec?: string }).__flightCodec });
    void loadCam(shape);
  }
  async function loadCam(sh: Shape) {
    if (cams[sh]) return;
    try {
      const [a, b] = await Promise.all([fetch(`${DIR}/${sh}.cam`), fetch(`${DIR}/${sh}.still.cam`)]);
      if (a.ok) cams = { ...cams, [sh]: new Float32Array(await a.arrayBuffer()) };
      if (b.ok) stillCams = { ...stillCams, [sh]: new Float32Array(await b.arrayBuffer()) };
    } catch {
      // (Without it the captions tied to points stay out: the words are whole all the same.)
    }
  }
  function fallBack() {
    if (noDecoder || destroyed) return;
    noDecoder = true;
    worker?.terminate();
    worker = null;
    for (const f of frames.values()) f.close();
    frames.clear();
    root.dataset.stills = '';
    void loadCam(shape);
  }
  function onWorker(e: MessageEvent) {
    const m = e.data;
    if (m.type === 'frame') {
      const f = m.frame as VideoFrame;
      if (m.gen !== gen || destroyed) return f.close();
      frames.get(m.key)?.close();
      frames.set(m.key, f);
      stats.peakHeld = Math.max(stats.peakHeld, frames.size);
      return;
    }
    if (m.gen !== gen) return;
    if (m.type === 'ready') {
      tracks = m.tracks;
      readyGen = gen;
      orderOf.clear();
      tracks.forEach((t, i) => orderOf.set(t.id, i));
      stats.codec = m.codec;
      stats.readyAt = stats.readyAt || performance.now();
      if (canvas.width !== m.w || canvas.height !== m.h) {
        canvas.width = m.w;
        canvas.height = m.h;
        shownKey = '';
      }
    } else if (m.type === 'none') fallBack();
    else if (m.type === 'bytes') {
      stats.fetched = m.fetched;
      stats.bytesLog.push([Math.round(m.at), m.fetched]);
    } else if (m.type === 'stats') {
      stats.decoded = m.decoded;
      stats.decodeMs = m.decodeMs;
      stats.held = m.held;
    }
  }

  /** Give back every frame outside the window round `i` of track `id` (the worker's own window, and one frame of room). */
  function prune(id: string, i: number, dir: number) {
    const o = orderOf.get(id) ?? 0;
    const lo = i - (dir < 0 ? AHEAD : BEHIND) - 1;
    const hi = i + (dir < 0 ? BEHIND : AHEAD) + 1;
    const gone: number[] = [];
    for (const [key, f] of frames) {
      const at = key % 100000;
      if (Math.floor(key / 100000) === o && at >= lo && at <= hi) continue;
      f.close();
      frames.delete(key);
      gone.push(key);
    }
    if (gone.length) worker?.postMessage({ type: 'release', keys: gone });
  }

  /** One picture gives way to another that is not its neighbour: the one on the canvas is copied over it and fades out. */
  let veil: HTMLCanvasElement | null = null;
  function dissolve() {
    if (!canvas.width || root.dataset.picture === undefined) return;
    veil?.remove();
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    c.className = 'flight-canvas flight-veil';
    c.setAttribute('aria-hidden', 'true');
    c.getContext('2d')?.drawImage(canvas, 0, 0);
    c.style.objectPosition = canvas.style.objectPosition;
    canvas.after(c);
    veil = c;
    // (Two frames on: the copy has been shown once at full strength before it starts to go.)
    requestAnimationFrame(() => requestAnimationFrame(() => (c.style.opacity = '0')));
    window.setTimeout(() => {
      c.remove();
      if (veil === c) veil = null;
    }, DISSOLVE + 120);
  }

  let shownKey = '';
  let lastWant = '';
  let lastTrack = '';
  let lastFrame = 0;
  let dissolveNext = false;
  /**
   * Draw track `id` at frame position `f` (a fraction lies between two frames). Returns whether the picture now on
   * the canvas is that place's own.
   */
  function show(id: string, f: number): boolean {
    const t = track(id);
    if (!t || (!ctx && !warp)) return false;
    f = Math.min(t.n - 1, Math.max(0, f));
    const a = Math.floor(f);
    const w = f - a;
    const want = Math.round(f);
    const dir = id === lastTrack && want < lastFrame ? -1 : id === lastTrack && want === lastFrame ? lastDir : 1;
    const wantKey = `${id}:${want}:${dir}`;
    if (wantKey !== lastWant) {
      lastWant = wantKey;
      lastDir = dir;
      // (What will be wanted next by time is asked for ahead: the dawn as the ending nears.)
      const soon: string[] = [];
      if (id === 'main' && !dawned && t.per && want / t.per > plan.settle - 3) soon.push('dawn');
      worker?.postMessage({ type: 'want', gen, track: id, frame: want, dir, soon });
      prune(id, want, dir);
    }
    lastTrack = id;
    lastFrame = want;
    const fa = frames.get(keyOf(id, a));
    const fb = w > 0.004 ? frames.get(keyOf(id, a + 1)) : undefined;
    let key: string;
    let one: VideoFrame | undefined;
    let two: VideoFrame | undefined;
    let oneAt = a;
    let mix = 0;
    // (Without the warp a frame by scroll stands until the next: two laid over each other are a double image.)
    const blends = !!warp || t.per === undefined;
    if (fa && (fb || w <= 0.004) && blends) {
      one = fa;
      two = fb;
      mix = fb ? w : 0;
      key = `${gen}:${id}:${a}:${mix.toFixed(3)}`;
    } else if (!blends && frames.has(keyOf(id, want))) {
      one = frames.get(keyOf(id, want));
      oneAt = want;
      key = `${gen}:${id}:${want}:0`;
    } else {
      // Not here yet: the nearest frame of this track that is.
      let best = -1;
      let dist = 1e9;
      const o = orderOf.get(id) ?? 0;
      for (const k of frames.keys()) {
        if (Math.floor(k / 100000) !== o) continue;
        const d = Math.abs((k % 100000) - f);
        if (d < dist) {
          dist = d;
          best = k;
        }
      }
      if (best < 0) return false;
      one = frames.get(best);
      oneAt = best % 100000;
      key = `${gen}:${id}:${oneAt}:near`;
      stats.missed++;
    }
    if (!one) return false;
    if (key === shownKey) return true;
    if (dissolveNext) {
      dissolve();
      dissolveNext = false;
    }
    if (warp) {
      // By scroll, with the cameras here: the two frames are brought to the camera that stands between them.
      const src = cams[shape];
      const i0 = t.per !== undefined ? Math.round((t.from ?? 0) * t.per) + a : -1;
      const withCams = two && mix > 0 && src && i0 >= 0 && (i0 + 2) * CAM_STRIDE <= src.length;
      let c = null;
      if (withCams) {
        const ca = src.subarray(i0 * CAM_STRIDE, (i0 + 1) * CAM_STRIDE);
        const cb = src.subarray((i0 + 1) * CAM_STRIDE, (i0 + 2) * CAM_STRIDE);
        for (let k = 0; k < CAM_STRIDE; k++) between[k] = ca[k] * (1 - mix) + cb[k] * mix;
        c = { a: ca, b: cb, at: between, aspect: ASPECT[shape] };
      }
      try {
        warp.draw({ key: keyOf(id, oneAt), frame: one }, two ? { key: keyOf(id, a + 1), frame: two } : null, mix, c);
      } catch {
        plain();
        return false;
      }
    } else if (ctx) {
      ctx.globalAlpha = 1;
      ctx.drawImage(one, 0, 0, canvas.width, canvas.height);
      if (two && mix > 0) {
        ctx.globalAlpha = mix;
        ctx.drawImage(two, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    }
    shownKey = key;
    stats.drawn++;
    if (root.dataset.picture === undefined) {
      root.dataset.picture = '';
      stats.firstFrameAt = performance.now();
    }
    return !key.endsWith('near');
  }
  let lastDir = 1;
  const between = new Float32Array(CAM_STRIDE);

  /** The still for a section, in the layer that is not now showing; then the two change places with a fade. */
  function showStill(n: number) {
    const url = `${DIR}/${shape}-${theme}.still-${n}.avif`;
    if (url === stillNow) return;
    stillNow = url;
    const next = stillTop === stillA ? stillB : stillA;
    const img = new Image();
    const swap = () => {
      if (stillNow !== url || destroyed) return;
      next.style.backgroundImage = `url(${url})`;
      next.dataset.on = '';
      delete stillTop.dataset.on;
      stillTop = next;
      root.dataset.picture = '';
    };
    img.onload = swap;
    // (A browser that cannot show the still keeps the one it has: the page's own ground at the worst.)
    img.onerror = () => {};
    img.src = url;
    // The stills either side are asked for ahead.
    for (const k of [n + 1, n - 1]) if (k >= 0 && k < plan.stops.length) new Image().src = `${DIR}/${shape}-${theme}.still-${k}.avif`;
  }

  /* ---------- the window ---------- */

  /**
   * Where the rendered frame lies over the window: it covers it, cut at the sides or at the head and foot, never
   * stretched. Which part is cut follows the flight. On the first screen the frame is held by its middle from side
   * to side (the name stands in the middle of it) and a little below its middle from head to foot (the first words
   * stand on the near snow at the frame's foot). From the first block of words on it is held toward its left edge
   * and its foot, where every block stands (flight.css), because the picture was rendered with a calm lee exactly
   * there: cut evenly, a window of another shape would have its words beside their lee. Not hard against that
   * corner: the lee falls away over a wide margin, and the subject, right of the words or over them, keeps more of
   * the frame. The frame moves from the one hold to the other as the camera comes down off the lake.
   */
  let fit: [number, number, number, number] = [1, 1, 0, 0];
  let cover: [number, number] = [1, 1];
  let heldAt = '';
  const HOLD_FROM = 1.25;
  const HOLD_TO = 1.9;
  /** Where the cut frame is held, as CSS says it (0: by its left or its head, 1: by its right or its foot). */
  const HOLD_HERO_Y = 0.7;
  const HOLD_X = 0.15;
  const HOLD_Y = 0.85;
  function hold(s: number) {
    const k = smooth(HOLD_FROM, HOLD_TO, s);
    const ax = 0.5 + (HOLD_X - 0.5) * k;
    const ay = HOLD_HERO_Y + (HOLD_Y - HOLD_HERO_Y) * k;
    fit[0] = cover[0];
    fit[1] = cover[1];
    fit[2] = (1 - cover[0]) * ax;
    fit[3] = (1 - cover[1]) * ay;
    const at = `${(ax * 100).toFixed(2)}% ${(ay * 100).toFixed(2)}%`;
    if (at === heldAt) return;
    heldAt = at;
    canvas.style.objectPosition = at;
    if (veil) veil.style.objectPosition = at;
    stillA.style.backgroundPosition = stillB.style.backgroundPosition = at;
  }
  function measureView() {
    viewW = html.clientWidth;
    viewH = Math.max(window.innerHeight, html.clientHeight);
    const first = sections[0];
    unit = first ? first.offsetHeight / (plan.hero + 1) : viewH;
    const aspect = viewW / viewH;
    const sh: Shape = aspect < TALL_BELOW ? 'tall' : 'wide';
    cover = [Math.max(1, (ASPECT[sh] * viewH) / viewW), Math.max(1, viewW / ASPECT[sh] / viewH)];
    heldAt = '';
    lastPlaced = '';
    callouts.measure();
    measureHero();
    if (sh !== shape) {
      shape = sh;
      stillNow = '';
      if (started) openStream();
    }
  }
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(measureView, 120);
  };
  const onTheme = () => {
    const t = themeNow();
    if (t === theme) return;
    theme = t;
    stillNow = '';
    dissolveNext = true;
    if (started) openStream();
  };
  const onStill = () => {
    if (mqStill.matches) {
      for (const f of frames.values()) f.close();
      frames.clear();
      root.dataset.stills = '';
      void loadCam(shape);
    } else if (!noDecoder) {
      delete root.dataset.stills;
      pos.x = window.scrollY / unit;
      pos.v = 0;
      openStream();
    }
  };

  /* ---------- what follows the picture: the rail's ticks, the switch, the sound's signals ---------- */

  const onRail = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a');
    const hit = a && rail.find((r) => r.el === a);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    window.scrollTo(0, Math.round(hit.at * unit));
  };
  railEl?.addEventListener('click', onRail);

  const fork = document.querySelector<HTMLElement>('.fl-fork');
  let gate = 0;
  const gateNow = [1, 0, 0];
  const surge = [0, 0, 0];
  const onGate = () => {
    const g = Math.min(2, Math.max(0, Number(fork?.dataset.active) || 0));
    if (g === gate) return;
    gate = g;
    // (The picture with that gate open is another track of the stream: it comes in under a dissolve, where live the gate rose.)
    dissolveNext = true;
  };
  const forkWatch = new MutationObserver(onGate);
  if (fork) forkWatch.observe(fork, { attributes: true, attributeFilter: ['data-active'] });

  const cam: SignalCam = { pos: [0, 0, 0], f: [0, 1, 0], r: [1, 0, 0], u: [0, 0, 1], tan: 0.4 };
  let camOk = false;
  /** The camera at a place in `main` (between two frames, the mean of theirs), or a still's own. */
  function camAt(s: number, per: number) {
    const stillN = still() ? stillAt(s) : -1;
    const src = stillN >= 0 ? stillCams[shape] : cams[shape];
    camOk = !!src;
    if (!src) return;
    const n = src.length / CAM_STRIDE;
    const f = stillN >= 0 ? stillN : Math.min(n - 1, Math.max(0, s * per));
    const a = Math.min(n - 1, Math.floor(f));
    const b = Math.min(n - 1, a + 1);
    const w = f - a;
    const at = (k: number) => src[a * CAM_STRIDE + k] * (1 - w) + src[b * CAM_STRIDE + k] * w;
    for (let k = 0; k < 3; k++) {
      cam.pos[k] = at(k);
      cam.f[k] = at(3 + k);
      cam.r[k] = at(6 + k);
      cam.u[k] = at(9 + k);
    }
    cam.tan = at(12);
  }
  const dayAt = (s: number) => {
    const f = Math.min(plan.day.length - 1, Math.max(0, s * 4));
    const a = Math.floor(f);
    const b = Math.min(plan.day.length - 1, a + 1);
    return plan.day[a] + (plan.day[b] - plan.day[a]) * (f - a);
  };
  const near = [0, 0, 0, 0];
  let melted = false;
  let meltFelt = false;
  /** Where the pointer's ray meets the water's plane, as the sound wants it: how far off that is (0: not over water). */
  const reachAt = (x: number, y: number) => {
    if (!camOk) return 0;
    const u = (x / viewW - fit[2]) / fit[0];
    const v = (y / viewH - fit[3]) / fit[1];
    const nx = (u * 2 - 1) * ASPECT[shape] * cam.tan;
    const ny = (1 - v * 2) * cam.tan;
    const dz = cam.f[2] + cam.r[2] * nx + cam.u[2] * ny;
    if (dz >= -1e-4) return 0;
    const t = -cam.pos[2] / dz;
    return t > 6000 ? 0 : 15 * t * ((2 * cam.tan) / viewH);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') pointerSignal(e.clientX / viewW, e.clientY / viewH, reachAt(e.clientX, e.clientY));
  };
  const onDown = (e: PointerEvent) => emit('press', e.clientX / viewW, e.clientY / viewH, reachAt(e.clientX, e.clientY));
  const onLeave = () => pointerSignal(0.5, 0.5, 0);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  /* ---------- the frame ---------- */

  const pos: Follow = { x: window.scrollY / Math.max(1, window.innerHeight), v: 0 };
  let last = 0;
  let started = false;
  /** The entrance: 'wait' until the picture is up, then it runs by the clock once; a page opened part way down has none. */
  let enter: 'wait' | 'run' | 'over' = 'over';
  let enterT0 = 0;
  /** The ending's light: it runs once, when the camera first rests there; then it has risen for the rest of the visit. */
  let dawned = false;
  let dawnT0 = -1;
  let dawnHeld = false;
  let visible = true;
  let held: number | null = null;
  let lastPlaced = '';
  let maxShowMs = 0;
  let atGoal = false;
  let exact = false;
  const visibility = new IntersectionObserver(
    (entries) => {
      visible = entries[entries.length - 1].isIntersecting;
    },
    { threshold: 0 },
  );

  const off = onFrame((now) => {
    if (destroyed) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    const raw = Math.min(plan.end, Math.max(0, window.scrollY / unit));
    const main = track('main');
    const per = main?.per ?? 30;
    let s: number;
    if (still()) {
      s = plan.stops[stillAt(raw)];
      pos.x = raw;
      pos.v = 0;
    } else if (held !== null) {
      s = pos.x = held;
      pos.v = 0;
    } else {
      // The spring's goal is a whole frame, so the picture comes to rest on one frame and is sharp there.
      const goal = Math.round(raw * per) / per;
      if (Math.abs(goal - pos.x) > CUT) {
        pos.x = goal;
        pos.v = 0;
        dissolveNext = true;
      } else follow(pos, goal, dt);
      if (Math.abs(pos.x - goal) < 2e-4 && Math.abs(pos.v) < 2e-3) {
        pos.x = goal;
        pos.v = 0;
      }
      s = pos.x;
    }
    setWords(s);
    hold(s);
    atGoal = still() || held !== null || Math.abs(s - Math.round(raw * per) / per) < 1e-6;
    exact = false;

    // The picture.
    let dawnT = dawned ? plan.dawn.over : 0;
    if (!visible) {
      // (Off the screen nothing is drawn or asked for.)
    } else if (still()) {
      showStill(stillAt(raw));
      exact = stillTop.style.backgroundImage.includes(stillNow) && stillNow !== '';
    }
    else if (main) {
      let id: Track['id'] = 'main';
      let f = s * per;
      const rest = s >= plan.settle - 0.02;
      const enterTrack = track('enter');
      const dawnTrack = track('dawn');
      const after = track('after');
      if (enter !== 'over' && enterTrack && s <= ENTER_UNTIL) {
        const t = enter === 'run' ? (now - enterT0) / 1000 : 0;
        id = 'enter';
        f = Math.min(enterTrack.n - 1, t * (enterTrack.fps ?? 30));
        if (t * (enterTrack.fps ?? 30) >= enterTrack.n - 1) enter = 'over';
      } else {
        if (enter !== 'over') {
          // (Scrolled away while it ran: the flight's own frame comes in under a dissolve.)
          enter = 'over';
          dissolveNext = true;
        }
        if (rest && dawnTrack && (!dawned || dawnHeld || dawnT0 >= 0)) {
          if (!dawned) {
            dawned = true;
            dawnHeld = true;
            dawnT0 = now;
            haptic('light');
            emit('dawn');
          }
          dawnT = dawnT0 >= 0 ? (now - dawnT0) / 1000 : plan.dawn.over;
          id = 'dawn';
          f = Math.min(dawnTrack.n - 1, dawnT * (dawnTrack.fps ?? 30));
        } else {
          if (dawnHeld) {
            // (Left the ending: the light has risen from here on, and the flight's own frames with it risen come in under a dissolve.)
            dawnHeld = false;
            dawnT0 = -1;
            dissolveNext = true;
          }
          const g = gate ? track(`gate${gate}`) : undefined;
          const covers = (t: TrackInfo | undefined) => !!t && t.per !== undefined && s >= (t.from ?? 0) && s <= (t.from ?? 0) + (t.n - 1) / t.per;
          if (dawned && covers(after)) {
            id = 'after';
            f = (s - (after!.from ?? 0)) * after!.per!;
          } else if (covers(g)) {
            id = g!.id;
            f = (s - (g!.from ?? 0)) * g!.per!;
          }
        }
      }
      const t0 = performance.now();
      const ok = show(id, f);
      maxShowMs = Math.max(maxShowMs, performance.now() - t0);
      // (By time, the picture is at rest once its clip has run out.)
      exact = ok && (id === 'enter' ? false : id !== 'dawn' || dawnT >= plan.dawn.over);
      if (enter === 'wait' && ok && root.dataset.picture !== undefined) {
        enter = 'run';
        // (The entrance begins once the picture has come up over its still.)
        enterT0 = now + 440;
      }
    }

    // The captions tied to points of the world, and what the sound follows.
    camAt(s, per);
    if (camOk) {
      // (At rest nothing is written: the captions stand where the last frame put them.)
      const placed = `${s}|${heldAt}|${viewW}|${viewH}|${shape}`;
      if (placed !== lastPlaced) {
        lastPlaced = placed;
        callouts.frame(cam, ASPECT[shape], viewW, viewH, s, fit);
      }
      const melt = (s - plan.melt[0]) / (plan.melt[1] - plan.melt[0]);
      const rest = s >= plan.settle - 0.02;
      flightSignal(now, s, cam, ASPECT[shape], melt, dayAt(s), rest);
      for (const [lane, x, y, from, to] of plan.near) near[lane] = 1 - smooth(from, to, Math.hypot(cam.pos[0] - x, cam.pos[1] - y));
      for (let i = 0; i < 3; i++) {
        const on = i === gate;
        gateNow[i] = Math.min(1, Math.max(0, gateNow[i] + (on ? dt / plan.gate.up : -dt / plan.gate.down)));
        surge[i] = on ? Math.min(1, surge[i] + dt / plan.gate.surge) : 0;
      }
      const d = plan.dawn;
      pictureSignal(now / 1000, near, gateNow, surge, smooth(d.ray[0], d.ray[1], dawnT), smooth(d.lift[0], d.lift[1], dawnT), smooth(d.rise[0], d.rise[1], dawnT));
      if (melt >= 1 && !melted) {
        melted = true;
        emit('melt', 1);
        if (!meltFelt) {
          meltFelt = true;
          haptic('soft');
        }
      } else if (melt < 0.9 && melted) {
        melted = false;
        emit('melt', 0);
      }
    }
  }, 10);

  /* ---------- start ---------- */

  root.append(stillA, stillB, canvas);
  visibility.observe(root);
  measureView();
  shape = viewW / viewH < TALL_BELOW ? 'tall' : 'wide';
  pos.x = Math.min(plan.end, Math.max(0, window.scrollY / unit));
  // (A load at the top of the page opens with the entrance; anywhere else the flight is simply there.)
  enter = pos.x <= ENTER_UNTIL && !mqStill.matches ? 'wait' : 'over';
  html.dataset.flight = 'on';
  started = true;
  // (The stream is opened in a task of its own: the page's words are set and the frame loop is running before the
  // canvas and the decoder are made, and neither piece of work is long.)
  const opening = window.setTimeout(() => {
    if (destroyed) return;
    if (mqStill.matches) {
      root.dataset.stills = '';
      void loadCam(shape);
    } else openStream();
  }, 0);
  const heroTimers = [0, 450, 1300].map((ms) => window.setTimeout(measureHero, ms));
  const ro = new ResizeObserver(onResize);
  ro.observe(document.body);
  window.addEventListener('resize', onResize);
  window.addEventListener('themechange', onTheme);
  mqStill.addEventListener('change', onStill);

  return {
    state: () => ({ s: still() ? plan.stops[stillAt(pos.x)] : pos.x, unit, day: dayAt(pos.x), pos: [...cam.pos] }),
    engine: { holdLean() {}, info: { player: true } },
    settled() {
      // (Asked between two frames, after a scroll made by script: the place the page is at now, not the last frame's.)
      const raw = Math.min(plan.end, Math.max(0, window.scrollY / unit));
      const per = track('main')?.per ?? 30;
      const here = still() || held !== null || Math.abs(pos.x - Math.round(raw * per) / per) < 1e-6;
      return here && atGoal && exact && !veil;
    },
    hold(s) {
      held = s;
    },
    stats: () => ({ ...stats, warpMs, maxShowMs, draws: warp ? 'warp' : '2d', frames: frames.size, shape, theme, stills: still(), meanDecodeMs: stats.decoded ? stats.decodeMs / stats.decoded : 0, w: canvas.width, h: canvas.height }),
    destroy() {
      destroyed = true;
      off();
      ro.disconnect();
      forkWatch.disconnect();
      visibility.disconnect();
      railEl?.removeEventListener('click', onRail);
      heroTimers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(opening);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('themechange', onTheme);
      mqStill.removeEventListener('change', onStill);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      worker?.postMessage({ type: 'close' });
      worker?.terminate();
      for (const f of frames.values()) f.close();
      frames.clear();
      veil?.remove();
      warp?.destroy();
      canvas.remove();
      stillA.remove();
      stillB.remove();
      delete html.dataset.flight;
      delete root.dataset.picture;
      delete root.dataset.stills;
    },
  };
}
