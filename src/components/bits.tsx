import Image from 'next/image';
import type { ProjectMedia } from '@/content/projects';

export function Arrow({ out = false }: { out?: boolean }) {
  return (
    <svg className="arrow" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      {out ? (
        <path d="M4 11 11 4M5.2 4H11v5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M2.5 7.5h10M8.4 3.4l4.1 4.1-4.1 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * A piece of real product media on a dry slab. `data-dry` raises its rect
 * out of the water, so inside a pool it becomes an island.
 */
export function Slab({ media, priority = false, sizes }: { media: ProjectMedia; priority?: boolean; sizes: string }) {
  if (media.kind === 'video') {
    return (
      <figure className="slab" data-dry>
        <video
          className="slab-media"
          src={media.src}
          poster={media.poster}
          width={media.w}
          height={media.h}
          muted
          loop
          playsInline
          controls
          preload="none"
          aria-label={media.alt}
        />
      </figure>
    );
  }
  return (
    <figure className="slab" data-dry>
      <Image className="slab-media" src={media.src} alt={media.alt} width={media.w} height={media.h} sizes={sizes} priority={priority} />
    </figure>
  );
}
