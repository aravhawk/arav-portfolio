# Day frame source materials

Run `tools/scene/render-day` on the Metal authoring machine. The script checks all three downloads against their SHA-256 hashes before rendering. Its default output is a 2880 × 1800 Cycles frame under `.tools/out/o1/`.

| Source | Rights | Use |
| --- | --- | --- |
| [Frozen Lake](https://polyhaven.com/a/frozen_lake) | Poly Haven CC0 | 2K HDR environment for illumination, reflections and refraction |
| [Snow Field Aerial](https://polyhaven.com/a/snow_field_aerial) | Poly Haven CC0 | 2K scanned height field displaced into the windpack, plus the matching colour scan for snow albedo |
| Site's TASA Orbiter variable font in src/fonts | Existing project typeface | Bold instance converted locally for Blender glyph outlines |

The ridge meshes, scoured mantle, cracks, embedded bubble veils and ice strokes are generated from source in day.py. The reference photograph of Igloo's site is used only for comparison in the local evidence folder.
