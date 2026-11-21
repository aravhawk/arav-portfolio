import { describe, expect, it } from 'vitest';
import { arms, groundAt, plan, recordPlan, spills, tribs } from '@/audio/plan';
import { AT, BASIN, BENDS, CANYON_LINE, COLS, DAM, DELTA, DY, ISLAND, LAKE, LATTICE, POOL, RIVER, SLAB, SLUICES, STREAM, TARN, TRIBS, WORLD, tribWidth } from '@/water/world';

const open = [1, 0, 0];

describe('the world’s plan is read from the calls that carve the bed', () => {
  it('records what the world paints: channels, pools, discs, free shapes, dry ground and broken water', () => {
    const p = recordPlan();
    const chans = p.ops.filter((o) => o.chan);
    expect(chans.length).toBeGreaterThan(30);
    expect(p.ops.filter((o) => !o.chan && o.wet).length).toBeGreaterThan(15);
    expect(p.ops.filter((o) => !o.chan && !o.wet).length).toBeGreaterThanOrEqual(3);
    expect(p.agit.length).toBeGreaterThan(10);
    // The free shapes (the tarn, the sea's coast) were kept as shapes, and the name `Path2D` was given back.
    expect(p.ops.some((o) => !o.chan && o.shape.k === 'ellipse')).toBe(true);
    expect(p.ops.some((o) => !o.chan && o.shape.k === 'poly' && o.shape.pts.length > 8)).toBe(true);
    expect((globalThis as { Path2D?: unknown }).Path2D).toBeUndefined();
    // The three sluices are known for what they are.
    expect(chans.filter((c) => c.chan && c.sluice >= 0).map((c) => (c.chan ? c.sluice : -1))).toEqual([0, 1, 2]);
    // It is drawn once.
    expect(plan()).toBe(plan());
  });

  it('the lake is ice until it melts; the river runs where world.ts draws it; beside it is land', () => {
    expect(groundAt(1300, LAKE.y1 - 800, 0, open)).toMatchObject({ wet: 0, ice: 1 });
    expect(groundAt(1300, LAKE.y1 - 800, 1, open)).toMatchObject({ wet: 1, ice: 0 });
    expect(groundAt(1300, LAKE.y1 - 800, 0.4, open).wet).toBeCloseTo(0.4, 9);
    for (const p of RIVER) expect(groundAt(p.x, p.y + 30, 1, open).wet, `${p.x},${p.y}`).toBeGreaterThan(0);
    // Below the lake's river the stream's middle line is a guide for what is drawn along it, not the bed. Through the
    // basin and down to the cliff it is over water at the basin's head and along the narrows below it...
    for (const i of [6, 8, 9, 10]) expect(groundAt(STREAM[i].x, STREAM[i].y + 30, 1, open).wet, `guide ${i}`).toBe(1);
    // ...but it crosses the island's west arm beside the block, which is dry ground,
    expect(groundAt(STREAM[7].x, STREAM[7].y + 30, 1, open).wet).toBe(0);
    expect(STREAM[7].x).toBeGreaterThan(SLAB.x - 420);
    expect(STREAM[7].x).toBeLessThan(SLAB.x - 230);
    // ...and it cuts the corner where the river now swings out east before it comes round to the cliff's foot: the
    // guide's point there is the bank inside that bend, and the river itself runs east of it.
    expect(groundAt(STREAM[11].x, STREAM[11].y + 30, 1, open).wet).toBe(0);
    expect(groundAt(2215, 6610 + DY, 1, open)).toMatchObject({ wet: 1, flow: 1 });
    const mid = { x: (RIVER[1].x + RIVER[2].x) / 2, y: (RIVER[1].y + RIVER[2].y) / 2 };
    expect(groundAt(mid.x, mid.y, 1, open)).toMatchObject({ wet: 1, flow: 1 });
    expect(groundAt(mid.x + 700, mid.y, 1, open).wet).toBe(0);
    expect(groundAt(mid.x - 700, mid.y, 1, open).wet).toBe(0);
  });

  it('the basin is water round an island that is dry; the block stands with its foot in it, and the water is broken in front of its face', () => {
    expect(groundAt(ISLAND.x, ISLAND.y, 1, open).wet).toBe(0);
    // (Two arms of the island come forward past the block's flanks: dry too.)
    expect(groundAt(SLAB.x - 325, SLAB.y + 100, 1, open).wet).toBe(0);
    expect(groundAt(SLAB.x + 330, SLAB.y + 60, 1, open).wet).toBe(0);
    // Between them, in front of the block's face, is water, marked as broken: that is where the sea's sets land.
    const front = groundAt(SLAB.x, SLAB.y - 190, 1, open);
    expect(front.wet).toBe(1);
    expect(front.white).toBeCloseTo(0.22, 6);
    expect(groundAt(SLAB.x, SLAB.y - 40, 1, open).wet).toBe(1);
    // Out in the basin, upstream of the island, the water is open from wall to wall and unbroken.
    const beside = groundAt(BASIN.x + 330, BASIN.y + 120, 1, open);
    expect(beside.wet).toBe(1);
    expect(beside.white).toBe(0);
    // (The near bank stands out into the basin's south-west corner in a round point: the station's name stands on it.)
    expect(groundAt(BASIN.x + 120, BASIN.y + 250, 1, open).wet).toBe(0);
  });

  it('the streams fall into the river where world.ts says, as wide as their counts', () => {
    const t = tribs();
    expect(t).toHaveLength(TRIBS.length);
    t.forEach((r, i) => {
      expect(r.x).toBe(TRIBS[i].mouth.x);
      expect(r.y).toBe(TRIBS[i].mouth.y);
      expect(r.w).toBe(tribWidth([9, 5, 3, 2, 1, 1, 1][i]));
      // Its mouth is water, fast and broken.
      const g = groundAt(r.x, r.y - 20, 1, open);
      expect(g.wet).toBe(1);
      expect(g.white).toBeGreaterThan(0.2);
    });
  });

  it('the rock pool is still, and drained by one thin brook that leaves from its far shore; the tarn does not move', () => {
    const inPool = groundAt(POOL.x + POOL.w - 120, POOL.y + 100, 1, open);
    expect(inPool.wet).toBe(1);
    expect(inPool.flow).toBeLessThan(0.15);
    // One brook, and no stream in: the pool is fed by its own melt.
    const sp = spills();
    expect(sp).toHaveLength(1);
    expect(sp[0]).toEqual({ x: 1800, y: 9620 + AT.pool, w: 56, speed: 0.7 });
    expect(sp[0].y).toBeGreaterThan(POOL.y + POOL.h * 0.8);
    // It is water where it leaves and runs down to the river.
    expect(groundAt(1740, 9750 + AT.pool, 1, open)).toMatchObject({ wet: 1, flow: 0.7 });
    expect(groundAt(TARN.x, TARN.y, 1, open)).toMatchObject({ wet: 1, still: 1 });
    expect(groundAt(TARN.x, TARN.y, 1, open).flow).toBeLessThan(0.05);
  });

  it('a sluice’s channel carries what its gate lets through, and a shut one is a dry bed', () => {
    const p = SLUICES[1][2];
    // Shut: the picture draws bare gravel there. No water, so no sound and no drop under a press.
    expect(groundAt(p.x, p.y, 1, [1, 0, 0])).toEqual({ wet: 0, flow: 0, white: 0, ice: 0, sea: 0 });
    for (const i of [1, 2]) for (const q of SLUICES[i].slice(0, 4)) expect(groundAt(q.x, q.y, 1, [1, 0, 0]).wet, `sluice ${i} at ${q.y}`).toBe(0);
    for (const q of SLUICES[0].slice(0, 4)) expect(groundAt(q.x, q.y, 1, [1, 0, 0]).wet).toBe(1);
    const half = groundAt(p.x, p.y, 1, [0.5, 0.5, 0]);
    expect(half.wet).toBe(0.5);
    expect(half.flow).toBe(0.5);
    const full = groundAt(p.x, p.y, 1, [0, 1, 0]);
    expect(full).toMatchObject({ wet: 1, flow: 1 });
    // It is white just below the gate, and less so further down.
    const mouth = SLUICES[1][1];
    expect(groundAt(mouth.x, mouth.y, 1, [0, 1, 0]).white).toBeGreaterThan(0.5);
    expect(full.white).toBeLessThan(groundAt(mouth.x, mouth.y, 1, [0, 1, 0]).white);
    // (Low down, the still pool's slow set is drawn over the channels: it moves water, it does not carve, and a channel under it is still its sluice's.)
    expect(groundAt(SLUICES[1][3].x, SLUICES[1][3].y, 1, [0, 1, 0]).flow).toBe(1);
    // Where the three have met the river runs whatever the gates say.
    expect(groundAt(1300, DAM.y + 1100, 1, [1, 0, 0]).wet).toBe(1);
    // Behind the dam it is a pond; the shallows where the columns stand barely move.
    expect(groundAt(1300, DAM.y - 120, 1, open).wet).toBeGreaterThan(0);
    expect(groundAt(COLS.xs[1], COLS.y + 120, 1, open).flow).toBeLessThan(0.15);
    expect(groundAt(LATTICE.x + 150, LATTICE.y + 150, 1, open).flow).toBeLessThan(0.1);
  });

  it('the canyon runs fast and breaks on the outside of its bends', () => {
    const mid = CANYON_LINE[1];
    expect(groundAt(mid.x, mid.y, 1, open)).toMatchObject({ wet: 1, flow: 1 });
    expect(groundAt(mid.x + 400, mid.y, 1, open).wet).toBe(0);
    const b = BENDS[0];
    expect(groundAt(b.x - 0.75 * 220, b.y + 0.75 * 220, 1, open).white).toBeGreaterThan(0.5);
  });

  it('the delta is three arms and the braids between them, with dry bars between, and past it and past the world’s end is the sea', () => {
    const a = arms();
    // Three arms and ten braids, as world.ts now draws them; the three arms are among the five broadest (the ones given a voice).
    expect(a).toHaveLength(13);
    const broad = a
      .slice()
      .sort((x, y) => y.w - x.w)
      .slice(0, 5);
    expect(broad.filter((r) => r.w > 110)).toHaveLength(3);
    expect(Math.min(...a.map((r) => r.w))).toBeLessThan(65);
    for (let i = 1; i < a.length; i++) expect(a[i].x).toBeGreaterThanOrEqual(a[i - 1].x);
    for (const r of a) {
      expect(r.y).toBeGreaterThan(DELTA.apex.y - 5);
      expect(groundAt(r.x, r.y, 1, open).wet).toBe(1);
    }
    // Somewhere across the delta there is dry ground between two channels.
    const y = DELTA.y + 100;
    let wet = 0;
    let dry = 0;
    for (let x = 1300; x < 2400; x += 20) (groundAt(x, y, 1, open).wet ? wet++ : dry++);
    expect(wet).toBeGreaterThan(5);
    expect(dry).toBeGreaterThan(5);
    expect(groundAt(1800, DELTA.sea + 600, 1, open)).toMatchObject({ wet: 1, sea: 1 });
    expect(groundAt(1300, WORLD.h + 5000, 1, open)).toMatchObject({ wet: 1, sea: 1 });
    expect(groundAt(-4000, WORLD.h + 200, 1, open).sea).toBe(1);
  });
});
