import type { BedPainter } from './bed';
import { SHOAL_Y } from './geography';
import { timeline } from './registry';

export * from './geography';

/** The picture and sound replay the same bed operations in flight order. */
export function paintWorld(b: BedPainter, tribs = [9, 5, 3, 2, 1, 1, 1], gate = 0) {
  for (const section of timeline) section.paint?.(b, tribs, gate);
  b.shoal = SHOAL_Y;
}
