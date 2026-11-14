import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { getPostBySlug, getAllPostSlugs, getAdjacentPosts } from '@/lib/blog';
import { mdxComponents } from '@/components/blog/MDXComponents';
import Footer from '@/components/shell/Footer';
import TLink from '@/components/shell/TLink';
import { Arrow } from '@/components/home/Arrow';
import type { BlogFrontmatter } from '@/types';

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post not found' };

  return {
    title: `${post.frontmatter.title}. Arav Jain`,
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
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }], [rehypePrettyCode, { theme: 'github-dark', keepBackground: true }]],
      },
    },
  });

  const { prev, next } = getAdjacentPosts(slug);
  const date = new Date(post.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <main>
      <article className="sheet" data-chapter="none" data-ground="#f2f2f2">
        <header className="article-head wrap">
          <div className="post-meta mono">
            <TLink className="link" href="/blog">
              Writing
            </TLink>
            <time dateTime={post.frontmatter.date}>{date}</time>
            <span>{post.readingTime}</span>
            <span>{post.frontmatter.tags.join(' / ')}</span>
          </div>
          <h1 className="article-title">{post.frontmatter.title}</h1>
          <p className="article-desc">{post.frontmatter.description}</p>
        </header>
        <div className="wrap">
          <div className="article-layout">
            <aside className="article-aside mono" aria-label="Post details">
              <span>Arav Jain</span>
              <time dateTime={post.frontmatter.date}>{date}</time>
              <span>{post.readingTime}</span>
              <TLink className="link" href="/blog" style={{ justifySelf: 'start' }}>
                All writing
              </TLink>
            </aside>
            <div className="article-body">
              <div className="prose">{content}</div>
            </div>
          </div>
          {prev || next ? (
            <nav className="post-nav" aria-label="More posts" style={{ marginBottom: 96 }}>
              {next ? (
                <TLink href={`/blog/${next.slug}`}>
                  <span className="mono">Newer</span>
                  <strong>{next.frontmatter.title}</strong>
                </TLink>
              ) : null}
              {prev ? (
                <TLink href={`/blog/${prev.slug}`}>
                  <span className="mono">Older</span>
                  <strong>{prev.frontmatter.title}</strong>
                </TLink>
              ) : null}
            </nav>
          ) : (
            <div className="block-foot" style={{ marginBottom: 96, marginTop: 0 }}>
              <span className="mono">End of post</span>
              <TLink className="btn" href="/blog">
                Back to all writing <Arrow />
              </TLink>
            </div>
          )}
        </div>
      </article>
      <Footer />
    </main>
  );
}
