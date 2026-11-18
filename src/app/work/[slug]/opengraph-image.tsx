import { PROJECTS, projectBySlug } from '@/content/projects';
import { OG_SIZE, OG_TYPE, PICTURES, type Picture, ogAlt, renderOg } from '@/lib/og';
import { KIND } from '@/content/kinds';

export const alt = ogAlt('A project by Arav Jain', 'work');
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** Each project's card stands on its own station of the home page; one without a station takes the delta. */
const pictureFor = (slug: string): Picture => (slug in PICTURES && slug !== 'home' && slug !== 'blog' ? (slug as Picture) : 'work');

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  const name = p ? p.name.replace('‑', '-') : 'Work';
  return [{ id: 'card', alt: p ? ogAlt(`${name}: ${p.line}`, pictureFor(slug)) : alt, size: OG_SIZE, contentType: OG_TYPE }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) return renderOg({ kicker: 'Work', title: 'Arav Jain', picture: 'work' });
  // The name keeps its non-breaking hyphen so it never splits across lines.
  return renderOg({ kicker: KIND[p.slug] ?? 'Work', title: p.name, line: p.line, picture: pictureFor(slug) });
}
