# v3 progress log

Branch `redesign/fable-v3-20261114`, from origin/main `9a487fb`. Build day: 2026-11-14 (CT).

## Checklist

- [x] 1. Repo: origin/main verified at 9a487fb, worktree clean, identity and SSH signing confirmed
- [x] 2. Skills loaded and recorded (skills-evidence.md)
- [x] 3. Reference study, first hand, Chromium + WebKit (reference-study.md)
- [x] 5. Concept: three candidates, one chosen (concept.md)
- [x] 6. Facts re-pulled on build day (content-sources.md)
- [x] 7. Build: glass engine, motion system, home, /work, project pages, blog shell, 404
- [x] 8. Quality gates
- [x] 9. Self-review x4 and two independent critiques (design-review.md)
- [x] 10. Signed commits, SSH push, production server on 3123

## Log

- 22:45 Verified origin/main, branch, signing config. Installed Playwright (Chromium, WebKit, Firefox) and Lighthouse outside the repo in `~/.t3/portfolio-redesign-v3/tools`.
- 22:50 Loaded ui-ux-pro-max, landing-page-design, design-taste-frontend, emil-design-eng, animate, choreograph, apple-design; read animation-performance and gestures.
- 23:10 Reference study finished: 4 pinnacle sites deep, 30+ others. Captures in `~/.t3/portfolio-redesign-v3/references/` (outside git).
- 23:10 Facts re-pulled. Changes against the brief: contributions 2,597 (was 2,591); jrls.space no longer resolves; the Flux project page says "Project not found"; aravhawk/nextup-site is 404; CryptoLab is `CryptoLab.swiftpm`; workjet is `workjet-google`.
- 23:20 Concept chosen: "One drop".
- 23:40 Glass engine running: one WebGL2 fragment shader, twelve signed distance forms, three-slot blending, DOM type mask for refraction.
- 00:10 Home beats, /work, project pages, blog shell, 404 and error states built. First signed commit.
- 00:40 Round 1 fixes (drop form, measured display widths, mobile layout). Home cut from 274 to 196 visible words.
- 01:10 Round 2 fixes. Lighthouse cold-compile task traced and reduced; software-GPU guard and watchdog added. Contrast on glass measured and fixed (worst 5.0:1).
- 01:40 First independent critique: 7/10, "close, not yet". Must-fix items worked through.
- 02:20 Round 3 and 4 captures, reduced motion in three engines, blog editor opened on the existing post (not saved), `git diff 9a487fb -- content/posts blog-editor` empty.
- 02:50 Second independent critique: 7.5/10. Remaining must-fix items addressed where they did not break contrast.

## Gate results (final build)

| Gate | Result |
|---|---|
| lint, typecheck, production build | pass |
| Lighthouse home, desktop / mobile | performance 100 / 100, accessibility 100 / 100, best practices 96 / 96, SEO 100 / 100, CLS 0 |
| Lighthouse post, desktop / mobile | performance 100 / 99, accessibility 100 / 100, best practices 96 / 96, SEO 100 / 100, CLS 0 |
| Best practices 96 | The only failed audit is two console 404s for `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js`, which exist on Vercel and not on localhost. |
| First cold Lighthouse run on home | 71, one 880ms task from a first-ever shader compile. Repeat runs 99 to 100. Reported as a known gap. |
| First-load transfer per route (JS, gzip, includes prefetch) | / 192 kB, /work 199 kB, /work/[slug] 199 kB, /blog 194 kB, /blog/[slug] 194 kB, 404 192 kB. CSS 13.5 kB, fonts 111 kB. |
| Cross-browser | 78 page and viewport checks (6 pages, Chromium, WebKit, Firefox at 1440x900, 1024x768, 768x1024, 390x844, plus iPhone 15 WebKit): 0 horizontal overflow, 0 console errors, WebGL active in all. |
| Reduced motion | 43 checks in three engines: no overflow, WebGL active (still frames, cross-fade between forms), no smooth scroll. One message in Playwright's WebKit iPhone profile comes from the engine's own native video controls ("Button failed to load, iconName = pip-placard"), not from site code. |
| Text on glass | Worst measured contrast 5.0:1 (33 text elements per viewport, 1440 and 390, three engines). |
| Home visible words | 196 at 1440, 195 at 390. |
| Dashes | 0 em or en dashes in `src/`, the docs, and the built HTML outside the untouched blog post body. |
| Never-list grep | 0 hits in `src/`, `public/` and the build output. |
| Posts and editor | `git diff 9a487fb -- content/posts blog-editor` is empty. |
| Large files | Only `public/media/agent-bridge-demo.mp4` (5.29 MB) is over 2 MB. No captures in the branch. |
