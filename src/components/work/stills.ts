/**
 * The committed stills of each scene (public/media/scenes): one per theme,
 * wide and upright. A scene band shows its still as a picture
 * (still-pictures.tsx), chosen by the system's scheme. These are the same
 * files by name, for the one case that picture cannot know: a reader whose
 * chosen theme differs from the system's. CSS then sets the right one.
 */
export function stillVars(scene: string): React.CSSProperties {
  const at = (shape: string, theme: string) => `url(/media/scenes/${scene}-${shape}-${theme}.webp)`;
  return {
    '--still-wide-light': at('wide', 'light'),
    '--still-wide-dark': at('wide', 'dark'),
    '--still-tall-light': at('tall', 'light'),
    '--still-tall-dark': at('tall', 'dark'),
  } as React.CSSProperties;
}
