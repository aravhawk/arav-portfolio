# Known pitfalls

Each of these cost time on this build.

- Full broken-face relief with unrestricted key reflection put yellow highlights in the shaded canyon, and thinning the whole upper wall produced a green band.
- **A shader program is really built at its first draw** on Apple
  GPUs (0.1 to 1.6 s each), and the driver keeps it between visits.
  A harness that has run before will not see the stall; a first
  visit will. Every new variant is a new stall.
- **A second draw into the same target is culled.** To weigh a shader
  term, draw into a target of its own.
- **A frame time read from a one-pixel read-back** is only right near
  the budget; light frames read slow.
- **The sound copies numbers from the picture.**
  `tests/audio/picture.test.ts` fails when one drifts. Fix the copy,
  not the test's floor.
- **Critics judging small tiled sheets misread sizes.** Show inner
  pages at full size.
- **Captures in the dev server with full shading pinned** are slow
  enough to catch words mid-entrance. Capture from a production
  build.
- **Words on a busy ground.** A title must stand wholly on one calm
  surface through its station's whole move, not only at the composed
  frame (`scripts/titles-test.mjs` measures three points a stretch).
- **Glass.** Frosted, blurred or translucent panels read as AI-made
  to the owner. Use plates.
- **A lee that shows its edge.** The calm ground under words must
  fall away over a wide margin; a pale rectangle is a fault.
- **One change, half applied.** Lighting, material or motion changed
  for one stretch only makes the page incoherent. Change the whole
  flight together or stage the work and land it at once.
- **A helper stopped part way** loses its report even when its code
  is committed. Let a task reach its end.
- **The file `_tmp_331_893442adcee2e4a63d7a6f1b4b38a471`** at the
  root is tracked and empty on purpose. Do not delete it.
- **Root `AGENTS.md` is tracked.** Do not delete it as a stray build
  output.
- **Review the frames between the composed stops, not only the
  stops.** A material change that looked right at every composed
  frame left the canyon's walls covered in blotches on the way in
  and out. Before integrating any change to the picture, look at 24
  evenly spaced frames of the whole page in both themes and at the
  same on a phone.
- **Every pushed commit must build, typecheck and render on its
  own.** Run `pnpm exec tsc --noEmit` and `pnpm build` on the exact
  tree before each push. Commit a deletion together with its
  replacement (a staged `git rm` rides along with the next commit,
  whatever that commit was meant to be: look at `git status --short`
  for staged lines first). Never rewrite pushed history to hide a
  broken commit; complete it in the next one and say so.
- **zsh does not split unquoted variables into words**, and a
  `git cherry-pick --continue` finishes the whole sequence: rerunning
  the remaining hashes duplicates commits.

- **The words' lee is far wider than the words.** The picture's calm
  under a block of words falls away over a wide margin (on a phone it
  covers nearly the whole frame). Using it to keep the live layer off
  the words turned the layer off. The layer reads the words' own boxes
  from the page instead (`words()` in `src/flight/live.ts`).
- **Asking a program's link status waits for its compile.** The live
  layer's two programs took 141 ms of the page's thread that way. They
  are now compiled in parallel (`KHR_parallel_shader_compile`) and taken
  up in the frame that finds them done: 0.4 ms.
- **A regular pattern over the water reads as an effect at once.** A
  glint in every cell of a grid, or a net of thin bright lines, could be
  pointed at in a still frame. Glints are sparse, anywhere in their
  cell, of their own size and clock; the water's light is broad and
  faint. Judge the layer on a difference image
  (`scripts/live-evidence.mjs`), then make sure it cannot be seen in the
  still itself.
- **The wall of cc-switch's dam is measured from the bed.** `DAM.h` is
  150, but its crest stands about 92 units over the water in the
  picture. A point placed through the camera is checked against the
  frame, not against the constant.

Change log: 2026-11-18 first version (orchestrator).
