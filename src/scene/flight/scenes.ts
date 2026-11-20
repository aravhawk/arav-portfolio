import endingAssets from './ending-assets.json';
import interestsAssets from './interests-assets.json';
import rydarAssets from './rydar-assets.json';
import tensorpowAssets from './tensorpow-assets.json';
import ccswitchAssets from './cc-switch-assets.json';
import ollamaAssets from './ollama-assets.json';
import agentbridgeAssets from './agent-bridge-assets.json';
import kilobenchAssets from './kilo-bench-assets.json';
import opensourceAssets from './open-source-assets.json';
import statementAssets from './statement-assets.json';
import lakeAssets from './lake-assets.json';
import ridgeAssets from './ridge-assets.json';
import projections from './ridge-projections.json';

export type Gate = 'wide' | 'tall';
export type Theme = 'day' | 'night';
type Projection = typeof projections.wide;
type Camera = {
  focus: number[];
  /** Metres for surveyed planes, fractional travel for a single depth field. */
  push: number;
  aspect: number;
} & (
  | { projection?: undefined }
  | { projection: Projection; aimPerMetre: [number, number]; sidestep: number }
);
type Definition = {
  id: string;
  screens: number;
  /** Screens of spindrift into the following scene. */
  exit: number;
  assets: Record<string, number>;
  root: string;
  words: 'lower-left' | 'lower-right';
};
type Lake = Definition & { kind: 'lake'; cameras: 'mesh.json'; themes: readonly Theme[] };
export type Plate = Definition & {
  kind: 'plate';
  project: string;
  layerFields?: { wind: string; silhouettes: Record<Gate, string> };
  cameras: Record<Gate, Camera>;
  fields: Record<Gate, Record<Theme, readonly [string, string]>>;
};

function riverPlate(id: string, assets: Record<string, number>, words: Definition['words'] = 'lower-left'): Plate {
  const fields = (gate: Gate, theme: Theme) =>
    [`${gate}-${theme}.avif`, `${gate}-${theme}-survey.webp`] as const;
  return {
    id, project: id, kind: 'plate', root: `/scene/${id}/`, assets,
    words, screens: 2, exit: 0.6,
    cameras: {
      wide: { focus: [0.59, 0.38], push: 0.19, aspect: 1.6 },
      tall: { focus: [0.54, 0.4], push: 0.13, aspect: 390 / 844 },
    },
    fields: {
      wide: { day: fields('wide', 'day'), night: fields('wide', 'night') },
      tall: { day: fields('tall', 'day'), night: fields('tall', 'night') },
    },
  };
}

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
  riverPlate('statement', statementAssets),
  {
    id: 'infiniview',
    kind: 'plate',
    project: 'infiniview',
    layerFields: {
      wind: 'wind.webp',
      silhouettes: { wide: 'wide-silhouettes.webp', tall: 'tall-silhouettes.webp' },
    },
    root: '/scene/ridge/',
    assets: ridgeAssets,
    words: 'lower-left',
    screens: 2,
    exit: 0.6,
    cameras: {
      wide: {
        projection: projections.wide,
        focus: projections.wide.focus,
        aimPerMetre: [-0.0017, 0.0048],
        sidestep: -0.014,
        push: 19.2,
        aspect: 1.6,
      },
      tall: {
        projection: projections.tall,
        focus: projections.tall.focus,
        aimPerMetre: [-0.001, 0.0018],
        sidestep: -0.025,
        push: 12.9,
        aspect: 390 / 844,
      },
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
  riverPlate('open-source', opensourceAssets),
  // The river runs out under the lower left here: the calm ground is on the right.
  riverPlate('kilo-bench', kilobenchAssets, 'lower-right'),
  riverPlate('agent-bridge', agentbridgeAssets),
  riverPlate('ollama', ollamaAssets),
  riverPlate('cc-switch', ccswitchAssets),
  riverPlate('tensorpow', tensorpowAssets),
  riverPlate('rydar', rydarAssets),
  riverPlate('interests', interestsAssets),
  riverPlate('ending', endingAssets),
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
  // Compare on the flight timeline so the exact closing pose stays a single draw.
  const end = starts[index] + scene.screens;
  return {
    index,
    progress: Math.min(1, local / scene.screens),
    mix: index + 1 < scenes.length ? Math.min(1, Math.max(0, (screens - end) / scene.exit)) : 0,
  };
}
