// The sound on the real page, in a headless browser: what loads and when,
// that the control starts and stops it, that it follows the scroll, sleeps
// with a hidden tab and on another page, and comes back in a visit. Frames
// of the control at rest, on, focused, on a phone, both themes.
//
//   NODE_PATH=<a node_modules with playwright> node scripts/sound/page.mjs <base url> <outdir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const base = process.argv[2] ?? 'http://localhost:3188';
const out = resolve(process.argv[3] ?? '.tools/out/s1');
mkdirSync(join(out, 'frames'), { recursive: true });
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=document-user-activation-required'] });
const lines = [];
const say = (ok, what) => {
  lines.push(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  console.log(lines.at(-1));
};

// Every audio context the page makes is kept where the check can see it, with a meter on its way out.
const tap = () => {
  const made = (window.__audio = []);
  const Real = window.AudioContext;
  window.AudioContext = class extends Real {
    constructor(...a) {
      super(...a);
      const meter = this.createAnalyser();
      meter.fftSize = 8192;
      made.push({ ctx: this, meter });
      const connect = AudioNode.prototype.connect;
      const ctx = this;
      AudioNode.prototype.connect = function (to, ...rest) {
        if (to === ctx.destination) connect.call(this, meter);
        return connect.call(this, to, ...rest);
      };
    }
  };
  window.__level = () => {
    const a = made[0];
    if (!a) return null;
    const d = new Float32Array(a.meter.fftSize);
    a.meter.getFloatTimeDomainData(d);
    let s = 0,
      peak = 0;
    for (const v of d) {
      s += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    return { state: a.ctx.state, rms: 20 * Math.log10(Math.sqrt(s / d.length) + 1e-9), peak, rate: a.ctx.sampleRate };
  };
  window.__long = [];
  new PerformanceObserver((l) => window.__long.push(...l.getEntries().map((e) => Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
};
const level = (page) => page.evaluate(() => window.__level());

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(tap);
const scripts = [];
page.on('response', async (r) => {
  // (The scene's own workers come and go with the scroll: they are the picture's, not the sound's.)
  if (r.request().resourceType() !== 'script' || r.url().includes('/scene/')) return;
  const body = await r.body().catch(() => Buffer.alloc(0));
  scripts.push({ url: r.url().replace(base, ''), raw: body.length, gzip: gzipSync(body, { level: 9 }).length });
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(base + '/', { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.dataset.flight === 'live', null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
// Everything a visitor does short of pressing the control: scroll the whole page, move, hover it, tab to it.
for (let i = 0; i < 12; i++) {
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(250);
}
await page.evaluate(() => scrollTo(0, 0));
const sound = page.locator('.in-sound');
await sound.hover();
await sound.focus();
await page.waitForTimeout(1200);
const before = scripts.length;
const beforeBytes = scripts.reduce((s, x) => s + x.gzip, 0);
say((await level(page)) === null, `before a press: no audio context exists, ${before} scripts loaded (${(beforeBytes / 1024).toFixed(1)} KB gzipped)`);
say((await sound.getAttribute('aria-pressed')) === 'false' && (await sound.getAttribute('aria-label')) === 'Sound', 'the control is a button named "Sound", not pressed');
const box = await sound.boundingBox();
say(box.width >= 44 && box.height >= 44, `the control is ${box.width} by ${box.height} px`);
await page.evaluate(() => document.activeElement.blur());
await page.mouse.move(700, 500);
await page.waitForTimeout(300);
const clip = async (p, name) => {
  const b = await p.locator('.in-links').boundingBox();
  await p.screenshot({ path: join(out, 'frames', name + '.png'), clip: { x: Math.max(0, b.x - 24), y: 0, width: Math.min(b.width + 48, p.viewportSize().width), height: 88 } });
};
await clip(page, 'day-rest');

await page.evaluate(() => (window.__long.length = 0));
const t0 = Date.now();
await sound.click();
await page.waitForFunction(() => window.__level()?.state === 'running', null, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2500);
const chunk = scripts.slice(before);
const chunkBytes = chunk.reduce((s, x) => s + x.gzip, 0);
say(chunk.length > 0 && chunkBytes <= 12 * 1024, `the first press fetched ${chunk.length} script(s), ${chunkBytes} bytes gzipped (${chunk.map((c) => `${c.url.split('/').pop()} ${c.gzip}`).join(', ')}); the limit is 12288`);
let l = await level(page);
say(l?.state === 'running' && l.rms > -45, `after the press: context ${l?.state}, ${l?.rms.toFixed(1)} dBFS RMS on the way out, peak ${l?.peak.toFixed(3)} (${Date.now() - t0} ms after it, at ${l?.rate} Hz)`);
say((await sound.getAttribute('aria-pressed')) === 'true', 'the control says it is pressed');
const long = await page.evaluate(() => window.__long);
say(long.length === 0, `long tasks from the press: ${long.length ? long.join(', ') + ' ms' : 'none'}`);
await page.mouse.move(700, 500);
await page.waitForTimeout(300);
await clip(page, 'day-on');
await page.keyboard.press('Tab');
await sound.focus();
await page.keyboard.press('Shift+Tab');
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
await clip(page, 'day-on-focused');

// Down the page: the level at each scene, and in the thick of a whiteout.
const unit = await page.evaluate(() => document.querySelector('[data-scene]').offsetHeight / 2.6);
const meter = async (screens, label) => {
  await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), screens * unit);
  await page.waitForTimeout(2600);
  const v = await level(page);
  return `${label} ${v.rms.toFixed(1)}`;
};
const heard = [];
heard.push(await meter(1, 'lake'));
heard.push(await meter(2.3, 'whiteout'));
heard.push(await meter(3.6, 'infiniview'));
heard.push(await meter(13.4 + 1, 'agent-bridge'));
await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
await page.waitForTimeout(3000);
heard.push('ending ' + (await level(page)).rms.toFixed(1));
l = await level(page);
say(l.state === 'running' && l.peak < 0.89, `scrolled and jumped through the page, dBFS RMS: ${heard.join(', ')}; peak ${l.peak.toFixed(3)}`);

// A hidden tab.
const hide = (hidden) =>
  page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
await hide(true);
await page.waitForTimeout(450);
const fading = await level(page);
await page.waitForTimeout(600);
l = await level(page);
say(l.state === 'suspended' && fading.state === 'running' && fading.rms < -50, `tab hidden: ${fading.rms.toFixed(1)} dBFS after 0.45 s with the context still running, then ${l.state}`);
await hide(false);
await page.waitForTimeout(2000);
l = await level(page);
say(l.state === 'running' && l.rms > -45, `tab shown: ${l.state}, ${l.rms.toFixed(1)} dBFS`);

// Another page, and back.
await page.click('a.nav-link[href="/work"]');
await page.waitForURL('**/work');
await page.waitForTimeout(1200);
l = await level(page);
say(l.state === 'suspended' && (await page.locator('.in-sound').count()) === 0, `on /work: context ${l.state}, no control`);
await page.click('a.in-mark');
await page.waitForURL(base + '/');
await page.waitForTimeout(2500);
l = await level(page);
say(l.state === 'running' && l.rms > -45 && (await sound.getAttribute('aria-pressed')) === 'true', `back on the home page: ${l.state}, ${l.rms.toFixed(1)} dBFS, the control still pressed`);

// Off, then pressed twenty times quickly, ending off.
await sound.click();
await page.waitForTimeout(1000);
l = await level(page);
say(l.state === 'suspended' && (await sound.getAttribute('aria-pressed')) === 'false', `pressed off: context ${l.state}`);
for (let i = 0; i < 21; i++) await sound.click({ delay: 5 });
await page.waitForTimeout(2000);
l = await level(page);
say(l.state === 'running' && l.rms > -45, `pressed 21 times in a row (ends on): ${l.state}, ${l.rms.toFixed(1)} dBFS`);

// The visit goes on through a reload: the control remembers, and nothing sounds until a press somewhere.
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);
const scriptsAfterReload = scripts.length;
say((await level(page)) === null && (await sound.getAttribute('aria-pressed')) === 'true', 'after a reload in the same visit: the control is pressed, no audio context yet');
await page.mouse.click(700, 500);
await page.waitForFunction(() => window.__level()?.state === 'running', null, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2000);
l = await level(page);
say(l?.state === 'running' && l.rms > -45 && scripts.length > scriptsAfterReload, `the first press anywhere brings it back: ${l?.state}, ${l?.rms.toFixed(1)} dBFS`);
await sound.click();
await page.waitForTimeout(300);

// A new visit: off again.
const again = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const night = await again.newPage();
await night.addInitScript(tap);
await night.goto(base + '/', { waitUntil: 'load' });
await night.waitForTimeout(3000);
say((await night.locator('.in-sound').getAttribute('aria-pressed')) === 'false' && (await night.evaluate(() => window.__level())) === null, 'a new visit opens with the control off and no audio context');
await night.mouse.move(700, 500);
await clip(night, 'night-rest');
await night.locator('.in-sound').click();
await night.waitForTimeout(2500);
await night.mouse.move(700, 500);
await night.waitForTimeout(300);
await clip(night, 'night-on');
l = await night.evaluate(() => window.__level());
say(l?.state === 'running', `dark theme: ${l?.state}, ${l?.rms.toFixed(1)} dBFS`);
await night.keyboard.press('Tab');
await night.locator('.in-sound').focus();
await night.keyboard.press('Shift+Tab');
await night.keyboard.press('Tab');
await night.waitForTimeout(200);
await clip(night, 'night-on-focused');

// A phone, both themes; and reduced motion (no canvas), where the sound still follows the sections.
for (const [name, scheme, width] of [['phone-day', 'light', 390], ['phone-night', 'dark', 390], ['phone-small-day', 'light', 375]]) {
  const c = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, colorScheme: scheme });
  const p = await c.newPage();
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: join(out, 'frames', name + '-rest.png'), clip: { x: 0, y: 0, width, height: 96 } });
  await p.locator('.in-sound').tap();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: join(out, 'frames', name + '-on.png'), clip: { x: 0, y: 0, width, height: 96 } });
  const b = await p.locator('.in-sound').boundingBox();
  const fits = await p.evaluate(() => {
    const a = document.querySelector('.in-brand').getBoundingClientRect(),
      l = document.querySelector('.in-links').getBoundingClientRect();
    return { gap: l.left - a.right, right: innerWidth - l.right, scroll: document.documentElement.scrollWidth - innerWidth };
  });
  say(b.width >= 44 && b.height >= 44 && fits.gap >= 5 && fits.right >= 8 && fits.scroll <= 0, `${name} (${width} px): control ${b.width} by ${b.height}, ${fits.gap.toFixed(0)} px between the plates, ${fits.right.toFixed(0)} px to the edge`);
  await c.close();
}
const calm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const still = await calm.newPage();
await still.addInitScript(tap);
await still.goto(base + '/', { waitUntil: 'load' });
await still.waitForTimeout(1500);
await still.locator('.in-sound').click();
await still.waitForTimeout(2500);
const top = await still.evaluate(() => window.__level());
await still.evaluate(() => document.querySelectorAll('[data-scene]')[1].scrollIntoView({ block: 'center', behavior: 'instant' }));
await still.waitForTimeout(2500);
const gapScene = await still.evaluate(() => window.__level());
say(top?.state === 'running' && top.rms > -45 && Math.abs(gapScene.rms - top.rms) > 0.5 && (await still.evaluate(() => !document.documentElement.hasAttribute('data-flight'))), `reduced motion (no canvas): ${top?.rms.toFixed(1)} dBFS at the lake, ${gapScene.rms.toFixed(1)} at the gap`);

say(errors.length === 0, `console errors: ${errors.length} ${errors.slice(0, 3).join(' | ')}`);
writeFileSync(join(out, 'page.txt'), lines.join('\n') + '\n\nscripts before the press:\n' + scripts.slice(0, before).map((s) => `${s.gzip}\t${s.url}`).join('\n') + '\n\nscripts fetched by the press:\n' + chunk.map((s) => `${s.gzip}\t${s.raw}\t${s.url}`).join('\n') + '\n');
await browser.close();
process.exit(lines.some((l) => l.startsWith('FAIL')) ? 1 : 0);
