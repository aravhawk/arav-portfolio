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

### 5. Gates (all must be re-run on the final build)
- [x] lint, typecheck, build, 196 unit tests at 24a276c plus the tracking tweak
- [~] Overlap test: script now measures ending contrast; passes on home at
      five widths in Chromium; the full three-browser run is owed
- [x] Perf traces at the deep water pass: p95 16.7 to 16.8 ms on all four
      profiles, tier 0 desktop, backing size constant (`traces/v4-r6`)
- [ ] Lighthouse on home, /work, a project page, a post (desktop and mobile)
- [x] Cross-browser matrix after the deep water pass: 92 loads, 0 problems
- [ ] Greps (dashes, banned words), word count, file sizes, blog/editor diff empty

### 6. Review
- [x] Rounds 1 to 5, `design-review.md`
- [x] Independent critic, first score: 5.5 of 10 (`critic/review-1.md`)
- [~] Fixes for the critic's findings (round 6): most done; remaining to Kilo
- [ ] Second independent score, target 8.5; write both into `design-review.md`

### 7. Finish
- [ ] Final screenshots and videos
- [ ] Push, production server on 3133, final report

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

