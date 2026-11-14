'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type Lenis from 'lenis';
import { clamp, luminance, runFrame, story } from '@/lib/story';
import type { Engine } from '@/components/scene/engine';
import Nav from './Nav';
import Cursor from './Cursor';
import Loader from './Loader';

type Section = { name: string; top: number; height: number; ground: string; sheet: boolean };

type ShellApi = {
  /** Navigate with the wipe. Falls back to a plain push for keyboard and reduced motion. */
  go: (href: string, animate: boolean) => void;
  scrollTo: (target: string | number) => void;
};

const Ctx = createContext<ShellApi>({ go: () => {}, scrollTo: () => {} });
export const useShell = () => useContext(Ctx);

const labelFor = (path: string) => (path === '/' ? 'Arav Jain' : path.startsWith('/work') ? 'Work' : path.startsWith('/blog') ? 'Writing' : path.slice(1));

const WIPE_IN = 420;
const WIPE_OUT = 540;

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wipeRef = useRef<HTMLDivElement>(null);
  const wipeLabelRef = useRef<HTMLSpanElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sectionsRef = useRef<Section[]>([]);
  const pendingRef = useRef<string | null>(null);
  const measureRef = useRef<() => void>(() => {});
  const [sceneState, setSceneState] = useState<'idle' | 'off' | 'ready' | 'failed'>('idle');
  const [fontsReady, setFontsReady] = useState(false);

  // One loop for everything that moves.
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    story.reduced = mq.matches;
    let lenis: Lenis | null = null;
    let disposed = false;
    let raf = 0;
    let lastGround = '';
    let lastInk = '';
    let lastChapter = '';
    let lastY = 0;
    let lastNav = '';

    const startLenis = async () => {
      if (story.reduced || lenis) return;
      const { default: LenisCtor } = await import('lenis');
      if (disposed || story.reduced) return;
      lenis = new LenisCtor({ lerp: 0.11, wheelMultiplier: 1, anchors: false });
      lenisRef.current = lenis;
    };
    const stopLenis = () => {
      lenis?.destroy();
      lenis = null;
      lenisRef.current = null;
    };
    const onMq = () => {
      story.reduced = mq.matches;
      root.dataset.motion = mq.matches ? 'reduced' : 'full';
      if (mq.matches) stopLenis();
      else void startLenis();
    };
    mq.addEventListener('change', onMq);
    root.dataset.motion = mq.matches ? 'reduced' : 'full';
    void startLenis();

    const measure = () => {
      const y = window.scrollY;
      story.vh = window.innerHeight;
      story.vw = window.innerWidth;
      sectionsRef.current = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]')).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: el.dataset.chapter!,
          top: r.top + y,
          height: Math.max(1, r.height),
          ground: el.dataset.ground || '#ffd60a',
          sheet: el.dataset.sheet !== undefined,
        };
      });
      engineRef.current?.resize();
    };
    measureRef.current = measure;
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    measure();

    const read = () => {
      const list = sectionsRef.current;
      const y = window.scrollY;
      const vh = story.vh;
      story.scrollY = y;
      if (!list.length) {
        story.chapter = 'none';
        story.local = 0;
        return;
      }
      // nav: hide while travelling down, show on the way up or near the top
      const nav = y < 160 || y < lastY - 3 ? 'up' : y > lastY + 3 ? 'down' : lastNav;
      lastY = y;
      if (nav !== lastNav) {
        lastNav = nav;
        root.dataset.nav = nav;
      }
      const yc = y + vh * 0.5;
      let i = list.findIndex((s) => yc >= s.top && yc < s.top + s.height);
      if (i < 0) i = yc < list[0].top ? 0 : list.length - 1;
      const cur = list[i];
      story.chapter = cur.name;
      story.local = clamp((yc - cur.top) / cur.height);

      // Ground: every chapter paints its own background, so the colour changes as a hard edge that
      // scrolls with the page. This value only feeds the page backdrop and the 3D floor bounce.
      let a = i;
      while (a > 0 && list[a].sheet) a--;
      const ground = list[a].sheet ? cur.ground : list[a].ground;
      story.ground = ground;
      if (ground !== lastGround) {
        lastGround = ground;
        root.style.setProperty('--ground', ground);
      }

      // Ink for the fixed chrome follows whatever sits under the top bar.
      const yt = y + 40;
      const top = list.find((s) => yt >= s.top && yt < s.top + s.height) ?? cur;
      const ink = luminance(top.ground) > 0.32 ? 'dark' : 'light';
      if (ink !== lastInk) {
        lastInk = ink;
        root.dataset.ink = ink;
      }
      if (cur.name !== lastChapter) {
        // Reduced motion: the scene cuts between resting poses, softened by a short fade.
        if (story.reduced && lastChapter) canvasRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease' });
        lastChapter = cur.name;
        root.dataset.at = cur.name;
      }
      story.covered = list.some((s, k) => {
        if (!s.sheet) return false;
        let end = k;
        while (end < list.length - 1 && list[end + 1].sheet) end++;
        return s.top <= y && list[end].top + list[end].height >= y + vh;
      });
    };

    const tick = (now: number) => {
      lenis?.raf(now);
      read();
      runFrame(now);
      const engine = engineRef.current;
      if (engine && !story.covered && !document.hidden) engine.render(now, story.reduced);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      engineRef.current?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      mq.removeEventListener('change', onMq);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onPointer);
      ro.disconnect();
      stopLenis();
    };
  }, []);

  // Fonts first (the engraving is drawn with them), then the WebGL chunk, off the critical path.
  // Pages with no 3D chapter (a blog post) never download it.
  const bootRef = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false;
    let started = false;
    const css = getComputedStyle(document.documentElement);
    const display = css.getPropertyValue('--font-onest').trim() || 'sans-serif';
    const mono = css.getPropertyValue('--font-jetbrains').trim() || 'monospace';
    const fonts = Promise.all([document.fonts.load(`600 80px ${display}`, 'ARAV'), document.fonts.load(`500 20px ${mono}`, 'LOOP 01')])
      .catch(() => null)
      .then(() => {
        if (!cancelled) setFontsReady(true);
      });
    const boot = async () => {
      if (started || cancelled) return;
      const wanted = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]')).some((el) => el.dataset.chapter !== 'none');
      if (!wanted) {
        setSceneState((s) => (s === 'idle' ? 'off' : s));
        return;
      }
      started = true;
      await fonts;
      try {
        const { Engine } = await import('@/components/scene/engine');
        if (cancelled || !canvasRef.current) return;
        const lowPower = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
        const engine = await Engine.create({
          canvas: canvasRef.current,
          fonts: { display, mono },
          lowPower,
          onFail: () => !cancelled && setSceneState('failed'),
        });
        if (cancelled) {
          engine.dispose();
          return;
        }
        engine.setIntro(document.documentElement.dataset.loaded ? 1 : 0);
        engineRef.current = engine;
        requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && setSceneState((s) => (s === 'failed' ? s : 'ready'))));
      } catch {
        if (!cancelled) setSceneState('failed');
      }
    };
    bootRef.current = () => void boot();
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 60));
    idle(() => void boot());
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const onRevealed = useCallback(() => {
    document.documentElement.dataset.loaded = 'true';
    engineRef.current?.setIntro(1);
  }, []);

  // Route change: finish the wipe once the new page is in.
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    measureRef.current();
    bootRef.current();
    const hash = window.location.hash;
    if (hash) requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView());
    const wipe = wipeRef.current;
    if (!wipe || pendingRef.current === null) return;
    pendingRef.current = null;
    const out = wipe.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], {
      duration: WIPE_OUT,
      easing: 'cubic-bezier(0.77, 0, 0.175, 1)',
      fill: 'forwards',
      delay: 80,
    });
    out.onfinish = () => {
      wipe.getAnimations().forEach((a) => a.cancel());
      wipe.dataset.on = 'false';
    };
  }, [pathname]);

  const go = useCallback(
    (href: string, animate: boolean) => {
      const url = new URL(href, window.location.href);
      const samePage = url.pathname === window.location.pathname;
      if (samePage) {
        if (url.hash) {
          const el = document.querySelector(url.hash);
          if (el) {
            if (lenisRef.current) lenisRef.current.scrollTo(el as HTMLElement, { duration: 1.4 });
            else el.scrollIntoView();
            history.replaceState(null, '', url.hash);
          }
        } else if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.2 });
        else window.scrollTo(0, 0);
        return;
      }
      const wipe = wipeRef.current;
      if (!animate || story.reduced || !wipe || pendingRef.current !== null) {
        router.push(href);
        return;
      }
      pendingRef.current = href;
      if (wipeLabelRef.current) wipeLabelRef.current.textContent = labelFor(url.pathname);
      wipe.dataset.on = 'true';
      const cover = wipe.animate([{ transform: 'translateY(101%)' }, { transform: 'translateY(0)' }], {
        duration: WIPE_IN,
        easing: 'cubic-bezier(0.77, 0, 0.175, 1)',
        fill: 'forwards',
      });
      cover.onfinish = () => router.push(href);
    },
    [router],
  );

  const scrollTo = useCallback((target: string | number) => {
    const el = typeof target === 'string' ? (document.querySelector(target) as HTMLElement | null) : target;
    if (el === null) return;
    // keyboard-driven jumps (a number) land at once; pointer-driven ones glide
    if (lenisRef.current) lenisRef.current.scrollTo(el, typeof el === 'number' ? { immediate: true } : { duration: 1.4 });
    else if (typeof el === 'number') window.scrollTo(0, el);
    else el.scrollIntoView();
  }, []);

  return (
    <Ctx.Provider value={{ go, scrollTo }}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <canvas ref={canvasRef} className="scene" data-state={sceneState} />
      {sceneState === 'failed' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="scene-poster" src="/loop-poster.webp" alt="" />
      ) : null}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="scene-poster" src="/loop-poster.webp" alt="" />
      </noscript>
      <Nav />
      <div id="main" className="page">
        {children}
      </div>
      <Cursor />
      <div ref={wipeRef} className="wipe" data-on="false" aria-hidden="true">
        <span ref={wipeLabelRef} />
      </div>
      <Loader ready={fontsReady && sceneState !== 'idle'} onRevealed={onRevealed} />
    </Ctx.Provider>
  );
}
