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
  frame (the first paint) and a still of each section.
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
- What the live picture had and the played one has not: the water does
  not move while the page is at rest, the pointer raises no wake, and the
  first screen does not breathe. Those belong to the live layer that is to
  come over the played picture.

## The scroll timeline

- `src/water/registry.ts` owns it. `SECTIONS` gives each stretch its
  length in screens (hero, say, the eight stations, delta, sea);
  `sectionStarts()` and `stillStops()` derive from it. Positions are
  always in **screens of scroll**, never pixels.
- Each station is a `Move`: the eye turns about one point and closes
  on it, so the composed frame is one moment of an authored move
  (`moved(m, t)`), and `flightKeys(aspect)` builds the whole path as
  one curve through every key. Wide and upright screens have their
  own keys. `poseAt(keys, s)` gives the pose at scroll `s`.
- `dayAt(s)` is a scalar along the flight that the sound reads. Keep
  its meaning.
- Composed stops today (screens): hero 0, statement 3.10, Infiniview
  5.60, Upstream 8.45, Kilo Bench 11.15, Agent Bridge 13.80, Open
  models 16.60, cc-switch 19.40, TensorPoW 22.15, RydAR 25.80, delta
  28.30, ending 31.10. (Planned: about 24 screens after the pacing
  task; this list will be regenerated, not hand-edited.)

## The scene

- `src/water/world.ts`: the plan. Where the lake, the river, each
  station's object and its water lie in world units.
- `src/water/sky.ts`: the hours. The light theme is one day, the
  dark theme one night ending at sunrise, as keys along scroll.
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

`src/audio/**`: synthesized, off until asked. It reads the world's
plan and copies a few of the picture's numbers;
`tests/audio/picture.test.ts` fails when a copied number drifts. It
follows the picture through `src/lib/signals.ts`, which the player now
writes (the place in the flight, the frame's camera, the melt, the dawn,
the gates). Its own script, fetched only when the toggle is pressed,
still imports the world's plan from `src/water` (plain numbers and the
registry, which carries shader source as text; nothing is compiled or
drawn).

Change log: 2026-11-18 first version (orchestrator).

The velocity texture starts at zero. Until the first pointer impulse, advection
and pressure projection preserve that value, so the engine skips those passes.
A newly allocated simulation window starts with a fresh zero field.
The shared clock stops in hidden tabs. An intersection observer also gates the
flight's draw callback when the canvas has left the viewport, and marks the
picture dirty on re-entry so reduced-motion readers get a fresh frame.

Change log: 2026-11-20 V1: the home page plays the pre-rendered flight; the engine is the renderer; inner bands are stills.
