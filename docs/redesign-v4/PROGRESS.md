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
- [ ] Skills loaded, `skills-evidence.md`
- [ ] Reference study, `reference-study.md`
- [ ] v2/v3 carry-over, `carry-over.md`
- [ ] v3 lag root cause, `perf.md`

### 2. Design
- [ ] `concept.md` (3+ concepts, pick)
- [ ] `motion-system.md`
- [ ] `typography.md` + bake-off + blind ranking + `font-licenses.md`

### 3. Content and metrics
- [ ] `content-sources.md` (every number re-pulled, every link checked)
- [ ] `lib/metrics` + snapshot + refresh script + weekly workflow + tests

### 4. Build
- [ ] Water engine (bed, simulation, shading, tiers, fallback)
- [ ] Home (hero, featured beats, interests, more, ending)
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
