import Link from 'next/link';
import Glass from '@/components/Glass';
import type { BlogPost } from '@/types';

type Meta = Pick<BlogPost, 'slug' | 'frontmatter'>;

export default function PostNavigation({ prev, next }: { prev: Meta | null; next: Meta | null }) {
  if (!prev && !next) return null;
  return (
    <nav className="post-nav" aria-label="More posts">
      {prev ? (
        <Glass as="div" radius={20}>
          <Link href={`/blog/${prev.slug}`}>
            <span className="mono">Older</span>
            <b>{prev.frontmatter.title}</b>
          </Link>
        </Glass>
      ) : (
        <span />
      )}
      {next ? (
        <Glass as="div" radius={20}>
          <Link href={`/blog/${next.slug}`}>
            <span className="mono">Newer</span>
            <b>{next.frontmatter.title}</b>
          </Link>
        </Glass>
      ) : null}
    </nav>
  );
}
