#!/usr/bin/env node
/**
 * The pre-rendered flight, from clean: every set rendered from the live
 * engine and encoded into what the site ships (public/flight/).
 *
 *   pnpm build && pnpm exec next start -p 3183 &
 *   NODE_PATH=<a node_modules with playwright> node tools/flight/make.mjs --base http://localhost:3183
 *
 * For each set (wide-day, wide-night, tall-day, tall-night) it runs
 * render.mjs (the lossless frames, a few GB a set, under --work) and then
 * encode.mjs (the streams, their indexes, the cameras, the first paint and
 * the stills), and removes that set's lossless frames before the next: one
 * set's worth of disk at a time. Alone on the GPU it takes about three
 * hours on an Apple M4.
 *
 * Options: --sets wide-day,tall-night   --work .tools/flight   --keep (the
 * lossless frames)   and everything render.mjs and encode.mjs take (--per,
 * --tracks, --crf-av1, --crf-hevc, --ssim ...), passed through to both.
 *
 * See README.md beside this file.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1];
};
const sets = arg('sets', 'wide-day,wide-night,tall-day,tall-night').split(',');
const work = arg('work', '.tools/flight');
const keep = args.includes('--keep');
const pass = args.filter((a, i) => !['--sets', '--work'].includes(a) && !['--sets', '--work'].includes(args[i - 1]) && a !== '--keep');

for (const set of sets) {
  for (const [script, extra] of [
    ['render.mjs', ['--out', work]],
    ['encode.mjs', ['--in', work]],
  ]) {
    const r = spawnSync(process.execPath, [join(here, script), '--set', set, ...extra, ...pass], { stdio: 'inherit' });
    if (r.status) process.exit(r.status ?? 1);
  }
  if (!keep) for (const f of readdirSync(join(work, set))) if (f.endsWith('.mkv')) rmSync(join(work, set, f));
}
const out = arg('out', join('public', 'flight'));
let total = 0;
for (const f of readdirSync(out).sort()) {
  const n = statSync(join(out, f)).size;
  total += n;
  console.log(`${String(n).padStart(10)}  ${f}`);
}
console.log(`${String(total).padStart(10)}  in all (${(total / 1048576).toFixed(1)} MB)`);
