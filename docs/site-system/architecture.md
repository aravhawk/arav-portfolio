# Architecture

Next.js 16 App Router, React 19, TypeScript, plain CSS, pnpm. No
animation library, no 3D library, no scroll library. Everything
below is as built.

## The map

| Path | What it is |
| --- | --- |
| `src/app/layout.tsx` | The shell every route shares: fonts, the theme script, the nav, the route cross-fade |
| `src/app/page.tsx`, `src/app/home.css` | The home page: twelve sections and their words |
| `src/scene/` | The scene system: the canvas component, the registry, the renderer, the observer, the stills' names |
| `public/scene/<folder>/` | Each scene's packed files |
| `tools/scene/` | The offline authoring and baking scripts; `SOURCES.md` is the ledger of sources |
| `tools/site/stills.cjs` | Photographs stills from the renderer |
| `src/sound/`, `src/components/SoundToggle.tsx` | The sound layer and its control |
| `src/app/work/`, `src/app/blog/`, `src/app/not-found.tsx`, `src/app/error.tsx` | The inner pages |
| `src/components/inner/`, `src/app/inner.css` | The inner pages' frame and stylesheet |
| `src/components/work/` | The project pages' bodies and the archive list |
| `src/content/projects.ts`, `src/content/kinds.ts` | All project copy, the archive, interests, contact |
| `src/lib/metrics/`, `content/metrics.snapshot.json` | Live numbers and their committed fallback |
| `src/lib/posts/` | The seam posts come through |
| `src/lib/og.tsx`, `src/lib/og/*.jpg` | Share cards and their pictures |
| `src/lib/site.ts` | The site's address and theme colours, in one place |
| `tests/` | vitest: scene timeline, sound, content order, metrics, blog contents |

## The home page and the canvas

`src/app/page.tsx` maps the scene registry to twelve `<section
class="sc" data-scene="<id>">`. Each holds a still
(`.sc-still`, a CSS background) and its words (`.sc-words`,
`data-copy`, `data-placement`). The function `words(id, m)` in that
file returns each scene's words. A scene whose `id` is a project
slug gets the default block (kind, name linked to its page, one
line) with no code.

One markup, two layouts (`src/app/home.css`):

- **Plain** (the default): scripts off, reduced motion, or no
  WebGL2. Each section is at least one screen tall, its still
  behind it, its words on the still's calm ground.
- **Flying** (`html[data-flight]`): each section is as tall as its
  scene's scroll length (`--len` screens). The canvas
  (`.hm-canvas`) is fixed behind the document. Each scene's words
  are fixed over it and shown by opacity while that scene is on
  screen. `data-flight="live"` once the canvas draws.

A small script in the page sets `data-flight` before first paint, so
nothing shifts when the canvas arrives.

`src/scene/SceneCanvas.tsx` is the only scene code in the page's
first script. It has no WebGL in it. It decides whether the page
flies, asks for the renderer after first paint, marks which words
are on (`data-on`), scrolls a focused link's scene into place, sets
the nav's scene counter (`#scene-at`), and marks sections near the
viewport (`data-near`) so only their stills are fetched. If the
renderer cannot start, the page becomes plain.

Nothing is `aria-hidden` or `inert` for being off screen. Screen
readers and keyboards meet the words in document order.

## The scene system

**The registry** is `src/scene/flight/scenes.ts`: the `scenes`
array, in page order. Today: `lake`, `statement`, `infiniview`,
`open-source`, `kilo-bench`, `agent-bridge`, `ollama`, `cc-switch`,
`tensorpow`, `rydar`, `interests`, `ending`. Each entry has:

- `id` (a project's slug where the scene is a project's);
- `screens`, the length of its push in screens of scroll (2 for
  all today), and `exit`, the length of the whiteout after it (0.6);
- `words`: `'lower-left'` or `'lower-right'`, where its calm ground
  is in a wide frame;
- `root` and the file names of its fields, for each gate (`wide`,
  `tall`) and theme (`day`, `night`);
- `cameras`: per gate, the `focus` the push closes on, the `push`
  amount and the `aspect` the plate was rendered at;
- `assets`: a JSON ledger of file names and bytes, written by the
  packer (`src/scene/flight/<id>-assets.json`).

`starts`, `flightLength` and `position(screens)` derive the
timeline from that list. The page is 30.6 screens long today. No
position is ever written by hand.

**Three kinds of scene:**

| Kind | Scenes | How it is drawn |
| --- | --- | --- |
| Lake | `lake` | Real baked meshes and textures (`src/scene/lake/gpu.ts`), six draws, an HDR target, bloom and a 32-cubed grade LUT per theme |
| Single-depth plate | the ten made by `riverPlate(...)` | One full-screen triangle (`src/scene/flight/plate.ts`). Two textures: a native-size luminance AVIF, and a smaller lossless WebP "survey" holding inverse distance (red), moving-water coverage (green) and two colour axes (blue, alpha). The push shifts each pixel by its depth, so near things move more than far |
| Layered plate | `infiniview` (files in `public/scene/ridge/`) | As above, plus surveyed planes for the ground and two groups of slabs, a silhouette matte and a wind texture (`src/scene/flight/ridge.ts`, `ridge-projections.json`) |

A plate is the offline render itself, projected. That is why it is
cheap and why it looks like the render. It also means the camera
can only move a little: see [scenes.md](scenes.md).

**Streaming** (`src/scene/flight/gpu.ts`). Only the lake loads at
the start. When the reader is 0.18 screens into a scene, the next
is requested: fetched and decoded in a worker
(`public/scene/plate.worker.js`), uploaded in strips of 128 lines,
one message a frame, drawn once into a 2 by 2 target, and marked
ready when the GPU says that draw is done. A scene two away is
released. If the reader outruns the stream, the picture waits at
the end of the current push until the next scene is ready. A jump
across several scenes is one whiteout (0.72 s) straight to the
target. A reload or a theme switch deep in the page opens on the
reader's own scene.

**The whiteout** is `whiteoutField` in `src/scene/flight/plate.ts`:
blown snow that closes over the outgoing scene and clears on the
incoming one, driven by scroll, the same in both directions. Words
are off while it passes.

**The loop** is `src/scene/lake/live.ts`: one
`requestAnimationFrame` loop for the canvas. It smooths scroll,
springs the pointer, advances the stream, draws, and pauses when
the tab is hidden or the canvas is off screen. See
[motion.md](motion.md).

**The observer** is `src/scene/observe.ts`: `sight`, four numbers
the renderer writes once a frame (`from`, `to`, `mix`,
`progress`). Anything that follows the picture without drawing
reads it. The sound does. It is only meaningful while
`data-flight="live"`.

**The test hook** is `window.__lakeProof`, set once the canvas is
live: `state()`, `frame(scroll, x, y)`, `capture()`, `sample(on)`,
`measure(width, height, breakdown, scroll)`. The stills tool and
the cost measurements use it.

## Stills

A still stands in wherever the canvas does not draw.

- **Section stills**: `src/scene/stills.ts` names them. The lake's
  four were baked with the scene (`public/scene/lake/still-*.avif`).
  The others are in `public/media/stills/scene/`,
  `<id>-<wide|tall>-<day|night>.avif`.
- **Project headers**: `public/media/stills/<slug>-<day|night>.avif`
  (2432 wide) and a `-1216` copy, mapped in
  `src/components/inner/stills.ts` with their alt text.
- **Share card pictures**: `src/lib/og/<id>.jpg`, 1200 by 630, day.

All but the lake's are photographed from the production renderer by
`tools/site/stills.cjs`. That tool carries its own lists of scene
ids, project slugs and card pictures, and assumes every scene is
2.6 screens long. Keep them in step with the registry.

## Sound

- `src/components/SoundToggle.tsx`: the control, on the home page
  only. It makes the audio context inside the press and imports
  `src/sound` on the first press. Its state is kept in
  `sessionStorage` (key `sound`): it lasts a visit, and a new visit
  is silent.
- `src/sound/scenes.ts`: one line a scene, keyed by the registry's
  `id`: `wind`, `drift`, `run`, `fall`, `lap`, `ice`, each 0 to 1.
- `src/sound/mapping.ts` turns two scenes, a mix and a push into
  targets (pure, tested). `src/sound/graph.ts` is the Web Audio
  graph: noise through filters, a few oscillators, a soft limiter.
  No audio file exists.
- `src/sound/index.ts` steps every 150 ms. It reads `sight` while
  the canvas draws and the document's sections where it does not.
  It suspends when the tab is hidden or another page is shown.
- `tests/sound/` holds it to its limits. `scripts/sound/` renders
  it to files without speakers and measures them.

## Inner pages

Every inner page is `InnerPage` from `src/components/inner/Page.tsx`:
a head (`back`, `label`, `title`, `lead`, `meta`, `still`), the
content, one way on, the footer. Styles are in `src/app/inner.css`,
scoped under `.in`: twelve columns in a 76rem measure, seven type
sizes, the `--s-*` spacing steps from `src/app/globals.css`,
hairlines, and one accent that means one thing, a number read live.

- `/work` (`src/app/work/page.tsx`): the featured index from
  `PROJECTS`, then "Also" from `MORE`, then the archive from
  `ARCHIVE` with its search (`src/components/work/ArchiveList.tsx`).
- `/work/[slug]`: the head with the project's still, then `Case`
  from `src/components/work/cases.tsx` (one composed body a project,
  with a plain fallback for a project that has none), then the ways
  out. On a phone (640 px and under) the page opens on the scene's
  tall still with the title at its foot.
- `/blog` and `/blog/[slug]`: see [blog.md](blog.md).

Client components exist only where a control needs one: the nav,
the sound toggle, the archive search, the film's play button, copy
email, the scene canvas.

## Content and live numbers

- Copy: `src/content/projects.ts` (`PROJECTS`, `MORE`, `ARCHIVE`,
  `INTERESTS`, `CONTACT`) and `src/content/kinds.ts` (`KIND`, the
  small label over each project). `tests/content/order.test.ts`
  holds `PROJECTS` to the order the scenes come in.
- Facts behind the project pages: `src/components/work/case-data.ts`.
- Live numbers: `getMetrics()` from `src/lib/metrics` (server only).
  It reads GitHub, npm and Ollama on the server, caches for an
  hour, and falls back to `content/metrics.snapshot.json`. A page
  that shows one exports `revalidate = 3600`. Full notes:
  `docs/redesign-v4/metrics.md`.
- Three scenes are drawn from numbers in that snapshot at bake
  time. See "Scenes drawn from data" in [scenes.md](scenes.md).

## Share cards and addresses

`src/lib/og.tsx` renders every card: one design, 1200 by 630, words
lower left in TASA Orbiter. The home card and each project's stand
on their scene's picture (`PICTURES` in that file); writing and
posts are type alone. Each route's `opengraph-image.tsx` calls it.
Every absolute address comes from `src/lib/site.ts`
(`https://arav.pro`).

## What loads when

1. **The HTML** has every word. A script in the head sets the theme
   (`data-theme`, from `localStorage` key `theme` or the system) and
   `data-scripted`. The home page's own script sets `data-flight`.
2. **First paint**: the hero's words and the lake's still.
   TASA Orbiter is the one preloaded font; the mono and the serif
   load when used.
3. **After first paint**: `SceneCanvas` waits for the still to
   decode and paint, then imports `src/scene/flight/gpu.ts`. No
   scene, shader or WebGL code is in any route's first script.
4. **The lake** loads through its worker
   (`public/scene/lake/decode.worker.js` and the decoders in
   `public/scene/lake/codecs/`), is drawn once off screen, and the
   canvas fades in over the still.
5. **Each next scene** streams while the reader is in the one
   before it. Other sections' stills are fetched only when near.
6. **Sound**: nothing until the first press of the toggle.
7. **Inner pages**: Work and Writing in the nav prefetch. Links to
   the home page do not (`prefetch={false}`), and the home page's
   station links do not either.

Change log: 2026-11-19 rewritten for the baked scenes (M1).
