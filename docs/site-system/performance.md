# Performance

Status: **as built** (R2, 2026-11-22). The numbers under "where it
stands" are measured on an Apple M4 (10 GPU cores, a 60 Hz display)
and dated; what only the owner's machine can settle is said there.

## The budget

The owner's display is a 16 inch MacBook Pro, M5 Pro: 3456 by 2234
device pixels, 120 Hz, about twice the M4's GPU. So, measured on the
M4 at a 3456 by 2234 output (one drained frame: see "how to measure"):

- **Travelling:** 11 ms or less of GPU time at every position (5.5 of
  his 8.3 ms).
- **At rest:** 11 ms or less where the scene is drawn every interval of
  his display, 22 ms or less where it is drawn every other one.
- **A first visit:** the live picture within seconds; after it, no
  frame over 20 ms and no task over 50 ms while the reader moves, and no
  program built in a frame the reader is moving through.
- **Phones and laptops from 2021 on:** a steady 60.
- **At rest the picture is the picture.** Full resolution, full
  shading, and the same frame as before any change to the engine
  (`scripts/flight-picture.mjs`, structural similarity 0.99 or more at
  32 positions, both themes, wide and tall). Resolution may be lower
  only while the camera travels, never under 0.7 of the screen a side
  on a desktop, and never blurred: one sharpening pass, grain at the
  screen's resolution. Device pixel ratio capped at 2.
- The engine's frame callback 1.5 ms or less; one WebGL context on the
  home page; nothing draws off screen.

## How the page holds it

- **The pace** (`src/water/pace.ts`). What a full frame costs at every
  quarter screen is a measured map (`src/water/cost-map.json`, ms per
  megapixel on the M4). How fast this device is against the M4 is
  measured once behind the still (`calibrate`: the scene three times,
  the GPU waited for). From those the page works out, each frame, the
  resolution on the move and how often the scene is drawn at rest. It
  does not ask a GPU timer while it runs (see `pitfalls.md`). Only
  missed frames on the move correct the measured speed.
- **A slower device** is given, in order: a lower resolution on the
  move (to the floor), leaner shading, the scene at half the rate
  again at rest (30 a second), and only then a lower resolution at
  rest (floor 0.8, a phone 0.6): a soft resting picture is the last
  thing given up. The leaner shading saves little (0 to 2 percent the first
  step, 7 the second), so in practice that tier is resolution.
- **Programs.** A variant of the pass costs the driver 0.15 to 1.6 s at
  its first draw on a first visit. The page builds, behind the still,
  the variants for the frame it opens on and three broad ones that can
  draw any piece of any frame (`coverFlight`); every other is built
  only while the reader has left the page alone for 450 ms.

## What a new section may cost

A station's own code runs only in its own piece of the frame
(`src/water/variants.ts`). A new station must: add no full-screen
pass; keep its per-pixel work inside its piece; prefer a few reads
from small baked or tiling textures to procedural noise in the pixel;
cost no more per frame than the median of the existing stations; and
say what it adds to the wait behind the still (a subject adds 0.1 to
0.4 s to the first draw of each broad variant that carries it:
`tests/water/cover.test.ts` holds the broad variants to four).

After any change to what a frame costs, or to the flight's length,
**measure the cost map again** (`flight-frame-cost.mjs --map`):
`tests/water/pace.test.ts` fails when the map and the flight's length
disagree.

**A station laid in is a whole number of quarter screens long.** The
map is sampled every quarter screen, and the pace's choices at a steep
place (the canyon's mouth, the delta's first light) were settled on
those samples. A station 2.6 screens long moved every later sample a
tenth of a screen, and one stop past the lattice then read 11.6 ms at
rest against 11; at 2.5 every later station meets the samples where it
did (R3).

**A row added to `/work` is paid for in its HTML** (the last section of
this file): count the gzipped bytes before and after.

## How to measure

All against a production build (`pnpm build && pnpm exec next start -p
<port>`), alone on the GPU, with Playwright on `NODE_PATH`.

- `scripts/flight-frame-cost.mjs <url> <out>`: one drained frame at
  every quarter screen, both themes, 3456 by 2234 and 780 by 1688, with
  full shading at the screen's resolution. `--map
  src/water/cost-map.json` writes the cost map. `--governed` times the
  pace as shipped, at rest and travelling, with the resolution, rate and
  shading the engine chose; `--base 8.333 --speed 0.5` makes it choose
  as on the owner's machine (read the times against the M4 budgets
  above). Use `--repeat 3` or more with `--governed`: a single frame
  after a quiet spell reads long.
- `scripts/flight-picture.mjs capture|compare`: the pinned picture at
  rest against a reference build; `--scale 0.7` for what the travelling
  path draws.
- `scripts/flight-first-visit.mjs`: a first visit with programs the
  driver has never built (each fragment shader is given a fresh
  unreachable branch): time to the live picture, every late frame and
  long task after it with what was being built, and any program built
  within 400 ms of the reader's last act. `--warm` is the returning
  reader.
- `scripts/flight-rate-check.mjs`: the page at 120 Hz on a 60 Hz
  display (two frame callbacks to a real frame): scroll, entrance, the
  picture's clock and the pace against the same visit at 60.
- `scripts/flight-scroll-curves.mjs <a> <b>`: the same hand on two
  builds; where the scroll, the camera and the words stand against
  time.
- `scripts/perf-trace.mjs`: a real Chrome trace of a whole scroll
  (desktop 1440 and 1728 at 2x, a phone with the CPU slowed four times);
  frame intervals per screen, long tasks, the canvas's backing size.
- A program is truly built at its first draw and the driver keeps it
  between visits, so a harness that has run before sees no compile
  stall: test a first visit with `flight-first-visit.mjs`.
- To weigh a shader term, draw the whole frame with one variant and a
  switch defined (`engine.holdVariant(mask, ['DAY', 'DBG_NO_NAME'])`),
  each into a drained frame of its own.

For ice changes, run `NODE_PATH=<playwright modules> node
scripts/ice-frame-cost.mjs <production URL>` on the M4. Optional arguments
select comma-separated screen positions and themes. The harness pins the
camera, entrance, scene clock and shading tier. It verifies the drawing
buffer and waits for each tile's own shader. Three fresh Chromium
process groups rotate through the same stop, with only the measured
group running. After the water and shader settle, the harness parks the
live animation callback so it cannot enqueue extra draws between batches.
It warms the rotation for 24 rounds, then samples 72 batches of ten
completed frames per browser. Every timed draw ends with a synchronous
pixel read. Keep all three means and the raw groups. A range above
0.3 ms fails the comparison. Rotating sessions share the load of the
same time window. A small range can still hide a slowdown common to
all three. Absolute times on unchanged shaders can drift 2–3 ms between windows.
For a material change, compare the two builds at the same stop in one
browser session on the M4. Use the production programs and compile their
counterparts with the control shader body, same tile masks and themes.
Keep the pose, clock, simulation, 2880 × 1800 backing and tier fixed.
Alternate programs on the same tiles. Reverse the order on each round.
After 24 warm rounds, retain all 40 paired groups, four warm draws and
12 timed draws per program. Finish every draw with a pixel read. Report
the two means, their paired difference and the spread of those
differences. Use the separate absolute run to track the display budget.

## Where it stands (R2, 2026-11-22)

Measured on the M4 (60 Hz). "As his machine would choose" is the
engine told it has a 120 Hz display and a GPU twice this one
(`flight-frame-cost.mjs --governed --base 8.333 --speed 0.5`), with the
times it then takes here read against the M4 budgets above.

- **The frame at rest is unchanged**: 128 pinned frames against the
  build before R2, least similarity 0.999989, 113 identical to the
  pixel. Its cost is unchanged too (3456 by 2234, full shading, worst
  in a screen): 17 to 27 ms in the first two screens, 19 to 21 in the
  canyon, 9 to 16 at the stations, 5 to 9 elsewhere; 1.4 to 6.4 ms at
  780 by 1688.
- **At rest, as his machine would choose**: full resolution and full
  shading at every one of 130 stops. The scene is drawn every other
  interval (60 a second) at 43 of them: screens 0 and 1, the block's
  station by night, the stretch at 16 to 19 and the canyon at 24 to 28;
  every interval elsewhere. Over budget at 4 stops: screen 1 (22.3 to
  26.0 ms against 22) and one at 18 (11.6 against 11).
- **Travelling, as his machine would choose**: the scene at 0.70 to
  1.00 of the screen's resolution, median 9.9 ms. Over 11 ms at 10 of
  130 stops: screens 0 and 1 (12.7 to 16.0 at the floor), the block's
  station by night (11.1 to 11.7) and one canyon stop (11.3).
- **Open fault: the first two screens.** The lake's ice with the name
  costs 24 to 27 ms mid-melt; at the floor that is 13 to 16 ms on the
  move. On his machine that is 6.5 to 8 of his 8.3 ms: likely 120 with
  dropped frames there, 60 at worst. Its cost is spread through the
  sheet's own shading and the water under it (no one part is more than
  a tenth: `engine.holdVariant` with `DBG_NO_*`), and the swept field's
  and the name's pieces of the frame are already only as large as what
  they draw.
- **A first visit** (programs the driver has never built): the live
  picture at 5.8 to 6.7 s (2.1 to 2.5 s before R2, which then froze 0.9
  to 1.3 s some 25 times in a scroll). After it: no task over 50 ms, no
  program built within 400 ms of the reader's last act, one frame of 50
  to 80 ms as the picture comes up, and a held frame of 0.15 to 0.5 s
  for each program built while the reader rests (about eight near where
  he rests, 0.7 s apart). Three tasks of 60 to 390 ms remain behind the
  still (synchronous GL calls waiting on the driver's builds).
- **A returning visit**: the live picture at 0.9 to 1.1 s; a whole
  scroll at reading speed at 3456 by 2234 with no frame over 20 ms
  (17 to 31 before R2).
- **The engine's frame callback**: 0.2 ms at the median, 1.1 at p99;
  never over 1.5 ms while the page scrolls; 2 to 5 ms in the callbacks
  that hand a program to the driver, all at rest.
- **This M4 at 3456 by 2234** is its own slower tier (60 Hz, half his
  GPU): on the move 0.70 to 1.00 with leaner shading in the opening and
  the canyon; at rest full resolution except the opening, the block's
  station and the canyon (0.80 to 0.92), and 30 a second at the dearest
  stops (screen 1; by night screen 0 and three canyon stops too). Before
  R2 those stretches cost it 20 to 27 ms a frame, under 60 a second.
- **Lighthouse** (median of three): `/` 99 on the phone preset (97
  before), 100 on desktop; `/work` 93, a project page 92, `/blog` 94 on
  the phone preset, 100 on desktop; CLS 0.003. The inner pages' phone
  LCP is still 3.1 s (their loading order was not part of R2).

### With the vault laid in (R3, 2026-11-22)

Measured the same way on the same M4, the build before (`e9123c8`) and
the build after, side by side.

- **The flight is 2.5 screens longer** (34.9 of scroll). Every other
  station's pinned frame at its own stop against the build before: 52
  pairs (13 stops, both themes, wide and tall), least similarity
  0.999881, none under the 0.99 floor, 21 identical to the pixel; the
  least are in the first screens' moving water, far upstream of the
  change. The lattice differs by 6 of 255 at its worst pixel.
- **The cost map** was made again. Before the vault it moved by +0.03
  ms per megapixel at the median (wide) and -0.09 (tall): the run's
  own noise. After the vault every station meets the same samples as
  before (the vault is ten of them long): median 0.00 to +0.01 (wide),
  -0.03 to 0.00 (tall).
- **The vault's stretch**, full resolution and full shading at rest:
  0.83 to 1.04 ms per megapixel (6.4 to 8.0 ms at 3456 by 2234), under
  both neighbours' stops (the dam 1.15, the lattice 1.3). As his machine would
  choose (22 stops, both themes): full resolution, every interval, full
  shading; 9.2 ms at most at rest and 10.0 ms travelling (medians 7.3
  and 9.0); 4.1 ms at 780 by 1688. The dam's and the lattice's
  stretches read as before (medians 8.9 and 10.1 at rest against 8.9
  and 10.0; 9.9 and 10.2 travelling against 9.8 and 10.2). No stop of
  the three stretches is over budget, before or after.
- **Programs.** The lower river's broad program carries nine subjects
  where it carried eight (`coverFlight`); there are still three broad
  programs and 21 builds on a first visit.
- **A first visit**: the live picture at 5.90 s by day (5.77 before)
  and 6.43 s by night (6.34): the ninth subject's share of one broad
  program's first draw. No task over 50 ms after it, no program built
  while the reader moves, in either build.
- **Lighthouse** (median of three, the two builds in turn): `/` 98 on
  the phone preset and 100 on desktop, before and after; `/work` 93
  and 100, before and after; `/work/cc-switch` 92 and 100 before, 91
  and 100 after (runs of 82 to 93 in both); `/work/envfetch` 99 and
  100. `/work`'s HTML is 14,013 bytes gzipped with ten rows (14,026 to
  14,036 with nine): three of a row picture's eight widths are no
  longer offered (`FEAT_SKIP` in `still-pictures.tsx`).

What only the owner's machine and a real phone can settle is in
`.tools/out/r2/REPORT.md` of the R2 task: chiefly whether the first two
screens hold 120 on the move, and how long a first visit's wait is on a
phone's driver.

Change log: 2026-11-22 R3: the vault; a station's length in quarter screens.

Change log: 2026-11-18 first version (orchestrator). 2026-11-22 R2: the
budget for the owner's 120 Hz display, the pace, the programs, the
measuring scripts, where it stands.

## Inner pages: the stills are pictures (K2, 2026-11-20)

A scene band, a row of the work index and the way on at a page's foot
each show a committed still (`public/media/scenes`). They are served
through the image optimiser as AVIF or WebP at the width shown
(`src/components/work/still-pictures.tsx`): `BandStill` at a page's
head, `FeatStill` in the index, `nextPic` for the way on. Rules:

- The band's still is the page's largest paint. It is a `picture` in
  the HTML with `fetchpriority="high"`, never lazy, decoded with the
  first frame. Its `sizes` follow the band's height in `pages.css`
  (`BAND_SHARE`): change one, change the other.
- Do not add `<link rel="preload">` or react-dom's `preload()` for it.
  React carries both as hints in the data a `<Link>` prefetches, so
  every page that links to this one fetches its still at high priority
  beside its own: two or three extra stills (60 to 90 kB) on each page,
  seen in Lighthouse's network log.
- The picture is chosen by the system's scheme. A reader who has set
  the other theme gets the full file as the band's ground from CSS
  (`stills.ts`, `.band-still` in `pages.css`).
- Everything else is `loading="lazy"`, one `img` for each theme with
  the other `display: none`, so only the one shown is fetched.
- Stills ask for quality 90 (`images.qualities` in `next.config.ts`).
  At 75 the snow's grain is smoothed.
- The live band's engine is not fetched until the page has presented
  its first frame and the band is within half a screen of the viewport
  (`SceneBand.tsx`). Asked for earlier, its 180 kB of script races the
  still.
- Measure with a warm optimiser: the first request for a width encodes
  it. `tests/content/stills.test.ts` fails when a still's file and the
  size its picture reserves disagree.

Where it stands on the phone preset: Lighthouse's simulation counts
every request that finished before an image largest paint, scripts
that had begun to run included. On a local server that is the
framework's scripts (about 160 kB) and the fonts (140 kB) as well as
the still, so a page whose largest paint is a picture simulates at
about 3.5 to 4 s however small the picture is; a page whose largest
paint is text (the home page, Ask Around) simulates at its first
paint. See `.tools/out/k2/REPORT.md` of the K2 task for the numbers.

## Inner pages: nothing but the page before its first frame (K3, 2026-11-20)

Lighthouse charges an image largest paint with every request that
finished before it. So on an inner page nothing is asked for before the
first frame except what that frame needs. The rules, and where each
lives:

- **One gate.** `src/lib/calm.ts`: `whenCalm(fn)` runs `fn` at the first
  idle moment after the page has presented its first frame. Anything
  not needed for the first screen waits on it. Do not add a second
  mechanism.
- **Links.** Use `@/components/Link`, not `next/link`, on every page
  but the home page. It holds the framework's fetching ahead until the
  page is calm. The way home from an inner page is `ahead="intent"`:
  fetched only when reached for. Fetched ahead, it brought some 70 kB of
  the flight's code in before the first frame (60 kB of it the engine a
  band asks for later anyway, 10 kB the home page's own).
- **The scene band's engine** and smooth scrolling's library on an
  inner page wait on the same gate (`SceneBand.tsx`, `Runtime.tsx`).
- **Pictures under the first screen** are `Held` (`components/Held.tsx`):
  the work index's rows, the way on, every plate. `loading="lazy"` alone
  is not enough, a browser asks for a lazy picture at first layout if
  it is within a few screens. No plate takes `priority`.
- **A video's poster and source** are set when its slab is within a
  screen of the viewport (`VideoSlab.tsx`).
- **Fonts.** Pages load Latin cuts of the two variable fonts
  (`src/fonts/*-Latin.woff2`, made by `scripts/font-cuts.sh`); the whole
  fonts are fetched only for a character a cut leaves out
  (`globals.css`). The name's ice face is not preloaded. A font
  preload cannot be scoped to one route: the manifest lists a
  preloaded file for every route.

What an inner page still loads before its largest paint, on the phone
preset (about 325 kB): the framework's scripts (react-dom 70 kB, the
router 48 kB, 8 kB more) and the site's own (35 kB), the two fonts
(74 kB), the still (33 to 48 kB), the stylesheets (25 kB), the page
(12 kB) and the ground's textures (6 kB). That simulates at about
3.1 s and scores 92 to 93. See `.tools/out/k3/REPORT.md` of the K3 task.

## The newsletter's field adds no request (R1, 2026-11-21)

Its rules are in `home.css` and its script rides in `Ending.tsx`'s
module, both of which every page already loads: the home page still
loads 13 scripts and 3 stylesheets, `/blog` 10 and 3 (counted in the
served HTML, before and after). The route (`/api/subscribe`) is asked
only when a reader sends the form. See `newsletter.md`.

## An inner page's HTML fits a new connection's first round (R1, 2026-11-21)

A new connection sends about 14.6 kB before it waits for the reader's
side to answer, and Lighthouse's phone preset charges a document over
that with one more round trip on its first paint and its largest.
`/work` is the heaviest page: 14,558 bytes on the wire in yesterday's
build (14,040 of gzipped HTML and its headers). 250 bytes more of nav
markup (the sound control's speaker and cross as SVG, a longer script
after it) put it at 14,807 and took `/work` from 92 to 90 on a phone.
The control's shapes are now drawn in CSS and `/work` is at 14,039
bytes of HTML again.

So: anything added to the nav, the footer or the root layout is added
to every page. Count the gzipped HTML of `/work` before and after
(`curl -s -o /dev/null -w '%{size_download}' -H 'Accept-Encoding: gzip'
<base>/work`), and put shapes in CSS, not in markup.

