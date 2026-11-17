import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { WorkStrip } from '@/components/work/blocks';
import { Case, SwitchInScene } from '@/components/work/cases';
import { SCENE_OF } from '@/components/work/stations';
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
 * A project's page: its own station from the home page's world, live, with
 * its name standing in it, then a page built from what the project is
 * (src/components/work/cases.tsx), then the way round the set.
 */
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) notFound();
  const m = await getMetrics();

  return (
    <PageShell
      scene={SCENE_OF[p.slug] ?? 'delta'}
      head={{
        // (The way back says where the page belongs. Nothing else stands over a project's name.)
        back: { href: '/work', label: 'Work' },
        title: p.name,
        vt: `title-${p.slug}`,
        lead: p.line,
        children: p.slug === 'cc-switch' ? <SwitchInScene /> : null,
      }}
      note={`Numbers read ${formatAsOf(m.retrievedAt)}`}
    >
      <Case p={p} m={m} />
      <WorkStrip current={p} />
    </PageShell>
  );
}
