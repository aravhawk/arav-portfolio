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

## Orchestrator guardrail (2026-11-15, binding until the final review)

At 2:30 PM CT the limit auto-resume restarted this thread and all seven
helpers at once, and eight agents in parallel spent the whole 5-hour window
in 23 minutes. Rules since then:

1. One task at a time. No `delegate_task`, no background helpers, no
   subagents of any kind until the final review.
2. The failed helper "v4 refs: new SOTD sites + Apple" is cancelled
   (`task_cancel`), and `task_status` on all seven shows none running
   (checked 2026-11-15, after the guardrail arrived). The SOTD and Apple
   study is skipped; do not redo it.
3. Reuse the six finished helpers' outputs. Do not redo references,
   typography research, metrics, content or carry-over.
4. At the final review: at most one critic helper, medium effort, nothing
   else running.
5. Three review rounds, not five. Per round capture only 390, 768, 1440 and
   1920 in Chromium. The full cross-browser pass (Chromium, WebKit, Firefox,
   all widths, touch) runs once, at the end.
6. Commit and push signed work at each milestone
   (`git push -u origin redesign/fable-v4b-20261115`, SSH, that branch only,
   no force-push, no PR, no merge).
7. Do not change model or effort.

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
- [~] Skills loaded (taste, Emil set, landing-page, ui-ux-pro-max, apple-design); `skills-evidence.md` owed
- [~] Reference study: parts 01 and 03 written by helpers; `reference-study.md` index and decision map owed (part 02 skipped by guardrail)
- [x] v2/v3 carry-over, `carry-over.md`
- [x] v3 lag root cause in `perf.md` (v4 measurements owed)

### 2. Design
- [ ] `concept.md` (3+ concepts, pick)
- [ ] `motion-system.md`
- [ ] `typography.md` + bake-off + blind ranking + `font-licenses.md`

### 3. Content and metrics
- [x] `content-sources.md` (every number re-pulled, every link checked)
- [x] `lib/metrics` + snapshot + refresh script + weekly workflow + tests (191 pass)
- [x] `metrics.md`; metrics wired into home (inner pages in progress)

### 4. Build
- [~] Water engine (bed, simulation, shading, tiers done; fallback, tuning owed)
- [~] Home (hero, eight beats, interests, ending) built; tuning owed
- [ ] /work archive, project detail pages
- [ ] Blog shell, 404, error, loading states
- [ ] Theme (system + toggle, no flash), haptics, reduced motion,
      reduced transparency, forced colors, print

### 5. Gates
- [ ] lint, typecheck, build, unit tests
- [ ] Overlap test (zero overlaps)
- [ ] Perf traces
- [ ] Lighthouse
- [ ] Cross-browser matrix + touch
- [ ] Greps (dashes, banned words), word count, blog/editor diff empty

### 6. Review
- [ ] Rounds 1 to 5, `design-review.md`
- [ ] Independent critic, fixes, re-score

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
