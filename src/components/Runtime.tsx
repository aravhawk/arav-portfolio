'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { onFrame } from '@/lib/frame';
import { primeHaptics } from '@/lib/haptics';

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
    const off = onFrame(() => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      const nowMelted = !home || y > vh * 0.62;
      if (nowMelted !== melted) {
        melted = nowMelted;
        html.toggleAttribute('data-melted', nowMelted);
      }
      const dy = y - lastY;
      if (Math.abs(dy) > 6) {
        const want = dy > 0 && y > vh * 0.5;
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

  // Warm haptics on the first touch, so the first real one is not late.
  useEffect(() => {
    const prime = () => primeHaptics();
    window.addEventListener('pointerdown', prime, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', prime);
  }, []);

  return null;
}
