import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { getPostBySlug, getAllPostSlugs, getAdjacentPosts } from '@/lib/blog';
import { mdxComponents } from '@/components/blog/MDXComponents';
import { postDate } from '@/lib/facts';
import { TLink } from '@/components/shell/Shell';
import Foot from '@/components/shell/Foot';
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
    openGraph: { title: post.frontmatter.title, description: post.frontmatter.description, type: 'article', publishedTime: post.frontmatter.date, tags: post.frontmatter.tags },
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
    options: { mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }], [rehypePrettyCode, { theme: 'github-dark', keepBackground: true }]] } },
  });
  const { prev, next } = getAdjacentPosts(slug);

  return (
    <main id="main" className="enter">
      <header className="article-top">
        <TLink className="back mono" href="/blog"><span aria-hidden="true">&larr;</span> Writing</TLink>
        <h1>{post.frontmatter.title}</h1>
        <p className="desc">{post.frontmatter.description}</p>
        <p className="tags mono"><time dateTime={post.frontmatter.date}>{postDate(post.frontmatter.date)}</time><span>{post.readingTime}</span>{post.frontmatter.tags.map((t) => <span key={t}>{t}</span>)}</p>
      </header>
      <div className="sheet" style={{ '--i': 1 } as React.CSSProperties}>
        <article className="prose">{content}</article>
        {(prev || next) && (
          <nav className="pn" aria-label="More posts">
            {prev ? <TLink href={`/blog/${prev.slug}`}><span className="mono">Older</span><span>{prev.frontmatter.title}</span></TLink> : <span />}
            {next ? <TLink href={`/blog/${next.slug}`}><span className="mono">Newer</span><span>{next.frontmatter.title}</span></TLink> : <span />}
          </nav>
        )}
        <Foot />
      </div>
    </main>
  );
}
