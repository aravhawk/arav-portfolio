import { scenes } from './flight/scenes';

/**
 * Every scene as a picture: what a section shows when the canvas does not
 * draw (scripts off, reduced motion, no WebGL2) and until it does. One per
 * scene, light and frame shape: the day and the night, a wide frame and a
 * tall one. The lake's were baked with the scene; the others are the
 * renderer's own first frame of each scene, photographed by
 * tools/site/stills.cjs into public/media/stills/scene.
 */
export interface SceneStills {
  day: string;
  night: string;
  dayTall: string;
  nightTall: string;
}

export const sceneStills = (id: string): SceneStills => {
  const scene = scenes.find((s) => s.id === id)!;
  if (scene.kind === 'lake')
    return {
      day: `${scene.root}still-day.avif`,
      night: `${scene.root}still-night.avif`,
      dayTall: `${scene.root}still-day-phone.avif`,
      nightTall: `${scene.root}still-night-phone.avif`,
    };
  const at = (name: string) => `/media/stills/scene/${id}-${name}.avif`;
  return { day: at('wide-day'), night: at('wide-night'), dayTall: at('tall-day'), nightTall: at('tall-night') };
};
