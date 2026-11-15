import { describe, expect, it } from 'vitest';

import { EXCLUDED_OWNERS, GITHUB_USER } from '@/lib/metrics/config';
import {
  buildPrSearchQuery,
  countByRepo,
  countMergedByOther,
  filterLedger,
  mergeLedgers,
  parsePrSearchResponse,
  prSearchApiUrl,
  prSearchWebUrl,
  sameOwners,
  toLedgerEntry,
} from '@/lib/metrics/core/github-prs.mjs';

import { fixture, LEDGER, searchItem } from './helpers';

describe('buildPrSearchQuery', () => {
  it('builds the headline query from the EXCLUDED_OWNERS constant', () => {
    expect(buildPrSearchQuery({ author: GITHUB_USER, excludedOwners: EXCLUDED_OWNERS })).toBe(
      'is:pr is:merged is:public author:aravhawk -user:aravhawk -user:infiniflop -user:2ALabz -user:nextup-inspired -user:navkarcaterers',
    );
  });

  it('adds one -user: term per excluded owner, whatever the list is', () => {
    const query = buildPrSearchQuery({ author: 'someone', excludedOwners: ['a', 'B', 'a', ' c ', ''] });
    expect(query).toBe('is:pr is:merged is:public author:someone -user:a -user:B -user:c');
  });

  it('builds the total query with no exclusions', () => {
    expect(buildPrSearchQuery({ author: 'aravhawk' })).toBe('is:pr is:merged is:public author:aravhawk');
  });

  it('never asks for private repositories', () => {
    expect(buildPrSearchQuery({ author: 'aravhawk', excludedOwners: EXCLUDED_OWNERS })).toContain('is:public');
  });
});

describe('search urls', () => {
  it('builds the API url with per_page=100 and a page number', () => {
    const url = new URL(prSearchApiUrl('is:pr is:merged author:aravhawk -user:aravhawk', { page: 2 }));
    expect(url.origin + url.pathname).toBe('https://api.github.com/search/issues');
    expect(url.searchParams.get('q')).toBe('is:pr is:merged author:aravhawk -user:aravhawk');
    expect(url.searchParams.get('per_page')).toBe('100');
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('builds a link a person can open', () => {
    const url = new URL(prSearchWebUrl('is:pr is:merged author:aravhawk'));
    expect(url.origin + url.pathname).toBe('https://github.com/search');
    expect(url.searchParams.get('q')).toBe('is:pr is:merged author:aravhawk');
    expect(url.searchParams.get('type')).toBe('pullrequests');
  });
});

describe('parsePrSearchResponse (saved search fixture)', () => {
  const parsed = parsePrSearchResponse(JSON.parse(fixture('github-search-upstream.json')), {
    excludedOwners: EXCLUDED_OWNERS,
  });

  it('reads the live count and every item', () => {
    expect(parsed.totalCount).toBe(21);
    expect(parsed.incomplete).toBe(false);
    expect(parsed.itemCount).toBe(21);
    expect(parsed.entries).toHaveLength(21);
  });

  it('turns items into ledger entries', () => {
    const entry = parsed.entries.find((item) => item.repo === 'devMEremenko/XcodeBenchmark');
    expect(entry).toEqual({
      repo: 'devMEremenko/XcodeBenchmark',
      number: 575,
      title: 'Add M3 Pro 12-core MacBook Pro 14"',
      mergedAt: '2025-03-29T15:45:51Z',
      url: 'https://github.com/devMEremenko/XcodeBenchmark/pull/575',
    });
  });

  it('aggregates the ledger by repository, largest first', () => {
    expect(countByRepo(parsed.entries).map(({ repo, count }) => [repo, count])).toEqual([
      ['pingdotgg/t3code', 8],
      ['AvinashDevineni/ThrasherAndChambersWebsite', 5],
      ['junhoyeo/tokscale', 3],
      ['Kanishksasi/Investo', 2],
      ['devMEremenko/XcodeBenchmark', 1],
      ['fakerybakery/openbridge', 1],
      ['Kilo-Org/kilocode', 1],
    ]);
    expect(countByRepo(parsed.entries)[0].url).toBe('https://github.com/pingdotgg/t3code');
  });
});

describe('parsePrSearchResponse (filtering)', () => {
  it('drops excluded owners even if the search returned them', () => {
    const mine = { ...LEDGER[0], repo: 'AravHawk/portfolio', url: 'https://github.com/AravHawk/portfolio/pull/1' };
    const json = { total_count: 2, incomplete_results: false, items: [searchItem(mine), searchItem(LEDGER[1])] };
    const parsed = parsePrSearchResponse(json, { excludedOwners: EXCLUDED_OWNERS });
    expect(parsed.itemCount).toBe(2);
    expect(parsed.entries.map((entry) => entry.repo)).toEqual(['pingdotgg/t3code']);
  });

  it('never lets a private repository into the ledger', () => {
    expect(toLedgerEntry({ ...searchItem(LEDGER[0]), private: true })).toBeNull();
    expect(toLedgerEntry({ ...searchItem(LEDGER[0]), repository: { private: true } })).toBeNull();
    expect(toLedgerEntry({ ...searchItem(LEDGER[0]), repository: { private: false } })).not.toBeNull();
  });

  it('drops anything that is not a merged pull request', () => {
    const item = searchItem(LEDGER[0]);
    expect(toLedgerEntry({ ...item, pull_request: { merged_at: null } })).toBeNull();
    expect(toLedgerEntry({ ...item, pull_request: undefined })).toBeNull();
    expect(toLedgerEntry({ ...item, repository_url: 'https://example.com/x' })).toBeNull();
    expect(toLedgerEntry({ ...item, number: '12' })).toBeNull();
    expect(toLedgerEntry(null)).toBeNull();
  });

  it('reports incomplete results and rejects malformed bodies', () => {
    expect(parsePrSearchResponse({ total_count: 5, incomplete_results: true, items: [] }).incomplete).toBe(true);
    expect(() => parsePrSearchResponse({ message: 'API rate limit exceeded' })).toThrow();
    expect(() => parsePrSearchResponse('nope')).toThrow();
  });
});

describe('ledger helpers', () => {
  it('merges ledgers by URL, newest merge first, without duplicates', () => {
    const extra = {
      repo: 'Kilo-Org/kilocode',
      number: 77,
      title: 'New one',
      mergedAt: '2026-11-12T10:00:00Z',
      url: 'https://github.com/Kilo-Org/kilocode/pull/77',
    };
    const merged = mergeLedgers([extra, { ...LEDGER[0], title: 'Renamed' }], LEDGER);
    expect(merged.map((entry) => entry.url)).toEqual([extra.url, LEDGER[0].url, LEDGER[1].url, LEDGER[2].url]);
    expect(merged[1].title).toBe('Renamed');
  });

  it('keeps a known merger when the newer entry lacks one', () => {
    const merged = mergeLedgers([LEDGER[0]], [{ ...LEDGER[0], mergedBy: 'someone' }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].mergedBy).toBe('someone');
  });

  it('filters by owner, ignoring case', () => {
    expect(filterLedger(LEDGER, ['PingDotGG']).map((entry) => entry.repo)).toEqual(['junhoyeo/tokscale']);
    expect(filterLedger(LEDGER, [])).toHaveLength(3);
  });

  it('counts by repository with ties in alphabetical order', () => {
    expect(countByRepo(LEDGER)).toEqual([
      { repo: 'pingdotgg/t3code', count: 2, url: 'https://github.com/pingdotgg/t3code' },
      { repo: 'junhoyeo/tokscale', count: 1, url: 'https://github.com/junhoyeo/tokscale' },
    ]);
    expect(countByRepo([])).toEqual([]);
  });

  it('counts PRs merged by someone else only when the merger is known', () => {
    const ledger = [
      { ...LEDGER[0], mergedBy: 'maintainer' },
      { ...LEDGER[1], mergedBy: 'AravHawk' },
      { ...LEDGER[2], mergedBy: null },
    ];
    expect(countMergedByOther(ledger, 'aravhawk')).toBe(1);
    expect(countMergedByOther(LEDGER, 'aravhawk')).toBe(0);
  });

  it('compares owner lists as sets', () => {
    expect(sameOwners(['a', 'B'], ['b', 'A', 'a'])).toBe(true);
    expect(sameOwners(['a'], ['a', 'b'])).toBe(false);
  });
});
