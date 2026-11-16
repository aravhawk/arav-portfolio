# Font licences

Every face shipped by the site is under the SIL Open Font License 1.1 and is
self hosted from this repository. The licence texts are committed in
`public/fonts/LICENSES/`.

| Family | Files in the repo | Licence | Copyright | Source | Reserved Font Name |
|---|---|---|---|---|---|
| Martian Grotesk | `src/fonts/MartianGrotesk-VF.woff2` (variable, width 75 to 200, weight 100 to 1000); `src/fonts/MartianGrotesk-Ice.woff2` and `src/fonts/og/MartianGrotesk-Display.ttf` (static instance, width 112, weight 760); `src/fonts/og/MartianGrotesk-Text.ttf` (static instance, width 100, weight 460) | SIL OFL 1.1, `public/fonts/LICENSES/MartianGrotesk-OFL.txt` | Copyright 2021 The Martian Grotesk Project Authors (https://github.com/evilmartians/grotesk) | https://github.com/evilmartians/grotesk | None |
| Martian Mono | `src/fonts/MartianMono-VF.woff2` (variable, width 75 to 112.5, weight 100 to 800); `src/fonts/og/MartianMono-Label.ttf` (static instance, width 100, weight 480) | SIL OFL 1.1, `public/fonts/LICENSES/MartianMono-OFL.txt` | Copyright 2021 The Martian Mono Project Authors (https://github.com/evilmartians/mono) | https://github.com/evilmartians/mono (also in Google Fonts `ofl/martianmono`) | None |

Notes:

- The static instances were cut from the variable fonts with `fonttools
  varLib.instancer`. The OFL allows modified versions, and neither family
  declares a Reserved Font Name, so the instances keep the family names.
- The static `.ttf` files exist because `next/og` cannot read woff2 or
  variable fonts; they are used only to draw the Open Graph cards.
- `system-ui` appears only as a fallback in font stacks. No system font file
  is embedded.
- Faces that were evaluated and rejected, and why, are in `typography.md`.
  Zalando Sans in particular carries a Reserved Font Name, which would have
  meant shipping the upstream file untouched or renaming the family.
