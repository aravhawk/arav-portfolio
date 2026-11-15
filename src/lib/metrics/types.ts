/**
 * Shared types for the metrics system. Types only: this file is safe to
 * import from client components (`import type`), tests and the pure modules.
 */
import type { MetricsConfig } from './config';

export type { MetricsConfig };

export type ContributionsWindow = 'lifetime' | 'last12months';

export type Metric = {
  /** The number to show. */
  value: number;
  /** The committed last-known-good value. */
  snapshotValue: number;
  /** True when `value` was confirmed by a valid live fetch in this revalidation. */
  live: boolean;
  /** ISO time the shown value was retrieved. */
  asOf: string;
  /** Public URL a person can open to check the number. */
  source: string;
};

export type OllamaModel = {
  name: string;
  pulls: number;
  url: string;
  /** ISO time from the model's "Updated" stamp on ollama.com, when exposed. */
  uploadedAt: string | null;
};

export type NpmPackageMetrics = {
  name: string;
  allTime: number;
  lastMonth: number;
  url: string;
};

export type PrLedgerEntry = {
  repo: string;
  number: number;
  title: string;
  mergedAt: string;
  url: string;
  /** Only filled in when REQUIRE_MERGED_BY_OTHER is on. */
  mergedBy?: string | null;
};

export type RepoCount = { repo: string; count: number; url: string };

export type SiteMetrics = {
  retrievedAt: string;
  ollama: { total: Metric; models: OllamaModel[] };
  npm: { allTime: Metric; lastMonth: Metric; packages: NpmPackageMetrics[] };
  contributions: {
    total: Metric;
    window: ContributionsWindow;
    label: string;
    byYear: Record<string, number>;
  };
  mergedPrs: {
    upstream: Metric;
    upstreamRepoCount: number;
    byRepo: RepoCount[];
    total: Metric;
    ledger: PrLedgerEntry[];
  };
};

/** Shape of content/metrics.snapshot.json. */
export type MetricsSnapshot = {
  schemaVersion: 1;
  /** ISO time of the last refresh run. Each section keeps its own time too. */
  retrievedAt: string;
  ollama: {
    retrievedAt: string;
    /** Public page a person can open. */
    source: string;
    /** What the server actually fetches. */
    endpoints: string[];
    total: number;
    models: OllamaModel[];
  };
  npm: {
    retrievedAt: string;
    source: string;
    endpoints: string[];
    allTime: number;
    lastMonth: number;
    packages: Array<NpmPackageMetrics & { firstPublished: string }>;
  };
  contributions: {
    retrievedAt: string;
    source: string;
    endpoints: string[];
    lifetime: number;
    byYear: Record<string, number>;
    last12Months: number;
  };
  mergedPrs: {
    retrievedAt: string;
    source: string;
    totalSource: string;
    endpoints: string[];
    query: string;
    totalQuery: string;
    excludedOwners: string[];
    requireMergedByOther: boolean;
    upstream: number;
    total: number;
    ledger: PrLedgerEntry[];
  };
};

/** Raw, unvalidated results of one fetch pass. Null means "could not read it". */
export type LiveOllama = {
  fetchedAt: string;
  profileOk: boolean;
  models: Array<{
    name: string;
    /** False for a model only the snapshot knows (missing from the live profile). */
    inProfile: boolean;
    profilePulls: number | null;
    pagePulls: number | null;
    updatedAt: string | null;
  }>;
  errors: string[];
};

export type LiveNpm = {
  fetchedAt: string;
  packages: Array<{ name: string; allTime: number | null; lastMonth: number | null }>;
  errors: string[];
};

export type LiveContributions = {
  fetchedAt: string;
  byYear: Record<string, number>;
  last12Months: number | null;
  errors: string[];
};

export type LiveMergedPrs = {
  fetchedAt: string;
  upstream: number | null;
  total: number | null;
  ledger: PrLedgerEntry[];
  /** True when every page of the search was read, so the ledger is authoritative. */
  ledgerComplete: boolean;
  errors: string[];
};

export type SourceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type LiveResults = {
  ollama: SourceResult<LiveOllama>;
  npm: SourceResult<LiveNpm>;
  contributions: SourceResult<LiveContributions>;
  mergedPrs: SourceResult<LiveMergedPrs>;
};

export type MetricStatus = { live: boolean; asOf: string };

export type ResolveStatus = {
  ollama: MetricStatus;
  npmAllTime: MetricStatus;
  npmLastMonth: MetricStatus;
  contributions: MetricStatus;
  upstreamPrs: MetricStatus;
  totalPrs: MetricStatus;
};

export type SourceName = 'ollama' | 'npm' | 'contributions' | 'mergedPrs';

export type ResolveResult = {
  /** The snapshot merged with every live value that passed validation. */
  snapshot: MetricsSnapshot;
  status: ResolveStatus;
  /** Human readable notes about anything that fell back to the snapshot. */
  problems: Array<{ source: SourceName; message: string }>;
};

/** Minimal fetch signature the pure modules need (global fetch satisfies it). */
export type FetchLike = (
  url: string,
  init?: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export type CollectOptions = {
  config: MetricsConfig;
  snapshot: MetricsSnapshot;
  fetchImpl: FetchLike;
  /** Extra fetch init merged into every request (the Next cache options). */
  init?: Record<string, unknown>;
  now?: Date;
  githubToken?: string | null;
  /** Refresh script only: re-read every contribution year and both windows. */
  full?: boolean;
  /** Upper bound on search calls spent on the PR ledger. */
  maxLedgerPages?: number;
};
