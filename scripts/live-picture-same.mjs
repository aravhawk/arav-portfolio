// The picture under the live layer is the picture that was there before it.
//
// At eight places in the flight this records a hash of the picture's own canvas (the played frame, as drawn) and,
// with the live layer off (`__flightLive = false`), a hash of the whole window as painted. Run it against two builds
// and compare the files: the same hashes, the same picture, byte for byte.
//
//   NODE_PATH=<playwright modules> node scripts/live-picture-same.mjs <url> <out.json> [--live]
//
// `--live` leaves the layer on (the window's hash is then left out: the layer moves): the canvas's hash must still match.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out] = process.argv.slice(2);
const live = process.argv.includes('--live');
const PLACES = [0, 3.1, 5.6, 11.2, 16.6, 19.4, 25.8, 31.1];
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 20);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (const [w, h, dpr, theme, mobile] of [[1728, 1117, 1, 'light', false], [390, 844, 2, 'dark', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: theme, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    if (!live) await page.addInitScript(() => (window.__flightLive = false));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__player, null, { timeout: 30000 });
    for (const s of PLACES) {
      await page.evaluate((s) => window.scrollTo(0, Math.round(s * window.__player.state().unit)), s);
      await page.waitForFunction(() => window.__player.settled(), null, { timeout: 60000 });
      await page.waitForTimeout(live ? 1500 : 700);
      const canvas = await page.evaluate(() => document.querySelector('canvas.flight-canvas:not(.flight-veil)').toDataURL('image/png'));
      const row = { w, h, theme, s, live: live ? await page.evaluate(() => !!window.__player.live?.()) : false, canvas: sha(canvas) };
      if (!live) row.window = sha(await page.screenshot({ type: 'png' }));
      rows.push(row);
      console.log(JSON.stringify(row));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(out, JSON.stringify(rows, null, 1));
