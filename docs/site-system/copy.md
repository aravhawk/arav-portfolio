# Copy

Status: **as built** (K1, 2026-11-20).

## How the site speaks

- Plain, specific sentences about what the thing does and what is
  true of it. If a sentence would fit any AI product, rewrite it.
- No slogans. No "X, not Y". No buzzword triads, no "revolutionize",
  "supercharge", "seamless". No captions that explain the design.
- No em dashes or en dashes. Sentence case.
- First person for him ("I co-founded"), third person for a project
  ("It switches"). One voice from the first screen to the ending.
- The home page holds 260 to 300 visible words. `checks.js` in the
  capture tools counts them; adding a word means removing one.
- Every number is real and sourced
  (`docs/redesign-v4/content-sources.md`); numbers that change are
  read live (`src/lib/metrics`) and said with when they were read.
  Merged pull requests count only repositories he does not own, less
  the repositories in `EXCLUDED_REPOS`
  (`src/lib/metrics/config.ts`). What is left out is never written
  into a page: the link under the count is a GitHub search with one
  `repo:` term for each counted repository (`buildCountedPrQuery`),
  made from the same ledger as the count. The query with the
  exclusions stays on the server.
- arav.pro is canonical. No photo of him.

## The words belong to the scenes

- A block stands on calm ground and arrives with the thing it names
  (the steps in `build`, `src/app/page.tsx`).
- A figure sits on what it counts: each stream's caption is its
  repository and its count, each column's its model and its pulls.
- A small mono label with a hairline leader names an object in the
  world (`Callout`): the block of ice, the two shards, the pane in
  the canyon's wall. Its text is a fact (a site, a name), never a
  comment on the picture.
- The ending is exactly "This was the warm-up." with "The next
  station isn't built yet." under it.

## What may appear (the owner's list, 2026-11-20)

Nine projects, in this order everywhere a list shows them
(`PROJECTS` in `src/content/projects.ts`). The home page's flight
keeps the order its world was built in.

| Project | Limits |
| --- | --- |
| Infiniview | No user numbers. Daytona Startup Grid acceptance (Apr 9, 2026) without a dollar figure. Link infiniview.dev, docs.infiniview.dev and, on its own page only, infiniflop.com (label "Infiniflop Labs"). Never the private repository. |
| Upstream | Counted live. XcodeBenchmark and openbridge are counted, not described. |
| Open models | Pulls live. For llama4, the upload date only: no claim of being first. |
| cc-switch | Downloads live, all time since Feb 1, 2026 and the last 30 days. |
| Kilo Bench | "Winner of the 'Kilo - For Devs, By Devs' prize". Never "1st overall". |
| Ask Around | "Winner" of Belweave's Notify Weekend 01 on justship.dev (Nov 7, 2026). No dollar figure. |
| RydAR | On the App Store as "RydAR: Safe Driving" since Nov 11, 2026. 2 collaborators. No competition result, no seller's name. No store link until the owner gives its address. |
| Agent Bridge | "Grok Bot" and "OpenAI agent" are the only product names for the two peers. No adoption numbers. Only the GitHub repository and the launch post are linked. |
| TensorPoW | A research implementation. No speed claim. |

Recognition is lines, never cards (`RECOGNITION`): "Selected for
OpenAI DevDay 2026" (about him, never under Infiniview); the
Business Insider story of May 2026, without his age, city or grade;
his GitHub contributions in 2026, read live and said with the date.

Nothing else is shown: no archive, no "also" list, no project the
owner holds back or has dropped, no bot name beyond the two above.
Ask the owner before adding a tenth.

## Where copy lives

`src/content/projects.ts` (every project's name, line, page copy and
links; recognition; interests; contact), `src/content/kinds.ts` (the
small labels), `src/components/work/case-data.ts` (what the project
pages' designed pieces say), `src/components/flight/` (the home
page's own sentences). The post in `content/posts/` is the owner's
own writing and is not edited.

Change log: 2026-11-18 first version (orchestrator). 2026-11-20 K1:
the definitive list, recognition, the story's rules. 2026-11-20 K2: the
public pull request link names only counted repositories.
