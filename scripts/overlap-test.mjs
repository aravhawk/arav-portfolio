#!/usr/bin/env node
/**
 * Overlap test: nothing may cover content, and no word may sit on a ground
 * it cannot be read against.
 *
 * The home page is the flight: its words are set over a picture, so there
 * is no mask to compare. On a page that runs the flight the test measures
 * instead (scripts/lib/legibility.mjs): at 40 or more scroll steps, in both
 * themes, it hides the words, photographs the picture behind each line, and
 * fails any line whose contrast against the worst pixels behind it is under
 * WCAG AA (4.5 to 1, or 3 to 1 for large type). The ending, at rest at the
 * foot of the page, is photographed three times as the water moves.
 *
 * Inner pages open on a band of the same world with the page's title set
 * in it, and go on over a textured ground. Nothing there scrolls under the
 * words, so what is measured is every line of text on the page, wherever
 * it stands: in the scene, on the snow, on a plate, in the terminal, in the
 * footer. The page is walked from top to foot in steps of four fifths of a
 * screen (so every line is seen at least once), in both themes. At each
 * step every visible line's box and ink are collected by walking text
 * nodes, the text alone is made transparent (its plates, pills and panels
 * stay), the page is photographed, and any line whose contrast against the
 * worst pixels behind it is under WCAG AA fails. Lines in the scene are
 * photographed three times, as the picture drifts. A control line of text
 * the colour of its own ground is planted first and must be caught, or the
 * measurement is blind and a clean result would mean nothing.
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
import { measureFlight, runsFlight, setTheme } from './lib/legibility.mjs';

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
const browsers = arg('browsers', 'chromium').split(',');
const widths = arg('widths', '320,390,768,1024,1440,1920,2560').split(',').map(Number);
const pages = arg('pages', '/,/work,/work/infiniview,/work/open-source,/work/kilo-bench,/work/agent-bridge,/work/ollama,/work/cc-switch,/work/tensorpow,/work/rydar,/blog,/blog/three-ai-agents-five-saas-products,/does-not-exist').split(',');
const steps = Number(arg('steps', '40'));
const out = arg('out', '');

/** Runs in the page: every visible line of text in the viewport, with its ink. */
function linesOnPage() {
  const lum = (rgb) => {
    const m = rgb.match(/[\d.]+/g).map(Number);
    const c = m.slice(0, 3).map((v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return { l: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], a: m.length > 3 ? m[3] : 1 };
  };
  const out = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const el = node.parentElement;
    // (The nav's two controls stand on their own glass, as on the home page: they are not over the bare page.)
    if (!el || el.closest('.sr-only, .skip, .glass, script, style, noscript, nextjs-portal, [data-nodry]')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    // A line that is still fading in or out is not being read yet.
    let op = 1;
    for (let e = el; e && e !== document.body; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    if (op < 0.99) continue;
    const px = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const ink = lum(cs.color);
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      // A line cut by the top or the foot of the screen is measured whole at the step before or after
      // (the steps overlap by a fifth of a screen); only a line taller than that overlap is measured in part.
      const cut = r.top < 0 || r.bottom > innerHeight;
      if (cut && r.height < innerHeight * 0.2) continue;
      const top = Math.max(0, r.top);
      out.push({
        x: Math.max(0, r.left),
        y: top,
        w: Math.min(innerWidth, r.right) - Math.max(0, r.left),
        h: Math.min(innerHeight, r.bottom) - top,
        text: node.nodeValue.trim().slice(0, 40),
        ink: ink.l,
        alpha: ink.a,
        large: px >= 24 || (bold && px >= 18.66),
        scene: !!el.closest('.band'),
      });
    }
  }
  return out;
}

/** Runs in the page: the brightest and darkest the page gets behind each box. */
async function behindBoxes({ b64, boxes }) {
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
/** The text alone goes: whatever it stands on stays in the photograph. */
const NO_INK =
  '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important;caret-color:transparent!important;transition:none!important}' +
  '::placeholder{color:transparent!important}li::marker{color:transparent!important}svg.arrow,.slab-play svg{visibility:hidden!important}nextjs-portal{display:none!important}';

/** Measure the lines now in view. Lines in the scene are photographed three times, as the picture moves. */
async function measureView(page) {
  const boxes = await page.evaluate(linesOnPage);
  if (!boxes.length) return [];
  const shots = boxes.some((b) => b.scene) ? 3 : 1;
  const style = await page.addStyleTag({ content: NO_INK });
  const worst = boxes.map(() => ({ hi: 0, lo: 1 }));
  for (let i = 0; i < shots; i++) {
    await page.waitForTimeout(i ? 600 : 80);
    const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
    const res = await page.evaluate(behindBoxes, { b64, boxes });
    res.forEach((r, j) => {
      worst[j].hi = Math.max(worst[j].hi, r.hi);
      worst[j].lo = Math.min(worst[j].lo, r.lo);
    });
  }
  await style.evaluate((el) => el.remove());
  return boxes.map((b, j) => ({ ...b, contrast: Math.min(ratio(b.ink, worst[j].hi), ratio(b.ink, worst[j].lo)) }));
}

/**
 * An inner page: every line of text against what is behind it, top to foot.
 * Returns the row's part: steps, lines, the worst contrast, the failures.
 */
async function measureInner(page, row) {
  // The scene's canvas arrives after first paint; where it cannot, the still stays and is what is measured.
  row.engine = await page
    .waitForFunction(() => !!document.querySelector('.band-view[data-band="on"]'), null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1300);
  // Everything at rest: nothing is measured half way through a fade.
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important}' });
  // Control: a line the colour of the ground it stands on must be caught.
  await page.evaluate(() => {
    const host = document.querySelector('.pg-body, .band-words') ?? document.body;
    const el = document.createElement('p');
    el.id = 'overlap-control';
    el.textContent = 'control line';
    el.style.cssText = 'position:fixed;left:40%;top:60%;z-index:99;font-size:16px;color:' + (document.documentElement.dataset.theme === 'dark' ? '#27313d' : '#e3e8eb');
    host.appendChild(el);
  });
  const control = (await measureView(page)).find((b) => b.text === 'control line');
  await page.evaluate(() => document.getElementById('overlap-control')?.remove());
  row.control = !!control && control.contrast < 3;
  if (!row.control) row.error = 'the control line was not caught: the measurement is blind';
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    const { vh, max } = await page.evaluate(() => ({ vh: innerHeight, max: document.documentElement.scrollHeight - innerHeight }));
    const n = Math.max(1, Math.ceil(max / (vh * 0.8)));
    for (let i = 0; i <= n; i++) {
      const y = Math.round((max * i) / n);
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(260);
      row.steps++;
      checks++;
      for (const b of await measureView(page)) {
        row.lines = (row.lines || 0) + 1;
        row.worst = Math.min(row.worst ?? Infinity, b.contrast);
        const need = b.large ? 3 : 4.5;
        if (b.alpha < 1) row.legibility.push({ theme, scroll: y, text: b.text, contrast: 0, need, note: 'translucent ink: not measurable' });
        else if (b.contrast < need) row.legibility.push({ theme, scroll: y, text: b.text, contrast: +b.contrast.toFixed(2), need, where: b.scene ? 'scene' : 'page' });
      }
      if (max <= 0) break;
    }
  }
  if (row.worst != null) row.worst = +row.worst.toFixed(2);
  if (!row.lines) row.error = 'no text was found on the page';
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
      const row = { browser: name, width, path, steps: 0, overlaps: [], legibility: [], engine: true };
      try {
        await page.goto(base + path, { waitUntil: 'load' });
        if (await page.evaluate(() => !!document.querySelector('.pg-ground'))) {
          // An inner page: every line against what is behind it, in both themes.
          row.inner = true;
          await measureInner(page, row);
          throw null;
        }
        if (await runsFlight(page)) {
          // The flight: no mask. Measure the words against the picture, in both themes.
          row.flight = true;
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(2200);
          const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
          const positions = Array.from({ length: steps + 1 }, (_, i) => Math.round((max * i) / steps));
          for (const theme of ['light', 'dark']) {
            await setTheme(page, theme);
            const m = await measureFlight(page, positions);
            row.steps += m.steps;
            checks += m.steps;
            row.lines = (row.lines || 0) + m.lines;
            row.worst = Math.min(row.worst ?? Infinity, m.worst ?? Infinity);
            for (const f of m.fails) row.legibility.push({ theme, ...f });
          }
          if (!row.lines) row.error = 'no words were found over the picture';
          throw null;
        }
        // Neither the flight nor an inner page: nothing here to measure.
        row.error = 'the page is neither the flight nor an inner page';
      } catch (err) {
        // (null: the page's own branch has finished and has nothing more to do here.)
        if (err !== null) row.error = String(err).slice(0, 200);
      }
      const bad = row.overlaps.length + row.legibility.length + (row.error ? 1 : 0);
      failures += bad;
      results.push(row);
      const said = row.flight
        ? `  the flight: words measured against the picture, ${row.lines} lines, worst contrast ${row.worst}`
        : row.inner
          ? `  every line measured against its ground, ${row.lines} lines, worst contrast ${row.worst}${row.engine ? '' : ' (no engine: the still)'}`
          : '';
      console.log(`${bad ? 'FAIL' : 'ok  '} ${name.padEnd(8)} ${String(width).padStart(4)} ${path.padEnd(44)} steps ${row.steps}${said}${bad ? `  overlaps ${row.overlaps.length} illegible ${row.legibility.length}${row.error ? ' error ' + row.error : ''}` : ''}`);
      if (bad) for (const o of [...row.overlaps.slice(0, 4), ...row.legibility.slice(0, 6)]) console.log('       ', JSON.stringify(o));
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}

console.log(`\n${results.length} page runs, ${checks} scroll positions checked, ${results.reduce((n, r) => n + (r.lines || 0), 0)} lines measured, ${failures} failures.`);
if (out) writeFileSync(out, JSON.stringify({ base, when: new Date().toISOString(), failures, checks, results }, null, 1));
process.exit(failures ? 1 : 0);
