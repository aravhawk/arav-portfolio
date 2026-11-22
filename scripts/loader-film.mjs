#!/usr/bin/env node
/**
 * The loading sequence, filmed: a visit to the home page from the navigation to `--after` ms past the live picture.
 *
 *   NODE_PATH=<playwright modules> node scripts/loader-film.mjs <base url> <out dir> <width> <height> <light|dark>
 *     [--warm] [--reduced] [--scroll] [--noscript] [--after 2600] [--n 12]
 *
 * A first visit by default (every fragment shader is made new to the driver, as flight-first-visit.mjs does);
 * `--warm` visits once and films the second visit, the returning reader's. `--scroll` wheels down for as long as
 * the sequence stands: the page must still be at its top when the picture comes up (`yAtLive`). `--noscript`
 * films the page without scripts, which must show no sequence at all.
 *
 * The frames are the compositor's own (a CDP screencast), so they show what was really presented while the
 * driver held the page. It writes `--n` evenly spaced frames, `files.txt` naming them, and `summary.json`: when
 * each step was reported (`steps`, from `__flight.loadLog`), the gaps between presented frames before the picture
 * (`shown`), frame intervals before and after it, the layout shift and the largest paint.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, out, w, h, theme, ...rest] = process.argv.slice(2);
const flag = (n) => rest.includes(`--${n}`);
const arg = (n, d) => (rest.indexOf(`--${n}`) < 0 ? d : rest[rest.indexOf(`--${n}`) + 1]);
const W = +w, H = +h, phone = W < 600;
const after = +arg('after', 2600), N = +arg('n', 12);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', `--window-size=${W},${H + 90}`] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: phone ? 2 : 1, colorScheme: theme, isMobile: phone, hasTouch: phone, reducedMotion: flag('reduced') ? 'reduce' : 'no-preference', javaScriptEnabled: !flag('noscript') });
if (!flag('warm')) {
  await ctx.addInitScript((seed) => {
    let n = seed;
    const proto = WebGL2RenderingContext.prototype;
    const original = proto.shaderSource;
    proto.shaderSource = function (shader, source) {
      if (this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER) source = source.replace(/void main\(\)\s*\{/, (body) => body + 'if(gl_FragCoord.x > ' + ++n + '.0) discard;');
      return original.call(this, shader, source);
    };
  }, 100000 + Math.floor(Math.random() * 8000000));
}
await ctx.addInitScript(() => {
  const log = (window.__film = { marks: {}, cls: 0, lcp: 0, frames: [] });
  const seen = (k) => { if (!(k in log.marks)) log.marks[k] = Math.round(performance.now()); };
  const read = () => {
    const s = document.documentElement.dataset;
    if (s.flight === 'on') seen('flight');
    if (s.picture !== undefined) { seen('picture'); if (log.yAtLive === undefined) log.yAtLive = scrollY; }
    if (s.opened !== undefined) seen('opened');
    if (s.load !== undefined) seen('load:' + s.load);
    if (s.loadAt !== undefined) seen('at:' + s.loadAt);
  };
  let watching = false;
  const watch = () => {
    if (watching || !document.documentElement) return;
    watching = true;
    new MutationObserver(read).observe(document.documentElement, { attributes: true });
    read();
  };
  let last = 0;
  const tick = (t) => { watch(); if (last) log.frames.push([Math.round(t), +(t - last).toFixed(1)]); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) log.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) log.lcp = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
});
if (flag('warm')) {
  const p0 = await ctx.newPage();
  await p0.goto(base + '/', { waitUntil: 'commit' });
  await p0.waitForFunction(() => document.documentElement.dataset.picture !== undefined, null, { timeout: 120000 });
  await p0.waitForTimeout(4000);
  await p0.close();
}
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const shots = [];
cdp.on('Page.screencastFrame', (f) => {
  shots.push({ t: f.metadata.timestamp * 1000, data: f.data });
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1 });
const t0 = Date.now();
await page.goto(base + '/', { waitUntil: 'commit' });
let liveAt = 0;
let scrolling = null;
if (flag('scroll')) {
  scrolling = (async () => {
    await page.waitForTimeout(1200);
    await page.mouse.move(W / 2, H / 2);
    for (let i = 0; i < 400 && !liveAt; i++) { await page.mouse.wheel(0, 60).catch(() => {}); await page.waitForTimeout(50); }
  })();
}
if (flag('noscript')) await page.waitForTimeout(3000);
else {
  await page.waitForFunction(() => document.documentElement.dataset.picture !== undefined, null, { timeout: 180000 });
  liveAt = Date.now() - t0;
  await page.waitForTimeout(after);
}
if (scrolling) await scrolling;
const info = flag('noscript') ? {} : await page.evaluate(() => ({ ...window.__film, loadLog: window.__flight?.loadLog ?? [], y: scrollY, nav: performance.timeOrigin, words: document.body.innerText.trim().split(/\s+/).length }));
await cdp.send('Page.stopScreencast').catch(() => {});
const end = Date.now() - t0;
// Evenly spaced moments; each shows the last frame the compositor had presented by then.
const picks = [];
for (let i = 0; i < N; i++) {
  const at = 150 + ((end - 150) * i) / (N - 1);
  let best = null;
  for (const s of shots) if (s.t - t0 <= at) best = s;
  if (!best) best = shots[0];
  if (best) picks.push({ at: Math.round(at), s: best });
}
const files = picks.map((p) => {
  const f = join(out, `t${String(p.at).padStart(5, '0')}ms.jpg`);
  writeFileSync(f, Buffer.from(p.s.data, 'base64'));
  return f;
});
const frames = info.frames ?? [];
const live = info.marks?.picture ?? 0;
const post = frames.filter((f) => f[0] > live);
const steps = {}; { const L = info.loadLog ?? []; for (let i = 0; i < L.length; i++) { const nx = L.slice(i + 1).find((e) => e.id !== L[i].id); if (!(L[i].id in steps)) steps[L[i].id] = { from: L[i].t, n: L[i].n }; steps[L[i].id].to = nx ? nx.t : live; } for (const k in steps) steps[k].ms = steps[k].to - steps[k].from; }
const gaps = []; { const pre = shots.filter((x) => x.t - t0 < liveAt); for (let i = 1; i < pre.length; i++) gaps.push(Math.round(pre[i].t - pre[i - 1].t)); }
const summary = { shown: { frames: gaps.length, over100: gaps.filter((g) => g > 100).length, over300: gaps.filter((g) => g > 300).length, worst: Math.max(0, ...gaps) }, steps, w: W, h: H, theme, warm: flag('warm'), reduced: flag('reduced'), liveWallMs: liveAt, marks: info.marks, cls: +(info.cls ?? 0).toFixed(4), lcp: info.lcp, y: info.y, yAtLive: info.yAtLive, words: info.words, screencastFrames: shots.length, afterLive: { frames: post.length, over20: post.filter((f) => f[1] > 20).length, over50: post.filter((f) => f[1] > 50).length, worst: Math.max(0, ...post.map((f) => f[1])) }, beforeLive: { over50: frames.filter((f) => f[0] <= live && f[1] > 50).length, worst: Math.max(0, ...frames.filter((f) => f[0] <= live).map((f) => f[1])) } };
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
writeFileSync(join(out, 'files.txt'), files.join('\n'));
console.log(JSON.stringify(summary));
await ctx.close();
await browser.close();
