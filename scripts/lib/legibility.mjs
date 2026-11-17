/**
 * The legibility check, shared by legibility-test.mjs and overlap-test.mjs.
 *
 * The home page sets its words over a moving picture, so their contrast is
 * measured, not assumed. At a scroll position this collects each visible
 * line of text over the picture (independently of the engine, by walking
 * text nodes), hides the words, photographs the picture behind them, and
 * fails any line whose contrast against the worst pixels behind it is under
 * WCAG AA (4.5 to 1, or 3 to 1 for large type).
 */

/** Runs in the page: every visible line of text set over the picture. */
function linesOverPicture() {
  const lum = (rgb) => {
    const m = rgb.match(/[\d.]+/g).map(Number);
    const c = m.slice(0, 3).map((v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    // An alpha below 1 is composited over the picture: treated as its own
    // colour scaled, which is the pessimistic reading for light text.
    const a = m.length > 3 ? m[3] : 1;
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * a;
  };
  const out = [];
  const range = document.createRange();
  for (const host of document.querySelectorAll('.fl-words[data-on], .fl-call[data-on], .nav')) {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const el = node.parentElement;
      // The nav sits on its own glass: it is not over the bare picture.
      if (el.closest('.glass')) continue;
      // A callout's caption stands on its own opaque plate (checked: not assumed).
      const plate = el.closest('.fl-call-label');
      if (plate && /^rgb\(/.test(getComputedStyle(plate).backgroundColor)) continue;
      // The film is a framed plate of its own: its control is not over the bare picture.
      if (el.closest('.fl-film')) continue;
      // A filled button brings its own opaque ground (checked: not assumed).
      const btn = el.closest('.btn');
      if (btn && /^rgb\(/.test(getComputedStyle(btn).backgroundColor)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // A line that is still fading in or out is not being read yet.
      let op = 1;
      for (let e = el; e && e !== document.body; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      if (op < 0.99) continue;
      const px = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
        out.push({ x: r.left, y: r.top, w: r.width, h: r.height, text: node.nodeValue.trim().slice(0, 40), ink: lum(cs.color), large: px >= 24 || (bold && px >= 18.66) });
      }
    }
  }
  return out;
}

/** Runs in the page: the brightest and darkest the picture gets behind each box. */
async function behind({ b64, boxes }) {
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
const HIDE = '.fl-words,.fl-call,.nav,.skip{visibility:hidden!important}nextjs-portal{display:none!important}';

/** True when the page in this tab is the flight and its picture is running. */
export async function runsFlight(page) {
  await page.waitForFunction(() => document.documentElement.dataset.flight || document.documentElement.dataset.water, null, { timeout: 20000 }).catch(() => {});
  return (await page.evaluate(() => document.documentElement.dataset.flight ?? null)) === 'on';
}

/**
 * Walk the flight and measure every line of words against the picture.
 * @param positions scroll positions in px
 * @param settle ms to let words that have just come in finish arriving
 * The last position of the page is the ending at rest: there the words and
 * the light event are given time to arrive, and the picture is photographed
 * three times as the water moves.
 */
export async function measureFlight(page, positions, { settle = 820 } = {}) {
  const row = { steps: 0, lines: 0, worst: null, fails: [] };
  const { vh, max } = await page.evaluate(() => ({ vh: innerHeight, max: document.documentElement.scrollHeight - innerHeight }));
  for (const y0 of positions) {
    const y = Math.round(Math.min(max, y0));
    const last = y >= max - 2;
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(last ? 4200 : settle);
    row.steps++;
    const boxes = await page.evaluate(linesOverPicture);
    if (!boxes.length) continue;
    const style = await page.addStyleTag({ content: HIDE });
    const worst = boxes.map(() => ({ hi: 0, lo: 1 }));
    for (let i = 0; i < (last ? 3 : 1); i++) {
      await page.waitForTimeout(i ? 650 : 60);
      const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
      const res = await page.evaluate(behind, { b64, boxes });
      res.forEach((r, j) => {
        worst[j].hi = Math.max(worst[j].hi, r.hi);
        worst[j].lo = Math.min(worst[j].lo, r.lo);
      });
    }
    await style.evaluate((el) => el.remove());
    boxes.forEach((b, j) => {
      const cr = Math.min(ratio(b.ink, worst[j].hi), ratio(b.ink, worst[j].lo));
      row.lines++;
      row.worst = Math.min(row.worst ?? Infinity, cr);
      const need = b.large ? 3 : 4.5;
      if (cr < need) row.fails.push({ scroll: +(y / vh).toFixed(2), text: b.text, contrast: +cr.toFixed(2), need });
    });
  }
  if (row.worst != null) row.worst = +row.worst.toFixed(2);
  return row;
}

/** Set the theme the way the site's own switch does. */
export async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    window.dispatchEvent(new Event('themechange'));
  }, theme);
  await page.waitForTimeout(900);
}
