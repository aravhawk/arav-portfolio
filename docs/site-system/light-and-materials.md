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
the ray through the solid. A mipmapped 512 × 1024 map holds shell-shaped surface breaks, fracture
facets, their lips and veils of air. The shader samples it behind the
face along the refracted ray. The front surface carries the saw marks,
wet sheen and glancing reflection.

For a station, call `iceGlacier` with the hit position, normal, view
ray, hit distance, local face coordinates, exit minus entry distance,
sky exposure, key exposure, broken-face fraction, distance to an edge
and a stable piece seed. It gathers the terrain or sky behind the ice
and the light at this hour, then calls `clearIce`. For a sheet with a
known bed, pass that backing directly to `clearIce`. The object owns
its intersection, snow cover, submerged shelf and reflected ray.
Apply `inAir` over the complete camera path after shading.

Measure a change at the composed stops and between them, including the
opening melt. At 1440 × 900 and DPR 2, the shared material's first pass
took 15.80–16.01 ms at the daylight opening across three sessions. Its
ceiling there is 14.96 ms.

The plates' faces should reach 4.5:1 by day and 3:1 before dawn against
the lake directly behind them, from rest through one screen of scroll.
Measure the same pixels with the plates hidden. Check 390, 768, 1440
and 1920 CSS pixels wide. The first pass misses both floors.

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
