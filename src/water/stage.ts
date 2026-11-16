/**
 * Mounts the water engine on a page: measures the DOM, carves the bed from
 * it, builds the ice name, and feeds the engine scroll and pointer input.
 *
 * DOM registration: rects are read in one batch when the layout can have
 * changed (resize, fonts, images, content height) and cached. Nothing is
 * measured on scroll.
 *
 * Startup is spread out so it never blocks: shaders compile one per task,
 * the bed waits for fonts so it is carved once, and the distance transforms
 * run in a worker.
 */

import { onFrame } from '@/lib/frame';
import { haptic } from '@/lib/haptics';
import { BedPainter, type Rect } from './bed';
import { WaterEngine } from './engine';
import { SCENES, type Anchors } from './scenes';
import { signedDistance } from './sdf';

const TEXT_SELECTOR =
  'h1,h2,h3,h4,h5,h6,p,li,a,span,button,dt,dd,figcaption,blockquote,pre,code,label,time,th,td,summary,strong,em,input,textarea,select,[data-dry]';
/** Text is kept this far from any water, in CSS px. */
export const DRY_PAD = 14;

export interface StageHandle {
  destroy(): void;
  engine: WaterEngine;
  rebuild(): void;
}

function hasOwnText(el: Element): boolean {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim().length) return true;
  }
  return false;
}

function docRect(el: Element, sx: number, sy: number): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
}

/* ---------- distance transforms, in a worker when there is one ---------- */

interface SdJob {
  alpha: Uint8ClampedArray;
  w: number;
  h: number;
  clamp: number;
  scale: number;
}
interface SdResult {
  sd: Float32Array;
  min: number;
}

export function makeSolver() {
  let worker: Worker | null = null;
  let seq = 0;
  const waiting = new Map<number, (r: SdResult) => void>();
  try {
    worker = new Worker(new URL('./sdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; sd: Float32Array; min: number }>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      done?.({ sd: e.data.sd, min: e.data.min });
    };
    worker.onerror = () => {
      // Fall back to the main thread for anything still waiting.
      worker?.terminate();
      worker = null;
      waiting.forEach((done) => done({ sd: new Float32Array(0), min: 0 }));
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  const local = (job: SdJob): SdResult => {
    const sd = signedDistance(job.alpha, job.w, job.h, 4, 0, job.clamp);
    let min = 0;
    for (let i = 0; i < sd.length; i++) {
      sd[i] *= job.scale;
      if (sd[i] < min) min = sd[i];
    }
    return { sd, min };
  };
  return {
    async solve(job: SdJob): Promise<SdResult> {
      if (!worker) return local(job);
      const id = ++seq;
      const res = await new Promise<SdResult>((resolve) => {
        waiting.set(id, resolve);
        worker!.postMessage({ id, alpha: job.alpha, w: job.w, h: job.h, stride: 4, clamp: job.clamp, scale: job.scale });
      });
      return res.sd.length ? res : local(job);
    },
    dispose() {
      worker?.terminate();
      worker = null;
    },
  };
}

export async function mountWater(root: HTMLElement, isCancelled: () => boolean = () => false): Promise<StageHandle | null> {
  const html = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'water-canvas';

  const mqStill = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const themeNow = () => (html.dataset.theme === 'dark' ? 1 : 0);

  // Throws when WebGL2 or float targets are missing: the caller keeps the
  // static design.
  const engine = new WaterEngine(canvas, { theme: themeNow(), still: mqStill.matches, coarse });
  await engine.prepare();
  if (isCancelled()) {
    engine.destroy();
    return null;
  }
  root.appendChild(canvas);
  const solver = makeSolver();

  let viewW = 0;
  let viewH = 0;
  let margin = 0;
  let docH = 0;
  let built = false;
  let destroyed = false;
  let buildToken = 0;
  let pulses: Rect[] = [];
  let pulseAt = 0;
  let pulseIdx = 0;

  // The melt finishing is a real event: the name has become the stream.
  let meltFelt = false;
  engine.onMelt = (done) => {
    if (done && !meltFelt) {
      meltFelt = true;
      haptic('soft');
    }
  };

  function measureView() {
    viewW = html.clientWidth;
    // The large viewport height: the canvas must also cover the area a
    // collapsing mobile URL bar reveals.
    viewH = Math.max(window.innerHeight, html.clientHeight);
    margin = Math.round(viewH * (coarse ? 0.3 : 0.12));
    const cssH = viewH + margin * 2;
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${cssH}px`;
    engine.resize(viewW, cssH, margin, window.devicePixelRatio || 1);
  }

  /** Raster of the name, drawn glyph by glyph where the DOM put it. */
  function rasterIce(sx: number, sy: number) {
    const host = document.querySelector<HTMLElement>('[data-ice]');
    if (!host) return null;
    const lines = Array.from(host.querySelectorAll<HTMLElement>('[data-ice-line]'));
    if (!lines.length) lines.push(host);
    const cs = getComputedStyle(lines[0]);
    const fontSize = parseFloat(cs.fontSize);
    const ls = parseFloat(cs.letterSpacing) || 0;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
    const rects = lines.map((l) => docRect(l, sx, sy));
    const pad = Math.round(fontSize * 0.22);
    const x0 = Math.min(...rects.map((r) => r.x)) - pad;
    const y0 = Math.min(...rects.map((r) => r.y)) - pad;
    const x1 = Math.max(...rects.map((r) => r.x + r.w)) + pad;
    const y1 = Math.max(...rects.map((r) => r.y + r.h)) + pad;
    const w = x1 - x0;
    const h = y1 - y0;
    // About one texel per CSS px at desktop sizes: the field upsamples cleanly.
    const tw = Math.min(1536, Math.max(256, Math.round(w)));
    const scale = w / tw;
    const th = Math.max(16, Math.round(h / scale));
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.setTransform(1 / scale, 0, 0, 1 / scale, -x0 / scale, -y0 / scale);
    ctx.font = font;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => {
      const text = (line.textContent || '').trim();
      const r = rects[i];
      const m = ctx.measureText(text);
      const asc = m.fontBoundingBoxAscent ?? fontSize * 0.8;
      const desc = m.fontBoundingBoxDescent ?? fontSize * 0.2;
      const baseline = r.y + (r.h - (asc + desc)) / 2 + asc;
      // Centre the run in its box, then place glyph by glyph so tracking
      // matches the DOM in every browser.
      const run = m.width + ls * (text.length - 1);
      const start = r.x + (r.w - run) / 2;
      let x = start;
      for (let k = 0; k < text.length; k++) {
        ctx.fillText(text[k], x, baseline);
        x = start + ctx.measureText(text.slice(0, k + 1)).width + ls * (k + 1);
      }
    });
    return { alpha: ctx.getImageData(0, 0, tw, th).data, tw, th, scale, rect: { x: x0, y: y0, w, h } };
  }

  async function build() {
    if (destroyed) return;
    const token = ++buildToken;
    // Measure text where it rests, not where a pending reveal has parked it.
    html.setAttribute('data-measuring', '');
    let painter: BedPainter;
    let ice: ReturnType<typeof rasterIce>;
    let nextPulses: Rect[];
    let nextDocH: number;
    let lake: Rect | null = null;
    try {
      const sx = window.scrollX;
      const sy = window.scrollY;
      const docW = html.clientWidth;
      nextDocH = Math.max(html.scrollHeight, viewH);
      root.style.height = `${nextDocH}px`;

      // As fine as a budget allows: the field must fit the device's
      // largest texture and stay under a cell count that keeps memory and
      // the worker's transform time modest (about 3 million cells on a
      // desktop, 1.2 million on a phone).
      const rows = Math.min(engine.maxTexture, coarse ? 4096 : 8192) - 8;
      const cells = coarse ? 1.2e6 : 3.0e6;
      const div = Math.max(2, nextDocH / rows, Math.sqrt((docW * nextDocH) / cells));
      painter = new BedPainter(docW, nextDocH, div);

      const anchors: Anchors = {
        rect(name) {
          const el = document.querySelector(`[data-bed="${name}"]`);
          return el ? docRect(el, sx, sy) : null;
        },
        all(prefix) {
          return Array.from(document.querySelectorAll<HTMLElement>(`[data-bed^="${prefix}"]`)).map((el) => ({
            name: el.dataset.bed as string,
            rect: docRect(el, sx, sy),
            el,
          }));
        },
        viewW: docW,
        viewH,
        docH: nextDocH,
      };
      const sceneName = document.querySelector<HTMLElement>('[data-scene]')?.dataset.scene;
      const scene = sceneName ? SCENES[sceneName] : undefined;
      if (scene) scene(painter, anchors);

      // Every text block is raised back to dry land.
      const range = document.createRange();
      const seen = document.querySelectorAll<HTMLElement>(TEXT_SELECTOR);
      for (let i = 0; i < seen.length; i++) {
        const el = seen[i];
        if (el.closest('[data-chrome],[data-ice],[data-nodry],.sr-only')) continue;
        if (!el.hasAttribute('data-dry') && !hasOwnText(el) && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) continue;
        const r = docRect(el, sx, sy);
        if (r.w < 2 || r.h < 2) continue;
        // Text can run past its own box (a long unbroken word in a narrow
        // column). Measure the ink, not just the box.
        if (el.scrollWidth > el.clientWidth + 1 && el.firstChild) {
          range.selectNodeContents(el);
          const t = range.getBoundingClientRect();
          const x1 = Math.max(r.x + r.w, t.right + sx);
          const y1 = Math.max(r.y + r.h, t.bottom + sy);
          r.x = Math.min(r.x, t.left + sx);
          r.y = Math.min(r.y, t.top + sy);
          r.w = x1 - r.x;
          r.h = y1 - r.y;
        }
        // A reveal starts a little low and rises: keep that travel dry too.
        const rev = el.closest<HTMLElement>('[data-reveal]');
        if (rev) r.h += rev.dataset.reveal === 'lead' ? 34 : rev.dataset.reveal === 'fade' ? 0 : 18;
        painter.dry(r, DRY_PAD, 10);
      }
      ice = rasterIce(sx, sy);
      lake = anchors.rect('lake');
      nextPulses = Array.from(document.querySelectorAll<HTMLElement>('[data-pulse]')).map((el) => docRect(el, sx, sy));
    } finally {
      html.removeAttribute('data-measuring');
    }

    // The heavy part, off the main thread.
    const r = painter.rasters();
    const [bedSd, iceSd] = await Promise.all([
      solver.solve({ alpha: r.mask, w: painter.w, h: painter.h, clamp: r.clampTexels, scale: painter.div }),
      ice ? solver.solve({ alpha: ice.alpha, w: ice.tw, h: ice.th, clamp: 400, scale: ice.scale }) : Promise.resolve(null),
    ]);
    // A newer build started while this one was in the worker: drop it.
    if (destroyed || token !== buildToken) return;

    docH = nextDocH;
    pulses = nextPulses;
    engine.setBed(painter.assemble(bedSd.sd, r.flow));
    engine.shoalY = painter.shoal ?? 1e9;
    if (ice && iceSd && lake) {
      engine.iceRect = ice.rect;
      engine.lake = { y0: lake.y, y1: lake.y + lake.h };
      engine.meltRange = Math.round(viewH * 0.56);
      const out = painter.outlet;
      engine.meltPath = out ? { x: out.x, y: out.y, reach: viewH * 0.9, w: out.w } : { x: 0, y: 0, reach: 0, w: 0 };
      engine.setIce({ sd: iceSd.sd, w: ice.tw, h: ice.th, minSd: iceSd.min });
    } else {
      engine.lake = { y0: -1e6, y1: -1e6 };
      engine.setIce(null);
    }
    built = true;
    html.dataset.water = 'on';
  }

  let rebuildTimer = 0;
  function scheduleBuild(delay = 120) {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      measureView();
      void build();
    }, delay);
  }

  measureView();
  // Carve once, with the real fonts: they set every text rect and the ice.
  if (document.fonts?.status !== 'loaded') {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  }
  if (isCancelled()) {
    solver.dispose();
    engine.destroy();
    canvas.remove();
    return null;
  }
  await build();
  // If fonts were still arriving when the wait ran out, carve again later.
  document.fonts?.ready.then(() => {
    if (!destroyed && document.fonts.status === 'loaded') scheduleBuild(200);
  });

  const ro = new ResizeObserver(() => {
    if (Math.abs(html.scrollHeight - docH) > 2 || html.clientWidth !== viewW) scheduleBuild();
  });
  ro.observe(document.body);
  const onResize = () => scheduleBuild();
  window.addEventListener('resize', onResize);

  const onTheme = () => engine.setTheme(themeNow());
  window.addEventListener('themechange', onTheme);
  const onStill = () => engine.setStill(mqStill.matches);
  mqStill.addEventListener('change', onStill);

  // Pointer: a moving fine pointer drags a wake; a press makes one splash.
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    engine.pointerMove(e.clientX + window.scrollX, e.clientY + window.scrollY);
  };
  const onDown = (e: PointerEvent) => {
    engine.splash(e.clientX + window.scrollX, e.clientY + window.scrollY, e.pointerType === 'touch' ? 24 : 20, 1.5);
  };
  const onLeave = () => engine.pointerLeave();
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  const off = onFrame((now) => {
    if (!built) return;
    const y = window.scrollY;
    const top = engine.tick(now, y, viewH);
    canvas.style.transform = `translate3d(0,${top}px,0)`;
    // Traffic: marked pools take turns sending a ripple while in view.
    if (pulses.length && now - pulseAt > 1900 && !mqStill.matches) {
      pulseAt = now;
      const r = pulses[pulseIdx++ % pulses.length];
      if (r.y + r.h > y && r.y < y + viewH) engine.splash(r.x + r.w / 2, r.y + r.h / 2, Math.max(12, r.w * 0.12), 0.5);
    }
  }, 10);

  return {
    engine,
    rebuild: () => scheduleBuild(0),
    destroy() {
      destroyed = true;
      off();
      ro.disconnect();
      solver.dispose();
      window.clearTimeout(rebuildTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('themechange', onTheme);
      mqStill.removeEventListener('change', onStill);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      engine.destroy();
      canvas.remove();
      delete html.dataset.water;
    },
  };
}
