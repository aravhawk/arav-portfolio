// A cold scroll of the whole home page: frame intervals, long tasks, main-thread time a frame.
//
//   NODE_PATH=<a node_modules with playwright> node docs/site-system/measure/scroll-trace.cjs <base> [seconds] [phone]
//
// <base> is a production build of this site. The cache is off, so every scene streams as on a
// first visit. [seconds] is how long the scroll takes (35 by default; 0.1 is a jump to the end).
// The window is headed so frames are presented at the display's own rate.
// The gate: no interval over 20 ms on a 60 Hz display, no task over 50 ms.
const { chromium } = require('playwright');
(async () => {
  const base = process.argv[2];
  const seconds = Number(process.argv[3] ?? 35);
  const phone = process.argv[4] === 'phone';
  if (!base) throw Error('usage: scroll-trace.cjs <base url> [seconds] [phone]');
  const browser = await chromium.launch({
    headless: false,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
  });
  await ctx.addInitScript(() => {
    window.__tasks = [];
    new PerformanceObserver((list) => window.__tasks.push(...list.getEntries().map((e) => Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lakeProof, undefined, { timeout: 60000 });
  const out = await page.evaluate(async (ms) => {
    const before = window.__tasks.length;
    const end = document.documentElement.scrollHeight - innerHeight;
    window.__lakeProof.sample(true);
    const start = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const t = now - start;
        scrollTo({ top: end * Math.min(1, t / ms), behavior: 'instant' });
        // Keep sampling until the picture has caught up with the scroll.
        if (t < ms + 4000) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    const { intervals, main } = window.__lakeProof.sample(false);
    return { intervals, main, tasks: window.__tasks.slice(before), state: window.__lakeProof.state() };
  }, seconds * 1000);
  const sorted = (a) => [...a].sort((x, y) => x - y);
  const at = (a, q) => sorted(a)[Math.min(a.length - 1, Math.floor(a.length * q))];
  const f = (x) => x.toFixed(1);
  console.log('frames', out.intervals.length, '| median', f(at(out.intervals, 0.5)), 'ms | p99', f(at(out.intervals, 0.99)), 'ms | longest', f(Math.max(...out.intervals)), 'ms | over 20 ms:', out.intervals.filter((x) => x > 20).length);
  console.log('main thread a frame: median', f(at(out.main, 0.5)), 'ms, max', f(Math.max(...out.main)), 'ms');
  console.log('tasks over 50 ms during the scroll:', out.tasks.length, out.tasks.join(' '));
  console.log('ended at', out.state.screens.toFixed(2), 'screens, backing', out.state.width + 'x' + out.state.height, 'scale', out.state.scale);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
