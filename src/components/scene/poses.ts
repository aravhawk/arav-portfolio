/**
 * Camera and band poses, per chapter. Each chapter lists poses spread evenly over its scroll length.
 * The last pose of a chapter matches the first pose of the next, so the journey is continuous.
 */
export type Pose = {
  cam: [number, number, number];
  look: [number, number, number];
  /** Rotation of the whole loop. */
  rot: [number, number, number];
  roll: number;
  fov: number;
  /** Speed of the engraving running along the band. */
  flow: number;
  /** Distance fade start and end. */
  near: number;
  far: number;
  /** 0..1 visibility of the probe gates. */
  gates: number;
  env: number;
  /** Extra camera distance on portrait screens. */
  portraitBack: number;
  /** Lens shift: moves the whole loop on screen, in fractions of the viewport (x right, y up). */
  shift: [number, number];
  /** Same, for portrait screens. */
  pshift: [number, number];
};

const base = {
  roll: 0,
  fov: 30,
  flow: 0.012,
  near: 40,
  far: 50,
  gates: 0,
  env: 1.15,
  portraitBack: 0,
  shift: [0, 0] as [number, number],
  pshift: [0, 0] as [number, number],
};
const GONE = { near: 0, far: 0.02 };

// Hero: one steel strand cuts across the name, its underside comes back the other way.
const HERO: Pose = { ...base, cam: [2.5, 0.8, 7.5], look: [1.6, 0.2, 0], rot: [0.5, -0.55, 0.32], shift: [-0.13, 0], portraitBack: 4 };
// Leaving the hero: the camera drops toward the band until the engraving is readable.
const MACRO: Pose = { ...base, cam: [3.4, 1.4, 5.6], look: [2.6, 0.9, 0.2], rot: [0.5, -0.3, 0.25], fov: 28, flow: 0.02, shift: [0.2, 0], portraitBack: 1.5 };
// Statement: the loop stands off to the right, the words own the left.
const SHELF: Pose = { ...base, cam: [0, 0, 15], look: [0, 0, 0], rot: [0.2, 1.15, 0.5], fov: 28, flow: 0.016, shift: [0.3, 0.02], pshift: [0.1, 0.3], portraitBack: 6 };
const SHELF_B: Pose = { ...SHELF, rot: [0.5, 1.5, 0.7] };
// Infiniview: the band arcs overhead through a line of probe rings.
const GATES_IN: Pose = { ...base, cam: [6.4, 4.6, 7.6], look: [5.4, 0.2, 0.4], rot: [0, 0, 0], fov: 34, flow: 0.05, gates: 0.15, env: 0.95, pshift: [0, 0.16], portraitBack: 2 };
const GATES: Pose = { ...base, cam: [5.0, 3.4, 5.5], look: [5.6, 0.8, 0.4], rot: [0, 0, 0], fov: 34, flow: 0.08, gates: 1, env: 0.95, pshift: [0, 0.16], portraitBack: 2 };
const GATES_OUT: Pose = { ...GATES, cam: [4.2, 2.6, 5.0], look: [5.4, 1.1, 0.4], rot: [0, 0.12, 0] };
// Rules: the whole loop as a small sculpture, top right, turning one notch per rule.
const EDGE: Pose = { ...base, cam: [0, 0, 32], look: [0, 0, 0], rot: [0.5, 0.3, 0.1], fov: 30, flow: 0.014, env: 1, shift: [0.27, 0.23], pshift: [0, 0.26], portraitBack: 14 };
// Ventures: a long run past the years.
const RUN_A: Pose = { ...base, cam: [-4.6, 0.4, 6.2], look: [-3.4, -0.4, 0], rot: [0.1, 0.5, -0.4], fov: 30, flow: 0.03, shift: [0.1, 0.12], portraitBack: 2 };
const RUN_B: Pose = { ...base, cam: [0, 3.0, 7.5], look: [0, 1.6, 0], rot: [0.2, 0, 0], fov: 30, flow: 0.03, shift: [0, 0.14], portraitBack: 2 };
const RUN_C: Pose = { ...base, cam: [4.2, 2.2, 7.2], look: [3.2, 1.9, 0], rot: [0.25, -0.35, 0.15], fov: 30, flow: 0.03, shift: [0, 0.16], portraitBack: 2 };
// Close: pull all the way out. The thing you were riding is one closed figure eight.
const WHOLE_IN: Pose = { ...base, cam: [0, 0.2, 13], look: [0, -0.4, 0], rot: [0.7, 0.5, 0.15], portraitBack: 10 };
const WHOLE: Pose = { ...base, cam: [0, 0, 25], look: [0, 0, 0], rot: [0.12, 0, 0], shift: [0, 0.12], pshift: [0, 0.1], portraitBack: 20 };
// Inner pages: a quiet strand in the page head.
const HEAD: Pose = { ...base, cam: [0, 3.0, 7.5], look: [0, 1.6, 0], rot: [0.2, 0, 0], fov: 30, flow: 0.014, shift: [0.1, 0.34], pshift: [0.1, 0.3], portraitBack: 3 };
const HEAD_OUT: Pose = { ...HEAD, rot: [0.3, 0.12, 0.04], shift: [0.1, 0.5], pshift: [0.1, 0.46] };

export const CHAPTERS: Record<string, Pose[]> = {
  hero: [HERO, HERO, MACRO],
  statement: [MACRO, SHELF, SHELF_B, GATES_IN],
  now: [GATES_IN, GATES, GATES_OUT, { ...EDGE, gates: 0 }],
  rules: [EDGE, { ...EDGE, rot: [0.6, 1.0, 0.2] }, { ...EDGE, rot: [0.4, 1.75, 0.3] }, { ...EDGE, rot: [0.6, 2.5, 0.2] }, { ...EDGE, rot: [0.6, 2.9, 0.2] }],
  timeline: [RUN_A, RUN_B, RUN_C, RUN_C, { ...RUN_C, ...GONE }],
  work: [{ ...RUN_C, ...GONE }],
  writing: [{ ...WHOLE_IN, ...GONE }, { ...WHOLE_IN, ...GONE }, { ...WHOLE_IN, ...GONE }, { ...WHOLE_IN, ...GONE }, WHOLE_IN],
  contact: [WHOLE_IN, WHOLE, WHOLE],
  head: [HEAD, HEAD_OUT],
  sheet: [HEAD_OUT],
  none: [HEAD_OUT],
};
