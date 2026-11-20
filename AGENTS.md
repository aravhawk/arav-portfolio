# Working on this site

This repository is Arav Jain's personal site (arav.pro). Before you add,
restore, retire or edit anything, read the maintainer pack:

**[`docs/site-system/README.md`](docs/site-system/README.md)**

It holds the map of the site, the art direction of the scenes and how
they are made, step-by-step recipes (add a scene, add a project, change
an inner page, change copy, retire something, re-bake, refresh the live
numbers), the performance gate and the scripts that measure it, the
motion rules, the copy rules, the checklist every change must pass, and
the known pitfalls.

What the site is, in four lines:

- The home page is twelve real sections of words in document order, over
  one fixed WebGL2 canvas that shows twelve offline-baked scenes
  (`src/scene/`, registry `src/scene/flight/scenes.ts`, assets in
  `public/scene/`, authoring in `tools/scene/`).
- The inner pages (`/work`, `/work/[slug]`, `/blog`, `/blog/[slug]`) are
  quiet typographic pages on `src/app/inner.css` with no scene code.
- Sound (`src/sound/`) is optional, synthesized, and loaded only when
  its toggle is pressed.
- All copy is in `src/content/`; live numbers come from
  `src/lib/metrics/`.

Rules that hold everywhere:

- New work must flow with the rest. Register a scene or a project in the
  lists the pack names and reuse the shared materials, tokens and
  components; do not write a one-off.
- Every word is DOM text. Nothing in a picture covers a name, a heading
  or copy, and words stand on calm ground through a scene's whole push,
  in both themes, wide and tall.
- The performance gate is hard: Lighthouse 95 or more on a phone and 100
  on a desktop for every page, no scene code in any page's first script,
  5 ms of GPU time a scene. Measure before and after
  (`docs/site-system/performance.md`). Never reach it by blurring the
  scene or dropping its resolution.
- Never add frosted-glass panels, or a panel or shadow behind words.
- Copy is plain and specific; public work only; nothing invented. See
  `docs/site-system/copy.md`.
- Run `pnpm build` before `pnpm exec tsc --noEmit`. Never `git add -A`;
  commit a deletion together with what replaces it.
- This file is tracked on purpose. Do not delete it. (`next dev` does
  not write one here: `agentRules` is off in `next.config.ts`.)
- `content/posts/` and `blog-editor/` are the owner's: do not change
  them. The empty file `_tmp_331_893442adcee2e4a63d7a6f1b4b38a471` at
  the root is not yours either.
