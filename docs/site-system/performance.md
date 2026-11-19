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
all three. Compare the absolute times against the published ceilings.

## Where it stands (2026-11-18, before the frame budget task)

1440 at 2x: 1.6 to 2.8 percent of frames slow, all in the first two
screens and the canyon. 1728 at 2x (about the owner's size): 5.8 to
9.7 percent. The name's plates and the canyon are over budget. A
first visit holds about eight frames for about 8 s in a scroll. These
are open faults, not the standard.

Change log: 2026-11-18 first version (orchestrator).
