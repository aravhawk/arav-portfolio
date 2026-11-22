'use client';

import { useEffect, useRef } from 'react';

// The browser can report its first presentation after a scheduled animation
// frame. Use that signal where available before requesting the 3D chunk.
function firstPaint(signal: AbortSignal) {
  if (
    signal.aborted ||
    !window.PerformanceObserver?.supportedEntryTypes.includes('paint') ||
    performance.getEntriesByType('paint').length
  )
    return Promise.resolve();
  return new Promise<void>((resolve) => {
    const finish = () => {
      observer.disconnect();
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const observer = new PerformanceObserver(finish);
    observer.observe({ type: 'paint', buffered: true });
    signal.addEventListener('abort', finish, { once: true });
  });
}

export function LakeCanvas({ flight = false }: { flight?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const tall = matchMedia('(max-aspect-ratio: 1/1)');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let controller: AbortController | undefined,
      timer = 0,
      raf = 0,
      closed = false;
    const cancel = () => {
      controller?.abort();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    const start = () => {
      cancel();
      if ((!flight && media.matches) || closed) return;
      controller = new AbortController();
      const { signal } = controller;
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          timer = window.setTimeout(async () => {
            if (signal.aborted) return;
            // Wait for the selected poster to decode, then give it a paint before
            // requesting the renderer or competing for bandwidth with the LCP.
            const still = new Image();
            const theme = document.documentElement.dataset.theme === 'dark' ? 'night' : 'day';
            still.src = '/scene/lake/still-' + theme + (tall.matches ? '-phone' : '') + '.avif';
            await still.decode().catch(() => {});
            await new Promise<void>((done) =>
              requestAnimationFrame(() => requestAnimationFrame(() => done())),
            );
            await firstPaint(signal);
            if (signal.aborted) return;
            performance.mark('lake:import');
            try {
              if (flight) {
                const { mountFlight } = await import('@/scene/flight/gpu');
                if (!signal.aborted)
                  await mountFlight(canvas, theme, signal, tall.matches ? 'tall' : 'wide', media.matches);
              } else {
                const { mount } = await import('@/scene/lake/live');
                if (!signal.aborted) await mount(canvas, theme, signal);
              }
            } catch (err) {
              if (!signal.aborted) console.error('Frozen lake initialization', err);
            }
          }, 0);
        });
      });
    };
    const lost = (e: Event) => {
      e.preventDefault();
      cancel();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', start);
    const themes = new MutationObserver(start);
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    media.addEventListener('change', start);
    tall.addEventListener('change', start);
    start();
    return () => {
      closed = true;
      cancel();
      themes.disconnect();
      tall.removeEventListener('change', start);
      media.removeEventListener('change', start);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', start);
    };
  }, [flight]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="flight-canvas"
      style={{ width: '100%', height: '100%', opacity: 0 }}
    />
  );
}
