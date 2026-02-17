'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight, Clock } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { cardHover } from '@/lib/animations';
import type { BlogPost } from '@/types';

type BlogPostMeta = Omit<BlogPost, 'content'>;

export default function BlogPostCard({ post }: { post: BlogPostMeta }) {
  const date = new Date(post.frontmatter.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.div variants={cardHover} initial="rest" whileHover="hover">
      <Link href={`/blog/${post.slug}`} className="group block">
        <div className="relative border border-[#1F1F1F] bg-[#0C0C0C] p-8 transition-colors duration-500 hover:border-[#00F0FF]/30 overflow-hidden h-full">
          {/* Hover gradient */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background:
                'linear-gradient(135deg, rgba(0, 240, 255, 0.03) 0%, transparent 50%)',
            }}
          />

          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-0 h-0 border-t-2 border-l-2 border-[#00F0FF] opacity-0 group-hover:opacity-100 group-hover:w-6 group-hover:h-6 transition-all duration-300" />
          <div className="absolute bottom-0 right-0 w-0 h-0 border-b-2 border-r-2 border-[#00F0FF] opacity-0 group-hover:opacity-100 group-hover:w-6 group-hover:h-6 transition-all duration-300" />

          {/* Metadata row */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-mono text-[#555555]">{date}</span>
            <span className="text-[#333333]">/</span>
            <span className="text-xs font-mono text-[#555555] flex items-center gap-1">
              <Clock size={10} />
              {post.readingTime}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-display text-2xl md:text-3xl text-[#FAFAFA] group-hover:text-[#00F0FF] transition-colors duration-300 mb-3 flex items-start gap-2">
            <span>{post.frontmatter.title}</span>
            <ArrowUpRight
              size={18}
              className="text-[#555555] group-hover:text-[#00F0FF] transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 flex-shrink-0 mt-2"
            />
          </h3>

          {/* Description */}
          <p className="text-[#888888] leading-relaxed mb-6 line-clamp-2">
            {post.frontmatter.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {post.frontmatter.tags.map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
