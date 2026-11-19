// Run against the production build with NODE_PATH pointing to the existing
// Playwright installation. Cost and capture use headed Chromium on Metal.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = process.env.LAKE_EVIDENCE || '.tools/out/o1c';
const modes = new Set(process.argv.slice(2));
const theme = process.env.LAKE_THEME || 'light';
const profile = process.env.LAKE_PROFILE || 'desktop';
const prefix = profile + '-' + theme;
const save = (file, data) => fs.writeFileSync(path.join(out, file), data);
const savePng = (file, url) => save(file, Buffer.from(url.split(',')[1], 'base64'));
const dump = (file, data) => save(file, JSON.stringify(data, null, 2));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-angle=metal',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });
  try {
    const phone = profile === 'phone';
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: phone ? 3 : 2,
      colorScheme: theme,
      isMobile: phone,
      hasTouch: phone,
    });
    await context.addInitScript(() => {
      window.lakeTimings = { tasks: [], lcp: [], cls: [], loaf: [] };
      for (const [type, key] of [
        ['longtask', 'tasks'],
        ['largest-contentful-paint', 'lcp'],
        ['layout-shift', 'cls'],
        ['long-animation-frame', 'loaf'],
      ]) {
        if (PerformanceObserver.supportedEntryTypes.includes(type))
          new PerformanceObserver((l) =>
            window.lakeTimings[key].push(...l.getEntries().map((e) => e.toJSON())),
          ).observe({ type, buffered: true });
      }
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) console.error(m.type(), m.text().slice(0, 350));
    });
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto('http://localhost:3183/lab/hero', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__lakeProof, undefined, { timeout: 60000 });
    const state = await page.evaluate(() => window.__lakeProof.state());
    console.log('Live', state);
    if (modes.has('capture')) {
      await page.waitForTimeout(550);
      dump(
        prefix + '-timeline.json',
        await page.evaluate(() => ({
          ...window.lakeTimings,
          paint: performance.getEntriesByType('paint').map((e) => e.toJSON()),
          marks: performance.getEntriesByType('mark').map((e) => e.toJSON()),
          worker: performance.getEntriesByType('measure').map((e) => e.toJSON()),
          resources: performance.getEntriesByType('resource').map((e) => e.toJSON()),
        })),
      );
      savePng(prefix + '-raw.png', await page.evaluate(() => window.__lakeProof.capture()));
      await page.screenshot({ path: path.join(out, prefix + '-words.png') });
      savePng(prefix + '-ground.png', await page.evaluate(() => window.__lakeProof.capture(false)));
    }
    if (modes.has('motion')) {
      for (let i = 0; i < 6; i++) {
        await page.evaluate(
          (s) => window.scrollTo({ top: s * 2 * innerHeight, behavior: 'instant' }),
          i / 5,
        );
        await page.waitForTimeout(830);
        await page.screenshot({ path: path.join(out, 'scroll-' + i + '.png') });
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      for (const [x, y] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ]) {
        await page.mouse.move(5 + x * 1430, 5 + y * 890);
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(out, 'pointer-' + x + y + '.png') });
      }
      savePng('mid-scroll.png', await page.evaluate(() => window.__lakeProof.frame(0.5, 0, 0)));
    }
    if (modes.has('cadence')) {
      const sample = await page.evaluate(async () => {
        window.__lakeProof.sample(true);
        await new Promise((resolve) => {
          const start = performance.now();
          function step(t) {
            const s = Math.min(1, (t - start) / 10000);
            scrollTo({ top: s * 2 * innerHeight, behavior: 'instant' });
            if (s < 1) requestAnimationFrame(step);
            else resolve();
          }
          requestAnimationFrame(step);
        });
        return window.__lakeProof.sample(false);
      });
      dump(prefix + '-cadence.json', sample);
    }
    if (modes.has('cost')) {
      const costs = [];
      for (const [w, h] of phone
        ? [[780, 1688]]
        : [
            [2880, 1800],
            [3456, 2234],
            [5120, 2880],
          ]) {
        const cost = await page.evaluate(
          ([w, h]) => window.__lakeProof.measure(w, h, w === 3456),
          [w, h],
        );
        costs.push(cost);
        console.log(cost);
        dump(prefix + '-cost.json', costs);
      }
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
