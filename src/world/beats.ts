import type { V3 } from './formations';

/** Where each formation stands in the world. The story travels toward the sunrise (negative z). */
export const SITES: V3[] = [
  [0, 0, 0], // 0 drift (the swarm asleep on the horizon behind the name)
  [0, 0, 0], // 1 name
  [30, 0, -260], // 2 sandbox
  [-20, 0, -520], // 3 one of 74
  [15, 0, -780], // 4 bridge
  [0, 0, -1040], // 5 merge
  [-10, 0, -1340], // 6 market
  [10, 0, -1600], // 7 engine
  [0, 0, -1860], // 8 launch
  [0, 0, 700], // 9 calm (archive and blog)
];

export type Pose = { p: V3; l: V3 };
export type Beat = {
  /** camera on arrival and at the end of the hold, local to the site */
  a: Pose;
  b: Pose;
  /** time of day, 0 night to 1 sunrise */
  tod: number;
  /** lens: bigger is blurrier off the focal plane */
  ap: number;
  /** where the subject sits on screen, as a fraction of the viewport (x right, y up) */
  shift: [number, number];
  /** portrait: extra pull-back multiplier */
  tall: number;
};

export const BEATS: Beat[] = [
  { a: { p: [0, 46, 300], l: [0, 6, -300] }, b: { p: [0, 46, 300], l: [0, 6, -300] }, tod: 0.0, ap: 0.5, shift: [0, 0], tall: 1 },
  { a: { p: [-16, 4.2, 124], l: [0, 12, 0] }, b: { p: [14, 3.4, 106], l: [0, 12, 0] }, tod: 0.06, ap: 1.0, shift: [0, 0.03], tall: 1.12 },
  { a: { p: [-58, 20, 74], l: [0, 14, 0] }, b: { p: [-42, 13, 66], l: [0, 14, 0] }, tod: 0.2, ap: 1.3, shift: [0.25, 0.03], tall: 1.25 },
  { a: { p: [40, 3.6, 110], l: [3, 20, 4] }, b: { p: [22, 2.6, 90], l: [3, 31, 4] }, tod: 0.34, ap: 1.1, shift: [-0.14, 0], tall: 1.15 },
  { a: { p: [10, 9, 104], l: [0, 17, 0] }, b: { p: [-26, 7, 90], l: [0, 17, 0] }, tod: 0.48, ap: 1.2, shift: [0, 0.08], tall: 1.22 },
  { a: { p: [40, 30, 150], l: [0, 6, -70] }, b: { p: [26, 18, 128], l: [0, 7, -110] }, tod: 0.62, ap: 0.7, shift: [0.24, 0.02], tall: 0.8 },
  { a: { p: [-40, 16, 138], l: [10, 17, 0] }, b: { p: [-8, 10, 122], l: [14, 17, 0] }, tod: 0.76, ap: 1.0, shift: [0.03, -0.06], tall: 1.15 },
  { a: { p: [26, 15, 70], l: [0, 20, 0] }, b: { p: [16, 18, 58], l: [0, 20, 0] }, tod: 0.88, ap: 1.4, shift: [-0.22, 0], tall: 1.25 },
  { a: { p: [-34, 7, 96], l: [6, 44, -140] }, b: { p: [-24, 3.2, 86], l: [8, 38, -200] }, tod: 1.0, ap: 0.9, shift: [0.2, 0], tall: 1.1 },
  { a: { p: [0, 26, 150], l: [0, 15, -300] }, b: { p: [0, 26, 150], l: [0, 15, -300] }, tod: 0.5, ap: 0.8, shift: [0, 0.1], tall: 1 },
];

/** Fraction of each scroll segment spent holding on a beat before the flight to the next one. */
export const HOLD = 0.42;
export const LAST = 8;
export const CALM = 9;
