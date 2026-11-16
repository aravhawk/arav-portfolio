import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { getPostBySlug, getAllPostSlugs, getAdjacentPosts } from '@/lib/blog';
import { mdxComponents } from '@/components/blog/MDXComponents';
import { PageShell } from '@/components/PageShell';
import { formatPostDate } from '@/lib/dates';
import type { BlogFrontmatter } from '@/types';

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post not found' };

  return {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      type: 'article',
      publishedTime: post.frontmatter.date,
      tags: post.frontmatter.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.frontmatter.title,
      description: post.frontmatter.description,
    },
  };
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

  return (
    <PageShell
      head={{
        back: { href: '/blog', label: 'Writing' },
        label: (
          <>
            <time dateTime={post.frontmatter.date}>{formatPostDate(post.frontmatter.date)}</time> / {post.readingTime}
          </>
        ),
        title: post.frontmatter.title,
        titleLong: true,
        lead: post.frontmatter.description,
      }}
    >
      <article className="article">
        <ul className="tags label" aria-label="Tags">
          {post.frontmatter.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <div className="prose block">{content}</div>
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
      </article>
    </PageShell>
  );
}
