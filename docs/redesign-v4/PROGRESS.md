# aravjain.dev v4: progress log

Branch `redesign/fable-v4b-20261115`, from origin/main `9a487fb`. Worktree
`~/.t3/worktrees/arav-portfolio/redesign-fable-v4b-20261115`. Evidence (never
committed) lives in `~/.t3/portfolio-redesign-v4/`.

If you are resuming: read this file top to bottom, then continue at the first
unchecked item. Do not restart.

## Standing rules (short form)

- Push only this branch, over SSH. No PR, no merge, no force-push.
- Signed commits only; `git verify-commit` each one.
- Never touch main, PRs #18/#19/#20 or their branches, the backup tag, or
  `content/posts` and `blog-editor` (diff against 9a487fb must stay empty).
- Captures, traces, specimens and reference material stay outside git.

## Working rules (orchestrator, corrected 2026-11-15 evening; these replace the earlier guardrail)

At 2:30 PM CT the limit auto-resume restarted this thread and all seven
helpers at once, and eight agents in parallel spent the whole 5-hour window
in 23 minutes. Arav's rule: never cut quality or depth, just do not be
wasteful.

1. Work serially, one task at a time, no parallel helpers. A helper is fine
   only if it runs alone while the main thread waits or stays light.
2. The failed helper "v4 refs: new SOTD sites + Apple" is cancelled and must
   not be restarted (its queued notice is stale). `task_status` on all seven
   showed none running. The SOTD and Apple study is NOT skipped: I redo it
   myself, serially, before design decisions lock, reusing the captures and
   measurements that helper left in `references/` and `tools/refs-b`.
3. Reuse the six finished helpers' outputs on disk; take a second look only
   where it adds value.
4. Full review depth as the brief says: five rounds, an independent critic,
   and full browser coverage. Avoid pure waste (duplicate captures,
   re-running unchanged checks).
5. Push signed checkpoints at each milestone
   (`git push -u origin redesign/fable-v4b-20261115`, SSH, that branch only,
   no force-push, no PR, no merge).
6. Do not change model or effort.
7. New scope, section I of the brief: **arav.pro is the primary canonical
   domain.** One config constant for the site URL; every canonical, sitemap,
   robots, JSON-LD, feed and OG URL points at https://arav.pro; host-based
   308s from aravjain.dev, www.aravjain.dev and www.arav.pro as a backup;
   per-page Open Graph images with `next/og` in the v4 language with real
   fonts; favicon, apple-touch-icon, theme-color for both themes. Verify
   rendered OG images and built meta tags, and grep for leftover
   aravjain.dev. Do not touch Vercel domain settings; list dashboard steps
   in the final report.

## Work split (Arav, t256u, 2026-11-15 about 10:10 PM CT; this overrides who does what above)

Arav's weekly Fable allowance on the Claude subscription was down to 11%.
The work is not paused; it is split.

1. **This thread (Claude Code, Fable 5.2) orchestrates, studies, tests and
   reviews only:** planning, the reference studies, reading and judging
   diffs, browser, performance and contrast checks, cross-browser runs,
   haptics checks, review rounds, docs and the final write-up. Full depth
   and rounds still apply. It does not write core implementation code. A
   one-line tweak is the limit.
2. **All core implementation goes to Kilo Code:** components, scene and
   shader code, page builds, section I work, refactors, and any bug fix
   bigger than a one-line tweak.
3. How to delegate, exactly:
   `delegate_task` with `target: {providerInstanceId: 'acpRegistry_kilo',
   model: 'kilo/anthropic/claude-fable-5.2', options: {mode: 'code'}}`,
   `runtimeMode: 'full-access'`, `isolation: 'shared'` (this worktree).
   Never Kilo's orchestrator mode; a Kilo task never spawns subtasks. It
   stays inside the worktree: no outside paths, no global installs.
4. **One Kilo task at a time.** Wait, review its diff, run the tests and
   visual checks, then send the next. No parallel helpers on any provider.
5. Every brief stands alone (Kilo gets no history): spec sections, exact
   files, Arav's rules and bans, acceptance tests, commands. Kilo commits
   locally, SSH-signed as aravhawk@gmail.com, and never pushes. This thread
   pushes the signed checkpoint after review.
6. If a Kilo task shows `waiting` or looks idle for about 10 minutes, check
   `task_status` and `t3_pending_request` for it at once and unblock it. Two
   stalls on the same task: cancel, note why here, do that piece in this
   thread at the smallest scope.
7. A result below the bar goes back to Kilo with specific notes. It is not
   rewritten here.

8. Effort tiers on the Claude side (t257u, 2026-11-16 12:00 AM CT): this
   thread stays at High for thinking, planning and review. Non-critical
   Claude work (running through the app, routine testing, screenshot
   passes) goes to one Fable 5.2 Medium helper at a time, never more;
   trivially easy steps may use Low. Kilo is unchanged.

Unchanged: same branch, signed SSH pushes only, no merge, no deploy,
section I, haptics.

## Checklist

### 0. Setup
- [x] Preconditions verified (origin/main 9a487fb, clean tree, identity, SSH signing)
- [x] Scrapped attempt removed: worktree `redesign-fable-v4-20261115` and local
      branch `redesign/fable-v4-20261115` (never pushed; `git ls-remote` empty)
- [x] Scrapped attempt's evidence set aside, not reused:
      `~/.t3/portfolio-redesign-v4/_scrapped-kilo-attempt/`
- [x] Tooling outside git: `~/.t3/portfolio-redesign-v4/tools` (Playwright 1.65.1,
      Lighthouse 13)
- [x] Dependencies: lenis, web-haptics 0.0.6, vitest

### 1. Study
- [x] Skills loaded and recorded in `skills-evidence.md`
- [x] Reference study: parts 01 and 03 by helpers, part 02 by me, `reference-study.md` index and decision map
- [x] v2/v3 carry-over, `carry-over.md`
- [x] v3 lag root cause in `perf.md` (v4 measurements: numbers taken, write-up owed)

### 2. Design
- [x] `concept.md`, `motion-system.md` (both need the deep water pass written in)
- [~] `typography.md`: blind ranking done (X, Y, Z); the pick changed to X plus
      a serif accent; the doc and `font-licenses.md` must be rewritten to match

### 3. Content and metrics
- [x] `content-sources.md`, `lib/metrics`, snapshot, refresh script, weekly workflow, tests, `metrics.md`
- [ ] Refresh the snapshot on ship (`node scripts/refresh-metrics.mjs`)

### 4. Build
- [x] Water engine, home, /work, project pages, blog shell, states, theme, haptics, reduced motion
- [~] Deep water pass after the critic (commit 24a276c): done in this thread
      before the split. What is left goes to Kilo (list in the log below).

### 4b. Domains and sharing (section I)
- [x] Site URL constant, canonical, sitemap, robots, feed, JSON-LD on arav.pro; host redirects; OG images; icons; theme-color
- [ ] Re-verify on the final build: OG images now use the new faces (render
      each, check meta for home, one project, one post, grep aravjain.dev)

### 5. Gates (final build, 2026-11-16)
- [x] lint, typecheck, build, 196 unit tests
- [x] Overlap test with the ending's measured contrast: Chromium, six pages,
      seven widths, 0 overlaps after every Kilo task; the full three-browser
      run on the final build is recorded in the last log line
- [x] Perf traces: p95 16.7 to 16.8 ms on all four profiles, tier 0 on
      desktop, one backing size each (`perf.md`, `traces/v4-final`)
- [x] Lighthouse: desktop 95 to 100, mobile 88 to 94, others 100
- [x] Cross-browser matrix: 92 loads, 0 problems; touch emulation
- [x] Greps (dashes, banned words), 197 words on home, one file over 2 MB
      (the Agent Bridge film, 4.36 MB), blog and editor diff empty

### 6. Review
- [x] Rounds 1 to 5, `design-review.md`
- [x] Independent critics: 5.5, 5.8, 5.5, 5.8, 5.8. Target 8.5 not met
- [x] Rounds 6 to 9 on their findings (K1 to K6 by Kilo, reviewed here)

### 7. Finish
- [x] Final screenshots (`screenshots/<browser>-<page>-<width>.png`) and
      videos (`home-scroll-1440.webm`, `home-touch-390.webm`)
- [x] Snapshot refreshed; pushed; production server on 3133; final report

## Log

- 2026-11-15 11:30 CT. Session start. Cleanup done, tooling installed.
- 2026-11-15 14:30 CT. Concept chosen and prototyped: "Meltwater" (see
  concept.md when written). Engine works in `src/water/` (bed from DOM, wave +
  velocity + dye simulation, one shading pass, ice name with scroll melt).
  Lab page at `/lab` (delete before ship). Dev server: `pnpm exec next dev -p 3140`.
- 2026-11-15 14:30 CT. Seven background agents were started for research and
  the metrics library; all seven died on the shared Claude rate limit. What
  they left, and what is still owed:
  - Metrics library: DONE on disk (`src/lib/metrics`, snapshot, refresh
    script, weekly workflow, 191 passing tests). Owed: `metrics.md`, wiring
    into pages, a re-run of the refresh on ship day.
  - `carry-over.md`: draft on disk (large). Owed: review, trim, `perf.md`
    root cause (traces are in `~/.t3/portfolio-redesign-v4/traces/v3`,
    scripts in `tools/v2v3`).
  - Reference captures: `~/.t3/portfolio-redesign-v4/references/<site>/`
    for 24 sites, probe scripts and logs in `tools/refs-a|b|c`
    (`tools/refs-c/draft-water.md` has water notes). Owed: the written
    `reference-study.md`.
  - Fonts: about 100 OFL families downloaded to
    `~/.t3/portfolio-redesign-v4/fonts/` with `_meta/fonts.json`; five
    audition specimens in `specimens/pre/audition`. Owed: `typography.md`,
    bake-off, pick, licences.
  - Content: link checks in `sources/links/results.tsv`, raw pulls in
    `sources/raw`, media in `sources/assets/<project>`. Owed:
    `content-sources.md`, project fact sheets.
  - Rule from here: no more than one background agent at a time.
- 2026-11-15 15:10 CT. Correction: six of the seven helpers did finish
  (2:33 to 2:53 PM). On disk and reused: `reference-study/01-...` and
  `03-...`, `typography.md` (three sections left for me), `metrics.md`,
  `content-sources.md`, `carry-over.md`, `perf.md` (v4 measurements owed),
  plus `sources/project-facts.md` outside git. Home page, ending screen and
  all eight project beds are built; inner pages in progress.
- 2026-11-15 20:10 CT. Independent critic (one fresh agent, medium effort,
  captures only): 5.5 of 10. Blind type ranking X, Y, Z, and the build had
  shipped Z. Full text in `~/.t3/portfolio-redesign-v4/critic/review-1.md`.
  Worst findings: the name was not ice, the melt was a weight slider, most
  of the page was flat grey, the water read as a texture, the type looked
  default, empty pools on inner pages, the ending was a step down from v2.
- 2026-11-15 22:05 CT. Round 6, the deep water pass, pushed as 24a276c
  (signed). Oblique camera (walls, waterline and bed read as depth), summed
  curvature caustics, rivers about twice as wide, a lake from bank to bank,
  the name as a standing block of ice, a melt that sinks and clears, TASA
  Orbiter with Spline Sans Mono and a Newsreader accent, the ending with
  words set in the picture, a plain footer on inner pages, no empty pools.
  The overlap test's ending check turned out to be vacuous (it skipped
  `data-chrome`); it now photographs the picture behind every line and
  measures contrast. That failed the light ending at 1.6 to 1, so the light
  ending was regraded as a blue-hour dawn; it passes at five widths.
- 2026-11-15 22:10 CT. Work split (t256u, section above). From here this
  thread reviews and tests; Kilo implements. Uncommitted at the split: one
  line in `globals.css` (display tracking -0.036em, leading 0.94).
- Open items for Kilo, from round 6 review (to be sent one task at a time):
  1. Home word count back to 200 or under after the copy changes; check.
  2. Reduced motion, no WebGL, forced colours and print after the layout
     changes (full-bleed lake, new ending, footer).
  3. Whatever the second critic finds.
- 2026-11-16 00:50 CT. Second independent critic (fresh agent, run through
  Kilo on Fable 5.2 to spare the Claude allowance, captures only): 5.8 of
  10 (`critic/review-2.md`). Up on type (6.5), ending (7), legibility (7),
  phone (7); still low on the name as ice, the water reading as a pool
  texture in tubes, the flat ground, the melt reading as a fade, and craft
  against the references (5). Its project sheet was a broken capture (my
  script, a zsh word-split), so project pages were judged from three.
- Kilo task K1, "the water world", brief at `.tools/briefs/K1-water-world.md`
  (git-ignored): ice as clear glacier ice, erosion melt with visible
  meltwater, natural deep water without terraces, a dark theme lit for
  night, a lit stone ground with a wet shore, fewer and wider bodies of
  water with real media on Kilo Bench and RydAR, a wake that bends light
  instead of a grey veil, antialiased edges. Capture tooling for Kilo is
  copied into `.tools/` inside the worktree so it never needs an outside path.
- Next after K1: K2 (ending: mountains, sun, the top-down phase using the
  page's own caustics; body copy scale; inner pages; small fixes), then a
  third score.
- 2026-11-16 03:35 CT. Kilo tasks K1, K2 and K3 done, each reviewed here
  from its captures and pushed as a signed checkpoint (K1 `314c747`, K2
  `d3914fb`, K3 `0fb181c`; all Kilo commits verify as signed). K1: clear
  ice, erosion melt, natural deep water without terraces, lit stone, wider
  streams, real media on Kilo Bench and RydAR, a wake of real ripples,
  antialiased edges. K2: meltwater without fog, luminous night water, the
  ending rebuilt (seamless handover, sculpted ranges, sun behind the ridge,
  the clipped full stop), body copy scale, small fixes. K3: a melt that
  never breaks into fragments, night caustics as a filled net, live water
  before the ending. Gates after each: lint, typecheck, 196 tests, overlap
  test 0 overlaps at seven widths, 197 words on home, p95 16.7 to 16.8 ms.
- 2026-11-16 03:54 CT. Third independent critic (fresh, through Kilo):
  5.5 of 10 (`critic/review-3.md`). Ending 7.5 ("the dark ending is the
  best frame in the build and beats v2"), five-second read 7.5; water 4.5,
  project pages 4, craft 5. Its project score rests partly on my capture
  (first and last screen only, so the pages looked like stubs): the next
  package shows whole pages. Its top finding is the same as the other two
  critics' in three different builds: the name as raised letters reads as
  a text effect whatever the material.
- Decision: stop tuning raised letters. Kilo task K4
  (`.tools/briefs/K4-frozen-lake.md`): the lake is covered by a sheet of
  lake ice and the name is cut through it, so the letters are live water
  seen through the ice; the melt is the sheet breaking up into floes that
  drift to the outlet. Also in K4: visible flow and a difference between
  runs and pools, a lit dark ground, a larger Kilo Bench image, the light
  ending's glints and colour handover, the gutter look on inner pages, a
  nav that leaves when the page scrolls down, a wake drawn by shading.
- After K4: review, a fourth and final independent score, then the final
  gates, the remaining docs and the report, whatever the score is. The
  report states the scores as they are.
- 2026-11-16 04:33 CT. K4 done, reviewed and pushed (`c630b1d`): the frozen
  lake (the name cut through a sheet of lake ice as live water; the melt
  is the sheet breaking into floes), runs and pools as different water, a
  lit dark ground, a larger Kilo Bench image, the light ending's sun path
  and colour handover, a wandering stream on inner pages, a nav that
  leaves on scroll down, a wake by shading.
- 2026-11-16 06:36 CT. K5 done, reviewed and pushed (`5d4be01`): night ice
  in dark theme (mean ice luminance 0.25, name 3.3 to 1), crisp drifted
  snow over clear ice in light with a lead of open water at the north
  shore (name 5.2 to 1), whole round floes that go largest last, no crease
  or terracing in the stream bed. Kilo caught a frame-time regression of
  its own (the fracture field cost 33 ms p95 under GPU contention) and
  fixed it before handing back.
- 2026-11-16 07:00 CT. Final gates on the K5 build (production, port 3141):
  perf p95 16.7 to 16.8 ms on all four profiles, tier 0 desktop, one
  backing size each; Lighthouse desktop 99, 100, 100, 100 and mobile 90,
  94, 88, 93 (home, /work, project, post), accessibility, best practices
  and SEO 100 everywhere; cross-browser matrix 92 loads, 0 problems; home
  197 words; states and haptics wiring pass. Section I re-verified: every
  canonical and OG URL on arav.pro, no stray aravjain.dev. The OG cards
  rendered but still drew the first build's look: sent to Kilo in K6.
- 2026-11-16 07:05 CT. Fourth independent critic: 5.8 of 10
  (`critic/review-4.md`). Four fresh critics, four builds: 5.5, 5.8, 5.5,
  5.8. The target of 8.5 is not met and the report says so. Its real,
  specific findings went to Kilo as K6 (`.tools/briefs/K6-last-fixes.md`):
  the dark hero's legibility, stepped edges on the ice at 2x, cracks
  cutting the name, a wake that had become too faint, a screen of plain
  water after the melt, the dark colour handover into the ending, halos,
  an empty spinner image, and the OG cards.
- After K6: review, final build, the full gate set once more (three-browser
  overlap run, perf, Lighthouse, matrix), a closing score for the record,
  final screenshots and videos, snapshot refresh, production server on
  3133, the report.
- 2026-11-16 07:48 CT. K6 done, reviewed and pushed (`e04fcd1`): dark hero
  with the name as lit water (4.5 to 1), crisp ice edges at 2x, cracks that
  route round the name, a stronger wake, a shorter lake, a graded dark
  handover into the ending, the empty spinner image dropped from the Kilo
  Bench page, the five OG cards redrawn.
- 2026-11-16 08:09 CT. Final build. Snapshot refreshed (`0a374c8`). Gates
  re-run on it (checklist above). Closing independent score 5.8
  (`critic/review-5.md`). No further passes: five scores in a row within
  0.3 of each other say another pass of the same kind will not move it.
- 2026-11-16 10:25 CT. Full overlap run on the final build finished: 189
  page runs (Chromium, WebKit, Firefox x seven widths x nine pages), 7,749
  scroll positions, 0 overlaps; worst ending contrast 3.32 at 320 wide
  (large type, bar 3). All 36 commits on the branch verify as signed.

## New bar (Arav, t260u and t261u, 2026-11-16 10:22 AM CT)

Do not close out at 5.5 to 5.8. Push v4 until a fresh panel of independent
critics gives a **median of 9.5 or more with no critic under 9**, same
rubric, no softening. Rounds: this thread plans, briefs, reviews and tests;
Kilo implements, one task at a time (same delegate settings as above);
after each round the full gates, then a fresh panel. Standing rules all
hold. If the usage limit comes again: push a signed checkpoint and write
exactly where things stand here first.

## Ranked gap list (from all five reviews, restudied against the references)

Scores so far: 5.5, 5.8, 5.5, 5.8, 5.8. Ranked by how much each theme
holds the score down, with what the critics said and what the references
do instead.

### 1. Art direction and identity: it is a relief, the references are worlds (craft 4.5 to 5, water 4.5 to 5.5)
- "No camera, no lighting change, no depth, no moment of spectacle after
  the first screen" (1). "A 2D pipe diagram" (4). "Flat next to Igloo's
  lit 3D scene and Lando's density" (5). "A flat grey page with a tube
  drawn on it" (2).
- References: every screen of Igloo, Lusion and Lando has **one large, lit,
  three-dimensional subject** seen through a real camera, with atmosphere
  (haze, sky, reflections), and small confident type around it. Igloo puts
  each portfolio item in the scene as an object with HUD callouts on
  leader lines. Lusion's pages are led by large rendered media.
- The one part of this build the critics put at reference level is the
  ending ("the best frame in the build", "beats v2"): a perspective scene
  with a sky, ranges, a sun and water. The second is the Infiniview beat:
  one large real product image standing in water beside one large title.
- Conclusion: the page has to become what its ending already is. One
  world seen through a camera that travels, with a horizon and weather,
  and one large subject per screen.

### 2. Hero and melt craft (the top finding in every review)
- Three builds of raised letters: "embossed plastic", "2000s 3D text",
  "WordArt". The ice sheet with the name cut through it: "flat posterised
  ice", "pixel-stepped", dark "camouflage" then "dated neon".
- The melt: "font-weight slider" (1), "cross-fade" (2, 3), "cartoon round
  floes; keep the name legible and break the ice into angular drifting
  plates" (5). A smudge where the lake meets its outlet.
- Needed: ice as one lit, refractive surface with real depth, seen at an
  angle under a sky so it has reflections and a horizon; angular plates;
  the name legible until the sheet goes; the meltwater visibly becoming
  the river.

### 3. Water character (4.5 to 5.5)
- "Uniform pipe", "gel hose", "one repeating caustic texture", "plumbing".
  The wake and click "nearly invisible" in stills (4, 5).
- Needed: water as bodies in a landscape (a lake, rapids, pools, a
  delta), with reflections of the sky and ranges, visible current, and a
  wake you can see in one frame.

### 4. Project pages and inner pages (4 to 6.5)
- "A stub template: title, one paragraph, a facts row and NEXT" (3);
  "narrow column with an empty right half" (5); Kilo Bench "empty teal
  placeholder", "unreadable screenshot" (4, 5); "the same pipe on every
  inner page" (3).
- References: Lusion's case pages are led by large media, full width, with
  dense, composed sections.
- Needed: case pages led by large readable media, using the full width, a
  different composition per project, no placeholder anywhere.

### 5. Typography, spacing and density (5 to 7)
- The system is now right ("good serif, mono and grotesk system", 5).
  What is left: "under-scaled at 1440 and 1920", "too much empty space and
  tiny type", "footer text is tiny", "body small on inner pages".
- References: Lusion sets 140 px headings against 13 px labels and fills
  the frame; Lando is dense.
- Needed: screens composed to the frame, not columns in a tall page.

### 6. Light and dark as two designs (4.5 to 6.5)
- "Dark is a palette swap" (2); "dark hero reads as camouflage" (4);
  "light hero reads as camouflage, dark hero as dated neon" (5).
- Needed: two times of day in one world, each lit on purpose.

### 7. Ending (5.5 to 7.5: the strongest part, still short of 9)
- "Lost v2's signature element (the falling light stream, the bokeh
  waterline)" (4, 5); "aliased glitter", "smeared ripples bottom right",
  "melted-looking mountains", "orphaned RSS" (5); light dawn "purple/pink".
- Needed: one signature light event, cleaner glitter, firmer ranges, the
  footer row composed.

### 8. Polish (softness 5 to 7; phone 6 to 7)
- Stepped or soft edges at 2x; halos; smudges; labels crowding channel
  ends on phones; dev badge in a capture (mine); a spinner screenshot.
- Process: critics 4 and 5 could not open four reference images and had
  the brief cut short by their tools. The next packages use smaller
  images and shorter files, the same rubric, a panel of three, and finer
  motion strips. Nothing about the scoring is softened.

### Decision for round 10
Stop improving the relief. Rebuild the home page as **one flight**: a fixed
full-screen scene seen through a perspective camera that travels down the
meltwater river as the page scrolls, from the frozen lake (the name cut
through the ice, under a sky, ranges on the horizon) through one composed
station per project (real media standing in the world, data as callouts
on leader lines) to the sea at dawn, which is the existing ending. The
engine's planes, distance fields, simulation and materials carry over: a
pitched camera is a different mapping from pixel to ray, not a different
renderer. Text is overlaid in composed zones and its contrast is measured
at every scroll position, as the ending's already is. Built first at a
temporary route so the shipped home page is not broken while it is judged.

## Final phase, after the design reaches the bar: music and sound (Arav, t262u, 2026-11-16 10:46 AM CT)

Not before the critics' median is 9.5 or more. It must not distract from
the design rounds. v4 gets properly made and composed music and sound
effects, as igloo.inc and other award sites have.

1. **Study first.** How Igloo and two or three other Site of the Day
   winners handle audio: the ambient score, UI and interaction sounds tied
   to motion, the sound toggle, and the default-muted start browsers
   require. Written up next to the reference study.
2. **One sound design for the ice-to-water idea.** An ambient bed, plus
   effects for the melt, scroll, hovers and the moments that already have
   haptics. Mixed and level-balanced, nothing harsh.
3. **Sources.** Original, synthesised (Web Audio) or properly licensed
   only (CC0 or royalty-free with the licence recorded in the repo, as
   the fonts' are). Never unlicensed audio.
4. **Control.** A clear, elegant sound on/off control. Off by default
   until the visitor turns it on; the choice is remembered; reduced
   motion and the user's choice are respected.
5. **Weight.** Audio loads lazily after the first interaction; the
   performance budget and the Lighthouse gates still hold.
6. **Who does what.** Kilo implements, one task at a time. This thread
   reviews by measurement (waveform and loudness analysis, clipping,
   level balance between bed and effects) and adds sound to the critics'
   rubric.
7. **Sync and fit (Arav, t263u): the sound is not a background layer.**
   igloo.inc is the primary audio benchmark: study its audio behaviour in
   detail and match its level of integration. Every effect is driven by
   the same interaction and animation state as the picture (scroll
   velocity, melt progress, hover and press, transitions, the pointer's
   wake), timed to the frame, with its parameters modulated live (pitch,
   filter, gain, stereo position) instead of fixed one-shots. The
   critics score **sync and fit** as their own line in the rubric.

## Round 10 log
- 2026-11-16 10:30 CT. Kilo task K7 started
  (`.tools/briefs/K7-the-flight.md`): a prototype at `/flight` of the home
  page as one world seen through a travelling perspective camera (frozen
  lake under a sky, melt and descent, the statement on the bank, the
  Infiniview slab in its basin with its reflection, hand-over to the
  existing ending), plus `scripts/legibility-test.mjs` (contrast behind
  every line of text at 40 or more scroll positions, both themes). The
  shipped home page is untouched until the prototype is judged.
- 2026-11-16 11:40 CT. K7 done and pushed (`222d41c`, signed). Its run sat
  idle for 17 minutes after it had committed and written its report, with
  nothing pending, so the run was closed (first stall of a Kilo task;
  nothing lost). The prototype works: `/flight` is one world through a
  travelling camera, legibility test passes at 390 and 1440 in both
  themes, existing pages untouched. It drops frames at 1728 wide (6
  percent) and under contention (p95 33 ms): a gate for the next task.
- 2026-11-16 11:48 CT. Interim independent read on the prototype (one
  critic, all 29 images opened this time): **6.0**, the highest so far.
  "The idea is at reference level; the rendering looks like a real-time
  demo scene." (`critic/review-6.md`). Worst: the hero name pale on pale
  and stepped; the ground "one striped noise texture"; the object "a flat
  screenshot rectangle on a snow disc"; dark "reads as neon"; the river
  "a uniform band"; smeared mountains.
- Kilo task K8 (`.tools/briefs/K8-from-demo-to-film.md`): render quality.
  Baked, mip-mapped, anisotropically filtered ground; real ranges; a sun,
  an aurora at night that open water mirrors (in place of water that
  glows by itself), a film finish; the hero as a binding composition with
  the name cut anamorphically and 4.5 to 1 measured in both themes; a
  river with visible current and angular plates; the object as a thing
  with a body, light and a clean reflection; frame rate as a hard gate
  (p95 16.7 ms or under and under 1 percent of frames over 25 ms on every
  profile).
- Then: K9 (the other seven stations, the ending inside the same world,
  time of day that moves with the scroll, swap into the home page,
  fallbacks, phone), K10 (project and inner pages led by large media),
  then a panel of three critics.
- 2026-11-16 12:29 CT. K8 failed before changing anything: the Kilo
  gateway stops any single response at 600 seconds, and its first big
  edit ran past that. Nothing lost (tree clean at `0b4ec0d`). Relaunched
  as two smaller tasks with an instruction to edit in small steps and
  commit per part. **K8a (running):** ground, ranges, sky, aurora, film
  finish, frame rate. **K8b (next):** the hero's composition and
  anamorphic name, the river and the melt's plates, the project object,
  the small named faults. Briefs for Kilo from here on always carry the
  small-steps instruction.
- 2026-11-16 14:35 CT. K8a done, reviewed and pushed (`b84354f`, seven
  signed commits): baked snow with form, real ranges from a marched
  height field baked to a panorama, a sun in frame, an aurora and stars
  that open water mirrors, a film finish on a float target, no world
  edge in the run-out, legibility passing at 390, 768, 1440 and 2560 in
  both themes. Frame rate: the two desktop profiles and the throttled
  phone hold p95 16.7 to 16.8 ms with 0.1 to 0.3 percent slow frames on
  tier 0; the contended profile does not (7 percent of scroll frames).
  My review of the frames: the world now reads as a film; the hero's
  composition, the river's surface and the object are still the
  prototype's.
- 2026-11-16 14:40 CT. K8b started (`.tools/briefs/K8b-hero-water-object.md`):
  the hero as a poster with the name cut anamorphically, water that reads
  as water in both themes, angular plates, the object as a monolith in a
  walled basin, and a governor that drops a shading tier under contention
  (never resolution) so the fourth profile passes.
- 2026-11-16 15:30 CT. K8b done, reviewed and pushed (`9a96439`, five
  signed commits): the hero as a poster (a vast lake to the far shore,
  the name cut anamorphically, measured 5.6 to 6.9 to 1 by day and 4.7 to
  5.9 at night), a river with current and wet banks, a night reflection
  that reads as water, the object as a monolith on rock, a governor that
  drops shading and never resolution. Gates: legibility passes at four
  widths in both themes, existing pages untouched. Frame rate: three
  profiles pass; the contended one still misses (8.4 percent of scroll
  frames) even at the leanest step. Kilo measured the cause: fill at
  full size with two windows on the GPU, not the shading maths.
- 2026-11-16 15:54 CT. Second interim independent read: **6.7**
  (`critic/review-7.md`). Sub-scores: water 6, legibility 7.5, sharpness
  6.5, type 7.5, five-second read 8.5, ending 7, light and dark 7.5,
  project pages 7, phone 6.5, craft 6.5. Series so far: 5.5, 5.8, 5.5,
  5.8, 5.8 (the relief), 6.0, 6.7 (the flight). Top findings: the name
  squashes as the camera descends and still reads as extruded lettering;
  the object is "a stock floating monitor"; hexagon lines in the ice;
  saw-toothed shorelines; the unbuilt stretches are empty; inner pages
  are "white paper with a gel tube ... a different world from the home".
- Next, one Kilo task at a time:
  K8c (`.tools/briefs/K8c-name-object-polish.md`): the name as open water
  that mirrors the scene with a bright recessed rim; the camera holds the
  hero's view until the name's ice has gone; cracks and shorelines; the
  first object as a block of ice with the product frozen inside; one
  full-size pass (bloom from the previous frame) for the contended
  profile; the start-up long task.
  K9a (`.tools/briefs/K9a-stations-2-4.md`): callouts on leader lines;
  Upstream as a confluence of seven streams; Kilo Bench; Agent Bridge as
  two lights across still water.
  K9b: Open models, cc-switch, TensorPoW, RydAR.
  K9c: interests, the ending inside the same world (no top-down caustic
  screens), the swap into the home page, fallbacks, phone paths.
  K10: project and inner pages in the home's world, led by large real
  media (staged in `.tools/assets/` with their sources).
  Then a panel of three critics; rounds continue until the median is 9.5
  with none under 9. Then the sound phase.
- 2026-11-16 17:00 CT. K8c done, reviewed and pushed (`30f77ee`, eight
  signed commits): the name as open water with a bright recessed rim on
  the far side only (no dark wall), the camera holding the hero's view
  until the name's ice has gone, wandering fractures into plates of
  different sizes, shorelines with a shelf and a foam line, the first
  object as a block of glacier ice with the product frozen inside it,
  one full-size pass straight to the screen with last frame's glow,
  start-up in short tasks (0 long tasks on desktop), the statement
  larger on phones. Gates: legibility passes at four widths in both
  themes, existing pages untouched, three perf profiles pass on tier 0.
  **Open gate:** the two-windows stress profile still drops 8.8 percent
  of scroll frames (p95 33 ms). One pass did not fix it; the real GPU
  time per frame at 2880 x 1800 is close to the budget on this machine.
  A later task must find a leaner tier that is a real saving. Not
  relaxed, not hidden.
- 2026-11-16 17:02 CT. K9a started (`.tools/briefs/K9a-stations-2-4.md`).
- Note on times: until 2026-11-16 17:30 CT the times in this log from
  round 6 on were written from memory and had drifted by up to six
  hours. They are now corrected from the commit timestamps (central
  time). From here each entry's time is read from the clock.
- 2026-11-16 18:42 CT. K9a done, reviewed and pushed (`f23dbbd`, five signed
  commits): world-anchored callouts on leader lines; station 2, the
  Upstream confluence of seven streams with the live figure; station 3,
  Kilo Bench's results on the bed of a clear pool; station 4, Agent
  Bridge's two lit shards across a still tarn with a crossing pulse;
  phone paths; legibility passing at four widths in both themes; three
  perf profiles pass on tier 0; contended still open (6 percent).
  Kilo's own shortfalls, kept for the polish pass after the journey is
  whole: the falls are short white bars; plumes merge; two captions off
  frame on phones; the results picture's own text is small; no stones on
  the pool's bed; shards cast no shadow; fewer capture rounds than asked;
  no 2x frames, no motion strips, no WebKit or Firefox captures.
- 2026-11-16 18:42 CT. K9b started (`.tools/briefs/K9b-stations-5-8.md`):
  Open models as four columns of ice sized by pulls, cc-switch as a dam
  with three sluices the switch really opens, TensorPoW as a lattice of
  ice, RydAR as a canyon the camera banks through.
- 2026-11-16 21:35 CT. K9b done and reviewed (`4e8f21e`, six signed commits): station
  5, four columns of ice as tall as each model's pulls with callouts;
  station 6, a dam of ice with three sluices the home page's real switch
  opens; station 7, a four by four lattice of ice; station 8, a canyon of
  blue ice the camera banks through with the app seen in the ice wall.
  The flight now runs lake, statement, eight stations, run-out, old
  ending. Legibility passes at 390, 768, 1440 and 2560 in both themes;
  existing pages untouched. **Frame rate regressed and is open:** 1440
  passes on tier 0; 1728 holds p95 16.8 ms but drops to the leanest tier
  with 2.4 percent slow frames; contended 13 percent. Kilo's own
  shortfalls per station are in `.tools/out/k9b/REPORT.md` (the ice is
  flat-lit, the dam is blocky, meltwater reads as lines).

## Change of hands (Arav, t266u, 2026-11-16 about 9:21 PM CT)

Arav's Claude plan is now Ultra (no 5-hour session limit, about double
the weekly limit). **Kilo is stopped.** K9b was the last Kilo task; its
committed work is kept; nothing more is sent to Kilo. From here all core
implementation happens in Claude Code on Fable 5.2: this thread
implements directly, or uses a single Claude helper where that is
genuinely useful, never more than one at a time. Effort: High for
thinking, planning, design decisions and review; Medium for run-throughs
and testing; Low for trivial steps. No need to pace work around a
session window. Unchanged: the 9.5 bar with the critic panel, the sound
phase after it, signed SSH commits and pushed checkpoints, no PR, no
merge. The briefs written for Kilo (`.tools/briefs/K9c-*.md` onward) are
still the specifications; the "gateway kills a response at 600 seconds"
rule in them was Kilo's and no longer applies. Independent critics now
run as a single Claude helper at Medium effort, captures only, as the
first one did.

## What is left, in order
1. The delta, the ending inside the flight, the flight becomes the home
   page (`.tools/briefs/K9c-ending-and-swap.md`).
2. Frame rate: every profile back inside the gate with eight stations
   (tier 0 at 1440 and 1728; the contended profile).
3. A polish pass over all eight stations and the hero from the reports'
   own shortfalls and critic 7's findings.
4. Project and inner pages in the home's world, led by large real media
   (assets staged in `.tools/assets/`, facts in `project-facts.md`).
5. Full gates, then a panel of three independent critics. Rounds until
   the median is 9.5 with none under 9.
6. The sound phase.


## All in, in parallel (Arav, t268u, 2026-11-16 11:38 PM CT)

Arav's direction, which replaces the one-helper limit above: finish v4
completely tonight. The weekly limit is at 93 percent remaining and
resets on Nov 17 at 1 PM CT, so use it fully. As many parallel Claude
helpers as genuinely speed the work up, on any model tier; **Fable 5.2
never above High effort** (High for critical design, planning and
review; Medium and Low for testing and trivial steps). Each helper gets
a disjoint area so no two duplicate or clash; this thread stays
responsible for integration and clean commits. No Kilo. To finish:
frame rate at large screens, polish on the stations and the hero,
project pages in the new style, per-page sharing cards with the
arav.pro canonical, WebHaptics, the metrics, full gates, then the
composed sound phase (igloo.inc as the benchmark), then fresh
independent critic rounds until the median is 9.5 with none under 9.
Commits SSH-signed and pushed as frequent checkpoints. No PR and no
merge from this thread: Arav opens the PR when this file says DONE.

### K9c (the last single helper), reviewed and pushed, 23:59

Five signed commits, `8e81133` to `7ebccf1`, pushed. **The flight is
now the home page at `/`**: the old relief page, `/flight`, the
separate `Ending` canvas and its shader are gone. New: the delta (the
river parts into three arms and six braids; the interests stand
there); time passes along the flight (cold morning to low sun; polar
night to first light); the ending is the flight's last frame, with one
light event per visit (the sun's edge clears the lowest saddle of the
ranges, found per device, and a line of light runs in across the sea);
the "words' lee" (the picture keeps itself calm behind whichever words
are up); reduced motion as composed stills; a plain stacked page
without WebGL; the home sharing card redrawn as the hero.

Gates at `7ebccf1`: lint, typecheck clean; 196 tests; build; legibility
on `/` at seven widths in both themes, 9,286 lines, 0 failures; overlap
on eight pages at seven widths, 2,583 positions, 0 overlaps; 197 words,
0 dashes, 0 console errors; protected paths diff empty.

**Frame rate is the open gate.** Fixed harness (every profile now
scrolls the whole page):

| profile | slow frames | p95 | tier |
| --- | --- | --- | --- |
| desktop-1440-dpr2 | 1 / 2,443 | 16.7 | 0 |
| desktop-1728-dpr2 | 93 / 2,350 (4.0%) | 16.8 | one step lean |
| phone-390-dpr3-cpu4x | 0 / 2,406 | 16.7 | 1 |
| desktop-1440-dpr2-contended | 331 / 2,109 | 33.4 | two steps lean |

The useful finding: the GPU driver's cost follows the whole shader's
shape, so code that never runs still slows the frame. The pass is now
compiled in two variants (the sea's code only from the canyon on).
The next step is a variant per stretch of the flight.

### The wave (launched 2026-11-17 about 00:05)

Six helpers, each in its own worktree and branch, its own ports, its
own files, briefs in `.tools/briefs/W*.md` (rules common to all in
`W-common.md`). None pushes; this thread cherry-picks their commits
onto the branch, re-runs the gates and pushes.

| helper | area | ports |
| --- | --- | --- |
| W1 | the hero: the name as open water, lake ice, the melt, ranges, the river between stations | 3151 / 3161 |
| W2 | stations 1 to 4 (Infiniview, Upstream, Kilo Bench, Agent Bridge) and callouts | 3152 / 3162 |
| W3 | stations 5 to 8 (Open models, cc-switch, TensorPoW, RydAR), the delta, the sea, the ending | 3153 / 3163 |
| W4 | every inner page in the home page's world: project pages as case studies, work, blog, 404 | 3154 / 3164 |
| W5 | sound: study of igloo.inc, a composed generative bed and effects driven by the picture's state | 3155 / 3165 |
| W6 | sharing cards from the real picture on every route, arav.pro canonical, icons (Medium effort) | 3156 / 3166 |

After the wave, in order: integrate; the frame-rate task alone on the
GPU (a compiled variant per stretch); haptics and metrics checks; full
gates; a panel of three fresh critics; rounds until the bar.

### The wave, first passes integrated (2026-11-17, 00:20 to 01:45)

Each helper worked in its own worktree; this thread cherry-picked its
commits onto the branch (every one re-signed and verified), resolved
the overlaps in `src/water/shaders/flight.ts` by hand, re-ran lint,
typecheck and tests, ran the merged build in a browser, and pushed.

| helper | commits on the branch | what landed | what its author says is still short |
| --- | --- | --- | --- |
| W6 cards | `e3f6792` to `a52c801` | every route's sharing card is its words over the real picture (photographed by `scripts/capture-og.mjs`); arav.pro in every canonical, `og:url`, sitemap, robots, feed and JSON-LD through one constant; 308s from the old domains; favicon, apple-touch-icon, `theme-color` | cards must be re-photographed after the picture settles; two cards set words over their subject |
| W1 hero | `b6bbabe` to `0c951d5` | the name's water mirrors sky and ranges with a glitter path and plates afloat; thicker sheet; swept ice toward the far shore; a bent far coast; the sheet breaks along wandering fractures into plates of every size; torn foam and white water on the river | at 320 px the name can still be read as lettering; the name's pool becomes a clean capsule in the melt; square shallows at the outlet |
| W5 sound | `103ee05` to `e3b23af` | a study of igloo.inc, lusion.co, activetheory.net and unseen.co by instrumenting Web Audio; a generative piece in one key (B minor to D major at the dawn) with voice-leading; wind, water, cracks, drips, the shards' call and answer, the lattice's arpeggio, the gates and the dawn bells all steered from the picture's state each frame through `src/lib/signals.ts`; no audio files; nothing loads until turned on; 26 rendered scenes measured; 41 new tests | nobody has listened; 16 of 235 frame-driven moments later than one frame; a long task at turn-on; water is a loop |
| W2 stations 1 to 4 | `3a27146` to `8819d8d` | the block stands in its basin's water with an interior and breaking waves; seven falls over an ice cliff sized by merged pull requests; the leaderboard cropped and larger in a pool with stones and an ice rim; shards in real ice with a bent mirror image | the block is a clean box; the cliff is one plane; Kilo Bench's table text is 9 px; day shards are pastel |
| W3 stations 5 to 8, delta, ending | `6d3a664` to `903429e`, then `71debe9` | one ice material for all four; columns whose volume is the pulls; a dam seen from downstream, with no hitch on a switch change (it was 74 to 94 ms); a wider canyon with a hall for the app; more braids and drift ice; the ending's hard sun limb, true line of light, a sun pillar, the foot row joined to the links | prisms, not seracs; the canyon's first bend is one wall and a third dearer per frame; the delta is not a blaze |
| W4 inner pages | `07d11ab`'s picks to `106d403` | every inner page opens on a live frame of the home page's world (`src/water/scene-band.ts`) and continues over lit snow; project pages are case studies led by large real media, with numbers at scale; work index, blog, post, 404, error, loading in the same world; the footer as one row; 22,516 lines of text measured for contrast, 0 failures; no horizontal scroll on 12 pages at 11 widths | 44 scene stills to retake after the picture settles; the ground "good, not great"; blog pages now revalidate hourly |

State at `106d403`: lint and typecheck clean, 237 tests, production
build, 197 visible words on the home page, 0 dashes, 0 console errors.

### Second passes (running) and critic panel 8

Launched as each first pass landed, each from the merged head:
**W7** hero pass 2 (the name as a melt pond: a pale shallow margin
deepening to dark water, no wall or bevel, one sky mirrored across all
the letters; the outlet's square shallows; the capsule; the empty
frames), **W8** sound pass 2 (clocked moments scheduled ahead on the
audio clock so they cannot be late; a live bubble model for water; ice
that sings; a returning motif; three rooms; a phone tier), **W9**
stations 1 to 4 pass 2 (Kilo Bench as a real rock pool with readable
results first), **W10** stations 5 to 8 and delta pass 2.

**Critic panel 8** (three fresh critics, Medium effort, captures only,
same rubric a to j, proofs required) is judging `106d403`: package at
`~/.t3/portfolio-redesign-v4/critic/package8/` (58 images: the home
page in 24 positions at 1440 and 390 in both themes, 13 full frames a
theme at 2x, phone frames, every inner page top to bottom, three
project pages' first screens). Sound is not judged this round.

### Critic panel 8: 6.6, 7.2, 6.8 (median 6.8), about 02:20

Scores and the shared findings are in `design-review.md` ("Panel 8").
The reviews are at `~/.t3/portfolio-redesign-v4/critic/review-8a.md`,
`-8b.md`, `-8c.md`. Not at the bar. Started the same hour, each from
the merged head and each in its own area: **W11** inner pages pass 2
(the ground; one skeleton eight times), **W12** the home page's words
(held through every station, a progress rail, the nav, layouts, type),
**W13** the ending (v2's ribbon of light and its mirror), **W14** the
name as standing letters of glacier ice (an alternative to W7's pool
of meltwater; one of the two is kept). Still to assign once the
running passes on the shaders land: the snow's sharpness, the dark
theme, the pictures set in ice. Then the frame-rate task, alone.

### Second passes integrated; panel 9 under way (2026-11-17, about 02:30 to 05:35)

Everything panel 8 found was answered by a helper and merged the same
way as the first wave (cherry-picked, re-signed, conflicts resolved by
hand, gates re-run, the merged build looked at, pushed).

| helper | what landed |
| --- | --- |
| W7 hero pass 2 | the lake's far mirror of the ranges, plates through the melt, the outlet without square shallows (its pond version of the name was then replaced) |
| W9 stations 1 to 4, pass 2 | Kilo Bench as a rock pool with a horizon, boulders and the results as readable plates (digits 15 to 24 px at 1440); a rough-hewn block; a bent cliff with falls that have volume; darker shards |
| W8 sound pass 2 | clocked moments scheduled ahead on the audio clock; a live bubble model for water; ice that sings; a returning five-note theme; three rooms; a phone tier; inner pages sound under the pointer |
| W11 inner pages pass 2 | eight project pages with eight structures; a ground of drawn wind ridges, grain and glints; clean pictures; the archive reordered; the blog index as its newest post in full |
| W14 then W17 the name | **the name stands on the lake as letters of pale glacier ice on a swept field of black lake ice, mirrored in it**; through the melt it reads "Arav Jain" or nothing at every position in both themes. (Decision: standing ice over W7's pond, which smeared mid-melt; all three critics and the owner's own words asked for ice. The name is held to the large-text contrast of 3 to 1 against the ice round it; it measures 4.25 to 5.79 except by day at 320 wide and at 2560 x 900, 2.92 and 2.52, where the hero's copy stands under the letters' feet.) |
| W13 the ending | v2's signature back as this site's own: the river's line of light runs out across a mirror-still sea and rises as a ribbon out of the frame; deep blue and gold; no scrim; RSS in the contact row |
| W10 stations 5 to 8, pass 2 | seracs for the four models; one dam with three cuts, a dark pond and dry beds; sixteen melted cubes askew; a crevasse opening the canyon's first reach, the app in rimed ice; a late-day delta |
| W15 snow and air | wind-cut drifts and sastrugi with cast shade at three sizes, sparkle fixed to the ground; banks with an ice shelf; finer ranges; no ghost stations in the haze |
| W12 words, nav, type | every station named for its whole stretch (22 of 24 strip positions carry copy; it was 6); a wordless rail of ticks; the nav back at rest and on any upward scroll; varied layouts; phone captions at 11 px or more; display tracking opened. The home page is at exactly 200 visible words |
| W16 night | aurora as tall drifting curtains that never clip; night water dark with mirrors; blue-grey snow with first light growing along the flight; the rust rings and the tarn's dimming found and removed |
| W18 pictures and night ice | real larger sources, mip-mapped: Infiniview's own sharing card in the block (1.72 source px per device px at 1440 at 2x), RydAR's page (about 1.4), Kilo Bench's results at 2324 px (0.26 to 0.36: the largest real source); one night ice on all eight subjects |

Also: the 44 scene stills and the 11 card pictures were retaken from
this picture and the cards' alt text rewritten (`3f0f3f7`).

State at `3f0f3f7`: lint and typecheck clean, 293 tests, production
build, 200 visible words, 0 dashes, 0 console errors.

Running: **P1** (frame rate, alone on the GPU: a compiled shader
variant per stretch of the flight; nothing has been measured cleanly
since the picture was rebuilt, and every helper reports its cost as
unproven), **W19** (the sound brought into line with the picture as it
now is: the arrival recomposed for the line running out and the ribbon
climbing, the name's melt, each station's water), and **critic panel
9** on `3f0f3f7` (package at `~/.t3/portfolio-redesign-v4/critic/package9/`,
58 images, same rubric; captures pin the engine's full shading, which
the frame-rate task must make the real behaviour on an idle machine).

### Critic panel 9: 7.1, 7.0, 7.3 (median 7.1), about 05:50

Up from 6.8; not at the bar. Scores and shared findings are in
`design-review.md` ("Panel 9"); reviews at
`~/.t3/portfolio-redesign-v4/critic/review-9a.md`, `-9b.md`, `-9c.md`.
A third round was started on what the three share, each helper in its
own area, while the frame-rate task (P1) restructures the shader: the
words' layer (overlaps in transit, titles crossing scene edges,
captions), inner pages, the stations' materials (RydAR, Kilo Bench,
cc-switch first), the melt, the night's snow, the delta and the
ending's air. A final clean frame-rate measurement follows when
nothing else is on the GPU.

## Kilo R3a/R3b (Nov 17, 2026, morning CT)

Done by Kilo in code mode while the orchestrator thread was paused. Briefs: `.tools/briefs/R3a-words.md`, `R3b-inner.md`. Branch `redesign/fable-v4b-20261115`, pushed over SSH, both commits SSH-signed (aravhawk@gmail.com, verified with `git log --show-signature -1`). No PR, no merge.

### Commits

- `d4d450e` feat(v4): R3a the home page's words
- `bccb701` feat(v4): R3b inner pages

### Tests

- `pnpm lint`, `pnpm typecheck`: clean after each task. `pnpm test`: 15 files, 296 tests pass (3 new in `tests/water/words.test.ts`). `pnpm build`: passes after each task.
- New `scripts/words-test.mjs` (rendered page, 80 scroll positions, each looked at in transit and at rest): 0 faults at 1440, 768 and 390 in both themes on the production build. Before the change: 41 faults at 1440 light, 58 at 390 dark (intersections, captions cut short, the nav at nine different heights).
- R3b: all 11 inner routes at 320, 390, 768, 1440, 1920: status 200, no sideways scroll, no console errors, no visible text under 12 px in the page body.

### R3a: what was done

- A station's words have two states only (a small tag, the composed block). Between them the block goes out, changes unseen, and comes back in, so no line can meet another in transit ("18,302" over its caption is gone). `src/water/words.ts` holds the rule and the captions' geometry.
- Station placements cut to three: lower left (the rule), upper left under the nav (Agent Bridge, RydAR), a figure across the top (Open models). TensorPoW's oversized name under its line is gone: one type scale, one order.
- Captions: whole names, no ellipsis, one treatment in both themes (the dark theme's blurred chips are removed). Wide frames: a fan whose leaders land on the streams. Phones: the seven repositories as one list in the streams' order, inside the words' lee; the four models stepped over their columns. All 84 px or more from the top.
- The nav no longer leaves on the home page: one fixed place (y 14) at every position. The rail names its ticks on hover and focus and is dropped on phones.

### R3b: what was done

- Type: body about 20 px at 1440 and growing to 24; captions, labels, table text 15 px or more at 1440. Section gap cut from up to 150 px to up to 104 px.
- Ground: a page-length layer of light that changes down the page in both themes; each page's drifts at their own offset and light angle; a soft shade under each section's groove.
- Charts: Upstream's bars and Open models' columns are flat, mono figures, teal on the leading one only.
- Upstream: T3 Code changes lead, larger; then the rest by repository; the full ledger kept, smaller, grouped by repository with counts.
- Open models: each build has what it is and a fact list (builds, context, input, capabilities, licence, updated), all from `.tools/assets/project-facts.md`.
- Kilo Bench: the leaderboard rows cut from the 2324 px capture column by column and shown large (two columns on phones); the alternating black and grey modes are one colour, smaller.
- Blog: index scene shortened (54svh); the post is about 21 px on a centred 33em measure with tags in the left margin.

### R3b remaining (Kilo)

Not done from the brief:

- Item 1: the count of screens less than a third filled at 1440 and 1920 was not run; Infiniview, Agent Bridge, cc-switch, TensorPoW and RydAR got only the shared type and rhythm changes, no per-page layout work ("right column starts 300 px below the terminal", the small dialog in a wide column).
- Item 2: no band of the page's scene returns lower down the page; the per-page difference is offset and light angle only.
- Item 6: the post's margin has tags only (no date or contents list there).
- Item 7: light pictures on dark pages are unchanged (existing mount and 0.84 dimming).
- Item 8: pill buttons and the glass nav are unchanged.
- Checks not run: inner-page text contrast after the ground change, the twelve-backdrop thumbnail sheet, WebKit and Firefox, `checks.js`.

### R3a not done or not verified

- Item 2 (titles on one calm surface): placements were moved, but the luminance-spread measurement behind each title was not written or run. By eye at 1440 light, Infiniview's last letters and arrow still touch the pool rim and Agent Bridge's line still runs over the far ridge.
- Item 6 (the dead frame in the melt): tried pinning the statement early, it sat over the breaking ice and was reverted. Positions without copy at rest: 11 of 80 (brief asks for 3 or fewer).
- Item 7 (3,202 against 3,203 between captures): not investigated.
- Legibility test (`scripts/legibility-test.mjs`): 1440 and 390 light pass. Dark still fails on captions over the lit river: at 1440 "XcodeBenchmark" 3.82 and "openbridge" 3.94 (Upstream), "gemma4" 4.24 and once "qwen3.5-opus-4.6" 2.31 (Open models); at 390 "llama4" 4.37 once. These were measured before the last halo and caption-window changes and not rerun at 1440 dark. The brief forbids a chip, so this needs the scene to supply the calm.
- Not run: 320, 768, 2560 legibility; reduced motion beyond one capture; no-WebGL page; keyboard order; WebKit and Firefox; `checks.js` word count.

### For Fable review

1. The tag-to-composed swap is a 240 ms fade out and in: check it reads as deliberate, not as a flicker, while scrolling slowly through a boundary.
2. The fixed nav on the home page reverses W12's "nav leaves on scroll down": confirm that is wanted.
3. Dark-theme caption contrast above (the one known failing gate).
4. The Kilo Bench crop is upscaled past 1x of its source on wide screens; check sharpness at 2x density.
5. The Open models copy is new wording of facts from the fact sheet: check tone and that "Claude Opus 4.6" in a model's own name is allowed.
6. The ground's light down the page is subtle; judge whether it answers "a tinted flat".
