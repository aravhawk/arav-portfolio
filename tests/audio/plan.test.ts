import { describe, expect, it } from 'vitest';
import { arms, groundAt, plan, recordPlan, spills, tribs } from '@/audio/plan';
import { BASIN, BENDS, CANYON_LINE, COLS, DAM, DELTA, ISLAND, LAKE, LATTICE, POOL, RIVER, SLUICES, STREAM, TARN, TRIBS, WORLD, tribWidth } from '@/water/world';

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
    for (const p of [...RIVER, ...STREAM.slice(6, 12)]) expect(groundAt(p.x, p.y + 30, 1, open).wet, `${p.x},${p.y}`).toBeGreaterThan(0);
    const mid = { x: (RIVER[1].x + RIVER[2].x) / 2, y: (RIVER[1].y + RIVER[2].y) / 2 };
    expect(groundAt(mid.x, mid.y, 1, open)).toMatchObject({ wet: 1, flow: 1 });
    expect(groundAt(mid.x + 700, mid.y, 1, open).wet).toBe(0);
    expect(groundAt(mid.x - 700, mid.y, 1, open).wet).toBe(0);
  });

  it('the basin is water round an island that is dry, and broken where the waves strike it', () => {
    expect(groundAt(ISLAND.x, ISLAND.y, 1, open).wet).toBe(0);
    const beside = groundAt(BASIN.x + 120, BASIN.y + BASIN.h / 2, 1, open);
    expect(beside.wet).toBe(1);
    const struck = groundAt(ISLAND.x - 1.5 * ISLAND.rx, ISLAND.y - 0.9 * ISLAND.ry, 1, open).white;
    expect(struck).toBeGreaterThan(0.4);
    expect(beside.white).toBeLessThan(struck);
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

  it('the clear pool is still, with a thin spill in and another out; the tarn does not move', () => {
    const inPool = groundAt(POOL.x + POOL.w - 120, POOL.y + 100, 1, open);
    expect(inPool.wet).toBe(1);
    expect(inPool.flow).toBeLessThan(0.15);
    const sp = spills();
    expect(sp.length).toBeGreaterThanOrEqual(2);
    for (const s of sp) {
      expect(s.w).toBeLessThan(90);
      expect(s.x).toBeGreaterThan(POOL.x - 90);
      expect(s.x).toBeLessThan(POOL.x + POOL.w + 90);
      expect(s.y).toBeGreaterThan(POOL.y - 90);
      expect(s.y).toBeLessThan(POOL.y + POOL.h + 90);
    }
    expect(groundAt(TARN.x, TARN.y, 1, open)).toMatchObject({ wet: 1, still: 1 });
    expect(groundAt(TARN.x, TARN.y, 1, open).flow).toBeLessThan(0.05);
  });

  it('a sluice’s channel carries what its gate lets through', () => {
    const p = SLUICES[1][2];
    expect(groundAt(p.x, p.y, 1, [1, 0, 0])).toMatchObject({ flow: 0, white: 0 });
    expect(groundAt(p.x, p.y, 1, [1, 0, 0]).wet).toBeCloseTo(0.3, 9);
    const half = groundAt(p.x, p.y, 1, [0.5, 0.5, 0]);
    expect(half.flow).toBe(0.5);
    const full = groundAt(p.x, p.y, 1, [0, 1, 0]);
    expect(full).toMatchObject({ wet: 1, flow: 1 });
    // It is white just below the gate, and less so further down.
    const mouth = SLUICES[1][1];
    expect(groundAt(mouth.x, mouth.y, 1, [0, 1, 0]).white).toBeGreaterThan(0.5);
    expect(full.white).toBeLessThan(groundAt(mouth.x, mouth.y, 1, [0, 1, 0]).white);
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

  it('the delta is several channels with dry bars between them, and past it and past the world’s end is the sea', () => {
    const a = arms();
    expect(a.length).toBeGreaterThanOrEqual(6);
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
