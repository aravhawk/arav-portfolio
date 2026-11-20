# Motion

Two kinds of motion live on this site and they follow different
rules: the picture's (the scene, driven by scroll and the pointer)
and the interface's (words, controls, layers, route changes).

## The picture

All of it is in `src/scene/lake/live.ts` (the loop) and
`src/scene/flight/gpu.ts` (the stream and the whiteout). One
`requestAnimationFrame` loop draws the canvas. It stops when the
tab is hidden or the canvas is off screen.

- **Scroll is the timeline.** Position is measured in screens of
  scroll, where one screen is the first section's height divided by
  its scene's length. Everything is a function of that position and
  runs the same backwards.
- **Scroll is smoothed twice** by an exponential ease (rate 6.49 a
  second, each stage), so a wheel burst settles without a snap.
- **The push.** Over a scene's two screens the camera closes on the
  scene's `focus` by its `push` amount. Near pixels move more than
  far ones, by the depth in the survey texture. This is the only
  camera move a plate has. It is small on purpose: see
  [scenes.md](scenes.md).
- **The breath.** At rest the camera drifts on three slow sines
  (periods of about 28 to 42 s), and open water shimmers where the
  survey marks it. The picture is never frozen and nothing in it is
  fast.
- **The pointer** leans the camera a little, through a critically
  damped spring (no overshoot, no bounce). Leaving the window
  returns it to centre. Nothing flees the cursor.
- **The whiteout.** For the 0.6 screens after a push, blown snow
  closes over the outgoing scene and clears on the incoming one. It
  follows scroll in both directions. The page's words are off from
  8 to 92 percent of it.
- **A jump.** A move across scenes that are not neighbours (a link,
  a keyboard focus, the End key) is one whiteout of 0.72 s straight
  to the target, not a flight through every scene between.
- **Catching up.** The picture follows the smoothed scroll at 5.5
  screens a second at most, and waits at the end of a push if the
  next scene is not ready.

**Frame-rate independence is a rule.** Every step in the loop is
integrated with the frame's own `dt` (the eases as `1 - e^(-rate ×
dt)`, the spring in closed form, `dt` capped at 0.06 s), so 60 Hz
and 120 Hz show the same motion. Never write `value += constant` a
frame. Never start a second animation loop for the canvas.

**Reduced motion**: the renderer does not mount. The page is its
stills and its words.

## Words on the home page

A scene's words arrive and leave by opacity only: 240 ms in, 190 ms
out, on `--ease-out` (`--hm-in` and `--hm-out` in
`src/app/home.css`). No rise, no mask, no letter effects. Words
reached by the keyboard are simply there, with no transition, and
their scene follows. With reduced motion or scripts off they are
plain text on a still.

## Tokens

In `src/app/globals.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | the one curve, in and out |
| `--t-press` | 120 ms | press feedback |
| `--t-fast` | 180 ms | hover, colour |
| `--t-ui` | 260 ms | small interface moves |
| `--t-theme` | 420 ms | the page's colours when the theme turns |

In `src/app/inner.css`: `--t-quick` 160 ms and `--t-layer` 200 ms.
Route changes are a cross-fade of the page inside the shell, 120 ms
out and 150 ms in (`::view-transition-*` in `globals.css`). Nothing
travels between routes.

## Rules for controls and layers

The owner's standing rules. They apply to the nav, the theme
switch, the sound toggle, the film's dialog, the archive search,
live-number tips, buttons and links.

- **A layer that opens scales from its trigger**, never from its
  own centre and never from `scale(0)`: it starts at 0.93 to 0.95
  with opacity. (The live-number tip starts at `scale(0.95)` from
  its lower left corner; the film's dialog grows from where it was
  pressed.)
- **Short.** Under 300 ms; about 200 ms for a small layer.
  Ease-out both ways, the exit about a fifth faster than the
  entrance.
- **Press** is `scale(0.97)` on `:active`.
- **Transform and opacity only.** No animated layout, no blur, no
  filter.
- **Nothing animates for a keyboard action**, nor for chrome that
  is always on screen. The theme knob does not slide when toggled
  from the keyboard.
- **Hover styles only under**
  `@media (hover: hover) and (pointer: fine)`.
- **Reduced motion** gets opacity alone
  (`@media (prefers-reduced-motion: reduce)` blocks in each
  stylesheet).
- **Nothing fades up on scroll** on an inner page. Content is
  there.
- `text-wrap: pretty` on running text, `balance` on headings.
- No jelly, no bounce, no particles, no parallax on DOM elements.

## Sound is not motion

The sound steps on a 150 ms timer (`src/sound/index.ts`) and only
sets ramps on audio parameters; it animates nothing. With reduced
motion it still plays but does not swell on a whiteout.

Change log: 2026-11-19 rewritten for the baked scenes (M1).
