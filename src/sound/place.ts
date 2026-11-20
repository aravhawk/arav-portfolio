/**
 * The place, heard: one step takes where the picture is and tells the
 * graph, and lets the ice speak when its time has come. The page steps it
 * a few times a second; the checks step it through a scripted walk.
 */
import type { Graph } from './graph';
import { gap, steer, targets } from './mapping';
import type { SceneSound } from './scenes';

export class Place {
  private readonly to = targets();
  private next = -1;
  constructor(
    private readonly graph: Graph,
    private readonly rng: () => number,
  ) {}
  /** At context time `t`: scene `a` with `b` brought in by `mix` (see mapping.ts). */
  step(t: number, a: SceneSound, b: SceneSound, mix: number, progress: number, night: boolean, still: boolean) {
    const to = steer(this.to, a, b, mix, progress, night, still);
    this.graph.set(to, t);
    // The first crack waits its turn like any other: turning sound on is never answered with a bang.
    if (this.next < 0) this.next = t + gap(to.rate, this.rng());
    if (t < this.next) return;
    const rng = this.rng;
    this.graph.crack(t + 0.05, rng() < 0.4, rng(), rng(), rng());
    this.next = t + gap(to.rate, rng());
  }
  /** After a silence (a hidden tab, another page): the ice does not answer the return at once. */
  rest() {
    this.next = -1;
  }
}
