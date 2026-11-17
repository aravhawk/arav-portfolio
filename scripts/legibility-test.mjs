#!/usr/bin/env node
/**
 * Legibility test for the flight: its words are set over a moving picture,
 * so their contrast is measured, not assumed.
 *
 * It walks /flight from top to bottom in small scroll steps, in both themes
 * and at each width. At every step it collects each visible line of text
 * over the picture (independently of the engine, by walking text nodes),
 * hides the words, photographs the picture behind them, and fails any line
 * whose contrast against the worst pixels behind it is under WCAG AA
 * (4.5 to 1, or 3 to 1 for large type). The method is the one the overlap
 * test uses for the ending.
 *
 * Playwright is not a dependency of this repo. Point NODE_PATH at an install
 * that has it:
 *
 *   NODE_PATH=.tools/node_modules node scripts/legibility-test.mjs --base http://localhost:3140
 *
 * Options: --browsers chromium,webkit,firefox  --widths 1440,390
 *          --themes light,dark  --step 0.1 (screens)  --path /flight  --out report.json
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
const route = arg('path', '/flight');
const browsers = arg('browsers', 'chromium').split(',');
const widths = arg('widths', '1440,390').split(',').map(Number);
const themes = arg('themes', 'light,dark').split(',');
const step = Number(arg('step', '0.1'));
const out = arg('out', '');

/** Runs in the page: every visible line of text set over the picture. */
function linesOverPicture() {
  const lum = (rgb) => {
    const m = rgb.match(/[\d.]+/g).map(Number);
    const c = m.slice(0, 3).map((v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const out = [];
  const range = document.createRange();
  for (const host of document.querySelectorAll('.fl-words[data-on], .fl-call[data-on], .nav')) {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const el = node.parentElement;
      // The nav sits on its own glass: it is not over the bare picture.
      if (el.closest('.glass')) continue;
      // A callout's caption stands on its own opaque plate (checked: not assumed).
      const plate = el.closest('.fl-call-label');
      if (plate && /^rgb\(/.test(getComputedStyle(plate).backgroundColor)) continue;
      // The film is a framed plate of its own: its control is not over the bare picture.
      if (el.closest('.fl-film')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // A line that is still fading in or out is not being read yet.
      let op = 1;
      for (let e = el; e && e !== document.body; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      if (op < 0.99) continue;
      const px = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
        out.push({ x: r.left, y: r.top, w: r.width, h: r.height, text: node.nodeValue.trim().slice(0, 40), ink: lum(cs.color), large: px >= 24 || (bold && px >= 18.66) });
      }
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

const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const HIDE = '.fl-words,.fl-call,.nav,.skip{visibility:hidden!important}nextjs-portal{display:none!important}';

const rows = [];
let failed = false;
for (const name of browsers) {
  const browser = await pw[name].launch({ args: name === 'chromium' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
  for (const width of widths) {
    for (const theme of themes) {
      const phone = width < 700;
      const ctx = await browser.newContext({
        viewport: { width, height: { 390: 844, 768: 1024, 1920: 1080, 2560: 1440 }[width] ?? (phone ? 844 : 900) },
        deviceScaleFactor: 1,
        colorScheme: theme,
        hasTouch: phone,
        isMobile: phone && name !== 'firefox',
      });
      const page = await ctx.newPage();
      const row = { browser: name, width, theme, steps: 0, lines: 0, worst: null, fails: [], flight: null };
      try {
        await page.goto(base + route, { waitUntil: 'load' });
        await page.waitForFunction(() => document.documentElement.dataset.flight, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
        row.flight = await page.evaluate(() => document.documentElement.dataset.flight ?? null);
        const vh = await page.evaluate(() => innerHeight);
        // The flight ends where the ending's picture begins; the ending's
        // own words are measured by the overlap test.
        const end = await page.evaluate(() => {
          const e = document.querySelector('.ending');
          return e ? e.getBoundingClientRect().top + scrollY - innerHeight : document.documentElement.scrollHeight - innerHeight;
        });
        // (--from and --to, in screens, walk only part of the way: for work on one stretch.)
        for (let y = Number(arg('from', '0')) * vh; y <= Math.min(end, Number(arg('to', '1e9')) * vh); y += step * vh) {
          await page.evaluate((yy) => window.scrollTo(0, yy), Math.round(y));
          // Let words that have just come in finish arriving.
          await page.waitForTimeout(Number(arg('settle', '820')));
          row.steps++;
          const boxes = await page.evaluate(linesOverPicture);
          if (!boxes.length) continue;
          const style = await page.addStyleTag({ content: HIDE });
          await page.waitForTimeout(60);
          const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
          const res = await page.evaluate(behind, { b64, boxes });
          await style.evaluate((el) => el.remove());
          boxes.forEach((b, j) => {
            const cr = Math.min(ratio(b.ink, res[j].hi), ratio(b.ink, res[j].lo));
            row.lines++;
            row.worst = Math.min(row.worst ?? Infinity, cr);
            const need = b.large ? 3 : 4.5;
            if (cr < need) row.fails.push({ scroll: +(y / vh).toFixed(2), text: b.text, contrast: +cr.toFixed(2), need });
          });
        }
      } catch (err) {
        row.error = String(err).slice(0, 200);
      }
      if (row.worst != null) row.worst = +row.worst.toFixed(2);
      const bad = row.fails.length > 0 || row.error || row.lines === 0;
      if (bad) failed = true;
      rows.push(row);
      console.log(
        `${bad ? 'FAIL' : 'ok  '} ${name.padEnd(8)} ${String(width).padStart(4)} ${theme.padEnd(5)} steps ${row.steps} lines ${row.lines} worst contrast ${row.worst}${row.flight === 'on' ? '' : ` (flight ${row.flight})`}${row.error ? ' error ' + row.error : ''}`,
      );
      for (const f of row.fails.slice(0, 8)) console.log(`     at ${f.scroll} screens: "${f.text}" ${f.contrast} (needs ${f.need})`);
      if (row.fails.length > 8) console.log(`     and ${row.fails.length - 8} more`);
      await ctx.close();
    }
  }
  await browser.close();
}
if (out) writeFileSync(out, JSON.stringify({ base, route, when: new Date().toISOString(), rows }, null, 1));
process.exit(failed ? 1 : 0);
