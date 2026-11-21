import { describe, expect, it } from 'vitest';
import { SETTLE_90, follow } from '@/flight/spring';

const run = (hz: number, seconds: number) => {
  const f = { x: 0, v: 0 };
  let peak = 0;
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    follow(f, 1, 1 / hz);
    peak = Math.max(peak, f.x);
  }
  return { x: f.x, peak };
};

describe('the picture follows the scroll through one spring', () => {
  it('has covered nine tenths of a step in SETTLE_90 seconds', () => {
    expect(run(600, SETTLE_90).x).toBeCloseTo(0.9, 2);
    expect(SETTLE_90).toBeGreaterThanOrEqual(0.5);
    expect(SETTLE_90).toBeLessThanOrEqual(0.7);
  });
  it('stands in the same place at 30, 60 and 120 frames a second', () => {
    for (const t of [0.1, 0.3, 0.6, 1.2]) {
      const a = run(60, t).x;
      expect(run(120, t).x).toBeCloseTo(a, 6);
      expect(run(30, t).x).toBeCloseTo(a, 6);
    }
  });
  it('never overshoots and comes to rest', () => {
    const r = run(120, 3);
    expect(r.peak).toBeLessThanOrEqual(1);
    expect(r.x).toBeCloseTo(1, 5);
  });
  it('keeps its speed when the goal moves under it', () => {
    const f = { x: 0, v: 0 };
    for (let i = 0; i < 12; i++) follow(f, 1, 1 / 60);
    const v = f.v;
    follow(f, 2, 1 / 600);
    expect(Math.abs(f.v - v)).toBeLessThan(0.25);
  });
});
