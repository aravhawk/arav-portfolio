import Image from 'next/image';
import type { ProjectMedia } from '@/content/projects';
import { VideoSlab } from './VideoSlab';

/**
 * A piece of real product media on a dry slab. `data-dry` raises its rect
 * out of the water, so inside a pool it becomes an island.
 */
export function Slab({ media, priority = false, sizes }: { media: ProjectMedia; priority?: boolean; sizes: string }) {
  if (media.kind === 'video') return <VideoSlab media={media} />;
  return (
    <figure className="slab" data-dry>
      <Image className="slab-media" src={media.src} alt={media.alt} width={media.w} height={media.h} sizes={sizes} priority={priority} />
    </figure>
  );
}
