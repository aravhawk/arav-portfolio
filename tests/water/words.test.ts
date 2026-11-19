import { composed } from '@/water/registry';
import { describe, expect, it } from 'vitest';
import { basisOf, flightKeys, poseAt, projectPoint, type V3 } from '@/water/camera';
import { type Cap, type Placed, NAV_CLEAR, isFan, layoutCaptions, layoutList, layoutStepped, streamAnchors } from '@/water/words';
import { COLS, colApex, colHeights } from '@/water/world';

/**
 * The home page's words may never meet. The captions' geometry is run here
 * with the flight's own camera across the whole of each station's stretch
 * of scroll, at every frame size the page is composed for, with every name
 * set whole: no two captions intersect, no leader crosses another or runs
 * behind a caption, all of it stands clear of the nav and inside the frame.
 * (scripts/words-test.mjs checks the same of the rendered page.)
 */

const FRAMES: [number, number][] = [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];
// 12 px mono, tracked 0.01em: a little wider than the page sets it.
const widthOf = (name: string) => Math.ceil(name.length * 7.7);
const H = 17;
const REPOS = ['Kilo Code', 'OpenBridge', 'XcodeBenchmark', 'Investo', 'Tokscale', 'Thrasher & Chambers Website', 'T3 Code'];
const MODELS = ['qwen3.5-opus-4.6', 'llama4', 'gemma4', 'qwen3.6'];

// The captions stand with their station's action: from a little before its composed frame to its leaving (see `build` in src/app/page.tsx).
const UP = composed.upstream;
const MODELS_AT = composed.models;
const SPAN: [number, number] = [-0.08, 0.95];

type Rect = [number, number, number, number];
const meet = (a: Rect, b: Rect) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const cross = (p: number[], q: number[], r: number[], s: number[]) => {
  const d = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return d(p, q, r) * d(p, q, s) < 0 && d(r, s, p) * d(r, s, q) < 0;
};
/** Does the segment a to b pass through the rectangle (shrunk a hair, so touching its edge is not through it)? */
const through = (a: number[], b: number[], r: Rect) => {
  for (let k = 0; k <= 40; k++) {
    const x = a[0] + ((b[0] - a[0]) * k) / 40;
    const y = a[1] + ((b[1] - a[1]) * k) / 40;
    if (x > r[0] + 1 && x < r[0] + r[2] - 1 && y > r[1] + 1 && y < r[1] + r[3] - 1) return true;
  }
  return false;
};

function check(caps: Cap[], at: Placed[], viewW: number, where: string) {
  const rects = at.map((p, i): Rect => [p.lx, p.ly, caps[i].w, caps[i].h]);
  for (let i = 0; i < caps.length; i++) {
    expect(rects[i][1], `${where}: caption ${i} under the nav`).toBeGreaterThanOrEqual(NAV_CLEAR);
    expect(rects[i][0], `${where}: caption ${i} inside the left`).toBeGreaterThanOrEqual(0);
    expect(rects[i][0] + rects[i][2], `${where}: caption ${i} inside the right`).toBeLessThanOrEqual(viewW);
    for (let j = i + 1; j < caps.length; j++) {
      expect(meet(rects[i], rects[j]), `${where}: captions ${i} and ${j} meet`).toBe(false);
      expect(cross([caps[i].x, caps[i].y], [at[i].fx, at[i].fy], [caps[j].x, caps[j].y], [at[j].fx, at[j].fy]), `${where}: leaders ${i} and ${j} cross`).toBe(false);
    }
  }
}

/** The captions in view at s on a frame, as the page finds them. */
function inView(points: V3[], names: string[], s: number, w: number, h: number, lift: (i: number) => number) {
  const aspect = w / h;
  const cam = basisOf(poseAt(flightKeys(aspect), s));
  const caps: Cap[] = [];
  points.forEach((pt, i) => {
    const p = projectPoint(cam, pt, aspect);
    const x = p[0] * w;
    const y = p[1] * h;
    if (p[2] > 1 && x > 24 && x < w - 24 && y > NAV_CLEAR + 30 && y < h - 24) caps.push({ x, y, w: widthOf(names[i]), h: H, lift: lift(i), side: 1 });
  });
  return caps;
}

describe('captions never meet, across the scroll range', () => {
  it('the seven repositories (wide frames: on their streams; narrow frames: one list)', () => {
    const points = streamAnchors();
    let seen = 0;
    for (const [w, h] of FRAMES) {
      const wide = w / h >= 0.9;
      const narrow = w < 720 || (w < 900 && !wide);
      for (let s = UP + SPAN[0]; s < UP + SPAN[1]; s += 0.02) {
        const where = `${w}x${h} at ${s.toFixed(2)}`;
        if (narrow) {
          const sizes = REPOS.map((n) => ({ w: widthOf(n), h: H }));
          const at = layoutList(sizes, 16, h * 0.6);
          for (let i = 1; i < at.length; i++) expect(at[i].ly, where).toBeGreaterThanOrEqual(at[i - 1].ly + H);
          for (const z of sizes) expect(16 + z.w, `${where}: a whole name fits the frame`).toBeLessThanOrEqual(w - 16);
          continue;
        }
        const caps = inView(points, REPOS, s, w, h, (i) => (i % 2 ? 78 : 44));
        if (!caps.length) continue;
        seen++;
        const at = layoutCaptions(caps, w, 48);
        check(caps, at, w, where);
        if (isFan(caps)) {
          const rects = at.map((p, i): Rect => [p.lx, p.ly, caps[i].w, caps[i].h]);
          caps.forEach((c, i) => rects.forEach((r, j) => j !== i && expect(through([c.x, c.y], [at[i].fx, at[i].fy], r), `${where}: leader ${i} behind caption ${j}`).toBe(false)));
        }
      }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('the four models (each over its own serac: wide frames as a row of leaders, narrow frames stepped)', () => {
    const heights = colHeights([9000, 5200, 2600, 1500]);
    const tops: V3[] = COLS.xs.map((x, i) => [x + colApex(i)[0] * COLS.r * (heights[i] / COLS.hMax), COLS.y + 26 * Math.sin(i * 2.3) + colApex(i)[1] * COLS.r * (heights[i] / COLS.hMax), heights[i] - 24]);
    let seen = 0;
    for (const [w, h] of FRAMES) {
      const wide = w / h >= 0.9;
      const narrow = w < 720 || (w < 900 && !wide);
      for (let s = MODELS_AT + SPAN[0]; s < MODELS_AT + SPAN[1]; s += 0.02) {
        const where = `${w}x${h} at ${s.toFixed(2)}`;
        const caps = inView(tops, MODELS, s, w, h, (i) => (i % 2 ? 40 : 64));
        if (!caps.length) continue;
        seen++;
        const at = narrow ? layoutStepped(caps, w, 18) : layoutCaptions(caps, w, 48);
        check(caps, at, w, where);
      }
    }
    expect(seen).toBeGreaterThan(100);
  });
});
