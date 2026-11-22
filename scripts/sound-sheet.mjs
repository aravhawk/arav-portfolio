// The sound control on one sheet: on and waiting, on and playing, muted; each at rest, pointed at, focused from the
// keyboard and pressed; in both themes; at 1x and at 2x, enlarged so its pixels can be counted; then the whole group
// it stands in, and a phone's.
//
//   NODE_PATH=<playwright modules> node scripts/sound-sheet.mjs <base> <outdir>
//
// Writes sound-sheet.png and sound.json (the control's name and title in each state, its target, its mark's box,
// what is in transition after a press with the pointer and after one from the keys, and what the M key does).
//
// How each state is held for its photograph: waiting, the page is given no audio context to make (so a press or a
// key cannot start the sound under the camera); playing, the page is clicked once and left two seconds; muted, the
// reader's stored choice is "off".

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');

const base = (process.argv[2] || 'http://localhost:3184').replace(/\/$/, '');
const out = process.argv[3] || '.tools/out/sound';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const facts = { states: {} };
const STATES = ['waiting', 'playing', 'muted'];

async function open(state, theme, dpr, extra = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 700 }, deviceScaleFactor: dpr, colorScheme: theme, ...extra });
  await context.addInitScript(
    ([t, s]) => {
      localStorage.setItem('theme', t);
      if (s === 'muted') localStorage.setItem('sound', 'off');
      if (s === 'waiting') {
        delete window.AudioContext;
        delete window.webkitAudioContext;
      }
    },
    [theme, state],
  );
  const page = await context.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  if (state === 'playing') {
    if (extra.hasTouch) await page.touchscreen.tap(200, 520);
    else await page.mouse.click(700, 520);
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-sound-live'), null, { timeout: 15000 });
    await page.waitForTimeout(600);
  }
  return { context, page };
}
const clipOf = async (page, sel = '.nav-sound', pad = 8) => {
  const b = await page.locator(sel).boundingBox();
  return { x: Math.round(b.x) - pad, y: Math.round(b.y) - 2, width: Math.round(b.width) + 2 * pad, height: Math.round(b.height) + 4 };
};
const snap = async (page, sel, pad) => (await page.screenshot({ clip: await clipOf(page, sel, pad) })).toString('base64');
const away = { x: 10, y: 400 };

const grid = [];
for (const dpr of [1, 2])
  for (const theme of ['light', 'dark'])
    for (const state of STATES) {
      const { context, page } = await open(state, theme, dpr);
      const control = page.locator('.nav-sound');
      const row = { label: `${state}, ${theme}, ${dpr}x`, cells: [] };
      await page.mouse.move(away.x, away.y);
      await page.waitForTimeout(250);
      row.cells.push(['rest', await snap(page)]);
      await control.hover();
      await page.waitForTimeout(300);
      row.cells.push(['hover', await snap(page)]);
      await page.mouse.move(away.x, away.y);
      await control.focus();
      // (Focus as the keyboard gives it: the ring is for keys only.)
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(250);
      row.cells.push(['focus', await snap(page)]);
      await page.evaluate(() => document.activeElement?.blur());
      await control.hover();
      await page.mouse.down();
      await page.waitForTimeout(250);
      row.cells.push(['pressed', await snap(page)]);
      await page.mouse.move(away.x, away.y);
      await page.mouse.up();
      if (dpr === 2) row.group = await snap(page, '.nav-links', 10);
      if (dpr === 1 && theme === 'light') {
        await page.waitForTimeout(400);
        const box = await control.boundingBox();
        const mark = await page.locator('.nav-sound-mark').boundingBox();
        facts.states[state] = {
          role: await control.getAttribute('role'),
          name: await control.getAttribute('aria-label'),
          checked: await control.getAttribute('aria-checked'),
          title: await control.getAttribute('title'),
          onHtml: await page.evaluate(() => `data-sound="${document.documentElement.dataset.sound}"${document.documentElement.hasAttribute('data-sound-live') ? ' data-sound-live' : ''}`),
          movingBars: await page.evaluate(() => document.querySelectorAll('.nav-sound-mark i').length && [...document.querySelectorAll('.nav-sound-mark i')].filter((i) => getComputedStyle(i).animationName !== 'none').length),
        };
        facts.tag = await control.evaluate((b) => b.tagName.toLowerCase());
        facts.keys = await control.getAttribute('aria-keyshortcuts');
        facts.target = `${box.width} x ${box.height}`;
        facts.mark = `${mark.width} x ${mark.height} at ${mark.x}, ${mark.y}`;
      }
      grid.push(row);
      await context.close();
    }

// A press with the pointer, a press from the keys, and the M key: what changes, what is in transition, what is said.
{
  const { context, page } = await open('playing', 'light', 1);
  const control = page.locator('.nav-sound');
  const state = () =>
    page.evaluate(() => ({
      html: document.documentElement.dataset.sound,
      playing: document.documentElement.hasAttribute('data-sound-live'),
      checked: document.querySelector('.nav-sound').getAttribute('aria-checked'),
      said: document.querySelector('.nav-sound-status').textContent,
      stored: localStorage.getItem('sound'),
      inTransition: document.querySelector('.nav-sound').getAnimations({ subtree: true }).filter((a) => a.transitionProperty).map((a) => `${a.transitionProperty} ${a.effect.getTiming().duration} ms ${a.effect.getTiming().easing}`),
    }));
  await control.click();
  facts.afterPointerPress = await state();
  await page.waitForTimeout(500);
  await control.focus();
  await page.keyboard.press('Enter');
  facts.afterEnter = await state();
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  facts.afterSpace = await state();
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
  await page.keyboard.press('m');
  facts.afterM = await state();
  await page.waitForTimeout(500);
  await page.keyboard.press('m');
  facts.afterMAgain = await state();
  // (In a field the letter is typed, and nothing is muted.)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  const field = page.locator('input[type="email"]').first();
  if (await field.count()) {
    await field.focus();
    await page.keyboard.type('m');
    facts.mTypedInAField = { ...(await state()), field: await field.inputValue() };
  }
  await context.close();
}

// Reduced motion: playing is still to be told from waiting, and nothing moves.
const calm = [];
for (const state of STATES) {
  const { context, page } = await open(state, 'light', 2, { reducedMotion: 'reduce' });
  await page.mouse.move(away.x, away.y);
  await page.waitForTimeout(250);
  calm.push([`${state}, reduced motion`, await snap(page)]);
  if (state === 'playing') facts.reducedMotionMovingBars = await page.evaluate(() => [...document.querySelectorAll('.nav-sound-mark i')].filter((i) => getComputedStyle(i).animationName !== 'none').length);
  await context.close();
}

// A phone: the whole nav, each state, both themes; and the control's target there.
const phone = [];
for (const theme of ['light', 'dark'])
  for (const state of STATES) {
    const { context, page } = await open(state, theme, 3, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.waitForTimeout(250);
    phone.push([`${state}, ${theme}, phone 390 at 3x`, await snap(page, '.nav', 0)]);
    if (theme === 'light' && state === 'waiting') {
      const b = await page.locator('.nav-sound').boundingBox();
      facts.phoneTarget = `${b.width} x ${b.height}`;
      facts.phoneNavFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    }
    await context.close();
  }
for (const width of [320, 360]) {
  const { context, page } = await open('waiting', 'light', 3, { viewport: { width, height: 700 }, isMobile: true, hasTouch: true });
  // (Past the lake the mark stands in the nav too: the tightest the row gets.)
  await page.evaluate(() => document.documentElement.setAttribute('data-melted', ''));
  await page.waitForTimeout(400);
  phone.push([`waiting, light, ${width} wide, the mark showing`, await snap(page, '.nav', 0)]);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.nav-mark, .nav-links')].map((e) => e.getBoundingClientRect()).map((r) => [Math.round(r.left), Math.round(r.right)]));
  (facts.narrow ??= {})[width] = { markAndGroup: boxes, apart: boxes[1][0] - boxes[0][1], target: await page.locator('.nav-sound').evaluate((b) => `${b.getBoundingClientRect().width} x ${b.getBoundingClientRect().height}`) };
  await context.close();
}

// (The sheet is laid out by a browser of its own.)
await browser.close();
const press = await chromium.launch();
const sheet = await press.newPage({ viewport: { width: 1900, height: 900 }, deviceScaleFactor: 1 });
const cell = ([label, png], h = 176) => `<figure><img style="height:${h}px" src="data:image/png;base64,${png}"><figcaption>${label}</figcaption></figure>`;
await sheet.setContent(`<style>
  body{margin:0;padding:24px;background:#8a9197;font:12px ui-monospace,Menlo,monospace;color:#0a0c0e}
  h2{font:600 13px ui-monospace,Menlo,monospace;margin:18px 0 8px}
  .row{display:flex;gap:14px;margin-bottom:14px;flex-wrap:wrap;align-items:flex-end}
  .row>b{width:150px;font-weight:400;align-self:center}
  figure{margin:0} img{display:block;image-rendering:pixelated} figcaption{margin-top:6px}
</style>
<h2>Each state: rest, pointed at, focused from the keys, pressed (enlarged; count the pixels at 1x)</h2>
${grid.map((r) => `<div class="row"><b>${r.label}</b>${r.cells.map((c) => cell(c)).join('')}${r.group ? cell(['beside the theme switch', r.group], 132) : ''}</div>`).join('')}
<h2>Reduced motion</h2><div class="row">${calm.map((c) => cell(c)).join('')}</div>
<h2>A phone</h2><div class="row">${phone.map((c) => cell(c, 150)).join('')}</div>`);
await sheet.waitForTimeout(400);
await sheet.screenshot({ path: join(out, 'sound-sheet.png'), fullPage: true });
writeFileSync(join(out, 'sound.json'), JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts, null, 1));
await press.close();
