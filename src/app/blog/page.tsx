import type { Metadata } from 'next';
import { Link } from '@/components/Link';
import { ViewTransition } from 'react';
import { Arrow } from '@/components/bits';
import { openingLines } from '@/components/blog/opening';
import { WAY_TO_WORK, WAY_TO_WRITING } from '@/components/NextBand';
import { SubscribeForm } from '@/components/ending/Ending';
import { PageShell } from '@/components/PageShell';
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
    <PageShell
      scene="lake"
      index
      head={{ title: WAY_TO_WRITING.title, lead: WAY_TO_WRITING.line }}
      next={WAY_TO_WORK}
    >
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
              <ViewTransition name={`post-${lead.slug}`} share="title" default="none">
                <h2 className="post-title">{lead.frontmatter.title}</h2>
              </ViewTransition>
              <div className="post-about">
                <p className="post-desc">{lead.frontmatter.description}</p>
                {opening ? <p className="post-open">{opening}</p> : null}
                <span className="post-go">
                  Read it
                  <span className="row-go" aria-hidden="true">
                    <Arrow />
                  </span>
                </span>
              </div>
            </Link>
            {rest.length ? (
              <ul className="posts posts-more">
                {rest.map((post) => (
                  <li key={post.slug}>
                    <Link className="post-row post-item" href={`/blog/${post.slug}`}>
                      <span className="label post-when">
                        <time dateTime={post.frontmatter.date}>{formatPostDate(post.frontmatter.date, 'short')}</time>
                        <span>{post.readingTime}</span>
                      </span>
                      <div className="post-copy">
                        <ViewTransition name={`post-${post.slug}`} share="title" default="none">
                          <h2 className="post-title">{post.frontmatter.title}</h2>
                        </ViewTransition>
                        <p className="post-desc">{post.frontmatter.description}</p>
                      </div>
                      <span className="row-go" aria-hidden="true">
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
      {/* After the posts, before the way on: new posts by email. (Interface only: it knows nothing of a post.) */}
      <section className="sec wrap" aria-labelledby="newsletter">
        <h2 className="sec-h" id="newsletter">
          Newsletter
        </h2>
        <SubscribeForm source="blog" label="Email address" split />
      </section>
    </PageShell>
  );
}
