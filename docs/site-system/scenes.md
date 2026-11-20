# Scenes: art direction and making

How the twelve pictures are meant to look, how they are made, and
what was learned making them. Read this before authoring or
changing a scene. The steps are in [recipes.md](recipes.md).

## The one world

A frozen lake at first light, and the river that leaves it. Every
scene is a place on that river, later in the same morning, in page
order. All of it is made from the same few materials, built once
for the hero and reused:

- **Slab ice**: sawn slabs of clear lake ice, pale where light
  passes through, with white fracture planes and bubble veils
  inside, frost on the upper edges, a bright rim where the low sun
  is behind them. The name's letters are made of it.
- **Black ice**: the lake's surface where no light passes, with a
  white crack network.
- **Wind-packed snow**: scoured ridges and soft drifts from scanned
  height fields. It is the calm ground the words stand on.
- **Open water**: dark, heavy, clear. A dark line on white is the
  page's main drawing tool.
- **The low sun**: behind the subject, so the subject is lit
  through or rimmed, with long shadows toward the camera.
- **The blue hour**: the dark theme is the same place before dawn.
  Blue, never black, never charcoal grey, lit by the sky's glow.

Colour is one cold blue-grey family at low saturation. White
appears only where light is: the sun, a glint, a lit edge. One
grade for the whole page in each theme (the lake's 32-cubed LUT,
`public/scene/lake/grade-day.rgb.gz` and `grade-night.rgb.gz`).

Every scene has four renders: wide and tall, day and night. Both
themes are first class. The phone is not a crop of the desktop.

## The twelve scenes

| Scene | The idea |
| --- | --- |
| `lake` | The name as slabs of lake ice on black ice, the low sun behind the far end |
| `statement` | No object. The river as one dark line across a wide field of snow |
| `infiniview` | A wall of standing slabs across the river, one fallen out of it, the sun in the gap |
| `open-source` | Seven meltwater channels join the river, each as wide as one repository's merged pull requests |
| `kilo-bench` | Three standing slabs, their heights the three models' scores |
| `agent-bridge` | A slab on each bank and one laid across between them |
| `ollama` | Four round pools, each one's area that model's share of the pulls |
| `cc-switch` | The river forks in three; one branch runs open, two are frozen |
| `tensorpow` | Sixteen blocks in a four by four grid on black ice, one lit through |
| `rydar` | One tight bend, a single slab on its outside like a marker |
| `interests` | A delta of seven channels, one an interest |
| `ending` | Open water to the horizon; one slab stands, one lies not yet raised |

## What was learned the hard way

1. **A few large, simple solids in a clear silhouette.** This
   pipeline makes standing slabs well and heaps of small tilted
   pieces badly. Infiniview was first a heaped pressure ridge and
   read as a pile of grey planks. It was redone as a wall with one
   slab missing. A scene is one readable idea made of at most a
   handful of simple shapes, or of the ground itself: dark water
   and black ice against snow.
2. **The hero's camera grammar.** Camera low. Lens 35 to 40
   degrees. The subject on a diagonal, far enough back that the
   whole idea is in frame. The low sun behind the subject. Sky in
   the upper third. A low fogged shore. Words lower left on calm
   snow. The scene's scroll is a push toward the subject.
3. **Grey blocking first, checked at 320 px.** Render the scene in
   plain grey (`--clay` in `tools/scene/ridge/study.py`) and look
   at it 320 px wide. A stranger must be able to say what it is in
   three words. Only then materials.
4. **One idea a scene.** One subject, with quiet around it. Snow
   and sky may be two thirds of the frame.
5. **Words on calm ground, through the whole push.** Check with the
   page's real words on, at the start and the end of the push, wide
   and tall, day and night. Channels behind a number, a title
   across a shoreline and a subject drifting up beside a title were
   all real faults. The fix is to re-aim the camera, shorten the
   push, or set `words: 'lower-right'`. Never a panel or a shadow
   behind the words.
6. **Night contrast is made in the bake.** White words on pale
   night snow measured as low as 1.3 to 1 before the fix. The fix
   was in the Blender scene: the near snow shelf keeps 10.5 percent
   of its light close to the camera and eases back to full between
   7 and 36 m downriver (`tools/scene/ridge/study.py`, the block
   under `if args.night`). After it, every scene's words measure
   4.7 to 1 or better at both ends of the push. A grade applied
   after rendering passed the numbers and still looked wrong
   (bright patches round the mist). Look as well as measure.
7. **The phone gets its own camera.** Its own distance, height and
   lens, with the subject in the upper middle and the words below.
   The delta needed a 46 degree lens and a higher camera to keep
   its outer channels in frame.
8. **The push is small on purpose.** A plate is a flat render moved
   by a depth field. Push too far and the projection stretches into
   streaks, or one slab slides over another without real parallax.
   Keep `push` near the values in the registry and look at the
   closing pose before you freeze a camera.
9. **About ten studies a scene, then freeze and ship.** Log each
   study. Do not stop at a picture: freeze the best, pack it,
   register it, list its faults.
10. **Haze, not lines.** Where sea or far shore meets sky, bake a
    fade into the sky (`fade_sea` in `tools/scene/river/ending.py`).
    A horizon as sharp as the foreground reads as a game.

## Scenes drawn from data

Three pictures encode real numbers. The scripts read
`content/metrics.snapshot.json` at bake time, so the picture is as
old as the snapshot it was baked from (today: retrieved
2026-11-16).

| Scene | Source | Encoding |
| --- | --- | --- |
| `open-source` | `mergedPrs.ledger`, grouped by repository (8, 5, 3, 2, 1, 1, 1) | Each channel's full width in metres is twice `max(0.36, 0.20 × count)` (`tools/scene/river/open_source.py`) |
| `ollama` | `ollama.models[].pulls` | Each pool's radius is 3.24 m times the square root of its pulls over the largest (`tools/scene/river/ollama.py`) |
| `kilo-bench` | The scores 7.6, 7.4, 6.3, written in `tools/scene/river/kilo_bench.py` | Each slab is 0.57 m tall a point |

The delta's seven channels match the seven entries of `INTERESTS`
in `src/content/projects.ts`, but the count is written in
`tools/scene/river/interests.py`, not read. If a number or a count
changes, re-bake the scene: see "Re-bake" in
[recipes.md](recipes.md).

## How a scene is made

- **Sources.** CC0 only, from Poly Haven and ambientCG. Every
  source, its licence and its use is in `tools/scene/SOURCES.md`;
  the downloads and their hashes are in
  `tools/scene/lake/inputs.json`. No paid source, no account, no
  generated imagery, no request to a third party from the site.
- **The lake** is authored by the scripts in `tools/scene/lake/`
  and rebuilt whole by `tools/scene/bake-lake`: meshes, baked
  textures, the grade LUTs, and its four stills.
- **A river scene** is one small Python module in
  `tools/scene/river/` that shapes the ground and places the slabs,
  rendered by `tools/scene/ridge/study.py` with the lake's own
  material library, and packed by `tools/scene/ridge/pack.py`.
  `tools/scene/bake-reach <id>` does all of it. Each scene's camera
  for each gate is a set of flags in that shell script.
- **Infiniview** has its own script, `tools/scene/bake-ridge`, and
  its own packer, `tools/scene/ridge/layers.py`, because its wall
  is rendered in separate layers.
- **Rendering** is Cycles: day and blue hour, wide (3456 px) and
  tall (1080 px). The day render also writes a survey image: red is
  10 m over the distance from the camera, green marks moving water.
  Both themes share geometry and cameras.

## What fails, by name

Send a picture back if it shows any of these:

- visible facets or flat shading; boxes; cubes with snow caps like
  icing;
- saturated cyan or turquoise;
- one procedural noise as the only detail; a texture that repeats
  on a large face;
- plastic highlights;
- a hard cut-out join where an object meets the ground or water;
- a horizon as sharp and contrasty as the foreground;
- anything grey that should be ice; a night that is charcoal
  instead of blue;
- more than one subject competing in a frame;
- anything a viewer would call a game asset or a placeholder.

And in the page around it: frosted or translucent panels, particles
that flee the cursor, jelly or bounce, a photo of the owner.

## Known faults today

Kept honest, worst first (from the last consistency pass):

1. The lake ships 2,421,598 bytes against 1.3 MB a scene.
2. Plates give less parallax between overlapping slabs than real
   geometry would. TensorPoW still shows some overlap.
3. Agent Bridge's deck meets its uprights at square joints.
   TensorPoW's grid looks staged. The delta's mouths join the sea
   too evenly.
4. cc-switch's three profiles are a plain row of names on the home
   page, not a control.

Change log: 2026-11-19 written in place of the old light and
materials page (M1).
