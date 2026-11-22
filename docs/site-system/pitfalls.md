# Known pitfalls

Each of these cost time on this build.

- Full broken-face relief with unrestricted key reflection put yellow highlights in the shaded canyon, and thinning the whole upper wall produced a green band.
- **A shader program is really built at its first draw** on Apple
  GPUs (0.1 to 1.6 s each), and the driver keeps it between visits.
  A harness that has run before will not see the stall; a first
  visit will. Every new variant is a new stall.
- **A live GPU timer reads long on a light frame.** The GPU slows its
  clock when it has little to do: a frame that takes 5.5 ms flat out
  read 12.5 ms from a timer query on a running page. A governor that
  trusts it lowers the resolution for nothing. Time a frame with the
  queue drained (`scripts/flight-frame-cost.mjs`), and let the running
  page work its pace out from the measured map (`pace.ts`).
- **One program that carries every subject is not a fallback.** It
  costs 70 to 100 ms a frame, ten times a stretch's own variant.
  Carrying the lake's ice or the block where they are not seen is what
  costs; four or five neighbouring stations in one program cost 5 to 10
  percent (`coverFlight`).
- **A program is built again for every kind of target.** Its first
  draw into a texture took 75 to 90 percent as long again after its
  first draw to the screen. The scene has one kind of target, the
  screen's own buffer, at rest and on the move.
- **A quick link does not mean the driver has the program.** One that
  linked in 70 ms still held the picture 0.4 s at its first draw. No
  program is built while the page moves, on a returning visit either.
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
- **The light is keyed to scroll, and a longer flight moves it.** The
  hours are positions down the page (`sky.ts`, `dayAt`, the valley's
  air in `flight.ts`). A station laid in without `added: true` shifts
  every later station's light, and the pinned comparison fails on all
  of them. Any new number that is a scroll position and is about light
  goes through `lightAt`.
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
- **A link that nothing gives pointer events back to.** A section of
  the flight takes no pointer events (`.fl-sec`), and everything in it
  inherits that. A station's pieces get them back as each one sets
  (`[data-at][data-in]`); the ending's row is set by its block, had no
  such rule, and so every contact link on the home page was dead while
  looking right (the element under each was `main.fl`). Anything
  pressable added to the flight must be given `pointer-events: auto`
  by the rule that shows it, and the same again in the page without
  scripts, where a rule that holds a piece until its block sets can
  outweigh the one that frees it. `scripts/click-test.mjs` presses
  every link and control for real, with scripts and without, and fails
  on one that does not answer.
- **A synthetic click proves nothing.** `element.click()` and
  `dispatchEvent` reach an element whatever covers it. Test a link by
  putting the pointer at its place on the screen.
- **Hidden text is counted.** A field hidden by being moved off the
  screen still has visible words to `checks.js`: the newsletter's trap
  has an `aria-label` and no text, or the home page counts two more.
- **The database's variables cannot be pulled.** The Neon integration
  marks them sensitive, and `vercel env pull` writes the word
  `[SENSITIVE]` in their place. The site makes its own table; a
  machine without the string tests against the stand-in. See
  `newsletter.md`.
- **A client component of its own is a script of its own, and a sheet
  it imports is a stylesheet of its own.** The newsletter's field has
  its rules in `home.css`, which every page loads, and no
  `'use client'`: it is exported through `Ending.tsx`, whose script
  every page loads. Each page loads the scripts and stylesheets it did
  without the field (count the tags in the served HTML).
- **A request made between the load and the largest paint is charged
  to that paint.** A page's largest picture is painted a frame or more
  after its `load` event. The sound's script was first asked for at the
  first idle moment after the load, and on `/work` that was 6 ms before
  the picture's paint. It now waits a second more
  (`SoundToggle.tsx`); `scripts/sound-load.mjs` fails if it is early.
- **A test browser may count a wheel as the reader's act.** Chrome,
  Safari and Firefox do not let sound start on a scroll. The WebKit and
  Firefox builds Playwright drives do count the wheel it sends. Ask the
  browser (`navigator.userActivation`) and hold the page to its answer,
  as `scripts/sound-visit.mjs` does; do not write the test to a rule
  the test browser does not keep.
- **Nothing on the page moves while the driver builds a program.** A
  CSS animation of `transform` or `opacity` is carried by the
  compositor through a busy main thread, but not through a program's
  first draw: the GPU process itself is held, and no frame is presented
  for 0.3 to 1.7 s (`scripts/loader-film.mjs`, `shown`: about 100 frames
  presented in a first visit's 6.7 s, the longest gap 1.7 s). So what
  stands during a first visit's wait is made of states, not of motion: a
  spinner, a shimmer or a pulse would be seen to stick.
- **Smooth scrolling gathers a wheel it cannot spend.** With the page
  held (`overflow: hidden`), Lenis still added each wheel to its target
  and spent it all when the page was let go. Its `prevent` is given the
  hold (`Runtime.tsx`). An attribute on `<html>` does not do it: Lenis
  looks only below its root.
- **A state drawn from `<html>` is right at the first paint; a state
  React writes is right after hydration.** The theme switch and the
  sound control are drawn by CSS from `data-theme` and `data-sound`,
  which the page's first script sets. What assistive technology is told
  (`aria-checked`) comes with React, so the sound control has a
  one-line script after it for a reader who had muted.

Change log: 2026-11-22 R3: the light's clock.

Change log: 2026-11-18 first version (orchestrator). 2026-11-21 R1: the dead links; three from the newsletter's field; three from the sound. 2026-11-22 R2: four from the frame's cost and the driver's builds. 2026-11-22 L1: two from the loading sequence.
