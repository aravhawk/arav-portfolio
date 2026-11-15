import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { METRICS_CONFIG } from '@/lib/metrics/config';
import { isExcludedRepo } from '@/lib/metrics/core/github-prs.mjs';
import { assertSnapshot, emptySnapshot, snapshotProblems } from '@/lib/metrics/core/snapshot.mjs';

import { makeSnapshot } from './helpers';

const committed: unknown = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../content/metrics.snapshot.json', import.meta.url)), 'utf8'),
);

describe('content/metrics.snapshot.json', () => {
  it('is a valid last-known-good snapshot', () => {
    expect(snapshotProblems(committed)).toEqual([]);
  });

  it('holds every metric, the per-item breakdowns, times and source URLs', () => {
    assertSnapshot(committed);
    expect(committed.ollama.models.length).toBeGreaterThanOrEqual(4);
    expect(committed.npm.packages.map((entry) => entry.name)).toContain('@aravhawk/cc-switch');
    expect(Object.keys(committed.contributions.byYear)).toEqual(
      expect.arrayContaining(['2021', '2022', '2023', '2024', '2025', '2026']),
    );
    expect(committed.mergedPrs.ledger.length).toBeGreaterThanOrEqual(21);
    for (const section of [committed.ollama, committed.npm, committed.contributions, committed.mergedPrs]) {
      expect(Number.isFinite(Date.parse(section.retrievedAt))).toBe(true);
      expect(section.source).toMatch(/^https:\/\//);
    }
  });

  it('has no PR from an excluded owner in the ledger', () => {
    assertSnapshot(committed);
    for (const entry of committed.mergedPrs.ledger) {
      expect(isExcludedRepo(entry.repo, METRICS_CONFIG.excludedOwners)).toBe(false);
    }
  });
});

describe('snapshotProblems', () => {
  it('accepts a well-formed snapshot', () => {
    expect(snapshotProblems(makeSnapshot())).toEqual([]);
  });

  it('rejects zero or missing values, so a broken refresh can never be written', () => {
    expect(snapshotProblems(emptySnapshot(METRICS_CONFIG)).length).toBeGreaterThan(0);
    expect(snapshotProblems(null)).toEqual(['snapshot is not an object']);
    expect(snapshotProblems({})).not.toEqual([]);

    const zero = makeSnapshot();
    zero.mergedPrs.upstream = 0;
    expect(snapshotProblems(zero)).toContain('mergedPrs.upstream must be a positive integer');

    const mismatch = makeSnapshot();
    mismatch.ollama.total = 999;
    expect(snapshotProblems(mismatch)).toContain('ollama.total must equal the sum of the models');

    const years = makeSnapshot();
    years.contributions.byYear['2026'] = 1;
    expect(snapshotProblems(years)).toContain('contributions.lifetime must equal the sum of byYear');

    const twice = makeSnapshot();
    twice.mergedPrs.ledger.push({ ...twice.mergedPrs.ledger[0] });
    expect(snapshotProblems(twice).some((problem) => /twice/.test(problem))).toBe(true);

    expect(() => assertSnapshot(zero)).toThrow(/Invalid metrics snapshot/);
  });
});
