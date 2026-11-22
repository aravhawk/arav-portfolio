# Architecture

Status: **as built** unless a line says planned.

## The idea

The home page is one glacial world, flown through by scroll: a frozen
lake with the name, the lake breaking up, a meltwater river past the
project stations, a delta, the sea. The DOM carries every word; the
picture carries no copy except media a project owns. Inner pages
(`/work`, `/work/[slug]`, `/blog`, posts) are ordinary pages that open
on a still of the same world.

The world is drawn by a hand-written WebGL2 engine (`src/water`, raw
GLSL, no three.js). **No page a visitor opens runs that engine.** It
takes most of a minute to build its shaders on a first visit and 10 to
27 ms a frame on a large screen, so since V1 (2026-11-20) it is the
**renderer**: `tools/flight` drives it on the owner's machine and
photographs the flight's frames, and the home page **plays** those frames
by scroll (`src/flight`). Everything below about the scene, the render
loop and the stations describes the renderer; "The player" describes what
a visitor runs.

## The player (what a visitor runs)

- `src/components/flight/FlightPage.tsx` is the page: the sections, the
  words, the rail. `/` renders it with `FlightPlayer`; `/render`
  (unlinked, noindex, disallowed in robots, for the tool only) renders the
  same page with `FlightStage`, the live engine. One component, so the
  words and their thresholds cannot drift between what is rendered and
  what is played.
- `public/flight/` holds what is played (made by `tools/flight`, see its
  README): for each window shape (`wide` 16:9, `tall` a phone) and theme
  (`day`, `night`) a stream of frames as AV1 and as HEVC with an index of
  every frame's offset, the camera of every frame, a still of the first
  frame (the first paint), a still of each section, and for each shape
  the live layer's masks.
- `src/components/FlightPlayer.tsx` puts the first frame's still in the
  HTML as a picture (the largest paint) and loads `src/flight/player.ts`
  after the first paint. Nothing of `src/water` but three small files of
  plain geometry (`callouts.ts`, `words.ts`, `projection.ts`) is in a
  visitor's scripts; the timeline's numbers reach the player as data
  (`Plan` in `src/flight/types.ts`), because `camera.ts` and `registry.ts`
  import the shaders' source.
- `player.ts` owns the home page's frame: it follows the scroll through
  one critically damped spring (`spring.ts`: nine tenths of a step in
  0.55 s, the same at any refresh rate; the scroll itself is native), and
  that one position sets the words, the rail, the captions tied to points
  of the world and the frame drawn. A jump of more than 2.5 screens is
  cut under a dissolve, not flown.
- `decode.worker.ts` fetches the stream by byte range, a few keyframe
  groups round the reader and ahead of the way they are going, and
  decodes with WebCodecs, keeping a window of 14 decoded frames round the
  reader. A window narrower than 9:10 is shown the tall set, any other the
  wide one; the frame covers the window (cut, never stretched).
- `warp.ts` draws the place between two frames. Neighbouring frames are
  up to hundreds of pixels apart where the camera travels, so they are
  not laid over each other as they are: each is looked up through the
  camera it was rendered from, on the ground plane, from the camera that
  stands between them (one 30-line WebGL program; a 2D canvas that steps
  from frame to frame where there is no WebGL). At rest the picture is one
  rendered frame, untouched.
- Three things run by time as they did live, each a track of the stream:
  the first screen's entrance, the ending's light (once, when the camera
  first rests there), and the picture's answer to the switch.
- With reduced motion, or where neither stream can be decoded, each
  section shows its still with its words whole, and stills change with a
  fade.
- `live.ts` is the **live layer** (V2): weather and light over the played
  picture, on a canvas of its own above the picture's (both in
  `.flight-stage`). It is a lazy chunk of its own, asked for once the
  picture is up and the entrance has run, and it draws only when the
  player's frame calls it. What it draws:
  - blown snow: 2,600 flakes in a box of air that travels with the
    camera, each placed in world space and projected through the camera
    of the frame shown (real depth and parallax), one wind; how many are
    out follows the place (`Plan.air`: keys along the valley);
  - on open water, sparse glints in slow bands and a faint broad
    undulation of light, anchored to the water's plane. Where the water
    is comes from the **masks** (`public/flight/<shape>.mask-<k>.webp`,
    made by `tools/flight`: every frame of `main`, small and grey, 0 sky,
    0.5 solid, 1 open water); between two frames the two masks are looked
    up through their cameras, as `warp.ts` does the picture;
  - the pointer: on water a soft ring spreads from where it passed and
    fades in 1.5 s; on ice and snow a faint cold light follows it through
    a spring. A finger's drag does the same;
  - the first screen's breath: `.flight-stage` drifts by 0.3 percent of
    the window's height on two slow periods (transform only), and lets go
    within a tenth of a second of a scroll;
  - cc-switch's gate: the chosen sluice is lit (its opening, its image on
    the water, its channel from the dam down) with the profile's name
    over it, placed through the camera (`Plan.gates`, `Plan.sluices`),
    changing in 200 ms, at once when chosen with the keys.
  Nothing of it is drawn where words stand: it reads the boxes of the
  blocks now showing and of the captions from the page (when they change
  and when the picture comes to rest, never each frame). The picture's
  own canvas is never touched: with `window.__flightLive = false` the
  page is the played frames alone (`scripts/live-picture-same.mjs`).
  With reduced motion, or where no stream decodes, there is no layer. A
  machine that cannot hold its frame with the picture at rest loses half
  the flakes, then the layer; never the picture.
- The switch moves the water (V3): while cc-switch's words stand, the
  frames with the second or the third sluice open are tracks of the
  stream (`gate1`, `gate2`, 40 frames each), and the player shows the
  chosen one under a dissolve. Before and after that stretch the picture
  is `main`, the first gate open, whatever is chosen: the live layer's
  lit gate still names the choice there.
- What the engine's picture had and the played one still has not: foam
  at the ice block's foot.

## The scroll timeline

- `src/water/registry.ts` owns it. `SECTIONS` gives each stretch its
  length in screens (hero, say, the nine stations, delta, sea);
  `sectionStarts()` and `stillStops()` derive from it. Positions are
  always in **screens of scroll**, never pixels.
- Each station is a `Move`: the eye turns about one point and closes
  on it, so the composed frame is one moment of an authored move
  (`moved(m, t)`), and `flightKeys(aspect)` builds the whole path as
  one curve through every key. Wide and upright screens have their
  own keys. `poseAt(keys, s)` gives the pose at scroll `s`.
- `dayAt(s)` is a scalar along the flight that the sound reads. Keep
  its meaning.
- Composed stops today (screens; `scripts/render-sheet.mjs` prints the
  list): hero 0, statement 3.10, Infiniview 5.60, Upstream 8.45, Open
  models 11.20, cc-switch 14.00, Kilo Bench 16.75, Ask Around 19.35,
  RydAR 23.00, Agent Bridge 25.60, TensorPoW 28.35, delta 30.90,
  ending 33.70. The flight is 34.7 screens long; the page scrolls 33.7.
  The stations stand in the owner's order (V3, 2026-11-20): the order
  of `PROJECTS` in `src/content/projects.ts`.

## The places along the river

- Each place's numbers in `src/water/geography.ts` are written from a
  base of its own (`AT`: `shallows` for the seracs and the dam, `pool`,
  `canyon`, `tarn`, `lattice`, `delta`; the basin and the confluence
  are written from the lake's foot, `DY`). A place is moved down the
  valley by moving its base: its object, its water, its shader's
  constants, its camera keys and its captions' anchors all follow,
  because none of them holds a number of its own. The river between
  two places is laid where their paint functions meet (the last
  channel of one ends where the first of the next begins).
- Paint order matters inside a place: the river into a still pool is
  painted before the pool's slow `flowOnly` water, or the pool runs.
- Ask Around's place is the ring (`RING`, `ringStones()`,
  `paintRing`, `src/water/shaders/ring.ts`): seven standing stones of
  the seracs' ice round a small round pool on the west bank, six lit
  from within as the tarn's shards are, one dark. It is a registered
  subject with no pass of its own (`customSubjects`): the pass calls
  `ringIce` over the finished ground and water, and that one function
  draws the stones, their shade, their light on the snow and their
  image in the pool.

## The scene

- `src/water/world.ts`: the plan. Where the lake, the river, each
  station's object and its water lie in world units.
- `src/water/sky.ts`: the hours. The light theme is one day, the
  dark theme one night ending at sunrise, as keys along scroll. The
  keys were calibrated on the first order of the places. Since the
  places took the owner's order each moved place keeps the light it
  stood in (`relaid`): the sun and the moon go back and forth between
  places, and every place is lit as it was made to be.
- `src/water/moments.ts`: clockwork and scroll-driven events
  (`ENTER` and `firstLight` for the first screen, `DAWN` for the
  ending, the melt).
- `src/water/shaders/`: `flight.ts` (the main pass: ground, water,
  sky, lighting, final colour), `stations.ts` (the stations'
  objects and their lighting), `name.ts` (the name's plates),
  `ice.ts` (the lake field and shared ice material), `terrain.ts`, `sim.ts` (the water
  simulation the pointer and the events disturb), `finish.ts`.
- `src/water/variants.ts`: the main pass is compiled in a variant per
  stretch of the flight and per theme (`#define`s), and a frame is
  drawn in pieces, each by the leanest variant that carries what
  stands in that piece. A station's code runs only where the station
  stands.

## The render loop

- `src/water/flight.ts`: `FlightEngine`. **One** `requestAnimationFrame`
  owner for the page: it reads scroll, poses the camera, steps the
  simulation, sets the words' steps, draws. `window.__flight` exposes
  `engine`, `state()`, `holds`, `poseAt(s)`, `holdPose(pose)`,
  `holdEntrance(t)`, and `engine.holdLean(0)` (pin full shading for
  captures).
- A quality governor steps shading in discrete tiers per stretch. It
  never changes resolution. The device pixel ratio is capped at 2
  (`src/water/engine.ts`).
- `src/water/opening.ts`: the seam for the first visit's opening
  (`holdOpening`, `whenOpened`). `src/water/poster.ts`: the first
  paint is a still of the first frame, chosen by window shape and
  theme before paint.

## The words

- `src/app/page.tsx`: one `<section class="fl-sec">` per stretch,
  each with a block of words (`.fl-words`, `data-fl-from`,
  `data-fl-to`). Each piece of a block carries a scroll threshold
  (`data-at`, written by `build()`); past it the piece is in, back
  past it it is out.
- `src/app/flight.css`: the home page's tokens (sizes, margins, the
  one anchor) and the steps' transitions.
- `src/water/words.ts`, `src/water/callouts.ts`: geometry of blocks
  and of callouts tied to points of the scene; the picture keeps a
  calm lee under every block.
- Copy comes from `src/content/projects.ts` (`src/content/kinds.ts`
  for the labels). Live numbers from `src/lib/metrics`.

## What a station is made of

`FLIGHT` in `src/water/registry.ts` orders every stretch, including the opening, statement, delta and sea. Each definition supplies its relative stop and camera keys. A project station can also supply a slug, a water painter, a box or boxes, a feature bit, shader source, an event range and band framing. The registry computes the timeline once. Camera interpolation, the rail, the DOM section order and project bands use it.

`world.ts` replays each registered painter against the bed or the audio recorder. Shared coordinates and the existing water painters live in `geography.ts`. Custom shaders receive colour, the world ray and scroll progress inside the projected bounds. The existing confluence/pool tile join, media textures and cross-pass reflections have specialized paths. Existing metric figures, film and switch controls have specialized markup in the home page.

## Inner pages

`src/app/work/[slug]/`, `src/app/work/`, `src/app/blog/`,
`src/components/work/**`, `src/app/pages.css`. A page opens on a
scene band (`src/components/SceneBand.tsx`: the scene's still, a picture
in the HTML) and ends on the next station's band
(`src/components/NextBand.tsx`). The engine's own band
(`src/water/scene-band.ts`) is no longer mounted by any page; it is kept
for making those stills again.

## Sound

`src/audio/**`: synthesized, on the home page only, on unless the
reader mutes it (see [sound.md](sound.md): the control, when sound
starts, its cost, its level). It reads the world's plan and copies a few
of the picture's numbers; `tests/audio/picture.test.ts` fails when a
copied number drifts. It follows the picture through
`src/lib/signals.ts`, which the player writes (the place in the flight,
the frame's camera, the melt, the dawn, the gates). Its own script is
fetched at idle after the home page's first paint. It imports the
world's plan from `src/water` (the registry, the camera's geometry, the
hours): plain numbers. The registry holds no shader text: a subject's
definition names its GLSL function, and `src/water/shaders/subjects.ts`,
which only the renderer loads, holds the source under that name.

Change log: 2026-11-18 first version (orchestrator).

The velocity texture starts at zero. Until the first pointer impulse, advection
and pressure projection preserve that value, so the engine skips those passes.
A newly allocated simulation window starts with a fresh zero field.
The shared clock stops in hidden tabs. An intersection observer also gates the
flight's draw callback when the canvas has left the viewport, and marks the
picture dirty on re-entry so reduced-motion readers get a fresh frame.

Change log: 2026-11-20 V1: the home page plays the pre-rendered flight; the engine is the renderer; inner bands are stills.

Change log: 2026-11-20 V2: the live layer over the played picture (`src/flight/live.ts`), its masks, the engine's mask output.

Change log: 2026-11-21 S2: sound on by default; the registry without shader text (`shaders/subjects.ts`).
