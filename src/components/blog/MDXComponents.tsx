import type { MDXComponents } from 'mdx/types';

const safe = (href: string) => href.startsWith('/') || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:');

/* Styling lives in .prose (globals.css). Only links need behaviour. */
export const mdxComponents: MDXComponents = {
  a: (props) => {
    const href = props.href || '';
    if (!safe(href)) return <span>{props.children}</span>;
    const ext = href.startsWith('http');
    return <a {...props} href={href} target={ext ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined} />;
  },
  // eslint-disable-next-line @next/next/no-img-element
  img: (props) => <img loading="lazy" decoding="async" {...props} alt={props.alt ?? ''} />,
};
