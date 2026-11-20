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
| Slow frames in a scroll, 1440 at 2x | 1.6 to 2.8 percent | none: longest interval 18.7 ms over 2,341 frames (builder's run, 60 Hz) |
| Slow frames, 1728 at 2x | 5.8 to 9.7 percent | not measured at that size |
| First visit | about eight frames held in a scroll | no held frame, no task over 50 ms in a cold scroll (builder's run) |
| Main thread a frame | not recorded | 0.2 ms median, 2.2 ms at most (builder's run) |

GPU time a frame at a 3456 by 2234 backing on an Apple M4, and
bytes shipped, by scene. The times are the builders' last
measurements for each scene. Some scenes were re-lit or re-framed
after theirs was taken, and the second and third scenes changed
places, so treat a whiteout's figure as a guide and measure again
before relying on it.

| Scene | At rest or pushing (ms) | Whiteout into it (ms) | Bytes |
| --- | --- | --- | --- |
| `lake` | 4.2 | none | 2,421,598 |
| `statement` | 4.2 | 6.3 | 769,597 |
| `infiniview` | 5.0 | 4.5 | 1,197,267 |
| `open-source` | 3.3 | 5.7 | 1,073,576 |
| `kilo-bench` | 4.1 | 6.6 | 713,795 |
| `agent-bridge` | 3.3 | 6.0 | 785,982 |
| `ollama` | 3.5 | 6.1 | 856,632 |
| `cc-switch` | 3.4 | 6.0 | 855,290 |
| `tensorpow` | 3.4 | 6.0 | 818,497 |
| `rydar` | 3.4 | 5.9 | 821,787 |
| `interests` | 4.7 | 6.0 | 904,215 |
| `ending` | 4.0 | 5.9 | 619,265 |

All twelve ledgers sum to 11,837,501 bytes. Texture memory peaked
at 134.6 MB across the measured poses (builder's run).

Sound: the chunk is 3,457 bytes gzipped; nothing of it loads before
the first press (builder's run). Today's offline render of a walk
through all twelve scenes: minus 19.8 LUFS by day, minus 21.9 by
night, peak minus 4.8 dBTP, no click in any of the five runs.

## Not met or not measured

Stated plainly, worst first.

1. **A task over 50 ms on every route under the phone preset.**
   The evaluation of the framework's own chunk (React DOM and the
   Next client) measured 76 to 101 ms in today's two runs under
   Lighthouse's 4x CPU slowdown (the builders measured 67 to 75).
   Nothing of the site's own is in it, and no way was found to
   split it.
2. **A second task on `/` under the phone preset.** Today's two
   runs each show one task of about 65 ms in the renderer's chunk,
   and the desktop preset shows one unattributed task of 58 to
   71 ms on `/`. The machine was rendering in Cycles at the time,
   and Lighthouse's browser has no GPU, so the cause is not
   established. Measure again on a quiet machine.
3. **The lake ships 2,421,598 bytes** against 1,300,000 a scene.
   Lossier textures changed fine edges visibly; only lossless
   savings were taken.
4. **Infiniview is at the 5 ms budget, not under it.**
5. **Not measured on real hardware:** a 120 Hz display (the owner's
   M5 Pro), and any physical phone. Every frame number here is from
   an M4 on a 60 Hz display or an emulated phone.
6. **INP is in the gate and has never been measured.**
7. **Night contrast** was measured once by a builder's own probe
   (every scene 4.7 to 1 or better at both ends of its push). The
   probe is not in the repository. After a night re-render, look,
   and say that it was not re-measured.
8. **Sound has not been heard by a person** and has only run in
   Chromium. One Lighthouse phone run of four scored 81 during its
   build and did not repeat.
9. **Today's own GPU and scroll numbers are not usable**: they were
   taken while another job rendered on the same GPU (frames of 80
   ms and more). The scripts ran correctly; the table above uses
   the builders' quiet runs.

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
