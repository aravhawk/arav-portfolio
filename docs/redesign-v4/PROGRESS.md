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
- 2026-11-16 00:20 CT. Second independent critic (fresh agent, run through
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
- 2026-11-16 03:55 CT. Kilo tasks K1, K2 and K3 done, each reviewed here
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
- 2026-11-16 04:20 CT. Third independent critic (fresh, through Kilo):
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
- 2026-11-16 06:10 CT. K4 done, reviewed and pushed (`c630b1d`): the frozen
  lake (the name cut through a sheet of lake ice as live water; the melt
  is the sheet breaking into floes), runs and pools as different water, a
  lit dark ground, a larger Kilo Bench image, the light ending's sun path
  and colour handover, a wandering stream on inner pages, a nav that
  leaves on scroll down, a wake by shading.
- 2026-11-16 08:20 CT. K5 done, reviewed and pushed (`5d4be01`): night ice
  in dark theme (mean ice luminance 0.25, name 3.3 to 1), crisp drifted
  snow over clear ice in light with a lead of open water at the north
  shore (name 5.2 to 1), whole round floes that go largest last, no crease
  or terracing in the stream bed. Kilo caught a frame-time regression of
  its own (the fracture field cost 33 ms p95 under GPU contention) and
  fixed it before handing back.
- 2026-11-16 09:15 CT. Final gates on the K5 build (production, port 3141):
  perf p95 16.7 to 16.8 ms on all four profiles, tier 0 desktop, one
  backing size each; Lighthouse desktop 99, 100, 100, 100 and mobile 90,
  94, 88, 93 (home, /work, project, post), accessibility, best practices
  and SEO 100 everywhere; cross-browser matrix 92 loads, 0 problems; home
  197 words; states and haptics wiring pass. Section I re-verified: every
  canonical and OG URL on arav.pro, no stray aravjain.dev. The OG cards
  rendered but still drew the first build's look: sent to Kilo in K6.
- 2026-11-16 09:25 CT. Fourth independent critic: 5.8 of 10
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
- 2026-11-16 10:40 CT. K6 done, reviewed and pushed (`e04fcd1`): dark hero
  with the name as lit water (4.5 to 1), crisp ice edges at 2x, cracks that
  route round the name, a stronger wake, a shorter lake, a graded dark
  handover into the ending, the empty spinner image dropped from the Kilo
  Bench page, the five OG cards redrawn.
- 2026-11-16 11:40 CT. Final build. Snapshot refreshed (`0a374c8`). Gates
  re-run on it (checklist above). Closing independent score 5.8
  (`critic/review-5.md`). No further passes: five scores in a row within
  0.3 of each other say another pass of the same kind will not move it.
- 2026-11-16 12:05 CT. Full overlap run on the final build finished: 189
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
- 2026-11-16 12:40 CT. Kilo task K7 started
  (`.tools/briefs/K7-the-flight.md`): a prototype at `/flight` of the home
  page as one world seen through a travelling perspective camera (frozen
  lake under a sky, melt and descent, the statement on the bank, the
  Infiniview slab in its basin with its reflection, hand-over to the
  existing ending), plus `scripts/legibility-test.mjs` (contrast behind
  every line of text at 40 or more scroll positions, both themes). The
  shipped home page is untouched until the prototype is judged.
- 2026-11-16 13:45 CT. K7 done and pushed (`222d41c`, signed). Its run sat
  idle for 17 minutes after it had committed and written its report, with
  nothing pending, so the run was closed (first stall of a Kilo task;
  nothing lost). The prototype works: `/flight` is one world through a
  travelling camera, legibility test passes at 390 and 1440 in both
  themes, existing pages untouched. It drops frames at 1728 wide (6
  percent) and under contention (p95 33 ms): a gate for the next task.
- 2026-11-16 14:20 CT. Interim independent read on the prototype (one
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
- 2026-11-16 14:55 CT. K8 failed before changing anything: the Kilo
  gateway stops any single response at 600 seconds, and its first big
  edit ran past that. Nothing lost (tree clean at `0b4ec0d`). Relaunched
  as two smaller tasks with an instruction to edit in small steps and
  commit per part. **K8a (running):** ground, ranges, sky, aurora, film
  finish, frame rate. **K8b (next):** the hero's composition and
  anamorphic name, the river and the melt's plates, the project object,
  the small named faults. Briefs for Kilo from here on always carry the
  small-steps instruction.

