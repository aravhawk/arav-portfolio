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
- **A still pool that runs.** Flow is painted in order: a river painted
  after a pool's slow `flowOnly` water makes the pool run (the sound
  heard a stream at the tarn; the picture's water would have moved).
  Paint the river in first.
- **The image optimiser keeps a re-shot picture's old self.** After
  replacing a file under `public/media/scenes`, remove
  `.next/cache/images` or the tests photograph the old picture.
- **A leaving key under standing words.** A block of words stands 0.2
  screens past its hold. A key that turns the eye in that time can
  bring water under the title (`scripts/titles-test.mjs` at 0.9 of the
  stretch). Leave along the bank the words stand on.
- **A pattern counted from the world's origin moves when a place does.**
  The sea's drift ice is laid out in cells of the world. When the delta
  moved 7,600 units the plates fell elsewhere, and one drifted under the
  ending's small line on a tablet (legibility 1.9 at 768 wide, and only
  there). A place's own pattern is counted from the place's base.
- **Run legibility at 768 as well as 390 and 1440.** A tablet held
  upright sees a cut of the phone's frame with its words elsewhere:
  what is calm under the words on a phone may not be under them there.
- **A link that nothing gives pointer events back to.** A section of
  the flight takes no pointer events (`.fl-sec`), and everything in it
  inherits that. A station's pieces get them back as each one sets
  (`[data-at][data-in]`); the ending's row is set by its block, had no
  such rule, and so every contact link on the home page was dead while
  looking right (the element under each was `main.fl`). Anything
  pressable added to the flight must be given `pointer-events: auto`
  by the rule that shows it. `scripts/click-test.mjs` presses every
  link and control for real and fails on one that does not answer.
- **A synthetic click proves nothing.** `element.click()` and
  `dispatchEvent` reach an element whatever covers it. Test a link
  with Playwright's `click()` or `tap()`, which go to its place on the
  screen.

Change log: 2026-11-18 first version (orchestrator). 2026-11-21 V3: five more. 2026-11-21 F1: the dead links.
