import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type { BlogFrontmatter } from '@/types';
import type { Post, PostSource } from './types';

/** The owner's posts: MDX files with front matter. This folder is his; the site only reads it. */
const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');

function read(filePath: string, slug: string): Post {
  const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'));
  return { slug, frontmatter: data as BlogFrontmatter, readingTime: readingTime(content).text, content };
}

/** Posts read from the files in `content/posts`. */
export const mdxFiles: PostSource = {
  all() {
    if (!fs.existsSync(POSTS_DIR)) return [];
    return fs
      .readdirSync(POSTS_DIR)
      .filter((f) => f.endsWith('.mdx'))
      .map((filename) => read(path.join(POSTS_DIR, filename), filename.replace(/\.mdx$/, '')))
      .filter((p) => p.frontmatter.published)
      .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
  },
  get(slug) {
    const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
    if (!fs.existsSync(filePath)) return null;
    const post = read(filePath, slug);
    return post.frontmatter.published ? post : null;
  },
};
