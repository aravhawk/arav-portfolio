/**
 * Motion tokens. Documented in docs/redesign-v3/motion-system.md.
 * Springs are specified as response (seconds) and damping ratio.
 */
export type SpringConfig = { response: number; damping: number };

export const spring = {
  ui: { response: 0.3, damping: 1 },
  move: { response: 0.45, damping: 1 },
  morph: { response: 0.55, damping: 1 },
  track: { response: 0.16, damping: 1 },
  throw: { response: 0.5, damping: 0.72 },
  settle: { response: 0.9, damping: 0.8 },
  cursor: { response: 0.22, damping: 0.9 },
} satisfies Record<string, SpringConfig>;

export const ease = {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
  drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const;

export const dur = {
  press: 140,
  fast: 180,
  base: 260,
  pane: 520,
  line: 900,
  route: 420,
  stagger: 60,
} as const;

/** Damped spring that keeps its velocity when retargeted. */
export class Spring {
  x: number;
  v = 0;
  target: number;
  private k = 0;
  private c = 0;

  constructor(x: number, cfg: SpringConfig = spring.ui) {
    this.x = x;
    this.target = x;
    this.config(cfg);
  }

  config(cfg: SpringConfig) {
    const w = (2 * Math.PI) / cfg.response;
    this.k = w * w;
    this.c = 2 * cfg.damping * w;
  }

  snap(x: number) {
    this.x = x;
    this.target = x;
    this.v = 0;
  }

  step(dt: number) {
    // Semi-implicit Euler in substeps of at most 4ms keeps it stable at any frame rate.
    let left = Math.min(dt, 0.064);
    while (left > 0) {
      const h = Math.min(left, 0.004);
      const a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
      left -= h;
    }
    return this.x;
  }

  get resting() {
    return Math.abs(this.x - this.target) < 1e-4 && Math.abs(this.v) < 1e-3;
  }
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
