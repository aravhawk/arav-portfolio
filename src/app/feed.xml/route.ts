import { Feed } from 'feed';
import { getAllPosts } from '@/lib/blog';

const SITE_URL = 'https://aravjain.dev';

export async function GET() {
  const posts = getAllPosts();

  const feed = new Feed({
    title: 'Arav Jain - Blog',
    description:
      'Thoughts on AI, GPU computing, blockchain, and building startups.',
    id: SITE_URL,
    link: `${SITE_URL}/blog`,
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
