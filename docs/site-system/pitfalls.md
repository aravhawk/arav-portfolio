# Known pitfalls

Each of these cost time on this build.

## Git and the build

- **A staged deletion rides into the next commit**, whatever that
  commit was meant to be. `git rm` a file in the same commit as
  what replaces it, and read `git status --short` for staged lines
  before every commit. Never `git add -A` or `git add .`.
- **Typecheck after the build, not before.** Next writes the route
  types during `pnpm build`. With stale ones `pnpm exec tsc
  --noEmit` can fail on a route that is fine.
- **Every commit must build and typecheck on its own.** Do not
  split a change so that one half does not build.
- **`.tools/` is ignored through `.git/info/exclude`**, not
  `.gitignore`. Evidence there is never committed, and a fresh
  clone elsewhere will not ignore it.
- **Python leaves `tools/scene/river/__pycache__/`** after a study
  render unless `PYTHONDONTWRITEBYTECODE=1` is set. It is
  untracked and not ignored. Delete it.
- **The root `AGENTS.md` and the empty file
  `_tmp_331_893442adcee2e4a63d7a6f1b4b38a471`** are tracked on
  purpose. Do not delete either as stray output.
- **zsh does not split unquoted variables into words.** Quote and
  list arguments one by one in scripts you run by hand.

## Making pictures

- **A helper stops at a picture.** A good render is not a scene.
  The job ends when it is packed, registered, has its words, sound
  line and stills, and its faults are listed. One helper stopped at
  seven studies and was sent back.
- **Heaps of small pieces read as rubble.** A few large upright
  solids read at thumbnail size. Block in grey and check at 320 px
  before any material.
- **Words on busy ground.** A composition that is calm at rest can
  put a channel, a shoreline or the subject behind the words by the
  end of the push. Check both ends, with the real words.
- **The phone needs its own composition.** Cropping the wide frame
  loses the subject or the outer parts of it. Every scene has a
  tall camera of its own.
- **Projection stretches at the end of a push.** A plate is a flat
  render moved by depth. Push far and snow smears into streaks and
  slabs slide without parallax. Shorten the push or give the
  revealed surface its own bake, as the lake does.
- **Night that passes the numbers and looks wrong.** A grade laid
  over the night render met every contrast figure and left bright
  patches round the mist. The fix was in the scene's light. Look.
- **A night gone charcoal.** A night render made by darkening the
  day loses its blue. Night is its own bake in the blue hour.
- **A near-zero blend still costs a draw.** At the last frame of a
  push a blend of about 3e-15 scheduled the next scene and a
  fourth draw. `position()` now compares on the whole timeline so
  that pose is exactly zero; `tests/scene/position.test.ts` holds
  it. Do not compute a blend from a difference of rounded numbers.
- **One change, half applied.** A light, material or camera rule
  changed for one scene only makes the page incoherent. Change all
  the scenes it applies to, or none.
- **Review the frames between the stops**, not only the composed
  frames. Faults hide in the push and the whiteout.

## Measuring

- **A busy GPU ruins every number.** With a Cycles render running
  on the same machine, a 4 ms frame measured 80 ms and a clean
  scroll showed 170 slow frames. Check for other jobs first.
- **A program is built at its first draw** on Apple GPUs, and the
  driver keeps it between visits, so a machine that has run the
  site before hides the stall. The renderer draws each program
  once into a tiny target before the canvas is shown. Keep that
  when you add anything that draws.
- **Lighthouse's phone LCP punishes a picture.** Its simulation
  charged a 9 KB header picture with every script loaded before
  it: 2.5 to 2.9 s. Only a text LCP passes. That is why a project
  page on a phone opens on a full-screen still with the title as
  the largest paint.
- **Lighthouse cannot see words over a picture.** Its
  accessibility 100 says nothing about contrast on the canvas.
- **`next start` does not serve files added to `public/` after it
  started.** New stills 404 until the server is restarted.
- **Capture from the production build.** The dev server is slow
  enough to catch things mid-load.
- **Small tiled sheets hide faults in type.** Judge inner pages at
  full size.

## The page

- **A link to the home page, prefetched from an inner page, pulls
  in the home page's chunks and styles** (about 100 KB). Every
  `Link` to `/` has `prefetch={false}`. So do the station links on
  the home page: all twelve word blocks are in the viewport at
  once, so the default would fetch every project page at load.
- **Glass.** Frosted, blurred or translucent panels read as
  AI-made to the owner. Solid plates only.
- **A panel or a shadow behind words** to rescue contrast is not
  allowed. Fix the picture.
- **The audio context must be made inside the press.** A browser
  will not start sound otherwise. The first context can hold the
  page for about 100 ms; the toggle warms the audio service when
  the pointer or focus reaches it
  (`src/components/SoundToggle.tsx`).
- **Hiding off-screen words from assistive technology** was how the
  lab page worked and is wrong for the real page. Nothing is
  `aria-hidden` or `inert` for being off screen.

## Tools that have gone stale

These are in the repository and no longer run as they are. Fix one
before you rely on it; do not copy its paths.

- `tools/scene/measure-flight.cjs` and
  `tools/scene/measure-lake.cjs` open `/lab/flight` and `/lab/hero`
  on fixed ports. Those routes were removed. Use the scripts in
  `docs/site-system/measure/`.
- `tools/scene/codecs.mjs` copies decoders out of `three`, which is
  not a dependency. The decoders it once copied are committed in
  `public/scene/lake/codecs/`.
- `tools/site/stills.cjs` works, but carries its own lists of
  scenes and projects and a fixed scene length of 2.6 screens.
- `tools/scene/SOURCES.md` says the lake's poster server uses port
  3184; `tools/scene/bake-lake` uses 3186.

Change log: 2026-11-18 first version; 2026-11-19 rewritten for the
baked scenes (M1).
