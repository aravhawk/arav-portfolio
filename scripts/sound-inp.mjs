#!/usr/bin/env node
/**
 * What the sound's start costs the page: the longest task on the page's
 * thread round the first gesture (the one that starts the sound), and the
 * interaction time (as INP measures it: from the event to the next frame
 * painted after its handlers) of that gesture, of the press that mutes
 * and of the press that turns sound back on.
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/sound-inp.mjs --base http://localhost:3185 [--profile tall] [--slow 4]
 *
 * --slow n makes the page's thread n times slower (a phone). Exits 1 if a
 * task is over 50 ms in the second after the first gesture, or an
 * interaction is 100 ms or more.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3185').replace(/\/$/, '');
const tall = arg('profile', 'wide') === 'tall';
const slow = +arg('slow', '1');
const V = tall ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let bad = 0;
const rows = [];
for (let run = 0; run < 3; run++) {
  const ctx = await browser.newContext({ viewport: V, deviceScaleFactor: 2, isMobile: tall, hasTouch: tall });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__ev = [];
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.interactionId) window.__ev.push({ name: e.name, at: Math.round(e.startTime), dur: Math.round(e.duration), delay: Math.round(e.processingStart - e.startTime), work: Math.round(e.processingEnd - e.processingStart) });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push({ at: Math.round(e.startTime), dur: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
  });
  if (slow > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
  }
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.querySelector('.flight-root[data-picture]'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const measure = async (what, act, wait = 2500) => {
    const t0 = await page.evaluate(() => {
      window.__ev.length = 0;
      window.__long.length = 0;
      return performance.now();
    });
    await act();
    await page.waitForTimeout(wait);
    const r = await page.evaluate((from) => ({ ev: window.__ev.slice(), long: window.__long.filter((l) => l.at >= from - 5 && l.at < from + 1500), playing: document.documentElement.hasAttribute('data-sound-live'), choice: document.documentElement.dataset.sound }), t0);
    const worst = r.ev.reduce((a, b) => (b.dur > (a?.dur ?? -1) ? b : a), null);
    const task = r.long.reduce((a, b) => Math.max(a, b.dur), 0);
    rows.push({ run: run + 1, what, interaction: worst ? `${worst.dur} ms (${worst.name}: ${worst.delay} waiting, ${worst.work} in handlers)` : 'under 16 ms', longestTask: task ? `${task} ms` : 'none over 50 ms', state: `${r.choice}${r.playing ? ', playing' : ''}` });
    if (task > 50 || (worst && worst.dur >= 100)) bad++;
  };
  const spot = tall ? [195, 520] : [700, 520];
  await measure('the first gesture (a press on the page): the sound starts', () => (tall ? page.touchscreen.tap(...spot) : page.mouse.click(...spot)));
  await measure('a press on the control: mute', () => (tall ? page.tap('.nav-sound') : page.click('.nav-sound')), 1200);
  await measure('a press on the control: sound on again', () => (tall ? page.tap('.nav-sound') : page.click('.nav-sound')), 1500);
  await measure('the M key: mute', () => page.keyboard.press('m'), 1000);
  await ctx.close();
}
console.table(rows);
console.log(`${tall ? 'phone screen' : 'wide screen'}, thread ${slow} times slower: ${bad ? `${bad} over the limits (a task over 50 ms, or an interaction of 100 ms or more)` : 'every task under 50 ms and every interaction under 100 ms'}`);
await browser.close();
process.exit(bad ? 1 : 0);
