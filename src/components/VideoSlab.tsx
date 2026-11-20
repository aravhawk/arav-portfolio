'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProjectMedia } from '@/content/projects';
import { haptic } from '@/lib/haptics';

/**
 * A video on a dry slab with one control of our own. It never plays on its
 * own, the film is not fetched until asked for, and it stops when it
 * leaves the view. Its poster is not fetched either until the slab is
 * within a screen of the viewport: a `poster` in the markup is fetched at
 * once, wherever on the page the video stands, and beside the page's own
 * first picture. The slab's box is reserved by the video's width and height
 * until then, so nothing moves when the poster arrives.
 */
export function VideoSlab({ media }: { media: ProjectMedia }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting) && !v.paused) v.pause();
    });
    io.observe(v);
    const close = new IntersectionObserver(
      (e) => {
        if (!e.some((x) => x.isIntersecting)) return;
        setNear(true);
        close.disconnect();
      },
      { rootMargin: '100% 0px' },
    );
    close.observe(v);
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    v.addEventListener('play', on);
    v.addEventListener('pause', off);
    return () => {
      io.disconnect();
      close.disconnect();
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
        src={near ? media.src : undefined}
        poster={near ? media.poster : undefined}
        width={media.w}
        height={media.h}
        muted
        loop
        playsInline
        preload="none"
        aria-label={media.alt}
      />
      {/* The control sits under the picture, never on it: the film has its
          own captions and nothing may cover them. */}
      <div className="slab-bar">
        <button type="button" className="slab-play" onClick={toggle} aria-label={playing ? 'Pause the video' : 'Play the video'} aria-pressed={playing}>
          <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
            {playing ? <path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /> : <path d="M3.5 1.8v10.4L12 7z" fill="currentColor" />}
          </svg>
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
      </div>
    </figure>
  );
}
