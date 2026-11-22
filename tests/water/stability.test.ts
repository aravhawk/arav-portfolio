import { describe, expect, it } from 'vitest';
import { WAVE_C2, WAVE_NU } from '@/water/shaders/sim';

/**
 * The surface is an explicit wave equation on a grid. Past its stability
 * limit the fastest mode (a checkerboard) grows without bound, which is what
 * a careless tweak to either constant produces. These tests run the same
 * update the shader runs, on the CPU, and hold the margin.
 */

function step(h: Float64Array, v: Float64Array, n: number, c2: number, nu: number) {
  const hn = new Float64Array(h.length);
  const vn = new Float64Array(v.length);
  const at = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const lap = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) - 4 * h[i];
      let vel = v[i] + c2 * lap;
      vel *= Math.exp(-(1 / 120) * 0.9);
      let height = h[i] + vel;
      height += nu * lap;
      height *= Math.exp(-(1 / 120) * 0.35);
      hn[i] = height;
      vn[i] = vel;
    }
  }
  h.set(hn);
  v.set(vn);
}

const energy = (h: Float64Array) => h.reduce((a, b) => a + b * b, 0);

describe('wave solver stability', () => {
  it('keeps the analytic margin for the fastest grid mode', () => {
    expect(8 * (WAVE_C2 + WAVE_NU)).toBeLessThan(3.6);
  });

  it('damps a checkerboard instead of amplifying it', () => {
    const n = 32;
    const h = new Float64Array(n * n);
    const v = new Float64Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = (x + y) % 2 ? 0.1 : -0.1;
    const before = energy(h);
    for (let i = 0; i < 600; i++) step(h, v, n, WAVE_C2, WAVE_NU);
    expect(energy(h)).toBeLessThan(before * 0.01);
  });

  it('stays bounded under a single sharp impulse', () => {
    const n = 48;
    const h = new Float64Array(n * n);
    const v = new Float64Array(n * n);
    h[(n / 2) * n + n / 2] = 1;
    let peak = 0;
    for (let i = 0; i < 1200; i++) {
      step(h, v, n, WAVE_C2, WAVE_NU);
      for (const x of h) peak = Math.max(peak, Math.abs(x));
    }
    expect(peak).toBeLessThan(1.5);
    expect(Number.isFinite(energy(h))).toBe(true);
  });

  it('shows why the limit matters: past it the same checkerboard explodes', () => {
    const n = 16;
    const h = new Float64Array(n * n);
    const v = new Float64Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = (x + y) % 2 ? 0.01 : -0.01;
    for (let i = 0; i < 200; i++) step(h, v, n, 0.52, 0.07);
    expect(energy(h)).toBeGreaterThan(1e6);
  });
});
