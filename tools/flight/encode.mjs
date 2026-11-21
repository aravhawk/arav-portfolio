#!/usr/bin/env node
/**
 * The rendered frames (render.mjs), made into what the site ships.
 *
 * For one set (`--set wide-day`) it writes to `public/flight/`:
 *
 *   <set>.av1    every track's frames as AV1, end to end       \  a stream: fetched in byte ranges,
 *   <set>.hevc   the same as HEVC, for where AV1 cannot decode  /  never whole
 *   <set>.av1.json, <set>.hevc.json   each stream's index: the decoder's
 *                configuration, and every frame's size (so its offset) and
 *                the keyframe interval, track by track
 *   <shape>.cam  the camera of every frame of `main` (13 floats a frame);
 *   <shape>.still.cam   the camera of each still
 *   <set>.poster.avif / .webp       the first paint: the entrance's first frame
 *   <set>.still-<n>.avif            each section's still (motion reduced,
 *                                   or no decoder)
 *
 * Made for scrubbing: a keyframe every half screen of scroll, so any place
 * is a few frames of decoding away; no frame is held back for another (no
 * B-frames; AV1 packs its hidden frames with the frame they serve), so the
 * frames come out of a decoder in the order they go in.
 *
 * The encoder is ffmpeg from `uv run --with imageio-ffmpeg` (SVT-AV1,
 * x265). The MP4 files it writes are read here for their samples and thrown
 * away: the site ships the bare samples and the index.
 *
 *   node tools/flight/encode.mjs --in .tools/flight --set wide-day [--codecs av1,hevc]
 *     [--per 30] [--crf-av1 36] [--crf-hevc 28 (wide) | 27 (tall)] [--ssim] [--keep]
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { appendFileSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpegPath } from './common.mjs';

const require = createRequire(import.meta.url);
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);

/** What each shape ships at, a codec. (The fallback's wide picture is 1080p: the browsers that need it decode HEVC in hardware built for that size.) */
export const SHIP = {
  wide: { av1: [2560, 1440], hevc: [1920, 1080], poster: [1280, 1920, 2560], still: 1920 },
  tall: { av1: [780, 1688], hevc: [780, 1688], poster: [780], still: 780 },
};
const ORDER = ['enter', 'main', 'dawn', 'after', 'gate1', 'gate2'];

/* ---------- MP4, as far as it must be read: one video track's samples and its decoder configuration ---------- */

function boxes(buf, from, to) {
  const out = [];
  for (let p = from; p + 8 <= to; ) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    let head = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(p + 8));
      head = 16;
    } else if (size === 0) size = to - p;
    out.push({ type, at: p + head, end: p + size });
    p += size;
  }
  return out;
}
const child = (buf, box, type) => boxes(buf, box.at, box.end).find((b) => b.type === type);

/** A file's top-level boxes, read without loading its media. */
function topBoxes(fd, size) {
  const out = [];
  const head = Buffer.alloc(16);
  for (let p = 0; p < size; ) {
    readSync(fd, head, 0, 16, p);
    let len = head.readUInt32BE(0);
    const type = head.toString('latin1', 4, 8);
    if (len === 1) len = Number(head.readBigUInt64BE(8));
    else if (len === 0) len = size - p;
    out.push({ type, at: p, size: len });
    p += len;
  }
  return out;
}

export function readMp4(file) {
  const size = statSync(file).size;
  const fd = openSync(file, 'r');
  try {
    const moovAt = topBoxes(fd, size).find((b) => b.type === 'moov');
    if (!moovAt) throw new Error(`${file}: no moov`);
    const moov = Buffer.alloc(moovAt.size);
    readSync(fd, moov, 0, moovAt.size, moovAt.at);
    const root = { at: 8, end: moov.length };
    const stbl = ['trak', 'mdia', 'minf', 'stbl'].reduce((b, t) => child(moov, b, t), root);
    const stsd = child(moov, stbl, 'stsd');
    // (stsd: version and flags, a count, then the one entry: size, type, 78 bytes of visual sample entry, then its boxes.)
    const entry = { type: moov.toString('latin1', stsd.at + 12, stsd.at + 16), at: stsd.at + 16 + 78, end: stsd.at + 8 + moov.readUInt32BE(stsd.at + 8) };
    const w = moov.readUInt16BE(stsd.at + 16 + 24);
    const h = moov.readUInt16BE(stsd.at + 16 + 26);
    const conf = boxes(moov, entry.at, entry.end).find((b) => b.type === 'av1C' || b.type === 'hvcC');
    const config = moov.subarray(conf.at, conf.end);
    const stsz = child(moov, stbl, 'stsz');
    const n = moov.readUInt32BE(stsz.at + 8);
    const fixed = moov.readUInt32BE(stsz.at + 4);
    const sizes = Array.from({ length: n }, (_, i) => fixed || moov.readUInt32BE(stsz.at + 12 + i * 4));
    const stco = child(moov, stbl, 'stco');
    const co64 = child(moov, stbl, 'co64');
    const chunks = stco ? Array.from({ length: moov.readUInt32BE(stco.at + 4) }, (_, i) => moov.readUInt32BE(stco.at + 8 + i * 4)) : Array.from({ length: moov.readUInt32BE(co64.at + 4) }, (_, i) => Number(moov.readBigUInt64BE(co64.at + 8 + i * 8)));
    const stsc = child(moov, stbl, 'stsc');
    const runs = Array.from({ length: moov.readUInt32BE(stsc.at + 4) }, (_, i) => ({ first: moov.readUInt32BE(stsc.at + 8 + i * 12), count: moov.readUInt32BE(stsc.at + 12 + i * 12) }));
    const offsets = [];
    let s = 0;
    for (let c = 0; c < chunks.length; c++) {
      let run = runs[0];
      for (const r of runs) if (r.first <= c + 1) run = r;
      let at = chunks[c];
      for (let k = 0; k < run.count && s < n; k++, s++) {
        offsets.push(at);
        at += sizes[s];
      }
    }
    const stss = child(moov, stbl, 'stss');
    const keys = stss ? Array.from({ length: moov.readUInt32BE(stss.at + 4) }, (_, i) => moov.readUInt32BE(stss.at + 8 + i * 4) - 1) : sizes.map((_, i) => i);
    if (child(moov, stbl, 'ctts')) throw new Error(`${file}: frames are reordered (ctts): the player wants them in order`);
    const data = sizes.map((len, i) => {
      const b = Buffer.alloc(len);
      readSync(fd, b, 0, len, offsets[i]);
      return b;
    });
    return { kind: conf.type, config, w, h, sizes, keys, data };
  } finally {
    closeSync(fd);
  }
}

/** The WebCodecs codec string a configuration record stands for. */
export function codecString(kind, c) {
  if (kind === 'av1C') {
    const profile = c[1] >> 5;
    const level = c[1] & 31;
    const tier = c[2] >> 7 ? 'H' : 'M';
    const depth = (c[2] >> 6) & 1 ? ((c[2] >> 5) & 1 ? 12 : 10) : 8;
    return `av01.${profile}.${String(level).padStart(2, '0')}${tier}.${String(depth).padStart(2, '0')}`;
  }
  // hvcC: profile space, tier and profile; the compatibility flags, bit-reversed; the level; the constraint bytes, trailing zeros dropped.
  const space = ['', 'A', 'B', 'C'][c[1] >> 6];
  const tier = (c[1] >> 5) & 1 ? 'H' : 'L';
  const profile = c[1] & 31;
  let compat = 0;
  const flags = c.readUInt32BE(2);
  for (let i = 0; i < 32; i++) if (flags & (1 << i)) compat |= 1 << (31 - i);
  const cons = Array.from(c.subarray(6, 12));
  while (cons.length && cons[cons.length - 1] === 0) cons.pop();
  return ['hvc1', `${space}${profile}`, (compat >>> 0).toString(16), `${tier}${c[12]}`, ...cons.map((b) => b.toString(16))].join('.');
}

function main() {
  const set = arg('set', 'wide-day');
  const [shape, theme] = set.split('-');
  const inDir = join(arg('in', '.tools/flight'), set);
  const outDir = arg('out', join('public', 'flight'));
  const codecs = arg('codecs', 'av1,hevc').split(',');
  const meta = JSON.parse(readFileSync(join(inDir, 'meta.json'), 'utf8'));
  const per = Number(arg('per', meta.per));
  const drop = meta.per / per;
  if (!Number.isInteger(drop)) throw new Error(`rendered at ${meta.per} a screen: cannot ship ${per}`);
  // (The tall picture is the phones': its fallback is what most iPhones play, and is given the finer setting.)
  const crf = { av1: arg('crf-av1', '36'), hevc: arg('crf-hevc', shape === 'tall' ? '27' : '28') };
  const ffmpeg = ffmpegPath();
  const tmp = join(inDir, 'enc');
  mkdirSync(tmp, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const run = (args) => {
    const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
  };
  /** sRGB frames to video: BT.709, studio range, said so in the stream, so a decoder gives back the colours that went in. */
  const colour = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
  const toYuv = (w, h, src) => `${src ? `${src},` : ''}scale=${w}:${h}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`;

  const report = [];
  for (const codec of codecs) {
    const [w, h] = SHIP[shape][codec];
    const stream = join(outDir, `${set}.${codec}`);
    writeFileSync(stream, '');
    const index = { codec: '', w, h, tracks: [] };
    let at = 0;
    for (const id of ORDER) {
      const t = meta.tracks[id];
      const src = join(inDir, `${id}.mkv`);
      if (!t || !existsSync(src)) continue;
      const byScroll = t.per !== undefined;
      const step = byScroll ? drop : 1;
      // A keyframe every half screen of scroll (every half second of a clip).
      const key = Math.round((byScroll ? per : t.fps) / 2);
      const pick = step > 1 ? `select='not(mod(n\\,${step}))',setpts=N/30/TB` : '';
      const mp4 = join(tmp, `${id}.${codec}.mp4`);
      const enc =
        codec === 'av1'
          ? ['-c:v', 'libsvtav1', '-preset', arg('preset-av1', '5'), '-crf', crf.av1, '-g', String(key), '-svtav1-params', `scd=0:keyint=${key}:irefresh-type=2:${arg('svt', 'tune=0:enable-tf=0')}`]
          : ['-c:v', 'libx265', '-preset', arg('preset-hevc', 'slow'), '-crf', crf.hevc, '-x265-params', `keyint=${key}:min-keyint=${key}:scenecut=0:bframes=0:open-gop=0:repeat-headers=0:log-level=error`, '-tag:v', 'hvc1'];
      if (!flag('reuse') || !existsSync(mp4)) run(['-r', '30', '-i', src, '-vf', toYuv(w, h, pick), '-r', '30', ...enc, ...colour, '-an', mp4]);
      const m = readMp4(mp4);
      if (m.w !== w || m.h !== h) throw new Error(`${mp4}: ${m.w}x${m.h}`);
      m.keys.forEach((k, i) => {
        if (k !== i * key) throw new Error(`${mp4}: keyframe ${i} at ${k}, not ${i * key}`);
      });
      if (m.keys.length !== Math.ceil(m.sizes.length / key)) throw new Error(`${mp4}: ${m.keys.length} keyframes in ${m.sizes.length} frames`);
      const codecId = codecString(m.kind, m.config);
      if (index.codec && index.codec !== codecId) throw new Error(`${id}: ${codecId}, not ${index.codec}`);
      index.codec = codecId;
      if (m.kind === 'hvcC') index.description = m.config.toString('base64');
      for (const d of m.data) appendFileSync(stream, d);
      const bytes = m.sizes.reduce((a, b) => a + b, 0);
      index.tracks.push({ id, ...(byScroll ? { from: t.from, per } : { fps: t.fps }), at, key, sizes: m.sizes });
      at += bytes;
      let ssim = '';
      if (flag('ssim')) {
        const r = spawnSync(ffmpeg, ['-hide_banner', '-r', '30', '-i', mp4, '-r', '30', '-i', src, '-lavfi', `[1:v]${toYuv(w, h, pick)}[ref];[0:v][ref]ssim`, '-f', 'null', '-'], { encoding: 'utf8' });
        ssim = (/All:([\d.]+)/.exec(r.stderr) || [])[1] || '?';
      }
      report.push({ set, codec, track: id, frames: m.sizes.length, MB: +(bytes / 1048576).toFixed(2), ssim });
      console.log(`${set} ${codec} ${id}: ${m.sizes.length} frames, ${(bytes / 1048576).toFixed(2)} MB${ssim ? `, SSIM ${ssim}` : ''}`);
      if (!flag('keep')) rmSync(mp4);
    }
    writeFileSync(`${stream}.json`, JSON.stringify(index));
    console.log(`${set}.${codec}: ${(at / 1048576).toFixed(2)} MB, ${index.codec}, index ${(statSync(`${stream}.json`).size / 1024).toFixed(1)} kB`);
  }

  // The camera of every shipped frame of `main` (the same for both themes).
  if (existsSync(join(inDir, 'main.cam'))) {
    const all = new Float32Array(new Uint8Array(readFileSync(join(inDir, 'main.cam'))).buffer);
    const n = Math.floor((all.length / 13 - 1) / drop) + 1;
    const cam = new Float32Array(n * 13);
    for (let i = 0; i < n; i++) cam.set(all.subarray(i * drop * 13, i * drop * 13 + 13), i * 13);
    writeFileSync(join(outDir, `${shape}.cam`), Buffer.from(cam.buffer));
  }

  if (existsSync(join(inDir, 'still.cam'))) copyFileSync(join(inDir, 'still.cam'), join(outDir, `${shape}.still.cam`));

  // The first paint and the stills.
  const sharp = createRequire(require.resolve('next/package.json', { paths: [process.cwd()] }))('sharp');
  const jobs = [];
  if (existsSync(join(inDir, 'enter.mkv'))) {
    const png = join(tmp, 'poster.png');
    run(['-i', join(inDir, 'enter.mkv'), '-frames:v', '1', png]);
    for (const pw of SHIP[shape].poster) {
      const name = join(outDir, `${set}.poster${SHIP[shape].poster.length > 1 ? `-${pw}` : ''}`);
      const img = () => sharp(png).resize({ width: pw, kernel: 'lanczos3' });
      jobs.push(img().avif({ quality: Number(arg('poster-q', 58)), effort: 7 }).toFile(`${name}.avif`), img().webp({ quality: 80, effort: 6 }).toFile(`${name}.webp`));
    }
  }
  for (let n = 0; n < (meta.stills || []).length; n++) {
    const png = join(inDir, `still-${n}.png`);
    if (!existsSync(png)) continue;
    jobs.push(sharp(png).resize({ width: SHIP[shape].still, kernel: 'lanczos3' }).avif({ quality: Number(arg('still-q', 55)), effort: 7 }).toFile(join(outDir, `${set}.still-${n}.avif`)));
  }
  return Promise.all(jobs).then(() => {
    writeFileSync(join(inDir, 'encode-report.json'), JSON.stringify(report, null, 1));
    if (!flag('keep')) rmSync(tmp, { recursive: true, force: true });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.resolve()
    .then(main)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
