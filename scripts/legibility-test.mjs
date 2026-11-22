#!/usr/bin/env node
/**
 * Legibility test for the home page (the flight): its words are set over a
 * moving picture, so their contrast is measured, not assumed.
 *
 * It walks the page from top to bottom in small scroll steps, the ending
 * included, in both themes and at each width. At every step it collects
 * each visible line of text over the picture (independently of the engine,
 * by walking text nodes), hides the words, photographs the picture behind
 * them, and fails any line whose contrast against the worst pixels behind
 * it is under WCAG AA (4.5 to 1, or 3 to 1 for large type). The measuring
 * itself is in scripts/lib/legibility.mjs, which the overlap test shares.
 *
 * Playwright is not a dependency of this repo. Point NODE_PATH at an install
 * that has it:
 *
 *   NODE_PATH=.tools/node_modules node scripts/legibility-test.mjs --base http://localhost:3140
 *
 * Options: --browsers chromium,webkit,firefox  --widths 1440,390
 *          --themes light,dark  --step 0.1 (screens)  --pages /  --out report.json
 *          --from 12 --to 15 (screens: walk only part of the way)  --settle 820 (ms)
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { measureFlight, runsFlight } from './lib/legibility.mjs';

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
const routes = arg('pages', arg('path', '/')).split(',');
const browsers = arg('browsers', 'chromium').split(',');
const widths = arg('widths', '1440,390').split(',').map(Number);
const themes = arg('themes', 'light,dark').split(',');
const step = Number(arg('step', '0.1'));
const out = arg('out', '');

/** The heights the page is composed for at each width. */
const HEIGHTS = { 320: 640, 390: 844, 768: 1024, 1024: 768, 1440: 900, 1920: 1080, 2560: 1440 };

const rows = [];
let failed = false;
for (const name of browsers) {
  const browser = await pw[name].launch({ args: name === 'chromium' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
  for (const route of routes) {
    for (const width of widths) {
      for (const theme of themes) {
        const phone = width < 700;
        const ctx = await browser.newContext({
          viewport: { width, height: Number(arg('height', HEIGHTS[width] ?? (phone ? 844 : 900))) },
          deviceScaleFactor: 1,
          colorScheme: theme,
          hasTouch: phone,
          isMobile: phone && name !== 'firefox',
        });
        const page = await ctx.newPage();
        let row = { steps: 0, lines: 0, worst: null, fails: [] };
        let flight = null;
        let error = '';
        try {
          await page.goto(base + route, { waitUntil: 'load' });
          flight = (await runsFlight(page)) ? 'on' : await page.evaluate(() => document.documentElement.dataset.flight ?? null);
          await page.waitForTimeout(2500);
          const { vh, max } = await page.evaluate(() => ({ vh: innerHeight, max: document.documentElement.scrollHeight - innerHeight }));
          // Every step from the top to the very foot of the page: the last position is the ending at rest.
          const positions = [];
          const to = Math.min(max, Number(arg('to', '1e9')) * vh);
          for (let y = Number(arg('from', '0')) * vh; y < to; y += step * vh) positions.push(y);
          positions.push(to);
          row = await measureFlight(page, positions, { settle: Number(arg('settle', '820')) });
        } catch (err) {
          error = String(err).slice(0, 200);
        }
        const bad = row.fails.length > 0 || error || row.lines === 0;
        if (bad) failed = true;
        rows.push({ browser: name, route, width, theme, flight, error, ...row });
        console.log(
          `${bad ? 'FAIL' : 'ok  '} ${name.padEnd(8)} ${route.padEnd(3)} ${String(width).padStart(4)} ${theme.padEnd(5)} steps ${row.steps} lines ${row.lines} worst contrast ${row.worst}${flight === 'on' ? '' : ` (flight ${flight})`}${error ? ' error ' + error : ''}`,
        );
        for (const f of row.fails.slice(0, 8)) console.log(`     at ${f.scroll} screens: "${f.text}" ${f.contrast} (needs ${f.need})`);
        if (row.fails.length > 8) console.log(`     and ${row.fails.length - 8} more`);
        await ctx.close();
      }
    }
  }
  await browser.close();
}
const fails = rows.reduce((n, r) => n + r.fails.length, 0);
console.log(`\n${rows.length} runs, ${rows.reduce((n, r) => n + r.lines, 0)} lines measured, ${fails} failures.`);
if (out) writeFileSync(out, JSON.stringify({ base, routes, when: new Date().toISOString(), rows }, null, 1));
process.exit(failed ? 1 : 0);
