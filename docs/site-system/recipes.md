# Recipes

Read the consistency checklist before editing a station.

## Add a station

Insert a definition in `FLIGHT` in `src/water/registry.ts`. The list runs upstream to downstream. This example stands just below the lattice. It raises a block of ice in the water already painted there. (Ask Around's ring, `src/water/shaders/ring.ts`, is a whole place made this way.)

```ts
{
  id: 'sample', rail: 'Sample', kind: 'title', length: 0.45, offset: 0.22,
  camera: ({ upright, stop }) => [{
    s: stop,
    pos: upright ? [1100, AT.lattice + 4680, 380] : [1020, AT.lattice + 4730, 280],
    aim: [1320, AT.lattice + 5500, 70], fov: upright ? 60 : 46,
  }],
  subject: {
    bit: 4096, define: 'F_SAMPLE', reach: 1300,
    boxes: [[[1240, AT.lattice + 5260, 0], [1400, AT.lattice + 5420, 140]]],
    event: [0, 0.45],
    shader: {
      fn: 'sampleIce',
      source: `vec3 sampleIce(vec3 col, vec3 ray, float progress) {
        vec3 lo = vec3(1240.0, ${(AT.lattice + 5260).toFixed(1)}, 0.0);
        vec3 hi = lo + vec3(160.0, 160.0, 60.0 + 80.0 * progress);
        vec3 a = (lo - uCamPos) / ray, b = (hi - uCamPos) / ray;
        vec3 nearFace = min(a, b), farFace = max(a, b);
        float t = max(max(nearFace.x, nearFace.y), nearFace.z);
        float leave = min(min(farFace.x, farFace.y), farFace.z);
        if (t <= 0.0 || leave < t) return col;
        vec3 normal = t == nearFace.z ? vec3(0, 0, -sign(ray.z)) :
          t == nearFace.x ? vec3(-sign(ray.x), 0, 0) : vec3(0, -sign(ray.y), 0);
        vec3 hit = uCamPos + t * ray;
        return inAir(iceGlacier(hit, normal, ray, t, hit.xy, leave-t, 1.0, 1.0, 0.0, 15.0, 0.31), ray, t);
      }`,
    },
  },
},
```

- Give a published project its existing `src/content/projects.ts` slug in `project`. The order of `PROJECTS` is the owner's and is not the flight's: adding a station does not move a project in `/work`. The default title block uses its kind, linked name and line. A study without project copy displays the rail label. The two existing metric figures have custom server-rendered templates.
- Measure length and stop offset in viewport heights. Author keys in increasing order inside the section. For a sustained move, return `holdKeys(move(pose, sx, sy, push, arc, rise), stop)` and allow room for its arrival and departure. Inspect the joins on wide and upright screens.
- Choose one unused power-of-two feature bit below the sign bit. The bounds enclose every hit, reflection and shadow throughout the event. Set the reach to the distance where the geometry becomes invisible. The shader receives eased scroll progress in either scroll direction. Pass hit geometry to the shared ice.
- To carve water, supply `paint(bed, tribs, gate)`. The render engine and the audio plan replay those operations. The hour follows the position in the flight. Live band cameras and project order follow the slug. Author any new content, page-specific UI, fallback stills and share art.
- Run the camera and audio suites, the production build and the consistency checklist. Visit the new rail tick and its two neighbours.

The figure layouts are `contributions` and `downloads`. Select one with `kind: 'figure', layout: 'contributions'` or its downloads equivalent. A title can use the default layout or select a project layout for an image, film or switch.

## Retire

Remove the definition from the list and remove shader or geometry helpers used only by that definition. Recheck the new join and the water course. For the original eight, inspect specialty media, sound and case-page bindings as well. Remove its content from `src/content/projects.ts` in the same commit: the site keeps no archive.

## Restore

Restore the definition, its geometry, shader and public content from history. Confirm its feature bit is still free and its world coordinates join the current neighbours. Run the add checks.

## Add a home section without an object

Register a definition with `kind: 'section'`, a rail label, a length, a stop offset and moving camera keys. The default block displays the label. Omit the subject. A custom statement or ending can select its own server-rendered words.

## Add a project that has no station yet

Add its entry to `entries` in `src/content/projects.ts` at its place in the owner's order, its label to `src/content/kinds.ts`, and its page to `CASES` in `src/components/work/cases.tsx` (without one it gets the plain page). Its page, its row in `/work`, the band that leads to it and its share card are then type alone (`band-type`, `feat-row-type`, `next-type` in `src/app/pages.css`). For a stretch of words on the home page, register a section with no subject and `camera: () => []`: the eye goes on between its neighbours' keys, and the block stands in the calm the picture keeps behind any words. When the world gets a place for it (as Ask Around did: `AROUND` in the registry), give the section a subject, a paint function, camera keys and a `project`, and photograph its pictures (below).

## Re-render the flight after the world or the words change

The home page plays frames rendered ahead of time. Anything that changes
the picture makes them stale: the world, the light, a station, the
camera's path, the page's length; **the words** (the picture keeps a calm
lee where each block stands, so a block that moves or grows needs its
frames again, and the live layer's masks with them: `make.mjs` does
both); the live numbers the picture shows (the columns' heights
from the model pulls, the streams' widths from the merged counts).

1. Make the change and look at it live on `/render` (the home page drawn
   by the engine; `pnpm dev` or a production build).
2. `pnpm build && pnpm exec next start -p 3183 &`, then, alone on the GPU:
   `NODE_PATH=<playwright's node_modules> node tools/flight/make.mjs --base http://localhost:3183`
   (about three hours for all four sets; `--sets wide-day` for one;
   `tools/flight/README.md` has the parts).
3. It prints every file of `public/flight/` and the total: 100 MB is the
   limit (6 MB of it the masks'). If it is over, raise `--crf-av1` / `--crf-hevc` a step and look
   at crops at 100 percent before accepting.
4. Rebuild, then: `scripts/flight-match.mjs` (the played frame beside the
   engine's at 16 places), `scripts/live-evidence.mjs` (the live layer on
   the new frames: its glints must lie on the water and nowhere else),
   the four page tests
   (`legibility-test`, `titles-test`, `words-test`, `overlap-test`),
   `scripts/player-trace.mjs` and Lighthouse (`performance.md`).
5. If the world or the light changed, the sharing cards are stale too:
   `node scripts/capture-og.mjs --base http://localhost:3183`
   (`public/og`). The inner pages' pictures (`public/media/scenes`) are
   photographed by
   `node scripts/capture-scenes.mjs --base http://localhost:3183 --only <scene>`
   from the route `/render/band`. Only Ask Around's were made this way
   (V3): the other scenes' pictures are older photographs, taken before
   the places changed their order, and a page's words were laid out on
   them. Re-shot as they are now, 78 lines on the inner pages fail
   `scripts/overlap-test.mjs`, so they were left. Re-shoot a scene only
   with that test beside you, and clear `.next/cache/images` before you
   run it: the image optimiser keeps serving the picture it had.
6. Commit `public/flight/` with the change that made it stale, in one
   commit.

## Move a place, or change the order of the places

1. Move its base in `AT` (`src/water/geography.ts`) and lay the river
   again where it meets its new neighbours (the last channel of the
   place before, the first of the place after). Put its definition at
   its new place in `FLIGHT` (`src/water/registry.ts`); add an approach
   or a leaving key where the eye would otherwise cross something.
2. Look at the whole flight on `/render` before rendering anything:
   `node scripts/render-sheet.mjs --count 32`, `--stops`, and
   `--around "<rail label>"` for a place's arrival and leaving, in both
   themes, wide (`--w 1920 --h 1080`) and tall (`--w 390 --h 844`).
3. `pnpm exec vitest run`: the camera tests say whether every half
   screen still shows a changed frame and each hold still grows its
   subject 12 to 20 percent; the audio tests say what the sound now
   hears at each stop (`movementAt` in `src/audio/scene.ts` names the
   sections each movement runs between).
4. Render again (above).

A new timed event in the picture (something that runs by the clock, not
by scroll) needs a track of its own: render it in `tools/flight/render.mjs`
as `enter` and `dawn` are, and play it in `src/flight/player.ts` where
they are played.

## Change the live layer

The weather and light over the played picture are `src/flight/live.ts`
(what it is: `architecture.md`; its rules: `motion.md`; its budget:
`performance.md`). It never draws into the picture's canvas, and a new
part must not either.

1. Change it and look at it on `pnpm dev`. How much snow is in the air
   along the valley, and where cc-switch's gates stand, are data on the
   page's plan (`PLAN.air`, `PLAN.gates`, `PLAN.sluices` in
   `src/components/flight/FlightPage.tsx`).
2. On the production build: `scripts/live-evidence.mjs` (each part
   photographed, with difference images: judge it there, then make sure
   it cannot be pointed at in the still), `scripts/live-cost.mjs` (the
   budget), `scripts/live-states.mjs` (reduced motion, hidden tab, the
   governor), `scripts/live-picture-same.mjs` against the build before
   (the picture under the layer has not changed).
3. The four page tests: the layer runs while they photograph the
   picture behind the words, so they also say whether it has lowered a
   line's contrast.

## Add an inner page

A route under `src/app/`, wrapped in the page shell
(`src/components/PageShell.tsx`), opening on a scene band and ending
on a next band, on `.pg-ground`, with type from the tokens in
`src/app/pages.css`. No screenful under a third filled
(`scripts/fill-test.mjs`); every line against its ground
(`scripts/overlap-test.mjs`).

Change log: 2026-11-18 first version (orchestrator). 2026-11-20 K1: a project without a station, no archive. 2026-11-20 V1: re-render the flight.
