// The newsletter's field in every state, photographed and measured.
//
//   NODE_PATH=<playwright modules> node scripts/subscribe-states.mjs <base> <outdir> [--noscript]
//
// Against a production build. On the home page's ending and on /blog, at 1440 and at 390 wide (touch), in both
// themes, it puts the field through idle, focused, sending, subscribed, already subscribed, looks wrong, too many
// tries and something failed, and saves a frame of each. The route's answers are given by the script itself (the
// request is caught in the browser), so nothing is stored and no database is needed.
//
// It also measures what the brief asks: that no state moves anything on the page (the place of what follows the
// form, and the layout-shift entries), the sizes of the targets, the input's type size, what the keys do, where
// focus goes, and how long a press on the button takes to its next paint.
//
// --noscript: with scripts off it really posts the form (one made-up address at example.com) and photographs the
// page the route sends it to. That one needs the site's database, or the stand-in (scripts/lib/neon-standin.mjs).
// It writes states.md beside the frames and exits 1 if a measure fails.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const noscript = args.includes('--noscript');
const [base = 'http://localhost:3184', out = '.tools/out/subscribe-states'] = args.filter((a) => !a.startsWith('--'));
mkdirSync(out, { recursive: true });

const ANSWERS = {
  subscribed: [200, { ok: true, outcome: 'subscribed' }],
  already: [200, { ok: true, outcome: 'already' }],
  invalid: [400, { ok: false, outcome: 'invalid' }],
  limited: [429, { ok: false, outcome: 'limited' }],
  failed: [500, { ok: false, outcome: 'failed' }],
};
const lines = ['# The newsletter field: states', '', `Site: ${base}`, ''];
let bad = 0;
const check = (ok, text) => {
  if (!ok) bad++;
  lines.push(`- ${ok ? 'ok' : 'FAIL'}: ${text}`);
};

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function open(ctx, route) {
  const page = await ctx.newPage();
  await page.goto(base + route, { waitUntil: 'load' });
  if (route === '/') {
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForSelector('.fl-end-words[data-set]', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2200);
  } else {
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('form.sub')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(500);
  }
  return page;
}

/** The form's frame with what it is composed with: the ending's whole block and its small print, or the page's section. */
async function frame(page, file) {
  const box = await page.evaluate(() => {
    const form = document.querySelector('.sub');
    const whole = form.closest('.fl-end-block') ?? form.closest('section') ?? form;
    const r = whole.getBoundingClientRect();
    // (The ending's small print hangs under its block.)
    const under = whole.querySelector('.fl-end-print')?.getBoundingClientRect().bottom ?? r.bottom;
    const wide = Math.max(r.right, form.getBoundingClientRect().right);
    return { x: r.left, y: r.top, w: wide - r.left, h: Math.max(r.bottom, under) - r.top, vw: innerWidth, vh: innerHeight };
  });
  const pad = 24;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  await page.screenshot({ path: join(out, file), clip: { x, y, width: Math.min(box.vw - x, box.w + pad * 2), height: Math.min(box.vh - y, box.h + pad * 2) } });
}

/** Where the things that must not move are. */
const places = (page) =>
  page.evaluate(() => {
    const top = (sel) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().top * 100) / 100 : null;
    };
    const f = document.querySelector('.sub').getBoundingClientRect();
    return { form: [f.top, f.height].map((v) => Math.round(v * 100) / 100).join('/'), head: top('.ending-head'), links: top('.ending-links'), print: top('.fl-end-print'), next: top('.next'), foot: top('footer') };
  });

for (const route of ['/', '/blog']) {
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      const touch = width < 700;
      const tag = `${route === '/' ? 'home' : 'blog'}-${width}-${theme}`;
      const ctx = await browser.newContext({ viewport: { width, height: touch ? 844 : 900 }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, colorScheme: theme });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('theme', t);
        } catch {}
        window.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        window.__ev = [];
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__ev.push({ name: e.name, d: e.duration });
        }).observe({ type: 'event', durationThreshold: 16, buffered: true });
      }, theme);
      let answer = 'subscribed';
      let hold = null;
      await ctx.route('**/api/subscribe', async (r) => {
        if (hold) await hold;
        const [status, body] = ANSWERS[answer];
        await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });

      lines.push('', `## ${tag}`, '');
      let page = await open(ctx, route);
      const rest = await places(page);
      const clsAtRest = await page.evaluate(() => window.__cls);
      await frame(page, `${tag}-1-idle.png`);

      // Sizes.
      const m = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const r = (el) => el.getBoundingClientRect();
        const go = q('.sub-go');
        const hit = getComputedStyle(go, '::before');
        const inset = ['top', 'right', 'bottom', 'left'].map((k) => parseFloat(hit[k]) || 0);
        const b = r(go);
        return {
          field: [Math.round(r(q('.sub-field')).width), Math.round(r(q('.sub-field')).height)],
          button: [Math.round(b.width), Math.round(b.height)],
          target: [Math.round(b.width - inset[1] - inset[3]), Math.round(b.height - inset[0] - inset[2])],
          font: parseFloat(getComputedStyle(q('.sub-input')).fontSize),
          label: q('form.sub label').textContent,
          name: q('.sub-input').labels?.[0]?.textContent,
          described: q('.sub-input').getAttribute('aria-describedby')?.split(' ').map((id) => document.getElementById(id)?.textContent).join(' | '),
          live: q('.sub-say').getAttribute('aria-live'),
          type: q('.sub-input').type + ', autocomplete ' + q('.sub-input').autocomplete + ', inputmode ' + q('.sub-input').inputMode + ', required ' + q('.sub-input').required,
          novalidate: q('form.sub').noValidate,
        };
      });
      check(m.font >= 16, `the input's text is ${m.font} px (16 or more: no zoom on a phone)`);
      check(m.target[1] >= 44 && m.target[0] >= 44, `the button is ${m.button.join(' by ')} px and takes presses over ${m.target.join(' by ')} px; the field is ${m.field.join(' by ')} px`);
      lines.push(`- the input: ${m.type}; its label reads "${m.name}"; described by "${m.described}"; the status line is aria-live ${m.live}; the form's own sentences replace the browser's: ${m.novalidate}`);

      // Focused.
      await page.locator('.sub-input').focus();
      await frame(page, `${tag}-2-focus.png`);

      // Looks wrong, before any request: a press on the button with a bad address.
      await page.locator('.sub-input').fill('reader@example');
      const press = async () => {
        const b = await page.locator('.sub-go').boundingBox();
        if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      };
      await press();
      await page.waitForTimeout(350);
      await frame(page, `${tag}-6-invalid.png`);
      let s = await page.evaluate(() => ({ say: document.querySelector('.sub-say').textContent, invalid: document.querySelector('.sub-input').getAttribute('aria-invalid'), value: document.querySelector('.sub-input').value, focus: document.activeElement?.className }));
      check(s.say.includes('looks wrong') && s.invalid === 'true' && s.value === 'reader@example' && s.focus === 'sub-input', `a bad address: "${s.say}", aria-invalid ${s.invalid}, what was typed is kept ("${s.value}"), focus is in the field`);
      await page.locator('.sub-input').pressSequentially('.com');
      s = await page.evaluate(() => document.querySelector('.sub-say').textContent);
      check(s === '', 'typing again takes the reason away');

      // Sending: the answer is held.
      let release;
      hold = new Promise((r) => (release = r));
      answer = 'limited';
      await press();
      await page.waitForTimeout(250);
      await frame(page, `${tag}-3-sending.png`);
      s = await page.evaluate(() => ({ text: document.querySelector('.sub-go').textContent, dis: document.querySelector('.sub-go').getAttribute('aria-disabled'), busy: document.querySelector('form.sub').getAttribute('aria-busy'), ro: document.querySelector('.sub-input').readOnly }));
      check(s.text === 'Subscribing…' && s.dis === 'true' && s.busy === 'true' && s.ro, `sending: the button says "${s.text}", aria-disabled ${s.dis}, the form aria-busy ${s.busy}, the field read-only ${s.ro}`);
      release();
      hold = null;
      await page.waitForTimeout(500);
      await frame(page, `${tag}-7-limited.png`);
      s = await page.evaluate(() => ({ say: document.querySelector('.sub-say').textContent, value: document.querySelector('.sub-input').value, focus: document.activeElement?.className, lines: Math.round(document.querySelector('.sub-said').getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector('.sub-said')).lineHeight)), bottom: Math.round(innerHeight - document.querySelector('.sub-said').getBoundingClientRect().bottom) }));
      check(s.say.startsWith('Too many tries') && s.value === 'reader@example.com' && s.focus === 'sub-input', `too many tries: "${s.say}", the address is kept, focus is back in the field`);
      check(s.bottom >= 0, `the reason is ${s.lines} line(s) and ends ${s.bottom} px above the foot of the screen`);

      answer = 'failed';
      await press();
      await page.waitForTimeout(500);
      await frame(page, `${tag}-8-failed.png`);
      s = await page.evaluate(() => ({ say: document.querySelector('.sub-say').textContent, button: document.querySelector('.sub-go').textContent, value: document.querySelector('.sub-input').value }));
      check(s.say.startsWith('Something went wrong') && s.button === 'Try again' && s.value === 'reader@example.com', `something failed: "${s.say}", the button says "${s.button}", the address is kept`);

      // Nothing has moved through all of that.
      const mid = await places(page);
      check(JSON.stringify(mid) === JSON.stringify(rest), `nothing moved through idle, wrong, sending, limited and failed (form top/height ${mid.form}; ${Object.entries(mid).filter(([k, v]) => k !== 'form' && v != null).map(([k, v]) => `${k} ${v}`).join(', ')})`);

      answer = 'subscribed';
      await press();
      await page.waitForTimeout(500);
      await frame(page, `${tag}-4-subscribed.png`);
      s = await page.evaluate(() => ({ done: document.querySelector('.sub-done')?.textContent, role: document.querySelector('.sub-done')?.getAttribute('role'), focus: document.activeElement?.className, field: !!document.querySelector('.sub-field') }));
      check(s.done?.startsWith("You're subscribed") && s.role === 'status' && s.focus === 'sub-done' && !s.field, `subscribed: the field is replaced by "${s.done}" (role ${s.role}), which takes focus`);
      const end = await places(page);
      check(JSON.stringify(end) === JSON.stringify(rest), 'the confirmation stands in the field\'s place: nothing moved');
      const cls = await page.evaluate(() => window.__cls);
      check(cls - clsAtRest < 0.001, `layout shift through every state: ${(cls - clsAtRest).toFixed(4)} (the page's own, before the field was touched: ${clsAtRest.toFixed(4)})`);
      const ev = await page.evaluate(() => window.__ev.filter((e) => ['click', 'pointerup', 'pointerdown', 'keydown'].includes(e.name)));
      const worst = ev.reduce((a, e) => Math.max(a, e.d), 0);
      check(worst < 100, `the slowest press to its next paint: ${worst || 'under 16'} ms over ${ev.length} measured event(s)`);
      await page.close();

      // Already subscribed, sent from the keys: the words change and nothing moves.
      page = await open(ctx, route);
      answer = 'already';
      await page.locator('.sub-input').focus();
      await page.keyboard.type('Reader@Example.com');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      await frame(page, `${tag}-5-already.png`);
      s = await page.evaluate(() => ({ done: document.querySelector('.sub-done')?.textContent, instant: document.querySelector('form.sub').hasAttribute('data-instant'), t: getComputedStyle(document.querySelector('.sub-done')).transitionDuration, focus: document.activeElement?.className }));
      check(s.done?.startsWith("You're already subscribed") && s.instant && /^0s/.test(s.t) && s.focus === 'sub-done', `from the keys (type, Enter): "${s.done}", no transition (${s.t}), focus on the confirmation`);
      // The order of the keys: field, then button.
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(route === '/' ? 3000 : 600);
      await page.locator('.sub-input').focus();
      await page.keyboard.press('Tab');
      s = await page.evaluate(() => document.activeElement?.className);
      check(s === 'sub-go', `Tab from the field goes to the button (the hidden trap is not a stop): ${s}`);
      await ctx.close();
    }
  }
}

if (noscript) {
  lines.push('', '## Scripts off', '');
  for (const [route, width] of [['/blog', 1440], ['/', 390]]) {
    const touch = width < 700;
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: touch ? 844 : 900 }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    const tag = `noscript-${route === '/' ? 'home' : 'blog'}-${width}`;
    await page.goto(base + route, { waitUntil: 'load' });
    await page.locator('form.sub').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(out, `${tag}-1-form.png`) });
    const address = `n1-noscript-${Math.random().toString(16).slice(2, 10)}@example.com`;
    await page.locator('.sub-input').fill(address);
    await Promise.all([page.waitForURL('**/newsletter/**', { timeout: 15000 }), page.locator('.sub-go').click()]);
    await page.screenshot({ path: join(out, `${tag}-2-answer.png`) });
    const first = new URL(page.url()).pathname;
    const h1 = await page.locator('h1').textContent();
    check(first === '/newsletter/subscribed', `${route} at ${width}, scripts off: the form posts ${address} and lands on ${first} ("${h1}")`);
    check(!page.url().includes('@') && !page.url().includes('%40'), 'the address is not in the address bar');
    await page.goto(base + route, { waitUntil: 'load' });
    await page.locator('.sub-input').fill(address);
    await Promise.all([page.waitForURL('**/newsletter/**', { timeout: 15000 }), page.locator('.sub-go').click()]);
    await page.screenshot({ path: join(out, `${tag}-3-again.png`) });
    check(new URL(page.url()).pathname === '/newsletter/already', `the same address again lands on ${new URL(page.url()).pathname} ("${await page.locator('h1').textContent()}")`);
    lines.push(`- test address to delete: ${address}`);
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(out, 'states.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(bad ? `\n${bad} measure(s) FAILED` : '\nall measures passed');
process.exit(bad ? 1 : 0);
