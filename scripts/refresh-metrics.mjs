#!/usr/bin/env node
// Rewrites content/metrics.snapshot.json from the live sources.
//
//   node scripts/refresh-metrics.mjs            refresh (pnpm metrics:refresh)
//   node scripts/refresh-metrics.mjs --dry-run  print what would change, write nothing
//   node scripts/refresh-metrics.mjs --force    accept live values that are lower than the snapshot
//
// It runs the same fetch, parse and validation code as the site
// (src/lib/metrics/core), so there is one source of truth. No dependencies:
// Node 24 loads config.ts directly. A source that fails keeps its old values.

import { appendFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { METRICS_CONFIG } from '../src/lib/metrics/config.ts';
import { collectLive } from '../src/lib/metrics/core/collect.mjs';
import { countByRepo } from '../src/lib/metrics/core/github-prs.mjs';
import { resolveMetrics } from '../src/lib/metrics/core/resolve.mjs';
import { assertSnapshot, emptySnapshot, snapshotProblems } from '../src/lib/metrics/core/snapshot.mjs';

const SNAPSHOT_PATH = fileURLToPath(new URL('../content/metrics.snapshot.json', import.meta.url));

/** The weekly run may spend a few more search calls than the site does. */
const MAX_LEDGER_PAGES = 5;

const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  console.log('Usage: node scripts/refresh-metrics.mjs [--dry-run] [--force]');
  process.exit(0);
}
const dryRun = args.has('--dry-run');
const force = args.has('--force');

/** @returns {Promise<{ snapshot: import('../src/lib/metrics/types').MetricsSnapshot, exists: boolean }>} */
async function readSnapshot() {
  let text;
  try {
    text = await readFile(SNAPSHOT_PATH, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { snapshot: emptySnapshot(METRICS_CONFIG), exists: false };
    }
    throw error;
  }
  const snapshot = JSON.parse(text);
  assertSnapshot(snapshot);
  return { snapshot, exists: true };
}

/** @param {number} value */
const fmt = (value) => value.toLocaleString('en-US');

/**
 * @param {string} label
 * @param {number} before
 * @param {number} after
 * @param {boolean} live
 */
function line(label, before, after, live) {
  const delta = after - before;
  const change = delta === 0 ? 'unchanged' : `${delta > 0 ? '+' : ''}${fmt(delta)}`;
  console.log(`  ${label.padEnd(28)} ${fmt(after).padStart(8)}  (${change}${live ? '' : ', kept from snapshot'})`);
}

async function main() {
  const { snapshot: previous, exists } = await readSnapshot();
  const now = new Date();
  if (!exists) console.log('No snapshot yet: creating it from the live sources.');

  const live = await collectLive({
    config: METRICS_CONFIG,
    snapshot: previous,
    fetchImpl: (url, init) => fetch(url, init),
    now,
    githubToken: process.env.GITHUB_TOKEN ?? null,
    full: true,
    maxLedgerPages: MAX_LEDGER_PAGES,
  });
  const { snapshot, status, problems } = resolveMetrics({
    previous,
    live,
    config: METRICS_CONFIG,
    now,
    force: force || !exists,
  });

  const failed = [
    status.ollama.live ? null : 'ollama',
    status.npmAllTime.live && status.npmLastMonth.live ? null : 'npm',
    status.contributions.live ? null : 'contributions',
    status.upstreamPrs.live && status.totalPrs.live ? null : 'mergedPrs',
  ].filter((name) => name !== null);

  console.log(`Metrics as of ${now.toISOString()}`);
  line('Ollama pulls', previous.ollama.total, snapshot.ollama.total, status.ollama.live);
  for (const model of snapshot.ollama.models) console.log(`      ${model.name.padEnd(24)} ${fmt(model.pulls).padStart(8)}`);
  line('npm downloads, all time', previous.npm.allTime, snapshot.npm.allTime, status.npmAllTime.live);
  line('npm downloads, last month', previous.npm.lastMonth, snapshot.npm.lastMonth, status.npmLastMonth.live);
  line(
    'Contributions, lifetime',
    previous.contributions.lifetime,
    snapshot.contributions.lifetime,
    status.contributions.live,
  );
  console.log(
    `      ${Object.entries(snapshot.contributions.byYear)
      .map(([year, count]) => `${year} ${fmt(count)}`)
      .join(', ')}`,
  );
  line(
    'Contributions, last year',
    previous.contributions.last12Months,
    snapshot.contributions.last12Months,
    live.contributions.ok && live.contributions.data.last12Months !== null,
  );
  line('Merged PRs, upstream', previous.mergedPrs.upstream, snapshot.mergedPrs.upstream, status.upstreamPrs.live);
  for (const repo of countByRepo(snapshot.mergedPrs.ledger)) {
    console.log(`      ${repo.repo.padEnd(48)} ${String(repo.count).padStart(3)}`);
  }
  line('Merged PRs, all public', previous.mergedPrs.total, snapshot.mergedPrs.total, status.totalPrs.live);

  for (const problem of problems) console.warn(`warning: ${problem.source}: ${problem.message}`);

  const invalid = snapshotProblems(snapshot);
  if (invalid.length > 0) {
    console.error(`Refusing to write an invalid snapshot:\n  ${invalid.join('\n  ')}`);
    process.exit(1);
  }
  if (failed.length === 4) {
    console.error('Every source failed: the snapshot was left untouched.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('Dry run: nothing written.');
  } else {
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`Wrote ${SNAPSHOT_PATH}`);
  }

  if (failed.length > 0) {
    console.warn(`Kept the previous values for: ${failed.join(', ')}`);
  }
  // Lets the workflow commit what did refresh and still flag the run.
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `failed=${failed.join(',')}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
