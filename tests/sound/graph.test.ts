import { describe, expect, it } from 'vitest';

import { position, scenes, flightLength } from '@/scene/flight/scenes';
import { build, CEILING, FADE, GLIDE, TRIM } from '@/sound/graph';
import { LIMIT, random, steer, targets } from '@/sound/mapping';
import { Place } from '@/sound/place';
import { BARE, SOUND } from '@/sound/scenes';
import { FakeContext, type Param } from './context';

const sounds = scenes.map((s) => SOUND[s.id] ?? BARE);

async function made(seed = 3) {
  const ctx = new FakeContext();
  const rng = random(seed);
  const graph = await build(ctx as unknown as BaseAudioContext, rng);
  ctx.seal();
  return { ctx, graph, place: new Place(graph, rng) };
}
const where = (screens: number) => {
  const p = position(screens);
  return [sounds[p.index], sounds[Math.min(p.index + 1, sounds.length - 1)], p.mix, p.progress] as const;
};
const steps = (p: Param) => p.calls.filter((c) => c.how !== 'setTargetAtTime');

describe('the graph', () => {
  it('starts silent, behind a limiter nothing can pass', async () => {
    const { ctx } = await made();
    // Told nothing yet: the last gain before the destination is 0 until the control asks.
    expect(ctx.standing.every((p) => p.calls.length === 0)).toBe(true);
    expect(CEILING * Math.tanh(1 / CEILING)).toBeLessThan(10 ** (-1 / 20));
    // A full scale input would have to be 30 times what the loudest scene makes to get there; the trim leaves that room.
    expect(TRIM * LIMIT.wind[1]).toBeLessThan(1.5);
  });

  it('glides, and only glides, through a walk of the whole page at any speed, day and night', async () => {
    for (const speed of [0.05, 0.4, 3, 11]) {
      const { ctx, place } = await made();
      let told = 0;
      for (let s = 0, i = 0; s <= flightLength; s += speed, i++) {
        ctx.currentTime = i * 0.15;
        place.step(ctx.currentTime, ...where(s), i % 2 === 1 && speed > 5, false);
      }
      for (const p of ctx.standing) {
        expect(steps(p), p.name).toEqual([]);
        for (const c of p.calls) {
          expect(c.tau).toBe(GLIDE);
          told++;
        }
      }
      expect(told).toBeGreaterThan(10);
    }
  });

  it('glides across a jump from the first scene to the last, with and without a whiteout', async () => {
    const { ctx, graph, place } = await made();
    const last = sounds.length - 1;
    place.step(0, sounds[0], sounds[0], 0, 0.5, false, false);
    const before = ctx.standing.reduce((n, p) => n + p.calls.length, 0);
    for (let i = 1; i <= 5; i++) place.step(i * 0.15, sounds[0], sounds[last], i / 5, 0.5, false, false);
    place.step(1, sounds[last], sounds[last], 0, 0, false, false);
    place.step(1.15, sounds[0], sounds[0], 0, 0, false, false);
    graph.set(steer(targets(), sounds[5], sounds[5], 0, 0, true, true), 1.3);
    expect(ctx.standing.reduce((n, p) => n + p.calls.length, 0)).toBeGreaterThan(before + 10);
    for (const p of ctx.standing) expect(steps(p), p.name).toEqual([]);
  });

  it('tells a parameter only when its target has moved', async () => {
    const { ctx, place } = await made();
    for (let i = 0; i < 40; i++) place.step(i * 0.15, sounds[4], sounds[5], 0, 0.5, false, false);
    for (const p of ctx.standing) expect(p.calls.length, p.name).toBeLessThanOrEqual(1);
  });

  it('turns on and off as a glide of one gain, however fast the control is pressed', async () => {
    const { ctx, graph } = await made();
    for (let i = 0; i < 20; i++) graph.power(i % 2 === 0, i * 0.01, i % 2 === 0 ? FADE.up : FADE.down);
    const told = ctx.standing.filter((p) => p.calls.length);
    expect(told.length).toBe(1);
    expect(told[0].name).toBe('gain.gain');
    expect(steps(told[0])).toEqual([]);
    expect(told[0].calls.map((c) => c.value)).toEqual(Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 1 : 0)));
    // Off is quick enough to be done before the context is put to sleep (0.6 s later: under -70 dB).
    expect(Math.exp(-0.6 / FADE.down)).toBeLessThan(10 ** (-70 / 20));
  });

  it('gives every voice of the ice a whole life: up from nothing by a ramp, away to nothing, then stopped', async () => {
    const { ctx, graph } = await made();
    const rng = random(11);
    for (let i = 0; i < 60; i++) {
      const sources = ctx.started.length,
        params = ctx.params.length,
        t = 5 + i * 20;
      graph.crack(t, i % 2 === 0, rng(), rng(), rng());
      const voices = ctx.started.slice(sources);
      expect(voices.length).toBe(i % 2 === 0 ? 2 : 1);
      for (const v of voices) {
        expect(v.at).toBe(t);
        expect(v.stop).toBeGreaterThan(t + 0.3);
        expect(v.stop).toBeLessThan(t + 3);
      }
      const gains = ctx.params.slice(params).filter((p) => p.name === 'gain.gain');
      expect(gains.length).toBe(voices.length);
      for (const [n, g] of gains.entries()) {
        expect(g.standing).toBe(false);
        // Made at 0 (before anything is heard through it), held at 0 until its time, then ramps alone.
        expect(g.calls.map((c) => c.how)).toEqual(['value', 'setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime']);
        expect(g.calls[0].value).toBe(0);
        expect(g.calls[1]).toMatchObject({ value: 0, t });
        expect(g.calls[2].t - t).toBeGreaterThan(0.0039);
        expect(g.calls[2].value).toBeLessThanOrEqual(0.32);
        expect(g.calls[4].value).toBe(0);
        // Its source runs until its gain is back at nothing, and not a second longer.
        expect(voices[n].stop).toBeGreaterThanOrEqual(g.calls[4].t);
        expect(voices[n].stop! - g.calls[4].t).toBeLessThan(0.1);
      }
      // A pitch may be set where a voice begins (it is silent then) and may only ramp after.
      for (const f of ctx.params.slice(params).filter((p) => p.name === 'oscillator.frequency')) {
        expect(f.calls.map((c) => c.how)).toEqual(['setValueAtTime', 'exponentialRampToValueAtTime']);
        expect(f.calls[0].t).toBe(t);
      }
    }
    for (const p of ctx.standing) expect(p.calls, p.name).toEqual([]);
  });
});

describe('the place', () => {
  it('never answers being turned on, or a return, with a crack: the ice waits its turn', async () => {
    for (let seed = 1; seed < 30; seed++) {
      const { ctx, place } = await made(seed);
      const heard = () => ctx.started.length;
      const from = heard();
      let first = -1;
      for (let i = 0; i < 4000 && first < 0; i++) {
        place.step(i * 0.15, sounds[0], sounds[0], 0, 0.5, false, false);
        if (heard() > from) first = i * 0.15;
      }
      expect(first).toBeGreaterThan(6);
      expect(first).toBeLessThan(30);
      place.rest();
      const again = heard();
      for (let i = 0; i < 40; i++) place.step(first + 1 + i * 0.15, sounds[0], sounds[0], 0, 0.5, false, false);
      expect(heard()).toBe(again);
    }
  });
  it('lets the ice speak a few times a minute at the lake and less elsewhere, never twice together', async () => {
    const count = async (index: number, night: boolean) => {
      const { ctx, place } = await made(5);
      const times: number[] = [];
      let seen = ctx.started.length;
      for (let i = 0; i < 12000; i++) {
        place.step(i * 0.15, sounds[index], sounds[index], 0, 0.5, night, false);
        if (ctx.started.length > seen) {
          times.push(i * 0.15);
          seen = ctx.started.length;
        }
      }
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThan(6);
      return times.length / 30;
    };
    const lake = await count(0, false),
      river = await count(3, false),
      dark = await count(0, true);
    expect(lake).toBeGreaterThan(3);
    expect(lake).toBeLessThan(5);
    expect(river).toBeLessThan(lake * 0.7);
    expect(dark).toBeLessThan(lake);
  });
});
