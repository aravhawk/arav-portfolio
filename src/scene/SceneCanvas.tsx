'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * The home page's picture: one canvas, fixed behind the document, drawn by
 * the scene system (src/scene/flight). This component is the small part
 * that ships with the page. It decides whether the page flies at all, asks
 * for the renderer after the first paint, and keeps the document and the
 * picture in step: which scene's words are on, where focus has gone, which
 * stills are near.
 *
 * The page has two layouts (see home.css). Plain: twelve sections, each its
 * scene's still and its words; this is the page with scripts off, with
 * reduced motion, or without WebGL2. Flying (`data-flight` on the root):
 * the sections give the scroll its length, the words are pinned over the
 * canvas. `data-flight="live"` once the canvas is drawing.
 */

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

export function SceneCanvas({
  plan,
}: {
  /** Each scene, in order: where it starts, how long its push is, how long the whiteout after it is (in screens). */
  plan: readonly (readonly [start: number, screens: number, exit: number])[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  // Before the first paint after a route change (a full load has already
  // decided in the page's own script): does this page fly?
  useLayoutEffect(() => {
    const root = document.documentElement;
    const can = !matchMedia('(prefers-reduced-motion: reduce)').matches && 'WebGL2RenderingContext' in window;
    if (!can) root.removeAttribute('data-flight');
    else if (!root.hasAttribute('data-flight')) root.setAttribute('data-flight', '');
    return () => root.removeAttribute('data-flight');
  }, []);

  useEffect(() => {
    const canvas = ref.current!;
    const root = document.documentElement;
    const main = canvas.closest('main')!;
    const sections = [...main.querySelectorAll<HTMLElement>('[data-scene]')];
    const words = sections.map((s) => s.querySelector<HTMLElement>('[data-copy]'));
    const counter = document.getElementById('scene-at');
    const tall = matchMedia('(max-aspect-ratio: 1/1)');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const flying = () => root.hasAttribute('data-flight');
    const mark = (state: '' | 'live') => root.setAttribute('data-flight', state);

    /** One screen of scroll, in pixels: the first section is its scene's length in these. */
    const unit = () => sections[0].offsetHeight / (plan[0][1] + plan[0][2]) || innerHeight;

    const show = (index: number) => {
      words.forEach((el, i) => el?.toggleAttribute('data-on', i === index));
      if (index >= 0 && counter) counter.dataset.n = String(index + 1).padStart(2, '0');
    };

    // Until the canvas draws, the document itself says where the reader is.
    let ticking = 0;
    const place = () => {
      ticking = 0;
      if (!flying() || root.dataset.flight === 'live') return;
      const at = scrollY / unit();
      let i = 0;
      while (i + 1 < plan.length && at >= plan[i + 1][0]) i++;
      const mix = (at - plan[i][0] - plan[i][1]) / plan[i][2];
      show(i + 1 < plan.length && mix > 0.08 ? (mix < 0.92 ? -1 : i + 1) : i);
    };
    const onScroll = () => {
      if (!ticking && root.dataset.flight === '') ticking = requestAnimationFrame(place);
    };
    addEventListener('scroll', onScroll, { passive: true });

    // Focus on a link brings its scene: the page scrolls to where those words stand.
    const onFocus = (e: FocusEvent) => {
      if (!flying() || !(e.target instanceof HTMLElement) || !e.target.matches(':focus-visible')) return;
      const i = sections.findIndex((s) => s.contains(e.target as Node));
      if (i < 0 || words[i]?.hasAttribute('data-on')) return;
      scrollTo({ top: Math.round((plan[i][0] + Math.min(0.6, plan[i][1] / 2)) * unit()), behavior: 'instant' });
    };
    main.addEventListener('focusin', onFocus);

    // A still is fetched when its section is near, never all twelve at once.
    const near = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.setAttribute('data-near', '');
      },
      { rootMargin: '100% 0px' },
    );
    sections.forEach((s) => near.observe(s));

    let controller: AbortController | undefined,
      timer = 0,
      raf = 0,
      closed = false;
    const cancel = () => {
      controller?.abort();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      if (flying()) mark('');
    };
    const plain = () => {
      cancel();
      root.removeAttribute('data-flight');
      show(0);
    };
    const start = () => {
      cancel();
      if (closed) return;
      if (media.matches || !('WebGL2RenderingContext' in window)) return plain();
      mark('');
      place();
      controller = new AbortController();
      const { signal } = controller;
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          timer = window.setTimeout(async () => {
            if (signal.aborted) return;
            // Wait for the first still to decode, then give it a paint before
            // requesting the renderer or competing for bandwidth with the LCP.
            const still = new Image();
            const theme = root.dataset.theme === 'dark' ? 'night' : 'day';
            still.src = '/scene/lake/still-' + theme + (tall.matches ? '-phone' : '') + '.avif';
            await still.decode().catch(() => {});
            await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
            await firstPaint(signal);
            if (signal.aborted) return;
            performance.mark('lake:import');
            try {
              const { mountFlight } = await import('@/scene/flight/gpu');
              if (signal.aborted) return;
              await mountFlight(canvas, theme, signal, tall.matches ? 'tall' : 'wide', false, unit, show);
              if (!signal.aborted) mark('live');
            } catch (err) {
              if (signal.aborted) return;
              // No picture to draw with: the page is its stills and its words.
              console.warn('The scene could not start', err);
              plain();
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
    themes.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    media.addEventListener('change', start);
    tall.addEventListener('change', start);
    start();
    return () => {
      closed = true;
      cancel();
      near.disconnect();
      themes.disconnect();
      cancelAnimationFrame(ticking);
      removeEventListener('scroll', onScroll);
      main.removeEventListener('focusin', onFocus);
      tall.removeEventListener('change', start);
      media.removeEventListener('change', start);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', start);
    };
  }, [plan]);

  return <canvas ref={ref} aria-hidden="true" className="hm-canvas" />;
}
