#!/usr/bin/env node
/**
 * Pictures of the engine's own flight, for looking at a change to the world before it is rendered.
 *
 * Opens `/render` (the home page drawn live by the engine), steps the page by hand as tools/flight/render.mjs does
 * (full shading, the picture's clock tied to the place, the words set at once with their lee) and photographs the
 * window, words and all, at a list of places. Writes each picture and one sheet of them all.
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/render-sheet.mjs --base http://localhost:3183 \
 *     --out .tools/out/sheets/wide-day --w 1920 --h 1080 --theme light --count 32
 *
 * --at 5.6,8.45      the places, in screens (instead of --count evenly spaced ones)
 * --stops            every section's composed frame (the rail's own list)
 * --around <id>      a section's arrival, composed frame and leaving (five places)
 * --cols 8 --thumb 480   the sheet's layout      --canvas   the engine's canvas alone, no words
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const pw = require('playwright');
const sharp = createRequire(require.resolve('next/package.json', { paths: [process.cwd()] }))('sharp');

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const base = String(arg('base', 'http://localhost:3183')).replace(/\/$/, '');
const out = String(arg('out', '.tools/out/sheets/wide-day'));
const w = Number(arg('w', 1920));
const h = Number(arg('h', 1080));
const mobile = w < 800;
const dpr = Number(arg('dpr', mobile ? 2 : 1));
const theme = String(arg('theme', 'light'));
const cols = Number(arg('cols', 8));
const thumb = Number(arg('thumb', mobile ? 240 : 480));
const CLOCK0 = 20;

const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: theme, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[page]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('[console]', m.text().slice(0, 300));
});
await page.goto(`${base}/render`, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.dataset.flight === 'on' && !!window.__flight && window.__flight.loaded(), null, { timeout: 240000 });
await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important} html{scroll-behavior:auto !important}' });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const f = window.__flight;
  f.engine.holdLean(0);
  f.manual(true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__at = async (s, now) => {
    const unit = f.state().unit;
    window.scrollTo(0, s * unit);
    f.engine.holdClock(20 + s);
    f.holdEntrance(2.4);
    f.engine.holdDawn(0);
    for (let tries = 0; tries < 900; tries++) {
      f.step(now, s);
      if (f.engine.info.settled) break;
      await sleep(50);
    }
    f.step(now, s);
    return f.engine.info.needed;
  };
  const rail = Array.from(document.querySelectorAll('.fl-rail a'), (a) => ({ at: Number(a.dataset.at), from: Number(a.dataset.from), name: a.getAttribute('aria-label') }));
  return { end: (document.documentElement.scrollHeight - window.innerHeight) / f.state().unit, rail };
});
let places;
if (arg('at', null)) places = String(arg('at')).split(',').map(Number);
else if (arg('stops', false)) places = info.rail.map((r) => r.at);
else if (arg('around', null)) {
  const r = info.rail.find((x) => x.name.toLowerCase().replace(/[^a-z]/g, '') === String(arg('around')).toLowerCase().replace(/[^a-z]/g, ''));
  if (!r) throw new Error('no such section: ' + info.rail.map((x) => x.name).join(', '));
  places = [r.at - 1.0, r.at - 0.55, r.at - 0.25, r.at, r.at + 0.4, r.at + 0.75, r.at + 1.1, r.at + 1.4];
} else {
  const n = Number(arg('count', 32));
  places = Array.from({ length: n }, (_, i) => (info.end * i) / (n - 1));
}
mkdirSync(out, { recursive: true });
console.log(`${w} x ${h} ${theme}: ${info.end.toFixed(2)} screens; ${info.rail.map((r) => `${r.name} ${r.at}`).join(', ')}`);
let now = 1e7;
const files = [];
for (const [i, s] of places.entries()) {
  // (Walked up to, so the words and the lee behind them have the history they have in the flight.)
  for (let k = 8; k > 0; k--) await page.evaluate(([a, b]) => window.__at(a, b), [Math.max(0, s - k * 0.05), (now += 60)]);
  const needed = await page.evaluate(([a, b]) => window.__at(a, b), [s, (now += 60)]);
  const file = join(out, `${String(i).padStart(2, '0')}-${s.toFixed(2)}.jpg`);
  if (arg('canvas', false)) await page.locator('canvas').first().screenshot({ path: file, type: 'jpeg', quality: 90 });
  else await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
  files.push(file);
  console.log(`  ${s.toFixed(2)}  ${needed}`);
  now += 1e5;
}
await browser.close();

// The sheet.
const th = Math.round((thumb * h) / w);
const rows = Math.ceil(files.length / cols);
const tiles = await Promise.all(files.map((f) => sharp(f).resize(thumb, th).toBuffer()));
await sharp({ create: { width: cols * thumb + (cols + 1) * 6, height: rows * th + (rows + 1) * 6, channels: 3, background: '#222' } })
  .composite(tiles.map((input, i) => ({ input, left: 6 + (i % cols) * (thumb + 6), top: 6 + Math.floor(i / cols) * (th + 6) })))
  .jpeg({ quality: 88 })
  .toFile(`${out}.jpg`);
console.log(`${out}.jpg`);
