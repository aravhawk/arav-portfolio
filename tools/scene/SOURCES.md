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
| [Ice 003](https://ambientcg.com/view?id=Ice003), [Ice 004](https://ambientcg.com/view?id=Ice004) | Lake surface and slab density |
| [Terrain 003](https://ambientcg.com/view?id=Terrain003), [004](https://ambientcg.com/view?id=Terrain004), [005](https://ambientcg.com/view?id=Terrain005) | Three eroded relief fields and registered albedo |
| [Snow 008 A](https://ambientcg.com/view?id=Snow008A), [009 A](https://ambientcg.com/view?id=Snow009A) | Sastrugi relief |
| [Mountainside](https://polyhaven.com/a/mountainside), [Rock 09](https://polyhaven.com/a/rock_09) | Scanned headland source and rematerialled ice fragments |

Poly Haven and ambientCG publish these assets under CC0. The existing TASA Orbiter font uses its repository licence. Exact upstream URLs and SHA-256 hashes are in [the input manifest](lake/inputs.json). The comparison photographs are outside the authoring pipeline.
