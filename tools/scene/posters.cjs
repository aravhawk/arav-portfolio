/* Generate the site's stills from the warmed renderer, at both camera gates.
   The caller starts the production server and supplies the pinned Python. */
const { chromium } = require('playwright');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
(async () => {
  const temp = '.tools/out/o2c/bake/posters';
  fs.mkdirSync(temp, { recursive: true });
  const browser = await chromium.launch({
    headless: false,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  try {
    for (const [theme, colorScheme] of [
      ['day', 'light'],
      ['night', 'dark'],
    ]) {
      for (const phone of [false, true]) {
        const viewport = phone ? { width: 390, height: 844 } : { width: 1440, height: 1200 };
        const page = await browser.newPage({ viewport, deviceScaleFactor: 2, colorScheme });
        await page.goto('http://localhost:3184/lab/hero');
        await page.waitForFunction(() => window.__lakeProof, undefined, { timeout: 60000 });
        const data = await page.evaluate(() => window.__lakeProof.capture());
        const name = 'still-' + theme + (phone ? '-phone' : '');
        const png = path.join(temp, name + '.png');
        fs.writeFileSync(png, Buffer.from(data.split(',')[1], 'base64'));
        const python = path.join(os.homedir(), '.t3/portfolio-redesign-v4/tools/bake-venv/bin/python');
        const result = spawnSync(
          python,
          ['tools/scene/still.py', png, 'public/scene/lake/' + name + '.avif', String(phone ? 860 : 2880)],
          { stdio: 'inherit' },
        );
        if (result.status !== 0) throw Error('AVIF encode failed');
        await page.close();
        console.log(name);
      }
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
