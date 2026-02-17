import type { MDXComponents } from 'mdx/types';

export const mdxComponents: MDXComponents = {
  h1: (props) => (
    <h1
      className="font-display text-4xl md:text-5xl text-[#FAFAFA] mt-12 mb-6 leading-tight"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="font-display text-3xl md:text-4xl text-[#FAFAFA] mt-10 mb-4 leading-tight"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="font-display text-2xl text-[#FAFAFA] mt-8 mb-3"
      {...props}
    />
  ),
  h4: (props) => (
    <h4
      className="font-mono text-sm uppercase tracking-wider text-[#00F0FF] mt-6 mb-2"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="text-[#CCCCCC] text-lg leading-relaxed mb-6 font-sans"
      {...props}
    />
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
    <ol
      className="list-decimal list-inside space-y-2 mb-6 text-[#CCCCCC] marker:text-[#00F0FF]"
      {...props}
    />
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
      className="bg-[#0C0C0C] border border-[#1F1F1F] p-6 overflow-x-auto mb-6 text-sm leading-relaxed font-mono"
      {...props}
    />
  ),
  code: (props) => {
    const isInline = !props.className?.includes('language-');
    if (isInline) {
      return (
        <code
          className="bg-[#1A1A1A] text-[#00F0FF] px-1.5 py-0.5 text-sm font-mono border border-[#2A2A2A]"
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
      className="text-left p-3 bg-[#0C0C0C] border border-[#1F1F1F] font-mono text-xs uppercase tracking-wider text-[#888888]"
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
