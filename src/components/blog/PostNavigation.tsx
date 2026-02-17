'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { BlogPost } from '@/types';

type BlogPostMeta = Omit<BlogPost, 'content'>;

interface PostNavigationProps {
  prev: BlogPostMeta | null;
  next: BlogPostMeta | null;
}

export default function PostNavigation({ prev, next }: PostNavigationProps) {
  return (
    <nav className="mt-20 pt-10 border-t border-[#1F1F1F]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {prev ? (
          <Link
            href={`/blog/${prev.slug}`}
            className="group block p-6 border border-[#1F1F1F] hover:border-[#00F0FF]/30 transition-colors duration-300"
          >
            <span className="text-xs font-mono uppercase tracking-wider text-[#555555] flex items-center gap-2 mb-2">
              <ArrowLeft size={12} /> Previous
            </span>
            <span className="font-display text-lg text-[#FAFAFA] group-hover:text-[#00F0FF] transition-colors duration-300">
              {prev.frontmatter.title}
            </span>
          </Link>
        ) : (
          <div />
        )}

        {next ? (
          <Link
            href={`/blog/${next.slug}`}
            className="group block p-6 border border-[#1F1F1F] hover:border-[#00F0FF]/30 transition-colors duration-300 text-right"
          >
            <span className="text-xs font-mono uppercase tracking-wider text-[#555555] flex items-center justify-end gap-2 mb-2">
              Next <ArrowRight size={12} />
            </span>
            <span className="font-display text-lg text-[#FAFAFA] group-hover:text-[#00F0FF] transition-colors duration-300">
              {next.frontmatter.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  );
}
