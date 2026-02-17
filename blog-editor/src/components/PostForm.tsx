'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface PostFormProps {
  mode: 'create' | 'edit';
  initialSlug?: string;
  initialFrontmatter?: {
    title: string;
    date: string;
    description: string;
    tags: string[];
    published: boolean;
  };
  initialContent?: string;
}

export default function PostForm({
  mode,
  initialSlug = '',
  initialFrontmatter,
  initialContent = '',
}: PostFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState(initialFrontmatter?.title || '');
  const [slug, setSlug] = useState(initialSlug);
  const [description, setDescription] = useState(
    initialFrontmatter?.description || ''
  );
  const [tagsInput, setTagsInput] = useState(
    initialFrontmatter?.tags?.join(', ') || ''
  );
  const [published, setPublished] = useState(
    initialFrontmatter?.published ?? false
  );
  const [date, setDate] = useState(
    initialFrontmatter?.date?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10)
  );
  const [content, setContent] = useState(initialContent);

  const generateSlug = useCallback((value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (mode === 'create') {
      setSlug(generateSlug(value));
    }
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const frontmatter = {
      title,
      date: new Date(date).toISOString(),
      description,
      tags,
      published,
    };

    try {
      const url =
        mode === 'create' ? '/api/posts' : `/api/posts/${initialSlug}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: mode === 'create' ? slug : undefined,
          frontmatter,
          content,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        setSaving(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Failed to save post');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 border border-red-400/30 bg-red-400/10 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[#555555] mb-2">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Post title"
          className="w-full px-4 py-3 bg-[#0C0C0C] border border-[#2A2A2A] text-[#FAFAFA] font-sans placeholder-[#555555] focus:outline-none focus:border-[#00F0FF] transition-colors"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[#555555] mb-2">
          Slug
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="post-slug"
          disabled={mode === 'edit'}
          className="w-full px-4 py-3 bg-[#0C0C0C] border border-[#2A2A2A] text-[#FAFAFA] font-mono text-sm placeholder-[#555555] focus:outline-none focus:border-[#00F0FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider text-[#555555] mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the post"
          rows={2}
          className="w-full px-4 py-3 bg-[#0C0C0C] border border-[#2A2A2A] text-[#FAFAFA] font-sans placeholder-[#555555] focus:outline-none focus:border-[#00F0FF] transition-colors resize-none"
        />
      </div>

      {/* Row: Tags, Date, Published */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-[#555555] mb-2">
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="AI, startups, GPU"
            className="w-full px-4 py-3 bg-[#0C0C0C] border border-[#2A2A2A] text-[#FAFAFA] font-sans text-sm placeholder-[#555555] focus:outline-none focus:border-[#00F0FF] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-[#555555] mb-2">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-[#0C0C0C] border border-[#2A2A2A] text-[#FAFAFA] font-mono text-sm focus:outline-none focus:border-[#00F0FF] transition-colors"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-3 px-4 py-3 border border-[#2A2A2A] bg-[#0C0C0C] w-full cursor-pointer hover:border-[#00F0FF]/30 transition-colors">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="accent-[#00F0FF]"
            />
            <span className="text-sm font-mono text-[#888888]">
              {published ? 'Published' : 'Draft'}
            </span>
          </label>
        </div>
      </div>

      {/* Content editor */}
      <div data-color-mode="dark">
        <label className="block text-xs font-mono uppercase tracking-wider text-[#555555] mb-2">
          Content (MDX)
        </label>
        <MDEditor
          value={content}
          onChange={(val) => setContent(val || '')}
          height={500}
          preview="live"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-[#1F1F1F]">
        <button
          onClick={handleSave}
          disabled={saving || !title || !slug}
          className="px-6 py-3 text-xs font-mono uppercase tracking-wider bg-[#00F0FF] text-[#050505] hover:bg-[#00D4E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create Post' : 'Save Changes'}
        </button>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 text-xs font-mono uppercase tracking-wider border border-[#2A2A2A] text-[#888888] hover:text-[#FAFAFA] hover:border-[#3A3A3A] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
