// What the live layer costs a frame (src/flight/live.ts).
//
// GPU: a timer query (EXT_disjoint_timer_query_webgl2) round the layer's own draw, the queue drained before and
// after, the median of 40 draws at each place. Main thread: the layer's whole turn in the player's frame (its
// uniforms, its draw calls, the breath, the gate's name), timed by the layer itself over every frame of the stay.
// The first frames: how long the programs took the page's thread, and the longest frame while they were taken up.
//
//   NODE_PATH=<playwright modules> node scripts/live-cost.mjs <url> <out.json> [--scale 1]
//
// It opens a window (the timer needs a real GPU context) at 1728 x 1117 at a density of 2 (a 3456 x 2234 output)
// and at 390 x 844 at a density of 3 (a phone's output).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out] = process.argv.slice(2);
const scaleAt = process.argv.indexOf('--scale');
const scale = scaleAt < 0 ? null : Number(process.argv[scaleAt + 1]);
const PLACES = [0, 3.1, 5.6, 11.15, 17.9, 20.7, 27.1, 32.4];
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (const [w, h, dpr, theme, mobile] of [[1728, 1117, 2, 'light', false], [1728, 1117, 2, 'dark', false], [390, 844, 3, 'light', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: theme, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    if (scale) await page.addInitScript((s) => (window.__flightLiveScale = s), scale);
    // The longest frame from the load until the layer has drawn half a second: its programs are taken up in there.
    await page.addInitScript(() => {
      window.__gaps = [];
      let last = 0;
      const tick = (t) => {
        if (last) window.__gaps.push(t - last);
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__player?.live?.()?.stats().frames > 30, null, { timeout: 60000 });
    const start = await page.evaluate(() => ({ ...window.__player.live().stats(), longestFrame: Math.max(...window.__gaps.slice(5)) }));
    for (const s of PLACES) {
      await page.evaluate((s) => window.scrollTo(0, Math.round(s * window.__player.state().unit)), s);
      await page.waitForFunction(() => window.__player.settled(), null, { timeout: 60000 });
      await page.mouse.move(w * 0.6, h * 0.7, { steps: 4 });
      await page.waitForTimeout(1200);
      const row = await page.evaluate(async () => {
        const live = window.__player.live();
        const gl = live.gl;
        const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!ext) throw Error('no timer query here');
        const px = new Uint8Array(4);
        const drain = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const one = () =>
          new Promise((resolve, reject) => {
            drain();
            const q = gl.createQuery();
            gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
            live.redraw();
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            drain();
            const poll = () => {
              if (gl.getParameter(ext.GPU_DISJOINT_EXT)) return reject(Error('disjoint'));
              if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return setTimeout(poll, 1);
              const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
              gl.deleteQuery(q);
              resolve(ms);
            };
            setTimeout(poll, 0);
          });
        const gpu = [];
        for (let i = 0; i < 40; i++) gpu.push(await one());
        gpu.sort((a, b) => a - b);
        const st = live.stats();
        return { gpuMedian: +gpu[20].toFixed(3), gpuP90: +gpu[36].toFixed(3), cpuMean: +st.cpuMs.toFixed(3), cpuMax: +st.cpuMax.toFixed(2), layer: [st.w, st.h], step: st.step, mask: st.maskK > 0.9 };
      });
      rows.push({ w, h, dpr, theme, s, ...row });
      console.log(JSON.stringify(rows[rows.length - 1]));
    }
    rows.push({ w, h, dpr, theme, start: { compileMs: +start.compileMs.toFixed(2), parallel: start.parallel, longestFrameMs: +start.longestFrame.toFixed(1) } });
    console.log(JSON.stringify(rows[rows.length - 1]));
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(out, JSON.stringify(rows, null, 1));
