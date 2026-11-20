import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InnerPage } from '@/components/inner/Page';
import { stillOf } from '@/components/inner/stills';
import { Ways, nextOf } from '@/components/work/blocks';
import { Case, ProfilePick } from '@/components/work/cases';
import { PROJECTS, projectBySlug } from '@/content/projects';
import { pageMeta } from '@/lib/meta';
import { formatAsOf, getMetrics } from '@/lib/metrics';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) return { title: 'Not found' };
  const name = p.name.replace('‑', '-');
  return pageMeta({ title: name, description: p.line, path: `/work/${p.slug}`, type: 'article' });
}

/**
 * A project's page: its name and its one line (over a still of its station
 * where that scene is built, see inner/stills.ts), then a page built from
 * what the project is (src/components/work/cases.tsx), then the ways out,
 * the way round the set, and the next project.
 */
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) notFound();
  const m = await getMetrics();
  const next = nextOf(p);

  return (
    <InnerPage
      head={{
        back: { href: '/work', label: 'Work' },
        title: p.name,
        lead: p.line,
        still: stillOf(p.slug),
        children: p.slug === 'cc-switch' ? <ProfilePick /> : null,
      }}
      note={`Numbers read ${formatAsOf(m.retrievedAt)}`}
      next={{ href: `/work/${next.slug}`, label: 'Next', title: next.name, line: next.line, aria: 'Next project' }}
    >
      <Case p={p} m={m} />
      <Ways current={p} />
    </InnerPage>
  );
}
