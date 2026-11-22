import { describe, expect, it } from 'vitest';
import { END_AT, MELT, basisOf, flightKeys, poseAt } from '@/water/camera';
import { F, bits, coverFlight, frameTiles, iceParts, passNeeds } from '@/water/variants';

/** What the whole frame needs down the flight, as the page works it out before it mounts. */
function needsFor(aspect: number) {
  const keys = flightKeys(aspect);
  const out: { s: number; need: number; pieces: number[] }[] = [];
  for (let s = 0; s <= END_AT + 1e-6; s += 0.05) {
    const pose = basisOf(poseAt(keys, s));
    const need = passNeeds(pose, aspect, iceParts((s - MELT.from) / (MELT.to - MELT.from), 0, true), true);
    out.push({ s, need, pieces: frameTiles(pose, aspect, need, null, Math.round(1000 * aspect), 1000).map((t) => t.mask) });
  }
  return out;
}

describe('the flight is covered by a few broad variants', () => {
  for (const aspect of [1728 / 1117, 1, 390 / 844]) {
    const needs = needsFor(aspect);
    const cover = coverFlight(needs);

    it(`every piece of every frame has one that carries it (aspect ${aspect.toFixed(2)})`, () => {
      for (const n of needs) {
        const here = cover.filter((c) => n.s >= c.from - 1e-6 && n.s <= c.to + 1e-6);
        expect(here.length).toBeGreaterThan(0);
        for (const piece of n.pieces) expect(cover.some((c) => (c.mask & piece) === piece)).toBe(true);
        // (The whole frame's need is carried by the stretch the position is in.)
        expect(here.some((c) => (c.mask & n.need) === n.need)).toBe(true);
      }
    });

    it(`they are few, and none carries the lake's ice past the lake (aspect ${aspect.toFixed(2)})`, () => {
      expect(new Set(cover.map((c) => c.mask)).size).toBeLessThanOrEqual(4);
      const lake = F.ICE | F.NAME | F.FIELD;
      for (const c of cover) if (c.mask & lake) expect(c.to).toBeLessThan(MELT.to + 0.3);
      // (And the block is not carried through the lower river.)
      for (const c of cover) if (c.mask & F.SLAB) expect(c.from).toBeLessThan(10);
      for (const c of cover) expect(bits(c.mask)).toBeLessThanOrEqual(9);
    });
  }
});
