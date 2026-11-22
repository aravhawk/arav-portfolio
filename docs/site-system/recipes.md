# Recipes

Read the consistency checklist before editing a station.

## The standing rule: a new project becomes a station

The owner's words (2026-11-22): "Whatever new projects and stuff I get,
they should be fully seamlessly added in there." A project is never
added as a row of `/work` alone. It gets a place in the flight, made of
the world's own ice, water and light, and everything else follows from
its registration. envfetch (R3) is the worked example; the files to
read are `src/water/shaders/vault.ts` and the `vault` entry of `FLIGHT`.

What that took, in order:

1. **A place by the river that neither neighbour's frame holds.** Work
   it out from the neighbours' composed cameras (position, heading,
   half the field of view at the widest window) before writing
   anything. The kettle lies on the west bank the flight already
   crosses between the dam and the lattice: behind the lattice's
   camera and off the side of the dam's.
2. **Its water**, as a painter (`paintKettle` in `geography.ts`). The
   bed's distance field reaches 360 units from a shore, so new water
   further than that from every shore a neighbour shows changes none of
   their pixels.
3. **Its subject**, a registered subject with no pass of its own: one
   GLSL function over the finished ground and water, shaded by
   `iceGlacier`, with its shade, its image in its water and its light,
   and one event on `progress` (the scroll through `event`).
4. **A length that is a whole number of quarter screens**
   (`performance.md`), and **`added: true` on its definition.** The light's hours were set
   station by station on the flight as it was; `lightAt` (camera.ts)
   takes an added station's length out of the light's clock, so every
   later station keeps its hour. Without it every later frame changes.
5. **Its words** (a layout in `src/app/page.tsx` in the others' measure:
   label, name, one line, small print, a callout that names the object
   with a fact), **its project** (`projects.ts`, `kinds.ts`, a page in
   `cases.tsx` from the repository's own facts), its line in
   `PICTURES` (`src/lib/og.tsx`).
6. **Its sound** (`sound.md`): a cue in the manner of its neighbours,
   from numbers the picture owns (`VAULT_LIT`).
7. **Its subject in `SUBJECTS`** of `tests/water/camera.test.ts`.
8. **The proof and the measurements**: the pinned picture of every
   other station at its own stop against the build before
   (`scripts/flight-picture.mjs`; later stops are that station's length
   further down); the cost map made again (`flight-frame-cost.mjs
   --map`); a first visit; `coverFlight`'s limit if the lower river
   would otherwise need one more broad program.
9. **Its stills and its share card**: `public/media/scenes/<slug>-*`
   (four shapes, two themes) and `public/og/<slug>.jpg` with its line
   in the manifest (`scripts/capture-og.mjs --only <slug>`).

## Add a station

Insert a definition in `FLIGHT` in `src/water/registry.ts`. The list runs upstream to downstream. This example fits between the lattice and the canyon. It raises a block of ice in the water already painted there.

```ts
{
  id: 'sample', rail: 'Sample', kind: 'title', length: 0.45, offset: 0.22,
  camera: ({ upright, stop }) => [{
    s: stop,
    pos: upright ? [1100, T2 + 4680, 380] : [1020, T2 + 4730, 280],
    aim: [1320, T2 + 5500, 70], fov: upright ? 60 : 46,
  }],
  subject: {
    bit: 4096, define: 'F_SAMPLE', reach: 1300,
    boxes: [[[1240, T2 + 5260, 0], [1400, T2 + 5420, 140]]],
    event: [0, 0.45],
    shader: {
      fn: 'sampleIce',
      source: `vec3 sampleIce(vec3 col, vec3 ray, float progress) {
        vec3 lo = vec3(1240.0, ${(T2 + 5260).toFixed(1)}, 0.0);
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

Add its entry to `entries` in `src/content/projects.ts` at its place in the owner's order, its label to `src/content/kinds.ts`, and its page to `CASES` in `src/components/work/cases.tsx` (without one it gets the plain page). Its page, its row in `/work`, the band that leads to it and its share card are then type alone (`band-type`, `feat-row-type`, `next-type` in `src/app/pages.css`). For a beat on the home page, register a section with `layout: 'beat'`, no subject and `camera: () => []` (see `around` in the registry): the eye goes on between its neighbours' keys, and the block stands in the calm the picture keeps behind any words. When the world gets a place for it, give the section a subject and a `project`, and capture its stills (`public/media/scenes`, `public/og`).

## Add an inner page

A route under `src/app/`, wrapped in the page shell
(`src/components/PageShell.tsx`), opening on a scene band and ending
on a next band, on `.pg-ground`, with type from the tokens in
`src/app/pages.css`. No screenful under a third filled
(`scripts/fill-test.mjs`); every line against its ground
(`scripts/overlap-test.mjs`).

Change log: 2026-11-22 R3: the standing rule and its worked example (envfetch).

Change log: 2026-11-18 first version (orchestrator). 2026-11-20 K1: a project without a station, no archive.
