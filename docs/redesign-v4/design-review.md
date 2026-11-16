# aravjain.dev v4: design review

Five rounds by the build thread, then independent critics, each a fresh
agent that saw only captures. Their scores were low, so the rounds went on:
this file records every score as it was given. Captures for every round are
outside git in `~/.t3/portfolio-redesign-v4/rounds/<n>/`, and the critics'
full reviews in `~/.t3/portfolio-redesign-v4/critic/review-<n>.md`.
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

## Independent critics

Each critic was a fresh agent with no access to this thread's reasoning or
to the code. Each was given only: captures from a production build (both
themes, four widths, inner pages, 2x close-ups, the melt and wake strips),
the reference captures (Igloo, Lando Norris, Lusion, Apple, Cyera, Grail,
Preymaker, v2's ending and v3's best frames), and the owner's verbatim
words. Each had to quote text from named images first, as proof it could
see them. The first also ranked the three type systems blind before seeing
anything else (typography.md). The same ten questions each time; 8.5 was
defined as "would not look out of place beside the references".

| | Critic 1 (round 5 build) | Critic 2 (round 6 build) | Critic 3 (after K1 to K3) | Critic 4 (after K4 and K5) |
|---|---|---|---|---|
| a. Real flowing water, bold and central | 5 | 5.5 | 4.5 | 5 |
| b. Nothing covered or hard to read | 7 | 7 | 6 | 6 |
| c. Nothing soft or low resolution | 6 | 7 | 6.5 | 5 |
| d. Typography | 5 | 6.5 | 6.5 | 6.5 |
| e. Five-second read | 8.5 | 8 | 7.5 | 8 |
| f. Ending against v2's | 5.5 | 7 | 7.5 | 6 |
| g. Light and dark both first class | 6.5 | 6 | 5.5 | 4.5 |
| h. Project pages | 6.5 | 5.5 | 4 | 6 |
| i. Phone | 6 | 7 | 6.5 | 6 |
| j. Craft against the references | 4.5 | 5 | 5 | 5 |
| **Overall** | **5.5** | **5.8** | **5.5** | **5.8** |

Four different agents scored four different builds, so the columns are
not a controlled series: critic 3's 4 for project pages, for instance,
rests on a capture of mine that showed only the first and last screen of
each page, and critic 4 reported that its tooling cut the brief short and
could not open four of the reference images. What they have in common is
the useful part, and so is the plain fact of the bottom row: **four
independent scores between 5.5 and 5.8, against a target of 8.5.** The
build did not reach the target.

What all three said, in their words:

- The name: "embossed plastic or soap, a Photoshop layer style" (1),
  "chunky rounded extruded lettering ... 2000s 3D text, not ice" (2),
  "bevelled extrusion ... reads as WordArt" (3). Three materials, the same
  verdict.
- The water: "a caustics texture laid in a tray" (1), "a uniform
  swimming-pool caustic pattern ... in narrow plastic tubes" (2), "teal
  fill with one repeating caustic texture in carved channels" (3).
- The ground: "about 85% flat grey" (1), "a flat light-grey sheet" (2),
  "white paper ground with a faint noise texture" (3).
- Against Igloo, Lusion and Apple: "a tidy, original, above-average
  portfolio. Beside the references it looks like a clever diagram" (1).

What they said was good: nothing ever covers copy; the five-second read;
the copy's restraint; the stream as one continuous line; the open-source
comb where each branch is a real repository; "Dry land" for the 404; the
serif statement; and, by the third, the ending ("the dark ending is the
best frame in the build and beats v2").

## Round 6: the deep water pass (after critic 1)

Done in this thread before the work was split.

| Critic 1's finding | What changed |
|---|---|
| The name is not ice | A standing block with fracture planes, cut faces and a shadow (later replaced twice more) |
| The melt is a font-weight slider | The letters sink and clear instead of thinning (later replaced) |
| Most of the site is flat grey | An oblique camera so walls, waterline and bed read as depth; rivers about twice as wide; a lake from bank to bank |
| The water reads as a texture | Caustics from the summed curvature of every moving layer: one coherent net that tightens round a wake |
| The type is the weakest of the three and looks default | TASA Orbiter and Spline Sans Mono, the system the blind ranking put first, with a Newsreader accent |
| Empty pools where media should be | Pages without media no longer open on a pool; the stream runs in from the top |
| The ending is a downgrade from v2 | The wedge of land is gone; the words are set in the picture as v2 had them |
| The play button covers the video's caption | The control sits under the picture |
| The ending repeated under every inner page | A plain footer |

Found while doing it: the overlap test's check of the ending was vacuous
(it skipped every element marked as chrome, which is all of the ending's
text). It now hides the words, photographs the picture behind each line
three times in both themes, and fails any line under WCAG AA. That failed
the light ending at 1.6 to 1, which is why the light theme's ending became
a blue-hour dawn instead of a pale morning.

## Round 7: the water world, the ending, the type scale (after critic 2)

From here the implementation was done by Kilo Code from written briefs
(tasks K1, K2, K3) and reviewed in this thread from its captures, one task
at a time.

| Critic 2's finding | What changed |
|---|---|
| The pool: "a stock pool texture ... with stepped pool edges" | The terraces are gone; the bed shelves from clear shallows to a dark middle; glacial teal in place of pool blue; caustics that vary with depth |
| Flat grey background | Lit stone with a visible grain, a wet shore, natural banks |
| Tubes bent into icons; shapes that explain nothing | Kilo Bench is a pool with the benchmark's real results beside it; RydAR is one meander with the app inside its bends; cc-switch is three branches under the three options of its switch |
| The wake is a grey smudge | The foam veil is gone; the wake is ripples that bend the light, and a click sends a ring |
| Ragged, stair-stepped channel edges | Every land and water edge is antialiased from the distance field |
| Dark theme is daylight water on charcoal | Night water: a dark teal body and a luminous net in the shallows |
| Body copy tiny against the headings | Reading text 18px at 1440, sentences under project names 22px, and the whole scale grows with the screen past 1440 |
| A dead screen before the ending; the ending's flat mountains and hard sun; a clipped full stop | The ending's first frames are the page's own water; ranges with a lit side, haze and a reflection; the sun behind the ridge with bloom; the full stop fixed |
| Infiniview's image caught mid scroll | The composed hero frame |

Sent back to Kilo after review of K1 and K2 (task K3): the meltwater read
as grey fog and lingered; the melt ended in scattered fragments, worst on
phones; the dark theme's caustics were drawn as outlined shapes; the last
reach of open water was a flat field.

## Round 8: the frozen lake (after critic 3)

Three critics had given the same top finding in three builds of it: the
name as raised letters reads as a text effect whatever it is made of.
Tuning that was stopped, and the picture was changed (Kilo tasks K4 and
K5).

| Critic 3's finding | What changed |
|---|---|
| The name: "bevelled extrusion ... an offset ghost beneath" | The lake is covered by a sheet of lake ice and the name is cut through it. The letters are live water seen through the ice, with the cut's wall and the sheet's shadow giving it depth. The raised block and its shadow are gone |
| The melt "thins and cross-fades" | The sheet melts: openings grow from the letters, leads open along the cracks, the sheet becomes a few large floes that shrink and drift to the outlet, then open water |
| Body water: "teal fill with one repeating caustic texture" | Runs and pools are different water: threads of current in the runs, deep calm pools, a lit edge, no repeated pattern from reach to reach |
| Dark: "flat charcoal ground" | The dark slab catches light; the water spills a little cool light onto the stone beside it |
| Light ending: "posterised glints"; "teal pool jump-cuts to purple sea" | A soft sun path; the water's colour travels from the page's teal to the sea across the lift |
| "A grey band right of the pipe"; "the same pipe on every inner page" | The band is gone; the stream wanders inside its lane |
| The nav pill over copy as it scrolls under | The nav leaves when the page scrolls down and returns on the way up |
| The wake as "a thin cartoon outline" | Drawn by shading only |

Sent back after review of K4 (task K5): in dark theme the ice sheet was as
bright as in light; the light ice read soft, like cloud; the middle of the
melt had crenellated floes and one cut by a straight line; a crease and
faint terracing showed in the stream bed.

## Round 9: the last fixes (after critic 4)

Critic 4's worst findings were real and specific, so one more task went
to Kilo (K6): the dark hero's name "barely legible ... camouflage"
(now the reverse of the light hero: dark ice, the name glowing as lit
water); stepped edges on the ice at 2x; cracks cutting the name apart in
the first half of the melt; a wake that had become too faint; a screen of
plain water after the melt; an abrupt colour change into the dark ending;
halos round dark channels; an empty spinner image on the Kilo Bench page.
The Open Graph cards, which still drew the first build's look, were
redrawn in the same task.

_K6's result and the closing score are recorded below._
