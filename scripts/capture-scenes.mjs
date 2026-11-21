#!/usr/bin/env node
/**
 * The inner pages' pictures (public/media/scenes), photographed from the engine.
 *
 * Each scene of the world is held as an inner page's band holds it (src/water/scene-band.ts) on the renderer's
 * route `/render/band`, at the size its picture reserves (src/components/work/still-pictures.tsx), in both themes:
 *
 *   <scene>-wide-*      the head of a page on a wide screen, bare
 *   <scene>-tall-*      the same on a phone
 *   <scene>-band-*      the way on at the foot of a page, with the calm its words stand in
 *   <scene>-bandtall-*  the same on a phone
 *
 * Run it after the world, the camera or the light changes, against a production build:
 *
 *   NODE_PATH=<a node_modules with playwright> node scripts/capture-scenes.mjs --base http://localhost:3183
 *
 * Options: --out public/media/scenes   --only ask-around,rydar   --max-kb 300
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const pw = require('playwright');
const sharp = createRequire(require.resolve('next/package.json', { paths: [process.cwd()] }))('sharp');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};
const base = arg('base', 'http://localhost:3183').replace(/\/$/, '');
const out = arg('out', join('public', 'media', 'scenes'));
const only = arg('only', '') ? arg('only', '').split(',') : null;
const maxBytes = Number(arg('max-kb', '300')) * 1024;

/** The stations' scenes, in the flight's order, and the three that are not stations. */
const SCENES = ['infiniview', 'open-source', 'ollama', 'cc-switch', 'kilo-bench', 'ask-around', 'rydar', 'agent-bridge', 'tensorpow', 'delta', 'lake', 'snow'];
/** Each shape: the frame in CSS pixels, its density, whether it is a phone's, and a box of the frame the picture keeps calm for words (x0, y0, x1, y1 from its top left: where a "next" band's label, name and line stand; a page's head lays its own veil instead). */
const SHAPES = {
  wide: { w: 1200, h: 601, dpr: 2, mobile: false, box: null },
  tall: { w: 390, h: 659, dpr: 2, mobile: true, box: null },
  band: { w: 1440, h: 600, dpr: 2, mobile: false, box: [0.03, 0.36, 0.5, 0.92] },
  bandtall: { w: 390, h: 480, dpr: 3, mobile: true, box: [0.05, 0.42, 0.95, 0.93] },
};
/** The scenes whose head is its own size (still-pictures.tsx: OWN). */
const OWN = { delta: { wide: [1200, 396] }, lake: { wide: [1200, 396] }, snow: { wide: [1200, 732], tall: [390, 844] } };

mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [shape, S] of Object.entries(SHAPES)) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: Math.max(S.w, 400), height: 900 }, deviceScaleFactor: S.dpr, colorScheme: theme, reducedMotion: 'reduce', isMobile: S.mobile, hasTouch: S.mobile });
    for (const scene of SCENES) {
      if (only && !only.includes(scene)) continue;
      // (The snowfield is never a way on: it has no band.)
      if (scene === 'snow' && shape.startsWith('band')) continue;
      const [w, h] = OWN[scene]?.[shape] ?? [S.w, S.h];
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.error('[page]', e.message));
      await page.setViewportSize({ width: Math.max(w, 400), height: Math.max(h, 400) });
      await page.goto(`${base}/render/band?scene=${scene}&w=${w}&h=${h}${S.box ? `&box=${S.box.join(',')}` : ''}`, { waitUntil: 'load' });
      await page.waitForFunction(() => !!document.querySelector('.band-stage[data-band="on"]') && !!window.__band, null, { timeout: 240000 });
      await page.evaluate((box) => window.__band.calm(box), !!S.box);
      // (The site's own nav and foot are not part of the picture.)
      await page.addStyleTag({ content: '.nav,.skip,footer,nextjs-portal{visibility:hidden!important}' });
      // (The pictures the stations carry arrive a moment after the first frame.)
      await page.waitForTimeout(2600);
      await page.evaluate((dark) => {
        window.__band.engine.setTheme(dark ? 1 : 0, true);
        window.dispatchEvent(new Event('resize'));
      }, theme === 'dark');
      await page.waitForTimeout(900);
      const png = await page.locator('.band-stage').screenshot({ type: 'png' });
      let buf;
      for (const q of [84, 80, 74, 68, 60]) {
        buf = await sharp(png).webp({ quality: q, effort: 6 }).toBuffer();
        if (buf.length <= maxBytes) break;
      }
      const file = join(out, `${scene}-${shape}-${theme}.webp`);
      writeFileSync(file, buf);
      const m = await sharp(buf).metadata();
      console.log(file, `${m.width} x ${m.height}`, `${(buf.length / 1024).toFixed(0)} kB`);
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
