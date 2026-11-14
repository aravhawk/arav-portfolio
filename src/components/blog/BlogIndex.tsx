'use client';

import { useMemo, useState } from 'react';
import { PostBig } from '@/components/home/Writing';
import type { BlogPost } from '@/types';

type Meta = Omit<BlogPost, 'content'>;

export default function BlogIndex({ posts, tags }: { posts: Meta[]; tags: string[] }) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const shown = useMemo(() => {
    let result = posts;
    if (tag) result = result.filter((p) => p.frontmatter.tags.includes(tag));
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.frontmatter.title.toLowerCase().includes(q) ||
          p.frontmatter.description.toLowerCase().includes(q) ||
          p.frontmatter.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [posts, query, tag]);

  return (
    <section className="block wrap block-tight" aria-labelledby="posts-title">
      <div className="index-bar">
        <h2 id="posts-title" className="label mono">
          Posts
        </h2>
        <p className="mono" aria-live="polite">
          {shown.length} of {posts.length} shown
        </p>
      </div>
      <div style={{ display: 'grid', gap: 16, marginBottom: 48 }}>
        <label className="sr-only" htmlFor="post-search">
          Search posts
        </label>
        <input id="post-search" className="field" type="search" placeholder="Search posts" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="chips" role="group" aria-label="Filter by tag">
          <button type="button" className="chip mono" aria-pressed={tag === null} onClick={() => setTag(null)}>
            All
          </button>
          {tags.map((t) => (
            <button type="button" key={t} className="chip mono" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {shown.map((p) => (
        <PostBig key={p.slug} post={p} />
      ))}
      {shown.length === 0 ? (
        <div className="post-big">
          <p className="post-big-desc">No posts match that search.</p>
          <div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQuery('');
                setTag(null);
              }}
            >
              Clear the filters
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
