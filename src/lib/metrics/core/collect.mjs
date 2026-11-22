// @ts-check
// Fetches every source once and returns raw, unvalidated readings.
// No Next.js or Node specific imports: the caller injects `fetch` and any
// extra fetch options (the Next cache settings), so the site, the refresh
// script and the tests all run this same code.

/**
 * @import {
 *   CollectOptions, LiveContributions, LiveMergedPrs, LiveNpm, LiveOllama,
 *   LiveResults, PrLedgerEntry, SourceResult,
 * } from '../types'
 */

import {
  contributionsUrl,
  isYearFinalInSnapshot,
  lifetimeYears,
  parseContributionsFor,
} from './contributions.mjs';
import {
  buildPrSearchQuery,
  countMergedByOther,
  filterLedger,
  mergeLedgers,
  parsePrSearchResponse,
  prSearchApiUrl,
} from './github-prs.mjs';
import { chunkDateRange, npmLastMonthUrl, npmRangeUrl, parseNpmPoint, sumNpmRange, toIsoDate } from './npm.mjs';
import { ollamaModelUrl, ollamaProfileUrl, parseOllamaModelPage, parseOllamaProfile } from './ollama.mjs';

/** Hard caps so a markup change can never turn into a burst of requests. */
const MAX_OLLAMA_MODEL_PAGES = 30;
const MAX_MERGED_BY_LOOKUPS = 30;
const SEARCH_PAGE_SIZE = 100;

/**
 * @typedef {Required<Pick<CollectOptions, 'config' | 'snapshot' | 'fetchImpl' | 'now'>> & {
 *   init: Record<string, unknown>,
 *   githubToken: string | null,
 *   full: boolean,
 *   maxLedgerPages: number,
 * }} Context
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageOf(error) {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timed out' : error.message;
  }
  return String(error);
}

/**
 * When the response was produced. A response served from the Next data cache
 * keeps its original Date header, so this is the honest retrieval time.
 *
 * @param {{ headers: { get(name: string): string | null } }} response
 * @param {Date} now
 * @returns {number} Epoch milliseconds.
 */
function responseTime(response, now) {
  const header = response.headers?.get?.('date');
  const parsed = header ? Date.parse(header) : NaN;
  const latest = now.getTime();
  // Ignore clocks that are ahead of ours or implausibly old.
  if (Number.isFinite(parsed) && parsed <= latest && latest - parsed < 7 * 24 * 60 * 60 * 1000) {
    return parsed;
  }
  return latest;
}

/**
 * One request: our User-Agent, a timeout, no retries.
 *
 * @param {Context} context
 * @param {string} url
 * @param {{ json?: boolean, github?: boolean }} [options]
 * @returns {Promise<{ body: any, at: number }>}
 */
async function request(context, url, { json = false, github = false } = {}) {
  /** @type {Record<string, string>} */
  const headers = {
    'User-Agent': context.config.userAgent,
    Accept: github ? 'application/vnd.github+json' : json ? 'application/json' : 'text/html',
  };
  if (github) {
    headers['X-GitHub-Api-Version'] = '2022-11-28';
    if (context.githubToken) headers.Authorization = `Bearer ${context.githubToken}`;
  }
  try {
    const response = await context.fetchImpl(url, {
      ...context.init,
      headers,
      signal: AbortSignal.timeout(context.config.fetchTimeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = json ? await response.json() : await response.text();
    return { body, at: responseTime(response, context.now) };
  } catch (error) {
    throw new Error(`${url}: ${messageOf(error)}`);
  }
}

/** Tracks the oldest response time used by one source. */
function createStamp() {
  /** @type {number | null} */
  let oldest = null;
  return {
    /** @param {number} at */
    note(at) {
      if (oldest === null || at < oldest) oldest = at;
    },
    /** @param {Date} now */
    iso(now) {
      return new Date(oldest ?? now.getTime()).toISOString();
    },
  };
}

/**
 * @param {Context} context
 * @returns {Promise<LiveOllama>}
 */
export async function collectOllama(context) {
  const user = context.config.ollamaUser;
  const stamp = createStamp();
  /** @type {string[]} */
  const errors = [];
  /** @type {ReturnType<typeof parseOllamaProfile>} */
  let rows = [];
  let profileOk = false;
  try {
    const profile = await request(context, ollamaProfileUrl(user));
    rows = parseOllamaProfile(profile.body, user);
    if (rows.length === 0) throw new Error(`${ollamaProfileUrl(user)}: no model links found`);
    profileOk = true;
    stamp.note(profile.at);
  } catch (error) {
    errors.push(messageOf(error));
  }

  // Profile models first (new ones included), then any the snapshot knows.
  const names = [...new Set([...rows.map((row) => row.name), ...context.snapshot.ollama.models.map((m) => m.name)])];
  const checked = names.slice(0, MAX_OLLAMA_MODEL_PAGES);
  const pages = await Promise.allSettled(
    checked.map(async (name) => {
      const page = await request(context, ollamaModelUrl(user, name));
      const parsed = parseOllamaModelPage(page.body);
      if (parsed.pulls === null) throw new Error(`${ollamaModelUrl(user, name)}: pull count not found`);
      return { ...parsed, at: page.at };
    }),
  );

  const models = names.map((name, index) => {
    const row = rows.find((candidate) => candidate.name === name);
    const page = index < pages.length ? pages[index] : null;
    if (page && page.status === 'rejected') errors.push(messageOf(page.reason));
    if (row && row.pulls === null) errors.push(`${name}: pull count not found on the profile page`);
    const pageData = page && page.status === 'fulfilled' ? page.value : null;
    if (pageData) stamp.note(pageData.at);
    return {
      name,
      inProfile: Boolean(row),
      profilePulls: row ? row.pulls : null,
      pagePulls: pageData ? pageData.pulls : null,
      updatedAt: (row ? row.updatedAt : null) ?? (pageData ? pageData.updatedAt : null),
    };
  });

  return { fetchedAt: stamp.iso(context.now), profileOk, models, errors };
}

/**
 * @param {Context} context
 * @returns {Promise<LiveNpm>}
 */
export async function collectNpm(context) {
  const today = toIsoDate(context.now);
  const stamp = createStamp();
  /** @type {string[]} */
  const errors = [];
  const packages = await Promise.all(
    context.config.npmPackages.map(async ({ name, firstPublished }) => {
      /** @type {number | null} */
      let allTime = null;
      /** @type {number | null} */
      let lastMonth = null;
      const [ranges, point] = await Promise.allSettled([
        (async () => {
          const windows = chunkDateRange(firstPublished, today);
          const sums = await Promise.all(
            windows.map(async (window) => {
              const response = await request(context, npmRangeUrl(name, window), { json: true });
              stamp.note(response.at);
              return sumNpmRange(response.body, window);
            }),
          );
          return sums.reduce((total, value) => total + value, 0);
        })(),
        (async () => {
          const response = await request(context, npmLastMonthUrl(name), { json: true });
          stamp.note(response.at);
          return parseNpmPoint(response.body);
        })(),
      ]);
      if (ranges.status === 'fulfilled') allTime = ranges.value;
      else errors.push(`${name} all-time: ${messageOf(ranges.reason)}`);
      if (point.status === 'fulfilled') lastMonth = point.value;
      else errors.push(`${name} last month: ${messageOf(point.reason)}`);
      return { name, allTime, lastMonth };
    }),
  );
  return { fetchedAt: stamp.iso(context.now), packages, errors };
}

/**
 * Lifetime mode re-reads only the current year (plus any year the snapshot
 * was taken too early to have final). `full` reads everything.
 *
 * @param {Context} context
 * @returns {Promise<LiveContributions>}
 */
export async function collectContributions(context) {
  const { config, snapshot, now, full } = context;
  const user = config.githubUser;
  const stamp = createStamp();
  /** @type {string[]} */
  const errors = [];
  const currentYear = now.getUTCFullYear();
  const wantLifetime = full || config.contributionsWindow === 'lifetime';
  const wantLastYear = full || config.contributionsWindow === 'last12months';

  const years = wantLifetime
    ? lifetimeYears(config.githubAccountCreatedYear, now).filter(
        (year) =>
          full ||
          year === currentYear ||
          snapshot.contributions.byYear[String(year)] === undefined ||
          !isYearFinalInSnapshot(year, snapshot.contributions.retrievedAt),
      )
    : [];

  /** @type {Record<string, number>} */
  const byYear = {};
  /** @type {number | null} */
  let last12Months = null;

  await Promise.all([
    ...years.map(async (year) => {
      try {
        const response = await request(context, contributionsUrl(user, year));
        byYear[String(year)] = parseContributionsFor(response.body, year);
        stamp.note(response.at);
      } catch (error) {
        errors.push(`${year}: ${messageOf(error)}`);
      }
    }),
    (async () => {
      if (!wantLastYear) return;
      try {
        const response = await request(context, contributionsUrl(user, null));
        last12Months = parseContributionsFor(response.body, null);
        stamp.note(response.at);
      } catch (error) {
        errors.push(`last year: ${messageOf(error)}`);
      }
    })(),
  ]);

  return { fetchedAt: stamp.iso(context.now), byYear, last12Months, errors };
}

/**
 * Two search calls in the normal case: one page of the headline query (which
 * carries both the live count and the ledger) and one for the public total.
 *
 * @param {Context} context
 * @returns {Promise<LiveMergedPrs>}
 */
export async function collectMergedPrs(context) {
  const { config, snapshot } = context;
  const author = config.githubUser;
  const stamp = createStamp();
  /** @type {string[]} */
  const errors = [];
  const upstreamQuery = buildPrSearchQuery({ author, excludedOwners: config.excludedOwners });
  const totalQuery = buildPrSearchQuery({ author });

  /** @type {number | null} */
  let upstream = null;
  /** @type {number | null} */
  let total = null;
  /** @type {PrLedgerEntry[]} */
  let ledger = [];
  let ledgerComplete = false;

  await Promise.all([
    (async () => {
      let seen = 0;
      /** @type {number | null} */
      let count = null;
      let trusted = true;
      try {
        for (let page = 1; page <= context.maxLedgerPages; page += 1) {
          const url = prSearchApiUrl(upstreamQuery, { page, perPage: SEARCH_PAGE_SIZE });
          const response = await request(context, url, { json: true, github: true });
          const parsed = parsePrSearchResponse(response.body, { excludedOwners: config.excludedOwners });
          stamp.note(response.at);
          if (parsed.incomplete) trusted = false;
          if (count === null) count = parsed.totalCount;
          seen += parsed.itemCount;
          ledger = mergeLedgers(ledger, parsed.entries);
          if (seen >= count || parsed.itemCount < SEARCH_PAGE_SIZE) break;
        }
      } catch (error) {
        errors.push(`merged PR search: ${messageOf(error)}`);
      }
      if (count !== null && !trusted) errors.push('merged PR search: GitHub returned incomplete results');
      if (count !== null && trusted) {
        upstream = count;
        ledgerComplete = seen >= count;
      }
    })(),
    (async () => {
      try {
        const url = prSearchApiUrl(totalQuery, { page: 1, perPage: 1 });
        const response = await request(context, url, { json: true, github: true });
        const parsed = parsePrSearchResponse(response.body);
        if (parsed.incomplete) throw new Error('GitHub returned incomplete results');
        total = parsed.totalCount;
        stamp.note(response.at);
      } catch (error) {
        errors.push(`total merged PR search: ${messageOf(error)}`);
      }
    })(),
  ]);

  if (config.requireMergedByOther && upstream !== null) {
    const known = filterLedger(snapshot.mergedPrs.ledger, config.excludedOwners);
    ledger = mergeLedgers(ledger, known.filter((entry) => ledger.some((live) => live.url === entry.url)));
    const missing = ledger.filter((entry) => entry.mergedBy === undefined).slice(0, MAX_MERGED_BY_LOOKUPS);
    await Promise.all(
      missing.map(async (entry) => {
        try {
          const url = `https://api.github.com/repos/${entry.repo}/pulls/${entry.number}`;
          const response = await request(context, url, { json: true, github: true });
          const mergedBy = response.body?.merged_by?.login;
          entry.mergedBy = typeof mergedBy === 'string' ? mergedBy : null;
        } catch (error) {
          errors.push(`merged-by lookup: ${messageOf(error)}`);
        }
      }),
    );
    const everything = ledgerComplete ? ledger : mergeLedgers(ledger, known);
    if (everything.some((entry) => entry.mergedBy === undefined)) {
      errors.push('merged-by lookup: some PRs still have no known merger');
      upstream = null;
    } else {
      upstream = countMergedByOther(everything, author);
    }
  }

  return { fetchedAt: stamp.iso(context.now), upstream, total, ledger, ledgerComplete, errors };
}

/**
 * @template T
 * @param {PromiseSettledResult<T>} settled
 * @returns {SourceResult<T>}
 */
function toResult(settled) {
  return settled.status === 'fulfilled'
    ? { ok: true, data: settled.value }
    : { ok: false, error: messageOf(settled.reason) };
}

/**
 * Fetch all four sources in parallel. Never throws: a source that fails
 * reports `ok: false` and the others are unaffected.
 *
 * @param {CollectOptions} options
 * @returns {Promise<LiveResults>}
 */
export async function collectLive(options) {
  /** @type {Context} */
  const context = {
    config: options.config,
    snapshot: options.snapshot,
    fetchImpl: options.fetchImpl,
    init: options.init ?? {},
    now: options.now ?? new Date(),
    githubToken: options.githubToken || null,
    full: options.full ?? false,
    maxLedgerPages: Math.max(1, options.maxLedgerPages ?? options.config.maxLedgerPages),
  };
  const [ollama, npm, contributions, mergedPrs] = await Promise.allSettled([
    collectOllama(context),
    collectNpm(context),
    collectContributions(context),
    collectMergedPrs(context),
  ]);
  return {
    ollama: toResult(ollama),
    npm: toResult(npm),
    contributions: toResult(contributions),
    mergedPrs: toResult(mergedPrs),
  };
}
