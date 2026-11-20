# Site system: the maintainer pack

For anyone, person or agent, who adds, changes or retires something
on arav.pro. The aim: new work looks and moves like the rest, and the
site stays as fast as it is. Every page here describes the site as
built. Where something is not built or not met, the page says so.

## What the site is

- **The home page** (`src/app/page.tsx`, `src/app/home.css`). Twelve
  real sections in document order hold all the words. Behind them one
  fixed WebGL2 canvas shows twelve scenes of a frozen lake and the
  river that leaves it, one a section. The scenes are rendered
  offline and drawn by a small scene system (`src/scene/`). A
  scroll-driven whiteout of blown snow joins one scene to the next.
- **The scenes are made offline** by Blender, driven by Python, from
  CC0 sources (`tools/scene/`), and packed into `public/scene/`.
- **Sound** (`src/sound/`): synthesized, off until the toggle in the
  nav is pressed, fetched on that press.
- **The inner pages** (`/work`, `/work/[slug]`, `/blog`,
  `/blog/[slug]`, not found): quiet typographic pages on
  `src/app/inner.css`. No scene code runs on them.

The earlier procedural engine (`src/water`, `src/audio`) and its
libraries were deleted on 2026-11-19. If a note or a memory tells you
to edit them, it is out of date.

## The five rules that matter most

1. **The words are the page.** Every word is DOM text in document
   order. Nothing in a picture may cover a name, a heading or copy,
   and words stand on calm ground from the start to the end of a
   scene's push, in both themes, wide and tall.
2. **One world.** A scene reuses the hero's slab ice, black ice,
   wind-packed snow, open water, low sun and blue hour. One idea a
   scene, made of a few large simple shapes. See
   [scenes.md](scenes.md).
3. **Register, do not hand-wire.** A scene is one entry in
   `src/scene/flight/scenes.ts`. A project is one entry in
   `src/content/projects.ts`. The page, the nav's counter, the
   stream, the sound and the tests follow those lists. See
   [recipes.md](recipes.md).
4. **The gate holds.** Lighthouse 95 or more on a phone and 100 on a
   desktop for every page, no scene code in any page's first script,
   5 ms of GPU time a scene. Measure before and after. See
   [performance.md](performance.md).
5. **No glass, no blur, no invented copy.** Solid surfaces only.
   Copy is plain, specific and public. See [copy.md](copy.md).

## Read in this order

| Read | For |
| --- | --- |
| [architecture.md](architecture.md) | What is where: the page, the canvas, the scene system, stills, sound, inner pages, content, live numbers, what loads when |
| [scenes.md](scenes.md) | The art direction of the scenes, what was learned making them, what fails |
| [recipes.md](recipes.md) | Step by step: add a scene, add a project, change an inner page, change copy, retire something, re-bake, refresh numbers |
| [performance.md](performance.md) | The gate, how each line is measured, before and after, what is not met |
| [measure/](measure/) | Five small scripts that measure the gate and the copy rules; `performance.md` and `copy.md` say how to run them |
| [motion.md](motion.md) | How the picture moves, and the rules for controls and layers |
| [copy.md](copy.md) | How the site speaks and what may appear on it |
| [blog.md](blog.md) | The blog's pages and the seam posts come through |
| [consistency-checklist.md](consistency-checklist.md) | The pass every change clears before it is called done |
| [pitfalls.md](pitfalls.md) | What has gone wrong before |

## Tools that are not in the repository

Some checks need tools that live outside git. Say so in your report
if you could not run one; do not skip it silently.

| Tool | Needed by | Where it is on the owner's machine |
| --- | --- | --- |
| Playwright (with Chromium) | `tools/site/stills.cjs`, `scripts/sound/render.mjs`, `scripts/sound/page.mjs`, `tools/scene/posters.cjs`, the `.cjs` scripts in `docs/site-system/measure/` | `~/.t3/portfolio-redesign-v4/tools/node_modules`, passed as `NODE_PATH` |
| Lighthouse | `docs/site-system/measure/lighthouse.sh` | `~/.t3/portfolio-redesign-v4/tools/node_modules/.bin/lighthouse` |
| Blender as a Python module (`bpy` 4.5.3) | every script under `tools/scene/` | a virtual environment at `~/.t3/portfolio-redesign-v4/tools/bake-venv`; `tools/scene/bake-lake` creates it with `uv` if it is missing |
| The CC0 source files | the bakes | `~/.t3/portfolio-redesign-v4/assets-src`, fetched and checked by `tools/scene/lake/inputs.py` |

Evidence (captures, study renders, reports) goes under `.tools/` in
the checkout. Git ignores that folder through the shared
`.git/info/exclude`, not through `.gitignore`.

## What stays untouched

`content/posts/` and `blog-editor/` are the owner's.
`git diff 9a487fb -- content/posts blog-editor` must stay empty. The
empty file `_tmp_331_893442adcee2e4a63d7a6f1b4b38a471` at the root
and the root `AGENTS.md` are tracked on purpose.

The story of how the site got here, with every measured number, is
`docs/redesign-v4/PROGRESS.md`. It is a record, not a guide.

Change log: 2026-11-19 rewritten for the baked scenes (M1).
