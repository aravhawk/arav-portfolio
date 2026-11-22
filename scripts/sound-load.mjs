#!/usr/bin/env node
/**
 * When the sound's code is fetched, and what it weighs.
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/sound-load.mjs --base http://localhost:3185 [--routes /,/work,/blog] [--press] [--muted]
 *
 * For each route, a first visit in Chromium: every script the page asks
 * for, when (ms from the start of the navigation), its size gzipped, and
 * whether it is the sound's (it holds the sound's own marker) or carries
 * shader text. Against that: the first paint, the largest paint and the
 * end of the load. The page is then left alone for eight seconds (the
 * idle fetch, if the page has one), and with --press the sound control is
 * pressed. --muted visits as a reader who muted before.
 *
 * Prints one table a route and a summary line: the sound's files, their
 * gzipped total, whether any was asked for before the largest paint.
 */
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const has = (name) => process.argv.includes(`--${name}`);
const base = arg('base', 'http://localhost:3185').replace(/\/$/, '');
const routes = arg('routes', '/').split(',');
/** What marks a file as the sound's own, and what marks shader text. */
const SOUND = /soundtier|createStereoPanner|createBiquadFilter/;
const GLSL = /precision highp|gl_FragCoord|gl_Position/;

const browser = await chromium.launch({ headless: true });
/** Every script a reader who had muted is sent on a route, by name. */
async function namesFor(route) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('sound', 'off'));
  const page = await ctx.newPage();
  const names = new Set();
  page.on('response', (res) => {
    if (/\.js(\?|$)/.test(res.url())) names.add(res.url().split('/').pop());
  });
  await page.goto(`${base}${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(8000);
  await ctx.close();
  return names;
}
let bad = 0;
for (const route of routes) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (has('muted')) await ctx.addInitScript(() => localStorage.setItem('sound', 'off'));
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const files = [];
  let t0 = 0;
  page.on('request', (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) t0 = Date.now();
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (!/\.js(\?|$)/.test(url)) return;
    const at = Date.now() - t0;
    try {
      const body = await res.body();
      const text = body.toString('utf8');
      files.push({ at, name: url.split('/').pop(), raw: body.length, gz: gzipSync(body, { level: 9 }).length, sound: SOUND.test(text), glsl: GLSL.test(text), phase: phase() });
    } catch {
      /* a response whose body is gone: not a script the page kept */
    }
  });
  let stage = 'load';
  const phase = () => stage;
  await page.goto(`${base}${route}`, { waitUntil: 'load' });
  const paint = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0, load: performance.timing.loadEventEnd - performance.timing.navigationStart }));
  stage = 'idle';
  await page.waitForTimeout(8000);
  const lcp = await page.evaluate(() => window.__lcp);
  if (has('press')) {
    stage = 'press';
    const btn = page.locator('.nav-sound');
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(3000);
    }
  }
  const control = await page.locator('.nav-sound').count();
  console.log(`\n${route}  first paint ${Math.round(paint.fcp)} ms, largest paint ${Math.round(lcp)} ms, load ${paint.load} ms, sound control: ${control ? 'yes' : 'no'}`);
  for (const f of files.sort((a, b) => a.at - b.at)) console.log(`  ${String(f.at).padStart(6)} ms  ${f.phase.padEnd(5)}  ${String(f.gz).padStart(7)} gz  ${String(f.raw).padStart(8)} raw  ${f.sound ? 'SOUND' : '     '} ${f.glsl ? 'GLSL' : '    '}  ${f.name}`);
  // The sound's files: what this visit asked for that the same visit by a reader who had muted does not (that
  // reader is never sent the sound). One of them holds the sound's own marker.
  const quiet = has('muted') ? null : await namesFor(route);
  const snd = quiet ? files.filter((f) => !quiet.has(f.name)) : files.filter((f) => f.sound);
  const mark = snd.find((f) => f.sound) ?? snd[0];
  const sum = (a) => a.reduce((s, f) => s + f.gz, 0);
  const beforeLcp = snd.filter((f) => f.at < lcp).length;
  console.log(`  the sound's files: ${snd.length}, ${sum(snd)} B gzipped (${snd.map((f) => `${f.name} ${f.gz}`).join(', ') || 'none fetched'}); with shader text: ${snd.filter((f) => f.glsl).length}; asked for ${mark ? `${mark.at} ms in, in the '${mark.phase}' phase` : 'never'}; before the load ended: ${snd.filter((f) => f.phase === 'load').length}; before the largest paint: ${beforeLcp}`);
  if (snd.some((f) => f.phase === 'load') || beforeLcp || snd.some((f) => f.glsl)) bad++;
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
