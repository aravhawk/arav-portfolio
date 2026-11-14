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
