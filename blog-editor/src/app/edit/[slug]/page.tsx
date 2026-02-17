'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PostForm from '@/components/PostForm';

interface PostData {
  slug: string;
  frontmatter: {
    title: string;
    date: string;
    description: string;
    tags: string[];
    published: boolean;
  };
  content: string;
}

export default function EditPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/posts/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Post not found');
        return res.json();
      })
      .then((data) => {
        setPost(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Post not found');
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-sm text-[#555555]">Loading...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-sm text-red-400">{error || 'Post not found'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-sans text-3xl text-[#FAFAFA] mb-2">
          Edit Post
        </h1>
        <p className="text-sm text-[#555555] font-mono">
          Editing: {post.slug}.mdx
        </p>
      </div>
      <PostForm
        mode="edit"
        initialSlug={post.slug}
        initialFrontmatter={post.frontmatter}
        initialContent={post.content}
      />
    </div>
  );
}
