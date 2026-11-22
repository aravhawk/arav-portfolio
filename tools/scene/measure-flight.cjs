// Production measurements on the same headed Metal browser used by the lake.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const evidence = process.env.FLIGHT_EVIDENCE || '.tools/out/o3d';
const mode = process.argv[2],
  gate = process.argv[3] || 'wide',
  theme = process.argv[4] || 'light';
const id = [mode, gate, theme].join('-'),
  url = 'http://localhost:3185/lab/flight';
const dir = path.join(evidence, id);
const json = (name, data) => fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(data, null, 2));
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-angle=metal',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
    ],
  });
  try {
    const phone = gate === 'tall';
    const ctx = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: theme,
      isMobile: phone,
      hasTouch: phone,
      reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
    });
    await ctx.addInitScript(() => {
      window.flightTasks = [];
      new PerformanceObserver((list) =>
        window.flightTasks.push(...list.getEntries().map((e) => ({ start: e.startTime, ms: e.duration }))),
      ).observe({ type: 'longtask', buffered: true });
    });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (['warning', 'error'].includes(m.type())) console.log(m.type(), m.text().slice(0, 260));
    });
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (mode === 'fast')
      await page.route('**/scene/ridge/*', async (r) => {
        await new Promise((done) => setTimeout(done, 1200));
        await r.continue();
      });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__lakeProof);
    const state = () => page.evaluate(() => window.__lakeProof.state());
    json('opening', await state());
    const move = async (s, settle = true) => {
      await page.evaluate((s) => scrollTo({ top: innerHeight * s, behavior: 'instant' }), s);
      if (settle)
        await page.waitForFunction((s) => Math.abs(window.__lakeProof.state().screens - s) < 0.001, s);
    };
    if (mode === 'cost') {
      const sizes = phone
        ? [[780, 1688]]
        : [
            [2880, 1800],
            [3456, 2234],
            [5120, 2880],
          ];
      const results = [];
      for (const [w, h] of sizes) {
        const stops =
          w === 3456
            ? [...Array.from({ length: 47 }, (_, i) => i / 10), 2.05, 2.15, 2.25, 2.35, 2.45, 2.55].sort(
                (a, b) => a - b,
              )
            : [0, 2, 2.1, 2.3, 2.5, 2.6, 4.6];
        for (const s of stops) {
          const cost = await page.evaluate(
            ([w, h, s]) => window.__lakeProof.measure(w, h, false, s),
            [w, h, s],
          );
          results.push({ s, ...cost });
          json('cost', results);
        }
      }
    } else if (mode === 'normal' || mode === 'fast') {
      json(
        'trace',
        await page.evaluate(async (fast) => {
          const trace = [],
            start = performance.now(),
            duration = fast ? 100 : 10000;
          window.__lakeProof.sample(true);
          await new Promise((done) => {
            function step(now) {
              const elapsed = now - start;
              const target = 4.6 * Math.min(1, elapsed / duration);
              scrollTo({ top: innerHeight * target, behavior: 'instant' });
              trace.push({ ms: now, target, ...window.__lakeProof.state() });
              if (elapsed < duration + 4200) requestAnimationFrame(step);
              else done();
            }
            requestAnimationFrame(step);
          });
          return {
            trace,
            cadence: window.__lakeProof.sample(false),
            tasks: window.flightTasks,
            marks: performance.getEntriesByType('mark').map((x) => x.toJSON()),
            resources: performance.getEntriesByType('resource').map((x) => x.toJSON()),
            worker: performance.getEntriesByType('measure').map((x) => x.toJSON()),
            paint: performance.getEntriesByType('paint').map((x) => x.toJSON()),
          };
        }, mode === 'fast'),
      );
    } else {
      const steps = mode === 'sweep' ? Array.from({ length: 47 }, (_, i) => i / 10) : [0, 2.3, 2.6, 4.6];
      for (const s of steps) {
        await move(s);
        await page.screenshot({
          path: path.join(dir, String(Math.round(s * 10)).padStart(2, '0') + '.jpg'),
          type: 'jpeg',
          quality: 94,
        });
      }
      await move(0);
      json('reverse', await state());
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
