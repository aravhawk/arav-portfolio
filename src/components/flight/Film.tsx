'use client';

import { useCallback, useRef } from 'react';
import type { ProjectMedia } from '@/content/projects';
import { haptic } from '@/lib/haptics';

/**
 * A film on the flight: one play control in the composition, and the film
 * itself shown over the page at a size it can be read at. Nothing is fetched
 * until it is asked for; closing it stops it.
 */
export function Film({ media }: { media: ProjectMedia }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const open = useCallback(() => {
    const d = dialog.current;
    const v = video.current;
    if (!d || !v) return;
    haptic('medium');
    d.showModal();
    void v.play().catch(() => {});
  }, []);
  const close = useCallback(() => dialog.current?.close(), []);
  // (Closed by its button, by Escape or by a press on the dark round it: the film stops and goes back to its start.)
  const onClose = useCallback(() => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }, []);

  if (media.kind !== 'video') return null;
  return (
    <>
      <button type="button" className="fl-play" onClick={open} aria-haspopup="dialog" aria-label="Play the launch film">
        <span className="fl-play-disc" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 14 14">
            <path d="M3.5 1.8v10.4L12 7z" fill="currentColor" />
          </svg>
        </span>
        <span>Film</span>
      </button>
      <dialog
        ref={dialog}
        className="fl-film-dialog"
        aria-label={media.alt}
        onClose={onClose}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="fl-film-frame">
          <video ref={video} src={media.src} poster={media.poster} width={media.w} height={media.h} controls playsInline preload="none" aria-label={media.alt} />
          <button type="button" className="fl-film-close" onClick={close} aria-label="Close the film">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </dialog>
    </>
  );
}
