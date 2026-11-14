import { getAllPosts } from '@/lib/blog';
import Hero from '@/components/home/Hero';
import Statement from '@/components/home/Statement';
import Now from '@/components/home/Now';
import Rules from '@/components/home/Rules';
import Timeline from '@/components/home/Timeline';
import Work from '@/components/home/Work';
import Writing from '@/components/home/Writing';
import Contact from '@/components/home/Contact';
import Hud from '@/components/home/Hud';

export default function Home() {
  const posts = getAllPosts().map(({ content: _content, ...rest }) => rest);
  return (
    <main>
      <Hero />
      <Statement />
      <Now />
      <Rules />
      <Timeline />
      <Work />
      <Writing posts={posts} />
      <Contact />
      <Hud />
    </main>
  );
}
