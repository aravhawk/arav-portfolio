# Recipes

Status: **today's recipe is by hand**, file by file, and is written
out below so that nothing is missed. **Planned:** the station
registry reduces "add a station" to one definition plus its object's
shader; this file is rewritten when that lands, and proved by a fresh
helper adding a throwaway station from this pack alone.

Before any recipe: read `consistency-checklist.md`. A change is not
done until it passes that list.

## Add a station to the flight (today, by hand)

1. **Content.** Add the project to `src/content/projects.ts` (name,
   one plain line, page copy, links, year) and its label to
   `src/content/kinds.ts`. Follow `copy.md`. Count the home page's
   words.
2. **Timeline.** In `src/water/camera.ts` add its length to
   `SECTIONS` in flight order and give it a `Move` for wide and for
   upright screens: the point the eye turns about is where the words'
   ground meets the subject, so the subject grows away from the
   words. Add it to `flightKeys`. Run `tests/water/camera.test.ts`
   (the eye never stops; every half screen changes).
3. **Place.** In `src/water/world.ts` give its object and its water a
   place on the river after its neighbour.
4. **Object.** In `src/water/shaders/stations.ts` write its object
   using the shared ice and the water that is there; call it from
   `shaders/flight.ts`. One subject, lit by its hour, whole inside
   the frame at every width. See `light-and-materials.md`.
5. **Its piece of the frame.** In `src/water/variants.ts` register
   its box of the world so its code runs only where it stands, and
   its `#define` for the stretch's variant.
6. **Its event.** One scroll-driven thing that happens to its object
   (scrubbed both ways, a mechanism no neighbour uses), in
   `src/water/moments.ts` with uniforms set in `src/water/flight.ts`.
7. **Its hour.** It takes its light from its place on the timeline in
   `src/water/sky.ts`; adjust the neighbouring keys only if the day
   needs room.
8. **Words.** In `src/app/page.tsx` add its section and block
   (eyebrow, title, line, figure or action) with `build()`
   thresholds; it takes the home page's one anchor and one scale from
   `src/app/flight.css`. Add its tick to the rail.
9. **Its page.** `src/app/work/[slug]` renders from the content; give
   it a case layout in `src/components/work/` if it needs one, a
   scene band and stills (`scripts/` capture tools), and a share
   card (`scripts/capture-og.mjs`).
10. **Sound.** `src/audio/plan.ts` reads the world's plan; run
    `tests/audio/` and update only the copied numbers that the tests
    name.
11. **Check.** Everything in `consistency-checklist.md`.

## Retire a station

Remove it in the reverse order, keeping its definition in git history
only (no dead code left behind): the block and tick, the event, the
piece and variant, the object's GLSL, its place, its `Move` and
length, its content entry or move the entry to the archive. Close the
gap on the timeline by regenerating the stops, never by leaving an
empty stretch. Run the whole checklist: its neighbours now meet each
other.

## Restore a station

Take its definition back from history as a whole, then treat it as a
new station: it must use today's ice, light and tokens, not the ones
it had.

## Add a home section that is not a station (a statement, an interlude)

A stretch of the flight with words and no object: a length in
`SECTIONS`, keys that travel (never a hold), a block in `page.tsx`,
and a calm ground under the words. No new shader code.

## Add an inner page

A route under `src/app/`, wrapped in the page shell
(`src/components/PageShell.tsx`), opening on a scene band and ending
on a next band, on `.pg-ground`, with type from the tokens in
`src/app/pages.css`. No screenful under a third filled
(`scripts/fill-test.mjs`); every line against its ground
(`scripts/overlap-test.mjs`).

Change log: 2026-11-18 first version (orchestrator).
