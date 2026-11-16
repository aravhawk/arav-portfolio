'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProjectMedia } from '@/content/projects';
import { haptic } from '@/lib/haptics';

/**
 * A video on a dry slab with one control of our own. It never plays on its
 * own, it is not fetched until asked for, and it stops when it leaves the
 * view.
 */
export function VideoSlab({ media }: { media: ProjectMedia }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting) && !v.paused) v.pause();
    });
    io.observe(v);
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    v.addEventListener('play', on);
    v.addEventListener('pause', off);
    return () => {
      io.disconnect();
      v.removeEventListener('play', on);
      v.removeEventListener('pause', off);
    };
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    haptic('medium');
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  return (
    <figure className="slab slab-video" data-dry>
      <video
        ref={ref}
        className="slab-media"
        src={media.src}
        poster={media.poster}
        width={media.w}
        height={media.h}
        muted
        loop
        playsInline
        preload="none"
        aria-label={media.alt}
      />
      <button type="button" className="slab-play glass" onClick={toggle} aria-label={playing ? 'Pause the video' : 'Play the video'} aria-pressed={playing}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          {playing ? <path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /> : <path d="M3.5 1.8v10.4L12 7z" fill="currentColor" />}
        </svg>
      </button>
    </figure>
  );
}
