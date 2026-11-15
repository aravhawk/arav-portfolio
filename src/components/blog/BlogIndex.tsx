'use client';

import Link from 'next/link';
import { ViewTransition, useMemo, useState } from 'react';
import Glass from '@/components/Glass';
import { ArrowRight, Search } from '@/components/Icons';
import { formatPostDate } from '@/lib/date';
import type { BlogPost } from '@/types';

type BlogPostMeta = Omit<BlogPost, 'content'>;

export default function BlogIndex({ posts, tags }: { posts: BlogPostMeta[]; tags: string[] }) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (!tag || p.frontmatter.tags.includes(tag)) &&
        (!s || p.frontmatter.title.toLowerCase().includes(s) || p.frontmatter.description.toLowerCase().includes(s) || p.frontmatter.tags.some((t) => t.toLowerCase().includes(s))),
    );
  }, [posts, q, tag]);

  return (
    <>
      <div className="tools">
        <Glass as="label" className="search" radius={999}>
          <Search />
          <span className="sr-only">Search posts</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" autoComplete="off" spellCheck={false} />
        </Glass>
        <div className="filters" role="group" aria-label="Filter by tag">
          <button type="button" className="filter" aria-pressed={tag === null} onClick={() => setTag(null)}>
            All
          </button>
          {tags.map((t) => (
            <button type="button" key={t} className="filter" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length ? (
        <ul className="posts">
          {filtered.map((p) => (
            <li key={p.slug}>
              <Glass as="article" className="post-card" refract>
                <div className="post-meta mono">
                  <time dateTime={p.frontmatter.date}>{formatPostDate(p.frontmatter.date, 'short')}</time>
                  <span aria-hidden="true">/</span>
                  <span>{p.readingTime}</span>
                </div>
                <ViewTransition name={`post-${p.slug}`} share="title" default="none">
                  <h2>{p.frontmatter.title}</h2>
                </ViewTransition>
                <p>{p.frontmatter.description}</p>
                <ul className="chips">
                  {p.frontmatter.tags.map((t) => (
                    <li className="chip" key={t}>
                      {t}
                    </li>
                  ))}
                </ul>
                <Link className="cover" href={`/blog/${p.slug}`} aria-label={`Read: ${p.frontmatter.title}`} />
              </Glass>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty" role="status">
          <p>{posts.length ? 'No posts match that search.' : 'Nothing published yet.'}</p>
          {posts.length ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQ('');
                setTag(null);
              }}
            >
              Clear filters
              <ArrowRight />
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
