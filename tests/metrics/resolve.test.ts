import { describe, expect, it } from 'vitest';

import { collectLive } from '@/lib/metrics/core/collect.mjs';
import {
  LAST_YEAR_LABEL,
  LIFETIME_LABEL,
  resolveMetrics,
  snapshotToSiteMetrics,
  toSiteMetrics,
} from '@/lib/metrics/core/resolve.mjs';
import { snapshotProblems } from '@/lib/metrics/core/snapshot.mjs';
import type { MetricsConfig, MetricsSnapshot } from '@/lib/metrics/types';

import {
  contributionsHtml,
  LEDGER,
  makeSnapshot,
  makeWorld,
  mockFetch,
  NOW,
  ollamaProfileHtml,
  searchItem,
  SNAPSHOT_TIME,
  TEST_CONFIG,
  worldHandler,
  type MockReply,
} from './helpers';

const NEXT_INIT = { next: { revalidate: 3600, tags: ['metrics'] } };
/** makeWorld() stamps every response with this Date header. */
const FETCHED_AT = '2026-11-15T11:59:00.000Z';

type RunOptions = {
  config?: MetricsConfig;
  snapshot?: MetricsSnapshot;
  now?: Date;
  token?: string | null;
  full?: boolean;
  force?: boolean;
};

async function run(handler: (url: string, init: Record<string, unknown>) => MockReply, options: RunOptions = {}) {
  const config = options.config ?? TEST_CONFIG;
  const snapshot = options.snapshot ?? makeSnapshot();
  const now = options.now ?? NOW;
  const { fetchImpl, calls } = mockFetch(handler);
  const live = await collectLive({
    config,
    snapshot,
    fetchImpl,
    init: NEXT_INIT,
    now,
    githubToken: options.token ?? null,
    full: options.full,
  });
  const resolved = resolveMetrics({ previous: snapshot, live, config, now, force: options.force });
  const metrics = toSiteMetrics({
    resolved: resolved.snapshot,
    committed: snapshot,
    status: resolved.status,
    config,
    retrievedAt: now.toISOString(),
  });
  return { live, resolved, metrics, calls, snapshot };
}

const hostOf = (url: string) => new URL(url).host;

describe('all sources healthy', () => {
  it('shows the live values and marks them live', async () => {
    const { metrics, resolved } = await run(worldHandler(makeWorld()));
    expect(resolved.problems).toEqual([]);

    expect(metrics.ollama.total).toEqual({
      value: 1060,
      snapshotValue: 1000,
      live: true,
      asOf: FETCHED_AT,
      source: 'https://ollama.com/aravhawk',
    });
    expect(metrics.ollama.models).toEqual([
      { name: 'alpha', pulls: 650, url: 'https://ollama.com/aravhawk/alpha', uploadedAt: '2025-04-11T02:23:00.000Z' },
      { name: 'beta', pulls: 410, url: 'https://ollama.com/aravhawk/beta', uploadedAt: '2025-04-11T02:23:00.000Z' },
    ]);

    expect(metrics.npm.allTime).toMatchObject({ value: 5200, snapshotValue: 5000, live: true, asOf: FETCHED_AT });
    expect(metrics.npm.lastMonth).toMatchObject({ value: 280, snapshotValue: 300, live: true });
    expect(metrics.npm.allTime.source).toBe('https://www.npmjs.com/package/@aravhawk/cc-switch');
    expect(metrics.npm.packages).toEqual([
      {
        name: '@aravhawk/cc-switch',
        allTime: 5200,
        lastMonth: 280,
        url: 'https://www.npmjs.com/package/@aravhawk/cc-switch',
      },
    ]);

    expect(metrics.contributions.total).toMatchObject({ value: 2427, snapshotValue: 2377, live: true });
    expect(metrics.contributions.window).toBe('lifetime');
    expect(metrics.contributions.label).toBe(LIFETIME_LABEL);
    expect(metrics.contributions.label).toBe('lifetime contributions on GitHub');
    expect(metrics.contributions.byYear).toEqual({
      '2021': 11,
      '2022': 16,
      '2023': 2,
      '2024': 162,
      '2025': 186,
      '2026': 2050,
    });

    expect(metrics.mergedPrs.upstream).toMatchObject({ value: 4, snapshotValue: 3, live: true });
    expect(metrics.mergedPrs.total).toMatchObject({ value: 52, snapshotValue: 50, live: true });
    expect(metrics.mergedPrs.upstreamRepoCount).toBe(3);
    expect(metrics.mergedPrs.byRepo.map(({ repo, count }) => [repo, count])).toEqual([
      ['pingdotgg/t3code', 2],
      ['junhoyeo/tokscale', 1],
      ['Kilo-Org/kilocode', 1],
    ]);
    expect(metrics.mergedPrs.ledger).toHaveLength(4);
    expect(metrics.mergedPrs.ledger[0].url).toBe('https://github.com/Kilo-Org/kilocode/pull/77');
    expect(new URL(metrics.mergedPrs.upstream.source).searchParams.get('q')).toContain('-user:aravhawk');
    expect(metrics.retrievedAt).toBe(NOW.toISOString());
  });

  it('produces a snapshot the refresh script can write', async () => {
    const { resolved } = await run(worldHandler(makeWorld()), { full: true });
    expect(snapshotProblems(resolved.snapshot)).toEqual([]);
    expect(resolved.snapshot.contributions.last12Months).toBe(2150);
    expect(resolved.snapshot.contributions.retrievedAt).toBe(FETCHED_AT);
    expect(resolved.snapshot.retrievedAt).toBe(NOW.toISOString());
  });
});

describe('requests', () => {
  it('sends the User-Agent, a timeout signal and the Next cache options on every request', async () => {
    const { calls } = await run(worldHandler(makeWorld()));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      expect(headers['User-Agent']).toBe('arav.pro-metrics/1.0 (+https://arav.pro)');
      expect(call.init.signal).toBeInstanceOf(AbortSignal);
      expect(call.init.next).toEqual({ revalidate: 3600, tags: ['metrics'] });
      expect(headers.Authorization).toBeUndefined();
    }
  });

  it('uses two search calls, and only the current year of contributions', async () => {
    const { calls } = await run(worldHandler(makeWorld()));
    const urls = calls.map((call) => call.url);
    expect(urls.filter((url) => hostOf(url) === 'api.github.com')).toHaveLength(2);
    expect(urls.filter((url) => hostOf(url) === 'github.com')).toEqual([
      'https://github.com/users/aravhawk/contributions?from=2026-01-01&to=2026-12-31',
    ]);
    expect(urls.filter((url) => hostOf(url) === 'ollama.com').sort()).toEqual([
      'https://ollama.com/aravhawk',
      'https://ollama.com/aravhawk/alpha',
      'https://ollama.com/aravhawk/beta',
    ]);
    expect(urls.filter((url) => hostOf(url) === 'api.npmjs.org').sort()).toEqual([
      'https://api.npmjs.org/downloads/point/last-month/@aravhawk/cc-switch',
      'https://api.npmjs.org/downloads/range/2026-02-01:2026-11-15/@aravhawk/cc-switch',
    ]);
  });

  it('never spends more than three search calls, even with a long ledger', async () => {
    const world = makeWorld();
    world.upstream = 450;
    const page = Array.from({ length: 100 }, (_, index) => ({
      ...LEDGER[0],
      number: index + 1,
      url: `https://github.com/pingdotgg/t3code/pull/${index + 1}`,
    }));
    const { calls, metrics, live } = await run(
      worldHandler(world, (url) => {
        const parsed = new URL(url);
        if (parsed.host !== 'api.github.com' || !(parsed.searchParams.get('q') ?? '').includes('-user:')) return null;
        const offset = (Number(parsed.searchParams.get('page')) - 1) * 100;
        const items = page.map((entry) => ({
          ...entry,
          number: entry.number + offset,
          url: `https://github.com/pingdotgg/t3code/pull/${entry.number + offset}`,
        }));
        return { body: { total_count: 450, incomplete_results: false, items: items.map(searchItem) } };
      }),
    );
    expect(calls.filter((call) => hostOf(call.url) === 'api.github.com')).toHaveLength(3);
    expect(metrics.mergedPrs.upstream.value).toBe(450);
    expect(live.mergedPrs.ok && live.mergedPrs.data.ledgerComplete).toBe(false);
    // An incomplete live ledger only adds to the snapshot ledger.
    expect(metrics.mergedPrs.ledger.length).toBe(200 + 1);
  });

  it('adds the Authorization header only for api.github.com, and only when a token exists', async () => {
    const { calls } = await run(worldHandler(makeWorld()), { token: 'test-token' });
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      if (hostOf(call.url) === 'api.github.com') expect(headers.Authorization).toBe('Bearer test-token');
      else expect(headers.Authorization).toBeUndefined();
    }
  });

  it('builds the search query from the exclusion list in the config', async () => {
    const config = { ...TEST_CONFIG, excludedOwners: ['aravhawk', 'acme'] };
    const { calls } = await run(worldHandler(makeWorld()), { config });
    const queries = calls
      .filter((call) => hostOf(call.url) === 'api.github.com')
      .map((call) => new URL(call.url).searchParams.get('q'));
    expect(queries.sort()).toEqual([
      'is:pr is:merged is:public author:aravhawk',
      'is:pr is:merged is:public author:aravhawk -user:aravhawk -user:acme',
    ]);
  });
});

describe('cumulative counters never drop', () => {
  it('shows max(live, snapshot) when a live value dips within tolerance', async () => {
    const world = makeWorld();
    world.ollama = { alpha: '590', beta: '410' };
    world.npmAllTime = 4900;
    world.contributions['2026'] = 1990;
    world.upstream = 3;
    world.upstreamItems = LEDGER;
    world.total = 48;
    const { metrics } = await run(worldHandler(world));

    expect(metrics.ollama.models.map((model) => model.pulls)).toEqual([600, 410]);
    expect(metrics.ollama.total).toMatchObject({ value: 1010, live: false, asOf: SNAPSHOT_TIME });
    expect(metrics.npm.allTime).toMatchObject({ value: 5000, live: false, asOf: SNAPSHOT_TIME });
    expect(metrics.contributions.total).toMatchObject({ value: 2377, live: false, asOf: SNAPSHOT_TIME });
    expect(metrics.mergedPrs.upstream).toMatchObject({ value: 3, live: true });
    expect(metrics.mergedPrs.total).toMatchObject({ value: 50, live: false, asOf: SNAPSHOT_TIME });
  });

  it('rejects a value below 0.9 x the snapshot and logs why', async () => {
    const world = makeWorld();
    world.ollama = { alpha: '100', beta: '410' };
    world.ollamaPages = { alpha: '100', beta: '410' };
    world.npmAllTime = 4000;
    world.contributions['2026'] = 1000;
    world.upstream = 2;
    world.total = 10;
    const { metrics, resolved } = await run(worldHandler(world));

    expect(metrics.ollama.models.find((model) => model.name === 'alpha')?.pulls).toBe(600);
    expect(metrics.ollama.total).toMatchObject({ value: 1010, live: false });
    expect(metrics.npm.allTime).toMatchObject({ value: 5000, live: false });
    expect(metrics.contributions.total).toMatchObject({ value: 2377, live: false });
    expect(metrics.mergedPrs.upstream).toMatchObject({ value: 3, live: false });
    expect(metrics.mergedPrs.total).toMatchObject({ value: 50, live: false });
    // A rejected count does not get to rewrite the ledger either.
    expect(metrics.mergedPrs.ledger.map((entry) => entry.url)).toEqual(LEDGER.map((entry) => entry.url));

    const messages = resolved.problems.map((problem) => `${problem.source}: ${problem.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^ollama: alpha: 100 is below 0\.9 x the snapshot value 600/),
        expect.stringMatching(/^npm: @aravhawk\/cc-switch all-time: 4000 is below/),
        expect.stringMatching(/^contributions: 2026: 1000 is below/),
        expect.stringMatching(/^mergedPrs: merged PRs: 2 is below/),
        expect.stringMatching(/^mergedPrs: total merged PRs: 10 is below/),
      ]),
    );
  });

  it('rejects zero, and never shows it', async () => {
    const world = makeWorld();
    world.ollama = { alpha: '0', beta: '0' };
    world.npmAllTime = 0;
    world.npmLastMonth = 0;
    world.upstream = 0;
    world.upstreamItems = [];
    world.total = 0;
    const { metrics } = await run(worldHandler(world));
    expect(metrics.ollama.total).toMatchObject({ value: 1000, live: false });
    expect(metrics.npm.allTime).toMatchObject({ value: 5000, live: false });
    expect(metrics.npm.lastMonth).toMatchObject({ value: 300, live: false });
    expect(metrics.mergedPrs.upstream).toMatchObject({ value: 3, live: false });
    expect(metrics.mergedPrs.total).toMatchObject({ value: 50, live: false });
    expect(metrics.mergedPrs.ledger).toHaveLength(3);
  });

  it('rejects a count that is not an integer', async () => {
    const { metrics } = await run(
      worldHandler(makeWorld(), (url) => {
        const parsed = new URL(url);
        if (parsed.host === 'api.github.com') {
          return { body: { total_count: 21.5, incomplete_results: false, items: [] } };
        }
        if (parsed.host === 'api.npmjs.org' && parsed.pathname.includes('/point/')) {
          return { body: { downloads: 'many' } };
        }
        return null;
      }),
    );
    expect(metrics.mergedPrs.upstream).toMatchObject({ value: 3, live: false });
    expect(metrics.mergedPrs.total).toMatchObject({ value: 50, live: false });
    expect(metrics.npm.lastMonth).toMatchObject({ value: 300, live: false });
    expect(metrics.npm.allTime).toMatchObject({ value: 5200, live: true });
  });
});

describe('last month is not cumulative', () => {
  it('takes a lower live value with no max against the snapshot', async () => {
    const world = makeWorld();
    world.npmLastMonth = 12;
    const { metrics } = await run(worldHandler(world));
    expect(metrics.npm.lastMonth).toMatchObject({ value: 12, snapshotValue: 300, live: true });
  });
});

describe('one source failing does not affect the others', () => {
  const expectOthersLive = (metrics: Awaited<ReturnType<typeof run>>['metrics'], failed: string) => {
    if (failed !== 'ollama') expect(metrics.ollama.total).toMatchObject({ value: 1060, live: true });
    if (failed !== 'npm') expect(metrics.npm.allTime).toMatchObject({ value: 5200, live: true });
    if (failed !== 'contributions') expect(metrics.contributions.total).toMatchObject({ value: 2427, live: true });
    if (failed !== 'mergedPrs') expect(metrics.mergedPrs.upstream).toMatchObject({ value: 4, live: true });
  };

  it('Ollama down (network error): snapshot for Ollama, live for the rest', async () => {
    const { metrics, resolved, snapshot } = await run(
      worldHandler(makeWorld(), (url) => (hostOf(url) === 'ollama.com' ? new Error('fetch failed') : null)),
    );
    expect(metrics.ollama.total).toEqual({
      value: 1000,
      snapshotValue: 1000,
      live: false,
      asOf: SNAPSHOT_TIME,
      source: 'https://ollama.com/aravhawk',
    });
    expect(metrics.ollama.models).toEqual(snapshot.ollama.models);
    expect(resolved.problems.some((problem) => problem.source === 'ollama')).toBe(true);
    expect(resolved.problems.every((problem) => problem.source === 'ollama')).toBe(true);
    expectOthersLive(metrics, 'ollama');
  });

  it('npm returning HTTP 500: snapshot for npm, live for the rest', async () => {
    const { metrics } = await run(
      worldHandler(makeWorld(), (url) => (hostOf(url) === 'api.npmjs.org' ? { status: 500, body: 'oops' } : null)),
    );
    expect(metrics.npm.allTime).toMatchObject({ value: 5000, live: false, asOf: SNAPSHOT_TIME });
    expect(metrics.npm.lastMonth).toMatchObject({ value: 300, live: false, asOf: SNAPSHOT_TIME });
    expect(metrics.npm.packages[0]).toMatchObject({ allTime: 5000, lastMonth: 300 });
    expectOthersLive(metrics, 'npm');
  });

  it('GitHub contributions timing out: snapshot for contributions, live for the rest', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const { metrics, resolved } = await run(
      worldHandler(makeWorld(), (url) => (hostOf(url) === 'github.com' ? timeout : null)),
    );
    expect(metrics.contributions.total).toMatchObject({ value: 2377, live: false, asOf: SNAPSHOT_TIME });
    expect(metrics.contributions.byYear['2026']).toBe(2000);
    expect(resolved.problems).toEqual([
      {
        source: 'contributions',
        message: '2026: https://github.com/users/aravhawk/contributions?from=2026-01-01&to=2026-12-31: timed out',
      },
    ]);
    expectOthersLive(metrics, 'contributions');
  });

  it('GitHub search rate limited (403): snapshot for PRs, live for the rest', async () => {
    const { metrics, snapshot } = await run(
      worldHandler(makeWorld(), (url) =>
        hostOf(url) === 'api.github.com' ? { status: 403, body: { message: 'API rate limit exceeded' } } : null,
      ),
    );
    expect(metrics.mergedPrs.upstream).toMatchObject({ value: 3, live: false, asOf: SNAPSHOT_TIME });
    expect(metrics.mergedPrs.total).toMatchObject({ value: 50, live: false, asOf: SNAPSHOT_TIME });
    expect(metrics.mergedPrs.ledger).toEqual(snapshot.mergedPrs.ledger);
    expect(metrics.mergedPrs.byRepo.map(({ repo, count }) => [repo, count])).toEqual([
      ['pingdotgg/t3code', 2],
      ['junhoyeo/tokscale', 1],
    ]);
    expectOthersLive(metrics, 'mergedPrs');
  });

  it('everything down: the whole result equals the snapshot, with no throw', async () => {
    const { metrics, snapshot } = await run(() => new Error('offline'));
    expect(metrics).toEqual({ ...snapshotToSiteMetrics(snapshot, TEST_CONFIG), retrievedAt: NOW.toISOString() });
  });

  it('survives a fetch implementation that throws synchronously', async () => {
    const live = await collectLive({
      config: TEST_CONFIG,
      snapshot: makeSnapshot(),
      fetchImpl: () => {
        throw new TypeError('fetch is not available');
      },
      now: NOW,
    });
    const resolved = resolveMetrics({ previous: makeSnapshot(), live, config: TEST_CONFIG, now: NOW });
    expect(resolved.snapshot).toEqual({ ...makeSnapshot(), retrievedAt: NOW.toISOString() });
  });
});

describe('parse failures fall back', () => {
  it('garbage HTML from GitHub: contributions use the snapshot', async () => {
    const { metrics } = await run(
      worldHandler(makeWorld(), (url) =>
        hostOf(url) === 'github.com' ? { body: '<html><body>Sign in to GitHub</body></html>' } : null,
      ),
    );
    expect(metrics.contributions.total).toMatchObject({ value: 2377, live: false });
  });

  it('heading and per-day sum disagree: contributions use the snapshot', async () => {
    const { metrics, resolved } = await run(
      worldHandler(makeWorld(), (url) =>
        hostOf(url) === 'github.com' ? { body: contributionsHtml(2050, 2026, 2049) } : null,
      ),
    );
    expect(metrics.contributions.total).toMatchObject({ value: 2377, live: false });
    expect(resolved.problems[0].message).toMatch(/heading says 2050 but the per-day counts sum to 2049/);
  });

  it('GitHub answering for the wrong year: contributions use the snapshot', async () => {
    const { metrics } = await run(
      worldHandler(makeWorld(), (url) => (hostOf(url) === 'github.com' ? { body: contributionsHtml(9999, 2025) } : null)),
    );
    expect(metrics.contributions.total).toMatchObject({ value: 2377, live: false });
  });

  it('npm clamping the range: all-time uses the snapshot, last month stays live', async () => {
    const { metrics } = await run(
      worldHandler(makeWorld(), (url) => {
        const parsed = new URL(url);
        if (parsed.host !== 'api.npmjs.org' || !parsed.pathname.includes('/range/')) return null;
        return { body: { start: '2026-05-15', end: '2026-11-15', downloads: [{ day: '2026-05-15', downloads: 9 }] } };
      }),
    );
    expect(metrics.npm.allTime).toMatchObject({ value: 5000, live: false });
    expect(metrics.npm.lastMonth).toMatchObject({ value: 280, live: true });
  });

  it('GitHub search reporting incomplete results: PRs use the snapshot', async () => {
    const { metrics } = await run(
      worldHandler(makeWorld(), (url) =>
        hostOf(url) === 'api.github.com' ? { body: { total_count: 40, incomplete_results: true, items: [] } } : null,
      ),
    );
    expect(metrics.mergedPrs.upstream).toMatchObject({ value: 3, live: false });
    expect(metrics.mergedPrs.total).toMatchObject({ value: 50, live: false });
  });
});

describe('Ollama per-model behaviour', () => {
  it('includes a new model automatically and adds it to the total', async () => {
    const world = makeWorld();
    world.ollama = { alpha: '650', beta: '410', gamma: '25' };
    const { metrics } = await run(worldHandler(world));
    expect(metrics.ollama.models.map((model) => [model.name, model.pulls])).toEqual([
      ['alpha', 650],
      ['beta', 410],
      ['gamma', 25],
    ]);
    expect(metrics.ollama.total).toMatchObject({ value: 1085, live: true });
  });

  it('falls back per model when one row and its page cannot be read', async () => {
    const world = makeWorld();
    world.ollama = { alpha: 'lots', beta: '410' };
    const { metrics, resolved } = await run(worldHandler(world));
    expect(metrics.ollama.models.map((model) => [model.name, model.pulls])).toEqual([
      ['alpha', 600],
      ['beta', 410],
    ]);
    expect(metrics.ollama.total).toMatchObject({ value: 1010, live: false, asOf: SNAPSHOT_TIME });
    expect(resolved.problems.map((problem) => problem.message)).toEqual(
      expect.arrayContaining(['alpha: pull count not found on the profile page']),
    );
  });

  it('uses the model page when the profile row cannot be read', async () => {
    const world = makeWorld();
    world.ollama = { alpha: 'lots', beta: '410' };
    world.ollamaPages = { alpha: '655', beta: '410' };
    const { metrics } = await run(worldHandler(world));
    expect(metrics.ollama.models[0]).toMatchObject({ name: 'alpha', pulls: 655 });
  });

  it('uses the model pages when the profile markup changes completely', async () => {
    const world = makeWorld();
    world.ollamaPages = { alpha: '660', beta: '420' };
    const { metrics } = await run(
      worldHandler(world, (url) => (url === 'https://ollama.com/aravhawk' ? { body: '<main>redesigned</main>' } : null)),
    );
    expect(metrics.ollama.models.map((model) => model.pulls)).toEqual([660, 420]);
    // The profile could not confirm the model list, so the total is not called live.
    expect(metrics.ollama.total).toMatchObject({ value: 1080, live: false });
  });

  it('takes the larger reading and notes it when the two pages disagree badly', async () => {
    const world = makeWorld();
    world.ollamaPages = { alpha: '6', beta: '410' };
    const { metrics, resolved } = await run(worldHandler(world));
    expect(metrics.ollama.models[0]).toMatchObject({ name: 'alpha', pulls: 650 });
    expect(resolved.problems.map((problem) => problem.message)).toContain(
      'alpha: profile says 650 pulls, model page says 6',
    );
  });

  it('keeps a model that vanished from the profile at its snapshot value', async () => {
    const world = makeWorld();
    world.ollama = { alpha: '650' };
    const { metrics } = await run(worldHandler(world));
    expect(metrics.ollama.models.map((model) => [model.name, model.pulls])).toEqual([
      ['alpha', 650],
      ['beta', 400],
    ]);
    expect(metrics.ollama.total.live).toBe(false);
  });

  it('reads abbreviated counts', async () => {
    const world = makeWorld();
    world.ollama = { alpha: '12.3K', beta: '1.2M' };
    const { metrics } = await run(worldHandler(world));
    expect(metrics.ollama.total.value).toBe(1212300);
  });

  it('does not request a page per link if the profile lists a flood of models', async () => {
    const flood = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`m${index}`, '1']));
    const world = makeWorld();
    world.ollama = flood;
    const { calls } = await run(
      worldHandler(world, (url) => (url === 'https://ollama.com/aravhawk' ? { body: ollamaProfileHtml(flood) } : null)),
    );
    expect(calls.filter((call) => hostOf(call.url) === 'ollama.com').length).toBeLessThanOrEqual(31);
  });
});

describe('contributions window', () => {
  it('lifetime keeps past years from the snapshot and re-reads only the current year', async () => {
    const world = makeWorld();
    world.contributions = { '2026': 2050 };
    const { metrics } = await run(worldHandler(world));
    expect(metrics.contributions.byYear).toEqual({
      '2021': 11,
      '2022': 16,
      '2023': 2,
      '2024': 162,
      '2025': 186,
      '2026': 2050,
    });
    expect(metrics.contributions.total.value).toBe(2427);
  });

  it('last12months reads the rolling page and relabels', async () => {
    const config: MetricsConfig = { ...TEST_CONFIG, contributionsWindow: 'last12months' };
    const { metrics, calls, resolved } = await run(worldHandler(makeWorld()), { config });
    expect(metrics.contributions.window).toBe('last12months');
    expect(metrics.contributions.label).toBe(LAST_YEAR_LABEL);
    expect(metrics.contributions.label).toBe('contributions in the last year');
    expect(metrics.contributions.total).toMatchObject({ value: 2150, snapshotValue: 2100, live: true });
    expect(calls.map((call) => call.url).filter((url) => hostOf(url) === 'github.com')).toEqual([
      'https://github.com/users/aravhawk/contributions',
    ]);
    expect(resolved.problems).toEqual([]);
  });

  it('last12months is a rolling window: it may go down, and falls back when unreadable', async () => {
    const config: MetricsConfig = { ...TEST_CONFIG, contributionsWindow: 'last12months' };
    const world = makeWorld();
    world.last12Months = 1500;
    const lower = await run(worldHandler(world), { config });
    expect(lower.metrics.contributions.total).toMatchObject({ value: 1500, live: true });

    const broken = await run(
      worldHandler(makeWorld(), (url) => (hostOf(url) === 'github.com' ? { status: 502, body: '' } : null)),
      { config },
    );
    expect(broken.metrics.contributions.total).toMatchObject({ value: 2100, live: false, asOf: SNAPSHOT_TIME });
  });

  it('after New Year, re-reads the year the snapshot caught before it ended', async () => {
    const snapshot = makeSnapshot();
    snapshot.contributions.retrievedAt = '2026-12-28T11:00:00.000Z';
    const world = makeWorld();
    world.contributions = { '2026': 2300, '2027': 4 };
    world.date = undefined;
    const now = new Date('2027-01-02T09:00:00.000Z');
    const { metrics, calls } = await run(worldHandler(world), { snapshot, now });
    expect(calls.map((call) => call.url).filter((url) => hostOf(url) === 'github.com').sort()).toEqual([
      'https://github.com/users/aravhawk/contributions?from=2026-01-01&to=2026-12-31',
      'https://github.com/users/aravhawk/contributions?from=2027-01-01&to=2027-12-31',
    ]);
    expect(metrics.contributions.byYear['2026']).toBe(2300);
    expect(metrics.contributions.byYear['2027']).toBe(4);
    expect(metrics.contributions.total).toMatchObject({ value: 2377 - 2000 + 2300 + 4, live: true });
  });

  it('a new year with no activity yet counts as zero, not as a failure', async () => {
    const snapshot = makeSnapshot();
    snapshot.contributions.retrievedAt = '2027-01-04T11:00:00.000Z';
    const world = makeWorld();
    world.contributions = { '2028': 0 };
    world.date = undefined;
    const { metrics, calls } = await run(worldHandler(world), { snapshot, now: new Date('2028-01-01T03:00:00.000Z') });
    // 2027 was never in the snapshot, so it is read along with 2028.
    expect(calls.filter((call) => hostOf(call.url) === 'github.com')).toHaveLength(2);
    expect(metrics.contributions.byYear['2028']).toBe(0);
    expect(metrics.contributions.total.value).toBe(2377);
  });
});

describe('merged PR ledger', () => {
  it('replaces the ledger when the live one is complete, so a repo that left public search drops out', async () => {
    const world = makeWorld();
    world.upstream = 3;
    world.upstreamItems = [world.upstreamItems[0], LEDGER[0], LEDGER[1]];
    const { metrics } = await run(worldHandler(world));
    expect(metrics.mergedPrs.ledger.map((entry) => entry.repo)).toEqual([
      'Kilo-Org/kilocode',
      'pingdotgg/t3code',
      'pingdotgg/t3code',
    ]);
    expect(metrics.mergedPrs.upstream.value).toBe(3);
  });

  it('applies a changed exclusion list without comparing against the old headline number', async () => {
    const config: MetricsConfig = { ...TEST_CONFIG, excludedOwners: [...TEST_CONFIG.excludedOwners, 'pingdotgg'] };
    const world = makeWorld();
    world.upstream = 1;
    world.upstreamItems = [LEDGER[2]];
    const live = await run(worldHandler(world), { config });
    expect(live.metrics.mergedPrs.upstream).toMatchObject({ value: 1, live: true });
    expect(live.metrics.mergedPrs.byRepo).toEqual([
      { repo: 'junhoyeo/tokscale', count: 1, url: 'https://github.com/junhoyeo/tokscale' },
    ]);

    const offline = await run(() => new Error('offline'), { config });
    expect(offline.metrics.mergedPrs.upstream).toMatchObject({ value: 1, live: false });
    expect(offline.metrics.mergedPrs.ledger.map((entry) => entry.repo)).toEqual(['junhoyeo/tokscale']);
  });

  it('REQUIRE_MERGED_BY_OTHER looks up who merged each PR and counts only the others', async () => {
    const config: MetricsConfig = { ...TEST_CONFIG, requireMergedByOther: true };
    const mergers: Record<string, string> = { '77': 'maintainer', '12': 'aravhawk', '9': 'maintainer', '4': 'someone' };
    const { metrics, calls } = await run(
      worldHandler(makeWorld(), (url) => {
        const match = /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/pulls\/(\d+)$/.exec(url);
        return match ? { body: { merged_by: { login: mergers[match[1]] } } } : null;
      }),
      { config },
    );
    expect(calls.filter((call) => call.url.includes('/pulls/'))).toHaveLength(4);
    expect(metrics.mergedPrs.upstream).toMatchObject({ value: 3, live: true });
  });

  it('makes no per-PR lookups when REQUIRE_MERGED_BY_OTHER is off', async () => {
    const { calls } = await run(worldHandler(makeWorld()));
    expect(calls.filter((call) => call.url.includes('/pulls/'))).toHaveLength(0);
  });
});

describe('refresh script behaviour (full, force)', () => {
  it('full mode re-reads every year and both windows', async () => {
    const { calls } = await run(worldHandler(makeWorld()), { full: true });
    expect(calls.filter((call) => hostOf(call.url) === 'github.com')).toHaveLength(7);
  });

  it('--force accepts lower live values and drops a model that left the profile', async () => {
    const world = makeWorld();
    world.ollama = { alpha: '500' };
    world.npmAllTime = 100;
    world.upstream = 1;
    world.upstreamItems = [LEDGER[0]];
    const { resolved } = await run(worldHandler(world), { full: true, force: true });
    expect(resolved.snapshot.ollama.models.map((model) => [model.name, model.pulls])).toEqual([['alpha', 500]]);
    expect(resolved.snapshot.ollama.total).toBe(500);
    expect(resolved.snapshot.npm.allTime).toBe(100);
    expect(resolved.snapshot.mergedPrs.upstream).toBe(1);
    expect(resolved.snapshot.mergedPrs.ledger).toHaveLength(1);
    expect(snapshotProblems(resolved.snapshot)).toEqual([]);
  });

  it('a failed source keeps its previous section and time', async () => {
    const { resolved, snapshot } = await run(
      worldHandler(makeWorld(), (url) => (hostOf(url) === 'ollama.com' ? new Error('down') : null)),
      { full: true },
    );
    expect(resolved.snapshot.ollama).toEqual(snapshot.ollama);
    expect(resolved.status.ollama.live).toBe(false);
    expect(resolved.snapshot.npm.retrievedAt).toBe(FETCHED_AT);
  });
});
