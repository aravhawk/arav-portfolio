#!/usr/bin/env node
/**
 * Sound check. Nobody can listen in a test, so the sound is measured.
 *
 * 1. Renders (the default). Each scene below is a script of what a visitor
 *    does. It is rendered through an OfflineAudioContext in headless
 *    Chromium by src/audio/render.ts, which builds the same graph and runs
 *    the same conductor and mapping as the page. For every scene it
 *    reports: peak and an estimate of the true peak (both must be at or
 *    under -1 dBFS), RMS, integrated loudness (ITU-R BS.1770 gating),
 *    crest factor, spectral centroid, the share of energy above 6 kHz
 *    (harshness), DC offset, clicks (a second difference that stands far
 *    above what surrounds it) and the largest sample-to-sample jump, and
 *    silence wherever a scene says there must be silence. A WAV and a
 *    spectrogram of each scene are written, so a person can listen and
 *    look.
 *
 * 2. Sync (--sync <base>). On the running site, with sound turned on by a
 *    real click, it causes each moment (a press on water, the switch, the
 *    melt's first crack, the shards' pulse, the lattice, the dawn) and
 *    reads the conductor's own trace: when the cause happened, when its
 *    sound was asked for, and the audio time it starts at. It also listens
 *    to the effects bus and finds each sound's real onset in the stream.
 *
 * Playwright is not a dependency of this repo. Point NODE_PATH at an
 * install that has it:
 *
 *   NODE_PATH=.tools/node_modules node scripts/audio-check.mjs [--out .tools/out/w5/renders] [--only hero-rest,dawn]
 *   NODE_PATH=.tools/node_modules node scripts/audio-check.mjs --sync http://localhost:3155
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- measuring ---------- */

export const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Power spectra of a signal: Hann windows of n samples every `hop`. Calls back with each frame's power per bin. */
function stft(x, n, hop, each) {
  const win = new Float64Array(n);
  for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const p = new Float64Array(n / 2);
  for (let at = 0; at + n <= x.length; at += hop) {
    for (let i = 0; i < n; i++) {
      re[i] = x[at + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let i = 0; i < n / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i];
    each(p);
  }
}

function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** ITU-R BS.1770 K-weighting at any sample rate. */
function kWeight(x, sr) {
  {
    const K = Math.tan((Math.PI * 1681.974450955533) / sr);
    const Vh = Math.pow(10, 3.999843853973347 / 20);
    const Vb = Math.pow(Vh, 0.4996667741545416);
    const Q = 0.7071752369554196;
    const a0 = 1 + K / Q + K * K;
    x = biquad(x, (Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
  }
  {
    const K = Math.tan((Math.PI * 38.13547087602444) / sr);
    const Q = 0.5003270373238773;
    const a0 = 1 + K / Q + K * K;
    x = biquad(x, 1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
  }
  return x;
}

/** Integrated loudness, LUFS: K-weighted, 400 ms blocks at 75% overlap, gated at -70 absolute and -10 relative. */
export function loudness(chs, sr) {
  const kw = chs.map((c) => kWeight(c, sr));
  const block = Math.round(0.4 * sr);
  const hop = Math.round(0.1 * sr);
  const z = [];
  for (let at = 0; at + block <= kw[0].length; at += hop) {
    let p = 0;
    for (const c of kw) {
      let s = 0;
      for (let i = at; i < at + block; i++) s += c[i] * c[i];
      p += s / block;
    }
    z.push(p);
  }
  const L = (p) => -0.691 + 10 * Math.log10(p);
  const abs = z.filter((p) => p > 0 && L(p) > -70);
  if (!abs.length) return -Infinity;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const rel = L(mean(abs)) - 10;
  const kept = abs.filter((p) => L(p) > rel);
  return kept.length ? L(mean(kept)) : -Infinity;
}

/** The highest value between samples, by four times oversampling with a windowed sinc round the samples near the top. */
export function truePeak(x) {
  const taps = 12;
  let top = 0;
  for (let i = 0; i < x.length; i++) top = Math.max(top, Math.abs(x[i]));
  const floor = top * 0.7;
  let peak = top;
  for (let i = taps; i < x.length - taps; i++) {
    if (Math.abs(x[i]) < floor) continue;
    for (let ph = 1; ph < 4; ph++) {
      const frac = ph / 4;
      let v = 0;
      for (let k = -taps + 1; k <= taps; k++) {
        const t = k - frac;
        v += x[i + k] * (Math.sin(Math.PI * t) / (Math.PI * t)) * (0.5 + 0.5 * Math.cos((Math.PI * t) / taps));
      }
      peak = Math.max(peak, Math.abs(v));
    }
  }
  return peak;
}

/**
 * Clicks: places where the wave's second difference stands far above what
 * surrounds it (a step or a spike in an otherwise smooth wave), and the
 * largest jump from one sample to the next.
 */
export function clicks(x, sr) {
  const n = x.length;
  let maxJump = 0;
  for (let i = 1; i < n; i++) maxJump = Math.max(maxJump, Math.abs(x[i] - x[i - 1]));
  const win = Math.round(0.02 * sr);
  const d2 = new Float32Array(n);
  for (let i = 2; i < n; i++) d2[i] = Math.abs(x[i] - 2 * x[i - 1] + x[i - 2]);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + d2[i];
  let count = 0;
  let last = -1e9;
  const at = [];
  for (let i = 2; i < n; i++) {
    if (d2[i] < 0.02) continue;
    const a = Math.max(0, i - win);
    const b = Math.min(n, i + win);
    const mean = (pre[b] - pre[a] - d2[i]) / (b - a - 1);
    if (d2[i] > 14 * mean + 0.02 && i - last > win) {
      count++;
      last = i;
      if (at.length < 6) at.push(+(i / sr).toFixed(3));
    }
  }
  return { count, maxJump, at };
}

/** RMS in dBFS of a stretch of a render, seconds. */
export function rmsOf(chs, sr, t0, t1) {
  const a = Math.max(0, Math.round(t0 * sr));
  const b = Math.min(chs[0].length, Math.round(t1 * sr));
  let sq = 0;
  for (const c of chs) for (let i = a; i < b; i++) sq += c[i] * c[i];
  return db(Math.sqrt(sq / Math.max(1, (b - a) * chs.length)));
}

/** Everything about a render. Peak, DC and clicks are over all of it; the rest is from `from` seconds on. */
export function analyze(all, sr, from = 0) {
  const start = Math.min(all[0].length - 1, Math.round(from * sr));
  const chs = all.map((c) => c.subarray(start));
  const n = chs[0].length;
  const mono = new Float32Array(n);
  for (const c of chs) for (let i = 0; i < n; i++) mono[i] += c[i] / chs.length;
  let peak = 0;
  let dc = 0;
  for (const c of all) {
    for (let i = 0; i < c.length; i++) {
      const a = Math.abs(c[i]);
      if (a > peak) peak = a;
      dc += c[i];
    }
  }
  let sq = 0;
  for (const c of chs) for (let i = 0; i < n; i++) sq += c[i] * c[i];
  const rms = Math.sqrt(sq / (n * chs.length));
  const N = 4096;
  let tot = 0;
  let cen = 0;
  let hi = 0;
  stft(mono, N, N / 2, (p) => {
    for (let i = 1; i < p.length; i++) {
      const f = (i * sr) / N;
      tot += p[i];
      cen += p[i] * f;
      if (f >= 6000) hi += p[i];
    }
  });
  let lr = 0;
  let ll = 0;
  let rr = 0;
  for (let i = 0; i < n; i++) {
    lr += chs[0][i] * chs[1][i];
    ll += chs[0][i] * chs[0][i];
    rr += chs[1][i] * chs[1][i];
  }
  const ck = all.map((c) => clicks(c, sr));
  return {
    seconds: +(all[0].length / sr).toFixed(1),
    peakDb: +db(peak).toFixed(2),
    truePeakDb: +db(Math.max(...all.map((c) => truePeak(c)))).toFixed(2),
    rmsDb: +db(rms).toFixed(1),
    lufs: +loudness(chs, sr).toFixed(1),
    crestDb: +(db(peak) - db(rms)).toFixed(1),
    centroidHz: tot ? Math.round(cen / tot) : 0,
    above6k: tot ? +(hi / tot).toFixed(4) : 0,
    dc: +(dc / (all[0].length * all.length)).toExponential(1),
    clicks: ck.reduce((s, c) => s + c.count, 0),
    clickAt: ck.flatMap((c) => c.at).slice(0, 6),
    maxJump: +Math.max(...ck.map((c) => c.maxJump)).toFixed(4),
    corr: ll && rr ? +(lr / Math.sqrt(ll * rr)).toFixed(2) : 1,
  };
}

/* ---------- files ---------- */

function wav(chs, sr) {
  const n = chs[0].length;
  const out = Buffer.alloc(44 + n * chs.length * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + n * chs.length * 2, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(chs.length, 22);
  out.writeUInt32LE(sr, 24);
  out.writeUInt32LE(sr * chs.length * 2, 28);
  out.writeUInt16LE(chs.length * 2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(n * chs.length * 2, 40);
  let at = 44;
  for (let i = 0; i < n; i++) {
    for (const c of chs) {
      out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, c[i])) * 32767), at);
      at += 2;
    }
  }
  return out;
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function png(w, h, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A picture of a render: frequency (40 Hz at the foot to 18 kHz at the top, each octave the same height) against time, and the wave's level under it. */
function spectrogram(chs, sr) {
  const n = chs[0].length;
  const mono = new Float32Array(n);
  for (const c of chs) for (let i = 0; i < n; i++) mono[i] += c[i] / chs.length;
  const N = 4096;
  const W = Math.min(1500, Math.max(300, Math.round((n / sr) * 40)));
  const hop = Math.max(256, Math.floor((n - N) / W));
  const H = 300;
  const strip = 70;
  const rgb = Buffer.alloc(W * (H + strip) * 3);
  let col = 0;
  stft(mono, N, hop, (p) => {
    if (col >= W) return;
    for (let y = 0; y < H; y++) {
      const f0 = 40 * Math.pow(18000 / 40, (H - 1 - y) / H);
      const f1 = 40 * Math.pow(18000 / 40, (H - y) / H);
      const b0 = Math.max(1, Math.floor((f0 * N) / sr));
      const b1 = Math.max(b0 + 1, Math.ceil((f1 * N) / sr));
      let e = 0;
      for (let b = b0; b < b1 && b < p.length; b++) e += p[b];
      // (Power in the band, against a full-scale sine's.)
      const d = 10 * Math.log10(e / ((N * N) / 16) + 1e-14);
      const v = Math.min(1, Math.max(0, (d + 96) / 84));
      const at = (y * W + col) * 3;
      rgb[at] = Math.round(255 * Math.min(1, v * 1.6));
      rgb[at + 1] = Math.round(255 * Math.max(0, v * 1.7 - 0.5));
      rgb[at + 2] = Math.round(255 * (v < 0.4 ? v * 1.6 : Math.max(0, 1.5 - v * 1.4)));
    }
    col++;
  });
  for (let x = 0; x < W; x++) {
    const a = Math.floor((x * n) / W);
    const b = Math.floor(((x + 1) * n) / W);
    let pk = 0;
    for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(mono[i]));
    // The level strip is in decibels: its top is 0 dBFS, its foot -72.
    const hgt = Math.round(strip * Math.min(1, Math.max(0, (db(pk) + 72) / 72)));
    for (let y = 0; y < strip; y++) {
      const at = ((H + y) * W + x) * 3;
      const on = strip - y <= hgt;
      rgb[at] = on ? 210 : 18;
      rgb[at + 1] = on ? 220 : 18;
      rgb[at + 2] = on ? 230 : 24;
    }
  }
  return png(W, H + strip, rgb);
}

/* ---------- the scenes ---------- */

function scenes(K) {
  const [, say, view, up, bench, bridge, models, fork, lattice, canyon, delta] = K.starts;
  const stop = K.stops;
  // Arrive at a station's composed frame from a little before it, and hold.
  const station = (i, night = 0) => ({ seconds: 18, scroll: [[0, stop[i] - 0.8], [3.2, stop[i]]], night: [[0, night]], clock0: 2.2 });
  return {
    'hero-rest': { seconds: 26, scroll: [[0, 0]] },
    'hero-rest-night': { seconds: 26, scroll: [[0, 0]], night: [[0, 1]] },
    'melt-slow': { seconds: 34, scroll: [[0, 0], [3, 0], [30, 2.0]], transients: true },
    'melt-medium': { seconds: 18, scroll: [[0, 0], [3, 0], [11, 2.0]], transients: true },
    'melt-fast': { seconds: 12, scroll: [[0, 0], [3, 0], [5.2, 2.0]], transients: true },
    'river-fast': { seconds: 18, scroll: [[0, say], [3, say], [11, bridge - 0.4]], transients: true },
    'station-0-statement': station(1),
    'station-1-infiniview': station(2),
    'station-2-upstream': station(3),
    'station-3-bench': station(4),
    'station-4-bridge': { ...station(5), seconds: 24, transients: true },
    'station-5-models': { ...station(6), transients: true },
    'station-6-fork': station(7),
    'station-7-lattice': { ...station(8), seconds: 24, transients: true },
    'station-8-canyon': { seconds: 22, scroll: [[0, canyon - 0.4], [3, canyon - 0.4], [9, stop[9]]], clock0: 2.2 },
    'station-9-delta': station(10),
    'wake-press': {
      seconds: 16,
      scroll: [[0, stop[1]]],
      pointer: [[0, 0.3, 0.7, 0], [3, 0.3, 0.7, 30], [6, 0.8, 0.72, 30], [6.6, 0.8, 0.72, 30], [7.1, 0.25, 0.68, 22], [7.6, 0.85, 0.7, 22], [8.1, 0.3, 0.66, 22], [8.5, 0.5, 0.7, 22], [16, 0.5, 0.7, 22]],
      events: [[10, 'press', 0.3, 0.8, 14], [11.5, 'press', 0.55, 0.66, 34], [13, 'press', 0.8, 0.56, 66]],
      transients: true,
    },
    switch: { seconds: 20, scroll: [[0, stop[7]]], events: [[5, 'switch', 1], [9.5, 'switch', 2], [14, 'switch', 0]], transients: true },
    dawn: { seconds: 28, scroll: [[0, K.END_AT - 2.6], [3, K.END_AT - 2.6], [10, K.END_AT]], transients: true },
    'dawn-night': { seconds: 28, scroll: [[0, K.END_AT - 2.6], [3, K.END_AT - 2.6], [10, K.END_AT]], night: [[0, 1]], transients: true },
    theme: { seconds: 24, scroll: [[0, stop[3]]], night: [[0, 0], [7, 1], [16, 0]], transients: true },
    'ui-and-route': {
      seconds: 14,
      scroll: [[0, stop[2]]],
      events: [[4, 'hover', 0.82], [4.5, 'hover', 0.87], [5, 'hover', 0.92], [6, 'tap', 0.87], [6.2, 'route'], [9, 'hover', 0.3], [9.6, 'tap', 0.3], [11, 'haptic:success']],
      transients: true,
    },
    'inner-page': { seconds: 24, home: false, scroll: [[0, 0], [8, 0], [12, 1.5], [24, 1.5]], events: [[5, 'route'], [15, 'hover', 0.8], [15.6, 'tap', 0.8]], transients: true },
    'reduced-motion': { seconds: 22, calm: true, scroll: [[0, 0], [3, 0], [10, 5.5]] },
    // Sound turned on a second in, turned off at eight: silence before and after.
    silence: { seconds: 14, scroll: [[0, stop[1]]], power: [[1, 1, 2], [8, 0, 0.5]], silent: [[0, 0.98], [10.5, 14]] },
    // The whole flight at a reading pace, and the ending held.
    flight: { seconds: 86, scroll: [[0, 0], [3, 0], [3 + K.END_AT / 0.45, K.END_AT]], transients: true },
  };
}

/* ---------- running it ---------- */

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('playwright not found. Set NODE_PATH to a node_modules folder that contains it.');
    process.exit(2);
  }
}

/** Serve the repo's own TypeScript to the page, transpiled as it is asked for. */
async function serveSource(page) {
  const ts = require('typescript');
  await page.route('http://audio.check/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"@/":"http://audio.check/src/"}}</script><body></body>' });
    }
    const base = join(root, path);
    const file = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && !f.endsWith('/'));
    if (!file || !file.startsWith(join(root, 'src'))) return route.fulfill({ status: 404, body: 'not found' });
    const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: file }).outputText;
    return route.fulfill({ contentType: 'text/javascript', body: js });
  });
  await page.goto('http://audio.check/');
}

async function renders() {
  const { chromium } = loadPlaywright();
  const out = resolve(arg('out', '.tools/out/w5/renders'));
  mkdirSync(out, { recursive: true });
  const only = arg('only', '');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => (m.type() === 'error' ? console.error('console:', m.text()) : null));
  await serveSource(page);
  const K = await page.evaluate(async () => {
    const c = await import('http://audio.check/src/water/camera');
    return { stops: c.stillStops(), starts: c.sectionStarts(), END_AT: c.END_AT, SETTLE_AT: c.SETTLE_AT };
  });
  const all = scenes(K);
  const names = Object.keys(all).filter((n) => !only || only.split(',').includes(n));
  const rows = [];
  let failed = 0;
  for (const name of names) {
    const { transients, silent, ...spec } = all[name];
    // (--solo bed|world|fx|ui: hear one bus alone, to set its level.)
    if (arg('solo', '')) spec.solo = arg('solo', '');
    const t0 = Date.now();
    const meta = await page.evaluate(async (s) => {
      const { renderScene } = await import('http://audio.check/src/audio/render');
      const r = await renderScene(s);
      window.__r = r;
      return { sr: r.sampleRate, n: r.channels[0].length, chords: r.chords, trace: r.trace, series: r.series };
    }, spec);
    // The samples come across in pieces: a long scene is tens of megabytes.
    const chs = [];
    for (let c = 0; c < 2; c++) {
      const data = new Float32Array(meta.n);
      const piece = 2_000_000;
      for (let at = 0; at < meta.n; at += piece) {
        const b64 = await page.evaluate(
          ([ch, a, b]) => {
            const u8 = new Uint8Array(window.__r.channels[ch].slice(a, b).buffer);
            let str = '';
            for (let i = 0; i < u8.length; i += 32768) str += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
            return btoa(str);
          },
          [c, at, Math.min(meta.n, at + piece)],
        );
        const buf = Buffer.from(b64, 'base64');
        data.set(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4), at);
      }
      chs.push(data);
    }
    const power = spec.power ?? [[0, 1, 2]];
    const m = analyze(chs, meta.sr, Math.min(spec.seconds - 4, power[0][0] + 3));
    const problems = [];
    if (m.peakDb > -1) problems.push(`peak ${m.peakDb} dBFS`);
    if (m.truePeakDb > -1) problems.push(`true peak ${m.truePeakDb} dBFS`);
    if (Math.abs(+m.dc) > 1e-3) problems.push(`DC ${m.dc}`);
    if (m.maxJump > 0.25) problems.push(`jump ${m.maxJump}`);
    if (!transients && m.clicks > 0) problems.push(`${m.clicks} clicks at ${m.clickAt.join(', ')} s`);
    if (m.above6k > 0.12) problems.push(`harsh: ${(m.above6k * 100).toFixed(1)}% above 6 kHz`);
    const quiet = (silent ?? []).map(([a, b]) => +rmsOf(chs, meta.sr, a, b).toFixed(1));
    quiet.forEach((q, i) => {
      if (q > -80) problems.push(`not silent ${silent[i][0]} to ${silent[i][1]} s: ${q} dBFS`);
    });
    if (problems.length) failed++;
    writeFileSync(join(out, `${name}.wav`), wav(chs, meta.sr));
    writeFileSync(join(out, `${name}.png`), spectrogram(chs, meta.sr));
    writeFileSync(join(out, `${name}.json`), JSON.stringify({ spec, metrics: m, quiet, chords: meta.chords, trace: meta.trace, series: meta.series }));
    rows.push({ name, ...m, quiet, problems });
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${name.padEnd(22)} ${String(m.seconds).padStart(5)} s  peak ${String(m.peakDb).padStart(7)}  true ${String(m.truePeakDb).padStart(7)}  rms ${String(m.rmsDb).padStart(6)}  ${String(m.lufs).padStart(6)} LUFS  crest ${String(m.crestDb).padStart(5)}  centroid ${String(m.centroidHz).padStart(5)} Hz  >6k ${(m.above6k * 100).toFixed(2).padStart(5)}%  dc ${m.dc}  clicks ${m.clicks}${transients ? '*' : ''}  jump ${m.maxJump}  corr ${m.corr}${quiet.length ? `  silence ${quiet.join(', ')} dBFS` : ''}  (${((Date.now() - t0) / 1000).toFixed(1)} s)${problems.length ? `\n     ${problems.join('; ')}` : ''}`);
  }
  await browser.close();
  const head = '| scene | seconds | peak dBFS | true peak | RMS | LUFS | crest dB | centroid Hz | above 6 kHz | DC | clicks | largest jump | L/R corr | silence dBFS | result |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const body = rows.map((r) => `| ${r.name} | ${r.seconds} | ${r.peakDb} | ${r.truePeakDb} | ${r.rmsDb} | ${r.lufs} | ${r.crestDb} | ${r.centroidHz} | ${(r.above6k * 100).toFixed(2)}% | ${r.dc} | ${r.clicks}${all[r.name].transients ? '*' : ''} | ${r.maxJump} | ${r.corr} | ${r.quiet.join(', ') || ''} | ${r.problems.length ? r.problems.join('; ') : 'ok'} |`);
  writeFileSync(join(out, 'table.md'), `${head}\n${body.join('\n')}\n\n\\* scenes with intended transients (cracks, drops, plucks, ticks): the click detector counts their onsets; the largest jump is the guard there.\n`);
  console.log(`\n${rows.length} scenes, ${failed} failed. WAVs, spectrograms and table.md in ${out}`);
  process.exit(failed ? 1 : 0);
}

/* ---------- sync ---------- */

async function sync(base) {
  const { chromium } = loadPlaywright();
  const out = resolve(arg('out', '.tools/out/w5'));
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' ? errors.push(m.text()) : null));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.flight === 'on', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => !!window.__sound);
  await page.click('.nav-sound');
  await page.waitForFunction(() => window.__sound && window.__sound.ctx.state === 'running', null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  // Listen to the buses the moments sound on, block by block, in the context's own time.
  await page.evaluate(() => {
    const { ctx, sound } = window.__sound;
    sound.trace = [];
    const tap = ctx.createScriptProcessor(256, 2, 2);
    const blocks = (window.__blocks = []);
    tap.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      const r = e.inputBuffer.getChannelData(1);
      let first = -1;
      let pk = 0;
      for (let i = 0; i < d.length; i++) {
        const v = Math.max(Math.abs(d[i]), Math.abs(r[i]));
        if (v > pk) pk = v;
        if (first < 0 && v > 2e-4) first = i;
      }
      if (blocks.length < 400000) blocks.push([e.playbackTime, pk, first]);
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    sound.g.fx.connect(tap);
    sound.g.ui.connect(tap);
    sound.g.bellIn.connect(tap);
    tap.connect(mute).connect(ctx.destination);
    // The two clocks, read together every frame.
    const pairs = (window.__pairs = []);
    const loop = () => {
      const o = ctx.getOutputTimestamp();
      if (pairs.length < 100000) pairs.push([performance.now(), ctx.currentTime, o.contextTime, o.performanceTime]);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const unit = await page.evaluate(() => window.__flight.state().unit);
  const K = await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('[data-fl]')).map((el) => el.offsetTop);
    return { secs, max: document.documentElement.scrollHeight - innerHeight };
  });
  const to = async (screens, ms = 900) => {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(screens * unit));
    await page.waitForTimeout(ms);
  };
  const glide = async (from, toS, seconds) => {
    const steps = Math.round(seconds * 30);
    for (let i = 0; i <= steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round((from + ((toS - from) * i) / steps) * unit));
      await page.waitForTimeout(33);
    }
  };
  const stops = await page.evaluate(() => Array.from(document.querySelectorAll('[data-fl]')).map((el) => el.offsetTop / window.__flight.state().unit));
  // The melt's first crack: from the frozen lake, begin to scroll.
  await to(0, 1500);
  await glide(0.05, 1.6, 5);
  // A press on water: the river at the statement.
  await to(stops[1] + 0.7, 2500);
  for (const [x, y] of [[980, 620], [700, 700], [1100, 560], [860, 760]]) {
    await page.mouse.move(x, y, { steps: 3 });
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(900);
  }
  // The shards: hold at the tarn for two of the pulse's rounds.
  await to(stops[5] + 1.2, 16500);
  // The columns' drips.
  await to(stops[6] + 1.2, 4000);
  // The switch.
  await to(stops[7] + 1.2, 2500);
  for (const i of [1, 2, 0]) {
    await page.locator('.switch-opt').nth(i).click();
    await page.waitForTimeout(1600);
  }
  // The lattice: a lap and a half.
  await to(stops[8] + 1.15, 14000);
  // The dawn.
  await to(stops[11] - 0.6, 1500);
  await glide(stops[11] - 0.6, K.max / unit, 3);
  await page.waitForTimeout(6000);
  const data = await page.evaluate(() => ({ trace: window.__sound.sound.trace, blocks: window.__blocks, pairs: window.__pairs, base: window.__sound.ctx.baseLatency, outLat: window.__sound.ctx.outputLatency, sr: window.__sound.ctx.sampleRate }));
  await browser.close();

  // For each moment: cause to the request for its sound (both on the page's clock), and the real onset in the stream against the start that was asked for.
  const perfOf = (ct) => {
    // The frame whose reading of the audio clock is nearest: the context's time `ct` is that frame's present plus the difference.
    let best = data.pairs[0];
    for (const p of data.pairs) if (Math.abs(p[1] - ct) < Math.abs(best[1] - ct)) best = p;
    return best[0] + (ct - best[1]) * 1000;
  };
  const onsetOf = (audio) => {
    // The first block, from just before the asked-for start, whose level stands clear of the blocks before it.
    // (A block is 256 samples, 5.3 ms: that is how finely the onset is placed.)
    const span = 256 / data.sr;
    let i = data.blocks.findIndex((b) => b[0] + span >= audio - span);
    if (i < 4) return NaN;
    for (; i < data.blocks.length && data.blocks[i][0] <= audio + 0.12; i++) {
      const before = Math.max(data.blocks[i - 1][1], data.blocks[i - 2][1], data.blocks[i - 3][1], data.blocks[i - 4][1]);
      if (data.blocks[i][1] > 4e-4 && data.blocks[i][1] > 2.2 * before) return Math.max(data.blocks[i][0], audio - span);
    }
    return NaN;
  };
  const by = {};
  for (const e of data.trace) (by[e.type] ||= []).push(e);
  const stat = (a) => {
    const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
    return s.length ? { n: s.length, min: s[0], med: s[Math.floor(s.length / 2)], max: s[s.length - 1] } : { n: 0, min: NaN, med: NaN, max: NaN };
  };
  const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : 'n/a');
  const lines = ['| moment | count | cause to request, ms (min / median / max) | cause to start on the audio clock, ms (min / median / max) | start asked for to onset found in the stream, ms (median / max; 5.3 ms blocks) | within a frame |', '| --- | --- | --- | --- | --- | --- |'];
  let bad = 0;
  for (const type of ['press', 'switch', 'crack', 'pulse', 'landing', 'lattice', 'drip', 'dawn', 'ray', 'melt', 'tap', 'hover']) {
    const ev = by[type];
    if (!ev) {
      lines.push(`| ${type} | 0 | | | | not caused |`);
      continue;
    }
    const req = stat(ev.map((e) => e.made - e.cause));
    const start = stat(ev.map((e) => perfOf(e.audio) - e.cause));
    const on = stat(ev.map((e) => (onsetOf(e.audio) - e.audio) * 1000));
    const ok = start.max <= 17;
    if (!ok) bad++;
    lines.push(`| ${type} | ${ev.length} | ${f(req.min)} / ${f(req.med)} / ${f(req.max)} | ${f(start.min)} / ${f(start.med)} / ${f(start.max)} | ${f(on.med)} / ${f(on.max)} (${on.n} found) | ${ok ? 'yes' : 'NO'} |`);
  }
  const lead = stat(data.pairs.filter((p) => p[3] > 0).map((p) => (p[1] - p[2]) * 1000));
  const note = `\nAudio context: ${data.sr} Hz, base latency ${(data.base * 1000).toFixed(1)} ms, output latency ${(data.outLat * 1000).toFixed(1)} ms; the audio clock runs ${f(lead.med)} ms (median) ahead of what the output device is playing. Sound loaded before the click: ${before}. Console errors: ${errors.length}.\n`;
  writeFileSync(join(out, 'sync.md'), lines.join('\n') + '\n' + note);
  writeFileSync(join(out, 'sync.json'), JSON.stringify({ trace: data.trace, base: data.base, outLat: data.outLat, errors }));
  console.log(lines.join('\n') + '\n' + note);
  if (errors.length) console.log(errors.slice(0, 10).join('\n'));
  process.exit(bad ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = arg('sync', '');
  if (base) await sync(base);
  else await renders();
}
