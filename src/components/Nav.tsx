'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useSyncExternalStore } from 'react';
import { haptic } from '@/lib/haptics';
import './nav.css';

type Theme = 'light' | 'dark';

function subscribe(cb: () => void) {
  window.addEventListener('themechange', cb);
  return () => window.removeEventListener('themechange', cb);
}
const getTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const getServerTheme = (): Theme => 'light';

export function setTheme(next: Theme) {
  const html = document.documentElement;
  html.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* private mode: theme lasts for this page */
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = next === 'dark' ? '#15181b' : '#e4e7e8';
  });
  window.dispatchEvent(new Event('themechange'));
}

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const toggle = useCallback(() => {
    // Haptic and visual change in the same handler, on the same frame.
    haptic('light');
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }, []);
  return (
    <button
      type="button"
      className="nav-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={theme === 'dark'}
      suppressHydrationWarning
    >
      <span className="nav-toggle-track" aria-hidden="true">
        <span className="nav-toggle-knob" />
      </span>
    </button>
  );
}

const LINKS = [
  { href: '/work', label: 'Work' },
  { href: '/blog', label: 'Writing' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="nav" data-chrome>
      <Link href="/" className="nav-mark glass" aria-label="Arav Jain, home" onClick={() => haptic('selection')}>
        <span>Arav Jain</span>
      </Link>
      <nav className="nav-links glass" aria-label="Main">
        {LINKS.map((l) => {
          const current = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link"
              aria-current={current ? 'page' : undefined}
              onClick={() => haptic('selection')}
            >
              {l.label}
            </Link>
          );
        })}
        <ThemeToggle />
      </nav>
    </header>
  );
}
