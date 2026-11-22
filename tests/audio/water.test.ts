import { describe, expect, it } from 'vitest';
import { WATER } from '@/audio/mapping';
import { PARAMS, VOICES, type WaterVoice, waterKernel, workletSource } from '@/audio/water';

const SR = 48000;
const make = waterKernel();

/** Render `seconds` of the model, a block at a time, as the worklet does. */
function render(k: ReturnType<typeof make>, seconds: number) {
  const n = Math.round((seconds * SR) / 128);
  const L = new Float32Array(n * 128);
  const R = new Float32Array(n * 128);
  const l = new Float32Array(128);
  const r = new Float32Array(128);
  for (let i = 0; i < n; i++) {
    k.render(l, r, 128);
    L.set(l, i * 128);
    R.set(r, i * 128);
  }
  return { L, R };
}
const rms = (x: Float32Array, from = 0) => {
  let s = 0;
  for (let i = from; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / (x.length - from));
};
/** How often the wave crosses zero, a second: how bright it is. */
const crossings = (x: Float32Array) => {
  let n = 0;
  for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 !== x[i] < 0) n++;
  return (n * SR) / x.length;
};
/** The level of each stretch of 10 ms. */
const levels = (x: Float32Array) => {
  const out: number[] = [];
  for (let at = 0; at + 480 <= x.length; at += 480) out.push(rms(x.subarray(at, at + 480)));
  return out;
};
const one = (v: WaterVoice, seconds = 4, seed = 5) => {
  const k = make(SR, 72, seed, VOICES);
  k.set(0, v);
  return render(k, seconds);
};

describe('the water model', () => {
  it('is silent until it is asked for water', () => {
    const { L, R } = render(make(SR, 72, 1, VOICES), 0.5);
    expect(Math.max(...L, ...R)).toBe(0);
  });

  it('a trickle, a stream, a fall and a pool are four different sounds from it', () => {
    const trickle = one(WATER.trickle as WaterVoice);
    const stream = one(WATER.stream as WaterVoice);
    const fall = one(WATER.fall as WaterVoice);
    const pool = one(WATER.pool as WaterVoice, 12);
    const half = SR / 2;
    // Louder from pool to trickle to stream to fall.
    expect(rms(trickle.L, half)).toBeGreaterThan(rms(pool.L, half) * 1.5);
    expect(rms(stream.L, half)).toBeGreaterThan(rms(trickle.L, half) * 2);
    expect(rms(fall.L, half)).toBeGreaterThan(rms(stream.L, half) * 1.3);
    // A trickle is small bubbles only: brighter than a stream; a pool's few are low.
    expect(crossings(trickle.L)).toBeGreaterThan(crossings(stream.L) * 1.3);
    expect(crossings(pool.L)).toBeLessThan(crossings(trickle.L) * 0.5);
    // A pool is mostly silence, with a bubble now and then; a trickle is separate bubbles; a stream and a fall never stop.
    const quiet = (x: Float32Array) => {
      const l = levels(x);
      return l.filter((v) => v < 1e-4).length / l.length;
    };
    expect(quiet(pool.L)).toBeGreaterThan(0.6);
    expect(quiet(stream.L.subarray(half))).toBe(0);
    expect(quiet(fall.L.subarray(half))).toBe(0);
    // A fall is steadier than a trickle: its level moves less from one hundredth of a second to the next.
    const rough = (x: Float32Array) => {
      const l = levels(x.subarray(half));
      const mean = l.reduce((a, b) => a + b, 0) / l.length;
      return Math.sqrt(l.reduce((a, b) => a + (b - mean) * (b - mean), 0) / l.length) / mean;
    };
    expect(rough(trickle.L)).toBeGreaterThan(rough(stream.L) * 1.5);
    expect(rough(stream.L)).toBeGreaterThan(rough(fall.L));
  });

  it('never comes round again: no stretch of its texture matches a later one', () => {
    const { L } = one(WATER.stream as WaterVoice, 24);
    const l = levels(L.subarray(SR)).map((v) => Math.log(v + 1e-9));
    const mean = l.reduce((a, b) => a + b, 0) / l.length;
    const d = l.map((v) => v - mean);
    let worst = 0;
    // Every lag from a third of a second to eleven seconds.
    for (let lag = 33; lag < 1100; lag++) {
      let ab = 0;
      let aa = 0;
      let bb = 0;
      for (let i = 0; i + lag < d.length; i++) {
        ab += d[i] * d[i + lag];
        aa += d[i] * d[i];
        bb += d[i + lag] * d[i + lag];
      }
      worst = Math.max(worst, ab / Math.sqrt(aa * bb));
    }
    expect(worst).toBeLessThan(0.2);
  });

  it('stays inside its bounds and never makes a number that is not one', () => {
    const k = make(SR, 72, 9, VOICES);
    for (let v = 0; v < VOICES; v++) k.set(v, [1, 500, 200, 6000, 1, 1, v / 10 - 1, 1, 1, 100, 6000]);
    const { L, R } = render(k, 2);
    for (const x of [L, R]) {
      for (let i = 0; i < x.length; i += 7) expect(Number.isFinite(x[i])).toBe(true);
    }
    // Twenty voices at full ask for more bubbles than there is room for: the rest are simply not made.
    expect(k.alive()).toBeLessThanOrEqual(72);
    expect(Math.max(...L.subarray(0, 48000).map(Math.abs))).toBeLessThan(40);
  });

  it('a voice sits where it is put, and its bubbles are spread only as far as it says', () => {
    const left = one([1, 200, 400, 5000, 0.7, 1, -0.9, 0.05, 0.2, 250, 3000]);
    expect(rms(left.L)).toBeGreaterThan(rms(left.R) * 3);
    const right = one([1, 200, 400, 5000, 0.7, 1, 0.9, 0.05, 0.2, 250, 3000]);
    expect(rms(right.R)).toBeGreaterThan(rms(right.L) * 3);
    const wide = one([1, 200, 400, 5000, 0.7, 1, 0, 1, 0.2, 250, 3000]);
    expect(rms(wide.L) / rms(wide.R)).toBeGreaterThan(0.7);
    expect(rms(wide.L) / rms(wide.R)).toBeLessThan(1.4);
  });

  it('bigger bubbles are lower and ring longer; a darker voice is darker', () => {
    const small = one([1, 60, 3000, 6000, 0.5, 1, 0, 0.3, 0, 200, 3000]);
    const big = one([1, 60, 300, 600, 0.5, 1, 0, 0.3, 0, 200, 3000]);
    expect(crossings(small.L)).toBeGreaterThan(crossings(big.L) * 4);
    // The same number of bubbles, but each large one sounds for far longer: less of the time is silent.
    const silent = (x: Float32Array) => levels(x).filter((v) => v < 1e-4).length;
    expect(silent(big.L)).toBeLessThan(silent(small.L));
  });

  it('a voice glides in and out: no step when it is turned up or off', () => {
    const k = make(SR, 72, 3, VOICES);
    k.set(0, [1, 0, 400, 4000, 0.6, 1, 0, 0.5, 1, 200, 3000]);
    const up = render(k, 0.4);
    // (Noise only, so the level can be read: it rises over tens of milliseconds, not in one block.)
    expect(rms(up.L.subarray(0, 128))).toBeLessThan(rms(up.L.subarray(9600, 19200)) * 0.25);
    k.set(0, [0, 0, 400, 4000, 0.6, 1, 0, 0.5, 1, 200, 3000]);
    const down = render(k, 0.6);
    expect(rms(down.L.subarray(0, 480))).toBeGreaterThan(0);
    expect(rms(down.L.subarray(24000))).toBe(0);
  });

  it('a clump of bubbles is made when it is asked for, and dies', () => {
    const k = make(SR, 72, 4, VOICES);
    k.burst(12, 300, 1800, 0.8, 0.5, 0.1, 0.1, 0.8);
    expect(k.alive()).toBe(12);
    const { L, R } = render(k, 1.5);
    expect(rms(R.subarray(0, 9600))).toBeGreaterThan(rms(L.subarray(0, 9600)));
    expect(rms(L.subarray(0, 9600))).toBeGreaterThan(0.01);
    expect(k.alive()).toBe(0);
    expect(rms(L.subarray(48000))).toBeLessThan(1e-4);
  });

  it('the same seed is the same water; another seed is other water', () => {
    const a = one(WATER.stream as WaterVoice, 1, 21);
    const b = one(WATER.stream as WaterVoice, 1, 21);
    const c = one(WATER.stream as WaterVoice, 1, 22);
    expect(Array.from(a.L.subarray(0, 4000))).toEqual(Array.from(b.L.subarray(0, 4000)));
    expect(Array.from(a.L.subarray(0, 4000))).not.toEqual(Array.from(c.L.subarray(0, 4000)));
  });

  it('makes live noise for the air: pink on one pair, white on the other, the two sides different', () => {
    const k = make(SR, 8, 2, VOICES);
    const pL = new Float32Array(4800);
    const pR = new Float32Array(4800);
    const wL = new Float32Array(4800);
    const wR = new Float32Array(4800);
    k.noise(pL, pR, wL, wR, 4800);
    expect(rms(wL)).toBeGreaterThan(0.2);
    expect(rms(pL)).toBeGreaterThan(0.02);
    // Pink is duller than white.
    expect(crossings(pL)).toBeLessThan(crossings(wL) * 0.6);
    let same = 0;
    for (let i = 0; i < 4800; i++) if (pL[i] === pR[i]) same++;
    expect(same).toBeLessThan(10);
  });
});

describe('the worklet', () => {
  it('is given code that stands on its own: it registers a processor that takes timed messages and makes water', () => {
    const src = workletSource();
    let Ctor: (new (o: unknown) => { port: { onmessage: (e: { data: unknown }) => void }; process(i: unknown[], o: Float32Array[][]): boolean }) | null = null;
    const sent: unknown[] = [];
    class Base {
      port = { onmessage: (_e: { data: unknown }) => {}, postMessage: (m: unknown) => sent.push(m) };
    }
    const scope = { AudioWorkletProcessor: Base, registerProcessor: (name: string, c: typeof Ctor) => {
      expect(name).toBe('water');
      Ctor = c;
    }, sampleRate: SR, currentTime: 0 };
    // Run it with nothing in reach but what a worklet has.
    new Function('globalThis', 'AudioWorkletProcessor', 'registerProcessor', 'sampleRate', src)(scope, Base, scope.registerProcessor, SR);
    expect(Ctor).not.toBeNull();
    const p = new Ctor!({ processorOptions: { bubbles: 40, seed: 3, voices: VOICES } });
    const out = () => [[new Float32Array(128), new Float32Array(128)], [new Float32Array(128), new Float32Array(128)], [new Float32Array(128), new Float32Array(128)]];
    // A voice asked for half a second from now, sent ahead, and a clump a little later, sent first: both wait for their time.
    p.port.onmessage({ data: [0.6, -1, 10, 300, 1500, 0.8, 0, 0.1, 0.05, 0.8] });
    p.port.onmessage({ data: [0.5, 0, ...WATER.stream] });
    p.port.onmessage({ data: 'sync' });
    expect(sent).toEqual([['sync', 0]]);
    let heardAt = -1;
    for (let i = 0; i < 300; i++) {
      scope.currentTime = (i * 128) / SR;
      const o = out();
      expect(p.process([], o)).toBe(true);
      if (heardAt < 0 && o[0][0].some((v) => v !== 0)) heardAt = scope.currentTime;
      // The air's noise runs from the first block.
      expect(o[1][0].some((v) => v !== 0)).toBe(true);
    }
    expect(heardAt).toBeGreaterThan(0.49);
    expect(heardAt).toBeLessThan(0.52);
    expect(PARAMS).toBe(WATER.stream.length);
  });
});
