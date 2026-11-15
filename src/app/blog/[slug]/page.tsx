import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ViewTransition } from 'react';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { getPostBySlug, getAllPostSlugs, getAdjacentPosts } from '@/lib/blog';
import { mdxComponents } from '@/components/blog/MDXComponents';
import PostNavigation from '@/components/blog/PostNavigation';
import SceneSetter from '@/components/SceneSetter';
import Footer from '@/components/Footer';
import Glass from '@/components/Glass';
import { ArrowLeft } from '@/components/Icons';
import { formatPostDate } from '@/lib/date';
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
    twitter: { card: 'summary_large_image', title: post.frontmatter.title, description: post.frontmatter.description },
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
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }], [rehypePrettyCode, { theme: 'github-dark', keepBackground: true }]],
      },
    },
  });

  const adjacent = getAdjacentPosts(slug);

  return (
    <>
      <SceneSetter name="post" />
      <div className="page">
        <article className="article layer-ui">
          <header className="article-head">
            <Link className="back" href="/blog">
              <ArrowLeft />
              Blog
            </Link>
            <div className="post-meta mono" style={{ color: 'var(--fg-dim)' }}>
              <time dateTime={post.frontmatter.date}>{formatPostDate(post.frontmatter.date)}</time>
              <span aria-hidden="true">/</span>
              <span>{post.readingTime}</span>
            </div>
            <ViewTransition name={`post-${slug}`} share="title" default="none">
              <h1 className="article-title">{post.frontmatter.title}</h1>
            </ViewTransition>
            <p className="article-desc">{post.frontmatter.description}</p>
            <ul className="chips">
              {post.frontmatter.tags.map((tag) => (
                <li className="chip" key={tag} style={{ color: 'var(--fg)', boxShadow: 'inset 0 0 0 1px var(--line)', background: 'transparent' }}>
                  {tag}
                </li>
              ))}
            </ul>
          </header>
          <Glass className="article-body" refract>
            <div className="prose">{content}</div>
          </Glass>
          <PostNavigation prev={adjacent.prev ? { slug: adjacent.prev.slug, frontmatter: adjacent.prev.frontmatter } : null} next={adjacent.next ? { slug: adjacent.next.slug, frontmatter: adjacent.next.frontmatter } : null} />
        </article>
      </div>
      <Footer />
    </>
  );
}
