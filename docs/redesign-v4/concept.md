# aravjain.dev v4: concept

Three concepts were worked up against the references (Igloo, Lando Norris,
Lusion, and the newer sites in `reference-study.md`) and against what the
owner said about v2 and v3. One was prototyped before the others were
written off, because the risk was technical, not rhetorical.

## What the concept has to do

From the owner's words:

- Liquid that is actually water, "literally flowing like water", bold and
  central, reacting to scroll and pointer. Not jelly, not a blob, not dots
  fleeing the cursor.
- His name in ice that melts as you scroll and becomes the water that turns
  into each project's visual.
- Nothing ever covers a name, a heading or copy.
- Never lag, never blur.
- 3D and immersive, no flat colour grounds. Light and dark, both first
  class.
- In five seconds: "AI and developer tooling builder".
- Keep v2's ending screen and v3's real project pages.

## Concept A: Meltwater (chosen)

The page is one machined mineral slab seen from straight above. A deep pool
is cut into its head, and the name sits in that pool as a block of ice.
Scrolling melts it. The meltwater leaves through an outlet and runs down a
channel milled through the whole page.

The channel is not drawn around the content: **the content carves it.** Every
text block is registered as dry land and raised out of the bed, so water can
only be where no word is. Each project then shapes the same water into its
own diagram, by the shape of the ground:

| Project | The bed | Why that shape |
|---|---|---|
| Infiniview | The real product UI on an island in a sealed basin, the water around it never still | A sandbox, under attack from every side |
| Upstream (T3 Code and others) | Seven tributaries, each as wide as its merged pull request count, joining the main stream | Merging upstream, literally |
| Kilo Bench | One header trough feeding parallel flumes of different reach | A benchmark: the same input down several lanes |
| Agent Bridge | Two round pools and a canal, ripples sent each way | Two peers and one inbox between them |
| Open models | Four basins whose areas are the four models' pull counts | Data as an object |
| cc-switch | A fork with three branches and real gates; picking a profile re-carves the bed and reroutes the flow | The product, as a thing you can do |
| TensorPoW | A 4 by 4 grid of cells the stream threads in order | A tensor |
| RydAR | Two tight bends back to back | The road it warns you about |

At the foot of the slab the stream opens into a body of water that fills the
right side of the view. There the camera, which has looked straight down for
the whole page, sinks and pitches up, and a horizon, a low sun and a sky
appear for the first and only time. That picture is v2's ending screen,
kept and rebuilt.

Why it is his and not a copy of Igloo: Igloo is ice as an object in a snowy
void, seen through a flying perspective camera, with a mono HUD. This is
water as a medium on an engineered table, seen from above like a site model
or a circuit board, where the ice exists only to become the stream. The
material story is "frozen, then shipped": the name is potential, the water
is the work.

Against the references:

- Igloo: one world, scroll as a timeline, a self-assembling subject. Met:
  one continuous bed, melt and ending scrubbed by scroll, the bed assembles
  each project's diagram. Not met: Igloo's free camera; v4's camera moves
  once, at the end, on purpose.
- Lando Norris: one irresistible hero interaction, data art-directed as
  objects, footer as poster. Met: the pointer drags a real wake through the
  lake and warms the ice where it rests; basins sized by pulls and
  tributaries sized by pull requests; the ending.
- Lusion: a quiet DOM frame around one loud canvas, per-chapter material
  propositions. Met: land is the quiet frame, and every chapter is a new
  proposition for the same material.
- Cyera: copy on solid objects of the world. Met by construction.

Risks, and how each was closed:

- A full-screen shader at full resolution is exactly what made v3 lag. The
  fluid runs at a third to a sixth of screen resolution; the one full-size
  pass does at most about fifteen texture reads and early-outs on land.
  Measured (perf.md): 16.7 ms at p95 and p99 on an M4 at 2880 x 2232.
- A top-down view can read as a flat map. Depth comes from parallax through
  the water to a terraced bed, bank shadows, caustics that sharpen with
  depth, a chamfered edge that catches a fixed key light, and a small
  perspective tilt away from the optical centre.
- Text registration can drift. The canvas is not fixed to the viewport: it
  is a strip that lives in the document and travels with it, so water and
  words stay registered even when the browser scrolls between frames.

## Concept B: Cold shelf (rejected)

A perspective flight along a glacier front: the name is carved into an ice
wall, calves into the sea as you scroll, and the camera follows the floes
past each project.

Closest to the friend's idea as spoken, and the most cinematic. Rejected
because it is Igloo's own subject, camera and palette, so it would be judged
as a copy and lose; because a perspective camera puts copy on top of the
scene, which is the complaint about v3; and because floes and ice walls need
authored models that a code-only build cannot make at that level.

## Concept C: Flume (rejected)

A test tank seen from the side, like a hydraulics lab: the name is a block
in the flow, streamlines bend around it, and each project is a test article
dropped into the tank.

It suits "agents that attack your app to prove what breaks" well. Rejected
because streamlines are particles and read as the banned cursor field the
moment the pointer comes near; because a side view of a tank is one long
horizontal band, which leaves most of a tall page empty; and because the ice
has nothing to do in it.

## Concept D: Core sample (rejected)

A vertical ice core drilled out of the page, melting from the top as you
scroll, with each project a layer in the core.

A clean scroll metaphor with a strong first frame. Rejected because it is a
single thin object in the middle of the screen, the opposite of bold and
central, and because once melted there is no water left to do anything.

## The loading moment

The page arrives as its static design: the name in the display face on a
still basin, readable immediately. When the engine is ready the water fades
in under it and the letters freeze: the type is replaced by the same
outlines cast in ice. If the engine never arrives (no WebGL2), nothing is
stuck: the static design is the page.
