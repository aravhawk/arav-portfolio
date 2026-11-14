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
  /** Camera roll on portrait screens. */
  proll: number;
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
  proll: 0,
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

// Hero: the name stays whole. The band curls up out of the empty lower left and only touches the first A.
const HERO: Pose = { ...base, cam: [6.9, 0.2, 6.6], look: [6.3, 0.2, 0.2], rot: [0, 0, 0], roll: 0.9, shift: [-0.3, -0.19], pshift: [0.05, -0.2], portraitBack: 4 };
// Statement: the loop stands off to the upper right, the words own the lower left.
const SHELF: Pose = { ...base, cam: [0, 0, 24], look: [0, 0, 0], rot: [1.0, 0.3, 0.5], fov: 28, flow: 0.016, shift: [0.3, 0.22], pshift: [0.06, 0.3], portraitBack: 16 };
const SHELF_B: Pose = { ...SHELF, rot: [1.1, 0.75, 0.6] };
// Infiniview: the top of one lobe, side on, running through three probe rings.
const GATES_IN: Pose = { ...base, cam: [6.9, 3.1, 6.8], look: [4.6, 2.5, 1.6], rot: [0, 0, 0], roll: 1.8, fov: 30, flow: 0.05, gates: 0.2, env: 0.95, shift: [0.22, 0.15], pshift: [0.02, 0.36], portraitBack: 9 };
const GATES: Pose = { ...base, cam: [6.6, 3.0, 6.4], look: [4.6, 2.5, 1.6], rot: [0, 0, 0], roll: 1.8, fov: 30, flow: 0.08, gates: 1, env: 0.95, shift: [0.22, 0.15], pshift: [0.02, 0.36], portraitBack: 9 };
const GATES_OUT: Pose = { ...GATES, cam: [6.2, 2.9, 6.2] };
// Rules: the whole loop as a sculpture, upper right, turning one notch per rule.
const EDGE: Pose = { ...base, cam: [0, 0, 27], look: [0, 0, 0], rot: [0.5, 0.3, 0.1], fov: 30, flow: 0.014, env: 1, shift: [0.25, 0.24], pshift: [0, 0.27], portraitBack: 16 };
// Ventures: an arch of band overhead while the years run underneath.
const ARCH_A: Pose = { ...base, cam: [3.6, 2.8, 6.2], look: [3.6, 2.5, 0], rot: [0, 0, 0], fov: 30, flow: 0.03, shift: [0, 0.31], pshift: [0, 0.43], portraitBack: 4 };
const ARCH_B: Pose = { ...base, cam: [4.6, 3.0, 5.6], look: [4.6, 2.6, 0], rot: [0, 0, 0], fov: 30, flow: 0.03, shift: [0, 0.33], pshift: [0, 0.43], portraitBack: 4 };
const ARCH_C: Pose = { ...base, cam: [5.4, 3.0, 6.0], look: [5.2, 2.4, 0], rot: [0, 0, 0.1], fov: 30, flow: 0.03, shift: [0, 0.31], pshift: [0, 0.43], portraitBack: 4 };
// Work and writing: the arch crosses the section title, then the list sheet rises over it.
const TITLE: Pose = { ...base, cam: [4.4, 2.9, 7.4], look: [4.4, 2.6, 0], rot: [0, 0, 0], fov: 30, flow: 0.02, shift: [0.16, 0.2], pshift: [0.1, 0.43], portraitBack: 4 };
// Close: pull all the way out. The thing you were riding is one closed figure eight.
const WHOLE_IN: Pose = { ...base, cam: [0, 0.2, 13], look: [0, -0.4, 0], rot: [0.7, 0.5, 0.15], portraitBack: 10 };
const WHOLE: Pose = { ...base, cam: [0, 0, 29], look: [0, 0, 0], rot: [0.12, 0, 0], shift: [0, 0.09], pshift: [0, 0.12], portraitBack: 22 };
// Inner pages: one pose each, so no two heads look alike.
const HEAD_WORK: Pose = { ...base, cam: [0, 3.0, 7.5], look: [0, 1.6, 0], rot: [0.2, 0, 0], fov: 30, flow: 0.014, shift: [0.1, 0.34], pshift: [0.14, 0.42], portraitBack: 9 };
const HEAD_BLOG: Pose = { ...base, cam: [6.9, 0.2, 7.2], look: [6.3, 0.2, 0.2], rot: [0, 0, 0], flow: 0.014, shift: [0.36, 0], pshift: [0.3, 0.3], portraitBack: 5 };
const HEAD_LOST: Pose = { ...base, cam: [0, 0, 19], look: [0, 0, 0], rot: [1.0, 0.3, 0.5], fov: 28, flow: 0.014, shift: [0.24, 0.2], pshift: [0.06, 0.26], portraitBack: 14 };
const up = (p: Pose): Pose => ({ ...p, shift: [p.shift[0], p.shift[1] + 0.18], pshift: [p.pshift[0], p.pshift[1] + 0.18] });

export const CHAPTERS: Record<string, Pose[]> = {
  hero: [HERO, HERO, SHELF, SHELF, SHELF],
  statement: [SHELF, SHELF, SHELF_B, SHELF_B, SHELF_B],
  now: [GATES_IN, GATES, GATES, GATES, GATES_OUT, GATES_OUT],
  rules: [EDGE, { ...EDGE, rot: [0.6, 1.0, 0.2] }, { ...EDGE, rot: [0.4, 1.75, 0.3] }, { ...EDGE, rot: [0.6, 2.5, 0.2] }, { ...EDGE, rot: [0.6, 2.9, 0.2] }],
  timeline: [ARCH_A, ARCH_B, ARCH_C, ARCH_C],
  work: [TITLE, TITLE, { ...TITLE, ...GONE }, { ...TITLE, ...GONE }, { ...TITLE, ...GONE }, { ...TITLE, ...GONE }],
  writing: [TITLE, TITLE, { ...TITLE, ...GONE }, { ...WHOLE_IN, ...GONE }, WHOLE_IN],
  contact: [WHOLE_IN, WHOLE, WHOLE],
  'head-work': [HEAD_WORK, up(HEAD_WORK)],
  'head-blog': [HEAD_BLOG, up(HEAD_BLOG)],
  'head-lost': [HEAD_LOST, HEAD_LOST],
  sheet: [up(HEAD_WORK)],
  none: [up(HEAD_WORK)],
};

// Tall screens get their own framing where the wide one would hide the name.
const HERO_TALL: Pose = { ...base, cam: [2.5, 0.8, 7.5], look: [1.6, 0.2, 0], rot: [0.5, -0.55, 0.32], pshift: [0.05, -0.2], portraitBack: 5 };

export const CHAPTERS_TALL: Record<string, Pose[]> = {
  hero: [HERO_TALL, HERO_TALL, SHELF, SHELF, SHELF],
};
