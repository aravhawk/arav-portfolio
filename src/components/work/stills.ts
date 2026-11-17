/**
 * The committed stills of each scene (public/media/scenes): one per theme,
 * wide and upright. They are what a scene band shows before the engine
 * arrives and where it cannot run, and the work index uses them as each
 * project's picture. CSS picks the theme and the shape.
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
