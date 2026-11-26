import type { MetadataRoute } from 'next';
import { PROJECTS } from '@/content/projects';
import { getAllPosts } from '@/lib/posts';
import { SITE_URL, abs } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: abs(`/blog/${post.slug}`),
    lastModified: new Date(post.frontmatter.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    {
      // The home page's address is the canonical one (no slash), so the sitemap, the canonical link and og:url agree.
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: abs('/blog'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: abs('/work'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...PROJECTS.map((p) => ({
      url: abs(`/work/${p.slug}`),
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...blogEntries,
    {
      url: abs('/feed.xml'),
      lastModified: posts.length ? new Date(Math.max(...posts.map((post) => new Date(post.frontmatter.date).getTime()))) : undefined,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ];
}
