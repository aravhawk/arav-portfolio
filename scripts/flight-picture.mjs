#!/usr/bin/env node
/**
 * The flight's picture, pinned and compared: the check that a change to the
 * engine has not changed what a reader sees at rest.
 *
 *   NODE_PATH=<playwright modules> node scripts/flight-picture.mjs capture <base url> <out dir>
 *     [--positions 32] [--at 0,1.5,28] [--theme light,dark] [--size wide,tall]
 *   node scripts/flight-picture.mjs compare <dir a> <dir b> [--crops <out dir>] [--floor 0.99]
 *
 * `capture` opens the home page on the real GPU and, at evenly spaced scroll
 * positions from the top to the foot, pins everything a frame depends on
 * (the clock, the entrance, the camera, full shading), waits for the words
 * and their lee to settle, and saves the canvas as it stands, with the film
 * grain left out (it is noise by design). Two builds captured this way draw
 * the same frame wherever their pictures agree.
 *
 * `compare` gives the structural similarity of each pair (RGB, 8 x 8
 * windows) and fails under the floor. With `--crops` it writes, for the six
 * pairs that differ most, the two frames cut to the 900 x 600 pixels round
 * their largest difference at 100 percent, and a page that flickers between
 * them.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const [mode, ...rest] = process.argv.slice(2);
const arg = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i < 0 ? def : rest[i + 1];
};

/* ---------- PNG, as much of it as is needed ---------- */

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** RGB rows, top first, as a PNG. */
export function encodePng(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'latin1');
    data.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw, { level: 3 })), chunk('IEND', Buffer.alloc(0))]);
}

/** An 8-bit RGB or RGBA PNG as RGB rows, top first. */
export function decodePng(file) {
  const w = file.readUInt32BE(16);
  const h = file.readUInt32BE(20);
  const bpp = file[25] === 6 ? 4 : file[25] === 2 ? 3 : 0;
  if (file[24] !== 8 || !bpp) throw new Error('only 8-bit RGB and RGBA');
  const parts = [];
  for (let at = 8; at < file.length; ) {
    const len = file.readUInt32BE(at);
    if (file.toString('latin1', at + 4, at + 8) === 'IDAT') parts.push(file.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const line = w * bpp;
  const cur = Buffer.alloc(line);
  let prev = Buffer.alloc(line);
  const rgb = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (line + 1)];
    const src = raw.subarray(y * (line + 1) + 1, (y + 1) * (line + 1));
    for (let i = 0; i < line; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      rgb[(y * w + x) * 3] = cur[x * bpp];
      rgb[(y * w + x) * 3 + 1] = cur[x * bpp + 1];
      rgb[(y * w + x) * 3 + 2] = cur[x * bpp + 2];
    }
    cur.copy(prev);
  }
  return { w, h, rgb };
}

/** Mean structural similarity over RGB in 8 x 8 windows every 4 pixels, and where the two differ most. */
export function ssim(a, b) {
  if (a.w !== b.w || a.h !== b.h) throw new Error(`sizes differ: ${a.w}x${a.h} and ${b.w}x${b.h}`);
  const { w, h } = a;
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let sum = 0;
  let n = 0;
  let worst = 2;
  let at = [0, 0];
  let maxDelta = 0;
  for (let y = 0; y + 8 <= h; y += 4) {
    for (let x = 0; x + 8 <= w; x += 4) {
      let s = 0;
      for (let c = 0; c < 3; c++) {
        let ma = 0, mb = 0, aa = 0, bb = 0, ab = 0;
        for (let j = 0; j < 8; j++) {
          let i = ((y + j) * w + x) * 3 + c;
          for (let k = 0; k < 8; k++, i += 3) {
            const p = a.rgb[i];
            const q = b.rgb[i];
            ma += p;
            mb += q;
            aa += p * p;
            bb += q * q;
            ab += p * q;
            const d = p > q ? p - q : q - p;
            if (d > maxDelta) maxDelta = d;
          }
        }
        ma /= 64;
        mb /= 64;
        const va = aa / 64 - ma * ma;
        const vb = bb / 64 - mb * mb;
        const cov = ab / 64 - ma * mb;
        s += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      }
      s /= 3;
      sum += s;
      n++;
      if (s < worst) {
        worst = s;
        at = [x + 4, y + 4];
      }
    }
  }
  return { ssim: sum / n, worst, at, maxDelta };
}

const SIZES = { wide: { width: 1728, height: 1117 }, tall: { width: 390, height: 844 } };

async function capture() {
  const [base, out] = rest;
  const { chromium } = createRequire(import.meta.url)('playwright');
  mkdirSync(out, { recursive: true });
  const themes = arg('theme', 'light,dark').split(',');
  const sizes = arg('size', 'wide,tall').split(',');
  const count = Number(arg('positions', '32'));
  const only = arg('at', '');
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const index = [];
  try {
    for (const size of sizes) {
      for (const theme of themes) {
        const ctx = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 2, colorScheme: theme });
        // The grain is left out of every program that has it: the scene's own, and the pass that puts it back at the screen's size.
        await ctx.addInitScript(() => {
          const proto = WebGL2RenderingContext.prototype;
          const original = proto.shaderSource;
          proto.shaderSource = function (shader, source) {
            return original.call(this, shader, source.replace(/\+= ?(gn|grain) \* \(1\.4/g, '+= 0.0 * $1 * (1.4'));
          };
        });
        const page = await ctx.newPage();
        await page.goto(base + '/', { waitUntil: 'load' });
        await page.waitForFunction(() => window.__flight && document.documentElement.dataset.picture !== undefined, null, { timeout: 120000 });
        await page.waitForTimeout(3000);
        const end = await page.evaluate(() => (document.documentElement.scrollHeight - innerHeight) / window.__flight.state().unit);
        const stops = only ? only.split(',').map(Number) : Array.from({ length: count }, (_, i) => +((i * end) / (count - 1)).toFixed(3));
        for (const s of stops) {
          await page.evaluate((s) => {
            const f = window.__flight;
            f.engine.holdLean(0);
            f.engine.holdClock(8);
            f.holdEntrance(8);
            scrollTo(0, Math.round(s * f.state().unit));
            f.holdPose(f.poseAt(s));
          }, s);
          // The words set, and the lee behind them comes in: a frame depends on both.
          await page.waitForTimeout(1300);
          await page.waitForFunction(
            () => {
              const e = window.__flight.engine;
              const a = e.lastArgs;
              if (!a || !e.standsReady(a.cam, a.aspect, e.needs(a.cam, a.aspect))) return false;
              const now = JSON.stringify([a.at.box, a.at.boxK, a.at.cap, a.at.capK]);
              const same = now === window.__was && (a.at.boxK === 0 || a.at.boxK === 1) && ((a.at.capK ?? 0) === 0 || a.at.capK === 1);
              window.__was = now;
              return same;
            },
            null,
            { timeout: 120000, polling: 200 },
          );
          const url = await page.evaluate(() => {
            const e = window.__flight.engine;
            if (!e.grab()) throw new Error('no frame');
            return e.canvas.toDataURL('image/png');
          });
          const name = `${size}-${theme}-${s.toFixed(3)}.png`;
          writeFileSync(join(out, name), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
          index.push({ size, theme, s, file: name });
          process.stdout.write(`${name}\n`);
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1));
}

function compare() {
  const [dirA, dirB] = rest;
  const floor = Number(arg('floor', '0.99'));
  const crops = arg('crops', '');
  const names = readdirSync(dirA).filter((f) => f.endsWith('.png') && readdirSync(dirB).includes(f)).sort();
  const rows = [];
  for (const name of names) {
    const a = decodePng(readFileSync(join(dirA, name)));
    const b = decodePng(readFileSync(join(dirB, name)));
    const r = ssim(a, b);
    rows.push({ name, ...r });
    console.log(`${name}\t${r.ssim.toFixed(6)}\tworst window ${r.worst.toFixed(3)} at ${r.at.join(',')}\tmax delta ${r.maxDelta}`);
  }
  const min = rows.reduce((m, r) => Math.min(m, r.ssim), 1);
  const under = rows.filter((r) => r.ssim < floor);
  console.log(`${rows.length} pairs, minimum ${min.toFixed(6)}, ${under.length} under ${floor}`);
  if (crops) {
    mkdirSync(crops, { recursive: true });
    writeFileSync(join(crops, 'ssim.csv'), 'frame,ssim,worst_window,at_x,at_y,max_delta\n' + rows.map((r) => `${r.name},${r.ssim.toFixed(8)},${r.worst.toFixed(4)},${r.at[0]},${r.at[1]},${r.maxDelta}`).join('\n') + '\n');
    const six = rows.slice().sort((p, q) => p.worst - q.worst).slice(0, 6);
    const cut = (img, cx, cy) => {
      const cw = Math.min(900, img.w);
      const ch = Math.min(600, img.h);
      const x0 = Math.min(img.w - cw, Math.max(0, cx - cw / 2)) | 0;
      const y0 = Math.min(img.h - ch, Math.max(0, cy - ch / 2)) | 0;
      const out = Buffer.alloc(cw * ch * 3);
      for (let y = 0; y < ch; y++) img.rgb.copy(out, y * cw * 3, ((y0 + y) * img.w + x0) * 3, ((y0 + y) * img.w + x0 + cw) * 3);
      return encodePng(out, cw, ch);
    };
    const items = [];
    for (const r of six) {
      const stem = r.name.replace('.png', '');
      writeFileSync(join(crops, `${stem}-a.png`), cut(decodePng(readFileSync(join(dirA, r.name))), r.at[0], r.at[1]));
      writeFileSync(join(crops, `${stem}-b.png`), cut(decodePng(readFileSync(join(dirB, r.name))), r.at[0], r.at[1]));
      items.push(stem);
    }
    writeFileSync(
      join(crops, 'flicker.html'),
      `<!doctype html><meta charset="utf-8"><title>Flicker comparison</title><style>body{margin:16px;background:#222;color:#ddd;font:13px system-ui}figure{margin:0 0 24px}img{display:block;image-rendering:pixelated}</style>
<p>Each pair at 100 percent, cut round its largest difference; the picture alternates between the two builds twice a second. Hold the pointer on one to stop it.</p>
${items.map((s) => `<figure><figcaption>${s} <span></span></figcaption><img data-a="${s}-a.png" data-b="${s}-b.png" src="${s}-a.png"></figure>`).join('\n')}
<script>for (const img of document.images) { let on = false, hold = false; img.onmouseenter = () => (hold = true); img.onmouseleave = () => (hold = false); setInterval(() => { if (hold) return; on = !on; img.src = on ? img.dataset.b : img.dataset.a; img.previousElementSibling.lastElementChild.textContent = on ? 'b' : 'a'; }, 500); }</script>`,
    );
  }
  if (under.length) process.exitCode = 1;
}

if (mode === 'capture') await capture();
else if (mode === 'compare') compare();
else {
  console.error('usage: flight-picture.mjs capture <base> <out> | compare <a> <b>');
  process.exit(2);
}
