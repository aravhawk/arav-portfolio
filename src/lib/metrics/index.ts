/**
 * Live metrics for the site (server only).
 *
 * Every number comes from a public source, is fetched on the server and is
 * cached by Next for an hour, so visitors never reach the sources. Each value
 * is validated against the committed snapshot in
 * content/metrics.snapshot.json, which is also what the site shows whenever a
 * source is down or changes shape. See docs/redesign-v4/metrics.md.
 *
 * Pages that render metrics should also `export const revalidate = 3600`.
 */
import 'server-only';

import { cache } from 'react';

import snapshotJson from '../../../content/metrics.snapshot.json';
import { CACHE_TAG, METRICS_CONFIG, REVALIDATE_SECONDS } from './config';
import { collectLive } from './core/collect.mjs';
import { formatAsOf as formatAsOfCore, formatCount as formatCountCore } from './core/format.mjs';
import { resolveMetrics, snapshotToSiteMetrics, toSiteMetrics } from './core/resolve.mjs';
import type { FetchLike, MetricsSnapshot, SiteMetrics } from './types';

export type {
  ContributionsWindow,
  Metric,
  MetricsSnapshot,
  NpmPackageMetrics,
  OllamaModel,
  PrLedgerEntry,
  RepoCount,
  SiteMetrics,
} from './types';
export {
  CACHE_TAG as METRICS_CACHE_TAG,
  CONTRIBUTIONS_WINDOW,
  EXCLUDED_OWNERS,
  REVALIDATE_SECONDS as METRICS_REVALIDATE_SECONDS,
} from './config';

const snapshot = snapshotJson as MetricsSnapshot;

/**
 * The newest validated values this server process has seen. It starts as the
 * committed snapshot and only ever moves forward, so a source that fails for
 * one revalidation falls back to the last good reading instead of dipping to
 * a week-old number.
 */
let lastKnownGood: MetricsSnapshot = snapshot;

/** Next data cache settings applied to every source request. */
const CACHED_FETCH_INIT = {
  next: { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] },
};

const fetchImpl: FetchLike = (url, init) => fetch(url, init as RequestInit);

const logged = new Set<string>();

/** Log each distinct problem once per server process. */
function logOnce(source: string, message: string): void {
  const key = `${source}: ${message}`;
  if (logged.has(key)) return;
  logged.add(key);
  console.warn(`[metrics] ${key} (showing the last known good value)`);
}

async function readMetrics(): Promise<SiteMetrics> {
  try {
    const now = new Date();
    const previous = lastKnownGood;
    const live = await collectLive({
      config: METRICS_CONFIG,
      snapshot: previous,
      fetchImpl,
      init: CACHED_FETCH_INIT,
      now,
      githubToken: process.env.GITHUB_TOKEN ?? null,
    });
    const { snapshot: resolved, status, problems } = resolveMetrics({
      previous,
      live,
      config: METRICS_CONFIG,
      now,
    });
    lastKnownGood = resolved;
    for (const problem of problems) logOnce(problem.source, problem.message);
    return toSiteMetrics({
      resolved,
      committed: snapshot,
      status,
      config: METRICS_CONFIG,
      retrievedAt: now.toISOString(),
    });
  } catch (error) {
    logOnce('all', error instanceof Error ? error.message : String(error));
    // (A reading that failed outright is not held: the next page asks again in a minute.)
    if (held) held.at = Date.now() - (REVALIDATE_SECONDS - 60) * 1000;
    return getSnapshotMetrics();
  }
}

/**
 * One reading an hour for the whole server process. Each page is rebuilt on
 * its own schedule, so without this two pages built a few minutes apart
 * could show a count that had ticked in between (3,202 on the home page,
 * 3,203 on a project page). Every page rendered by this process within the
 * hour now shows the same figures and the same "as of" time. (Across
 * separate server instances the pages can still differ until each is next
 * rebuilt; each page states the time of its own reading.)
 */
let held: { at: number; value: Promise<SiteMetrics> } | null = null;

const loadMetrics = cache((): Promise<SiteMetrics> => {
  const now = Date.now();
  if (!held || now - held.at >= REVALIDATE_SECONDS * 1000) held = { at: now, value: readMetrics() };
  return held.value;
});

/**
 * Current metrics: live where a source answered with a valid value, the
 * snapshot everywhere else. Never throws. Calls within one render share a
 * single pass, and all source requests run in parallel.
 */
export async function getMetrics(): Promise<SiteMetrics> {
  return loadMetrics();
}

/** The committed snapshot only. Synchronous, no network. */
export function getSnapshotMetrics(): SiteMetrics {
  return snapshotToSiteMetrics(snapshot, METRICS_CONFIG);
}

/** Format an ISO time in Central Time, e.g. "Nov 15, 2026, 4:40 AM CT". */
export function formatAsOf(iso: string): string {
  return formatAsOfCore(iso);
}

/** Format a count with thousands separators, e.g. 18284 -> "18,284". */
export function formatCount(value: number): string {
  return formatCountCore(value);
}
