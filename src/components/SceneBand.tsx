import { stillVars } from '@/components/work/stills';
import type { SceneId } from '@/water/scene-band';

interface Props {
  scene: SceneId;
  /** A shorter band: a post's head. */
  short?: boolean;
  /** A band that is the whole first screen: a page with nothing under it. */
  full?: boolean;
  /** An index page: a little lower, so the first row of the list stands in the first screen. */
  index?: boolean;
  /** The scene's still as a picture (BandStill): the band's picture. `null`: the still is the band's ground, set from CSS (the 404). */
  still: React.ReactNode;
  /** The page's label, title and line: they stand in the scene's calm corner. */
  children: React.ReactNode;
}

/**
 * The head of an inner page: a frame of the home page's world with the
 * page's words standing in it. The frame is a still of that scene (one per
 * theme, and one for an upright screen), a picture in the HTML.
 *
 * (It used to give way to the live engine after the first paint. No page a
 * visitor opens loads the engine now: the band is its still, as it always
 * was before the engine arrived. The engine's own band, src/water/scene-band.ts,
 * is kept for making these stills again.)
 */
export function SceneBand({ scene, short, full, index, still, children }: Props) {
  return (
    <header className={`band${short ? ' band-short' : ''}${full ? ' band-full' : ''}${index ? ' band-index' : ''}${still ? '' : ' band-ground'}`} data-scene-id={scene}>
      <div className="band-view" data-fill aria-hidden="true" style={stillVars(scene)}>
        {still}
      </div>
      <div className="band-words wrap" data-band-words>
        {children}
      </div>
    </header>
  );
}
