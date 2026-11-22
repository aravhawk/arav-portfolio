#!/usr/bin/env node
/**
 * The home page at 120 Hz on a display that has only 60: is anything in the
 * flight a matter of frames instead of time?
 *
 *   NODE_PATH=<playwright modules> node scripts/flight-rate-check.mjs <base url> <out dir>
 *
 * The page's one frame loop (src/lib/frame.ts) is driven through
 * `requestAnimationFrame`. Here that is replaced: on every real frame the
 * page's callbacks are run once (60 Hz) or twice, 8.33 ms apart on the
 * frame clock (120 Hz), so each frame the page sees is half as long while
 * the wall clock is the same. The same visit is then made at both rates:
 * the entrance is let run, a fixed burst of wheel events is sent, and the
 * pointer is drawn across the lake. It writes, for each rate, the scroll
 * position, the camera's and the picture's own clock against time, and
 * compares them: where the scroll stands at each tenth of a second, how
 * long the entrance takes, how fast the picture's clock runs, when the
 * camera is called travelling and when the resolution is back.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

/** Installed before any page script: the frame loop at `hz` on the frame clock, whatever the display. */
function pace(hz) {
  const real = window.requestAnimationFrame.bind(window);
  const per = Math.max(1, Math.round(hz / 60));
  let queue = [];
  let id = 0;
  let clock = 0;
  window.requestAnimationFrame = (cb) => {
    queue.push([++id, cb]);
    return id;
  };
  window.cancelAnimationFrame = (handle) => {
    queue = queue.filter((q) => q[0] !== handle);
  };
  const tick = (t) => {
    if (!clock) clock = t;
    for (let i = 0; i < per; i++) {
      // (The frame clock runs with the wall clock: two steps of 8.33 ms to a 16.67 ms frame.)
      clock = Math.max(clock + 1000 / hz, t - (per - 1 - i) * (1000 / hz));
      const run = queue;
      queue = [];
      for (const [, cb] of run) cb(clock);
    }
    real(tick);
  };
  real(tick);
  window.__rate = { hz, log: [] };
}

async function visit(hz) {
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
  await ctx.addInitScript(pace, hz);
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.picture !== undefined, null, { timeout: 120000 });
  // Sample the page's state on the wall clock, every real frame, from the moment the picture is live.
  await page.evaluate(() => {
    const f = window.__flight;
    const t0 = performance.now();
    const log = window.__rate.log;
    let frames = 0;
    const orig = f.engine.frame.bind(f.engine);
    f.engine.frame = (...a) => {
      frames++;
      return orig(...a);
    };
    const sample = () => {
      const i = f.engine.info;
      log.push({ t: Math.round(performance.now() - t0), y: Math.round(scrollY), s: +f.state().s.toFixed(4), pos: f.state().pos.map((v) => +v.toFixed(2)), clock: +f.engine.time.toFixed(3), frames, scale: i.scale, travelling: i.travelling, opened: document.documentElement.dataset.opened !== undefined, base: i.base });
      setTimeout(sample, 16);
    };
    sample();
  });
  const mark = async (name) => page.evaluate((n) => window.__rate.log.push({ mark: n, t: window.__rate.log[window.__rate.log.length - 1].t }), name);
  await page.waitForTimeout(4200);
  await page.mouse.move(720, 450);
  await mark('wheel');
  // Twenty wheel events of 120 px, one every 25 ms: the same hand at either rate.
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(3500);
  await mark('pointer');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(1500);
  for (let i = 0; i <= 60; i++) {
    await page.mouse.move(400 + i * 10, 520 + 40 * Math.sin(i / 6));
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(800);
  const log = await page.evaluate(() => window.__rate.log);
  await browser.close();
  return log;
}

const runs = {};
for (const hz of [60, 120]) {
  runs[hz] = await visit(hz);
  writeFileSync(join(out, `rate-${hz}.json`), JSON.stringify(runs[hz]));
}

const summary = {};
for (const hz of [60, 120]) {
  const log = runs[hz];
  const rows = log.filter((r) => r.mark === undefined);
  const at = (name) => log.find((r) => r.mark === name).t;
  const wheel = at('wheel');
  const pointer = at('pointer');
  const after = rows.filter((r) => r.t >= wheel && r.t < pointer);
  const yAt = (ms) => after.find((r) => r.t >= wheel + ms)?.y ?? null;
  const settled = after.find((r) => r.t > wheel + 600 && Math.abs(r.y - after[after.length - 1].y) < 1);
  const first = rows[0];
  const lastRow = rows[rows.length - 1];
  summary[hz] = {
    framesASecond: +(((lastRow.frames - first.frames) / (lastRow.t - first.t)) * 1000).toFixed(1),
    displayIntervalSeen: lastRow.base,
    pictureClockPerSecond: +(((lastRow.clock - first.clock) / (lastRow.t - first.t)) * 1000).toFixed(3),
    entranceOverMs: rows.find((r) => r.opened)?.t ?? null,
    scrollAfterWheel: Object.fromEntries([100, 200, 300, 400, 600, 800, 1000, 1500, 2500].map((ms) => [ms, yAt(ms)])),
    scrollSettledMs: settled ? settled.t - wheel : null,
    scrollRestsAt: after[after.length - 1].y,
    travellingFromMs: (after.find((r) => r.travelling)?.t ?? wheel) - wheel,
    travellingForMs: (after.filter((r) => r.travelling).pop()?.t ?? wheel) - (after.find((r) => r.travelling)?.t ?? wheel),
    fullAgainMs: (after.find((r) => r.t > wheel + 400 && !r.travelling && r.scale === 1)?.t ?? wheel) - wheel,
  };
}
const a = summary[60];
const b = summary[120];
const worst = Math.max(...Object.keys(a.scrollAfterWheel).map((k) => Math.abs((a.scrollAfterWheel[k] ?? 0) - (b.scrollAfterWheel[k] ?? 0))));
const verdict = {
  scrollCurveWorstDifferencePx: worst,
  pictureClockDifferencePercent: +((Math.abs(a.pictureClockPerSecond - b.pictureClockPerSecond) / a.pictureClockPerSecond) * 100).toFixed(2),
  entranceDifferenceMs: Math.abs((a.entranceOverMs ?? 0) - (b.entranceOverMs ?? 0)),
  settleDifferenceMs: Math.abs((a.scrollSettledMs ?? 0) - (b.scrollSettledMs ?? 0)),
};
writeFileSync(join(out, 'rate-summary.json'), JSON.stringify({ summary, verdict }, null, 1));
console.log(JSON.stringify({ summary, verdict }, null, 1));
