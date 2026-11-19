# Light and materials

The hours and solid UI surfaces are in use. A single ice material for all objects is planned.

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
at the hit distance and fade toward the directional horizon colour. The lower mist layer favours
water. The panorama stores range depth for its own haze. A new object
uses `inAir` for both its direct hit and the full reflected path.
The block’s display and its spill rise together as its ice draws near.

The scene shader applies the vignette before the display curve. Both
themes share the same highlight shoulder and moving luminance grain.
Keep the scene sharp and the shore free of emissive outlines.

## The ice (planned: one function for every object)

Lake Baikal's ice: a clear body that glows blue-green where light
passes through it and is dark where it does not; a few white fracture
planes and veils of bubbles inside; sawn faces with fine saw marks,
broken faces with chipped glinting edges, never a rounded bevel;
Fresnel; wet and darker where water touches it; one true image in
still water. Every ice object on the page calls the same material.

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
