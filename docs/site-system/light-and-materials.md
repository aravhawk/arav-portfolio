# Light and materials

Status: the hours are **as built** (first pass) and being finished;
the one shared ice is **planned** (the one-ice task). Solid UI
surfaces are as built.

## Light

- The light theme is **one day**, first light to sunset; the dark
  theme is **one night that ends at sunrise**. Every station has its
  own hour: sun or moon height and bearing, the colour of light and
  of shade, its air. `src/water/sky.ts` holds the hours as keys along
  scroll; the light moves continuously, never in a step.
- A new station takes its hour from its place on the timeline. Do not
  give a station a private light.
- Snow is never one white: lit snow and shaded snow are two colours
  at every hour. Water takes its colour from the sky it mirrors and
  its depth.
- The night is moonlight: nearly colourless, one low key, deep
  neutral shadows. No colour wash. The aurora appears twice only (the
  first screen, faint; Kilo Bench, full).
- Air: distance is told by haze that takes the sky's colour and
  brightens toward the sun. Tone: one filmic curve; no clipped white.
  Grain: fine, luminance only. **No blur of any kind** (no bloom, no
  depth of field).
- No emissive outline or glow where water meets ice or snow.

## The ice (planned: one function for every object)

Lake Baikal's ice: a clear body that glows blue-green where light
passes through it and is dark where it does not; a few white fracture
planes and veils of bubbles inside; sawn faces with fine saw marks,
broken faces with chipped glinting edges, never a rounded bevel;
Fresnel; wet and darker where water touches it; one true image in
still water. Every ice object on the page calls the same material.

## Objects

One strong subject a frame. Real silhouettes with thickness, lit by
the hour's key and a rim, standing in the valley's air, with a
contact shadow or a true reflection. Text that a project owns
(a screen, a table) is drawn sharp at the size it is shown, squarely
enough to the eye to be read, whole inside the frame at every width.

## The DOM's surfaces

- No glass: no `backdrop-filter`, no translucent panels or cards.
  Controls that stand over the picture are **plates**
  (`.plate` in `src/app/globals.css`): solid, a hairline edge, a
  close shadow, corners at `--r-2`.
- Words stand on the picture's own calm ground (a lee the scene
  keeps under every block), never on a card.
- Inner pages stand on quiet snow (`.pg-ground` in
  `src/app/pages.css`): soft large forms, no grain, no band behind a
  heading.

Change log: 2026-11-18 first version (orchestrator).
