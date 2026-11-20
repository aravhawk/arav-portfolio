# aravjain.dev v4: motion system

> **A record of the earlier site (before the rebuild of Nov 19, 2026).** The engine, files and plans named here are gone or changed; the site as it is now is described in [`docs/site-system/`](../site-system/README.md).

One clock: a single `requestAnimationFrame` loop (`src/lib/frame.ts`) drives
smooth scroll, the water, the ending and every scroll-linked reveal, in that
order. It stops while the tab is hidden.

## Tokens (`src/app/globals.css`)

| Token | Value | Used for |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Anything arriving, and every response to a press or hover |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Anything moving across the screen while visible (the ending's headline wipe) |
| `--ease-in` | `cubic-bezier(0.55, 0, 0.9, 0.3)` | Leaving only, and always faster than the arrival it mirrors (the nav hiding) |
| `--t-press` | 120 ms | `:active` feedback |
| `--t-fast` | 180 ms | Colour and background on hover |
| `--t-ui` | 260 ms | Controls: underlines, arrows, the theme knob, the nav mark |
| `--t-reveal` | 760 ms | Content arriving on scroll |
| `--t-theme` | 420 ms | Light to dark, on the page and in the shaders together |

No built-in curve (`ease`, `linear`) is used for movement. `ease` appears
only on colour changes, where it is correct.

## Rules

- **Feedback under 300 ms.** Press is `scale(0.97)` (0.94 on the small round
  controls) in 120 ms, applied on `:active`, so it starts on pointer down.
- **Hover only where there is a hover.** Every hover rule sits inside
  `@media (hover: hover) and (pointer: fine)`.
- **Transform and opacity only** for anything in the DOM.
- **Exits are faster than entrances.** Nav hides in 260 ms and returns in
  420 ms; the ending's lines leave in 180 ms and arrive in 700 to 900 ms.
- **Chrome gets out of the way.** The nav leaves when the page scrolls
  down and returns when it scrolls up or reaches the top, so it is never
  parked over copy passing under it.
- **Scroll-linked motion is a function of position.** The melt and the
  ending read scroll and set a state. Nothing plays on a
  timer, so everything reverses exactly and has an exact rest pose.
- **No bounce on large surfaces.** Anything that moves on its own is
  critically damped: `x += (target - x) * (1 - exp(-lambda * dt))`, which is
  also frame-rate independent. Theme uses lambda 9; the pointer velocity
  filter uses 0.5 per frame.
- **Reveals are cast, not uniform.** Each beat has a lead (the name or the
  big figure, rises 34px), support (the line and the control, rise 18px, 70
  and 140 ms later) and decoration (the label, fades only). One observer,
  each element revealed once, never replayed.
- **Nothing blocks.** Every element is interactive the moment it is visible.

## The water's own motion

| Thing | Behaviour | Constant |
|---|---|---|
| Surface waves | Linear wave equation on a low-resolution grid, fixed substeps of 1/120 s, banks reflect | `(c dt / dx)^2 = 0.34` with viscosity 0.04 (stable while their sum times 8 stays under 4), slower in shallows; damping 0.9 to 2.4 per second; height and velocity clamped |
| Current | Authored flow map along each channel, blurred | 78 px/s where the map is 1; 34% through the lake |
| Pointer | A body moving through open water: a trough along its path and a bulge behind it, plus momentum into a velocity field kept divergence free. The wake is seen because it bends the light on the bed and throws a soft highlight; nothing is drawn on top of the water | Trough radius 15px, strength scales with speed up to 700 px/s; velocity decays at 0.9 per second |
| Press or tap | One ring that travels outward and damps over about a second | Radius 16px (22px for touch) |
| Agent Bridge | The two pools take turns sending a ripple while in view | Every 1.9 s |
| Melt | The lake is covered by a sheet of ice with the name cut through it. By scroll position: the sheet wets and its cracks brighten; the openings grow from the letters' edges and leads open along the cracks; the sheet lets go of the banks and becomes a few large floes; the floes shrink, round off and drift to the outlet; open water. It reverses exactly | Over 0.64 of a viewport of scroll; the name is readable through the first half |
| Meltwater | Clear, lighter water leaves the ice with the current and runs down the first channel; it clears in under a second | Dye carried by the flow map |
| Current | In the runs, fine bright threads ride the flow; pools are calm with a slow swell | Carried by the flow map at 78 px/s |
| Warmth | Resting the pointer on the ice leaves a wet, clearer patch; it refreezes | Decay 0.45 per second |
| Ending | The page's own water hands over to the ending with no seam; then eye height 8 to 1 and the pitch lifts to the horizon, by scroll, as one continuous move. The water's colour travels from the page's teal to the sea's across the lift | Smoothstep on progress over about two thirds of a screen |
| Sunrise | After arrival the sun climbs for 60 s, then holds | Once per page view |

## Haptics (section H)

A haptic is fired in the same handler as the visual change it belongs to,
through `src/lib/haptics.ts`, and only on a meaningful, discrete action.

| Action | Preset |
|---|---|
| Theme switch | `light` |
| Nav links, profile switch, archive filters | `selection` |
| Contact links on the ending | `medium` |
| Email copied | `success` |
| Copy failed, or a page error | `error` |
| The name finishes melting (once per page view) | `soft` |
| The horizon settles into place (once per page view) | `light` |
| Turning haptics back on | `light` |

Never on load, hover, pointer movement, flowing water or ordinary scroll.

## Reduced motion

`prefers-reduced-motion: reduce` gives a deliberate still version, not a
broken one: the water is drawn with time frozen and redraws only when the
page scrolls, the ice sheet stays whole with the name cut in it, every
reveal is already in place, smooth scroll is off, the ending is a single screen
at its final pose with the sun risen, and there are no haptics.
`prefers-reduced-transparency` makes glass solid. `forced-colors` drops the
canvas and outlines the basins.
