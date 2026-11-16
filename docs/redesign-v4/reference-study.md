# aravjain.dev v4: reference study

First-hand study of 24 sites, done on 2026-11-15 in Playwright (Chromium and
WebKit, 1440 x 900 and 390 x 844). Captures are outside git in
`~/.t3/portfolio-redesign-v4/references/<site>/`. Technique only: nothing
was copied.

The full studies:

1. [Igloo, Lando Norris, Lusion, Lusion Labs, exp-ion](reference-study/01-pinnacle-and-lusion.md)
2. [New Sites of the Day and Apple](reference-study/02-new-sotd-and-apple.md):
   Cyera, Grail, The First The Last, Preymaker, Auge, apple.com/macos,
   apple.com/macbook-pro
3. [Studios, product sites and real-time water](reference-study/03-studios-products-water.md):
   Active Theory, Unseen, KPR, Jesper Landberg, Linear, Raycast, Resend,
   Bruno Simon, Montfort, Astrodither, plus the water technique notes

## What makes each one world-class, in one line

| Site | The technique |
|---|---|
| Igloo | Ice as a physical material rendered twice (inner object into a mipped target, then the face refracting it), frost from mip level instead of a blur pass, a four-corner HUD so copy never sits on the model |
| Lando Norris | Native scroll with Lenis and CSS sticky pins; one hero interaction; a 144 x 90 fluid field that is never shown, only thresholded into a mask; flat 16.7 ms frames |
| Lusion | Each 3D element is tied to the rectangle of its DOM section; a small "screen paint" buffer lets the page react to the pointer for four cheap passes |
| Cyera | Copy only on opaque cards that are objects in the scene; long, soft 1 s reveals with 80 ms staggers |
| Grail | A weight-300 display serif at 86 to 345px against 12 to 16px text; the page ends on an event |
| The First The Last | Titles at 138 to 303px with -0.04em tracking; work shown as full-bleed footage |
| Preymaker | Case pages built from one large statement, a narrow body column and paired media, with no cards |
| Auge | Three text sizes on one screen |
| Apple | Eyebrow, two-sentence headline, body, real UI; glass only on floating controls; chrome motion under 0.35 s; scrubbed reveals that reverse |
| Linear, Raycast, Resend | One family in fine weight steps (300, 400, 510, 590); hover feedback in 100 to 200 ms; numbers small, tabular and grey |
| Active Theory, Unseen, Montfort, KPR | A fixed canvas with DOM text over a calm, tonally compressed region; distortion confined to rims |
| Evan Wallace's WebGL Water | A 256 x 256 heightfield, the pointer as a moving body, caustics from the refracted area |

## Typography across the references

- One or two families per site, never three. Where there are two, the split
  is display against text, and the display face does almost nothing below
  40px.
- Display runs 74 to 345px at line height 0.7 to 1.0. Tracking tightens with
  size: about -0.02em at 90px, -0.04em above 130px. Faces with optical sizes
  (SF Pro) stay near zero.
- Body is 14 to 21.6px at line height 1.15 to 1.5. Labels are 8 to 14px,
  uppercase, weight 500 or more, tracked out.
- The ratio between the largest and smallest text on a screen is 8 to 1 at
  the quiet end (Cyera, Apple) and 28 to 36 to 1 at the loud end (Grail,
  Lando). Igloo is the outlier: a single mono at about 1.2 to 1.
- Premium weight steps are intermediate, not 400 and 700: Linear uses 510
  and 590, Cyera 500.

v4's own numbers and the pick are in [typography.md](typography.md).

## Decision map: every major v4 choice and where it came from

| v4 decision | Reference and what was learned |
|---|---|
| All copy sits on dry land; the bed is carved around text rectangles | Lusion (3D tied to DOM rects), Cyera (copy on solid objects of the world), Igloo (HUD lanes). No reference puts a scrim over busy 3D for body copy; all reserve lanes |
| A small, fixed-resolution fluid field with full-resolution shading | Igloo 128 x 128, Lando 144 x 90, Lusion 270 x 168, Wallace 256 x 256. Detail comes from the shading pass that reads the field |
| Hybrid water: a wave heightfield plus a velocity field plus authored flow | Water notes in part 3: pure dye reads as ink or jelly, pure ripples read as a pool. Height bends light, velocity moves things |
| The pointer is a moving body dragged along its path, not a point source | Wallace (displaced volume), Unseen (force along the previous-to-current segment). It gives wakes, where a drop gives rings |
| Caustics from the surface's own curvature, split slightly by colour, fading in shallows | Wallace's refracted-area method, done as a full-screen term |
| Depth cues: red-first absorption, terraced bed for refraction to bend, dark wet seam and bright lip at banks, sparse foam | "What separates water from jelly" list in part 3 |
| Ice name from a signed distance field: clear bevel, cloudy core, melt by threshold so the skeleton lasts longest; a real `h1` underneath | Igloo's ice parameters and frost mask; ice notes in part 3 |
| No resolution scaling, ever: fixed device pixel ratio cap of 2, quality stepped in discrete tiers | Igloo's adaptive stepper was seen firing under load; v3's governor did the same and blurred (perf.md). Cyera and Auge render at full ratio |
| Native scroll, Lenis only for fine pointers, no pins on the main page; the canvas travels with the document | Lando (native scroll, flat frames), KPR and Montfort (native scroll, fixed canvas, DOM text) |
| Melt and ending are functions of scroll position | Apple (scrubbed reveals reverse exactly), Igloo (scroll as a timeline) |
| The ending is a single picture the camera tilts up into | v2's ending screen (carry-over.md), Grail (page ends on an event), Apple (the page settles) |
| Eyebrow label, name, one line, one control on every beat | Apple's fixed grammar; Auge's three sizes per screen |
| Display tracking -0.045em, numbers -0.06em, labels +0.07em uppercase at 11px | Measured tracking by size across The First The Last, Grail, Lando and Linear |
| Reveal: 760 ms ease-out, 70 ms stagger, lead travels furthest | Cyera (1 s, 80 ms), Grail (0.55 to 0.6 s on `cubic-bezier(0.22, 1, 0.36, 1)`), Lusion (0.75 s) |
| Chrome feedback 120 to 260 ms | Linear 100 to 160 ms, Apple 180 to 344 ms |
| Glass only on floating controls: nav, the profile switch | Apple's local nav; Linear's inner light ring plus outer dark ring instead of heavy blur |
| Project pages: statement lead, titled steps, full-width media, facts, next project, no cards | Preymaker case pages |
| Live numbers small and tabular beside one large figure | Linear and Resend present numbers quietly; Lando art-directs data as objects, which is what the project beds do |

## Honest notes

- Part 2 was written from captures a stopped helper had already taken. I
  read every sheet and measurement myself but did not re-capture.
- No 2025 or 2026 award winner with physically simulated top-down water was
  found. v4's water is built from first principles and the Wallace lineage,
  not from a site that already does it.
- Headless Chromium caps at 60 Hz, so no reference was measured at 120 Hz.
- Igloo has no DOM text; its type sizes were read from screenshots.
- Not reached: KPR inner pages, Bruno Simon's and Astrodither's shaders
  (machine-generated names), the Lando Norris WebKit pacing run.
- Real iOS hardware was not available for any reference or for v4.
