// Photograph every scene from the renderer itself, for the places the canvas does not draw.
//
//   node tools/site/stills.cjs <base>        e.g. http://localhost:3189 (a production build of this site)
//
// Writes, from the home page's own canvas (no words, no nav: the canvas's pixels alone):
//   public/media/stills/scene/<id>-<wide|tall>-<day|night>.avif   each scene's first frame: a section's still
//   public/media/stills/<slug>-<day|night>.avif and -1216.avif     a project page's header, mid push
//   src/lib/og/<id>.jpg                                            the share cards' pictures, 1200 by 630, day
//
// Needs Playwright on NODE_PATH and a GPU. The lake's own stills were baked with the scene (public/scene/lake).
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(require.resolve('sharp', { paths: [path.dirname(require.resolve('next/package.json'))] }));

const SCENES = ['lake', 'statement', 'infiniview', 'open-source', 'kilo-bench', 'agent-bridge', 'ollama', 'cc-switch', 'tensorpow', 'rydar', 'interests', 'ending'];
const PROJECTS = ['infiniview', 'open-source', 'kilo-bench', 'agent-bridge', 'ollama', 'cc-switch', 'tensorpow', 'rydar'];
const OG = ['lake', ...PROJECTS, 'interests'];
const LENGTH = 2.6; // a scene's push and the whiteout after it, in screens (src/scene/flight/scenes.ts)

(async () => {
  const base = process.argv[2];
  if (!base) throw Error('usage: node tools/site/stills.cjs <base url>');
  // Optional scene IDs limit a single-scene rebake to its own derivatives.
  const selected = process.argv.slice(3);
  for (const id of selected) if (!SCENES.includes(id)) throw Error('unknown scene ' + id);
  for (const d of ['public/media/stills/scene', 'src/lib/og']) fs.mkdirSync(d, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  for (const gate of ['wide', 'tall'])
    for (const [scheme, light] of [['light', 'day'], ['dark', 'night']]) {
      const ctx = await browser.newContext({
        viewport: gate === 'wide' ? { width: 1440, height: 900 } : { width: 390, height: 844 },
        deviceScaleFactor: 2,
        colorScheme: scheme,
        isMobile: gate === 'tall',
        hasTouch: gate === 'tall',
      });
      const page = await ctx.newPage();
      await page.goto(base + '/', { waitUntil: 'load' });
      await page.waitForFunction(() => window.__lakeProof);
      const firstHeight = await page.locator('[data-scene]').first().evaluate((el) => el.offsetHeight);
      const screen = firstHeight / LENGTH;
      const frame = async (s) => {
        await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), Math.ceil(screen * s));
        await page.waitForFunction((s) => Math.abs(window.__lakeProof.state().screens - s) < 0.004, s, { timeout: 60000 });
        const url = await page.evaluate((s) => window.__lakeProof.frame(s, 0, 0), s);
        return Buffer.from(url.split(',')[1], 'base64');
      };
      for (const [i, id] of SCENES.entries()) {
        if (selected.length && !selected.includes(id)) continue;
        if (i > 0) {
          const first = sharp(await frame(i * LENGTH));
          const out = `public/media/stills/scene/${id}-${gate}-${light}.avif`;
          await (gate === 'wide' ? first.resize({ width: 1920 }) : first).avif({ quality: 50, effort: 7 }).toFile(out);
        }
        if (gate !== 'wide') continue;
        const mid = await frame(i * LENGTH + 1);
        if (PROJECTS.includes(id)) {
          // The header of a project's page: a band across the frame, where the scene's subject stands.
          const band = sharp(mid).extract({ left: 0, top: 260, width: 2880, height: 1200 });
          await band.clone().resize({ width: 2432 }).avif({ quality: 52, effort: 7 }).toFile(`public/media/stills/${id}-${light}.avif`);
          await band.clone().resize({ width: 1216 }).avif({ quality: 55, effort: 7 }).toFile(`public/media/stills/${id}-${light}-1216.avif`);
        }
        if (light === 'day' && OG.includes(id))
          await sharp(i ? mid : await frame(0))
            .resize({ width: 1200, height: 630, fit: 'cover', position: i ? 'south' : 'centre' })
            .jpeg({ quality: 84, mozjpeg: true })
            .toFile(`src/lib/og/${id}.jpg`);
      }
      await ctx.close();
      console.log(gate, light, 'done');
    }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
