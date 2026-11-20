// Renders the home page's sound to files, without speakers, and measures them.
//
//   NODE_PATH=<a node_modules with playwright> node scripts/sound/render.mjs <outdir>
//
// For each scripted visit (walk day, walk night, toggle, jump, hidden; see
// walk.ts) it writes <name>.wav (32-bit float, 48 kHz, stereo), <name>.json
// (where the picture was at each step, and when the ice spoke) and, through
// analyse.mjs, the measurements. Playwright is not a dependency of the
// site: it is found through NODE_PATH.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyse } from './analyse.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? '.tools/out/s1');
mkdirSync(out, { recursive: true });

// The bundler is the test runner's own (vite, which vitest brings): found through it, not a dependency of the site.
const require = createRequire(import.meta.url);
const viaVitest = createRequire(require.resolve('vitest/package.json'));
const { build } = await import(pathToFileURL(join(dirname(viaVitest.resolve('vite/package.json')), 'dist/node/index.js')).href);

const bundle = await build({
  configFile: false,
  logLevel: 'error',
  build: { write: false, minify: false, lib: { entry: join(here, 'walk.ts'), formats: ['iife'], name: 'soundWalk' } },
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output[0].code;

const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addScriptTag({ content: code });

const RUNS = [
  ['walk-day', 'walk', false],
  ['walk-night', 'walk', true],
  ['toggle', 'toggle', false],
  ['jump', 'jump', false],
  ['hidden', 'hidden', false],
  // (`parts` as a third argument: each layer alone, for balancing; not one of the proofs.)
  ...(process.argv[3] === 'parts' ? [['parts', 'parts', false]] : []),
].filter((r) => process.argv[3] !== 'parts' || r[0] === 'parts');
const rows = [];
for (const [name, kind, night] of RUNS) {
  const r = await page.evaluate(([k, n]) => window.soundWalk.render(k, n, 20261119), [kind, night]);
  const pcm = Buffer.from(r.pcm, 'base64');
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(3, 20); // IEEE float
  head.writeUInt16LE(2, 22);
  head.writeUInt32LE(r.rate, 24);
  head.writeUInt32LE(r.rate * 8, 28);
  head.writeUInt16LE(8, 32);
  head.writeUInt16LE(32, 34);
  head.write('data', 36);
  head.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(out, name + '.wav'), Buffer.concat([head, pcm]));
  writeFileSync(join(out, name + '.json'), JSON.stringify({ scenes: r.scenes, cracks: r.cracks, timeline: r.timeline }));
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
  rows.push(analyse(name, samples, r.rate, r, out));
}
await browser.close();
const table = ['run\tseconds\tLUFS-I\ttrue peak dBTP\tsample peak dBFS\tclicks\tfaults the detector caught when put in\tice events', ...rows.map((r) => [r.name, r.seconds.toFixed(1), r.lufs.toFixed(1), r.truePeak.toFixed(1), r.peak.toFixed(1), r.clicks, r.control, r.cracks].join('\t'))].join('\n');
writeFileSync(join(out, 'analysis.tsv'), table + '\n');
console.log(table);
