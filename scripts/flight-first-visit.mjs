#!/usr/bin/env node
/**
 * A first visit to the home page, with programs the driver has never built.
 *
 *   NODE_PATH=<playwright modules> node scripts/flight-first-visit.mjs <base url> <out dir>
 *     [--theme light|dark] [--profile wide|phone] [--speed 0.8] [--wait 3000] [--warm]
 *
 * Every fragment shader is given an unreachable branch with a literal of its
 * own, so the driver's store of built programs has none of them (a harness
 * that has run before would otherwise never see a first build). It reports
 * the time from the navigation to the live picture; then, after `--wait` ms
 * of looking at it, scrolls to the foot at `--speed` screens a second and
 * lists every frame over 20 ms and every task over 50 ms from the moment the
 * picture is live, each with what the engine was building then, and every
 * program the engine built less than 400 ms after the reader last did
 * anything. `--warm` leaves the shaders alone and visits twice: the second
 * visit is the returning reader's.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const [base, out, ...rest] = process.argv.slice(2);
const arg = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i < 0 ? def : rest[i + 1];
};
const theme = arg('theme', 'light');
const profile = arg('profile', 'wide');
const speed = Number(arg('speed', '0.8'));
const look = Number(arg('wait', '3000'));
const warm = rest.includes('--warm');
mkdirSync(out, { recursive: true });
const phone = profile === 'phone';
const viewport = phone ? { width: 390, height: 844 } : { width: 1728, height: 1117 };

function instrument() {
  const log = { frames: [], tasks: [], live: 0, flight: 0 };
  window.__visit = log;
  let last = 0;
  const tick = (t) => {
    if (last) log.frames.push([Math.round(t), +(t - last).toFixed(1), +(scrollY / innerHeight).toFixed(2)]);
    last = t;
    const d = document.documentElement.dataset;
    if (!log.flight && d.flight === 'on') log.flight = Math.round(t);
    if (!log.live && d.picture !== undefined) log.live = Math.round(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) log.tasks.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    /* Chromium only */
  }
}

const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme, isMobile: phone, hasTouch: phone });
  if (!warm) {
    await ctx.addInitScript((seed) => {
      let n = seed;
      const proto = WebGL2RenderingContext.prototype;
      const original = proto.shaderSource;
      proto.shaderSource = function (shader, source) {
        if (this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER) source = source.replace(/void main\(\)\s*\{/, (body) => body + 'if(gl_FragCoord.x > ' + ++n + '.0) discard;');
        return original.call(this, shader, source);
      };
    }, 100000 + Math.floor(Math.random() * 8000000));
  }
  await ctx.addInitScript(instrument);
  for (const visit of warm ? ['first', 'again'] : ['cold']) {
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(base + '/', { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__visit?.live, null, { timeout: 180000 });
    await page.waitForTimeout(look);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const pxPerSec = speed * viewport.height;
    const t0 = Date.now();
    if (phone) {
      for (;;) {
        const want = Math.min(max, ((Date.now() - t0) / 1000) * pxPerSec);
        await page.evaluate((y) => window.scrollTo(0, y), want);
        await page.waitForTimeout(16);
        if (want >= max) break;
      }
    } else {
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      let reached = 0;
      let stalled = 0;
      for (;;) {
        const want = Math.min(max + 400, ((Date.now() - t0) / 1000) * pxPerSec);
        const at = await page.evaluate(() => window.scrollY);
        if (at >= max - 1) break;
        stalled = at <= reached + 0.5 ? stalled + 1 : 0;
        reached = Math.max(reached, at);
        if (stalled > 240) break;
        const behind = want - at;
        if (behind > 4) await page.mouse.wheel(0, Math.min(speed > 3 ? 1200 : 140, behind));
        await page.waitForTimeout(16);
      }
    }
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ ...window.__visit, builds: window.__flight?.engine.buildLog ?? [], info: window.__flight?.engine.info, y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    const after = r.frames.filter((f) => f[0] > r.live);
    const late = after.filter((f) => f[1] > 20);
    const near = (t, span) => r.builds.filter((b) => b.t > t - span - 20 && b.t <= t + 20).map((b) => `${b.what} ${b.key}`);
    const row = {
      visit,
      theme,
      profile,
      speed,
      liveMs: r.live,
      flightOnMs: r.flight,
      framesAfterLive: after.length,
      over20: late.length,
      over34: after.filter((f) => f[1] > 34).length,
      over50: after.filter((f) => f[1] > 50).length,
      worst: Math.max(0, ...after.map((f) => f[1])),
      late: late.map((f) => ({ at: f[0], ms: f[1], screen: f[2], building: near(f[0], f[1]) })),
      tasksAfterLive: r.tasks.filter((t) => t[0] > r.live).map((t) => ({ at: t[0], ms: t[1], building: near(t[0] + t[1], t[1]) })),
      tasksBeforeLive: r.tasks.filter((t) => t[0] <= r.live).map((t) => t[1]),
      builtWhileBusy: r.builds.filter((b) => b.t > r.live && b.what !== 'live' && b.quiet < 400),
      builds: r.builds.length,
      reached: `${(r.y / viewport.height).toFixed(1)} of ${(r.max / viewport.height).toFixed(1)}`,
      variants: r.info?.variants,
    };
    rows.push(row);
    console.log(JSON.stringify({ ...row, late: row.late.slice(0, 40), variants: undefined }, null, 1));
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(join(out, `visit-${warm ? 'warm' : 'cold'}-${profile}-${theme}-${speed}.json`), JSON.stringify(rows, null, 1));
