# Reference study 01: igloo.inc, landonorris.com, lusion.co, labs.lusion.co, exp-ion.lusion.co

First-hand technique study, captured 2026-11-15 with Playwright 1.65.1 (Chromium with ANGLE Metal on Apple M4, and WebKit), at 1440x900 (DPR 2) and 390x844 (DPR 3, touch, iPhone UA). Technique only. No assets, fonts, logos or palettes from these sites are in the repo.

## Method and caveats

- An init script hooked `getContext`, `shaderSource`, `linkProgram`, `createFramebuffer`, `bindFramebuffer`, `viewport`, draw calls, texture allocation and `requestAnimationFrame`. "Passes" below means framebuffer or viewport switches that received draws inside one rAF frame. Shader source was read from the hook; site bundles were read for constants.
- Evidence lives outside git in `~/.t3/portfolio-redesign-v4/references/<site>/`: `chromium-1440/`, `webkit-1440/`, `chromium-390/`, `chromium-1440-interact/`, `video/` (`chromium-1440-scroll.webm`, `chromium-1440-interact.webm`), `best/`, `_tech/*.json` (raw measurements), `_shaders/` and `_src/` (analysis copies, never to be moved into the repo).
- Scrolling was done with wheel events of 60 to 100 px (touch scroll gestures on mobile), never `scrollTo`.
- Frame pacing was measured in separate runs with no video and no screenshots, one site at a time, 15 to 20 s of continuous scroll. Headless browsers cap at 60 Hz, so 16.7 ms is the floor. 120 Hz behaviour could not be measured.
- Screenshot bursts for igloo, landonorris and lusion.co ran while other captures were encoding video, so their millisecond labels are stretched. Durations quoted for those sites come from source constants, CSS, or in-page traces, not from burst labels. Labs and Ion bursts ran alone and are accurate.

Summary of measured rendering budgets:

| Site | three.js | WebGL canvas backing at 1440x900 CSS (DPR 2) | Effective DPR | Backing at 390x844 (DPR 3) | AA | Passes / draws per frame |
|---|---|---|---|---|---|---|
| igloo.inc | r165 | 1655x1035 | 1.15 | 585x1266 (1.5) | SMAA post, no MSAA | 31 / 50 (hero), 22 / 34 (ice cubes) |
| landonorris.com | r174 | 1800x1125 | 1.25 | 780x1688 (2.0) | MSAA x2 render targets | 10 / 13 steady, 18 with hero |
| lusion.co | r158 | 2160x1350 | 1.5 | 585x1266 (1.5) | SMAA post, `antialias:false`, `alpha:false` | 13 / 16 steady, 38 / 85 hero, 57 to 67 in the astronaut scenes |
| labs.lusion.co | r138 | 2160x1350 | 1.5 | 585x1266 (1.5) | SMAA post plus FSR upscaler stage | 15 / 16 |
| exp-ion.lusion.co | r138 | 2160x1350 | 1.5 | 585x1266 (1.5), WebGL1 on mobile and WebKit | MSAA x4 main target | 33 / 36 |

Frame pacing, rAF deltas in ms while scrolling (n is frames):

| Site | Chromium 1440 (p50 / p95 / p99 / max, frames over 20 ms) | WebKit 1440 | Chromium 390 |
|---|---|---|---|
| igloo.inc | 16.7 / 33.4 / 33.5 / 50.1, 279 of 920 | 17 / 18 / 19 / 26, 2 of 903 | 16.7 / 16.7 / 16.8 / 16.8, 0 of 903 |
| landonorris.com | 16.7 / 16.7 / 16.8 / 16.8, 0 of 1201 | run hung, see Could not access | 16.7 / 16.7 / 16.8 / 33.3, 1 of 917 |
| lusion.co | 16.7 / 33.3 / 33.4 / 133, 75 of 1115 (hero idle is p50 49.9) | 17 / 34 / 44 / 50, 211 of 761 (hero idle p50 39) | 16.7 / 16.8 / 16.8 / 100, 1 of 911 |
| labs.lusion.co | 16.7 / 16.8 / 33.3 / 33.4, 18 of 1185 | 17 / 26 / 30 / 43, 119 of 880 | 16.7 / 16.8 / 16.8 / 250, 1 of 900 |
| exp-ion.lusion.co | 16.7 / 49.9 / 66.6 / 100, 294 of 857 | 19 / 28 / 32 / 96, 280 of 762 | not rerun alone; first pass under load p50 33.3 |

---

## 1. igloo.inc (pinnacle)

### What makes it world-class (specific techniques, no adjectives)

- The whole site is one WebGL canvas. There is no DOM text at all: `document.body` has zero visible text nodes, and every label is MSDF text drawn in the scene (`IBMPlexMono-Medium.json` plus a KTX2 atlas). Text and 3D therefore share one tone map, one bloom and one transition shader.
- Three scenes (igloo, ice cubes, entry portal) each render to their own composer. A full-screen composite shader blends the outgoing and incoming scene with a diagonal wipe whose edge is driven by a texture, with chromatic aberration and vertical parallax of 0.4 screen heights on both layers. The scroll loops: after the third scene it wraps to the first.
- Ice is a modified `MeshPhysicalMaterial` with a hand-written transmission stage and a two-pass back-face then front-face render (details below).
- Resolution is capped low on purpose (DPR 1.15 on DPR 1 or 2 screens, 1.5 on DPR 3) and the softness is covered with blue-noise dithering, SMAA and bloom.
- All lerps, friction and damping are frame-rate independent (`lerpFPS`, `frictionFPS` scale by `delta / 16.67 ms`), so motion is the same at 60 and 120 Hz.

### Scene and shaders

- three.js r165, WebGL2, Svelte shell, GSAP with CustomEase, Draco geometry (`.drc`), KTX2 or Basis textures transcoded to BC7 (internal formats 36492, 36493) with full mip chains, an EXR worker, an MSDF worker, an audio worker.
- One visible canvas, CSS 1440x900, backing 1655x1035. Source: `DPR = devicePixelRatio <= 2 ? min(dpr, 1.15) : min(dpr, 1.5)`.
- Adaptive DPR class: starts 2 s after load, averages FPS over at least 4 s and 5 samples; below 30 fps it lowers a multiplier by 0.1 down to a floor of 0.6; at 60 fps or more it raises it by 0.1 up to 1; it stops permanently after 4 direction flips. Observed: with a video encoder loading the machine the backing dropped to 1159x724 (0.7) in Chromium and 993x621 (0.6) in WebKit. Run alone, both browsers held 1655x1035. So igloo does drop resolution under load.
- 46 framebuffers and 90 to 91 programs created. Render targets are RGBA16F (HDR). No MSAA renderbuffers anywhere.
- Per-frame pass list in the igloo scene (31 passes, 50 draws):
  1. Mouse fluid simulation at 128x128, 10 passes: curl, vorticity, divergence, clear pressure, 3 pressure iterations, gradient subtract, 2 advections (the common stable-fluids layout). It feeds snow and smoke displacement.
  2. Scene render at 1655x1035, split around a GPGPU particle update at 388x388 (150,544 particles) that reads a 64x64x64 3D volume texture as a signed distance target.
  3. Per-scene post pass (blue noise, scroll texture, ring proximity).
  4. Main composite (two scenes plus detail overlay), then UI text draws on top.
  5. pmndrs postprocessing chain: luminance, 6 mip downsamples (828x518 down to 26x17), 5 upsamples, bloom composite (`mipmapBlur`, 6 levels, threshold 0.2, radius 0.85, intensity 1), SMAA edge, SMAA weights, final effect pass to screen.
- Ice cube scene (22 passes, 34 draws): no fluid sim; adds a transmission pre-pass and a 512x512 "mouse frost" pass.
- Entry scene: the particle volume morphs between baked 3D shapes (64 cubed volumes) for each social link.

Ice, precisely:

- Base: `MeshPhysicalMaterial` subclass with `onBeforeCompile`. Parameters read from source: colour `#e0e8ef`, `roughness 0.65` with a roughness map, tangent-space normal map at `normalScale (1,1)`, `ior 1.18`, `reflectivity 0.3`, PMREM env map (cube UV) at `envMapIntensity 0.91` rotated by pi on Y, three's own `transmission` set to 0 because the custom stage replaces it. Custom uniforms: `uTransmission 1`, `uThickness 2`, `uChromaticAberration 0.1`, frost colour, attenuation disabled (`volumeAttenuation` returns 1).
- Two passes per frame. Pass A: the cube material is set to one face side, the object frozen inside the cube is made visible, labels and background shapes are hidden, the transmission sampler is a 4x4 background texture, and the scene renders into a dedicated transmission render target. Pass B: the material flips to the other side, the transmission sampler becomes that render target, the inner object is hidden (it now only exists as a refracted image), labels are shown. This is the back-face then front-face transmission method: what is seen through the front surface already contains the far wall and the inner object.
- Refraction: for each fragment, `refract(-v, n, 1/ior)` scaled by thickness gives an exit point, which is projected to screen UV and sampled from the transmission target (three's `getVolumeTransmissionRay` logic).
- Frosted blur without a blur pass: the transmission target has mips, and the sample LOD is `log2(targetWidth) * roughness * clamp(ior * 2 - 2, 0, 1)`. Sampling uses mipped bicubic filtering (two bicubic taps at floor and ceil LOD, mixed), which removes the blocky look of trilinear mip blur.
- Dispersion: 3 loop iterations; in each, R, G and B are sampled separately with `ior`, `ior * (1 + CA * (i + noise) / 3)` and `ior * (1 + 2 * CA * (i + noise) / 3)`. Thickness is also jittered per sample by `thickness * roughness^0.33`. Jitter comes from a 128 px blue-noise texture with a per-frame offset, so 9 taps read as a continuous spectral smear.
- Micro-surface: the shading normal is perturbed by `roughness^2 * 2 * blueNoiseVector` before refraction, which gives the grainy frozen interior.
- Mouse frost: a three-mesh-bvh raycast gives the hit UV on the cube; a 512x512 ping-pong buffer accumulates a splat there (updated at most every 15 ms, target velocity decays by 0.88 per step). Channel R is frost amount, G is a rim. In the ice shader, R adds 0.025 to the normal distortion and G adds emissive frost colour multiplied by a tiling triangle texture, so frost crystals light up along the cursor trail.
- Output is clamped to 0..1 before tone mapping, which keeps the ice from blowing out under bloom.
- Camera FOV narrows with speed: `fov = 45 - 5 * |scrollVelocity|`.

### Scroll timeline

- Fully virtual. `html` and `body` are `overflow:hidden`, `scrollHeight` equals the viewport, `scrollY` stays 0.
- Wheel delta is multiplied by `0.00075` into scene units (1 unit is about 1333 px of wheel). Scene heights from source: igloo 2.35, cubes 5.5, entry scene completes the loop; one lap measured at about 11,700 px of wheel.
- Smoothing is a double lerp: `targetY1 = lerpFPSLimited(targetY1, targetY2, 0.075, cap 100 px per frame)`, then `y = lerpFPS(y, targetY1, 0.15)`. The raw target is clamped to within 750 px of the current position, so a hard flick cannot skip a scene.
- Each scene gets `progress = (y - top) / height`, which scrubs that scene's camera path and timelines. Position is taken modulo the total, which makes the loop.
- Auto-centre: 1.4 s after the last input, GSAP tweens the scroll to the nearest scene edge or to per-scene rest points (the cubes scene declares 0.2 and 0.76), duration 2 s plus distance, ease `inOut3`.
- Scroll velocity (friction 0.98 per frame, clamped 0..1) is a uniform for the transition shader and FOV.
- Project detail is a route (`/portfolio/pudgy-penguins`), opened by clicking the cube. It has its own scroll target with the same multiplier.

### Motion

- GSAP defaults: `ease power2.inOut`, `duration 0.6`.
- Custom eases (SVG path form): `inOut1 = M0,0 C0.5,0 0.1,1 1,1`, `inOut2 = C0.56,0 0,1`, `inOut3 = C0.6,0 0,1`, `inOut4 = C0.4,0 -0.06,1`, `igloo_ease_1 = C0.662,0.073 0.047,1`.
- Intro timeline: 7.5 s tweens with `inOut1` and `inOut3` starting at 0.7 s, a 4 s `sine.out` layer from 0.5 s, intro particles hidden at 3.75 s.
- Most frequent durations in the bundle: 0.4 s (14 uses), 2 s (11), 0.75 s (10), 0.2 s (10), 3 s (9), 7.5 s (8). Most frequent eases: `none` (37, scrubbed values), `sine.out` (22), `power2.inOut` (16), `power2.out` (16).
- Scene-to-scene composite: diagonal cut with slope `-0.2 * aspect`, edge displaced by a texture channel, chromatic aberration of 5 taps with barrel distortion strongest mid-wipe, layer parallax `0.4 * power2In(progress)`.
- Detail open: frost texture displacement 0.1 UV on the outgoing scene, a 0.005 UV horizontal "tech" displacement, chromatic aberration eased `power2Out`, cross-mix from 40 percent progress.

### Typography (a table of measured values)

One family: IBM Plex Mono Medium, rendered as MSDF in WebGL. `document.fonts` lists it as unloaded because the page never uses it in CSS. The wordmark is geometry, not type. Sizes below are derived from glyph advance in screenshots (Plex Mono advance is 0.6 em), accuracy about 0.5 px.

| Role | 1440 | 390 | Notes |
|---|---|---|---|
| Wordmark (mesh) | 150 px wide, about 34 px tall | 135 px wide | glow from bloom |
| Corner body copy (manifesto, copyright, scroll hint) | 13.8 px, line pitch 14.4 px (about 1.04) | 12 px, line pitch 12.7 px | sentence case, right-aligned in the top-right corner |
| Section tag (`////// Manifesto`) | 13.8 px | 12 px | lower contrast than body |
| Cube HUD label (`PORTFOLIO_CO_01`) | 16.7 px, line pitch 17.4 px | not measured | uppercase |
| Detail page body | 13.8 px, line pitch 17.4 px (1.26), 60 characters per line, column 481 px, centred | not measured | paragraphs separated by one blank line |
| Close, sound toggle | 13.8 px | 12 px | bracket corners drawn as lines |

Largest to smallest text on screen is about 1.2 to 1. Hierarchy comes from position, case and opacity, not size. The only large mark is the wordmark.

### Loader, nav, transitions, footer

- Loader: flat fog-grey field with one thin progress line about 60 px wide at centre, about 3.2 s on this connection. Then the 7.5 s intro: wireframe plexus, igloo materialises, terrain grows outward, blocks separate, HUD text types in.
- Nav: none. Four fixed HUD corners: wordmark top-left, manifesto top-right, scroll hint and sound toggle bottom-left. Corners hide while scenes transition and when the content does not apply.
- Page transition: the frost and chromatic cross-mix above. Back navigation reverses it.
- Footer: none. The last scene is the contact scene and the scroll wraps to the start.

### How text stays legible

- Text only occupies the four corners with 50 px margins at 1440 (25 px at 390). The subject sits in the centre 40 percent of the frame. The two never share pixels in the resting state.
- Cube labels sit beside the cube and connect to it with a 1 px leader line, so the label is in empty fog while still tied to the object.
- On the detail page the scene is dimmed to a dark navy and the object is reduced to a low-contrast silhouette behind a 60 character column. The dimming is done in the scene, not with a DOM scrim.
- Text is white with bloom glow over a mid-grey fog, so it holds contrast against both light and dark areas.
- HUD text fades out during the transition wipe, so text is never seen through chromatic aberration at rest.

### What v4 should take (technique only)

- The ice recipe for the name: back-face pass into a mipped target, front-face pass that refracts into it, LOD-from-roughness with bicubic mip sampling for frost, 3 samples per channel with rising IOR for dispersion, blue-noise jitter with a per-frame offset, low IOR (about 1.2), no attenuation.
- A melt can be driven the same way igloo drives frost: a persistent ping-pong mask in the object's UV space that the material reads (igloo adds emissive and normal distortion; v4 can lower roughness, raise transmission and feed the mask into the fluid as a source).
- Frame-rate independent smoothing for scroll and all followers, a per-frame step cap, and a clamp of the raw target to within about one viewport of the current position.
- Scroll velocity as a first-class uniform (FOV, aberration, flow speed).
- Blue noise plus SMAA in place of MSAA when the heavy surfaces are full-screen refraction.
- If v4 must never drop resolution, pick a fixed cap like igloo's 1.15 to 1.5 and do not ship an adaptive stepper; igloo's stepper visibly softens the picture when it fires.
- HUD-corner layout with leader lines as one model for labelling a 3D subject without covering it.

### Could not access

- No DOM text, so no computed styles; type sizes are screenshot-derived.
- Audio (the site has a sound design layer) was not evaluated.
- Exact height of the third scene was not found in source; the lap length was measured instead.
- 120 Hz pacing.

---

## 2. landonorris.com (pinnacle)

### What makes it world-class (specific techniques, no adjectives)

- Normal DOM page (Webflow) with native scroll height (13,584 px at 1440) smoothed by Lenis, and one fixed WebGL canvas behind the DOM at `z-index:-1`. Text is real HTML at all times.
- The hero portrait is a WebGL plane. A low-resolution fluid simulation driven by the cursor is thresholded into a mask that swaps the portrait for a 3D helmet rendered to an offscreen target. The fluid is never shown as fluid; it is only a mask, which is why it looks sharp at 144x90.
- 20 or more small Rive canvases (logo, buttons, next race, signature, page transition) carry the vector motion, so icons and scribbles animate at device resolution without video.
- One easing curve and one duration run nearly the whole DOM: `0.75s cubic-bezier(0.65, 0.05, 0, 1)`.
- A two-face type system (grotesque variable plus a display serif) set as mixed words inside one headline.

### Scene and shaders

- three.js r174, WebGL2, GSAP 3.13.0 with ScrollTrigger, Lenis 1.1.20, Rive `@rive-app/canvas-lite` 2.26.4, jQuery (Webflow), Draco GLB models, two 1k `.hdr` studio environments, MSDF fonts for in-canvas headlines.
- Canvas `.gl`: CSS 1440x900, backing 1800x1125. Source: `pixelRatio = width > 768 ? min(dpr, 1.25) : min(dpr, 2)`. Mobile backing 780x1688.
- Context: `antialias:false`, `alpha:true`, `powerPreference:'high-performance'`. Render targets use multisampled renderbuffers at 2 samples and are resolved with `blitFramebuffer` (4 blits per hero frame).
- Hero frame (18 passes): helmet (MeshStandardMaterial with env map, normal, roughness and metalness maps) plus wireframe into a 1800x1125 target; MSDF text into a second target; three screen draws (contour background, copy, hero composite); a 1440x900 cursor noise pass; the fluid sim at 144x90; two further MSAA targets for the helmet and matcap layers.
- Steady state below the hero: 10 passes, 13 draws. The canvas only draws the contour background and keeps the sim alive.
- Fluid sim constants from source: `resolution 0.1` of the canvas (144x90), `iterations_poisson 4`, `dissipation 0.96`, `mouse_force 50`, `cursor_size 18`, `dt 0.014`, BFECC advection on, viscosity off. Seven shader stages: advect, external force, divergence, pressure (4 Jacobi iterations, ping-pong), pressure subtract, output.
- Hero composite shader: samples the fluid texture, inverts it, `step(0.1, r)` makes a hard mask, and mixes portrait to helmet through that mask. A second term sweeps a curved wipe (`vUv.y + sin(vUv.x * PI) * sin(hover * PI) * 0.2`) when the helmet hover state toggles.
- Background contour lines: a noise texture with quantised bands; four neighbour taps at a `THICKNESS` offset; if any neighbour differs from the centre, the pixel is an edge. This draws topographic lines of constant width with no geometry.
- Glossy helmets: standard PBR with `ior` and `dispersion` uniforms present, lit only by the HDR environment; a "dark edges" term and a texture cross-fade uniform switch liveries.

### Scroll timeline

- Lenis options read at runtime: `lerp 0.1`, `wheelMultiplier 1`, `touchMultiplier 1.25`, `syncTouch true`, `syncTouchLerp 0.075`, `touchInertiaMultiplier 35`, `easing t => min(1, 1.001 - 2^(-10t))`, `autoRaf false` (driven from the GSAP ticker), `overscroll true`. Scroll is real: `scrollY` moves and the address bar and scrollbar behave natively.
- 26 ScrollTriggers use `scrub: true`; triggers mostly `start: "top bottom"` (13) or `"top 90%"` (7), `end: "bottom top"` (7).
- Pinning is done with CSS `position: sticky` wrappers, not ScrollTrigger pins: the hero (`.sticky-item.home-hero`), a horizontal track (`.horizontal-pin-sticky`) and one later section, each 100 vh tall inside a taller parent.
- Sequence at 1440: hero portrait shrinks into a frame while a horizontal marquee crosses (0 to about 1,100 px), signature draws (Rive), statement headline (1,300 to 2,400), scattered photo field with background colour stepping dark to light (2,400 to 5,400), ON TRACK / OFF TRACK split (5,600 to 6,300), full-bleed photo (6,300 to 7,200), helmet grid on black (7,200 to 9,000), store, partners, socials fan, footer card (12,684 is the bottom).
- A fixed 6 px scroll indicator on the right edge uses `mix-blend-mode: difference`.

### Motion

- CSS census on the home page: 48 elements `opacity 0.75s cubic-bezier(0.65, 0.05, 0, 1)`; 17 `color` with the same; 16 `transform`; 16 `clip-path, transform`. Secondary curve `0.6s cubic-bezier(0.19, 1, 0.22, 1)` on 4 link colours. CSS variable `--duration-default: 0.75s`.
- Menu: `.nav-menu-w` animates `clip-path: ellipse(120% 0% at 50% 0%)` to `ellipse(120% 100% at 50% 20%)`. Traced in-page: the visible sweep ran from 44 percent to 99.9 percent radius in about 620 ms with a long ease-out tail, consistent with the 0.75 s curve.
- Page transition: a full-screen lime overlay with a Rive mark (`page-transition.riv`). In-page trace of `.transition-w` visibility: shown at 29 ms, hidden at 2,288 ms, so about 2.26 s per navigation.
- GSAP usage in the bundle: eases `power2.out` (36), `none` (17, scrubbed), `power2.inOut` (15), `expo.inOut` (12), `power1.inOut` (11), `power3.out` (10), `elastic.out(1, 0.75)` (5). Durations 0.5 s (21), 2 s (19), 0.6 s (14), 0.3 s (11). Staggers 0.02 s (7), 0.015 s (5), 0.03 s (3).
- Marquee: CSS `translateXLeft 30s linear infinite`.

### Typography (a table of measured values)

Families: Mona Sans Variable (weight 200 to 900 and width axes, used for display, text and labels) and Brier Bold (display serif, used for accent words). The root size is fluid: `--fluid-font = clamp(992px, 100vw, 1920px) / 1728 * 16`, which is 13.33 px at 1440.

| Role | 1440 | 390 | Notes |
|---|---|---|---|
| Hero | no headline; portrait only, plus a 38 px / 44 px uppercase name for accessibility | same | |
| Statement headline | Mona Sans 105.8 px / 95.9 px (0.906), tracking -0.83 px, uppercase, `wdth 93, wght 660`; accent words in Brier 110 px / 91.3 px, tracking -2.5 px | 37.9 px / 34.35 px, tracking -0.68 px; Brier 37.9 px / 31.5 px, tracking -2.03 px | two faces alternate word by word |
| Section headings | 93.3 px / 79.3 px (0.85), -3.33 px, `wght 750`; 60 px / 53.2 px, -1.67 px | 43.3 px / 36.8 px, -1.08 px; 39 px / 33.4 px; 28.2 px / 25 px | uppercase |
| Inner page title (On Track) | 297.3 px / 263.4 px (0.886), -2.5 px, `wdth 95, wght 700` | not measured | |
| Lead copy (inner pages) | 30 px / 33 px (1.1), -0.83 px, `wdth 100, wght 500` | not measured | |
| Body | 16.67 px / 20.83 px (1.25), -0.17 px, `wdth 100, wght 500` | not measured | sentence case |
| Serif caption | Brier 26.67 px / 27.7 px, +0.67 px; 20 px / 18.9 px | 18.4 px / 19.2 px, +0.54 px | sentence case |
| Menu links | 70 px / 65.8 px (0.94), uppercase, `wght 660` | not measured | per-letter spans |
| Nav button label | 13.33 px / 13.33 px, weight 800, `wdth 86`, uppercase | not measured | |
| Small labels | 8.33 px / 8.33 px, uppercase, `wdth 100, wght 700`; 12 px / 15 px weight 600 to 700; 10 px / 12.5 px | not measured | |

Largest to smallest on the home page: 110 to 8.33, about 13 to 1. On the On Track page: 297 to 8.33, about 36 to 1. Width axis is used as a hierarchy tool: 75 for stat labels, 86 for buttons, 93 for display, 100 for body.

### Loader, nav, transitions, footer

- Loader: full-screen lime field with a small Rive monogram at centre and a short progress rule near the bottom. Hero visible by 5 s in the first-pass capture.
- Nav: fixed bar 83 px tall at `z-index 120`: wordmark left, monogram centre (Rive), store button and a 60 px hamburger right. No background; it sits over content.
- Menu: full-screen dark panel via the ellipse clip-path. Left half is a 2x2 photo grid, right half is 4 stacked 70 px links, small links at the bottom.
- Page transition: lime wipe with Rive mark, 2.26 s.
- Footer: a dark rounded card inset in a lime field, with a notch cut in the top edge, a 3D helmet bust centred, link columns left and right, partner logos along the bottom.

### How text stays legible

- The canvas is behind the DOM and stays visually quiet under text: outside the hero it only draws one flat colour and thin contour lines at low contrast.
- Photos and 3D objects sit in their own grid cells; text blocks are placed in the gutters between them, not on top of them. In the scattered photo field, captions are 8.33 px labels anchored to image corners.
- Where a headline does cross an image (ON TRACK / OFF TRACK between the helmet and the portrait), the headline is the foreground layer, set in solid colour, and the images are cropped to the left and right thirds.
- Section backgrounds are solid and change in steps with scroll (dark olive, grey, off-white, black), so text colour always has a known background.
- The right-edge scroll indicator uses `difference` blending so it reads on any section.

### What v4 should take (technique only)

- Run the fluid at about 1/10 resolution and never display it directly; use it as a mask or displacement source for sharp full-resolution layers. For v4's water, the same split applies: low-resolution simulation fields (height, velocity), full-resolution shading.
- BFECC advection with 4 pressure iterations is enough at that resolution and costs 7 small passes.
- Keep text in the DOM above a canvas at `z-index:-1`, and make the canvas quiet wherever DOM text sits.
- Edge detection on a banded noise field for constant-width contour lines (useful for a machined bed: tool-path or elevation lines).
- One duration and one curve for all DOM transitions (`0.75s cubic-bezier(0.65, 0.05, 0, 1)` here), plus one faster expo-out curve for hovers.
- Lenis with `lerp 0.1`, `syncTouch` and CSS sticky wrappers for pinned ranges; `scrub: true` timelines for anything that follows scroll.
- Fluid root font size (`clamp(min, 100vw, max) / design width * 16`) so every size and spacing scales together.
- Width axis as hierarchy, and a serif display face mixed word by word into a grotesque headline.
- DPR cap of 1.25 on desktop with MSAA x2 targets as an alternative to igloo's SMAA route.

### Could not access

- The dedicated WebKit pacing run hung in Playwright WebKit and was killed. The first-pass WebKit capture did complete (33 frames in `webkit-1440/`), with one page error (`getShaderInfoLog(...)` returned null) and a p50 of 52 ms while other captures were running, so that figure is not a fair measure.
- Mobile body copy sizes were cut off in the capture log.
- The mobile first pass captured 15 frames (one per about 650 px) because touch gestures carried inertia; coverage is complete but sparser than every half viewport.
- Rive state machine internals.

---

## 3. lusion.co

### What makes it world-class (specific techniques, no adjectives)

- Custom engine on three.js r158 with no GSAP and no Lenis. One fixed WebGL canvas, DOM content in a fixed container (1440x51,555 px on the home page) moved by transforms, and a second fixed 2D canvas at `z-index 100` for transition covers.
- A "screen paint" buffer: a cheap velocity and weight field at 1/8 resolution, written by the pointer and offset by scroll, used by a full-screen pass to displace and RGB-shift the final image. It makes every pixel on the site react to the cursor for about 4 small passes.
- Hero objects use a hand-written glass and gloss shader that refracts a blurred copy of the scene and ray-traces its nearest neighbours analytically.
- A pixel budget: `DPR = min(1.5, dpr)` and `MAX_PIXEL_COUNT = 2560 * 1440`; above that, both dimensions are scaled down to fit. An FSR upscaler stage exists (`upscalerAmount 1`, `upscalerSharpness 1` by default).
- A continuous 3D line (a ribbon mesh driven by scroll ratios) threads between DOM sections and links the hero, the reel and the next heading.

### Scene and shaders

- Astro site, three.js r158, WebGL2, `antialias:false`, `alpha:false`, `powerPreference:'high-performance'`. Custom `.buf` geometry format, EXR matcap, a video texture for the reel (1920x960 uploaded per frame).
- Backing 2160x1350 at 1440 (DPR 1.5), 585x1266 at 390.
- Steady frame (13 passes): low paint 540x337, paint ping-pong at 270x168 (3 passes), scene and DOM-synced planes at full size (9 passes including SMAA edge, weight, blend and the final colour pass with vignette, saturation, contrast, tint and dither).
- Hero frame (38 passes, 85 draws): the scene is rendered, copied, and blurred down an 8-step chain (1080x675, 540x338, 270x169, 135x84, two passes each) three times in the frame so that each layer of semi-transparent objects can sample a blurred version of what is behind it.
- Hero cross material (12.6 KB fragment shader):
  - Variants by define: opaque, `IS_SEMITRANSPARENT` (front) and `IS_SEMITRANSPARENT_BACK`.
  - Front: `refract(-V, smoothNormal, 1/2.4)`, offset the world position by `0.3` along that vector, project to screen UV, sample the blurred scene at `lod = 2.5 + thickness`. Back: `refract(-V, -N, 2.4)`, sample the sharp scene.
  - Fresnel: `(1 - |dot(normalize(N + SN), V)|) * (1 - thickness)`, added as `fresnel * albedo * 0.5`.
  - Matcap from an EXR with packed channels: R is diffuse, G is specular for rough, B is specular for glossy; chosen by `roughness > 0.5`.
  - Neighbour shading: up to N nearest objects are passed as position, radius, rotation and colour lists; the shader intersects analytic cylinders to get reflections, ambient occlusion and bounce colour. No shadow map, no screen-space reflection.
  - A hue term `hue2RGBSmooth(viewNormal.z * ao * 1.5)` adds thin-film colour at thin edges.
  - Filmic tone map in the material; alpha carries a bloom mask.
- Astronaut scenes (57 to 67 passes): bloom is an FFT convolution at 1024x512 (forward and inverse FFT passes with a kernel texture, 42 passes), plus halo with RGB shift and a lens dirt texture.
- Project cards: a plane shader with depth texture, ripple, depth-of-field offset and rounded corners computed in the shader, synced to the DOM rect of the card.

### Scroll timeline

- Virtual. `html` and `body` are `overflow:hidden`, `overscroll-behavior:none`, `scrollY` is 0.
- `ScrollPane` constants: wheel easing `delta = (target - current) * (1 - exp(-12 * dt))`; touch drag uses a 0.1 s velocity history and friction that mixes from 2.1 to 1.9 by speed (divisor 5 view heights); `minScrollPixel 0.1`; arrow keys step 100 px; page keys step one view.
- DOM sections report ranges (`getDomRange`) and each WebGL element reads its own show, active and hide ratios from them, so 3D pieces are tied to DOM layout, not to absolute scroll numbers.
- Home sequence in wheel px at 1440: hero 0 to 900, headline and line 900 to 2,700, reel card rotates flat and expands 2,700 to 5,000, featured work grid 5,400 to 12,600, second headline and tablet 13,000 to 15,700, tablet becomes a tunnel flight 16,000 to 22,000, call to action 22,500 to 24,000, footer 25,000 to 26,500, then "keep scrolling" loads the About page with a progress bar.
- A scroll strength value (`+= |delta|`, decays with `1 - exp(-10 * dt)`, max 1) feeds shaders.

### Motion

- CSS: `transform 0.4s cubic-bezier(0.4, 0, 0.1, 1)` (most common), `transform 0.4s` and `0.6s cubic-bezier(0.35, 0, 0, 1)`, colour `0.4s` to `0.5s ease`, one `0.3s cubic-bezier(0.16, 1, 0.3, 1)`. Menu items stagger by 0.02 s steps (delays 0.02, 0.04, 0.06, 0.08 s) at 0.5 s.
- Looping hints: `arrow-animation` and `text-animation`, 3 s, `cubic-bezier(0.1, 0, 0.1, 1)`, infinite.
- Scroll indicator fades at 2 units per second (0.5 s) after 0.5 s idle.
- All WebGL motion is computed per frame from ratios with exponential smoothing; there are no tween calls to read.

### Typography (a table of measured values)

Families: Aeonik (400, 500, 400 italic) for everything, IBM Plex Mono (400, 500) for numerals, and a 1.6 KB custom mono (LusionMono) for the loader counter.

| Role | 1440 | 390 | Notes |
|---|---|---|---|
| Hero headline | 144 px / 144 px (1.0), tracking -2.88 px (-0.02 em), weight 400 | 78 px / 78 px, -1.56 px | sentence case |
| Section heading | 115.2 px / 103.7 px (0.9), -2.3 px | 58.5 px / 52.65 px, -1.17 px | |
| Projects index title | 244.8 px / 244.8 px | 66.3 px / 66.3 px | |
| Project page title | 72 px / 68.4 px (0.95) | not measured | |
| Intro statement | 36 px / 39.6 px (1.1) | 23.4 px / 25.7 px | |
| Body | 21.6 px / 30.24 px (1.4) | 16 px / 22.4 px (1.4) | |
| Project body | 12 px / 18 px (1.5) | not measured | |
| Card title | 43.2 px / 49.7 px | 25.35 px / 29.15 px | per-letter spans |
| Labels | 14.4 px / 16.56 px, weight 500, uppercase; 14 px weight 500 uppercase (buttons) | 14 px / 16.1 px | |
| Tags | 12.96 px / 14.9 px, uppercase | 9.75 px / 11.2 px | |
| Smallest | 11.88 px / 17.82 px | 11.55 px / 17.3 px | |

Largest to smallest on the home page: 144 to 11.88, about 12 to 1. One family, almost entirely weight 400; hierarchy is size, case and tracking.

### Loader, nav, transitions, footer

- Loader: black screen, a white progress bar at centre and a three-digit counter bottom-left in the custom mono. The hero is revealed with black triangles retreating from the corners.
- Nav: fixed header 146 px tall: wordmark left; sound toggle (45 px canvas button), "Let's talk" pill and "Menu" pill right. The menu is a small white card dropping from the Menu pill (303 px wide link rows of 76 px, a newsletter field, a Labs link), not a full-screen takeover.
- Page transition: the clicked project card's WebGL plane expands into the project hero while the DOM swaps; back reverses with a blurred streak. End of page: "keep scrolling to learn more" with a progress bar that loads the next page.
- Footer: white block with address, socials and newsletter, then a black "next page" strip.

### How text stays legible

- Layout lanes: on the light sections the page is a 12-column DOM grid on a flat near-white background (`--grid-gap 2vw`); WebGL only draws inside rounded card rectangles and the thin ribbon line. Text never sits on the cards except the "Play Reel" label, which is large (about 43 px), white and centred on video.
- The ribbon line passes behind headings at a stroke width far thinner than the letter stems, in a saturated colour against black text.
- In full-bleed 3D scenes, text is large (57.6 px uppercase), placed bottom-left and bottom-right, and the scene has a dark vignette there.
- The final colour pass exposes brightness, contrast and tint uniforms, and the header switches between `is-white-bg` and `is-black-bg` classes, so UI colour follows the scene.

### What v4 should take (technique only)

- The screen-paint buffer as the cheapest whole-page liquid response: 1/8 resolution, velocity in RG and weight in BA, scroll offset applied to the sample UV so trails stay attached to content, curl noise added to the advection, then a final pass that displaces and RGB-shifts by it.
- Refraction through a pre-blurred scene pyramid with LOD chosen by thickness, plus a separate back-face variant; cheaper than per-sample blur and stable in motion.
- Packed matcap channels for diffuse and two gloss levels on machined parts.
- Pixel budget rule (`min(1.5, dpr)` and a 3.69 megapixel ceiling) fixed at resize time, with no runtime stepping.
- DOM-range-driven 3D: each 3D element reads show and hide ratios from the rect of the DOM section it belongs to. This is the mechanism v4 needs for a stream that shapes itself to each project block while text stays in DOM "land".
- A continuous element (their ribbon, v4's stream) that links sections and passes through gutters.
- Exponential wheel easing with coefficient 12 as a starting point for a virtual or hybrid scroller.

### Could not access

- The reel's Vimeo player hit a Cloudflare challenge in headless mode; the in-canvas mp4 reel texture did load.
- The in-page menu trace returned a static value (wrong element), so the menu duration is from CSS (0.4 s to 0.5 s with 0.02 s stagger), not traced.
- WebGL transition durations are not exposed as constants and burst timing was unreliable in that run.
- The hero idles at about 20 to 25 fps in headless Chromium (p50 49.9 ms) and about 25 fps in WebKit; real-GPU headed numbers were not taken.

---

## 4. labs.lusion.co

### What makes it world-class (specific techniques, no adjectives)

- Light and dark themes switch in one click with the WebGL scene following: the final colour pass has an invert uniform next to brightness, contrast and tint, and DOM colours transition in 0.25 s.
- The background is a GPGPU particle or smoke field (128x128 position and velocity textures) that reacts to a painted mouse buffer, under a grid of project cards drawn as WebGL planes with rounded corners and shadows.
- Two layouts (grid and list) of the same data, switched with an animated toggle.
- An FSR 1.0 upscaler is in the pipeline: EASU (edge-adaptive spatial upsample) then RCAS (contrast-adaptive sharpen), with `u_inResolution`, `u_outResolution` and `u_sharpness` uniforms.

### Scene and shaders

- three.js r138, WebGL2, React shell, same engine family as lusion.co (`DPR = min(1.5, dpr)`, `MAX_PIXEL_COUNT = 2560 * 1440`, `UP_SCALE` setting).
- 15 programs, 15 framebuffers. Per frame 15 passes and 16 draws: particle velocity and position at 128x128 (2), low paint 540x337 (1), paint at 135x84 (3), main scene, SMAA edge, weights and blend, EASU, RCAS, final colour, screen-paint distortion, all at 2160x1350.
- Mouse paint drives both the particle wind (`u_mousePaintTex`, `u_windForce`) and the final RGB-shift distortion.

### Scroll timeline

- Virtual (`overflow:hidden`, `overscroll-behavior:none`). The card grid scrolls as WebGL planes with DOM labels positioned to match. More than 14,400 px of wheel covers 18 experiments, then an "Explore more" row.
- A subscribe bar is fixed at the bottom centre throughout.
- Clicking a card opens `/exp/<name>` as an overlay route with a text column left and media right.

### Motion

- Loader counter 0 to 100 in about 3.3 s (accurate burst), numerals roll out by 3.9 s, hero text in by 4.5 s.
- Theme switch: body colour flips at 63 ms (traced); the WebGL cross-fade completes in about 0.6 to 0.8 s (burst frames at 121 ms, 362 ms, 601 ms, 842 ms).
- Card open and route change: a diagonal black and white band wipe drawn on a 2D cover canvas, about 1.8 s end to end.
- CSS: `color 0.25s ease-in-out` (11 elements), `transform 0.4s cubic-bezier(0.33, 1, 0.68, 1)`, `transform 1s cubic-bezier(0.785, 0.135, 0.15, 0.86)`, `background-color 0.5s ease-in-out`, `height 1s ease-in-out`.

### Typography (a table of measured values)

Families: Aeonik (400, 500, 900, 400 italic) and IBM Plex Mono Medium for metadata.

| Role | 1440 | 390 | Notes |
|---|---|---|---|
| Loader numerals | Aeonik 900, 180 px / 180 px | 90 px / 90 px | |
| Hero headline | 73.8 px / 51.66 px (0.7), tracking -1.476 px (-0.02 em), uppercase | 30 px / 30 px, -0.6 px | three lines, very tight leading |
| About headline | 120 px / 84 px (0.7), -2.4 px | not measured | sentence case |
| Card title | 30 px / 36 px (grid), 21.6 px (list) | 24 px / 28.8 px | |
| Body | 17.4 px, line-height normal | 14.04 px | |
| Nav | 16.08 px / 16.08 px, uppercase, tracking +0.32 px | 30 px / 36 px, capitalised (menu) | |
| Mono metadata | Plex Mono 500, 14.04 px, tracking +0.70 px (0.05 em), uppercase | 12 px, +0.6 px | experiment number, year, tags |
| Smallest | Plex Mono 9.6 px, +0.48 px, uppercase; Aeonik 12 px, +0.24 px | 9.6 px | |

Largest to smallest in normal use: 73.8 to 9.6, about 7.7 to 1. Sans for names, mono with 0.05 em tracking for metadata.

### Loader, nav, transitions, footer

- Loader: white screen, "0" at left and a counter at right in 180 px weight 900 numerals.
- Nav: one row: logo tag left; About, Contact, Lusion links centre; grid or list switch; theme switch ("B W"); small counter right.
- Transitions: diagonal band wipe on a cover canvas. Contact opens as a bottom sheet (597 px tall).
- Footer: none on the index; an "Explore more" row ends the list.

### How text stays legible

- Card metadata is DOM text placed on the card's own dark or image surface at fixed corners, with titles below the image area in grid view.
- The smoke background is low contrast (light grey on white, dark grey on black) and stays within about 10 percent of the background luminance, so the hero headline needs no scrim.
- In list view the 3D preview is confined to a rectangle that follows the hovered row; rows of text stay on the flat background.

### What v4 should take (technique only)

- Theme switching that includes the 3D scene: put colour grading uniforms (invert or a two-palette mix, brightness, contrast, tint) in the last pass and tween them with the CSS colour transition. For v4, light and dark should be a uniform set on the water and bed shaders, not two scenes.
- Keep an EASU plus RCAS stage in the pipeline. It lets the simulation and refraction render below output size on weak GPUs while edges stay sharp, which is a fixed-quality alternative to visible resolution stepping.
- Mono metadata at 0.05 em tracking against a neutral sans for names.
- Background effects held within a narrow luminance band of the page colour so text needs no scrim.

### Could not access

- Whether the upscaler is active (input smaller than output) on low-end devices; at both tested sizes the main targets equalled the canvas size.
- Experiments open external subdomains; only Akari's overlay and Ion were opened.

---

## 5. exp-ion.lusion.co (reachable)

### What makes it world-class (specific techniques, no adjectives)

- A product page in one canvas where each scroll section has its own baked camera animation (`cam_intro.buf`, `cam_design1.buf`, `cam_audio1.buf`, `cam_design2.buf`, `cam_material1.buf`, `cam_material2.buf`) scrubbed by scroll.
- Black product on black set, lit only by rim light, a blurred planar reflection, and a field of audio-reactive floor particles.
- A custom PBR shader with clear coat, two blended normal maps, normal filtering and specular anti-aliasing uniforms to keep highlights stable on the machined body.
- A material picker that swaps finishes in the shader with a 1.75 s light sweep.

### Scene and shaders

- three.js r138, WebGL2 on desktop Chromium, WebGL1 on WebKit and on the mobile profile. Backing 2160x1350 (DPR 1.5). Main target uses 4x MSAA renderbuffers (`RGBA8` and `DEPTH24`).
- 33 passes, 36 draws per frame, constant across all sections:
  - Floor particles: position and velocity simulation at 256x256 (65,536 points), with `u_audioIntensity` and a floor radius.
  - Environment: a cube HDR (6 faces) converted to cube UV and blurred with a spherical Gaussian pass at 3072x1024, 10 passes per frame, so the environment can rotate and change with the section.
  - Planar reflection of the product into a 2048x1024 mipped target.
  - Product shader (17.5 KB): `u_roughness`, `u_clearCoat`, `u_clearCoatRoughness`, `u_normalTexture1` and `2` with `u_normalMapBlending`, `u_useNormalFiltering`, `u_specularAntiAliasingVariance` and `Threshold`, `u_fresnelIntensity`, env rotation on Y and Z, a fake key light, an "info" texture for per-area parameters, blue-noise dither.
  - Floor shader: computes distance to the product with a rounded-box SDF, samples the reflection mip chain at `LOD = (3 + roughnessInfo * k) * distance factor` with a cubic mip filter, and offsets the UV by the info map, giving contact-sharp, distance-blurred reflections on a rough floor.
  - Bloom: threshold with halo and RGB shift, 5 separable blur levels (1080x675 to 68x43), weighted composite, then vignette, contrast, tint and dither.

### Scroll timeline

- Virtual; wheel is normalised and can also be dragged. About 4,500 px of wheel covers the page.
- Sections at 1440: intro wordmark (0), Aluminium unibody (450 to 900), design callouts (1,350 to 1,800), Hear the difference with the floor lit (2,250 to 2,700), Recycled materials close-up (3,150 to 3,600), Customizable finish (4,050 onward, last section).
- A vertical section index on the right edge (Overview, Structure and so on, 11 px labels) shows position.
- Each section's text enters while the camera is still moving and finishes after it stops; letters animate per character.

### Motion

- Loader to hero: about 6.9 s of black with one small line of text, then the wordmark rises from the bottom between 7.5 s and 8.7 s (accurate burst).
- Material change: light sweep across the surface, about 1.75 s (bursts at 252, 752, 1,249, 1,751 ms).
- Overlay (preorder, credits): 0.4 s to 0.8 s fade and scale.
- CSS: `all 0.3s ease-in-out` (9 elements), `all 0.5s ease-in-out` (6), `all 0.2s ease` (6).

### Typography (a table of measured values)

Families: PP Neue Montreal (500 and 600 in use, 400 loaded), with Aeonik and IBM Plex Mono only inside the credits overlay.

| Role | 1440 | 390 | Notes |
|---|---|---|---|
| Hero wordmark | 250 px / 187.5 px (0.75), weight 500, uppercase | 150 px / 112.5 px | cropped by the bottom edge on purpose |
| Section heading | 80 px / 76 px (0.95), weight 500, uppercase | 35 px / 33.25 px | per-letter spans |
| Tagline | 20 px / 22 px (1.1), uppercase | 20 px / 22 px | |
| Body | 14 px / 16.1 px (1.15), weight 500, sentence case | 14 px / 16.1 px | |
| Labels and buttons | 11 px / 12.65 px, weight 500 to 600, uppercase, tracking +0.5 px | 11 px | |

Largest to smallest: 250 to 11, about 23 to 1. One family at one weight; the scale jump does the work.

### Loader, nav, transitions, footer

- Loader: black, one 11 px line of text at left centre.
- Nav: logo tag top-left, Preorder pill top-right, a small round icon bottom-left, Credits bottom-right. Four corners, 50 px margins.
- Transitions: none between routes; overlays fade over the canvas with the scene dimmed.
- Footer: none. The last section is the material picker.

### How text stays legible

- Alternating lanes: the product sits right when the text block is left, and moves left or to the centre when the text is right or centred. The baked cameras are authored so the product never crosses the text block's rectangle at rest.
- The set is near black everywhere except the product rim and a controlled floor glow, so white text has constant contrast anywhere.
- In the centred section the product is small and the heading sits in the dark upper third while body copy sits below the horizon line of the floor.
- Body copy stays at 14 px weight 500 (heavier than regular) to hold up on black.

### What v4 should take (technique only)

- Author camera or flow paths per section offline and scrub them by section progress, with text lanes decided first and the 3D framed around them.
- Reflection from a mipped planar target with LOD by distance (SDF to the object) and by a roughness map: this is the right look for a machined bed under water (sharp near contact, soft far away) and costs one extra scene render.
- Normal filtering and specular anti-aliasing on machined metal so highlights do not sparkle at DPR 1.15 to 1.5.
- Spherical Gaussian env blur at runtime if the environment needs to change between themes; otherwise prefilter once.
- Per-section constant pass count: Ion keeps 33 passes whatever is on screen, which keeps frame time flat.
- MSAA x4 on the main target is affordable at DPR 1.5 for hard-edged geometry; pair it with post AA only if refraction shimmer needs it.

### Could not access

- Section durations of the baked cameras (binary `.buf` data).
- Audio reactivity (no audio in headless).
- Mobile pacing alone (only the first pass under load: p50 33.3 ms).
- The dedicated Chromium run measured p95 49.9 ms on desktop; whether that is headless overhead or real cost is unknown.

---

## Cross-site findings for v4

1. Resolution: none of the five render at native DPR 2 or 3. Caps are 1.15 (igloo), 1.25 (landonorris), 1.5 (all Lusion sites), with 1.5 to 2.0 on phones. Softness is hidden with blue-noise dither, bloom and SMAA or 2x to 4x MSAA. For "no resolution drops", choose a fixed cap and budget for it; igloo's adaptive stepper (minus 0.1 per step down to 0.6) is the one visible quality change in the set.
2. Simulation resolution: fluid fields run at 128x128 (igloo), 144x90 (landonorris), 270x168 (lusion paint), 135x84 (labs). None exceeds about 1/8 of screen size. Detail comes from the full-resolution shading that reads the field.
3. Refraction: both igloo and lusion refract into a blurred or mipped copy of the scene with LOD from roughness or thickness, and both render back faces separately. Dispersion is per-channel IOR offsets with blue-noise jitter (igloo). Neither traces real rays.
4. Scroll: three models. Fully virtual with scene progress (igloo, Lusion family), and native scroll plus Lenis plus sticky plus scrub (landonorris). The native model is the only one where text is selectable DOM with normal accessibility and where pacing stayed at a flat 16.7 ms.
5. Text safety: every site reserves lanes. Igloo and Ion use four HUD corners with 50 px margins; landonorris and lusion keep the canvas quiet under DOM text and confine 3D to cards, gutters or cells; all use solid or tightly controlled backgrounds behind copy. No site relies on a blur or gradient scrim over busy 3D for body text.
6. Type: each site uses one or two families. Body is 14 to 21.6 px at 1440 with line-height 1.15 to 1.4; small labels are 8.33 to 14.4 px, uppercase, weight 500 or more, tracking 0 to +0.05 em; display is 73.8 to 250 px with line-height 0.7 to 1.0 and tracking about -0.02 em. Largest to smallest ratios run from 7.7 to 1 (labs) through 12 or 13 to 1 (lusion, landonorris home) to 23 to 1 (Ion) and 36 to 1 (landonorris inner page). Igloo is the outlier at 1.2 to 1 with a single mono.
7. Motion: DOM durations cluster at 0.4 s (Lusion) and 0.75 s (landonorris) with strong ease-in-out curves (`0.4, 0, 0.1, 1`, `0.35, 0, 0, 1`, `0.65, 0.05, 0, 1`). Scene transitions take 1.75 to 2.3 s. Intros take 7 to 9 s from navigation to an interactive hero.
