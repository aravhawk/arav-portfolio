import { Feed } from 'feed';
import { getAllPosts } from '@/lib/blog';
import { SITE_URL } from '@/lib/site';

// The feed changes only when a post does: it is built once, with the site.
export const dynamic = 'force-static';

export async function GET() {
  const posts = getAllPosts();

  const feed = new Feed({
    title: 'Arav Jain: Writing',
    description: 'Notes on AI agents, evaluation, security and shipping software.',
    id: SITE_URL,
    link: `${SITE_URL}/blog`,
    // (`rss` is the key the library reads for the feed's own address.)
    feedLinks: { rss: `${SITE_URL}/feed.xml` },
    language: 'en',
    copyright: `All rights reserved ${new Date().getFullYear()}, Arav Jain`,
    author: {
      name: 'Arav Jain',
      link: SITE_URL,
    },
  });

  posts.forEach((post) => {
    feed.addItem({
      title: post.frontmatter.title,
      id: `${SITE_URL}/blog/${post.slug}`,
      link: `${SITE_URL}/blog/${post.slug}`,
      description: post.frontmatter.description,
      date: new Date(post.frontmatter.date),
      category: post.frontmatter.tags.map((t) => ({ name: t })),
    });
  });

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
