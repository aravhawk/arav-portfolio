import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/bits';
import { PageShell } from '@/components/PageShell';
import { getAllPosts } from '@/lib/blog';
import { formatPostDate } from '@/lib/dates';
import { pageMeta } from '@/lib/meta';

export const metadata: Metadata = pageMeta({
  title: 'Writing',
  description: 'Notes on AI agents, evaluation, security and shipping software.',
  path: '/blog',
});

export default function BlogPage() {
  const posts = getAllPosts();
  return (
    <PageShell
      head={{
        label: 'Writing',
        title: 'Notes from the work',
        lead: 'What I learn building agents and the tools around them.',
      }}
    >
      <section className="block" aria-label="Posts">
        {posts.length ? (
          <ul className="posts">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link className="post-row" href={`/blog/${post.slug}`}>
                  <span className="label">
                    <time dateTime={post.frontmatter.date}>{formatPostDate(post.frontmatter.date, 'short')}</time>
                  </span>
                  <span>
                    <h2>{post.frontmatter.title}</h2>
                    <p className="body">{post.frontmatter.description}</p>
                  </span>
                  <span className="row-go" aria-hidden="true">
                    <Arrow />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing published yet. The first post is on its way.</p>
        )}
      </section>
    </PageShell>
  );
}
