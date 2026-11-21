#!/usr/bin/env node
/**
 * Proof that no page a visitor opens loads the engine.
 *
 * It opens each route in Chromium, scrolls the whole page (so whatever is
 * loaded late is loaded), presses nothing, and lists every script the page
 * fetched, workers included, with its size. Each script's text is searched
 * for marks that only the engine's code carries (its shaders' uniforms, its
 * classes); one found is a failure. The renderer's own route, `/render`,
 * is listed last as the control: it must carry them.
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/engine-absent.mjs --base http://localhost:3183 [--routes /,/work]
 */
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3183').replace(/\/$/, '');
const routes = arg('routes', '/,/work,/work/infiniview,/blog').split(',');
/** Text only the engine has: uniforms of the shading pass, the simulation's programs, the engine's own names. */
const MARKS = ['uCamPos', 'uSkyK', 'mountPano', 'iceGlacier', 'FlightEngine', 'compileBegin', 'paintWorld', 'getUniformBlockIndex', 'uJacobi', 'snowShadowBearing'];

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let failed = false;
for (const route of [...routes, '/render']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const scripts = new Map();
  page.on('response', async (res) => {
    const type = res.request().resourceType();
    const url = res.url();
    if (type !== 'script' && !/\.js(\?|$)/.test(url)) return;
    try {
      const body = await res.text();
      // (Its size on the wire: what it is gzipped. A local server sends it chunked and does not say.)
      scripts.set(url.replace(base, ''), { size: gzipSync(body).length, raw: Buffer.byteLength(body), marks: MARKS.filter((m) => body.includes(m)) });
    } catch {
      // (A response the browser dropped: nothing to read.)
    }
  });
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= max; y += 2400) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(1500);
  const rows = [...scripts.entries()];
  const hit = rows.filter(([, s]) => s.marks.length);
  const total = rows.reduce((a, [, s]) => a + s.size, 0);
  const control = route === '/render';
  console.log(`\n${route}  ${rows.length} scripts, ${(total / 1024).toFixed(0)} kB gzipped, ${(rows.reduce((a, [, s]) => a + s.raw, 0) / 1024).toFixed(0)} kB of text${control ? '  (the renderer: the control)' : ''}`);
  for (const [url, s] of rows) console.log(`  ${String((s.size / 1024).toFixed(1)).padStart(7)} kB  ${url.split('/').pop().slice(0, 60)}${s.marks.length ? `  ENGINE: ${s.marks.join(', ')}` : ''}`);
  if (control ? !hit.length : hit.length) {
    failed = true;
    console.log(control ? '  FAIL: the control found no engine: the marks are stale' : `  FAIL: ${hit.length} script(s) carry the engine`);
  } else console.log(control ? '  ok: the engine is here, and only here' : '  ok: no engine');
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
