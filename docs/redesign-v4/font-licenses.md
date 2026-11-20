# Font licences

Every face shipped by the site is under the SIL Open Font License 1.1 and is
self hosted from this repository. The licence texts are committed in
`public/fonts/LICENSES/`.

| Family | Files in the repo | Licence | Copyright | Source | Reserved Font Name |
|---|---|---|---|---|---|
| TASA Orbiter | `src/fonts/TASAOrbiter-VF.woff2` (variable, weight 400 to 800); `src/fonts/TASAOrbiter-Ice.woff2` (static instance, weight 800, the face the ice name is drawn from); `src/fonts/og/TASAOrbiter-Display.ttf` (static, weight 800) and `src/fonts/og/TASAOrbiter-Text.ttf` (static, weight 500) | SIL OFL 1.1, `public/fonts/LICENSES/TASAOrbiter-OFL.txt` | Copyright 2025 The TASA-Typeface-Collection Project Authors | https://github.com/localremotetw/TASA-Typeface-Collection (via google/fonts, `ofl/tasaorbiter`) | None declared |
| Spline Sans Mono | `src/fonts/SplineSansMono-VF.woff2` (variable, weight 300 to 700); `src/fonts/og/SplineSansMono-Label.ttf` (static, weight 500) | SIL OFL 1.1, `public/fonts/LICENSES/SplineSansMono-OFL.txt` | Copyright 2022 The Spline Sans Mono Project Authors | https://github.com/SorkinType/SplineSansMono (via google/fonts, `ofl/splinesansmono`) | None declared |
| Newsreader | `src/fonts/Newsreader-Accent.woff2` (optical size fixed at 72, weight 300 to 500, Latin subset) | SIL OFL 1.1, `public/fonts/LICENSES/Newsreader-OFL.txt` | Copyright 2020 The Newsreader Project Authors | https://github.com/productiontype/Newsreader (via google/fonts, `ofl/newsreader`) | None declared |

Notes:

- The static instances and the Newsreader subset were cut from the variable
  fonts with `fonttools` (`varLib.instancer` and `subset`). The OFL allows
  modified versions, and none of the three families declares a Reserved
  Font Name, so the cuts keep the family names.
- `src/fonts/TASAOrbiter-Latin.woff2` and `src/fonts/SplineSansMono-Latin.woff2`
  are Latin cuts of the two variable fonts (K3, 2026-11-20), made with
  `fonttools subset` by `scripts/font-cuts.sh`: the same outlines, metrics
  and weight axis, fewer characters, and without the stylistic sets the
  site never asks for. Pages load these. The whole fonts stay beside them
  and are fetched only for a character a cut leaves out
  (`src/app/globals.css`).
- The static `.ttf` files exist because `next/og` cannot read woff2 or
  variable fonts; they are used only to draw the Open Graph cards.
- Newsreader is an accent: it sets two sentences on the site. It is one
  display-size instance, Latin only, so it costs 48 KB and is not preloaded.
- `system-ui` and `Georgia` appear only as fallbacks in font stacks. No
  system font file is embedded.
- Faces that were evaluated and rejected, and why, are in `typography.md`.
  Martian Grotesk and Martian Mono shipped in the first build and were
  replaced after the blind ranking; their files and licence texts are gone
  from the repository. Zalando Sans carries a Reserved Font Name, which
  would have meant shipping the upstream file untouched or renaming the
  family.
