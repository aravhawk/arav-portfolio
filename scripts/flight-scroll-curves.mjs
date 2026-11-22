#!/usr/bin/env node
/**
 * Does the page move as it did? The same hand on two builds: where the
 * scroll, the camera and the words stand against time.
 *
 *   NODE_PATH=<playwright modules> node scripts/flight-scroll-curves.mjs <base a> <base b> <out dir> [--theme dark]
 *
 * On each build, after the entrance: a reader's scroll (a wheel notch of
 * 100 px every 125 ms for 6 s), a rest, then a fling (24 notches of 300 px
 * in 0.4 s) and a rest. Every frame it writes the time, the scroll
 * position, the camera's position, how many of the words' pieces are in and
 * how many captions are on. The two curves are laid over each other at
 * 50 ms steps and the largest differences printed: they should be within a
 * frame's travel of each other.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const [a, b, out, ...rest] = process.argv.slice(2);
const theme = rest.includes('--theme') ? rest[rest.indexOf('--theme') + 1] : 'light';
mkdirSync(out, { recursive: true });

async function run(base) {
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.opened !== undefined, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.mouse.move(720, 450);
  await page.evaluate(() => {
    const f = window.__flight;
    const log = (window.__curve = []);
    const t0 = performance.now();
    const tick = () => {
      log.push([Math.round(performance.now() - t0), Math.round(scrollY * 10) / 10, ...f.state().pos.map((v) => +v.toFixed(1)), document.querySelectorAll('[data-at][data-in]').length, document.querySelectorAll('.fl-call[data-on]').length]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  const until = async (ms) => {
    const wait = t0 + ms - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  };
  for (let i = 0; i < 48; i++) {
    await until(200 + i * 125);
    await page.mouse.wheel(0, 100);
  }
  for (let i = 0; i < 24; i++) {
    await until(8500 + i * 17);
    await page.mouse.wheel(0, 300);
  }
  await until(12500);
  const log = await page.evaluate(() => window.__curve);
  await browser.close();
  return log;
}

const curves = { a: await run(a), b: await run(b) };
writeFileSync(join(out, `curves-${theme}.json`), JSON.stringify(curves));
const at = (log, t, k) => {
  let i = log.findIndex((r) => r[0] >= t);
  if (i < 0) i = log.length - 1;
  if (i === 0) return log[0][k];
  const p = log[i - 1];
  const q = log[i];
  return p[k] + ((q[k] - p[k]) * (t - p[0])) / Math.max(1, q[0] - p[0]);
};
let worstY = 0;
let worstAt = 0;
let worstCam = 0;
let speedThen = 0;
const rows = [];
for (let t = 0; t <= 12400; t += 50) {
  const ya = at(curves.a, t, 1);
  const yb = at(curves.b, t, 1);
  const cam = Math.hypot(at(curves.a, t, 2) - at(curves.b, t, 2), at(curves.a, t, 3) - at(curves.b, t, 3), at(curves.a, t, 4) - at(curves.b, t, 4));
  rows.push([t, ya.toFixed(1), yb.toFixed(1), (yb - ya).toFixed(1)].join(','));
  if (Math.abs(yb - ya) > worstY) {
    worstY = Math.abs(yb - ya);
    worstAt = t;
    speedThen = Math.abs(at(curves.a, t + 50, 1) - at(curves.a, t - 50, 1)) * 10;
  }
  worstCam = Math.max(worstCam, cam);
}
writeFileSync(join(out, `curves-${theme}.csv`), 't_ms,scroll_a_px,scroll_b_px,difference_px\n' + rows.join('\n') + '\n');
const end = (log) => log[log.length - 1];
const summary = {
  theme,
  largestScrollDifferencePx: +worstY.toFixed(1),
  atMs: worstAt,
  scrollSpeedThenPxPerSecond: Math.round(speedThen),
  thatIsThisManyMsOfTravel: speedThen ? +((worstY / speedThen) * 1000).toFixed(1) : 0,
  largestCameraDifferenceWorldUnits: +worstCam.toFixed(1),
  restsAtPx: [end(curves.a)[1], end(curves.b)[1]],
  wordsInAtEnd: [end(curves.a)[5], end(curves.b)[5]],
  captionsOnAtEnd: [end(curves.a)[6], end(curves.b)[6]],
  frames: [curves.a.length, curves.b.length],
};
writeFileSync(join(out, `curves-${theme}-summary.json`), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
