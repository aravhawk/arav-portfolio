/**
 * The sound of the home page, live. This is the chunk the control fetches
 * on its first press; nothing here runs before that.
 *
 * It follows the picture through the scene system's observer
 * (src/scene/observe.ts) while the canvas draws, and through the
 * document's own sections where it does not (reduced motion, no WebGL2,
 * the moments before the canvas is up). It steps a few times a second,
 * allocates nothing as it goes, and is silent and suspended whenever the
 * tab is hidden, the page is another page, or the control is off.
 */
import { sight } from '@/scene/observe';
import { build, FADE, type Graph } from './graph';
import { random } from './mapping';
import { Place } from './place';
import { BARE, SOUND, type SceneSound } from './scenes';

/** Milliseconds between steps. */
const STEP = 150;

let ctx: AudioContext | undefined;
let graph: Graph | undefined;
let place: Place | undefined;
let building: Promise<void> | undefined;
let wanted = false;
let sounding = false;
let timer = 0;
let sleep = 0;
let sections: HTMLElement[] = [];
let sounds: SceneSound[] = [];
let tops: number[] = [];
let still: MediaQueryList | undefined;
/** The home page is the page shown, and it has not been put away. */
let here = true;
let away = false;

const root = () => document.documentElement;

/** The page's scenes, in order, and where each section stands in the document. */
function survey() {
  if (!here) return;
  if (!sections[0]?.isConnected) {
    sections = [...document.querySelectorAll<HTMLElement>('main [data-scene]')];
    sounds = sections.map((s) => SOUND[s.dataset.scene!] ?? BARE);
  }
  tops = sections.map((s) => s.offsetTop);
}

function step() {
  if (!ctx || !place || !sounds.length) return;
  const r = root();
  const night = r.dataset.theme === 'dark';
  if (r.dataset.flight === 'live') {
    const a = sounds[sight.from] ?? BARE;
    place.step(ctx.currentTime, a, sounds[sight.to] ?? a, sight.mix, sight.progress, night, !!still?.matches);
    return;
  }
  // No canvas: the scene is the section the reader is in (its top edge where the words are pinned, its middle where the page is plain).
  const y = scrollY + (r.hasAttribute('data-flight') ? 0 : innerHeight / 2);
  let i = 0;
  while (i + 1 < tops.length && y >= tops[i + 1]) i++;
  place.step(ctx.currentTime, sounds[i], sounds[i], 0, 0.5, night, true);
}

/** Bring what is heard into line with what is wanted, the tab and the page. */
function settle() {
  if (!ctx || !graph) return;
  survey();
  const should = wanted && here && !away && !document.hidden && sounds.length > 0;
  if (should === sounding) return;
  sounding = should;
  clearTimeout(sleep);
  clearInterval(timer);
  if (should) {
    void ctx.resume();
    place?.rest();
    graph.power(true, ctx.currentTime, FADE.up);
    step();
    timer = window.setInterval(step, STEP);
  } else {
    // Down first, quickly; the context stops only once nothing is sounding.
    graph.power(false, ctx.currentTime, FADE.down);
    const c = ctx;
    sleep = window.setTimeout(() => void c.suspend(), 600);
  }
}

/** The control is on. `context` was made inside the visitor's press. */
export function soundOn(context: AudioContext) {
  wanted = true;
  if (building) return building.then(settle);
  ctx = context;
  still = matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('visibilitychange', settle);
  addEventListener('pagehide', () => {
    away = true;
    settle();
  });
  addEventListener('pageshow', () => {
    away = false;
    settle();
  });
  addEventListener('resize', survey, { passive: true });
  const rng = random((Date.now() ^ (performance.now() * 1000)) >>> 0);
  building = build(context, rng).then((g) => {
    graph = g;
    place = new Place(g, rng);
    settle();
    // Turned off again while it was being made: nothing to hear, so nothing runs.
    if (!sounding) void context.suspend();
  });
  return building;
}

/** The control is off. */
export function soundOff() {
  wanted = false;
  settle();
}

/** The page changed under the nav: the home page was left (`false`), or come back to. */
export function soundHere(is: boolean) {
  here = is;
  settle();
}
