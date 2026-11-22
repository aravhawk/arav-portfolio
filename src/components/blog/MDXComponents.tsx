import type { MDXComponents } from 'mdx/types';

/**
 * Post bodies are styled by the `.prose` scope in pages.css, so the MDX map
 * only needs the two elements that carry behaviour: links and images.
 */
export const mdxComponents: MDXComponents = {
  a: (props) => {
    const href = props.href || '';
    // (A page of this site, a place in this page, or another site. Nothing else is a link here: no address to write to.)
    const isSafe = href.startsWith('/') || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://');
    if (!isSafe) return <span>{props.children}</span>;
    const external = href.startsWith('http');
    return <a target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} {...props} href={href} />;
  },
  table: (props) => (
    <div className="table-scroll">
      <table {...props} />
    </div>
  ),
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img loading="lazy" decoding="async" alt={props.alt || ''} {...props} />
  ),
};
