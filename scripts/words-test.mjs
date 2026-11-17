#!/usr/bin/env node
/**
 * Words test for the home page (the flight): no two lines of text may ever
 * intersect, at any scroll position.
 *
 * It walks the page from top to bottom at evenly spaced scroll positions, at
 * each width and in both themes. At every position it looks twice: a moment
 * after the scroll lands (words in transit) and again once they have settled.
 * Each time it collects every visible line of text over the picture (station
 * words, captions and the nav, by walking text nodes, independently of the
 * engine) and fails when
 *
 *   - two lines of different elements intersect,
 *   - a line is set smaller than 11 px,
 *   - a caption is cut short (an ellipsis, or text wider than its box),
 *   - a line runs out of the frame's sides,
 *   - the nav, where it is shown, is not at its one fixed place.
 *
 * A line's rectangle is its glyph box trimmed to where ink can be: display
 * type set at a line height under 1 has glyph boxes taller than its lines.
 *
 * Playwright is not a dependency of this repo. Point NODE_PATH at an install
 * that has it:
 *
 *   NODE_PATH=.tools/node_modules node scripts/words-test.mjs --base http://localhost:3140
 *
 * Options: --widths 1440,768,390  --themes light,dark  --count 80 (positions)
 *          --from 12 --to 15 (screens)  --settle 900 (ms)  --out report.json
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

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
const base = arg('base', 'http://localhost:3140');
const widths = arg('widths', '1440,768,390').split(',').map(Number);
const themes = arg('themes', 'light,dark').split(',');
const count = Number(arg('count', '80'));
const settle = Number(arg('settle', '900'));
const out = arg('out', '');
const HEIGHTS = { 320: 640, 390: 844, 768: 1024, 1024: 768, 1440: 900, 1920: 1080, 2560: 1440 };
/** The smallest type a line may be set in, px. */
const MIN_PX = 11;

/** Runs in the page: every visible line of text over the picture, and the nav's place. */
function collect(minOpacity) {
  const lines = [];
  const faults = [];
  const range = document.createRange();
  let id = 0;
  for (const host of document.querySelectorAll('.fl-words[data-on], .fl-call[data-on], .nav')) {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue?.trim();
      if (!text) continue;
      const el = node.parentElement;
      if (el.closest('.sr-only, .metric-tip')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let op = 1;
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.visibility === 'hidden' || s.display === 'none') op = 0;
        op *= Number(s.opacity);
      }
      if (op < minOpacity) continue;
      // (The size the reader sees: the set size times any scale the flight has on it.)
      const set = parseFloat(cs.fontSize);
      const piece = el.closest('[data-w]');
      const tf = piece ? getComputedStyle(piece).transform : 'none';
      const scale = tf && tf !== 'none' ? new DOMMatrix(tf).a : 1;
      const px = set * scale;
      // A live number is one figure: its digits are one line. So is a caption.
      const unit = el.closest('.fl-call-label, [data-w="fig"], .fl-count, .nav-mark, .nav-links') ?? el;
      const key = unit.dataset.wt ?? (unit.dataset.wt = String(++id));
      const cut = el.closest('.fl-call-label');
      if (cut && (cut.scrollWidth > cut.clientWidth + 1 || /…|\.\.\.$/.test(text))) faults.push({ kind: 'cut short', text });
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight) continue;
        if (px < 10.95) faults.push({ kind: `type ${px.toFixed(1)} px`, text });
        if (r.left < -0.5 || r.right > innerWidth + 0.5) faults.push({ kind: 'out of the frame', text });
        // Where ink can be: the glyph box without the room over the capitals and under the descenders.
        const h = r.height;
        lines.push({ key, text: text.slice(0, 36), x0: r.left, x1: r.right, y0: r.top + h * 0.16, y1: r.bottom - h * 0.1 });
      }
    }
  }
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (a.key === b.key) continue;
      if (a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5) hits.push([a.text, b.text]);
    }
  }
  const nav = document.querySelector('.nav-links');
  const nr = nav?.getBoundingClientRect();
  return { lines: lines.length, hits, faults, navY: nr && nr.bottom > 0 ? +nr.top.toFixed(1) : null };
}

const rows = [];
let failed = false;
const browser = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const width of widths) {
  for (const theme of themes) {
    const phone = width < 700;
    const ctx = await browser.newContext({
      viewport: { width, height: Number(arg('height', HEIGHTS[width] ?? (phone ? 844 : 900))) },
      deviceScaleFactor: 1,
      colorScheme: theme,
      hasTouch: phone,
      isMobile: phone,
    });
    const page = await ctx.newPage();
    const row = { width, theme, steps: 0, lines: 0, empty: 0, fails: [], navYs: [] };
    let error = '';
    try {
      await page.goto(base + '/', { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.dataset.flight, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const { vh, max } = await page.evaluate(() => ({ vh: innerHeight, max: document.documentElement.scrollHeight - innerHeight }));
      const from = Math.min(max, Number(arg('from', '0')) * vh);
      const to = Math.min(max, Number(arg('to', '1e9')) * vh);
      for (let i = 0; i < count; i++) {
        const y = Math.round(from + ((to - from) * i) / Math.max(1, count - 1));
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        row.steps++;
        // In transit (anything a reader could make out), then at rest.
        for (const [wait, minOpacity, when] of [[140, 0.35, 'transit'], [y >= max - 2 ? 4200 : settle, 0.05, 'rest']]) {
          await page.waitForTimeout(wait);
          const got = await page.evaluate(collect, minOpacity);
          const at = +(y / vh).toFixed(2);
          for (const [a, b] of got.hits) row.fails.push({ scroll: at, when, kind: 'intersect', text: `"${a}" x "${b}"` });
          for (const f of got.faults) row.fails.push({ scroll: at, when, kind: f.kind, text: `"${f.text}"` });
          if (when === 'rest') {
            row.lines += got.lines;
            if (got.navY != null) row.navYs.push(got.navY);
            // (The nav's own words are always there: a frame with nothing else has no copy.)
            if (got.lines <= 3) row.empty++;
          }
        }
      }
      const ys = [...new Set(row.navYs)];
      if (ys.length > 1) row.fails.push({ scroll: '-', when: 'rest', kind: 'nav moves', text: ys.join(', ') });
      if (row.navYs.length < row.steps) row.fails.push({ scroll: '-', when: 'rest', kind: 'nav away', text: `${row.steps - row.navYs.length} of ${row.steps} positions` });
    } catch (err) {
      error = String(err).slice(0, 200);
    }
    // (One fault is reported once per position.)
    const seen = new Set();
    row.fails = row.fails.filter((f) => {
      const k = `${f.scroll}|${f.kind}|${f.text}`;
      return seen.has(k) ? false : (seen.add(k), true);
    });
    const bad = row.fails.length > 0 || error || row.lines === 0;
    if (bad) failed = true;
    rows.push({ ...row, error });
    console.log(`${bad ? 'FAIL' : 'ok  '} ${String(width).padStart(4)} ${theme.padEnd(5)} positions ${row.steps} lines ${row.lines} without copy ${row.empty} nav y ${[...new Set(row.navYs)].join('/')} faults ${row.fails.length}${error ? ' error ' + error : ''}`);
    for (const f of row.fails.slice(0, 14)) console.log(`     at ${f.scroll} (${f.when}) ${f.kind}: ${f.text}`);
    if (row.fails.length > 14) console.log(`     and ${row.fails.length - 14} more`);
    await ctx.close();
  }
}
await browser.close();
const fails = rows.reduce((n, r) => n + r.fails.length, 0);
console.log(`\n${rows.length} runs, ${rows.reduce((n, r) => n + r.lines, 0)} lines, ${fails} faults.`);
if (out) writeFileSync(out, JSON.stringify({ base, when: new Date().toISOString(), rows }, null, 1));
process.exit(failed ? 1 : 0);
