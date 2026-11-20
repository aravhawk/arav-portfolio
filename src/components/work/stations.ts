import { PROJECTS } from '@/content/projects';
import type { SiteMetrics } from '@/lib/metrics';
import { COLS, TRIBS, colHeights } from '@/water/world';

/**
 * What the stations carry, the same on an inner page as on the home page:
 * the streams' widths and the columns' heights from the live numbers, and
 * the three pictures (the block of ice, the pool's bed, the canyon's wall).
 */
export function stationData(m: SiteMetrics) {
  const bench = PROJECTS.find((p) => p.slug === 'kilo-bench')?.media[0];
  const rydar = PROJECTS.find((p) => p.slug === 'rydar')?.media[0];
  return {
    tribs: m.mergedPrs.byRepo.slice(0, TRIBS.length).map((r) => r.count),
    cols: colHeights(m.ollama.models.slice(0, COLS.xs.length).map((x) => x.pulls)),
    slab: '/media/infiniview-hero.webp',
    sheet: bench?.kind === 'image' ? bench.src : undefined,
    face: rydar?.kind === 'image' ? rydar.src : undefined,
  };
}
