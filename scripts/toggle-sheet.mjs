// The theme switch on one sheet: at rest, pointed at, focused from the keyboard and pressed, off (light) and on
// (dark), at 1x and at 2x, each enlarged so its pixels can be counted; then the knob's travel, frame by frame, with
// motion and with reduced motion.
//
//   NODE_PATH=<playwright modules> node scripts/toggle-sheet.mjs <base> <outdir>
//
// Writes toggle-sheet.png and toggle.json (the control's name, role, state, target size and what the keys do).

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');

const base = (process.argv[2] || 'http://localhost:3184').replace(/\/$/, '');
const out = process.argv[3] || '.tools/out/toggle';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const shots = [];
const facts = {};

async function open(theme, dpr, extra = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 600 }, deviceScaleFactor: dpr, colorScheme: theme, ...extra });
  await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await context.newPage();
  await page.goto(base + '/work', { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return { context, page };
}
const clipOf = async (page) => {
  const b = await page.locator('.nav-toggle').boundingBox();
  return { x: Math.round(b.x) - 6, y: Math.round(b.y) - 2, width: Math.round(b.width) + 12, height: Math.round(b.height) + 4 };
};
const snap = async (page, label) => shots.push({ label, png: (await page.screenshot({ clip: await clipOf(page) })).toString('base64') });

for (const dpr of [1, 2])
  for (const theme of ['light', 'dark']) {
    const { context, page } = await open(theme, dpr);
    const toggle = page.locator('.nav-toggle');
    const tag = `${theme === 'dark' ? 'on (dark)' : 'off (light)'} ${dpr}x`;
    await page.mouse.move(10, 300);
    await snap(page, `${tag} rest`);
    await toggle.hover();
    await page.waitForTimeout(300);
    await snap(page, `${tag} hover`);
    await page.mouse.move(10, 300);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.classList.contains('nav-toggle'))) break;
    }
    await page.waitForTimeout(200);
    await snap(page, `${tag} focus`);
    await page.evaluate(() => document.activeElement?.blur());
    await toggle.hover();
    await page.mouse.down();
    await page.waitForTimeout(250);
    await snap(page, `${tag} pressed`);
    await page.mouse.move(10, 300);
    await page.mouse.up();
    if (dpr === 1 && theme === 'light') {
      await page.waitForTimeout(300);
      const box = await toggle.boundingBox();
      const track = await page.locator('.nav-toggle-track').boundingBox();
      const knob = await page.locator('.nav-toggle-knob').first().boundingBox();
      facts.role = await toggle.getAttribute('role');
      facts.name = await toggle.getAttribute('aria-label');
      facts.checkedInLight = await toggle.getAttribute('aria-checked');
      facts.target = `${box.width} x ${box.height}`;
      facts.track = `${track.width} x ${track.height} at ${track.x}, ${track.y}`;
      facts.knob = `${knob.width} x ${knob.height} at ${knob.x}, ${knob.y}`;
      // From the keyboard: Space and Enter each change it, it says its new state, and nothing is in transition.
      await toggle.focus();
      await page.keyboard.press('Space');
      facts.afterSpace = { theme: await page.evaluate(() => document.documentElement.dataset.theme), checked: await toggle.getAttribute('aria-checked'), stored: await page.evaluate(() => localStorage.getItem('theme')), running: await page.evaluate(() => document.querySelector('.nav-toggle').getAnimations({ subtree: true }).length) };
      await page.keyboard.press('Enter');
      facts.afterEnter = { theme: await page.evaluate(() => document.documentElement.dataset.theme), checked: await toggle.getAttribute('aria-checked'), running: await page.evaluate(() => document.querySelector('.nav-toggle').getAnimations({ subtree: true }).length) };
      // With the pointer: what moves, and for how long.
      await toggle.click();
      facts.afterClick = await page.evaluate(() =>
        document.querySelector('.nav-toggle').getAnimations({ subtree: true }).map((a) => `${a.transitionProperty} ${a.effect.getTiming().duration} ms ${a.effect.getTiming().easing}`),
      );
      await page.waitForTimeout(400);
      await toggle.click();
      await page.waitForTimeout(400);
    }
    await context.close();
  }

// The first paint follows the system when nothing is stored, and the stored choice when one is.
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 600 }, colorScheme: scheme });
  const page = await context.newPage();
  await page.goto(base + '/work', { waitUntil: 'commit' });
  await page.waitForSelector('.nav-toggle');
  (facts.firstPaint ??= {})[`system ${scheme}, nothing stored`] = await page.evaluate(() => document.documentElement.dataset.theme);
  await context.close();
}

// The travel, frame by frame: the transition is held at fixed times and photographed.
for (const reduced of [false, true]) {
  const { context, page } = await open('light', 2, { reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.mouse.move(10, 300);
  await page.evaluate(() => document.querySelector('.nav-toggle').click());
  // (That click came from script, so it counts as the keyboard's: say it was a pointer's, and start again.)
  await page.evaluate(() => {
    const t = document.querySelector('.nav-toggle');
    t.click();
    t.removeAttribute('data-instant');
    void t.offsetWidth;
    document.documentElement.dataset.theme = 'dark';
    for (const a of document.getAnimations()) a.pause();
  });
  for (const ms of [0, 30, 60, 90, 120, 180]) {
    await page.evaluate((t) => { for (const a of document.getAnimations()) a.currentTime = t; }, ms);
    await snap(page, `${reduced ? 'reduced motion' : 'motion'} ${ms} ms`);
  }
  await context.close();
}

// (The sheet is laid out by a browser of its own: one that has just held a paused transition will not always photograph a new page.)
await browser.close();
const press = await chromium.launch();
const sheet = await press.newPage({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1 });
const cell = (s) => `<figure><img src="data:image/png;base64,${s.png}"><figcaption>${s.label}</figcaption></figure>`;
const rows = [shots.slice(0, 4), shots.slice(4, 8), shots.slice(8, 12), shots.slice(12, 16), shots.slice(16, 22), shots.slice(22, 28)];
await sheet.setContent(`<style>
  body{margin:0;padding:24px;background:#8a9197;font:12px ui-monospace,Menlo,monospace;color:#0a0c0e}
  .row{display:flex;gap:14px;margin-bottom:18px;flex-wrap:wrap}
  figure{margin:0} img{display:block;height:192px;image-rendering:pixelated} figcaption{margin-top:6px}
</style>${rows.map((r) => `<div class="row">${r.map(cell).join('')}</div>`).join('')}`);
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: join(out, 'toggle-sheet.png'), fullPage: true });
writeFileSync(join(out, 'toggle.json'), JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts, null, 1));
await press.close();
