# Recipes

Read the consistency checklist before editing a station.

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

- Give a published project its existing `src/content/projects.ts` slug in `project`. The default title block uses its kind, linked name and line. A study without project copy displays the rail label. The two existing metric figures have custom server-rendered templates.
- Measure length and stop offset in viewport heights. Author keys in increasing order inside the section. For a sustained move, return `holdKeys(move(pose, sx, sy, push, arc, rise), stop)` and allow room for its arrival and departure. Inspect the joins on wide and upright screens.
- Choose one unused power-of-two feature bit below the sign bit. The bounds enclose every hit, reflection and shadow throughout the event. Set the reach to the distance where the geometry becomes invisible. The shader receives eased scroll progress in either scroll direction. Pass hit geometry to the shared ice.
- To carve water, supply `paint(bed, tribs, gate)`. The render engine and the audio plan replay those operations. The hour follows the position in the flight. Live band cameras and project order follow the slug. Author any new content, page-specific UI, fallback stills and share art.
- Run the camera and audio suites, the production build and the consistency checklist. Visit the new rail tick and its two neighbours.

The figure layouts are `contributions` and `downloads`. Select one with `kind: 'figure', layout: 'contributions'` or its downloads equivalent. A title can use the default layout or select a project layout for an image, film or switch.

## Retire

Remove the definition from the list and remove shader or geometry helpers used only by that definition. Recheck the new join and the water course. For the original eight, inspect specialty media, sound and case-page bindings as well. Archive published content separately when its URL must continue to resolve.

## Restore

Restore the definition, its geometry, shader and public content from history. Confirm its feature bit is still free and its world coordinates join the current neighbours. Run the add checks.

## Add a home section without an object

Register a definition with `kind: 'section'`, a rail label, a length, a stop offset and moving camera keys. The default block displays the label. Omit the subject. A custom statement or ending can select its own server-rendered words.

## Add an inner page

A route under `src/app/`, wrapped in the page shell
(`src/components/PageShell.tsx`), opening on a scene band and ending
on a next band, on `.pg-ground`, with type from the tokens in
`src/app/pages.css`. No screenful under a third filled
(`scripts/fill-test.mjs`); every line against its ground
(`scripts/overlap-test.mjs`).

Change log: 2026-11-18 first version (orchestrator).
