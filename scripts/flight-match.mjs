#!/usr/bin/env node
/**
 * The played flight beside the live engine, place for place.
 *
 * For 16 places spread over the page, a theme and a window shape, it
 * photographs the home page (the pre-rendered flight, held at that exact
 * place) and the engine's own route (`/render`, or photographs of the
 * engine taken earlier: --ref), and sets them side by side:
 *
 *   <out>/<shape>-<theme>-pairs.jpg   every pair, small, the engine on the left
 *   <out>/<shape>-<theme>-crops.jpg   two crops of every pair at 100 percent
 *   <out>/<shape>-<theme>.json        how far apart each pair is (mean
 *                                     difference of a crop without words)
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/flight-match.mjs \
 *     --base http://localhost:3183 --out .tools/out/match --shape wide --theme light [--ref <dir>]
 *
 * --ref: a folder of engine photographs named <shape>-<theme>-<s>.png (s with
 * `_` for the point), taken at the same window size.
 * What moves by time in the engine (the water's ripples, the film's grain,
 * the first screen's breath) is not at the same moment in the two.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = createRequire(require.resolve('next/package.json', { paths: [process.cwd()] }))('sharp');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3183').replace(/\/$/, '');
const out = arg('out', '.tools/out/match');
const shape = arg('shape', 'wide');
const theme = arg('theme', 'light');
const ref = arg('ref', '');
const V = shape === 'wide' ? { w: 1920, h: 1080, dpr: 1 } : { w: 390, h: 844, dpr: 2, mobile: true };
const SPAN = Number(arg('span', 31.1));
const places = Array.from({ length: 16 }, (_, i) => Math.round(((i * SPAN) / 15) * 30) / 30);
const name = (s) => s.toFixed(4).replace('.', '_').replace(/0+$/, '').replace(/_$/, '');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const open = async (path) => {
  const ctx = await browser.newContext({ viewport: { width: V.w, height: V.h }, deviceScaleFactor: V.dpr, colorScheme: theme, isMobile: !!V.mobile, hasTouch: !!V.mobile });
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'load' });
  return page;
};

// The player, held at each place.
const played = [];
{
  const page = await open('/');
  await page.waitForFunction(() => window.__player, null, { timeout: 20000 });
  await page.waitForTimeout(4000);
  for (const s of places) {
    await page.evaluate((s) => {
      window.scrollTo(0, s * window.__player.state().unit);
      window.__player.hold(s);
    }, s);
    await page.waitForFunction(() => window.__player.settled(), null, { timeout: 20000 }).catch(() => console.log('the player did not settle at', s));
    await page.waitForTimeout(s > SPAN - 0.5 ? 1500 : 900);
    const file = join(out, `played-${shape}-${theme}-${name(s)}.png`);
    await page.screenshot({ path: file });
    played.push(file);
  }
  await page.context().close();
}
// The engine: photographs taken earlier, or the engine's own route now.
const engine = [];
if (ref) for (const s of places) engine.push(join(ref, `${shape}-${theme}-${name(s) || '0'}.png`));
else {
  const page = await open('/render');
  await page.waitForFunction(() => document.documentElement.dataset.flight === 'on' && window.__flight?.loaded?.(), null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.__flight.engine.holdLean(0));
  for (const s of places) {
    await page.evaluate((s) => window.scrollTo(0, s * window.__flight.state().unit), s);
    await page.waitForTimeout(s > SPAN - 0.5 ? 9000 : 2600);
    const file = join(out, `engine-${shape}-${theme}-${name(s)}.png`);
    await page.screenshot({ path: file });
    engine.push(file);
  }
}
await browser.close();

const W = V.w * V.dpr;
const H = V.h * V.dpr;
const missing = engine.filter((f) => !existsSync(f));
if (missing.length) throw new Error(`no engine photograph: ${missing.join(', ')}`);
// Every pair, small.
{
  const tw = shape === 'wide' ? 640 : 260;
  const th = Math.round((tw * H) / W);
  const cols = shape === 'wide' ? 2 : 4;
  const rows = Math.ceil(places.length / cols);
  const gap = 10;
  const cell = tw * 2 + gap;
  const parts = [];
  for (let i = 0; i < places.length; i++) {
    const x = (i % cols) * (cell + gap * 2) + gap;
    const y = Math.floor(i / cols) * (th + gap) + gap;
    parts.push({ input: await sharp(engine[i]).resize(tw, th).toBuffer(), left: x, top: y }, { input: await sharp(played[i]).resize(tw, th).toBuffer(), left: x + tw + 2, top: y });
  }
  await sharp({ create: { width: cols * (cell + gap * 2), height: rows * (th + gap) + gap, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 88 }).toFile(join(out, `${shape}-${theme}-pairs.jpg`));
}
// Two crops of every pair at 100 percent: the middle of the frame, and the right of it (clear of the words on a wide frame).
const report = [];
{
  const cw = shape === 'wide' ? 560 : 380;
  const ch = shape === 'wide' ? 340 : 300;
  const spots = shape === 'wide' ? [[0.5, 0.42], [0.8, 0.7]] : [[0.5, 0.3], [0.5, 0.52]];
  const gap = 8;
  const parts = [];
  for (let i = 0; i < places.length; i++) {
    const row = { s: places[i], diff: [] };
    for (let k = 0; k < spots.length; k++) {
      const left = Math.round(Math.min(W - cw, Math.max(0, spots[k][0] * W - cw / 2)));
      const top = Math.round(Math.min(H - ch, Math.max(0, spots[k][1] * H - ch / 2)));
      const a = await sharp(engine[i]).removeAlpha().extract({ left, top, width: cw, height: ch }).raw().toBuffer();
      const b = await sharp(played[i]).removeAlpha().extract({ left, top, width: cw, height: ch }).raw().toBuffer();
      let sum = 0;
      for (let p = 0; p < a.length; p++) sum += Math.abs(a[p] - b[p]);
      row.diff.push(+(sum / a.length).toFixed(2));
      const x = k * (cw * 2 + gap * 3) + gap;
      const y = i * (ch + gap) + gap;
      parts.push({ input: a, raw: { width: cw, height: ch, channels: 3 }, left: x, top: y }, { input: b, raw: { width: cw, height: ch, channels: 3 }, left: x + cw + 2, top: y });
    }
    report.push(row);
  }
  await sharp({ create: { width: spots.length * (cw * 2 + gap * 3), height: places.length * (ch + gap) + gap, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 92 }).toFile(join(out, `${shape}-${theme}-crops.jpg`));
}
writeFileSync(join(out, `${shape}-${theme}.json`), JSON.stringify(report, null, 1));
for (const r of report) console.log(`${shape}-${theme} at ${r.s.toFixed(2)}: mean difference ${r.diff.join(', ')} of 255`);
