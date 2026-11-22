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
 *    silence wherever a scene says there must be silence. A scene may
 *    also say what the conductor must have done in it (its trace of
 *    moments and the harmony it moved through): the arrival's notes at
 *    their times on the light event's clock, the name's letters going
 *    under in their stretch of the melt and the sheet breaking after the
 *    last, nothing sounding for a jump. A WAV and a spectrogram of each
 *    scene are written, so a person can listen and look.
 *
 * 2. Sync (--sync <base> [--label name] [--load]). On the running site,
 *    with sound turned on by a real click, it causes each moment and reads
 *    the conductor's own trace. Moments on the picture's own clock (the
 *    shards' pulse, the lattice, the gates, the surge, the drips, the crests
 *    that land on the block, and the arrival: the gathering along the line
 *    of light, the theme and the ladder up the ribbon) are set ahead: for each, the time it is heard (the
 *    audio time it starts at, through the device's latency as the output
 *    timestamps give it) against the time of the frame that shows it.
 *    Moments a visitor causes (a press, the switch, a tick of the rail, the
 *    ice cracking and the name's letters going under as the page is
 *    scrolled) are asked for at once: the cause against the start on the
 *    audio clock. It also listens to the effects' bus and finds each sound's
 *    real onset in the stream. --load runs a second renderer on the GPU.
 *
 * Playwright is not a dependency of this repo. Point NODE_PATH at an
 * install that has it:
 *
 *   NODE_PATH=.tools/node_modules node scripts/audio-check.mjs [--out .tools/out/w19/renders] [--only hero-rest,dawn] [--solo bed|world|fx|ui]
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

/**
 * A loop a listener could find shows as the sound's fine texture coming
 * round again. This takes the level of the band the water and the air live
 * in (1.5 to 7 kHz) every 10 ms, removes its slow drift (anything a second
 * or longer: a scroll, a swell), and looks for a lag between 0.4 and 14 s at
 * which that texture matches itself. Random water gives a few hundredths; a
 * looped buffer gives a clear peak at its length.
 */
export function loopOf(x, sr) {
  const N = 1024;
  const hop = 480;
  const env = [];
  const b0 = Math.round((1500 * N) / sr);
  const b1 = Math.round((7000 * N) / sr);
  stft(x, N, hop, (p) => {
    let e = 0;
    for (let i = b0; i < b1; i++) e += p[i];
    env.push(Math.log(e + 1e-12));
  });
  const n = env.length;
  const per = sr / hop;
  if (n < per * 3) return { r: 0, lag: 0 };
  // Take off the slow part: a running mean a second wide.
  const half = Math.round(per / 2);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + env[i];
  const d = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n, i + half + 1);
    d[i] = env[i] - (pre[b] - pre[a]) / (b - a);
  }
  let best = { r: 0, lag: 0 };
  const maxLag = Math.min(Math.round(14 * per), Math.floor(n / 2));
  for (let lag = Math.round(0.4 * per); lag < maxLag; lag++) {
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 0; i + lag < n; i++) {
      ab += d[i] * d[i + lag];
      aa += d[i] * d[i];
      bb += d[i + lag] * d[i + lag];
    }
    const r = aa && bb ? ab / Math.sqrt(aa * bb) : 0;
    if (r > best.r) best = { r, lag: lag / per };
  }
  return best;
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
  let mid = 0;
  stft(mono, N, N / 2, (p) => {
    for (let i = 1; i < p.length; i++) {
      const f = (i * sr) / N;
      tot += p[i];
      cen += p[i] * f;
      if (f >= 6000) hi += p[i];
      if (f >= 300 && f <= 4000) mid += p[i];
    }
  });
  const lp = loopOf(mono, sr);
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
    mid: tot ? +(mid / tot).toFixed(3) : 0,
    midDb: +db(Math.sqrt((mid / Math.max(1, tot)) * (sq / (n * chs.length)))).toFixed(1),
    loop: +lp.r.toFixed(2),
    loopAt: +lp.lag.toFixed(2),
    dc: +(dc / (all[0].length * all.length)).toExponential(1),
    clicks: ck.reduce((s, c) => s + c.count, 0),
    clickAt: ck.flatMap((c) => c.at).slice(0, 6),
    maxJump: +Math.max(...ck.map((c) => c.maxJump)).toFixed(4),
    corr: ll && rr ? +(lr / Math.sqrt(ll * rr)).toFixed(2) : 1,
  };
}

/** The largest jump from one sample to the next in a stretch of a render, seconds. */
export function stepOf(chs, sr, t0, t1) {
  const a = Math.max(1, Math.round(t0 * sr));
  const b = Math.min(chs[0].length, Math.round(t1 * sr));
  let worst = 0;
  for (const c of chs) for (let i = a; i < b; i++) worst = Math.max(worst, Math.abs(c[i] - c[i - 1]));
  return worst;
}

/** The loudness (BS.1770, gated) of a stretch of a render, seconds. */
export function loudnessOf(chs, sr, t0, t1) {
  const a = Math.max(0, Math.round(t0 * sr));
  const b = Math.min(chs[0].length, Math.round(t1 * sr));
  return loudness(chs.map((c) => c.subarray(a, b)), sr);
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

/** The moments of one kind in a render's trace, in order (those taken back left out). */
// (A moment held back a few hundredths on purpose, behind another of its kind in the same frame, is noted with a `+`.)
const of = (meta, type) => meta.trace.filter((e) => e.type === type || e.type === `${type}+`).sort((a, b) => a.audio - b.audio);

/**
 * What the arrival must be, wherever a scene has the light event in it:
 * one low bell at the dawn; the six notes of the gathering inside the
 * line's run, in order; then, not before the ribbon's first light, the
 * theme's five chords from that light to the end of the rise and the six
 * rungs of the ladder between them; the harmony on the dominant until the
 * ribbon leaves the water and on the tonic from then.
 */
function arrivalCheck(K) {
  return (meta) => {
    const bad = [];
    const dawn = of(meta, 'dawn');
    if (dawn.length !== 1) return [`the dawn came ${dawn.length} times`];
    const t0 = dawn[0].audio;
    const rel = (type) => of(meta, type).map((e) => e.audio - t0);
    const near = (a, b, what, tol = 0.02) => Math.abs(a - b) > tol && bad.push(`${what}: ${a.toFixed(3)} s after the dawn, not ${b.toFixed(3)}`);
    const gather = rel('gather');
    const chords = rel('arrival');
    const climb = rel('climb');
    if (gather.length !== 6) bad.push(`${gather.length} notes in the gathering, not 6`);
    if (chords.length !== 5) bad.push(`${chords.length} chords of the theme, not 5`);
    if (climb.length !== 6) bad.push(`${climb.length} rungs of the ladder, not 6`);
    gather.forEach((t, i) => near(t, K.gather[i], `gathering note ${i}`));
    chords.forEach((t, i) => near(t, K.arrival[i], `the theme's chord ${i}`));
    if (gather.length && gather[gather.length - 1] > K.lineEnd + 0.02) bad.push('the gathering ran on past the line of light');
    if (chords.length && gather.length && chords[0] - gather[gather.length - 1] < 0.25) bad.push('no breath between the line reaching the far shore and the ribbon');
    if (climb.length && chords.length && (climb[0] < chords[0] || climb[climb.length - 1] > K.DAWN.rise[1])) bad.push('the ladder is not inside the ribbon\'s rise');
    for (let j = 1; j < climb.length; j++) if (climb[j] <= climb[j - 1]) bad.push('the ladder does not climb in time');
    // The harmony: the tonic comes with the ribbon, from the dominant, and not before.
    const rest = meta.chords.find((c) => c.move === 'rest');
    if (!rest) bad.push('the tonic never came');
    else {
      if (rest.t - t0 < K.ARRIVE_AT - 0.06 || rest.t - t0 > K.ARRIVE_AT + 0.06) bad.push(`the tonic came ${(rest.t - t0).toFixed(2)} s after the dawn, not with the ribbon at ${K.ARRIVE_AT.toFixed(2)}`);
      const before = meta.chords.filter((c) => c.t < rest.t).pop();
      if (!before || !/^A/.test(before.chord) || before.move !== 'approach') bad.push(`before the tonic the harmony was ${before ? `${before.chord} (${before.move})` : 'nothing'}`);
      if (meta.chords.some((c) => c.t > t0 - 0.5 && c.t < rest.t - 0.01 && c !== before)) bad.push('the harmony moved between the dawn and the ribbon');
    }
    if (of(meta, 'resolve').length) bad.push('the still resolution sounded over a light event');
    return bad;
  };
}

/** Where no light event runs (reduced motion, or the sun already up): the resolution and one soft chord, no sweep. */
const stillArrivalCheck = (meta) => {
  const bad = [];
  for (const type of ['dawn', 'gather', 'arrival', 'climb', 'air']) if (of(meta, type).length) bad.push(`${of(meta, type).length} of '${type}' with no light event`);
  if (of(meta, 'resolve').length !== 1) bad.push(`the resolution was marked ${of(meta, 'resolve').length} times, not once`);
  if (!meta.chords.some((c) => c.move === 'rest' && /^D/.test(c.chord))) bad.push('the tonic never came');
  return bad;
};

/**
 * The name's melt, in the picture's order: cracks first (under the
 * letters), then every letter's last going under, once each, inside its
 * stretch of the melt, then the sheet's break, once, after the last
 * letter; and the meltwater at their feet before any of them goes.
 */
function nameCheck(K, { back = false } = {}) {
  return (meta) => {
    const bad = [];
    const meltAt = (t) => {
      const s = meta.series.reduce((best, x) => (Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best), meta.series[0]);
      return s.scene.melt;
    };
    const cracks = of(meta, 'crack');
    const letters = of(meta, 'letter');
    const breaks = of(meta, 'break');
    if (!cracks.length) bad.push('no crack');
    if (letters.length !== K.letters) bad.push(`${letters.length} letters went under, not ${K.letters}`);
    if (breaks.length !== 1) bad.push(`the sheet broke ${breaks.length} times`);
    if (cracks.length && letters.length && cracks[0].audio > letters[0].audio) bad.push('a letter went under before the first crack');
    for (const l of letters) {
      const m = meltAt(l.audio);
      if (m < K.NAME_MELT.left[0] - 0.04 || m > K.NAME_MELT.left[1] + 0.06) bad.push(`a letter went under at melt ${m.toFixed(2)}`);
    }
    if (breaks.length && letters.length && breaks[0].audio < letters[letters.length - 1].audio) bad.push('the sheet broke before the last letter had gone');
    // The meltwater: heard (the thin voice) by the time the ice under the blocks has begun to open, and before the first letter goes.
    const first = letters.length ? letters[0].audio : Infinity;
    const wet = meta.series.filter((x) => x.t < first && x.water[9] > 0.05);
    if (!wet.length) bad.push('no meltwater before the letters went');
    if (meta.series.some((x) => x.scene.melt < K.NAME_MELT.pond[0] - 0.01 && x.water[9] > 0)) bad.push('meltwater on a sheet that has not begun to melt');
    if (back) {
      // (The page went back up: nothing went under a second time, and the sheet did not break again.)
      const turn = meta.series.reduce((best, x) => (x.scene.melt > best.scene.melt ? x : best), meta.series[0]).t;
      if (letters.some((l) => l.audio > turn + 0.3)) bad.push('a letter went under on the way back up');
    }
    return bad;
  };
}

/** A tick of the rail: the page goes somewhere in one frame, and nothing sounds for what it did not pass. */
const jumpCheck = (n) => (meta) => {
  const bad = [];
  for (const type of ['crack', 'letter', 'break', 'melt']) if (of(meta, type).length) bad.push(`${of(meta, type).length} of '${type}' for a jump`);
  if (of(meta, 'jump').length !== n) bad.push(`${of(meta, 'jump').length} jumps heard, not ${n}`);
  if (meta.jumps !== n) bad.push(`the scene saw ${meta.jumps} jumps, not ${n}`);
  return bad;
};

function scenes(K) {
  const [, say, view, up, bench, bridge, models, fork, lattice, canyon, delta] = K.starts;
  const stop = K.stops;
  const arrival = arrivalCheck(K);
  // Arrive at a station's composed frame from a little before it, and hold.
  const station = (i, night = 0) => ({ seconds: 18, scroll: [[0, stop[i] - 0.8], [3.2, stop[i]]], night: [[0, night]], clock0: 2.2 });
  // The places in the flight's own order, by the registry's names: a walk comes to each in turn.
  const ORDER = Object.entries(K.stopOf).sort((x, y) => x[1] - y[1]);
  // A walk through the page as it is read: the first screen, then each place in the flight's own order, come to in
  // a second and a half and read for six, and the ending held through its light. The start is the page's own (the
  // mix fades in from silence over a second and a half at the reader's first gesture, here a second in).
  const walk = (extra, within) => {
    const scroll = [[0, 0], [5, 0]];
    let t = 5;
    for (const [, at] of ORDER.slice(1)) {
      scroll.push([t + 1.6, at], [t + 7.6, at]);
      t += 7.6;
    }
    return { seconds: Math.ceil(t + 16), scroll, power: [[1, 1, 1.5]], transients: true, loud: [-23, within], top: -3, places: ORDER.map(([id], i) => [id, i ? 5 + (i - 1) * 7.6 + 1.6 : 0, i ? 5 + i * 7.6 : 5]), ...extra };
  };
  return {
    // ---- sound on by default: the levels a reader gets, and no click where the mix is turned ----
    // The walk's loudness is the site's: about -23 LUFS, no peak over -3 dBTP.
    walk: walk({}, 1),
    'walk-night': walk({ night: [[0, 1]] }, 1.5),
    'walk-lean': walk({ lean: true }, 2),
    // The start, in a place with water running (the loudest steady place to start in): from silence, no step.
    'power-start': { seconds: 10, scroll: [[0, K.stopOf.upstream ?? stop[3]]], power: [[2, 1, 1.5]], silent: [[0, 1.98]], edges: [[2, 1.5]], top: -3, clock0: 2.2 },
    // Muted (200 ms), brought back (400 ms), muted again while it is still coming back, and back.
    'power-mute': { seconds: 16, scroll: [[0, K.stopOf.upstream ?? stop[3]]], power: [[0, 1, 1.5], [5, 0, 0.2], [8, 1, 0.4], [11, 0, 0.2], [11.1, 1, 0.4], [11.25, 0, 0.2], [13, 1, 0.4]], silent: [[5.21, 7.98], [11.46, 12.98]], edges: [[5, 0.2], [8, 0.4], [11, 0.2], [11.1, 0.4], [11.25, 0.2], [13, 0.4]], top: -3, clock0: 2.2 },
    // Muted on the first screen, where the bed and its bells are all there is.
    'power-mute-hero': { seconds: 14, scroll: [[0, 0]], power: [[0, 1, 1.5], [6, 0, 0.2], [9, 1, 0.4]], silent: [[6.21, 8.98]], edges: [[6, 0.2], [9, 0.4]], top: -3 },
    // A hidden tab and back: out in 300 ms, silence, in over 800 ms.
    'power-hidden': { seconds: 16, scroll: [[0, K.stopOf.upstream ?? stop[3]]], power: [[0, 1, 1.5], [6, 0, 0.3], [10, 1, 0.8]], silent: [[6.31, 9.98]], edges: [[6, 0.3], [10, 0.8]], top: -3, clock0: 2.2 },

    'hero-rest': { seconds: 26, scroll: [[0, 0]] },
    'hero-rest-night': { seconds: 26, scroll: [[0, 0]], night: [[0, 1]] },
    'melt-slow': { seconds: 34, scroll: [[0, 0], [3, 0], [30, 2.0]], transients: true, check: nameCheck(K) },
    'melt-medium': { seconds: 18, scroll: [[0, 0], [3, 0], [11, 2.0]], transients: true, check: nameCheck(K) },
    'melt-fast': { seconds: 12, scroll: [[0, 0], [3, 0], [5.2, 2.0]], transients: true, check: nameCheck(K) },
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
    // The basin: the pointer crosses the water slowly, then fast, then rests; three presses, near, middle and far.
    'wake-press': {
      seconds: 16,
      scroll: [[0, stop[2]]],
      pointer: [[0, 0.4, 0.78, 0], [3, 0.4, 0.78, 30], [6, 0.9, 0.8, 30], [6.6, 0.9, 0.8, 30], [7.1, 0.4, 0.76, 22], [7.6, 0.92, 0.78, 22], [8.1, 0.42, 0.74, 22], [8.5, 0.6, 0.78, 22], [16, 0.6, 0.78, 22]],
      events: [[10, 'press', 0.42, 0.88, 14], [11.5, 'press', 0.62, 0.72, 34], [13, 'press', 0.8, 0.56, 66]],
      transients: true,
    },
    switch: { seconds: 20, scroll: [[0, stop[7]]], events: [[5, 'switch', 1], [9.5, 'switch', 2], [14, 'switch', 0]], transients: true },
    dawn: { seconds: 28, scroll: [[0, K.END_AT - 2.6], [3, K.END_AT - 2.6], [10, K.END_AT]], transients: true, check: arrival },
    'dawn-night': { seconds: 28, scroll: [[0, K.END_AT - 2.6], [3, K.END_AT - 2.6], [10, K.END_AT]], night: [[0, 1]], transients: true, check: arrival },
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

    // Each station's water, alone (the world's bus only): arrive and hold.
    'water-lake-melted': { seconds: 20, scroll: [[0, 1.9], [3, say - 0.1]], solo: 'world' },
    'water-basin': { ...station(2), seconds: 22, solo: 'world', transients: true },
    'water-confluence': { ...station(3), seconds: 20, solo: 'world' },
    'water-pool': { ...station(4), seconds: 20, solo: 'world' },
    // (The pulse leaves a shard every three and a half seconds, with a real splash at its foot.)
    'water-tarn': { ...station(5), seconds: 20, solo: 'world', transients: true, period: [3.5] },
    'water-columns': { ...station(6), seconds: 20, solo: 'world', transients: true },
    'water-sluice': { ...station(7), seconds: 20, solo: 'world', events: [[6, 'switch', 1], [11, 'switch', 2], [15.5, 'switch', 0]], transients: true },
    'water-lattice': { ...station(8), seconds: 22, solo: 'world', transients: true, period: [9] },
    'water-canyon': { seconds: 20, scroll: [[0, canyon + 0.6], [3, canyon + 0.6], [14, stop[9]]], solo: 'world', clock0: 2.2 },
    'water-delta': { ...station(10), seconds: 20, solo: 'world' },
    'water-sea': { seconds: 40, scroll: [[0, K.END_AT]], solo: 'world', clock0: 9 },
    // The ice: at rest (its groans), and the first frames of the melt (the break, then the cracks that follow).
    'ice-rest': { seconds: 50, scroll: [[0, 0]], solo: 'fx', transients: true },
    'ice-first': { seconds: 14, scroll: [[0, 0], [3, 0], [9, 0.75]], transients: true },
    'ice-first-alone': { seconds: 14, scroll: [[0, 0], [3, 0], [9, 0.75]], solo: 'fx', transients: true },
    'ice-floes': { seconds: 14, scroll: [[0, 1.2], [3, 1.2], [10, 1.95]], solo: 'fx', transients: true },
    // The piece alone (the bed's bus only): the theme at the hero, through the flight, and at the arrival.
    'theme-hero': { seconds: 30, scroll: [[0, 0]], solo: 'bed', transients: true },
    'theme-hero-night': { seconds: 30, scroll: [[0, 0]], night: [[0, 1]], solo: 'bed', transients: true },
    'theme-flight': { seconds: 150, scroll: [[0, 0], [3, 0], [3 + K.END_AT / 0.22, K.END_AT]], solo: 'bed', transients: true },
    'theme-arrival': { seconds: 30, scroll: [[0, K.END_AT - 2.2], [3, K.END_AT - 2.2], [12, K.END_AT]], transients: true, check: arrival },
    'theme-arrival-alone': { seconds: 30, scroll: [[0, K.END_AT - 2.2], [3, K.END_AT - 2.2], [12, K.END_AT]], solo: 'bed', transients: true, check: arrival },
    // The three rooms, on the same sounds (the effects' bus only): three presses on water in each place.
    'room-open': { seconds: 14, scroll: [[0, stop[2]]], solo: 'fx', events: [[4, 'press', 0.5, 0.86, 16], [6.5, 'press', 0.4, 0.74, 30], [9, 'press', 0.62, 0.66, 50]], transients: true },
    'room-canyon': { seconds: 14, scroll: [[0, stop[9]]], solo: 'fx', events: [[4, 'press', 0.5, 0.86, 16], [6.5, 'press', 0.4, 0.74, 30], [9, 'press', 0.62, 0.66, 50]], transients: true, clock0: 2.2 },
    'room-still': { seconds: 14, scroll: [[0, stop[5]]], solo: 'fx', events: [[4, 'press', 0.5, 0.86, 16], [6.5, 'press', 0.4, 0.74, 30], [9, 'press', 0.62, 0.66, 50]], transients: true, clock0: 3.6 },
    // The aurora's own voice: the hero before dawn, the bed's bus only, against the same by day.
    'aurora': { seconds: 40, scroll: [[0, 0]], night: [[0, 1]], solo: 'bed', transients: true },
    // The phone's tier.
    'lean-hero': { seconds: 26, scroll: [[0, 0]], lean: true, transients: true },
    'lean-melt': { seconds: 18, scroll: [[0, 0], [3, 0], [11, 2.0]], lean: true, transients: true },
    'lean-confluence': { ...station(3), lean: true },
    'lean-dawn': { seconds: 28, scroll: [[0, K.END_AT - 2.6], [3, K.END_AT - 2.6], [10, K.END_AT]], lean: true, transients: true, check: arrival },
    'lean-flight': { seconds: 86, scroll: [[0, 0], [3, 0], [3 + K.END_AT / 0.45, K.END_AT]], lean: true, transients: true },
    // ---- as the picture now is ----
    // The arrival alone on each of its buses, on an upright screen, and where no light event runs.
    'arrival-bells': { seconds: 22, scroll: [[0, K.END_AT - 0.9], [2, K.END_AT - 0.9], [5, K.END_AT]], solo: 'bed', transients: true, check: arrival },
    'arrival-upright': { seconds: 24, scroll: [[0, K.END_AT - 1.6], [2, K.END_AT - 1.6], [7, K.END_AT]], aspect: 0.46, transients: true, check: arrival },
    // (Reduced motion: the ribbon is simply there. The resolution, no sweep.)
    'arrival-still': { seconds: 20, calm: true, scroll: [[0, K.END_AT - 2.6], [3, K.END_AT - 2.6], [6, K.END_AT]], transients: true, check: stillArrivalCheck },
    // (The sun is already up from an earlier visit to the ending in this page's life.)
    'arrival-again': { seconds: 20, dawned: true, scroll: [[0, K.END_AT - 1.4], [3, K.END_AT - 1.4], [8, K.END_AT]], transients: true, check: stillArrivalCheck },
    // A tick of the rail to the ending from the frozen lake: the dominant at once, the whole arrival, nothing for the lake it did not melt.
    'arrival-by-rail': { seconds: 22, scroll: [[0, 0]], events: [[4, 'tap', 0.985, 11, 12], [4.09, 'jump', 1]], jumps: [[4.1, K.END_AT]], transients: true, check: (m) => [...arrival(m), ...jumpCheck(1)(m)] },
    // The name's melt as a story, at a reading pace: the first cracks under the letters, meltwater, the letters going under, the sheet's break.
    'name-melt': { seconds: 30, scroll: [[0, 0], [3, 0], [27, 1.4]], transients: true, check: nameCheck(K) },
    'name-melt-night': { seconds: 30, scroll: [[0, 0], [3, 0], [27, 1.4]], night: [[0, 1]], transients: true, check: nameCheck(K) },
    'name-melt-ice': { seconds: 30, scroll: [[0, 0], [3, 0], [27, 1.4]], solo: 'fx', transients: true, check: nameCheck(K) },
    'name-melt-water': { seconds: 30, scroll: [[0, 0], [3, 0], [27, 1.4]], solo: 'world', transients: true, check: nameCheck(K) },
    'name-melt-upright': { seconds: 30, scroll: [[0, 0], [3, 0], [27, 1.4]], aspect: 0.46, transients: true, check: nameCheck(K) },
    // Down past the name and back up again: the letters go under once, on the way down only.
    'name-melt-back': { seconds: 30, scroll: [[0, 0], [3, 0], [14, 1.3], [17, 1.3], [27, 0.4]], transients: true, check: nameCheck(K, { back: true }) },
    // The rail: a hover down three ticks, then three jumps (lake to basin, basin to canyon, canyon back to the statement).
    'rail-jump': {
      seconds: 22,
      scroll: [[0, 0]],
      events: [[2, 'hover', 0.985, 0, 12], [2.4, 'hover', 0.985, 1, 12], [2.8, 'hover', 0.985, 2, 12], [4, 'tap', 0.985, 2, 12], [4.09, 'jump', 1], [10, 'tap', 0.985, 9, 12], [10.09, 'jump', 1], [16, 'tap', 0.985, 1, 12], [16.09, 'jump', -1]],
      jumps: [[4.1, stop[2]], [10.1, stop[9]], [16.1, stop[1]]],
      transients: true,
      clock0: 2.2,
      check: jumpCheck(3),
    },
    'rail-jump-world': { seconds: 22, scroll: [[0, 0]], events: [[4.09, 'jump', 1], [10.09, 'jump', 1], [16.09, 'jump', -1]], jumps: [[4.1, stop[2]], [10.1, stop[9]], [16.1, stop[1]]], solo: 'world', clock0: 2.2, check: jumpCheck(3) },
    // The basin's sea, long enough for two sets to come and go: each crest that lands on the block's face.
    'basin-sets': {
      seconds: 44,
      scroll: [[0, stop[2]]],
      solo: 'world',
      transients: true,
      check: (m) => {
        const n = of(m, 'slap').length;
        return n >= 8 && n <= 24 ? [] : [`${n} crests landed in 44 s`];
      },
    },
    // The dam from downstream: one running channel, two dry beds. The middle gate is opened, then the first again.
    'dam-channels': { ...station(7), seconds: 20, solo: 'world', events: [[8, 'switch', 1], [14, 'switch', 0]], transients: true },
    // The lattice's thread, in every lane; the columns' drips, where they land.
    'lattice-thread': { ...station(8), seconds: 22, solo: 'world', transients: true, period: [9] },
    // The tarn on an upright screen: the shards stand against the sky over a foot of bank, and still call and answer.
    'tarn-upright': {
      ...station(5),
      seconds: 22,
      aspect: 0.46,
      transients: true,
      check: (m) => (of(m, 'pulse').length >= 3 ? [] : [`${of(m, 'pulse').length} pulses heard at the tarn on an upright screen`]),
    },
    // The night: the aurora's voice following the curtains at the lake, and thinning as the first light grows down the flight.
    'aurora-curtains': { seconds: 70, scroll: [[0, 0]], night: [[0, 1]], solo: 'bed', transients: true, clock0: 12 },
    'aurora-thins': {
      seconds: 44,
      scroll: [[0, delta + 1.1], [3, delta + 1.1], [40, K.SETTLE_AT - 0.08]],
      night: [[0, 1]],
      solo: 'bed',
      transients: true,
      check: (m) => {
        const bad = [];
        const a = m.series.map((x) => x.mix.aurora);
        if (!(a[4] > 0.4)) bad.push(`the aurora's voice at the delta is ${a[4]}`);
        if (!(a[a.length - 2] < 0.05)) bad.push(`the aurora's voice as the sun is about to rise is ${a[a.length - 2]}`);
        // It thins from the top: when the highest partial has gone the lowest is still there.
        const hour = m.series.map((x) => x.scene.aurora);
        const i = hour.findIndex((h) => h < 0.7);
        if (i < 0) bad.push('the hour never lost its aurora');
        else if (m.series.slice(i).some((x) => x.shimmer[4] > 0)) bad.push('the highest partial outlasted the first light');
        return bad;
      },
    },
    // The picture's clock disturbed: three long frames at the tarn and the lattice. What was set ahead is taken back, nothing clicks.
    'stalled': { seconds: 24, scroll: [[0, stop[5]], [10, stop[5]], [12, stop[8]]], stalls: [[5.9, 300], [8.4, 120], [17.9, 250]], transients: true, clock0: 2.2, disturbedMin: 3 },
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
  await page.route('https://audio.check/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"@/":"https://audio.check/src/"}}</script><body></body>' });
    }
    const base = join(root, path);
    const file = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && !f.endsWith('/'));
    if (!file || !file.startsWith(join(root, 'src'))) return route.fulfill({ status: 404, body: 'not found' });
    const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: file }).outputText;
    return route.fulfill({ contentType: 'text/javascript', body: js });
  });
  await page.goto('https://audio.check/');
}

async function renders() {
  const { chromium } = loadPlaywright();
  const out = resolve(arg('out', '.tools/out/w19/renders'));
  mkdirSync(out, { recursive: true });
  const only = arg('only', '');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => (m.type() === 'error' ? console.error('console:', m.text()) : null));
  await serveSource(page);
  const K = await page.evaluate(async () => {
    const c = await import('https://audio.check/src/water/camera');
    const m = await import('https://audio.check/src/audio/mapping');
    const t = await import('https://audio.check/src/audio/theory');
    const w = await import('https://audio.check/src/water/moments');
    const r = await import('https://audio.check/src/water/registry');
    return {
      stopOf: r.composed,
      stops: c.stillStops(),
      starts: c.sectionStarts(),
      END_AT: c.END_AT,
      SETTLE_AT: c.SETTLE_AT,
      DAWN: w.DAWN,
      ARRIVE_AT: m.ARRIVE_AT,
      lineEnd: m.lineTime(1),
      gather: t.GATHER.map((_, i) => m.gatherTime(i)),
      arrival: t.ARRIVAL.map((_, i) => m.arrivalTime(i)),
      NAME_MELT: m.NAME_MELT,
      letters: m.nameLetters(1.6).length,
    };
  });
  const all = scenes(K);
  const names = Object.keys(all).filter((n) => !only || only.split(',').includes(n));
  const rows = [];
  let failed = 0;
  for (const name of names) {
    const { transients, silent, disturbedMin, period, check, loud, top, edges, places, ...spec } = all[name];
    // (--solo bed|world|fx|ui: hear one bus alone, to set its level.)
    if (arg('solo', '')) spec.solo = arg('solo', '');
    const t0 = Date.now();
    const meta = await page.evaluate(async (s) => {
      const { renderScene } = await import('https://audio.check/src/audio/render');
      const r = await renderScene(s);
      window.__r = r;
      const th = await import('https://audio.check/src/audio/theory');
      return { sr: r.sampleRate, n: r.channels[0].length, chords: r.chords, trace: r.trace, series: r.series, water: r.water, disturbed: r.disturbed, jumps: r.jumps, phrases: r.phrases.map((p) => ({ ...p, derived: th.derives(p.notes) })) };
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
    // (The guard on the sharpest transient, an ice crack on the phone's tier: 0.25 at the level the sound was first
    // set at, and the whole mix is brought up since sound is on by default.)
    if (m.maxJump > 0.32) problems.push(`jump ${m.maxJump}`);
    // The site's loudness, where a scene is the measure of it; and its ceiling.
    if (loud && Math.abs(m.lufs - loud[0]) > loud[1]) problems.push(`${m.lufs} LUFS, not ${loud[0]} within ${loud[1]}`);
    if (top !== undefined && m.truePeakDb > top) problems.push(`true peak ${m.truePeakDb} dBTP, over ${top}`);
    // Where the mix is turned (on, off): nothing steps. The largest jump from one sample to the next inside each
    // turn is held against the largest in the steady second before or after it: a fade adds none of its own.
    const turns = (edges ?? []).map(([at, len]) => {
      const inside = stepOf(chs, meta.sr, at - 0.01, at + len + 0.03);
      const beside = Math.max(stepOf(chs, meta.sr, at - 1.1, at - 0.05), stepOf(chs, meta.sr, at + len + 0.05, at + len + 1.1));
      const ck = chs.map((c) => clicks(c.subarray(Math.max(0, Math.round((at - 0.02) * meta.sr)), Math.round((at + len + 0.05) * meta.sr)), meta.sr).count).reduce((x, y) => x + y, 0);
      return { at, len, step: +inside.toFixed(4), beside: +beside.toFixed(4), clicks: ck };
    });
    for (const e of turns) {
      if (!transients && e.clicks > 0) problems.push(`${e.clicks} click(s) in the turn at ${e.at} s`);
      if (!transients && e.step > Math.max(0.012, e.beside * 1.5)) problems.push(`a step of ${e.step} in the turn at ${e.at} s (${e.beside} beside it)`);
    }
    // Each place of a walk: its own loudness over its hold, so no place stands out of the piece.
    const held = (places ?? []).map(([id, a, b]) => [id, +loudnessOf(chs, meta.sr, Math.max(a, power[0][0] + power[0][2] + 0.2), b).toFixed(1)]);
    if (!transients && m.clicks > 0) problems.push(`${m.clicks} clicks at ${m.clickAt.join(', ')} s`);
    if (m.above6k > 0.12) problems.push(`harsh: ${(m.above6k * 100).toFixed(1)}% above 6 kHz`);
    if (!meta.water) problems.push('the water model did not run');
    // (Where the world is heard alone, nothing may come round again. With the bed in, the bells' own beat is a period and is not a loop.)
    // (And where the picture itself does something on a period, the splash that goes with it comes round on that period: that is the picture's, and is said.)
    const own = (period ?? []).some((p) => Math.abs(m.loopAt / p - Math.round(m.loopAt / p)) * p < 0.12 && m.loopAt > p / 2);
    if (spec.solo === 'world' && m.loop > 0.3 && !own) problems.push(`a loop: the texture comes round at ${m.loopAt} s (r ${m.loop})`);
    if (meta.phrases.some((p) => !p.derived)) problems.push(`a bell phrase that is not the theme: ${JSON.stringify(meta.phrases.find((p) => !p.derived))}`);
    // The harmony: it never moves twice in two seconds, and the arrival is reached from the dominant.
    meta.chords.forEach((c, i) => {
      const was = meta.chords[i - 1];
      if (!was) return;
      if (c.t - was.t < 2 && !(spec.night ?? []).some((n) => Math.abs(n[0] - c.t) < 2.5)) problems.push(`the harmony moved twice in ${(c.t - was.t).toFixed(2)} s: ${was.chord} at ${was.t}, ${c.chord} at ${c.t}`);
      if (c.move === 'rest' && was.move !== 'rest' && !/^A/.test(was.chord)) problems.push(`the arrival was reached from ${was.chord}, not from the dominant`);
    });
    if (disturbedMin && meta.disturbed < disturbedMin) problems.push(`the clock was disturbed ${disturbedMin} times and noticed ${meta.disturbed}`);
    // What the conductor must have done in this scene.
    if (check) problems.push(...check(meta));
    const quiet = (silent ?? []).map(([a, b]) => +rmsOf(chs, meta.sr, a, b).toFixed(1));
    quiet.forEach((q, i) => {
      if (q > -80) problems.push(`not silent ${silent[i][0]} to ${silent[i][1]} s: ${q} dBFS`);
    });
    if (problems.length) failed++;
    writeFileSync(join(out, `${name}.wav`), wav(chs, meta.sr));
    writeFileSync(join(out, `${name}.png`), spectrogram(chs, meta.sr));
    writeFileSync(join(out, `${name}.json`), JSON.stringify({ spec, metrics: m, quiet, turns, places: held, chords: meta.chords, phrases: meta.phrases, trace: meta.trace, series: meta.series, disturbed: meta.disturbed }));
    rows.push({ name, ...m, quiet, problems });
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${name.padEnd(22)} ${String(m.seconds).padStart(5)} s  peak ${String(m.peakDb).padStart(7)}  true ${String(m.truePeakDb).padStart(7)}  rms ${String(m.rmsDb).padStart(6)}  ${String(m.lufs).padStart(6)} LUFS  crest ${String(m.crestDb).padStart(5)}  centroid ${String(m.centroidHz).padStart(5)} Hz  >6k ${(m.above6k * 100).toFixed(2).padStart(5)}%  300-4k ${(m.mid * 100).toFixed(0).padStart(3)}% ${String(m.midDb).padStart(6)} dB  loop ${m.loop}@${m.loopAt}  dc ${m.dc}  clicks ${m.clicks}${transients ? '*' : ''}  jump ${m.maxJump}  corr ${m.corr}${quiet.length ? `  silence ${quiet.join(', ')} dBFS` : ''}${turns.length ? `  turns ${turns.map((e) => `${e.at}s step ${e.step} (beside ${e.beside}) clicks ${e.clicks}`).join('; ')}` : ''}${held.length ? `\n     places (LUFS over each hold): ${held.map(([id, l]) => `${id} ${l}`).join(', ')}` : ''}  (${((Date.now() - t0) / 1000).toFixed(1)} s)${problems.length ? `\n     ${problems.join('; ')}` : ''}`);
  }
  await browser.close();
  const head = '| scene | seconds | peak dBFS | true peak | RMS | LUFS | crest dB | centroid Hz | above 6 kHz | 300 Hz to 4 kHz (share, level dBFS) | loop (r at s) | DC | clicks | largest jump | L/R corr | silence dBFS | result |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const body = rows.map((r) => `| ${r.name} | ${r.seconds} | ${r.peakDb} | ${r.truePeakDb} | ${r.rmsDb} | ${r.lufs} | ${r.crestDb} | ${r.centroidHz} | ${(r.above6k * 100).toFixed(2)}% | ${(r.mid * 100).toFixed(0)}%, ${r.midDb} | ${r.loop} at ${r.loopAt} | ${r.dc} | ${r.clicks}${all[r.name].transients ? '*' : ''} | ${r.maxJump} | ${r.corr} | ${r.quiet.join(', ') || ''} | ${r.problems.length ? r.problems.join('; ') : 'ok'} |`);
  writeFileSync(join(out, arg('table', 'table.md')), `${head}\n${body.join('\n')}\n\n\\* scenes with intended transients (cracks, drops, plucks, ticks): the click detector counts their onsets; the largest jump is the guard there.\n`);
  console.log(`\n${rows.length} scenes, ${failed} failed. WAVs, spectrograms and table.md in ${out}`);
  process.exit(failed ? 1 : 0);
}

/* ---------- sync ---------- */

/** What the picture does by its own clock: its sounds are set ahead for the frame that shows them. */
const AHEAD = ['pulse', 'landing', 'lattice', 'lap', 'drip', 'gate-up', 'gate-down', 'ring', 'surge', 'slap', 'air', 'gather', 'arrival', 'climb'];
/** What a visitor causes, in a handler or by scrolling: asked for at once. */
const AT_ONCE = ['press', 'switch', 'tap', 'hover', 'jump', 'crack', 'letter', 'break', 'dawn', 'melt'];

async function sync(base) {
  const { chromium } = loadPlaywright();
  const out = resolve(arg('out', '.tools/out/w19'));
  const label = arg('label', 'run');
  const load = process.argv.includes('--load');
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // A second renderer, loading the GPU: another tab's flight, scrolled up and down the whole time.
  let other = null;
  if (load) {
    other = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await other.goto(base + '/', { waitUntil: 'load' });
    await other.waitForFunction(() => document.documentElement.dataset.flight === 'on', null, { timeout: 60000 });
    await other.evaluate(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const t0 = performance.now();
      const go = () => {
        const p = ((performance.now() - t0) / 30000) % 2;
        window.scrollTo(0, max * (p < 1 ? p : 2 - p));
        requestAnimationFrame(go);
      };
      requestAnimationFrame(go);
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' ? errors.push(m.text()) : null));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.flight === 'on', null, { timeout: 60000 });
  await page.bringToFront();
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => !!window.__sound);
  await page.hover('.nav-sound');
  await page.waitForTimeout(300);
  await page.click('.nav-sound');
  await page.waitForFunction(() => window.__sound && window.__sound.ctx.state === 'running', null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  // Listen to the buses the moments sound on, in the context's own time: for each block, the first sample that
  // stands clear of the blocks before it. The listening node has a delay of its own, so that is measured first,
  // with ticks asked for at known times while nothing else is sounding there.
  const tapDelay = await page.evaluate(async () => {
    const { ctx, sound } = window.__sound;
    sound.trace = [];
    const tap = ctx.createScriptProcessor(256, 2, 2);
    const blocks = (window.__blocks = []);
    const prior = [0, 0, 0, 0];
    tap.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      const r = e.inputBuffer.getChannelData(1);
      const ref = Math.max(4e-4, 2.2 * Math.max(prior[0], prior[1], prior[2], prior[3]));
      let first = -1;
      let pk = 0;
      for (let i = 0; i < d.length; i++) {
        const v = Math.max(Math.abs(d[i]), Math.abs(r[i]));
        if (v > pk) pk = v;
        if (first < 0 && v > ref) first = i;
      }
      prior.shift();
      prior.push(pk);
      if (blocks.length < 400000) blocks.push([e.playbackTime, pk, first]);
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    sound.g.fx.connect(tap);
    sound.g.ui.connect(tap);
    tap.connect(mute).connect(ctx.destination);
    // The two clocks, read together every frame, and each frame's length.
    const pairs = (window.__pairs = []);
    const loop = (now) => {
      const o = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : { contextTime: 0, performanceTime: 0 };
      if (pairs.length < 200000) pairs.push([performance.now(), ctx.currentTime, o.contextTime || 0, o.performanceTime || 0, now]);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    await new Promise((res) => setTimeout(res, 400));
    const found = [];
    for (let k = 0; k < 5; k++) {
      const at = ctx.currentTime + 0.25;
      sound.fire('tap', 0.5, 0, 0, at, performance.now());
      await new Promise((res) => setTimeout(res, 700));
      const b = blocks.find((x) => x[2] >= 0 && x[0] + x[2] / ctx.sampleRate >= at - 0.002);
      if (b) found.push(b[0] + b[2] / ctx.sampleRate - at);
    }
    sound.trace = [];
    found.sort((x, y) => x - y);
    return found.length ? found[Math.floor(found.length / 2)] : NaN;
  });
  const unit = await page.evaluate(() => window.__flight.state().unit);
  const K = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - innerHeight }));
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
  // A tick of the rail: the page goes to the basin in one frame (a hover, a press and the jump).
  {
    const bb = await page.locator('.fl-rail a').nth(2).boundingBox();
    if (bb) {
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 3 });
      await page.waitForTimeout(250);
      await page.mouse.down();
      await page.waitForTimeout(60);
      await page.mouse.up();
      await page.waitForTimeout(2500);
    }
  }
  // A press on water: the basin.
  await to(stops[2] + 1.0, 2500);
  for (const [x, y] of [[650, 720], [900, 650], [1150, 760], [760, 800]]) {
    await page.mouse.move(x, y, { steps: 3 });
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(900);
  }
  // The shards: hold at the tarn for two of the pulse's rounds.
  await to(stops[5] + 1.2, 16500);
  // The columns' drips.
  await to(stops[6] + 1.2, 5000);
  // The switch.
  await to(stops[7] + 1.2, 2500);
  for (const i of [1, 2, 0]) {
    await page.locator('.switch-opt').nth(i).click();
    await page.waitForTimeout(1900);
  }
  // The lattice: a lap and a half.
  await to(stops[8] + 1.15, 14000);
  // The dawn.
  await to(stops[11] - 0.6, 1500);
  await glide(stops[11] - 0.6, K.max / unit, 3);
  await page.waitForTimeout(6000);
  const data = await page.evaluate(() => ({ trace: window.__sound.sound.trace, blocks: window.__blocks, pairs: window.__pairs, base: window.__sound.ctx.baseLatency, outLat: window.__sound.ctx.outputLatency, sr: window.__sound.ctx.sampleRate, disturbed: window.__sound.sound.disturbed, lag: window.__sound.map.lag, tier: window.__sound.tier, lead: window.__sound.lead() }));
  await browser.close();

  // The two clocks, measured here from the page's own readings (not taken from the sound's map): near each
  // moment, the render head is the upper edge of the readings of the audio clock, and what is heard is what the
  // output timestamps say (or the head less the reported latency where they say nothing).
  const offsets = (perf) => {
    let head = -Infinity;
    const ears = [];
    let lo = 0;
    let hi = data.pairs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (data.pairs[mid][0] < perf - 1000) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < data.pairs.length && data.pairs[i][0] < perf + 1000; i++) {
      const p = data.pairs[i];
      head = Math.max(head, p[1] - p[0] / 1000);
      if (p[3] > 0 && p[2] > 0) ears.push(p[2] - p[3] / 1000);
    }
    ears.sort((a, b) => a - b);
    const ear = ears.length ? ears[ears.length >> 1] : head - (data.base + data.outLat);
    return { head, ear };
  };
  const frames = data.pairs.map((p, i) => (i ? p[4] - data.pairs[i - 1][4] : 16.7)).filter((d) => d > 0 && d < 500);
  frames.sort((a, b) => a - b);
  const frameMs = frames[frames.length >> 1];
  const long = frames.filter((d) => d > frameMs * 1.5).length;
  const onsetOf = (audio) => {
    // The first rise in the stream at or after the start that was asked for, with the listening node's own delay taken off.
    for (const b of data.blocks) {
      if (b[2] < 0) continue;
      const t = b[0] + b[2] / data.sr - tapDelay;
      if (t < audio - 0.0015) continue;
      return t <= audio + 0.06 ? t : NaN;
    }
    return NaN;
  };
  const by = {};
  let taken = 0;
  let unseen = 0;
  for (const e of data.trace) {
    if (e.type.endsWith(':taken-back')) {
      taken++;
      continue;
    }
    if (e.cause === null || Number.isNaN(e.cause)) {
      unseen++;
      continue;
    }
    (by[e.type] ||= []).push(e);
  }
  const stat = (a) => {
    const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
    return s.length ? { n: s.length, min: s[0], med: s[Math.floor(s.length / 2)], max: s[s.length - 1] } : { n: 0, min: NaN, med: NaN, max: NaN };
  };
  const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : 'n/a');
  const three = (s) => `${f(s.min)} / ${f(s.med)} / ${f(s.max)}`;
  const one = Math.max(17, frameMs + 0.4);
  let bad = 0;
  // A frame that began late (more than a frame and a half after the one before it) shows its moments late: the
  // picture missed a beat. Those moments are counted apart, with how late their frame was.
  const stamps = data.pairs.map((p) => p[4]);
  // (From when the moment was set to the frame that showed it: the longest any frame in between took.)
  const gapBefore = (at, since) => {
    let lo = 0;
    let hi = stamps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (stamps[mid] < at - 0.01) lo = mid + 1;
      else hi = mid;
    }
    let worst = frameMs;
    for (let i = lo; i > 0 && stamps[i] > since - 1; i--) worst = Math.max(worst, stamps[i] - stamps[i - 1]);
    return worst;
  };
  const rowsA = ['| moment | count | set ahead by, ms (median) | heard after its frame begins, ms (min / median / max) | heard inside its frame | its frame came late and the sound kept to the moment: count, sound ahead by (ms, most), frame late by (ms, most) | heard after its frame: count, by (ms, most) | start leaves the graph, ms before its frame begins (median) | start asked for to onset found in the stream, ms (median / max) |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  const summary = {};
  for (const type of AHEAD) {
    const ev = by[type];
    if (!ev) {
      rowsA.push(`| ${type} | 0 | | | not caused | | | | |`);
      continue;
    }
    const rows = ev.map((e) => ({ heard: (e.audio - offsets(e.made).ear) * 1000 - e.cause, left: (e.audio - offsets(e.made).head) * 1000 - e.cause, gap: gapBefore(e.cause, e.made) }));
    const inside = rows.filter((r) => r.heard >= -0.5 && r.heard <= frameMs + 0.5);
    // Ahead of its frame: the frame that shows the moment began later than the moment's own beat. That is a frame
    // the picture missed (one between the setting and the showing ran long); the sound was already on its way.
    const ahead = rows.filter((r) => r.heard < -0.5);
    const behind = rows.filter((r) => r.heard > frameMs + 0.5);
    const lead = stat(ev.map((e) => e.cause - e.made));
    const on = stat(ev.map((e) => (onsetOf(e.audio) - e.audio) * 1000));
    const unexplained = ahead.filter((r) => r.gap <= frameMs * 1.5).length;
    if (behind.length || unexplained) bad++;
    summary[type] = { n: ev.length, inside: inside.length, ahead: ahead.length, behind: behind.length, unexplained, min: Math.min(...rows.map((r) => r.heard)), max: Math.max(...rows.map((r) => r.heard)) };
    rowsA.push(`| ${type} | ${ev.length} | ${f(lead.med)} | ${three(stat(rows.map((r) => r.heard)))} | ${inside.length === ev.length ? `all ${ev.length}` : `${inside.length} of ${ev.length}`} | ${ahead.length ? `${ahead.length}, ${f(-Math.min(...ahead.map((r) => r.heard)))}, ${f(Math.max(...ahead.map((r) => r.gap)) - frameMs)}${unexplained ? ` (${unexplained} with no late frame found)` : ''}` : 'none'} | ${behind.length ? `${behind.length}, ${f(Math.max(...behind.map((r) => r.heard)) - frameMs)}` : 'none'} | ${f(-stat(rows.map((r) => r.left)).med)} | ${['ring', 'surge', 'slap'].includes(type) ? 'water only: not on the bus listened to' : `${f(on.med)} / ${f(on.max)} (${on.n} found)`} |`);
  }
  const rowsB = ['| moment | count | cause to request, ms (min / median / max) | cause to start on the audio clock, ms (min / median / max) | start asked for to onset found in the stream, ms (median / max) | starts within one frame of its cause |', '| --- | --- | --- | --- | --- | --- |'];
  for (const type of AT_ONCE) {
    const ev = by[type];
    if (!ev) {
      rowsB.push(`| ${type} | 0 | | | | not caused |`);
      continue;
    }
    const start = ev.map((e) => (e.audio - offsets(e.made).head) * 1000 - e.cause);
    const req = stat(ev.map((e) => e.made - e.cause));
    const on = stat(ev.map((e) => (onsetOf(e.audio) - e.audio) * 1000));
    const late = start.filter((x) => x > one).length;
    if (late) bad++;
    summary[type] = { n: ev.length, late, min: Math.min(...start), max: Math.max(...start) };
    rowsB.push(`| ${type} | ${ev.length} | ${three(req)} | ${three(stat(start))} | ${f(on.med)} / ${f(on.max)} (${on.n} found) | ${late ? `${ev.length - late} of ${ev.length}` : 'all'} |`);
  }
  const lagNow = stat(data.pairs.filter((p) => p[3] > 0).map((p) => (p[1] - p[2]) * 1000));
  const note = `\nFrames: median ${f(frameMs)} ms; ${long} of ${frames.length} were longer than one and a half times that (longest ${f(frames[frames.length - 1])} ms). A second renderer loading the GPU: ${load ? 'yes' : 'no'}.\nThe picture's clock was found disturbed ${data.disturbed} times; ${taken} moments set ahead were taken back; ${unseen} were set and their frame never came (the page was moved on).\nThe listening node's own delay, measured with ticks asked for at known times and taken off the onset columns: ${(tapDelay * 1000).toFixed(2)} ms. An onset is found where the effects' bus first rises clear of the 21 ms before it, so a moment that begins under another sound, or swells in slowly, is not found.\nAudio context: ${data.sr} Hz, base latency ${(data.base * 1000).toFixed(1)} ms, output latency ${(data.outLat * 1000).toFixed(1)} ms; the audio clock as the page reads it runs ${f(lagNow.med)} ms (median) ahead of what the device is playing; the sound's own map has it at ${f(data.lag * 1000)} ms. The hop to the audio thread, as measured at the end: the lead for moments asked for at once was ${f(data.lead * 1000)} ms. Tier: ${data.tier.lean ? 'lean' : 'full'}. Sound loaded before the click: ${before}. Console errors: ${errors.length}.\n`;
  const text = `### ${label}\n\nSet ahead on the picture's clock:\n\n${rowsA.join('\n')}\n\nAsked for at once:\n\n${rowsB.join('\n')}\n${note}`;
  writeFileSync(join(out, `sync-${label}.md`), text);
  writeFileSync(join(out, `sync-${label}.json`), JSON.stringify({ summary, frameMs, long, frames: frames.length, disturbed: data.disturbed, taken, unseen, trace: data.trace, base: data.base, outLat: data.outLat, errors }));
  console.log(text);
  if (errors.length) console.log(errors.slice(0, 10).join('\n'));
  process.exit(bad ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = arg('sync', '');
  if (base) await sync(base);
  else await renders();
}
