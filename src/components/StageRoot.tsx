'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { stage } from '@/stage/stage';
import { bindMagnets } from '@/lib/magnet';
import type { GlassEngine } from '@/gl/engine';

declare global {
  interface Window {
    __intro?: boolean;
    __dropReady?: boolean;
    __lenis?: { scrollTo: (t: number | string | HTMLElement, o?: Record<string, unknown>) => void; stop: () => void; start: () => void; destroy: () => void };
  }
}

/** The world behind every page: ground colour, colour fields, and the drop. */
export default function StageRoot() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ground = useRef<HTMLDivElement>(null);
  const orbs = useRef<(HTMLDivElement | null)[]>([]);
  const engine = useRef<GlassEngine | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const html = document.documentElement;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    stage.reduced = mq.matches;
    const onMq = () => {
      stage.reduced = mq.matches;
      stage.dirty = true;
    };
    mq.addEventListener('change', onMq);

    const unsub = stage.subscribe(() => {
      html.dataset.ground = stage.ground;
      html.dataset.tone = stage.tone;
    });
    html.dataset.ground = stage.ground;
    html.dataset.tone = stage.tone;

    const unMagnet = bindMagnets();

    // Smooth, velocity-aware scroll. Native scroll stays the source of truth.
    let lenis: { on: (e: string, fn: (l: { velocity: number }) => void) => void; destroy: () => void } | null = null;
    if (!mq.matches) {
      import('lenis').then(({ default: Lenis }) => {
        const l = new Lenis({ lerp: 0.1, autoRaf: true, anchors: true });
        l.on('scroll', (e: { velocity: number }) => stage.setVelocity(e.velocity / 42));
        lenis = l as unknown as typeof lenis;
        window.__lenis = l as unknown as Window['__lenis'];
      });
    }

    let disposed = false;
    const ready = () => {
      window.__dropReady = true;
      window.dispatchEvent(new Event('drop:ready'));
    };
    const boot = async () => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe || !canvas.current || !ground.current) throw new Error('no webgl2');
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        const { GlassEngine } = await import('@/gl/engine');
        if (disposed) return;
        const e = new GlassEngine({ canvas: canvas.current, ground: ground.current, orbs: orbs.current.filter(Boolean) as HTMLDivElement[] });
        await e.ready;
        if (disposed) return e.dispose();
        engine.current = e;
        if (window.__intro && !stage.reduced) stage.beginIntro();
        e.start();
        html.dataset.gl = 'on';
      } catch {
        html.dataset.gl = 'off';
      }
      ready();
    };
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 60));
    const handle = idle(() => void boot(), { timeout: 500 });

    return () => {
      disposed = true;
      (window.cancelIdleCallback ?? window.clearTimeout)(handle as number);
      mq.removeEventListener('change', onMq);
      unsub();
      unMagnet();
      lenis?.destroy();
      window.__lenis = undefined;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    // New route: start at the top and re-read what the drop should refract.
    if (!window.location.hash) window.__lenis?.scrollTo(0, { immediate: true, force: true });
    const t = window.setTimeout(() => engine.current?.collect(), 60);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <div className="world" aria-hidden="true">
        <div className="ground" ref={ground} />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="orb"
            ref={(el) => {
              orbs.current[i] = el;
            }}
          />
        ))}
      </div>
      <canvas className="drop" ref={canvas} aria-hidden="true" />
      <div className="drop-css" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  );
}
