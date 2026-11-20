'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A film with one control of our own, under the picture and never on it
 * (the film has its own captions). It never plays on its own, it is not
 * fetched until asked for, and it stops when it leaves the view.
 */
export function Film({ src, poster, alt, w, h }: { src: string; poster: string; alt: string; w: number; h: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting) && !v.paused) v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  return (
    <figure className="shot shot-film">
      <video
        ref={ref}
        className="shot-media"
        src={src}
        poster={poster}
        width={w}
        height={h}
        muted
        loop
        playsInline
        preload="none"
        aria-label={alt}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button type="button" className="film-play" onClick={toggle} aria-label={playing ? 'Pause the video' : 'Play the video'} aria-pressed={playing}>
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
          {playing ? <path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /> : <path d="M3.5 1.8v10.4L12 7z" fill="currentColor" />}
        </svg>
        <span>{playing ? 'Pause' : 'Play'}</span>
      </button>
    </figure>
  );
}
