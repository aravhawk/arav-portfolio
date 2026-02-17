import type { Metadata } from 'next';
import { getAllPosts, getAllTags } from '@/lib/blog';
import BlogIndex from '@/components/blog/BlogIndex';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import CustomCursor from '@/components/ui/CustomCursor';

export const metadata: Metadata = {
  title: 'Blog - Arav Jain',
  description:
    'Thoughts on AI, GPU computing, blockchain, and building startups.',
  openGraph: {
    title: 'Blog - Arav Jain',
    description:
      'Thoughts on AI, GPU computing, blockchain, and building startups.',
    type: 'website',
  },
};

export default function BlogPage() {
  const posts = getAllPosts().map(({ content: _content, ...rest }) => rest);
  const tags = getAllTags();
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#050505]">
      <CustomCursor />
      <div className="noise-overlay" />
      <Navigation />
      <BlogIndex posts={posts} tags={tags} />
      <Footer currentYear={currentYear} />
    </main>
  );
}
