import { getAllPostSlugs, getPostBySlug } from '@/lib/blog';
import { formatPostDate } from '@/lib/dates';
import { OG_SIZE, OG_TYPE, renderOg } from '@/lib/og';

export const alt = 'A post by Arav Jain, set on pale stone beside a stream of teal water.';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  return [{ id: 'card', alt: post ? `${post.frontmatter.title}, a post by Arav Jain. Set on pale stone beside a stream of teal water.` : alt, size: OG_SIZE, contentType: OG_TYPE }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return renderOg({ kicker: 'Writing', title: 'Arav Jain' });
  return renderOg({
    kicker: `Writing / ${formatPostDate(post.frontmatter.date, 'short')}`,
    title: post.frontmatter.title,
  });
}
