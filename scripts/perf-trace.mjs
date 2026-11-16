#!/usr/bin/env node
/**
 * Performance harness: a real Chrome trace over a full home scroll and the
 * hero interaction, on a desktop profile and on a phone profile with the
 * CPU throttled 4x.
 *
 * It reports frame intervals (p50, p95, p99), dropped frames, long tasks,
 * GPU time per frame from the trace, the quality tier the engine ended on,
 * and the canvas backing-store size on every frame, which is how a
 * resolution drop would show up. Traces are written outside the repo.
 *
 *   NODE_PATH=~/.t3/portfolio-redesign-v4/tools/node_modules \
 *     node scripts/perf-trace.mjs --base http://localhost:3133 \
 *       --out ~/.t3/portfolio-redesign-v4/traces/v4
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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
const base = arg('base', 'http://localhost:3133');
const outDir = arg('out', join(homedir(), '.t3/portfolio-redesign-v4/traces/v4')).replace(/^~/, homedir());
const only = arg('profile', '');
mkdirSync(outDir, { recursive: true });

const PROFILES = [
  { name: 'desktop-1440-dpr2', viewport: { width: 1440, height: 900 }, dpr: 2, throttle: 1, touch: false },
  { name: 'desktop-1728-dpr2', viewport: { width: 1728, height: 1117 }, dpr: 2, throttle: 1, touch: false },
  { name: 'phone-390-dpr3-cpu4x', viewport: { width: 390, height: 844 }, dpr: 3, throttle: 4, touch: true },
].filter((p) => !only || p.name.includes(only));

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

function summarise(intervals) {
  const s = intervals.slice().sort((a, b) => a - b);
  return {
    frames: s.length,
    p50: +pct(s, 0.5).toFixed(2),
    p95: +pct(s, 0.95).toFixed(2),
    p99: +pct(s, 0.99).toFixed(2),
    max: +(s[s.length - 1] || 0).toFixed(2),
    over25ms: s.filter((x) => x > 25).length,
    over34ms: s.filter((x) => x > 34).length,
  };
}

/** Installed before any page script: frame log, long tasks, backing size. */
function instrument() {
  const log = { frames: [], sizes: [], longTasks: [], marks: [] };
  window.__perf = log;
  let last = 0;
  const tick = (t) => {
    if (last) log.frames.push(t - last);
    last = t;
    const c = document.querySelector('.water-canvas');
    if (c) log.sizes.push(c.width * 10000 + c.height);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) log.longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* longtask is Chromium only */
  }
}

const report = [];
for (const prof of PROFILES) {
  const browser = await pw.chromium.launch({
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-benchmarking'],
  });
  const ctx = await browser.newContext({
    viewport: prof.viewport,
    deviceScaleFactor: prof.dpr,
    hasTouch: prof.touch,
    isMobile: prof.touch,
  });
  await ctx.addInitScript(instrument);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (prof.throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.throttle });

  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.water, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => document.documentElement.dataset.water);

  // Trace.
  const chunks = [];
  cdp.on('Tracing.dataCollected', (e) => chunks.push(...e.value));
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: {
      includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'gpu', 'viz', 'benchmark', 'latencyInfo'],
    },
  });

  const mark = (name) => page.evaluate((n) => window.__perf.marks.push({ n, frame: window.__perf.frames.length }), name);

  // 1. Full home scroll, top to bottom, at reading speed.
  await mark('scroll-start');
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  if (prof.touch) {
    // Native momentum scrolling in steps, as a thumb would.
    for (let y = 0; y < max; y += 48) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(16);
    }
  } else {
    await page.mouse.move(prof.viewport.width / 2, prof.viewport.height / 2);
    for (let y = 0; y < max + 600; y += 70) {
      await page.mouse.wheel(0, 70);
      await page.waitForTimeout(16);
    }
  }
  await page.waitForTimeout(1200);
  await mark('scroll-end');

  // 2. The hero interaction: back to the lake, drag the pointer through it.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  await mark('hero-start');
  const { width: w, height: h } = prof.viewport;
  for (let i = 0; i < 300; i++) {
    const t = i / 300;
    const x = w * (0.5 + 0.36 * Math.sin(t * 9.4));
    const y = h * (0.55 + 0.2 * Math.sin(t * 15.1));
    if (prof.touch) {
      if (i % 30 === 0) await page.touchscreen.tap(x, y);
    } else {
      await page.mouse.move(x, y);
    }
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(800);
  await mark('hero-end');

  const traceDone = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  await traceDone;
  const tracePath = join(outDir, `${prof.name}.trace.json`);
  writeFileSync(tracePath, JSON.stringify({ traceEvents: chunks }));

  const perf = await page.evaluate(() => ({ ...window.__perf, info: window.__water ? window.__water.engine.info : null }));
  const at = (n) => (perf.marks.find((m) => m.n === n) || { frame: 0 }).frame;
  const scroll = perf.frames.slice(at('scroll-start'), at('scroll-end'));
  const hero = perf.frames.slice(at('hero-start'), at('hero-end'));
  const sizes = [...new Set(perf.sizes)].map((v) => `${Math.floor(v / 10000)}x${v % 10000}`);

  // GPU time: sum of GPU task durations in the trace, per rendered frame.
  let gpuMicros = 0;
  let gpuTasks = 0;
  for (const e of chunks) {
    if (e.name === 'GPUTask' && e.ph === 'X' && e.dur) {
      gpuMicros += e.dur;
      gpuTasks++;
    }
  }
  const frames = scroll.length + hero.length || 1;

  const row = {
    profile: prof.name,
    water: state,
    scroll: summarise(scroll),
    hero: summarise(hero),
    longTasks: { count: perf.longTasks.length, totalMs: perf.longTasks.reduce((a, b) => a + b.dur, 0), worstMs: Math.max(0, ...perf.longTasks.map((t) => t.dur)) },
    gpuMsPerFrame: +(gpuMicros / 1000 / frames).toFixed(2),
    gpuTasks,
    backingSizes: sizes,
    engine: perf.info,
    trace: tracePath,
  };
  report.push(row);
  console.log(JSON.stringify(row, null, 1));
  await browser.close();
}

const reportPath = join(outDir, 'report.json');
writeFileSync(reportPath, JSON.stringify({ base, when: new Date().toISOString(), report }, null, 1));
console.log('report', reportPath);
