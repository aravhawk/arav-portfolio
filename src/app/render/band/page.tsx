import type { Metadata } from 'next';
import { BandStage } from '@/components/BandStage';
import { PROJECTS } from '@/content/projects';
import { getMetrics } from '@/lib/metrics';
import type { SceneId } from '@/water/scene-band';
import { COLS, TRIBS, colHeights } from '@/water/world';

/**
 * The renderer's second route: one scene of the world as an inner page's band holds it, drawn by the live engine at a
 * size the address gives. It exists for scripts/capture-scenes.mjs, which photographs the inner pages' pictures
 * (public/media/scenes) from it. Nothing links here; robots are kept out of /render.
 *
 *   /render/band?scene=ask-around&w=1200&h=601            the scene, bare
 *   ...&box=0.03,0.42,0.5,0.9                             with the calm the words of a "next" band stand in (x0, y0, x1, y1 of the frame, from its top left)
 */

export const metadata: Metadata = {
  title: 'Renderer: a scene',
  robots: { index: false, follow: false },
};

export default async function RenderBand({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const m = await getMetrics();
  const media = (slug: string) => {
    const first = PROJECTS.find((p) => p.slug === slug)?.media[0];
    return first?.kind === 'image' ? first.src : '';
  };
  const box = q.box ? q.box.split(',').map(Number) : null;
  return (
    <BandStage
      scene={(q.scene ?? 'lake') as SceneId}
      w={Number(q.w) || 1200}
      h={Number(q.h) || 601}
      box={box && box.length === 4 && box.every(Number.isFinite) ? (box as [number, number, number, number]) : null}
      tribs={m.mergedPrs.byRepo.slice(0, TRIBS.length).map((r) => r.count)}
      cols={colHeights(m.ollama.models.slice(0, COLS.xs.length).map((x) => x.pulls))}
      slab="/media/infiniview-hero.webp"
      sheet={media('kilo-bench')}
      face={media('rydar')}
    />
  );
}
