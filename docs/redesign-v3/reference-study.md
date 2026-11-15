# Reference study (first hand, 2026-11-14)

Every site below was opened in Playwright Chromium (ANGLE Metal, WebGL2) and, where noted, WebKit. Pages were scrolled in 200px wheel steps, hovered, dragged, menus opened and one internal link followed. Bundles and captured GLSL were grepped for technique evidence. Captures (PNG, webm, HAR, shader dumps) are in `~/.t3/portfolio-redesign-v3/references/`, outside git. Nothing here is from memory.

## Pinnacle

### igloo.inc
- **Loader:** flat `#A0A5B1` with an ASCII progress glyph, then a wireframe line network resolves into the lit scene over 5 to 7s (GSAP CustomEase `M0,0 C0.662,0.073 0.047,1 1,1`).
- **Rendering:** three r165, one WebGL2 canvas, no DOM text at all (MSDF text in GL). 134 custom ShaderMaterials, pmndrs postprocessing (bloom, DoF, god rays, SMAA), fluid sim passes. DPR capped: `dpr<=2 ? min(dpr,1.15) : min(dpr,1.5)`, adaptive.
- **Glass:** the ice blocks are `MeshPhysicalMaterial` patched in `onBeforeCompile`: a pre-rendered scene texture is sampled 3 to 5 times with `refract(-v, n, 1/ior)` and a per-channel IOR offset (`uChromaticAberration .1`, `uThickness 2`, ior 1.5 and 1.18), blue-noise jitter, roughness-driven LOD blur, normals perturbed by a mouse fluid texture.
- **Scroll:** no page scroll. Wheel feeds one virtual value, double lerped (0.075 then 0.15), idle snap to the nearest section. Sections are separate scenes blended in one full-screen shader driven by progress and velocity.
- **Copy:** about 36 words on the first screen, IBM Plex Mono 12 to 14px, monochrome.
- **Why it works:** one material (ice) carries the whole site, and scroll velocity is an input to the picture, not only to position.

### landonorris.com
- **Loader and route change:** the same full-screen lime `#D2FF00` wipe with a small Rive mark. One device, used for both.
- **Rendering:** three r174 fixed canvas plus Rive canvases. The hero head uses projected textures; a mouse fluid sim texture masks in a second render (the helmet) along the cursor trail.
- **Scroll:** Lenis 1.1.20 (`lerp 0.1`, `syncTouch`), GSAP ScrollTrigger scrub, SplitText. Sections change by ground colour (white, dark green, cream, black); lines reveal behind solid lime blocks.
- **Type and copy:** Mona Sans bold caps with a display serif inside the same headline; about 12 words on the first screen.
- **Why it works:** four flat grounds and one brand colour, type at poster scale, and the cursor reveals a second state of the same object.

### lusion.co and labs.lusion.co
- **Loader equals transition:** a 2D canvas overlay draws both the loader shape and every route change.
- **Rendering:** three r158, own engine (no GSAP, no Lenis). Post: SMAA, bloom, mouse-velocity screen distortion, camera motion blur.
- **Glass:** custom shader, `ior 2.4`, one refracted lookup of a mip-blurred scene texture (`lod = 2.5 + thickness`), matcap spec, fresnel, hue shift by view normal.
- **Motion:** scroll smoothing `1 - exp(-12 dt)`; drag inertia; pointer values run through second-order dynamics (f 1.35, zeta 0.5, r 1.25). CSS curve `cubic-bezier(.35,0,0,1)`.
- **Labs:** cards tilt with scroll velocity inside a looping grid; greyscale thumbnails take colour on hover; a `backdrop-filter: invert(1)` disc cursor. react-spring tensions 170/26 to 400/32.
- **Why it works:** every pointer-following value has mass, and the cheapest possible glass (one blurred refracted lookup plus fresnel) still reads as glass.

## Glass and material specialists

| Site | Technique (evidence) |
|---|---|
| labs.noomoagency.com | drei-style MeshTransmissionMaterial port: scene to FBO, resampled 2 to 4 times with refracted UVs; `thickness 1.3, roughness .001, chromaticAberration .01, samples 4` (2 on small screens). A faceted glass sphere refracts large black type. |
| jesperlandberg.com | Everything in WebGL. Scene renders to a target, a lens pass shifts R and B by `±u_aberr (.004)` of the lens deflection inside a rim band. Springs are a batched pool configured as `{response .5, dampingRatio 1}`. Card to page is a shared element grown inside WebGL; router calls `startViewTransition`. |
| organimo.com | `MeshPhysicalMaterial` transmission only on WebGL2 desktop, tinted matcap otherwise. Barrel-distortion chromatic aberration post pass. A clean capability gate. |
| reactbits.dev Fluid Glass | Raymarched SDF glass: `refract(rd, n, 1/ior)`, interior bounces, exit with `ior ± dispersion * 0.06` for R and B, 8-tap ring blur for frost. |
| kube.io liquid glass | SVG chain: `feImage(displacement)` then `feDisplacementMap` (scale 55 to 134), saturate, a specular rim image, blends; applied as `backdrop-filter: url()`. The map comes from ray simulation through a convex squircle bezel. Chrome only. |
| reactbits.dev Glass Surface | Three `feDisplacementMap`s, one per channel at scale -180/-170/-160, give dispersion. Sniffs the UA: SVG path in Chromium, other paths elsewhere. |
| apple.com/os/ios, developer.apple.com/design | No canvas, no SVG filter on the marketing pages. Nav is `saturate(1.8) blur(20px)` over 80% alpha. The liquid glass hero is an image. |
| igloo.inc, lusion.co | See above. |

**Verified cross-browser fact that drives the build:** `CSS.supports('backdrop-filter','url(#f)')` returns true in Chromium, WebKit and Firefox, but only Chromium renders the displacement. Feature detection cannot choose the path, so the SVG refraction path is selected by engine and everything else gets the tuned `backdrop-filter` stack. WebGL glass rendered in all three engines.

## Fluid motion specialists

| Site | Technique (evidence) |
|---|---|
| emilkowal.ski | `type: "spring", bounce: 0` with durations .2 to .8. Bounce is rare. |
| rauno.me | Motion springs 400/30, 500/40; 320/60 mass .2 for fast pieces. |
| linear.app | Springs 200/18 mass .5, 1500/80; `(.32,.72,0,1)` at .7s for sheets; view transitions with the root animation disabled. |
| family.co | Heavy sheets at 800/80 mass 4; ease `[.19,1,.22,1]`. |
| podium.global | Lenis `lerp .08`; shader uniforms `uScrollVelocity`, `uBarrelIntensity`: scroll velocity distorts the picture. |
| shader.se | Cursor followers on Motion springs 60 to 150 stiffness, 20 to 30 damping. |
| dala.craftedbygc.com | GPGPU particle spring sim; `blur(20px)` header with an `@supports` fallback. |

## Others studied

unseen.co (Highway cross-dissolve between WebGL scenes, fluid sim, `(.16,1,.3,1)` at 1s), kprverse.com (ScrollTrigger pinned wipes on native scroll, mono HUD nav), bruno-simon.com (three WebGPURenderer plus Rapier; overshoot curves `(.4,1.6,.65,1)`), landdding.com entries (petrillo.studio, griflan.com, bem.ai, grida.co), godly.website entries (podium.global, astrodither, nothing-to-watch, augen.pro), activetheory.net, fluid.glass.

## Could not access or verify

- obys.agency (DNS failure), the Codrops liquid-glass article (403), resn.co.nz (stuck on its loader), zajno.com (not attempted).
- godly.website now redirects to recent.design and has no 3D or glass tag; landdding.com has no dev-tool category. Entries were picked by inspection.
- Interruptibility was not measured on any reference; spring constants come from bundles and are not mapped to specific elements.
- No depth-of-field parameters were extracted anywhere.
- Playwright's WebKit and Firefox builds did not render plain `backdrop-filter: blur()` on the test page, so blur fallbacks cannot be judged visually in those two engines from automation. See design-review.md for how this was handled.
- Igloo's Manifesto panel did not open in capture; Lusion's footer was not reached.

## Decision map

| v3 choice | Learned from | What changed in translation |
|---|---|---|
| One material carries the site: a drop of liquid glass | Igloo (ice only) | Liquid instead of solid, so it can become each project. |
| Raymarched SDF glass in a single WebGL2 fragment shader, no three.js | ReactBits Fluid Glass, Lusion's one-lookup glass | SDFs morph for free; per-channel exit refraction gives dispersion; total JS stays small. |
| Per-channel IOR offset for dispersion, mip LOD blur for frost | Igloo, Jesper, Lusion | Three exit rays, one per channel. |
| Glass refracts large type | Noomo Labs | The type is real DOM text; a mask of it is drawn from the live DOM rectangles each time they move and uploaded, so the drop bends the same letters that are on the page. |
| Flat grounds that switch per beat, four colours total | Lando Norris | Ground colour is blended continuously in JS and in the shader, never cut. |
| Scroll velocity is an input to the picture | Igloo, Podium, Jesper | Velocity stretches the drop and leans the display type. |
| Lenis smoothing | Lando, Podium | `lerp 0.1`; native scroll remains the source of truth. |
| Springs as response plus damping ratio, zero bounce by default | Emil, Jesper, Apple | One closed-form spring class for DOM and uniforms. |
| Pointer values have mass | Lusion second-order dynamics | Drop tilt, rim light and magnets all run through springs. |
| Loader and route change are the same device | Lando, Lusion | The drop is both: it condenses on load and persists across routes while React view transitions move the DOM. |
| Shared element between list and detail | Jesper | `<ViewTransition name>` on project and post titles; the drop itself is the second shared element. |
| SVG displacement panes in Chromium, tuned blur stack elsewhere | kube.io, ReactBits Glass Surface, Apple nav | Engine sniff, because feature detection lies. |
| Capability gates and DPR caps | Igloo, Organimo, Noomo | DPR cap 1.5, adaptive resolution tiers, fewer march steps on small screens, CSS glass when WebGL2 is missing. |
| Monospace HUD readouts in corners | Igloo, KPR | Only for real numbers. |
| Copy density | Igloo 36 words, Lando 12 words on the first screen | Home capped at 200 words in total. |

Nothing was copied: no code, shaders, copy, assets or signature effect from any reference.
