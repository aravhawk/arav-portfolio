'use client';

import { useEffect, useRef } from 'react';
import type { SceneId } from '@/water/scene-band';

/**
 * One scene of the world, drawn live by the engine in a frame of a given size: the renderer's stage for the inner
 * pages' pictures (src/app/render/band). No page a visitor opens mounts this.
 */
export function BandStage({ scene, w, h, box, tribs, cols, slab, sheet, face }: { scene: SceneId; w: number; h: number; box: [number, number, number, number] | null; tribs: number[]; cols: number[]; slab: string; sheet: string; face: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let handle: { detach(): void } | null = null;
    const el = host.current;
    if (!el) return;
    void import('@/water/scene-band').then(({ attachBand }) =>
      attachBand(el, { scene, tribs, cols, slab, sheet, face }, () => cancelled).then((b) => {
        if (cancelled) b?.detach();
        else handle = b;
      }),
    );
    return () => {
      cancelled = true;
      handle?.detach();
    };
  }, [scene, tribs, cols, slab, sheet, face]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
        <style>{'.band-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'}</style>
        <div ref={host} className="band-stage" style={{ position: 'absolute', inset: 0 }} />
        {/* (Where a band's words would stand: the picture keeps its calm there. Nothing is written in it.) */}
        <div data-band-words style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {box ? <p style={{ position: 'absolute', left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%`, margin: 0 }} /> : null}
        </div>
      </div>
    </div>
  );
}
