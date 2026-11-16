# Live metrics

The site shows four numbers that update on their own: Ollama pulls, npm
downloads, GitHub contributions and merged pull requests. This page explains
where they come from, how they are kept honest, and how to change them.

## At a glance

| Metric | Source | Kind |
| --- | --- | --- |
| Ollama pulls (total and per model) | `https://ollama.com/aravhawk` plus each model page | cumulative |
| npm downloads, all time | `api.npmjs.org/downloads/range/...` summed from first publish | cumulative |
| npm downloads, last month | `api.npmjs.org/downloads/point/last-month/...` | rolling |
| GitHub contributions, lifetime (default) | `github.com/users/aravhawk/contributions?from=YYYY-01-01&to=YYYY-12-31` per year | cumulative |
| GitHub contributions, last 12 months (optional) | `github.com/users/aravhawk/contributions` | rolling |
| Merged PRs in other people's repos (headline) | GitHub search API | cumulative |
| Merged PRs, all public (secondary) | GitHub search API | cumulative |

No credentials, no paid services, no client-side requests. Visitors never
reach the sources: every request happens on the server and is cached.

## Files

```
src/lib/metrics/
  index.ts            server-only entry: getMetrics, getSnapshotMetrics, formatAsOf
  config.ts           every switch and constant (the file to edit)
  types.ts            shared types (safe to `import type` anywhere)
  package.json        only says "type": "module" (see "The refresh script")
  core/               pure, dependency-free ES modules with JSDoc types
    count.mjs         parseCount, checkLive, pickCumulative, pickRolling
    ollama.mjs        profile and model page parsers
    contributions.mjs contributions calendar parser
    npm.mjs           date range chunking and response parsing
    github-prs.mjs    search query builder, ledger and per-repo aggregation
    collect.mjs       fetches all four sources in parallel
    resolve.mjs       validation, max(live, snapshot), fallback
    snapshot.mjs      shape check for the snapshot file
    format.mjs        formatAsOf, formatCount (also safe in client components)
content/metrics.snapshot.json   committed last-known-good values
scripts/refresh-metrics.mjs     rewrites the snapshot
.github/workflows/refresh-metrics.yml   runs the script every Monday
tests/metrics/                  unit tests and trimmed fixtures
```

The parsing, fetching and validation code lives once, in `core/`. The site
(`index.ts`), the refresh script and the tests all import the same modules.
`import 'server-only'` appears only in `index.ts`, so the script and the tests
can load everything else.

## Using it in a page

```tsx
import { formatAsOf, getMetrics } from '@/lib/metrics';

export const revalidate = 3600; // must be a literal: Next reads it statically

export default async function Page() {
  const metrics = await getMetrics();
  // metrics.mergedPrs.upstream.value, metrics.ollama.total.value, ...
  // formatAsOf(metrics.ollama.total.asOf) -> "Nov 15, 2026, 4:40 AM CT"
}
```

- `getMetrics()` never throws. Calls made during one render share one pass.
- `getSnapshotMetrics()` is synchronous and returns the committed snapshot.
- Every `Metric` carries `value`, `snapshotValue`, `live`, `asOf` (ISO time
  the shown value was retrieved) and `source` (a public URL a person can open).
- A client component cannot import `@/lib/metrics` (it is server-only). Pass
  values down as props, and import display helpers from
  `@/lib/metrics/core/format.mjs` if needed.

## Caching

Every source request is made with
`fetch(url, { next: { revalidate: 3600, tags: ['metrics'] } })`, so Next keeps
each response in its data cache for an hour. Pages that show metrics also
export `revalidate = 3600`, which makes them ISR pages: a visitor always gets
the cached HTML, and at most once an hour Next rebuilds the page in the
background. Cache Components is not used.

Per revalidation the server makes about ten requests: one Ollama profile and
one page per model, one npm range (per 12 months of history) and one npm
point, one contributions page, and two GitHub search calls. Search is capped
at three calls (the unauthenticated limit is ten per minute). Each request
sends `User-Agent: aravjain.dev-metrics/1.0 (+https://aravjain.dev)`, times
out after 5 seconds and is never retried.

To refresh on demand, call `revalidateTag('metrics')` from a route handler or
server action.

`GITHUB_TOKEN` is optional. If it is set in the environment it is sent as an
`Authorization` header to `api.github.com` only, which raises the rate limit.
The search always includes `is:public`, so a token never brings private
repositories into the results.

## Validation and fallback

Each fetched value must be:

1. a finite integer,
2. greater than zero, and
3. for cumulative counters, at least 0.9 times the snapshot value.

Cumulative counters (all-time npm, Ollama pulls, merged PRs, lifetime
contributions) are shown as `max(live, snapshot)`, so the site never shows a
broken, zero or dropping number. Last-month npm downloads and the last 12
months of contributions are rolling windows: they are validated (rules 1 and
2) and fall back, but they are allowed to go down.

On any fetch, parse or validation failure the site shows the last known good
value and logs one line on the server (`[metrics] ...`, once per distinct
problem per server process). Nothing is shown to the visitor. The four
sources run with `Promise.allSettled`, so one failing never affects another.
`Metric.live` is `false` and `Metric.asOf` is the older time whenever a value
is not from this hour's fetch.

"Last known good" is the committed snapshot, or a newer validated reading if
this server process has already seen one. That keeps a single failed hour
from pulling a number back to a week-old value.

Source by source:

- **Ollama.** Every link to `/aravhawk/<model>` on the profile is a model, so
  new models are counted automatically. The pull count is the text before
  "Pulls" in the model's row ("9,441", "12.3K" and "1.2M" all parse). Each
  model page is fetched as a cross-check (it shows the same counter next to
  "Downloads"); the larger reading wins and a large disagreement is logged.
  Validation and fallback are per model, then the models are summed. The
  model's date comes from the absolute time in a `title` attribute (for
  example "Apr 11, 2025 2:23 AM UTC"). The site labels that stamp "Updated",
  so `uploadedAt` moves if a model is pushed again.
- **npm.** The range API serves at most 18 months per request, so the range
  from first publish to today is cut into 12-month windows and summed. A
  response whose start was moved by the API, or that repeats or misplaces a
  day, is rejected.
- **Contributions.** The "N contributions in YYYY" heading must equal the sum
  of the per-day tooltips, and must be for the year that was asked for. Past
  years are immutable, so they are read from the snapshot and only the current
  year is fetched each hour. Around New Year the year that just ended is
  fetched too, until a snapshot taken after it ended exists.
- **Merged PRs.** The live number is the search `total_count`. The first page
  of results (100 per page) also gives the ledger. A complete live ledger
  replaces the snapshot ledger, so a repository that stops being public drops
  out; an incomplete one only adds to it. Per-repository counts and the
  repository count come from the ledger.

## The snapshot

`content/metrics.snapshot.json` holds every metric, the per-item breakdowns
(models, packages, years), the PR ledger (`repo`, `number`, `title`,
`mergedAt`, `url`), and for each section the time it was retrieved, the public
source URL and the endpoints that were fetched. It is committed, so a fresh
deploy with every source down still shows real numbers.

### The refresh script

```
pnpm metrics:refresh                         # same as: node scripts/refresh-metrics.mjs
node scripts/refresh-metrics.mjs --dry-run   # print what would change, write nothing
node scripts/refresh-metrics.mjs --force     # accept live values lower than the snapshot
```

It needs no install: Node 24 runs it directly, including `config.ts`.
`src/lib/metrics/package.json` exists only to mark that folder as ES modules,
which is what lets plain `node` load `config.ts` without a warning. Keep
`config.ts` free of imports and of TypeScript syntax that needs compiling
(enums, namespaces, parameter properties).

The script applies the same validation as the site. A source that fails keeps
its previous values and time. It re-reads every contribution year and both
contribution windows, so flipping the window later needs no extra step.

Use `--force` when a number has genuinely gone down (a deleted model, a
repository removed from GitHub). Without it the script, like the site, keeps
the higher snapshot value and reports that source as not refreshed.

### The weekly Action

`.github/workflows/refresh-metrics.yml` runs every Monday at 11:00 UTC and on
manual dispatch. It runs the script and, only if the snapshot file changed,
makes one signed-off commit to `main`:
`chore(metrics): weekly snapshot refresh`.

- It uses the built-in `GITHUB_TOKEN` with `contents: write`. No new secrets,
  no personal access tokens.
- Only `actions/checkout` and `actions/setup-node` are used, pinned by full
  commit SHA.
- A concurrency group keeps runs from overlapping, and there is never more
  than one commit per run.
- Commits made by the Action are bot commits and are exempt from the repo's
  SSH-signing rule.
- It only starts running once the branch is merged, because GitHub runs
  scheduled workflows from the default branch.
- If a source could not be refreshed, the run still commits what did refresh
  and then ends red, naming the source, so a broken parser is noticed.

## How to

### Add an npm package

Add one line to `NPM_PACKAGES` in `src/lib/metrics/config.ts`, with the date
of its first publish:

```ts
export const NPM_PACKAGES = [
  { name: '@aravhawk/cc-switch', firstPublished: '2026-02-01' },
  { name: '@aravhawk/new-thing', firstPublished: '2027-01-20' },
];
```

It is counted from the next revalidation. Run `pnpm metrics:refresh` so the
snapshot has it too. With more than one package the source link becomes the
npm profile (`NPM_PROFILE_URL`).

### Flip the contributions window

One line in `src/lib/metrics/config.ts`:

```ts
export const CONTRIBUTIONS_WINDOW: 'lifetime' | 'last12months' = 'last12months';
```

The label changes with it: "lifetime contributions on GitHub" becomes
"contributions in the last year". The snapshot already stores both numbers.

### Change which PRs count

Edit `EXCLUDED_OWNERS` in `config.ts`. The search query, the ledger filter and
the snapshot all derive from that one constant. Then run
`pnpm metrics:refresh`. Until the snapshot is refreshed the site recounts from
the ledger and skips the comparison against the old headline number.

`REQUIRE_MERGED_BY_OTHER` (default `false`) additionally requires that someone
else merged the PR. Turning it on costs one API lookup per PR that the
snapshot has not seen yet; with it off there are no per-PR lookups.

## Lifetime or last 12 months?

Reference values on Nov 15, 2026: lifetime 2,989 (2021: 11, 2022: 16,
2023: 2, 2024: 162, 2025: 186, 2026: 2,612); last 12 months 2,652.

| | Lifetime (default) | Last 12 months |
| --- | --- | --- |
| Size | The bigger number, always | Smaller, by whatever is older than a year |
| Direction | Only ever goes up | Can fall after a quiet stretch |
| What it says | Total work since 2021 | Current pace |
| Matches GitHub's profile | No single number on the profile shows it; a visitor has to add up the years | Yes, it is the exact line above the calendar |
| Requests per hour | One (the current year; past years come from the snapshot) | One |
| Honesty about recency | Hides that almost all of it is from 2026 | Shows it plainly |
| Risk | None once past years are stored | A visible drop if activity slows |

Today the two differ by about 13 percent, because nearly all activity is
recent. The gap widens every year the account stays active. The owner asked
for this comparison and chose lifetime as the default because it shows the
bigger number, and because a number that never drops fits the same rule the
other counters follow. Last 12 months is the better choice if the point ever
becomes "this is how active I am right now" rather than "this is how much I
have done".

## Tests

`pnpm test` runs the unit tests in `tests/metrics/`:

- count parsing ("9,441", "12.3K", "1.2M", garbage)
- the Ollama profile parser and the model page cross-check, against saved HTML
- the contributions parser (heading against per-day sum), against saved HTML
- npm range chunking (at most 18 months, no gaps, no double-counted days) and
  summing
- the PR search query builder, ledger and per-repository aggregation
- validation and fallback with a mocked `fetch`: finite integer, greater than
  zero, at least 0.9 times the snapshot, `max(live, snapshot)`, fallback on
  failure, and one source failing while the others stay live
- the committed snapshot is well formed

The fixtures in `tests/metrics/fixtures/` are real responses trimmed to the
fragments the parsers read.
