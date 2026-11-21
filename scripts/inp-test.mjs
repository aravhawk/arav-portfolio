#!/usr/bin/env node
/**
 * How long the home page takes to answer the reader: a scripted set of
 * real interactions (pointer and key events from the browser's own input
 * path), each measured as the browser measures an interaction for INP: from
 * the event to the next frame painted after its handlers.
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/inp-test.mjs --base http://localhost:3183 [--profile tall]
 *
 * The interactions: the theme toggle; a nav link (and the way back); a
 * wheel scroll (not an interaction to INP: the longest frame gap after it
 * is reported in its place); a tap on a link in the flight (a project's
 * name, at its station); the rail; the switch in cc-switch's words.
 * It prints each interaction's longest event and the worst of all.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3183').replace(/\/$/, '');
const tall = arg('profile', 'wide') === 'tall';
const V = tall ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: V, deviceScaleFactor: 2, isMobile: tall, hasTouch: tall });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__ev = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.interactionId) window.__ev.push({ name: e.name, dur: Math.round(e.duration), delay: Math.round(e.processingStart - e.startTime), work: Math.round(e.processingEnd - e.processingStart) });
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
});
const settle = async (ms = 900) => page.waitForTimeout(ms);
const take = async (what) => {
  await settle();
  const ev = await page.evaluate(() => window.__ev.splice(0));
  const worst = ev.reduce((a, b) => (b.dur > (a?.dur ?? -1) ? b : a), null);
  rows.push({ what, ms: worst ? worst.dur : '<16', event: worst ? worst.name : '', delay: worst?.delay ?? 0, handlers: worst?.work ?? 0 });
};
const rows = [];
const press = (sel) => (tall ? page.tap(sel) : page.click(sel));

await page.goto(`${base}/`, { waitUntil: 'load' });
await page.waitForFunction(() => !!document.querySelector('.flight-root[data-picture]'), null, { timeout: 30000 }).catch(() => {});
await settle(3500);
await page.evaluate(() => window.__ev.splice(0));

await press('button[aria-label^="Switch to"]');
await take('theme toggle (to dark)');
await press('button[aria-label^="Switch to"]');
await take('theme toggle (to light)');

// A wheel scroll: the longest gap between frames in the second after it.
const gap = await page.evaluate(async () => {
  let worst = 0;
  let last = performance.now();
  const until = last + 1200;
  window.scrollBy(0, window.innerHeight * 0.8);
  while (performance.now() < until) {
    const now = await new Promise((r) => requestAnimationFrame(r));
    worst = Math.max(worst, now - last);
    last = now;
  }
  return Math.round(worst);
});
rows.push({ what: 'scroll (longest frame gap in the next 1.2 s)', ms: gap, event: 'frame', delay: 0, handlers: 0 });

// A link in the flight: Infiniview's name at its station.
await page.evaluate(() => window.scrollTo(0, 5.6 * window.__player.state().unit));
await page.waitForFunction(() => window.__player.settled(), null, { timeout: 10000 }).catch(() => {});
await settle(700);
await page.evaluate(() => window.__ev.splice(0));
await press('.fl-view-words[data-on] a.beat-link');
await page.waitForURL('**/work/infiniview', { timeout: 10000 });
await take('a link in the flight (Infiniview)');
await page.goBack();
await page.waitForFunction(() => !!window.__player, null, { timeout: 10000 });
await settle(1500);
await page.evaluate(() => window.__ev.splice(0));

if (!tall) {
  await page.click('.fl-rail a:nth-child(6)');
  await take('a tick of the rail');
}
// The switch in cc-switch's words.
const stop = await page.evaluate(() => Number(document.querySelector('.fl-fork')?.closest('[data-fl-from]')?.dataset.flIn ?? 0) + 0.6);
await page.evaluate((s) => window.scrollTo(0, s * window.__player.state().unit), stop);
await page.waitForFunction(() => window.__player.settled(), null, { timeout: 10000 }).catch(() => {});
await settle(700);
await page.evaluate(() => window.__ev.splice(0));
await press('.fl-fork .switch-opt:nth-of-type(2)').catch(() => {});
await take('the switch (second profile)');

await page.evaluate(() => window.scrollTo(0, 0));
await settle(1200);
await page.evaluate(() => window.__ev.splice(0));
await press('a.nav-link[href="/work"]');
await page.waitForURL('**/work', { timeout: 10000 });
await take('nav link (Work)');
await press('a.nav-mark');
await page.waitForURL(`${base}/`, { timeout: 10000 });
await take('nav link (home)');

await browser.close();
for (const r of rows) console.log(`${String(r.ms).padStart(5)} ms  ${r.what}${r.event ? `  [${r.event}, input delay ${r.delay}, handlers ${r.handlers}]` : ''}`);
const nums = rows.filter((r) => r.event !== 'frame' && typeof r.ms === 'number').map((r) => r.ms);
console.log(`worst interaction: ${nums.length ? Math.max(...nums) : '<16'} ms`);
