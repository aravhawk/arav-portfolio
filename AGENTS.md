# Working on this site

This repository is Arav Jain's personal site (arav.pro). Before you add,
restore, retire or edit any section, read the maintainer pack:

**[`docs/site-system/README.md`](docs/site-system/README.md)**

It holds the architecture map, the motion system and its tokens, the
lighting and material rules, the performance budget and how to measure
it, the copy rules, step-by-step recipes with templates, the
consistency checklist every change must pass, and the known pitfalls.

Rules that hold everywhere:

- New work must flow with the rest. Use the shared tokens and the
  registration points the pack describes; do not write a one-off.
- Never lower resolution, blur the scene, or cover text. Never add
  frosted-glass panels.
- Copy is plain and specific; public work only. See
  `docs/site-system/copy.md`.
- This file is tracked on purpose. Do not delete it. (`next dev` does
  not write one here: `agentRules` is off in `next.config.ts`.)
- `content/posts/` and `blog-editor/` are the owner's: do not change
  them. The empty file `_tmp_331_893442adcee2e4a63d7a6f1b4b38a471` at
  the root is not yours either.
