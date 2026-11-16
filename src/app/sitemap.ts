import type { MetadataRoute } from 'next';
import { PROJECTS } from '@/content/projects';
import { getAllPosts } from '@/lib/blog';
import { abs } from '@/lib/site';

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
      url: abs('/'),
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
  ];
}
