import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SiteMetrics } from '@/lib/metrics/types';

import {
  contributionsHtml,
  mockFetch,
  ollamaModelHtml,
  ollamaProfileHtml,
  searchItem,
  type MockCall,
  type MockReply,
} from './helpers';

type Entry = typeof import('@/lib/metrics');

/** Load a fresh copy of the Next-facing entry with global fetch replaced. */
async function load(handler: (url: string) => MockReply): Promise<{ entry: Entry; calls: MockCall[] }> {
  vi.resetModules();
  const { fetchImpl, calls } = mockFetch(handler);
  vi.stubGlobal('fetch', (url: string, init?: Record<string, unknown>) => fetchImpl(String(url), init));
  const entry = await import('@/lib/metrics');
  return { entry, calls };
}

/** A healthy world where every source reports a little more than `base`. */
function growingWorld(base: SiteMetrics) {
  return (url: string): MockReply => {
    const parsed = new URL(url);
    if (parsed.host === 'ollama.com') {
      const model = decodeURIComponent(parsed.pathname.split('/')[2] ?? '');
      const pulls = Object.fromEntries(base.ollama.models.map((entry) => [entry.name, String(entry.pulls + 10)]));
      if (!model) return { body: ollamaProfileHtml(pulls) };
      return pulls[model] ? { body: ollamaModelHtml(pulls[model]) } : undefined;
    }
    if (parsed.host === 'api.npmjs.org') {
      if (parsed.pathname.includes('/point/')) return { body: { downloads: base.npm.lastMonth.value + 1 } };
      const range = /\/range\/(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})\//.exec(parsed.pathname);
      if (!range) return undefined;
      const perWindow = base.npm.allTime.value + 100;
      return { body: { start: range[1], end: range[2], downloads: [{ day: range[1], downloads: perWindow }] } };
    }
    if (parsed.host === 'github.com') {
      const from = parsed.searchParams.get('from');
      if (!from) return { body: contributionsHtml(5, null) };
      const asked = from.slice(0, 4);
      return { body: contributionsHtml((base.contributions.byYear[asked] ?? 0) + 7, Number(asked)) };
    }
    if (parsed.host === 'api.github.com') {
      const upstream = (parsed.searchParams.get('q') ?? '').includes('-user:');
      return {
        body: upstream
          ? {
              total_count: base.mergedPrs.ledger.length,
              incomplete_results: false,
              items: base.mergedPrs.ledger.map(searchItem),
            }
          : { total_count: base.mergedPrs.total.value + 2, incomplete_results: false, items: [] },
      };
    }
    return undefined;
  };
}

describe('@/lib/metrics (Next-facing entry)', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  it('getSnapshotMetrics returns the committed snapshot without touching the network', async () => {
    const { entry, calls } = await load(() => new Error('offline'));
    const metrics = entry.getSnapshotMetrics();
    expect(calls).toHaveLength(0);
    for (const metric of [
      metrics.ollama.total,
      metrics.npm.allTime,
      metrics.npm.lastMonth,
      metrics.contributions.total,
      metrics.mergedPrs.upstream,
      metrics.mergedPrs.total,
    ]) {
      expect(Number.isInteger(metric.value) && metric.value > 0).toBe(true);
      expect(metric.value).toBe(metric.snapshotValue);
      expect(metric.live).toBe(false);
      expect(Number.isFinite(Date.parse(metric.asOf))).toBe(true);
      expect(metric.source).toMatch(/^https:\/\//);
    }
    expect(metrics.contributions.window).toBe('lifetime');
    expect(metrics.contributions.label).toBe('lifetime contributions on GitHub');
    expect(metrics.mergedPrs.upstreamRepoCount).toBe(metrics.mergedPrs.byRepo.length);
    const counts = metrics.mergedPrs.byRepo.map((repo) => repo.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(metrics.mergedPrs.ledger.length);
  });

  it('getMetrics never throws and silently equals the snapshot when every source is down', async () => {
    const { entry } = await load(() => new Error('offline'));
    const metrics = await entry.getMetrics();
    expect({ ...metrics, retrievedAt: '' }).toEqual({ ...entry.getSnapshotMetrics(), retrievedAt: '' });
  });

  it('logs each problem once on the server, not on every call', async () => {
    const { entry } = await load(() => new Error('offline'));
    await entry.getMetrics();
    const first = warn.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[metrics\] /);
    await entry.getMetrics();
    await entry.getMetrics();
    expect(warn.mock.calls.length).toBe(first);
  });

  it('getMetrics shows live values, fetched with the hourly Next cache settings', async () => {
    const base = (await load(() => undefined)).entry.getSnapshotMetrics();
    const { entry, calls } = await load(growingWorld(base));
    const metrics = await entry.getMetrics();

    expect(metrics.ollama.total).toMatchObject({
      value: base.ollama.total.value + 10 * base.ollama.models.length,
      snapshotValue: base.ollama.total.value,
      live: true,
    });
    expect(metrics.npm.allTime).toMatchObject({ value: base.npm.allTime.value + 100, live: true });
    expect(metrics.npm.lastMonth).toMatchObject({ value: base.npm.lastMonth.value + 1, live: true });
    expect(metrics.contributions.total.value).toBeGreaterThan(base.contributions.total.value);
    expect(metrics.contributions.total.live).toBe(true);
    expect(metrics.mergedPrs.upstream).toMatchObject({ value: base.mergedPrs.upstream.value, live: true });
    expect(metrics.mergedPrs.total).toMatchObject({ value: base.mergedPrs.total.value + 2, live: true });
    expect(metrics.mergedPrs.ledger).toEqual(base.mergedPrs.ledger);
    expect(warn).not.toHaveBeenCalled();

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.init.next).toEqual({ revalidate: 3600, tags: ['metrics'] });
      expect((call.init.headers as Record<string, string>)['User-Agent']).toBe(
        'arav.pro-metrics/1.0 (+https://arav.pro)',
      );
      expect((call.init.headers as Record<string, string>).Authorization).toBeUndefined();
    }
    expect(calls.filter((call) => new URL(call.url).host === 'api.github.com').length).toBeLessThanOrEqual(3);
  });

  it('a source that fails later falls back to the last good live value, not a lower one', async () => {
    const base = (await load(() => undefined)).entry.getSnapshotMetrics();
    let online = true;
    const healthy = growingWorld(base);
    const { entry } = await load((url) => (online ? healthy(url) : new Error('offline')));

    const first = await entry.getMetrics();
    expect(first.npm.allTime).toMatchObject({ value: base.npm.allTime.value + 100, live: true });

    online = false;
    // (A reading is held for the hour: the next one is an hour later.)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + (entry.METRICS_REVALIDATE_SECONDS + 1) * 1000));
    const second = await entry.getMetrics();
    vi.useRealTimers();
    expect(second.npm.allTime).toMatchObject({
      value: base.npm.allTime.value + 100,
      snapshotValue: base.npm.allTime.value,
      live: false,
      asOf: first.npm.allTime.asOf,
    });
    expect(second.ollama.total.value).toBe(first.ollama.total.value);
    expect(second.contributions.total.value).toBe(first.contributions.total.value);
    expect(second.mergedPrs.total.value).toBe(first.mergedPrs.total.value);
    expect(second.ollama.total.live).toBe(false);
  });

  it('holds one reading for the hour, so every page rendered in it shows the same figures', async () => {
    const base = (await load(() => undefined)).entry.getSnapshotMetrics();
    let bump = 0;
    const healthy = growingWorld(base);
    const { entry, calls } = await load((url) => {
      const reply = healthy(url);
      // (The sources tick on between two pages' renders.)
      if (reply && new URL(url).host === 'api.npmjs.org' && url.includes('/point/')) return { body: { downloads: base.npm.lastMonth.value + 1 + bump } };
      return reply;
    });
    const first = await entry.getMetrics();
    const asked = calls.length;
    bump = 7;
    const second = await entry.getMetrics();
    expect(calls.length).toBe(asked);
    expect(second.npm.lastMonth.value).toBe(first.npm.lastMonth.value);
    expect(second.retrievedAt).toBe(first.retrievedAt);
    // An hour on, the sources are asked again.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + (entry.METRICS_REVALIDATE_SECONDS + 1) * 1000));
    const third = await entry.getMetrics();
    vi.useRealTimers();
    expect(calls.length).toBeGreaterThan(asked);
    expect(third.npm.lastMonth.value).toBe(first.npm.lastMonth.value + 7);
  });

  it('uses GITHUB_TOKEN when it exists, and only for the GitHub API', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
    const base = (await load(() => undefined)).entry.getSnapshotMetrics();
    const { entry, calls } = await load(growingWorld(base));
    await entry.getMetrics();
    const withAuth = calls.filter((call) => (call.init.headers as Record<string, string>).Authorization);
    expect(withAuth.length).toBeGreaterThan(0);
    for (const call of withAuth) {
      expect(new URL(call.url).host).toBe('api.github.com');
      expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    }
  });

  it('formatAsOf renders Central Time', async () => {
    const { entry } = await load(() => undefined);
    expect(entry.formatAsOf('2026-11-15T10:40:00.000Z')).toBe('Nov 15, 2026, 4:40 AM CT');
    expect(entry.formatAsOf('2026-07-04T17:05:00.000Z')).toBe('Jul 4, 2026, 12:05 PM CT');
    expect(entry.formatAsOf('2026-01-01T05:59:00.000Z')).toBe('Dec 31, 2025, 11:59 PM CT');
    expect(entry.formatAsOf('not a date')).toBe('');
    expect(entry.formatCount(18284)).toBe('18,284');
  });
});
