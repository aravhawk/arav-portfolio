#!/usr/bin/env node
/**
 * Performance harness: a real Chrome trace over a full home scroll and the
 * hero interaction, on a desktop profile and on a phone profile with the
 * CPU throttled 4x.
 *
 * It reports frame intervals (p50, p95, p99), dropped frames, long tasks,
 * GPU time per frame from the trace, the quality tier the engine ended on,
 * and the canvas backing-store size on every frame, which is how a
 * resolution drop would show up. It also prints slow frames for each
 * screen of scroll, so a costly stretch of the page can be found.
 *
 * The scroll is driven by where the page actually is, not by how many
 * wheel events were sent: every profile goes from the top to the very foot
 * of the page at reading speed (about `--speed` screens a second).
 *
 *   NODE_PATH=.tools/node_modules node scripts/perf-trace.mjs \
 *     --base http://localhost:3142 --out .tools/out/traces
 *
 * Options: --path /  --profile 1728 (a part of a profile's name)  --speed 0.8
 *   --theme light|dark (the colour scheme the page is opened in; light)
 *   --keep-trace (write each profile's trace beside the report: hundreds of
 *     megabytes a profile, so it is not written unless asked for)
 *
 * The 2560 x 1440 profile runs only when it is named (`--profile 2560`).
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
/** The page to trace: `--path /flight` for the flight, the home page by default. */
const route = arg('path', '/');
const base = arg('base', 'http://localhost:3142');
const outDir = arg('out', '.tools/out/traces').replace(/^~/, homedir());
const only = arg('profile', '');
/** Screens of scroll a second: a reader's pace through a long page. */
const speed = Number(arg('speed', '0.8'));
const theme = arg('theme', 'light') === 'dark' ? 'dark' : 'light';
const keepTrace = process.argv.includes('--keep-trace');
mkdirSync(outDir, { recursive: true });

const PROFILES = [
  { name: 'desktop-1440-dpr2', viewport: { width: 1440, height: 900 }, dpr: 2, throttle: 1, touch: false },
  { name: 'desktop-1728-dpr2', viewport: { width: 1728, height: 1117 }, dpr: 2, throttle: 1, touch: false },
  { name: 'phone-390-dpr3-cpu4x', viewport: { width: 390, height: 844 }, dpr: 3, throttle: 4, touch: true },
  // The same desktop run while a second copy of the site renders its own
  // water in another window: frame rate may fall, sharpness may not.
  { name: 'desktop-1440-dpr2-contended', viewport: { width: 1440, height: 900 }, dpr: 2, throttle: 1, touch: false, contend: true },
  // A large desktop screen: the governor is allowed to lean here.
  { name: 'desktop-2560-dpr2', viewport: { width: 2560, height: 1440 }, dpr: 2, throttle: 1, touch: false, extra: true },
].filter((p) => (only ? p.name.includes(only) : !p.extra));

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
  const log = { frames: [], at: [], sizes: [], longTasks: [], marks: [], on: 0 };
  window.__perf = log;
  let last = 0;
  const tick = (t) => {
    if (last) {
      log.frames.push(t - last);
      // Where the page was, in screens of scroll, when this frame was drawn.
      log.at.push(scrollY / innerHeight);
    }
    last = t;
    const c = document.querySelector('.water-canvas, .flight-canvas');
    if (c) log.sizes.push(c.width * 10000 + c.height);
    // When the picture first stood on the page.
    if (!log.on && document.documentElement.dataset.flight === 'on') log.on = Math.round(t);
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
    colorScheme: theme,
  });
  if (prof.contend) {
    const other = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
    const rival = await other.newPage();
    await rival.goto(base + '/', { waitUntil: 'load' });
    await rival.waitForTimeout(1500);
  }
  await ctx.addInitScript(instrument);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (prof.throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.throttle });

  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.water || document.documentElement.dataset.flight, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => document.documentElement.dataset.water || document.documentElement.dataset.flight);

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

  // 1. The whole page, top to foot, at reading speed. The loop watches
  // where the page is: a wheel event moves a different distance at each
  // device pixel ratio (and smooth scrolling lags it), so counting events
  // would stop short.
  await mark('scroll-start');
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const pxPerSec = speed * prof.viewport.height;
  const t0 = Date.now();
  let reached = 0;
  if (prof.touch) {
    // Native scrolling in small steps, as a thumb would.
    for (;;) {
      const want = Math.min(max, ((Date.now() - t0) / 1000) * pxPerSec);
      await page.evaluate((yy) => window.scrollTo(0, yy), want);
      await page.waitForTimeout(16);
      reached = want;
      if (want >= max) break;
    }
  } else {
    await page.mouse.move(prof.viewport.width / 2, prof.viewport.height / 2);
    let stalled = 0;
    for (;;) {
      // Wheel toward where a reader would be by now; the page says where it really is.
      const want = Math.min(max + 400, ((Date.now() - t0) / 1000) * pxPerSec);
      const at = await page.evaluate(() => window.scrollY);
      if (at >= max - 1) {
        reached = at;
        break;
      }
      stalled = at <= reached + 0.5 ? stalled + 1 : 0;
      reached = Math.max(reached, at);
      // (Nothing has moved for two seconds: report how far it got instead of spinning.)
      if (stalled > 120) break;
      const behind = want - at;
      if (behind > 4) await page.mouse.wheel(0, Math.min(140, behind));
      await page.waitForTimeout(16);
    }
  }
  await page.waitForTimeout(1200);
  await mark('scroll-end');
  const leanAtFoot = await page.evaluate(() => window.__flight?.engine.info.lean ?? null);
  const scrolled = await page.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  // Hold at the foot: the ending at rest, and its light event.
  await mark('end-start');
  await page.waitForTimeout(4000);
  await mark('end-end');

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
  const tracePath = keepTrace ? join(outDir, `${prof.name}-${theme}.trace.json`) : null;
  if (tracePath) writeFileSync(tracePath, JSON.stringify({ traceEvents: chunks }));

  const perf = await page.evaluate(() => ({
    ...window.__perf,
    info: window.__water ? window.__water.engine.info : null,
    paint: Math.round(performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint')?.startTime ?? 0),
  }));
  const at = (n) => (perf.marks.find((m) => m.n === n) || { frame: 0 }).frame;
  const scroll = perf.frames.slice(at('scroll-start'), at('scroll-end'));
  const hero = perf.frames.slice(at('hero-start'), at('hero-end'));
  const ending = perf.frames.slice(at('end-start'), at('end-end'));
  // Slow frames for each screen of scroll: "screen: over 25 ms / frames".
  const screens = [];
  for (let i = at('scroll-start'); i < at('scroll-end'); i++) {
    const k = Math.floor(perf.at[i]);
    screens[k] = screens[k] || { frames: 0, over25: 0, worst: 0 };
    screens[k].frames++;
    if (perf.frames[i] > 25) screens[k].over25++;
    screens[k].worst = Math.max(screens[k].worst, perf.frames[i]);
  }
  const perScreen = Array.from(screens, (v, k) => (v ? `${k}:${v.over25}/${v.frames}` : `${k}:-`)).join(' ');
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

  // Long tasks once the page has painted: what a reader could feel.
  const late = perf.longTasks.filter((t) => t.start > perf.paint);
  const row = {
    profile: prof.name,
    theme,
    water: state,
    scroll: summarise(scroll),
    scrolled: `${(scrolled.y / prof.viewport.height).toFixed(1)} of ${(scrolled.max / prof.viewport.height).toFixed(1)} screens${scrolled.y >= scrolled.max - 2 ? '' : ' (DID NOT REACH THE FOOT)'}`,
    slowPerScreen: perScreen,
    ending: summarise(ending),
    hero: summarise(hero),
    longTasks: { count: perf.longTasks.length, totalMs: perf.longTasks.reduce((a, b) => a + b.dur, 0), worstMs: Math.max(0, ...perf.longTasks.map((t) => t.dur)) },
    longTasksAfterPaint: { count: late.length, worstMs: Math.max(0, ...late.map((t) => t.dur)), list: late.slice(0, 12).map((t) => `${t.start}:${t.dur}`).join(' ') },
    firstPaintMs: perf.paint,
    pictureOnMs: perf.on,
    leanAtFoot,
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

const reportPath = join(outDir, `report-${theme}${only ? `-${only}` : ''}.json`);
writeFileSync(reportPath, JSON.stringify({ base, when: new Date().toISOString(), report }, null, 1));
console.log('report', reportPath);
