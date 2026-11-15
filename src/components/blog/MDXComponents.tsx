import type { MDXComponents } from 'mdx/types';

/** Styling lives in `.prose` (globals.css). Only behaviour is defined here. */
export const mdxComponents: MDXComponents = {
  a: (props) => {
    const href = props.href || '';
    const isSafe = href.startsWith('/') || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:');
    if (!isSafe) return <span>{props.children}</span>;
    const external = href.startsWith('http');
    return <a target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} {...props} href={href} />;
  },
  table: (props) => (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Table">
      <table {...props} />
    </div>
  ),
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt || ''} loading="lazy" decoding="async" {...props} />
  ),
};
