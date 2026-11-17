'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { onFrame } from '@/lib/frame';
import { primeHaptics } from '@/lib/haptics';
import { emit, signals } from '@/lib/signals';

/**
 * Page runtime: smooth scroll, reveals and the nav's scroll state. One
 * component so they share the single frame loop and nothing here re-renders.
 */
/** How long the scroll must hold still, on the home page, before the nav returns. */
const REST_MS = 480;

export function Runtime() {
  const pathname = usePathname();

  // Smooth wheel scrolling for fine pointers. Touch keeps native scrolling.
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let off: (() => void) | null = null;
    let lenis: import('lenis').default | null = null;
    let cancelled = false;

    const start = async () => {
      if (!fine.matches || reduced.matches || lenis) return;
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
    const sync = () => (fine.matches && !reduced.matches ? void start() : stop());
    sync();
    reduced.addEventListener('change', sync);
    fine.addEventListener('change', sync);
    return () => {
      cancelled = true;
      reduced.removeEventListener('change', sync);
      fine.removeEventListener('change', sync);
      stop();
    };
  }, []);

  // Nav state and scroll-linked word reveals, read once per frame.
  useEffect(() => {
    const html = document.documentElement;
    let lastY = window.scrollY;
    let hidden = false;
    let melted: boolean | null = null;
    const home = pathname === '/';
    emit('route');
    let restY = lastY;
    let restAt = 0;
    const off = onFrame((now) => {
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
      // On the home page it also comes back when the scroll comes to rest:
      // the flight's words are set clear of it, and from any station the
      // rest of the site is one press away. It leaves again with the next
      // move down.
      if (Math.abs(y - restY) > 1 || !restAt) {
        restY = y;
        restAt = now;
      } else if (home && hidden && now - restAt > REST_MS) {
        hidden = false;
        html.removeAttribute('data-nav-hidden');
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

  // Warm haptics on the first touch, so the first real one is not late.
  useEffect(() => {
    const prime = () => primeHaptics();
    window.addEventListener('pointerdown', prime, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', prime);
  }, []);

  return null;
}
