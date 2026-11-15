# Design review

Captures: `review/` in this folder (contact sheets), full set in `~/.t3/portfolio-redesign-v2/screenshots/`. Reference frames: `references/`.

## Self-review rounds

| Round | What I looked at | What was wrong | What changed |
| --- | --- | --- | --- |
| 1 | First render of all 8 beats at 1440 | Blown out: bloom plus additive lights turned every beat white. Subject shifted the wrong way. Water ripple tore the reflections | Light gain cut to under half, bloom threshold raised, ripple cut to a quarter, shift sign fixed |
| 2 | Same beats, plus flights, loader, index, post (`review/round2-flights-loader-pages.jpg`) | Dawn beats (5 to 8) were a bright peach wash, so lights and white type vanished. Sky drifted mauve. Market chart was tiny and cropped. Flights were a white-out | Sky rebuilt as three stops (horizon, mid, zenith), kept dusky to the end, warm band narrowed, clouds made darker rather than pink. Market, merge and finale reframed. Flight aperture cut |
| 3 | Phone at 390, reduced-motion version, steady scroll film (`review/round3-before-critique.jpg`) | Phone subjects were small. A white frame in the last flight. A flat-topped block in the ridges where the ring seam sat in view. Too little of the scroll spent on beats | Per-beat portrait pull-back, lights fade near the lens, seam moved behind the camera, hold raised from 32% to 42% of each segment, more labels pinned to the swarm |
| 4 | Side by side with Igloo `d-01`, `d-09` and Lando `d-02`, `d-13`; first independent critique | See below | See below |
| 5 | Second independent critique on the fixed build | See below | See below |

## Honest comparison with Igloo and Lando
- What holds up: one world with a time-of-day arc, a real mirror, a countdown HUD, type with two extremes in one line, a loader that is already the scene, phone framing that is composed rather than shrunk. Home is 132 words.
- Where it is behind Igloo: Igloo's objects are modelled, textured and lit; here only the Merlin is a solid surface, everything else is light. The ridges are procedural strips, not terrain.
- Where it is behind Lando: no face, no photography, no product footage. The brief's content rules and the lack of supplied assets mean the work is shown as metaphor.
- Would it win Site of the Day? Two independent reviewers both said no: 6.5 out of 10, Honorable Mention level. I agree with the direction of that score. It is clearly above the previous build and clearly below the two references.

## Independent critique 1 (fresh agent, saw only captures): 6.5 / 10
| Finding | Action |
| --- | --- |
| One look eight times: every beat is a particle wireframe over the lake | Merlin became a solid brushed-metal engine that mirrors the sky and fires a plume onto the water. Merge is now shot from above as a graph. Infiniview arrives wide and pushes in. Finale is a curved launch arc, not a second vertical beam |
| Type and 3D collide in most frames | Every beat got a reserved side and a soft shade pool under the copy; agent-bridge headline broken into three lines; Infiniview and hero copy moved to the top left; subject shifts retuned |
| Every transition is the same bokeh blizzard | Flight aperture cut by 92% at mid-flight, swirl and lift halved, stagger tightened so shapes re-form sooner, max bokeh size cut by a third, ambient haze halved. Still one kind of transition (see gaps) |
| Cheap environment: flat ridges, stair-stepped reflection | Ridges got gullies, a lit crest toward the sun and haze at the base. Reflection target raised from 0.6 to 0.85 scale and vertical ripple halved |
| Nothing real is shown | Not fixed. No screenshots or footage were supplied, and Infiniview claims are limited to infiniflop.com |
| Weak beats: stat said three times, filler line on trading | "First place out of 74 submissions" line removed. Trading line cut to five words; AlphaPredict and "14 strategies" moved onto the chart as labels |
| Almost no interaction | Pointer parallax and the swarm parting around the pointer already existed but do not show in stills. Merlin drag kept. No sound added |
| Hero and finale unfinished: dim V, purple fringe, "65,536 lights" label, "First light in first light" | Hero aperture cut so all four letters are sharp, edge fringing cut to a third, label removed, HUD reads "First light now" at the end |
| Orange block wipe is Lando's lime wipe | Replaced with a thin scanner line that reveals the headline |
| Phone: tiny name, text slab takes half the screen | Name now bleeds off both edges; headline sizes cut; subject shifted off the beam on beats 3 and 8 |

## Independent critique 2 (second fresh agent, fixed build): 6.5 / 10
| Finding | Action |
| --- | --- |
| Infiniview hold pushes the cube through the headline | Hold pulled back out of the cube and shifted right |
| Hero: dead sky, small tagline, cropped reflection | Horizon raised to mid-frame, full reflection in frame, tagline 25% larger |
| Finale reuses the beam from "1st of 74" | Launch path now arcs toward the sun |
| "OF74" reads without a space | Word spacing added to the condensed cut |
| Bokeh discs everywhere | Aperture down 30% globally, haze halved |
| One material, one transition, one lockup formula | Partly addressed (solid engine, top-down merge, xxl numerals). Remaining: see gaps |
| Static version missing headlines | Checked in a viewport capture: headlines are present. It was a full-page screenshot artefact |

## Known gaps
- Only one solid object. The sandbox, spheres and candles are still light.
- One transition type between beats.
- No portrait, product UI or footage.
- No sound.
- Callouts do not follow the engine when it is tilted, and are hidden on phones.
- Tested in Chrome for Testing on Metal only. Not tested in Safari, Firefox or on a real phone; phone captures are emulated.
- The second critique's "wallpaper lake" point about ridges is only partly answered; they are still strips, not terrain.

## Checks
- `pnpm lint`, `tsc --noEmit`, `pnpm build`: pass.
- Overflow: none at 390, 768, 1024, 1440, live and static, on home, index, blog, post and 404.
- Lighthouse, home, production build on localhost: desktop 97 / 100 / 96 / 100, mobile 98 / 100 / 96 / 100 (performance, accessibility, best practices, SEO). Best practices loses points for two 404s from Vercel's analytics scripts, which only exist on Vercel.
- JS on the wire per route: 149 kB before WebGL, 306 kB once the lazy three.js chunk loads. Static visitors never load it.
- 60fps measured during a steady scroll in headless Chrome on Metal.
- Reduced motion and no-WebGL: same DOM, stills rendered from the live scene.
- Blog editor: installed and started with `pnpm dev` in `blog-editor/`, opened `/edit/three-ai-agents-five-saas-products`, nothing saved. `git diff 9a487fb -- content/posts blog-editor` is empty.
