import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { getPost } from '@/lib/posts';
import type { MDXComponents } from 'mdx/types';

// Replicated MDX components matching the main site's Brutalist Tech Noir theme
// Keep in sync with: arav-portfolio/src/components/blog/MDXComponents.tsx
const mdxComponents: MDXComponents = {
  h1: (props) => (
    <h1
      className="text-4xl md:text-5xl text-[#FAFAFA] mt-12 mb-6 leading-tight"
      style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="text-3xl md:text-4xl text-[#FAFAFA] mt-10 mb-4 leading-tight"
      style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="text-2xl text-[#FAFAFA] mt-8 mb-3"
      style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
      {...props}
    />
  ),
  h4: (props) => (
    <h4
      className="text-sm uppercase tracking-wider text-[#00F0FF] mt-6 mb-2"
      style={{ fontFamily: "var(--font-mono)" }}
      {...props}
    />
  ),
  p: (props) => (
    <p className="text-[#CCCCCC] text-lg leading-relaxed mb-6" {...props} />
  ),
  strong: (props) => (
    <strong className="text-[#FAFAFA] font-semibold" {...props} />
  ),
  em: (props) => <em className="text-[#CCCCCC] italic" {...props} />,
  a: (props) => (
    <a
      className="text-[#00F0FF] hover:text-[#00D4E0] underline underline-offset-4 decoration-[#00F0FF]/30 hover:decoration-[#00F0FF] transition-colors duration-300"
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      {...props}
    />
  ),
  ul: (props) => (
    <ul className="list-none space-y-2 mb-6 pl-0" {...props} />
  ),
  ol: (props) => (
    <ol className="list-decimal list-inside space-y-2 mb-6 text-[#CCCCCC]" {...props} />
  ),
  li: (props) => (
    <li
      className="text-[#CCCCCC] text-lg leading-relaxed pl-6 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-2 before:h-px before:bg-[#00F0FF]"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="border-l-2 border-[#00F0FF] pl-6 my-8 italic text-[#888888]"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="bg-[#0C0C0C] border border-[#1F1F1F] p-6 overflow-x-auto mb-6 text-sm leading-relaxed"
      style={{ fontFamily: "var(--font-mono)" }}
      {...props}
    />
  ),
  code: (props) => {
    const isInline = !props.className?.includes('language-');
    if (isInline) {
      return (
        <code
          className="bg-[#1A1A1A] text-[#00F0FF] px-1.5 py-0.5 text-sm border border-[#2A2A2A]"
          style={{ fontFamily: "var(--font-mono)" }}
          {...props}
        />
      );
    }
    return <code {...props} />;
  },
  hr: () => <hr className="hr-glow my-12 border-none" />,
  table: (props) => (
    <div className="overflow-x-auto mb-6">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="text-left p-3 bg-[#0C0C0C] border border-[#1F1F1F] text-xs uppercase tracking-wider text-[#888888]"
      {...props}
    />
  ),
  td: (props) => (
    <td className="p-3 border border-[#1F1F1F] text-[#CCCCCC]" {...props} />
  ),
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="w-full border border-[#1F1F1F] my-8"
      alt={props.alt || ''}
      {...props}
    />
  ),
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const { content } = await compileMDX({
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

  const date = new Date(post.frontmatter.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* Preview banner */}
      <div className="mb-8 px-4 py-3 border border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800] text-xs font-mono uppercase tracking-wider flex items-center justify-between">
        <span>Preview Mode - {post.frontmatter.published ? 'Published' : 'Draft'}</span>
        <a
          href={`/edit/${slug}`}
          className="text-[#00F0FF] hover:text-[#00D4E0] transition-colors"
        >
          Edit Post
        </a>
      </div>

      {/* Post preview matching main site layout */}
      <article className="max-w-3xl mx-auto">
        <header className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span
              className="text-xs uppercase tracking-[0.2em] text-[#888888]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {date}
            </span>
            <span className="text-[#333333]">/</span>
            <span
              className="text-xs text-[#555555]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {post.readingTime}
            </span>
          </div>

          <h1
            className="text-5xl md:text-6xl lg:text-7xl text-[#FAFAFA] mb-6 leading-[1.1]"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            {post.frontmatter.title}
          </h1>

          <p className="text-lg md:text-xl text-[#888888] max-w-2xl leading-relaxed mb-8">
            {post.frontmatter.description}
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            {post.frontmatter.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-mono uppercase tracking-wider px-3 py-1 border text-[#00F0FF] border-[#00F0FF]/20 bg-[#00F0FF]/10"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="hr-glow" />
        </header>

        <div>{content}</div>
      </article>
    </div>
  );
}
