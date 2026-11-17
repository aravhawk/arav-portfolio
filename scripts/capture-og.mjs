#!/usr/bin/env node
/**
 * The pictures behind the sharing cards, photographed from the live home
 * page: light theme, words and nav hidden, 1200 x 630 at 2x, each written
 * to public/og/<name>.jpg at 220 KB or less, with public/og/manifest.json
 * beside them (where each was taken and how light its calm zone is).
 * src/lib/og.tsx sets each card's words over its picture.
 *
 * Re-run it whenever the home page's picture changes, against a running
 * server (a production build photographs best):
 *
 *   NODE_PATH=.tools/node_modules node scripts/capture-og.mjs --base http://localhost:3166
 *
 * Nothing here is a typed-in scroll position. Each station is found on the
 * page: the section (`data-fl`) that holds the link to that project's page,
 * photographed at the middle of the stretch in which its words stand
 * (`data-fl-from` to `data-fl-to`, in screens; the engine's handle gives
 * the length of a screen and says when the camera has arrived).
 *
 *   home          the first frame: the name in the ice
 *   <slug>        the station whose words link to /work/<slug>
 *   work          the delta: the section whose words link to /work
 *   blog          the tarn, seen on the way in: the Agent Bridge station
 *                 before its words arrive (so it is not that card again)
 *
 * Playwright is not a dependency of this repo: point NODE_PATH at an
 * install that has it. Options: --base  --out public/og  --only home,work
 * --max-kb 220
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
const base = arg('base', 'http://localhost:3166').replace(/\/$/, '');
const outDir = arg('out', join('public', 'og'));
const only = arg('only', '') ? arg('only', '').split(',') : null;
const maxBytes = Number(arg('max-kb', '220')) * 1024;

const W = 1200;
const H = 630;
/* The camera centres each station. A card wants its subject right of
   centre and calm ground on the left for the words, so a station is
   photographed on a screen this much wider than the card and the card is
   that screen's left 1200. The first frame is taken as it is: the name is
   centred. */
const LEAD = 240;
/* The share of the card, from the left, that the words stand in. */
const ZONE = 0.56;
/* How far into the approach (from the top of the station's section to
   where its words arrive) the tarn is seen whole from above, with both
   shards and its dark water. */
const TARN_APPROACH = 0.36;
const HIDE = '.fl-words,.fl-call,.fl-calls,.nav,.skip{visibility:hidden!important}nextjs-portal{display:none!important}';

mkdirSync(outDir, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function open(width) {
  const ctx = await browser.newContext({ viewport: { width, height: H }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.flight === 'on' && !!window.__flight, null, { timeout: 90000 });
  // The bed is carved and the name cut a little after the picture first shows.
  await page.waitForTimeout(4500);
  await page.addStyleTag({ content: HIDE });
  return { ctx, page };
}

/** The page's own account of its stations, in screens of scroll. */
const readSections = (page) =>
  page.evaluate(() => {
    const unit = window.__flight.state().unit;
    return Array.from(document.querySelectorAll('[data-fl]')).map((sec) => {
      const words = sec.querySelector('[data-fl-from]');
      const top = sec.offsetTop / unit;
      return {
        unit,
        top,
        end: top + sec.offsetHeight / unit,
        from: words ? Number(words.dataset.flFrom) : top,
        to: words ? Number(words.dataset.flTo) : top,
        links: Array.from(sec.querySelectorAll('a[href^="/work"]')).map((a) => a.getAttribute('href')),
      };
    });
  });

/** Scroll to `s` screens and wait until the camera is there and at rest. */
async function goTo(page, s, unit) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(s * unit));
  let last = -1;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => window.__flight.state().s);
    if (Math.abs(now - s) < 0.03 && Math.abs(now - last) < 0.002) break;
    last = now;
  }
  // The words' lee lifts and the water settles from the move.
  await page.waitForTimeout(1600);
  return page.evaluate(() => window.__flight.state().s);
}

/** Runs in the page: how light the picture is where the words will stand. */
async function zoneLight({ b64, zone }) {
  const img = new Image();
  img.src = 'data:image/jpeg;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 158;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, Math.round(c.width * zone), c.height).data;
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const ls = new Float32Array(d.length / 4);
  for (let i = 0; i < ls.length; i++) ls[i] = 0.2126 * lin(d[i * 4]) + 0.7152 * lin(d[i * 4 + 1]) + 0.0722 * lin(d[i * 4 + 2]);
  ls.sort();
  const at = (q) => Math.round(ls[Math.floor((ls.length - 1) * q)] * 1000) / 1000;
  return { low: at(0.02), mid: at(0.5), high: at(0.98) };
}

/** Photograph the card's rectangle, as good a JPEG as fits the budget. */
async function shoot(page, name) {
  let buf = null;
  let q = 86;
  for (; q >= 30; q -= 4) {
    buf = await page.screenshot({ type: 'jpeg', quality: q, clip: { x: 0, y: 0, width: W, height: H } });
    if (buf.length <= maxBytes) break;
  }
  if (buf.length > maxBytes) throw new Error(`${name}: ${buf.length} bytes at quality ${q}, over the budget`);
  writeFileSync(join(outDir, `${name}.jpg`), buf);
  const light = await page.evaluate(zoneLight, { b64: buf.toString('base64'), zone: ZONE });
  return { bytes: buf.length, quality: q, light };
}

const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const want = (name) => !only || only.includes(name);
const record = (name, s, shot) => {
  // Under dark words the calm zone must be light; under light words, dark.
  manifest[name] = { s: Math.round(s * 100) / 100, tone: shot.light.mid < 0.3 ? 'dark' : 'light', light: shot.light, bytes: shot.bytes, quality: shot.quality };
  console.log(`${name.padEnd(14)} s ${s.toFixed(2).padStart(6)}  ${String(Math.round(shot.bytes / 1024)).padStart(3)} KB  q${shot.quality}  zone ${shot.light.low}/${shot.light.mid}/${shot.light.high}  ${manifest[name].tone}`);
};

try {
  if (want('home')) {
    const { ctx, page } = await open(W);
    const s = await goTo(page, 0, 1);
    record('home', s, await shoot(page, 'home'));
    await ctx.close();
  }

  const { ctx, page } = await open(W + LEAD);
  const sections = await readSections(page);
  const stations = [];
  for (const sec of sections) {
    for (const href of sec.links) {
      const m = /^\/work(?:\/([a-z0-9-]+))?$/.exec(href);
      if (!m) continue;
      const name = m[1] ?? 'work';
      // The middle of the stretch its words stand in, kept inside its own section.
      const from = Math.max(sec.from, sec.top);
      const to = Math.min(sec.to, sec.end);
      stations.push({ name, s: (from + to) / 2, unit: sec.unit });
      if (name === 'agent-bridge') stations.push({ name: 'blog', s: sec.top + (sec.from - sec.top) * TARN_APPROACH, unit: sec.unit });
    }
  }
  if (!stations.some((x) => x.name === 'blog')) throw new Error('the tarn (the Agent Bridge station) was not found on the page');
  for (const st of stations) {
    if (!want(st.name)) continue;
    const s = await goTo(page, st.s, st.unit);
    record(st.name, s, await shoot(page, st.name));
  }
  await ctx.close();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${Object.keys(manifest).length} pictures' manifest to ${manifestPath}`);
} finally {
  await browser.close();
}
