#!/usr/bin/env node
/**
 * The played flight, traced: a cold visit to the home page (an empty
 * cache), scrolled from the top to the foot, and what the page did the
 * while.
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/player-trace.mjs \
 *     --base http://localhost:3183 --profile wide --run read --theme light --out trace.json
 *
 * --profile  wide (1728 x 1117 at 2x, the owner's laptop) | desk (1920 x 1080 at 1x) | tall (390 x 844 at 2x, touch)
 * --software  run without a GPU (what Lighthouse's headless Chrome does)
 * --run      read: a screen a second, the whole page  |  fling: the whole page in bursts of several screens,
 *            each over a third of a second, with a pause between
 *
 * It reports: the time to the first paint, to the still, to the first
 * played frame; every frame interval while scrolling (how many were over 20
 * ms, the longest); every long task; what was fetched, when; how many
 * decoded frames were held at most, and what a frame cost to decode; the
 * script heap. The flight's streams are the only requests counted as
 * "fetched".
 *
 * Playwright is not a dependency of this repo: point NODE_PATH at an
 * install that has it.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3183').replace(/\/$/, '');
const profile = arg('profile', 'wide');
const run = arg('run', 'read');
const theme = arg('theme', 'light');
const P = { wide: { w: 1728, h: 1117, dpr: 2 }, desk: { w: 1920, h: 1080, dpr: 1 }, tall: { w: 390, h: 844, dpr: 2, mobile: true } }[profile];

// (--software: no GPU, as Lighthouse's headless Chrome runs: WebGL and canvas are then drawn by the CPU.)
const software = process.argv.includes('--software');
const browser = await chromium.launch({ headless: true, args: software ? ['--enable-precise-memory-info'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: P.w, height: P.h }, deviceScaleFactor: P.dpr, colorScheme: theme, isMobile: !!P.mobile, hasTouch: !!P.mobile });
const page = await ctx.newPage();
const requests = [];
page.on('response', (res) => {
  const url = res.url();
  if (!url.includes('/flight/')) return;
  const len = Number(res.headers()['content-length'] || 0);
  requests.push({ file: url.split('/flight/')[1], status: res.status(), bytes: len });
});
await page.addInitScript(() => {
  window.__trace = { long: [], frames: [], on: false, t0: 0 };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__trace.long.push([Math.round(e.startTime), Math.round(e.duration)]);
  }).observe({ type: 'longtask', buffered: true });
  let last = 0;
  const loop = (now) => {
    if (window.__trace.on && last) window.__trace.frames.push(+(now - last).toFixed(2));
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
await page.goto(`${base}/`, { waitUntil: 'load' });
await page.waitForFunction(() => !!document.querySelector('.flight-root[data-picture]'), null, { timeout: 30000 }).catch(() => {});
// (The entrance runs out before the reader scrolls.)
await page.waitForTimeout(3600);
const start = await page.evaluate(() => {
  const paint = Object.fromEntries(performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]));
  const s = window.__player.stats();
  return { paint, firstPlayedFrame: Math.round(s.firstFrameAt), streamReady: Math.round(s.readyAt), codec: s.codec, draws: s.draws, picture: `${s.w}x${s.h}`, fetchedAtStart: s.fetched, longBeforeScroll: window.__trace.long.slice() };
});
const lcp = await page.evaluate(
  () =>
    new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const e = list.getEntries().pop();
        resolve({ at: Math.round(e.startTime), what: e.element?.className || e.element?.tagName || '', url: (e.url || '').split('/').pop() });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve(null), 1500);
    }),
);

// The scroll: by script, a little every frame (read), or in bursts (fling).
const samples = await page.evaluate(
  async ({ run }) => {
    const unit = window.__player.state().unit;
    const end = document.documentElement.scrollHeight - window.innerHeight;
    const out = [];
    const tr = window.__trace;
    tr.frames.length = 0;
    tr.on = true;
    const t0 = performance.now();
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const sample = () => {
      const s = window.__player.stats();
      out.push({ t: Math.round(performance.now() - t0), y: +(window.scrollY / unit).toFixed(2), s: +window.__player.state().s.toFixed(2), fetched: s.fetched, held: s.frames, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0, decoded: s.decoded, decodeMs: Math.round(s.decodeMs), missed: s.missed });
    };
    let lastSample = 0;
    if (run === 'read') {
      // A screen a second.
      let prev = performance.now();
      while (window.scrollY < end - 1) {
        const now = await frame();
        window.scrollTo(0, Math.min(end, window.scrollY + ((now - prev) / 1000) * unit));
        prev = now;
        if (now - lastSample > 500) {
          lastSample = now;
          sample();
        }
      }
    } else {
      // Bursts: three screens in a third of a second, eased out as a flung page is, then a pause.
      let y = 0;
      while (y < end - 1) {
        const from = y;
        const to = Math.min(end, y + 3 * unit);
        const t1 = performance.now();
        for (;;) {
          const now = await frame();
          const k = Math.min(1, (now - t1) / 340);
          window.scrollTo(0, from + (to - from) * (1 - (1 - k) ** 3));
          if (k >= 1) break;
        }
        y = to;
        const until = performance.now() + 500;
        while (performance.now() < until) await frame();
        sample();
      }
    }
    const until = performance.now() + 1500;
    while (performance.now() < until) await frame();
    sample();
    tr.on = false;
    return { out, frames: tr.frames.slice(), long: tr.long.slice(), seconds: (performance.now() - t0) / 1000 };
  },
  { run },
);
const end = await page.evaluate(() => {
  const s = window.__player.stats();
  return { fetched: s.fetched, peakHeld: s.peakHeld, decoded: s.decoded, meanDecodeMs: +s.meanDecodeMs.toFixed(2), drawn: s.drawn, missed: s.missed, bytesLog: s.bytesLog, w: s.w, h: s.h };
});
await browser.close();

const f = samples.frames.slice().sort((a, b) => a - b);
const pct = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))];
const longScroll = samples.long.filter(([at]) => !start.longBeforeScroll.some(([b]) => b === at));
const summary = {
  profile,
  run,
  theme,
  viewport: `${P.w}x${P.h}@${P.dpr}`,
  ...start,
  lcp,
  seconds: +samples.seconds.toFixed(1),
  frames: f.length,
  frameMs: { p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: f[f.length - 1], over20: f.filter((x) => x > 20).length, over34: f.filter((x) => x > 34).length },
  longTasksBeforeScroll: start.longBeforeScroll,
  longTasksInScroll: longScroll,
  fetchedMB: +(end.fetched / 1048576).toFixed(2),
  peakHeldFrames: end.peakHeld,
  // (A decoded frame is held as 4:2:0: a byte and a half a pixel.)
  peakHeldMB: +((end.peakHeld * end.w * end.h * 1.5) / 1048576).toFixed(0),
  peakHeapMB: Math.max(...samples.out.map((s) => s.heap)),
  decoded: end.decoded,
  meanDecodeMs: end.meanDecodeMs,
  drawn: end.drawn,
  drewNearestInstead: end.missed,
};
console.log(JSON.stringify({ ...summary, longTasksBeforeScroll: undefined, n: undefined }, null, 1));
const out = arg('out', '');
if (out) writeFileSync(out, JSON.stringify({ summary, samples: samples.out, bytesLog: end.bytesLog, requests, frames: samples.frames }, null, 1));
