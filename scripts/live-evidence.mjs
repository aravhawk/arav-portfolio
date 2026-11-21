// Pictures of the live layer at work (src/flight/live.ts), from a running build.
//
// For a window shape and a theme it writes, under <out>/<shape>-<theme>/:
//   air-<n>.jpg        the air through one transit (the page held at eight places from the lake's outlet down the river)
//   air-only-<n>.jpg   the same with the picture taken away: the layer alone, on black, under the page's words
//   water-<stop>-<t>.jpg, water-<stop>-diff.jpg   two stops over three seconds, and what changed, eight times over
//   pointer-water.jpg, pointer-ice.jpg, pointer-only-*.jpg   the pointer's ring on water and its light on ice
//   breath-a.jpg, breath-b.jpg, breath-diff.jpg   the first screen three seconds apart, and the difference
//   gate-<profile>.jpg   the selector's three states
//
//   NODE_PATH=<playwright modules> SHARP=<path to sharp> node scripts/live-evidence.mjs <url> <out> [--only wide-day,tall-night]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require(process.env.SHARP ?? 'sharp');
const [url, out] = process.argv.slice(2);
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt < 0 ? null : process.argv[onlyAt + 1].split(',');
const SHAPES = { wide: { w: 1728, h: 1117, dpr: 1, mobile: false }, tall: { w: 390, h: 844, dpr: 2, mobile: true } };

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (const [shape, S] of Object.entries(SHAPES)) {
    for (const theme of ['day', 'night']) {
      if (only && !only.includes(`${shape}-${theme}`)) continue;
      const dir = join(out, `${shape}-${theme}`);
      mkdirSync(dir, { recursive: true });
      const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: S.dpr, colorScheme: theme === 'night' ? 'dark' : 'light', isMobile: S.mobile, hasTouch: S.mobile });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('[pageerror]', e.message));
      const cdp = await ctx.newCDPSession(page);
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__player?.live?.()?.stats().ok, null, { timeout: 60000 });
      const shot = (name) => page.screenshot({ path: join(dir, `${name}.jpg`), type: 'jpeg', quality: 88 });
      const png = () => page.screenshot({ type: 'png' });
      const go = async (s) => {
        await page.evaluate((s) => window.scrollTo(0, Math.round(s * window.__player.state().unit)), s);
        await page.waitForFunction(() => window.__player.settled(), null, { timeout: 60000 });
        await page.waitForFunction(() => window.__player.live().stats().maskK > 0.95, null, { timeout: 20000 });
      };
      const alone = (on) =>
        page.evaluate((on) => {
          const root = document.querySelector('.flight-root');
          root.querySelector('canvas.flight-canvas').style.visibility = on ? 'hidden' : '';
          root.style.background = on ? '#000' : '';
        }, on);
      const diff = async (a, b, name) => {
        const A = await sharp(a).raw().toBuffer({ resolveWithObject: true });
        const B = await sharp(b).raw().toBuffer();
        const d = Buffer.alloc(A.data.length);
        let sum = 0;
        for (let i = 0; i < d.length; i++) {
          const v = Math.abs(A.data[i] - B[i]);
          sum += v;
          d[i] = i % A.info.channels === 3 ? 255 : Math.min(255, v * 8);
        }
        await sharp(d, { raw: A.info }).jpeg({ quality: 88 }).toFile(join(dir, `${name}.jpg`));
        return +(sum / d.length).toFixed(3);
      };
      const drag = async (pts) => {
        // (A drag of the pointer; on the phone a finger's, sent as touches.)
        if (!S.mobile) {
          for (const [x, y] of pts) {
            await page.mouse.move(x, y, { steps: 5 });
            await page.waitForTimeout(140);
          }
          return;
        }
        for (let i = 0; i < pts.length; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: i ? 'touchMove' : 'touchStart', touchPoints: [{ x: pts[i][0], y: pts[i][1] }] });
          await page.waitForTimeout(140);
        }
      };
      const log = { shape, theme };

      // The first screen's breath.
      await go(0);
      await page.waitForFunction(() => window.__player.live().stats().breath > 0.97, null, { timeout: 20000 });
      const b0 = await png();
      await page.waitForTimeout(3000);
      const b1 = await png();
      await sharp(b0).jpeg({ quality: 88 }).toFile(join(dir, 'breath-a.jpg'));
      await sharp(b1).jpeg({ quality: 88 }).toFile(join(dir, 'breath-b.jpg'));
      log.breathDiff = await diff(b0, b1, 'breath-diff');

      // The air through one transit: the page held at eight places, the layer's own clock running.
      for (let n = 0; n < 8; n++) {
        const s = 1.2 + n * 0.3;
        await page.evaluate((s) => window.__player.hold(s), s);
        await page.waitForTimeout(450);
        await shot(`air-${n}`);
        await alone(true);
        await page.waitForTimeout(80);
        await shot(`air-only-${n}`);
        await alone(false);
      }
      await page.evaluate(() => window.__player.hold(null));

      // Water at two stops over three seconds.
      for (const stop of [5.6, 32.4]) {
        await go(stop);
        await page.waitForTimeout(stop > 30 ? 6500 : 1200);
        const frames = [];
        for (let t = 0; t <= 3; t++) {
          frames.push(await png());
          await sharp(frames[t]).jpeg({ quality: 88 }).toFile(join(dir, `water-${stop}-${t}.jpg`));
          if (t < 3) await page.waitForTimeout(1000);
        }
        log[`waterDiff${stop}`] = await diff(frames[0], frames[3], `water-${stop}-diff`);
      }

      // The pointer: on water, then on ice.
      await go(5.6);
      const water = S.mobile ? [[150, 700], [190, 730], [235, 752], [280, 770]] : [[1180, 880], [1260, 905], [1340, 925], [1420, 940]];
      const ice = S.mobile ? [[90, 330], [130, 345], [170, 352], [205, 356]] : [[420, 520], [500, 540], [580, 552], [650, 560]];
      await drag(water);
      await page.waitForTimeout(260);
      await shot('pointer-water');
      await alone(true);
      await shot('pointer-only-water');
      await alone(false);
      if (S.mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(1800);
      await drag(ice);
      await page.waitForTimeout(500);
      await shot('pointer-ice');
      await alone(true);
      await shot('pointer-only-ice');
      await alone(false);
      if (S.mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

      // The selector's three states.
      await go(20.7);
      await page.waitForTimeout(600);
      const names = await page.$$eval('.fl-fork .switch-opt', (els) => els.map((e) => e.textContent));
      for (let i = 0; i < names.length; i++) {
        await page.evaluate((i) => document.querySelectorAll('.fl-fork .switch-opt')[i].click(), i);
        await page.waitForTimeout(700);
        await shot(`gate-${names[i]}`);
      }
      console.log(JSON.stringify(log));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
