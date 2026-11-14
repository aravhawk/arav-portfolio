# Design review (Nov 14 2026)

## The concept in one paragraph
One closed band of brushed, engraved steel, rendered live in three.js. The page is a camera ride around it: it curls up beside the name, stands off while I introduce myself, runs through three probe rings for Infiniview, turns as a small sculpture beside each rule, arches over the years, crosses the work title, and at the end the camera pulls out and the thing you were riding is one figure eight above the email address. Three flat colours carry everything else: signal yellow, black and paper. Type is Onest for display and reading, JetBrains Mono for labels.

## Self-review rounds
Each round: screenshot at 1440, 1024 and 390, compare against the Igloo and Lando captures in `references/`, write down what is worse than them, fix it.

| Round | What was wrong | What changed |
| --- | --- | --- |
| 1 | The first hero put the whole loop on screen with far parts fading to see-through. It read as glass tape, and it spent the reveal on the first screen. Engraving was as loud as the name. Underside of the band was a flat olive on yellow. | Opaque steel only. Camera moved in so the whole loop is saved for the close. Engraving cut to a third of the face height with ruler ticks and counts. Added a floor strip light so undersides carry a highlight. |
| 2 | Reading text sat under the band inside every pinned chapter, because a sticky box makes its own stacking context. Statement, rules and Infiniview copy were all crossed by steel. | Each pinned chapter is now two sticky layers: display type under the canvas, reading text over it. Added a lens shift to the camera so the loop can be composed into a corner without changing the shot. |
| 3 | The loader was a hairline and 12px text on an empty yellow field. Page heads hid their own titles behind the band. The phone hero showed "JAIN" and no "ARAV". | Loader rebuilt as a count set in the name's own cut and position that leaves upward as the name rises. Separate poses per page head. Portrait poses for the hero. |
| 4 (after independent critique, below) | Band over text in about half the frames; chapter grounds blended through muddy olive and beige; engraving mirrored on one face; phone timeline unreadable. | Every chapter paints its own ground, so colour changes as a hard edge that scrolls with the page. Text always lower left, loop always upper right. Bottom face of the band no longer flipped. Band steps out of the phone timeline. |
| 5 (after the critic's second pass) | Band still crossed the Infiniview copy on entry; engraving read upside down on the arch; phone /work head covered its title; hero strap split the name; lists after the timeline had no 3D. | Infiniview copy now enters only after the camera settles; the arch face is drawn half a turn round so it reads upright where it is seen most; the hero band lives in the empty lower left and touches only the first A; list sections are opaque sheets, so the band crosses the section title and is then covered for real as the list rises. |

## Independent critique
A fresh subagent with no access to my reasoning reviewed the screenshots, the reference sheets and the live site twice. It was told what Arav asked for and what he rejected, nothing about how the site was made.

First pass, scores out of 10: concept 7, 3D craft 6, scroll choreography 5, typography 6.5, colour 6, copy 7.5, mobile 4.5. Its verdict: "the first version with an actual idea", but "the band crosses body copy, headings and links in roughly half the frames", the colour cross-fades "pass through muddy olive and cream beige, which are literally his banned colours", the ribbon text "reads backwards in the hero", and the second half of home "reads as a clean but ordinary editorial template". It listed 17 problems.

Second pass, after round 4: concept 7.5, 3D craft 6.5, choreography 6, typography 7, colour 8, copy 7.5, mobile 5.5. Fixed outright: colour transitions, contact. Still open at that point, with what I did next:

| Its finding (second pass) | Status now |
| --- | --- |
| Band on the Infiniview heading and paragraph on entry | Fixed in round 5. Checked at 1440 and 390 |
| Band swells over the statement at the yellow to black edge | Fixed: the paragraph fades before the camera leaves |
| "DEV TOOLS", "INFINIFLOP LABS", "AGENTS" read reversed | Fixed for the arch face. The band still turns, so words on it read sideways or inverted in some frames. That is what a band does |
| Hero strap splits the name into "AR/AV"; lede sits on steel | Fixed: name is whole, lede is on yellow |
| /work head at 390 covers "WORK" | Fixed with a portrait pose |
| /blog head: band over the lede and the nav mark | Fixed with a new pose; the band now clips the foot of the G only |
| Reduced motion: band over text in intro and Infiniview | Fixed: under reduced motion the band shows only in the hero, the close and the page heads |
| Selected work and Writing are plain lists with no band | Partly. The arch now crosses both section titles and the list sheet occludes it. The rows themselves are still plain, by choice: no screenshots, no decoration between a reader and the list |
| Phone timeline has no 3D | Open. I tried an arch held at the top of the screen and it collided with the cards again, so the phone timeline stays type only |
| Rules are four similar layouts with a small knot | Partly. One type size, no orphan, knot moved in from the edge. The layout repeats on purpose so the sentence is the only thing that changes |
| Blog index shows search and chips for one post | Open. The controls are how the blog works today and they stay; they are now one compact bar |
| Home Writing headline is title case | Open on purpose: it is the post's own title, and post content is unchanged |
| Probe rings read as decoration; one label visible | Partly. Three rings, labelled Review, Probe, Stress-test (Infiniflop's own verbs). Two labels are on screen at the resting frame at 1440, the third sits above the top edge |
| Console 404s | Fixed. They were Vercel's analytics scripts, which only exist on Vercel; they now load only there |

I did not run a third critic pass. Round 5 was checked by me against fresh captures, so treat its "fixed" marks as mine, not the critic's.

## Honest comparison with Igloo and Lando
- Where it holds up: one idea carried from first frame to last; a believable material with no glow, blur or gradient; colour with nerve; a hero that is the person's name and nothing else; copy that is his own sentences with sources.
- Where it is behind: both references have bespoke 3D assets, sound and far more scenes. This has one procedural object. Lando has photography of the man; this has none, by choice. Igloo's camera work is continuous cinema; here the camera eases between about twenty poses and the chapter handoffs are the weakest frames (the half second where one chapter's copy has left and the next has not arrived).
- Motion was judged from frame sequences and two recorded scroll videos, not from sitting in front of it at 60 fps on real hardware. That is the main thing I could not verify.

## taste-skill gate
`GATE: OPEN 94 (rounds used up)`. Three rounds: 100, 95, 94 FAILs. Logs: `~/.t3/portfolio-redesign-20261114/gate/gate-round{1,2,3}.txt`. No waivers were written: the gate allows five and the open findings are one structural disagreement, not five exceptions.

What the gate caught that was real, all fixed: content hidden when scripts are off (`hidden-content`), no fallback when shaders fail (`gl-fallback`), a focus ring removed by a stray utility from the blog editor's stylesheet being scanned (`focus-ring`), focus landing on an off-screen venture (`focus-visible`), the fixed nav covering content on phones (`nav-covers`), labels cut by the viewport edge.

What stays open and why: the gate checks a company landing page built from its own kit, with one section per screen and nothing that moves because the page scrolled. `pinned` (7), `section-air` (8), `section-height`, `screen-height`, `one-section`, `empty-area`, `no-visual`, `sparse`, `container-edges`, `hero-enter`, `moment-none`, `motion-layer` and `shader-lint` all follow from this site being a scroll-choreographed 3D page with a fixed canvas, which is the brief. `cta` wants a button in the hero; this hero is a name. `copy-fact` wants a number in the h1. `heading-scale`, `stagger`, `row-lines`, `bleed-one-side`, `edge-left`, `split-pair` are its grid rules against the mixed display sizes and the horizontal run.

## Quality checks (production build, `next start`)
- `pnpm lint`: clean. `tsc --noEmit`: clean. `pnpm build`: passes, 10 static pages.
- Lighthouse (local, simulated throttling). Home mobile: performance 100, accessibility 100, best practices 100, SEO 100; FCP 0.8 s, LCP 0.8 s, TBT 20 ms, CLS 0. Home desktop: 100 / 100 / 100 / 100; LCP 0.2 s. Post page mobile: 100 / 100 / 100 / 100. Reports: `~/.t3/portfolio-redesign-20261114/lighthouse/`.
- First-load JS, gzip: `/` 183.5 kB, `/work` 179.0 kB, `/blog` 180.2 kB, post 179.7 kB, 404 179.0 kB. CSS 8.8 kB. The live site at 9a487fb serves 233.4 kB on `/`.
- Lazy JS: three.js scene 134.6 kB gzip and Lenis 5.3 kB, both after first paint. Blog posts never download the scene.
- No horizontal overflow at 390, 768, 1024 or 1440 on any route.
- Landmarks: one `header`, `nav`, `main`, `footer`, one `h1` per page, headings in order. Skip link first in tab order. Every interactive element has a visible 2px focus ring. Canvas has `role="img"` and a label.
- Reduced motion: no smooth scroll, no loader, no pins; every chapter is a readable block; the band is a still in the hero, close and page heads.
- No scripts: same readable layout plus a still image of the loop.
- No WebGL or a shader failure: the still image replaces the canvas.
- Em and en dashes: none in `src/`, `public/`, these docs, or the served HTML of `/`, `/work`, `/blog` and the 404. The post page contains only the 11 that are in the post itself.

## Known gaps
- Tested in headless Chrome for Testing on this Mac only. Not checked in Safari, Firefox, or on a physical phone; `svh`, sticky pins and WebGL on iOS are the things to look at first.
- The scene re-renders its small environment map while the floor colour eases between chapters. Cheap on this machine, unmeasured on a low-end phone.
- Chapter handoffs between pinned sections (Infiniview to rules especially) pass through a frame with little on it.
- Phone timeline, work and writing are type only.
- The engraved words on the band (`BUILD PROBE BREAK FIX AGAIN`, `LOOP 01`, `RUN 0001`, `OPEN SOURCE`) are decoration, not claims. Say the word and they change.
- The agent-bridge line now reads "OpenAI Dot", as Arav confirmed.
- No Open Graph image yet. The card falls back to text.
- Post dates render in America/Chicago with an explicit time zone on server and client, so the post shows Apr 17, 2026 like the live site.

## Follow-up, Nov 14 afternoon
Arav asked for all of his work back on the site. `/work` is now grouped: a three-figure ledger (DeveloperWeek 2026 first of 74, 36 merged pull requests upstream, 2 hackathon and challenge entries), then Agents and tools (9), Apps (9), Markets and chains (3), Robots and hardware (3), an Earlier shelf (12) and Upstream by repository (10). The home work section carries the same ledger above the six featured rows. Checked at 390, 768, 1024 and 1440 for overflow, and under reduced motion. Sources for every added line are in `content-sources.md`.
