# Concept

## Three concepts

### A. Proof of work
A chain of monolithic blocks hanging in a void. Each block is a project; the camera travels the chain and each block opens into a diorama. The name puns on TensorPoW and on what a portfolio is.

Against Igloo and Lando: the pun is good and the copy writes itself, but it is a gallery with better lighting. Seven dioramas means seven separate modelling jobs with no shared material, which is exactly where the last build went thin. Igloo wins by having one material and three rooms. Blocks of ice with things inside is also uncomfortably close to Igloo's own second scene. Rejected.

### B. Static fire
One rocket engine on a test stand. The site is a countdown; each project is a subsystem that lights up; the finale is ignition.

Against Igloo and Lando: it has a single iconic object like the helmet, which is the right instinct. But the Nov 9 build already put a Merlin 1D in the hero and Arav paused it. It also makes rockets the subject. Arav builds agents; rockets are something he is into. Rejected.

### C. First light (chosen)
The hour before sunrise on a flooded salt flat. A swarm of 65,536 lights is already out there working. They are the only actors on the site, and they build everything: his name as a monument standing in the water, then each flagship, one after another, flying from site to site while the camera flies with them. The sky moves from night to sunrise as you scroll. The last thing the swarm does is leave: it lifts off as one column toward the sun. The last line is "It's still early."

Why this one:
- It is him. He builds agents and the tools around them, so the agents build the site. Nothing is drawn by anything else.
- Ambition is felt, not stated. Scale (a name the size of a hangar, mirrored in water), a countdown, a launch, a sunrise, and one sentence that says the day has not started.
- One material, one world, like Igloo. One swarm, one sky, one sheet of water. Every beat reuses the same actors, so the quality bar is set once.
- The time of day is the scroll bar. Each beat gets its own sky for free, and the palette is never arbitrary.
- It is scrubbable. Formations are functions of scroll, so it runs forwards and backwards with no state to desync.

Honest risks, and what the build does about them:
- Particle morphs are a known trick. So the swarm is never dust in a void: it stands on water with a real planar reflection, under a sky with stars, cloud and ridgelines, with per-particle depth of field and fog. The lights also move with intent (code lines scanned, packets travelling an arc, branches merging), not just from shape to shape.
- Points can read as thin next to Igloo's solid ice. So formations are dense, close passes fill the lens with bokeh, and the water doubles everything.
- Sunrise palettes drift purple. This one runs ink blue to steel to flare orange to pale gold, with no violet.

## The world
- Ground: thin water over salt, a planar mirror with slow ripples and a faint crust pattern near the camera.
- Sky: an analytic dome keyed to time of day. Stars that fade, high cloud lit from below near sunrise, a sun that clears the ridge in the last beat.
- Ridges: three layers of far mountains, each lighter with distance.
- Swarm: 65,536 lights on desktop, 16,384 on phones. Each has a home in the current formation and the next; it flies between them on a staggered, curved path. Size and softness come from its distance to the focal plane.

## Beats

| # | Beat | What the swarm builds | Sky | Copy |
| --- | --- | --- | --- | --- |
| 0 | Load | A counter runs up to the swarm size while lights wake along the horizon | black | agent count |
| 1 | Name | ARAV as a monument, standing in the water | night, stars | I build AI agents and the tools around them. |
| 2 | Infiniview | A sandbox: a cage of light around a slab of code. Probes circle and cross it; found lines burn orange | deep blue | Infiniview. Agents that review, probe and stress-test your code in cloud sandboxes. |
| 3 | DeveloperWeek | 74 pillars in a field. 73 stay low. One goes up past the top of the frame | blue hour | 1st of 74. |
| 4 | agent-bridge | Two spheres and a bridge of arcs, packets crossing | steel, first warmth | Messages are data, never permission. |
| 5 | Upstream | Branch lines from everywhere converge into one trunk running to the horizon | horizon glow | 20 pull requests merged upstream. |
| 6 | Markets | A skyline of candles receding to the horizon, a forecast cone ahead of the last one | orange band | AlphaPredict and a bot that trades 14 strategies. |
| 7 | Merlin | A wireframe Merlin 1D. Drag to turn it, flick to spin it | gold edge | A SpaceX engine you spin with your bare hands. |
| 8 | First light | The swarm leaves as one column toward the sun | sunrise | It's still early. Contact. |

## Loading moment
Black. A single hairline for the horizon. A mono counter runs from 0 to 65,536 while the shaders compile and the formations are computed (the count is the real number of lights). Then the lights rise off the horizon and assemble the name while the HUD wipes in.

## Transitions
The canvas lives in the root layout and never unmounts. Leaving a page, a flare bar wipes the DOM and the swarm scatters; on the new page it settles into that page's formation: a low drifting field behind the archive and the blog so text stays readable.

## Type
Archivo variable. Display lines mix width 125 at weight 800 with width 62 at weight 300, so one headline holds both extremes. Geist Mono for the HUD at 11 to 12px. Nothing in between except one 18px line per beat.

## Colour
Ink `#04070c`, steel `#8fa3b8`, bone `#eef1ee`, flare `#ff5a1f`. The sky supplies everything else.

## Fallbacks
- No WebGL or reduced motion: every beat becomes a full-screen still rendered from the same scene, with the same copy over it. No flight, no scrub.
- Phone: same film, portrait camera poses, a quarter of the swarm, copy anchored to the bottom.

## What changed during the build
- The Merlin beat is a solid engine, not wire: brushed metal that mirrors the sky, with a plume that fires onto the water. The swarm lays it down from the nozzle up and stays on it as a faint scan.
- The merge beat is shot from above, so it reads as a graph.
- The finale is a launch arc that bends toward the sun.
- Headlines are revealed by a scanner line instead of a block wipe.
- Phone swarm is 21,609 lights (147 squared), not 16,384.
