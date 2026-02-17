'use client';

import Badge from '@/components/ui/Badge';

interface BlogTagFilterProps {
  tags: string[];
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
}

export default function BlogTagFilter({
  tags,
  activeTag,
  onTagChange,
}: BlogTagFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => onTagChange(null)}>
        <Badge variant={activeTag === null ? 'cyan' : 'default'}>All</Badge>
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onTagChange(activeTag === tag ? null : tag)}
        >
          <Badge variant={activeTag === tag ? 'cyan' : 'default'}>{tag}</Badge>
        </button>
      ))}
    </div>
  );
}
