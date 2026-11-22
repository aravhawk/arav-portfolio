import { describe, expect, it } from 'vitest';
import { END_AT } from '@/water/camera';
import map from '@/water/cost-map.json';
import { FLOOR, NEAR_FULL, RAMP, REST_FLOOR, REST_SHARE, SETTLE_MS, TRAVEL_SHARE, costAt, easeScale, expect as cost, restPace, travelPace, travelling, type PaceInput } from '@/water/pace';

/** The owner's display (3456 by 2234 at 120 Hz) on a GPU twice the cost map's; the map's own GPU at 60 Hz; a phone a third as fast. */
const M5 = (c: number, broad = false): PaceInput => ({ base: 1000 / 120, mpx: 7.72, cost: c, speed: 0.5, broad, phone: false });
const M4 = (c: number): PaceInput => ({ base: 1000 / 60, mpx: 7.72, cost: c, speed: 1, broad: false, phone: false });
const PHONE = (c: number): PaceInput => ({ base: 1000 / 60, mpx: 1.32, cost: c, speed: 3, broad: false, phone: true });

describe('the cost map', () => {
  it('covers the whole flight in both themes and both shapes', () => {
    for (const shape of ['wide', 'tall'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        const row = map[shape][theme];
        // (A flight that has been made longer or shorter needs its map measured again: scripts/flight-frame-cost.mjs --map.)
        expect(Math.abs((row.length - 1) * map.step - END_AT)).toBeLessThan(0.75);
        for (const v of row) expect(v).toBeGreaterThan(0.1);
      }
    }
    expect(costAt(0, false, 1.6)).toBeGreaterThan(0);
    expect(costAt(999, true, 0.5)).toBeGreaterThan(0);
  });
});

describe('the pace', () => {
  it('at rest is always the full picture where a full frame fits 60 a second', () => {
    for (let c = 0.4; c <= 3.6; c += 0.1) {
      const p = restPace(M5(c));
      expect(p.scale).toBe(1);
      expect(p.lean).toBe(0);
      // Every interval where it fits one, every other where it does not: never slower than 60 a second.
      expect(p.every).toBe(cost(M5(c), 1, 0) <= TRAVEL_SHARE * (1000 / 120) ? 1 : 2);
      expect(p.ms).toBeLessThanOrEqual(REST_SHARE * (1000 / 60));
    }
  });

  it('on the move never goes under the floor, and fits the interval where the floor allows', () => {
    for (let c = 0.4; c <= 3.6; c += 0.1) {
      for (const make of [M5, M4]) {
        const i = make(c);
        const p = travelPace(i);
        expect(p.scale).toBeGreaterThanOrEqual(FLOOR.desktop);
        expect(p.every).toBe(1);
        if (p.scale > FLOOR.desktop && p.scale < 1) expect(p.ms).toBeLessThanOrEqual(TRAVEL_SHARE * i.base * 1.001);
        if (p.scale === 1) expect(cost(i, 1, 0)).toBeLessThanOrEqual(TRAVEL_SHARE * i.base * 1.15);
      }
    }
  });

  it('is the same at 60 and at 120 Hz for a GPU twice as fast', () => {
    // (Everything is a ratio of cost to interval: half the interval on twice the GPU is the same choice.)
    for (let c = 0.4; c <= 3.6; c += 0.1) expect(travelPace(M5(c)).scale).toBeCloseTo(travelPace(M4(c)).scale, 6);
  });

  it('steps a slow device down in order: leaner shading, a lower resolution at rest, then half the rate', () => {
    const light = restPace(PHONE(1.0));
    expect(light).toMatchObject({ scale: 1, every: 1, lean: 0 });
    let last = { lean: 0, scale: 1, every: 1 };
    for (let c = 1; c <= 12; c += 0.25) {
      const p = restPace(PHONE(c));
      expect(p.lean).toBeGreaterThanOrEqual(last.lean);
      expect(p.scale).toBeLessThanOrEqual(last.scale);
      expect(p.every).toBeGreaterThanOrEqual(last.every);
      expect(p.scale).toBeGreaterThanOrEqual(REST_FLOOR.phone);
      // (The resolution is not lowered while leaner shading is left to try, nor the rate while resolution is.)
      if (p.scale < 1) expect(p.lean).toBe(2);
      if (p.every > 1) expect(p.scale).toBe(REST_FLOOR.phone);
      last = p;
    }
    expect(travelPace(PHONE(12)).scale).toBe(FLOOR.phone);
  });

  it('draws a 240 Hz display at 120 on the move', () => {
    expect(travelPace({ ...M5(1), base: 1000 / 240 }).every).toBe(2);
  });
});

describe('travel and the settle', () => {
  /** A scroll that travels for a second and stops, run at a display rate: when it is seen to travel, and the resolution over time. */
  const run = (hz: number) => {
    const dt = 1000 / hz;
    let trip = { on: false, movedAt: -1e9 };
    let scale = 1;
    const log: { t: number; on: boolean; scale: number }[] = [];
    for (let t = 0; t <= 2200; t += dt) {
      // (Screen heights a second: at rest, then one second of travel that eases out, then rest.)
      const flow = t < 200 ? 0 : t < 1200 ? 0.8 * Math.exp(-(t - 200) / 220) + (t < 900 ? 0.2 : 0) : 0;
      trip = travelling(trip, flow, t);
      scale = easeScale(scale, trip.on ? 0.7 : 1, dt / 1000);
      log.push({ t, on: trip.on, scale });
    }
    return log;
  };
  const when = (log: ReturnType<typeof run>, test: (x: (typeof log)[number]) => boolean) => log.find(test)?.t ?? -1;

  it('takes the same time at 60 and at 120 Hz', () => {
    const a = run(60);
    const b = run(120);
    // The first travelling frame is the first frame after the scroll begins, at either rate.
    expect(Math.abs(when(a, (x) => x.on) - when(b, (x) => x.on))).toBeLessThanOrEqual(1000 / 60);
    // It is at the floor, and back at full, at the same moments to within a frame of the slower display.
    for (const test of [(x: { scale: number; t: number }) => x.scale <= 0.7001, (x: { scale: number; t: number }) => x.t > 900 && x.scale === 1]) {
      expect(Math.abs(when(a, test) - when(b, test))).toBeLessThanOrEqual(2 * (1000 / 60));
    }
  });

  it('lets the resolution go at once and brings it back over about a fifth of a second, after the camera has been still a moment', () => {
    const log = run(120);
    const start = when(log, (x) => x.on);
    expect(when(log, (x) => x.scale <= 0.7001) - start).toBeLessThan(60);
    const stop = when(log, (x) => x.t > 900 && !x.on);
    const full = when(log, (x) => x.t > 900 && x.scale === 1);
    expect(full - stop).toBeGreaterThan(100);
    expect(full - stop).toBeLessThan(((NEAR_FULL - 0.7) / RAMP.up) * 1000 + 40);
    // (And it is not called travel for longer than the settle after the picture has stopped moving.)
    expect(stop).toBeLessThan(1200 + SETTLE_MS + 20);
  });
});
