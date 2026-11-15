'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { world } from './store';

/**
 * The canvas behind every page. It mounts once in the root layout and never unmounts,
 * so the swarm survives navigation. three.js is loaded only after first paint.
 */
export default function World() {
  const ref = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.world !== 'live') { world.set({ status: 'static' }); return; }
    const canvas = ref.current!;
    let dead = false;
    let cleanup = () => {};
    world.set({ status: 'loading' });
    (async () => {
      try {
        const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
        const count = mobile ? 147 * 147 : 256 * 256;
        const family = getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'sans-serif';
        const [{ createEngine }] = await Promise.all([import('./engine'), document.fonts.load(`900 120px ${family.split(',')[0]}`, 'ARAV').catch(() => null)]);
        if (dead) return;
        world.set({ count: Math.round(Math.sqrt(count)) ** 2 });
        const engine = await createEngine(canvas, { count, family, mobile, onProgress: (done, total) => world.set({ done, total }) });
        if (dead) { engine.dispose(); return; }
        const home = location.pathname === '/';
        engine.setQ(home ? 1 + scrollY / (innerHeight * 2) : 1);
        engine.setMode(home ? 'story' : 'calm', { intro: true });
        engine.start();
        const onResize = () => engine.resize();
        const onVis = () => (document.hidden ? engine.stop() : engine.start());
        const onMove = (e: PointerEvent) => { if (e.pointerType === 'touch') return; engine.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1), true); };
        const onLeave = () => engine.setPointer(0, 0, false);
        addEventListener('resize', onResize); document.addEventListener('visibilitychange', onVis);
        addEventListener('pointermove', onMove, { passive: true }); document.addEventListener('pointerleave', onLeave);
        cleanup = () => { removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); engine.dispose(); };
        (window as unknown as { __world?: unknown }).__world = engine;
        world.set({ engine, status: 'ready' });
        root.dataset.ready = '1';
      } catch {
        // No WebGL2, lost context, anything: fall back to the still version.
        root.dataset.world = 'static';
        world.set({ status: 'static', engine: null });
      }
    })();
    return () => { dead = true; cleanup(); };
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const { engine } = world.get();
    if (!engine) return;
    const home = pathname === '/';
    if (home) engine.setQ(1);
    engine.setMode(home ? 'story' : 'calm');
  }, [pathname]);

  return <canvas ref={ref} className="world" aria-hidden="true" />;
}
