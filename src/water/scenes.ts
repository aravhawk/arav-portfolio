/**
 * Scenes: how each page's layout becomes a river bed.
 *
 * A scene reads named anchors from the DOM (elements with `data-bed`) and
 * paints pools and channels through them. Layout is decided by CSS; the
 * scene only connects what the layout placed, so the bed reflows with the
 * page at every width.
 */

import { type BedPainter, type Pt, type Rect, cx, cy, pt } from './bed';

export interface Anchors {
  rect(name: string): Rect | null;
  all(prefix: string): { name: string; rect: Rect; el: HTMLElement }[];
  viewW: number;
  viewH: number;
  docH: number;
}

export type Scene = (b: BedPainter, a: Anchors) => void;

const bottom = (r: Rect, t = 0.5): Pt => pt(r.x + r.w * t, r.y + r.h);
const topOf = (r: Rect, t = 0.5): Pt => pt(r.x + r.w * t, r.y);

/** Stream width scales gently with the viewport. */
const streamW = (a: Anchors) => Math.max(26, Math.min(46, a.viewW * 0.032));

const lab: Scene = (b, a) => {
  const lake = a.rect('lake');
  if (!lake) return;
  b.pool(lake, 40);
  // A slow current gathers toward the outlet, so meltwater leaves the lake.
  for (const t of [0.18, 0.5, 0.82]) {
    b.channel([pt(lake.x + lake.w * t, lake.y + lake.h * 0.12), pt(lake.x + lake.w * (0.5 + (t - 0.5) * 0.5), lake.y + lake.h * 0.6), pt(cx(lake), lake.y + lake.h - 30)], {
      width: lake.w * 0.34,
      speed: 0.3,
      flowOnly: true,
    });
  }
  const w = streamW(a);
  const pools = a.all('pool:');
  let from = bottom(lake);
  b.agitate(from, 60, 0.8);
  for (const p of pools) {
    const to = topOf(p.rect);
    const midY = (from.y + to.y) / 2;
    b.channel([pt(from.x, from.y - 30), pt(from.x, midY - 10), pt(to.x, midY + 10), pt(to.x, to.y + 30)], { width: w });
    b.pool(p.rect, 28);
    b.channel([pt(cx(p.rect), p.rect.y + 20), pt(cx(p.rect), cy(p.rect)), pt(cx(p.rect), p.rect.y + p.rect.h - 20)], {
      width: w * 2.2,
      speed: 0.35,
      flowOnly: true,
    });
    b.agitate(pt(to.x, to.y + 26), 46, 0.9);
    from = bottom(p.rect);
  }
  b.channel([pt(from.x, from.y - 30), pt(from.x, a.docH + 40)], { width: w });
};

export const SCENES: Record<string, Scene> = { lab };
