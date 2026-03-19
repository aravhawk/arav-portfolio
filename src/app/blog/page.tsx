import type { Metadata } from 'next';
import { getAllPosts, getTagsFromPosts } from '@/lib/blog';
import BlogIndex from '@/components/blog/BlogIndex';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Blog - Arav Jain',
  description:
    'Thoughts on AI agents, security, engineering, and building startups.',
  openGraph: {
    title: 'Blog - Arav Jain',
    description:
      'Thoughts on AI agents, security, engineering, and building startups.',
    type: 'website',
  },
};

export default function BlogPage() {
  const posts = getAllPosts().map(({ content: _content, ...rest }) => rest);
  const tags = getTagsFromPosts(posts);

  return (
    <main className="min-h-screen bg-[#050505]">
      <div className="noise-overlay" />
      <Navigation />
      <BlogIndex posts={posts} tags={tags} />
      <Footer />
    </main>
  );
}
