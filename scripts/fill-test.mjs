#!/usr/bin/env node
/**
 * Fill test: no screen of an inner page may be mostly empty.
 *
 * Every inner page is walked from its head to its foot, a screen at a time
 * (and again half a screen out of step, so a hole that straddles two
 * screens is seen whole), at 1440 x 900 and 1920 x 1080 in both themes. At
 * each position the test adds up what stands on the screen:
 *
 *  - text boxes: for every block that holds text, the box round its lines
 *    as they are set (from the first line's top to the last line's foot,
 *    from the leftmost ink to the rightmost). The empty part of a wide
 *    column beside a short line counts for nothing. Two things are
 *    measured across their own width and as tall as their ink: a row of
 *    a table (a `tr`, or a list's row marked `data-row`), which is a line
 *    of cells on a rule that runs the row's width; and a block of a
 *    post's running text (`.prose`), whose lines are set to the measure;
 *  - pictures: images, films, the scene's canvas and its still, and
 *    anything marked `data-fill` (a picture set as a background);
 *  - diagrams: the drawn pieces, each marked `data-fill` on its outer box
 *    (a chart, a sequence, a terminal, a table of marks);
 *  - controls: buttons, fields, switches.
 *
 * The boxes are painted on a grid of 4 px cells, so nothing is counted
 * twice, and the covered share of the screen is the result. A screen under
 * a third fails, unless it is the page's last (the foot of a page is its
 * footer and whatever room the last screen has left). The fixed nav is
 * chrome, not content: it is left out.
 *
 * Playwright is not a dependency of this repo. Point NODE_PATH at an install
 * that has it:
 *
 *   NODE_PATH=<tools>/node_modules node scripts/fill-test.mjs --base http://localhost:3154
 *
 * Options: --pages /work,...  --sizes 1440x900,1920x1080  --themes light,dark
 *          --min 0.3334  --step 0.5  --out report.json  --all (print every screen)
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
const flag = (name) => process.argv.includes(`--${name}`);
const base = arg('base', 'http://localhost:3154');
const pages = arg('pages', '/work,/work/infiniview,/work/open-source,/work/kilo-bench,/work/agent-bridge,/work/ollama,/work/cc-switch,/work/tensorpow,/work/rydar,/blog,/blog/three-ai-agents-five-saas-products,/does-not-exist').split(',');
const sizes = arg('sizes', '1440x900,1920x1080')
  .split(',')
  .map((s) => s.split('x').map(Number));
const themes = arg('themes', 'light,dark').split(',');
const min = Number(arg('min', String(1 / 3)));
const step = Number(arg('step', '0.5'));
const out = arg('out', '');
const all = flag('all');

/** Runs in the page: the share of the screen that text boxes, pictures, diagrams and controls cover, as it stands now. */
function fillNow() {
  const CELL = 4;
  const W = innerWidth;
  const H = innerHeight;
  const gw = Math.ceil(W / CELL);
  const gh = Math.ceil(H / CELL);
  const grid = new Uint8Array(gw * gh);
  const kinds = { text: 0, picture: 0, control: 0 };
  const paint = (l, t, r, b, kind) => {
    const x0 = Math.max(0, Math.floor(l / CELL));
    const y0 = Math.max(0, Math.floor(t / CELL));
    const x1 = Math.min(gw, Math.ceil(r / CELL));
    const y1 = Math.min(gh, Math.ceil(b / CELL));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (!grid[y * gw + x]) {
          grid[y * gw + x] = 1;
          kinds[kind]++;
        }
      }
    }
  };
  const SKIP = '.nav, .skip, .sr-only, script, style, noscript, nextjs-portal, [data-nofill]';
  const seen = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };

  // Pictures and diagrams, then controls.
  for (const el of document.querySelectorAll('img, video, canvas, picture, [data-fill]')) {
    if (el.closest(SKIP) || !seen(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    paint(r.left, r.top, r.right, r.bottom, 'picture');
  }
  for (const el of document.querySelectorAll('button, input, select, textarea, [role="switch"], [role="tab"]')) {
    if (el.closest(SKIP) || !seen(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    paint(r.left, r.top, r.right, r.bottom, 'control');
  }

  // Text: one box per block that holds text, round its lines as set.
  const boxes = new Map();
  const range = document.createRange();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const el = node.parentElement;
    if (!el || el.closest(SKIP) || !seen(el)) continue;
    let block = el;
    while (block.parentElement && /^inline/.test(getComputedStyle(block).display) && getComputedStyle(block).display !== 'inline-block' && getComputedStyle(block).display !== 'inline-flex' && getComputedStyle(block).display !== 'inline-grid') block = block.parentElement;
    block = block.closest('tr, [data-row]') ?? block;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const b = boxes.get(block);
      if (!b) boxes.set(block, { l: r.left, t: r.top, r: r.right, b: r.bottom });
      else {
        b.l = Math.min(b.l, r.left);
        b.t = Math.min(b.t, r.top);
        b.r = Math.max(b.r, r.right);
        b.b = Math.max(b.b, r.bottom);
      }
    }
  }
  for (const [block, b] of boxes) {
    // A ruled row, and a block of running text, are as wide as they are set.
    if (block.matches('tr, [data-row]') || (block.closest('.prose') && !block.closest('pre, table'))) {
      const q = block.getBoundingClientRect();
      b.l = Math.min(b.l, q.left);
      b.r = Math.max(b.r, q.right);
    }
    paint(b.l, b.t, b.r, b.b, 'text');
  }

  const cells = gw * gh;
  return { share: (kinds.text + kinds.picture + kinds.control) / cells, text: kinds.text / cells, picture: kinds.picture / cells, control: kinds.control / cells };
}

const results = [];
let failures = 0;
let screens = 0;
const browser = await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h] of sizes) {
  for (const theme of themes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const path of pages) {
      await page.goto(base + path, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(700);
      // Lazy pictures hold their boxes (real width and height), so the page's length is settled without them.
      const docH = await page.evaluate(() => document.documentElement.scrollHeight);
      const max = Math.max(0, docH - h);
      const ys = [];
      for (let y = 0; y < max; y += Math.round(h * step)) ys.push(y);
      ys.push(max);
      const rows = [];
      for (const y of ys) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(60);
        const f = await page.evaluate(fillNow);
        const last = y >= max - 1;
        rows.push({ y, last, ...f });
      }
      const bad = rows.filter((r) => !r.last && r.share < min);
      screens += rows.length;
      failures += bad.length;
      results.push({ path, w, h, theme, docH, screens: rows.length, worst: Math.min(...rows.filter((r) => !r.last).map((r) => r.share), 1), bad, rows });
      const worst = rows.filter((r) => !r.last).reduce((a, r) => (r.share < a.share ? r : a), { share: 1, y: 0 });
      console.log(`${bad.length ? 'FAIL' : 'ok  '} ${String(w).padStart(4)}x${h} ${theme.padEnd(5)} ${path.padEnd(46)} ${String(rows.length).padStart(3)} screens  least ${(worst.share * 100).toFixed(0).padStart(3)}% at y ${worst.y}`);
      for (const r of all ? rows : bad) console.log(`       y ${String(r.y).padStart(6)}  ${(r.share * 100).toFixed(0).padStart(3)}%  (text ${(r.text * 100).toFixed(0)}, pictures and diagrams ${(r.picture * 100).toFixed(0)}, controls ${(r.control * 100).toFixed(0)})${r.last ? '  last' : ''}`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${screens} screens on ${pages.length} pages at ${sizes.map((s) => s.join('x')).join(', ')} in ${themes.join(', ')}: ${failures} under ${(min * 100).toFixed(0)}% (the last screen of a page is not counted)`);
if (out) writeFileSync(out, JSON.stringify({ base, min, step, failures, screens, results }, null, 1));
process.exit(failures ? 1 : 0);
