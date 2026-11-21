// The live layer's quiet states (src/flight/live.ts), shown working on a running build.
//
//   reduced   with less motion asked for there is no layer at all: no canvas, no breath, the stills
//   hidden    with the tab hidden the layer's frames stop, and start again when it is shown
//   weak      on a machine that cannot hold its frame at rest (every frame made to run 30 ms long) the
//             layer gives up half its flakes, then itself; the picture's own canvas is the same before and after
//   steps     the governor's three steps held by hand, the layer alone on black (what each step draws)
//
//   NODE_PATH=<playwright modules> node scripts/live-states.mjs <url> <out dir>
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 20);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const report = {};
const open = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1728, height: 1117 }, deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__player, null, { timeout: 30000 });
  return { ctx, page };
};
const go = async (page, s) => {
  await page.evaluate((s) => window.scrollTo(0, Math.round(s * window.__player.state().unit)), s);
  await page.waitForFunction(() => window.__player.settled(), null, { timeout: 60000 });
};
const frames = (page) => page.evaluate(() => window.__player.live()?.stats().frames ?? -1);
const picture = async (page) => sha(await page.evaluate(() => document.querySelector('canvas.flight-canvas:not(.flight-veil)').toDataURL('image/png')));
try {
  {
    const { ctx, page } = await open({ reducedMotion: 'reduce' });
    await page.waitForTimeout(2500);
    await go(page, 5.6);
    await page.mouse.move(1200, 900, { steps: 8 });
    await page.waitForTimeout(800);
    report.reduced = await page.evaluate(() => ({
      layer: window.__player.live(),
      canvas: !!document.querySelector('.flight-live'),
      breath: document.querySelector('.flight-stage').style.transform,
      stills: document.querySelector('.flight-root').dataset.stills !== undefined,
    }));
    await page.screenshot({ path: join(out, 'reduced.jpg'), type: 'jpeg', quality: 85 });
    await ctx.close();
  }
  {
    const { ctx, page } = await open();
    await page.waitForFunction(() => window.__player.live()?.stats().ok, null, { timeout: 60000 });
    await go(page, 5.6);
    await page.waitForTimeout(500);
    const a = await frames(page);
    await page.waitForTimeout(1000);
    const b = await frames(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);
    const c = await frames(page);
    await page.waitForTimeout(1500);
    const d = await frames(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(1000);
    const e = await frames(page);
    report.hidden = { shownFor1s: b - a, hiddenFor1500ms: d - c, shownAgainFor1s: e - d };

    // The governor's steps, held: the layer alone on black.
    await page.evaluate(() => {
      const root = document.querySelector('.flight-root');
      root.querySelector('canvas.flight-canvas').style.visibility = 'hidden';
      root.style.background = '#000';
    });
    await go(page, 1.6);
    for (const n of [0, 1, 2]) {
      await page.evaluate((n) => window.__player.live().holdStep(n), n);
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(out, `step-${n}.jpg`), type: 'jpeg', quality: 88 });
    }
    await page.evaluate(() => window.__player.live().holdStep(null));
    await ctx.close();
  }
  {
    const { ctx, page } = await open();
    await page.waitForFunction(() => window.__player.live()?.stats().ok, null, { timeout: 60000 });
    await go(page, 5.6);
    await page.waitForTimeout(1500);
    const before = await picture(page);
    const log = [];
    const t0 = Date.now();
    // (A machine that cannot hold its frame: every frame is made to run 30 ms long, with the picture at rest.)
    await page.evaluate(() => {
      window.__burn = true;
      const burn = () => {
        if (!window.__burn) return;
        const until = performance.now() + 30;
        while (performance.now() < until);
        requestAnimationFrame(burn);
      };
      requestAnimationFrame(burn);
    });
    let step = 0;
    while (Date.now() - t0 < 60000) {
      const st = await page.evaluate(() => window.__player.live().stats());
      if (st.step !== step) {
        step = st.step;
        log.push({ step, afterMs: Date.now() - t0 });
      }
      if (step >= 2) break;
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => (window.__burn = false));
    await page.waitForTimeout(800);
    report.weak = {
      period: (await page.evaluate(() => window.__player.live().stats())).period,
      steps: log,
      layerCanvas: await page.evaluate(() => document.querySelector('.flight-live').style.display),
      pictureSame: before === (await picture(page)),
      stepStaysAfterTheMachineRecovers: (await page.evaluate(() => window.__player.live().stats())).step,
    };
    await page.screenshot({ path: join(out, 'weak-after.jpg'), type: 'jpeg', quality: 85 });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
writeFileSync(join(out, 'states.json'), JSON.stringify(report, null, 1));
