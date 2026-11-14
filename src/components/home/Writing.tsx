import type { BlogPost } from '@/types';
import TLink from '@/components/shell/TLink';
import { Arrow } from './Arrow';

type Meta = Omit<BlogPost, 'content'>;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function PostBig({ post }: { post: Meta }) {
  return (
    <article className="post-big" data-cursor="Read">
      <div className="post-meta mono">
        <time dateTime={post.frontmatter.date}>{formatDate(post.frontmatter.date)}</time>
        <span>{post.readingTime}</span>
        <span>{post.frontmatter.tags.join(' / ')}</span>
      </div>
      <h3 className="post-big-title">
        <TLink href={`/blog/${post.slug}`}>{post.frontmatter.title}</TLink>
      </h3>
      <p className="post-big-desc">{post.frontmatter.description}</p>
    </article>
  );
}

export default function Writing({ posts }: { posts: Meta[] }) {
  return (
    <section className="block g-paper" data-chapter="writing" data-ground="#f2f2f2" aria-labelledby="writing-title" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="block-head">
          <h2 id="writing-title" className="block-title behind">
            Writing
          </h2>
        </div>
        <div className="block-sheet">
          <p className="block-lead">Notes from running agents until they break, and what the wreckage says.</p>
          {posts.slice(0, 3).map((p) => (
            <PostBig key={p.slug} post={p} />
          ))}
          <div className="block-foot">
            <a className="mono link tap" href="/feed.xml">
              RSS feed
            </a>
            <TLink className="btn" href="/blog">
              Read the blog <Arrow />
            </TLink>
          </div>
        </div>
      </div>
    </section>
  );
}
