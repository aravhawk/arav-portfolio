#!/usr/bin/env node
/**
 * Scripted visits to the home page, for the sound's start: when the audio
 * context really runs, what the control shows before and after, and
 * whether the browser's console said anything.
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/sound-visit.mjs --base http://localhost:3185 [--browsers chromium,webkit,firefox] [--out dir]
 *
 * In each browser, a first visit with each of: only scrolling (a wheel); a
 * click on the page; a key press; a tap, on a phone's profile; a first
 * press on the mute control. Then a second visit by a reader who muted
 * (silent, the control muted, the sound's script not fetched until it is
 * turned on, then on at that press), and a second visit by a reader with
 * sound on (starts at the first gesture). And the M key, the hidden tab,
 * a visit that asks for less data, and an inner page.
 *
 * The page's AudioContext is watched from before any script runs (its
 * constructor is wrapped): every context made, when, and each change of
 * its state. "Playing" is the context running and the mix's own fade
 * having come up (window.__sound, which the sound publishes for checks).
 * Exits 1 if a case does not do what it should.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const pw = require('playwright');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3185').replace(/\/$/, '');
const browsers = arg('browsers', 'chromium,webkit,firefox').split(',');
const out = arg('out', '');
if (out) mkdirSync(out, { recursive: true });

const watch = () => {
  window.__ctx = [];
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Real = window[name];
    if (!Real) continue;
    window[name] = class extends Real {
      constructor(...a) {
        super(...a);
        const rec = { made: Math.round(performance.now()), states: [[Math.round(performance.now()), this.state]], ctx: this };
        window.__ctx.push(rec);
        this.addEventListener('statechange', () => rec.states.push([Math.round(performance.now()), this.state]));
      }
    };
  }
  window.__take = () => {
    const d = document.documentElement;
    const b = document.querySelector('.nav-sound');
    const c = window.__ctx?.[0];
    const s = window.__sound;
    return {
      now: Math.round(performance.now()),
      choice: d.dataset.sound ?? null,
      playing: d.hasAttribute('data-sound-live'),
      control: b ? `${b.getAttribute('aria-label')} | ${b.getAttribute('title')}` : 'none',
      contexts: window.__ctx?.length ?? 0,
      state: c ? c.ctx.state : 'no context',
      states: c ? c.states : [],
      level: s ? +s.sound.powerAt(s.ctx.currentTime).toFixed(2) : null,
      stored: (() => {
        try {
          return localStorage.getItem('sound');
        } catch {
          return 'no storage';
        }
      })(),
    };
  };
  // The page photographs its own state as it loads and again five seconds on. (Asking it from outside would itself
  // count as the reader's act in Chromium, and a wheel after that would be let through.)
  window.__snaps = {};
  // What the browser itself says of each wheel: whether it counts it as the reader's act.
  window.__wheels = [];
  window.addEventListener('wheel', () => window.__wheels.push(navigator.userActivation ? navigator.userActivation.isActive || navigator.userActivation.hasBeenActive : null), { capture: true, passive: true });
  window.addEventListener('load', () => {
    window.__snaps.first = window.__take();
    setTimeout(() => (window.__snaps.before = window.__take()), 4800);
  });
};
const read = (page) => page.evaluate(() => window.__take());
const show = (r) => `${r.choice}${r.playing ? ', playing' : r.choice === 'on' ? ', waiting' : ''}; context ${r.state}; level ${r.level ?? 'none'}; "${r.control}"`;

const rows = [];
let failed = 0;

for (const name of browsers) {
  const browser = await pw[name].launch({ headless: true });
  const version = browser.version();
  const visit = async (label, { phone = false, store = null, route = '/', context: ctxOpts = {}, init = null } = {}, act, expect) => {
    const opts = phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2, ...(name === 'firefox' ? {} : { isMobile: true }) } : { viewport: { width: 1440, height: 900 } };
    const context = await browser.newContext({ ...opts, ...ctxOpts });
    await context.addInitScript(watch);
    if (store) await context.addInitScript((v) => localStorage.setItem('sound', v), store);
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    const said = [];
    const scripts = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') said.push(`${m.type()}: ${m.text().slice(0, 160)}`);
    });
    page.on('pageerror', (e) => said.push(`pageerror: ${e.message.slice(0, 160)}`));
    page.on('response', async (res) => {
      if (!/\.js(\?|$)/.test(res.url())) return;
      try {
        if (/soundtier/.test((await res.body()).toString('utf8'))) scripts.push(Date.now());
      } catch {
        /* gone */
      }
    });
    await page.goto(`${base}${route}`, { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    const fetchedBefore = scripts.length;
    const steps = await act(page, async (what, ms = 2600) => {
      await page.waitForTimeout(ms);
      const r = await read(page);
      r.fetched = scripts.length;
      r.what = what;
      return r;
    });
    const after = steps[steps.length - 1];
    // (The first paint's own state, and the state before anything was done: taken by the page itself.)
    const { first, before } = await page.evaluate(() => window.__snaps);
    before.fetched = fetchedBefore;
    const t0 = before.now;
    const started = after.states.find(([, s]) => s === 'running');
    const row = { browser: `${name} ${version}`, case: label, first: show(first), before: `${show(before)}; script ${before.fetched ? 'fetched' : 'not fetched'}`, steps: steps.map((s) => `${s.what}: ${show(s)}; script ${s.fetched ? 'fetched' : 'not fetched'}`), started: started ? `${started[0] - t0} ms after the wait ended` : 'never', console: said };
    const problems = expect({ first, before, steps, after, said });
    // (An error fails the visit, and so does anything at all said about audio. Other warnings are the page's own and are listed.)
    const bad = said.filter((m) => /^(error|pageerror)/.test(m) || /audio/i.test(m));
    if (bad.length) problems.push(`console: ${bad.join(' / ')}`);
    row.problems = problems;
    if (problems.length) failed++;
    rows.push(row);
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${name.padEnd(8)} ${label}`);
    console.log(`       first paint: ${row.first}`);
    console.log(`       before:      ${row.before}`);
    for (const s of row.steps) console.log(`       ${s}`);
    console.log(`       context first ran: ${row.started}${problems.length ? `\n       PROBLEMS: ${problems.join('; ')}` : ''}`);
    await context.close();
  };
  const waiting = (r) => r.choice === 'on' && !r.playing && /^Mute sound \| Sound is on and starts/.test(r.control);
  const playing = (r) => r.choice === 'on' && r.playing && r.state === 'running' && r.level > 0.9 && r.control === 'Mute sound | Mute sound (M)';
  const muted = (r) => r.choice === 'off' && !r.playing && (r.level === null || r.level === 0) && /^Turn sound on/.test(r.control);
  const must = (ok, msg) => (ok ? [] : [msg]);
  const spot = { x: 700, y: 520 };

  await visit('first visit, only scrolling', {}, async (page, take) => {
    await page.mouse.move(spot.x, spot.y);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(150);
    }
    const r = await take('after six wheel scrolls');
    // (A real Chrome, Safari or Firefox does not count a wheel. The WebKit and Firefox builds that Playwright drives
    // count the wheel it sends: the page asks the browser, and starts exactly where the browser says the wheel counts.)
    const counted = await page.evaluate(() => window.__wheels.some(Boolean));
    r.what += counted ? ' (this build says a wheel counts as the reader\'s act)' : ' (the browser says a wheel does not count)';
    r.counted = counted;
    return [r];
  }, ({ first, before, after }) => [
    ...must(waiting(first) && waiting(before), 'not on-and-waiting before'),
    ...must(before.fetched > 0, 'the script was not fetched at idle'),
    ...must(after.counted ? playing(after) : waiting(after) && after.state !== 'running', after.counted ? 'the browser counted the wheel and the sound did not start' : 'the sound started on a wheel the browser did not count (or the control says playing)'),
  ]);

  await visit('first visit, a click', {}, async (page, take) => {
    await page.mouse.click(spot.x, spot.y);
    return [await take('after a click on the page')];
  }, ({ before, after }) => [...must(waiting(before), 'not waiting before'), ...must(playing(after), 'not playing after a click')]);

  await visit('first visit, a key press', {}, async (page, take) => {
    await page.keyboard.press('ArrowDown');
    return [await take('after the down arrow')];
  }, ({ before, after }) => [...must(waiting(before), 'not waiting before'), ...must(playing(after), 'not playing after a key')]);

  await visit('first visit, a tap (phone)', { phone: true }, async (page, take) => {
    await page.touchscreen.tap(195, 500);
    return [await take('after a tap on the page')];
  }, ({ before, after }) => [...must(waiting(before), 'not waiting before'), ...must(playing(after), 'not playing after a tap')]);

  await visit('first visit, first press is the mute control', {}, async (page, take) => {
    await page.locator('.nav-sound').click();
    const a = await take('after the press on the control');
    await page.mouse.click(spot.x, spot.y);
    await page.keyboard.press('ArrowDown');
    return [a, await take('after a click and a key elsewhere')];
  }, ({ steps }) => [...must(muted(steps[0]) && steps[0].stored === 'off', 'not muted and stored after the press'), ...must(steps[0].contexts === 0 || steps[0].state !== 'running', 'a context ran at the press on the control'), ...must(muted(steps[1]) && steps[1].state !== 'running', 'sound started after muting')]);

  await visit('second visit, muted before', { store: 'off' }, async (page, take) => {
    await page.mouse.click(spot.x, spot.y);
    await page.keyboard.press('ArrowDown');
    const a = await take('after a click and a key');
    await page.locator('.nav-sound').click();
    const b = await take('after turning sound on at the control');
    await page.locator('.nav-sound').click();
    return [a, b, await take('after muting again', 900)];
  }, ({ first, before, steps }) => [
    ...must(muted(first) && muted(before), 'the control is not muted from the first paint'),
    ...must(before.fetched === 0 && steps[0].fetched === 0, 'the sound script was fetched for a muted reader'),
    ...must(muted(steps[0]) && steps[0].contexts === 0, 'a context was made for a muted reader'),
    ...must(playing(steps[1]) && steps[1].stored === 'on', 'not playing after it was turned on'),
    ...must(muted(steps[2]) && steps[2].stored === 'off' && steps[2].level === 0, 'not silent after muting again'),
  ]);

  await visit('second visit, sound on before', { store: 'on' }, async (page, take) => {
    await page.mouse.click(spot.x, spot.y);
    return [await take('after a click on the page')];
  }, ({ before, after }) => [...must(waiting(before) && before.fetched > 0, 'not waiting with the script fetched'), ...must(playing(after), 'not playing after the first gesture')]);

  await visit('the M key mutes and brings it back', {}, async (page, take) => {
    await page.mouse.click(spot.x, spot.y);
    const a = await take('after a click');
    await page.keyboard.press('m');
    const b = await take('after M', 900);
    await page.keyboard.press('m');
    return [a, b, await take('after M again', 1500)];
  }, ({ steps }) => [...must(playing(steps[0]), 'not playing after a click'), ...must(muted(steps[1]) && steps[1].level === 0, 'M did not mute to silence'), ...must(playing(steps[2]), 'M did not bring it back')]);

  await visit('the tab hidden and shown again', {}, async (page, take) => {
    await page.mouse.click(spot.x, spot.y);
    const a = await take('after a click');
    const hide = (hidden) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await hide(true);
    const b = await take('hidden', 1200);
    await hide(false);
    return [a, b, await take('shown again', 1800)];
  }, ({ steps }) => [...must(playing(steps[0]), 'not playing after a click'), ...must(steps[1].state === 'suspended' && steps[1].level === 0 && !steps[1].playing, 'not suspended in silence while hidden'), ...must(playing(steps[2]), 'did not come back')]);

  await visit('a first visit that asks for less data', { init: () => Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => ({ saveData: true, addEventListener() {} }) }) }, async (page, take) => {
    await page.mouse.click(spot.x, spot.y);
    return [await take('after a click on the page')];
  }, ({ first, before, after }) => [...must(muted(first) && before.fetched === 0, 'not muted from the first paint, or the script was fetched'), ...must(muted(after) && after.contexts === 0 && after.stored === null, 'sound started, or a choice was stored for them')]);

  await visit('a first visit on a device with little memory', { init: () => Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => 1 }) }, async (page, take) => {
    await page.mouse.click(spot.x, spot.y);
    return [await take('after a click on the page')];
  }, ({ first, before, after }) => [...must(muted(first) && before.fetched === 0, 'not muted from the first paint, or the script was fetched'), ...must(muted(after) && after.contexts === 0, 'sound started')]);

  await visit('an inner page (/work), then home by its link, then back', { route: '/work' }, async (page, take) => {
    await page.mouse.click(700, 300);
    await page.keyboard.press('ArrowDown');
    const a = await take('on /work after a click and a key');
    // (The nav leaves on the way down the page and comes back on the way up.)
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(700);
    await page.locator('.nav-mark').click();
    await page.waitForURL(`${base}/`);
    const b = await take('on the home page, arrived by a press', 4500);
    await page.locator('.nav-link[href="/work"]').click();
    await page.waitForURL(`${base}/work`);
    return [a, b, await take('on /work again', 1500)];
  }, ({ before, steps }) => [
    ...must(before.control === 'none' && before.fetched === 0, 'an inner page shows the control or fetched the script'),
    ...must(steps[0].control === 'none' && steps[0].fetched === 0 && steps[0].contexts === 0, 'an inner page made a context or fetched the script'),
    ...must(steps[1].control !== 'none' && steps[1].fetched > 0, 'the home page has no control or no script'),
    ...must(steps[2].control === 'none' && !steps[2].playing && (steps[2].level === null || steps[2].level === 0), 'sound on an inner page'),
  ]);

  await browser.close();
}

if (out) writeFileSync(join(out, 'visits.json'), JSON.stringify(rows, null, 1));
console.log(`\n${rows.length} visits, ${failed} failed.`);
process.exit(failed ? 1 : 0);
