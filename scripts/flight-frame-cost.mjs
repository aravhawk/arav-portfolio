#!/usr/bin/env node
/**
 * What a frame of the flight costs the GPU, by scroll position.
 *
 *   NODE_PATH=<playwright modules> node scripts/flight-frame-cost.mjs <url> <output directory>
 *     [--governed] [--stops light:1.5,dark:28] [--repeat 7] [--size wide,tall] [--theme light,dark]
 *     [--base 8.33] [--speed 0.5] [--lean 0] [--map src/water/cost-map.json]
 *
 * Each row times one complete engine callback (simulation, scene, the glow)
 * with a drained queue and a hardware timer query, on the real GPU at a
 * 3456 by 2234 output and at 780 by 1688.
 *
 * Without `--governed`: every quarter screen with full shading at the
 * screen's own resolution, the clock, the entrance and the camera pinned.
 * This is the cost map: `--map` writes it for the engine (ms per megapixel
 * on this GPU; see src/water/pace.ts), and it is to be made again whenever a
 * scene's cost changes.
 *
 * With `--governed`: the pace as shipped. At every quarter screen the page
 * is left to itself for a moment, then one frame is timed at rest and one
 * with the camera held as travelling, each at the resolution, rate and
 * shading the engine chose there; those are written beside the time.
 * `--base` and `--speed` stand in for another display and another GPU (a
 * 120 Hz display is `--base 8.33`; a GPU twice this one is `--speed 0.5`):
 * the engine then chooses as it would there, and the time, measured here,
 * is to be read against this GPU's share of that display's budget.
 *
 * `--lean 1` or `2` pins that step of leaner shading in place of full
 * shading (what a step saves). `--stops` times only the named stops, `--repeat` times each that often
 * and keeps the median (for comparing two builds at the dearest places).
 */
import { createRequire } from 'node:module';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const [url, directory, ...rest] = process.argv.slice(2);
const arg = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i < 0 ? def : rest[i + 1];
};
const governed = rest.includes('--governed');
const repeat = Number(arg('repeat', '1'));
const only = arg('stops', '')
  .split(',')
  .filter(Boolean)
  .map((x) => x.split(':'));
const sizes = arg('size', 'wide,tall').split(',');
const themes = arg('theme', 'light,dark').split(',');
const base = arg('base', '');
const speed = arg('speed', '');
const mapPath = arg('map', '');
const lean = Number(arg('lean', '0'));
const SIZES = { wide: [1728, 1117], tall: [390, 844] };

mkdirSync(directory, { recursive: true });
const table = join(directory, governed ? 'governed.jsonl' : 'frames.jsonl');
writeFileSync(table, '');

/** One frame, timed: the queue drained before and after, the query round the whole callback. */
function timeFrame([count, live]) {
  const e = window.__flight.engine;
  const gl = e.gl;
  const a = e.lastArgs;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) throw Error('Hardware timer unavailable');
  const pixel = new Uint8Array(4);
  const drain = () => {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  };
  const one = () =>
    new Promise((resolve, reject) => {
      drain(); // Start with an empty Metal queue.
      const query = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      e.holdClock(null);
      e.touch();
      const time = performance.now();
      e.frame(time, a.cam, a.aspect, a.at);
      const cpu = performance.now() - time;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      drain();
      // (The pinned survey holds the clock again between frames; the governed one leaves the engine running, so the
      // resolution it has settled on is the one timed.)
      if (!live) e.holdClock(8);
      const poll = () => {
        if (gl.isContextLost() || gl.getParameter(ext.GPU_DISJOINT_EXT)) return reject(Error('Invalid GPU query'));
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return setTimeout(poll, 1);
        const gpu = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        gl.deleteQuery(query);
        resolve({ gpu, cpu });
      };
      setTimeout(poll, 0);
    });
  return (async () => {
    const got = [];
    // (Repeated: two are let go first, and the median of the rest is kept.)
    for (let i = 0; i < count + (count > 1 ? 2 : 0); i++) {
      got.push(await one());
      if (count > 1) await new Promise((r) => setTimeout(r, 30));
    }
    const kept = (count > 1 ? got.slice(2) : got).sort((x, y) => x.gpu - y.gpu);
    const info = e.info;
    return { ...kept[kept.length >> 1], cpu: Math.max(...kept.map((k) => k.cpu)), backing: [gl.drawingBufferWidth, gl.drawingBufferHeight], scale: info.scale ?? 1, every: info.every ?? 1, lean: info.lean, speed: info.speed ?? 1, tiles: info.tiles };
  })();
}

const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const size of sizes) {
    const [width, height] = SIZES[size];
    for (const colorScheme of themes) {
      if (only.length && !only.some((x) => x[0] === colorScheme)) continue;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme, isMobile: size === 'tall', hasTouch: size === 'tall' });
      await page.goto(url);
      await page.waitForFunction(() => window.__flight && document.documentElement.dataset.picture !== undefined, null, { timeout: 120000 });
      await page.waitForTimeout(2500);
      const end = await page.evaluate(() => (document.documentElement.scrollHeight - innerHeight) / window.__flight.state().unit);
      const stops = only.length ? only.filter((x) => x[0] === colorScheme).map((x) => Number(x[1])) : Array.from({ length: Math.floor(end / 0.25) + 1 }, (_, i) => i * 0.25);
      if (governed && (base || speed)) {
        await page.evaluate(
          ([b, k]) => {
            const e = window.__flight.engine;
            if (b) e.base = Number(b);
            if (k) e.speed = e.speed0 = Number(k);
          },
          [base, speed],
        );
      }
      for (const s of stops) {
        await page.evaluate(
          ([s, governed, lean]) => {
            const f = window.__flight;
            const e = f.engine;
            if (!governed) {
              e.holdLean(lean);
              e.holdPace?.({ scale: 1, every: 1 });
            }
            e.holdClock(8);
            f.holdEntrance(8);
            scrollTo(0, Math.round(s * f.state().unit));
            f.holdPose(f.poseAt(s));
          },
          [s, governed, lean],
        );
        await page.waitForFunction(
          (s) => {
            const f = window.__flight;
            const e = f.engine;
            const a = e.lastArgs;
            const want = f.poseAt(s).pos;
            return a && Math.abs(f.state().s - s) < 0.003 && a.cam.pos.every((v, i) => Math.abs(v - want[i]) < 1e-6) && e.standsReady(a.cam, a.aspect, e.needs(a.cam, a.aspect));
          },
          s,
          { timeout: 120000 },
        );
        if (!governed) {
          const sample = await page.evaluate(timeFrame, [repeat, false]);
          if (sample.backing[0] !== width * 2 || sample.backing[1] !== height * 2) throw Error(JSON.stringify(sample));
          appendFileSync(table, JSON.stringify({ width, colorScheme, s, mode: 'rest', ...sample }) + '\n');
          continue;
        }
        for (const mode of ['rest', 'travel']) {
          // The engine is left to choose for a moment, the clock running, with the camera held as at rest or as travelling.
          await page.evaluate((travel) => {
            const e = window.__flight.engine;
            e.holdPace({ travel });
            e.holdClock(null);
          }, mode === 'travel');
          await page.waitForTimeout(520);
          const sample = await page.evaluate(timeFrame, [repeat, true]);
          appendFileSync(table, JSON.stringify({ width, colorScheme, s, mode, ...sample }) + '\n');
        }
        await page.evaluate(() => {
          window.__flight.engine.holdPace(null);
          window.__flight.engine.holdClock(8);
        });
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (mapPath && !governed && !only.length && !lean) {
  const rows = readFileSync(table, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const map = { step: 0.25, gpu: 'Apple M4 (10 GPU cores)', wide: {}, tall: {} };
  for (const r of rows) {
    const shape = r.width === SIZES.wide[0] ? 'wide' : 'tall';
    (map[shape][r.colorScheme] ??= [])[Math.round(r.s / 0.25)] = +(r.gpu / ((r.backing[0] * r.backing[1]) / 1e6)).toFixed(2);
  }
  writeFileSync(mapPath, JSON.stringify(map).replace(/("(wide|tall|light|dark)")/g, '\n$1') + '\n');
  console.log(`cost map written to ${mapPath}`);
}
