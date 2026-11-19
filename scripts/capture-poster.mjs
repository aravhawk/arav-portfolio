#!/usr/bin/env node
/**
 * The first paint's stills, photographed from the live home page.
 *
 * The home page's first paint is a still of the scene's own first frame,
 * under the canvas; the live picture comes up over it. The first camera
 * stands nearer the name the wider the window is, so there is one still to
 * a band of window shapes (posterBands in src/water/camera.ts) and to a
 * theme. Each is the entrance's first frame for that band (the band's own
 * first camera, before the light has arrived: `holdEntrance(0)`), taken at
 * full shading with the words, the nav and the rail hidden, on a window as
 * wide as the band's widest, and written to public/media/poster/ as
 * <band>-<theme>.avif and .webp, each 150 KB or less, with manifest.json
 * beside them.
 *
 * Re-run it whenever the first frame changes (the name's look, the light,
 * the lake), against a running server (a production build photographs best):
 *
 *   NODE_PATH=.tools/node_modules node scripts/capture-poster.mjs --base http://localhost:3166
 *
 * Nothing here is typed in: the bands are read from the page's own first
 * script (`posterBoot` in src/water/poster.ts writes them into the page).
 *
 * Playwright is not a dependency of this repo: point NODE_PATH at an
 * install that has it. The encoder is sharp, which Next.js brings.
 * Options: --base  --out public/media/poster  --only wide-3,tall-1
 * --themes light,dark  --max-kb 150
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  console.error('playwright not found. Set NODE_PATH to a node_modules folder that contains it.');
  process.exit(2);
}
let sharp;
try {
  sharp = createRequire(require.resolve('next/package.json'))('sharp');
} catch {
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp not found (Next.js installs it as an optional dependency).');
    process.exit(2);
  }
}

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3166').replace(/\/$/, '');
const outDir = arg('out', join('public', 'media', 'poster'));
const only = arg('only', '') ? arg('only', '').split(',') : null;
const themes = arg('themes', 'light,dark').split(',');
const maxBytes = Number(arg('max-kb', '150')) * 1024;

/* The window each shape is photographed on: its height in CSS px (the words' layout is a real window's) and how many
   device pixels to each. A still is fitted to the frame's height, so these give its height in pixels. */
const SHAPE = { tall: { h: 844, dpr: 2 }, mid: { h: 1024, dpr: 1.5 }, square: { h: 1000, dpr: 1.2 }, wide: { h: 900, dpr: 1.2 } };
const HIDE = '.fl-words,.fl-call,.fl-calls,.nav,.skip,.fl-rail,.fl-poster{visibility:hidden!important}nextjs-portal{display:none!important}';

mkdirSync(outDir, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

/** The bands, as the page's own first script holds them: [id, lo, hi]. */
async function readBands() {
  const page = await browser.newPage();
  const html = await (await page.request.get(`${base}/`)).text();
  await page.close();
  const m = html.match(/\(\[(\[(?:\\?"|&quot;)[a-z]+-\d+.*?\])\],/);
  if (!m) throw new Error('the page does not carry its poster bands');
  return JSON.parse(`[${m[1].replace(/\\"/g, '"').replace(/&quot;/g, '"')}]`);
}

async function encode(png, kind) {
  // The best quality that fits the budget.
  for (const q of kind === 'avif' ? [62, 56, 50, 45, 40, 35, 30] : [86, 80, 74, 68, 62, 55, 48]) {
    const buf = kind === 'avif' ? await sharp(png).avif({ quality: q, effort: 6, chromaSubsampling: '4:2:0' }).toBuffer() : await sharp(png).webp({ quality: q, effort: 6 }).toBuffer();
    if (buf.length <= maxBytes) return { buf, q };
  }
  throw new Error(`${kind}: no quality fits ${maxBytes} bytes`);
}

const bands = await readBands();
const manifest = { when: new Date().toISOString(), base, bands: [] };
for (const [id, lo, hi] of bands) {
  if (only && !only.includes(id)) continue;
  const shape = SHAPE[id.split('-')[0]];
  // (A hair under the band's widest window: that window itself is the next band's narrowest.)
  const width = Math.floor(hi * shape.h) - 2;
  for (const theme of themes) {
    const phone = id.startsWith('tall');
    const ctx = await browser.newContext({ viewport: { width, height: shape.h }, deviceScaleFactor: shape.dpr, colorScheme: theme, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.flight === 'on' && !!window.__flight, null, { timeout: 90000 });
    const got = await page.evaluate(() => document.documentElement.dataset.poster);
    if (got !== id) throw new Error(`a ${width} x ${shape.h} window is in band ${got}, not ${id}`);
    // The entrance's first frame, held; full shading; nothing but the picture.
    await page.evaluate(() => {
      window.__flight.holdEntrance(0);
      window.__flight.engine.holdLean(0);
    });
    await page.addStyleTag({ content: HIDE });
    // (The bed is carved and the name cut a little after the picture first shows.)
    await page.waitForTimeout(4500);
    const png = await page.screenshot({ type: 'png' });
    await ctx.close();
    const meta = await sharp(png).metadata();
    const row = { id, theme, lo, hi, w: meta.width, h: meta.height };
    for (const kind of ['avif', 'webp']) {
      const { buf, q } = await encode(png, kind);
      writeFileSync(join(outDir, `${id}-${theme}.${kind}`), buf);
      row[kind] = { kb: +(buf.length / 1024).toFixed(1), quality: q };
    }
    manifest.bands.push(row);
    console.log(`${id}-${theme}  ${meta.width} x ${meta.height}  avif ${row.avif.kb} KB (q${row.avif.quality})  webp ${row.webp.kb} KB (q${row.webp.quality})`);
  }
}
await browser.close();
if (!only) writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`${manifest.bands.length} stills in ${outDir}`);
