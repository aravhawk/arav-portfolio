import { PROJECTS, type Project } from '@/content/projects';
import { abs } from '@/lib/site';
import { PERSON_ID, WEBSITE_ID } from '@/lib/site-ld';

/**
 * Structured data for the work pages, in the shape of the home page's (src/lib/site-ld.ts): the entries refer to the
 * person and the site by the same `@id`s, and say only what the pages say (a name, a line, an address). `/work` is
 * the heaviest page's HTML (docs/site-system/performance.md, "An inner page's HTML fits a new connection's first
 * round"): its entry is kept to what it must say, and was measured at 320 bytes gzipped.
 */
const PERSON = { '@id': PERSON_ID };
const WEBSITE = { '@id': WEBSITE_ID };

/** The name as the page says it (the non-breaking hyphen in a name is set for the eye, not for a reader of data). */
const nameOf = (p: Project) => p.name.replace('‑', '-');

const workId = (slug: string) => `${abs(`/work/${slug}`)}#work`;

/** The index names each project's own entry (on its own page) by `@id`: the list costs the page ten short references. */
export const workLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${abs('/work')}#page`,
  url: abs('/work'),
  name: 'Work',
  isPartOf: WEBSITE,
  hasPart: PROJECTS.map((p) => ({ '@id': workId(p.slug) })),
});

export const projectLd = (p: Project) => ({
  '@context': 'https://schema.org',
  '@type': 'CreativeWork',
  '@id': workId(p.slug),
  url: abs(`/work/${p.slug}`),
  name: nameOf(p),
  description: p.line,
  isPartOf: { '@id': `${abs('/work')}#page` },
  author: PERSON,
});
