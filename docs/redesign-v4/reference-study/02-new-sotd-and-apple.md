# Reference study, part 2: new Sites of the Day and Apple

Written by the main build thread on 2026-11-15. The captures and the raw
measurements were gathered earlier the same day by a helper that was stopped
before it wrote anything up; they are in
`~/.t3/portfolio-redesign-v4/references/<site>/` (`chromium-1440`,
`webkit-1440`, `chromium-390`, inner pages, `tech/*.json`, `sheets/`,
`best/`, `video/`). I read the measurements and went through the contact
sheets for every site below myself. Numbers are from Chromium at 1440 x 900,
device pixel ratio 2, unless a line says otherwise.

Technique only. No asset, palette, font or composition from these sites is
used in v4.

## secure-the-unknown.cyera.com (Active Theory)

**What makes it world-class.** A loud, fully 3D scene with text that is never
hard to read, because text is never placed on the scene. Every paragraph sits
on an opaque white card that is itself an object in the world (it stands on a
cloud and casts onto it), in a region the scene keeps tonally compressed.

**Scene.** One WebGL2 canvas at 2880 x 1800 for a 1440 x 900 viewport: full
device pixel ratio, no cap. `antialias: false`, `alpha: false`,
`powerPreference: high-performance`. 10 to 14 draw calls and 3 render targets
per frame. Assets are JSON geometry plus a Draco decoder. The page does not
scroll (`body { overflow: hidden }`, document height equals the viewport):
wheel input drives a virtual timeline.

**Motion.** DOM transitions are long and soft: 1 s and 1.2 s on
`cubic-bezier(0.215, 0.61, 0.355, 1)` (ease-out cubic), staggered 80 ms per
element (icon 0, title 0.08 s, description 0.16 s). Small state dots: 0.3 s
ease-out.

**Typography.** One variable family (Haffer, weight 100 to 900).

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Scene title ("Discover") | 93.2px | 500 | 0.77 | -0.01em |
| Result title | 70px | 500 | 0.86 | -0.02em |
| Card heading | 32px | 500 | 0.8 | -0.03em |
| Instruction | 40px | 400 | 1.0 to 1.05 | 0 |

Largest to smallest on a screen is about 8 to 1.

**How text stays legible.** Opaque cards, a compressed palette behind them
(lavender to blue, no detail), and a white CTA pill in the top right that
never moves. Nothing translucent carries copy.

**What v4 takes.** The principle, stated as a rule: copy lives on something
solid that belongs to the world. In v4 that solid thing is the land itself.
Also the stagger: 70 to 80 ms between a title and its support, not more.

**Could not access.** Headless ran this scene at about 22 Hz, so its frame
pacing on real hardware is unknown.

## grail-app.com

**What makes it world-class.** A light display serif at poster scale against
a small neutral grotesk, with almost nothing in between, and a page that ends
on an event (shapes fall and pile up behind the last words) instead of a
list of links.

**Scene.** three.js r185 on a fixed canvas behind the DOM at 2160 x 1350:
a device pixel ratio cap of 1.5. Lenis smooth scroll. Three CSS sticky pins
(a 900px panel inside 2385px, a 450px panel inside 1530px, a stats panel).

**Motion.** Hover and highlight: 0.3 s on `cubic-bezier(0.22, 1, 0.36, 1)`.
Image and bar reveals: 0.55 to 0.6 s on the same curve. Button press:
0.15 s ease.

**Typography.** PP Pangaia (weight 300) for display, Switzer for text.

| Role | Size | Weight | Line height | Tracking | Case |
|---|---|---|---|---|---|
| Numeral | 345.6px | 300 | 1.0 | -0.01em | |
| Chapter title | 145 to 208px | 300 | 0.88 | -0.005 to -0.01em | upper |
| Section headline | 86 to 92px | 300 | 0.86 to 0.88 | -0.01em | upper |
| Body and labels | 12 to 16px | 400 | about 1.4 | 0 | |

Largest to smallest is about 28 to 1. Hierarchy comes from scale alone: the
display weight never goes above 300.

**How text stays legible.** Mostly lanes: headline left, object centre, body
right. In one chapter the 3D totem is drawn in front of the headline and
hides letters. That is exactly the fault the owner named in v3, so v4 does
the opposite.

**What v4 takes.** Small chapter labels in the corners of each section; a
stats row set as plain numbers on hairlines, no cards; a finale. Not taken:
an object over type, and uppercase display.

## thefirstthelast.agency

**What makes it world-class.** Scale. Section titles are 138 to 303px with
tracking at -0.04em, some drawn as ghost words that cross behind the next
section, with body copy at 14 to 18px. Work is shown as full-bleed footage
with the project name set over it once, small.

**Scene.** Nuxt with Lenis. No canvas was live in the captured states
(effects are video and CSS). Three sticky pins of one screen inside two to
four screens.

**Motion.** Header and info panels: 0.3 s and 0.5 s on
`cubic-bezier(0.32, 0, 0.12, 1)`. The loader scatters small coloured tags and
draws a line between the two halves of the name, with a percentage.

**Typography.** TWK Lausanne in two weights.

| Role | Size | Line height | Tracking |
|---|---|---|---|
| Ghost title | 303px | 1.2 | -0.04em |
| Section title | 138 to 248px | 1.0 | -0.035 to -0.04em |
| Statement | 28 to 32px | 1.15 | -0.01em |
| Body, nav | 14 to 18px | 1.3 | 0 |

**What v4 takes.** Tracking of -0.04em and tighter above 130px (v4's display
and numbers sit at -0.045 to -0.06em). Not taken: ghost words behind content.

## preymaker.com (case-study pages)

**What makes it world-class.** The inner pages are as considered as the
home page. A case study is: full-bleed footage with the client name small and
centred and one paragraph over the dark lower left; then white blocks that
each open with one large bold statement (25 to 40px, weight 600 to 700,
line height about 1.05) followed by body copy in a narrow column offset to
the right; media in pairs with a 2px gap; no cards, borders or shadows
anywhere.

**Motion.** Slow and even: opacity 0.7 s on
`cubic-bezier(0.39, 0.575, 0.565, 1)`, transforms 1.5 s on
`cubic-bezier(0.19, 1, 0.22, 1)` with a 0.2 s delay, cards 0.6 s with 0.3 s
delay. The loader is the mark, the word "Loading" and a three digit count at
the edges.

**Typography.** One family (New Grotesk) at 400 to 700. Headings 40px / 42px
at -0.02em; uppercase labels 20 to 25px at weight 700 with line height below
1; body 14px / 18px.

**What v4 takes.** The case-page rhythm for `/work/[slug]`: a statement-size
lead, then titled steps, then media at full column width, then facts, then
the next project. No cards.

## auge-xp.com

**What makes it world-class.** Restraint. One screen, three text sizes: a
292px wordmark, an 18px paragraph, 10px footer links. The only motion is the
image strip above, and every hover answers within about 0.2 s.

**Scene.** Next.js, a fixed canvas at full device pixel ratio (2880 x 1800)
behind the DOM at `z-index: -1`, pointer events off. Three families: a heavy
display (292.7px, line height 0.75), a text grotesk (18px), a display serif
for one accent.

**What v4 takes.** The discipline of few sizes on one screen: v4's hero has
three (ice name, role line, intro).

## apple.com/macos and apple.com/macbook-pro

**What makes it world-class.** A fixed grammar repeated without deviation:
eyebrow, headline, body, media. The headline is nearly always two short
sentences ("Top of screen. Top of mind."). Media is real product UI at full
fidelity. Glass is used only for controls that float (the local nav's
segmented pill), never for content.

**Measured type (SF Pro, not embeddable; values are what matter).**

| Role | Size / line | Weight | Tracking |
|---|---|---|---|
| Section headline | 48 / 52px | 600 | -0.003em |
| Eyebrow | 21 / 25px | 600 | +0.011em |
| Tile headline | 28 / 32px | 600 | +0.007em |
| Body | 17 / 25px | 400 | -0.022em |
| Caption lead-in | 17px | 600, then 400 | -0.022em |

Display tracking is close to zero because SF Pro Display is drawn for size
(optical sizes). A face without optical sizes has to tighten by hand as it
grows, which is what v4 does.

**Motion.** Link colour 0.32 s on `cubic-bezier(0.4, 0, 0.6, 1)`; menus
0.18 to 0.24 s ease; tile hover 0.344 s. Nothing in the chrome is slower
than 0.35 s. Product reveals are scrubbed by scroll, so they reverse exactly.

**Materials.** The local nav is a capsule of segmented controls, about 44px
tall, with a tinted translucent fill and a light inner edge. Tiles have a
radius near 28px and no border; depth is a slightly different surface
colour, not a shadow. Under `prefers-reduced-motion` the scrubbed sequences
are replaced by stills at the final state.

**End of page.** A single quiet panel with one line and one link, then
footnotes. The page settles; it does not stop mid-thought.

**What v4 takes.** The eyebrow, headline, body rhythm on every beat. Real
product UI for Infiniview. Glass only on floating controls (nav, the profile
switch). Chrome motion at or under 0.3 s. Scrubbed, reversible motion for the
melt and the ending. Stills at the final state under reduced motion.

## Notes on access

- I did not re-capture these sites; I used the helper's captures from the
  same day and read them myself. The helper's own write-up never existed.
- Cyera, Preymaker and Auge do not scroll natively, so their "scroll" frames
  are steps through a virtual timeline.
- Frame pacing was not measured for any of these seven.
