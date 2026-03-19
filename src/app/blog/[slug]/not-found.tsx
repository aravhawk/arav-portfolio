import Link from 'next/link';

export default function PostNotFound() {
  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center px-6">
      <div className="text-center">
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#00F0FF] mb-4 block">
          404
        </span>
        <h1 className="font-display text-5xl md:text-6xl text-[#FAFAFA] mb-4">
          Post Not Found
        </h1>
        <p className="text-[#888888] mb-8 max-w-md mx-auto">
          This blog post doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 px-6 py-3 text-xs font-mono uppercase tracking-wider text-[#050505] bg-[#00F0FF] hover:bg-[#00D4E0] transition-colors duration-300"
        >
          Back to Blog
        </Link>
      </div>
    </main>
  );
}
