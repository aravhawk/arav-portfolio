# The consistency checklist

Status: **as built** (the rule); the tooling for items 5 and 6 is
being added.

Run this whole pass before any change is called done. Any mismatch is
a FAIL. The page must be coherent at every commit: never one stretch
in a new light, motion or material while its neighbours are in the
old one.

1. **Look at the whole page**, both themes, 1440 and 390: 24 evenly
   spaced frames each, and every composed stop at 2x. Then the
   transitions: for every pair of neighbouring sections, eight frames
   across the join.
2. **Motion**: every half screen of scroll changes the picture; the
   eye never stops; easing and durations come from the tokens; no
   mechanism is used by two neighbours; the words build in the one
   way; reduced motion is whole.
3. **Light**: each station is told from its neighbours by light
   alone; the light moves without a step; the night has form.
4. **Materials**: all ice is the one ice; no glow or outline where
   water meets ice; no glass anywhere in the DOM.
5. **Frame pacing and input**: per-screen frame times within the
   budget and even from section to section on the owner's display
   (`performance.md`); the pointer's wake within a frame.
6. **First visit**: no held frame while moving.
7. **Words**: `scripts/legibility-test.mjs`, `scripts/words-test.mjs`,
   `scripts/titles-test.mjs` pass at 390, 768, 1440 (and the wide
   ones); nothing clipped or covered; 200 words or fewer on the home
   page; copy follows `copy.md`.
8. **Inner pages**: `scripts/overlap-test.mjs`, `scripts/fill-test.mjs`
   on every page, **a blog post and the blog index included**, at
   320, 390, 768 and 1440 in both themes. Lighthouse on the home
   page, one project page and one blog post, at 1440 and at 390.
   Every address (canonical, share image, feed, sitemap, robots,
   structured data) on `https://arav.pro`.
9. **Code**: `pnpm lint`, `pnpm exec tsc --noEmit`,
   `pnpm exec vitest run`, `pnpm build`; no console errors; pages read
   with scripts off.
10. **Other browsers and states**: WebKit and Firefox, reduced motion,
    no WebGL, forced colours, print.

## The critics' PASS criteria

Independent critics judge captures and motion runs of this site
beside landonorris.com, igloo.inc and lusion.co, and return PASS or
FAIL with reasons (no scores). A PASS needs all of:

1. No tell of a generic AI-made site anywhere (no glass panels, no
   cursor-repel particles, no jelly, no template type, no slogans,
   no captions that explain the design).
2. Every half screen of scroll changes the picture; no two stations
   share a mechanism; motion reads as one system.
3. The name, the ice and the water read as photographed materials;
   each station is told apart by light alone.
4. The night theme is the equal of the day.
5. Nothing covers or clips text at any width; what he does is in the
   first paint.
6. Hierarchy holds at real size; every sentence is specific to him
   and his work.
7. The frame-time and first-visit budgets hold on the owner's
   display, with the per-screen table attached (measured, not judged
   from stills).
8. Beside the three references, the critic cannot name a fault that
   makes this the lesser site.

Change log: 2026-11-18 first version (orchestrator).
