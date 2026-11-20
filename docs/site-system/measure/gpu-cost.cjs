// GPU time of one frame of the home page, by scroll position, at the owner's backing size.
//
//   NODE_PATH=<a node_modules with playwright> node docs/site-system/measure/gpu-cost.cjs <base> [from] [to] [step]
//
// <base> is a production build of this site (http://localhost:3189). Positions are in screens of
// scroll: scene i rests from starts[i] to starts[i] + 2, and its whiteout runs for the 0.6 after
// (src/scene/flight/scenes.ts). With no range the whole page is measured.
// It uses the renderer's own timer (window.__lakeProof.measure): the median of seven GPU timer
// queries, each over six draws of a full frame. Run it alone on the GPU, and twice: a Cycles render
// or another browser on the same GPU turns 4 ms into 80.
const { chromium } = require('playwright');
(async () => {
  const [base, from = 0, to = 30.6, step = 0.2] = [process.argv[2], ...process.argv.slice(3).map(Number)];
  if (!base) throw Error('usage: gpu-cost.cjs <base url> [from] [to] [step]');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lakeProof, undefined, { timeout: 60000 });
  let worst = 0;
  for (let s = from; s <= to + 1e-9; s += step) {
    const r = await page.evaluate((s) => window.__lakeProof.measure(3456, 2234, false, s), s);
    worst = Math.max(worst, r.gpu);
    console.log(s.toFixed(2).padStart(6), r.gpu.toFixed(2).padStart(7), 'ms GPU', r.main.toFixed(2), 'ms main');
    if (s === from) console.log('      ', r.renderer, '|', r.method);
  }
  console.log('worst', worst.toFixed(2), 'ms (budget: 5 at rest, 7 in a whiteout)');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
