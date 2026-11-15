import { describe, expect, it } from 'vitest';

import {
  crossCheckPulls,
  extractPulls,
  ollamaModelUrl,
  ollamaProfileUrl,
  parseOllamaDate,
  parseOllamaModelPage,
  parseOllamaProfile,
} from '@/lib/metrics/core/ollama.mjs';

import { fixture, ollamaModelHtml, ollamaProfileHtml } from './helpers';

describe('parseOllamaProfile (saved profile fixture)', () => {
  const models = parseOllamaProfile(fixture('ollama-profile.html'), 'aravhawk');

  it('finds every model link with its pull count', () => {
    expect(models.map((model) => [model.name, model.pulls])).toEqual([
      ['qwen3.5-opus-4.6', 9441],
      ['llama4', 7363],
      ['gemma4', 1283],
      ['qwen3.6', 198],
    ]);
    expect(models.reduce((sum, model) => sum + (model.pulls ?? 0), 0)).toBe(18285);
  });

  it('reads the updated date from the title attribute', () => {
    const byName = new Map(models.map((model) => [model.name, model.updatedAt]));
    expect(byName.get('llama4')).toBe('2025-04-11T02:23:00.000Z');
    expect(byName.get('qwen3.5-opus-4.6')).toBe('2026-04-01T03:58:00.000Z');
    for (const model of models) expect(model.updatedAt).not.toBeNull();
  });

  it('does not mistake the tag count for the pull count', () => {
    for (const model of models) expect(model.pulls).not.toBe(5);
  });
});

describe('parseOllamaProfile (markup variants)', () => {
  it('picks up a new model automatically', () => {
    const html = ollamaProfileHtml({ alpha: '650', beta: '410', 'brand-new': '3' });
    expect(parseOllamaProfile(html, 'aravhawk').map((model) => model.name)).toEqual(['alpha', 'beta', 'brand-new']);
  });

  it('handles abbreviated counts', () => {
    const html = ollamaProfileHtml({ big: '12.3K', bigger: '1.2M' });
    expect(parseOllamaProfile(html, 'aravhawk').map((model) => model.pulls)).toEqual([12300, 1200000]);
  });

  it('ignores links to other users and to pages that are not models', () => {
    const html = `
      <a href="/someone-else/llama4"><span>99</span><span>&nbsp;Pulls</span></a>
      <a href="/aravhawk/alpha/tags"><span>7</span><span>&nbsp;Pulls</span></a>
      <a href="/aravhawk/alpha:latest"><span>8</span><span>&nbsp;Pulls</span></a>
      <a href="/aravhawk"><span>9</span><span>&nbsp;Pulls</span></a>
      <a class="x" href="/aravhawk/alpha"><span>650</span><span>&nbsp;Pulls</span></a>`;
    expect(parseOllamaProfile(html, 'aravhawk')).toEqual([{ name: 'alpha', pulls: 650, updatedAt: null }]);
  });

  it('lists a model once even when it is linked twice', () => {
    const html = `
      <a href="/aravhawk/alpha"><img alt=""></a>
      <a href="/aravhawk/alpha"><span>650</span><span>&nbsp;Pulls</span></a>`;
    expect(parseOllamaProfile(html, 'aravhawk')).toEqual([{ name: 'alpha', pulls: 650, updatedAt: null }]);
  });

  it('still reads the count if the spans are restyled', () => {
    const html = '<a href="/aravhawk/alpha"><div><b>9,441</b> Pulls</div><div>5 Tags</div></a>';
    expect(parseOllamaProfile(html, 'aravhawk')[0].pulls).toBe(9441);
  });

  it('reports a model without a readable count as null, and no models as an empty list', () => {
    const html = '<a href="/aravhawk/alpha"><span>lots of</span><span>&nbsp;Pulls</span></a>';
    expect(parseOllamaProfile(html, 'aravhawk')).toEqual([{ name: 'alpha', pulls: null, updatedAt: null }]);
    expect(parseOllamaProfile('<html><body>Just a moment...</body></html>', 'aravhawk')).toEqual([]);
  });
});

describe('parseOllamaModelPage', () => {
  it('reads the count and date from the saved llama4 fixture', () => {
    expect(parseOllamaModelPage(fixture('ollama-model-llama4.html'))).toEqual({
      pulls: 7363,
      updatedAt: '2025-04-11T02:23:00.000Z',
    });
  });

  it('accepts "Pulls" as well as "Downloads" and abbreviated counts', () => {
    expect(parseOllamaModelPage(ollamaModelHtml('12.3K')).pulls).toBe(12300);
    expect(extractPulls('<span>1.2M</span><span>&nbsp;Pulls</span>')).toBe(1200000);
    expect(extractPulls('<span>1</span> <span> Pull</span>')).toBe(1);
  });

  it('returns nulls for a page with no stats', () => {
    expect(parseOllamaModelPage('<html><body>404</body></html>')).toEqual({ pulls: null, updatedAt: null });
  });
});

describe('crossCheckPulls (profile row against model page)', () => {
  it('agrees when both pages show the same count', () => {
    expect(crossCheckPulls(7363, 7363)).toEqual({ pulls: 7363, agrees: true, checked: true });
  });

  it('cross-checks the fixtures: profile row and model page agree for llama4', () => {
    const profile = parseOllamaProfile(fixture('ollama-profile.html'), 'aravhawk');
    const row = profile.find((model) => model.name === 'llama4');
    const page = parseOllamaModelPage(fixture('ollama-model-llama4.html'));
    expect(crossCheckPulls(row?.pulls ?? null, page.pulls)).toEqual({ pulls: 7363, agrees: true, checked: true });
  });

  it('takes the larger reading and tolerates abbreviation rounding', () => {
    expect(crossCheckPulls(12300, 12349)).toEqual({ pulls: 12349, agrees: true, checked: true });
    expect(crossCheckPulls(7363, 7370)).toEqual({ pulls: 7370, agrees: true, checked: true });
  });

  it('flags readings that are far apart', () => {
    expect(crossCheckPulls(7363, 73)).toEqual({ pulls: 7363, agrees: false, checked: true });
  });

  it('uses whichever page gave a count when the other did not', () => {
    expect(crossCheckPulls(null, 7363)).toEqual({ pulls: 7363, agrees: false, checked: false });
    expect(crossCheckPulls(7363, null)).toEqual({ pulls: 7363, agrees: false, checked: false });
    expect(crossCheckPulls(null, null)).toEqual({ pulls: null, agrees: false, checked: false });
    expect(crossCheckPulls(0, 7363).pulls).toBe(7363);
  });
});

describe('parseOllamaDate', () => {
  it.each([
    ['Apr 11, 2025 2:23 AM UTC', '2025-04-11T02:23:00.000Z'],
    ['Apr 1, 2026 3:58 AM UTC', '2026-04-01T03:58:00.000Z'],
    ['Dec 31, 2025 12:05 AM UTC', '2025-12-31T00:05:00.000Z'],
    ['Dec 31, 2025 12:05 PM UTC', '2025-12-31T12:05:00.000Z'],
    ['Jan 2, 2026 11:59 PM UTC', '2026-01-02T23:59:00.000Z'],
    ['Apr 11, 2025', '2025-04-11T00:00:00.000Z'],
  ])('reads %j', (text, iso) => {
    expect(parseOllamaDate(text)).toBe(iso);
  });

  it.each(['1 year ago', 'llama4', '', 'Feb 31, 2026 1:00 AM UTC', 'Foo 11, 2025 2:23 AM UTC', 'Apr 11, 2025 13:23 PM UTC'])(
    'rejects %j',
    (text) => {
      expect(parseOllamaDate(text)).toBeNull();
    },
  );
});

describe('urls', () => {
  it('builds the public pages', () => {
    expect(ollamaProfileUrl('aravhawk')).toBe('https://ollama.com/aravhawk');
    expect(ollamaModelUrl('aravhawk', 'qwen3.5-opus-4.6')).toBe('https://ollama.com/aravhawk/qwen3.5-opus-4.6');
  });
});
