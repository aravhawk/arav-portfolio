# v3 concept

## What the site has to say

Arav builds agents, breaks software on purpose, ships open source, and likes rockets and circuit boards. The numbers are real and small enough to read at a glance. The site should feel like one continuous object you can push around, not a stack of sections.

## Three concepts

### A. Flight computer
A glass circuit board the size of the page. Scroll flies the camera along traces from component to component; each component is a project; signals pulse along the traces.

- For: ties to the VELOCITY boards and to agents passing messages.
- Against Igloo: Igloo's world is three objects in empty space. A board is hundreds of small parts, so nothing leads.
- Against Lando: no room for type at poster scale.
- Against the glass references: glass over a dark board has little to refract. Circuit imagery is also what the current site already uses as a background.
- Verdict: rejected. Busy, expected, and weak for glass.

### B. Ascent
Scroll is altitude. The page climbs from the pad to orbit, each project is a stage event, glass is the cockpit canopy and its HUD.

- For: spaceflight is his thing, the loader is a countdown.
- Against Igloo and Lando: a climb through a sky gradient is a background, not an authored object. It is also close to v2's sunrise scroll, which is off limits.
- Against the glass references: a canopy is one flat pane. No thickness, no dispersion worth showing.
- Verdict: rejected. Too near v2 and the glass is a sticker.

### C. One drop (chosen)
A single drop of liquid glass sits in front of type set at poster scale. It condenses out of small droplets while the page loads. As you scroll it flows into the shape of each thing he built: a lens for Infiniview, a merge graph for open source, benchmark bars for Kilo Bench, two bodies and a bridge for Agent Bridge, four stacked discs sized by real pull counts for the Ollama models, a switch you can flip for cc-switch, a 3x3x3 lattice for TensorPoW, an engine bell for Merlin. It refracts the real headline behind it with chromatic dispersion, stretches with scroll velocity, leans toward the cursor and can be grabbed and thrown. The ground switches between four flat colours. The drop follows you to /work, the project pages and the blog.

- Against Igloo: same discipline (one material, one object, almost no copy) with a different material and behaviour. Igloo's ice is rigid and placed; this is liquid and changes form.
- Against Lando: borrows flat grounds and poster type, replaces the cursor-reveal with a body you can handle.
- Against the glass references: this is the Noomo and ReactBits class of glass (real refraction with interior path, per-channel exit, fresnel, specular) and the DOM panes use the kube.io displacement chain where the engine supports it.
- Against the motion references: every value is a spring; the drop is the shared element across routes.
- Risks: a raymarcher costs fill rate (answered with a bounding test, DPR cap and adaptive tiers); a blob can look generic (answered with authored, recognisable forms and real data in the geometry).
- Verdict: chosen.

## How the chosen concept meets the brief

| Requirement | Answer |
|---|---|
| Original | No reference has a single morphing liquid body whose forms are the portfolio. |
| Expresses Arav | Lens under attack (security), merge graph (open source), bars (evaluation), bridge (agents), switch (tools), lattice (research), engine bell (rocketry). Mono readouts and the engine cover the hardware side. |
| Authored 3D centerpiece that carries the story | Eleven hand-written signed distance forms in one shader, blended by scroll. |
| Glass as core material | The drop (WebGL refraction, dispersion, fresnel, specular, absorption) and every pane, chip, nav and button (layered DOM glass with one light direction). |
| Memorable loading moment | Droplets stream in and merge into the drop while a mono counter runs on real readiness (fonts, shader compile). The headline is on screen from the first paint. |
| Each flagship its own beat | Own form, own ground, own type entrance, own pane position, and one interaction where it makes sense (flip the switch, drag the engine). |

## System

- **Grounds:** Cloud `#E8ECEF`, Ink `#0A0C0F`, Signal `#FF4B14`, Cobalt `#1433FF`. No other page colours. No violet.
- **Type:** Archivo variable (width 62 to 125, weight to 800) for everything; Geist Mono only for numbers and readouts. No italics.
- **Light:** one key light from the upper left for the drop, the pane rims and the shadows.
- **Radii:** 12, 20, 28, pill. Spacing on an 8px grid (4 for hairline gaps).
