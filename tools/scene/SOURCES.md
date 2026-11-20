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

The flight's working Infiniview plates reuse the same CC0 inputs. Run
`tools/scene/bake-ridge` to render wide and tall cameras at first light and
blue hour, record inverse depth and liquid coverage, encode log-radiance
AVIF and lossless survey textures, and regenerate the registry byte ledger.
Each plate is decoded through the lake's own 32³ display LUT at runtime.
