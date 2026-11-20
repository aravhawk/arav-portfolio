# Performance

The gate, how each line is measured, where the site stands, and
what is not met. The gate is the owner's and is hard: it is reached
by making the work cheaper, never by removing the scene.

## The gate

Measured on the production build
(`pnpm build && pnpm exec next start -p 3189`), for every page.

| Line | Limit |
| --- | --- |
| Lighthouse performance | 95 or more on the phone preset, 100 on the desktop preset |
| Lighthouse accessibility, best practices, SEO | 100 |
| LCP | under 2.0 s on the phone preset, under 1.2 s on desktop |
| CLS | under 0.02 |
| INP | under 100 ms |
| Long tasks | none over 50 ms after first paint |
| First script | no scene, shader, WebGL or sound code in any route's first load |
| GPU time, a scene at rest or in its push | 5 ms a frame at a 3456 by 2234 backing on an Apple M4 |
| GPU time, the dearest frame of a whiteout | 7 ms, same backing and machine |
| A scene's files | 1,300,000 bytes for both themes and both frame shapes |
| Texture memory | under 200 MB with two scenes resident |
| A scroll of the whole home page | no frame interval over 20 ms on a 60 Hz display; the stream never holds a frame |
| Sound | nothing loaded before the first press; its chunk 12 KB gzipped or less |

Why 5 ms: the owner's display is 3456 by 2234 at 120 Hz, so a frame
is 8.3 ms. The canvas draws at the full device pixel ratio, capped
at 2.

## How to measure

The four scripts are in `docs/site-system/measure/`. Playwright and
Lighthouse are not dependencies of the site: see the table in
[README.md](README.md) for where they are.

```sh
pw="$HOME/.t3/portfolio-redesign-v4/tools/node_modules"
pnpm build && pnpm exec next start -p 3189 &

# Lighthouse, both presets, a table (scores, LCP, CLS, blocking, longest task, script)
docs/site-system/measure/lighthouse.sh http://localhost:3189 .tools/out/lh / /work /work/infiniview /blog

# First-load script of a route, gzipped, and that none of it is the renderer or the sound
docs/site-system/measure/first-load-js.sh http://localhost:3189 /

# GPU time a frame by scroll position (whole page, or a range in screens)
NODE_PATH="$pw" node docs/site-system/measure/gpu-cost.cjs http://localhost:3189
NODE_PATH="$pw" node docs/site-system/measure/gpu-cost.cjs http://localhost:3189 26 28.6

# A cold scroll of the whole page in 35 s, then a jump, then a phone
NODE_PATH="$pw" node docs/site-system/measure/scroll-trace.cjs http://localhost:3189 35
NODE_PATH="$pw" node docs/site-system/measure/scroll-trace.cjs http://localhost:3189 0.1
NODE_PATH="$pw" node docs/site-system/measure/scroll-trace.cjs http://localhost:3189 35 phone

lsof -tiTCP:3189 -sTCP:LISTEN | xargs kill
```

Notes that decide whether a number means anything:

- **Measure the production build.** The dev server is slower and
  loads differently.
- **Measure alone on the GPU.** A Cycles render or a second browser
  on the same machine turns a 4 ms frame into 80. Check with
  `ps aux | grep study.py` before you trust a GPU or scroll number.
  Run twice.
- **GPU time** comes from the renderer's own hook,
  `window.__lakeProof.measure(width, height, false, scroll)`: the
  median of seven timer queries, each over six draws of a full
  frame. A scene `i` rests from `starts[i]` to `starts[i] + 2`
  screens; the whiteout into the next runs for the 0.6 after. A
  whiteout's cost is charged to the scene it brings in.
- **A scene's bytes**: add up its ledger,
  `src/scene/flight/<id>-assets.json`. The ledger counts both
  themes and both frame shapes; one visit fetches one of each.
- **Lighthouse's phone preset simulates** a slow phone from a fast
  run. Its LCP for a picture counts every script that finished
  before the paint, so a page whose largest paint is a picture
  reads about 2.5 to 2.9 s however small the picture is. That is
  why a project page on a phone opens on its scene's still behind
  the whole first screen with the title as the largest paint.
- **Lighthouse cannot score a 404.** For the not found page use
  the same binary with `--ignore-status-code`.
- **Sound**: `NODE_PATH="$pw" node scripts/sound/page.mjs
  http://localhost:3189 .tools/out/sound` checks on the real page
  that nothing loads before the press, and prints the chunk's size.
  `node scripts/sound/render.mjs .tools/out/sound` (same
  `NODE_PATH`) renders the sound to files and measures loudness,
  peak and clicks.
- **Not scripted here**: INP, and the contrast of words against the
  night picture. See "Not met or not measured".

## Before and after

Before is the site with the procedural engine (at commit `a8d6721`,
2026-11-19, from `docs/redesign-v4/PROGRESS.md`). After is today's
tree (at `061a4d0`, measured 2026-11-19 with Lighthouse 13.6.0 on
an Apple M4 unless a source is named).

### Loading

| | Before | After |
| --- | --- | --- |
| `/`, phone score | 74 | 100 |
| `/work`, phone score | 54 | 100 |
| a project page, phone score | 56 | 100 |
| `/blog`, phone score | 85 | 100 |
| a post, phone score | 85 | 100 (builder's run) |
| Desktop scores, same five pages | 100, 92, 98, 99, 99 | 100 on all |
| `/work`, phone LCP | 12.7 s | 0.91 s |
| `/`, phone LCP | not recorded | 0.90 s |
| `/`, desktop LCP | not recorded | 0.24 s |
| CLS | not recorded | 0.000 on every page |
| `/`, main thread blocked on a phone | 1.5 s | 33 ms |
| Script transferred a page | 360 to 380 KB | 186 KB on `/`, 161 to 165 KB on inner pages |

Of the script on `/`, 192 KB gzipped is the sum of every script tag
and 39 KB of that is Next's `nomodule` polyfill, which a modern
browser never fetches. Almost all the rest is React and the Next
client. The renderer is a separate chunk of 55 KB (before
compression), asked for after first paint.

### The picture

| | Before | After |
| --- | --- | --- |
| How a frame is made | about 9,000 lines of procedural shader, every pixel computed | baked plates and meshes, three to eight draws a frame |
| Slow frames in a scroll, 1440 at 2x | 1.6 to 2.8 percent | none: longest interval 18.7 ms over 2,341 frames in a cold 35 s scroll (quiet run, Nov 20, 60 Hz); the same on the phone profile |
| Slow frames, 1728 at 2x | 5.8 to 9.7 percent | not measured at that size |
| First visit | about eight frames held in a scroll | no held frame, no task over 50 ms in a cold scroll (quiet run, Nov 20) |
| Main thread a frame | not recorded | 0.2 ms median, 2.2 ms at most (quiet run, Nov 20) |

GPU time a frame at a 3456 by 2234 backing on an Apple M4, and
bytes shipped, by scene. The times are one quiet run of
`measure/gpu-cost.cjs` on Nov 20, 2026, after the last re-lighting
and the change of order, sampled every 0.4 of a screen: the worst
sample in each scene's rest and push, and in the whiteout into it.
The bytes are every file in the scene's folder under
`public/scene/`, stills included.

| Scene | At rest or pushing (ms) | Whiteout into it (ms) | Bytes |
| --- | --- | --- | --- |
| `lake` | 4.7 | none | 2,421,598 |
| `statement` | 3.7 | 4.6 | 751,527 |
| `infiniview` | 4.0 | 5.0 | 1,184,577 |
| `open-source` | 3.8 | 7.3 | 1,040,926 |
| `kilo-bench` | 4.0 | 5.9 | 692,072 |
| `agent-bridge` | 4.0 | 6.7 | 758,867 |
| `ollama` | 3.7 | 5.8 | 834,143 |
| `cc-switch` | 4.2 | 5.7 | 834,834 |
| `tensorpow` | 5.3 | 5.8 | 778,973 |
| `rydar` | 3.9 | 6.1 | 790,119 |
| `interests` | 5.2 | 5.9 | 872,701 |
| `ending` | 4.0 | 6.0 | 592,163 |

The folders sum to 11,552,500 bytes. Over budget in this run: `tensorpow`
(5.3) and `interests` (5.2) at rest against 5 ms, and the whiteout
into `open-source` (7.3) against 7 ms. Texture memory peaked at
134.6 MB across the measured poses (builder's run).

Sound: the chunk is 3,457 bytes gzipped; nothing of it loads before
the first press (builder's run). Today's offline render of a walk
through all twelve scenes: minus 19.8 LUFS by day, minus 21.9 by
night, peak minus 4.8 dBTP, no click in any of the five runs.

## Not met or not measured

Stated plainly, worst first.

1. **A task over 50 ms on every route under the phone preset.**
   The evaluation of the framework's own chunk (React DOM and the
   Next client) measured 63 to 74 ms on all twelve routes in a
   quiet run on Nov 20 under Lighthouse's 4x CPU slowdown; a few
   routes also show one unattributed task of 57 to 75 ms. Nothing
   of the site's own is in the chunk, and no way was found to
   split it. Unthrottled it is about 15 to 19 ms.
2. **Three GPU samples over budget** in the quiet run of Nov 20:
   `tensorpow` at 5.3 ms and `interests` at 5.2 ms at rest (budget
   5), and the whiteout into `open-source` at 7.3 ms (budget 7).
   The builders' own runs had every scene inside. One run, sampled
   every 0.4 of a screen: measure again before and after any fix.
   A second long task once reported on `/` did not appear in the
   quiet run: `/` shows only the framework's.
3. **The lake ships about 2.4 MB** against 1.3 MB a scene.
   Lossier textures changed fine edges visibly; only lossless
   savings were taken.
4. **Not measured on real hardware:** a 120 Hz display (the owner's
   M5 Pro), and any physical phone. Every frame number here is from
   an M4 on a 60 Hz display or an emulated phone.
5. **INP is in the gate and has never been measured.**
6. **Night contrast** was measured once by a builder's own probe
   (every scene 4.7 to 1 or better at both ends of its push). The
   probe is not in the repository. After a night re-render, look,
   and say that it was not re-measured.
7. **Sound has not been heard by a person** and has only run in
   Chromium. One Lighthouse phone run of four scored 81 during its
   build and did not repeat.

## Rules that keep the gate

- A new scene is a plate: one full-screen draw, two textures. It
  adds no pass, no new shader program and no new dependency.
- Nothing is fetched, decoded, compiled or uploaded in a way that
  blocks a frame. Decoding is in a worker; uploads are in strips;
  a scene is drawn once off screen before it is shown.
- The canvas never lowers its resolution by design. When slow
  frames pile up (a count of 60) it steps the backing down by 5
  percent, to 80 percent at the least, and steps back up after 600
  steady frames
  (`src/scene/lake/live.ts`). Do not widen
  that range and do not add blur.
- Inner pages load no canvas, WebGL or audio code. Links to the
  home page are not prefetched from them.
- No new npm dependency without the owner's word.
- Pictures are AVIF or WebP at the size shown, with width and
  height; only the first screen's picture is eager.

Change log: 2026-11-19 rewritten for the baked scenes (M1).
