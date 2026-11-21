# Light and materials

## Light

| Stop | Day | Night |
| --- | --- | --- |
| Lake | Low sun behind the plates | Low moon and a faint aurora |
| Statement | Long blue shadows in morning mist | Silver moonlight across the river |
| Infiniview | Cold morning and clear ranges | Moonlit snow around the screen |
| Upstream | Low cream light from the left, milky falls | Silver falls against a shaded cliff |
| Kilo Bench | High white sun, short shadows, clear pool | Aurora over the pool |
| Agent Bridge | Pale overcast light | Moonset and stars on the tarn |
| Open models | Cream afternoon light | Cobalt overhead, silver horizon behind the columns |
| cc-switch | Low gold key and blue shade | Pale horizon light across the dam, violet in shadow |
| TensorPoW | Amber light across the banks | First rose light on the peaks |
| RydAR | Last sunlight at the rim | Rose horizon over the shaded canyon |
| Delta | Peach sky and pink ice | Warm dawn reflected in the sea |
| Ending | Setting sun | Rising sun |

The rows are in the order the hours were written, not the flight's:
each place carries its hour with it (`relaid` in `src/water/sky.ts`),
so down the river the day is no longer in order. Ask Around has no
hour of its own: it stands in the light between Kilo Bench's noon and
RydAR's last sun.

A new stop inherits its hour from its scroll position. To author a new
hour, add the stop to the day and night key sequences in
`src/water/sky.ts`. The interpolation carries key direction, fill,
water, haze and mist through the neighbouring hours. The visible sun
and the ground's shadow-casting key have separate elevations.

The engine integrates air density from the camera height once per
frame. Beyond the foreground, the valley air grows denser. Its onset
follows camera height. Ground and station shaders call `airLoss(t)`
at the hit distance and fade toward the directional horizon colour.
The lower mist layer favours water. The panorama stores range depth
for its own haze. A new object uses `inAir` for both its direct hit
and the full reflected path.
The block’s display and its spill rise together as its ice draws near.

The scene shader applies the vignette before the display curve. Both
themes share the same highlight shoulder and moving luminance grain.
Keep the scene sharp and the shore free of emissive outlines.

## Ice

The name plates, frozen lake, station objects and drift ice use
`clearIce` in `src/water/shaders/ice.ts`. It absorbs red first along
the ray through the solid. A mipmapped 512 × 1024 map holds shell-shaped
surface breaks, fracture facets, their lips and veils of air. The
shader samples it behind the face along the refracted ray. The front
surface carries the saw marks, wet sheen and glancing reflection.

For a station, call `iceGlacier` with the hit position, normal, view
ray, hit distance, local face coordinates, exit minus entry distance,
sky exposure, key exposure, broken-face fraction, distance to an edge
and a stable piece seed. It gathers the terrain or sky behind the ice
and the light at this hour, then calls `clearIce`. For a sheet with a
known bed, pass that backing directly to `clearIce`. The object owns
its intersection, snow cover, submerged shelf and reflected ray.
For a rough vertical wall backed by more ice, call `clearIce` with the
shaded wall as its backing and reflection. Map the air-rich layers in
world space, dip them along the cut and offset them across joints. Use
distance below the lip for the thin edge. Give direct reflection only
to fracture lips exposed to the key. The canyon uses the same inputs
for the wall in the river reflection.

For a thick exposed face, include its existing station feature in
`DEEP_ICE_FEATURES` in `shaders/stations.ts` and pass `true` as the
final argument to `iceGlacier`. The block and columns use this finish.
Their clear edges admit the horizon. Deeper in the chord, a second
fracture is sampled along the refracted ray at a different depth and
scale from the front inclusions. The display samples its image inside
its aperture. Past the 2500-unit fade plus one block width, its direct
intersection can be skipped. Opaque display pixels above the splash and clear of snow
and wear finish there. Only land and its grounded ice shelf receive
the block’s three-ray ground shadow.
The plate outline uses the same chipped distance for the
direct hit and its reflection. Frost clears toward a fresh arris.
Apply `inAir` over the complete camera path after shading.
The block and shard find their entry and exit by clipping the ray
against flat faces. When the first six faces leave an empty interval,
the remaining faces cannot contribute ice, shadow or reflection.

Measure a change at the composed stops and between them, including the
opening melt. At 1440 × 900 and DPR 2, the shared material's first pass
took 15.80–16.01 ms at the daylight opening across three sessions.
The standing name already requests the field shader. Compiling its ice
field for ground-level plates lets the driver omit the overhead lake
and cut-letter paths. The water on that same field also omits the
cut-letter glitter, pond and drifting chips. Inner-page lake shaders
and the water simulation select their own field from their uniforms.

With the water held and the three browsers rotating every ten measured
draws, the daylight opening measured 11.70–11.75 ms against its
14.96 ms ceiling. One screen in, it measured 16.50–16.58 ms against
21.24 ms. These are whole-frame times, including the synchronous read.
The daylight Agent Bridge and the transition at 23.5 screens before
dawn exceeded their ceilings in the route sweep. Repeating the same
draws in a different time window moved their means by 3.08 and 2.45 ms.

On the standing name, the sawn face scatters incident light before it
passes through the body. The extended form of `clearIce` takes a
saw-frost weight followed by a direct-reflection weight. Melt clears
the frost first at the feet.
The swept sheet darkens toward a steep view into the lake. Its glancing
reflection keeps the track of the sun or moon. Across the swept field,
the direct glint strengthens toward the far ice and the sides. The
snow fill under the hero copy fades off bare ice above the measured
text margin. Before dawn the wind-swept field has no snow dust or
drift. The underlying sheet samples its snow where it shows through.

The name must reach 4.5:1 by day and 3:1 before dawn. At 390, 768, 1440
and 1920 CSS pixels, hold full shading and render at 0, 0.25, 0.5, 0.75
and 1 screen. At each position hold the clock and render normally, with
`DBG_NO_NHIT`, and with `DBG_NO_NLOOK` plus `DBG_NO_NMIR`. The flat
render identifies the pixels covered by plates. At those same pixels
compare median linear-sRGB luminance in the normal and hidden renders,
using (lighter + 0.05) / (darker + 0.05). The historical diagnostic uses
DPR 2 through 1440 and DPR 1 at 1920. Inspect the first frames at DPR 2.

## Objects

One strong subject a frame. Real silhouettes with thickness, lit by
the hour's key and a rim, standing in the valley's air, with a
contact shadow or a true reflection. Text that a project owns
(a screen, a table) is drawn sharp at the size it is shown, squarely
enough to the eye to be read, whole inside the frame at every width.

## The DOM's surfaces

- No glass: no `backdrop-filter`, no translucent panels or cards.
  Controls that stand over the picture are **plates**
  (`.plate` in `src/app/globals.css`): solid, a hairline edge, a
  close shadow, corners at `--r-2`.
- Words stand on the picture's own calm ground (a lee the scene
  keeps under every block), never on a card.
- Inner pages stand on quiet snow (`.pg-ground` in
  `src/app/pages.css`): soft large forms, no grain, no band behind a
  heading.

Change log: 2026-11-18 first version (orchestrator).
