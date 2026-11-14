'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { clamp, story } from '@/lib/story';
import { chapters } from '@/lib/content';

/** Chapter index and page progress, bottom left. Decoration for sighted users; hidden from the tree. */
export default function Hud() {
  const root = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const last = useRef('');

  useFrame(() => {
    const max = document.documentElement.scrollHeight - story.vh;
    if (bar.current) bar.current.style.transform = `scaleX(${clamp(story.scrollY / Math.max(1, max)).toFixed(4)})`;
    if (story.chapter !== last.current) {
      last.current = story.chapter;
      const i = chapters.findIndex((c) => c.id === story.chapter);
      if (text.current && i >= 0) text.current.textContent = `${String(i + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}  ${chapters[i].label}`;
      // only the open 3D chapters carry it; the hero, the lists and the close have their own footers
      if (root.current) root.current.dataset.show = i > 0 && i < 5 ? 'true' : 'false';
    }
  });

  return (
    <div ref={root} className="hud mono" data-show="false" aria-hidden="true">
      <span ref={text} style={{ whiteSpace: 'pre' }} />
      <span className="hud-track">
        <span ref={bar} className="hud-bar" />
      </span>
    </div>
  );
}
