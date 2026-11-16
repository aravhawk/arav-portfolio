# aravjain.dev v4: design review

Five rounds by the build thread, then one independent critic. Captures for
every round are outside git in `~/.t3/portfolio-redesign-v4/rounds/<n>/`.
Each round asked the same questions: is it water and not jelly, is anything
covered, does anything lag or go soft, are the fonts premium, does a
stranger get who he is in five seconds, is the ending at least as good as
v2's, are both themes first class.

## Round 1: does the whole page exist and hold together

Captured: home at 1440 (light and dark), 390, 768 and 1920; /work, two
project pages, a post and the 404, at 1440 and 390.

| Finding | Fix |
|---|---|
| The ending's top-down water had a blotchy cell pattern that matched nothing above it | Replaced, then removed down to a faint fine shimmer, so the page's water hands over to the ending without a seam |
| Dark theme ending: the land went brown, because horizon haze was being mixed into it from straight above | Haze on land now scales with the tilt |
| "cc-switch" overflowed its column at display size | Project names are capped by their own column with a container query (`150cqw / longest word`), and the name uses a non-breaking hyphen |
| The statement left one orphaned word, and on phones wrapped to eleven short lines | `text-wrap: balance`, and its own size on phones |
| Inner pages ended on a pool sitting above a horizon, which read as two unrelated pictures | Inner pages drop the pool; the stream runs under the band, and the band's horizon is raised so its words stand on land |
| On project pages the stream crossed the row of live numbers to reach the project's bed | The bed gets a row of its own between the head and the body |
| Blog titles were set at full display width and weight and filled five lines | Long titles use width 100, weight 680 and a 20ch measure |
| The phone lake was a screen and a half of empty water | Shortened to 134svh |

## Round 2: material, close up

Captured at 2x device pixel ratio so the surfaces could be judged at the
size the owner will see them.

| Finding | Fix |
|---|---|
| The ice had a stitched, quilted bevel and read as inflated metal | The distance field is smoothed before normals are taken; the letter became a flat frosted face with a narrow clear bevel, a lit rim on the light side and a shaded one opposite |
| Mid-melt, the name left a grey blurred ghost of itself in the water. Blur is the one thing that must never appear | The melt no longer fogs the water. Meltwater lifts the water's own colour slightly where it runs and nothing else |
| The name went thin in the first third of the melt and was gone by 60% | Erosion is eased (`m^2.3`) and calibrated to the thickest stroke, so the name stays bold through the first half and the last slivers go at the very end |
| A hard-edged pale patch sat in the top left of every pool (the overhead light's reflection) | Softened to a wide, faint sheen |
| Land read as a flat pale ground in thumbnails, which is the complaint about v3 | A relief line milled parallel to every bank (inside the margin text keeps from water, so it never runs under a word), water colour thrown onto the bank beside it, stronger falloff from the key light, more grain |
| Dark theme: water was a milky grey blue and the slab had no visible material | Darker bed and bluer scatter so depth reads, stronger caustics, and the relief line's lit lip is added, since a multiply is invisible on a dark slab |
| Bank edges stair-stepped on diagonals | The bed field went from one texel per 4px to as fine as a memory budget allows (about 2.3px on a desktop) |
| Lighthouse desktop performance was 82: 400 ms of blocking at startup | Shaders compile one per task, the bed is carved once after fonts load, distance transforms moved to a worker: 100, with 0 ms blocking |
| Unlit statement words were at 26% opacity, 2.2 to 1 | A dim ink token that passes 3 to 1 as large text in both themes |
| At 200% text size the hero copy ran under the nav | The hero header has a minimum height, not a fixed one |

States checked this round: no WebGL (the static design: name in type on a
still basin, basins as CSS, sky as a gradient), reduced motion (two
screenshots 1.2 s apart are byte identical; every statement word lit; the
ending is one screen at its final pose), keyboard (skip link first, 2px ring
on every stop), forced colours, print.

## Round 3: motion and touch

Recorded: `home-scroll-1440.webm` and `home-touch-390.webm` with real touch
events (tap, drag, flick), plus a frame strip of the pointer crossing the
lake.

| Finding | Fix |
|---|---|
| The pointer's wake was almost invisible, which fails "a real fluid simulation reacting to the cursor" | Stronger displacement, the pointer treated as a moving body (trough ahead, bulge behind), more refraction and caustic focusing from the simulated surface, idle shimmer roughly doubled |
| Wake highlights broke into blocky dashes | Wider, softer threshold on the crest highlight |
| Raising the surface viscosity to remove grain turned the water into a checkerboard on the next build | That was a real stability failure in the explicit wave scheme. The constants are back inside the limit with margin, the result is clamped, and a unit test runs the same update on the CPU and fails if the limit is crossed |
| Home was at about 260 words by a strict count (every label, numeral and nav item) | Cut to 200 without losing a required fact; the "as of" stamp lives in each number's tooltip and on /work |
| Route changes were a hard cut | View transitions: the page lifts away and the next settles in while the water keeps running underneath; a project's name travels from its row to its page |

Touch results in emulation: tap splashes, drag and flick scroll natively,
the profile switch re-carves the bed on tap, the theme switch works, in
both mobile WebKit and Chromium profiles.

## Round 4: project pages

v3's project pages were its weakest part, and v2's were redirects.

| Finding | Fix |
|---|---|
| Only three project pages (the data-driven ones) had a bed of their own | Every project page now carries its own: Kilo Bench the flumes, Agent Bridge the two pools and the canal with the launch video on the bank, TensorPoW the grid, RydAR the bends, Infiniview the product on its island |
| The video used native controls, which look different in every browser | One control of our own; the video is not fetched until asked for and stops when it leaves the view |

Each project page is: way back, label, name, a statement-size summary, the
project's bed, live figures where they exist, titled steps for how it
works, real media, a ledger or table where there is data, facts, links out,
and the next project.

## Round 5: every browser, every width

92 page loads: Chromium, WebKit and Firefox at 320, 390, 768, 1024, 1440,
1920 and 2560, plus an iPhone profile in WebKit and a Pixel profile in
Chromium with touch. Checked by measurement on each: horizontal overflow,
text running outside the viewport, clipped text, console errors, the water
either running or cleanly off, fonts loaded.

| Finding | Fix |
|---|---|
| WebKit logged errors from its own native video control icons | Gone with the designed control |
| The overlap test, run at every width for the first time, failed at 320px: a repository name (one unbroken word) spilled out of its column into the stream lane | Row names wrap; the bed now measures a text block's ink as well as its box. Re-run: zero |
| Firefox warned about drawing without vertex attribute 0 | Every pass draws a real triangle bound to attribute 0 |

Results of the final gates are in the build's final report and in
`perf.md`.

## Independent critic

One fresh agent with no access to this thread's reasoning. It was given
only: the final captures (both themes, four widths, inner pages, the
close-ups and the motion strips), the reference captures (Igloo, Lando
Norris, Lusion, Apple, Cyera, Grail, Preymaker, and v2's ending and v3's
best frames), the three blind type sheets, and the owner's verbatim words.

_Scores before and after, and what was fixed, are recorded below once the
critic has run._
