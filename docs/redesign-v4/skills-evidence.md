# Skills used, and what each one decided

All skills were read from `~/.claude/skills/<name>/` (symlinks to
`~/.agents/skills/<name>/`). Nothing was installed or modified. Impeccable
was not used.

Where a skill's rule conflicts with the owner's brief, the brief wins; those
cases are listed so nobody mistakes them for oversights.

## Required

### design-taste-frontend (taste-skill 2.5.1)
`~/.claude/skills/design-taste-frontend/SKILL.md`, loaded with the Skill tool.

Decisions it shaped:
- The page is classed as software/tech, which is the only kind the skill
  allows a big scene and a shader effect on. One effect (the water), not
  several.
- No caption or description under any visual. The product screenshot and
  the launch video carry alt text only.
- Software shows its own UI: Infiniview's beat uses the real finding screen,
  not a metaphor or a generic dashboard.
- Copy rules: headings name things, the first screen says what he does and
  for whom with one hard fact, nothing invented, no slop words.
- Equal left and right edges: one `.wrap` gutter for every block.
- Hover answers on every link and control; nothing tilts; reduced motion
  rests everything with nothing left hidden.
- No violet anywhere.
- The checklist's 820, 768, 390 and 320 passes, 44px targets, and "nothing
  lies on anything else".

Not applied, and why: the skill's dealer, kit and gate scripts
(`start.mjs`, `deal.mjs`, `gate.mjs`) build and check a static page from its
own starter; this is a bespoke Next.js build with its own gates (overlap
test, traces, Lighthouse, cross-browser), so the kit was not copied in and
the gate was not armed. "One section per screen at exactly one or two
screens" was treated as a rhythm target (beats are about one screen), not a
hard height. "Flat grounds" is overridden by the owner: no flat colour
backgrounds.

### emil-design-eng
`~/.claude/skills/emil-design-eng/SKILL.md`, loaded with the Skill tool.

- The curves: `cubic-bezier(0.23, 1, 0.32, 1)` out and
  `cubic-bezier(0.77, 0, 0.175, 1)` in-out are the site's tokens.
- Buttons scale to 0.97 on `:active`; nothing animates from `scale(0)`;
  never `transition: all`; never `ease-in` on an entrance.
- UI feedback under 300 ms; exits faster than entrances.
- Hover inside `(hover: hover) and (pointer: fine)`.
- No React state on the frame path: the engine, the statement, the nav and
  the readouts write to the DOM or to uniforms directly.
- Stagger 70 ms, well inside the 30 to 80 ms range.
- Tooltips ("as of") scale from their own corner at 0.97, 140 ms.

### landing-page-design
`~/.claude/skills/landing-page-design/SKILL.md`, loaded with the Skill tool.

- One audience, one message above the fold: the takeaway line, the company,
  the name.
- The mandatory tagline reveal became the statement after the hero: words
  light one at a time as they cross a line, throttled through the one frame
  loop, all lit under reduced motion.
- `text-wrap: balance` on headings and `pretty` on body; no orphaned words.
- Every state: hover, active, focus, loading skeleton shaped like the page,
  empty archive, inline error with what to do next, a branded 404.
- Ship list: skip link, favicon, meta and share tags, alt text, semantic
  landmarks, a way back from every page, a 390px check.
- No hyphens as punctuation in copy; sentence case.

Overridden by the brief: its font list (Geist, Manrope, Poppins are banned
here), its fixed Tailwind type scale (a fluid scale was required), "never
use gradients in backgrounds" (the world is lit), and the centred floating
nav became two corner controls so the nav never parks over the name.

### ui-ux-pro-max
`~/.claude/skills/ui-ux-pro-max/SKILL.md`, loaded with the Skill tool; its
search tool was run once
(`search.py "developer tools AI portfolio immersive 3D water premium" --design-system --variance 8 --motion 9 --density 3`).

- Priority order used for review: accessibility, touch, performance, then
  style.
- 4.5:1 text contrast, 3:1 for large text (which is why unlit statement
  words are a colour token, not 26% opacity), visible focus, 44px targets.
- Reserve space for everything that loads: live numbers are rendered on the
  server, media has width and height, CLS is 0.
- Spacious density tier for a marketing page.

Not taken from its output: the suggested style ("Brutalism") and font
(Inter, banned). Its "avoid" line was useful: "2D-only layouts, AI purple
and pink gradients".

## Emil Kowalski's set and related skills (read from disk)

| Skill | Path | What it decided |
|---|---|---|
| animation-performance | `~/.claude/skills/animation-performance/SKILL.md` | Design against 8 ms, not 16; name the cause before changing code; never drive children from an inherited CSS variable (the canvas is moved with its own `transform`); no stacked blurs; verify with a recording, which became `scripts/perf-trace.mjs` |
| apple-design | `~/.claude/skills/apple-design/SKILL.md` | Respond on pointer down; critically damped motion by default, bounce only after a throw (there is none); glass only for floating controls with a bright top edge; tracking that tightens with size; haptics on the causal event, on the same frame; the three accessibility media queries |
| animate | `~/.claude/skills/animate/SKILL.md` | The "should this animate at all" gate: keyboard actions and the archive filter do not animate |
| choreograph | `~/.claude/skills/choreograph/SKILL.md` | Lead, support, decoration roles for each beat; no uniform stagger; one entrance per container; exits simultaneous |
| gestures | `~/.claude/skills/gestures/SKILL.md` | No per-move React state; `touch-action: manipulation`; the profile switch thumb lands without bounce because a tap applies no force |
| mobile-native | `~/.claude/skills/mobile-native/SKILL.md` | `svh` for the hero, safe-area insets with `viewport-fit=cover`, 16px inputs so the archive search does not zoom the page, no tap highlight, `user-select: none` only on controls, one theme colour per scheme |
| review-animations | `~/.claude/skills/review-animations/SKILL.md` | The ten standards used as the checklist for each review round |

Skimmed for headings only, nothing taken: animation-vocabulary,
find-animation-opportunities, improve-animations, remove-animations,
break-ui, prototype, pick-ui-library. The repo's own
`.agents/skills/frontend-design` was left untouched.
