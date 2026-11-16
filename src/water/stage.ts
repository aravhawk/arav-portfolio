/**
 * Mounts the water engine on a page: measures the DOM, carves the bed from
 * it, builds the ice name, and feeds the engine scroll and pointer input.
 *
 * DOM registration (R1): rects are read in one batch when the layout can have
 * changed (resize, fonts, images, content height) and cached. Nothing is
 * measured on scroll.
 */

import { onFrame } from '@/lib/frame';
import { haptic } from '@/lib/haptics';
import { BedPainter, type Rect } from './bed';
import { WaterEngine, type IceInput } from './engine';
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

export function mountWater(root: HTMLElement): StageHandle {
  const html = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'water-canvas';
  root.appendChild(canvas);

  const mqStill = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const themeNow = () => (html.dataset.theme === 'dark' ? 1 : 0);

  const engine = new WaterEngine(canvas, { theme: themeNow(), still: mqStill.matches, coarse });

  let viewW = 0;
  let viewH = 0;
  let margin = 0;
  let docH = 0;
  let built = false;
  let destroyed = false;
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

  function buildIce(sx: number, sy: number) {
    const host = document.querySelector<HTMLElement>('[data-ice]');
    if (!host) {
      engine.setIce(null);
      return;
    }
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
    if ('fontVariationSettings' in canvas.style && cs.fontVariationSettings && cs.fontVariationSettings !== 'normal') {
      (ctx.canvas.style as CSSStyleDeclaration).fontVariationSettings = cs.fontVariationSettings;
    }
    lines.forEach((line, i) => {
      const text = (line.textContent || '').trim();
      const r = rects[i];
      const m = ctx.measureText(text);
      const asc = m.fontBoundingBoxAscent ?? fontSize * 0.8;
      const desc = m.fontBoundingBoxDescent ?? fontSize * 0.2;
      const baseline = r.y + (r.h - (asc + desc)) / 2 + asc;
      // Place glyph by glyph so tracking matches the DOM in every browser.
      let x = r.x;
      for (let k = 0; k < text.length; k++) {
        ctx.fillText(text[k], x, baseline);
        const adv = ctx.measureText(text.slice(0, k + 1)).width;
        x = r.x + adv + ls * (k + 1);
      }
    });
    const data = ctx.getImageData(0, 0, tw, th).data;
    const sd = signedDistance(data, tw, th, 4, 0, 48);
    let minSd = 0;
    for (let i = 0; i < sd.length; i++) {
      sd[i] *= scale;
      if (sd[i] < minSd) minSd = sd[i];
    }
    const ice: IceInput = { sd, w: tw, h: th, minSd };
    engine.iceRect = { x: x0, y: y0, w, h };
    engine.meltRange = Math.round(viewH * 0.82);
    engine.setIce(ice);
  }

  function build() {
    if (destroyed) return;
    const sx = window.scrollX;
    const sy = window.scrollY;
    const docW = html.clientWidth;
    docH = Math.max(html.scrollHeight, viewH);
    root.style.height = `${docH}px`;

    // One CSS px per 4 texels is plenty for a distance field; very long
    // pages coarsen so the texture stays within every device's limit.
    let div = 4;
    while (docH / div > 3800) div += 1;
    const painter = new BedPainter(docW, docH, div);

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
      docH,
    };
    const sceneName = document.querySelector<HTMLElement>('[data-scene]')?.dataset.scene;
    const scene = sceneName ? SCENES[sceneName] : undefined;
    if (scene) scene(painter, anchors);

    // Every text block is raised back to dry land.
    const seen = document.querySelectorAll<HTMLElement>(TEXT_SELECTOR);
    for (let i = 0; i < seen.length; i++) {
      const el = seen[i];
      if (el.closest('[data-chrome],[data-ice],[data-nodry],.sr-only')) continue;
      if (!el.hasAttribute('data-dry') && !hasOwnText(el) && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) continue;
      const r = docRect(el, sx, sy);
      if (r.w < 2 || r.h < 2) continue;
      painter.dry(r, DRY_PAD, 10);
    }

    engine.setBed(painter.finish());
    buildIce(sx, sy);
    pulses = Array.from(document.querySelectorAll<HTMLElement>('[data-pulse]')).map((el) => docRect(el, sx, sy));
    built = true;
    html.dataset.water = 'on';
  }

  let rebuildTimer = 0;
  function scheduleBuild(delay = 120) {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      measureView();
      build();
    }, delay);
  }

  measureView();
  build();
  // Fonts change every text rect and the ice outline.
  document.fonts?.ready.then(() => scheduleBuild(0));

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
    engine.splash(e.clientX + window.scrollX, e.clientY + window.scrollY, e.pointerType === 'touch' ? 22 : 16, 0.55);
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
