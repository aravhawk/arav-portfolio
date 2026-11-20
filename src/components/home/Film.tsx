'use client';

import { useRef } from 'react';

/**
 * The launch film on the home page: one play control among the words, and
 * the film itself shown over the page at a size it can be read at. Nothing
 * is fetched until it is asked for; closing it stops it.
 */
export function Film({ src, poster, alt, w, h }: { src: string; poster?: string; alt: string; w: number; h: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const d = dialog.current;
    const v = video.current;
    if (!d || !v) return;
    // The layer opens from the control that opened it.
    const r = e.currentTarget.getBoundingClientRect();
    d.style.setProperty('--from-x', `${r.left + r.width / 2}px`);
    d.style.setProperty('--from-y', `${r.top + r.height / 2}px`);
    if (poster) v.poster = poster;
    d.showModal();
    void v.play().catch(() => {});
  };
  const close = () => dialog.current?.close();
  // Closed by its button, by Escape or by a press on the dark round it: the film stops and goes back to its start.
  const onClose = () => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <>
      <button type="button" className="hm-play" onClick={open} aria-haspopup="dialog" aria-label="Play the launch film">
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3.5 1.8v10.4L12 7z" fill="currentColor" />
        </svg>
        {/* The play mark says it; the word is kept for readers that cannot see the mark. */}
        <span className="sr-only">Film</span>
      </button>
      <dialog
        ref={dialog}
        className="hm-film"
        aria-label={alt}
        onClose={onClose}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="hm-film-frame">
          <video ref={video} src={src} width={w} height={h} controls playsInline preload="none" aria-label={alt} />
          <button type="button" className="hm-film-close" onClick={close} aria-label="Close the film">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </dialog>
    </>
  );
}
