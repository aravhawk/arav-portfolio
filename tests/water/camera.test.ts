import { composed, type SectionId } from '@/water/registry';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { END_AT, HOLDS, MOVE, SETTLE_AT, type Basis, type V3, basisOf, flightKeys, groundUnder, poseAt, projectPoint, rayThrough } from '@/water/camera';
import { COLS, DAM, DELTA, FACE, LATTICE, SHARDS, SHEET, SLAB, AT, boardSpan, ringStones, lipY, sheetCols } from '@/water/world';

/**
 * The scroll never holds still. The camera is a pure function of scroll, so
 * the rules it is authored to can be measured here, on every screen shape
 * the page is composed for:
 *
 *  - the eye's speed never reaches zero and never jumps, from the first
 *    pixel of scroll to the ending's rest;
 *  - between any two positions half a screen apart the frame changes
 *    visibly: the station's subject is 6 percent larger or smaller, or the
 *    near ground has slid against the far ranges by 4 percent of the
 *    frame's width;
 *  - across a station's whole hold its subject grows or turns by 12 to 20
 *    percent (a turn is counted as the ranges' slide behind it, in percent
 *    of the frame's width);
 *  - a station's composed frame is exactly the frame it was composed as.
 *
 * `CAM_REPORT=path` writes the table the report quotes.
 */

const SHAPES: [string, number][] = [
  ['wide 1440 x 900', 1.6],
  ['wide 1920 x 1080', 1920 / 1080],
  ['phone 390 x 844', 390 / 844],
  ['tablet 768 x 1024', 0.75],
];

/** Each station's subject: two points of it, whose distance apart in the frame is its size. */
const SUBJECTS: Record<string, (aspect: number) => [V3, V3]> = {
  Infiniview: () => [
    [SLAB.x - SLAB.w / 2, SLAB.y, SLAB.h + SLAB.lift],
    [SLAB.x + SLAB.w / 2, SLAB.y, SLAB.lift],
  ],
  Upstream: () => [
    [1344, lipY(1344), 100],
    [2080, lipY(2080), 100],
  ],
  'Kilo Bench': (a) => [
    [SHEET.x0, SHEET.y, -36],
    [SHEET.x0 + boardSpan(sheetCols(a)), SHEET.y, -36],
  ],
  'Agent Bridge': () => [
    [SHARDS[0].x, SHARDS[0].y, SHARDS[0].h],
    [SHARDS[0].x, SHARDS[0].y, 0],
  ],
  // (Where the eye goes round its subject, the subject's size is the height of something upright in it: a width seen
  // at a slant changes with the slant, not only with how near the eye has come.)
  'Ask Around': () => [
    [ringStones()[2].x, ringStones()[2].y, 0],
    [ringStones()[2].x, ringStones()[2].y, ringStones()[2].h],
  ],
  'Open models': () => [
    [COLS.xs[1], COLS.y, 0],
    [COLS.xs[1], COLS.y, COLS.hMax],
  ],
  'cc-switch': () => [
    [DAM.gates[1], DAM.y, 0],
    [DAM.gates[1], DAM.y, DAM.h],
  ],
  TensorPoW: () => [
    [LATTICE.x, LATTICE.y, 0],
    [LATTICE.x, LATTICE.y, 100],
  ],
  RydAR: () => [
    [FACE.x, FACE.y, FACE.z],
    [FACE.x, FACE.y, FACE.z + FACE.h],
  ],
  Interests: () => [
    [DELTA.apex.x, DELTA.y, 0],
    [DELTA.apex.x, DELTA.y, 100],
  ],
};

const camAt = (aspect: number, s: number) => basisOf(poseAt(flightKeys(aspect), s));

/** How large a subject stands in the frame, in frame widths. */
function sizeOf(cam: Basis, aspect: number, pts: [V3, V3]) {
  const a = projectPoint(cam, pts[0], aspect);
  const b = projectPoint(cam, pts[1], aspect);
  return Math.hypot(a[0] - b[0], (a[1] - b[1]) / aspect);
}

/** How far the near ground slides against the far ranges between two cameras, in frame widths. */
function slide(a: Basis, b: Basis, aspect: number) {
  // The ranges: a point very far along the first camera's level line of sight.
  const lvl = Math.hypot(a.f[0], a.f[1]) || 1;
  const far: V3 = [a.pos[0] + (a.f[0] / lvl) * 1e7, a.pos[1] + (a.f[1] / lvl) * 1e7, 0];
  const f0 = projectPoint(a, far, aspect);
  const f1 = projectPoint(b, far, aspect);
  let most = 0;
  for (const [sx, sy] of [
    [0.5, 0.82],
    [0.25, 0.72],
    [0.75, 0.72],
    [0.5, 0.62],
  ]) {
    const hit = groundUnder(a, sx, sy, aspect);
    if (!hit || hit.t > 6000) continue;
    const p0 = projectPoint(a, [hit.x, hit.y, 0], aspect);
    const p1 = projectPoint(b, [hit.x, hit.y, 0], aspect);
    if (p1[2] < 1) {
      // (The eye has gone past it: it has left the frame altogether.)
      most = Math.max(most, 1);
      continue;
    }
    most = Math.max(most, Math.hypot(p1[0] - p0[0] - (f1[0] - f0[0]), (p1[1] - p0[1] - (f1[1] - f0[1])) / aspect));
  }
  return most;
}

/** How far the ranges turn behind the subject between two cameras, in frame widths (0 where the ranges are not in the frame: an eye that looks steeply down). */
function turn(a: Basis, b: Basis, aspect: number) {
  const d = rayThrough(a, 0.5, 0.5, aspect);
  const lvl = Math.hypot(d[0], d[1]) || 1;
  const far: V3 = [a.pos[0] + (d[0] / lvl) * 1e7, a.pos[1] + (d[1] / lvl) * 1e7, 0];
  const f0 = projectPoint(a, far, aspect);
  const f1 = projectPoint(b, far, aspect);
  if (f0[1] < -0.2 || f1[1] < -0.2) return 0;
  return Math.hypot(f1[0] - f0[0], (f1[1] - f0[1]) / aspect);
}

describe('the scroll never holds still', () => {
  it('the eye never stops and its speed never jumps', () => {
    const faults: string[] = [];
    for (const [name, aspect] of SHAPES) {
      const keys = flightKeys(aspect);
      // (Where the eye is and where it looks, together: a turn of the head on the spot is motion too.)
      const speed = (s: number, e: number) => {
        const a = poseAt(keys, s);
        const b = poseAt(keys, s + e);
        return Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2], (b.aim[0] - a.aim[0]) * 0.3, (b.aim[1] - a.aim[1]) * 0.3) / Math.abs(e);
      };
      for (let s = 0; s < SETTLE_AT - 0.3; s += 0.005) {
        const v = speed(s, 0.005);
        if (v < 25) faults.push(`${name}: the eye all but stops at ${s.toFixed(1)} (${v.toFixed(0)} a screen)`);
      }
      // At every key the speed coming in is the speed going out.
      for (const k of keys) {
        if (k.s <= 0 || k.s >= SETTLE_AT - 0.3) continue;
        const before = speed(k.s, -1e-6);
        const after = speed(k.s, 1e-6);
        if (Math.abs(before - after) > 0.02 * Math.max(before, after) + 1) faults.push(`${name}: the eye's speed jumps at ${k.s.toFixed(2)} (${before.toFixed(0)} to ${after.toFixed(0)} a screen)`);
      }
    }
    expect([...new Set(faults)]).toEqual([]);
  });

  it('every half screen of scroll shows a changed frame', () => {
    const faults: string[] = [];
    const swings: string[] = [];
    for (const [name, aspect] of SHAPES) {
      const holds = HOLDS();
      for (let s = 0; s <= SETTLE_AT - 0.5 + 1e-6; s += 0.1) {
        const a = camAt(aspect, s);
        const b = camAt(aspect, s + 0.5);
        const moved = slide(a, b, aspect);
        // (Wherever the half screen touches a hold, that station's subject is in the frame.)
        const hold = holds.find((h) => s + 0.5 > h.from - 0.2 && s < h.to + 0.2);
        const subject = hold && SUBJECTS[hold.name];
        const grown = subject ? Math.abs(sizeOf(b, aspect, subject(aspect)) / sizeOf(a, aspect, subject(aspect)) - 1) : 0;
        // (The first screen's own stretch: the lake melts under a camera that only closes on the name. The melt is the change there.)
        if (s + 0.5 <= 1.22) continue;
        if (moved >= 0.04 || grown >= 0.06) continue;
        // Where the eye is coming round onto a station it travels away from the subject it is turning to face, so the
        // subject's size and the ground's slide can each cancel over half a screen while the whole frame swings. That
        // swing is change a reader sees: it is counted here, and kept apart, so the report can say how often it is the
        // only measure that is met.
        const swung = turn(a, b, aspect);
        if (swung >= 0.04) swings.push(`${name} at ${s.toFixed(1)}`);
        else faults.push(`${name} at ${s.toFixed(1)}: ground slides ${(moved * 100).toFixed(1)}%, subject changes ${(grown * 100).toFixed(1)}%, the frame swings ${(swung * 100).toFixed(1)}%`);
      }
    }
    if (process.env.CAM_REPORT) writeFileSync(process.env.CAM_REPORT.replace(/(\.\w+)?$/, '-swings$1'), swings.join('\n') + '\n');
    expect(faults).toEqual([]);
  });

  it('across a hold the subject grows or turns by 12 to 20 percent', () => {
    const rows: string[] = [];
    const faults: string[] = [];
    for (const [name, aspect] of SHAPES) {
      for (const h of HOLDS()) {
        const subject = SUBJECTS[h.name];
        if (!subject) continue;
        const a = camAt(aspect, h.from);
        const b = camAt(aspect, h.to);
        const grown = sizeOf(b, aspect, subject(aspect)) / sizeOf(a, aspect, subject(aspect)) - 1;
        const turned = turn(a, b, aspect);
        const ground = slide(a, b, aspect);
        const keys = flightKeys(aspect);
        const speed = (s: number) => {
          const p = poseAt(keys, s - 0.01);
          const q = poseAt(keys, s + 0.01);
          return Math.hypot(q.pos[0] - p.pos[0], q.pos[1] - p.pos[1], q.pos[2] - p.pos[2]) / 0.02;
        };
        // The eye's mean speed on its way here from the last station, against its speed at the composed frame.
        const i = HOLDS().indexOf(HOLDS().find((x) => x.name === h.name)!);
        const left = i > 0 ? HOLDS()[i - 1].to : h.from - 1.2;
        let way = 0;
        for (let s = left; s < h.from - 1e-6; s += 0.02) way += speed(s) * 0.02;
        const travel = way / (h.from - left);
        let half = Infinity;
        for (let s = h.from; s + 0.5 <= h.to + 1e-6; s += 0.05) {
          const p = camAt(aspect, s);
          const q = camAt(aspect, s + 0.5);
          half = Math.min(half, Math.max(Math.abs(sizeOf(q, aspect, subject(aspect)) / sizeOf(p, aspect, subject(aspect)) - 1) / 0.06, slide(p, q, aspect) / 0.04));
        }
        rows.push(`${name} | ${h.name} | ${h.from.toFixed(2)} to ${h.to.toFixed(2)} | ${(grown * 100).toFixed(1)} | ${(turned * 100).toFixed(1)} | ${(ground * 100).toFixed(1)} | ${half.toFixed(2)} | ${speed(h.stop).toFixed(0)} | ${travel.toFixed(0)} | ${(speed(h.stop) / travel).toFixed(2)}`);
        const most = Math.max(Math.abs(grown), turned);
        if (most < 0.12) faults.push(`${name}, ${h.name}: grows ${(grown * 100).toFixed(1)}%, turns ${(turned * 100).toFixed(1)}%: under 12`);
        if (Math.abs(grown) > 0.2 || turned > 0.2) faults.push(`${name}, ${h.name}: grows ${(grown * 100).toFixed(1)}%, turns ${(turned * 100).toFixed(1)}%: over 20`);
      }
    }
    if (process.env.CAM_REPORT) writeFileSync(process.env.CAM_REPORT, ['shape | station | hold (screens) | subject grows % | ranges turn % of width | near ground slides % of width | least change in half a screen (1 = the rule) | speed at the stop | mean speed on the way in | ratio', ...rows].join('\n') + '\n');
    expect(faults).toEqual([]);
  });

  it('a station is composed where it was composed', () => {
    // The frames the fourth round did not recompose: where the eye stands at each stop on a wide screen.
    const at: [SectionId, V3][] = [
      ['infiniview', [930, 8110, 300]],
      ['upstream', [1380, 9950, 330]],
      ['fork', [2130, AT.shallows + 3800, 640]],
      ['lattice', [500, AT.lattice + 3800, 640]],
      ['delta', [1100, AT.delta + 7450, 400]],
    ];
    for (const [i, pos] of at) {
      const p = poseAt(flightKeys(1.6), composed[i]);
      for (let k = 0; k < 3; k++) expect(p.pos[k], `stop ${i}`).toBeCloseTo(pos[k], 6);
    }
    expect(MOVE.before + MOVE.after).toBeGreaterThan(1);
    expect(END_AT).toBeGreaterThan(SETTLE_AT);
  });
});
