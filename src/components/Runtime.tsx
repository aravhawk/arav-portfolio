'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { whenCalm } from '@/lib/calm';
import { onFrame } from '@/lib/frame';
import { primeHaptics } from '@/lib/haptics';
import { emit, signals } from '@/lib/signals';

/**
 * Page runtime: smooth scroll, reveals and the nav's scroll state. One
 * component so they share the single frame loop and nothing here re-renders.
 */

export function Runtime() {
  const pathname = usePathname();

  // Smooth wheel scrolling for fine pointers. Touch keeps native scrolling.
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let off: (() => void) | null = null;
    let lenis: import('lenis').default | null = null;
    let cancelled = false;

    /** The flight's own pages scroll natively: the picture follows the scroll through its own smoothing (src/flight/spring.ts), and a second one under it would be scroll-jacking. */
    const flight = () => window.location.pathname === '/' || window.location.pathname === '/render';
    const start = async () => {
      if (!fine.matches || reduced.matches || lenis || flight()) return;
      const { default: Lenis } = await import('lenis');
      if (cancelled) return;
      lenis = new Lenis({ autoRaf: false, lerp: 0.115, wheelMultiplier: 1, anchors: true });
      off = onFrame((now) => lenis?.raf(now), 0);
    };
    const stop = () => {
      off?.();
      off = null;
      lenis?.destroy();
      lenis = null;
    };
    const sync = () => (fine.matches && !reduced.matches && !flight() ? void start() : stop());
    // An inner page's first screen does not need the library: it is fetched once the page has shown that screen and
    // is idle. (Again on every route change: it stops on the way to the home page and starts on the way from it.)
    const offCalm = whenCalm(sync);
    reduced.addEventListener('change', sync);
    fine.addEventListener('change', sync);
    return () => {
      cancelled = true;
      offCalm();
      reduced.removeEventListener('change', sync);
      fine.removeEventListener('change', sync);
      stop();
    };
  }, [pathname]);

  // Nav state and scroll-linked word reveals, read once per frame.
  useEffect(() => {
    const html = document.documentElement;
    let lastY = window.scrollY;
    let hidden = false;
    let melted: boolean | null = null;
    const home = pathname === '/';
    emit('route');
    const off = onFrame(() => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      signals.scrollY = y;
      // (On the home page the name is the hero: the mark waits until the lake's letters have run together into open water.)
      const nowMelted = !home || y > vh * 1.25;
      if (nowMelted !== melted) {
        melted = nowMelted;
        html.toggleAttribute('data-melted', nowMelted);
      }
      // The nav leaves as soon as the page moves down, so it never sits
      // over copy that is scrolling under it, and comes back when the page
      // moves up or is at its top. Scroll position is read, not wheel
      // events, so a scroll made by script counts too. Focus inside the
      // nav brings it back in CSS, so it stays reachable by keyboard.
      // On the home page it never leaves: the flight's words are set clear
      // of it at every position, so it is fixed chrome at one place and is
      // never caught half-way.
      if (home) return;
      const dy = y - lastY;
      const atTop = y <= 8;
      if (Math.abs(dy) > 6 || (atTop && hidden)) {
        const want = dy > 0 && !atTop;
        if (want !== hidden) {
          hidden = want;
          html.toggleAttribute('data-nav-hidden', hidden);
        }
        lastY = y;
      }
    }, 20);
    return () => {
      off();
      html.removeAttribute('data-nav-hidden');
    };
  }, [pathname]);

  // Reveals: one observer, each element revealed once.
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-js', '');
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-in])'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.setAttribute('data-in', ''));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-in', '');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  // Held pictures (Held.tsx): each gets its address at the page's first calm moment, and is an ordinary lazy picture
  // from then on.
  useEffect(
    () =>
      whenCalm(() => {
        for (const img of document.querySelectorAll<HTMLImageElement>('img[data-held]')) {
          const { src, srcset } = img.dataset;
          // (Once the real picture is in, its own shape rules again, exactly as it did before pictures were held.)
          img.addEventListener('load', () => img.style.removeProperty('aspect-ratio'), { once: true });
          if (srcset) img.srcset = srcset;
          if (src) img.src = src;
          img.removeAttribute('data-held');
        }
      }),
    [pathname],
  );

  // Warm haptics on the first touch, so the first real one is not late.
  useEffect(() => {
    const prime = () => primeHaptics();
    window.addEventListener('pointerdown', prime, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', prime);
  }, []);

  return null;
}
