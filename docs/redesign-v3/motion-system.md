# Motion system

One language: things have mass, start from where they are, and can be interrupted. Tokens live in `src/lib/motion.ts` (JS) and `:root` in `src/app/globals.css` (CSS). Nothing in the site uses a value that is not in this file.

## Springs (response in seconds, damping ratio)

Closed-form damped spring, retargetable at any time, keeps velocity on retarget.

| Token | Response | Damping | Used for |
|---|---|---|---|
| `spring.ui` | 0.30 | 1.0 | Pane rim light, magnets, hover previews |
| `spring.move` | 0.45 | 1.0 | Drop position and scale between beats and routes |
| `spring.morph` | 0.55 | 1.0 | Shape weights when a route or hover picks a form |
| `spring.track` | 0.16 | 1.0 | Scroll-linked values (shape weights on home, ground colour) |
| `spring.throw` | 0.50 | 0.72 | After a gesture with momentum only: drag release of the drop, the switch flip |
| `spring.settle` | 0.90 | 0.80 | Intro: droplets merging into the drop |
| `spring.cursor` | 0.22 | 0.9 | Lens cursor follower |

## Easing curves (CSS and WAAPI)

| Token | Curve | Used for |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entrances, hover, press release |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | On-screen movement, line reveals |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Mobile menu panel, view-transition groups |

## Durations

| Token | Value | Used for |
|---|---|---|
| `--dur-press` | 140ms | Press feedback, `scale(0.97)` |
| `--dur-fast` | 180ms | Hover colour, chips, focus ring |
| `--dur-base` | 260ms | Small panels, tone flips |
| `--dur-pane` | 520ms | Pane materialize (blur 12px to 0, scale 0.96 to 1, opacity) |
| `--dur-line` | 900ms | Display line reveals |
| `--dur-route` | 420ms | Shared-element view transitions |
| `--stagger` | 60ms | Menu links and display lines, capped at 400ms |

## Scroll

- Lenis, `lerp 0.1`, `syncTouch` off (native momentum on touch). Disabled under reduced motion.
- Velocity is read from Lenis each frame, normalised to roughly -1..1 and passed through `spring.ui`. It drives three things only: the drop's stretch along Y, the lean (skewX up to 4deg) of the display type, and the strength of dispersion in the drop.

## Choreography per beat

Each beat has one lead (the display word), one support (the pane) and decoration (readouts). The drop is the constant. No two adjacent beats use the same entrance.

| Beat | Form | Ground | Word entrance | Pane arrives | Extra |
|---|---|---|---|---|---|
| Hero | drop | Cloud | fills from outline as the counter runs | readouts rise from the bottom edge | droplets merge on load |
| Infiniview | lens with ring, three probes | Signal | lines rise from a clip, 60ms apart | from the right | probes dent the lens |
| Open source | merge graph | Ink | slides in from the left, tracking closes | from the bottom | PR titles cycle |
| Kilo Bench | four bars | Cloud | scales down from 1.25 with blur | from the left | bars grow on entry |
| Agent Bridge | sphere, cube, bridge | Cobalt | two words arrive from opposite sides | from the bottom, with the video | a packet travels the bridge |
| Open models | four discs sized by pulls | Ink | counter ticks to the total | from the right | discs drop in sequence |
| cc-switch | switch | Signal | letters close up from wide tracking | from the left | click flips it (`spring.throw`) |
| TensorPoW | 3x3x3 lattice | Cloud | rises per line | from the right | lattice breathes |
| Merlin | engine bell | Ink | drops in from above | from the bottom | drag spins it with inertia |
| More | orbit of seven | Cobalt | none, chips materialize in a wave | chips | |
| Contact | drop | Cloud | words light up one at a time on scroll | links | |

## Route transitions

- React `<ViewTransition>` on route navigations. Shared elements: project title (home beat, /work row, project page), post title (blog index, post page). Group timing `--dur-route` on `--ease-drawer`, image pairs pass through a 3px blur.
- Page content: old view fades and lifts 8px in 160ms, new view rises 16px in 320ms on `--ease-out`. Exit is shorter than enter.
- The WebGL drop is not part of the snapshot. It stays live and springs (`spring.morph`, `spring.move`) to the form and position the new route asks for.

## Reduced motion

A separate, designed state, not a slower one:
- No Lenis, no intro sequence, no idle wobble, no pointer lean, no velocity effects, no parallax.
- The drop renders still frames and changes form with a 200ms cross-fade instead of a morph.
- Panes and words are in place at first paint. Hover and focus keep colour and opacity changes at `--dur-fast`.
- View transitions reduce to a 150ms cross-fade.
- The Agent Bridge video does not autoplay; it shows its poster and native controls.

Also honoured: `prefers-reduced-transparency` (panes become solid tinted surfaces) and `prefers-contrast: more` (solid panes with a 1px contrasting border).
