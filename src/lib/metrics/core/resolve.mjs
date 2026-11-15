// @ts-check
// Turns raw live readings plus the committed snapshot into the numbers the
// site shows. This is the one place the validation and fallback rules live:
//   - a live value must be a finite integer greater than zero
//   - a cumulative counter must also be at least 0.9 x its snapshot value,
//     and is shown as max(live, snapshot)
//   - anything else falls back to the snapshot
// The site calls it on every revalidation; the refresh script calls it to
// write the next snapshot. Pure: no I/O, no clock other than `now`.

/**
 * @import {
 *   LiveContributions, LiveMergedPrs, LiveNpm, LiveOllama, LiveResults, Metric,
 *   MetricsConfig, MetricsSnapshot, MetricStatus, PrLedgerEntry, ResolveResult,
 *   ResolveStatus, SiteMetrics, SourceName, SourceResult,
 * } from '../types'
 */

import {
  checkLive,
  isNonNegativeInteger,
  isPositiveInteger,
  NO_LIVE_VALUE,
  pickCumulative,
  pickRolling,
} from './count.mjs';
import { contributionsProfileUrl, contributionsUrl, isYearFinalInSnapshot, lifetimeYears } from './contributions.mjs';
import {
  buildPrSearchQuery,
  countByRepo,
  countMergedByOther,
  filterLedger,
  mergeLedgers,
  prSearchWebUrl,
  sameOwners,
} from './github-prs.mjs';
import { npmPackageUrl } from './npm.mjs';
import { crossCheckPulls, ollamaModelUrl, ollamaProfileUrl } from './ollama.mjs';

export const LIFETIME_LABEL = 'lifetime contributions on GitHub';
export const LAST_YEAR_LABEL = 'contributions in the last year';

/**
 * @typedef {{ config: MetricsConfig, now: Date, force: boolean }} Options
 * @typedef {(message: string) => void} Note
 */

/**
 * A failed validation is worth a log line. A value that was never fetched is
 * not: either it was not needed, or the fetch error is already recorded.
 *
 * @param {string | null} reason
 * @returns {reason is string}
 */
function worthNoting(reason) {
  return reason !== null && reason !== NO_LIVE_VALUE;
}

/**
 * @template T
 * @param {SourceResult<T>} result
 * @param {Note} note
 * @returns {T | null}
 */
function unwrap(result, note) {
  if (!result.ok) {
    note(result.error);
    return null;
  }
  return result.data;
}

/**
 * @param {MetricsSnapshot['ollama']} previous
 * @param {SourceResult<LiveOllama>} result
 * @param {Options} options
 * @param {Note} note
 * @returns {{ section: MetricsSnapshot['ollama'], status: MetricStatus }}
 */
export function resolveOllama(previous, result, { config, force }, note) {
  const user = config.ollamaUser;
  const data = unwrap(result, note);
  const fallback = { section: previous, status: { live: false, asOf: previous.retrievedAt } };
  if (!data) return fallback;
  data.errors.forEach(note);

  const known = new Map(previous.models.map((model) => [model.name, model]));
  const names = [...new Set([...data.models.map((model) => model.name), ...known.keys()])];
  let allLive = data.profileOk && names.length > 0;
  /** @type {MetricsSnapshot['ollama']['models']} */
  const models = [];

  for (const name of names) {
    const live = data.models.find((model) => model.name === name);
    const before = known.get(name);
    // With --force a model that left the profile is dropped instead of kept.
    if (force && data.profileOk && !(live && live.inProfile)) continue;
    const cross = crossCheckPulls(live ? live.profilePulls : null, live ? live.pagePulls : null);
    if (cross.checked && !cross.agrees && live) {
      note(`${name}: profile says ${live.profilePulls} pulls, model page says ${live.pagePulls}`);
    }
    const picked = pickCumulative(cross.pulls, before ? before.pulls : null, {
      minRatio: config.minRatioOfSnapshot,
      force,
    });
    if (!picked.live) {
      allLive = false;
      if (worthNoting(picked.reason)) note(`${name}: ${picked.reason}`);
    }
    if (!isPositiveInteger(picked.value)) continue;
    models.push({
      name,
      pulls: picked.value,
      url: ollamaModelUrl(user, name),
      uploadedAt: (live ? live.updatedAt : null) ?? (before ? before.uploadedAt : null),
    });
  }

  const total = models.reduce((sum, model) => sum + model.pulls, 0);
  if (!isPositiveInteger(total)) {
    note('no model has a readable pull count');
    return fallback;
  }
  models.sort((a, b) => b.pulls - a.pulls || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const retrievedAt = allLive ? data.fetchedAt : previous.retrievedAt;
  return {
    section: {
      retrievedAt,
      source: ollamaProfileUrl(user),
      endpoints: [ollamaProfileUrl(user), `${ollamaProfileUrl(user)}/<model>`],
      total,
      models,
    },
    status: { live: allLive, asOf: retrievedAt },
  };
}

/**
 * @param {MetricsSnapshot['npm']} previous
 * @param {SourceResult<LiveNpm>} result
 * @param {Options} options
 * @param {Note} note
 * @returns {{ section: MetricsSnapshot['npm'], allTime: MetricStatus, lastMonth: MetricStatus }}
 */
export function resolveNpm(previous, result, { config, force }, note) {
  const data = unwrap(result, note);
  const stale = { live: false, asOf: previous.retrievedAt };
  if (!data) return { section: previous, allTime: stale, lastMonth: stale };
  data.errors.forEach(note);

  let allTimeLive = config.npmPackages.length > 0;
  let lastMonthLive = allTimeLive;
  /** @type {MetricsSnapshot['npm']['packages']} */
  const packages = [];

  for (const { name, firstPublished } of config.npmPackages) {
    const live = data.packages.find((entry) => entry.name === name);
    const before = previous.packages.find((entry) => entry.name === name);
    const allTime = pickCumulative(live ? live.allTime : null, before ? before.allTime : null, {
      minRatio: config.minRatioOfSnapshot,
      force,
    });
    if (!allTime.live) {
      allTimeLive = false;
      if (worthNoting(allTime.reason)) note(`${name} all-time: ${allTime.reason}`);
    }
    // A single package may honestly have zero downloads in a month.
    const liveMonth = live && isNonNegativeInteger(live.lastMonth) ? live.lastMonth : null;
    if (liveMonth === null) lastMonthLive = false;
    if (!isPositiveInteger(allTime.value)) continue;
    packages.push({
      name,
      firstPublished,
      allTime: allTime.value,
      lastMonth: liveMonth ?? (before ? before.lastMonth : 0),
      url: npmPackageUrl(name),
    });
  }

  const allTimeTotal = packages.reduce((sum, entry) => sum + entry.allTime, 0);
  if (!isPositiveInteger(allTimeTotal)) {
    note('no package has a readable download count');
    return { section: previous, allTime: stale, lastMonth: stale };
  }
  const monthSum = packages.reduce((sum, entry) => sum + entry.lastMonth, 0);
  const month = pickRolling(lastMonthLive ? monthSum : null, previous.lastMonth);
  if (!month.live) {
    lastMonthLive = false;
    if (worthNoting(month.reason)) note(`last month: ${month.reason}`);
  }
  // Not cumulative: live when valid, otherwise the best last-known figure.
  const lastMonthTotal = month.live ? monthSum : isPositiveInteger(monthSum) ? monthSum : previous.lastMonth;

  const bothLive = allTimeLive && lastMonthLive;
  return {
    section: {
      retrievedAt: bothLive ? data.fetchedAt : previous.retrievedAt,
      source: packages.length === 1 ? packages[0].url : config.npmProfileUrl,
      endpoints: [
        'https://api.npmjs.org/downloads/range/<start>:<end>/<package>',
        'https://api.npmjs.org/downloads/point/last-month/<package>',
      ],
      allTime: allTimeTotal,
      lastMonth: lastMonthTotal,
      packages,
    },
    allTime: { live: allTimeLive, asOf: allTimeLive ? data.fetchedAt : previous.retrievedAt },
    lastMonth: { live: lastMonthLive, asOf: lastMonthLive ? data.fetchedAt : previous.retrievedAt },
  };
}

/**
 * @param {MetricsSnapshot['contributions']} previous
 * @param {SourceResult<LiveContributions>} result
 * @param {Options} options
 * @param {Note} note
 * @returns {{ section: MetricsSnapshot['contributions'], status: MetricStatus }}
 */
export function resolveContributions(previous, result, { config, now, force }, note) {
  const user = config.githubUser;
  const data = unwrap(result, note);
  if (!data) return { section: previous, status: { live: false, asOf: previous.retrievedAt } };
  data.errors.forEach(note);

  const currentYear = now.getUTCFullYear();
  let lifetimeLive = true;
  /** @type {Record<string, number>} */
  const byYear = {};
  for (const year of lifetimeYears(config.githubAccountCreatedYear, now)) {
    const key = String(year);
    const before = previous.byYear[key];
    // Past years are immutable once the snapshot has them; only the current
    // year (and a year the snapshot caught before it ended) needs a live read.
    const needed =
      year === currentYear || before === undefined || !isYearFinalInSnapshot(year, previous.retrievedAt);
    const picked = pickCumulative(data.byYear[key], before, {
      minRatio: config.minRatioOfSnapshot,
      allowZero: true,
      force,
    });
    if (needed && !picked.live) lifetimeLive = false;
    if (!picked.live && worthNoting(picked.reason)) note(`${key}: ${picked.reason}`);
    byYear[key] = picked.value ?? 0;
  }
  const yearSum = Object.values(byYear).reduce((sum, value) => sum + value, 0);
  const usable = isPositiveInteger(yearSum);
  if (!usable) lifetimeLive = false;

  const lastYear = pickRolling(data.last12Months, previous.last12Months);
  if (!lastYear.live && worthNoting(lastYear.reason)) note(`last year: ${lastYear.reason}`);

  const live = config.contributionsWindow === 'lifetime' ? lifetimeLive : lastYear.live;
  // The section time vouches for the per-year values, so it only moves when
  // every year that needed a live read got one.
  const retrievedAt = lifetimeLive ? data.fetchedAt : previous.retrievedAt;
  return {
    section: {
      retrievedAt,
      source: contributionsProfileUrl(user),
      endpoints: [
        `${contributionsUrl(user)}?from=<YYYY>-01-01&to=<YYYY>-12-31`,
        contributionsUrl(user),
      ],
      lifetime: usable ? yearSum : previous.lifetime,
      byYear: usable ? byYear : previous.byYear,
      last12Months: lastYear.value ?? previous.last12Months,
    },
    status: { live, asOf: live ? data.fetchedAt : previous.retrievedAt },
  };
}

/**
 * @param {MetricsSnapshot['mergedPrs']} previous
 * @param {SourceResult<LiveMergedPrs>} result
 * @param {Options} options
 * @param {Note} note
 * @returns {{ section: MetricsSnapshot['mergedPrs'], upstream: MetricStatus, total: MetricStatus }}
 */
export function resolveMergedPrs(previous, result, { config, force }, note) {
  const author = config.githubUser;
  const excluded = [...config.excludedOwners];
  const query = buildPrSearchQuery({ author, excludedOwners: excluded });
  const totalQuery = buildPrSearchQuery({ author });
  const knownLedger = filterLedger(previous.ledger, excluded);
  // If the exclusion rule changed since the snapshot, its headline number
  // answers a different question: recount from the ledger and skip the
  // comparison until the next refresh.
  const comparable =
    sameOwners(previous.excludedOwners, excluded) && previous.requireMergedByOther === config.requireMergedByOther;
  const recount = config.requireMergedByOther ? countMergedByOther(knownLedger, author) : knownLedger.length;
  const baseline = comparable ? previous.upstream : recount > 0 ? recount : previous.upstream;

  const data = unwrap(result, note);
  if (data) data.errors.forEach(note);

  const upstreamPick = pickCumulative(data ? data.upstream : null, comparable ? previous.upstream : null, {
    minRatio: config.minRatioOfSnapshot,
    force,
  });
  if (!upstreamPick.live && worthNoting(upstreamPick.reason)) {
    note(`merged PRs: ${upstreamPick.reason}`);
  }
  const totalPick = pickCumulative(data ? data.total : null, previous.total, {
    minRatio: config.minRatioOfSnapshot,
    force,
  });
  if (!totalPick.live && worthNoting(totalPick.reason)) {
    note(`total merged PRs: ${totalPick.reason}`);
  }

  // The live ledger is usable whenever the live count passed validation,
  // even if the shown number stays at a higher snapshot value.
  const liveUsable =
    data !== null &&
    checkLive(data.upstream, {
      baseline: force || !comparable ? null : previous.upstream,
      minRatio: config.minRatioOfSnapshot,
    }).ok;
  /** @type {PrLedgerEntry[]} */
  let ledger = knownLedger;
  if (data && liveUsable) {
    const liveLedger = filterLedger(data.ledger, excluded);
    // A complete live ledger replaces the old one, so a repository that is no
    // longer public drops out. An incomplete one only adds to it.
    ledger = data.ledgerComplete
      ? mergeLedgers(
          liveLedger,
          knownLedger.filter((entry) => liveLedger.some((live) => live.url.toLowerCase() === entry.url.toLowerCase())),
        )
      : mergeLedgers(liveLedger, knownLedger);
  } else {
    ledger = mergeLedgers(knownLedger);
  }

  const upstream = upstreamPick.value ?? baseline;
  const total = totalPick.value ?? previous.total;
  const fetchedAt = data ? data.fetchedAt : previous.retrievedAt;
  return {
    section: {
      retrievedAt: upstreamPick.live && totalPick.live ? fetchedAt : previous.retrievedAt,
      source: prSearchWebUrl(query),
      totalSource: prSearchWebUrl(totalQuery),
      endpoints: ['https://api.github.com/search/issues?q=<query>&per_page=100'],
      query,
      totalQuery,
      excludedOwners: excluded,
      requireMergedByOther: config.requireMergedByOther,
      upstream,
      total,
      ledger,
    },
    upstream: { live: upstreamPick.live, asOf: upstreamPick.live ? fetchedAt : previous.retrievedAt },
    total: { live: totalPick.live, asOf: totalPick.live ? fetchedAt : previous.retrievedAt },
  };
}

/**
 * Merge live readings into the snapshot.
 *
 * @param {{
 *   previous: MetricsSnapshot,
 *   live: LiveResults,
 *   config: MetricsConfig,
 *   now?: Date,
 *   force?: boolean,
 * }} input `force` (refresh script only) accepts valid live values even when
 *   they are lower than the snapshot.
 * @returns {ResolveResult}
 */
export function resolveMetrics({ previous, live, config, now = new Date(), force = false }) {
  /** @type {ResolveResult['problems']} */
  const problems = [];
  const options = { config, now, force };
  /** @param {SourceName} source @returns {Note} */
  const noteFor = (source) => (message) => {
    problems.push({ source, message });
  };

  const ollama = resolveOllama(previous.ollama, live.ollama, options, noteFor('ollama'));
  const npm = resolveNpm(previous.npm, live.npm, options, noteFor('npm'));
  const contributions = resolveContributions(
    previous.contributions,
    live.contributions,
    options,
    noteFor('contributions'),
  );
  const mergedPrs = resolveMergedPrs(previous.mergedPrs, live.mergedPrs, options, noteFor('mergedPrs'));

  return {
    snapshot: {
      schemaVersion: 1,
      retrievedAt: now.toISOString(),
      ollama: ollama.section,
      npm: npm.section,
      contributions: contributions.section,
      mergedPrs: mergedPrs.section,
    },
    status: {
      ollama: ollama.status,
      npmAllTime: npm.allTime,
      npmLastMonth: npm.lastMonth,
      contributions: contributions.status,
      upstreamPrs: mergedPrs.upstream,
      totalPrs: mergedPrs.total,
    },
    problems,
  };
}

/**
 * Status for showing a snapshot as is: nothing is live.
 *
 * @param {MetricsSnapshot} snapshot
 * @returns {ResolveStatus}
 */
export function snapshotStatus(snapshot) {
  /** @param {string} asOf @returns {MetricStatus} */
  const stale = (asOf) => ({ live: false, asOf });
  return {
    ollama: stale(snapshot.ollama.retrievedAt),
    npmAllTime: stale(snapshot.npm.retrievedAt),
    npmLastMonth: stale(snapshot.npm.retrievedAt),
    contributions: stale(snapshot.contributions.retrievedAt),
    upstreamPrs: stale(snapshot.mergedPrs.retrievedAt),
    totalPrs: stale(snapshot.mergedPrs.retrievedAt),
  };
}

/**
 * Shape resolved values into what the pages consume.
 *
 * @param {{
 *   resolved: MetricsSnapshot,
 *   committed: MetricsSnapshot,
 *   status: ResolveStatus,
 *   config: MetricsConfig,
 *   retrievedAt: string,
 * }} input `resolved` holds the values to show, `committed` the snapshot they
 *   are compared against.
 * @returns {SiteMetrics}
 */
export function toSiteMetrics({ resolved, committed, status, config, retrievedAt }) {
  /**
   * @param {number} value
   * @param {number} snapshotValue
   * @param {MetricStatus} state
   * @param {string} source
   * @returns {Metric}
   */
  const metric = (value, snapshotValue, state, source) => ({
    value,
    snapshotValue,
    live: state.live,
    asOf: state.asOf,
    source,
  });
  const lifetime = config.contributionsWindow === 'lifetime';
  const byRepo = countByRepo(resolved.mergedPrs.ledger);

  return {
    retrievedAt,
    ollama: {
      total: metric(resolved.ollama.total, committed.ollama.total, status.ollama, resolved.ollama.source),
      models: resolved.ollama.models.map((model) => ({ ...model })),
    },
    npm: {
      allTime: metric(resolved.npm.allTime, committed.npm.allTime, status.npmAllTime, resolved.npm.source),
      lastMonth: metric(resolved.npm.lastMonth, committed.npm.lastMonth, status.npmLastMonth, resolved.npm.source),
      packages: resolved.npm.packages.map(({ name, allTime, lastMonth, url }) => ({ name, allTime, lastMonth, url })),
    },
    contributions: {
      total: lifetime
        ? metric(
            resolved.contributions.lifetime,
            committed.contributions.lifetime,
            status.contributions,
            resolved.contributions.source,
          )
        : metric(
            resolved.contributions.last12Months,
            committed.contributions.last12Months,
            status.contributions,
            resolved.contributions.source,
          ),
      window: config.contributionsWindow,
      label: lifetime ? LIFETIME_LABEL : LAST_YEAR_LABEL,
      byYear: { ...resolved.contributions.byYear },
    },
    mergedPrs: {
      upstream: metric(
        resolved.mergedPrs.upstream,
        committed.mergedPrs.upstream,
        status.upstreamPrs,
        resolved.mergedPrs.source,
      ),
      upstreamRepoCount: byRepo.length,
      byRepo,
      total: metric(resolved.mergedPrs.total, committed.mergedPrs.total, status.totalPrs, resolved.mergedPrs.totalSource),
      ledger: resolved.mergedPrs.ledger.map(({ repo, number, title, mergedAt, url }) => ({
        repo,
        number,
        title,
        mergedAt,
        url,
      })),
    },
  };
}

/**
 * The committed snapshot, shaped for the pages. Nothing is fetched.
 *
 * @param {MetricsSnapshot} snapshot
 * @param {MetricsConfig} config
 * @returns {SiteMetrics}
 */
export function snapshotToSiteMetrics(snapshot, config) {
  // Re-apply the current exclusion rule so a config edit takes effect before
  // the next refresh.
  const ledger = mergeLedgers(filterLedger(snapshot.mergedPrs.ledger, config.excludedOwners));
  return toSiteMetrics({
    resolved: { ...snapshot, mergedPrs: { ...snapshot.mergedPrs, ledger } },
    committed: snapshot,
    status: snapshotStatus(snapshot),
    config,
    retrievedAt: snapshot.retrievedAt,
  });
}
