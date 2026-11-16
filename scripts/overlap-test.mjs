#!/usr/bin/env node
/**
 * Overlap test: nothing may cover content.
 *
 * For every page, width and browser it walks the page in 40 or more scroll
 * steps. At each step it asks the water engine to render its effect mask
 * (water and ice, the same shader that draws the frame, read back from a
 * target) and compares that mask with the bounding boxes of every visible
 * text line, collected independently of the engine by walking text nodes.
 * Any text pixel that sits on water fails the run.
 *
 * The ending is the one place words are set in a picture (v2's composition,
 * kept on purpose). There the test measures instead: it hides the words,
 * photographs the picture behind each line three times as the water moves,
 * and fails any line whose contrast against the worst pixels behind it is
 * under WCAG AA (4.5 to 1, or 3 to 1 for large type).
 *
 * Playwright is not a dependency of this repo. Point NODE_PATH at an install
 * that has it:
 *
 *   NODE_PATH=~/.t3/portfolio-redesign-v4/tools/node_modules \
 *     node scripts/overlap-test.mjs --base http://localhost:3133
 *
 * Options: --browsers chromium,webkit,firefox  --widths 320,390,...
 *          --pages /,/work,...  --steps 40  --out report.json
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
const base = arg('base', 'http://localhost:3133');
const browsers = arg('browsers', 'chromium').split(',');
const widths = arg('widths', '320,390,768,1024,1440,1920,2560').split(',').map(Number);
const pages = arg('pages', '/,/work,/work/infiniview,/work/open-source,/work/cc-switch,/work/agent-bridge,/blog,/blog/three-ai-agents-five-saas-products,/does-not-exist').split(',');
const steps = Number(arg('steps', '40'));
const out = arg('out', '');

/** Runs in the page: text line boxes in document coordinates. */
function collectText() {
  const boxes = [];
  const skip = (el) => !!el.closest('[data-chrome], [data-ice], .sr-only, [data-nodry], script, style, noscript, .water-root');
  const hidden = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return true;
    }
    return false;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const el = node.parentElement;
    if (!el || skip(el) || hidden(el)) continue;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      boxes.push({
        x: r.left + scrollX,
        y: r.top + scrollY,
        w: r.width,
        h: r.height,
        text: node.nodeValue.trim().slice(0, 40),
        ending: !!el.closest('.ending'),
      });
    }
  }
  // Media that must stay dry counts as content too.
  for (const el of document.querySelectorAll('[data-dry]')) {
    if (skip(el) || hidden(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 1) boxes.push({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, text: `<${el.tagName.toLowerCase()} data-dry>`, ending: false });
  }
  return boxes;
}

/** Runs in the page: count effect pixels under each box at this scroll. */
function hitTest(boxes) {
  const w = window.__water;
  if (!w) return { noEngine: true, hits: [] };
  const vh = Math.max(innerHeight, document.documentElement.clientHeight);
  const info = w.engine.info;
  const mask = w.engine.readMask(scrollY, vh);
  const hits = [];
  for (const b of boxes) {
    if (b.ending) continue;
    const top = b.y - scrollY;
    if (top + b.h < 0 || top > innerHeight) continue;
    const x0 = Math.max(0, Math.floor(b.x / mask.scale));
    const x1 = Math.min(mask.w - 1, Math.ceil((b.x + b.w) / mask.scale) - 1);
    const y0 = Math.max(0, Math.floor((top + info.margin) / mask.scale));
    const y1 = Math.min(mask.h - 1, Math.ceil((top + b.h + info.margin) / mask.scale) - 1);
    let n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) if (mask.data[y * mask.w + x] > 127) n++;
    }
    if (n > 0) hits.push({ text: b.text, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), pixels: n });
  }
  return { hits, tier: info.tier };
}

/** Runs in the page: every line of text in the ending, with its colour and size. */
function endingText() {
  const copy = document.querySelector('.ending .ending-copy');
  if (!copy) return [];
  const lum = (rgb) => {
    const m = rgb.match(/[\d.]+/g).map(Number);
    const c = m.slice(0, 3).map((v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    // An alpha below 1 is composited over the picture: treat it as its own
    // colour scaled, which is the pessimistic reading for light text.
    const a = m.length > 3 ? m[3] : 1;
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * a;
  };
  const out = [];
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const el = node.parentElement;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const px = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
      out.push({ x: r.left, y: r.top, w: r.width, h: r.height, text: node.nodeValue.trim().slice(0, 40), ink: lum(cs.color), large: px >= 24 || (bold && px >= 18.66) });
    }
  }
  return out;
}

/** Runs in the page: the brightest and darkest the picture gets behind each box. */
async function behind({ b64, boxes }) {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const k = img.naturalWidth / innerWidth;
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return boxes.map((b) => {
    const x = Math.max(0, Math.floor(b.x * k));
    const y = Math.max(0, Math.floor(b.y * k));
    const w = Math.max(1, Math.min(c.width - x, Math.ceil(b.w * k)));
    const h = Math.max(1, Math.min(c.height - y, Math.ceil(b.h * k)));
    const d = g.getImageData(x, y, w, h).data;
    const ls = new Float32Array(d.length / 4);
    for (let i = 0; i < ls.length; i++) ls[i] = 0.2126 * lin(d[i * 4]) + 0.7152 * lin(d[i * 4 + 1]) + 0.0722 * lin(d[i * 4 + 2]);
    ls.sort();
    // The 99.5th and 0.5th percentiles: the worst the line meets, ignoring a lone pixel.
    return { hi: ls[Math.min(ls.length - 1, Math.floor(ls.length * 0.995))], lo: ls[Math.floor(ls.length * 0.005)] };
  });
}

async function endingContrast(page) {
  // Let the words finish arriving, then measure where they rest.
  await page.waitForTimeout(1700);
  const boxes = await page.evaluate(endingText);
  if (!boxes.length) return { lines: 0, fails: [], worst: null };
  const style = await page.addStyleTag({ content: '.ending .ending-copy{visibility:hidden!important}nextjs-portal{display:none!important}' });
  const worst = boxes.map(() => ({ hi: 0, lo: 1 }));
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(i ? 650 : 120);
    const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
    const res = await page.evaluate(behind, { b64, boxes });
    res.forEach((r, j) => {
      worst[j].hi = Math.max(worst[j].hi, r.hi);
      worst[j].lo = Math.min(worst[j].lo, r.lo);
    });
  }
  await style.evaluate((el) => el.remove());
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const fails = [];
  let min = Infinity;
  boxes.forEach((b, j) => {
    const cr = Math.min(ratio(b.ink, worst[j].hi), ratio(b.ink, worst[j].lo));
    min = Math.min(min, cr);
    const need = b.large ? 3 : 4.5;
    if (cr < need) fails.push({ text: b.text, contrast: +cr.toFixed(2), need, x: Math.round(b.x), y: Math.round(b.y) });
  });
  return { lines: boxes.length, fails, worst: +min.toFixed(2) };
}

const results = [];
let failures = 0;
let checks = 0;

for (const name of browsers) {
  const browser = await pw[name].launch({
    args: name === 'chromium' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [],
  });
  for (const width of widths) {
    const height = width < 600 ? 844 : width < 1100 ? 1024 : width < 2000 ? 900 : 1300;
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      hasTouch: width < 800,
      isMobile: name !== 'firefox' && width < 800,
    });
    for (const path of pages) {
      const page = await ctx.newPage();
      const row = { browser: name, width, path, steps: 0, overlaps: [], ending: [], engine: true };
      try {
        await page.goto(base + path, { waitUntil: 'load' });
        await page.waitForFunction(() => document.documentElement.dataset.water === 'on' || document.documentElement.dataset.water === 'off', null, { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(900);
        // Everything revealed and at rest.
        await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((el) => el.setAttribute('data-in', '')));
        await page.addStyleTag({ content: '[data-reveal]{transition:none!important}' });
        await page.waitForTimeout(250);
        const boxes = await page.evaluate(collectText);
        const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        // Control: a box dropped in the middle of a pool must be caught, or
        // the mask is blind and a clean result would mean nothing.
        const control = await page.evaluate(() => {
          const el = document.querySelector('[data-bed="lake"], [data-bed="head"]');
          if (!el || !window.__water) return null;
          const r = el.getBoundingClientRect();
          // Just inside the left bank, clear of any island in the middle.
          return { x: r.left + scrollX + 12, y: r.top + scrollY + r.height * 0.5 - 10, w: 10, h: 20, text: 'control', ending: false, top: r.top + scrollY };
        });
        if (control) {
          await page.evaluate((yy) => window.scrollTo(0, yy), Math.max(0, control.y - 300));
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          const c = await page.evaluate(hitTest, [control]);
          if (!c.noEngine && c.hits.length !== 1) row.error = 'control box in the pool was not detected: the mask is blind';
          row.control = !c.noEngine && c.hits.length === 1;
        }
        for (let i = 0; i <= steps; i++) {
          const y = Math.round((max * i) / steps);
          await page.evaluate((yy) => window.scrollTo(0, yy), y);
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          const res = await page.evaluate(hitTest, boxes);
          row.steps++;
          checks++;
          if (res.noEngine) {
            row.engine = false;
            break;
          }
          for (const h of res.hits) row.overlaps.push({ scroll: y, ...h });
        }
        // The ending, at rest at the bottom of the page, in both themes.
        if (await page.evaluate(() => !!document.querySelector('.ending'))) {
          for (const theme of ['light', 'dark']) {
            await page.evaluate((t) => {
              document.documentElement.dataset.theme = t;
              window.dispatchEvent(new Event('themechange'));
            }, theme);
            await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
            await page.waitForTimeout(700);
            const e = await endingContrast(page);
            row.endingLines = (row.endingLines || 0) + e.lines;
            row.endingWorst = Math.min(row.endingWorst ?? Infinity, e.worst ?? Infinity);
            for (const f of e.fails) row.ending.push({ theme, ...f });
          }
        }
      } catch (err) {
        row.error = String(err).slice(0, 200);
      }
      const bad = row.overlaps.length + row.ending.length + (row.error ? 1 : 0);
      failures += bad;
      results.push(row);
      console.log(`${bad ? 'FAIL' : 'ok  '} ${name.padEnd(8)} ${String(width).padStart(4)} ${path.padEnd(44)} steps ${row.steps}${row.engine ? '' : ' (static fallback, no water to overlap)'}${row.endingLines ? `  ending: ${row.endingLines} lines, worst contrast ${row.endingWorst}` : ''}${bad ? `  overlaps ${row.overlaps.length} ending ${row.ending.length}${row.error ? ' error ' + row.error : ''}` : ''}`);
      if (bad) for (const o of [...row.overlaps.slice(0, 4), ...row.ending.slice(0, 4)]) console.log('       ', JSON.stringify(o));
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}

console.log(`\n${results.length} page runs, ${checks} scroll positions checked, ${failures} overlaps.`);
if (out) writeFileSync(out, JSON.stringify({ base, when: new Date().toISOString(), failures, checks, results }, null, 1));
process.exit(failures ? 1 : 0);
