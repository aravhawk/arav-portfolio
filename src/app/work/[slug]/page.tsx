import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { NextProject } from '@/components/work/blocks';
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
 * its name standing in it, then a case study laid out for what the project
 * has (src/components/work/cases.tsx), then the way to the next one.
 */
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) notFound();
  const m = await getMetrics();
  const next = PROJECTS[(PROJECTS.indexOf(p) + 1) % PROJECTS.length];

  return (
    <PageShell
      scene={SCENE_OF[p.slug] ?? 'delta'}
      head={{
        back: { href: '/work', label: 'Work' },
        // (The way back already says Work: a project with no label of its own gets none.)
        label: p.kicker || undefined,
        title: p.name,
        vt: `title-${p.slug}`,
        lead: p.line,
        children: p.slug === 'cc-switch' ? <SwitchInScene /> : null,
      }}
      note={`Numbers read ${formatAsOf(m.retrievedAt)}`}
    >
      <Case p={p} m={m} />
      <NextProject next={next} />
    </PageShell>
  );
}
