/**
 * The first paint's still: which one a window shows. There is one to a band
 * of window shapes and to a theme (see posterBands in camera.ts and
 * scripts/capture-poster.mjs). It is chosen before the first paint by a
 * small script in the page itself (`posterBoot`), and again by the flight's
 * stage when the page is come to from another (`pickPoster`): both write
 * the band on the document (`data-poster`) and the still's address in
 * `--poster`, so the stylesheet shows it and the flight draws its first
 * frame from that band's camera.
 */

import { posterBands } from './camera';

const DIR = '/media/poster';

/** What both choosers run: `B` is every band as [id, lo, hi]. Self-contained, so it can be written into the page as text. */
function choose(B: [string, number, number][], dir: string) {
  const d = document.documentElement;
  const a = (d.clientWidth || window.innerWidth) / Math.max(window.innerHeight, d.clientHeight, 1);
  let id = a < B[0][1] ? B[0][0] : B[B.length - 1][0];
  for (let i = 0; i < B.length; i++) if (a >= B[i][1] && a < B[i][2]) id = B[i][0];
  const t = d.dataset.theme === 'dark' ? 'dark' : 'light';
  const u = dir + '/' + id + '-' + t;
  d.dataset.poster = id;
  d.style.setProperty('--poster', "image-set(url('" + u + ".avif') type('image/avif'), url('" + u + ".webp') type('image/webp'))");
}

const table = (): [string, number, number][] => posterBands().map((b) => [b.id, b.lo, b.hi]);

/** Choose the still for this window and theme. */
export function pickPoster() {
  choose(table(), DIR);
}

/**
 * The page's own first script, as text: it chooses the still before the first paint, and sees that the first
 * frame's words set even where the picture is slow to come or never comes (at once, where motion is reduced).
 */
export function posterBoot(wordsByMs: number): string {
  return `(function(){try{(${choose.toString()})(${JSON.stringify(table())},${JSON.stringify(DIR)})}catch(e){}var d=document.documentElement,w=function(){d.setAttribute('data-hero-words','')};try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)w();else setTimeout(w,${wordsByMs})}catch(e){w()}})()`;
}
