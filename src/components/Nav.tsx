'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { THEME_COLOR } from '@/lib/site';
import { SoundToggle } from './SoundToggle';
import './nav.css';

type Theme = 'light' | 'dark';

const subscribe = (cb: () => void) => {
  window.addEventListener('themechange', cb);
  return () => window.removeEventListener('themechange', cb);
};
const getTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const getServerTheme = (): Theme => 'light';

function toggleTheme() {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* private mode: the theme lasts for this page */
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = THEME_COLOR[window.location.pathname === '/' ? 'home' : 'page'][next];
  });
  window.dispatchEvent(new Event('themechange'));
}

const LINKS = [
  { href: '/work', label: 'Work' },
  { href: '/blog', label: 'Writing' },
];

/**
 * The site's nav: the name, Work, Writing, the theme switch and, on the
 * home page, the sound control. On an inner
 * page it is part of the page and scrolls with it. On the home page it
 * stands over the picture as two solid plates, with the number of the scene
 * the reader is in beside the name (the scene's canvas keeps it: see
 * SceneCanvas).
 */
export function Nav({ scenes }: { scenes: number }) {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const home = pathname === '/';
  return (
    <header className={home ? 'in-nav in-nav-home' : 'in-nav'}>
      <div className="in-brand">
        {/* Not fetched ahead from an inner page: the home page's scene code is no part of reading a project. */}
        <Link href="/" prefetch={false} className="in-mark" aria-label="Arav Jain, home">
          Arav Jain
        </Link>
        {home ? <span id="scene-at" className="in-at" data-n="01" data-of={scenes} aria-hidden="true" /> : null}
      </div>
      <nav className="in-links" aria-label="Main">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link" aria-current={pathname === l.href || pathname.startsWith(l.href + '/') ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
        {/* The place can be heard, if asked: only where the place is. */}
        {home ? <SoundToggle /> : null}
        <button
          type="button"
          className="in-theme"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={theme === 'dark'}
          suppressHydrationWarning
        >
          <span className="in-theme-track" aria-hidden="true">
            <span className="in-theme-knob" />
          </span>
        </button>
      </nav>
    </header>
  );
}
