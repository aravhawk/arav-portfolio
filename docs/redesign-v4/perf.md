# Performance: what went wrong in v3 and what v4 does about it

The owner's report on v3: "sometimes, even on my extremely powerful [...] machine, it'll actually start lagging for some reason and get the animations blurry and lower quality."

This document finds the cause in v3's code, reproduces it with measurements, and turns it into rules for v4.

## How it was measured

- Site under test: v3 production build at `http://localhost:3123` (worktree `redesign-fable-v3-20261114`, head `d1e3410`). Control: v2 production build at `http://localhost:3113`.
- Machine: Apple M4, 10 cores, 60 Hz display. Headless Chromium from Playwright 1.65.1 on ANGLE Metal with the GPU enabled, viewport 1440 x 900 at device pixel ratio 2. WebKit from the same Playwright for a second engine. The owner's machine is faster and was not measured; what follows for it is inference and is marked as such.
- Script: `~/.t3/portfolio-redesign-v4/tools/v2v3/perf.js`. One run is: load, 10 s idle on the hero, pointer circles over the hero subject, drag it, a slow wheel scroll down the whole home page (40 px every 40 ms), a fast scroll back up. A `scrollfirst` variant scrolls before the hero interaction.
- Per frame it logs: the frame interval, the canvas backing-store size against its CSS size, scroll position, how many requestAnimationFrame callbacks ran and how long they took, how many canvas-to-texture uploads happened, how many `getBoundingClientRect` and `fillText` calls ran, and the engine state. GPU time for the on-screen draw is read with `EXT_disjoint_timer_query_webgl2`. Long tasks and long animation frames come from `PerformanceObserver`.
- Chrome traces are recorded through a CDP session (`Tracing.start`, timeline, frame and GPU categories) and summarised per phase by `tools/v2v3/trace_stats.py`. Frame logs are summarised by `tools/v2v3/analyze.py`.
- Two sets of runs exist. The first set ran while other WebGL capture jobs were using the same GPU (load average 34 to 59). They are kept because they show what v3 does when the GPU is contended. The second set ("quiet") ran with load average 3.4 to 5.3 and is the clean baseline.

Files, all in `~/.t3/portfolio-redesign-v4/traces/`:

| File | What |
|---|---|
| `v3/chromium-dpr2-quiet-cold-trace.json.gz` (+ `-frames.json`, `-trace-summary.txt`) | Clean machine, full run, with tracing. Chrome DevTools opens the `.gz` directly |
| `v3/chromium-dpr2-quiet-scrollfirst-frames.json`, `-quiet-seen-frames.json`, `-quiet-cpu4x-frames.json` | Clean machine, no tracing: scroll first; intro skipped; 4x CPU throttle |
| `v3/chromium-dpr2-cold-trace.json.gz`, `v3/chromium-dpr2-scrollfirst-trace.json.gz` (+ frames; summary for the first) | Contended GPU, with tracing |
| `v3/chromium-dpr2-cold-notrace-frames.json`, `-seen-notrace-`, `-cpu4x-notrace-`, `chromium-dpr1-cold-notrace-` | Contended GPU, no tracing |
| `v3/webkit-dpr2-cold-frames.json` | WebKit, contended |
| `v2/chromium-dpr2-quiet-cold-frames.json` | v2 control, clean |
| `v2/chromium-dpr2-cold-trace.json.gz` (+ frames, summary), `v2/chromium-dpr2-cpu4x-notrace-frames.json`, `v2/webkit-dpr2-cold-frames.json` | v2 control, contended |

The capture sets in `~/.t3/portfolio-redesign-v4/v2v3/` are a second source: every `_frames.json` there records the canvas width for each screenshot.

## Root cause of v3's lag and blur

Short version: v3 spends nearly the whole frame on one full-screen raymarch, so it has no headroom, and a quality governor that only ever steps down turns any slow moment into a permanent loss of resolution.

### 1. The governor is a one-way ratchet

`src/gl/engine.ts:6-11`:

```ts
const TIERS = [
  { scale: 1, steps: 64, inner: 22 },
  { scale: 0.8, steps: 56, inner: 18 },
  { scale: 0.62, steps: 48, inner: 14 },
  { scale: 0.48, steps: 40, inner: 10 },
];
```

`src/gl/engine.ts:176-186`, the scale multiplies a device pixel ratio that is already capped:

```ts
const cap = w < 768 ? 1.25 : 1.5;
this.dpr = Math.min(window.devicePixelRatio || 1, cap) * TIERS[this.tier].scale;
...
c.width = Math.max(2, Math.round(w * this.dpr));
c.height = Math.max(2, Math.round(h * this.dpr));
```

`src/gl/engine.ts:271-282`, the whole policy:

```ts
// Adaptive quality: step down a tier when frames stay long.
if (dt > 0.026) this.slow++;
else this.slow = Math.max(0, this.slow - 0.25);
if (this.slow > 24) {
  this.slow = 0;
  if (this.tier < TIERS.length - 1) {
    this.tier++;
    this.resize();
  } else if (dt > 0.05) {
    this.els.onGiveUp?.();
  }
}
```

What that code does:

- A slow frame adds 1 and a good frame removes 0.25, so the counter climbs whenever more than one frame in five is over 26 ms. Twenty-five net slow frames (under a second of real trouble) costs a tier.
- There is no code path that lowers `this.tier`. A tier lost is lost until the page is fully reloaded. Client-side navigation keeps the engine, so it also follows the visitor to /work, project pages and the blog.
- The threshold is a fixed 26 ms. It does not know the display's refresh rate. Anything that holds the page at 30 frames a second makes every frame "slow" (33 ms), which walks the canvas to the bottom tier in about 2.5 seconds and leaves it there. Derived from the code, not measured here.
- It measures during the least representative moments: the intro and the first seconds after load.
- At the bottom tier, one more bad stretch calls `onGiveUp` (`src/components/StageRoot.tsx:76-81`), which destroys the WebGL engine and shows `.drop-css` (`src/app/globals.css:139-152`): a fixed, viewport-anchored blob with a 10 px backdrop blur. It does not scroll with the page, so from then on it floats over content (`v2v3/v3/chromium-1440/work-archive-03.jpg`).

The resolution each tier produces for a 1440 x 900 viewport on a 2x screen (native 2880 x 1800):

| Tier | Canvas | Canvas pixels per CSS pixel | Share of native pixels |
|---|---|---|---|
| 0 | 2160 x 1350 | 1.50 | 56% |
| 1 | 1728 x 1080 | 1.20 | 36% |
| 2 | 1339 x 837 | 0.93 | 22% |
| 3 | 1037 x 648 | 0.72 | 13% |
| gave up | CSS blob with `backdrop-filter: blur(10px)` | | |

Tier 3 draws the glass at 0.72 pixels per CSS pixel and the browser stretches it over a 2x screen beside type that is drawn at full resolution. That is the "blurry and lower quality". The ray step counts drop with it (64 to 40 outer, 22 to 10 inner), which softens the refraction further. On phones the cap is 1.25, so the canvas is 488 px wide for a 390 px, 3x screen even at tier 0.

### 2. It happens in practice

Canvas backing-store width over time, one row per run. "Share slow" is the share of all frames in the run with an interval over 26 ms.

| Run | Conditions | Tier 1 at | Tier 3 at | Gave up at | Share slow |
|---|---|---|---|---|---|
| quiet-scrollfirst | clean, no tracing | never | never | never | 0.0% |
| quiet-seen | clean, no tracing, intro skipped | never | never | never | 0.2% |
| quiet-cpu4x | clean, no tracing, 4x CPU throttle | never | never | never | 0.3% |
| quiet-cold | clean, tracing on | 12.4 s | reached tier 2 at 45.4 s | never | 5.3% |
| WebKit capture walk | clean, one other capture running | cc-switch beat | Merlin beat | never | n/a |
| cold | contended GPU, tracing | 4.5 s | 8.0 s | before the scroll | 8.4% |
| cold-notrace | contended GPU | 2.7 s | 5.8 s | 37.0 s | 13.0% |
| seen-notrace | contended GPU, intro skipped | 3.1 s | 5.5 s | 12.3 s | 11.1% |
| cpu4x-notrace | contended GPU, 4x CPU | 2.7 s | 7.0 s | 150.1 s | 13.9% |
| dpr1-cold-notrace | contended GPU, 1x screen | 6.6 s | 10.5 s (691 px wide) | 28.4 s | 22.9% |
| scrollfirst | contended GPU, tracing | 3.2 s | 6.5 s | 10.1 s | 5.6% |
| WebKit | contended GPU | 12.0 s | 15.5 s | 26.5 s | 19.5% |

Reading it:

- With nothing else touching the GPU, v3 holds tier 0 and 60 frames a second for the whole run. This is why it looked fine in its own review ("60fps measured").
- The overhead of recording a trace was enough to cost two tiers on an otherwise clean machine. In that run 5.3% of frames were slow, and the page lost 62% of its canvas pixels for the rest of the session. After the second step the draw took 4.5 ms and the page had plenty of room, but nothing steps back up.
- In the WebKit screenshot walk the canvas went 2160, 1728, 1339, 1037 between the cc-switch and Merlin beats (`v2v3/v3/webkit-1440/_frames.json`, `home-36.jpg` to `home-52.jpg`) with only one other capture running.
- With the GPU shared, every run hit the bottom tier within 5.5 to 15.5 seconds of loading, and every one ended on the CSS blob. Skipping the intro did not help. A 1x screen did not help.
- Every tier step is itself a hitch. `resize()` reallocates the WebGL drawing buffer and the 2D mask canvas, throws away the font cache and forces the mask to be redrawn and uploaded. The long task at each step measured 82 to 91 ms on the clean machine and 77 to 355 ms when contended (for example steps at 2.70, 3.93 and 5.78 s with long tasks at 2.58, 3.97 and 5.85 s).

The v2 control, same machine and same contention: the canvas is 2160 x 1350 in every frame of every run and every capture, because v2 fixes its resolution once (`redesign-fable-v2-20261114/src/world/engine.ts:283`). Under contention v2's frame rate fell to 35 to 51 a second, and it stayed exactly as sharp as before. On the clean machine it had 3 slow frames in 5,499. v2 degrades by dropping frames. v3 degrades by dropping frames and then dropping resolution for good.

### 3. Why there is no headroom: one pass eats the frame

v3 draws a single full-screen triangle with a raymarching fragment shader, every frame, whether or not anything changed.

- It never idles. `engine.ts:267-269` skips the draw only under reduced motion. The surface wobble is driven by time, so a visitor reading the hero is paying full price 60 times a second.
- The shader is heavy per pixel. `src/gl/shader.ts:312-319` marches up to 64 steps; each step calls `map()` (`shader.ts:194-221`), which evaluates up to three blended forms plus five satellite droplets with smooth minimums and a three-way sine wobble. Then four more `map()` calls for the normal, up to 22 for the path through the body (`335-341`), four more for the exit normal, and three backdrop lookups for dispersion (`350-359`). Worst case is about 94 distance-field evaluations for one pixel.
- A lot of pixels pay it. The early-out is a circle of 1.75 radii around the body (`shader.ts:291`, `engine.ts:337`). On the hero the radius is 0.33 of the short side (297 px), so the marched circle has a radius of 520 px: about 65% of a 1440 x 900 viewport. During the intro the bound is 7.75 radii, which is the whole screen.

GPU time for that one draw call (timer query, clean machine, 2160 x 1350):

| Where | p50 | p95 | max |
|---|---|---|---|
| Whole run, three clean runs | 8.3 to 9.6 ms | 11.0 to 13.5 ms | 18.5 to 37 ms |
| Idle on the hero | 9.7 to 12.5 ms | 11.1 to 14.0 ms | 16.6 ms |
| Merlin beat | 9.8 ms | 13.9 ms | 17.1 ms |
| Infiniview beat | 9.3 ms | 12.0 ms | 15.3 ms |
| Contact beat (smallest body) | 5.9 ms | 9.0 ms | 13.7 ms |

And by tier, which shows the cost follows pixel count:

| Canvas width | Clean (with tracing) p50 / p95 | Contended p50 |
|---|---|---|
| 2160 | 14.8 / 20.8 ms | 23 to 52 ms |
| 1728 | 5.4 / 13.4 ms | 18 to 41 ms |
| 1339 | 4.5 / 8.9 ms | 11 to 18 ms |
| 1037 | not reached | 3.5 to 11 ms |

A 60 Hz frame is 16.7 ms. The draw alone takes 8 to 13 ms of it on this machine before the browser composites anything. In the clean trace, while the hero sat at tier 0, the GPU process main thread was busy for 9,891 ms of a 10,000 ms window (99%); the renderer main thread was busy 8%. Once tiers had been dropped it fell to 33% over the scroll down (tiers 1 and 2) and 18% on the scroll back up (tier 2) (`v3/chromium-dpr2-quiet-cold-trace-summary.txt`).

So the page is GPU-bound, not script-bound. Throttling the CPU 4x changed nothing on the clean machine (0.3% slow frames, same GPU times). Script inside animation frames is 0.3 to 0.5 ms at the median.

### 4. What the browser has to composite on top

All of this sits over a canvas that changes every frame, so none of it can be cached:

- 24 elements with `backdrop-filter` on the home page (`globals.css:165-181`): the nav, four hero readouts, a pane per project. Blur 22 px plus saturate and brightness.
- In Chromium, panes marked `refract` replace that with an SVG filter chain inside `backdrop-filter`: a blur, an image, three displacement maps, three colour matrices and two blends (`src/components/Glass.tsx:113-127`).
- A full-viewport grain layer with `mix-blend-mode: overlay` at `z-index: 40` (`globals.css:154-157`), which forces a blend of the whole page every frame.
- 15 elements with `filter` transitions (`blur(8px)` to `blur(14px)` on words and panes, `globals.css:304-321`, `353`), including blur animated on a wrapper whose child has a backdrop filter.
- The canvas is created with `alpha: true` and premultiplied alpha (`engine.ts:43`) and stacked between two DOM layers, so it is blended, never an opaque layer.

I could not separate the cost of each of these from the raymarch in the traces. What the data does show: when the engine gave up and only the DOM was left, the same page with all 24 backdrop filters ran at a flat 60 frames a second even on the contended machine (scrollfirst run after 10 s: 0 slow frames in 614 while idle, 31 in 1,514 with the pointer moving, 4 in 2,018 while dragging). The filters alone are affordable. The filters on top of a canvas that already uses most of the frame are what tips it over.

### 5. Main-thread work on the frame path

None of this is the root cause on Chromium (script time is small), but it is waste, and one item is a real cost in WebKit.

- Animation-frame loops: three run permanently on the home page and three more conditionally. Engine frame (`engine.ts:246`), the home conductor (`src/components/home/Home.tsx:301-363`), Lenis with `autoRaf` (`StageRoot.tsx:48`); plus the glass rim update on pointer move (`Glass.tsx:51-58`), the magnet springs (`src/lib/magnet.ts:15-32`), and the loader (`Home.tsx:263-280`). Measured: 3.0 to 3.6 callbacks per frame.
- React state on the frame path: the loader calls `setLoad` every frame for the first one to two and a half seconds (`Home.tsx:268`), re-rendering the whole home tree while the shader is compiling and the intro is drawing its most expensive frames. The nav sets state from the scroll event (`src/components/Nav.tsx:22-27`).
- Layout reads every frame: 30 `getBoundingClientRect` calls per frame while scrolling and about 40 while the pointer moves. The conductor measures all eleven sections each frame (`Home.tsx:305`), the mask measures every refracted element (`engine.ts:200`), every glass pane measures itself on pointer move (`Glass.tsx:28`).
- A texture rebuilt and re-uploaded while scrolling. The drop refracts the page's type by sampling a mask. `drawMask` (`engine.ts:195-238`) redraws all visible display type into a 2D canvas (1900 x 1188 at this viewport) with `fillText`, uploads it with `texImage2D` and builds a full mip chain, whenever any refracted element has moved by a pixel. Measured: 2,564 to 2,590 uploads in a 57 s scroll, 76% of frames. In Chromium the upload is asynchronous and costs the main thread about 0.1 ms. In WebKit it is synchronous: 24 ms at the median per upload while scrolling and 31 to 52 ms at rest (contended run, so treat the size as an upper bound, but it is a main-thread stall either way).
- `document.querySelectorAll('[data-refract]')` every 45 frames (`engine.ts:253-256`).

First load: the hydration task is 92 ms on the clean machine. On the contended machine it was 1.6 to 1.9 s in two runs.

### 6. What this means for the owner's machine (inference)

Not measured, so stated as reasoning:

- A faster GPU buys headroom, but the owner's screen probably asks for more. A larger window means more pixels inside the marched circle, and a 120 Hz display halves the frame budget to 8.3 ms while the engine draws twice as often. The draw is 8 to 13 ms on the test machine at 2.9 megapixels. A GPU twice as fast still spends about half to all of a 120 Hz frame on it.
- So on that machine too the page runs near its limit, and "sometimes" is exactly how a ratchet with no recovery presents: fine until one bad stretch (another GPU-heavy app or tab, a video, an external display, battery or low-power mode, a browser frame cap), then soft for the rest of the session.
- "start lagging" and "get blurry" are the same event seen twice: the slow frames that trigger the governor are the lag, the governor's response is the blur, and each step adds a visible stall of its own.

### v2, for comparison

- Fixed resolution: `min(devicePixelRatio, 1.5, 2600 / longest side)`, never changed. Sharpness is constant. It is also constantly a little soft on 2x screens, and its mirror renders at 0.85 of that.
- Clean machine: 60 frames a second, 3 slow frames in 5,499, no long tasks. Contended: 35 to 51 frames a second, resolution unchanged. WebKit: 58 to 60.
- Zero backdrop filters, blends or CSS filters on the home page. One 14 px backdrop blur on the sheet of inner pages and one on the mobile menu.
- Three permanent animation-frame loops (engine, story, Lenis), like v3. Unlike v3 it keeps React state off the frame path: the canvas and the DOM share one plain mutable record (`src/world/store.ts`) and the loader writes text through refs.
- It builds ten formations of 65,536 points on the main thread at load, one per frame; long tasks of 95 to 278 ms were recorded there on the contended and throttled runs.
- It also draws every frame forever.

## Rules v4 takes from this

Resolution and quality:

1. The final on-screen water pass renders at `min(devicePixelRatio, 2)` and that number never changes during a session. The hero surface is never scaled below it. No tier may touch the canvas backing store.
2. Quality is controlled upstream, in discrete tiers of things the eye does not read as blur: simulation grid size (for example 512, 384, 256), caustics and reflection target size, iteration counts. Changing a tier swaps a texture size between frames. It never resizes the canvas.
3. Pick the tier before the first visible frame, from a short benchmark behind the loader, and store it for the session.
4. If a tier ever changes at runtime, it needs hysteresis in both directions: step down only after two seconds of sustained misses, step back up after ten seconds of headroom, at most one change every five seconds, and never during the intro, a scroll gesture, the first two seconds after load, a resize, or a return from a hidden tab.
5. Measure against the display, not a constant. The budget is the median frame interval observed at start. A steady 33 ms interval is a 30 Hz cap and counts as on time. v3's fixed 26 ms did neither.
6. The canvas backing store is resized only on a real window resize, debounced. Every tier step in v3 was a 77 to 355 ms stall.
7. There is no give-up path that puts a different visual on screen mid-session. If the context is lost or the lowest tier cannot hold, switch the whole page to the static stills (same DOM), once.
8. Phones follow rule 1. v3's 1.25 cap made the canvas 488 px wide on a 390 px, 3x screen.

Cost:

9. Budget on the test machine (M4, 1440 x 900 at 2x, 60 Hz): all of v4's passes together at most 6 ms of GPU time at p95, and the GPU process main thread busy at most 50% of wall time in a trace of the hero at rest. v3 was 11 to 13.5 ms and 99%.
10. No ray loops in the on-screen pass. The water is a heightfield simulated in textures, whose cost is fixed per texel and does not grow with the window, and one shading pass with a small fixed number of texture reads.
11. Do not shade pixels that have nothing in them. Use geometry or a scissor rectangle around the water; v3 marched 65% of the viewport for a body that covered a fraction of it.
12. Render on demand. When the simulation's energy is below a threshold and there is no scroll or pointer input, stop drawing and stop stepping. Resume on input. Pause when the tab is hidden and when the canvas is off screen.
13. The canvas is opaque (`alpha: false`) and sits at the bottom of the stack.

Compositing:

14. Nothing that overlaps the canvas uses `backdrop-filter`, `mix-blend-mode` or an animated CSS `filter`. Text sits on dry land, so its surfaces are opaque. Grain, vignette and tone mapping live in the final shader pass.
15. Text and the effect never share pixels. This is enforced by the overlap test, not by eye.

Main thread:

16. One requestAnimationFrame loop for the whole app: scroll smoothing, simulation, DOM writes, in that order. Anything else subscribes to it.
17. No React state on the frame path. Loader progress, nav visibility and in-view flags are written through refs and data attributes.
18. No layout reads inside the loop. Section offsets are cached on resize and by a ResizeObserver.
19. No per-frame canvas-to-texture uploads. Anything typographic that the water needs (the ice name) is rasterised once per resize and moved with a uniform.
20. Heavy set-up (shader compile, building simulation state) runs off the first-paint path, uses `KHR_parallel_shader_compile` as v3 did, and is chunked so no task is over 50 ms.

Proof:

21. The perf gate logs the canvas backing-store size on every frame of a full home scroll and fails if it changes.
22. The gate runs four ways: clean, with tracing on, with 4x CPU throttle, and with a second WebGL page competing for the GPU. v3 only ever passed the first, and tracing alone was enough to break it.
23. Clean run targets: under 1% of frames longer than 1.5 frame intervals, no long task over 50 ms after load, p99 frame interval within one extra frame.
24. Under contention the frame rate may fall. Sharpness may not.

## v4 measurements

Measured on the final production build (`next start`), 2026-11-16, on the
same M4 the v3 traces were taken on, with `scripts/perf-trace.mjs`: a real
Chrome trace over a full scroll of the home page at reading speed, then 300
pointer moves through the hero. Headless Chromium on Metal, 60 Hz. Traces
and the report are in `~/.t3/portfolio-redesign-v4/traces/v4-final/`.

| Profile | Scroll p50 / p95 / p99 (ms) | Frames over 25 ms | Hero p50 / p95 / p99 (ms) | Frames over 25 ms | Long tasks | GPU ms per frame | Backing size | Tier |
|---|---|---|---|---|---|---|---|---|
| Desktop 1440 x 900 at 2x | 16.7 / 16.8 / 16.8 | 2 of 677 | 16.7 / 16.7 / 16.8 | 0 of 648 | 1 (50 ms, at start) | 1.12 | 2880 x 2232, constant | 0 (highest) |
| Desktop 1728 x 1117 at 2x | 16.7 / 16.8 / 33.3 | 13 of 804 | 16.7 / 16.7 / 16.8 | 0 of 648 | 1 (53 ms, at start) | 1.15 | 3456 x 2770, constant | 0 |
| Phone 390 x 844 at 3x, CPU throttled 4x | 16.7 / 16.7 / 16.8 | 0 of 281 | 16.7 / 16.7 / 16.8 | 0 of 377 | 2 (worst 64 ms throttled, about 16 ms real) | 0.27 | 780 x 2700, constant | 1 |
| Desktop 1440 at 2x, a second copy of the site rendering in another window | 16.7 / 16.8 / 33.3 | 9 of 673 | 16.7 / 16.7 / 16.8 | 0 of 648 | 0 | 1.99 | 2880 x 2232, constant | 0 |

Against the rules above:

- **Sharpness never drops.** The backing store is one size for the whole
  of every run, including the contended one (rules 1, 6, 21, 24). The
  device pixel ratio is capped at 2 and never changed; the only thing a
  quality tier changes is the simulation grid and a few shading terms.
- **Frame time.** p95 is one tick over the 16.7 ms target on three of the
  four profiles (16.8 ms: the display's own interval as the timer reports
  it). The scroll is not perfect: between 0.3 and 1.6 percent of frames in
  the long scroll took two intervals on the desktop profiles (rule 23 asks
  for under 1 percent; the 1440 run meets it, the 1728 and contended runs
  miss it). The hero interaction dropped no frames on any profile.
- **Cost.** About 1.1 ms of GPU time per frame on a desktop, against a
  budget of 6 (rule 9). No ray loops in the on-screen pass; the ice's
  fracture field is the dearest term and is skipped under packed snow.
- **Start-up.** One long task of about 50 ms on a desktop while shaders
  compile and the bed is carved (rule 20 asks for none over 50 ms: this
  sits on the line). Programs compile one per task; distance transforms
  run in a worker. `KHR_parallel_shader_compile` is not used.
- **Not measured.** The dark theme (the trace script has no theme
  option; the dark hero lights more of the ice's fracture field). A 120 Hz
  display. The owner's own machine. A real phone.

Lighthouse on the same build (desktop preset / mobile preset, performance):
home 95 to 99 / 89 to 90, /work 100 / 94, a project page 99 to 100 / 88
to 94, a post 100 / 93. Accessibility, best practices and SEO are 100 on
all four pages in both presets. CLS is 0 everywhere. First-load JavaScript
is 195 kB gzipped on every route (623 kB raw across 11 scripts).
