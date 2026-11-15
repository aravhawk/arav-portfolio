/**
 * Live metrics configuration.
 *
 * Keep this file import-free and limited to erasable TypeScript syntax:
 * scripts/refresh-metrics.mjs loads it with plain `node` (Node 24 strips the
 * types), so it is the single place both the site and the script read from.
 */

/**
 * Which GitHub contributions number the site shows.
 * 'lifetime' sums every calendar year since the account was created.
 * 'last12months' shows GitHub's rolling "contributions in the last year".
 */
export const CONTRIBUTIONS_WINDOW: 'lifetime' | 'last12months' = 'lifetime';

/**
 * Merged PRs count as open-source work when the repository owner is NOT in
 * this list. It is the only place the rule lives: the search query, the
 * ledger filter and the snapshot all derive from it.
 */
export const EXCLUDED_OWNERS: readonly string[] = [
  'aravhawk',
  'infiniflop',
  '2ALabz',
  'nextup-inspired',
  'navkarcaterers',
];

/**
 * When true, a PR only counts if somebody else merged it. That needs one
 * extra API lookup per new PR, so it stays off unless the owner asks for it.
 */
export const REQUIRE_MERGED_BY_OTHER: boolean = false;

/**
 * npm packages to count. Add a package here (with the date of its first
 * publish) and it is included automatically from the next revalidation.
 */
export const NPM_PACKAGES: ReadonlyArray<{ name: string; firstPublished: string }> = [
  { name: '@aravhawk/cc-switch', firstPublished: '2026-02-01' },
];

/** Public npm page used as the source link once there is more than one package. */
export const NPM_PROFILE_URL = 'https://www.npmjs.com/~aravhawk';

export const GITHUB_USER = 'aravhawk';

/** Year the GitHub account was created: the first year of the lifetime sum. */
export const GITHUB_ACCOUNT_CREATED_YEAR = 2021;

export const OLLAMA_USER = 'aravhawk';

/** ISR window in seconds. Pages that show metrics export the same value. */
export const REVALIDATE_SECONDS = 3600;

/** Cache tag on every metrics fetch, for revalidateTag('metrics'). */
export const CACHE_TAG = 'metrics';

export const USER_AGENT = 'aravjain.dev-metrics/1.0 (+https://aravjain.dev)';

export const FETCH_TIMEOUT_MS = 5000;

/** A cumulative counter must be at least this fraction of the snapshot value. */
export const MIN_RATIO_OF_SNAPSHOT = 0.9;

/** Search API calls spent on the PR ledger per revalidation (one more call fetches the total). */
export const MAX_LEDGER_PAGES = 2;

export type MetricsConfig = {
  contributionsWindow: 'lifetime' | 'last12months';
  excludedOwners: readonly string[];
  requireMergedByOther: boolean;
  npmPackages: ReadonlyArray<{ name: string; firstPublished: string }>;
  npmProfileUrl: string;
  githubUser: string;
  githubAccountCreatedYear: number;
  ollamaUser: string;
  userAgent: string;
  fetchTimeoutMs: number;
  minRatioOfSnapshot: number;
  maxLedgerPages: number;
};

/** Everything above, bundled for the pure modules in ./core. */
export const METRICS_CONFIG: MetricsConfig = {
  contributionsWindow: CONTRIBUTIONS_WINDOW,
  excludedOwners: EXCLUDED_OWNERS,
  requireMergedByOther: REQUIRE_MERGED_BY_OTHER,
  npmPackages: NPM_PACKAGES,
  npmProfileUrl: NPM_PROFILE_URL,
  githubUser: GITHUB_USER,
  githubAccountCreatedYear: GITHUB_ACCOUNT_CREATED_YEAR,
  ollamaUser: OLLAMA_USER,
  userAgent: USER_AGENT,
  fetchTimeoutMs: FETCH_TIMEOUT_MS,
  minRatioOfSnapshot: MIN_RATIO_OF_SNAPSHOT,
  maxLedgerPages: MAX_LEDGER_PAGES,
};
