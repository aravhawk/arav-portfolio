// Measures a rendered file: integrated loudness (ITU-R BS.1770-4), true
// peak (4x oversampled), a loudness curve against the scene timeline (SVG),
// a spectrogram (PNG) and a count of clicks. No dependency.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));

/** A biquad, direct form 1, over one channel. */
function biquad(x, [b0, b1, b2, a1, a2]) {
  const y = new Float64Array(x.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
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
// BS.1770 K-weighting at 48 kHz: a high shelf, then a high-pass.
const SHELF = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
const HIGH = [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621];

/** Mean square of the K-weighted sum of channels over each window: `win` seconds long, every `hop` seconds. */
function blocks(weighted, rate, win, hop) {
  const n = weighted[0].length,
    w = Math.round(win * rate),
    h = Math.round(hop * rate);
  const sums = weighted.map((ch) => {
    const s = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) s[i + 1] = s[i] + ch[i] * ch[i];
    return s;
  });
  const out = [];
  for (let at = 0; at + w <= n; at += h) out.push(sums.reduce((z, s) => z + (s[at + w] - s[at]) / w, 0));
  return out;
}
const lk = (z) => -0.691 + 10 * Math.log10(Math.max(z, 1e-12));

function integrated(weighted, rate) {
  const z = blocks(weighted, rate, 0.4, 0.1).filter((v) => lk(v) > -70);
  if (!z.length) return -Infinity;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const gate = lk(mean(z)) - 10;
  const kept = z.filter((v) => lk(v) > gate);
  return lk(mean(kept));
}

/** The largest value between samples: four times oversampled through a windowed sinc. */
function truePeak(x) {
  const TAPS = 12;
  const phases = [1, 2, 3].map((p) => {
    const f = p / 4,
      k = new Float64Array(2 * TAPS);
    for (let j = 0; j < 2 * TAPS; j++) {
      const d = j - TAPS + 1 - f;
      const sinc = d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d);
      k[j] = sinc * (0.5 + 0.5 * Math.cos((Math.PI * d) / TAPS));
    }
    return k;
  });
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
  }
  // Only near the loud places can a value between samples be the largest.
  const near = peak * 0.7;
  for (let i = TAPS; i < x.length - TAPS - 1; i++) {
    if (Math.abs(x[i]) < near && Math.abs(x[i + 1]) < near) continue;
    for (const k of phases) {
      let v = 0;
      for (let j = 0; j < 2 * TAPS; j++) v += k[j] * x[i + j - TAPS + 1];
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
  }
  return peak;
}

/**
 * Clicks: a step in the wave. The second difference of a sound that moves
 * smoothly is small; at a step it is one tall spike with nothing like it
 * either side. A sample is a click when its second difference stands 10
 * times above the RMS of the 40 ms round it (leaving out the 1 ms nearest)
 * and is not too small to hear (-66 dBFS).
 */
function clicks(x, rate) {
  const n = x.length,
    wide = Math.round(0.02 * rate),
    gap = Math.round(0.0005 * rate);
  const d = new Float64Array(n),
    sum = new Float64Array(n + 1);
  for (let i = 2; i < n; i++) d[i] = x[i] - 2 * x[i - 1] + x[i - 2];
  for (let i = 0; i < n; i++) sum[i + 1] = sum[i] + d[i] * d[i];
  const found = [];
  let last = -rate;
  for (let i = wide; i < n - wide; i++) {
    const a = Math.abs(d[i]);
    if (a < 5e-4) continue;
    const around = sum[i + wide] - sum[i + gap + 1] + sum[i - gap] - sum[i - wide];
    const rms = Math.sqrt(around / (2 * (wide - gap) - 1));
    if (a > 10 * rms && i - last > 0.005 * rate) {
      found.push(i / rate);
      last = i;
    }
  }
  return found;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(ang * k),
          s = Math.sin(ang * k);
        const a = i + k,
          b = a + len / 2;
        const tr = re[b] * c - im[b] * s,
          ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
}

function png(width, height, rgb) {
  const crcTable = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (buf) => {
    let c = -1;
    for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Time left to right, 40 Hz to 16 kHz bottom to top on a log scale, -100 to -30 dB black to white through blue. */
function spectrogram(mono, rate, file) {
  const N = 2048,
    W = Math.min(1600, Math.floor(mono.length / 512)),
    H = 320;
  const hop = (mono.length - N) / (W - 1);
  const rgb = Buffer.alloc(W * H * 3);
  const window = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const re = new Float64Array(N),
    im = new Float64Array(N);
  for (let x = 0; x < W; x++) {
    const at = Math.floor(x * hop);
    for (let i = 0; i < N; i++) {
      re[i] = mono[at + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let y = 0; y < H; y++) {
      const hz = 40 * Math.pow(16000 / 40, 1 - y / (H - 1));
      const bin = Math.min(N / 2 - 1, Math.max(1, Math.round((hz * N) / rate)));
      const level = db(Math.hypot(re[bin], im[bin]) / (N / 4));
      const v = Math.min(1, Math.max(0, (level + 100) / 70));
      const o = (y * W + x) * 3;
      rgb[o] = 255 * Math.pow(v, 2.2);
      rgb[o + 1] = 255 * Math.pow(v, 1.3);
      rgb[o + 2] = 255 * Math.min(1, v * 1.6);
    }
  }
  writeFileSync(file, png(W, H, rgb));
}

/** Short-term loudness (3 s) and momentary (0.4 s) over time, with the scenes as bands and the ice as ticks. */
function chart(name, weighted, rate, seconds, meta, lufs, file) {
  const W = 1600,
    H = 360,
    L = 46,
    B = 26,
    lo = -50,
    hi = -10;
  const x = (t) => L + ((W - L - 8) * t) / seconds;
  const y = (v) => 8 + ((H - B - 8) * (hi - Math.min(hi, Math.max(lo, v)))) / (hi - lo);
  const line = (win, hop) =>
    blocks(weighted, rate, win, hop)
      .map((z, i) => `${x(i * hop + win / 2).toFixed(1)},${y(lk(z)).toFixed(1)}`)
      .join(' ');
  let bands = '';
  const tl = meta.timeline;
  for (let i = 0, from = 0; i <= tl.length; i++) {
    const key = (s) => (s.mix > 0.02 && s.mix < 0.98 ? -1 : s.mix >= 0.98 ? s.to : s.from);
    if (i === tl.length || key(tl[i]) !== key(tl[from])) {
      const k = key(tl[from]),
        x0 = x(tl[from].t),
        x1 = x(i === tl.length ? seconds : tl[i].t);
      bands += `<rect x="${x0.toFixed(1)}" y="8" width="${(x1 - x0).toFixed(1)}" height="${H - B - 8}" fill="${k < 0 ? '#dfe6ea' : k % 2 ? '#f6f8f9' : '#eef2f4'}"/>`;
      if (k >= 0 && x1 - x0 > 40) bands += `<text x="${(x0 + 4).toFixed(1)}" y="22" font-size="11" fill="#566067">${meta.scenes[k]}</text>`;
      from = i;
    }
  }
  let grid = '';
  for (let v = lo; v <= hi; v += 10) grid += `<line x1="${L}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="#c9d1d6" stroke-width="0.5"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#566067">${v}</text>`;
  for (let t = 0; t <= seconds; t += seconds > 40 ? 10 : 2) grid += `<text x="${x(t)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="#566067">${t} s</text>`;
  const ice = meta.cracks.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${H - B - 12}" y2="${H - B}" stroke="#0a0c0e" stroke-width="1.5"/>`).join('');
  writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="ui-monospace, monospace"><rect width="${W}" height="${H}" fill="#fff"/>${bands}${grid}${ice}` +
      `<line x1="${L}" x2="${W - 8}" y1="${y(lufs)}" y2="${y(lufs)}" stroke="#b4532a" stroke-dasharray="4 4"/>` +
      `<polyline points="${line(0.4, 0.1)}" fill="none" stroke="#8aa0ad" stroke-width="1"/><polyline points="${line(3, 0.25)}" fill="none" stroke="#0a0c0e" stroke-width="1.8"/>` +
      `<text x="${W - 12}" y="${H - B - 16}" font-size="11" text-anchor="end" fill="#566067">${name}: LUFS, short-term 3 s (black), momentary 0.4 s (grey), integrated ${lufs.toFixed(1)} (dashed); darker bands: whiteout; ticks: ice</text></svg>`,
  );
}

export function analyse(name, samples, rate, meta, out) {
  const n = samples.length / 2;
  const ch = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    ch[0][i] = samples[2 * i];
    ch[1][i] = samples[2 * i + 1];
  }
  const weighted = ch.map((c) => biquad(biquad(c, SHELF), HIGH));
  const lufs = integrated(weighted, rate);
  const peak = Math.max(...ch.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
  const tp = Math.max(...ch.map(truePeak));
  const found = ch.map((c) => clicks(c, rate));
  // The detector's own check, on the same sound with faults put into it at ten places in each channel:
  // 50 ms cut out (a click at each edge, unless the wave happens to be near nothing there), and the level halved in one sample.
  const places = Array.from({ length: 10 }, (_, i) => Math.floor((n * (i + 1)) / 11));
  const caught = (spoil, edges) =>
    ch.reduce((sum, c) => {
      const k = c.slice();
      for (const at of places) spoil(k, at);
      const found = clicks(k, rate);
      return sum + places.reduce((m, at) => m + edges.filter((e) => found.some((t) => Math.abs(t - (at + e) / rate) < 0.002)).length, 0);
    }, 0);
  const span = Math.round(0.05 * rate);
  const cut = caught((k, at) => k.fill(0, at, at + span), [0, span]);
  const halved = caught((k, at) => {
    for (let i = at; i < at + span * 4; i++) k[i] *= 0.5;
  }, [0, span * 4]);
  const mono = Float64Array.from(ch[0], (v, i) => (v + ch[1][i]) / 2);
  spectrogram(mono, rate, join(out, name + '-spectrogram.png'));
  chart(name, weighted, rate, n / rate, meta, lufs, join(out, name + '-loudness.svg'));
  if (name === 'parts') console.log('parts, LUFS over seconds 2 to 6 of each:', blocks(weighted, rate, 4, 6).map((z, i) => (i ? '' : '') + lk(z).toFixed(1)).join('  '), '| peaks', [0, 1, 2, 3, 4].map((k) => db(ch[0].subarray(k * 6 * rate, (k + 1) * 6 * rate).reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toFixed(1)).join('  '));
  if (found[0].length + found[1].length) console.log(name, 'clicks at', found.map((f) => f.map((t) => t.toFixed(3)).join(' ')).join(' | '));
  return { name, seconds: n / rate, lufs, truePeak: db(tp), peak: db(peak), clicks: found[0].length + found[1].length, control: `${cut}/40 cuts, ${halved}/40 halvings`, cracks: meta.cracks.length };
}
