# aravjain.dev v4: typography

Status: draft from the typography research pass, 2026-11-15. Sections up to "Pre-bake-off read" are complete. "Bake-off", "Blind ranking" and "The pick" are left for the in-site round.

Evidence lives outside git in `~/.t3/portfolio-redesign-v4/`:

- `fonts/<family>/` holds every downloaded family (92 of them) as ttf plus a full woff2, each with its `OFL.txt`. `fonts/LICENSE-NOTES.md` has the licence notes for the systems. `fonts/_meta/fonts.json` has the raw metadata.
- `specimens/pre/<system>/index.html` is one static page per system. `specimens/pre/shots/` has 64 full-page screenshots (8 systems, Chromium and WebKit, 1440x900 and 390x844, light and dark).
- `specimens/pre/contact-sheet-light.png` and `contact-sheet-dark.png` are the blind sheets (letters only). `reading-sheet-light.png` and `reading-sheet-dark.png` do the same for long-form copy. The key is `specimens/pre/contact-sheet-key.md`.
- `specimens/pre/audition/` has "Arav Jain" set in 91 display, mono and serif cuts, which is how the shortlist was made.
- `specimens/pre/refs/*.json` has the measured type styles of the reference sites.
- Scripts are in `tools/type/` (`refprobe.js`, `audition.js`, `systems.js`, `build-specimens.js`, `shoot.js`, `fontmeta.py`, `docgen.py`).

## How designers choose type

Written for someone who does not know font names. None are needed to follow this.

### 1. Start from the voice, not from a font list

A typeface is a tone of voice for words. The same sentence set in two faces says two different things about who is speaking, before anyone reads it. So a designer starts by writing down what the reader should conclude in five seconds, then asks which shapes say that.

For this site the sentence is "AI and developer tooling builder", at a finish the owner describes as multi-trillion-dollar, enterprise-level, very modern and fluid. Translated into type terms:

| What we want people to feel | What that means in letter shapes |
| --- | --- |
| Technical, exact, built by an engineer | Even stroke thickness, flat cut stroke ends, numbers that line up in columns, a monospaced voice for data |
| Expensive, enterprise-grade | Restraint (few faces, few weights), very tight spacing on big type, generous space around it, tuned in-between weights |
| Modern | Sans serif, large lowercase height, simple geometry, no nostalgic quirks |
| Fluid, liquid | Smooth continuous curves in the letters, and type that can change weight or width smoothly because it is a variable font |
| Machined stone, ice | Thick strokes with clean edges for the name, so the ice letters have body; squared-off curves where the bed is machined |

Every candidate was judged against that table, and against one hard practical test: the name "Arav Jain" is cast as ice from the display face's outlines, so the letters A, r, a, v, J, i, n have to be thick, even and unmistakable. A face whose "a" is a plain circle with a stick (single-storey) turns "Arav" into something that reads like "Arov", which is why several otherwise good faces were dropped.

### 2. The families of type and what each one implies

| Family | How to spot it | What it says | Typical users | Use here |
| --- | --- | --- | --- | --- |
| Grotesque (old sans, about 1900) | Slightly irregular, tight openings, sturdy | Industrial, newsprint, honest, a little rough | Newspapers, American signage | Flavour only (Special Gothic, Big Shoulders) |
| Neo-grotesque (Swiss, 1950s) | Very even, closed shapes, horizontal stroke ends. Helvetica is the model | Neutral, corporate, "no voice at all" | Apple, Linear, most software | The safe base. Risk: looks like every template |
| Geometric sans | Built from circles and straight lines, round "o", pointed "A" | Modern, clean, optimistic, tech brand | Google, Spotify, space agencies | Strong option for the name (TASA Orbiter) |
| Humanist sans | Shapes follow handwriting, open letters, varied widths | Warm, friendly, readable | Health, education, government | Avoided. Too soft for this finish |
| Wide or extended sans | Letters stretched sideways | Confident, cinematic, luxury, motorsport | Fashion houses, car brands, landonorris.com | Strong option for the name (Martian Grotesk wide, Zalando Sans expanded) |
| Condensed or compressed sans | Tall narrow letters packed tight | Loud, monumental, poster, sport | Sports brands, film titles | Tried (Big Shoulders). Fights the water |
| Monospace | Every letter the same width, like code | Engineering, data, precision, honesty about being technical | Terminals, igloo.inc, dev tools | A second voice for labels and numbers |
| Transitional serif | Moderate thick-thin contrast, upright | Serious, journalistic, trustworthy | Newspapers, long articles | Option for blog reading (Newsreader) |
| Didone or modern serif | Extreme thick-thin contrast, hairline serifs | Fashion, luxury, drama | Vogue, perfume | Rejected. Hairlines break up on moving water |
| Old-style serif | Soft, low contrast, bookish | Literary, warm, traditional | Books | Rejected. Wrong era |
| Slab serif | Thick block serifs | Sturdy, typewriter, mechanical | Engineering manuals | Only inside some monos |

### 3. The details designers look at, and what each one signals

| Detail | Plain meaning | What it signals | Where it mattered here |
| --- | --- | --- | --- |
| x-height | Height of lowercase letters compared to capitals | Tall lowercase feels modern and reads well small. Short lowercase feels classic and elegant | Martian Grotesk is very tall (0.60), Newsreader is short (0.43), so Newsreader is set 2px larger to look the same size |
| Aperture | How open letters like "a", "e", "c" are | Open reads easily when small. Closed looks tighter and more "designed" when big | Text faces need open, display faces can be closed |
| Contrast | Difference between thick and thin strokes | Low contrast looks engineered and modern. High contrast looks luxurious and fragile | Ice letters need low contrast so no part is too thin to cast |
| Terminals | How a stroke ends | Flat horizontal cuts look machined. Angled or round ends look friendly | Flat cuts match the machined bed |
| Ink traps and notches | Small cuts where strokes meet | Once a printing fix, now a "precision instrument" detail | Stack Sans Notch uses them. Good on the name, looks like a rendering bug at medium sizes |
| Width | How wide letters are | Wide is calm, confident, expensive. Narrow is urgent and loud | The main axis of difference between the systems |
| Squareness (superellipse) | Round letters drawn closer to rounded rectangles | Hardware, screens, machined parts | Present in Martian Grotesk, Azeret Mono, Big Shoulders |
| Single or double storey "a" and "g" | "a" drawn as a circle and stick, or with the upper bowl | Single looks geometric and childlike. Double is more legible and adult | The name has three a's. Double storey was required |
| Tabular figures | All digits the same width | Numbers that change or stack do not jitter. Reads as an instrument | Required for live readouts. Martian Grotesk and Big Shoulders lack them, so their numbers are set another way |
| Slashed zero | A zero with a line through it | "This is data", borrowed from code | Used in metric readouts where available |
| Case-sensitive forms | Punctuation that re-centres for ALL CAPS | Polish in uppercase labels | Checked per family in the survey table |
| Optical size | A font that redraws itself for small or huge sizes | The mark of a professional family. Big sizes get tighter and finer, small sizes get sturdier | Newsreader, Big Shoulders and Google Sans Flex have it |
| Variable axes | One file that can slide between weights, widths and more | Smooth motion and exact in-between values | Lets the name animate and lets us use weights like 420 |

### 4. Pairing: how many faces, and why

- **Concord** means using one family for everything and getting variety from size, weight and width. This is what the most expensive sites do: Apple uses SF Pro, Linear uses Inter, Lusion uses Aeonik, igloo uses one mono. It looks calm and deliberate.
- **Contrast** means pairing two faces that are clearly different in kind, for example a sans with a serif, or a sans with a mono. The rule is that they must differ a lot. Two similar sans faces together just look like a mistake.
- **One family with axes versus two families.** A variable family with a width axis can act like two faces (a wide voice for the name, a normal voice for text) while keeping the same skeleton, so nothing clashes. Two families give more drama and more risk.
- **Display and text are different jobs.** Display type is looked at. It can be heavy, tight and characterful. Text type is read. It must be even, open and quiet. Many faces are good at only one of these.
- **A mono is a voice, not a default.** Monospace says "this is a measurement or a machine speaking". Use it only where that is true: labels, timestamps, counters, code. If everything is mono (igloo does this on purpose) the site becomes an instrument panel. If mono is sprinkled at random it means nothing.
- **A serif accent** adds a human, editorial voice next to a technical sans. It works when it is rare (a blog title, a closing line) and fails when it is everywhere.

### 5. Scale, spacing and weight: where "expensive" actually comes from

Most of the premium feeling is not the font. It is how the font is set.

- **Modular scale.** Sizes step by a fixed ratio so they feel related. This site uses few steps on purpose: about 10px labels, 14px units, 17 to 20px reading text, 42 to 52px titles, then straight to display sizes of 150px and more.
- **Extreme scale contrast.** Setting a 93px or 250px word beside a 10px label is the single strongest luxury signal on the reference sites. landonorris.com runs 106px display against 8.3px labels, a ratio near 13 to 1. Lusion runs 144px against 12px. Mid-sized type everywhere is what makes a site look like a template.
- **Tracking tightens as size grows.** Letter spacing that is right at 16px looks loose at 160px. Rule of thumb used here: 0 at body size, about -0.02em at 40px, -0.04 to -0.055em at hero size. Small ALL CAPS labels go the other way and get opened up by +0.05 to +0.08em.
- **Leading (line spacing) by size.** Reading text wants 1.55 to 1.68 times the font size. Titles want about 1.05 to 1.1. Huge display lines want 0.84 to 0.98 so two lines read as one block.
- **Optical sizes.** Where a family has an optical size axis, big type uses the display cut and small type the text cut, automatically.
- **In-between weights.** Ordinary sites use 400, 500, 700 because those are the files they have. A variable font allows 360, 420, 480, 560. Linear uses 510. landonorris.com uses 660 and 750. Choosing a weight per size by eye is a quiet sign that someone tuned the type. General pattern: the bigger the type, the lighter it can be, with one deliberate exception here, the ice name, which must be heavy to have body.
- **Dark theme correction.** Light text on a dark ground looks bolder than the same text in dark on light. Drop the weight by roughly 20 to 30 units in the dark theme for reading text.
- **Numbers.** Live numbers get tabular figures and, where the face has one, a slashed zero.

### 6. How a face earns its place

1. Set the real words, not "the quick brown fox". Here: the name, a project name, real numbers, a real blog paragraph with code in it.
2. Set them at real sizes on the real ground colours, light and dark.
3. Look in more than one browser engine. WebKit and Chromium draw the same font slightly differently.
4. Reject on any one of: weak letters in the name, no way to do steady numbers, tiring long-form reading, a strong association with some other brand, a licence problem.
5. Rank blind, so a famous name does not win on reputation.

## How the references use type

Measured on 2026-11-15 with Playwright (Chromium, 1440 wide), reading computed styles of visible text after scrolling. Raw data is in `specimens/pre/refs/`. The fuller per-site tables in `reference-study/01-pinnacle-and-lusion.md` and `reference-study/03-studios-products-water.md` were written in parallel; I checked them afterwards and the numbers agree (Linear's four weights 300, 400, 510, 590 and its -0.022em and -0.011em tracking rule, landonorris.com's width 93 and weight 660 headline, Lusion's 144px at -0.02em, igloo's single Plex Mono in WebGL). Two things from those files matter for the systems below: IBM Plex Mono recurs on igloo.inc, Lusion and one more studio site, and Azeret Mono is the only face on astrodither.robertborghesi.is, so systems "monolith" and "instrument" would each echo a reference.

| Site | Faces | Display setting | Text setting | Labels and mono | What to take from it |
| --- | --- | --- | --- | --- | --- |
| linear.app | Inter Variable for everything (features cv01, ss03 on), Berkeley Mono, Tiempos Headline loaded for accents | 64px, weight 510, tracking -0.022em, leading 1.0. Also 48px at the same weight and tracking | 15px, weight 400, tracking -0.011em, leading 1.6. Secondary 13px at -0.01em, tiny 10px at -0.015em | Berkeley Mono 12px uppercase for section kickers, 14px with leading 1.71 for code | One sans, in-between weight (510), negative tracking even on body, mono only for kickers and code |
| apple.com/macos | SF Pro Display above about 20px, SF Pro Text below | 48px, weight 600, tracking -0.003em, leading 1.08. 28px at +0.007em | 17px, weight 400, tracking -0.022em, leading 1.47. Fine print 12px at -0.01em | None. Hierarchy comes from size and weight alone | Two optical cuts of one family, only weights 400 and 600, different tracking per cut |
| landonorris.com | Mona Sans Variable for text and display, Brier Bold (a brush script) as accent | 106px uppercase, width 93, weight 660, tracking -0.008em, leading 0.91. 32px headings at width 93, weight 750 | 14px, leading 1.43, and 16.7px, leading 1.25, weights 400 and 500 | 8.3px uppercase at weight 700, 13.3px uppercase nav at width 86, weight 800 | Width axis used as a voice, in-between weights, 13 to 1 scale contrast, one hand-drawn accent |
| lusion.co | Aeonik (weights 400 and 500 only), IBM Plex Mono, a custom LusionMono | 144px, weight 400, tracking -0.02em, leading 1.0. Also 115px at leading 0.9 | 21.6px, leading 1.4 | 13px and 14.4px uppercase in Aeonik, mono for small technical marks | Almost everything at weight 400. Size does all the work. Regular weight at 144px looks more expensive than bold |
| igloo.inc | IBM Plex Mono Medium only. There is no DOM text; every word is drawn inside WebGL from a signed-distance-field atlas of the font | Small mono sizes throughout, uppercase, no display size at all | Same | The whole site is the label voice | A single mono makes the whole site an instrument. Type lives inside the 3D scene, which is the same trick as our ice name |

Shared patterns: one family carries nearly everything, weights stay between 400 and 660 except where a brand wants force, display leading sits at or below 1.0, display tracking is negative, small labels are uppercase with open tracking, and a mono is always present as the technical voice.

Because Mona Sans is landonorris.com's text face, it is not used as a text face in any system below. Mona Sans and Hubot Sans were still auditioned as display faces and dropped for other reasons (see the table).

## Candidates

92 families were downloaded and inspected, all SIL OFL 1.1 with the licence text read at the source and saved beside the files. No Apache 2.0 family made the survey. 91 display, mono and serif cuts were set as "Arav Jain" in the audition sheets.

Reading the table: "RFN" means the licence declares a Reserved Font Name, which limits renaming and modification (see `fonts/LICENSE-NOTES.md`). woff2 size is the full, unsubsetted variable file; the Latin subset number is an estimate of what a production subset would weigh. "Arrows 6 of 6" counts the arrow characters left, up, right, down, up-right and down-right. "Latin 319" counts Basic Latin, Latin-1 and Latin Extended-A.

Licence surprises:

- **Commit Mono and Departure Mono** show "MIT" on GitHub. That covers the website code. The fonts themselves are under OFL 1.1 in a separate file (`LICENSE-FONT`, `public/assets/LICENSE`).
- **Uncut Sans** shows no detected licence on GitHub. Its `LICENSE.txt` is OFL 1.1 with a trademark note on the name.
- **Monaspace** is OFL 1.1 (checked, since it was flagged to verify), with Reserved Font Names for all five voices.
- **Reserved Font Names** exist on Zalando Sans ("Zalando"), IBM Plex ("Plex"), Mona Sans and Hubot Sans ("Mona"), Monaspace, Aspekta and Intel One Mono. Zalando's upstream repo publishes its own woff2, saved in `fonts/zalandosans/upstream-web/`, which avoids the question.
- **Google Sans Flex and Google Sans Code** are OFL 1.1 with no Reserved Font Name, but ship a `TRADEMARKS.md`: the names are Google trademarks and must not imply affiliation.
- **Martian Grotesk and Big Shoulders have no tabular figures** at all, a feature gap, not a licence one.
- Not on Google Fonts, pulled from their own repos: Martian Grotesk, Uncut Sans, Aspekta, Apfel Grotezk, Overused Grotesk, Commit Mono, Departure Mono, Monaspace, Mona Sans v2.

| Family | Looked at as | Designer or foundry | Licence | Source | Axes | woff2 size | Figures and features | Read |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Akt | display grotesk | Dmitry Grenev | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/akt) | wght 100 to 900 | 110 KB (Latin subset about 39 KB) | NO tabular figures, case forms, frac, 6 stylistic sets, 8 character variants, arrows 6 of 6, Latin 318 of 319 | 2026 release. Squared neo-grotesk, flat J bar, clean; no tabular figures. Reserve. |
| Albert Sans | text grotesk | Andreas Rasmussen | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/albertsans) | wght 100 to 900 | 51 KB (Latin subset about 44 KB), italic 55 KB | NO tabular figures, frac, 5 stylistic sets, arrows 0 of 6, Latin 310 of 319 | Scandinavian geometric text face, quiet; no tnum, no arrows. Passed over. |
| Anybody | display, width axis | Tyler Finck | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/anybody) | wdth 50 to 150, wght 100 to 900 | 91 KB (Latin subset about 61 KB), italic 99 KB | tnum, slashed zero, case forms, frac, 1 stylistic sets, arrows 0 of 6, Latin 317 of 319 | Eurostile flavoured, 50 to 150 width. Reads retro sci-fi and gamer. Rejected. |
| Apfel Grotezk | display grotesk | Luigi Gorlero | OFL 1.1 | [source](https://github.com/collletttivo/apfel-grotezk) | static, 5 files kept | 112 KB (Latin subset about 18 KB) | NO tabular figures, frac, arrows 6 of 6, Latin 281 of 319 | Five static weights, chunky Satt cut has charm but uneven spacing and thin coverage (281 of 319). Rejected. |
| Asap Sharp | display, width axis | Omnibus-Type | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/asapsharp) | wght 100 to 900, wdth 75 to 125 | 93 KB (Latin subset about 66 KB), italic 105 KB | tabular by default, slashed zero, case forms, frac, 1 stylistic sets, arrows 4 of 6, Latin 318 of 319 | 2026 release. Competent but anonymous. Rejected. |
| Aspekta | display and text grotesk | Ivo Dolenc | OFL 1.1, RFN | [source](https://github.com/ivodolenc/aspekta) | wght 100 to 900 | 29 KB (Latin subset about 23 KB) | NO tabular figures, case forms, 14 stylistic sets, arrows 6 of 6, Latin 255 of 319 | Aeonik-like geometry, 14 stylistic sets, but no tabular figures and thin Latin coverage (255 of 319). Reserve only. |
| Atkinson Hyperlegible Mono | mono | Braille Institute, Applied Design Works, Elliott Scott, Megan Eiswerth, Letters From Sweden | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblemono) | wght 200 to 800 | 25 KB (Latin subset about 20 KB), italic 27 KB | tabular by default, slashed zero, case forms, frac, arrows 0 of 6, Latin 282 of 319 | Legibility-first mono, slashed zero. Honest but plain. Passed over. |
| Atkinson Hyperlegible Next | text grotesk | Braille Institute, Applied Design Works, Elliott Scott, Megan Eiswerth, Letters From Sweden | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext) | wght 200 to 800 | 47 KB (Latin subset about 38 KB), italic 51 KB | tnum, case forms, frac, arrows 0 of 6, Latin 282 of 319 | Very legible, slightly institutional voice. Passed over. |
| Azeret Mono | mono with character | Displaay, Martin Vácha | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/azeretmono) | wght 100 to 900 | 46 KB (Latin subset about 36 KB), italic 50 KB | tabular by default, slashed zero, case forms, frac, 16 stylistic sets, arrows 6 of 6, Latin 317 of 319 | Displaay. Wide, squared, slab i and r, 16 stylistic sets, slashed zero. Display voice of system "instrument". |
| B612 Mono | mono | Nicolas Chauveau, Thomas Paillot, Jonathan Favre-Lamarine, Jean-Luc Vinot | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/b612mono) | static, 2 files kept | 87 KB (Latin subset about 19 KB), italic 83 KB | tabular by default, arrows 6 of 6, Latin 196 of 319 | Designed for Airbus cockpit displays, a perfect story for readouts, but only 2 weights and 196 of 319 Latin. Rejected. |
| Big Shoulders | compressed display | Patric King | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/bigshoulders) | wght 100 to 900, opsz 10 to 72 | 124 KB (Latin subset about 83 KB) | NO tabular figures, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 315 of 319 | Chicago industrial condensed with an optical size axis. Monumental, flat sided. No tabular figures. Display of system "monolith". |
| Bodoni Moda | serif accent | Owen Earl | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/bodonimoda) | wght 400 to 900, opsz 6 to 96 | 73 KB (Latin subset about 63 KB), italic 83 KB | tnum, case forms, frac, 3 stylistic sets, arrows 0 of 6, Latin 318 of 319 | Didone with optical size 6 to 96. Hairlines too fragile on a moving water ground. Rejected. |
| Boldonse | display | Universitype | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/boldonse) | static, 1 file kept | 31 KB (Latin subset about 25 KB) | NO tabular figures, case forms, frac, 1 stylistic sets, arrows 0 of 6, Latin 314 of 319 | One ultra heavy poster style. Too loud, x-height 0.87. Rejected. |
| Cascadia Mono | mono | Aaron Bell, Mohamad Dakak, Viktoriya Grabowska, Liron Lavi Turkenich | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/cascadiamono) | wght 200 to 700 | 205 KB (Latin subset about 34 KB), italic 150 KB | tabular by default, slashed zero, case forms, frac, 3 stylistic sets, arrows 4 of 6, Latin 319 of 319 | Microsoft terminal face, reads as an editor default. Rejected. |
| Clarity City | text grotesk | VMware, Chris Simpson | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/claritycity) | wght 100 to 900 | 25 KB (Latin subset about 22 KB), italic 27 KB | NO tabular figures, 1 stylistic sets, arrows 0 of 6, Latin 274 of 319 | 2026 release from VMware. Clean but thin feature set and 274 of 319 Latin. Rejected. |
| Commit Mono | mono | Eigil Nikolajsen | OFL 1.1 | [source](https://github.com/eigilnikolajsen/commit-mono) | wght 200 to 700, ital 0 to 1 | 85 KB (Latin subset about 43 KB) | tabular by default, 5 stylistic sets, 11 character variants, arrows 4 of 6, Latin 319 of 319 | Neutral, calm code face, 11 character variants, tabular by nature. Mono of system "notch". Repo is MIT, the font itself is OFL (LICENSE-FONT). |
| Datatype | mono | Frank Tisellano | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/datatype) | wdth 50 to 150, wght 100 to 900 | 80 KB (Latin subset about 64 KB) | tabular by default, arrows 0 of 6, Latin 268 of 319 | 2026 release with width 50 to 150. Thin, narrow default, no tnum feature needed but weak at display. Rejected. |
| Departure Mono | mono | Helena Zhang | OFL 1.1 | [source](https://github.com/rektdeckard/departure-mono) | static, 1 file kept | 22 KB (Latin subset about 8 KB) | tabular by default, case forms, frac, 2 stylistic sets, arrows 6 of 6, Latin 318 of 319 | Pixel face. Lovely, but retro terminal is the wrong finish here. Rejected. |
| Doto | mono | Óliver Lalan | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/doto) | ROND 0 to 100, wght 100 to 900 | 9 KB (Latin subset about 7 KB) | tabular by default, arrows 0 of 6, Latin 268 of 319 | Dot matrix with a roundness axis. Gimmick at this finish level. Rejected. |
| Familjen Grotesk | display grotesk | Familjen STHLM AB | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/familjengrotesk) | wght 400 to 700 | 33 KB (Latin subset about 21 KB), italic 35 KB | tabular by default, slashed zero, case forms, frac, 2 stylistic sets, arrows 6 of 6, Latin 315 of 319 | Single-storey a makes "Arav" read badly; weights stop at 700. Rejected. |
| Finlandica Headline | display grotesk | Helsinki Type Studio, Niklas Ekholm, Juho Hiilivirta, Jaakko Suomalainen | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/finlandicaheadline) | wght 100 to 900 | 126 KB (Latin subset about 55 KB), italic 134 KB | tnum, slashed zero, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 317 of 319 | 2026 release, Helsinki Type Studio. Spiky A and quirky terminals, too national-brand. Rejected. |
| Finlandica Text | text grotesk | Helsinki Type Studio, Niklas Ekholm, Juho Hiilivirta, Jaakko Suomalainen | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/finlandicatext) | wght 100 to 900 | 116 KB (Latin subset about 50 KB), italic 123 KB | tnum, slashed zero, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 317 of 319 | 2026 release. Companion to the above; same quirks. Rejected. |
| Fragment Mono | mono | Wei Huang, URW Design Studio | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/fragmentmono) | static, 1 file kept | 45 KB (Latin subset about 32 KB), italic 47 KB | tabular by default, slashed zero, case forms, frac, 2 stylistic sets, arrows 6 of 6, Latin 289 of 319 | Helvetica-flavoured mono, one weight, slashed zero, case forms. Mono of system "swiss". |
| Fraunces | serif accent | Undercase Type, Phaedra Charles, Flavia Zimbardi | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/fraunces) | opsz 9 to 144, wght 100 to 900, SOFT 0 to 100, WONK 0 to 1 | 191 KB (Latin subset about 143 KB), italic 230 KB | NO tabular figures, case forms, 1 stylistic sets, arrows 0 of 6, Latin 317 of 319 | Soft, wonky old style with four axes. Warm and literary, and by now a familiar indie default. Rejected. |
| Funnel Display | display grotesk | NORD ID, Kristian Möller | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/funneldisplay) | wght 300 to 800 | 23 KB (Latin subset about 18 KB) | tabular by default, case forms, frac, arrows 0 of 6, Latin 288 of 319 | Cut-in joints on r and a. Interesting but reads fintech startup. Passed over. |
| Funnel Sans | text grotesk | NORD ID, Kristian Möller | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/funnelsans) | wght 300 to 800 | 22 KB (Latin subset about 18 KB), italic 24 KB | tabular by default, case forms, frac, arrows 0 of 6, Latin 288 of 319 | Text companion of Funnel Display. Passed over. |
| Geologica | display grotesk | Monokrom, Sindre Bremnes, Frode Helland | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/geologica) | wght 100 to 900, CRSV 0 to 1, SHRP 0 to 100, slnt -12 to 0 | 118 KB (Latin subset about 54 KB) | tnum, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 317 of 319 | Sharpness and cursive axes, sturdy heavy weights. Solid but characterless next to the picks. Reserve. |
| Geom | display grotesk | Thanos Poulakidas | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/geom) | wght 300 to 900 | 48 KB (Latin subset about 33 KB), italic 50 KB | NO tabular figures, case forms, frac, arrows 0 of 6, Latin 316 of 319 | 2025 release. Geometric, no tabular figures, no arrows. Rejected. |
| Gloock | serif accent | Duarte Pinto | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/gloock) | static, 1 file kept | 38 KB (Latin subset about 28 KB) | tnum, slashed zero, case forms, frac, arrows 6 of 6, Latin 289 of 319 | One heavy display serif. Too editorial-magazine for the name. Rejected. |
| Google Sans Code | mono | Google, Universal Thirst | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/googlesanscode) | wght 300 to 800 | 57 KB (Latin subset about 35 KB), italic 62 KB | tabular by default, 1 stylistic sets, arrows 4 of 6, Latin 296 of 319 | Google, Universal Thirst. Friendly, very readable code face, 300 to 800. Mono of system "flex". |
| Google Sans Flex | superfamily | Google | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/googlesansflex) | opsz 1 to 144, wdth 25 to 151, wght 1 to 1000, ROND 0 to 100, slnt -10 to 0 | 1418 KB (Latin subset about 1092 KB) | tnum, slashed zero, frac, 3 stylistic sets, arrows 0 of 6, Latin 296 of 319 | Five axes: weight 1 to 1000, width 25 to 151, optical size, slant, roundness. Whole system "flex" in one file, but the file is 1.4 MB and the look says Google. Name is a Google trademark (TRADEMARKS.md). |
| Hanken Grotesk | text grotesk | Alfredo Marco Pradil, Hanken Design Co. | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/hankengrotesk) | wght 100 to 900 | 56 KB (Latin subset about 39 KB), italic 59 KB | tabular by default, case forms, frac, 3 stylistic sets, arrows 2 of 6, Latin 318 of 319 | Quiet, even, flat terminals, tabular by default. Text face of system "instrument". |
| Host Grotesk | text grotesk | Element Type, Doğukan Karapınar, İbrahim Kaçtıoğlu | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/hostgrotesk) | wght 300 to 800 | 31 KB (Latin subset about 25 KB), italic 34 KB | tabular by default, case forms, frac, 2 stylistic sets, arrows 6 of 6, Latin 303 of 319 | Pleasant quirks, loose word space at display size. Passed over. |
| Hubot Sans | display, width axis | Tobias Bjerrome Ahlin, GitHub, Degarism Studio, Sebastian Carewe | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/hubotsans) | wdth 75 to 125, wght 200 to 900 | 155 KB (Latin subset about 128 KB), italic 165 KB | tnum, case forms, frac, 4 stylistic sets, arrows 4 of 6, Latin 312 of 319 | GitHub. Double-storey a and good widths, but reads as GitHub, and Reserved Font Name applies. Passed over. |
| IBM Plex Mono | mono | Mike Abbink, Bold Monday | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/ibmplexmono) | static, 3 files kept | 117 KB (Latin subset about 18 KB), italic 43 KB | tabular by default, slashed zero, frac, 5 stylistic sets, arrows 6 of 6, Latin 319 of 319 | The face igloo.inc renders everything in. Three static weights kept. Mono of system "monolith". Reserved Font Name "Plex". |
| IBM Plex Sans | text grotesk | Mike Abbink, Bold Monday | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/ibmplexsans) | wght 100 to 700, wdth 75 to 100 | 225 KB (Latin subset about 83 KB), italic 257 KB | tabular by default, slashed zero, frac, 6 stylistic sets, arrows 6 of 6, Latin 319 of 319 | Engineered, rectilinear, strongly IBM. Text face of system "monolith". Reserved Font Name "Plex". |
| Intel One Mono | mono | Intel Corporation, Frere-Jones Type | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/intelonemono) | wght 300 to 700 | 55 KB (Latin subset about 40 KB), italic 58 KB | tabular by default, 5 stylistic sets, arrows 0 of 6, Latin 309 of 319 | Legibility-first, low x-height (0.46). Rejected. |
| Iosevka Charon Mono | mono | Juliette Pluto | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/iosevkacharonmono) | static, 3 files kept | 1036 KB (Latin subset about 21 KB) | tabular by default, slashed zero, frac, arrows 6 of 6, Latin 319 of 319 | 2026 release on Google Fonts. Narrow, dense, 1 MB for three statics. Rejected. |
| Kode Mono | mono | Isa Ozler | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/kodemono) | wght 400 to 700, wdth 75 to 125, ROND 0 to 100 | 100 KB (Latin subset about 81 KB) | tabular by default, frac, 2 stylistic sets, arrows 6 of 6, Latin 280 of 319 | Width and roundness axes, sci-fi angles. Rejected. |
| League Gothic | compressed display | Tyler Finck, Caroline Hadilaksono, Micah Rich | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/leaguegothic) | wdth 75 to 100 | 27 KB (Latin subset about 19 KB) | NO tabular figures, case forms, 1 stylistic sets, arrows 0 of 6, Latin 298 of 319 | Classic condensed gothic with only a width axis, one weight. Too thin for ice letters. Rejected. |
| Libre Caslon Condensed | serif accent | Pablo Impallari, Rodrigo Fuenzalida, Ertekin Erdin | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/librecasloncondensed) | wght 400 to 700 | 63 KB (Latin subset about 53 KB), italic 69 KB | tnum, slashed zero, case forms, frac, arrows 2 of 6, Latin 317 of 319 | 2026 release. Handsome condensed Caslon, wrong era for this site. Rejected. |
| Lilex | mono | Mike Abbink, Paul van der Laan, Pieter van Rosmalen, Mikhael Khrustik | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/lilex) | wght 100 to 700 | 91 KB (Latin subset about 47 KB), italic 103 KB | tabular by default, slashed zero, case forms, frac, 4 stylistic sets, 12 character variants, arrows 6 of 6, Latin 318 of 319 | Plex Mono derivative with ligatures. No advantage over Plex Mono here. Rejected. |
| Literata | serif accent | TypeTogether | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/literata) | opsz 7 to 72, wght 200 to 900 | 388 KB (Latin subset about 178 KB), italic 387 KB | tnum, slashed zero, case forms, frac, 2 stylistic sets, arrows 4 of 6, Latin 318 of 319 | Excellent book face with optical sizes. Too bookish next to machined stone; 387 KB. Reserve for long form. |
| Martian Grotesk | display grotesk, width axis | Roman Shamin | OFL 1.1 | [source](https://github.com/evilmartians/grotesk) | wght 100 to 1000, wdth 75 to 200 | 145 KB (Latin subset about 88 KB) | NO tabular figures, case forms, frac, arrows 4 of 6, Latin 301 of 319 | Evil Martians. Weight 100 to 1000, width 75 to 200, x-height 0.6, very even thick strokes. No tabular figures. Display and text of system "martian". |
| Martian Mono | mono with character | Roman Shamin, Evil Martians | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/martianmono) | wght 100 to 800, wdth 75 to 112.5 | 62 KB (Latin subset about 44 KB) | tabular by default, case forms, frac, 2 character variants, arrows 4 of 6, Latin 301 of 319 | Evil Martians. Width 75 to 112.5, weight 100 to 800; the best heavy mono looked at. Mono of system "martian". |
| Mona Sans (Google Fonts build) | display, width axis | Tobias Bjerrome Ahlin, GitHub, Degarism Studio, Sebastian Carewe | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/monasans) | wdth 75 to 125, wght 200 to 900 | 167 KB (Latin subset about 135 KB), italic 174 KB | tnum, case forms, frac, 8 stylistic sets, arrows 4 of 6, Latin 312 of 319 | GitHub. Default a is single-storey, so "Arav" reads badly; also the text face on landonorris.com. Rejected. Reserved Font Name. |
| Mona Sans and Mona Sans Mono (upstream v2) | display and mono | Deni Anggara | OFL 1.1, RFN | [source](https://github.com/github/mona-sans) | wdth 75 to 125, wght 200 to 900, opsz 0 to 100, ital 0 to 1 | 612 KB (Latin subset about 457 KB) | tnum, case forms, frac, 10 stylistic sets, arrows 4 of 6, Latin 312 of 319 | Upstream v2 adds optical size, an ital axis and Mona Sans Mono. Same objections as above. Rejected. |
| Monaspace (Neon, Argon, Xenon, Krypton) | mono superfamily | Riley Cran and the Lettermatic Team | OFL 1.1, RFN | [source](https://github.com/githubnext/monaspace) | wght 200 to 800, wdth 100 to 125, slnt -11 to 0 | 2032 KB (Latin subset about 135 KB) | tabular by default, case forms, frac, 10 stylistic sets, 13 character variants, arrows 6 of 6, Latin 317 of 319 | GitHub Next. Five voices with weight, width and slant axes; licence is OFL 1.1 (verified in LICENSE). Krypton is too costume, Neon is fine but plainer than Azeret or Martian Mono. Reserve. |
| Mozilla Headline | display, width axis | Studio DRAMA | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/mozillaheadline) | wght 200 to 700, wdth 75 to 125 | 68 KB (Latin subset about 59 KB) | NO tabular figures, slashed zero, case forms, frac, 4 stylistic sets, arrows 0 of 6, Latin 291 of 319 | Studio DRAMA. Slab details on r and i, slashed zero default. Distinctive but reads as Mozilla. Passed over. |
| Mozilla Text | text grotesk | Studio DRAMA | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/mozillatext) | wght 200 to 700 | 32 KB (Latin subset about 26 KB) | NO tabular figures, slashed zero, case forms, frac, 1 stylistic sets, arrows 0 of 6, Latin 291 of 319 | Text companion of Mozilla Headline. Passed over. |
| Newsreader | serif accent | Production Type | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/newsreader) | wght 200 to 800, opsz 6 to 72 | 210 KB (Latin subset about 159 KB), italic 234 KB | tabular by default, case forms, arrows 0 of 6, Latin 315 of 319 | Production Type. Sharp, newsy, optical size 6 to 72, tabular by default. Serif of system "atelier". |
| Overused Grotesk | display and text grotesk | RandomMaerks | OFL 1.1 | [source](https://github.com/RandomMaerks/Overused-Grotesk) | wght 200 to 900 | 74 KB (Latin subset about 40 KB) | tnum, slashed zero, frac, 12 stylistic sets, 5 character variants, arrows 6 of 6, Latin 318 of 319 | Helvetica-like, 12 stylistic sets, tnum and zero, actively maintained. Close second to Uncut Sans for system "swiss". Reserve. |
| Playfair (v2) | serif accent | Claus Eggers Sørensen | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/playfair) | opsz 5 to 1200, wdth 87.5 to 112.5, wght 300 to 900 | 638 KB (Latin subset about 294 KB), italic 698 KB | tnum, slashed zero, case forms, frac, 4 stylistic sets, 1 character variants, arrows 6 of 6, Latin 317 of 319 | Version 2 with optical size 5 to 1200. Razor hairlines at big sizes look expensive but vanish on dark water; 637 KB. Reserve. |
| Pliant | display, width axis | Non Foundry, Jona Saucedo | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/pliant) | wght 100 to 900, wdth 100 to 125 | 105 KB (Latin subset about 37 KB), italic 114 KB | NO tabular figures, slashed zero, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 317 of 319 | 2026 release, Non Foundry. Single-storey a. Rejected for the name. |
| Radio Canada Big | display grotesk | Étienne Aubert Bonn | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/radiocanadabig) | wght 400 to 700 | 27 KB (Latin subset about 20 KB), italic 29 KB | tnum, case forms, frac, arrows 0 of 6, Latin 317 of 319 | Humanist broadcaster face, weights stop at 700. Warm, not technical. Rejected. |
| Recursive | superfamily | Arrow Type, Stephen Nixon | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/recursive) | MONO 0 to 1, CASL 0 to 1, wght 300 to 1000, slnt -15 to 0, CRSV 0 to 1 | 702 KB (Latin subset about 471 KB) | tabular by default, slashed zero, case forms, frac, 13 stylistic sets, arrows 6 of 6, Latin 318 of 319 | Sans to mono on one axis, weight to 1000. Clever, but the casual DNA shows even at linear. Passed over. |
| Red Hat Display | display grotesk | MCKL | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/redhatdisplay) | wght 300 to 900 | 40 KB (Latin subset about 36 KB), italic 42 KB | tnum, slashed zero, case forms, frac, 2 stylistic sets, arrows 2 of 6, Latin 314 of 319 | Pentagram, MCKL. Geometric with wide J; enterprise Linux association is on brand, but shapes are generic. Passed over. |
| Red Hat Mono | mono | MCKL | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/redhatmono) | wght 300 to 700 | 29 KB (Latin subset about 26 KB), italic 32 KB | tabular by default, slashed zero, case forms, frac, 2 stylistic sets, arrows 2 of 6, Latin 314 of 319 | Companion mono. Passed over. |
| Red Hat Text | text grotesk | MCKL | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/redhattext) | wght 300 to 700 | 39 KB (Latin subset about 36 KB), italic 42 KB | tnum, slashed zero, case forms, frac, 2 stylistic sets, arrows 2 of 6, Latin 314 of 319 | Companion text face. Passed over. |
| Redaction | serif accent | MCKL | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/redaction) | static, 2 files kept | 52 KB (Latin subset about 23 KB), italic 26 KB | NO tabular figures, frac, arrows 0 of 6, Latin 311 of 319 | 2026 addition. Legal-document serif with pixel-degraded cuts; only the regular family was pulled. Too conceptual. Rejected. |
| Reddit Mono | mono | Stephen Hutchings, OrangeRed | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/redditmono) | wght 200 to 900 | 79 KB (Latin subset about 45 KB) | tabular by default, slashed zero, case forms, frac, 4 stylistic sets, 18 character variants, arrows 6 of 6, Latin 314 of 319 | Round, friendly. Rejected. |
| Reddit Sans | text grotesk | Stephen Hutchings, OrangeRed | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/redditsans) | wght 200 to 900 | 94 KB (Latin subset about 57 KB), italic 95 KB | tnum, slashed zero, case forms, frac, 4 stylistic sets, 18 character variants, arrows 6 of 6, Latin 314 of 319 | Friendly, rounded joins, 18 character variants. Wrong warmth. Rejected. |
| Rethink Sans | text grotesk | Hans Thiessen | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/rethinksans) | wght 400 to 800 | 48 KB (Latin subset about 39 KB), italic 50 KB | tabular by default, case forms, frac, arrows 4 of 6, Latin 303 of 319 | Quiet, no tnum feature but tabular by default. Passed over. |
| Roboto Flex | superfamily | Font Bureau, David Berlow, Santiago Orozco, Irene Vlachou, Ilya Ruderman, Yury Ostromentsky, Mikhail Strukov | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/robotoflex) | opsz 8 to 144, wght 100 to 1000, GRAD -200 to 150, wdth 25 to 151, slnt -10 to 0, XOPQ 27 to 175, YOPQ 25 to 135, XTRA 323 to 603, YTUC 528 to 760, YTLC 416 to 570, YTAS 649 to 854, YTDE -305 to -98, YTFI 560 to 788 | 773 KB (Latin subset about 348 KB) | tabular by default, arrows 4 of 6, Latin 318 of 319 | Thirteen axes, 772 KB. Enormous control, Android default voice. Rejected. |
| Roboto Serif | serif accent | Commercial Type, Greg Gazdowicz | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/robotoserif) | wdth 50 to 150, opsz 8 to 144, wght 100 to 900, GRAD -50 to 100 | 1551 KB (Latin subset about 788 KB), italic 1958 KB | tabular by default, slashed zero, frac, 6 stylistic sets, arrows 4 of 6, Latin 318 of 319 | 1.5 MB, neutral. Rejected. |
| Schibsted Grotesk | display and text grotesk | Bakken & Bæck, Henrik Kongsvoll | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/schibstedgrotesk) | wght 400 to 900 | 69 KB (Latin subset about 55 KB), italic 73 KB | tnum, slashed zero, case forms, frac, arrows 6 of 6, Latin 317 of 319 | Tight, slightly quirky, strong 900. Weights start at 400. Passed over; best alternate for a grotesk plus serif system. |
| Science Gothic | display, width axis | Thomas Phinney, Vassil Kateliev, Brandon Buerkle | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/sciencegothic) | CTRS 0 to 85, slnt -10 to 0, wdth 50 to 200, wght 100 to 900 | 887 KB (Latin subset about 425 KB) | tnum, slashed zero, case forms, frac, 2 stylistic sets, arrows 6 of 6, Latin 314 of 319 | 2025 release. Width 50 to 200 plus a contrast axis; wide cuts read Eurostile sci-fi; 886 KB. Rejected. |
| SN Pro | text grotesk | Tobias Whetton, Supernotes | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/snpro) | wght 200 to 900 | 124 KB (Latin subset about 53 KB), italic 132 KB | tnum, case forms, frac, 3 stylistic sets, arrows 6 of 6, Latin 317 of 319 | 2025 release. San Francisco-like, rounded details. Passed over. |
| Sofia Sans Extra Condensed | compressed display | Lettersoup, Botio Nikoltchev, Ani Petrova | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/sofiasansextracondensed) | wght 1 to 1000 | 107 KB (Latin subset about 56 KB), italic 109 KB | tnum, case forms, frac, 2 stylistic sets, arrows 6 of 6, Latin 293 of 319 | DIN-like, weight 1 to 1000, tabular figures. Strong runner-up to Big Shoulders, with a descending J. Reserve. |
| Sometype Mono | mono | Ryoichi Tsunekawa | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/sometypemono) | wght 400 to 700 | 27 KB (Latin subset about 20 KB), italic 28 KB | tabular by default, case forms, frac, arrows 6 of 6, Latin 315 of 319 | Humanist, soft-shouldered mono with real italics. Mono of system "atelier". |
| Sora | display grotesk | Jonathan Barnbrook, Julián Moncada | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/sora) | wght 100 to 800 | 48 KB (Latin subset about 41 KB) | tnum, case forms, frac, 1 stylistic sets, arrows 0 of 6, Latin 310 of 319 | Barnbrook. Superelliptical, wide; a/v spacing loose at heavy weights. Passed over. |
| Source Serif 4 | serif accent | Frank Grießhammer | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/sourceserif4) | wght 200 to 900, opsz 8 to 60 | 418 KB (Latin subset about 213 KB), italic 338 KB | tabular by default, slashed zero, case forms, frac, 2 stylistic sets, arrows 6 of 6, Latin 313 of 319 | Rational, sturdy, optical size 8 to 60. Safe second choice to Newsreader. Reserve. |
| Special Gothic | display grotesk, width axis | Alistair McCready | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/specialgothic) | wght 400 to 700, wdth 75 to 125 | 123 KB (Latin subset about 96 KB) | tnum, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 314 of 319 | 2025 release. American gothic with character, width 75 to 125 but weights stop at 700. Passed over. |
| Special Gothic Condensed One | compressed display | Alistair McCready | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/specialgothiccondensedone) | static, 1 file kept | 40 KB (Latin subset about 30 KB) | tnum, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 314 of 319 | One weight, too light for ice letters. Rejected. |
| Special Gothic Expanded One | wide display | Alistair McCready | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/specialgothicexpandedone) | static, 1 file kept | 42 KB (Latin subset about 32 KB) | tnum, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 314 of 319 | One weight, handsome, but no family to build a system from. Rejected. |
| Spline Sans Mono | mono | Eben Sorkin, Mirko Velimirović | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/splinesansmono) | wght 300 to 700 | 57 KB (Latin subset about 49 KB), italic 65 KB | tabular by default, slashed zero, case forms, frac, 18 stylistic sets, arrows 0 of 6, Latin 306 of 319 | Open, wide-set, 18 stylistic sets, slashed zero. Mono of system "orbiter". |
| Stack Sans Headline | display grotesk | Koto | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/stacksansheadline) | wght 200 to 700 | 50 KB (Latin subset about 42 KB) | tnum, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 306 of 319 | 2025 release, Koto for Stack Overflow. Compact, large x-height (0.56). Display of system "notch". |
| Stack Sans Notch | display grotesk | Koto | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/stacksansnotch) | wght 200 to 700 | 49 KB (Latin subset about 41 KB) | tnum, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 306 of 319 | Same skeleton with angled cuts in the joints and a slanted i dot. Reads machined at hero size, reads as a glitch below about 80px. Hero only in system "notch". |
| Stack Sans Text | text grotesk | Koto | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/stacksanstext) | wght 200 to 700 | 50 KB (Latin subset about 41 KB) | tnum, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 306 of 319 | Text cut. Heavy colour for its weight number; needs 300 for body. Text of system "notch". |
| Strichpunkt Sans | wide display | René Bieder | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/strichpunktsans) | wght 400 to 900, wdth 100 to 200 | 94 KB (Latin subset about 79 KB) | tabular by default, case forms, frac, arrows 6 of 6, Latin 313 of 319 | 2026 release, Rene Bieder. Width 100 to 200, heavy and tight, tabular by default. Strong wide alternate. Reserve. |
| SUSE Mono | mono | René Bieder | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/susemono) | wght 100 to 800 | 34 KB (Latin subset about 23 KB), italic 35 KB | tabular by default, case forms, frac, 3 stylistic sets, arrows 6 of 6, Latin 294 of 319 | 2025 release. Plain. Rejected. |
| TASA Orbiter | display and text grotesk | Local Remote, Weizhong Zhang | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/tasaorbiter) | wght 400 to 800 | 51 KB (Latin subset about 37 KB) | tnum, slashed zero, case forms, frac, 1 stylistic sets, arrows 6 of 6, Latin 313 of 319 | 2025 release, Local Remote for the Taiwan Space Agency. Geometric, thick, tnum plus slashed zero plus case forms. Whole of system "orbiter". |
| TikTok Sans | display, width axis | Grilli Type, Contrast Foundry, Type Network | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/tiktoksans) | opsz 12 to 36, wdth 75 to 150, wght 300 to 900, slnt -6 to 0 | 341 KB (Latin subset about 171 KB) | tnum, slashed zero, case forms, frac, 3 stylistic sets, 5 character variants, arrows 6 of 6, Latin 314 of 319 | 2025 release, Grilli Type and Contrast Foundry. The best drawn width-axis grotesk looked at (width 75 to 150, optical size). Kept out of a system only because the name reads oddly on a developer site. Strong reserve. |
| Unbounded | wide display | NaN | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/unbounded) | wght 200 to 900 | 253 KB (Latin subset about 79 KB) | tnum, case forms, frac, 4 stylistic sets, arrows 6 of 6, Latin 318 of 319 | Single-storey a, crypto association. Rejected. |
| Uncut Sans | display and text grotesk | Kasper Nordkvist | OFL 1.1 | [source](https://github.com/kaspernordkvist/uncut_sans) | wght 300 to 700, ital 0 to 11 | 76 KB (Latin subset about 53 KB) | tnum, slashed zero, case forms, frac, 9 stylistic sets, arrows 6 of 6, Latin 316 of 319 | Neue Montreal-like, refined, tnum plus zero plus case, 9 stylistic sets. Weights 300 to 700. Whole of system "swiss". |
| Valley Sans | display grotesk | Niklas Ekholm, Lari Mörö | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/valleysans) | wght 100 to 900 | 67 KB (Latin subset about 57 KB), italic 69 KB | tnum, case forms, frac, 3 stylistic sets, arrows 6 of 6, Latin 317 of 319 | 2026 release. Friendly geometric. Rejected. |
| Wix Madefor Display | display grotesk | Dalton Maag | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/wixmadefordisplay) | wght 400 to 800 | 42 KB (Latin subset about 23 KB) | NO tabular figures, case forms, frac, arrows 4 of 6, Latin 293 of 319 | Dalton Maag. Well made, no tabular figures. Passed over. |
| Wix Madefor Text | text grotesk | Dalton Maag | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/wixmadefortext) | wght 400 to 800 | 43 KB (Latin subset about 23 KB), italic 29 KB | NO tabular figures, case forms, frac, arrows 4 of 6, Latin 293 of 319 | Dalton Maag. Well made, no tabular figures. Passed over. |
| Young Serif | serif accent | Bastien Sozeau | OFL 1.1 | [source](https://github.com/google/fonts/tree/main/ofl/youngserif) | static, 1 file kept | 39 KB (Latin subset about 30 KB) | tnum, slashed zero, case forms, frac, arrows 0 of 6, Latin 317 of 319 | One heavy old style with a single-storey a. Rejected. |
| Zalando Sans | display and text grotesk, width axis | Jakob Ekelund, KH Type, Zalando | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/zalandosans) | wdth 75 to 125, wght 200 to 900 | 123 KB (Latin subset about 101 KB), italic 129 KB | tnum, case forms, frac, 3 stylistic sets, arrows 6 of 6, Latin 309 of 319 | 2025 release, Jakob Ekelund and KH Type. Width 75 to 125, weight 200 to 900; expanded cuts are elegant and expensive looking; tabular figures carry a slashed zero. Display and text of system "atelier". Reserved Font Name "Zalando". |
| Zalando Sans Expanded | wide display | Jakob Ekelund, KH Type, Zalando | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/zalandosansexpanded) | wght 200 to 900 | 58 KB (Latin subset about 46 KB), italic 60 KB | tnum, case forms, frac, 3 stylistic sets, arrows 6 of 6, Latin 309 of 319 | Static-width export of the same design. Not needed, the width axis file covers it. |
| Zalando Sans SemiExpanded | wide display | Jakob Ekelund, KH Type, Zalando | OFL 1.1, RFN | [source](https://github.com/google/fonts/tree/main/ofl/zalandosanssemiexpanded) | wght 200 to 900 | 59 KB (Latin subset about 47 KB), italic 61 KB | tnum, case forms, frac, 3 stylistic sets, arrows 6 of 6, Latin 309 of 319 | Static-width export of the same design. Not needed. |

## Systems

Eight complete systems were built as specimens. Each role map below is generated from the same file that built the specimen (`tools/type/systems.js`), so the numbers are exactly what the screenshots show. Sizes are for a 1440 wide page, with the 390 wide value after the slash. The name is sized so "Arav Jain" spans the content width (92 percent of the page) in every system, which is why its vw value differs.

Letters are the blind contact sheet letters.

### C. martian: wide engineered grotesk

Martian Grotesk for display and text, Martian Mono for labels, numbers and code. Both from Evil Martians, a developer tooling consultancy, and drawn as a pair.

Why it fits: this is the most engineered voice in the survey. Strokes are thick and almost perfectly even, curves are slightly squared, stroke ends are cut flat, which is the machined bed in letter form. At width 112 and weight 820 the name is the heaviest and most even of all eight, so the ice letters get the most body and the widest counters for light to refract through. The width axis runs from 75 to 200 and weight from 100 to 1000, so the name can change weight or width smoothly as it melts. Numbers are set in Martian Mono, which makes every live figure read as an instrument readout, and the provenance says developer tooling to anyone who inspects the page. Two files, about 205 KB before subsetting.

Weak points: long-form reading in Martian Grotesk is dense because the lowercase is very tall and wide; it needs width 90, weight 330 and leading 1.68 to stay comfortable, and it is still the least relaxed blog page of the top three. The grotesk has no tabular figures, so every number must be mono. It is less luxurious than atelier.

| Role | Face | Size at 1440 / 390 | Weight | Width | Tracking | Leading | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (hero and ice letters) | Martian Grotesk | 17.07vw / same | 820 | 112 | -0.045em | 0.9 |   |
| Takeaway line | Martian Grotesk | 25px / 19px | 420 | 100 | -0.018em | 1.2 |   |
| Project name | Martian Grotesk | 10.6vw / 13.4vw | 700 | 106 | -0.045em | 0.92 |   |
| Project description | Martian Grotesk | 20px / 17px | 350 | 94 | -0.008em | 1.46 |   |
| Label | Martian Mono | 10.5px / same | 500 | 100 | +0.05em | 1.3 | uppercase |
| Timestamp label | Martian Mono | 9.5px / same | 400 | 87.5 | +0.03em | 1.3 | uppercase |
| Metric number | Martian Mono | 56px / 36px | 520 | 87.5 | -0.06em | 1 |   |
| Metric unit | Martian Grotesk | 14px / same | 480 | 100 | -0.005em | 1.3 |   |
| Blog title | Martian Grotesk | 42px / 28px | 620 | 96 | -0.032em | 1.1 |   |
| Blog body | Martian Grotesk | 16.5px / 15.5px | 330 | 90 | 0 | 1.68 |   |
| Code | Martian Mono | 12.5px / same | 400 | 87.5 | 0 | 1.6 |   |
| Closing line | Martian Grotesk | 7.4vw / 11vw | 720 | 112 | -0.045em | 0.98 |   |

### F. atelier: expanded grotesk plus sharp serif

Zalando Sans (one variable file with width 75 to 125) for display and interface text, Newsreader for the takeaway line, blog titles, blog body and the closing line, Sometype Mono for labels and code.

Why it fits: three clearly different voices, each with one job. The expanded grotesk at width 125 gives the name the wide, calm, expensive stance of a fashion house or a car brand, with flat terminals and enough weight at 800 for ice. Newsreader is a sharp, modern news serif with an optical size axis; it turns the blog into something that reads like a publication and gives the closing line a human voice against all the machinery. Sometype Mono is a soft-shouldered mono that keeps labels technical without shouting. The tabular figures in Zalando Sans carry a slashed zero, so the readouts look like data with no extra work. In the dark theme this was the page that looked most like the references.

Weak points: a grotesk with a serif italic accent is a known award-site move, so it must be used sparingly to avoid looking borrowed. Setting the five-second takeaway in a serif softens "technical"; the bake-off should try it in Zalando Sans too. The joins in the wide 800 cut are thinner than Martian Grotesk's, so the ice is a little less massive. Zalando Sans has a Reserved Font Name. Heaviest payload of the top three (Newsreader roman and italic are large before subsetting).

| Role | Face | Size at 1440 / 390 | Weight | Width | Tracking | Leading | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (hero and ice letters) | Zalando Sans | 18.11vw / same | 800 | 125 | -0.048em | 0.9 |   |
| Takeaway line | Newsreader | 31px / 23px | 380 | n/a | -0.018em | 1.15 | opsz 36 |
| Project name | Zalando Sans | 10.6vw / 13.4vw | 560 | 125 | -0.045em | 0.94 |   |
| Project description | Zalando Sans | 20.5px / 17.5px | 400 | 100 | -0.006em | 1.46 |   |
| Label | Sometype Mono | 10.5px / same | 500 | n/a | +0.08em | 1.3 | uppercase |
| Timestamp label | Sometype Mono | 9.5px / same | 400 | n/a | +0.05em | 1.3 | uppercase |
| Metric number | Zalando Sans | 60px / 38px | 500 | 112 | -0.04em | 1 | tnum |
| Metric unit | Zalando Sans | 14.5px / same | 500 | 100 | 0 | 1.3 |   |
| Blog title | Newsreader | 52px / 34px | 480 | n/a | -0.022em | 1.04 | opsz 72 |
| Blog body | Newsreader | 20px / 18.5px | 400 | n/a | 0 | 1.56 | opsz 18 |
| Code | Sometype Mono | 14px / same | 400 | n/a | 0 | 1.6 |   |
| Closing line | Newsreader | 9vw / 13vw | 380 | n/a | -0.035em | 0.98 | italic, opsz 72 |

### A. orbiter: space agency geometric

TASA Orbiter for display and text, Spline Sans Mono for labels and code. TASA Orbiter was drawn in 2025 for the Taiwan Space Agency.

Why it fits: a clean geometric sans with thick, simple, confident shapes and square dots. It is the easiest of the eight to read at every size, and the only display face here with tabular figures, slashed zero and case forms all present, so one family covers the name, the big numbers and the blog. "Out of this world" is literal in its origin. The geometry (near-circular bowls, straight stems) casts into ice cleanly. Smallest payload: about 108 KB for both files before subsetting.

Weak points: it is the least distinctive of the top three. People have seen this kind of geometric sans on many technology brands, so the type alone will not make the site memorable; the water has to. Weights start at 400, so there is no light cut for very large quiet lines. No width axis.

| Role | Face | Size at 1440 / 390 | Weight | Width | Tracking | Leading | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (hero and ice letters) | TASA Orbiter | 24.48vw / same | 800 | n/a | -0.052em | 0.9 |   |
| Takeaway line | TASA Orbiter | 26px / 20px | 450 | n/a | -0.02em | 1.2 |   |
| Project name | TASA Orbiter | 12vw / 15.4vw | 650 | n/a | -0.052em | 0.94 |   |
| Project description | TASA Orbiter | 21px / 17.5px | 400 | n/a | -0.01em | 1.45 |   |
| Label | Spline Sans Mono | 10.5px / same | 500 | n/a | +0.08em | 1.3 | uppercase |
| Timestamp label | Spline Sans Mono | 9.5px / same | 400 | n/a | +0.05em | 1.3 | uppercase |
| Metric number | TASA Orbiter | 64px / 40px | 560 | n/a | -0.045em | 1 | tnum |
| Metric unit | TASA Orbiter | 14.5px / same | 500 | n/a | 0 | 1.3 |   |
| Blog title | TASA Orbiter | 44px / 29px | 650 | n/a | -0.034em | 1.08 |   |
| Blog body | TASA Orbiter | 18px / 16.5px | 400 | n/a | -0.004em | 1.62 |   |
| Code | Spline Sans Mono | 14px / same | 400 | n/a | 0 | 1.6 |   |
| Closing line | TASA Orbiter | 8.2vw / 12vw | 720 | n/a | -0.052em | 0.98 |   |

### D. swiss: restrained neo-grotesk

Uncut Sans for everything, Fragment Mono for labels and code.

Why it fits: this is the Lusion and Linear approach. One neutral family, moderate weights (480 to 620 on display instead of 800), very tight tracking, and scale doing the work. Uncut Sans is refined, has tabular figures, slashed zero, case forms and nine stylistic sets. Fragment Mono is a Helvetica-flavoured mono that matches it closely. It will never look wrong.

Weak points: it is the closest to what the earlier versions were faulted for. Neutral neo-grotesks are what most developer sites use, so it reads as competent, not as special. Maximum weight is 700, the thinnest name of the sans systems. Kept as the reserve.

| Role | Face | Size at 1440 / 390 | Weight | Width | Tracking | Leading | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (hero and ice letters) | Uncut Sans | 23.67vw / same | 700 | n/a | -0.058em | 0.9 |   |
| Takeaway line | Uncut Sans | 26px / 20px | 420 | n/a | -0.02em | 1.2 |   |
| Project name | Uncut Sans | 12.6vw / 16vw | 520 | n/a | -0.055em | 0.94 |   |
| Project description | Uncut Sans | 21px / 17.5px | 400 | n/a | -0.012em | 1.42 |   |
| Label | Fragment Mono | 10.5px / same | 400 | n/a | +0.06em | 1.3 | uppercase |
| Timestamp label | Fragment Mono | 9.5px / same | 400 | n/a | +0.03em | 1.3 | uppercase |
| Metric number | Uncut Sans | 64px / 40px | 480 | n/a | -0.05em | 1 | tnum |
| Metric unit | Uncut Sans | 14.5px / same | 500 | n/a | -0.005em | 1.3 |   |
| Blog title | Uncut Sans | 44px / 29px | 560 | n/a | -0.034em | 1.08 |   |
| Blog body | Uncut Sans | 18px / 16.5px | 380 | n/a | -0.004em | 1.6 |   |
| Code | Fragment Mono | 13.5px / same | 400 | n/a | 0 | 1.6 |   |
| Closing line | Uncut Sans | 8.6vw / 12.4vw | 620 | n/a | -0.055em | 0.98 |   |

### H. notch: machined cuts in the joints

Stack Sans Notch for the name only, Stack Sans Headline for other display, Stack Sans Text for reading, Commit Mono for labels and code. Stack Sans was drawn by Koto for Stack Overflow in 2025.

Why it fits: the Notch cut has small angled cuts where strokes join and a slanted dot on the i. At hero size those read as chisel marks in stone, and in ice they would become channels for meltwater. The developer provenance is as direct as it gets.

Weak points: below about 80px the notches look like a rendering fault (the crossbar of "e" appears broken), so the cut is only safe on the name. The text cut is heavy for its weight number and reads darker than the others even at 300. No slashed zero. Weights stop at 700.

| Role | Face | Size at 1440 / 390 | Weight | Width | Tracking | Leading | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (hero and ice letters) | Stack Sans Notch | 24.2vw / same | 700 | n/a | -0.04em | 0.9 |   |
| Takeaway line | Stack Sans Text | 25px / 19.5px | 360 | n/a | -0.014em | 1.2 |   |
| Project name | Stack Sans Headline | 12.6vw / 16vw | 600 | n/a | -0.045em | 0.94 |   |
| Project description | Stack Sans Text | 20.5px / 17px | 340 | n/a | -0.008em | 1.46 |   |
| Label | Commit Mono | 11px / same | 500 | n/a | +0.06em | 1.3 | uppercase |
| Timestamp label | Commit Mono | 10px / same | 400 | n/a | +0.03em | 1.3 | uppercase |
| Metric number | Stack Sans Headline | 66px / 42px | 520 | n/a | -0.045em | 1 | tnum |
| Metric unit | Stack Sans Text | 14.5px / same | 500 | n/a | 0 | 1.3 |   |
| Blog title | Stack Sans Headline | 44px / 29px | 560 | n/a | -0.022em | 1.08 |   |
| Blog body | Stack Sans Text | 17.5px / 16px | 300 | n/a | 0 | 1.64 |   |
| Code | Commit Mono | 14px / same | 400 | n/a | 0 | 1.6 |   |
| Closing line | Stack Sans Headline | 8.6vw / 12.4vw | 640 | n/a | -0.045em | 0.98 |   |

### G. flex: one superfamily, many axes

Google Sans Flex for display and text, Google Sans Code for labels and code.

Why it fits: one file does everything through five axes: weight 1 to 1000, width 25 to 151, optical size 1 to 144, slant and roundness. The roundness axis is the interesting one for this site: the name could go from sharp corners to fully rounded as the ice melts, which no other candidate can do.

Weak points: the file is 1.4 MB as shipped and still about 1.1 MB as a Latin subset with all axes kept, so it would need axis trimming. The round dots and friendly curves say Google and consumer product, not enterprise tooling. The names are Google trademarks. TikTok Sans (Grilli Type, width 75 to 150, optical size, 341 KB) is a better drawn alternative for a one-family system and is on the reserve list.

| Role | Face | Size at 1440 / 390 | Weight | Width | Tracking | Leading | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (hero and ice letters) | Google Sans Flex | 16.38vw / same | 780 | 124 | -0.04em | 0.9 | opsz 144, ROND 0 |
| Takeaway line | Google Sans Flex | 26px / 20px | 420 | 100 | -0.012em | 1.2 |   |
| Project name | Google Sans Flex | 11.4vw / 14.6vw | 640 | 112 | -0.035em | 0.94 | opsz 144 |
| Project description | Google Sans Flex | 21px / 17.5px | 400 | 100 | -0.004em | 1.45 |   |
| Label | Google Sans Code | 10.5px / same | 500 | n/a | +0.07em | 1.3 | uppercase |
| Timestamp label | Google Sans Code | 9.5px / same | 400 | n/a | +0.04em | 1.3 | uppercase |
| Metric number | Google Sans Flex | 66px / 42px | 560 | 88 | -0.03em | 1 | opsz 96, tnum, zero |
| Metric unit | Google Sans Flex | 14.5px / same | 500 | 100 | 0 | 1.3 |   |
| Blog title | Google Sans Flex | 44px / 29px | 600 | 100 | -0.025em | 1.08 | opsz 48 |
| Blog body | Google Sans Flex | 18px / 16.5px | 400 | 100 | 0 | 1.62 |   |
| Code | Google Sans Code | 14px / same | 400 | n/a | 0 | 1.6 |   |
| Closing line | Google Sans Flex | 7.8vw / 11.4vw | 700 | 120 | -0.04em | 0.98 | opsz 144 |

### E. monolith: compressed monumental

Big Shoulders for display, IBM Plex Sans for text, IBM Plex Mono for labels and code.

Why it fits: tall, flat-sided, heavy letters that look cut from a block, set in capitals for project names and the closing line. IBM Plex Mono is the face igloo.inc draws everything in.

Weak points: compressed type is loud and vertical, and it fights the calm horizontal flow of water. The name ends up very tall with narrow counters, which gives the ice less interior to show. Big Shoulders has no tabular figures, so the specimen fakes them with fixed-width digit cells. The overall feel is sport or poster, not fluid. Plex reads as IBM.

| Role | Face | Size at 1440 / 390 | Weight | Width | Tracking | Leading | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (hero and ice letters) | Big Shoulders | 26.28vw / same | 900 | n/a | -0.012em | 0.84 | opsz 72 |
| Takeaway line | IBM Plex Sans | 24px / 18.5px | 400 | n/a | -0.012em | 1.25 |   |
| Project name | Big Shoulders | 19vw / 24vw | 800 | n/a | -0.005em | 0.84 | uppercase, opsz 72 |
| Project description | IBM Plex Sans | 21px / 17.5px | 400 | n/a | -0.008em | 1.45 |   |
| Label | IBM Plex Mono | 11px / same | 500 | n/a | +0.08em | 1.3 | uppercase |
| Timestamp label | IBM Plex Mono | 10px / same | 400 | n/a | +0.04em | 1.3 | uppercase |
| Metric number | Big Shoulders | 84px / 60px | 800 | n/a | 0 | 0.9 | opsz 72, digits in 0.44em cells |
| Metric unit | IBM Plex Sans | 14.5px / same | 500 | n/a | 0 | 1.3 |   |
| Blog title | Big Shoulders | 60px / 40px | 760 | n/a | 0 | 0.98 | opsz 60 |
| Blog body | IBM Plex Sans | 18px / 16.5px | 400 | n/a | -0.003em | 1.62 |   |
| Code | IBM Plex Mono | 14px / same | 400 | n/a | 0 | 1.6 |   |
| Closing line | Big Shoulders | 13.5vw / 19vw | 900 | n/a | -0.008em | 0.86 | uppercase, opsz 72 |

### B. instrument: mono-forward readout system

Azeret Mono for the name, project names, numbers, labels and code; Hanken Grotesk for reading text.

Why it fits: it commits to the idea that the whole site is an instrument. The name is a monospaced nameplate with slab details, every number is naturally tabular with a slashed zero, and the grotesk only appears where there are paragraphs to read.

Weak points: at hero size a heavy mono reads as terminal or indie hacker, not as enterprise. The fixed letter widths leave uneven gaps in "Arav Jain" even with tracking at -0.075em and the word space pulled in. It was the weakest name on both sheets.

| Role | Face | Size at 1440 / 390 | Weight | Width | Tracking | Leading | Extras |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Name (hero and ice letters) | Azeret Mono | 18.78vw / same | 800 | n/a | -0.075em | 0.9 | word space -0.3em |
| Takeaway line | Azeret Mono | 21px / 15.5px | 480 | n/a | -0.03em | 1.25 |   |
| Project name | Azeret Mono | 9.6vw / 12.2vw | 700 | n/a | -0.075em | 0.94 |   |
| Project description | Hanken Grotesk | 21px / 17.5px | 420 | n/a | -0.008em | 1.45 |   |
| Label | Azeret Mono | 10.5px / same | 500 | n/a | +0.06em | 1.3 | uppercase |
| Timestamp label | Azeret Mono | 9.5px / same | 400 | n/a | +0.03em | 1.3 | uppercase |
| Metric number | Azeret Mono | 54px / 34px | 620 | n/a | -0.07em | 1 | zero |
| Metric unit | Hanken Grotesk | 14.5px / same | 520 | n/a | 0 | 1.3 |   |
| Blog title | Hanken Grotesk | 44px / 29px | 660 | n/a | -0.03em | 1.08 |   |
| Blog body | Hanken Grotesk | 18px / 16.5px | 400 | n/a | 0 | 1.62 |   |
| Code | Azeret Mono | 13px / same | 400 | n/a | -0.01em | 1.6 |   |
| Closing line | Azeret Mono | 6.2vw / 9.4vw | 700 | n/a | -0.075em | 1 | word space -0.25em |

### Payload at a glance

| Letter | System | Files loaded by the specimen | Full woff2 | Latin subset estimate | Breakdown (KB, full) |
| --- | --- | --- | --- | --- | --- |
| C | martian | 2 | 206 KB | about 132 KB | Martian Grotesk 145, Martian Mono 62 |
| E | monolith | 6 | 722 KB | about 479 KB | Big Shoulders 124, IBM Plex Sans 225, IBM Plex Sans Italic 257, IBM Plex Mono 38, IBM Plex Mono 39, IBM Plex Mono 40 |
| G | flex | 2 | 1475 KB | about 1127 KB | Google Sans Flex 1418, Google Sans Code 57 |
| F | atelier | 5 | 723 KB | about 644 KB | Zalando Sans 123, Zalando Sans Italic 129, Newsreader 210, Newsreader Italic 234, Sometype Mono 27 |
| B | instrument | 3 | 160 KB | about 134 KB | Azeret Mono 46, Hanken Grotesk 56, Hanken Grotesk Italic 59 |
| H | notch | 4 | 235 KB | about 167 KB | Stack Sans Notch 49, Stack Sans Headline 50, Stack Sans Text 50, Commit Mono 85 |
| A | orbiter | 2 | 109 KB | about 86 KB | TASA Orbiter 51, Spline Sans Mono 57 |
| D | swiss | 2 | 121 KB | about 85 KB | Uncut Sans 76, Fragment Mono 45 |

Italic files have no subset estimate and are counted at full size. Atelier loads Zalando Sans Italic in the specimen CSS but never uses it; production can drop it (or use the upstream file, whose slnt axis replaces it).

## Pre-bake-off read

My own ranking after looking at the audition sheets, both contact sheets, both reading sheets, the mobile montage and full pages in Chromium and WebKit. It is not blind, since I built the systems.

1. **atelier (F).** The most expensive looking page, especially in the dark theme, and the best long-form reading by a clear margin. Three voices with clean jobs. The wide name is elegant and still solid. Risks: the serif-accent trope, the serif takeaway line, and the Reserved Font Name.
2. **martian (C).** The strongest name for ice (heaviest, most even strokes) and the most convincing "developer tooling" voice. Mono numerals look like real instruments. Risks: blog reading is dense, and the feel is engineered more than luxurious.
3. **orbiter (A).** The cleanest all-rounder with the best feature coverage and the smallest files. A thick, simple name. Risk: it is the least memorable of the three.
4. **swiss (D).** Refined and safe. Too close to the neutral look that earlier versions were faulted for. Reserve.
5. **notch (H).** A distinctive name, but the notch reads as a defect at medium sizes and the text cut is heavy.
6. **flex (G).** Technically the most capable, but it looks like Google and weighs over a megabyte.
7. **monolith (E).** Striking in isolation, wrong for a fluid world, and has no tabular figures.
8. **instrument (B).** A mono name does not reach the finish the owner asked for.

Recommended for the in-site bake-off: **atelier, martian, orbiter**.

Things the bake-off should settle, since a static specimen cannot:

- How each name looks as actual ice. Martian Grotesk at width 112, weight 820 should cast best; check whether Zalando Sans at width 125, weight 800 has joins that are too thin once refraction is added, and try weight 860 to 900 if so.
- The takeaway line in atelier, serif against sans. I expect sans (Zalando Sans, 26px, weight 420) to win for "technical" and the serif to stay for blog and closing line only.
- A hybrid worth one extra round if martian wins the name but loses on reading: Martian Grotesk and Martian Mono everywhere, with Newsreader for blog body only.
- Dark theme weights. The specimens use the same weights in both themes; reading text should drop 20 to 30 units in dark.
- Numbers that count up. All three recommended systems have steady digits (mono, tabular with slashed zero, tabular with slashed zero).
- Subsetting. Full files were used here. Production should subset to Latin and, for Zalando Sans, either use the upstream woff2 as is or rename the family.

Known limits of this pass: specimens are flat colour grounds with no water behind the type; "Scroll to melt" and the closing sentence are placeholder words; body copy is two paragraphs of the real post chosen because they contain inline code; hero fitting was measured in Chromium and reused in WebKit, where no overflow was detected in any of the 64 screenshots.

## Bake-off (in the real v4 pages)

## Blind ranking

## The pick
