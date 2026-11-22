// NODE_PATH=<Playwright node_modules> node scripts/callout-check.mjs <url> <capture directory>
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    const height = width === 390 ? 844 : 900;
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width === 390, colorScheme: theme });
    await page.addInitScript(() => {
      const proto = WebGL2RenderingContext.prototype;
      const names = new WeakMap();
      window.camera = {};
      for (const method of ['getUniformLocation', 'uniform3fv', 'uniform2f']) {
        const original = proto[method];
        proto[method] = function (...args) {
          const result = original.apply(this, args);
          if (method === 'getUniformLocation') {
            if (result) names.set(result, args[1]);
          } else {
            const name = names.get(args[0]);
            if (/^uCam(Pos|F|R|U)$/.test(name)) window.camera[name] = [...args[1]];
            if (name === 'uLens') window.camera.lens = args.slice(1);
          }
          return result;
        };
      }
    });
    const touch = width === 390 ? await page.context().newCDPSession(page) : null;
    await page.goto(url);
    await page.waitForFunction(() => window.__flight && document.documentElement.hasAttribute('data-picture'), null, { timeout: 120000 });
    const stations = await page.locator('.fl-calls').evaluateAll(groups => groups.map(g => {
      const e = g.firstElementChild;
      return [+e.dataset.callFrom, +e.dataset.callTo, g.closest('section').className];
    }));
    const expected = await page.locator('[data-call]').allTextContents();
    const seen = new Set();
    for (const [from, to, station] of stations) {
      await page.evaluate(s => scrollTo(0, s * window.__flight.state().unit), from + .18 * (to - from));
      await page.waitForTimeout(350);
      for (const fraction of [.18, .55, .92, .72]) {
        const delta = await page.evaluate(s => s * window.__flight.state().unit - scrollY, from + fraction * (to - from));
        if (fraction === .18) {
          await page.evaluate(s => scrollTo(0, s * window.__flight.state().unit), from + fraction * (to - from));
        } else if (touch) {
          const travel = Math.min(410, Math.abs(delta));
          const origin = delta > 0 ? 640 : 140;
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: origin }] });
          for (let step = 1; step <= 5; step++) {
            await touch.send('Input.dispatchTouchEvent', {
              type: 'touchMove', touchPoints: [{ x: 180, y: origin - Math.sign(delta) * travel * step / 5 }],
            });
            await page.waitForTimeout(fraction === .92 ? 8 : 40);
          }
        } else await page.mouse.wheel(0, delta);
        for (const phase of fraction === .18 ? ['rest'] : ['moving', 'rest']) {
          await page.waitForTimeout(phase === 'moving' ? 50 : 850);
          const sample = await page.evaluate(() => {
            const c = window.camera;
            const calls = [...document.querySelectorAll('.fl-call')].filter(e => getComputedStyle(e).opacity > .03);
            return calls.map(e => {
              const label = e.lastElementChild.getBoundingClientRect();
              const overlap = calls.some(other => {
                const r = other.lastElementChild.getBoundingClientRect();
                return other !== e && r.left < label.right && r.right > label.left && r.top < label.bottom && r.bottom > label.top;
              });
              let error = null;
              if (!e.hasAttribute('data-loose')) {
                const anchor = (c.lens[1] >= .9 && e.dataset.callWide || e.dataset.call).split(',').map(Number);
                const dot = v => v.reduce((sum, n, i) => sum + n * (anchor[i] - c.uCamPos[i]), 0);
                const z = dot(c.uCamF) * c.lens[0];
                const x = innerWidth * .5 * (1 + dot(c.uCamR) / (z * c.lens[1]));
                const y = innerHeight * .5 * (1 - dot(c.uCamU) / z);
                const ring = e.firstElementChild.getBoundingClientRect();
                error = Math.hypot(x - ring.left - ring.width / 2, y - ring.top - ring.height / 2);
              }
              return { label: e.textContent, error, overlap };
            });
          });
          for (const call of sample) seen.add(call.label);
          rows.push({ width, theme, station, fraction, phase, sample });
          if (station.includes('fl-up') && fraction === .72) await page.screenshot({ path: out + '/' + [width, theme, phase].join('-') + '.jpg' });
          if (phase === 'moving' && touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
      }
    }
    const missing = expected.filter(label => !seen.has(label));
    if (missing.length) throw Error('Unmeasured labels at ' + width + ' ' + theme + ': ' + missing.join(', '));
    await page.close();
  }
} finally {
  await browser.close();
  writeFileSync(out + '/samples.json', JSON.stringify(rows));
}
const samples = rows.flatMap(r => r.sample);
const failed = samples.filter(s => s.overlap || s.error > 1);
console.log({ samples: samples.length, faults: failed.length, max: Math.max(...samples.map(s => s.error)) });
if (!samples.length || failed.length) process.exitCode = 1;
