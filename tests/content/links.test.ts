import { describe, expect, it } from 'vitest';

import { KIND } from '@/content/kinds';
import { CONTACT, PROJECTS, RECOGNITION, TOOLS, projectBySlug } from '@/content/projects';

/**
 * The links a project shows are part of what the owner has approved
 * (docs/site-system/copy.md). A link that is missing is better than one
 * that is guessed: these fail when a placeholder or an unknown address
 * stands in for a real one.
 */
describe('project links', () => {
  const all = [
    ...PROJECTS.flatMap((p) => p.links.map((l) => ({ where: p.slug, ...l }))),
    ...TOOLS.flatMap((t) => t.links.map((l) => ({ where: t.slug, ...l }))),
    { where: 'recognition', label: 'press', href: RECOGNITION.press.href },
    ...Object.entries(CONTACT)
      .filter(([key]) => key !== 'email')
      .map(([key, href]) => ({ where: 'contact', label: key, href })),
  ];

  it('every link is a whole https address with a label, never a placeholder', () => {
    for (const link of all) {
      expect(link.label.trim(), `${link.where}: a link without a label`).not.toBe('');
      const url = new URL(link.href);
      expect(url.protocol, `${link.where}: ${link.href}`).toBe('https:');
      expect(url.hostname, `${link.where}: ${link.href}`).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      expect(link.href, `${link.where}: ${link.href}`).not.toMatch(/example\.|localhost|todo|placeholder|#$/i);
    }
  });

  it('Infiniview links its site, its docs and the company, as at f993068', () => {
    expect(projectBySlug('infiniview')?.links).toEqual([
      { label: 'infiniview.dev', href: 'https://infiniview.dev' },
      { label: 'Docs', href: 'https://docs.infiniview.dev' },
      { label: 'Infiniflop Labs', href: 'https://infiniflop.com' },
    ]);
    // The company's address is on Infiniview's page and nowhere new.
    const others = PROJECTS.filter((p) => p.slug !== 'infiniview').flatMap((p) => p.links);
    expect(others.some((l) => /infiniflop\.com/.test(l.href))).toBe(false);
  });

  it('RydAR ships without a store link: no public App Store address is known', () => {
    const rydar = projectBySlug('rydar');
    expect(rydar?.links).toEqual([
      { label: 'rydar.org', href: 'https://rydar.org' },
      { label: 'Source', href: 'https://github.com/aravhawk/RydAR' },
    ]);
    for (const p of PROJECTS) {
      for (const link of p.links) {
        expect(`${link.label} ${link.href}`, p.slug).not.toMatch(/app ?store|apps\.apple\.com|itunes|testflight/i);
      }
    }
  });
});

/**
 * The other tools on /work (docs/site-system/copy.md): each is one of his
 * own public repositories, said in one plain line, and none is on the
 * owner's never or hold lists.
 */
describe('other tools', () => {
  const NEVER = /alphapredict|trading|macro-guru|tempify|askrosie|wordle|github\.io|belweave|3400z|99719t|investo|merlin|clarifai|fix-it-bot|gofoundr|thrasher|oxydrop|agentsocket|project-net|openhark|agent-island/i;

  it('each links its own repository first, and a release only of that repository', () => {
    for (const t of TOOLS) {
      const [source, ...rest] = t.links;
      expect(source.label, t.slug).toBe('Source');
      expect(source.href, t.slug).toMatch(/^https:\/\/github\.com\/aravhawk\/[A-Za-z0-9._-]+$/);
      for (const l of rest) expect(l.href, t.slug).toBe(`${source.href}/releases/tag/${l.label}`);
      expect(`${t.slug} ${t.name} ${source.href}`, t.slug).not.toMatch(NEVER);
    }
  });

  it('each has a kind, a line without dashes or praise, and is not one of the nine', () => {
    for (const t of TOOLS) {
      expect(KIND[t.slug], t.slug).toBeTruthy();
      expect(t.line, t.slug).not.toMatch(/[\u2013\u2014]/);
      expect(t.line, t.slug).not.toMatch(/\b(powerful|seamless|blazing|beautiful|best|revolution|supercharge)/i);
      expect(t.line.endsWith('.'), t.slug).toBe(true);
      expect(PROJECTS.some((p) => p.slug === t.slug), t.slug).toBe(false);
    }
  });
});
