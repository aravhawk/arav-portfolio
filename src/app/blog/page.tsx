import type { Metadata } from 'next';
import { getAllPosts, getTagsFromPosts } from '@/lib/blog';
import BlogIndex from '@/components/blog/BlogIndex';
import PageHead from '@/components/shell/PageHead';
import Footer from '@/components/shell/Footer';

const description = 'Notes on AI agents, evaluation and the tools around them, by Arav Jain.';

export const metadata: Metadata = {
  title: 'Writing. Arav Jain',
  description,
  alternates: { canonical: '/blog' },
  openGraph: { title: 'Writing. Arav Jain', description, type: 'website', url: 'https://aravjain.dev/blog' },
};

export default function BlogPage() {
  const posts = getAllPosts().map(({ content: _content, ...rest }) => rest);
  const tags = getTagsFromPosts(posts);

  return (
    <main>
      <PageHead pose="blog" title="Writing" lead="Experiments with coding agents, written up with the numbers." meta={`${posts.length} ${posts.length === 1 ? 'post' : 'posts'} / RSS at /feed.xml`} />
      <div className="sheet" data-chapter="sheet" data-ground="#f2f2f2" data-sheet>
        <BlogIndex posts={posts} tags={tags} />
      </div>
      <Footer />
    </main>
  );
}
