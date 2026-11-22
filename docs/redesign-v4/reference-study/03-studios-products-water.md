# Reference study 03: studios, product sites and real-time water

Captured 15 Nov 2026 with Playwright 1.65.1: Chromium 159 (ANGLE Metal, Apple M4, hardware GL confirmed through `WEBGL_debug_renderer_info`) and WebKit 27.2 at 1440 x 900, Chromium at 390 x 844 (DPR 3, touch, iPhone user agent). Method per site: wait for the loader, wheel in 90 px steps, JPEG (quality 80) every half viewport, Chromium scroll video, hover and focus pass that reads running `CSSTransition` objects through `document.getAnimations()`, then a scripted interaction pass (gates, menus, drags, inner pages). An init script hooks `shaderSource`, `createShaderModule`, `texImage2D`, `texStorage2D`, `getExtension` and `getContext`, so shader text, render target sizes and context attributes are first-hand. Typography comes from `document.fonts` plus computed styles of every visible text node.

Evidence: `~/.t3/portfolio-redesign-v4/references/<site>/` with `chromium-1440/`, `webkit-1440/`, `chromium-390/`, `video/`, `best/` and `data/` (typography, network, hover and shader JSON). Scripts: `~/.t3/portfolio-redesign-v4/tools/refs-c/`. Nothing from any site (fonts, images, palettes, shader files) is in the repo, and nothing here should be copied; the notes describe technique only.

Technique-only caveats that apply to every section: letter-spacing is reported in px as computed, with the em ratio in brackets; "w510" means computed font-weight 510; durations are measured values, not design intent.

Sites: Part 1 is linear.app, raycast.com, resend.com, activetheory.net, unseen.co, kprverse.com, jesperlandberg.com. Part 2 (found for this study) is bruno-simon.com, mont-fort.com, astrodither.robertborghesi.is, plus two that were studied and turned out to be weak matches, fluid.glass and morphowater.com.

---

## linear.app

### What makes it world-class
- One sans family for everything, with only four weights (300, 400, 510, 590) and one tracking rule: about -0.022em on headings, -0.011em on body, 0 on 12 px and below.
- The product is the illustration. Every figure is live DOM built from the real UI (issue lists, a diff view, a thread, a cycle chart), not screenshots, so numbers and labels stay sharp at any DPR and can animate.
- Interaction feedback is 100 to 160 ms everywhere. Nothing on hover takes longer than 200 ms.
- No canvas, no scroll library, no scroll hijack. Document height 9990 px at 1440, 5936 px at 390; a 400 px wheel moves the page 400 px in the same frame.

### Scene and shaders
None. Zero canvases and zero shaders in all three captures. Motion is CSS: 99 `@keyframes`, 97 `prefers-reduced-motion` rules, 186 `color-mix()` uses, View Transitions referenced. Hero grid dots are SVG circles on a 2.8 s linear keyframe loop.

### Scroll and motion (measured)
- Scroll: native, no smoothing (scrollY reaches target at t = 0 ms after the wheel event).
- Nav link hover: `color 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94), background 0.1s` same curve. Colour rgb(138, 143, 152) to rgb(247, 248, 248), background transparent to rgba(255, 255, 255, 0.08), pill radius 9999 px, height 32 px, padding 0 12 px.
- Primary button (Sign up): `background-color 0.16s cubic-bezier(0.25, 0.46, 0.45, 0.94)`, rgb(229, 229, 230) to rgb(255, 255, 255). Announcement link: `filter 0.16s`, to `brightness(1.3)`.
- Sidebar rows in the product mock: background to rgba(255, 255, 255, 0.02) or 0.03 in 160 ms.
- Duration histogram across all CSS: 0.16 s (59 uses), 0.2 s (37), 0.12 s (29), 0.15 s (21), 0.18 s (18), 0.3 s (17), 0.1 s (12). Longer moves (0.7 s) are reserved for SVG diagram transforms on `cubic-bezier(0.32, 0.72, 0, 1)`.
- Easing set: `(0.25, 0.46, 0.45, 0.94)` for almost everything, `(0.32, 0.72, 0, 1)` for large transforms, `(0.165, 0.84, 0.44, 1)` for a few filters.
- Focus: `outline: 1px solid rgb(94, 105, 209)`, `outline-offset: 2px`, follows the element radius, shown on `:focus-visible` only.
- Press: no scale change measured on nav items.

### Typography
Families: Inter Variable (100 to 900, `font-feature-settings: "cv01", "ss03"`), Berkeley Mono (variable) for code and dates, Tiempos Headline 400 declared for quotes. `-webkit-font-smoothing: antialiased`, `text-rendering: optimizeLegibility`, `text-wrap: balance` on section headings.

| Role | 1440 | 390 |
|---|---|---|
| Hero h1 | 64 / 64, w510, -1.408 px (-0.022em) | 38 / 41.8, w510, -0.836 px |
| Closing headline | 72 / 72, w510, -1.584 px | 38 / 41.8 |
| Section h2 | 48 / 48, w510, -1.056 px | 24 / 31.92, w510, -0.288 px |
| Lead paragraph | 24 / 31.92, w400, -0.288 px (-0.012em) | 24 / 31.92 |
| Card h3 | 20 / 26.6, w590, -0.24 px | same |
| Body | 15 / 24, w400, -0.165 px (-0.011em), rgb(138, 143, 152) | same |
| Nav, footer links | 13 / 19.5, w400, 0 | 13 |
| UI labels | 13 / 19.5, w510, -0.13 px; 12 / 14, w510, 0 | same |
| Mono | Berkeley Mono 14 / 24 and 12, w400 | 10 / 14 |

### Nav, footer, numbers, glass, colour scheme
- Nav: fixed, 73 px, background `linear-gradient(rgba(11, 11, 11, 0.8), rgba(...0.76))` with `backdrop-filter: blur(20px)` and a 1 px bottom border at white 8 percent. Logo left, six links and two actions right. Hovering Product or Resources opens a panel (captured in `best/c1440-ix-nav-product.jpg`).
- Footer: 524 px, six columns, 46 links at 13 px, column titles 13 px w510, no oversized wordmark.
- Numbers: issue ids and dates use `font-variant-numeric: tabular-nums` (some with `lining-nums`), 12 or 13 px, in the secondary grey rgb(138, 143, 152); changelog dates are Berkeley Mono 12 px. No big stat counters anywhere on the home page; the only headline figure is in running text at body size.
- Glass: secondary button is `rgba(255, 255, 255, 0.05)` with `backdrop-filter: blur(4px)` and a four-layer shadow: inset 0 0 0 1 px white 3 percent, inset 0 1 px 0 white 4 percent (top light), 0 0 0 1 px black 60 percent (outer ring), 0 4 px 4 px black 10 percent. Depth comes from the ring pair, not from blur.
- Colour scheme: dark only. `data-theme="dark"`, inline `color-scheme: dark`, body rgb(8, 9, 10), text rgb(247, 248, 248). Emulating `prefers-color-scheme: light` changes nothing. Three text greys: 247, 208 to 214, 138 to 152, plus 98 to 109 for tertiary.

### How text stays legible
Text never sits on imagery. Product mocks are dimmed toward the page background with gradient masks at their edges so headings above them keep a clean field.

### What v4 should take
- The four-weight scale with optical weights 510 and 590 in place of 500 and 600, and one tracking formula.
- 100 to 160 ms hover timings on one ease-out curve, with a separate slower curve reserved for large moves.
- Tabular numerals in a secondary colour for any live figure; mono only for dates and ids.
- The two-ring glass edge (inner light ring plus outer dark ring) for any panel that floats over the water.
- `:focus-visible` outline 1 px with 2 px offset in an accent colour.

### Could not access
Authenticated app. Nav dropdown transition timing was not isolated (panel captured as a frame only).

---

## raycast.com

### What makes it world-class
- A floating pill nav with a physical edge: gradient fill, 5 px backdrop blur, 1 px border at white 6 percent and an inset top highlight at white 15 percent.
- One hero object in WebGL (refractive glass bars) and everything else in DOM, including a full interactive keyboard whose keys animate with custom property transitions.
- Buttons are built from stacked shadows that imitate a keycap: dark outer ring, soft outer glow, dark inset bottom line, white inset top line.
- Dark only, with display P3 colours where supported (19 `display-p3` uses).

### Scene and shaders
- three.js r186, one WebGL2 canvas inside the hero, 1920 x 1432 backing for 1200 x 895 CSS at DPR 1 (1.6x); 2400 x 1790 in WebKit; 624 x 894 for 390 x 559 on the phone (1.6x of CSS, not 3x). Context: `antialias: true`, `powerPreference: "high-performance"`.
- Six shaders. The glass uses the transmission material pattern from the react-three ecosystem: uniforms `chromaticAberration`, `anisotropicBlur`, `distortion`, `distortionScale`, `temporalDistortion`, `buffer`, with one 1024 x 1024 RGBA16F offscreen buffer that the glass samples for its refraction, plus `ior`, `thickness`, `dispersion`, `iridescence`, `clearcoat`. A custom background shader takes `uColor1` to `uColor3`, `uSpeed`, `uSize`.
- Draw count is low (about 420 draw calls over the whole capture session), so the hero costs little once idle.

### Scroll and motion (measured)
- Scroll: native, no smoothing. Document 15932 px at 1440, 15940 px at 390.
- Nav link hover: `color 0.2s ease-in-out`, rgb(156, 156, 157) to white.
- Download button: `background-color 0.2s, box-shadow 0.2s ease-in-out, transform 0.1s ease-in-out`; rgb(230, 230, 230) to white.
- Keyboard keys: `opacity 0.4s, box-shadow 0.2s, transform 0.2s, color 0.2s, --key-bg-start-color 0.4s, --key-bg-end-color 0.4s` on `cubic-bezier(0.23, 1, 0.32, 1)` (registered custom properties, so gradients tween).
- Duration histogram: 0.3 s (143), 0.2 s (123), 0.15 s (56), 0.1 s (27), 0.5 s (20). Easing set: `(0.23, 1, 0.32, 1)` 21 uses, `(0.4, 0, 0.2, 1)` 17, `(0.165, 0.84, 0.44, 1)` 10, `(0.16, 1, 0.3, 1)` 8.
- Focus: browser default ring, `1px auto rgb(153, 200, 255)`, offset 1 px.
- 18 reduced-motion rules, 102 keyframes.

### Typography
Families: Inter variable (100 to 900, features `"calt", "kern", "liga", "ss03"`; the h1 uses `"liga" 0, "ss02", "ss08"`), Geist Mono variable, JetBrains Mono variable (100 to 800), SF Pro Text for keycap glyphs. Instrument Serif and VT323 are declared but not loaded on the home page.

| Role | 1440 | 390 |
|---|---|---|
| Hero h1 | 64 / 70.4, w600, 0 | 36 / 39.6, w600 |
| Feature display h3 | 56 / 65.6, w400, +0.2 px | not sampled |
| Section h2 (large) | 32 / 38.4, w500, -0.8 px (-0.025em) | 32 / 38.4 |
| Section h2 (small) | 20, w500, +0.2 px | 20 |
| Lead | 18, w400, +0.2 px, `text-wrap: balance` | 18 / 28.8, w500, +0.2 px |
| Quote | 20 / 32, w500, rgb(106, 107, 108) with white emphasis | same |
| Nav and buttons | 14, w500 | 14 |
| Mono label | Geist Mono 12 / 19.2, +0.2 px | Geist Mono 10, w300, +0.5 px, uppercase |

Raycast tracks slightly positive (+0.2 px) on body and small headings, the opposite of Linear, and relies on weight 500 and 600 for density.

### Nav, footer, numbers, glass, colour scheme
- Nav: floating bar, radius 16 px, `linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)`, `backdrop-filter: blur(5px)`, border 1 px rgba(255, 255, 255, 0.06), `box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15)`.
- Download button: rgb(230, 230, 230), radius 8 px, padding 8 px 12 px, shadow stack `0 0 0 2px rgba(0, 0, 0, 0.5), 0 0 14px rgba(255, 255, 255, 0.19), inset 0 -1px 0.4px rgba(0, 0, 0, 0.2), inset 0 1px 0.4px #fff`.
- Material windows: `backdrop-filter: blur(30px)` over a 96 to 98 percent opaque gradient; lighter panels use `blur(24px) saturate(1.5)` over white 12 to 15 percent; app windows use `blur(36px)` with rgba(158, 190, 215, 0.1), border rgba(142, 140, 144, 0.2), shadow `0 4px 40px 8px rgba(0, 0, 0, 0.4), 0 0 0 0.5px rgba(0, 0, 0, 0.8), inset 0 0.5px 0 rgba(255, 255, 255, 0.3)`. Blur values in CSS: 10 px (26 uses), 2 px (20), 20 px (12), 8 px (10), 25 px (8).
- Numbers: none presented as statistics on the home page. Numeric text is keycaps (SF Pro Text 16 and 32 px, w500) and hex colours (Inter 13 px). One `tabular-nums` use.
- Footer: six link columns plus a newsletter field, then the hero shader repeated behind the last call to action.
- Colour scheme: dark only, body rgb(7, 8, 10); light emulation changes nothing.

### How text stays legible
The hero headline sits directly over the red glass bars. The bars are darkest and most blurred in the centre band where the headline sits, bright only toward the edges, and a radial dark vignette fades the canvas into the page background.

### What v4 should take
- The four-layer keycap shadow for the one primary action.
- Inset top highlight plus low-alpha border as the glass edge; blur stays small (2 to 10 px) on small elements and 24 to 36 px only on large panels.
- Registered custom properties so gradient stops can transition.
- Cap canvas DPR near 1.6 for a soft, refractive subject.
- Composition rule for text on a canvas: keep the busiest, brightest part of the effect away from the text block and vignette to the page colour.

### Could not access
The desktop app itself. Footer was read from frames, not from a `footer` element (the page does not use one).

---

## resend.com

### What makes it world-class
- A three-family display system: a serif (Domaine) for the two brand statements, a tight grotesque (ABC Favorit) for section headings, Inter for body, Commit Mono for code. Each has one job.
- Code is content: API samples are real, selectable, syntax-coloured text with language tabs.
- A live operational status line in the footer ("All systems operational") is the one live figure, presented as body-size text.
- Tailwind-era defaults used consistently: 150 ms on `cubic-bezier(0.4, 0, 0.2, 1)` for colour, 200 ms for buttons.

### Scene and shaders
- three.js r149, one WebGL2 canvas 648 x 550 at DPR 1 for the hero object, class `animate-webgl-scale-in-fade`; no canvas is mounted at 390 (the phone gets no 3D). 36 unique shaders on desktop, 11 on the pricing page. GSAP 3.49 present.
- Five videos elsewhere on the page.

### Scroll and motion (measured)
- Scroll: native. Document 12360 px at 1440, 14186 px at 390. CSS scroll-driven animation properties appear 8 times and View Transitions 12 times.
- Nav trigger (Features): opens a panel whose entry runs `opacity 350ms cubic-bezier(0.22, 1, 0.36, 1)`, `scale 350ms` same curve, and a chevron `translate 200ms cubic-bezier(0.4, 0, 1, 1)`.
- Nav siblings dim when one is hovered: `color 0.5s cubic-bezier(0.4, 0, 0.2, 1)`, rgb(240, 240, 240) to rgb(161, 164, 165).
- Log in: `color 0.2s cubic-bezier(0.4, 0, 0.2, 1)`.
- Get started: `0.2s cubic-bezier(0.4, 0, 0.2, 1)`; text white to black, fill transparent to white 90 percent (full inversion on hover).
- Duration histogram: 0.15 s (66), 0.2 s (30), 0.3 s (23), 1 s (17). Curves: `(0.4, 0, 0.2, 1)` 78 uses, `(0.36, 0.66, 0.6, 1)`, `(0.16, 1, 0.3, 1)`, `(0.22, 1, 0.36, 1)`.

### Typography
Families: Domaine 400, ABC Favorit 400 and 500 (features `"ss01", "ss04", "ss05"`), Inter variable, Commit Mono 400.

| Role | 1440 | 390 |
|---|---|---|
| Hero h1 | Domaine 96 / 96, w400, -0.96 px (-0.01em) | 64 / 64, -0.64 px |
| Closing statement | Domaine 76.8 / 76.8, -0.768 px | 64 / 64 |
| Section h2 | ABC Favorit 56 / 67.2, w400, -2.8 px (-0.05em) | 48 / 57.6, -2.4 px |
| Feature h3 | ABC Favorit 20 / 20, 0; 16 / 24, -0.8 px | 20 / 32 |
| Body | Inter 18 / 27, w400, rgb(161, 164, 165) | 16 / 28 and 16 / 24 |
| Quote | Inter 24 / 36, w500 | same |
| Nav | Inter 14 / 20, w500 | 16 |
| Button | Inter 14 or 16, w600 | 16 |
| Code | Commit Mono 16 / 24 | 16 / 24 |
| Small | Inter 12 / 16, w400 or w500 | 12 / 16 |

### Nav, footer, numbers, glass, colour scheme
- Nav: sticky, 58 px, transparent, no blur and no border.
- Call-to-action glass: `linear-gradient(104deg, rgba(253, 253, 253, 0.05) 5%, rgba(240, 240, 228, 0.1) 100%)`, `backdrop-filter: blur(25px)`, 2 px border at white 5 percent, radius 16 px.
- Footer (read on the pricing page): 636 px, five columns, 36 links at 16 px, postal address and the status line at the left.
- Numbers: HTTP status codes and JSON in Commit Mono inside code panels (rgba(241, 247, 254, 0.71)); no marketing counters. On the pricing page, prices are set inline in the card heading at heading size and weight, in the form "Automations, then a middle dot, then $0.0015 / run", with the free allowance stated in the sentence below (`best/c1440-ix-inner-pricing.jpg`).
- Colour scheme: dark only (`class="dark"`, `color-scheme: dark`, `meta color-scheme: dark`), body black, text rgb(240, 240, 240), secondary rgb(161, 164, 165). 982 `color-mix()` and 468 `display-p3` occurrences from the token system.

### How text stays legible
The 3D object sits beside the headline, never behind it. Secondary copy is a fixed mid grey on pure black (about 8:1).

### What v4 should take
- A serif or otherwise contrasting display face used exactly twice (opening and closing statements).
- Sibling dimming on nav hover (others fade to secondary over 500 ms) so the hovered item needs no background.
- Menu entry at 350 ms on `cubic-bezier(0.22, 1, 0.36, 1)` with opacity and scale together.
- One live status line as plain text, not a dashboard, and figures stated inline in headings in the unit the reader cares about.
- Dropping the 3D object entirely on phones when it is decoration.

### Could not access
Dashboard. Hero shader internals were not analysed (36 shaders, standard three.js physical material variants).

---

## activetheory.net

### What makes it world-class
- The whole site is one WebGL2 canvas driven by their own engine (globals `Hydra` and `AT`); the DOM holds only accessibility links and a chat field.
- 121 unique shaders, eight workers, KTX2 textures (33 files) with ASTC, ETC, BPTC and S3TC fallbacks, 15 MP4 project previews mapped onto glass cards.
- Supersampling in place of MSAA: canvas backing 2160 x 1350 for a 1440 x 900 DPR 1 viewport.
- A low-resolution fluid field moves every particle system (see below), so the pointer has one consistent physical effect across the scene.

### Scene and shaders
- Context: WebGL2, `antialias: false`, `alpha: false`, `powerPreference: "high-performance"`. Float extensions requested: `EXT_color_buffer_float`, `OES_texture_float_linear`.
- Targets seen: scene 2160 x 1350 RGB8; fluid 288 x 180 and 576 x 360 (RGB8); particle state 512 x 512, 725 x 725, 256 x 256, 128 x 128 and 32 x 32 RGBA32F; 256 x 256 RGBA16F; shadow or reflection 1024 x 1024.
- Fluid coupling (verbatim logic): particle position shaders project the particle to screen, then `flow = texture(tFluid, screenUV).xy; pos += flow * 0.0001 * HZ * uMouseStrength * texture(tFluidMask, screenUV).r;`. `HZ` is a refresh-rate normaliser used on every per-frame rate (`pos += (target - pos) * 0.07 * HZ`).
- Glass project cards: `screenuv += normal.xy * 0.01 * uReflection.x; f = pow(getFresnel(vNormal + normal * 0.02, vViewDir, 1.0), 5.0); color += f * texture(tVideo, vUv + normal.xy * 0.1).rgb * 0.9; color += texture(tRefraction, screenuv).rgb * uReflection.y;`. The card refracts a separate render of the scene (`tRefraction`) offset by a normal map, with a Fresnel-weighted second sample of its own video.
- Reflective floor: planar mirror target sampled at `uv - normal.xy * 0.015 * uWaterUVStrength`, where the normal is a scrolling water normal map (`tWaterNormal`, `uSpeed * 0.05`).
- Post: unreal bloom chain, volumetric light (`fExposure`, `fDecay`, `fDensity`, `fWeight`), lens streak and halo pass with chroma split, per-scene LUT (the token `lut` appears in all 121 shaders).
- Text: MSDF atlases (PNG plus JSON for three weights) drawn in the canvas, animated per letter (`uLetterCount`, `uWordCount`, `uByWord`, `uByLine`).

### Scroll and motion (measured)
- No document scroll (height equals the viewport). Wheel input drives a virtual timeline: about 2250 px of wheel for the opening camera move (logo, particle garden), 2000 px for the headline dolly, then about one project card per 450 to 900 px; 11250 px of wheel returns to the start (the list loops).
- Loader: black for about 1.5 s, then the logo ring with a progress arc at 3 to 5 s, interactive at roughly 15 s on this connection.
- DOM transitions that exist: `all 0.4s cubic-bezier(0.17, 0.4, 0.02, 0.99)` on links, 0.8 s on the chat field, 1 s opacity on wrappers with `cubic-bezier(0.39, 0.575, 0.565, 1)`.
- Mobile: full DPR 3 canvas (1170 x 2532) with the scene target at 682 x 1477; fluid targets drop to 156 x 338 and 78 x 169.

### Typography
| Role | 1440 | 390 |
|---|---|---|
| Headline | in canvas, MSDF, uppercase monospaced grotesque (NB Architekt family), three lines, cap height about 2.6 percent of viewport height; computed size not available | in canvas |
| Menu list (DOM) | 14 / 21, w400 | not in DOM |
| Player label | 10 / 30, w400 | same |
| Button | 14, w700, radius 5 px, border 1 px white 60 percent, fill white 10 percent | same |

### How text stays legible
- The headline is white on the darkest region of the frame; the scene is graded so the left third stays near black while cards and particles occupy the right.
- Card titles sit on a frosted card whose video is dimmed and blurred behind the title; cards are edge-lit so the title plane reads as a separate surface.
- The persistent nav is a small pill with `backdrop-filter: blur(4px)`, rgba(0, 0, 0, 0.5) and a 2 px border at white 30 percent.

### What v4 should take
- One fluid field, sampled by everything (particles there; ripples, foam, ice melt debris and caustics in v4).
- The `HZ` normaliser on every per-frame constant.
- Refraction as "sample a prior render of what is behind, offset by a normal", with a Fresnel-weighted reflection added on top. This is the ice letter recipe.
- Supersample 1.5x on DPR 1 displays instead of MSAA when the budget allows.
- Reserve a dark, quiet region of the frame for type and grade the scene around it.

### Could not access
Anything rendered in workers through `OffscreenCanvas` would bypass the hook (eight workers were created; all 121 shaders came from the main thread, so coverage is probably complete but not proven). Canvas text sizes are estimates from frames. Headless Chromium ran the home scene at about 20 fps under heavy machine load, so no frame timing is reported.

---

## unseen.co

### What makes it world-class
- The home is a single still composition (arches, steps, a shallow pool) in real-time 3D with a reflecting water floor that responds to the pointer; there is no scroll on the home page at all.
- Navigation between Home, Projects, Index and Contact is a camera move through one continuous scene, with the DOM text swapped during the move.
- A gate screen (animated eyes, "Enter" or "Enter without audio") doubles as the loader.
- Film treatment in post: vignette, barrel distortion, grain (`u_vignetteStrength`, `u_maxDistort`, `u_bendAmount`, noise).

### Scene and shaders
- three.js r143, WebGL2, `antialias: false`, plus a 2 x MSAA 1440 x 900 renderbuffer for the main target. Canvas is 1x at every DPR (390 x 844 backing on a DPR 3 phone). 34 unique shaders on entry, 54 after visiting all four pages.
- Water floor (read in full): a planar reflection target of 1080 x 450 stored as a mip atlas and sampled with bicubic filtering at a variable level. `reflectionUv.x += n1.x * 0.03 * edgeReduce * ao; reflectionUv.xy += fluidPos * 0.02 * ao * edgeReduce;` where `n1` is a noise texture scrolled at `uTime * 0.05` with UVs stretched 6 by 20 (long horizontal ripples) and `fluidPos` is the normalised pointer fluid. Blur level: `lod = clamp(uBaseLod + spec * 2.0, 0.0, 4.0) * ao`, plus `clamp(length(fluidPos) * 12.0, 0.0, 2.0)`. A baked ambient occlusion map (`uAOTexture`) removes distortion near walls and steps. Highlights are `smoothstep(0.05, 1.0, dot(specRay, lightDir)) * 0.2`, and `luminance(abs(fluid)) * 0.7` adds a bright crest where the pointer has just been.
- Pointer fluid: 128 x 128 RGBA16F (a second chain at 256 x 256). Self-advection plus force along the pointer segment, then divergence times `uViscosity`, pressure and gradient subtraction.
- Text in the scene uses troika SDF text (the hero line is in the canvas).
- Compressed textures: BPTC and ASTC, mostly 1024 px.

### Scroll and motion (measured)
- Home: document height equals viewport; wheel does nothing. Projects: custom smooth scroll (class `asscroll-disabled` on the root when locked), cards are WebGL planes that bend with scroll velocity (`u_velocity`, `u_bendAmount`).
- Loader and gate: text letters cascade in by 1.5 s, the Enter button is present by 5 s; entry to the scene takes about 9 s including the camera settle.
- CSS: `transform 1s cubic-bezier(0.16, 1, 0.3, 1)` for line reveals, `color 0.5s ease-out` on nav links, `all 0.4s ease-in-out` on filters; other curves `(0.87, 0, 0.13, 1)` and `(0.19, 1, 0.22, 1)`. GSAP 3.3.6.

### Typography
Families: Neue Montreal 400, Saol Display 400 regular and italic. Root font size is 1vw (14.4 px at 1440, 14 px at 390).

| Role | 1440 | 390 |
|---|---|---|
| Hero line ("Creating the" italic serif over "unexpected" sans) | in canvas (SDF), cap height about 4 percent of viewport height | in canvas |
| Page h1 (DOM) | 57.6 / 69.12, w400, -1.152 px (-0.02em) | not sampled |
| Contact h2 | 86.4 / 77.76, w700 | not sampled |
| Body | 14.4 / 16.56, w400, -0.36 px (-0.025em), rgb(66, 66, 66) | 14 / 21 |
| Nav | 14.4 / 21.6, w400 | 14 / 21 |
| Labels | 10.08 / 15.12, uppercase, 0 | 9.8 / 14.7, uppercase |

### How text stays legible
- Near-black text on a pale, low-contrast plaster wall: the composition keeps the wall behind the headline flat and evenly lit, and all the visual activity (water, sky, stairs) is in the lower half.
- Italic serif plus upright sans in one line gives the headline its own contrast without needing size.
- A small white pill button sits under the headline; nothing else competes in the centre.

### What v4 should take
- The reflection recipe: blur the reflected or refracted image more where the water is disturbed. It is one extra texture level lookup and it is what makes the pointer trail read as moving water instead of a warp.
- Bake an occlusion or "calm" mask for the bed so distortion fades near banks and obstacles.
- Stretch ripple noise anisotropically along the flow direction.
- Force along the pointer segment (previous to current), not at a point.
- A page change as a camera move over the same water.

### Could not access
The audio-on path. Case-study pages were not opened. Hero text metrics are estimates. On the first pass the capture stayed on the gate (kept in `references/unseen/gate/`); the scene captures are in `chromium-1440/ix-*.jpg`.

---

## kprverse.com

### What makes it world-class
- Native document scroll (16416 px at 1440, 14538 px at 390) with a fixed three.js canvas behind and DOM text above; illustrations are WebGL planes inside tab-shaped masks that scale from card to full bleed as they pass.
- Extreme type contrast: a 273.6 px display word (Hexaframe) against 8 to 12 px uppercase mono labels, with a variable grotesque (ABC Whyte Plus, 125 to 950) between.
- Background colour changes by section (white, lilac, black) with the canvas covering the transition.

### Scene and shaders
- three.js r150, WebGL2, `antialias: false`, `stencil: true` (used for the masks). GSAP 3.10.4 with ScrollTrigger and SplitText. 37 unique shaders; named materials include `KPR`, `BeamMaterial`, `GlowMaterial`, `RayMaterial`, sprite materials.
- Image planes: uniforms `uMaskStart`, `uMaskEnd`, `uGradientProgress`, `tNoise`, `uLod`, `uFlickProgress`, `uFlickResolution`, `uPurpleAmount`; images blur by mip level (`uLod`) and tint while entering.
- Textures: 2048 x 2048 BPTC and ASTC on desktop, 1024 on the phone. Canvas 1x on desktop, 585 x 1266 on the DPR 3 phone (1.5x).
- Ten videos, 24 audio files, six GLB models.

### Scroll and motion (measured)
- Scroll: native, immediate (400 px wheel gives 400 px at t = 0). Animation is scrubbed by ScrollTrigger against real scroll position.
- Timeline at 1440: hero 0 to 900; white editorial block to 2700; sunset landscape with centred question to 4500; "10K" collectibles on white then lilac to 6300; fan of character cards with drag hint; full-bleed city illustration with caption at the bottom edge; three more illustration cards that enter rotated a few degrees and flatten; closing "KEEPERS" display word with small cards; black footer with a full-width wordmark.
- CSS: `all 0.2s ease`; the JS curves are the standard Penner set.
- Loader: preloader element fades over 0.1 s; hero is on screen at 1.5 s.

### Typography
Families: Hexaframe (display), ABC Whyte Plus variable (125 to 950), IBM Plex Mono 400, 500, 600. Root font is viewport-scaled (0.9 px per rem unit at 1440). `font-feature-settings: "zero"`, `font-variation-settings: "opsz" 0`.

| Role | 1440 | 390 |
|---|---|---|
| Display word | Hexaframe 273.6 / 218.88 (0.8), w700, -27.36 px (-0.1em), uppercase | 72.8 / 58.24, -7.28 px |
| Hero h1 | ABC Whyte Plus 159.12 / 133.66 (0.84), w350, -12.73 px (-0.08em), uppercase | 56.16 / 53.04, -4.49 px |
| Section h2 | 46.8 / 42.12 (0.9), w650, -3.276 px (-0.07em), uppercase | 26 / 24.7, -1.82 px |
| Body | 13.5 / 17.55, w400, -0.27 px (-0.02em); lead 18.9 / 22.68, -0.567 px | 12.48 / 14.98, -0.25 px |
| Nav and labels | IBM Plex Mono 12.6 / 15.37, w400, -0.504 px (-0.04em), uppercase | 14.56 / 17.76, -0.58 px |
| Micro labels | IBM Plex Mono 8.1 to 9.9, w450, -0.02em, uppercase | 8.32 to 10.4 |

### How text stays legible
- Over illustrations, headlines are white, bold, tightly tracked uppercase with a darkened lower gradient baked into the image plane; captions sit in a fixed band at the bottom edge.
- Most reading text sits on flat white or lilac, with the illustration contained in a card beside it.
- Mono labels are below 10 px on desktop (8.1 px is too small to recommend).

### What v4 should take
- Native scroll with a fixed canvas and DOM text: no scroll hijack and correct scroll restoration.
- Masks that grow from a contained card to full bleed as the visitor arrives at a project: a direct model for the stream "shaping itself into each project's visual".
- Tight negative tracking scaled with size (-0.02em body, -0.07em headings, -0.1em display).
- Halve texture resolution and cap DPR at 1.5 on phones.

### Could not access
Sign-in area. The inner URL tried (`/the-world`) returned their 404 page, which was captured instead; inner pages are routed client-side from the nav and were not reached.

---

## jesperlandberg.com

### What makes it world-class
- One screen, no document scroll: a ribbon of curved project panels in 3D that the visitor drags or wheels horizontally, over a faint perspective grid that reflects the panels in its lines only.
- Every piece of visible text is drawn in the canvas as instanced glyph quads, so type can ride the ribbon's bend, blur with motion and reveal by line.
- The shader source ships with its design rationale in comments, which makes the decisions readable (several are quoted below).
- Profile opens inside a refracting ring (a lens with chromatic fringe) instead of a new page.

### Scene and shaders
- three.js r185, WebGL2, `antialias: true`, one canvas at 1x on desktop and 780 x 1688 on the DPR 3 phone (2x). 16 unique shaders on load, 19 after interaction. Textures are ETC2-compressed at 1200 px wide.
- Pointer trail: 144 x 90 RGBA8 height field, decay plus diffusion plus one Gaussian stamp per frame, clamped at 1.5. Comment: "Deliberately NOT a fluid. A stable-fluids build of this exists ... and it reads as water, ink carried off the stroke, swirling. A ball under a sheet is the opposite bargain: the bump stays where the ball made it and dies in place."
- Frame-rate independence: "Both rates arrive dt-shaped (exp decays computed on the CPU), so a 120Hz frame and a dropped one leave the same cloth behind."
- Units: all effect radii are expressed as a share of viewport width, matching the CSS fluid rem (`100vw / --size`), so shader and layout scale together.
- Ribbon vertex shader sections: a y-wave along the strip, a velocity "rear-up" (panels tilt with scroll speed), hover lift. Glyph shader: "Motion blur, and why the QUAD has to grow for it", line reveal, sway. Panel fragment: frame fade, dispersion, smear.
- Lens: "Gravitational lensing, on a leash", "The depth is painted, not displaced", "Shading needs headroom".

### Scroll and motion (measured)
- No native scroll. Wheel and drag move the ribbon with inertia; it loops. Root class `grabbable`.
- DOM transitions: `opacity 0.3s cubic-bezier(0, 0, 0.2, 1)` on buttons (1 to 0.6 on hover), `opacity 0.5s` same curve on route links (0.5 to 1).
- Loader: black with a three-segment bar at 5 s; scene visible by about 10 s.

### Typography
Family: ABC Diatype Plus variable (served as `sans`, 200 to 1000). DOM text is the accessible mirror of the canvas text.

| Role | 1440 | 390 |
|---|---|---|
| h1 (name and role) | 26.88 / 37.63, w700 | 28 / 39.2 |
| h2 | 20.16 / 28.22, w700 | 21 / 29.4 |
| Project names | 17.28 / 24.19, w400, -0.864 px (-0.05em) | 16 / 22.4, -0.8 px |
| Body | 13.44 / 18.82, w400, 0 or -0.27 px (-0.02em) | 14 / 19.6 |
| Labels | 9.6 / 13.44, w500, uppercase | 10 / 14 |

### How text stays legible
- White on black for all interface text, at the four corners of the viewport, away from the ribbon.
- Profile copy sits inside the lens on a solid black disc; the distortion is confined to the rim.
- Panel captions are placed at the lower-left of each panel on a darkened corner.

### What v4 should take
- The note that stable fluids "reads as water": for v4 that is the wanted result, and the same author's decay and diffusion field is the cheap fallback for low-end devices.
- `exp(-k * dt)` decay computed on the CPU for frame-rate independence.
- One unit system shared by CSS and shaders (share of viewport width).
- Keep distortion at the rim and a calm, solid centre wherever text must be read through a refracting element. This is the legibility rule for ice letters.
- Grow glyph or letter quads when adding motion blur or melt so the effect is not clipped.

### Could not access
Case-study routes were not opened. Canvas text sizes are taken from the DOM mirror.

---

## Part 2 selections

Selection method: Awwwards listings for Site of the Day and Site of the Month from 2025 to November 2026, filtered for real-time water, fluid, ice or glass, then verified by capture. Two candidates that looked right on paper were rejected after capture and are recorded so nobody repeats the work.

| Site | Award (from the Awwwards entry) | Why picked | Verdict |
|---|---|---|---|
| bruno-simon.com | Site of the Day 21 Jan 2026, listed among Sites of the Month | A real-time world with a shoreline and open water you can enter, built on WebGPU | Strong for shoreline cues and WebGPU delivery |
| mont-fort.com | Site of the Day 23 Jun 2025, listed among Sites of the Month | Scroll-driven journey through clouds, sea and a globe with a pointer trail simulation | Strong for scroll structure and text over a moving scene |
| astrodither.robertborghesi.is | Site of the Day 5 May 2026 | Entry describes a custom fluid simulation on three.js WebGPU with TSL | Useful for WebGPU delivery; the fluid is a smoke-like accent |
| fluid.glass | Site of the Day 30 Mar 2026 | Name and subject suggest glass refraction | Rejected as a water or refraction reference: no canvas at all |
| morphowater.com | Honorable Mention 12 Oct 2026 | Water brand with a 3D can and a scroll journey | Rejected as a water technique reference: water is filmed |

No 2025 to 2026 award winner was found whose main subject is physically simulated top-down water. The closest working references remain the technical demos in the water section and the Unseen pool floor.

---

## bruno-simon.com

### What makes it world-class
- A drivable 3D world as a portfolio, on three.js r187 `WebGPURenderer` with TSL node materials; 212 WGSL modules were compiled on desktop and 105 on the phone build.
- It ran in headless Chromium and in Playwright WebKit 27.2 with a `webgpu` canvas context in both.
- A click-to-start gate on a small lit diorama, then the camera pulls back to the island.

### Scene and shaders
- Canvas 1x at 1440 x 900; 780 x 1688 on the DPR 3 phone (2x). Eight workers (physics and loaders). Two compute modules.
- Water as observed in frames (`best/c1440-ix-drive-1.jpg` to `ix-drive-4.jpg`): the shore is drawn as a depth gradient from pale turquoise at the sand to deep blue, with two or three thin white lines that follow the coastline contour and move outward. Driving into the sea switches to an underwater grade ("Under the sea" achievement) with a darker blue floor, drifting leaves on the surface and a purple horizon band. It is stylised, not refractive.
- The shader text is machine-generated (variables `nodeVar0`, uniforms `nodeUniform0`), so no technique could be read from names.

### Scroll and motion (measured)
No scroll. Keyboard, pointer and gamepad drive a vehicle. DOM easing strings include `cubic-bezier(0.4, 1.6, 0.65, 1)` and `(0.49, 2.2, 0.53, 0.75)` (overshoot curves for UI pops). Start gate visible after about 12 s; world interactive about 9 s after the click on this machine.

### Typography
Families: Amatic SC 700 (hand-drawn display, used in world signage and prompts), Nunito 400, 700, 900 for interface, one more display face. No DOM text is visible until menus open, so no size table: the capture has no text nodes at either breakpoint.

### How text stays legible
World text is large extruded geometry lit like the scene. Interface text sits in opaque dark tabs at the top edge.

### What v4 should take
- Shoreline recipe for the banks of the stream: depth-keyed colour ramp plus thin contour-following foam lines that drift away from the edge. Even without refraction, those two cues make an edge read as a waterline.
- WebGPU with TSL is deployable today, including in WebKit; if v4 goes that way, keep a WebGL2 path because the shader output cannot be hand-tuned or inspected as easily.
- A gate that shows a small, cheap, already attractive scene while the rest loads.

### Could not access
Shader logic (anonymised WGSL). Multiplayer features (page reported the server as offline during one run and connected in another). The phone capture stayed on the start gate.

---

## mont-fort.com

### What makes it world-class
- A long native-scroll page (16886 px at 1440) with Lenis smoothing over a fixed three.js canvas whose scene changes by chapter: peaks in cloud, a cloud deck, a ship at sea, a globe, a forest canopy, then a plain white footer.
- Text is DOM, set in one geometric sans in uppercase with wide positive tracking, placed in a consistent column while the scene moves behind it.
- A pointer trail simulation lightly parts the clouds and disturbs the sea.

### Scene and shaders
- three.js r169, WebGL2, `antialias: false`, Astro, GSAP with ScrollTrigger, Lenis. 31 unique shaders. Canvas 1x on desktop; 780 x 1918 on the phone (2x, sized to the large viewport height).
- Pointer trail: 336 x 256 RGBA16F feedback buffer (`tLast`), four taps of the previous frame offset by noise (`propagationFactor = 0.15`), persistence 0.99, shifted by `uMouseVelocity * 0.005`, with three nested `smoothstep` discs at the pointer.
- Sea: analytic foam. `splash = sin(0.4 * s + t) * sin(s + 0.1 * t) * smoothstep(-1, 1, sin(0.3 * s + 2 * t))` on world position, thresholded with `smoothstep` against height plus a scrolling noise texture, with a second noise-driven "foam fog" band added as emission.
- Chapter uniforms (`uChapter`, `uPage`, `uTransition`, `uTransitionColor`) cross-fade base colour maps and lightmaps per section; a 512 x 512 RGBA32F target and a 4096 x 2048 ASTC texture (the globe) were allocated.

### Scroll and motion (measured)
- Lenis: after one 400 px wheel event the page had moved 41 px in the first frame, 132 px at 49 ms, 203 px at 99 ms, 254 px at 150 ms, 292 px at 200 ms; 50 percent at 99 ms, 90 percent at 400 ms, 99 percent at 750 ms. That is an exponential approach with about 0.1 of the remaining distance per 60 Hz frame.
- Timeline at 1440: 0 to 1350 peaks and wordmark; to 3150 statement and intro copy over cloud; to 5400 divisions with the ship (one division per about 900 px); to 7650 globe with office markers; dark band; to 14400 forest canopy with three long text sections; white footer.
- CSS curves: `cubic-bezier(0.4, 0, 0.1, 1)` (23 uses), `(0.32, 0.94, 0.6, 1)`, `(0.9, 0, 0.4, 1)`.
- Loader: white screen with the nav only at 1.5 s; hero scene visible by 5 s.

### Typography
Families: Century Gothic 400 and 700, Josefin Sans 300 for the wordmark.

| Role | 1440 | 390 |
|---|---|---|
| Wordmark | Josefin Sans 62, w300, +19.84 px (0.32em), uppercase | 18, w300, +5.76 px |
| Statement h2 | 50 / 70, w400, +2.24 px (0.045em), uppercase, `text-wrap: balance` | 36 / 50.4, +1.44 px |
| Section heading | 40 / 56, +1.6 px, uppercase | 28 / 39.2, +2.24 px |
| Lead | 24 / 38.4, +0.48 px | 20 / 32 |
| Body | 16 / 25.6, +1.28 px (0.08em) | 16 / 25.6, +1.28 px |
| Label | 14 / 16.8, w700, +3.36 px (0.24em), uppercase; 12 / 14.4, +0.48 px | 12 / 19.2 |

### How text stays legible
- The scene is graded into a narrow tonal range per chapter (pale blue-white clouds, slate sea, deep green canopy), and text takes the opposite end: mid blue rgb(45, 98, 140) on the pale chapters, white on the dark ones.
- Text blocks sit where the scene is emptiest: sky above the peaks, open cloud, the dark side of the globe.
- Depth of field and haze reduce background contrast under long paragraphs in the forest chapter.

### What v4 should take
- Lenis at its default damping feels like the measured curve above; if v4 keeps Lenis, drive the water's flow speed from Lenis velocity so scroll and stream share one curve.
- Compress the scene's tonal range per section so one text colour works for the whole section, and switch text colour only at chapter boundaries.
- Chapter uniforms that cross-fade looks instead of swapping scenes.
- Analytic foam (sines plus noise threshold) as the fallback tier when the simulation is off.

### Could not access
Inner pages. The sea chapter was studied from shader text and frames only; the pointer was not dragged across it in isolation.

---

## astrodither.robertborghesi.is

### What makes it world-class
- A single-screen audio-reactive piece on three.js r180 `WebGPURenderer` (TSL): a 3D hand rendered through an ordered-dither stage with a limited palette, particle streaks flying past the camera, selective bloom, and a pointer-driven fluid wisp.
- 33 WGSL modules in total, no compute modules: the fluid runs as fragment passes.
- Canvas 1x on desktop, 663 x 1434 on the DPR 3 phone (1.7x).

### Scene and shaders
- Bloom is the standard five-level chain blended with per-level factors (read from WGSL: five mip textures weighted by `lerpBloomFactor`), with a 13-tap separable Gaussian.
- Fluid as observed (`best/c1440-ix-drag-mid.jpg`, `ix-move-1.jpg`): a pale smoke-like smear that follows the pointer path and displaces the dithered pixels it crosses, dissipating in about one second.
- A "hold for speed" control scales time (HUD shows a multiplier and a running clock).

### Scroll and motion (measured)
No scroll. Click to enter (the gate is also the audio permission). Wheel input had no visible effect.

### Typography
Azeret Mono variable (100 to 900), features `"liga"`. Everything is one size: 13.44 / 20.16 at 1440 (w400, with w700 at -1.344 px tracking for the gate prompt), 12 / 18 at 390. HUD text sits in the four corners.

### How text stays legible
Monospace white on near black (rgb(8, 8, 8)) in the corners, outside the area the hand occupies; bloom is selective, so it never washes the HUD.

### What v4 should take
- Selective bloom: only glints and caustic peaks should feed the bloom pass, never the bed or the text.
- A fragment-pass fluid works on WebGPU without compute, so one simulation design can serve both back ends.
- Not the look: a dye-style fluid drawn directly reads as smoke.

### Could not access
Shader logic beyond structure (anonymised WGSL). Audio reactivity (headless, no audio output).

---

## fluid.glass (weak match, kept short)

- Award: Awwwards Site of the Day, 30 Mar 2026 (Exo Ape). Picked for the name and for glass as a subject.
- Finding: zero canvases and zero shaders in all three captures. The site is video and photography with CSS glass: `backdrop-filter: blur(18px)` (declared as 2rem) on the cursor follower (white 15 to 20 percent gradient), on buttons (white 20 percent) and on the menu panel (dark 80 percent). Lenis is present; the page scrolls inside a fixed wrapper.
- Motion: `color 0.5s ease` on links, `opacity 0.3s ease-out` on images, long eases `cubic-bezier(1, 0, 0, 1)` and `(0.77, 0, 0.175, 1)` for page-level moves.
- Typography: Aeonik Pro 400 and 700, Aeonik Mono 500 and 600. Display 57.6 / 57.6, -1.728 px (-0.03em); 43.2 / 43.2, -1.296 px; 36 / 36, -0.72 px; body 16.2 / 21.06 and 14.4 / 18.72; mono labels 10.8, w500, +0.864 px (0.08em), uppercase. At 390: display 41.6 / 41.6, -0.832 px; body 16.64 / 21.63; labels 12.48, +1 px.
- Legibility: white type centred over footage, with the footage graded dark in the middle band; long copy moves to a flat off-white page.
- Take: tight display with wide-tracked mono labels is a clean pairing; the frosted cursor follower is a cheap way to make a pointer feel like it touches the surface. Nothing here helps with water.
- Could not access: the cookie banner covered the lower right of most frames; the pointer pass opened the menu on hover, so the later 1440 frames show the menu over footage.

## morphowater.com (weak match, kept short)

- Award: Awwwards Honorable Mention, 12 Oct 2026 (not Site of the Day). Picked because the product is water.
- Finding: three.js r185 with standard physical materials (transmission, thickness, IOR, dispersion, clearcoat) for an aluminium can and a globe; the water itself (waterfall, surf, pool) is filmed footage revealed through the can opening by a mask (`reveal`, `videoFrame`). Canvas 1x on desktop, 1.7x on the phone. Native scroll, 24479 px at 1440.
- Typography: Gotham 300 to 500 with Publico Headline italic 300 for the second line of each pair. Display 133.92 / 124.5, -7.37 px (-0.055em) with the italic at 140.6 / 137.8, -6.33 px; h2 90 / 91.8, w300, -4.95 px; h3 57.6 / 63.36, -2.3 px; body 16.13 / 29.03. At 390: 70.2 / 65.3 and 73.7 / 72.2; h2 44.85 / 48.4; body 17.16 / 27.46.
- Legibility: white type on footage with a dark gradient from the lower left; a persistent dark frame around the viewport.
- Take: the upright-plus-italic pairing at display size; the reveal of a scene through a shaped opening.
- Could not access: only the first 12600 px of scroll were captured at 1440 inside the time cap.

---

## Cross-site numbers worth keeping

| Topic | Observed |
|---|---|
| Hover duration, product sites | Linear 100 to 160 ms; Raycast 200 ms; Resend 150 to 200 ms |
| Standard ease-out | Linear `(0.25, 0.46, 0.45, 0.94)`; Raycast `(0.23, 1, 0.32, 1)`; Resend `(0.4, 0, 0.2, 1)` |
| Large-move ease | Linear `(0.32, 0.72, 0, 1)` at 0.7 s; Unseen `(0.16, 1, 0.3, 1)` at 1 s; Resend `(0.22, 1, 0.36, 1)` at 350 ms |
| Nav blur | Linear 20 px; Raycast 5 px; Resend none |
| Glass edge | Inner light ring or top highlight at white 3 to 15 percent plus outer dark ring at black 50 to 80 percent |
| Heading tracking | Linear -0.022em; Resend -0.01em serif and -0.05em grotesque; KPR -0.07 to -0.1em; Raycast 0 |
| Body size | 15 px (Linear), 18 px (Raycast, Resend), 13.5 to 16 px (studios) |
| Scroll model | Native: Linear, Raycast, Resend, KPR, Morpho. Lenis: Montfort. Virtual or none: Active Theory, Unseen home, Jesper Landberg, Astrodither, Bruno Simon |
| Colour scheme | All three product sites are dark only and ignore `prefers-color-scheme` |
| Phone canvas DPR | 1x Unseen; 1.5x KPR; 1.6x Raycast; 1.7x Astrodither, Morpho; 2x Jesper Landberg, Montfort, Bruno Simon; 3x canvas with 1.75x scene Active Theory |
| Text over canvas | DOM text: KPR, Montfort, Raycast, Resend. Canvas text (MSDF, SDF or instanced glyphs): Active Theory, Unseen hero, Jesper Landberg |

---

## Real-time water: technique notes

Everything marked "verified" was read first-hand from live pages with a `WebGLRenderingContext.prototype.shaderSource` hook (and `GPUDevice.createShaderModule` for WebGPU) injected through `page.addInitScript`, plus hooks on `texImage2D`, `texStorage2D` and `getExtension` to log render target sizes, formats and extensions. Raw dumps: `~/.t3/portfolio-redesign-v4/references/_water-demos/<demo>/`. GPU used for all captures: ANGLE Metal on Apple M4 (not software GL).

### 0. Recommendation for v4 in one page

Build a hybrid: a shallow-water heightfield with a velocity field, not a stable-fluids dye toy and not a pure ripple shader.

| Pass | Target | Size | Format | Notes |
|---|---|---|---|---|
| 1. Bed | static texture | 1024 to 2048 long edge | RGBA8 (height in A) plus RGBA8 normal | The machined bed: heightmap `b(x)`, channel walls, engraving. Baked once per layout. |
| 2. Sim A (state) | ping-pong | 256 x 144 desktop, 192 x 108 mobile (fixed, never tied to DPR) | RGBA16F | `r` water depth `d`, `g` vertical velocity or previous height, `b,a` horizontal velocity `u,v` |
| 3. Sim B (flux, only if pipe model) | ping-pong | same | RGBA16F | outflow flux left, right, top, bottom |
| 4. Obstacles and sources | single | same | RGBA8 | r solid mask (letters, cards, banks), g source rate (melt water), b pointer splat |
| 5. Normals | single | same or 2x | RG16F or RGBA8 | central differences of surface height `b + d`, stored `n.xz` |
| 6. Caustics | single | 512 x 288 to 1024 x 576 | R8 or R16F | refracted-area ratio from pass 5, one separable 5-tap blur |
| 7. Detail flow | none (in final shader) | screen | | two-phase flow-mapped detail normal, advected by sim velocity |
| 8. Final composite | canvas | CSS size x min(DPR, 2) | RGBA8 | refraction of bed, absorption, caustics, Fresnel reflection, glints, foam, wet edges |

Why this and not the alternatives:
- Pure wave-equation heightfield (Wallace) gives perfect ripples but no flow. Water that only ripples reads as a pool, not a stream.
- Pure stable fluids (Stam, Dobryakov) gives flow but no surface. Rendered directly it reads as ink or smoke; pushed through a threshold it reads as jelly. That is the look the owner rejected.
- The hybrid uses the velocity field only to move things (ripples, detail normals, foam, caustic drift) and the height field only to bend light. Each field does the one thing it is good at.

Cheapest version that still reads as water (ship this first, upgrade later): wave-equation height `h` at 256 x 144 with a semi-Lagrangian advection step along a prescribed flow field `U(x)` (authored from the channel layout, plus pointer and scroll impulses), solid mask with reflective boundaries, normals, Laplacian caustics, flow-mapped detail normals. Six small passes, all RGBA16F.

### 1. Heightfield water (Evan Wallace, WebGL Water), verified

Source: https://madebyevan.com/webgl-water/ , code https://github.com/evanw/webgl-water , write-up https://medium.com/@evanwallace/rendering-realtime-caustics-in-webgl-2a99a29a0b2c

Measured:
- Simulation state: two 256 x 256 textures, `gl.FLOAT` RGBA with LINEAR filtering when `OES_texture_float_linear` exists, falling back to `HALF_FLOAT_OES` (water.js lines 22 to 28). Channels: `r` height, `g` vertical velocity, `b,a` normal x and z.
- Caustics target: 1024 x 1024 RGBA8. Water mesh: plane with `detail: 200` (200 x 200 quads).
- Per frame: `stepSimulation()` twice, `updateNormals()` once, then caustics, then the scene. Canvas backing store is CSS size times `devicePixelRatio`; the simulation is independent of it.

Update shader (verbatim logic):
```glsl
float average = (h(coord - dx) + h(coord - dy) + h(coord + dx) + h(coord + dy)) * 0.25;
info.g += (average - info.r) * 2.0;   // accelerate toward neighbour mean
info.g *= 0.995;                      // damping
info.r += info.g;                     // integrate
```
This is the discrete wave equation `h_tt = c^2 * laplacian(h)` with `c^2 * dt^2 / dx^2 = 0.5` (the factor 2.0 times the 0.25 average). Stability needs that factor to be at most 0.5 in 2D for the explicit scheme, so 2.0 is the fastest stable wave speed; run several steps per frame for faster waves, never raise the constant.

Normal reconstruction (forward differences, stored as xz):
```glsl
vec3 dx = vec3(delta.x, h(coord + vec2(delta.x, 0.0)) - info.r, 0.0);
vec3 dy = vec3(0.0, h(coord + vec2(0.0, delta.y)) - info.r, delta.y);
info.ba = normalize(cross(dy, dx)).xz;
// later: normal = vec3(info.b, sqrt(1.0 - dot(info.ba, info.ba)), info.a);
```

Drop (pointer) injection, a raised-cosine bump, radius 0.03 and strength plus or minus 0.01 in the demo:
```glsl
float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
drop = 0.5 - cos(drop * PI) * 0.5;
info.r += drop * strength;
```
Moving obstacle (the sphere): add the displaced volume at the old position, subtract it at the new one. This is what makes a moving object push a bow wave and leave a trough; it conserves volume, which is why it looks right:
```glsl
info.r += volumeInSphere(oldCenter);
info.r -= volumeInSphere(newCenter);
```
Use exactly this for the pointer in v4: treat the pointer as a small submerged body with an old and a new position, not as a "drop at the cursor". A drop makes rings; a moved body makes a wake.

Surface shading:
```glsl
for (int i = 0; i < 5; i++) { coord += info.ba * 0.005; info = texture2D(water, coord); } // sharpen crests
vec3 refractedRay = refract(incomingRay, normal, 1.0 / 1.333);
float fresnel = mix(0.25, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));
gl_FragColor = mix(refractedColor, reflectedColor, fresnel);
```
Sun glint is `pow(max(0.0, dot(light, ray)), 5000.0) * vec3(10.0, 8.0, 6.0)` on the reflected ray: an extremely tight lobe at ten times white. Tint under water multiplies by `vec3(0.4, 0.9, 1.0)` (red is absorbed first).

Descendants read the same way:
- three.js `webgl_gpgpu_water` (verified): 128 x 128 RGBA32F heightmap. Verlet form with no stored velocity: `newHeight = ((N + S + E + W) * 0.5 - heightTwoFramesAgo) * viscosity`, pointer adds `(cos(phase) + 1.0) * deep`. https://threejs.org/examples/webgl_gpgpu_water.html
- Martin Renou, threejs-caustics (verified): simulation 512 x 512 RGBA32F, caustics 1024 x 1024 RGBA32F, environment depth map 1536 x 1536. Same update. https://github.com/martinRenou/threejs-caustics and https://medium.com/@martinRenou/real-time-rendering-of-water-caustics-59cda1d74aa
- jeantimex WebGPU port (14 WGSL modules captured): same algorithm on WebGPU. https://github.com/jeantimex/webgpu-water

### 2. Shallow water on the GPU (pipe model): what makes it flow

Sources: Mei, Decaudin, Hu, "Fast Hydraulic Erosion Simulation and Visualization on GPU" (2007) https://inria.hal.science/inria-00402079/document ; O'Brien and Hodgins, "Dynamic Simulation of Splashing Fluids" (1995); Kass and Miller, "Rapid, Stable Fluid Dynamics for Computer Graphics" (1990); Matthias Mueller, Ten Minute Physics 16, height field water https://matthias-research.github.io/pages/tenMinutePhysics/

State per cell: bed height `b`, water depth `d`, four outflow fluxes `fL, fR, fT, fB`. Cell size `l`, pipe cross-section `A`, gravity `g`.

1. Flux: `f_i = max(0, f_i + dt * A * g * (H - H_i) / l)` where `H = b + d` and `H_i` is the neighbour's surface.
2. Scale so a cell cannot give more water than it has: `K = min(1, d * l * l / ((fL + fR + fT + fB) * dt))`, then `f_i *= K`.
3. Depth: `d += dt * (sum of neighbour inflow - sum of own outflow) / (l * l)`.
4. Velocity for rendering: `u = (fR(x-1) - fL(x) + fR(x) - fL(x+1)) / (2 * l * dAvg)`, same for `v`.
5. Solids: a solid cell has `b` very high, so no flux enters it. No special boundary code.

Stability: keep `dt * sqrt(g * dMax) / l` below about 0.5. Two or three substeps per frame at 256 x 144 is cheap.

Why it suits v4: water entering at the melting letters runs downhill along the machined channel, splits around obstacles, pools behind lips and leaves real eddies and wakes behind every obstacle without authoring anything. The velocity is a by-product, so foam, detail normals and caustics can all be advected by it. Mass is conserved, so the stream visibly swells when the ice melts faster (scroll velocity can drive the source rate).

Cheaper approximation with most of the look: keep the Wallace wave equation but (a) advect height and velocity along a flow field, `h(x) = hPrev(x - U(x) * dt)` before the wave step, which makes ripples drift downstream and skews rings into teardrops, and (b) use the solid mask for reflective boundaries (when a neighbour is solid, substitute the cell's own height). With a steady `U`, a static obstacle then produces a standing V wake: the obstacle continuously disturbs water that is moving past it.

### 3. Stable fluids and how production sites use it

Sources: Jos Stam, "Stable Fluids" (SIGGRAPH 1999) https://dl.acm.org/doi/10.1145/311535.311548 and "Real-Time Fluid Dynamics for Games" (GDC 2003) https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/GDC03.pdf ; Mark Harris, GPU Gems chapter 38 https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu ; Pavel Dobryakov, WebGL Fluid Simulation https://github.com/PavelDoGreat/WebGL-Fluid-Simulation

Pass order per frame (Dobryakov, verified by capture at 1440 x 900):
1. curl: `w = R.y - L.y - T.x + B.x`
2. vorticity confinement: force from the gradient of `abs(w)`, scaled by `curl * w * dt`
3. divergence: `div = 0.5 * (R.x - L.x + T.y - B.y)`
4. pressure clear: `p *= 0.8` (warm start from last frame)
5. Jacobi, 20 iterations: `p = (L + R + B + T - div) * 0.25`
6. projection: `u -= vec2(R - L, T - B)` of pressure
7. advect velocity: `u(x) = uPrev(x - dt * uPrev(x) * texel) / (1 + dissipation * dt)`
8. advect dye with the same formula

Measured targets: velocity 205 x 128 RG16F (two), divergence, curl and pressure 205 x 128 R16F, dye 1638 x 1024 RGBA16F (two), bloom chain 410 x 256 down to 3 x 2, sunrays 314 x 196 R16F. Extensions requested: `EXT_color_buffer_float`, `OES_texture_float_linear`. So the "128" simulation is 128 on the short edge with the long edge scaled by aspect. The repo falls back to dye 512 and a manual four-tap bilinear filter in the advection shader when linear filtering of float textures is missing.

How studios combine it (observed in this study):
- Active Theory home (verified): a fluid velocity texture `tFluid` at 288 x 180 (RGB8 targets) plus a mask `tFluidMask`. It is never drawn. Particle position shaders project each particle to screen space, sample the fluid there and add `flow * 0.0001 * HZ * uMouseStrength * mask` to the particle position. `HZ` normalises for refresh rate. The floor is a separate planar reflection distorted by a scrolling normal map: `uv -= normal.xy * 0.015 * uWaterUVStrength`.
- Unseen home (verified): velocity field at 128 x 128 RGBA16F (a second chain at 256 x 256). One pass self-advects (`texture2D(uTexture, vUv - texture2D(uTexture, vUv).xy * uCellSize)`) and adds pointer force along the segment between the previous and current pointer position (`sdLine(vUv, uPrevMouse, uMouse)`), then divergence, pressure and gradient subtraction. The pool floor is a planar reflection whose lookup is offset by scrolling noise (`n1.x * 0.03`) and by the fluid (`fluidPos * 0.02`), and whose blur level rises with fluid speed (`lod + clamp(length(fluidPos) * 12.0, 0.0, 2.0)`): disturbed water reflects a blurrier image.
- Jesper Landberg (verified, shader comments intact): pointer trail is a 144 x 90 RGBA8 height field with only decay and diffusion, `h = mix(c, neighbours * 0.25, u_diff) * u_decay + u_amp * exp(-dot(q, q) / (u_rad * u_rad))`, clamped at 1.5. The author's comment states that a stable-fluids build of the same effect "reads as water" (ink carried off the stroke, swirling) and was rejected because the brief there was fabric. Decay and diffusion rates are computed on the CPU as `exp(-k * dt)` so 120 Hz and dropped frames give the same result.
- Montfort (verified): pointer trail at 336 x 256 RGBA16F, feedback of the last frame sampled with a noise offset (`propagationFactor = 0.15`), persistence 0.99 per frame, shifted by `uMouseVelocity * 0.005`. Shoreline foam is analytic: two multiplied sines on world position gated by `smoothstep`, broken up with a scrolling noise texture.
- The pattern in every production site studied: simulation at 128 to 336 on the short edge, sampled with bilinear filtering by a full-resolution shader that supplies all the high-frequency detail (normal maps, noise, text). The simulation never needs to be sharp because it is only used as a displacement.

For v4 this means: if stable fluids is used at all, use it as the horizontal velocity field `U` that advects the heightfield and the detail normals. Do not render dye.

### 4. Flow maps for rivers (Valve two-phase technique)

Source: Alex Vlachos, "Water Flow in Portal 2", SIGGRAPH 2010 Advances in Real-Time Rendering https://advances.realtimerendering.com/s2010/Vlachos-Waterflow(SIGGRAPH%202010%20Advanced%20RealTime%20Rendering%20Course).pdf ; worked tutorial: Catlike Coding, Texture Distortion https://catlikecoding.com/unity/tutorials/flow/texture-distortion/

A normal map scrolled along a per-pixel flow vector stretches without bound, so sample it twice with phases half a cycle apart and cross-fade so each sample is invisible at the moment it resets:
```glsl
vec2 flow = texture(uVelocity, uv).ba * uFlowScale;          // from the sim, not a painted map
float n = texture(uNoise, uv * 2.0).r;                       // per-pixel phase offset hides the pulse
float p0 = fract(uTime * uCycle + n);
float p1 = fract(p0 + 0.5);
vec3 n0 = texture(uDetailNormal, uv * uTile - flow * p0).xyz * 2.0 - 1.0;
vec3 n1 = texture(uDetailNormal, uv * uTile + 0.5 - flow * p1).xyz * 2.0 - 1.0;
float w = abs(1.0 - 2.0 * p0);                               // 0 at mid cycle, 1 at reset
vec3 nd = normalize(mix(n0, n1, w));
nd.xy *= uDetailBase + uDetailBySpeed * length(flow);        // fast water is rougher
```
Rules that matter: keep `flow * phase` under about half a texture tile so stretching stays invisible; scale normal strength by flow speed (still water must go glassy); offset the second sample by half a tile so the two layers never line up; drive `flow` from the simulated velocity so the detail ripples bend around obstacles exactly where the big waves do.

### 5. Wakes behind obstacles and around the pointer

- Static obstacle in a current: needs (a) a solid mask with reflective boundary and (b) advection of the height field by the current. The obstacle then sheds a steady V. In shallow water the half angle follows the Froude number, `sin(theta) = sqrt(g * d) / U` when `U > sqrt(g * d)`; in deep water it is the fixed Kelvin angle of 19.47 degrees. So faster flow means a narrower wake. Tie the flow speed uniform to scroll velocity and the wakes narrow as the visitor scrolls faster.
- Moving pointer: Wallace's displaced-volume trick (section 1) with old and new pointer positions, radius about 2 to 3 sim texels, sub-stepped along the segment so a fast pointer does not leave dotted rings. Add momentum too: splat `(pointerVelocity * k)` into the horizontal velocity field with a Gaussian `exp(-dot(p, p) / r)`, so detail normals and foam get dragged along the path.
- Turbulent wake: add a little vorticity confinement (section 3, steps 1 and 2) to the velocity field only behind obstacles, or inject alternating-sign curl at the obstacle's lee side to get a Karman street at low cost.
- Foam: a scalar advected by the velocity, sourced where `abs(divergence)` or the speed gradient is high (obstacle stagnation points, bank contact, where melt water joins) and decaying over 1 to 3 seconds. Render it as thin bright lines by thresholding foam against a streaky noise advected with the same two-phase scheme.
- Further reading for richer wakes: Tessendorf, "Interactive Water Surfaces" (iWave) https://people.computing.clemson.edu/~jtessen/reports/papers_files/Interactive_Water_Surfaces.pdf ; Yuksel, House, Keyser, "Wave Particles" (2007) http://www.cemyuksel.com/research/waveparticles/ ; Jeschke et al., "Water Surface Wavelets" (2018) https://dl.acm.org/doi/10.1145/3197517.3201336

### 6. Caustics

Method A, refracted-area ratio (Wallace, verified; Renou, verified). Draw the water grid into a caustics texture. In the vertex shader compute where the light ray through each vertex lands on the bed for a flat surface (`oldPos`) and for the real surface (`newPos`, using `refract(-light, normal, 1.0 / 1.333)`), and place the vertex at `newPos`. In the fragment shader:
```glsl
float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));
float newArea = length(dFdx(newPos)) * length(dFdy(newPos));
gl_FragColor.r = oldArea / newArea * 0.2;   // light squeezed into a smaller area is brighter
```
The bed then samples that texture at its own position projected back along the refracted light direction and multiplies its diffuse term (`scale += diffuse * caustic.r * 2.0 * caustic.g`, where `g` carries the obstacle shadow). Renou adds a ray march against an environment depth map (50 steps in the vertex shader, `eta = 0.7504`) so caustics land on arbitrary geometry, a 2 x 5-tap Gaussian to hide triangle edges, and `causticsFactor = 0.15`. Cost: one draw of a 200 x 200 grid.

Method A without a mesh (recommended for v4, bed is nearly flat and seen from above). In a fullscreen pass over the caustics target:
```glsl
vec2 n = texture(uNormals, uv).xy;                   // surface normal xz
float depth = texture(uState, uv).r;
vec2 p = uv + n * depth * uRefractK;                 // where this column's light lands
float area = abs(dFdx(p.x) * dFdy(p.y) - dFdx(p.y) * dFdy(p.x));
float flat0 = abs(dFdx(uv.x) * dFdy(uv.y) - dFdx(uv.y) * dFdy(uv.x));
float caustic = flat0 / max(area, 1e-5);             // Jacobian determinant of the light map
```
This is a gather approximation of a scatter process, valid while displacement is under a few texels, which is the regime of a shallow stream. Clamp to about 4 and blur once.

Method B, Laplacian approximation. Expanding the determinant to first order gives `caustic = 1.0 - k * depth * laplacian(h)`: crests act as converging lenses and are bright underneath, troughs are dark. Five taps on the height texture, no extra target. It lacks the sharp folded filaments of real caustics but tracks the simulation exactly; sharpen with `pow(max(caustic, 0.0), 2.0 to 4.0)`.

Method C, animated textures. Two samples of a tiling caustic texture at different scale and scroll, combined with `min`, with a small per-channel UV offset for dispersion (Alan Zucconi https://www.alanzucconi.com/2019/09/13/believable-caustics-reflections/ ; GPU Gems chapter 2 https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-2-rendering-water-caustics ; procedural version: Dave Hoskins, Tileable Water Caustic https://www.shadertoy.com/view/MdlXz8). Looks rich in a still frame but never responds to the pointer or obstacles, and from a top-down camera the viewer can directly compare surface ripples and floor pattern, so the mismatch is visible within seconds.

Which looks most real from above: A (mesh-free form) driven by the real normals, plus a low-amplitude Method C layer that is advected by the flow field with the two-phase scheme so still stretches keep some caustic life. Details that sell it:
- Split dispersion: evaluate the light map three times with `uRefractK` scaled by about 0.98, 1.0 and 1.02 for R, G, B. Filaments get faint orange and blue fringes.
- Depth dependence: caustic contrast should grow with depth up to the focal distance and vanish where depth goes to zero (wet edge). Multiply by `smoothstep(0.0, dFocus, depth)`.
- Shadows: obstacles and ice letters must cut the caustics (Wallace keeps this in the green channel). An ice letter should cast a soft dark footprint with a bright refracted rim on its down-light side.
- Light direction: tilt the light 20 to 35 degrees from vertical so the caustic pattern is offset from the ripples that produce it; with vertical light they overlap and the depth cue is lost.
- Maxime Heckel's write-up covers the same normal-projection method in React Three Fiber with chromatic aberration: https://blog.maximeheckel.com/posts/caustics-in-webgl/

### 7. What makes top-down clear water read as water, not jelly or plastic

Jelly and plastic come from four mistakes: a visible volume boundary with thick rounded edges, uniform tint regardless of depth, broad soft specular highlights, and refraction that wobbles a whole region together at low frequency. Real shallow water seen from above is nearly invisible; you see the bed, displaced, plus a few very bright and very small events. The cues, in order of importance:

1. Refraction parallax of the bed. Offset the bed lookup by `n.xz * depth * (1.0 - 1.0 / 1.333)` (about 0.25 times depth times slope). The bed must have fine, high-contrast, straight detail (machining lines, engraved type, a grid) so the eye can see lines bend. Displacement must scale with depth: zero at the banks, strongest mid-channel. Reference image: a tiled pool floor at noon, grout lines wriggling but tiles still clearly square.
2. Caustic network drifting downstream, sharp bright filaments on the bed, brighter in deeper water, absent at the edge. Reference: sunlit creek bed over pale stone, the light net sliding across pebbles.
3. Specular glints, tiny and blown out. Use a very high exponent (Wallace uses 5000) or a GGX lobe with roughness 0.02 to 0.05, at HDR intensity 5 to 10 with a small bloom. They should appear only on the steepest ripple faces and flicker as ripples pass. Broad highlights are the single strongest plastic cue. Reference: sun sparkle on a shallow brook, points and short dashes, never patches.
4. Fresnel. Looking straight down, water reflects only 2 percent (`F0 = 0.02`), so the surface is almost purely transmissive; reflection should appear only on ripple slopes: `F = F0 + (1.0 - F0) * pow(1.0 - dot(n, v), 5.0)`. Reflect a soft environment (a large softbox or sky gradient), which makes ripples visible as light and dark bands even where the bed is plain.
5. Depth absorption (Beer-Lambert): `transmit = exp(-sigma * depth)` with `sigma` largest in red. Real coefficients per metre are about (0.45, 0.06, 0.02); for a few centimetres of stream, exaggerate by 10 to 30 times so the deepest channel shifts to a cool blue-green while the shallows stay untinted. Never tint uniformly.
6. Contact line and meniscus. Where water meets a bank or an obstacle: a 1 to 2 pixel dark line just inside the water edge (the meniscus curves up and refracts the bed away), then a thin bright specular line on the curve facing the light. Where depth goes to zero the bed just beyond is darker and slightly more saturated and glossier for a few pixels: the wet edge. Reference: a puddle on polished concrete, the dark rim and the damp halo around it.
7. Foam and surface streaks: thin, broken lines that follow streamlines, gather at stagnation points and in eddies, and dissolve. Sparse. More than about 3 percent coverage reads as soap.
8. Motion at two scales: slow bulk drift (seconds) and fast capillary ripples (tenths of a second) that travel faster than the flow. If everything moves at one speed it reads as a scrolling texture.
9. Shadows through water: objects above cast shadows on the bed that are displaced by refraction and have soft, wavering edges.
10. Correct response: a disturbance must produce rings that expand at constant speed, reflect off banks and pass through each other. Blobs that follow the cursor and relax back are the jelly signature. Volume conservation (section 1) is what removes it.

### 8. Ice letters seen from above

Goal: the name is clearly the name at a glance, and clearly ice on a second look.

Geometry without meshes: render the name once to a signed distance field (MSDF from the font, or a blurred alpha mask converted to distance; 1024 px wide is enough). Everything derives from the distance `s` (positive inside).
- Height profile: `hIce = bevel(s)`, a quarter-round over the first 8 to 12 percent of stroke width and a nearly flat top with low-frequency undulation of 2 to 4 percent. Real melting ice has rounded, slumped edges, not chamfers.
- Normal: `n = normalize(vec3(-gradient(hIce) * kBevel, 1.0))` plus a detail normal for surface melt pits (cellular noise, low amplitude).
- Refraction: sample the bed at `uv + n.xy * thickness * (1.0 - 1.0 / 1.31)` (ice IOR 1.31, `F0 = 0.018`). Strong at the bevel, where it shows a bright inverted sliver of the surroundings, and nearly zero on the flat top so the bed pattern continues through the letter almost undisturbed. That contrast between calm interior and optically busy rim is what glass and ice look like from above.
- Interior, in three parallax layers at depths 0.25, 0.5 and 0.8 of thickness (`uv + viewOffset * depth`, plus the refraction offset): (1) a cloudy core, white scatter concentrated along the stroke centre line where trapped air freezes last, `smoothstep` on `s` normalised by stroke half-width, modulated by fbm; (2) fracture planes, a sparse Voronoi-edge or authored crack map, shown as thin bright lines only when their facet normal catches the light, so they flash as the light or scroll changes; (3) bubbles, small rings with a bright dot, some stretched into short needles pointing from the centre line outward.
- Surface: clear ice is glossy (roughness about 0.05) with frost patches of roughness 0.4 to 0.6 that also add white. A wet film on melting ice makes it glossier than frozen ice, so raise gloss and lower frost as melt progresses.
- Rim light: Fresnel term plus an explicit edge term `smoothstep(e1, e0, s)` lit from one side, and a dark inner line just inside it. Bright line outside, dark line inside is the standard rendering of a transparent solid edge.
- Absorption: `exp(-sigmaIce * thickness)` with a faint cyan bias. Keep it subtle; saturated blue reads as plastic.
- Caustic and shadow under the letter: a soft dark footprint offset opposite the light with a bright focused rim on the far side (the letter is a lens). This grounds the letters on the bed and is the strongest cue that they are transparent solids.

Keeping letterforms legible:
- Choose a heavy, open sans with large counters; refraction eats thin strokes. Stroke width at least 9 to 10 percent of cap height at the smallest breakpoint.
- Keep the silhouette exact: all noise affects the interior and the normal, never the outer contour, until melting starts.
- Hold a luminance step between letter and bed: the cloudy core lifts interior luminance, the footprint shadow lowers the bed around it. Check by blurring a screenshot to 8 px and confirming the name still reads.
- Limit interior refraction offset to under 10 percent of stroke width; allow the large offsets only within the bevel band.
- Melting: animate a threshold on `s` plus a noise term weighted toward thin parts, `inside = s - melt * (1.0 + 0.6 * noise) > 0.0`, so serifs and joins go first and the skeleton of each letter survives until late. Feed the lost area into the water simulation as a source along the contour and draw a wet film ring around each letter that widens with melt.
- Keep a real DOM `h1` with the name for accessibility, search and reduced-motion; the canvas is the presentation.

### 9. Performance practice

Simulation resolutions observed first-hand: Wallace 256 x 256 (two steps per frame); three.js GPGPU water 128 x 128; Renou 512 x 512; Dobryakov velocity 205 x 128 with dye 1638 x 1024; Active Theory fluid 288 x 180 and 576 x 360 on desktop, 156 x 338 and 78 x 169 on a 390 x 844 phone; Unseen 128 x 128 and 256 x 256; Montfort trail 336 x 256; Jesper Landberg trail 144 x 90 in plain RGBA8. All are far below screen resolution and none scale with DPR.

Canvas DPR handling observed (backing store versus CSS size): Active Theory renders 2160 x 1350 for a 1440 x 900 DPR 1 viewport (1.5x supersampling, no MSAA) and on a DPR 3 phone uses a full 1170 x 2532 canvas with the scene target at 682 x 1477 (1.75x) upscaled; KPR caps a DPR 3 phone at 1.5x (585 x 1266) and halves its texture set (1024 instead of 2048 px KTX2); Jesper Landberg, Montfort and Bruno Simon cap at 2x (780 x 1688); Astrodither and Morpho cap at 1.7x (663 x 1434); Raycast's hero canvas runs at 1.6x on both desktop and phone; Unseen renders 1x everywhere (390 x 844 on a DPR 3 phone) and relies on DOM text for sharpness.

Formats and extensions (probed with the same script in all three engines on this machine, `tools/refs-c/caps.js`):

| Engine | WebGL2 float extensions | RGBA16F, RG16F, R16F renderable with LINEAR | RGBA32F renderable |
|---|---|---|---|
| Chromium 159 (ANGLE Metal, Apple M4) | EXT_color_buffer_float, EXT_color_buffer_half_float, EXT_float_blend, OES_texture_float_linear | yes | yes |
| WebKit 27.2 (Playwright build, Apple GPU) | same four | yes | yes |
| Firefox 159 | EXT_color_buffer_float, EXT_float_blend, OES_texture_float_linear (no EXT_color_buffer_half_float) | yes | yes |

Rules that follow:
- Use WebGL2 and RGBA16F or RG16F with `HALF_FLOAT`. Half-float textures are linearly filterable in core WebGL2; 32-bit float filtering needs `OES_texture_float_linear`, which mobile GPUs often lack. Never depend on it.
- Rendering to half float needs `EXT_color_buffer_half_float` or `EXT_color_buffer_float`. Request both and accept either; Firefox exposes only the latter, and iOS Safari has historically exposed only the former. Always confirm with `checkFramebufferStatus` on a real 8 x 8 target at start-up instead of trusting the extension list.
- Not verified here: real iOS hardware. Playwright WebKit on macOS is not iOS Safari. Treat iOS as: half float render targets yes, 32-bit float render targets and float linear filtering not guaranteed. Test on a device before sign-off.
- Fallback ladder: RGBA16F, then RGBA8 with height packed into two channels (16-bit fixed point) and velocity in the other two, then a static pre-rendered loop. Dobryakov's manual bilinear filter is the reference for the no-linear-filter path.
- Half float precision is about 3 decimal digits. Keep heights in a range near 1 (store `h * 10` if the waves are tiny) or small ripples quantise into terraces that show up in the caustics first.

DPR and resolution:
- Fix the simulation in sim texels, independent of canvas size, so the water behaves identically on every device.
- Cap canvas DPR at 2 (1.5 on low-end mobile). The water composite is low-frequency apart from glints; if the frame budget is missed, lower the caustics and normal targets first, then the composite scale, and never the DOM text.
- Do not adapt resolution continuously. Visible resolution pumping is worse than a constant lower resolution. Measure for the first 60 to 90 frames behind the loader, pick a tier once, and only step down (never back up) after a sustained miss, cross-fading over 300 ms.
- Use a fixed simulation timestep (for example 1/120 s, one to three steps per frame, accumulator capped at 3) so 120 Hz ProMotion and 60 Hz displays produce the same wave speed. Active Theory multiplies every per-frame rate by an `HZ` factor for the same reason.
- Allocate every target once. Reallocating on resize or per frame causes hitches (resize: debounce 150 ms and reallocate only the composite target).
- One draw per pass, a single shared fullscreen triangle, no depth or stencil buffer, `antialias: false`, `powerPreference: 'high-performance'`, `alpha: false` where the canvas is the page background. Precompile programs behind the loader (`KHR_parallel_shader_compile`) so the first scroll does not stall.
- Pause the simulation when the canvas is offscreen or the tab is hidden (`IntersectionObserver`, `visibilitychange`) and after about 2 seconds without input once kinetic energy falls below a threshold; keep rendering only the cheap flow-mapped detail.
- Keep pointer and scroll handlers passive and write only into uniforms; never read pixels back.
- Text over water stays in the DOM on its own compositor layer so it remains sharp at any canvas resolution.
