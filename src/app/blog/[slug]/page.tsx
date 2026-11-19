import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { getPostBySlug, getAllPostSlugs, getAdjacentPosts } from '@/lib/posts';
import { postContents } from '@/components/blog/contents';
import { mdxComponents } from '@/components/blog/MDXComponents';
import { WAY_TO_WRITING } from '@/components/NextBand';
import { PageShell } from '@/components/PageShell';
import { formatPostDate } from '@/lib/dates';
import { pageMeta } from '@/lib/meta';
import { SITE_NAME, SITE_URL, abs } from '@/lib/site';
import type { BlogFrontmatter } from '@/types';

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post not found' };

  return pageMeta({
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    path: `/blog/${slug}`,
    type: 'article',
    publishedTime: post.frontmatter.date,
    tags: post.frontmatter.tags,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { content } = await compileMDX<BlogFrontmatter>({
    source: post.content,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }],
          [rehypePrettyCode, { theme: 'github-dark', keepBackground: true }],
        ],
      },
    },
  });

  const { prev, next } = getAdjacentPosts(slug);
  const contents = postContents(post.content);
  const contentsList = (
    <ol>
      {contents.map((h) => (
        <li key={h.id}>
          <a href={`#${h.id}`}>{h.text}</a>
        </li>
      ))}
    </ol>
  );

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.frontmatter.title,
    description: post.frontmatter.description,
    datePublished: post.frontmatter.date,
    url: abs(`/blog/${slug}`),
    mainEntityOfPage: abs(`/blog/${slug}`),
    keywords: post.frontmatter.tags.join(', '),
    author: { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: SITE_NAME, url: SITE_URL },
    publisher: { '@id': `${SITE_URL}/#person` },
  };

  return (
    <PageShell
      scene="lake"
      short
      head={{
        back: { href: '/blog', label: 'Writing' },
        label: (
          <>
            {/* The date the post was published (not the date of the work it describes). */}
            Published <time dateTime={post.frontmatter.date}>{formatPostDate(post.frontmatter.date)}</time> / {post.readingTime}
          </>
        ),
        title: post.frontmatter.title,
        vt: `post-${slug}`,
        titleLong: true,
      }}
      next={WAY_TO_WRITING}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <article className="article wrap">
        {/* The margin: when it was written, what it is filed under, and its own headings. It stays beside the
            text while the post is read; on a narrow screen it is folded above the text. */}
        <aside className="article-rail" aria-label="About this post">
          <p className="rail-when">
            <time dateTime={post.frontmatter.date}>{formatPostDate(post.frontmatter.date)}</time>
            <span>{post.readingTime}</span>
          </p>
          <ul className="tags" aria-label="Tags">
            {post.frontmatter.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
          {contents.length ? (
            <>
              <nav className="toc toc-wide" aria-label="Contents">
                <p className="toc-h">Contents</p>
                {contentsList}
              </nav>
              <details className="toc toc-fold">
                <summary>Contents</summary>
                {contentsList}
              </details>
            </>
          ) : null}
        </aside>
        <div className="article-main">
          <p className="article-lead">{post.frontmatter.description}</p>
          <div className="prose">{content}</div>
          {prev || next ? (
            <nav className="post-nav" aria-label="More posts">
              {prev ? (
                <Link href={`/blog/${prev.slug}`}>
                  <span className="label">Older</span>
                  <strong>{prev.frontmatter.title}</strong>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link href={`/blog/${next.slug}`}>
                  <span className="label">Newer</span>
                  <strong>{next.frontmatter.title}</strong>
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </article>
    </PageShell>
  );
}
