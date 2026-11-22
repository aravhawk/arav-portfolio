#!/usr/bin/env node
/**
 * Titles test for the home page (the flight): each station's name or figure
 * stands wholly on one calm surface.
 *
 * The legibility test says a title can be read. It does not say the title
 * is well placed: a name whose last letter runs off the snow onto a pool's
 * rim passes for contrast and still looks wrong. So at each station's
 * composed frame (the middle of the stretch in which its block of words
 * stands composed: `data-fl-in` to `data-fl-out`, in screens) this hides the
 * words, photographs the picture behind each title, and measures how far
 * apart the lightest and darkest of it are, as a contrast ratio (the 2nd and
 * 98th percentiles of linear luminance, so a glint or a crack does not
 * count; a ratio, so the same rule holds by day and before dawn). A title
 * over one surface measures near 1; a title that crosses an edge measures 2
 * or more.
 *
 * A station's frame is not held: the camera makes one slow move through the
 * whole of the stretch in which the block stands composed (from the moment
 * its title is in, `data-fl-in`, to the moment it leaves, `data-fl-out`).
 * So each title is measured three times, near the start, at the middle and
 * near the end of that stretch (0.1, 0.47 and 0.9 of it): the surface under
 * it must hold through the move.
 *
 * Playwright is not a dependency of this repo. Point NODE_PATH at an install
 * that has it:
 *
 *   NODE_PATH=.tools/node_modules node scripts/titles-test.mjs --base http://localhost:3140
 *
 * Options: --widths 1440,390  --themes light,dark  --max 1.5 (the largest
 *          ratio allowed)  --settle 2600 (ms at each stop)  --out report.json
 *          --points 0.1,0.47,0.9 (where in each composed stretch to measure)
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { runsFlight, setTheme } from './lib/legibility.mjs';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  console.error('playwright not found. Set NODE_PATH to a node_modules folder that contains it.');
  process.exit(2);
}

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3140');
const widths = String(arg('widths', '1440,390')).split(',').map(Number);
const themes = String(arg('themes', 'light,dark')).split(',');
const MAX = Number(arg('max', 1.5));
const settle = Number(arg('settle', 2600));
const out = arg('out', '');
const HEIGHT = { 320: 640, 390: 844, 768: 1024, 1024: 768, 1440: 900, 1920: 1080, 2560: 1440 };
const HIDE = '.fl-words,.fl-call,.nav,.skip,.fl-rail{visibility:hidden!important}nextjs-portal{display:none!important}';

/** Where in its composed stretch each block is measured: near its start, at its middle, near its end. */
const POINTS = String(arg('points', '0.1,0.47,0.9')).split(',').map(Number);

/** Runs in the page: every composed block's stops, in screens, in page order. */
function stops(points) {
  return Array.from(document.querySelectorAll('.fl-words[data-fl-in]')).flatMap((el) => {
    const a = Number(el.dataset.flIn);
    const b = Number(el.dataset.flOut);
    return points.map((p) => ({ stop: a + (b - a) * p, at: p }));
  });
}

/** Runs in the page: the titles now showing (a station's name or its figure), each line's ink box. */
function titles() {
  const res = [];
  const range = document.createRange();
  for (const host of document.querySelectorAll('.fl-words[data-on]')) {
    for (const el of host.querySelectorAll('.display, .number, .fl-fig')) {
      let op = 1;
      for (let e = el; e && e !== document.body; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      if (op < 0.99) continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let x0 = 1e9;
      let y0 = 1e9;
      let x1 = -1e9;
      let y1 = -1e9;
      let text = '';
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.nodeValue || !node.nodeValue.trim()) continue;
        text += node.nodeValue.trim();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width < 1 || r.height < 1) continue;
          // (Display type is set at a line height under 1: its ink keeps to the middle of its glyph box.)
          const trim = r.height * 0.14;
          x0 = Math.min(x0, r.left);
          y0 = Math.min(y0, r.top + trim);
          x1 = Math.max(x1, r.right);
          y1 = Math.max(y1, r.bottom - trim);
        }
      }
      // (The arrow beside a name is part of the title.)
      const arrow = el.querySelector('svg, .arrow');
      if (arrow) x1 = Math.max(x1, arrow.getBoundingClientRect().right);
      if (x1 > x0 && y1 > y0 && y1 > 0 && y0 < innerHeight) res.push({ text: text.slice(0, 32), x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return res;
}

/** Runs in the page: the spread of the picture's luminance behind each box. */
async function spread({ b64, boxes }) {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const k = img.naturalWidth / innerWidth;
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return boxes.map((b) => {
    const x = Math.max(0, Math.floor(b.x * k));
    const y = Math.max(0, Math.floor(b.y * k));
    const w = Math.max(1, Math.min(c.width - x, Math.ceil(b.w * k)));
    const h = Math.max(1, Math.min(c.height - y, Math.ceil(b.h * k)));
    const d = g.getImageData(x, y, w, h).data;
    const ls = new Float32Array(d.length / 4);
    for (let i = 0; i < ls.length; i++) ls[i] = 0.2126 * lin(d[i * 4]) + 0.7152 * lin(d[i * 4 + 1]) + 0.0722 * lin(d[i * 4 + 2]);
    ls.sort();
    const lo = ls[Math.floor(ls.length * 0.02)];
    const hi = ls[Math.min(ls.length - 1, Math.floor(ls.length * 0.98))];
    return { lo, hi };
  });
}

const browser = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const report = [];
let fails = 0;
for (const width of widths) {
  for (const theme of themes) {
    const narrow = width < 800;
    const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] ?? 900 }, deviceScaleFactor: narrow ? 2 : 1, colorScheme: theme, isMobile: narrow, hasTouch: narrow });
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    if (!(await runsFlight(page))) {
      console.log(`skip ${width} ${theme}: the flight is not running`);
      await ctx.close();
      continue;
    }
    await setTheme(page, theme);
    // (Full shading, as on an idle machine.)
    await page.evaluate(() => window.__flight?.engine?.holdLean?.(0));
    const list = await page.evaluate(stops, POINTS);
    for (const { stop, at } of list) {
      await page.evaluate((s) => window.scrollTo(0, s * innerHeight), stop);
      await page.waitForTimeout(settle);
      const boxes = await page.evaluate(titles);
      if (!boxes.length) continue;
      const style = await page.addStyleTag({ content: HIDE });
      await page.waitForTimeout(80);
      const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
      const res = await page.evaluate(spread, { b64, boxes });
      await style.evaluate((el) => el.remove());
      boxes.forEach((b, i) => {
        const sp = +((res[i].hi + 0.05) / (res[i].lo + 0.05)).toFixed(2);
        const bad = sp > MAX;
        if (bad) fails++;
        report.push({ width, theme, stop: +stop.toFixed(2), at, text: b.text, spread: sp, lo: +res[i].lo.toFixed(3), hi: +res[i].hi.toFixed(3), ok: !bad });
        console.log(`${bad ? 'FAIL' : 'ok  '} ${String(width).padStart(4)} ${theme.padEnd(5)} at ${stop.toFixed(2).padStart(5)} (${at} of its stretch)  spread ${sp.toFixed(2)}  (${res[i].lo.toFixed(2)} to ${res[i].hi.toFixed(2)})  "${b.text}"`);
      });
    }
    await ctx.close();
  }
}
await browser.close();
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\n${report.length} titles measured, ${fails} over ${MAX}.`);
process.exit(fails ? 1 : 0);
