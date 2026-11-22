import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildPrSearchQuery, prSearchWebUrl } from '@/lib/metrics/core/github-prs.mjs';
import type { FetchLike, MetricsConfig, MetricsSnapshot, PrLedgerEntry } from '@/lib/metrics/types';

export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

export const NOW = new Date('2026-11-15T12:00:00.000Z');
export const SNAPSHOT_TIME = '2026-11-09T11:00:00.000Z';

export const TEST_CONFIG: MetricsConfig = {
  contributionsWindow: 'lifetime',
  excludedOwners: ['aravhawk', 'infiniflop', '2ALabz', 'nextup-inspired', 'navkarcaterers'],
  requireMergedByOther: false,
  npmPackages: [{ name: '@aravhawk/cc-switch', firstPublished: '2026-02-01' }],
  npmProfileUrl: 'https://www.npmjs.com/~aravhawk',
  githubUser: 'aravhawk',
  githubAccountCreatedYear: 2021,
  ollamaUser: 'aravhawk',
  userAgent: 'arav.pro-metrics/1.0 (+https://arav.pro)',
  fetchTimeoutMs: 5000,
  minRatioOfSnapshot: 0.9,
  maxLedgerPages: 2,
};

export const LEDGER: PrLedgerEntry[] = [
  {
    repo: 'pingdotgg/t3code',
    number: 12,
    title: 'Fix the thing',
    mergedAt: '2026-10-02T10:00:00Z',
    url: 'https://github.com/pingdotgg/t3code/pull/12',
  },
  {
    repo: 'pingdotgg/t3code',
    number: 9,
    title: 'Add the other thing',
    mergedAt: '2026-09-01T10:00:00Z',
    url: 'https://github.com/pingdotgg/t3code/pull/9',
  },
  {
    repo: 'junhoyeo/tokscale',
    number: 4,
    title: 'Docs',
    mergedAt: '2026-08-01T10:00:00Z',
    url: 'https://github.com/junhoyeo/tokscale/pull/4',
  },
];

/** A small snapshot that does not depend on the committed one. */
export function makeSnapshot(): MetricsSnapshot {
  const query = buildPrSearchQuery({ author: 'aravhawk', excludedOwners: TEST_CONFIG.excludedOwners });
  const totalQuery = buildPrSearchQuery({ author: 'aravhawk' });
  return {
    schemaVersion: 1,
    retrievedAt: SNAPSHOT_TIME,
    ollama: {
      retrievedAt: SNAPSHOT_TIME,
      source: 'https://ollama.com/aravhawk',
      endpoints: ['https://ollama.com/aravhawk', 'https://ollama.com/aravhawk/<model>'],
      total: 1000,
      models: [
        { name: 'alpha', pulls: 600, url: 'https://ollama.com/aravhawk/alpha', uploadedAt: '2026-04-01T03:58:00.000Z' },
        { name: 'beta', pulls: 400, url: 'https://ollama.com/aravhawk/beta', uploadedAt: null },
      ],
    },
    npm: {
      retrievedAt: SNAPSHOT_TIME,
      source: 'https://www.npmjs.com/package/@aravhawk/cc-switch',
      endpoints: [
        'https://api.npmjs.org/downloads/range/<start>:<end>/<package>',
        'https://api.npmjs.org/downloads/point/last-month/<package>',
      ],
      allTime: 5000,
      lastMonth: 300,
      packages: [
        {
          name: '@aravhawk/cc-switch',
          firstPublished: '2026-02-01',
          allTime: 5000,
          lastMonth: 300,
          url: 'https://www.npmjs.com/package/@aravhawk/cc-switch',
        },
      ],
    },
    contributions: {
      retrievedAt: SNAPSHOT_TIME,
      source: 'https://github.com/aravhawk',
      endpoints: [
        'https://github.com/users/aravhawk/contributions?from=<YYYY>-01-01&to=<YYYY>-12-31',
        'https://github.com/users/aravhawk/contributions',
      ],
      lifetime: 2377,
      byYear: { '2021': 11, '2022': 16, '2023': 2, '2024': 162, '2025': 186, '2026': 2000 },
      last12Months: 2100,
    },
    mergedPrs: {
      retrievedAt: SNAPSHOT_TIME,
      source: prSearchWebUrl(query),
      totalSource: prSearchWebUrl(totalQuery),
      endpoints: ['https://api.github.com/search/issues?q=<query>&per_page=100'],
      query,
      totalQuery,
      excludedOwners: [...TEST_CONFIG.excludedOwners],
      requireMergedByOther: false,
      upstream: 3,
      total: 50,
      ledger: LEDGER.map((entry) => ({ ...entry })),
    },
  };
}

// --- Synthetic source responses -------------------------------------------

export function ollamaProfileHtml(models: Record<string, string>, user = 'aravhawk'): string {
  const rows = Object.entries(models).map(
    ([name, pulls]) => `
    <li><a href="/${user}/${name}" class="group w-full space-y-5">
      <div title="${name}"><h2><span>${name}</span></h2></div>
      <p>
        <span class="flex items-center"><span >${pulls}</span><span class="hidden sm:flex">&nbsp;Pulls</span></span>
        <span class="flex items-center"><span >5</span><span class="hidden sm:flex">&nbsp;Tags</span></span>
        <span class="flex items-center" title="Apr 11, 2025 2:23 AM UTC"><span>Updated&nbsp;</span><span >1 year ago</span></span>
      </p>
    </a></li>`,
  );
  return `<div id="repo"><ul role="list">${rows.join('')}</ul></div>`;
}

export function ollamaModelHtml(pulls: string): string {
  return `<p><span class="flex items-center"><span >${pulls}</span><span class="hidden sm:flex">&nbsp;Downloads</span></span>
  <span class="flex items-center" title="Apr 11, 2025 2:23 AM UTC"><span>Updated&nbsp;</span><span >1 year ago</span></span></p>`;
}

/** A calendar whose per-day tooltips add up to `daySum` (defaults to `total`). */
export function contributionsHtml(total: number, year: number | null, daySum = total): string {
  const period = year === null ? 'in the last year' : `in ${year}`;
  const first = Math.min(daySum, 1);
  const rest = daySum - first;
  const tips = [
    '<tool-tip for="contribution-day-component-0-0" class="sr-only">No contributions on January 1st.</tool-tip>',
    first > 0 ? '<tool-tip for="contribution-day-component-0-1" class="sr-only">1 contribution on January 8th.</tool-tip>' : '',
    rest > 0
      ? `<tool-tip for="contribution-day-component-0-2" class="sr-only">${rest.toLocaleString('en-US')} contributions on January 15th.</tool-tip>`
      : '',
  ];
  return `<div class="js-yearly-contributions">
    <h2 tabindex="-1" id="js-contribution-activity-description" class="f4 text-normal mb-2">
      ${total.toLocaleString('en-US')}
      contributions
        ${period}
    </h2>
    <table><tbody><tr>${tips.join('\n')}</tr></tbody></table></div>`;
}

export function searchItem(entry: PrLedgerEntry): Record<string, unknown> {
  return {
    repository_url: `https://api.github.com/repos/${entry.repo}`,
    html_url: entry.url,
    number: entry.number,
    title: entry.title,
    state: 'closed',
    pull_request: { merged_at: entry.mergedAt },
  };
}

// --- Mock fetch -----------------------------------------------------------

export type MockReply =
  | { status?: number; body: unknown; headers?: Record<string, string> }
  | Error
  | undefined;

export type MockCall = { url: string; init: Record<string, unknown> };

/**
 * A fetch stand-in. The handler returns a reply for a URL, an Error to throw,
 * or undefined for a 404.
 */
export function mockFetch(handler: (url: string, init: Record<string, unknown>) => MockReply) {
  const calls: MockCall[] = [];
  const fetchImpl: FetchLike = async (url, init = {}) => {
    calls.push({ url, init });
    const reply = handler(url, init);
    if (reply instanceof Error) throw reply;
    const status = reply ? (reply.status ?? 200) : 404;
    const body = reply ? reply.body : 'not found';
    const headers = new Map(Object.entries(reply?.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    };
  };
  return { fetchImpl, calls };
}

export type World = {
  ollama: Record<string, string>;
  /** Count shown on each model page; defaults to the profile value. */
  ollamaPages?: Record<string, string>;
  npmAllTime: number;
  npmLastMonth: number;
  contributions: Record<string, number>;
  last12Months: number;
  upstream: number;
  upstreamItems: PrLedgerEntry[];
  total: number;
  date?: string;
};

/** Everything a little higher than makeSnapshot(), so every value is live. */
export function makeWorld(): World {
  return {
    ollama: { alpha: '650', beta: '410' },
    npmAllTime: 5200,
    npmLastMonth: 280,
    contributions: { '2021': 11, '2022': 16, '2023': 2, '2024': 162, '2025': 186, '2026': 2050 },
    last12Months: 2150,
    upstream: 4,
    upstreamItems: [
      {
        repo: 'Kilo-Org/kilocode',
        number: 77,
        title: 'New one',
        mergedAt: '2026-11-12T10:00:00Z',
        url: 'https://github.com/Kilo-Org/kilocode/pull/77',
      },
      ...LEDGER,
    ],
    total: 52,
    date: 'Sun, 15 Nov 2026 11:59:00 GMT',
  };
}

/** Routes every source URL to a healthy reply built from `world`. */
export function worldHandler(world: World, overrides: (url: string, init: Record<string, unknown>) => MockReply | null = () => null) {
  return (url: string, init: Record<string, unknown>): MockReply => {
    const override = overrides(url, init);
    if (override !== null) return override;
    const headers = world.date ? { date: world.date } : undefined;
    const parsed = new URL(url);
    if (parsed.host === 'ollama.com') {
      const [, , model] = parsed.pathname.split('/');
      if (!model) return { body: ollamaProfileHtml(world.ollama), headers };
      const pulls = world.ollamaPages?.[model] ?? world.ollama[model];
      return pulls === undefined ? undefined : { body: ollamaModelHtml(pulls), headers };
    }
    if (parsed.host === 'api.npmjs.org') {
      if (parsed.pathname.startsWith('/downloads/point/last-month/')) {
        return { body: { downloads: world.npmLastMonth, start: '2026-10-16', end: '2026-11-14' }, headers };
      }
      const range = /^\/downloads\/range\/(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})\//.exec(parsed.pathname);
      if (!range) return undefined;
      return {
        body: { start: range[1], end: range[2], downloads: [{ day: range[1], downloads: world.npmAllTime }] },
        headers,
      };
    }
    if (parsed.host === 'github.com') {
      const from = parsed.searchParams.get('from');
      if (!from) return { body: contributionsHtml(world.last12Months, null), headers };
      const year = from.slice(0, 4);
      const count = world.contributions[year];
      return count === undefined ? undefined : { body: contributionsHtml(count, Number(year)), headers };
    }
    if (parsed.host === 'api.github.com' && parsed.pathname === '/search/issues') {
      const query = parsed.searchParams.get('q') ?? '';
      if (query.includes('-user:')) {
        return {
          body: { total_count: world.upstream, incomplete_results: false, items: world.upstreamItems.map(searchItem) },
          headers,
        };
      }
      return { body: { total_count: world.total, incomplete_results: false, items: [] }, headers };
    }
    return undefined;
  };
}
