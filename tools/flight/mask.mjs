#!/usr/bin/env node
/**
 * The live layer's masks, from the renderer's mask track.
 *
 * The home page lays a light live layer over the played flight
 * (src/flight/live.ts): glints on open water, a wake under the pointer.
 * It has to know where the water is in the frame it lies over, and where
 * the words stand. render.mjs can photograph exactly that (`--tracks
 * mask`): every frame of the flight again, written as what it shows in
 * place of its colour (red: open water; green: solid ground or ice; blue:
 * the words' lee, which the layer does not use: it reads the words' own
 * boxes from the page). This turns those frames into what ships:
 *
 *   <shape>.mask-<k>.webp   sheet k: `per` masks and the first of the next
 *                           sheet (so two neighbouring masks are always on
 *                           one sheet), each a small grey picture of what
 *                           the frame shows: 0 sky, 0.5 solid, 1 open water
 *   <shape>.mask.json       the sheets' layout
 *
 * The masks do not depend on the theme: one set a shape, rendered from the
 * day set.
 *
 *   node tools/flight/render.mjs --base http://localhost:3183 --out .tools/flight-mask --set wide-day --tracks mask --dpr 1
 *   node tools/flight/mask.mjs --in .tools/flight-mask --set wide-day
 *
 * Options: --cell 384x216 (wide) | 180x390 (tall)   --step 1 (a mask every this
 * many frames)   --per 30 (masks a sheet: a screen of scroll)   --q 55 (WebP quality)
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpegPath } from './common.mjs';

const require = createRequire(import.meta.url);
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const CELL = { wide: '384x216', tall: '180x390' };

async function main() {
  const set = arg('set', 'wide-day');
  const [shape] = set.split('-');
  const inDir = join(arg('in', '.tools/flight-mask'), set);
  const outDir = arg('out', join('public', 'flight'));
  const meta = JSON.parse(readFileSync(join(inDir, 'meta.json'), 'utf8'));
  const t = meta.tracks.mask;
  if (!t) throw new Error(`${inDir}: no mask track. Render it first (render.mjs --tracks mask).`);
  const [cw, ch] = arg('cell', CELL[shape]).split('x').map(Number);
  const step = Number(arg('step', 1));
  const per = Number(arg('per', 30));
  const q = Number(arg('q', 55));
  mkdirSync(outDir, { recursive: true });

  // Every `step`th frame, brought down to a cell by area, as raw pixels.
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-i', join(inDir, 'mask.mkv'), '-vf', `select='not(mod(n\\,${step}))',scale=${cw}:${ch}:flags=area`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  if (r.status) throw new Error(`ffmpeg: ${r.stderr}`);
  const px = cw * ch;
  const n = r.stdout.length / (px * 3);
  if (!Number.isInteger(n) || n !== Math.ceil(t.n / step)) throw new Error(`${n} masks from ${t.n} frames at a step of ${step}`);

  // One cell: what is there, as one grey value (water is always solid too: red and green halved and added).
  const cells = [];
  for (let i = 0; i < n; i++) {
    const cell = Buffer.alloc(px);
    for (let k = 0; k < px; k++) cell[k] = Math.round((r.stdout[(i * px + k) * 3] + r.stdout[(i * px + k) * 3 + 1]) / 2);
    cells.push(cell);
  }

  const sharp = createRequire(require.resolve('next/package.json', { paths: [process.cwd()] }))('sharp');
  for (const f of readdirSync(outDir)) if (f.startsWith(`${shape}.mask`)) rmSync(join(outDir, f));
  const cols = Math.ceil(Math.sqrt(((per + 1) * ch) / cw));
  const rows = Math.ceil((per + 1) / cols);
  const sheets = Math.ceil((n - 1) / per);
  let bytes = 0;
  for (let k = 0; k < sheets; k++) {
    const sheet = Buffer.alloc(cols * cw * rows * ch);
    for (let c = 0; c <= per; c++) {
      const cell = cells[Math.min(n - 1, k * per + c)];
      const x0 = (c % cols) * cw;
      const y0 = Math.floor(c / cols) * ch;
      for (let y = 0; y < ch; y++) cell.copy(sheet, (y0 + y) * cols * cw + x0, y * cw, (y + 1) * cw);
    }
    const file = join(outDir, `${shape}.mask-${k}.webp`);
    await sharp(sheet, { raw: { width: cols * cw, height: rows * ch, channels: 1 } }).webp({ quality: q, effort: 6, smartSubsample: false }).toFile(file);
    bytes += statSync(file).size;
  }
  const index = { w: cw, h: ch, cols, rows, per, step, from: t.from, n, sheets, frames: t.per };
  writeFileSync(join(outDir, `${shape}.mask.json`), JSON.stringify(index));
  console.log(`${shape}: ${n} masks of ${cw} x ${ch} in ${sheets} sheets of ${cols * cw} x ${rows * ch}, ${(bytes / 1048576).toFixed(2)} MB`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
