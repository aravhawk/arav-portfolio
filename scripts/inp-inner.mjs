#!/usr/bin/env node
/**
 * How long an inner page takes to answer the reader: real interactions on
 * /work and on a project page, each measured as the browser measures one
 * for INP (from the event to the next frame painted after its handlers).
 * The home page has its own: scripts/inp-test.mjs.
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/inp-inner.mjs --base http://localhost:3184 [--profile tall] [--slow 4]
 *
 * `--slow 4` runs the page's thread four times slower (a middling phone).
 * The interactions: the theme switch both ways, the sound control, the copy
 * button, a link to another site, the profile switch on cc-switch's page,
 * a row of the index (to its page) and the way back by the nav.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3184').replace(/\/$/, '');
const tall = arg('profile', 'wide') === 'tall';
const slow = Number(arg('slow', '1'));
const V = tall ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: V, deviceScaleFactor: 2, isMobile: tall, hasTouch: tall, permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.route((url) => !url.href.startsWith(base) && /^https?:/.test(url.href), (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '' }));
const page = await ctx.newPage();
if (slow > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: slow });
await page.addInitScript(() => {
  window.__ev = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.interactionId) window.__ev.push({ name: e.name, dur: Math.round(e.duration), delay: Math.round(e.processingStart - e.startTime), work: Math.round(e.processingEnd - e.processingStart) });
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
});

const rows = [];
const take = async (what) => {
  await page.waitForTimeout(700);
  const ev = await page.evaluate(() => window.__ev.splice(0)).catch(() => []);
  const worst = ev.reduce((a, b) => (b.dur > (a?.dur ?? -1) ? b : a), null);
  rows.push({ what, ms: worst ? worst.dur : '<16', event: worst?.name ?? '', delay: worst?.delay ?? 0, handlers: worst?.work ?? 0 });
};
/** A real press at the element's place, brought to mid-screen first. */
const press = async (sel, where) => {
  const el = page.locator(sel).first();
  await el.evaluate((n) => n.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__ev.splice(0));
  const b = await el.boundingBox();
  if (tall) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await take(where);
};
const open = async (route) => {
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
};

await open('/work');
await press('.nav-toggle', '/work: theme switch (to dark)');
await press('.nav-toggle', '/work: theme switch (to light)');
await press('.nav-sound', '/work: sound on');
await press('.nav-sound', '/work: sound off');
await press('.tool-links a', '/work: a tool\'s source (new tab)');
for (const p of ctx.pages().slice(1)) await p.close();
await press('.end-copy', '/work: copy the email address');
await press('a.feat-row[href="/work/cc-switch"]', '/work: a row, to its page');
await page.waitForURL('**/work/cc-switch', { timeout: 10000 });
await page.waitForTimeout(1500);
await press('.switch [role="radio"]:nth-of-type(2)', '/work/cc-switch: profile switch (kimi)');
await press('.switch [role="radio"]:nth-of-type(3)', '/work/cc-switch: profile switch (ollama)');
await press('.nav-toggle', '/work/cc-switch: theme switch');
await press('.nav-toggle', '/work/cc-switch: theme switch (back)');
await press('.end-copy', '/work/cc-switch: copy the email address');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(600);
await press('a.nav-link[href="/work"]', '/work/cc-switch: the nav, back to the index');
await page.waitForURL('**/work', { timeout: 10000 });

console.log(`${V.width} x ${V.height}${slow > 1 ? `, thread ${slow}x slower` : ''}`);
for (const r of rows) console.log(`${String(r.ms).padStart(4)} ms  ${r.what}${r.event ? `  (${r.event}: waited ${r.delay} ms, handlers ${r.handlers} ms)` : ''}`);
const worst = Math.max(0, ...rows.map((r) => (typeof r.ms === 'number' ? r.ms : 0)));
console.log(`worst: ${worst || '<16'} ms`);
await browser.close();
process.exit(worst > 100 ? 1 : 0);
