/**
 * The blog's posts, for every page that shows them.
 *
 * This is the seam between the blog's UI and where its content comes from
 * (see docs/site-system/blog.md). Pages import from here and nowhere else:
 * nothing under src/app or src/components reads the file system, parses
 * front matter or names the content folder. To take posts from somewhere
 * else, write another `PostSource` and set it as `source` below.
 */
import { mdxFiles } from './mdx-files';
import type { Post, PostSource } from './types';

export type { Post, PostSource } from './types';

const source: PostSource = mdxFiles;

/** Every published post, newest first. */
export function getAllPosts(): Post[] {
  return source.all();
}

/** One published post, or null. */
export function getPostBySlug(slug: string): Post | null {
  return source.get(slug);
}

export function getAllPostSlugs(): string[] {
  return source.all().map((p) => p.slug);
}

export function getTagsFromPosts(posts: Pick<Post, 'frontmatter'>[]): string[] {
  const tags = new Set<string>();
  posts.forEach((p) => p.frontmatter.tags.forEach((t) => tags.add(t)));
  return Array.from(tags).sort();
}

export function getAllTags(): string[] {
  return getTagsFromPosts(source.all());
}

/** The posts either side of one: `prev` is the older, `next` the newer. */
export function getAdjacentPosts(slug: string): { prev: Post | null; next: Post | null } {
  const posts = source.all();
  const index = posts.findIndex((p) => p.slug === slug);
  return {
    prev: index >= 0 && index < posts.length - 1 ? posts[index + 1] : null,
    next: index > 0 ? posts[index - 1] : null,
  };
}
