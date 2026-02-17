import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import {
  getPostBySlug,
  getAllPostSlugs,
  getAdjacentPosts,
} from '@/lib/blog';
import { mdxComponents } from '@/components/blog/MDXComponents';
import PostNavigation from '@/components/blog/PostNavigation';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import CustomCursor from '@/components/ui/CustomCursor';
import Badge from '@/components/ui/Badge';
import GridBackground from '@/components/ui/GridBackground';
import type { BlogFrontmatter } from '@/types';

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.frontmatter.title} - Arav Jain`,
    description: post.frontmatter.description,
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

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

  const adjacentPosts = getAdjacentPosts(slug);
  const prev = adjacentPosts.prev
    ? { ...adjacentPosts.prev, content: '' }
    : null;
  const next = adjacentPosts.next
    ? { ...adjacentPosts.next, content: '' }
    : null;

  const currentYear = new Date().getFullYear();

  const date = new Date(post.frontmatter.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-[#050505]">
      <CustomCursor />
      <div className="noise-overlay" />
      <Navigation />

      <article className="relative pt-40 pb-20">
        <GridBackground variant="circuit" fade="both" intensity="dim" />

        <div className="max-w-3xl mx-auto px-6 lg:px-12">
          {/* Post header */}
          <header className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#888888]">
                {date}
              </span>
              <span className="text-[#333333]">/</span>
              <span className="text-xs font-mono text-[#555555]">
                {post.readingTime}
              </span>
            </div>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-[#FAFAFA] mb-6 leading-[1.1]">
              {post.frontmatter.title}
            </h1>

            <p className="text-lg md:text-xl text-[#888888] max-w-2xl leading-relaxed mb-8">
              {post.frontmatter.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {post.frontmatter.tags.map((tag) => (
                <Badge key={tag} variant="cyan">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="hr-glow" />
          </header>

          {/* MDX content */}
          <div className="prose-brutalist">{content}</div>

          {/* Post navigation */}
          <PostNavigation prev={prev} next={next} />
        </div>
      </article>

      <Footer currentYear={currentYear} />
    </main>
  );
}
