// @ts-check
// Merged pull requests: search query builder, response parsing and ledger
// aggregation. Pure: no I/O.

/** @import { PrLedgerEntry, RepoCount } from '../types' */

const API_REPO_PREFIX = 'https://api.github.com/repos/';

/**
 * Build the GitHub search query. With `excludedOwners` it is the headline
 * query (merged PRs in repos that are not excluded); without it, the query
 * for every public merged PR.
 *
 * An entry of `excludedOwners` is an owner ("acme": every repository of
 * theirs, `-user:acme`) or one repository ("acme/site": that one only,
 * `-repo:acme/site`).
 *
 * `is:public` never changes the unauthenticated result (that search only
 * sees public repositories) and keeps private ones out if a token is set.
 *
 * @param {{ author: string, excludedOwners?: readonly string[] }} options
 * @returns {string}
 */
export function buildPrSearchQuery({ author, excludedOwners = [] }) {
  const parts = ['is:pr', 'is:merged', 'is:public', `author:${author}`];
  const seen = new Set();
  for (const owner of excludedOwners) {
    const key = owner.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    parts.push(`${key.includes('/') ? '-repo' : '-user'}:${owner.trim()}`);
  }
  return parts.join(' ');
}

/**
 * @param {string} query
 * @param {{ page?: number, perPage?: number }} [options]
 * @returns {string} REST search URL.
 */
export function prSearchApiUrl(query, { page = 1, perPage = 100 } = {}) {
  const params = new URLSearchParams({
    q: query,
    per_page: String(perPage),
    page: String(page),
    sort: 'created',
    order: 'desc',
  });
  return `https://api.github.com/search/issues?${params.toString()}`;
}

/**
 * @param {string} query
 * @returns {string} The same search on github.com, for a person to open.
 */
export function prSearchWebUrl(query) {
  const params = new URLSearchParams({ q: query, type: 'pullrequests' });
  return `https://github.com/search?${params.toString()}`;
}

/** @param {string} repo */
export function repoUrl(repo) {
  return `https://github.com/${repo}`;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

/**
 * @param {string} repo "owner/name"
 * @param {readonly string[]} excludedOwners Owners, and single repositories as "owner/name".
 */
export function isExcludedRepo(repo, excludedOwners) {
  const full = repo.toLowerCase();
  const owner = full.split('/')[0];
  return excludedOwners.some((excluded) => {
    const key = excluded.trim().toLowerCase();
    return key.includes('/') ? key === full : key === owner;
  });
}

/**
 * Turn one search result item into a ledger entry.
 * Returns null for anything that is not a merged PR in a public repository.
 *
 * @param {unknown} item
 * @returns {PrLedgerEntry | null}
 */
export function toLedgerEntry(item) {
  if (!isRecord(item)) return null;
  const { repository_url: repositoryUrl, html_url: url, number, title } = item;
  const pull = item.pull_request;
  if (typeof repositoryUrl !== 'string' || !repositoryUrl.startsWith(API_REPO_PREFIX)) return null;
  if (typeof url !== 'string' || typeof number !== 'number' || !Number.isSafeInteger(number)) return null;
  if (!isRecord(pull) || typeof pull.merged_at !== 'string' || !pull.merged_at) return null;
  if (!Number.isFinite(Date.parse(pull.merged_at))) return null;
  // Search items carry no visibility flag today; honour one if it ever appears.
  if (item.private === true) return null;
  if (isRecord(item.repository) && item.repository.private === true) return null;
  const repo = repositoryUrl.slice(API_REPO_PREFIX.length);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) return null;
  return {
    repo,
    number,
    title: typeof title === 'string' ? title.trim() : '',
    mergedAt: pull.merged_at,
    url,
  };
}

/**
 * Parse one page of search results.
 *
 * @param {unknown} json
 * @param {{ excludedOwners?: readonly string[] }} [options]
 * @returns {{ totalCount: number, incomplete: boolean, itemCount: number, entries: PrLedgerEntry[] }}
 */
export function parsePrSearchResponse(json, { excludedOwners = [] } = {}) {
  if (!isRecord(json) || typeof json.total_count !== 'number' || !Array.isArray(json.items)) {
    throw new Error('GitHub search response has no total_count or items');
  }
  /** @type {PrLedgerEntry[]} */
  const entries = [];
  for (const item of json.items) {
    const entry = toLedgerEntry(item);
    if (entry && !isExcludedRepo(entry.repo, excludedOwners)) entries.push(entry);
  }
  return {
    totalCount: json.total_count,
    incomplete: json.incomplete_results === true,
    itemCount: json.items.length,
    entries,
  };
}

/**
 * Newest merge first, then by URL so the order is stable.
 *
 * @param {PrLedgerEntry[]} ledger
 * @returns {PrLedgerEntry[]}
 */
export function sortLedger(ledger) {
  return [...ledger].sort(
    (a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt) || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0),
  );
}

/**
 * Union of ledgers keyed by PR URL. Earlier arguments win, except that a
 * known `mergedBy` is never lost.
 *
 * @param {...readonly PrLedgerEntry[]} ledgers
 * @returns {PrLedgerEntry[]}
 */
export function mergeLedgers(...ledgers) {
  /** @type {Map<string, PrLedgerEntry>} */
  const byUrl = new Map();
  for (const ledger of ledgers) {
    for (const entry of ledger) {
      const key = entry.url.toLowerCase();
      const known = byUrl.get(key);
      if (!known) {
        byUrl.set(key, { ...entry });
      } else if (known.mergedBy === undefined && entry.mergedBy !== undefined) {
        known.mergedBy = entry.mergedBy;
      }
    }
  }
  return sortLedger([...byUrl.values()]);
}

/**
 * Drop entries whose owner is excluded.
 *
 * @param {readonly PrLedgerEntry[]} ledger
 * @param {readonly string[]} excludedOwners
 * @returns {PrLedgerEntry[]}
 */
export function filterLedger(ledger, excludedOwners) {
  return ledger.filter((entry) => !isExcludedRepo(entry.repo, excludedOwners));
}

/**
 * Per-repository counts, largest first (ties: alphabetical, ignoring case).
 *
 * @param {readonly PrLedgerEntry[]} ledger
 * @returns {RepoCount[]}
 */
export function countByRepo(ledger) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const entry of ledger) counts.set(entry.repo, (counts.get(entry.repo) ?? 0) + 1);
  return [...counts.entries()]
    .map(([repo, count]) => ({ repo, count, url: repoUrl(repo) }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const left = a.repo.toLowerCase();
      const right = b.repo.toLowerCase();
      return left < right ? -1 : left > right ? 1 : 0;
    });
}

/**
 * How many ledger entries were merged by someone other than the author.
 * Entries with an unknown merger do not count.
 *
 * @param {readonly PrLedgerEntry[]} ledger
 * @param {string} author
 */
export function countMergedByOther(ledger, author) {
  const self = author.toLowerCase();
  return ledger.filter((entry) => typeof entry.mergedBy === 'string' && entry.mergedBy.toLowerCase() !== self)
    .length;
}

/**
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 */
export function sameOwners(a, b) {
  const normalize = (/** @type {readonly string[]} */ list) =>
    [...new Set(list.map((owner) => owner.trim().toLowerCase()))].sort().join('\n');
  return normalize(a) === normalize(b);
}
