'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Eye, Trash2, Clock } from 'lucide-react';

interface PostMeta {
  slug: string;
  frontmatter: {
    title: string;
    date: string;
    description: string;
    tags: string[];
    published: boolean;
  };
  readingTime: string;
}

export default function PostList() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    const res = await fetch('/api/posts');
    const data = await res.json();
    setPosts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleDelete = async (slug: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/posts/${slug}`, { method: 'DELETE' });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.slug !== slug));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-sm text-[#555555]">Loading posts...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-sm text-[#555555] mb-4">
          No posts yet
        </p>
        <Link
          href="/new"
          className="text-xs font-mono uppercase tracking-wider px-4 py-2 bg-[#00F0FF] text-[#050505] hover:bg-[#00D4E0] transition-colors"
        >
          Create your first post
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_100px_100px_120px_140px] gap-4 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[#555555] border-b border-[#1F1F1F]">
        <span>Title</span>
        <span>Status</span>
        <span>Date</span>
        <span className="flex items-center gap-1">
          <Clock size={10} /> Read time
        </span>
        <span className="text-right">Actions</span>
      </div>

      {/* Posts */}
      {posts.map((post) => {
        const date = new Date(post.frontmatter.date).toLocaleDateString(
          'en-US',
          { month: 'short', day: 'numeric', year: 'numeric' }
        );

        return (
          <div
            key={post.slug}
            className="grid grid-cols-[1fr_100px_100px_120px_140px] gap-4 px-4 py-4 items-center border border-[#1F1F1F] bg-[#0C0C0C] hover:border-[#2A2A2A] transition-colors"
          >
            {/* Title + tags */}
            <div>
              <p className="text-[#FAFAFA] font-sans mb-1">
                {post.frontmatter.title}
              </p>
              <div className="flex flex-wrap gap-1">
                {post.frontmatter.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono uppercase tracking-wider text-[#555555] bg-[#1A1A1A] px-2 py-0.5 border border-[#2A2A2A]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <span
                className={`text-xs font-mono uppercase tracking-wider px-2 py-1 border ${
                  post.frontmatter.published
                    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                    : 'text-[#FFB800] border-[#FFB800]/20 bg-[#FFB800]/10'
                }`}
              >
                {post.frontmatter.published ? 'Published' : 'Draft'}
              </span>
            </div>

            {/* Date */}
            <span className="text-xs font-mono text-[#555555]">{date}</span>

            {/* Reading time */}
            <span className="text-xs font-mono text-[#555555]">
              {post.readingTime}
            </span>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <Link
                href={`/edit/${post.slug}`}
                className="p-2 border border-[#2A2A2A] text-[#888888] hover:text-[#00F0FF] hover:border-[#00F0FF]/30 transition-colors"
                title="Edit"
              >
                <Pencil size={14} />
              </Link>
              <Link
                href={`/preview/${post.slug}`}
                className="p-2 border border-[#2A2A2A] text-[#888888] hover:text-[#00F0FF] hover:border-[#00F0FF]/30 transition-colors"
                title="Preview"
              >
                <Eye size={14} />
              </Link>
              <button
                onClick={() =>
                  handleDelete(post.slug, post.frontmatter.title)
                }
                className="p-2 border border-[#2A2A2A] text-[#888888] hover:text-red-400 hover:border-red-400/30 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
