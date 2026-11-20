# Day frame source materials

Run `tools/scene/render-day` on the Metal authoring machine. The script checks all three downloads against their SHA-256 hashes before rendering. Its default output is a 2880 × 1800 Cycles frame under `.tools/out/o1/`.

| Source | Rights | Use |
| --- | --- | --- |
| [Frozen Lake](https://polyhaven.com/a/frozen_lake) | Poly Haven CC0 | 2K HDR environment for illumination, reflections and refraction |
| [Snow Field Aerial](https://polyhaven.com/a/snow_field_aerial) | Poly Haven CC0 | 2K scanned height field displaced into the windpack, plus the matching colour scan for snow albedo |
| Site's TASA Orbiter variable font in src/fonts | Existing project typeface | Bold instance converted locally for Blender glyph outlines |

The ridge meshes, scoured mantle, cracks, embedded bubble veils and ice strokes are generated from source in day.py. The reference photograph of Igloo's site is used only for comparison in the local evidence folder.

## Study 095

Run `tools/scene/render-lake` from the checkout to render the approved camera, its name mask and its matched ground plate. Intermediate files go under the ignored evidence directory. The frozen construction retains the order of modelling and lighting operations from study 095.

| CC0 source | Use |
| --- | --- |
| [Frozen Lake](https://polyhaven.com/a/frozen_lake), [Snow Field 2 Pure Sky](https://polyhaven.com/a/snow_field_2_puresky), [Wasteland Clouds Pure Sky](https://polyhaven.com/a/wasteland_clouds_puresky) | Environment illumination, sky and dawn backlight |
| [Snow Field Aerial](https://polyhaven.com/a/snow_field_aerial), [Snow 02](https://polyhaven.com/a/snow_02) | Snow albedo, displacement and fine windpack detail |
| [Ice 003](https://ambientcg.com/view?id=Ice003), [Ice 004](https://ambientcg.com/view?id=Ice004) | Lake surface, slab density and the view-dependent microfacet response in the metric lake bake |
| [Terrain 003](https://ambientcg.com/view?id=Terrain003), [004](https://ambientcg.com/view?id=Terrain004), [005](https://ambientcg.com/view?id=Terrain005) | Three eroded relief fields and registered albedo |
| [Snow 008 A](https://ambientcg.com/view?id=Snow008A), [009 A](https://ambientcg.com/view?id=Snow009A) | Sastrugi relief, wind-scoured snow coverage and the fine normal detail on the near bank |
| [Mountainside](https://polyhaven.com/a/mountainside), [Rock 09](https://polyhaven.com/a/rock_09) | Scanned headland source and rematerialled ice fragments |

Poly Haven and ambientCG publish these assets under CC0. The existing TASA Orbiter font uses its repository licence. Exact upstream URLs and SHA-256 hashes are in [the input manifest](lake/inputs.json). The comparison photographs are outside the authoring pipeline.

## Browser bake

Run `tools/scene/bake-lake` from this checkout after installing the project's locked dependencies. It verifies the inputs, renders day and blue hour in Cycles, exports the decimated meshes and optical atlas, encodes KTX2, AVIF radiance fields and meshopt, samples the Blender display transform into LUTs, builds the site and captures the four first-paint stills from the production renderer. The poster capture uses the shared Playwright installation and starts a temporary server on port 3184. The script pins the Python tools and verifies the Khronos KTX tools download for Apple silicon. An existing compatible encoder can be selected with `TOKTX`.

The lab worker uses the versioned Basis Universal and meshoptimizer decoders from `three`. Their software licences are recorded beside the decoders. The camera's view-dependent reflection also uses the Frozen Lake environment listed above.

The O2 wind-scoured far bank uses the recorded Snow 008 A and 009 A displacement scans. The directional glints on the lake use Ice 003 as a bump map. The pressure collars reuse the authored rafted slabs.

The O2b foreground snow tongue uses the Snow 008 A scan. The solar footprint comes from the projected outlines of the eight authored slabs. A second Cycles camera records the eastern faces and background at the end of the move in each lighting setup. Both cameras also render a wide portrait background. The foreground windpack carries the recorded Snow 02 normal map in metre-scaled UVs.

## Infiniview ridge studies

The offline Cycles study in `ridge/study.py` uses the following CC0 inputs from the same verified cache. The pressure ridge meshes, internal air lenses, spill, foam and distant shore are authored in the script.

| Source | Use |
| --- | --- |
| [Frozen Lake](https://polyhaven.com/a/frozen_lake) | Indirect illumination and reflections in the slab faces |
| [Wasteland Clouds Pure Sky](https://polyhaven.com/a/wasteland_clouds_puresky) | Low-contrast cloud detail in the dawn gradient |
| [Ice 003](https://ambientcg.com/view?id=Ice003) and [Ice 004](https://ambientcg.com/view?id=Ice004) | Surface relief of the lake, chipped edges and partially healed air lenses |
| [Snow 02](https://polyhaven.com/a/snow_02) | Windpack grain |

The Baikal and pressure-ridge photographs were visual references only. The original O3 day study is frozen in commit `28edb44`. Its authoring command, from that revision, was:

```sh
py="$HOME/.t3/portfolio-redesign-v4/tools/bake-venv/bin/python"
"$py" tools/scene/lake/inputs.py
"$py" tools/scene/ridge/study.py .tools/out/o3/studies/07-current.png --width 2880 --samples 48
```

The O3b bake at `8d366e8` recorded inverse depth and liquid coverage at the two camera gates. The station uses the lake’s 32³ display LUT.

### O3c layer bake

`tools/scene/bake-ridge` builds a day and a blue-hour material library from the final lake authoring pass. The ridge uses those exact slab, fracture, sun, sky and bounce-light datablocks. Separate deposits add frost to exposed plate faces. The snow uses the hero's metre-scale Snow 02 normal mapping. The wind field is derived from the [Poly Haven Snow 02 displacement scan](https://polyhaven.com/a/snow_02), and the bank relief uses the [ambientCG Snow 009 A displacement scan](https://ambientcg.com/view?id=Snow009A). Both are CC0.

Cycles renders the complete view, the bank with both jaws hidden, and two isolated slab groups at each camera and light setting. The packed native luminance atlas, companion colour and river-coverage atlas, native silhouette matte shared across lighting states, and wind sample are served locally. The bake also regenerates the byte ledger and the projections for the two lips and the snow plane. Render evidence and the uncompressed projections are in `.tools/out/o3c/`.

### O3d standing wall

Six standing monoliths and three fallen fragments occupy seven cuts across the river. The script constructs the broken crests, fracture sheets, heaved collars, frozen margins, daylight disc and horizon glow. It derives a separate unwrapped density field for each monolith and fragment from ambientCG Ice 004 and Poly Haven Snow 02. The same lake materials supply its volume absorption, scattering and frost. The embedded fields and Cycles renders stay offline. The Snow 02 normal scan breaks up a non-repeating strip of capillary crests. The survey's alpha channel stores this strip separately from the baked liquid colour so the closing camera samples it in river coordinates. All source scans and their CC0 links appear above.

Run `tools/scene/bake-ridge` to reproduce the station. The two moving projections now carry the fallen fragments and the standing wall. The third carries the ground and the far shore. The O3c picture and its bake remain reproducible at `7ee68ba`.

The downstream river reuses the lake Slab, Snow, Fracture and Lake sky library and the ridge water, moraine and fog. The CC0 source URLs and licences above apply to these bakes. The riverbanks and slab outlines are authored in metres in `tools/scene/river/`.
