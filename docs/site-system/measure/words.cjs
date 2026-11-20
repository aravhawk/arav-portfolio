// The copy rules that a machine can check, on a production build of this site.
//
//   NODE_PATH=<a node_modules with playwright> node docs/site-system/measure/words.cjs <base>
//
// 1. Counts the home page's visible words (the page holds 200; adding one means removing one).
// 2. On every page in the sitemap, and a missing page: no em or en dash, and none of the names
//    that never appear on the site. A post's own text (.prose) is the owner's and is not checked.
// 3. Reports console errors on the home page.
const { chromium } = require('playwright');
const NEVER = ['Jarvis', 'Friday', 'Grok Bot', 'AlphaPredict', 'infiniflop/infiniview'];
(async () => {
  const base = process.argv[2];
  if (!base) throw Error('usage: words.cjs <base url>');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const count = await page.evaluate(() => {
    const skip = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return true;
        if (n.matches('.sr-only, .metric-tip, .skip, script, style, noscript, nextjs-portal')) return true;
      }
      return false;
    };
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.trim() && !skip(n.parentElement)) out.push(n.nodeValue.trim());
    return out.join(' ').split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;
  });
  console.log('home page, visible words:', count, count === 200 ? '' : '(it held 200)');
  console.log('home page, console errors:', errors.length, errors.join(' | '));
  const map = await (await page.request.get(base + '/sitemap.xml')).text();
  const paths = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  let bad = 0;
  for (const path of [...new Set([...paths, '/nope'])]) {
    const res = await page.request.get(base + path);
    const text = (await res.text())
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<div class="prose[\s\S]*?<\/article>/, ' ')
      .replace(/<[^>]+>/g, ' ');
    const dashes = (text.match(/[\u2013\u2014]/g) || []).length;
    const names = NEVER.filter((w) => text.toLowerCase().includes(w.toLowerCase()));
    if (dashes || names.length) bad++;
    console.log(String(res.status()), path.padEnd(48), 'dashes', dashes, '| names', names.join(', ') || 'none');
  }
  await browser.close();
  if (bad || errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
