# Motion

Status: the tokens, the words' steps and the camera's moves are **as
built**. The velocity signals, the camera's spring and one tokens
module are **planned** (the motion system task).

## Principles

1. **One clock.** The engine owns the page's only frame loop
   (`src/water/flight.ts`). Scroll, camera, simulation, words and
   sound are stepped from it. Do not start another
   `requestAnimationFrame` loop or a timer that animates.
2. **Scroll is a timeline.** Everything in the picture is a function
   of scroll position in screens, scrubs both ways, and rests in an
   exact pose. Nothing waits on a timer except the short transitions
   of words between two finished states.
3. **The eye never stops.** Every station is one authored camera move
   (push, arc or rise). No hold in which two frames half a screen
   apart are the same picture (`tests/water/camera.test.ts` asserts
   it).
4. **Motion starts from the thing that causes it.** A station's event
   begins at its object; a press answers at the control; a page
   transition begins at what was touched.
5. **No trick twice in a row.** Each station's event is a different
   mechanism. Do not reuse one reveal between every beat.
6. **Crisp at rest.** No blur, ever; no resolution change.

## The live layer (as built, V2)

The played picture is a still at rest; `src/flight/live.ts` lays weather
and light over it. Its rules:

- **It must read as weather and light, never as an effect.** If a part
  can be pointed at in a still frame, it is too strong. Glints are a few
  pixels, sparse and never on a grid; the water's light is a broad shade
  lighter or darker, never a line; flakes are small and few.
- **In the world, not on the glass.** Flakes, glints and the pointer's
  rings are placed in world space and seen through the frame's camera,
  so they pass with the camera's travel. Only the pointer's cold light
  and the breath are of the window.
- **By the clock, from the one frame loop.** Everything is a function of
  time and place, so it is the same at any refresh rate; springs are
  integrated exactly. It has no loop or timer of its own.
- **The pointer never commands.** A ring spreads and fades in 1.5 s;
  the cold light follows through a critically damped spring (0.36 s) and
  goes a few seconds after the pointer stops. Nothing flees it, nothing
  trails it, nothing is drawn where words stand.
- **The breath is small and lets go.** 0.3 percent of the window's
  height, periods of 11 and 7.3 s, in over 1.4 s once the entrance has
  run, out in under 0.1 s at the first scroll.
- **The gate answers in 200 ms**, ease-out, setting out from the control
  that chose it; at once when chosen with the keys.
- **Reduced motion: none of it.** No canvas, no breath. Hidden tab: it
  stops with the frame loop.

## Easing (tokens in `src/app/globals.css`)

| Token | Curve | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | anything arriving, and UI feedback |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | anything moving on screen |
| `--ease-in` | `cubic-bezier(0.55, 0, 0.9, 0.3)` | anything leaving (and make it faster than its arrival) |

Never linear for UI, never a start from `scale(0)`, no bounce on a
large surface.

## Durations

| Token | Value | Use |
| --- | --- | --- |
| `--t-press` | 120 ms | press feedback (`:active`, scale 0.97), at pointer-down |
| `--t-fast` | 180 ms | hover, colour |
| `--t-ui` | 260 ms | small UI |
| `--fl-set`, `--fl-rise` (home) | 200 to 320 ms | a piece of a block of words setting through its mask |
| `--t-theme` | 420 ms | the theme's turn |
| `--t-reveal` | 760 ms | a page's first reveal, a page transition |

Hover styles only under `@media (hover: hover) and (pointer: fine)`.
`prefers-reduced-motion`: every step is shown at once, no entrance,
the first screen stands where its still was taken.

## UI layers and controls (the owner's standing guidance, Nov 19, 2026)

These apply wherever the site has the matching element (the nav, the
rail's labels, the post's contents, the film's
dialog, the profile switch, buttons and links). They do not change
the hero, the river or any 3D work.

- **Origin-aware.** A dropdown, popover, menu, tooltip or overflow
  layer scales from its trigger, never from its own centre
  (`transform-origin` from the trigger's position, or the library's
  variable where one is used).
- **Short.** UI motion stays under 300 ms, about 200 ms for a small
  layer. Ease-out for both enter and exit; the exit about a fifth
  faster than the enter.
- **Never from nothing.** No start from `scale(0)`: start at 0.93 to
  0.95 with opacity. Press feedback is `scale(0.97)` on `:active`.
- **Transform and opacity only**, and interruptible transitions in
  place of keyframes.
- **No motion on keyboard-initiated actions**, nor on chrome people
  see constantly.
- **Reduced motion** across the scroll journey and the ending: a
  fade in place of any large movement.
- `text-wrap: pretty` on body copy.

### The theme switch (as built, F1)

`ThemeToggle` in `src/components/Nav.tsx`, styled in `nav.css`. It is
the model for a small control:

- **A real switch** (`role="switch"`, named "Dark theme",
  `aria-checked`). Off is light: an open track with a full disc at its
  left. On is dark: a filled track, the disc at its right, cut to a
  crescent. The state is read without a label, in both themes.
- **On the pixel grid.** A 40 by 22 track, a 16 px disc 3 px in, 18 px
  of travel: whole pixels, so every edge is sharp at 1x and 2x. The
  nav's side padding is rounded to a pixel for the same reason (the
  gutter is a share of the window's width).
- **The button is the target** (52 by 44, never under 44 wide); the
  focus ring stands round the track.
- **180 ms, ease-out, transform and opacity only.** The track's two
  looks are two layers that cross-fade; their colours are the
  switch's own and do not turn with the theme's tokens, so nothing
  flashes as the tokens change under them. The press is
  `scale(0.97)` on the button.
- **One element in the markup.** The track's two looks, the
  crescent's bite and reduced motion's second disc are pseudo-elements
  in `nav.css`. `Nav.tsx` is in every page's script, and a few more
  bytes of it cost every page a request (`performance.md`, "The
  first round").
- **Nothing moves when it is changed from the keyboard**
  (`data-instant`, set from the click's press count), nor is there a
  press scale under `:focus-visible`.
- **Reduced motion: a cross-fade.** The disc does not travel: one
  stands at each end and one fades as the other comes.
- **The theme itself turns by the page's colours cross-fading in
  place** (`--t-theme`). Nothing grows from the centre of the screen;
  if a reveal is ever added it sets out from the switch.
- The first paint has the system's scheme or the stored choice
  (`boot` in `layout.tsx`); the switch is drawn from `data-theme`, so
  it is right in that paint too.

`scripts/toggle-sheet.mjs <base> <outdir>` photographs every state at
1x and 2x, enlarged, with the travel frame by frame, and writes the
control's name, role, sizes and what the keys do.

## Springs (planned: one helper in the engine)

For anything that follows the pointer or a drag: critically damped
(damping ratio 1.0; 0.8 only for something small), response 0.3 to
0.4 s, integrated per frame so the result does not depend on the
frame rate. The camera follows smoothed scroll through the same
spring.

## Words

A block of words builds in steps as its station composes, each piece
at its own size through a mask, the eyebrow first (a title is never
shown small). Steps are scroll thresholds (`data-at`); each step is a
short transition that completes on its own and reverses when scrolled
back. A block leaves as one, quickly (a piece may leave a little before
its block where the ground under it is lost first: `data-fl-until`, used
by the first screen's sentence and by the delta's recognition lines,
which the dawn's light reaches a tenth of a screen early on a phone). No word may ever be covered,
and no two lines may intersect at any scroll position
(`scripts/words-test.mjs`).

## Transitions between sections

Sections are joined by the flight itself: the camera travels, the
light moves with scroll, the outgoing block leaves before the
incoming eyebrow stands. There is no wipe, fade or scene cut between
stations, and a new station must not add one.

## Haptics

Only as the direct consequence of a meaningful action; never on load,
hover or continuous scroll; in the picture, only at discrete beats.

Change log: 2026-11-18 first version (orchestrator). 2026-11-21 F1: the theme switch.
