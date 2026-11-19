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
back. A block leaves as one, quickly. No word may ever be covered,
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

Change log: 2026-11-18 first version (orchestrator).
