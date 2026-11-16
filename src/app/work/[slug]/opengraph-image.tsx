import { PROJECTS, projectBySlug } from '@/content/projects';
import { OG_SIZE, OG_TYPE, renderOg } from '@/lib/og';

export const alt = 'A project by Arav Jain, set on pale stone beside a stream of teal water.';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  const name = p ? p.name.replace('‑', '-') : 'Work';
  return [{ id: 'card', alt: p ? `${name}: ${p.line} Set on pale stone beside a stream of teal water.` : alt, size: OG_SIZE, contentType: OG_TYPE }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) return renderOg({ kicker: 'Work', title: 'Arav Jain' });
  // The name keeps its non-breaking hyphen so it never splits across lines.
  return renderOg({ kicker: p.kicker || 'Work', title: p.name, line: p.line });
}
