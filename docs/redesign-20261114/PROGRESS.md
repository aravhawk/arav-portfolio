# Redesign Nov 14 2026: progress log

## Checklist
- [x] Step 0 preflight
- [ ] Step 1 design skills loaded, evidence written
- [ ] Step 2 reference research (browser), reference-log.md
- [ ] Step 3 content gathered, content-sources.md
- [ ] Step 4 build (concept, 3D centerpiece, pages, blog shell)
- [ ] Quality: lint, typecheck, build, a11y, reduced motion, overflow, Lighthouse, bundle
- [ ] Self-review x3, independent critique, design-review.md
- [ ] Blog/editor verification, posts diff empty
- [ ] Final: server on :3112, screenshots in ~/.t3/portfolio-redesign-20261114/

## Log
### Step 0 (done)
- Before: HEAD 5f0f2f8 (2 unpushed: e1c2cc6, 5f0f2f8), origin/main 9a487fb52b99fe0e248106e955e5b01f31c15291, tree clean.
- Created annotated tag `backup/portfolio-20261109` -> 5f0f2f818914a379e0014d30d8403317af6c2755 (tag.gpgsign is on, so the tag is signed and needed a message).
- `git reset --keep origin/main`: local main == 9a487fb. Tag still resolves to 5f0f2f8.
- git user.email aravhawk@gmail.com, commit.gpgsign true, gpg.format ssh.
- Stale `next-server` on :3112 (PID 32763) stopped.
- Note: `.taste-skill/` from the Nov 9 build is now untracked (the live .gitignore does not list it). Left in place, not deleted.

### Steps 1 to 3 (done)
- Skills loaded and recorded in `skills-evidence.md`. All four required skills loaded.
- 16 reference sites captured in Chrome with GPU WebGL; decision map in `reference-log.md`.
- Facts re-gathered from GitHub, infiniflop.com, the live site, X (logged-out view) and project READMEs; `content-sources.md`.

### Step 4 build log
- Commit 0761831: the loop scene (three.js), home chapters, /work, blog shell.
- Commit 7d9de77: resting layout by default, poster fallback, loader count, a11y fixes.
- Self-review round 1: hero pose hid the first letter; band underside read as flat olive; phone hero hid the name. Fixed with lens shift, a floor strip light and a portrait pose.
- Self-review round 2: reading text was under the canvas inside sticky pins (a sticky box is its own stacking context). Split every pinned chapter into a behind layer and a front layer.
- Self-review round 3: loader was a hairline on an empty field. Rebuilt as a count in the name's own cut that hands off to the name.
- taste-skill gate: three rounds, ended `GATE: OPEN 94 (rounds used up)`. Logs in `~/.t3/portfolio-redesign-20261114/gate/`.
- Blog editor check: `pnpm install --frozen-lockfile` then `pnpm dev` in `blog-editor/` (port 3001). List, edit view and preview all loaded the existing post. No non-GET requests. `git diff 9a487fb -- content/posts` is empty. Editor stopped afterwards.
- Independent critique (fresh subagent, no access to my reasoning): scored it about 6/10 and listed 17 problems. Round 4 below works through them.
- Round 4 (commit 2c1bd36): hard-edged grounds, text-safe zones, true-reading engraving, three labelled rings, snapping ventures run, pinned statement with the "into" row, contents rail on posts.
- Critic second pass: colour 6 to 8, mobile 4.5 to 5.5, overall still "a flaw within ten seconds" (band on the Infiniview copy). Round 5 fixes that and five more of its points.
- Round 5: Infiniview copy enters after the camera settles, arch face reads upright, hero band moved to the empty lower left, tall-screen hero pose, per-page head poses, list sheets occlude the band, reduced motion shows the band only where it stands clear, Vercel scripts load only on Vercel.
- Final checks on the production build: lint, typecheck and build clean; Lighthouse 100/100/100/100 (home mobile, home desktop, post mobile); first-load JS 183.5 kB gzip on `/`; no overflow at 390/768/1024/1440; no em or en dashes outside the post body.
- Screenshots: `~/.t3/portfolio-redesign-20261114/screenshots/`. Videos: `home-scroll-1440.webm`, `home-scroll-390.webm` in the same parent folder.

## Checklist (final)
- [x] Step 0 preflight
- [x] Step 1 design skills loaded, evidence written
- [x] Step 2 reference research (browser), reference-log.md
- [x] Step 3 content gathered, content-sources.md
- [x] Step 4 build
- [x] Quality: lint, typecheck, build, a11y, reduced motion, overflow, Lighthouse, bundle
- [x] Self-review rounds, independent critique (two passes), design-review.md
- [x] Blog/editor verification, posts diff empty
- [x] Server on :3112, screenshots and videos saved
