# Design review

Captures for every round are outside git in `~/.t3/portfolio-redesign-v3/rounds/<n>/` (all pages, Chromium, WebKit and Firefox at 1440, 1024, 768 and 390, plus an iPhone 15 WebKit profile). References are in `~/.t3/portfolio-redesign-v3/references/`.

## Round 1: first complete build

Compared with the Igloo and Lando sheets and the Noomo glass captures.

| Finding | Fix |
|---|---|
| The hero drop was an opaque lavender ball. Nothing was refracted, and the colour was close to violet, which is banned. | Removed the coloured inner glow on light grounds, changed the form from an ellipsoid to a pebble with two nearly flat faces so the middle shows the type and the rim bends it, moved it onto the name. |
| Display words overflowed the viewport (18,284, TensorPoW, cc-switch). | Measured every line's width in em in a real browser and set each word's fit from that. |
| The Agent Bridge title never appeared. | The split entrance had higher specificity than the entered state. Fixed the selector. |
| Forms kept the yaw of whichever beat spun last, so the contact drop showed edge on. | Scenes that do not spin unwind to the nearest full turn. |
| Mobile: panes covered the titles, 17px horizontal overflow. | Title at the top, the drop in its own band, the pane at the bottom. Overflow clipped at the root and the offscreen entrance offsets fixed. |
| Home was 274 words. | Cut to 196 visible words (195 at 390). |

## Round 2: material and legibility

| Finding | Fix |
|---|---|
| Glass on Ink looked like brown plastic because it refracted the orange colour field. | Swapped the colour fields on Ink, added a cool rim light scaled to the ground, raised reflections. |
| Blink panes showed frost but little edge refraction. | Less blur inside the filter (9 to 5), deeper bezel, larger displacement, per-channel scales 1 / 1.14 / 1.28. Letters now visibly bend at the pane edge. |
| First Lighthouse run scored 71 on home (one 880ms task). | Traced to a cold shader compile on first ever load. Collapsed the shader's inlined call sites (one loop for the three blended forms, one loop for normals). Warm and repeat runs score 99 to 100. |
| Under a software rasteriser every frame took 320ms. | The renderer string is checked before boot and software GL gets the CSS glass. A watchdog also stands the engine down if the lowest quality tier cannot hold frame rate. |
| Text on glass measured as low as 3.3:1 on the More chips and 3.28:1 on one dark pane in Firefox. | Denser tint for glass buttons that sit on the ground, darker chips and stronger tint on dark glass. Worst measured case is now 5.0:1 in all three engines. |

## Independent critique (fresh agent, round 2 captures plus the live site)

Scores before fixes: overall 7, polish 6.5, glass realness 6.5, glass prominence 8, motion 7, typography 7, originality 7.5, content clarity 6.5, mobile 5.5, cross-browser 8. Verdict: "SOTD: close, not yet."

| Critic finding | What was done |
|---|---|
| 1. Contact drop hid the headline. | Parked to the lower right, clear of the type. |
| 2. Glass crossed titles and the 18,284 figure at rest; on mobile it buried them. | Repositioned per beat; on mobile the drop has its own band and is smaller. Project pages park it above the title end. |
| 3. Empty frames between beats, muddy mid-blend grounds. | Beat entrances now overlap (next arrives at 72%, previous leaves at 45%), beats shortened from 170 to 150svh, grounds change over the middle third only. |
| 4. Glass read as milky porcelain on empty light grounds. | Environment now has two coloured cards and a second strip light to reflect, stronger fresnel, more absorption with depth and a darker rim on light grounds. Improved, not solved: see gaps. |
| 5. Refraction softer than live type at 2x. | Type mask resolution raised from 1x to up to 1.5x device pixels. |
| 6. DOM glass looked like white pills on light grounds. | Bevelled rim (bright upper left, cobalt lower right), faint signal fringe, thickness shading. Edge refraction stays Blink only. |
| 7. Mobile hero and contact composition. | Drop centred on the "av/Ja" junction; on contact it fills the gap between headline and links. |
| 8. On /work the glass floated over rows. | It scrolls away with the page header and docks in the right gutter while a row is hovered. The "hover a row" sentence was removed. |
| 9. Project pages are thin. | Not addressed beyond the parked form and shared-element title. Listed as a gap. |
| 10. Count-ups showed false numbers mid-scroll. | Count-ups removed. Numbers only ever show the real value. |
| 11. Nav pill sat on article text. | Nav steps aside on scroll down on inner pages. |
| 12. Copy count. | 196 visible words. The critic's 227 included visually hidden headings and the skip link. |
| 13. No mid-scale type. | Pane lead copy raised from 20 to 24px, panes widened. |
| 16. Blog index looked abandoned with one post. | Posts are full-width feature rows. |
| 14, 15, 17, 18 (DOM does little in route changes, drag is under-rewarded, mobile menu is plain, scroll length). | 18 partly (beats shortened). The rest are open. |

## Round 3: after the critic fixes

Re-ran all 78 page and viewport checks in three engines plus reduced motion in three engines. No overflow, no console errors, WebGL active everywhere. Contrast re-measured. Lighthouse re-run.

## Round 4: final pass and second critique

See the end of this file.

### Second independent critique (fresh agent, round 4 captures plus the live site)

Scores after fixes: overall 7.5 (was 7), polish 6.5 (6.5), glass realness 7.5 (6.5; WebGL forms 8.5, DOM panes 5), glass prominence 8 (8), motion 7 (7), typography 8 (7), originality 7.5 (7.5), content clarity 8.5 (6.5), mobile 7 (5.5), cross-browser 9 (8). Verdict unchanged: "SOTD: close, not yet."

| Second-pass finding | What was done |
|---|---|
| "Open source" project title ran off the right edge. | Title fit corrected for every project name. |
| Repo names overprinted the merged counts on /work/open-source. | Wider key column, names break at the slash. |
| Buttons lost their label for a moment when the ground flipped mid-scroll; a ghost of the next pane showed early. | Panes now leave before the ground changes and arrive after it has settled. |
| Nav pill sat on display type and panes mid-scroll on home. | The bar steps aside on scroll down everywhere, not only on inner pages. |
| Route change showed both pages superimposed. | The old page is gone (150ms) before the new one starts to arrive. |
| 404: the form covered the last digit. | Moved clear of the number. |
| `/favicon.ico` returned 404. | Rewritten to the SVG icon. |
| DOM panes read as white cards on light grounds; no edge refraction visible at 2x on some panes. | Open. The pane fill cannot go much lower without failing AA over the black display type behind it. See gaps. |
| Drop interior is still flat on empty light grounds (post page, /work at 1440). | Open. |
| Mobile menu is plain; some composition holes at 390 (hero gap, 404 top third). | Open. |

## Honest answers to the brief's questions

- **Would it win SOTD?** Two independent critics said "close, not yet". The home scroll is the strongest part; inner pages are quieter than the references.
- **Is the glass real?** The drop is: refraction on entry, a marched interior path, a separate exit ray per colour channel, fresnel reflection, specular, absorption. The panes bend their backdrop only in Blink (SVG displacement with per-channel scales); WebKit and Firefox get blur, saturation, bevel and rim.
- **Does every section feel fluid?** Every home beat does. Project pages and the blog are composed and transition well but do not have their own scroll choreography.
- **Is it consistent?** One type family, four grounds, one light direction, one set of motion tokens.
- **Too much text?** Home is 196 visible words.
- **Does it show everything?** Eight flagships on the stage, RydAR and seven highlights on /work, seventeen archive lines, press and the essay.
