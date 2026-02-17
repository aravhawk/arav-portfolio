'use client';

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import Section from '@/components/layout/Section';
import GridBackground from '@/components/ui/GridBackground';
import BlogPostCard from './BlogPostCard';
import BlogSearch from './BlogSearch';
import BlogTagFilter from './BlogTagFilter';
import {
  staggerContainer,
  fadeInUp,
  viewportSettings,
} from '@/lib/animations';
import type { BlogPost } from '@/types';

type BlogPostMeta = Omit<BlogPost, 'content'>;

interface BlogIndexProps {
  posts: BlogPostMeta[];
  tags: string[];
}

export default function BlogIndex({ posts, tags }: BlogIndexProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    let result = posts;

    if (activeTag) {
      result = result.filter((p) => p.frontmatter.tags.includes(activeTag));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.frontmatter.title.toLowerCase().includes(q) ||
          p.frontmatter.description.toLowerCase().includes(q) ||
          p.frontmatter.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [posts, searchQuery, activeTag]);

  return (
    <div className="relative pt-32">
      <GridBackground variant="circuit" fade="both" intensity="dim" />

      <Section
        label="Blog"
        title="Thoughts & Writing"
        subtitle="On AI, GPU computing, blockchain, and building startups."
      >
        {/* Search + Filter */}
        <div className="mb-12 space-y-6">
          <BlogSearch value={searchQuery} onChange={setSearchQuery} />
          <BlogTagFilter
            tags={tags}
            activeTag={activeTag}
            onTagChange={setActiveTag}
          />
        </div>

        {/* Post grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {filteredPosts.map((post) => (
            <motion.div key={post.slug} variants={fadeInUp}>
              <BlogPostCard post={post} />
            </motion.div>
          ))}
        </motion.div>

        {/* Empty state */}
        {filteredPosts.length === 0 && (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            className="text-center py-20"
          >
            <p className="font-mono text-sm uppercase tracking-wider text-[#555555]">
              No posts found
            </p>
          </motion.div>
        )}
      </Section>
    </div>
  );
}
