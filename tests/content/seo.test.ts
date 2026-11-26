import { describe, expect, it } from 'vitest';

import { PROJECTS } from '@/content/projects';
import { pageMeta } from '@/lib/meta';
import { SITE_URL } from '@/lib/site';
import { projectLd, workLd } from '@/lib/work-ld';

describe('structured data for the work pages', () => {
  it('lists every project by the @id its own page gives it', () => {
    const parts = workLd().hasPart.map((x) => x['@id']);
    expect(parts).toEqual(PROJECTS.map((p) => projectLd(p)['@id']));
    expect(new Set(parts).size).toBe(PROJECTS.length);
  });

  it('points each project back at the work page, and every address is on this site', () => {
    const page = workLd()['@id'];
    for (const p of PROJECTS) {
      const ld = projectLd(p);
      expect(ld.isPartOf['@id']).toBe(page);
      expect(ld.url.startsWith(`${SITE_URL}/work/`)).toBe(true);
      expect(ld.name).not.toMatch(/‑/);
    }
  });

  it('carries no email address and no award', () => {
    const all = JSON.stringify([workLd(), ...PROJECTS.map(projectLd)]);
    expect(all).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(all).not.toMatch(/award|honou?r|scholarship/i);
  });
});

describe('share titles', () => {
  it('carry the site name, as the tab does, while the tab keeps the layout template', () => {
    const m = pageMeta({ title: 'Work', description: 'd', path: '/work' });
    expect(m.title).toBe('Work');
    expect(m.openGraph?.title).toBe('Work · Arav Jain');
    expect((m.twitter as { title?: string }).title).toBe('Work · Arav Jain');
  });

  it('let a post stand under its own title', () => {
    const m = pageMeta({ title: 'A post', shareTitle: 'A post', description: 'd', path: '/blog/a' });
    expect(m.openGraph?.title).toBe('A post');
  });
});

describe('the one address', () => {
  it('is arav.pro, with no trailing slash, and the sitemap, robots and feed use that form', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const { default: robots } = await import('@/app/robots');
    expect(SITE_URL).toBe('https://arav.pro');
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/feed.xml`);
    for (const u of urls) {
      expect(u.startsWith('https://arav.pro')).toBe(true);
      expect(u.endsWith('/')).toBe(false);
    }
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(robots().host).toBe(SITE_URL);
  });

  it('is the only address in the site\'s code: the old domain appears once, as a host that redirects', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css|mjs)$/.test(name) && /aravjain\.dev/.test(readFileSync(path, 'utf8'))) hits.push(path);
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(hits.map((h) => h.slice(process.cwd().length + 1))).toEqual(['src/lib/site.ts']);
  });
});

describe('the Veritas recognition line', () => {
  it('says the same facts on the home page (the tighter line) and on /work (the fuller one)', async () => {
    const { RECOGNITION } = await import('@/content/projects');
    const work = `${RECOGNITION.veritas.award}. ${RECOGNITION.veritas.result}`;
    for (const line of [RECOGNITION.veritas.home, work]) {
      expect(line).toContain('Honorable Mention');
      expect(line).toContain('Veritas AI International High School Hackathon 2026');
      expect(line).toContain('OxyDrop');
      expect(line).toContain('Roughly');
      expect(line).toMatch(/top 20 of (more than 1,000|1,000\+) entries/);
      expect(line).toContain('$1,500 Veritas AI program scholarship');
      expect(line).not.toMatch(/—|cash|funding|prize/i);
      expect(line).not.toMatch(/\.$/);
    }
    expect(RECOGNITION.veritas.home.length).toBeLessThan(work.length);
  });
});
