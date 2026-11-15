import { Spring, spring, clamp, lerp, type SpringConfig } from '@/lib/motion';

export const SHAPES = ['drop', 'lens', 'merge', 'bars', 'bridge', 'stack', 'switch', 'tensor', 'engine', 'slab', 'orbit', 'split'] as const;
export type ShapeName = (typeof SHAPES)[number];
export type GroundName = 'cloud' | 'signal' | 'ink' | 'cobalt';

type RGB = [number, number, number];
const c = (r: number, g: number, b: number): RGB => [r / 255, g / 255, b / 255];

export const GROUNDS: Record<
  GroundName,
  { bg: RGB; ink: RGB; tintA: RGB; tintB: RGB; glow: number; shadow: number; tone: 'light' | 'dark'; orbs: [RGB, RGB, RGB]; orbA: number }
> = {
  cloud: { bg: c(232, 236, 239), ink: c(10, 12, 15), tintA: c(255, 226, 210), tintB: c(206, 226, 255), glow: 0.0, shadow: 0.2, tone: 'light', orbs: [c(255, 120, 70), c(60, 130, 255), c(255, 255, 255)], orbA: 0.36 },
  signal: { bg: c(255, 75, 20), ink: c(10, 12, 15), tintA: c(255, 244, 232), tintB: c(20, 51, 255), glow: 0.04, shadow: 0.26, tone: 'light', orbs: [c(255, 138, 60), c(214, 44, 0), c(255, 190, 120)], orbA: 0.6 },
  ink: { bg: c(10, 12, 15), ink: c(232, 236, 239), tintA: c(120, 170, 255), tintB: c(255, 150, 96), glow: 0.24, shadow: 0, tone: 'dark', orbs: [c(255, 75, 20), c(20, 51, 255), c(40, 48, 64)], orbA: 0.26 },
  cobalt: { bg: c(20, 51, 255), ink: c(232, 236, 239), tintA: c(255, 75, 20), tintB: c(232, 236, 239), glow: 0.2, shadow: 0.25, tone: 'dark', orbs: [c(80, 120, 255), c(6, 20, 160), c(255, 110, 60)], orbA: 0.5 },
};

export type Placement = { x: number; y: number; size: number };
export type Scene = {
  shape: ShapeName;
  ground: GroundName;
  /** Desktop placement: centre as viewport fractions, size as a fraction of the short side. */
  d: Placement;
  /** Placement below 768px. */
  m: Placement;
  pitch?: number;
  yaw?: number;
  spin?: number;
};

const N = SHAPES.length;

class Stage {
  weights = Array.from({ length: N }, (_, i) => new Spring(i === 0 ? 1 : 0, spring.morph));
  x = new Spring(0.5, spring.move);
  y = new Spring(0.5, spring.move);
  size = new Spring(0.28, spring.move);
  pitch = new Spring(0, spring.move);
  yawBase = new Spring(0, spring.move);
  spin = new Spring(0, spring.move);
  yaw = 0;
  bg = [0, 1, 2].map((i) => new Spring(GROUNDS.cloud.bg[i], spring.track));
  ink = [0, 1, 2].map((i) => new Spring(GROUNDS.cloud.ink[i], spring.move));
  tintA = [0, 1, 2].map((i) => new Spring(GROUNDS.cloud.tintA[i], spring.move));
  tintB = [0, 1, 2].map((i) => new Spring(GROUNDS.cloud.tintB[i], spring.move));
  orbCol = [0, 1, 2].map((o) => [0, 1, 2].map((i) => new Spring(GROUNDS.cloud.orbs[o][i], spring.move)));
  orbA = new Spring(GROUNDS.cloud.orbA, spring.move);
  glow = new Spring(GROUNDS.cloud.glow, spring.move);
  shadow = new Spring(GROUNDS.cloud.shadow, spring.move);
  gather = new Spring(1, spring.settle);
  flip = new Spring(0, spring.throw);
  grow = new Spring(1, spring.move);
  pulse = new Spring(0, { response: 0.6, damping: 0.5 });
  wobble = new Spring(0.35, spring.move);
  vel = new Spring(0, spring.ui);
  ptrX = new Spring(0, spring.ui);
  ptrY = new Spring(0, spring.ui);
  // Drag state: 1:1 while held, inertia after release.
  dragYaw = 0;
  dragPitch = new Spring(0, spring.throw);
  dragVelYaw = 0;
  dragging = false;
  ground: GroundName = 'cloud';
  tone: 'light' | 'dark' = 'light';
  reduced = false;
  dirty = true;
  private preview: ShapeName | null = null;
  private base = new Float32Array(N).fill(0);
  private listeners = new Set<() => void>();
  private first = true;

  constructor() {
    this.base[0] = 1;
  }

  private narrow() {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  }

  private place(a: Scene, b: Scene | null, m: number) {
    const pa = this.narrow() ? a.m : a.d;
    const pb = b ? (this.narrow() ? b.m : b.d) : pa;
    this.x.target = lerp(pa.x, pb.x, m);
    this.y.target = lerp(pa.y, pb.y, m);
    this.size.target = lerp(pa.size, pb.size, m);
    this.pitch.target = lerp(a.pitch ?? 0, b?.pitch ?? a.pitch ?? 0, m);
    this.yawBase.target = lerp(a.yaw ?? 0, b?.yaw ?? a.yaw ?? 0, m);
    this.spin.target = lerp(a.spin ?? 0, b?.spin ?? a.spin ?? 0, m);
  }

  private colours(a: GroundName, b: GroundName, m: number) {
    const ga = GROUNDS[a];
    const gb = GROUNDS[b];
    for (let i = 0; i < 3; i++) {
      this.bg[i].target = lerp(ga.bg[i], gb.bg[i], m);
    }
    const g = m < 0.5 ? ga : gb;
    for (let i = 0; i < 3; i++) {
      this.ink[i].target = g.ink[i];
      this.tintA[i].target = g.tintA[i];
      this.tintB[i].target = g.tintB[i];
      for (let o = 0; o < 3; o++) this.orbCol[o][i].target = g.orbs[o][i];
    }
    this.orbA.target = g.orbA;
    this.glow.target = g.glow;
    this.shadow.target = g.shadow;
    const name = m < 0.5 ? a : b;
    if (name !== this.ground) {
      this.ground = name;
      this.tone = g.tone;
      this.emit();
    }
  }

  private applyWeights(cfg: SpringConfig) {
    const p = this.preview ? SHAPES.indexOf(this.preview) : -1;
    for (let i = 0; i < N; i++) {
      const s = this.weights[i];
      s.config(p >= 0 ? spring.morph : cfg);
      s.target = p >= 0 ? (i === p ? 1 : 0) : this.base[i];
    }
  }

  private settleIfFirst() {
    if (!this.first && !this.reduced) return;
    this.first = false;
    const all = [this.x, this.y, this.size, this.pitch, this.yawBase, this.spin, this.orbA, this.glow, this.shadow, ...this.weights, ...this.bg, ...this.ink, ...this.tintA, ...this.tintB, ...this.orbCol.flat()];
    for (const s of all) s.snap(s.target);
  }

  /** A route or a hover picks one scene. Springs carry it there. */
  setScene(scene: Scene) {
    this.base.fill(0);
    this.base[SHAPES.indexOf(scene.shape)] = 1;
    this.applyWeights(spring.morph);
    for (const s of [this.x, this.y, this.size]) s.config(spring.move);
    for (const s of this.bg) s.config(spring.move);
    this.place(scene, null, 0);
    this.colours(scene.ground, scene.ground, 0);
    this.settleIfFirst();
    this.dirty = true;
  }

  /** Scroll position blends two neighbouring scenes. Tight springs keep it attached to the hand. */
  setBlend(a: Scene, b: Scene, m: number) {
    this.base.fill(0);
    this.base[SHAPES.indexOf(a.shape)] += 1 - m;
    this.base[SHAPES.indexOf(b.shape)] += m;
    this.applyWeights(spring.track);
    for (const s of [this.x, this.y, this.size]) s.config(spring.ui);
    for (const s of this.bg) s.config(spring.track);
    this.place(a, b, m);
    this.colours(a.ground, b.ground, m);
    this.wobble.target = 0.25 + 0.75 * (1 - Math.abs(m * 2 - 1));
    this.settleIfFirst();
    this.dirty = true;
  }

  setPreview(shape: ShapeName | null) {
    this.preview = shape;
    this.applyWeights(spring.morph);
    this.dirty = true;
  }

  setVelocity(v: number) {
    this.vel.target = this.reduced ? 0 : clamp(v, -1, 1);
  }

  setPointer(nx: number, ny: number) {
    if (this.reduced) return;
    this.ptrX.target = nx;
    this.ptrY.target = ny;
  }

  /** Is this viewport point on the drop? */
  hits(px: number, py: number) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const r = this.size.x * Math.min(w, h) * 1.05;
    return Math.hypot(px - this.x.x * w, py - this.y.x * h) < r;
  }

  tap() {
    this.pulse.v += 9;
    if (this.weights[SHAPES.indexOf('switch')].x > 0.5) this.flip.target = this.flip.target > 0.5 ? 0 : 1;
    this.dirty = true;
  }

  beginIntro() {
    this.gather.snap(0);
    this.gather.target = 1;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  step(dt: number) {
    const all = [this.x, this.y, this.size, this.pitch, this.yawBase, this.spin, this.orbA, this.glow, this.shadow, this.gather, this.flip, this.grow, this.pulse, this.wobble, this.vel, this.ptrX, this.ptrY, this.dragPitch];
    let moving = false;
    for (const s of all) {
      s.step(dt);
      if (!s.resting) moving = true;
    }
    for (const group of [this.weights, this.bg, this.ink, this.tintA, this.tintB, ...this.orbCol]) {
      for (const s of group) {
        s.step(dt);
        if (!s.resting) moving = true;
      }
    }
    if (!this.dragging) {
      this.dragYaw += this.dragVelYaw * dt;
      this.dragVelYaw *= Math.exp(-1.8 * dt);
      if (Math.abs(this.dragVelYaw) > 0.01) moving = true;
    }
    if (!this.reduced) this.yaw += this.spin.x * dt;
    // When a scene does not spin, unwind to the nearest full turn so forms face the viewer again.
    if (Math.abs(this.spin.target) < 1e-3) {
      const tau = Math.PI * 2;
      const home = Math.round(this.yaw / tau) * tau;
      this.yaw += (home - this.yaw) * (1 - Math.exp(-5 * dt));
      const dh = Math.round(this.dragYaw / tau) * tau;
      if (!this.dragging && Math.abs(this.dragVelYaw) < 0.3) this.dragYaw += (dh - this.dragYaw) * (1 - Math.exp(-3 * dt));
      if (Math.abs(home - this.yaw) > 1e-3 || Math.abs(dh - this.dragYaw) > 1e-3) moving = true;
    }
    if (moving) this.dirty = true;
    return moving;
  }

  /** Top three weighted forms, normalised. */
  top3() {
    const idx = [0, 1, 2];
    const w = [0, 0, 0];
    const order = this.weights.map((s, i) => [Math.max(s.x, 0), i] as const).sort((a, b) => b[0] - a[0]);
    let sum = 0;
    for (let k = 0; k < 3; k++) {
      idx[k] = order[k][1];
      w[k] = order[k][0];
      sum += w[k];
    }
    if (sum < 1e-4) return { idx, w: [1, 0, 0] };
    return { idx, w: w.map((v) => v / sum) };
  }

  rotation() {
    const yaw = this.yawBase.x + this.yaw + this.dragYaw + this.ptrX.x * 0.28;
    const pitch = this.pitch.x + this.dragPitch.x - this.ptrY.x * 0.2;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    // Column-major mat3 for Rx(pitch) * Ry(yaw).
    return [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy];
  }
}

export const stage = new Stage();
