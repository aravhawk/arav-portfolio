import type { MDXComponents } from 'mdx/types';

/** Post bodies are styled by `.prose` in globals.css. Only behaviour lives here. */
export const mdxComponents: MDXComponents = {
  a: (props) => {
    const href = props.href || '';
    const isSafe =
      href.startsWith('/') || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:');
    if (!isSafe) return <span>{props.children}</span>;
    const external = href.startsWith('http');
    return <a target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} {...props} href={href} />;
  },
  h4: (props) => <h4 className="mono" {...props} />,
  table: (props) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
  img: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt || ''} {...props} />
  ),
};
