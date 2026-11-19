# Architecture

Status: **as built** unless a line says planned.

## The idea

The home page is one glacial world drawn in raw WebGL2 (hand-written
GLSL, no three.js), flown through by scroll: a frozen lake with the
name, the lake breaking up, a meltwater river past eight project
stations, a delta, the sea. The DOM carries every word; the picture
carries no copy except media a project owns. Inner pages (`/work`,
`/work/[slug]`, `/blog`, posts) are ordinary pages that open on a band
of the same world.

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
scene band (`src/components/SceneBand.tsx`, `src/water/scene-band.ts`:
the live scene where it can run, its still otherwise) and ends on the
next station's band (`src/components/NextBand.tsx`).

## Sound

`src/audio/**`: synthesized, off until asked. It reads the world's
plan and copies a few of the picture's numbers;
`tests/audio/picture.test.ts` fails when a copied number drifts.

Change log: 2026-11-18 first version (orchestrator).
