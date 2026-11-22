#!/usr/bin/env node
/**
 * The home page in Playwright's WebKit build: does it draw, is it paced,
 * and what are its frame intervals over a reader's scroll?
 *
 *   NODE_PATH=<playwright modules> node scripts/flight-webkit.mjs <base url> <out dir> [--theme dark]
 *
 * It is not Safari (its GPU process and its compositor are the test
 * build's), so it settles that the engine's WebGL2 path, the calibration
 * behind the still (fences, no timer query) and the pace run on WebKit;
 * frame times on the owner's Safari are his machine's to show.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { webkit } = createRequire(import.meta.url)('playwright');
const [base, out, ...rest] = process.argv.slice(2);
const theme = rest.includes('--theme') ? rest[rest.indexOf('--theme') + 1] : 'light';
mkdirSync(out, { recursive: true });
const viewport = { width: 1440, height: 900 };
const browser = await webkit.launch({ headless: false });
const errors = [];
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, colorScheme: theme });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const t0 = Date.now();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.picture !== undefined || document.documentElement.dataset.flight === 'off', null, { timeout: 180000 });
  const liveMs = Date.now() - t0;
  await page.waitForTimeout(4500);
  const state = (label) =>
    page.evaluate((label) => {
      const f = window.__flight;
      if (!f) return { label, flight: document.documentElement.dataset.flight ?? null };
      const i = f.engine.info;
      const gl = f.engine.gl;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return { label, s: +f.state().s.toFixed(2), paced: i.paced, speed: i.speed, base: i.base, scale: i.scale, every: i.every, lean: i.lean, travelling: i.travelling, backing: i.backing, tiles: i.tiles, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), cover: i.cover };
    }, label);
  const rows = [await state('at rest, first screen')];
  await page.screenshot({ path: join(out, `webkit-${theme}-0.png`) });
  await page.evaluate(() => {
    window.__iv = [];
    let last = performance.now();
    const tick = (t) => {
      window.__iv.push([+(t - last).toFixed(1), window.__flight?.engine.info.scale ?? 1, +(scrollY / innerHeight).toFixed(2)]);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const start = Date.now();
  let n = 0;
  for (;;) {
    const want = Math.min(max, ((Date.now() - start) / 1000) * 0.8 * viewport.height);
    const at = await page.evaluate(() => window.scrollY);
    if (at >= max - 1) break;
    if (want - at > 4) await page.mouse.wheel(0, Math.min(140, want - at));
    await page.waitForTimeout(16);
    if (++n % 400 === 0) rows.push(await state('scrolling'));
    if (Date.now() - start > 90000) break;
  }
  await page.waitForTimeout(1500);
  rows.push(await state('at rest, the foot'));
  await page.screenshot({ path: join(out, `webkit-${theme}-foot.png`) });
  const iv = await page.evaluate(() => window.__iv);
  const sorted = iv.map((x) => x[0]).sort((a, b) => a - b);
  const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  const summary = { theme, liveMs, frames: iv.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), worst: sorted[sorted.length - 1], over20: iv.filter((x) => x[0] > 20).length, over34: iv.filter((x) => x[0] > 34).length, over50: iv.filter((x) => x[0] > 50).length, scaleOnTheMove: [Math.min(...iv.map((x) => x[1])), Math.max(...iv.map((x) => x[1]))], reached: await page.evaluate(() => +(scrollY / innerHeight).toFixed(1)), errors, rows };
  writeFileSync(join(out, `webkit-${theme}.json`), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ ...summary, rows: rows.map((r) => ({ ...r, tiles: r.tiles?.length, cover: r.cover?.length })) }, null, 1));
} finally {
  await browser.close();
}
