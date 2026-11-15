import { GROUNDS, type GroundName } from '@/stage/stage';

/** Sets the ground before first paint on a direct load, so there is no flash of the default colour. */
export default function GroundInit({ ground }: { ground: GroundName }) {
  const tone = GROUNDS[ground].tone;
  return <script dangerouslySetInnerHTML={{ __html: `document.documentElement.dataset.ground=${JSON.stringify(ground)};document.documentElement.dataset.tone=${JSON.stringify(tone)};` }} />;
}
