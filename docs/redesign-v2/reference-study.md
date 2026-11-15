# Reference study (first-hand, Nov 14 2026)

Every site below was opened in Chrome for Testing (Playwright, GPU on, 1440x900, plus 390x844 for Igloo and Lando), scrolled with real wheel events, poked with the pointer, and fingerprinted (canvases, WebGL, three.js revision, fonts actually loaded, asset requests). Captures live in `references/<site>/` (`d-NN.jpg` desktop frames in scroll order, `m-NN.jpg` phone frames, `tech-d.json` fingerprint, `text-d.txt` visible copy). Scroll videos for Igloo and Lando are committed; the other videos are in `~/.t3/portfolio-redesign-v2/references/` to keep the repo small. `_igloo-sheet.jpg`, `_lando-sheet.jpg`, `_overview-a.jpg` and `_overview-b.jpg` are contact sheets.

## What I could not access
- **unseen.co**: loaded and rendered, but my wheel input never left the first room, so I only studied the opening scene.
- **bruno-simon.com**: stops at "click to start"; I studied the loader and the idle diorama, not the drive.
- **awwwards.com portfolio listing**: a menu overlay covered the grid. I used the Sites of the Day list instead and picked sites from it.
- **samdallyn.co** (picked from the SOTD list): did not resolve. Dropped.
- **labs.lusion.co**: the index and its cards, not the individual experiments.
- My wheel steps were too coarse for Lando and Jesper, so I hit the footer early. The frames cover every section, but the committed Lando video shows a lot of footer.

## The two pinnacles

### igloo.inc
Fingerprint: three.js r165, zero DOM text (the visible word count is 1). Every letter is drawn in WebGL from an MSDF atlas (`IBMPlexMono-Medium-datatexture.ktx2`, `msdfworker`). 21 Draco geometries, KTX2 textures, 3D volume textures for the particle figures, EXR scene captures.

What makes it world class:
1. **One world, three rooms, no cuts.** Mountain and igloo, then a ring portal, then a particle figure on a plinth. The camera never cuts; it pushes through fog, and the fog is the transition. The page is 900px tall. Scroll is a timeline, not a page.
2. **One palette, enforced everywhere.** Everything is the same cold grey blue. Glow is the only accent, and it comes from inside objects (light leaking between ice blocks).
3. **Depth is stacked, not implied.** Foreground rock, subject, mid ridge, far ridge, sky, each a step lighter. Screen-space chromatic fringing appears only while the camera moves.
4. **Text is a HUD, not a layout.** Four corners, about 12px mono, under 35 words on the first screen. Numbered callouts (23, 25, 31, 32) are pinned to the model with hairlines, so data lives on the object.
5. **The subject assembles itself.** Ice blocks float into place; the figure is thousands of small lit bodies. Nothing just fades in.
6. **Phone is the same film.** Same scene, re-framed for portrait, HUD stacked into the corners.

### landonorris.com
Fingerprint: three.js r174 (helmet GLBs, two studio HDRIs), Rive (21 canvases for small animated marks), Lenis. Fonts: Brier (display) and Mona Sans Variable. 542 visible words over 15 screens. Palette: lime `#d2ff00`, olive black `#282c20`, bone `#f4f4ed`.

What makes it world class:
1. **The hero is one interaction.** Portrait at full height; the pointer paints a soft-edged mask that swaps skin for the helmet render and its wireframe. One idea, instantly understood, impossible not to play with.
2. **Type tension inside a single line.** A thin, high-contrast serif and a heavy grotesque share a headline ("REDEFINING" / "LIMITS"). Size jumps from 93px display to 10px labels with almost nothing in between.
3. **Reveals have weight.** Lime blocks wipe across lines and leave the text behind; the signature draws as a stroke. Nothing fades.
4. **Dense and quiet alternate.** Full-bleed ticker type, then two small photos floating in an empty field, then a dark helmet wall, then a fanned stack of cards.
5. **Real data is art-directed.** The next race sits in a tiny tag-shaped card bottom left: track outline, name, a laurel. Data as an object, not a table.
6. **The footer is a poster.** A notched dark card inside a lime frame, the helmeted figure breaking its edge, navigation left and right of it, sponsors as a ticker.
7. **Nav is two buttons.** Wordmark top left, store and a two-line menu top right. The menu is the full navigation.

## The rest

| Site | Fingerprint | The technique worth learning |
| --- | --- | --- |
| lusion.co | three r158, matcap EXR, Aeonik + Plex Mono, canvas inside a rounded frame | A quiet white DOM frame around one loud canvas. Rigid bodies (cross shapes, three colours) that the pointer shoves; soft contact shadows. Later the astronaut flies down a tunnel of shards with heavy bloom and lens fringing. Loader is a block that fills while a counter runs. "Keep scrolling" at the footer carries you to the next page. |
| labs.lusion.co | three r138 | Experiments as dated cards with tiny mono metadata on a pale noise ground. Shows how to make an index feel like a lab shelf, one line each. |
| unseen.co | three r143, room GLBs, Saol Display + Neue Montreal | A stylised room standing in shallow water, with the reflection doing half the lighting work. One serif line over the scene. |
| kprverse.com | Nuxt, three r150, Hexaframe at 369px | Enormous type (369px, tracking -0.1em) rotated and cropped by the viewport; panels that change background colour per chapter. |
| jesperlandberg.com | three r185, KTX2 + Mux video textures | Work as curved WebGL panels on a faint grid floor in a black room; horizontal travel; the whole portfolio is one strip. |
| davidwhyte.com/experience | three r149, one `scene.glb`, Canela + Roobert, Lenis | Painted 3D landscape that dissolves between scenes with a brush mask; small poem text beside a large quiet subject. |
| bruno-simon.com | three r187 | A loading moment that is already the world (a lit diorama on a dark grid). |
| pangrampangram.com | no WebGL | Type specimens as posters; one typeface per tile, huge. Confidence through scale. |
| landdding.com, godly.website | Next / gallery | Used to survey current personal and studio sites; dense card grids are exactly what this build avoids. |
| activetheory.net | own engine (Hydra), matcap KTX2, NB Architekt | Dark world, bioluminescent particle masses with depth of field, glass cards. 40 words. Closest to this build's swarm, and the bar for particle quality. |
| dylanbrouwer.design | Webflow, GSAP 3.15 + SplitText, three r185, ABC Gravity at 288px | Variable-width display type slammed against the viewport edge ("SITES THAT MOVE"), a 3D badge hanging in the footer. |
| raviklaassens.com | Webflow, GSAP, one WebGL canvas, Replica + Reckless | Portrait with a heat-map shader; a footer that is one red word mark across the full width. |
| obys.agency | own WebGL, custom Obys faces | An index you scrub: one vertical filmstrip in the centre, project names left and right, one line each. |
| makemepulse.com | Nuxt, Lenis, Biotif + Beatrice Display | Light and heavy cuts of display type set on a staggered baseline; soft white 3D forms. |

## Decision map

| Decision in this build | Learned from | How it is not a copy |
| --- | --- | --- |
| One continuous world that scroll flies through, no section cuts | Igloo (rooms joined by fog) | A salt flat before dawn, not a mountain; the sky's time of day is the timeline |
| Scroll is a timeline: camera, formation and sun all keyed to it | Igloo, Lusion tunnel | Night to sunrise arc gives every beat a different sky |
| The subject assembles itself from small bodies | Igloo's blocks and particle figure, Active Theory's particle masses | The bodies are one swarm that persists all page long and rebuilds itself into each project |
| Depth in stacked layers: near bokeh, subject, far ridges, sky, plus a mirror of all of it | Igloo's ridges, Unseen's water | Planar reflection on thin water doubles every formation |
| Depth of field and lens fringing only where the camera moves | Igloo, Lusion | Bokeh is computed per particle from a focus distance keyed per beat |
| Corner HUD in small mono; almost no copy | Igloo (35 words on screen) | HUD carries a live countdown to first light instead of copyright lines |
| Numbers pinned to the 3D subject with hairlines | Igloo callouts, Lando's race card | Callouts carry real facts (74 entries, 14 strategies, 8 PRs) |
| Display type: two extremes of one family in the same line | Lando (Brier serif + grotesque), Dylan Brouwer (variable width), kprverse (scale) | Archivo's width axis: 62 thin against 125 black. No serif |
| Wipe reveals with weight, never fades | Lando's lime blocks | A flare-coloured bar sweeps and leaves the line; used once per beat |
| One hero interaction you cannot help trying | Lando's helmet mask, Lusion's shoved bodies | The pointer parts the swarm; in the Merlin beat you drag the engine and can flick it into a spin |
| Dense and quiet alternate | Lando | Monument beats (name, 1 of 74) alternate with busy ones (sandbox, markets) |
| Loading moment that is already the world | Bruno Simon, Lusion's counter, Lando's flat lime field | A counter of agents waking, then the swarm lifts off the horizon |
| Page transitions keep the canvas alive | Lusion "keep scrolling", Igloo fog | The swarm scatters and re-forms per route; DOM wipes with the flare bar |
| Nav is a wordmark and a tiny set of links; menu becomes a full panel on phones | Lando, Igloo | Links sit in the HUD corners |
| Archive as a one-line index, searchable | Obys index, Lusion Labs shelf | Rows only: name, line, kind, year. No cards, no thumbnails |
| Footer as a poster | Lando footer, Ravi Klaassens word mark | Sunrise, one line of display type, contacts as large links |
| Phone gets the same film, re-framed | Igloo mobile | Portrait camera poses per beat and a smaller swarm |
| Palette locked to one world | Igloo (ice), Lando (lime and olive) | Night ink, blue hour steel, one flare orange that only shows up where the sun or a finding is |
