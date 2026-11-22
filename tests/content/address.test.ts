import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { mdxComponents } from '@/components/blog/MDXComponents';
import { CONTACT } from '@/content/projects';

/**
 * The site carries no email address (the owner's decision, 21 November 2026:
 * an address in a page is harvested, and X, LinkedIn and GitHub are enough).
 * Not as a link, not as text, not in structured data, the feed or a script.
 * These fail if one comes back into anything the site is built from.
 * `scripts/address-search.mjs` makes the same search of the built output and
 * of every served route.
 *
 * Nothing here spells an address or the mail scheme whole, so this file
 * passes its own search.
 */

const ROOT = join(__dirname, '..', '..');
const AT = String.fromCharCode(64);
/** His own address, and any address at a mail host or at one of his domains. */
const HIS = ['arav', 'hawk', AT, 'g', 'mail', '.com'].join('');
const ANY = new RegExp(`[A-Za-z0-9._%+-]+${AT}(?:g(?:oogle)?mail|outlook|hotmail|live|icloud|me|proton(?:mail)?|pm|yahoo|hey|fastmail|arav|aravjain|infiniflop|infiniview)\\.[a-z]{2,}`, 'i');
/** The scheme that opens a mail program. */
const SCHEME = new RegExp(['mail', 'to', ':'].join(''), 'i');

/** Every tracked text file of what the site is built from or says about itself. (`blog-editor/` is the owner's own tool, built apart from the site, and `docs/redesign-v4/` is the record of the earlier builds: neither ships.) */
const files = execFileSync('git', ['ls-files', '-z', 'src', 'public', 'content', 'scripts', 'tests', 'docs/site-system', 'package.json', 'next.config.ts', 'AGENTS.md'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter((f) => f && !/\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp4|webm|mov|mp3|wav|bin|ktx2?|glb|pdf)$/i.test(f));

describe('no email address anywhere in the site', () => {
  it('the contact has no address, and its links are X, LinkedIn, GitHub and the resume', () => {
    expect(Object.keys(CONTACT)).toEqual(['x', 'linkedin', 'github', 'resume']);
    for (const href of Object.values(CONTACT)) {
      expect(href).toMatch(/^https:\/\//);
      expect(href).not.toContain(AT);
    }
  });

  it('a post cannot carry a mail link: its link component sets one as plain words', () => {
    // (The markdown library turns a bare address into such a link by itself; this is what stops it reaching a page.)
    const link = mdxComponents.a as (props: { href?: string; children?: string }) => { type: unknown; props: Record<string, unknown> };
    const made = link({ href: ['mail', 'to', ':', 'someone', AT, 'example.com'].join(''), children: 'write to me' });
    expect(made.type).toBe('span');
    expect(made.props.href).toBeUndefined();
    expect(link({ href: 'https://example.com', children: 'a page' }).type).toBe('a');
  });

  it('there are files to search', () => {
    expect(files.length).toBeGreaterThan(150);
    expect(files).toContain('src/content/projects.ts');
    expect(files).toContain('src/components/ending/Ending.tsx');
  });

  it('no source, content, public file, script, test or maintainer note holds an address or a mail link', () => {
    const found: string[] = [];
    for (const f of files) {
      const text = readFileSync(join(ROOT, f), 'utf8');
      if (text.includes(HIS)) found.push(`${f}: his address`);
      const any = text.match(ANY);
      if (any) found.push(`${f}: an address at ${any[0].split(AT)[1]}`);
      if (SCHEME.test(text)) found.push(`${f}: the mail scheme`);
    }
    expect(found).toEqual([]);
  });
});
