# Carry-over from v2 and v3

What v4 keeps, reworks or kills from the two earlier builds, section by section, followed by three dossiers: the v2 ending screen, the v3 project pages and archive, and spacing.

## Sources

| | v2 "First light" | v3 "One drop" |
|---|---|---|
| Worktree (read only) | `~/.t3/worktrees/arav-portfolio/redesign-fable-v2-20261114` | `~/.t3/worktrees/arav-portfolio/redesign-fable-v3-20261114` |
| Head | `546b01c` | `d1e3410` |
| Production build studied | `http://localhost:3113` | `http://localhost:3123` |
| Renderer | three.js: 65,536 point lights, sky dome, ridge rings, planar mirror, bloom | raw WebGL2: one full-screen raymarched glass body |

All file paths below are relative to the worktree named in the heading of the table they sit in. Line numbers are from the heads above.

Captures are outside git in `~/.t3/portfolio-redesign-v4/v2v3/<v2|v3>/<browser>-<width>/<page>-<nn>.jpg`. Each folder has a `_frames.json` that maps every file to what it shows, the scroll offset, and the canvas backing-store width at that moment. Contact sheets are in `~/.t3/portfolio-redesign-v4/v2v3/_sheets/`. One Chromium home scroll video per site: `v2/chromium-1440/home-scroll.webm` and `v3/chromium-1440/home-scroll.webm`. Capture folders: `chromium-1440`, `webkit-1440`, `chromium-390`, `webkit-390` under each of `v2/` and `v3/` (1440 x 900 at 2x; 390 x 844 at 3x with touch). Frame names quoted in this document (for example `v3/chromium-1440/home-01.jpg`) are relative to `~/.t3/portfolio-redesign-v4/v2v3/`.

## Verdict rules

- KILL is used only where the section hits one of the owner's stated complaints. The complaint is quoted.
- KEEP says exactly what survives.
- REWORK says exactly what changes. Anything I would cut on my own judgment, without an owner complaint behind it, is listed as REWORK with the cut spelled out.
- Both type systems are dead everywhere ("Both of them have absolute shit fonts"). Every row below assumes new type; it is not repeated per row.

## v2 "First light": every section

### Site-wide

| Section | What it is | Verdict | Reason |
|---|---|---|---|
| Boot decision before first paint | Inline script in `src/app/layout.tsx:28` sets `data-world` to `live` or `static` (no WebGL2, reduced motion, or `?static`) before anything renders | KEEP | Keep the pattern: one attribute on `<html>`, decided before paint, drives the whole fallback in CSS. No flash, no hydration mismatch. |
| Static version | With `data-world="static"` each beat becomes a normal 100svh section over a still rendered from the live scene (`src/app/globals.css:182-188`, stills in `public/stills`) | KEEP | Keep the rule that the fallback is the same DOM and the same words over stills taken from the real scene. v4 needs new stills. |
| Loader | Full-screen ink sheet with a count of lights waking up, a hairline bar and "Agents awake" (`src/components/shell/Shell.tsx:32-62`, `globals.css:44-52`) | REWORK | Keep the pacing rule in `Shell.tsx:40-43` (never faster than the eye can read, never slower than the real load). Drop the particle count and the copy: there is no swarm in v4. The loader state must not sit in React state. |
| Nav | Stacked two-weight name mark top left, three mono links top right, no backing (`Shell.tsx:115-125`, `globals.css:61-70`) | REWORK | The bare, wide-set layout is one of the bold things about v2. It has no backing, so on /work and the post it prints straight over rows and prose (`v2/chromium-1440/work-03.jpg`, `work-07.jpg`). v4 keeps the corners-of-the-frame placement on the home page and gives the nav a dry plate to sit on wherever content scrolls under it. |
| Mobile menu | Full-screen ink sheet at 90% with an 18px backdrop blur, 15vw links that rise in with a 60ms stagger (`globals.css:77-83`) | REWORK | Keep the size and the stagger. Remove the backdrop blur over a live canvas (see perf.md). |
| Route cover | Ink sheet with a 3px flare edge that rises, holds, then leaves. Navigation waits 470ms for it (`Shell.tsx:86-103`, `globals.css:54-59`) | REWORK | Replace with v3's shared-element view transitions. A curtain that delays every click by half a second reads as slow. |
| Smooth scroll | Lenis, `lerp: 0.11`, wheel only, loaded only in live mode (`Shell.tsx:73-84`) | REWORK | Keep Lenis but drive it from the single frame loop. v2 runs it on its own requestAnimationFrame loop next to two others. |
| Type system | Archivo variable (width 62 to 125) plus Geist Mono (`layout.tsx:9-10`, `globals.css:35-37`) | KILL | "Both of them have absolute shit fonts." |
| Colour tokens | Ink `#04070c`, bone `#eef1ee`, steel `#9db0c4`, dim `#6f8296`, flare `#ff5a1f`, line at 16% bone (`globals.css:3-16`) | REWORK | Dark only. v4 needs light and dark. The restraint (one accent, used for 1px and 2px marks only) carries over. |
| Fixed-stage scroll model | Beats are fixed full-screen stages switched by scroll, 200svh per beat, 42% of each segment is a hold and 58% is flight (`globals.css:108-114`, `src/world/beats.ts:49`, `Story.tsx:28-46`) | REWORK | 15.7 screens of scroll for eight beats, more than half of it between beats. v4 scrolls real content on land; the water moves with it. |
| Keyboard focus brings a beat on screen | Focusing a link inside an off-screen beat scrolls to that beat (`Story.tsx:76-80`) | KEEP | Keep it wherever scroll position decides what is visible. |

### Home, top to bottom

| Section | What it is | Verdict | Reason |
|---|---|---|---|
| Beat 1, hero | The first name in 65k lights standing on a mirror of water with its full reflection, night sky, tagline top left in two weights (`v2/chromium-1440/home-02.jpg`) | REWORK | The composition is strong: one word, a horizon, a true reflection, a lot of empty sky. The material is the problem. v4 keeps "the name is a physical object in the scene" and makes it ice on the bed. |
| Cursor repel on the swarm | A ray from the pointer pushes lights away inside a soft radius (`src/world/shaders.ts:139-141`, `src/world/engine.ts:222-224` and `244-245`, `src/world/World.tsx:39-42`). Visible as a bite out of the R in `v2/chromium-1440/home-repel-01.jpg` and a kink in the light column in `ending-hover-07.jpg` | KILL | "having a bunch of particles, and when you hover, it has a circle part around your cursor where the particles go away from it. That's a classic AI design these days [...] That's horrible." |
| The particle swarm as the material of every subject | 256 x 256 lights (147 x 147 on phones) morphing between ten formations (`src/world/formations.ts`) | KILL | Same complaint. The swarm and the repel are one effect. Also the first critic's top finding: "One look eight times". |
| Pointer parallax | Camera shifts up to 2.2% of the subject distance with the pointer (`engine.ts:227`) | REWORK | Not the repel, and not complained about. In a top-down v4 it becomes a small shift of the light direction, not a camera move. |
| Beat 2, Infiniview | Kicker, two-weight headline at 180px, one line, one link, top left; a sandbox cube of lights on the right; two labels pinned to it (`home-06.jpg`) | REWORK | Keep the copy lockup (kicker with a 22px flare rule, headline, one sentence, one link). The subject becomes the stream shaping itself. Note the second critic found the cube pushing through the headline. |
| Beat 3, "1st of 74" | A numeral at up to 21vw, bottom right, beside a beam of light | REWORK | This is the "bit more bold" side of v2: a single stat set as large as the viewport allows. Keep that scale for real numbers. The beam goes. |
| Beat 4, agent-bridge | Three-line headline "Messages are data. Never permission." and two light nodes with a bridge | REWORK | Keep the headline as the project's quote. Subject is redone in water. |
| Beat 5, upstream | "20 merged upstream", shot from above as a graph of branches folding into main | REWORK | The only top-down beat, and the closest thing in v2 to v4's viewpoint: branches as streams joining a main channel is directly reusable. |
| Beat 6, markets | "The bot trades." with a candle chart in lights | REWORK | Content decision belongs to the v4 content pass. The chart-in-lights goes with the swarm. |
| Beat 7, Merlin | Solid brushed-metal engine built in code, a drag pad that spins it, a plume on the water (`src/world/solid.ts`, `Story.tsx:67-73`) | KILL | "The Merlin engine thing that was just a quick demo I made: why the fuck is that included on the page?" Not a feature in v4. It may appear once as an archive row. |
| Flights between beats | Staggered departure of every light with swirl and lift, aperture pulled (`shaders.ts:129-136`, `engine.ts:192-199`) | KILL | Part of the particle effect ("a bunch of particles"). Both critics called it a "bokeh blizzard". |
| Callouts pinned to the subject | Mono labels with a 7px ring and a 62px leader line, projected from 3D each frame (`Story.tsx:55-63`, `globals.css:169-177`) | REWORK | Annotation on a technical drawing suits a machined bed. Redo as labels engraved on land next to the water, not projected over it. Hidden on phones in v2; v4 must show them. |
| Shade pool and text shadow | A radial dark gradient under each copy block and a 22px text shadow so type survives the lights (`globals.css:88`, `121-124`) | KILL | It exists only because the effect runs under the words. v4's rule that all text sits on dry land removes the need. Hits "the liquid blob jelly thingy will cover up the actual name or critical parts of it" in spirit: no patching text over effects. |
| Headline scan reveal | Each headline line wipes in behind a 3px flare bar over 900ms, 110ms per line; kicker, sentence and link follow at 60, 420 and 520ms (`globals.css:127-138`) | KEEP | Keep the mechanism and the timings: clip-path wipe, one lead element, staggered support. It is cheap (no filters) and it is one of the polished moments. |
| HUD | Bottom edge: "01 / 08" and beat label left, "First light in 47:00" countdown right, 2px flare progress bar (`Story.tsx:47-54`, `globals.css:160-167`) | REWORK | Keep a quiet mono readout on the bottom edge and the 2px progress bar. The countdown belongs to the sunrise story and stays only if v4 keeps a time-of-day arc. |
| Scroll cue | "Scroll" with a 26px falling hairline, appears 3.2s after load (`globals.css:145-149`) | REWORK | Keep small and late. Hide after first scroll. |
| Time-of-day arc | Sky runs from night at the top of the page to first light at the bottom through six colour keys (`engine.ts:34-47`) | REWORK | This is why the ending lands: the page earns the sunrise. v4 views the bed from above, so the arc becomes light angle and colour temperature on the water along the scroll, resolving at the ending. |
| Post chain | Bloom, speed-driven chromatic fringe, vignette, ACES, gamma, grain (`shaders.ts:177-194`, `engine.ts:146-152`) | REWORK | Keep ACES, the grain and a light vignette, all inside the final shader pass. Drop the fringe that grows with camera speed. |
| Beat 8, ending | "It's still early." with contact links over a sunrise on water | KEEP | "the ending screen thing that looks like it came straight out of Mac OS's peak design engineers". See the dossier. |

### /work, /blog, post, 404

| Section | What it is | Verdict | Reason |
|---|---|---|---|
| /work header | "The index" at 158px in two weights, bottom of a 62svh band over the calm scene, a mono meta row (`src/app/work/page.tsx:15-20`, `globals.css:191-194`) | REWORK | Bold and clean. Keep the scale and the single meta row. |
| /work sheet | Ink panel with a 14px backdrop blur that covers the world as you scroll (`globals.css:195`) | REWORK | Keep "content sits on its own opaque surface". No backdrop blur over the canvas. |
| /work search and chips | Underlined search field with a live "n of 48" count, eight pill filters (`src/components/work/Index.tsx:19-31`, `globals.css:200-209`) | REWORK | Merge into v3's archive tools. Keep the live count inside the field. |
| /work rows | 48 rows: year, name, one line, kind, arrow. Every row is an external link or not a link (`Index.tsx:32-49`) | KILL | "V2's project page was horrible. It literally just had redirects." The row grid itself (5ch, 22ch, 1fr, 15ch, 22px) is clean and feeds the v4 archive. |
| Sheet footer | "It's still early." at 100px with the four contact links, text only, on ink (`src/components/shell/Foot.tsx`, `globals.css:270-272`) | KEEP | Keep the idea that every inner page ends on the ending. In v2 it is only the words. In v4 it is a compact version of the real scene. |
| /blog index | Title, description and date as full-width rows with hairlines (`src/app/blog/page.tsx`, `globals.css:231-238`) | REWORK | Clean. With one post it reads as empty (`v2/chromium-1440/blog-01.jpg`). |
| Blog post | 52svh title band, then a 68ch column at 18px / 1.68 (`src/app/blog/[slug]/page.tsx`, `globals.css:239-267`) | KEEP | Keep the measure (68ch, 701px at 1440), the 18px body, the spacing scale inside prose and the flare-underlined links. New type. Blog content and editor are untouched. |
| 404 | "Nothing out here." centred with one link (`src/components/shell/Lost.tsx`) | REWORK | Fine and short. Needs the v4 scene. |

## v3 "One drop": every section

### Site-wide

| Section | What it is | Verdict | Reason |
|---|---|---|---|
| Flat colour grounds | Four full-page grounds (cloud `#e8ecef`, signal `#ff4b14`, ink `#0a0c0f`, cobalt `#1433ff`) that switch per project, with three soft colour fields drifting over them (`src/stage/stage.ts:10-18`, `src/app/globals.css:107-131`) | KILL | Owner clarification: "No flat colour backgrounds in v4". |
| The drop | One raymarched glass body with twelve forms, drawn on a fixed full-screen canvas above the type (`src/gl/shader.ts`, `src/gl/engine.ts`, `globals.css:133`) | KILL | "no 'drop' concept"; "it feels more like Jelly". |
| Jelly behaviour | Idle surface wobble, stretch with scroll velocity, a pulse when tapped, five orbiting satellite droplets (`shader.ts:195-197`, `206-207`, `210-219`) | KILL | "the drop concept and its jelly behaviour"; "liquid must read as real flowing water". |
| The drop over type | The canvas is `z-index: 2`, the display type is `z-index: 1` (`globals.css:133`, `161`). The drop is placed on the words on purpose so it can refract them | KILL | "the liquid blob jelly thingy will cover up the actual name or critical parts of it". Frames are listed after this table. |
| Quality governor | Four resolution tiers that only ever step down, then a give-up to a CSS blob (`engine.ts:6-11`, `271-282`) | KILL | "it'll actually start lagging for some reason and get the animations blurry and lower quality". See perf.md. |
| CSS fallback drop | A fixed blob with a 10px backdrop blur shown when WebGL is off or has given up (`globals.css:139-152`) | KILL | Same complaint. It is fixed to the viewport and does not scroll away, so after a give-up it sits on content on every page (`v3/chromium-1440/work-archive-03.jpg`). |
| Grain overlay | Full-viewport SVG noise at 7% with `mix-blend-mode: overlay` on top of everything (`globals.css:154-157`) | KILL | Lag: a blended full-screen layer over a canvas that repaints every frame. v4 puts grain inside the shader. |
| Glass panes | Every card, the nav and the readouts: tint, 22px backdrop blur, eight-part shadow, conic rim light that follows the pointer, and in Chromium an SVG displacement filter per pane (`src/components/Glass.tsx`, `globals.css:165-205`) | REWORK | The nav pill and the readout row are among the "clean and modern" moments. The material is not: critics scored the DOM panes 5 out of 10 ("white cards on light grounds"), and 24 backdrop filters over a live canvas are a measured cost. In v4 these are opaque machined plates on land: same radii and spacing, no backdrop filter, a fixed light. |
| Nav | Centred pill: name with a dot, three links, 44px targets, current page as an inset chip, steps aside on scroll down and returns on scroll up (`src/components/Nav.tsx`, `globals.css:242-258`) | KEEP | Keep the structure, the sizes (56px tall, 6px inner padding, 44px items) and the hide-on-scroll behaviour. Rework the material as above. Move the scroll handler out of React state. |
| Mobile menu | Full-screen frosted sheet, 40px links with a small note each (`globals.css:259-269`) | REWORK | Both critics called it plain. |
| View transitions | React `ViewTransition` with a shared title between list row, home word and page title; old page leaves in 150ms before the new one arrives (`globals.css:554-567`) | KEEP | Keep the shared-title morph and the timings. |
| Motion tokens and springs | One file of spring presets, easings and durations mirrored in CSS, and a small `Spring` class with substeps that keeps velocity when retargeted (`src/lib/motion.ts`) | KEEP | Keep the file nearly as is. It is the cleanest module in either build. |
| Magnetic buttons | Elements marked `data-magnet` lean toward the pointer on a spring (`src/lib/magnet.ts`) | REWORK | Not complained about, but it is a pointer-proximity effect in the same family as the repel. Cut to press feedback and a plain hover, and it stops being its own animation loop. |
| Type system | Archivo 800 at 125% width for display, Geist Mono for numbers | KILL | "The V3 has slightly better fonts, but both fonts are basically shitty". |
| Real numbers | `Counter` prints the value and never counts up through false numbers (`src/components/Counter.tsx`) | KEEP | Keep the rule. |
| Accessibility fallbacks | Solid panes under reduced transparency and high contrast, a designed still state under reduced motion (`globals.css:207-216`, `569-584`) | KEEP | Keep all three media queries and the idea of a designed still. |

### Home, top to bottom

| Section | What it is | Verdict | Reason |
|---|---|---|---|
| Loader | A three-digit mono counter top left driven by fonts and shader readiness (`src/components/home/Home.tsx:243-287`) | REWORK | Honest and small. It calls `setLoad` every frame, which re-renders the whole home tree during the most expensive second of the page. Write to a text node instead. |
| Hero | The name on two lines at 306px, the drop on top of it, one sentence bottom left, four number readouts bottom right (`v3/chromium-1440/home-01.jpg`) | REWORK | Keep the scale of the name, the one sentence, and the readout row (real numbers, tabular figures, a short label each, 8px gaps). The drop sitting on the name is a KILL: "will cover up the actual name". |
| Flagship beat, Infiniview | Word at up to 40svh on a signal-orange ground, lens form, pane bottom left | REWORK | Keep word plus one small pane with one sentence, two chips and two buttons. Ground and form go. |
| Flagship beat, Open source | Two-line word on ink, merge form, pane with two stats and a PR title | REWORK | Keep the two stats and the real PR title. |
| Flagship beat, Kilo Bench | Word bottom left on cloud, bars form, pane top right | REWORK | Same. |
| Flagship beat, Agent Bridge | Word on cobalt, bridge form, pane with the launch video | REWORK | Keep the video: it is the only real footage on either site. The pane and the form both sit on the word here (`home-23.jpg` to `home-27.jpg`). |
| Flagship beat, Open models | "18,284" as the word, stack form, pane listing four models with pulls | REWORK | A number as the headline is strong. Keep with the live metric. |
| Flagship beat, cc-switch | Word on signal, toggle form you can tap, pane with npm downloads | REWORK | Keep the idea that one visual is operable. |
| Flagship beat, TensorPoW | Word on cloud, lattice form | REWORK | Same. |
| Flagship beat, Merlin | Word on ink, engine form with a plume tied to scroll speed | KILL | "The Merlin engine thing that was just a quick demo I made: why the fuck is that included on the page?" |
| Beat entrances | Seven entrance kinds for the words (rise, left, zoom, split, wide, fall, fill), panes blur in from 12px (`globals.css:303-321`) | REWORK | Keep the overlap rule from review round 3 (next title arrives at 72%, previous leaves at 45%, so type is always on screen). Use one or two entrance kinds, and no animated `filter: blur` on anything that contains a pane. |
| Type lean | Display type skews up to a few degrees with scroll velocity (`Home.tsx:327`, `346`) | KILL | Part of "the drop concept and its jelly behaviour": type that wobbles with speed is the same jelly. |
| More | Five project chips, "All work", a one-line press quote on cobalt (`Home.tsx:441-479`) | REWORK | Keep the press quote. Chips that link to an anchor on /work are weak; link to real pages. |
| Closing statement and contact | A seven-word quote at 166px that lights up word by word, then four buttons and the drop (`Home.tsx:353-361`, `481-514`) | REWORK | Replaced by the v2 ending. The word-by-word light-up can move to the ending headline. The drop covers "shipping" on the way in (`home-58.jpg`). |

### /work, project pages, /blog, post, 404

| Section | What it is | Verdict | Reason |
|---|---|---|---|
| /work header | "Work" at 234px with a glass slab beside it, one lede line | REWORK | Keep title plus one line. Slab goes with the drop. |
| Featured rows | Nine rows: number, name at up to 64px, one line, round arrow button; the whole row is a link to a detail page (`src/components/work/WorkIndex.tsx:23-43`, `globals.css:409-428`) | KEEP | "For the V3 project pages and archive style, it is way better to have pages for projects". Keep the row anatomy, the 104px row height, the 12px slide on hover and the arrow that fills and turns 45 degrees. |
| Row hover preview | Hovering a row morphs the drop into that project's form and docks it at the right edge (`WorkIndex.tsx:28-30`, `stage.ts:173-185`) | REWORK | The idea carries straight over: hovering a row makes the stream take that project's shape in the margin, never over the rows. |
| "Also" cards | Seven glass cards with a title, two or three lines, an optional award note and link buttons (`WorkIndex.tsx:45-69`) | REWORK | Useful middle tier between featured and archive. Opaque plates, and each should become a real page or drop to the archive. |
| Archive | Search, kind filters, compact rows: name, text, year, kind (`WorkIndex.tsx:71-137`) | KEEP | "V3 project pages and archive style". See the dossier. |
| Project detail pages | `/work/[slug]`: back link, numbered kicker, title, lede, a body pane, a facts pane, optional stats, next project (`src/app/work/[slug]/page.tsx`) | KEEP | "it is way better to have pages for projects and information about them, and then you can go into their main websites". See the dossier for what is thin. |
| Page footer strip | One 92px row: copyright left, five text links right (`src/components/Footer.tsx`, `globals.css:543-546`) | REWORK | Clean but forgettable. Inner pages should end on a compact version of the ending instead. Keep RSS in it. |
| /blog index | "Blog" at 234px with the slab over it, search and tag filters, posts as wide feature cards (`src/components/blog/BlogIndex.tsx`) | REWORK | Keep the feature-row card (date and reading time, title left, description and tags right). The slab over the heading is a KILL: owner named "the blog" as a place where the blob covers the name (`v3/chromium-1440/blog-01.jpg`). |
| Blog post | 760px column: back link, date, title at 72px, description, tags, then the prose inside one pane with 48px padding (`src/app/blog/[slug]/page.tsx`) | REWORK | Keep the header stack and the column. Prose inside a translucent pane is 5,168px of backdrop filter; make it a plain dry surface. |
| 404 | "404" at 46svh on ink with a cracked form, two buttons | REWORK | Keep word, one sentence, two actions. |

### Where the v3 effect covers names and headings

Evidence for the KILL. All frames are in `v3/chromium-1440/` unless noted; the same happens in the other three capture sets.

| Frames | What is covered |
|---|---|
| `home-01.jpg` to `home-03.jpg` | The drop sits on the end of both lines of the owner's name. Only "Ara" and "Ja" are readable. |
| `home-05.jpg` to `home-08.jpg` | The lens covers the "ie" in Infiniview. |
| `home-11.jpg` to `home-14.jpg` | The merge form and then the pane cover the end of "source". |
| `home-18.jpg` to `home-21.jpg` | The bars cover the "ch" in "Bench". |
| `home-23.jpg` to `home-27.jpg` | The bridge form and the video pane together cover "Bridge". |
| `home-28.jpg`, `home-29.jpg` | The stack form sits on the last digits of "18,284". |
| `home-36.jpg` to `home-39.jpg` | The toggle covers "cc-" and then "itc" in "switch". |
| `home-41.jpg` to `home-44.jpg` | The lattice covers "rPo" in "TensorPoW". |
| `home-48.jpg` to `home-52.jpg` | The engine bell covers "rl" in "Merlin". |
| `home-58.jpg` | The drop covers "ing" in "shipping". |
| `blog-01.jpg` | The slab covers "lo" in "Blog". |
| `project-agent-bridge-01.jpg` | A satellite droplet sits on the final "e" of the page title. |
| `v3/webkit-1440/project-open-source-01.jpg`, `project-kilo-bench-01.jpg`, `project-open-models-01.jpg` | The parked form covers the last letters of three project page titles. |
| `work-archive-03.jpg` | After the engine gave up, the CSS fallback blob covers the archive filters and the year column. |
| `v3/webkit-390/home-01.jpg` | Phone hero: the drop covers the middle of both lines of the name. |
| `v3/webkit-390/work-01.jpg`, `blog-01.jpg` | Phone: the slab covers "rk" in "Work" and "og" in "Blog". |
| `v3/webkit-390/project-merlin-control-01.jpg` | Phone: the form sits on the "t" of the page title. |
| `v3/webkit-390/home-58.jpg` | Phone: a droplet sits inside "software" in the closing line. |

The first critique of v3 already reported this ("Glass crossed titles and the 18,284 figure at rest; on mobile it buried them") and it was repositioned beat by beat. It cannot be fixed by repositioning, because the concept is a body that refracts the type it sits on. v4's rule has to be structural: the effect and the text never share pixels.

## Dossier A: the v2 ending screen

The frame the owner means is the last beat of the v2 home page: `v2/chromium-1440/ending-03.jpg`. Full set: `ending-enter-01..10` (entrance), `ending-01..04` (rest states over seven seconds), `ending-hover-01..07`, `ending-focus-01..08`, in all four capture folders. Contact sheet: `_sheets/v2-ending-c1440.jpg`.

It has two halves: about forty lines of DOM and CSS, and a WebGL scene. Most of what reads as "macOS" is the scene.

### Files and line ranges (v2 worktree)

| File | Lines | What it does for the ending |
|---|---|---|
| `src/lib/facts.ts` | 79-82 | Beat 8 copy: id `early`, label "First light", place `bl`, headline in two parts |
| `src/components/home/Story.tsx` | 91-120 | The beat section. 109-117 is the block only beat 8 has: contact list and two internal links |
| `src/components/home/Story.tsx` | 28-64 | The frame loop that turns the beat on, fills the HUD and the progress bar |
| `src/components/home/Story.tsx` | 126-130 | HUD and progress bar markup |
| `src/app/globals.css` | 35-37 | The three type classes (`mono`, `black`, `thin`) |
| `src/app/globals.css` | 90-105 | Copy block, headline sizes, link style |
| `src/app/globals.css` | 108-125 | Fixed stage, placement, shade pool |
| `src/app/globals.css` | 127-138 | Entrance choreography |
| `src/app/globals.css` | 151-158 | `.ends`, `.contact`, `.more` |
| `src/app/globals.css` | 160-167 | HUD and bar |
| `src/app/globals.css` | 277-291 | Phone overrides |
| `src/world/beats.ts` | 13, 44 | Where the scene stands and the two camera poses |
| `src/world/engine.ts` | 34-47 | Sky colour keys and interpolation. Line 40 is the ending's key |
| `src/world/engine.ts` | 70-106 | Sky dome, three ridge rings, the mirror |
| `src/world/engine.ts` | 146-152, 256-259 | Bloom and final pass set-up and per-frame values |
| `src/world/engine.ts` | 189 | Scroll to camera pose for the last beat |
| `src/world/engine.ts` | 281-288 | Resolution: device pixel ratio cap and mirror size |
| `src/world/shaders.ts` | 9-41 | The sky function |
| `src/world/shaders.ts` | 53-74 | Ridges |
| `src/world/shaders.ts` | 76-107 | Water |
| `src/world/shaders.ts` | 177-194 | Final pass: fringe, exposure, vignette, ACES, gamma, grain |
| `src/world/formations.ts` | 406-426 | The column of light and the exhaust on the water |
| `src/components/shell/Foot.tsx` | 1-13 | The text-only reprise at the bottom of /work, /blog and posts |

### DOM

```
<section class="beat" data-beat="8" data-place="bl" data-on aria-label="First light">
  <div class="beat-still" aria-hidden="true"></div>          (static mode only)
  <div class="copy">
    <h2 class="head" data-size="md">
      <span class="ln" style="--l:0">
        <span class="thin">It's still</span><span class="black">early.</span>
      </span>
    </h2>
    <div class="ends">
      <ul class="contact black">
        <li><a href="..." target="_blank" rel="noopener noreferrer">GitHub</a></li>
        <li><a ...>X</a></li>
        <li><a ...>LinkedIn</a></li>
        <li><a href="mailto:...">Email</a></li>
      </ul>
      <p class="more mono">
        <a href="/work">Everything I have built</a><a href="/blog">Writing</a>
      </p>
    </div>
  </div>
</section>
...
<div class="hud mono" aria-hidden="true">
  <div><b>08</b> / 08&nbsp;&nbsp;<span>First light</span></div>
  <div class="hud-r"><span>First light </span><b>now</b></div>
</div>
<div class="hud-bar" aria-hidden="true"></div>
```

The canvas (`.world`, fixed, `z-index: 0`) is behind it. The nav is fixed on top. Nothing else is on screen.

### Every CSS value that matters

Measured in Chromium at 1440 x 900 and 390 x 844 (`~/.t3/portfolio-redesign-v4/v2v3/_measure.json`).

| Property | 1440 | 390 | Source |
|---|---|---|---|
| Page gutter `--pad` | 37.44px (`clamp(16px, 2.6vw, 40px)`) | 16px | `globals.css:13` |
| Stage padding | 127px top, 37px sides, 135px bottom (3.4 and 3.6 times the gutter) | 84px, 16px, 64px | `:109`, `:278` |
| Copy block | 606 x 214px, left 37px, top 552px, so its bottom edge is 134px above the viewport bottom | 352 x 151px, top 629px | measured |
| Copy grid gap | 20px (`clamp(10px, 1.4vw, 20px)`) | 10px | `:90` |
| Headline size | 82.08px (`clamp(2.2rem, 5.7vw, 6.6rem)`) | 37.44px (9.6vw) | `:99`, `:283` |
| Headline line height | 0.84 (68.9px) | 0.84 | `:93` |
| Headline, light part | width axis 62%, weight 250, tracking 0, word spacing 0.14em, uppercase | same | `:37` |
| Headline, heavy part | width axis 125%, weight 800, tracking -0.04em (-3.28px), uppercase | same | `:36` |
| Space between the two parts | 0.16em | 0.16em as flex gap | `:95`, `:282` |
| Text shadow on copy, HUD, nav | `0 0 22px rgba(4,7,12,0.6), 0 0 3px rgba(4,7,12,0.35)` | same | `:88` |
| Shade pool under the copy | `radial-gradient(ellipse 62% 58% at 0% 100%, rgba(4,7,12,0.62), rgba(4,7,12,0) 72%)`, fades in over 500ms | `linear-gradient(0deg, rgba(4,7,12,0.78), rgba(4,7,12,0.4) 34%, rgba(4,7,12,0) 58%)` | `:122`, `:288` |
| `.ends` | grid, 22px gap, margin-top 18px (`clamp(10px, 2vh, 28px)`) | same | `:152` |
| Contact links | 24.48px (`clamp(1.05rem, 1.7vw, 1.7rem)`), weight 800, width 125%, tracking -0.04em, uppercase, 10px vertical padding, 46px tall | 18.4px, 40px tall | `:153-154`, `:285` |
| Contact gaps | 4px row, 37.44px column | 0 row, 22px column | `:153`, `:285` |
| Contact underline | 1px flare line, 8px above the box bottom, `scaleX(0)` to `scaleX(1)` in 320ms `cubic-bezier(0.23, 1, 0.32, 1)`, enters from the left, leaves to the right | none (hover only) | `:155-156` |
| Secondary links | mono 11px / 1.35, weight 500, tracking 0.09em, uppercase, 12px vertical padding, 26px gap, bone on steel | same | `:35`, `:157-158` |
| HUD | mono 11px, steel with bone for the live values, 37px side padding, 30px from the bottom | 16px, 13px; label hidden | `:161-167`, `:289` |
| Progress bar | 2px, flare, full width at the end | same | `:165` |
| Focus ring | `2px solid #ff5a1f`, offset 4px, radius 2px | same | `:28` |
| Radii, borders, box shadows, blurs | none anywhere in the ending | none | |

There is no card, no border, no radius and no CSS blur on this screen. That absence is part of why it looks finished.

Key excerpts:

```css
/* globals.css:36-37 */
.black { font-stretch: 125%; font-weight: 800; letter-spacing: -0.04em; }
.thin { font-stretch: 62%; font-weight: 250; letter-spacing: 0; word-spacing: 0.14em; }

/* globals.css:129-137, the entrance */
html[data-world='live'] .beat .ln { clip-path: inset(-10% 100% -10% 0); transition: clip-path 160ms var(--ease-out); }
html[data-world='live'] .beat[data-on] .ln { clip-path: inset(-10% 0 -10% 0); transition: clip-path 900ms var(--ease-in-out) calc(var(--l) * 110ms); }
html[data-world='live'] .beat[data-on] .ln::after { animation: scan 900ms var(--ease-in-out) calc(var(--l) * 110ms) both; }
html[data-world='live'] .beat[data-on] .go, html[data-world='live'] .beat[data-on] .ends { opacity: 1; transform: none; transition: opacity 700ms var(--ease-out) 520ms, transform 700ms var(--ease-out) 520ms; }

/* globals.css:152-158 */
.ends { display: grid; gap: 22px; justify-items: start; margin-top: clamp(10px, 2vh, 28px); }
.contact { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 4px clamp(18px, 2.6vw, 44px); font-size: clamp(1.05rem, 1.7vw, 1.7rem); text-transform: uppercase; }
.contact a { padding: 10px 0; position: relative; }
.contact a::after { content: ''; position: absolute; left: 0; right: 0; bottom: 8px; height: 1px; background: var(--flare); transform: scaleX(0); transform-origin: right; transition: transform 320ms var(--ease-out); }
```

### The scene, value by value

Sky key at the end of the page (`engine.ts:40`), linear colour before tone mapping:

```ts
{ t: 1.0, zen: [0.011, 0.04, 0.1], mid: [0.045, 0.095, 0.125], hor: [0.3, 0.17, 0.07], band: [2.3, 1.05, 0.22], sunEl: 0.022, exp: 1.0, stars: 0 },
```

| Part | Values | Source |
|---|---|---|
| Vertical gradient | horizon to mid over `smoothstep(0, 0.15, h)`, then to zenith over `smoothstep(0.06, 0.62, h)` | `shaders.ts:14` |
| Warm band | `band * exp(-h * 15) * az^5 * 0.55` plus a wider `exp(-h * 30) * az^2 * 0.16`; `az` is closeness to the sun's compass direction, so the warmth is a pool on one side, not a stripe | `shaders.ts:16-20` |
| Sun | elevation 0.022 rad (1.3 degrees above the horizon), 0.18 to the right; glow `sd^260 * 0.5`; disc `smoothstep(0.99988, 0.99995, sd) * 9` in colour (1.0, 0.86, 0.62) | `shaders.ts:22-24`, `engine.ts:237` |
| High cloud | four-octave value noise stretched 0.55 by 1.5, drifting at 0.004 per second, darker than the sky, lit from below near the sun | `shaders.ts:26-32` |
| Stars | fully faded out at this key | `engine.ts:40` |
| Ridges | three rings at radius 9000, 6800 and 5000, heights 950, 620 and 330, darkness 0.5, 0.72 and 0.9; five octaves of ridged noise; each ring drops to 22% height where the sun comes up, which is what opens the bright gap; haze at the base | `engine.ts:79-97`, `shaders.ts:53-74` |
| Water | three.js `Reflector` mirror at 0.85 of the canvas size (0.6 on phones); two crossing noise fields offset the reflection, calmer with distance; fresnel `0.34 + 0.66 * (1 - V.y)^3`; a faint cellular salt crust where you look down; haze `1 - exp(-dist * 0.00022)` to the horizon colour | `engine.ts:100-106`, `286-287`, `shaders.ts:89-106` |
| Light column | 62% of the lights on a curve `[8 + t^1.6 * 330, 0.4 + t^0.8 * 330, -40 - t * 420]`, streaming along its tangent; 20% as exhaust rolling outward on the water; five rings | `formations.ts:409-425` |
| Camera | field of view 32 degrees; arrives at position (-34, 7, 96) looking at (6, 44, -140), and over the last 0.72 screens of scroll sinks toward (-24, 3.2, 86) looking at (8, 38, -200), getting about 86% of the way there before the page ends; subject shifted 10% of the width | `beats.ts:44`, `engine.ts:189` |
| Bloom | UnrealBloom, strength `0.48 - tod * 0.1` (0.38 here), radius 0.6, threshold 0.95, half-float target | `engine.ts:147-150`, `258` |
| Final pass | chromatic offset `c * r2 * (0.004 + 0.05 * speed)`, exposure times 1.15, vignette `1 - r2 * 0.85`, ACES, gamma 2.2, grain of plus or minus 0.011 | `shaders.ts:182-192` |
| Resolution | `min(devicePixelRatio, 1.5, 2600 / longest side)`, fixed for the session. Measured backing store 2160 x 1350 for a 1440 x 900 viewport on a 2x screen, in every frame of every capture | `engine.ts:283` |

```glsl
// shaders.ts:12-24
vec3 skyColor(vec3 d){
  float h = max(d.y, 0.0);
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.15, h)); col = mix(col, uZen, smoothstep(0.06, 0.62, h));
  vec2 a = normalize(d.xz + 1e-5); vec2 s = normalize(uSun.xz);
  float az = max(dot(a, s), 0.0);
  float band = exp(-h * 15.0) * pow(az, 5.0);
  col += uBand * band * 0.55;
  col += uBand * exp(-h * 30.0) * pow(az, 2.0) * 0.16;
  float sd = max(dot(normalize(d), uSun), 0.0);
  col += uBand * pow(sd, 260.0) * 0.5 * smoothstep(0.6, 1.0, uTod);
  col += vec3(1.0, 0.86, 0.62) * smoothstep(0.99988, 0.99995, sd) * 9.0 * smoothstep(0.86, 1.0, uTod);
  ...

// shaders.ts:182-192
vec2 c = vUv - 0.5; float r2 = dot(c, c);
vec2 off = c * r2 * (0.004 + 0.05 * uMove);
vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
col *= uExp * 1.15;
col *= 1.0 - r2 * 0.85;
col = aces(col);
col = pow(col, vec3(1.0 / 2.2));
col += (h(vUv * 900.0 + fract(uTime) * 61.0) - 0.5) * 0.022;
```

### Behaviour and motion

1. Scroll drives a single number `q`. The engine follows it with an exponential ease (`q += (target - q) * (1 - 0.0015^dt)`, `engine.ts:206-207`), so the camera never jumps, even on a wheel tick.
2. From beat 7 the swarm leaves the engine, the camera lifts 16 units in the middle of the flight, and the sky runs from key 0.88 to 1.0. `home-27.jpg` and `home-28.jpg` show the flight.
3. The beat turns on when `q` passes 7.925 (`Story.tsx:38-45`). The headline wipes in left to right behind a 3px flare bar over 900ms with the in-out curve; the links and the two small links rise 14px and fade in over 700ms starting at 520ms. `ending-enter-01.jpg` catches the bar at the left edge. Leaving is fast: 160 to 180ms.
4. After arrival nothing changes except: lights stream up the column, the exhaust rolls outward on the water, ripples move the reflection, cloud drifts, lights twinkle. The four rest frames over seven seconds (`ending-01..04`) are nearly identical. The sun does not move.
5. The last 0.72 screens of scroll lower the camera from 7 to about 3.7 units above the water, so the page ends on a slow settle toward the surface, not a stop.
6. HUD at the end: "08 / 08 First light" left, "First light now" right, bar full.
7. Hover: only the 1px underline. Focus: the global 2px flare ring. No pressed state on the contact links. The pointer still parts the light column (`ending-hover-07.jpg`).

### Why it reads as macOS quality

- It is one picture. A sky, a horizon, a reflection and one bright vertical. Every other beat has a subject competing with a headline; this one has room.
- The palette comes from a model of a sky, not from a palette. Deep blue at the top, a short warm band at the horizon only on the sun's side, nothing violet. That is the same recipe as the dawn desktop pictures the owner is thinking of.
- Depth is built the way a photograph has it: three ridge layers that lose contrast with distance, haze to the horizon colour, and a gap in the ridges exactly where the sun is.
- The light is high dynamic range and then tone mapped. The band is 2.3 in linear light and ACES rolls it off, so the bright area glows without a hard clipped patch.
- Grain and vignette are tiny (plus or minus 1.1% and 0.85 times radius squared), enough to remove gradient banding and hold the eye in the middle.
- The reflection is real, so the lower third agrees with the upper two thirds.
- The type does almost nothing: one line at 82px, four words at 24px, two labels at 11px, all on one left edge, the block's foot 134px above the bottom. The chrome (name top left, links top right, readout bottom left and right, 2px bar) frames the picture like a menu bar and a dock.
- It is the pay-off of the whole page. The sky has been getting lighter for fourteen screens.
- It is still. After the entrance, nothing asks for attention.

### What is weak about it

- The type. Both families are killed.
- The contact links sit on the brightest part of the picture. The exhaust lights and their bloom run through "LinkedIn" and "Email" (`ending-hover-01.jpg`, `ending-hover-03.jpg`), and the screen only works because of the shade pool and the text shadow.
- The light column is the swarm, and the pointer still dents it.
- The ridges are extruded strips. At 2x you can see vertical gully streaks and soft, stepped silhouettes in the reflection. The second critic's word was "wallpaper lake".
- Everything is rendered at 1.5 device pixels at most and the mirror at 0.85 of that, with no antialiasing on the ridge edges, so on a 2x screen the picture is softer than the type on top of it.
- Bloom turns the brightest exhaust lights into a row of round discs on the waterline that reads as lens dirt.
- Interaction is thin: no pressed state, no arrow, no difference between the primary action and the rest, Email is a bare `mailto:` with nothing to copy.
- The sun never rises. The story says first light and then holds a still.
- The page just stops. No colophon, no RSS, no date, and the HUD says "First light" twice.
- On phones the headline drops to 37px and the block is pushed to the bottom over a linear dark gradient that covers the lower 58% of the picture.
- On inner pages the reprise is only the words on flat ink (`v2/chromium-1440/work-07.jpg`); the picture is missing.

### Proposals to elevate it in v4

1. Keep the composition exactly: horizon on the lower third, at least two thirds sky, one headline and one row of links on a single left edge, chrome on the frame. Keep the ending's sky key as the starting values for the dark theme.
2. Arrive by tilting up. v4 looks straight down at the bed for the whole page; at the end the camera pitches up as the stream runs out into open water, and the horizon and the sky appear for the first and only time. That makes the ending a reveal instead of a last slide.
3. Make the water the real simulation. The stream that has run down the page feeds the lake, so ripples at the mouth are the fluid sim's own, and the reflection is a true planar reflection at full resolution. Replace the bloom discs with a sun glitter path: a narrow specular streak on the water along the sun's direction, broken by the ripples.
4. Put the words on land. A dry machined ledge in the lower left foreground carries the headline and the links, lit by the same sun. No shade pool, no text shadow, and nothing bright can pass behind a link.
5. Let the sun rise. After arrival the sun climbs slowly for about a minute, the band widens and the ledge picks up a warm edge, then it stops for good. Under reduced motion it is a still at the final state.
6. Two themes from one model. Dark theme: v2's dawn as it is. Light theme: the same scene later in the morning, higher sun, paler zenith, lighter water. Both come from the same sky function with different keys.
7. Render the sky and the water at the full device pixel ratio (see perf.md for the rule). A sky gradient costs almost nothing per pixel; softness here is what breaks the illusion. Dither in the shader instead of an overlay.
8. Replace the strip ridges with a real heightfield silhouette, antialiased analytically in the shader, with the same three-layer haze.
9. Make the links real controls: 44px minimum targets, the 1px underline kept, a small arrow that moves 3px on hover, scale 0.97 on press, a focus ring that matches the control's shape. Email copies the address and confirms in place, with a haptic on touch.
10. Finish the page: a quiet colophon on the readout line (year, RSS, when the numbers were last pulled) in place of the repeated "First light".
11. Keep the entrance mechanics: wipe over 900ms on the in-out curve, support at 420 and 520ms, fast exit. Move v3's word-by-word light-up here if the headline becomes a sentence.
12. Carry it to every inner page. /work, each project page and each post end on a short band of the same scene (about 60svh) with the same links, replacing both v2's text-only footer and v3's strip.
13. The pointer does one physical thing only: it disturbs the water where it touches, through the simulation. Nothing parts around the cursor.

## Dossier B: v3 project pages and archive

Frames: `v3/<browser>-<width>/work-*.jpg`, `work-row-hover-*.jpg`, `work-archive-*.jpg`, `project-<slug>-*.jpg`.

### Routes

| Route | File | Notes |
|---|---|---|
| `/work` | `src/app/work/page.tsx` | Server component. Title, lede, then the client `WorkIndex` |
| `/work/[slug]` | `src/app/work/[slug]/page.tsx` | Statically generated for all nine slugs (`generateStaticParams`, lines 14-16). Metadata per project: title, description from the one-line summary, canonical, Open Graph title and description (18-23). Unknown slug calls `notFound()` (28) |
| Scene per route | `src/components/SceneSetter.tsx`, `src/components/GroundInit.tsx` | Sets the form and the ground colour; `GroundInit` writes the ground before first paint so a direct load does not flash |

### Data model

Everything lives in one typed file, `src/lib/site.ts`.

```ts
// site.ts:35-55
export type Project = {
  slug: string;
  name: string;
  lines: string[];            // display lines for the home word
  linesNarrow?: string[];
  w: number;                  // measured width of the widest line in em
  wNarrow?: number;
  shape: ShapeName;
  ground: GroundName;
  kicker: string;
  line: string;               // one line for lists, the page lede and meta description
  body: string[];
  quote?: string;
  facts: Fact[];              // { k, v }
  links: LinkItem[];          // { label, href }; the first is the primary action
  stats?: { value: number; label: string }[];
  video?: boolean;
};
```

- `projects` (57-274): nine entries. `flagships` (277) is the eight shown on the home page.
- `highlights` (286-338): seven items with a name, text, an optional award note and links. These have no page.
- `archive` (352-373): seventeen items: `{ name, kind: 'Earlier work' | 'Tools' | 'Small', year, text, href?, live? }`.
- `metrics` (9-23): every number, with one retrieval date (7). Project stats and facts read from it, so a number is written once.
- `scenes` and `projectScene` (378-401): where the form sits per route.

### /work, top to bottom (1440)

| Block | Measured |
|---|---|
| Page | 144px top padding, 48px sides, 64px bottom, 48px between header and content, 64px between the three sections |
| Title | "Work" at 234px, line height 0.88; lede 24px / 1.3, 36ch |
| Section heading | 14px, weight 600, uppercase, tracking 0.04em, count in mono on the right, 16px below |
| Featured rows | 9 rows, 104px each, hairline between; grid `56px, 1.1fr, 1.3fr, 44px` with 16px gaps; name 63px; one line 16px / 24px at 80% ink, 46ch; 44px round arrow button |
| "Also" cards | `repeat(auto-fill, minmax(320px, 1fr))`, 16px gaps, 20px padding, 20px radius; title 24px, text 14px / 20px |
| Archive tools | Search field 48px tall, full pill, 16px side padding; four 44px pill filters to its right, 4px gaps |
| Archive rows | 49px each; grid `220px, 1fr, 72px, 96px`; name 16px bold with a 1px underline; text 14px; year and kind 13px mono |
| Footer strip | 92px |

### How the archive search and filter works

```ts
// WorkIndex.tsx:13-19
const [q, setQ] = useState('');
const [kind, setKind] = useState<ArchiveKind | 'All'>('All');
const rows = useMemo(() => {
  const s = q.trim().toLowerCase();
  return archive.filter((a) => (kind === 'All' || a.kind === kind) && (!s || `${a.name} ${a.text} ${a.kind} ${a.year}`.toLowerCase().includes(s)));
}, [q, kind]);
```

- One lowercase substring match over name, text, kind and year, combined with the kind filter by AND. No fuzzy matching, no debounce, no URL state. Seventeen rows make that enough.
- The count in the section heading ("03 / 17") is `aria-live="polite"` (lines 74-76), so screen readers hear the result count.
- Filters are real buttons with `aria-pressed` inside a labelled group (84-90).
- The empty state repeats the query and offers one "Clear search" button that resets both controls (121-135). Frame `work-archive-04.jpg`.
- Focus on the search field swaps the pane's edge for a 2px solid ring (`globals.css:445`). Frame `work-archive-02.jpg`.
- Archive names link straight out to the repo. That is right for an archive; it is the featured work that needed pages.

### Project page, top to bottom

`src/app/work/[slug]/page.tsx:36-116`. Measured on `/work/agent-bridge` at 1440.

| Block | Lines | Measured |
|---|---|---|
| Back link "Work" with arrow | 38-41 | 44px tall |
| Kicker: index and category in mono | 42-44 | 12px, uppercase, tracking 0.06em |
| Title, shared-element with the list row and the home word | 45-51 | 156px for "Agent Bridge"; size comes from `name.length * 0.72` |
| Lede: the one-line summary | 52 | 24px / 1.3, 36ch (496px) |
| Two columns | 55 | `1fr` and 460px, 48px gap; one column below 1024px |
| Body pane: optional video, paragraphs, optional quote, link buttons | 56-70 | 836px wide, 28px padding, 28px radius, 20px gaps; paragraphs 18px / 28px; quote 24px / 32px bold; first link solid |
| Side: optional stat tiles, then a facts list | 72-100 | stat tiles 224 x 74px in two columns; facts rows 41px, key in mono, hairlines |
| Next project | 103-115 | full-width row, 146px, name at 72px, same arrow as the list |
| Footer strip | 117 | 92px |

### What is good

- Real pages with stable URLs for the featured work, and a clear order: what it is, proof, facts, where to go. The outbound links come after the information, which is exactly what the owner asked for.
- One typed source for every list and page, with numbers defined once.
- The row to page transition shares the title, so the click feels like the row opening.
- The facts list is a `dl` with mono keys and hairlines: dense, honest, easy to scan.
- The first link is the primary action and is visually distinct.
- "Next" keeps the visitor moving without going back to the list.
- The three tiers on /work (featured, also, archive) match how much there is to say about each thing.
- Archive tools are accessible and have a designed empty state.

### What is thin

The first v3 critic's finding 9 was "Project pages are thin." The review's response: "Not addressed beyond the parked form and shared-element title. Listed as a gap." The closing notes add that project pages "do not have their own scroll choreography". What that means concretely:

- There is very little on them. Bodies are one or two short paragraphs: Open models, cc-switch and RydAR each have a single paragraph of two or three sentences (`site.ts:177`, `191`, `261-263`). Page heights at 1440 x 900 run from 1,082px (merlin-control) to 1,640px (agent-bridge), so most pages are barely more than one screen and the "next" row is visible on arrival.
- Only one page has any media (`video?: boolean`, and only Agent Bridge sets it). No screenshots, no diagrams, no code, no before and after. The data model has no field for them.
- No structure inside the body: no problem, approach, result. `body` is a flat list of strings.
- Facts are uneven: two rows on merlin-control and RydAR, seven on Open source. Role, dates and stack are not consistent fields, so pages cannot be compared.
- The quote and the stats are optional and rare, so many pages are a title over two small panes.
- The seven "Also" items and RydAR's neighbours have no page at all, and the home page's chips link to `/work#highlights`, an anchor, not a page (`Home.tsx:450`).
- "Next" walks the array in order and wraps; there is no previous, no related writing, no link back to the same project on the home page.
- Titles are sized by character count, not measured width (`page.tsx:46`). The second critic caught "Open source" running off the edge; it was patched, not solved.
- The parked form still touches long titles (`project-agent-bridge-01.jpg`).
- No Open Graph image and no structured data per project.
- Each page sits on that project's flat ground colour, which v4 drops.

### What v4 does with it

- Keep the routes, the single typed source, the three tiers, the row anatomy, the facts list, the shared title, "next", and the archive tools.
- Extend `Project` with: `role`, `period`, `stack`, `status` as fixed fact fields; `media[]` (image or video with alt text and aspect ratio); `sections[]` with a heading and body so a page has at least what it is, what I built, what happened; `related` (post slugs).
- Give every page its own water visual on land beside the content, the same one the home page shapes for that project, so the page has something only it has.
- Add previous as well as next, and end on the compact ending band.
- Measure title widths at build time instead of estimating.
- Put search state in the URL (`?q=`, `?kind=`) so a filtered archive can be linked.
- Merlin stays out of the featured set.

## Dossier C: spacing and cleanliness

All numbers measured in Chromium (`~/.t3/portfolio-redesign-v4/v2v3/_measure.json`).

### Scales

| | v2 | v3 |
|---|---|---|
| Gutter | `clamp(16px, 2.6vw, 40px)`: 37.44px at 1440, 16px at 390 | `clamp(16px, 3.4vw, 48px)`: 48px at 1440, 16px at 390 |
| Content width at 1440 | 1,365px, full bleed minus gutters | 1,344px, full bleed minus gutters |
| Reading column | 68ch, 701px, centred | 760px column, 664px of text inside a pane with 48px padding |
| Spacing values in use | Fluid and off-grid: 10, 12, 14, 15, 18, 20, 22, 24, 26, 28, 34, 43.2, 56, and multiples of the gutter (0.8, 3.4, 3.6, 4.6, 5, 6 times) | A 4px grid: 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 48, 64, 96, 144 |
| Radii | None except 999px filter chips and 4 to 8px in prose | 12, 20, 28, pill |
| Type sizes | Fluid clamps everywhere: 11 (mono labels), 15.2, 16, 16.3, 18, 20.8, 24.5, 41.6, 49, 77.8, 82, 158, 180, up to 21vw | Stepped: 12, 13, 14, 16, 18, 20, 24, 28, 30, 36, 48, 63, 72, then display words fitted to the viewport (156 to 306px) |
| Line heights | 0.84 display, 1.35 mono, 1.68 prose | 0.88 display, 16 / 20 / 24 / 28 / 32px steps for text, 30px prose |
| Hit targets | 35 to 46px; nav links are 35px tall | 44px minimum everywhere (48px for search) |

### Section rhythm

| | v2 | v3 |
|---|---|---|
| Home length at 1440 x 900 | 14,148px for 8 beats: 200svh each, one fixed stage at a time | 14,085px for 11 beats: hero 125svh, eight at 150svh, two at 120svh, each a sticky 100svh pin |
| Stage padding | 127 to 172px top, 37px sides, 135px bottom | 96px top, 48px sides, 36px bottom |
| Copy per beat | Kicker, headline, one sentence, one link in a single 20px-gap column, on one edge | A display word in one layer and a 461px pane (28px padding, 20px gaps) in another, in opposite corners |
| Inner page top | 187px above an h1 that sits at the bottom of a 62svh band (558px) | 144px, then title, 16px, lede, 48px, content |
| List rows | 55px rows, 15px vertical padding, 28.8px column gap | Featured 104px (20px padding), archive 49px (12px padding), 16px gaps |
| Footer | 130px above a 100px headline | 92px strip |

### Where each is cleaner or bolder

v3 is cleaner in:
- Spacing discipline. Every gap is on the 4px grid, so panes, rows and chips line up without anyone having to look. v2's values are individually tuned.
- A real type scale with fixed line heights, which is why its small text (rows, facts, cards) looks set, not scattered.
- Hit targets and controls: 44px everywhere, one button anatomy, one chip anatomy, visible pressed states.
- Inner pages. /work and the project pages have a clear hierarchy: section heading with count, rows, cards, archive.
- Wider gutter (48 against 37px) and a centred nav that leaves the corners empty.

v2 is cleaner in:
- Chrome. There is none: no cards, no borders, no radii, no shadows on the home page. Text sits on the picture on one margin. v3 has a pane, chips and two buttons in every beat.
- One alignment edge per screen. v3 splits each beat between two corners, which is where its collisions come from.
- Hairlines. v2's 1px rules at 16% and its 55px rows are denser and calmer than v3's cards.
- Restraint with colour: one accent, used only as 1px and 2px marks.

v2 is bolder in:
- Type contrast inside a single line: a 62% width light cut against a 125% width heavy cut at the same size. v3 uses one weight.
- Scale of numbers and short words: "1st" and "20" run to 21vw (302px at 1440, 30vw on phones).
- Letting the picture have the whole screen with the copy at 82px in a corner.

v3 is bolder in:
- Display words fitted edge to edge by measured width (306px for the hero name), and a number as a headline.
- Full-bleed colour. That is the part v4 cannot keep.

### Recommendation

- Take v3's system: a 4px spacing grid (4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 144), a stepped type scale with fixed line heights, 44px targets, a 48px gutter at desktop and 16px on phones, 12 / 20 / 28px radii for the few plates that exist.
- Take v2's composition: no card unless the content is a control or a table; one alignment edge per screen; hairlines at about 16% instead of boxes; at most one accent used as a thin mark.
- Take v2's boldness for the few big things: the name, one number per project, the ending headline. Set them as large as the land allows and nothing else above 72px.
- Keep both reading columns' measure (about 68ch, 660 to 700px at 18px with 30px line height).
- Shorten the home scroll. Both builds spend roughly fourteen screens on eight to eleven beats. With text on land and no fixed stages, v4 should let content set the height.
