// NODE_PATH=<playwright modules> node scripts/flight-frame-cost.mjs <url> <output directory>
import { createRequire } from 'node:module';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const [url, directory] = process.argv.slice(2);
mkdirSync(directory, { recursive: true });
const table = join(directory, 'frames.jsonl');
writeFileSync(table, '');
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const [width, height] of [[1728, 1117], [390, 844]]) {
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme });
      await page.goto(url);
      await page.waitForFunction(() => window.__flight && document.documentElement.dataset.flight === 'on', null, { timeout: 90000 });
      const end = await page.evaluate(() => (document.documentElement.scrollHeight - innerHeight) / window.__flight.state().unit);
      for (let s = 0; s <= end; s += 0.25) {
        await page.evaluate(s => {
          const f = window.__flight;
          f.engine.holdLean(0);
          f.engine.holdClock(8);
          f.holdEntrance(8);
          scrollTo(0, Math.round(s * f.state().unit));
          f.holdPose(f.poseAt(s));
        }, s);
        await page.waitForFunction(s => {
          const f = window.__flight, e = f.engine, a = e.lastArgs;
          return a && Math.abs(f.state().s - s) < 0.003 && e.standsReady(a.cam, a.aspect, e.needs(a.cam, a.aspect));
        }, s, { timeout: 90000 });
        const sample = await page.evaluate(() => {
          const e = window.__flight.engine, gl = e.gl, a = e.lastArgs;
          const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
          if (!ext) throw Error('Hardware timer unavailable');
          const pixel = new Uint8Array(4);
          function drain() {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          }
          drain(); // Start with an empty Metal queue.
          const query = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
          e.holdClock(null);
          const time = performance.now();
          e.frame(time, a.cam, a.aspect, a.at);
          const cpu = performance.now() - time;
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          drain();
          e.holdClock(8);
          return new Promise((resolve, reject) => {
            function poll() {
              if (gl.isContextLost() || gl.getParameter(ext.GPU_DISJOINT_EXT)) return reject(Error('Invalid GPU query'));
              if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return setTimeout(poll, 1);
              const gpu = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
              gl.deleteQuery(query);
              resolve({ gpu, cpu, backing: [gl.drawingBufferWidth, gl.drawingBufferHeight] });
            }
            setTimeout(poll, 0);
          });
        });
        if (sample.backing[0] !== width * 2 || sample.backing[1] !== height * 2) throw Error(JSON.stringify(sample));
        appendFileSync(table, JSON.stringify({ width, colorScheme, s, ...sample }) + '\n');
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
