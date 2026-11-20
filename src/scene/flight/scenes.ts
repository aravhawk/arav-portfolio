import lakeAssets from './lake-assets.json';
import ridgeAssets from './ridge-assets.json';

export type Gate = 'wide' | 'tall';
export type Theme = 'day' | 'night';
type Camera = { focus: [number, number]; push: number; aspect: number };
type Definition = {
  id: string;
  screens: number;
  /** Screens of spindrift into the following scene. */
  exit: number;
  assets: Record<string, number>;
  root: string;
  words: 'lower-left';
};
type Lake = Definition & { kind: 'lake'; cameras: 'mesh.json'; themes: readonly Theme[] };
export type Plate = Definition & {
  kind: 'plate';
  project: string;
  cameras: Record<Gate, Camera>;
  fields: Record<Gate, Record<Theme, readonly [string, string]>>;
};

export const scenes: readonly (Lake | Plate)[] = [
  {
    id: 'lake',
    kind: 'lake',
    root: '/scene/lake/',
    assets: lakeAssets,
    cameras: 'mesh.json',
    themes: ['day', 'night'],
    words: 'lower-left',
    screens: 2,
    exit: 0.6,
  },
  {
    id: 'infiniview',
    kind: 'plate',
    project: 'infiniview',
    root: '/scene/ridge/',
    assets: ridgeAssets,
    words: 'lower-left',
    screens: 2,
    exit: 0.6,
    cameras: {
      wide: { focus: [0.65, 0.54], push: 0.22, aspect: 1.6 },
      tall: { focus: [0.51, 0.43], push: 0.17, aspect: 390 / 844 },
    },
    fields: {
      wide: {
        day: ['wide-day.avif', 'wide-day-survey.webp'],
        night: ['wide-night.avif', 'wide-night-survey.webp'],
      },
      tall: {
        day: ['tall-day.avif', 'tall-day-survey.webp'],
        night: ['tall-night.avif', 'tall-night-survey.webp'],
      },
    },
  },
];
export const starts: number[] = [];
let length = 0;
for (const [index, scene] of scenes.entries()) {
  starts.push(length);
  length += scene.screens + (index + 1 < scenes.length ? scene.exit : 0);
}
export const flightLength = length;
export function position(screens: number) {
  let index = 0;
  while (index + 1 < starts.length && screens >= starts[index + 1]) index++;
  const scene = scenes[index];
  const local = Math.max(0, screens - starts[index]);
  return {
    index,
    progress: Math.min(1, local / scene.screens),
    mix: index + 1 < scenes.length ? Math.min(1, Math.max(0, (local - scene.screens) / scene.exit)) : 0,
  };
}
