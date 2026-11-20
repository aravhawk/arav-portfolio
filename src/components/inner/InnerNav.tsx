'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { THEME_COLOR } from '@/lib/site';

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
    m.content = THEME_COLOR.page[next];
  });
  window.dispatchEvent(new Event('themechange'));
}

const LINKS = [
  { href: '/work', label: 'Work' },
  { href: '/blog', label: 'Writing' },
];

/**
 * The nav of every page that is not the flight: the name, Work, Writing and
 * the theme switch, in the page's own grid. It is part of the page and
 * scrolls with it, so it never moves on its own.
 */
export function InnerNav({ pathname }: { pathname: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  return (
    <header className="in-nav">
      <Link href="/" prefetch={false} className="in-mark" aria-label="Arav Jain, home">
        Arav Jain
      </Link>
      <nav className="in-links" aria-label="Main">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link" aria-current={pathname === l.href || pathname.startsWith(l.href + '/') ? 'page' : undefined}>
            {l.label}
          </Link>
        ))}
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
