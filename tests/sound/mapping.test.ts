import { describe, expect, it } from 'vitest';

import { scenes } from '@/scene/flight/scenes';
import { gap, LIMIT, random, steer, targets, veil, type Targets } from '@/sound/mapping';
import { BARE, SOUND } from '@/sound/scenes';

const sounds = scenes.map((s) => SOUND[s.id] ?? BARE);
const KEYS = Object.keys(LIMIT) as (keyof Targets)[];
const STEPS = Array.from({ length: 41 }, (_, i) => i / 40);
const at = (...args: Parameters<typeof steer> extends [Targets, ...infer R] ? R : never) => ({ ...steer(targets(), ...args) });

describe('from the picture to the graph', () => {
  it('stays inside its limits for every scene, every pair of scenes and every step of a whiteout', () => {
    for (const a of sounds)
      for (const b of sounds)
        for (const mix of STEPS)
          for (const progress of [0, 0.5, 1])
            for (const night of [false, true])
              for (const still of [false, true]) {
                const to = at(a, b, mix, progress, night, still);
                for (const k of KEYS) {
                  expect(Number.isFinite(to[k]), k).toBe(true);
                  expect(to[k], k).toBeGreaterThanOrEqual(LIMIT[k][0]);
                  expect(to[k], k).toBeLessThanOrEqual(LIMIT[k][1]);
                }
              }
  });
  it('is never held at a limit by a scene at rest (the limits are a guard, not the level)', () => {
    for (const a of sounds) {
      const to = at(a, a, 0, 1, false, false);
      for (const k of ['wind', 'tone', 'rate'] as const) {
        expect(to[k], k).toBeGreaterThan(LIMIT[k][0]);
        expect(to[k], k).toBeLessThan(LIMIT[k][1]);
      }
    }
  });
  it('survives a position outside the page', () => {
    for (const mix of [-3, 4, NaN, Infinity]) for (const k of KEYS) expect(Number.isFinite(at(sounds[0], sounds[1], mix, NaN, false, false)[k]), k).toBe(true);
    expect(at(sounds[0], sounds[1], NaN, NaN, false, false)).toEqual(at(sounds[0], sounds[1], 0, 0, false, false));
    expect(at(sounds[0], sounds[1], -3, 9, false, false)).toEqual(at(sounds[0], sounds[1], 0, 1, false, false));
  });
  it('writes into what it is given and makes nothing new', () => {
    const out = targets();
    expect(steer(out, sounds[0], sounds[1], 0.3, 0.2, false, false)).toBe(out);
  });
  it('is one scene alone at either end of a whiteout, and hands over without a jump', () => {
    for (let i = 0; i + 1 < sounds.length; i++) {
      // At 0 the next scene does not matter; at 1 it is the next scene as it will be when the picture names it.
      expect(at(sounds[i], sounds[i + 1], 0, 0.7, false, false)).toEqual(at(sounds[i], sounds[0], 0, 0.7, false, false));
      const end = at(sounds[i], sounds[i + 1], 1, 1, false, false);
      const next = at(sounds[i + 1], sounds[i + 1], 0, 0, false, false);
      for (const k of KEYS) expect(end[k], k).toBeCloseTo(next[k], 6);
    }
  });
  it('moves by small amounts between neighbouring steps of a whiteout', () => {
    for (let i = 0; i + 1 < sounds.length; i++)
      for (let s = 1; s < STEPS.length; s++) {
        const a = at(sounds[i], sounds[i + 1], STEPS[s - 1], 1, false, false);
        const b = at(sounds[i], sounds[i + 1], STEPS[s], 1, false, false);
        for (const k of KEYS) expect(Math.abs(b[k] - a[k]) / (LIMIT[k][1] - LIMIT[k][0]), k).toBeLessThan(0.08);
      }
  });
  it('has the whiteout close over everything: the wind up, the water and the ice down, and back', () => {
    expect(veil(0)).toBe(0);
    expect(veil(1)).toBe(0);
    expect(veil(0.5)).toBe(1);
    for (const m of STEPS) expect(veil(m)).toBeCloseTo(veil(1 - m), 12);
    for (let i = 0; i + 1 < sounds.length; i++) {
      const a = sounds[i],
        b = sounds[i + 1];
      const before = at(a, b, 0, 1, false, false),
        mid = at(a, b, 0.5, 1, false, false),
        after = at(a, b, 1, 1, false, false);
      expect(mid.wind).toBeGreaterThan(Math.max(before.wind, after.wind));
      expect(mid.drift).toBeGreaterThan(Math.max(before.drift, after.drift));
      expect(mid.tone).toBeGreaterThan(Math.max(before.tone, after.tone));
      for (const k of ['run', 'fall', 'lap'] as const) expect(mid[k]).toBeLessThanOrEqual(0.1 * Math.max(before[k], after[k]) + 1e-9);
      expect(mid.ice).toBeLessThan(0.2);
    }
  });
  it('does not swell with reduced motion: one scene gives way to the next', () => {
    for (let i = 0; i + 1 < sounds.length; i++)
      for (const mix of STEPS) {
        const to = at(sounds[i], sounds[i + 1], mix, 1, false, true);
        const ends = [at(sounds[i], sounds[i], 0, 1, false, true), at(sounds[i + 1], sounds[i + 1], 0, 0, false, true)];
        for (const k of ['wind', 'drift', 'tone'] as const) {
          expect(to[k]).toBeLessThanOrEqual(Math.max(ends[0][k], ends[1][k]) + 1e-9);
          expect(to[k]).toBeGreaterThanOrEqual(Math.min(ends[0][k], ends[1][k]) - 1e-9);
        }
        expect(to.ice).toBe(1);
      }
  });
  it('is lower and stiller before dawn, everywhere', () => {
    for (const a of sounds)
      for (const mix of [0, 0.5]) {
        const day = at(a, a, mix, 0.5, false, false),
          night = at(a, a, mix, 0.5, true, false);
        for (const k of KEYS) expect(night[k], k).toBeLessThanOrEqual(day[k]);
        expect(night.wind).toBeLessThan(day.wind);
        expect(night.rate).toBeLessThan(day.rate);
      }
  });
  it('brings the water a little nearer as the camera goes in', () => {
    const far = at(SOUND.interests, SOUND.interests, 0, 0, false, false),
      near = at(SOUND.interests, SOUND.interests, 0, 1, false, false);
    expect(near.run).toBeGreaterThan(far.run);
    expect(near.run / far.run).toBeLessThan(1.3);
    expect(near.wind).toBe(far.wind);
  });
  it('lets the ice speak rarely: many seconds apart at its busiest, never on a beat', () => {
    const rng = random(7);
    for (let i = 0; i < 2000; i++) {
      const u = rng();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      expect(gap(LIMIT.rate[1], u)).toBeGreaterThan(6);
      expect(gap(LIMIT.rate[0], u)).toBeLessThan(125);
    }
    expect(gap(3, 0.9)).toBeGreaterThan(gap(3, 0.1) * 2);
    // More of it at the lake and at the grid of blocks than anywhere else.
    const rate = (id: string) => at(SOUND[id], SOUND[id], 0, 0, false, false).rate;
    for (const s of scenes) if (s.id !== 'lake' && s.id !== 'tensorpow') expect(rate(s.id)).toBeLessThan(rate('tensorpow'));
    expect(rate('lake')).toBeGreaterThanOrEqual(rate('tensorpow'));
  });
  it('is the same walk from the same seed', () => {
    const a = random(20261119),
      b = random(20261119),
      c = random(1);
    const run = (r: () => number) => Array.from({ length: 8 }, r);
    const first = run(a);
    expect(run(b)).toEqual(first);
    expect(run(c)).not.toEqual(first);
  });
});
