import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/blog';
import { postDate } from '@/lib/facts';
import { TLink } from '@/components/shell/Shell';
import Foot from '@/components/shell/Foot';

export const metadata: Metadata = {
  title: 'Writing',
  description: 'Notes from Arav Jain on coding agents, evaluation and building.',
  alternates: { canonical: '/blog' },
};

export default function BlogPage() {
  const posts = getAllPosts();
  return (
    <main id="main" className="enter">
      <header className="top">
        <div>
          <h1 className="head"><span className="ln"><span className="black">Writing</span></span></h1>
          <p className="top-meta mono"><span>{posts.length} {posts.length === 1 ? 'post' : 'posts'}</span><a href="/feed.xml">RSS</a></p>
        </div>
      </header>
      <div className="sheet" style={{ '--i': 1 } as React.CSSProperties}>
        <ul className="posts">
          {posts.map((p) => (
            <li key={p.slug}>
              <TLink className="post" href={`/blog/${p.slug}`}>
                <h2>{p.frontmatter.title}</h2>
                <div className="meta mono"><time dateTime={p.frontmatter.date}>{postDate(p.frontmatter.date, 'short')}</time><span>{p.readingTime}</span></div>
                <p>{p.frontmatter.description}</p>
              </TLink>
            </li>
          ))}
        </ul>
        {posts.length === 0 && <p className="none">Nothing published yet.</p>}
        <Foot />
      </div>
    </main>
  );
}
