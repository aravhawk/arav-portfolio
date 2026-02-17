'use client';

import { Search } from 'lucide-react';

interface BlogSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function BlogSearch({ value, onChange }: BlogSearchProps) {
  return (
    <div className="relative max-w-md">
      <Search
        size={16}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555555]"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search posts..."
        className="w-full pl-11 pr-4 py-3 bg-[#0C0C0C] border border-[#2A2A2A] text-[#FAFAFA] font-sans text-sm placeholder-[#555555] focus:outline-none focus:border-[#00F0FF] transition-colors duration-300"
      />
    </div>
  );
}
