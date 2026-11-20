# Performance

Status: the budget is the rule now; the gate's owner profile and
first-visit run are **planned** (the frame budget task). The numbers
under "where it stands" are measured and dated.

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
