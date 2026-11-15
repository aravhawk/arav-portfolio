'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { world, serverSnapshot } from '@/world/store';
import { person } from '@/lib/facts';

type Go = (href: string) => void;
const Nav = createContext<Go>(() => {});

/** Internal link that plays the cover before the route changes. */
export function TLink({ href, children, ...rest }: { href: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const go = useContext(Nav);
  return (
    <NextLink
      href={href}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault(); go(href);
      }}
    >
      {children}
    </NextLink>
  );
}

const fmt = new Intl.NumberFormat('en-US');

function Loader() {
  const s = useSyncExternalStore(world.subscribe, world.snapshot, () => serverSnapshot);
  const n = useRef<HTMLSpanElement>(null); const bar = useRef<HTMLElement>(null);
  const target = useRef(0); const ready = useRef(false);
  useEffect(() => { target.current = s.status === 'ready' ? 1 : Math.min(0.94, (s.done / s.total) * 0.94); ready.current = s.status === 'ready'; }, [s.done, s.total, s.status]);
  useEffect(() => {
    let raf = 0; let shown = 0; const t0 = performance.now(); let done = false;
    const tick = () => {
      // never faster than the eye can read it, never slower than the load
      const cap = Math.min(1, (performance.now() - t0) / 1500);
      shown += (Math.min(target.current, cap) - shown) * 0.14;
      if (ready.current && cap >= 1 && shown > 0.992) shown = 1;
      const total = world.get().count;
      if (n.current) n.current.textContent = fmt.format(Math.round(shown * total));
      if (bar.current) bar.current.style.setProperty('--p', String(shown));
      if (shown >= 1 && !done) { done = true; document.documentElement.dataset.loaded = '1'; return; }
      raf = requestAnimationFrame(tick);
    };
    if (document.documentElement.dataset.world === 'live') raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="loader" aria-hidden="true">
      <div className="loader-in">
        <span className="loader-n" ref={n}>0</span>
        <span className="loader-h"><i ref={bar} /></span>
        <span className="loader-row mono"><span>Agents awake</span><span>{fmt.format(s.count)}</span></span>
      </div>
    </div>
  );
}

const LINKS = [{ href: '/work', label: 'Index' }, { href: '/blog', label: 'Writing' }];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const pending = useRef(false);
  const lenis = useRef<{ scrollTo: (t: number, o?: { immediate?: boolean }) => void; destroy: () => void; raf: (t: number) => void } | null>(null);

  // Smooth wheel scroll, only where the film is playing.
  useEffect(() => {
    if (document.documentElement.dataset.world !== 'live') return;
    let raf = 0; let dead = false;
    import('lenis').then(({ default: Lenis }) => {
      if (dead) return;
      const l = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9, syncTouch: false });
      lenis.current = l; (window as unknown as { __lenis?: unknown }).__lenis = l;
      const loop = (t: number) => { l.raf(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    });
    return () => { dead = true; cancelAnimationFrame(raf); lenis.current?.destroy(); lenis.current = null; };
  }, []);

  const go = useCallback<Go>((href) => {
    setOpen(false);
    if (href === pathname) { lenis.current ? lenis.current.scrollTo(0) : window.scrollTo({ top: 0 }); return; }
    const root = document.documentElement;
    if (root.dataset.world !== 'live') { router.push(href); return; }
    if (pending.current) return;
    pending.current = true; root.dataset.cover = 'in';
    window.setTimeout(() => router.push(href), 470);
  }, [pathname, router]);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    const root = document.documentElement;
    lenis.current ? lenis.current.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0);
    const t = window.setTimeout(() => { root.dataset.cover = 'out'; window.setTimeout(() => { delete root.dataset.cover; }, 640); }, 140);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <Nav.Provider value={go}>
      <a className="skip" href="#main">Skip to content</a>
      <Loader />
      <header className="nav">
        <TLink href="/" className="mark" aria-label="Arav Jain, home">
          <span className="black">Arav</span><span className="thin">Jain</span>
        </TLink>
        <nav className="nav-links mono" aria-label="Main">
          {LINKS.map((l) => <TLink key={l.href} href={l.href} aria-current={pathname.startsWith(l.href) ? 'page' : undefined}>{l.label}</TLink>)}
          <a href={`mailto:${person.email}`}>Contact</a>
        </nav>
        <button className="menu-btn mono" aria-expanded={open} aria-controls="menu" onClick={() => setOpen((o) => !o)}>
          <span>{open ? 'Close' : 'Menu'}</span><i aria-hidden="true" />
        </button>
      </header>
      <div className="menu" id="menu" data-open={open ? '' : undefined} inert={!open}>
        <nav aria-label="Menu">
          {[{ href: '/', label: 'Home' }, ...LINKS].map((l, i) => (
            <TLink key={l.href} href={l.href} className={i % 2 ? 'thin' : 'black'} style={{ '--i': i } as React.CSSProperties}>{l.label}</TLink>
          ))}
        </nav>
        <div className="mono">
          {person.links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
          <a href={`mailto:${person.email}`}>Email</a>
        </div>
      </div>
      {children}
      <div className="cover" aria-hidden="true" />
    </Nav.Provider>
  );
}
