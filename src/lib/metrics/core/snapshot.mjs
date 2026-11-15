// @ts-check
// Shape checks for content/metrics.snapshot.json. Pure.

/** @import { MetricsConfig, MetricsSnapshot } from '../types' */

import { isNonNegativeInteger, isPositiveInteger } from './count.mjs';
import { contributionsProfileUrl } from './contributions.mjs';
import { buildPrSearchQuery, prSearchWebUrl } from './github-prs.mjs';
import { ollamaProfileUrl } from './ollama.mjs';

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function isIsoTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** @param {unknown} value */
function isUrl(value) {
  return typeof value === 'string' && /^https:\/\/\S+$/.test(value);
}

/**
 * List everything wrong with a snapshot. An empty list means it is usable as
 * the site's last-known-good fallback.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function snapshotProblems(value) {
  /** @type {string[]} */
  const problems = [];
  /** @param {boolean} condition @param {string} message */
  const expect = (condition, message) => {
    if (!condition) problems.push(message);
  };
  if (!isRecord(value)) return ['snapshot is not an object'];
  expect(value.schemaVersion === 1, 'schemaVersion must be 1');
  expect(isIsoTime(value.retrievedAt), 'retrievedAt must be an ISO time');

  const { ollama, npm, contributions, mergedPrs } = value;
  for (const [name, section] of Object.entries({ ollama, npm, contributions, mergedPrs })) {
    if (!isRecord(section)) {
      problems.push(`${name} section is missing`);
      continue;
    }
    expect(isIsoTime(section.retrievedAt), `${name}.retrievedAt must be an ISO time`);
    expect(isUrl(section.source), `${name}.source must be a URL`);
    expect(Array.isArray(section.endpoints) && section.endpoints.length > 0, `${name}.endpoints must list the URLs fetched`);
  }
  if (problems.length > 0) return problems;

  expect(isPositiveInteger(ollama.total), 'ollama.total must be a positive integer');
  expect(Array.isArray(ollama.models) && ollama.models.length > 0, 'ollama.models must not be empty');
  let pulls = 0;
  for (const model of Array.isArray(ollama.models) ? ollama.models : []) {
    const ok =
      isRecord(model) &&
      typeof model.name === 'string' &&
      isPositiveInteger(model.pulls) &&
      isUrl(model.url) &&
      (model.uploadedAt === null || isIsoTime(model.uploadedAt));
    expect(ok, `ollama model ${isRecord(model) ? String(model.name) : '?'} is malformed`);
    if (ok) pulls += model.pulls;
  }
  expect(pulls === ollama.total, 'ollama.total must equal the sum of the models');

  expect(isPositiveInteger(npm.allTime), 'npm.allTime must be a positive integer');
  expect(isPositiveInteger(npm.lastMonth), 'npm.lastMonth must be a positive integer');
  expect(Array.isArray(npm.packages) && npm.packages.length > 0, 'npm.packages must not be empty');
  let downloads = 0;
  for (const entry of Array.isArray(npm.packages) ? npm.packages : []) {
    const ok =
      isRecord(entry) &&
      typeof entry.name === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(entry.firstPublished)) &&
      isPositiveInteger(entry.allTime) &&
      isNonNegativeInteger(entry.lastMonth) &&
      isUrl(entry.url);
    expect(ok, `npm package ${isRecord(entry) ? String(entry.name) : '?'} is malformed`);
    if (ok) downloads += entry.allTime;
  }
  expect(downloads === npm.allTime, 'npm.allTime must equal the sum of the packages');

  expect(isPositiveInteger(contributions.lifetime), 'contributions.lifetime must be a positive integer');
  expect(isPositiveInteger(contributions.last12Months), 'contributions.last12Months must be a positive integer');
  if (isRecord(contributions.byYear)) {
    let years = 0;
    for (const [year, count] of Object.entries(contributions.byYear)) {
      expect(/^\d{4}$/.test(year) && isNonNegativeInteger(count), `contributions.byYear.${year} is malformed`);
      if (isNonNegativeInteger(count)) years += count;
    }
    expect(years === contributions.lifetime, 'contributions.lifetime must equal the sum of byYear');
  } else {
    problems.push('contributions.byYear is missing');
  }

  expect(isPositiveInteger(mergedPrs.upstream), 'mergedPrs.upstream must be a positive integer');
  expect(isPositiveInteger(mergedPrs.total), 'mergedPrs.total must be a positive integer');
  expect(isUrl(mergedPrs.totalSource), 'mergedPrs.totalSource must be a URL');
  expect(typeof mergedPrs.query === 'string' && typeof mergedPrs.totalQuery === 'string', 'mergedPrs queries are missing');
  expect(
    Array.isArray(mergedPrs.excludedOwners) && mergedPrs.excludedOwners.every((/** @type {unknown} */ o) => typeof o === 'string'),
    'mergedPrs.excludedOwners must be a list of names',
  );
  expect(typeof mergedPrs.requireMergedByOther === 'boolean', 'mergedPrs.requireMergedByOther must be a boolean');
  expect(Array.isArray(mergedPrs.ledger) && mergedPrs.ledger.length > 0, 'mergedPrs.ledger must not be empty');
  const urls = new Set();
  for (const entry of Array.isArray(mergedPrs.ledger) ? mergedPrs.ledger : []) {
    const ok =
      isRecord(entry) &&
      typeof entry.repo === 'string' &&
      /^[^/\s]+\/[^/\s]+$/.test(entry.repo) &&
      isPositiveInteger(entry.number) &&
      typeof entry.title === 'string' &&
      isIsoTime(entry.mergedAt) &&
      isUrl(entry.url);
    expect(ok, `ledger entry ${isRecord(entry) ? String(entry.url) : '?'} is malformed`);
    if (ok) {
      expect(!urls.has(entry.url), `ledger lists ${entry.url} twice`);
      urls.add(entry.url);
    }
  }
  return problems;
}

/**
 * @param {unknown} value
 * @returns {asserts value is MetricsSnapshot}
 */
export function assertSnapshot(value) {
  const problems = snapshotProblems(value);
  if (problems.length > 0) throw new Error(`Invalid metrics snapshot:\n  ${problems.join('\n  ')}`);
}

/**
 * A blank baseline for the very first refresh, when no snapshot exists yet.
 * Everything in it is zero, so only fully fetched data can produce a valid
 * snapshot from it.
 *
 * @param {MetricsConfig} config
 * @returns {MetricsSnapshot}
 */
export function emptySnapshot(config) {
  const epoch = new Date(0).toISOString();
  const query = buildPrSearchQuery({ author: config.githubUser, excludedOwners: config.excludedOwners });
  const totalQuery = buildPrSearchQuery({ author: config.githubUser });
  return {
    schemaVersion: 1,
    retrievedAt: epoch,
    ollama: { retrievedAt: epoch, source: ollamaProfileUrl(config.ollamaUser), endpoints: [], total: 0, models: [] },
    npm: { retrievedAt: epoch, source: config.npmProfileUrl, endpoints: [], allTime: 0, lastMonth: 0, packages: [] },
    contributions: {
      retrievedAt: epoch,
      source: contributionsProfileUrl(config.githubUser),
      endpoints: [],
      lifetime: 0,
      byYear: {},
      last12Months: 0,
    },
    mergedPrs: {
      retrievedAt: epoch,
      source: prSearchWebUrl(query),
      totalSource: prSearchWebUrl(totalQuery),
      endpoints: [],
      query,
      totalQuery,
      excludedOwners: [...config.excludedOwners],
      requireMergedByOther: config.requireMergedByOther,
      upstream: 0,
      total: 0,
      ledger: [],
    },
  };
}
