# Performance

Status: since V1 (2026-11-20) the home page plays the flight from frames
rendered ahead of time; "The played flight" below is what a visitor's
page costs and how to measure it. The sections after it ("The budget",
"What a new section may cost", "How to measure", "Where it stands")
describe the **engine**, which is now the renderer and runs only on
`/render`: they are what a frame costs to render, not what a visitor
waits for. Point the engine's own scripts (`perf-trace.mjs`,
`flight-frame-cost.mjs`, `ice-frame-cost.mjs`, `capture-og.mjs`) at
`/render`.

## The played flight (V1, 2026-11-20)

The gate, on the production build, for every page: Lighthouse
performance 95 or more on the phone preset and 100 on desktop; largest
paint under 1.2 s on desktop and 2.0 s on a phone; layout shift under
0.02; no task over 50 ms after the first paint; interactions under 100
ms; no frame interval over 20 ms on a 60 Hz display while the home page
is scrolled; `public/flight/` 100 MB or less (6 MB of it the live
layer's masks).

What the home page does, and the rule behind each part:

- **First paint.** The first frame's still is a picture in the HTML
  (`FlightPlayer.tsx`): a source for each shape and scheme, its size
  reserved, `fetchpriority="high"`. No preload link (see the inner
  pages' note below: React carries a preload to every page that links
  here).
- **Nothing of the player before the first paint.** `player.ts`, its
  worker and `warp.ts` are one lazy chunk, asked for at the first idle
  moment after the first paint. The canvas and the decoder are made in a
  task of their own after the words are set.
- **Marks on the picture's own layer, not on the document.** The player
  says "the picture is up" with an attribute on `.flight-root`. An
  attribute on `<html>` makes the browser look at every element's style
  again; `data-flight="on"` is the one such mark, set once.
- **One frame loop** (`src/lib/frame.ts`), stopped while the tab is
  hidden. Per frame: one spring step, attribute writes only where a
  word's state changes, the captions' transforms only when the place
  changes, one draw only when the frame to show changes. At rest nothing
  is written and nothing is drawn.
- **Decoding off the main thread** (`decode.worker.ts`): fetching by
  byte range, WebCodecs, a window of 14 frames. The main thread uploads a
  decoded frame as a texture when it first draws it.
- **Bytes by need.** On a load: the index (5 to 10 kB), the camera file
  (51 kB), the entrance's first half second and the first two screens of
  the flight. Then three keyframe groups (a screen and a half) ahead of
  the reader and one behind, as they travel.
- **The cut.** A jump of more than 2.5 screens (a rail tick, End, a
  reload part way down) is not flown: the picture holds, the frames for
  the new place are fetched and decoded, and it comes in under a 260 ms
  dissolve.

### The live layer (V2, 2026-11-20)

`src/flight/live.ts` draws over the played picture every frame, at rest
too, so its cost is the page's resting cost. Its budget, a frame, on
this M4: **1 ms of GPU time and 0.5 ms of the page's thread at a 3456 x
2234 output; a quarter of that on a phone's**; no program compile over
10 ms; 12 kB of script (gzipped) after the first paint and none before;
two programs (three at most).

How it stays inside it:

- **Its canvas is a pixel to a CSS pixel** on a large screen (1728 x
  1117 under a 3456 x 2234 window), 1.25 on a phone. The layer is soft
  by nature; the picture under it is what is sharp. This is the layer's
  own canvas, never the picture's: the rule against lowering the scene's
  resolution stands.
- **One pass over the window** for water, pointer and gate (the mask:
  one lookup at rest, two between frames; a 64 x 64 noise tile, not
  hashed noise), then the flakes as points, only as many as are out.
- **Programs compiled off the page's thread**
  (`KHR_parallel_shader_compile`), taken up in the frame that finds them
  done.
- **Masks by need**: a sheet a screen of scroll (about 37 kB wide, 26 kB
  tall), decoded off the thread (`createImageBitmap`), four kept.
- **Nothing read from the page each frame**: the words' boxes are read
  when the blocks change and when the picture comes to rest, and a
  uniform is handed to a program only when its value has changed.
- **A governor**: with the picture at rest the layer is all that is
  drawn, so frames that run long then are its doing. It halves the
  flakes, then removes itself; it never comes back in that visit.

Measured (`scripts/live-cost.mjs`: a timer query round the layer's own
draw, the median of 40 at each of eight stops; the page's thread timed by
the layer over every frame of the stay):

| Output | GPU, median at a stop | Page's thread, mean | Compile on the thread | Longest frame while it starts |
| --- | --- | --- | --- | --- |
| 3456 x 2234 (layer 1728 x 1117) | 0.40 to 0.72 ms | 0.12 to 0.20 ms | 0.5 ms | 18.8 ms |
| phone, 1170 x 2532 (layer 488 x 1055) | 0.13 to 0.23 ms | 0.13 to 0.19 ms | 0.4 ms | 18.6 ms |

(The timer's ninth decile reads 1.2 to 2.1 ms at some stops and equals
the median at others: the page's own frame lands inside the query there.
The dearest stop is the ending, where the whole lower frame is water.
The page's thread does not get cheaper with a smaller output: on a
phone's output it is at the quarter budget, 0.125 ms, or a little over
it, measured on this machine with a 0.1 ms clock.) With the layer
running: Lighthouse on `/` 100 and 100 (three runs), the cold scroll
traces with no interval over 16.8 ms and no long task, the worst
interaction 40 ms wide and 64 ms on the phone profile.
Script: the layer's chunk is 9.0 kB gzipped and the player's grew 0.3
kB. `scripts/live-states.mjs` shows reduced motion, the hidden tab and
the governor; `scripts/live-picture-same.mjs` that the picture under the
layer is byte for byte the picture without it;
`scripts/live-evidence.mjs` photographs each part.

How to measure (alone on the machine; a render or an encode running
beside it spoils every number):

- `scripts/player-trace.mjs`: a cold visit scrolled top to foot,
  `--profile wide|desk|tall`, `--run read|fling`. Frame intervals, long
  tasks, bytes over time, frames held, decode cost, heap.
- `scripts/inp-test.mjs`: the scripted interactions and the worst.
- `scripts/engine-absent.mjs`: every script each route fetches, and a
  failure if any carries the engine.
- `scripts/flight-match.mjs`: the played frame beside the engine's.
- Lighthouse through the orchestrator's `lh.sh`, three runs, the median.
  Lighthouse's headless Chrome has no GPU: WebGL and canvas are drawn by
  the CPU there, so the player's first frames cost more in its trace
  than on any real device. `player-trace.mjs --software` reproduces that.

Where it stands (2026-11-20, Apple M4, Chromium 159, a 60 Hz display,
production build; the full tables are in the V1 task's
`.tools/out/v1/REPORT.md`):

| | Phone preset | Desktop preset |
| --- | --- | --- |
| `/` Lighthouse performance (median of 3) | 100 | 100 |
| `/` largest paint | 1.05 s | 0.28 s |
| `/` layout shift | 0.004 | 0.000 |
| inner pages, performance | 94 to 96 | 100 |
| inner pages, largest paint | 2.8 to 3.1 s | 0.63 to 0.67 s |

- A cold scroll of the whole home page, a screen a second and in
  flings, 1728 x 1117 at 2x and 390 x 844 at 2x: every frame interval
  16.7 or 16.8 ms, none over 20 ms, no long task. A frame decodes in 1.3
  to 2.8 ms in the worker (AV1; 2560 x 1440 wide, 780 x 1688 tall).
- First paint 56 to 72 ms, first played frame 160 ms after navigation
  (a local server).
- Bytes: 3.7 MB before the first scroll on the wide picture (the
  entrance, and the first two screens, which are the dearest of the
  flight), 1.6 MB on the tall one; the whole flight 17.7 MB wide, 6.3 MB
  tall.
- Memory: 14 decoded frames at most, 74 MB wide and 26 MB tall (a
  frame is held as 4:2:0); script heap 8 MB.
- Worst interaction 40 ms (the theme's toggle).
- `public/flight/`: 85.8 MB of the 90 allowed
  (`tests/flight/streams.test.ts` fails over the limit).

What does not meet the gate: the inner pages on the phone preset (94 to
96, largest paint about 3 s simulated). That is the still's simulated
cost described under "Inner pages" below, as before V1; the engine no
longer loads on those pages at all. Not verified here: a 120 Hz display
(this one is 60 Hz), and any real phone.

## The budget

On the owner's display (1920 by 1080 at 2x on an Apple M4 with 10 GPU
cores; also a 120 Hz MacBook Pro), production build:

- Frame time: p95 16.7 ms or under and under 1 percent of frames over
  25 ms, **on every screen of scroll**, in both themes. No section
  more than 2 ms dearer at p95 than its neighbours.
- 120 Hz only where full shading holds it; otherwise a steady 60.
- First visit: no frame held over 60 ms while the reader is moving.
- No task over 50 ms after first paint.
- **Never** lower resolution, blur or upscale. Device pixel ratio
  capped at 2.
- GPU textures 64 MiB or less; JS heap under 60 MB; one WebGL context
  on the home page; nothing draws off screen.
- Phones: 60 with no slow frame on the phone profile.

## What a new section may cost

A station's own code runs only in its own piece of the frame
(`src/water/variants.ts`). A new station must: add no full-screen
pass; keep its per-pixel work inside its piece; prefer a few reads
from small baked or tiling textures to procedural noise in the pixel;
add at most one shader variant (each is built by the driver at its
first draw, 0.1 to 1.6 s on a first visit) and say so; cost no more
per frame than the median of the existing stations.

## How to measure

- `scripts/perf-trace.mjs` on `/` against a production build
  (`pnpm build && pnpm exec next start -p <port>`), alone on the GPU.
  Profiles: desktop 1440 and 1728 at 2x, a phone, a contended
  desktop, 2560 at 2x; `--theme light|dark`. It prints p50, p95, p99
  and slow frames **per screen**. (Planned: a `desktop-1920-dpr2`
  profile, a first-visit run with programs the driver has never
  built, a memory read.)
- One frame's cost at a stop: draw the scene extra times and take the
  difference, **each extra draw into a target of its own** (a second
  draw into the same target is culled by the GPU), with full shading
  pinned (`window.__flight.engine.holdLean(0)`).
- A program is truly built at its first draw and the driver keeps it
  between visits, so a harness that has run before sees no compile
  stall. Test a first visit with programs made new.

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

## Where it stands (2026-11-18, before the frame budget task)

1440 at 2x: 1.6 to 2.8 percent of frames slow, all in the first two
screens and the canyon. 1728 at 2x (about the owner's size): 5.8 to
9.7 percent. The name's plates and the canyon are over budget. A
first visit holds about eight frames for about 8 s in a scroll. These
are open faults, not the standard.

Change log: 2026-11-18 first version (orchestrator).

For the quarter-screen survey on Metal, run `scripts/flight-frame-cost.mjs`
with the production URL and an output directory. Each row times one complete
engine callback at full shading with a drained queue and a hardware timer query.
CPU time covers submission inside the engine. The query can include time
waiting for submission. Use the repeated ice benchmark for small differences.
Pass `--cold` to the scroll trace to insert a unique, unreachable discard in
each fragment program and exercise first use.

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
- There is no live band any more (V1): no engine is fetched on an inner
  page. The band is its still.
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
- **Smooth scrolling's library** on an inner page waits on the same gate
  (`Runtime.tsx`). (The scene band's engine used to: since V1 no inner
  page loads it.)
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

## Inner pages: the first round, and the count of requests (F1, 2026-11-21)

Two more things the phone preset's simulation charges for, both found by
reading a report's request log (`a['network-requests']`), not its score:

- **The page's HTML must fit a server's first round.** A new connection
  sends about 14.6 kB before it waits for an answer; a page whose HTML
  (headers and all) is over that pays another round trip, 150 ms on the
  preset, on its first paint and its largest. Here that is about
  **14.0 kB of gzipped HTML** (`curl -s -H 'Accept-Encoding: gzip' <page>
  | wc -c`). `/work` was 14.2 kB and grew to 15.9 with its second group;
  it is 13.5 now. What was taken out of every page:
  - **A held picture says its widths once** (`pack` in `Held.tsx`,
    `data-set`; `Runtime.tsx` writes the same `srcset` out again;
    `tests/content/held.test.ts` holds the two together). The lists of
    the work index's eighteen pictures were a quarter of its HTML, each
    carried twice (in the page and in the data it hydrates from).
  - **The 404's picture is its band's ground, from CSS** (`band-ground`).
    The root's not-found page is carried in the data of every page, and
    its picture's four lists of addresses were in each of them.
  - **The site's structured data is on the home page only**
    (`src/app/page.tsx`). In the root layout it was 0.6 kB of every
    page, twice.
- **Every script file before the largest paint is a request of its own**
  on the six connections the simulation gives a page. The bundler
  splits by the size of the source: a few hundred bytes more in
  `src/components/Nav.tsx` (comments included) moved three small
  loaders into a file of their own, a ninth request on every page, and
  that alone cost `/blog` and Upstream a point each. So the theme
  switch is one element with its layers drawn in CSS, and `Nav.tsx`
  keeps its commentary in `nav.css`. After a change to anything in the
  layout's script (`Nav`, `Runtime`, `SoundToggle`, `Link`), count:
  `curl -s <page> | grep -o '<script src="[^"]*" async' | wc -l` gives
  8 on `/blog` and 9 on `/work` and the project pages. One more is a
  point lost; find what grew.
- **A client component of its own is a script of its own, and a sheet
  it imports is a stylesheet of its own.** The newsletter's field was
  both, and `/blog` went from 96 to 95 on a phone (largest paint 2.78 s
  to 2.93 s). Its rules are in `home.css`, which every page loads, and
  the component has no `'use client'`: it is exported through
  `Ending.tsx`, whose script every page loads. `/blog` is at 8 scripts
  and 3 stylesheets again.
- Build clean before measuring (`rm -rf .next`): an incremental build
  can split differently from a clean one.

What is still over the first round: Upstream (14.2 kB: its ledger of
merged pull requests is the page) and the post (17.4 kB: the article
itself, carried twice by the framework). Both paint a round trip later
than the rest and score 93 to 94.

Interactions on an inner page: `scripts/inp-inner.mjs` (`--profile
tall`, `--slow 4`). Worst on `/work` and cc-switch's page: 72 ms wide,
88 ms on a phone's screen, 72 ms with the thread four times slower (the
theme's turn each time).

Where the pages stand (2026-11-21, the median of three runs each, a
clean production build on a local server, Apple M4; accessibility, best
practices and SEO are 100 on every route in both presets):

| Route | Phone before | Phone after | Phone LCP before | after | Desktop before | after | Desktop LCP before | after | CLS after (phone) | TBT after (phone) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 100 | 100 | 1.05 s | 1.05 s | 100 | 100 | 0.28 s | 0.28 s | 0.004 | 10 ms |
| `/work` | 93 | 94 | 3.22 s | 3.08 s | 100 | 100 | 0.67 s | 0.63 s | 0.004 | 10 ms |
| `/work/infiniview` | 94 | 94 | 3.08 s | 3.08 s | 100 | 100 | 0.67 s | 0.67 s | 0.004 | 11 ms |
| `/work/open-source` | 93 | 93 | 3.23 s | 3.23 s | 100 | 100 | 0.70 s | 0.70 s | 0.004 | 10 ms |
| `/work/ollama` | 94 | 94 | 3.08 s | 3.08 s | 100 | 100 | 0.66 s | 0.67 s | 0.004 | 11 ms |
| `/work/cc-switch` | 94 | 94 | 3.08 s | 3.08 s | 100 | 100 | 0.68 s | 0.68 s | 0.004 | 10 ms |
| `/work/kilo-bench` | 95 | 95 | 3.00 s | 3.00 s | 100 | 100 | 0.67 s | 0.67 s | 0.004 | 10 ms |
| `/work/ask-around` | 95 | 96 | 2.99 s | 2.78 s | 100 | 100 | 0.62 s | 0.62 s | 0.004 | 10 ms |
| `/work/rydar` | 95 | 95 | 2.93 s | 2.93 s | 100 | 100 | 0.62 s | 0.63 s | 0.004 | 11 ms |
| `/work/agent-bridge` | 94 | 94 | 3.07 s | 3.14 s | 100 | 100 | 0.66 s | 0.67 s | 0.004 | 7 ms |
| `/work/tensorpow` | 94 | 94 | 3.09 s | 3.14 s | 100 | 100 | 0.68 s | 0.68 s | 0.004 | 6 ms |
| `/blog` | 96 | 96 | 2.78 s | 2.77 s | 100 | 100 | 0.62 s | 0.62 s | 0.004 | 10 ms |
| `/blog/three-ai-agents-five-saas-products` | 94 | 93 | 3.08 s | 3.15 s | 100 | 100 | 0.67 s | 0.67 s | 0.004 | 10 ms |

The phone preset's largest paint moves in steps of about 70 ms from one
build to the next on the same page (which connection a file is given,
and whether the ground's small textures are asked for before or after
the first layout). A page within a step of a boundary, as the post is,
can show a point either way with nothing changed on it. The inner pages
whose largest paint is a picture stay at 93 to 96: the simulation
charges that paint with the framework's scripts (about 160 kB) and the
two fonts (75 kB), as "Inner pages: nothing but the page before its
first frame" above says, and nothing more of that can be taken without
changing what the pages are.

Change log: 2026-11-20 V1: the played flight, its rules, its measures. 2026-11-21 F1: the first round and the count of requests. N1: the newsletter's field adds no request.
