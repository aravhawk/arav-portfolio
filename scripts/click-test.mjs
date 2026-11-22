// Every link and control on a page, really clicked: what each one did.
//
//   NODE_PATH=<playwright modules> node scripts/click-test.mjs <base> [outdir] [--routes /,/work] [--sizes 1440,390] [--themes light,dark] [--noscript]
//
// Against a production build (`pnpm build && pnpm exec next start -p <port>`). For each route, at 1440 wide with a
// mouse and at 390 wide with touch, in both themes, the script lists every link and control the page shows, brings
// each to where a reader would meet it (on the home page: the scroll position at which its block of words stands),
// and presses it with Playwright's own click or tap: the pointer goes to the element's place on the screen, so a
// link that something covers, or that takes no pointer events, fails here as it does for a reader. Then it checks
// what the press did:
//
//   a link to another site   a new tab at that address, the link carries rel="noopener", the tab has no opener
//   mailto:                  the browser is asked to open that address
//   a link inside the site   the page's address is the link's (the feed: the address, or the file handed over)
//   #fragment                the address carries the fragment (the rail's ticks: the page travels to the place)
//   the copy button          the clipboard holds the address
//   any other control        some state it shows has changed (pressed, checked, a dialog open, the theme)
//
// With --noscript the same routes are opened with scripts off (the home page then stacks as a plain page) and every
// link is pressed where it lies: a link has to answer there too. (Controls need scripts and are not pressed.)
//
// No request leaves the machine: every address outside the base is answered with an empty page.
// It writes `clicks.json` and `clicks.md` to the out directory, prints a summary, and exits 1 if any press failed.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : args.splice(i, 2)[1];
};
const routes = flag('routes', '/,/work,/work/cc-switch,/blog,/blog/three-ai-agents-five-saas-products').split(',');
const sizes = flag('sizes', '1440,390').split(',').map(Number);
const themes = flag('themes', 'light,dark').split(',');
const noscript = args.includes('--noscript') && !!args.splice(args.indexOf('--noscript'), 1);
const base = (args[0] || 'http://localhost:3184').replace(/\/$/, '');
const out = args[1] || '';

const SELECTOR = 'a[href], button, [role="radio"], [role="switch"], summary';

/** Runs in the page: numbers every link and control, and says what each is and where a reader meets it. */
function survey(selector) {
  const vh = Math.max(window.innerHeight, document.documentElement.clientHeight);
  const list = [];
  let n = 0;
  for (const el of document.querySelectorAll(selector)) {
    if (el.closest('dialog:not([open])')) continue;
    const id = String(n++);
    el.setAttribute('data-ct', id);
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const shown = cs.display !== 'none' && cs.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    // Where it is said to be: its landmark, then its own words.
    const land = el.closest('header.nav') ? 'nav' : el.closest('.fl-rail') ? 'rail' : el.closest('footer') ? 'footer' : el.closest('.ending') ? 'ending' : el.closest('nav[aria-label]')?.getAttribute('aria-label') ?? 'page';
    const name = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const href = el.tagName === 'A' ? el.getAttribute('href') : null;
    // On the home page a block of words stands for a stretch of scroll: the place, in screens, at which this one does.
    let at = null;
    const words = el.closest('.fl-words');
    const call = el.closest('.fl-call');
    if (call) at = (Number(call.dataset.callFrom) + Number(call.dataset.callTo)) / 2;
    else if (words) {
      const from = Number(words.dataset.flFrom);
      const to = Number(words.dataset.flTo);
      at = to > 1e5 ? 1e6 : words.dataset.flOut ? Number(words.dataset.flOut) - 0.35 : from < 0 ? 0 : (from + to) / 2;
    } else if (land === 'rail') at = 1;
    list.push({
      id,
      land,
      name,
      href,
      tag: el.tagName.toLowerCase(),
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
      skip: el.classList.contains('skip'),
      fixed: land === 'nav' || land === 'rail',
      // (On the home page the nav's mark stands in for the name once the name has gone: it is pressed from there.)
      late: el.classList.contains('nav-mark') && !!document.querySelector('main.fl'),
      shown,
      y: at == null ? null : Math.round(Math.min(at * vh, document.documentElement.scrollHeight - window.innerHeight)),
      railAt: land === 'rail' ? Number(el.dataset.at) : null,
    });
  }
  return list;
}

/** Runs in the page: what a control shows of its state, and what the page shows around it. */
function stateOf(id) {
  const el = document.querySelector(`[data-ct="${id}"]`);
  const own = el ? ['aria-pressed', 'aria-checked', 'aria-expanded', 'aria-label', 'data-state'].map((a) => el.getAttribute(a)).join('|') + '|' + el.textContent : 'gone';
  const group = el?.closest('[role="radiogroup"]');
  return [
    own,
    group ? Array.from(group.querySelectorAll('[aria-checked]'), (x) => x.getAttribute('aria-checked')).join('') : '',
    el?.closest('details') ? String(el.closest('details').open) : '',
    document.documentElement.dataset.theme,
    document.querySelectorAll('dialog[open]').length,
    document.querySelectorAll('video').length ? Array.from(document.querySelectorAll('video'), (v) => v.paused).join('') : '',
  ].join(' ~ ');
}

/** Runs in the page: is the middle of the element the element (or a part of it)? If not, what is there. */
function under(id) {
  const el = document.querySelector(`[data-ct="${id}"]`);
  if (!el) return 'gone';
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (!hit) return 'nothing (off the screen)';
  if (el.contains(hit) || hit.contains(el) && hit.closest('[data-ct]') === el) return '';
  return hit.tagName.toLowerCase() + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.trim().split(/\s+/).join('.') : '');
}

async function run(browser, width, theme) {
  const touch = width < 700;
  const context = await browser.newContext({
    viewport: { width, height: touch ? 844 : 900 },
    deviceScaleFactor: 2,
    hasTouch: touch,
    isMobile: touch,
    colorScheme: theme,
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
  });
  // Nothing leaves the machine: another site's address is answered here, so a new tab still lands on its address.
  await context.route(
    (url) => !url.href.startsWith(base) && /^https?:/.test(url.href),
    (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>held</title>' }),
  );
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {}
    // What the page itself saw of the last press: the link or control the click event reached.
    window.__ct = null;
    document.addEventListener('click', (e) => { window.__ct = e.target.closest?.('[data-ct]')?.getAttribute('data-ct') ?? 'elsewhere'; }, true);
  }, theme);

  const rows = [];
  let page = await context.newPage();
  let asked = [];
  const listen = async (p) => {
    // (A mailto: address makes no request: the browser says it was asked to open it.)
    const cdp = await context.newCDPSession(p);
    await cdp.send('Page.enable');
    cdp.on('Page.frameRequestedNavigation', (e) => asked.push(e.url));
  };
  await listen(page);

  for (const route of routes) {
    const open = async (y) => {
      if (page.isClosed()) {
        page = await context.newPage();
        await listen(page);
      }
      await page.goto(base + route, { waitUntil: 'load' });
      await page.waitForTimeout(route === '/' ? 1500 : 500);
      const list = await page.evaluate(survey, SELECTOR);
      if (y) await page.evaluate((top) => window.scrollTo(0, top), y);
      return list;
    };
    const list = await open(0);
    let fresh = true;
    let at = 0;
    for (const item of list) {
      const row = { route, width, theme, land: item.land, name: item.name, href: item.href, ok: false, did: '' };
      rows.push(row);
      if (item.skip) {
        // The skip link is shown only to the keyboard: it is reached with Tab and followed with Enter.
        if (!fresh) await open(0);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-ct'));
        await page.keyboard.press('Enter');
        const hash = await page.evaluate(() => location.hash);
        row.ok = focused === item.id && hash === item.href;
        row.did = row.ok ? `keyboard: first Tab stop, Enter goes to ${hash}` : `keyboard: focus ${focused}, hash ${hash}`;
        fresh = false;
        at = -1;
        continue;
      }
      if (!item.shown) {
        row.ok = true;
        row.did = 'not shown at this width';
        continue;
      }
      // Bring it to where a reader meets it.
      const y = item.fixed ? (item.land === 'rail' ? item.y : 0) : item.y;
      if (item.late) {
        // (Down past the name, then a little up: the nav leaves on the way down and returns on the way up.)
        await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3.4));
        await page.waitForTimeout(900);
        await page.mouse.wheel(0, -160);
        await page.evaluate(() => window.scrollBy(0, -160));
        await page.waitForTimeout(900);
        at = -1;
      } else if (y != null && y !== at) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        at = y;
        if (item.fixed && item.land === 'nav') await page.waitForTimeout(600);
      }
      // (Inside a closed disclosure, as the post's contents are on a phone: a reader opens it first, so the test does.)
      const shutIn = await page.evaluate((id) => { const d = document.querySelector(`[data-ct="${id}"]`)?.closest('details:not([open])'); const sum = d?.querySelector('summary'); if (!sum || sum.getAttribute('data-ct') === id) return null; sum.scrollIntoView({ block: 'center', behavior: 'instant' }); return sum.getAttribute('data-ct'); }, item.id);
      if (shutIn) {
        const sb = await stillBox(page, shutIn);
        if (sb) await (touch ? page.touchscreen.tap(sb.x, sb.y) : page.mouse.click(sb.x, sb.y));
        await page.waitForTimeout(250);
      }
      // (Off the flight a reader scrolls to it: it is brought to the middle of the screen, clear of the nav.)
      if (y == null) {
        // (A page that is still travelling from the last press, to a heading say, takes the scroll back: so until it holds.)
        for (let tries = 0; tries < 4; tries++) {
          await page.evaluate((id) => document.querySelector(`[data-ct="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' }), item.id);
          const b = await stillBox(page, item.id);
          if (b && b.y > 70 && b.y < (touch ? 844 : 900) - 10) break;
        }
        at = -1;
      }
      // (A block of words sets in steps once the picture is there: wait for this piece, no longer than a reader would.)
      const wait = route === '/' ? 6000 : 1500;
      const t0 = Date.now();
      let cover = await page.evaluate(under, item.id);
      while (cover && Date.now() - t0 < wait) {
        await page.waitForTimeout(150);
        cover = await page.evaluate(under, item.id);
      }
      const before = await page.evaluate(stateOf, item.id);
      const urlBefore = page.url();
      const scrollBefore = await page.evaluate(() => window.scrollY);
      asked = [];
      await page.evaluate(() => { window.__ct = null; });
      const popup = item.target === '_blank' ? context.waitForEvent('page', { timeout: 5000 }).catch(() => null) : null;
      const download = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
      // The press itself: the pointer goes to the middle of the element's box, where a reader's would. Nothing is
      // scrolled for it and nothing is dispatched to the element: if something covers that place, it gets the press.
      const box = await stillBox(page, item.id);
      if (!box || box.x < 0 || box.y < 0 || box.x > width || box.y > (touch ? 844 : 900)) {
        row.did = `DEAD: it is not on the screen where a reader meets it (${box ? `${Math.round(box.x)}, ${Math.round(box.y)}` : 'no box'})`;
        continue;
      }
      if (touch) await page.touchscreen.tap(box.x, box.y);
      else await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(60);
      const href = item.href ?? '';
      const reached = await page.evaluate(() => window.__ct).catch(() => 'navigated');
      const arrived = reached === item.id || reached === 'navigated';
      if (!arrived && !(item.tag === 'a' && page.url() !== urlBefore)) {
        const where = await page.evaluate((id) => { const el = document.querySelector(`[data-ct="${id}"]`); const w = el?.closest('.fl-words'); return `scroll ${Math.round(window.scrollY)} px${w ? `, its block ${w.hasAttribute('data-on') ? 'on' : 'off'}` : ''}`; }, item.id).catch(() => '');
        row.did = `DEAD: the press never arrives; under its middle is ${cover || (await page.evaluate(under, item.id).catch(() => '?')) || 'itself'} (${reached === null ? 'no click event at all' : `the click went to ${reached}`}; ${where})`;
        if (page.url() !== urlBefore) { await open(0); at = 0; fresh = true; }
        continue;
      }
      if (item.tag === 'a' && item.target === '_blank') {
        const tab = await popup;
        if (!tab) {
          row.did = `no new tab (the click reached ${reached})`;
          continue;
        }
        await tab.waitForLoadState('domcontentloaded').catch(() => {});
        const got = tab.url();
        // (The new tab's own view of where it came from: with rel="noopener" it has none.)
        const opener = await tab.evaluate(() => window.opener !== null).catch(() => false);
        await tab.close();
        const want = new URL(href, base + route).href;
        const rel = /\bnoopener\b/.test(item.rel ?? '');
        row.ok = got === want && rel && !opener;
        row.did = `new tab at ${got}${got === want ? '' : ` (wanted ${want})`}${rel ? ', rel noopener' : ', NO rel noopener'}${opener ? ', HAS an opener' : ''}`;
      } else if (href.startsWith('mailto:')) {
        await page.waitForTimeout(250);
        const req = asked.find((u) => u.startsWith('mailto:'));
        row.ok = reached === item.id && (req ? req === href : true);
        row.did = req ? `the browser was asked to open ${req}` : `the click reached the link (${href}); the browser reported no request`;
      } else if (item.tag === 'a' && href.startsWith('#')) {
        await page.waitForTimeout(item.land === 'rail' ? 900 : 300);
        const now = await page.evaluate(() => ({ y: window.scrollY, hash: location.hash, vh: Math.max(window.innerHeight, document.documentElement.clientHeight), max: document.documentElement.scrollHeight - window.innerHeight }));
        if (item.land === 'rail') {
          const want = Math.min(Math.round(item.railAt * now.vh), now.max);
          row.ok = Math.abs(now.y - want) <= 2;
          row.did = `the page travels to ${now.y} px (its place: ${want} px)`;
          at = now.y;
          if (now.hash) fresh = false;
        } else {
          row.ok = now.hash === href;
          row.did = `the address takes ${now.hash || 'no fragment'}`;
          // (The page is now travelling to that heading: the next press starts from a page at rest.)
          await open(0);
          at = 0;
          fresh = true;
          continue;
        }
      } else if (item.tag === 'a') {
        const want = new URL(href, base + route);
        if (want.pathname === new URL(urlBefore).pathname && !want.hash) {
          // The way home, pressed at home: the page is already there, and goes back to its top.
          await page.waitForTimeout(1200);
          const top = await page.evaluate(() => window.scrollY);
          row.ok = reached === item.id && new URL(page.url()).pathname === want.pathname;
          row.did = `already at ${want.pathname}: the click arrives${top < 4 ? ', the page returns to its top' : `, the page stays at ${top} px`}`;
          await open(0);
          at = 0;
          fresh = true;
          continue;
        }
        const landed = await Promise.race([
          page.waitForURL((u) => u.pathname === want.pathname, { timeout: 8000 }).then(() => 'page', () => null),
          download.then((d) => (d ? 'file' : new Promise(() => {}))),
        ]);
        if (landed === 'file') {
          const d = await download;
          row.ok = d.url() === want.href;
          row.did = `the browser is handed the file at ${d.url()}`;
          await d.cancel().catch(() => {});
        } else {
          row.ok = landed === 'page';
          row.did = landed ? `goes to ${new URL(page.url()).pathname}` : `stays at ${new URL(page.url()).pathname} (the click reached ${reached})`;
        }
        if (page.url() !== urlBefore || landed) {
          await open(0);
          at = 0;
          fresh = true;
          continue;
        }
      } else if (/copy email/i.test(item.name)) {
        await page.waitForTimeout(150);
        const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => `unreadable: ${e.message}`);
        const said = await page.evaluate((id) => document.querySelector(`[data-ct="${id}"]`)?.textContent?.trim(), item.id);
        row.ok = /^[^@\s]+@[^@\s]+$/.test(clip) && said === 'Copied';
        row.did = `the clipboard holds ${clip}; the control says "${said}"`;
      } else {
        await page.waitForTimeout(200);
        const after = await page.evaluate(stateOf, item.id);
        const moved = (await page.evaluate(() => window.scrollY)) !== scrollBefore;
        const already = before.split(' ~ ')[0].split('|')[1] === 'true';
        row.ok = after !== before || moved || (already && reached === item.id);
        row.did = after !== before ? `state changes: ${diff(before, after)}` : already && reached === item.id ? 'already the chosen one: the click arrives, nothing to change' : `no change the page shows (the click reached ${reached})`;
        // Put back what a control opened or switched, so the next press starts from the same page.
        if (after !== before) {
          if ((await page.evaluate(() => document.querySelectorAll('dialog[open]').length)) > 0) {
            // (The film's frame takes its height when the film's first bytes arrive: the control is pressed once it is still.)
            await page.evaluate(() => document.querySelector('dialog[open] button[aria-label^="Close"]')?.setAttribute('data-ct', 'close'));
            await page.waitForTimeout(500);
            const cb = await stillBox(page, 'close');
            if (cb) await (touch ? page.touchscreen.tap(cb.x, cb.y) : page.mouse.click(cb.x, cb.y));
            await page.waitForTimeout(250);
            const shut = (await page.evaluate(() => document.querySelectorAll('dialog[open]').length)) === 0;
            rows.push({ route, width, theme, land: item.land, name: 'Close the film', href: null, ok: shut, did: shut ? 'the dialog closes' : 'DEAD: the dialog stays open' });
            if (!shut) await page.keyboard.press('Escape');
          } else if (/theme|sound/i.test(item.name)) {
            await (touch ? page.touchscreen.tap(box.x, box.y) : page.mouse.click(box.x, box.y));
            await page.waitForTimeout(150);
          }
        }
      }
      fresh = false;
    }
  }
  await context.close();
  return rows;
}

/** The middle of an element's box, once the box has stopped moving (a smooth scroll, a block setting). */
async function stillBox(page, id) {
  const read = () => page.evaluate((x) => { const r = document.querySelector(`[data-ct="${x}"]`)?.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, id);
  let last = await read();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(80);
    const now = await read();
    if (last && now && Math.abs(now.x - last.x) < 0.5 && Math.abs(now.y - last.y) < 0.5) return now;
    last = now;
  }
  return last;
}

function diff(a, b) {
  const x = a.split(' ~ ');
  const y = b.split(' ~ ');
  const names = ['itself', 'its group', 'its details open', 'theme', 'open dialogs', 'video paused'];
  return x.map((v, i) => (v === y[i] ? null : `${names[i]} ${short(v)} to ${short(y[i])}`)).filter(Boolean).join('; ');
}
const short = (s) => s.replace(/\s+/g, ' ').slice(0, 70);

/**
 * The same pages with scripts off: every link, pressed where it lies. The page cannot be asked what the click
 * reached (nothing of ours runs in it), so the test asks the browser what stands at the link's middle and then
 * presses there: a new tab at the link's address, or the page's own address changed, is the answer.
 */
async function runPlain(browser, width, theme) {
  const touch = width < 700;
  const height = touch ? 844 : 900;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, colorScheme: theme, javaScriptEnabled: false, acceptDownloads: true });
  await context.route(
    (url) => !url.href.startsWith(base) && /^https?:/.test(url.href),
    (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>held</title>' }),
  );
  const rows = [];
  let page = await context.newPage();
  for (const route of routes) {
    await page.goto(base + route, { waitUntil: 'load' });
    const count = await page.locator('a[href]').count();
    for (let i = 0; i < count; i++) {
      if (page.isClosed()) page = await context.newPage();
      if (page.url() !== base + route) await page.goto(base + route, { waitUntil: 'load' });
      const link = page.locator('a[href]').nth(i);
      const item = await link.evaluate((el) => ({
        name: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        href: el.getAttribute('href'),
        target: el.getAttribute('target'),
        rel: el.getAttribute('rel'),
        skip: el.classList.contains('skip'),
        land: el.closest('header.nav') ? 'nav' : el.closest('.fl-rail') ? 'rail' : el.closest('footer') ? 'footer' : el.closest('.ending') ? 'ending' : 'page',
        shown: (() => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0; })(),
      }));
      const row = { route, width, theme: `${theme}, scripts off`, land: item.land, name: item.name, href: item.href, ok: false, did: '' };
      rows.push(row);
      if (item.skip || !item.shown || item.href.startsWith('#')) {
        row.ok = true;
        row.did = item.skip ? 'the skip link: shown to the keyboard only' : item.shown ? 'a place on this page' : 'not shown at this width';
        continue;
      }
      await link.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const at = await link.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, own: !!hit && (el.contains(hit) || hit.contains(el) && hit.closest('a') === el), what: hit ? hit.tagName.toLowerCase() + (typeof hit.className === 'string' && hit.className ? '.' + hit.className.trim().split(/\s+/).join('.') : '') : 'nothing' };
      });
      if (!at.own) {
        row.did = `DEAD: under its middle is ${at.what}`;
        continue;
      }
      if (item.href.startsWith('mailto:')) {
        row.ok = true;
        row.did = 'the link is the thing under the press (an address to write to: no page to arrive at)';
        continue;
      }
      const want = new URL(item.href, base + route).href;
      const popup = item.target === '_blank' ? context.waitForEvent('page', { timeout: 5000 }).catch(() => null) : null;
      const download = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
      await (touch ? page.touchscreen.tap(at.x, at.y) : page.mouse.click(at.x, at.y));
      if (popup) {
        const tab = await popup;
        const got = tab ? tab.url() : '';
        await tab?.waitForLoadState('domcontentloaded').catch(() => {});
        row.ok = (tab ? tab.url() : got) === want && /\bnoopener\b/.test(item.rel ?? '');
        row.did = tab ? `new tab at ${tab.url()}${/\bnoopener\b/.test(item.rel ?? '') ? ', rel noopener' : ', NO rel noopener'}` : 'DEAD: no new tab';
        await tab?.close();
      } else if (want === base + route) {
        row.ok = true;
        row.did = 'already at this address: the link is the thing under the press';
      } else {
        const landed = await Promise.race([
          page.waitForURL((u) => u.href === want || u.pathname === new URL(want).pathname, { timeout: 8000 }).then(() => 'page', () => null),
          download.then((d) => (d ? 'file' : new Promise(() => {}))),
        ]);
        row.ok = !!landed;
        row.did = landed === 'file' ? 'the browser is handed the file' : landed ? `goes to ${new URL(page.url()).pathname}` : `DEAD: stays at ${new URL(page.url()).pathname}`;
        if (landed === 'file') await (await download)?.cancel().catch(() => {});
      }
    }
  }
  await context.close();
  return rows;
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const all = [];
// (One size and theme at a time: the home page plays its picture, and four of them at once would starve each other.)
for (const width of sizes) for (const theme of themes) all.push(...(await (noscript ? runPlain : run)(browser, width, theme)));
await browser.close();

const bad = all.filter((r) => !r.ok);
const md = ['| Route | Width | Theme | Where | Link or control | What the press did | |', '| --- | --- | --- | --- | --- | --- | --- |'];
for (const r of all) md.push(`| ${r.route} | ${r.width} | ${r.theme} | ${r.land} | ${r.name.replace(/\|/g, '/')} | ${r.did.replace(/\|/g, '/')} | ${r.ok ? 'ok' : 'FAIL'} |`);
if (out) {
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'clicks.json'), JSON.stringify(all, null, 1));
  writeFileSync(join(out, 'clicks.md'), md.join('\n') + '\n');
}
for (const width of sizes)
  for (const theme of themes)
    for (const route of routes) {
      const of = all.filter((r) => r.route === route && r.width === width && r.theme.split(',')[0] === theme);
      console.log(`${route.padEnd(44)} ${String(width).padEnd(5)} ${theme.padEnd(6)} ${of.filter((r) => r.ok).length}/${of.length} respond`);
    }
for (const r of bad) console.log(`FAIL ${r.route} ${r.width} ${r.theme} [${r.land}] ${r.name}: ${r.did}`);
console.log(bad.length ? `${bad.length} of ${all.length} presses failed` : `all ${all.length} presses respond`);
process.exit(bad.length ? 1 : 0);
