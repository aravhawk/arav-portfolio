# Design skills used (Nov 14 2026)

Enumerated `~/.agents/skills` (26 folders), `~/.claude/skills` (symlinks to the same folders, plus `.trash` and `synced`), `~/.codex/skills` (only `.system`: imagegen, openai-docs, review-agent, skill-creator, skill-installer; none are design skills) and the repo's own `.agents/skills/frontend-design`. Impeccable is not installed and was not used. No skill was installed or modified.

Each entry: path, a short quote that proves it was read, and where it changed a decision. Where a skill's rule collides with what Arav asked for (scroll choreography, parallax, a 3D centerpiece), his ask wins and the collision is written down.

## Required four

### taste-skill (design-taste-frontend 2.5.1)
- Path: `~/.agents/skills/design-taste-frontend/SKILL.md` (loaded with the Skill tool)
- Quote: "Build the website a good company would ship: it says plainly what is sold, shows the real thing on every screen, and looks made for this client, not from a template and not like an art piece."
- Ran its dealers from the repo root:
  - `assets/layout/deal.mjs --type software --has ui,object` dealt hero `product` ("Product stage with one object"). Kept: one object carries the hero, no box, no gradient panel, no second object.
  - `scripts/start.mjs deal --page software` dealt palettes blue-black-cornflower, green-black-bone, stone-blueprint. All three repeat a direction Arav already rejected (blue accent on Nov 9, dark green, stone/beige), so the palette went through the skill's own "client's colours" path (`start.mjs brand --bg --ink --accent`) instead.
  - Type: first pairing dealt was **Onest + JetBrains Mono**. Taken as dealt.
  - `scripts/moments.mjs pick` dealt `marquee-row` and `liquid-type`. Not used: the page's moments are the scroll-driven 3D loop and the word reveal, which Arav asked for directly.
- Shaped: one accent, one radius scale (sharp), one button style, real facts only ("Nothing is invented"), no captions under visuals, "one object never carries the page" (the loop leads the hero, the Infiniview chapter and the close; the rest is type), copy rules ("a noun in every heading, buttons as a verb and an object"), 44px tap targets, skip link, focus rings, no violet.
- Collisions, decided for Arav's brief: "nothing moves because the page scrolled except a dealt moment" and "parallax on text" in its Never list. This site is scroll choreographed on purpose. Body copy is never parallaxed; only the display name, decorative layers and the 3D scene move with scroll.
- Gate: see `design-review.md` for the `GATE:` line, waivers and open FAILs.

### ui-ux-pro-max
- Path: `~/.agents/skills/ui-ux-pro-max/SKILL.md` (loaded with the Skill tool), search tool `scripts/search.py`
- Quote: "Keep the narrative understandable without scroll-driven effects. Use progress indicator. Mobile: simplify animations. Keep DOM reading order complete; disable parallax and scroll-scrub under reduced motion."
- Ran: `"personal portfolio developer founder immersive 3D" --design-system --variance 8 --motion 9 --density 3`, `"scroll pin scrub parallax" --domain gsap`, `"reduced motion webgl fallback" --stack threejs`.
- Shaped: the page pattern (Scroll-Triggered Storytelling: hook, chapters, climax), the chapter progress index in the HUD, "Don't pin more than 1-2 sections per page" (two pinned sections: rules and timeline), "never parallax body copy", reactive `matchMedia` for reduced motion instead of a one-time read, `role="img"` plus `aria-label` on the canvas, antialias decided at renderer construction.
- Not taken: its style match (Brutalism) and font match (Caveat / Quicksand) were off target for this brief and are recorded here rather than applied.

### landing-page-design
- Path: `~/.agents/skills/landing-page-design/SKILL.md` (loaded with the Skill tool)
- Quote: "Every landing page includes one large type section stating the core benefit or tagline, separate from the hero... each word transitions individually from that muted tone to the full text color, in reading order."
- Shaped: the word-by-word statement section after the hero (B11, with the reduced-motion rule: full color at once), the spacing scale (2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96), "Never apply a border to only one side of a card", flat backgrounds with no gradients, no italics, no weight above bold, `text-wrap: balance` on headings and `pretty` on body, sentence case, motion on transform and opacity only, no dead links, branded 404, skip link, 390px check, "Never invent facts".
- Collisions: its font whitelist (Geist, Manrope, Poppins) lost to taste-skill's dealt pairing; its 60px Heading 1 cap and 680px hero cap do not fit a display-name hero and are waived for the name only. "No hyphens in text" is kept for new copy except inside real names (cc-switch, agent-bridge, stress-test as Infiniflop writes it).

### Emil Kowalski's set
All under `~/.agents/skills/`:
- `emil-design-eng/SKILL.md` (Skill tool). Quote: "Never animate keyboard-initiated actions." Shaped: page transitions are skipped when a link is activated from the keyboard; `:active` scale 0.97 on pressables; hover motion gated behind `(hover: hover) and (pointer: fine)`; custom curves `cubic-bezier(0.23, 1, 0.32, 1)` and `cubic-bezier(0.77, 0, 0.175, 1)` as the only two easing tokens; clip-path reveals; springs for pointer-following (cursor, camera parallax).
- `animate/SKILL.md` (read in full). Quote: "No approximated values. Every curve, duration, and spring config comes from the tables below." Shaped: UI durations 160 to 250ms, the long durations are reserved for the load and chapter moments ("Marketing / explanatory: can be longer"), never `scale(0)`, never `transition: all`.
- `choreograph/SKILL.md` (read in full). Quote: "One entrance per container." Shaped: the load sequence casts the name as lead, the role line as support and the HUD as decoration (fade only); project rows do not stagger in on scroll; exits are simultaneous and shorter than entrances.
- `animation-performance/SKILL.md` (read in full). Quote: "Never drive a child's transform from a CSS variable on the parent." Shaped: scroll-driven transforms are written straight to `element.style.transform` from one rAF loop, no React state per frame, one WebGL context, DPR capped.
- `review-animations/SKILL.md` + `STANDARDS.md`, `improve-animations`, `find-animation-opportunities`, `remove-animations` (skimmed, used for the self-review rounds). Quote (remove-animations): "Repeated scroll reveals on every section still fail." Shaped: no fade-in-on-scroll on every block; reveals exist only where they carry the chapter.
- `mobile-native/SKILL.md` (skimmed). Quote: "Layout has wrong height: 100dvh (app) or 100svh (hero)." Shaped: `svh` units for full-screen chapters, `-webkit-tap-highlight-color` off, `touch-action: manipulation`, `theme-color`, hover gating, no zoom lock.
- `apple-design/SKILL.md` (skimmed). Quote: "Always animate from the presentation (current) value, never the target value." Shaped: camera and cursor use critically damped follow from the current value, so scroll and pointer changes can interrupt each other without a jump.
- `gestures`, `break-ui`, `prototype`, `pick-ui-library`, `animation-vocabulary` (skimmed; no drag surfaces or component library needed here). `break-ui` informed the long-title and narrow-width checks on blog cards and project rows.
- Not relevant: `animate-expo`, `ask-sonner`, `write-swift`, `security-audit`, `find-skills`, `cinetic` (video production).

## Also used
- `frontend-design` (repo copy, `.agents/skills/frontend-design/SKILL.md`). Quote: "Choose a clear conceptual direction and execute it with precision." Shaped: one committed idea (a single machined loop) rather than a mix of effects; a saturated ground instead of another polite neutral.
