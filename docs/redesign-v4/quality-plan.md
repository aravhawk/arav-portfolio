# The quality plan (Nov 18, 2026)

Written in answer to Arav's quality brief (t306u, t307u) and his
addition about a maintainer pack (t309u). The goal: the best personal
site there is. Zero AI slop, extreme physical fluidity, never killing
the browser. Benchmark: landonorris.com, with igloo.inc and lusion.co.
Critics return PASS or FAIL; no numbers.

## What was studied

- The source pack, the API critic's review
  (`.tools/briefs/critic-review-api-1.md`), and the skills installed
  on this machine (the taste skill, Emil Kowalski's, animation
  performance, choreograph, Apple design, animate, mobile native).
- landonorris.com first-hand, Nov 18 (frames in
  `~/.t3/portfolio-redesign-v4/references/landonorris/study-20261118/`):
  Webflow, GSAP 3.13, Lenis 1.1.20 (lerp 0.1, one frame loop owned by
  GSAP), three r174, Rive for small icons; an 1,800 px wheel burst
  settles exponentially in about 1.6 s with no snapping; one easing
  voice (`cubic-bezier(0.65, 0.05, 0, 1)` at 0.75 s on about 100 of
  110 transitioned elements, an expo-out second); the pointer paints
  a noise-edged mask on the hero that heals back in about 1.5 s; 542
  words over 15 screens (ours: 200 over 32); 3D confined to the hero
  and a few moments. Its frame times were not measured (the GPU was
  shared with a running helper).

## (a) Slop tells and their fixes

Glass chrome (done: solid plates). Extruded hero name (done: plates of
clear lake ice; cut chips and real refraction to come). The night as
one cobalt wash (A1). Game-prop ice (A2, one ice). A screenshot frozen
in an ice block, Igloo's idea (Infiniview becomes water breaching a
wall of ice; the screen stands free). The keystoned table and RydAR's
web card (a flat slab whole at every width; a phone plate showing the
app). Dead holds over 32 screens (the motion task; about 24 screens).
One choreography at every station (an event of its own for each;
words that enter with the camera's direction). The ending's ribbon as
a lens flare (it rises from the sun's path; the two themes end
differently). Specks and diagram streamlines in cc-switch's water.
Paper grain, streaks and a seam on inner pages (done). One template
for every project page with padded figures (structure varied by
project). The first paint's pop and hidden line (done). First-visit
freezes and lag (section c). Copy against the Nov 16 rule: the home
page's "Messages are data, never permission." becomes a plain
sentence (it stays on the project page as his README's own line);
"It's still early." gives way to "Selected for OpenAI DevDay 2026."
as the ending's headline unless he vetoes it.

## (b) Fluidity

One clock (the engine owns the only frame loop). Lenis-class inertia
with the camera on a critically damped, frame-rate-independent spring,
never under a quarter of travel speed at a station, scrubbing both
ways to exact rest poses. Scroll velocity as a signal (streaks and
spray, a slight bank, a breath of the lens under 2 degrees, the
sound); crisp at rest; no blur ever. The pointer raises real wakes
and leans the light and the eye on a spring; every control answers at
pointer-down; hover only for fine pointers; haptics at discrete
beats. Three curves and a short table of durations
(`docs/site-system/motion.md`). A different scroll-driven event at
each station, begun at its object. Page transitions that begin at the
thing touched. Designed reduced motion.

## (c) Performance

The budget and its measurement are in
`docs/site-system/performance.md`: p95 16.7 ms and under 1 percent
over 25 ms on every screen in both themes at 1920 by 1080 at 2x, no
section more than 2 ms dearer than its neighbours; 120 Hz only where
full shading holds it; no held frame on a first visit while moving
(programs built in an opening of 5 s or less, shown on the rail);
never lower resolution or blur; 64 MiB of textures, one context;
phones at 60. Enforced by `scripts/perf-trace.mjs` (owner's profile,
first-visit run, memory) as a gate at every integration.

## (d) Who does what, in order

Astra (3D, one task at a time, each reviewed against the references
before it lands; station work gathers on a staging branch and lands
whole after a consistency pass):

1. A1 the light (running).
2. A2 one ice across the whole page.
3. A3 the station registry: one typed definition a station, the
   existing stations ported with the picture unchanged (the code side
   of the maintainer pack).
4. A4 the motion system and pacing on the registry.
5. A5 the frame budget: plates and canyon baked, the first visit's
   opening, the governor.
6. A6 to A10 the stations in pairs, each added through the registry
   by the pack's recipe (Infiniview and the statement; Upstream and
   Kilo Bench; Agent Bridge and Open models; cc-switch and TensorPoW;
   RydAR and the delta).
7. A11 the ending's ribbon and the inner pages' scenes.
8. A12 whatever the consistency pass fails.

This thread (Fable): the glass (done); copy; the words'
choreography; inner pages; page transitions; phone targets and a
section jump; the performance gate and the consistency tooling; the
maintainer pack's pages (`docs/site-system/`, linked from
`AGENTS.md`), kept true as each task lands; retakes; integration; the
consistency pass at each stage; the critic panels; and, before V4 is
called done, **a fresh helper adds a throwaway section on a scratch
branch from the pack alone**, the result is checked for a seamless
fit, the branch is deleted, and the pack is fixed wherever the helper
struggled.

## (e) PASS criteria

The eight in `docs/site-system/consistency-checklist.md`.
