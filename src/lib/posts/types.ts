import type { BlogPost } from '@/types';

/**
 * A post as the site's pages see it: where it lives (`slug`), what it says
 * about itself (`frontmatter`: title, the date it was published, its
 * description and tags), how long it takes to read, and its body as MDX.
 * Nothing here says where a post is stored.
 */
export type Post = BlogPost;

/**
 * Where posts come from. The blog's pages, the feed, the sitemap and the
 * share images read posts only through this. Today the one source reads the
 * MDX files in `content/posts`; a CMS or a backend would be another object
 * of this shape, switched in `./index.ts`, with no change to any page.
 */
export interface PostSource {
  /** Every published post, newest first. */
  all(): Post[];
  /** One published post, or null. */
  get(slug: string): Post | null;
}
