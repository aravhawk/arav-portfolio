import { describe, expect, it } from 'vitest';
import type { Graph } from '@/audio/graph';
import { Sound } from '@/audio/sound';

/** A stand-in for the mix's on/off gain: it keeps what it is told and can say its value at any time, as the audio thread would. */
function fakeParam() {
  let events: { t: number; v: number; ramp: boolean }[] = [];
  return {
    cancelScheduledValues(t: number) {
      events = events.filter((e) => e.t < t);
    },
    setValueAtTime(v: number, t: number) {
      events.push({ t, v, ramp: false });
    },
    linearRampToValueAtTime(v: number, t: number) {
      events.push({ t, v, ramp: true });
    },
    at(t: number): number {
      let last = { t: -1, v: 0, ramp: false };
      for (const e of events) {
        if (e.t <= t) last = e;
        else return e.ramp ? last.v + ((e.v - last.v) * (t - last.t)) / (e.t - last.t) : last.v;
      }
      return last.v;
    },
  };
}

const make = () => {
  const on = fakeParam();
  return { on, sound: new Sound({ on } as unknown as Graph) };
};

describe('the mix is turned on and off without a step', () => {
  it('starts from silence, at rest, and is exactly full when its time is up', () => {
    const { on, sound } = make();
    sound.setOn(true, 2, 1.5);
    expect(on.at(2)).toBe(0);
    expect(on.at(2.01)).toBeLessThan(0.003);
    expect(on.at(2.75)).toBeCloseTo(0.5, 2);
    expect(on.at(3.5)).toBe(1);
    expect(on.at(9)).toBe(1);
    for (let t = 2; t < 3.5; t += 0.01) expect(on.at(t + 0.01)).toBeGreaterThanOrEqual(on.at(t));
    expect(sound.rising).toBe(true);
  });

  it('a mute reaches true silence in its 200 ms', () => {
    const { on, sound } = make();
    sound.setOn(true, 0, 1.5);
    sound.setOn(false, 5, 0.2);
    expect(on.at(5)).toBe(1);
    expect(on.at(5.2)).toBe(0);
    expect(on.at(8)).toBe(0);
    expect(sound.powerAt(5.2)).toBe(0);
    expect(sound.rising).toBe(false);
  });

  it('what the conductor believes is what the audio thread is doing, at every moment', () => {
    const { on, sound } = make();
    sound.setOn(true, 1, 1.5);
    for (let t = 0; t < 3; t += 0.013) expect(sound.powerAt(t)).toBeCloseTo(on.at(t), 9);
  });

  it('turned round part way, a fade carries on from where it stood: nothing jumps', () => {
    const { on, sound } = make();
    // The turns, in time: on, muted while still coming up, on again, muted again a moment later, on.
    const turns: [number, boolean, number][] = [
      [0, true, 1.5],
      [0.6, false, 0.2],
      [0.7, true, 0.4],
      [0.85, false, 0.2],
      [2, true, 0.4],
    ];
    // The level is read as the audio thread makes it: forward in time, each turn asked for at its own moment.
    let next = 0;
    let was = 0;
    const dt = 0.0001;
    for (let i = 0; i <= 30000; i++) {
      const t = i * dt;
      while (next < turns.length && turns[next][0] <= t + 1e-9) {
        sound.setOn(turns[next][1], turns[next][0], turns[next][2]);
        next++;
      }
      const v = on.at(t);
      // (Over a tenth of a millisecond the level moves by no more than the steepest fade could move it.)
      expect(Math.abs(v - was), `at ${t.toFixed(4)} s`).toBeLessThan(0.002);
      was = v;
    }
    expect(on.at(1.05)).toBe(0);
    expect(on.at(2.4)).toBe(1);
  });
});
