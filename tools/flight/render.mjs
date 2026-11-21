#!/usr/bin/env node
/**
 * The flight's frames, photographed from the live engine.
 *
 * The home page plays the flight from frames rendered ahead of time. This
 * is the renderer: it opens the engine's own route (`/render`, the home
 * page drawn live) in Chromium on this machine's GPU, steps the page one
 * frame at a time and reads each frame straight from the engine's canvas
 * (the canvas alone: no words, no nav), at full shading, with every clock
 * that the picture reads tied to the frame's place in the flight. Two runs
 * give the same frames.
 *
 * One run renders one **set** (a window shape and a theme):
 *
 *   wide   1920 x 1080 CSS at a density of 4/3: a 2560 x 1440 picture
 *   tall   390 x 844 CSS at a density of 2: a 780 x 1688 picture
 *   day    the light theme        night    the dark theme
 *
 * and, of that set, these **tracks** (see src/flight/types.ts):
 *
 *   main    the whole flight by scroll, `--per` frames a screen
 *   enter   the first screen's entrance, by time (ENTER in moments.ts)
 *   dawn    the ending's light event, by time (DAWN in moments.ts)
 *   after   the last stretch by scroll, with the light risen
 *   gate1, gate2   the stretch round the sluices, second and third gate open
 *   stills  each section's composed frame as the engine draws it with
 *           motion reduced (PNG files, not a track)
 *
 * What it writes, under `--out/<shape>-<theme>/`:
 *
 *   <track>.mkv   the frames, lossless (x264 RGB, qp 0)
 *   main.cam      the camera of every frame of `main`, 13 floats a frame
 *   still-<n>.png, still.cam   the stills, and the camera of each
 *   meta.json     each track's frame count, where it starts, its rate
 *
 * encode.mjs turns those into what the site ships. make.mjs runs both for
 * every set.
 *
 *   NODE_PATH=<a node_modules with playwright> node tools/flight/render.mjs \
 *     --base http://localhost:3183 --out .tools/flight --set wide-day
 *
 * Options: --tracks main,enter,dawn,after,stills[,gate1,gate2]   --per 30   --gates from,to (screens)
 * --from <screens> --to <screens> (main only: a part of it, for a trial)
 *
 * Playwright is not a dependency of this repo: point NODE_PATH at an
 * install that has it. ffmpeg is taken from `uv run --with imageio-ffmpeg`
 * (or FFMPEG=<path>).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHAPES, ffmpegPath } from './common.mjs';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  console.error('playwright not found. Set NODE_PATH to a node_modules folder that contains it.');
  process.exit(2);
}

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3183').replace(/\/$/, '');
const [shape, theme] = arg('set', 'wide-day').split('-');
const outDir = join(arg('out', '.tools/flight'), `${shape}-${theme}`);
const per = Number(arg('per', 30));
// (The gates' tracks are rendered when asked for: see README.md for why they are not shipped.)
const want = arg('tracks', 'main,enter,dawn,after,stills').split(',');
const partFrom = arg('from', null);
const partTo = arg('to', null);

/** The picture's clock at the top of the flight, in seconds, and how much of it a screen of scroll is: a second. */
const CLOCK0 = 20;
/** The clips that run by time: frames a second. */
const CLIP_FPS = 30;
/** The page's clock at the start of the track now being rendered, ms (see `record`). */
let T0 = 0;
/** How far before a part of the flight the page is walked, unrecorded, so the lee behind the words has the history it has in `main`. */
const RUN_IN = 1.5;

async function main() {
  const S = SHAPES[shape];
  if (!S || !['day', 'night'].includes(theme)) throw new Error(`unknown set ${shape}-${theme}`);
  mkdirSync(outDir, { recursive: true });
  const ffmpeg = ffmpegPath();
  const metaPath = join(outDir, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : { tracks: {} };

  // The frames come out of the page as raw pixels, posted to this process, and go straight into the encoder.
  let sink = null;
  let got = 0;
  const server = createServer((req, res) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => {
      const body = Buffer.concat(parts);
      got++;
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (!sink) return res.end('none');
      sink(body).then(() => res.end('ok'));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const open = async (reduced) => {
    const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-web-security'] });
    const ctx = await browser.newContext({
      viewport: { width: S.w, height: S.h },
      deviceScaleFactor: S.dpr,
      colorScheme: theme === 'night' ? 'dark' : 'light',
      reducedMotion: reduced ? 'reduce' : 'no-preference',
      isMobile: S.mobile,
      hasTouch: S.mobile,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('[page]', e.message));
    await page.goto(`${base}/render`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.flight === 'on' && !!window.__flight && window.__flight.loaded(), null, { timeout: 180000 });
    // (Words set at once: the lee is measured where they stand, never part way through a step.)
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none !important;animation:none !important} html{scroll-behavior:auto !important}' });
    await page.waitForTimeout(2500);
    const size = await page.evaluate((port) => {
      const f = window.__flight;
      f.engine.holdLean(0);
      f.manual(true);
      const c = f.engine.canvas;
      const gl = f.engine.gl;
      const px = new Uint8Array(c.width * c.height * 4);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      /** One frame: the page at `y`, the picture's clock at `clock`, the page's own clock at `now`. Drawn until every piece of it is drawn by its own program. */
      window.__shot = async ({ y, clock, now, enter, dawn, gate, send, still }) => {
        window.scrollTo(0, y);
        // (The place itself is handed over too: a scroll position is rounded to the screen's pixels, and a word whose
        // threshold is this very frame's place must be in, with its lee, in this frame.)
        const s = y / f.state().unit;
        if (!still) f.engine.holdClock(clock);
        f.holdEntrance(still ? null : enter);
        f.engine.holdDawn(dawn);
        f.engine.gate = gate;
        let tries = 0;
        for (; tries < 600; tries++) {
          f.step(now, s);
          const info = f.engine.info;
          if (info.settled) break;
          await sleep(50);
        }
        if (send) {
          f.step(now, s);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
          await fetch(`http://127.0.0.1:${port}/f`, { method: 'POST', body: px });
        }
        const cam = f.cam();
        return { tries, s: f.state().s, needed: f.engine.info.needed, cam: [...cam.pos, ...cam.f, ...cam.r, ...cam.u, cam.tan] };
      };
      const first = document.querySelector('[data-fl]');
      return { w: c.width, h: c.height, unit: f.state().unit, end: (document.documentElement.scrollHeight - window.innerHeight) / f.state().unit, hero: first.offsetHeight };
    }, port);
    return { browser, page, size };
  };

  /** A lossless file of the frames posted while `run` runs. */
  const record = async (name, size, fps, run) => {
    const file = join(outDir, `${name}.mkv`);
    const ff = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${size.w}x${size.h}`, '-r', String(fps), '-i', '-', '-vf', 'vflip', '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'veryfast', '-pix_fmt', 'rgb24', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (code) => (code ? rej(new Error(`ffmpeg ${code}`)) : res())));
    sink = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));
    got = 0;
    // (The page's own clock only ever goes forward: each track starts well after the last one ended. What eases by
    // that clock, the lee behind the words, would otherwise be thrown by a step back in time.)
    T0 += 1e7;
    const t0 = Date.now();
    await run();
    sink = null;
    ff.stdin.end();
    await done;
    console.log(`${shape}-${theme} ${name}: ${got} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    return got;
  };

  const tracks = want.filter((t) => t !== 'stills');
  if (tracks.length) {
    const { browser, page, size } = await open(false);
    const END = Math.round(size.end * 1000) / 1000;
    const plan = await page.evaluate(() => ({ holds: window.__flight.holds }));
    const consts = { END, SETTLE: END - 0.3, ENTER: 2.4, DAWN: 5.2 };
    console.log(`${shape}-${theme}: ${size.w} x ${size.h}, ${END} screens, unit ${size.unit}px`);
    meta.w = size.w;
    meta.h = size.h;
    meta.end = END;
    meta.per = per;
    const shot = (o) => page.evaluate((o) => window.__shot(o), o);
    const frameAt = (i, extra) => ({ y: (i / per) * size.unit, clock: CLOCK0 + i / per, now: T0 + (i / per) * 1000, enter: consts.ENTER, dawn: 0, gate: 0, send: true, ...extra });
    /** A stretch of the flight by scroll: frames `i0` to `i1`, walked up to from RUN_IN before it. */
    const stretch = async (i0, i1, extra, each) => {
      for (let i = Math.max(0, Math.round(i0 - RUN_IN * per)); i < i0; i++) await shot(frameAt(i, { ...extra, send: false }));
      for (let i = i0; i <= i1; i++) {
        const r = await shot(frameAt(i, extra));
        each?.(i, r);
        if ((i - i0) % 100 === 0) console.log(`  ${i} of ${i1}  s ${r.s.toFixed(3)}  tries ${r.tries}  ${r.needed}`);
      }
    };
    const N = Math.round(END * per);

    if (tracks.includes('main')) {
      const i0 = partFrom === null ? 0 : Math.round(Number(partFrom) * per);
      const i1 = partTo === null ? N : Math.round(Number(partTo) * per);
      const cams = new Float32Array((i1 - i0 + 1) * 13);
      const needed = [];
      const n = await record('main', size, 30, () =>
        stretch(i0, i1, {}, (i, r) => {
          cams.set(r.cam, (i - i0) * 13);
          needed.push(r.needed);
        }),
      );
      writeFileSync(join(outDir, 'main.cam'), Buffer.from(cams.buffer));
      // Where the sluices are in the frame: the stretch the gates' tracks cover.
      const dam = needed.map((x, k) => (/\bdam\b/i.test(x) ? k + i0 : -1)).filter((k) => k >= 0);
      meta.tracks.main = { n, from: i0 / per, per };
      meta.dam = dam.length ? [dam[0] / per, dam[dam.length - 1] / per] : null;
      meta.holds = plan.holds;
    }
    if (tracks.includes('enter')) {
      const frames = Math.round(consts.ENTER * CLIP_FPS);
      const n = await record('enter', size, CLIP_FPS, async () => {
        // (A second and a half at the top of the page first, unrecorded: whatever lee an earlier track left has gone.)
        for (let k = 15; k > 0; k--) await shot({ y: 0, clock: CLOCK0 - consts.ENTER, now: T0 - k * 100, enter: 0, dawn: 0, gate: 0, send: false });
        for (let k = 0; k <= frames; k++) {
          const t = k / CLIP_FPS;
          await shot({ y: 0, clock: CLOCK0 - consts.ENTER + t, now: T0 + t * 1000, enter: t, dawn: 0, gate: 0, send: true });
        }
      });
      meta.tracks.enter = { n, fps: CLIP_FPS };
    }
    if (tracks.includes('dawn')) {
      const at = Math.round(consts.SETTLE * per);
      const frames = Math.round(consts.DAWN * CLIP_FPS);
      const n = await record('dawn', size, CLIP_FPS, async () => {
        for (let i = Math.round(at - RUN_IN * per); i < at; i++) await shot(frameAt(i, { send: false }));
        const f0 = frameAt(at, {});
        for (let k = 0; k <= frames; k++) {
          const t = k / CLIP_FPS;
          await shot({ ...f0, clock: f0.clock + t, now: f0.now + t * 1000, dawn: t });
        }
      });
      meta.tracks.dawn = { n, fps: CLIP_FPS, at: consts.SETTLE };
    }
    if (tracks.includes('after')) {
      // From where the camera begins to settle on the ending: before it the light event changes nothing in the frame.
      const a0 = Number(arg('after-from', Math.floor((END - 2.2) * per) / per));
      const i0 = Math.round(a0 * per);
      const n = await record('after', size, 30, () => stretch(i0, N, { dawn: consts.DAWN }));
      meta.tracks.after = { n, from: i0 / per, per };
    }
    for (const g of [1, 2]) {
      if (!tracks.includes(`gate${g}`)) continue;
      const span = (arg('gates', '') || '').split(',').map(Number);
      const range = span.length === 2 && span.every(Number.isFinite) ? span : meta.dam;
      if (!range) throw new Error('no stretch for the gates: render main first, or pass --gates from,to');
      const i0 = Math.round(range[0] * per);
      const i1 = Math.round(range[1] * per);
      const n = await record(`gate${g}`, size, 30, () => stretch(i0, i1, { gate: g }));
      meta.tracks[`gate${g}`] = { n, from: i0 / per, per };
    }
    writeFileSync(metaPath, JSON.stringify(meta, null, 1));
    await browser.close();
  }

  if (want.includes('stills')) {
    // Motion reduced: the engine draws each section's composed frame, its words whole. One still to a section.
    const { browser, page, size } = await open(true);
    const stops = await page.evaluate(() => Array.from(document.querySelectorAll('.fl-rail a'), (a) => Number(a.dataset.at)));
    const sharp = createRequire(require.resolve('next/package.json', { paths: [process.cwd()] }))('sharp');
    let last = null;
    sink = async (buf) => {
      last = buf;
    };
    const cams = new Float32Array(stops.length * 13);
    for (let n = 0; n < stops.length; n++) {
      // (A few frames first: the lee comes in at once when motion is reduced, but only on the frame after its words are measured.)
      for (let k = 0; k < 6; k++) {
        const r = await page.evaluate((o) => window.__shot(o), { y: stops[n] * size.unit, clock: 0, now: 1e9 + n * 5000 + k * 400, enter: null, dawn: null, gate: 0, send: k === 5, still: true });
        cams.set(r.cam, n * 13);
      }
      await sharp(last, { raw: { width: size.w, height: size.h, channels: 4 } }).flip().removeAlpha().png().toFile(join(outDir, `still-${n}.png`));
      console.log(`${shape}-${theme} still ${n} at ${stops[n]}`);
    }
    sink = null;
    writeFileSync(join(outDir, 'still.cam'), Buffer.from(cams.buffer));
    meta.stills = stops;
    meta.w = size.w;
    meta.h = size.h;
    writeFileSync(metaPath, JSON.stringify(meta, null, 1));
    await browser.close();
  }
  server.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
