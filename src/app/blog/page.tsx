import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/inner/bits';
import { openingLines } from '@/components/blog/opening';
import { InnerPage, WAY_TO_WORK, WAY_TO_WRITING } from '@/components/inner/Page';
import { getAllPosts } from '@/lib/posts';
import { formatPostDate } from '@/lib/dates';
import { pageMeta } from '@/lib/meta';

export const metadata: Metadata = pageMeta({
  title: 'Writing',
  description: 'Notes on AI agents, evaluation, security and shipping software.',
  path: '/blog',
});

export default function BlogPage() {
  const posts = getAllPosts();
  const [lead, ...rest] = posts;
  const opening = lead ? openingLines(lead.content) : null;
  return (
    <InnerPage head={{ title: WAY_TO_WRITING.title, lead: WAY_TO_WRITING.line }} next={WAY_TO_WORK}>
      <section className="sec wrap" aria-label="Posts">
        {lead ? (
          <>
            {/* The newest post is the page: its title, when it was written, what it is about and how it opens. */}
            <Link className="post-row post-lead" href={`/blog/${lead.slug}`}>
              <span className="label post-when">
                <time dateTime={lead.frontmatter.date}>{formatPostDate(lead.frontmatter.date)}</time>
                <span>{lead.readingTime}</span>
                <span>{lead.frontmatter.tags.join(', ')}</span>
              </span>
              <h2 className="post-title">{lead.frontmatter.title}</h2>
              <div className="post-about">
                <p className="post-desc">{lead.frontmatter.description}</p>
                {opening ? <p className="post-open">{opening}</p> : null}
                <span className="post-go">
                  Read it <Arrow />
                </span>
              </div>
            </Link>
            {rest.length ? (
              <ul className="posts">
                {rest.map((post) => (
                  <li key={post.slug}>
                    <Link className="post-row post-item" href={`/blog/${post.slug}`}>
                      <span className="label post-when">
                        <time dateTime={post.frontmatter.date}>{formatPostDate(post.frontmatter.date, 'short')}</time>
                        <span>{post.readingTime}</span>
                      </span>
                      <div className="post-copy">
                        <h2 className="post-title">{post.frontmatter.title}</h2>
                        <p className="post-desc">{post.frontmatter.description}</p>
                      </div>
                      <span className="index-go" aria-hidden="true">
                        <Arrow />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="empty">Nothing published yet. The first post is on its way.</p>
        )}
      </section>
    </InnerPage>
  );
}
