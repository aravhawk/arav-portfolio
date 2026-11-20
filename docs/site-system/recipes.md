# Recipes

Step by step, with the real file names and commands. Run commands
from the root of the checkout. Read [scenes.md](scenes.md) before
making a picture and
[consistency-checklist.md](consistency-checklist.md) before calling
anything done.

In the commands below:

```sh
py="$HOME/.t3/portfolio-redesign-v4/tools/bake-venv/bin/python"
pw="$HOME/.t3/portfolio-redesign-v4/tools/node_modules"   # Playwright
```

Both are outside the repository (see the table in
[README.md](README.md)). The production server in the examples is
`pnpm build && pnpm exec next start -p 3189`. Stop it by PID when
you finish: `lsof -tiTCP:3189 -sTCP:LISTEN | xargs kill`.

## Add a scene to the home page

A scene is four offline renders, packed, plus one line in the
registry, its words, its sound line and its stills. This recipe
makes a single-depth river scene, the kind ten of the twelve are.
Use `sample` below as the scene's id; a project's scene uses the
project's slug.

### 1. Decide the idea

One readable idea in the hero's camera grammar, from a few large
shapes or from the ground itself. Write it in one sentence before
opening Blender. If the picture encodes a number, read it from
`content/metrics.snapshot.json` in the script, as
`tools/scene/river/open_source.py` does.

### 2. Author the ground and the subject

Create `tools/scene/river/sample.py` (hyphens in the id become
underscores in the file name). `tools/scene/river/reach.py` calls
it. It may define:

| Function | Needed | What it does |
| --- | --- | --- |
| `shore(xs, y, axis, half)` | yes | Returns a signed distance in metres for a row of ground at `y`: below zero is open water, above is snow. `axis` and `half` are the default river's centre and half width |
| `subject(sawn)` | yes | Places slabs with `sawn(name, outline, thickness, centre, angles, "near", seed)`; `pass` for a scene with no object |
| `extras(grid, frozen)` | no | Adds sheets of black or sealed ice |
| `relief(xs, y)` | no | Adds height to the snow, such as a bank |
| `horizon(grid, water)` | no | Adds far water |

`tools/scene/river/kilo_bench.py` (12 lines) and
`tools/scene/river/rydar.py` are the shortest full examples.

### 3. Block it in grey and look at it small

```sh
PYTHONDONTWRITEBYTECODE=1 "$py" tools/scene/ridge/study.py \
  .tools/out/sample/studies/01.png --reach sample --clay --width 320 --samples 4
```

This takes about two seconds. (Without the first word Python
leaves an untracked `tools/scene/river/__pycache__/`: delete it,
never commit it.) It shows the solids and the relief in
plain grey; water is not dark in this mode. Pass the camera flags
you mean to use (`--distance`, `--height`, `--aim`, `--target-z`,
`--lens-angle`, and `--phone` for the tall frame). A stranger must
be able to say what it is in three words. Keep a log of each study
in `.tools/out/sample/studies/LOG.md`.

### 4. Set the cameras and bake the four renders

The cameras for each scene and gate are flags in
`tools/scene/bake-reach`. A new id gets the defaults (wide:
distance 29, height 4; tall: distance 38, height 5.6). Add a `case`
for your id there if it needs its own, as `tensorpow` and
`interests` have. Then:

```sh
PYTHONDONTWRITEBYTECODE=1 tools/scene/bake-reach sample
```

It checks the CC0 inputs, builds the day and night material
libraries from the lake if they are missing (slow the first time),
renders wide and tall in day and night with Cycles, and packs them.
Working files go to `.tools/out/o4/bake/sample/`. It writes:

- `public/scene/sample/`: eight files,
  `<wide|tall>-<day|night>.avif` (luminance) and
  `<wide|tall>-<day|night>-survey.webp` (depth, water, colour);
- `src/scene/flight/sample-assets.json`: the byte ledger.

Add up the ledger. The budget is 1,300,000 bytes for the scene.
If you used a new source, add it to `tools/scene/SOURCES.md` and
`tools/scene/lake/inputs.json`. CC0 only.

A scene that needs separate moving layers, as Infiniview does, is a
different and longer path: `tools/scene/bake-ridge`,
`tools/scene/ridge/layers.py`, `src/scene/flight/ridge.ts`. Do not
start there.

### 5. Register it

In `src/scene/flight/scenes.ts`, import the ledger and add one line
to `scenes`, in page order. The ending stays last.

```ts
import sampleAssets from './sample-assets.json';
// ...
  riverPlate('sample', sampleAssets),            // words lower left
  riverPlate('sample', sampleAssets, 'lower-right'), // or lower right
```

`riverPlate` sets the length (2 screens, 0.6 of whiteout), the
focus and the push. To change the camera move for one scene, spread
the result and override `cameras`. The page's sections, the nav's
counter, the stream and the timeline follow the list.

### 6. Its words

In `src/app/page.tsx`:

- If the id is a slug in `PROJECTS`, the default block (kind, name
  linked to its page, one line) appears with no code. The project
  must then sit at the same place in `PROJECTS` as its scene does
  among the project scenes, or `tests/content/order.test.ts` fails.
- Otherwise add a `case` to `words(id, m)` and an entry to `LABEL`
  (the section's accessible name). Without both the build fails.

The home page holds 200 visible words. See [copy.md](copy.md)
before adding any.

### 7. Its sound line

Add one entry to `SOUND` in `src/sound/scenes.ts`, keyed by the id:
how much wind, drift, running water, falling water, lapping water
and ice the picture shows, each 0 to 1.
`tests/sound/scenes.test.ts` fails until it is there.

### 8. Its stills

In `tools/site/stills.cjs`, add the id to `SCENES` at the same
place as in the registry (and to `PROJECTS` if it is a project's
scene; a project is then in `OG` too). Then, with the production
server running:

```sh
NODE_PATH="$pw" node tools/site/stills.cjs http://localhost:3189 sample
```

It needs a GPU. It writes
`public/media/stills/scene/sample-<wide|tall>-<day|night>.avif`
and, for a project, the header bands and `src/lib/og/sample.jpg`.
Scenes after the new one have moved down the page, but their own
first frames have not changed, so their stills stand. It takes
about 40 seconds for one scene.

A running `next start` does not serve files added to `public/`
after it started. Stop the server and start it again before you
look at the new stills.

The tool assumes every scene is 2.6 screens long (`LENGTH`). If you
gave a scene another length, the tool must be changed first.

### 9. Check it

1. `pnpm lint`, then `pnpm build`, then `pnpm exec tsc --noEmit`,
   then `pnpm exec vitest run`. All clean.
2. Look at the scene with its real words at the start and the end
   of its push, wide (1440 by 900) and tall (390 by 844), day and
   night. Words on calm ground at every one. Then scroll the
   whiteouts into and out of it, forward and back.
3. Reload deep in the page, and jump from the top to the end: the
   picture opens on the right scene.
4. Scripts off and reduced motion: the section shows its still and
   its words.
5. Turn sound on and pass through the scene.
6. The gate: Lighthouse on `/`, the scene's GPU time, its bytes.
   Commands in [performance.md](performance.md).
7. Commit the scene's files, its ledger, its stills and the code
   together.

## Add a project

There are three weights. Choose the lightest that is true.

**A line in the archive.** Add an entry to `ARCHIVE` in
`src/content/projects.ts` (name, one line, link, group, year). It
appears on `/work` and in the search. Nothing else.

**A row under "Also".** Add an entry to `MORE` in the same file.

**A featured project** has a page, a place in the index and a scene
on the home page. The three go together: a test holds `PROJECTS` to
the order of the scenes.

1. **Content.** Add an entry to `entries` in
   `src/content/projects.ts`: `slug`, `n` (two digits, in order:
   renumber the ones after it), `name`, `kicker`, `line` (the one
   sentence the home page shows), `summary`, `how`, `facts`,
   `links`, `media`. Every statement needs a public source. Add its
   label to `KIND` in `src/content/kinds.ts`.
2. **Media.** Real product pictures go in `public/media/` as WebP
   or AVIF at the size shown, with their true `w` and `h` and a
   written `alt` in the entry.
3. **Its scene.** Follow "Add a scene" with the slug as the id.
   Place it in `scenes` where the project sits in `PROJECTS`.
4. **Its page.** `/work/<slug>` now exists: the head, a plain body
   (summary, facts, each picture) and the ways out. For a composed
   body, add a component to `CASES` in
   `src/components/work/cases.tsx` and keep its facts in
   `src/components/work/case-data.ts`. Its styles go in
   `src/app/inner.css` under `.in`.
5. **Its header still.** Add the slug to `ALT` in
   `src/components/inner/stills.ts` with a sentence that says what
   the picture shows. The files come from step 8 of "Add a scene".
6. **Its share card.** Add the slug to `PICTURES` in
   `src/lib/og.tsx` with the same kind of sentence. The picture is
   `src/lib/og/<slug>.jpg`, from the same tool. Look at the card at
   `/work/<slug>/opengraph-image/card`: the words must stand clear
   of the subject.
7. **Copy that counts.** "Eight things I would point you to first"
   in `WAY_TO_WORK` (`src/components/inner/Page.tsx`) and the list
   of names in the description in `src/app/work/page.tsx` are now
   wrong. Fix both.
8. **Check.** The four commands; `/work`, the new page and its
   neighbours at 1440, 390 and 320 in both themes; Lighthouse on
   the new page; the sitemap (`/sitemap.xml`) lists it.

## Add or change a section on an inner page

- Every inner page is `<InnerPage head={...}>` from
  `src/components/inner/Page.tsx`. A new route under `src/app/`
  uses it and takes its metadata from `pageMeta` in
  `src/lib/meta.ts`.
- A section is `<Sec>` from `src/components/work/blocks.tsx` (or a
  `<section className="sec wrap">`). Give it a real heading with
  `title` and `id`, or an `aria-label`. No eyebrow labels as
  decoration.
- Use what exists: `Spec` for facts, `Note` for a point, `Shot` for
  a picture with its caption, `Live` for a live number, `Arrow` for
  the one arrow (`src/components/inner/bits.tsx`).
- Styles go in `src/app/inner.css`, scoped under `.in`, on the
  twelve columns, with the seven type sizes (`--t-label` to
  `--t-display`) and the `--s-*` spacing steps. No new size, no
  shadow, no gradient, no plate, nothing that fades in on scroll.
- The accent (`--acc`) means a number read live. Do not use it for
  anything else.
- A server component unless a control needs the client. The first
  picture in the first screen gets `first`; nothing else is eager.
- Check at 1440, 390 and 320 in both themes: one `h1`, no
  horizontal scroll, targets 44 px. Then Lighthouse on that page.

## Change copy

1. Read [copy.md](copy.md).
2. Project copy: `src/content/projects.ts`. Labels:
   `src/content/kinds.ts`. Facts on project pages:
   `src/components/work/case-data.ts`. The hero, the statement, the
   interests' line and the ending: `src/app/page.tsx`. The ways on
   and the footer: `src/components/inner/Page.tsx`.
3. The home page holds 200 visible words. Adding a word means
   removing one.
4. A line that got longer may now run onto busy ground. Look at its
   scene at both ends of the push, wide and tall, both themes.
5. If the words are also in a share card or in alt text
   (`src/lib/og.tsx`, `src/components/inner/stills.ts`, the route's
   `opengraph-image.tsx`), change them there.
6. Never edit `content/posts/`.

## Retire a scene or a project

**A scene that is not a project's:**

1. Remove its line and its import from
   `src/scene/flight/scenes.ts`, and `git rm` its ledger.
2. Remove its `case` and `LABEL` entry in `src/app/page.tsx`, its
   line in `src/sound/scenes.ts` (a test fails if a line outlives
   its scene), and its id in `tools/site/stills.cjs`.
3. `git rm -r public/scene/<id>` and its files in
   `public/media/stills/scene/`.
4. Leave `tools/scene/river/<id>.py` if the scene may return; say
   so in the commit.
5. Check the new join: the whiteout between its old neighbours,
   both directions, and that their words still read as a sequence.

**A featured project:** do the above for its scene, then remove its
entry from `PROJECTS` and renumber `n`, its `KIND`, its `CASES`
component and data, its entries in `ALT`
(`src/components/inner/stills.ts`) and `PICTURES`
(`src/lib/og.tsx`), its header stills and `src/lib/og/<slug>.jpg`,
and its styles in `src/app/inner.css`. Fix the counted copy (step 7
of "Add a project"). If the work should stay findable, add a line
to `MORE` or `ARCHIVE`. Its old address will be a 404: add a
redirect in `next.config.ts` if it was shared.

Commit a deletion together with what replaces it. To restore
something, take its files from history (`git log --diff-filter=D
--name-only`) and follow the add recipe's checks.

## Re-bake after a source changes

- **A river scene** (its module, its camera flags, the shared
  study script or the packer changed): `tools/scene/bake-reach
  <id>`, then its stills (step 8 of "Add a scene"), then look at
  it with its words. A change to `tools/scene/ridge/study.py` or
  `tools/scene/ridge/pack.py` touches every river scene: re-bake
  and review all ten, or do not make it.
- **Infiniview:** `tools/scene/bake-ridge`, then
  `node tools/site/stills.cjs <base> infiniview`.
- **The lake:** `tools/scene/bake-lake`. It rebuilds everything the
  lake ships, builds the site, starts a server on port 3186
  (`LAKE_POSTER_PORT` to change it), and re-shoots the lake's four
  stills. It installs the pinned Python tools with `uv` and needs
  `toktx` (it fetches it if missing).
- **A data-drawn scene after the numbers moved:** refresh the
  snapshot first (below), then re-bake `open-source` and `ollama`.
  Kilo Bench's scores are written in its module.

After any re-bake, `git diff --stat` should show only that scene's
folder, its ledger and its stills. Commit them together.

## Refresh the live numbers

The site reads its numbers on the server every hour. The committed
snapshot is only the fallback, and what the data-drawn scenes are
baked from.

```sh
node scripts/refresh-metrics.mjs --dry-run   # print what would change
pnpm metrics:refresh                         # rewrite content/metrics.snapshot.json
pnpm exec vitest run tests/metrics
```

A GitHub Action (`.github/workflows/refresh-metrics.yml`) does the
same every Monday once the branch is on `main`. To add an npm
package or change which numbers count, edit
`src/lib/metrics/config.ts`. Full notes:
`docs/redesign-v4/metrics.md`.

Change log: 2026-11-19 rewritten for the baked scenes (M1).
