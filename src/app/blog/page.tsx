import type { Metadata } from 'next';
import { getAllPosts, getTagsFromPosts } from '@/lib/blog';
import BlogIndex from '@/components/blog/BlogIndex';
import SceneSetter from '@/components/SceneSetter';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Notes on AI agents, agent evaluation, security and shipping software.',
  alternates: { canonical: '/blog' },
  openGraph: { title: 'Blog · Arav Jain', description: 'Notes on AI agents, agent evaluation, security and shipping software.', type: 'website' },
};

export default function BlogPage() {
  const posts = getAllPosts().map(({ content: _content, ...rest }) => rest);
  const tags = getTagsFromPosts(posts);

  return (
    <>
      <SceneSetter name="blog" />
      <div className="page">
        <header className="page-head layer-type" style={{ pointerEvents: 'auto', userSelect: 'auto' }}>
          <h1 className="word page-title" style={{ '--w': 2.6 } as React.CSSProperties}>
            <span className="line">
              <span data-refract>Blog</span>
            </span>
          </h1>
          <p className="page-lede">Notes on agents, evaluation, security and shipping.</p>
        </header>
        <div className="layer-ui" style={{ display: 'grid', gap: 24 }}>
          <BlogIndex posts={posts} tags={tags} />
        </div>
      </div>
      <Footer />
    </>
  );
}
