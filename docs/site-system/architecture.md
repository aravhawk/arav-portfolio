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
- `lightAt(s)` is the light's own clock: the scroll without the
  stations marked `added` in the registry. The sky, `dayAt` and the
  valley's air read the scroll through it, so a station laid in later
  moves no other station's hour (R3).
- Composed stops at the first version (screens; read `composed` in the
  registry for today's): hero 0, statement 3.10, Infiniview
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
  drawn in pieces, each by the leanest variant that has drawn before
  and carries what stands in that piece. A station's code runs only
  where the station stands.

## The render loop

- `src/water/flight.ts`: `FlightEngine`. **One** `requestAnimationFrame`
  owner for the page: it reads scroll, poses the camera, steps the
  simulation, sets the words' steps, draws. `window.__flight` exposes
  `engine`, `state()`, `holds`, `poseAt(s)`, `holdPose(pose)`,
  `holdEntrance(t)`, `engine.holdLean(0)` (pin full shading for
  captures), `engine.holdPace({ scale, every, travel })` (pin the
  pace), `engine.info` (what drew the last frame and at what pace) and
  `engine.buildLog` (when each program was built).
- **The pace** (`src/water/pace.ts`, R2). At rest every frame is drawn
  at the screen's own resolution with full shading; where that does not
  fit one interval of a 120 Hz display the scene is drawn every other
  interval. While the camera travels the scene is drawn smaller (never
  under 0.7 of the screen a side on a desktop, 0.6 on a phone) and
  brought to size by one sharpening pass with the grain at the screen's
  resolution (`RECONSTRUCT` in `shaders/finish.ts`); it comes back over
  a fifth of a second once the picture has been still 150 ms. How small
  is worked out from a measured map of what a frame costs at each
  quarter screen (`cost-map.json`) and from this device's speed, measured
  once behind the still (`calibrate`). The device pixel ratio is capped
  at 2 (`src/water/engine.ts`). An inner page's band is not paced.
- **Programs** (`variants.ts`, `coverFlight`). Behind the still the page
  builds the variants for the frame it opens on and three broad ones
  that between them can draw any piece of any frame. A piece's own
  variant is built only while the reader has left the page alone for
  450 ms; until then the stretch's broad one draws it. Nothing is built
  while the page moves.
- `src/water/opening.ts`: the seam for the first visit's opening
  (`holdOpening`, `whenOpened`). `src/water/poster.ts`: the first
  paint is a still of the first frame, chosen by window shape and
  theme before paint.

## The loading sequence (L1)

A first visit waits about six seconds behind the still while the driver
builds the programs (`performance.md`). The wait is the hour before the
light, told twice by the same reports:

- **The grade.** One layer over the still (`.fl-poster::after`, a
  two-stop gradient in the scene's shadow colour, thinner toward the
  foot so the first words keep their ground; deeper by night) holds the
  first frame in the blue hour. Its opacity is `--fl-grade`, set lower
  at each step by that step's share of the wait, and it is exactly
  nothing at the last: the still is then the picture's first frame, and
  the entrance's light is the end of the same story.
- **The readout.** Over the first line: which step this is, set large in
  the display face, the step's name beside it in the small mono label.
  Nothing is drawn under it (a rule that filled read as a progress
  bar): the picture coming up is the measure. By day the nav's plates
  are tinted by the same grade, so they do not stand white against the
  blue hour.

- `src/water/load-steps.ts`: the steps in order, the words each is named
  by, what each was measured to take, and `armLoad`, which the page's
  first script runs before the first paint (`posterBoot`). It sets
  `data-load` on the document: `cold` for a first visit (the core is in
  the first paint), `warm` for a reader whose driver has built the
  programs before (remembered in `localStorage`; the core stays out
  unless the wait passes 1.7 s, and then the readout alone: a grade that
  came late would darken a page already seen bright). This file is in
  the page's first script.
- `src/water/load.ts`: `loadStep(id, k, n)`, called by `prepare`, `stand`
  and `mountFlight` as each piece of a step is done, and `loadOver`,
  called in the frame that sets `data-picture`. One report is one style
  write (eased by CSS); nothing runs per frame
  and nothing moves between reports. It is in
  the flight's own script. `__flight.loadLog` keeps every report.
- `.fl-load` and the grade in `flight.css`: their rules, the hold (the page cannot
  be scrolled while `data-load` is `cold` or `warm`, so the picture
  always comes up at the top; `Runtime.tsx` tells the smooth scrolling
  not to gather a wheel meanwhile), the hand-off (`over`: the core sinks
  out as the live picture dissolves in, then the entrance runs) and the
  rail's arrival.
- A step added to `prepare` or `mountFlight` that takes a tenth of a
  second or more gets a row in `LOAD_STEPS` and its reports. If the
  flight cannot mount, `loadDrop` lets the page go; if its script never
  arrives, `armLoad`'s own timer does; if a step never reports again,
  the timer in `loadStep` does.
- `scripts/loader-film.mjs` films it (cold, `--warm`, `--reduced`,
  `--scroll`, `--noscript`).

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

`src/audio/**`: synthesized, on unless the reader mutes it
(`sound.md`: the control, how it starts, what it costs, its level). It
reads the world's plan and copies a few of the picture's numbers;
`tests/audio/picture.test.ts` fails when a copied number drifts.

Change log: 2026-11-18 first version (orchestrator).

The velocity texture starts at zero. Until the first pointer impulse, advection
and pressure projection preserve that value, so the engine skips those passes.
A newly allocated simulation window starts with a fresh zero field.
The shared clock stops in hidden tabs. An intersection observer also gates the
flight's draw callback when the canvas has left the viewport, and marks the
picture dirty on re-entry so reduced-motion readers get a fresh frame.

Change log: 2026-11-22 R3: `lightAt`; a registered subject with no pass of its own is in use (the vault).

Change log: 2026-11-22 R2: the pace; programs built behind the still and at rest only.

Measure projected callout rings and label intersections against the camera uniforms submitted to WebGL with `NODE_PATH=<Playwright node_modules> node scripts/callout-check.mjs http://localhost:3189 .tools/out/b3/callouts`.

Change log: 2026-11-22 L1: the loading sequence. Second pass: the grade, the readout set large.
