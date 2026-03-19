'use client';

import Link from 'next/link';

export default function BlogPostError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center px-6">
      <div className="text-center">
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-red-400 mb-4 block">
          Error
        </span>
        <h1 className="font-display text-5xl md:text-6xl text-[#FAFAFA] mb-4">
          Something Went Wrong
        </h1>
        <p className="text-[#888888] mb-8 max-w-md mx-auto">
          There was an error loading this blog post.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="px-6 py-3 text-xs font-mono uppercase tracking-wider border border-[#2A2A2A] text-[#888888] hover:text-[#FAFAFA] hover:border-[#3A3A3A] transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/blog"
            className="px-6 py-3 text-xs font-mono uppercase tracking-wider text-[#050505] bg-[#00F0FF] hover:bg-[#00D4E0] transition-colors"
          >
            Back to Blog
          </Link>
        </div>
      </div>
    </main>
  );
}
