'use client';

import { Link } from '@/components/Link';
import { usePathname } from 'next/navigation';
import { useCallback, useSyncExternalStore } from 'react';
import { haptic, hapticsAvailable, hapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { THEME_COLOR } from '@/lib/site';
import { SoundToggle } from './SoundToggle';
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
    m.content = THEME_COLOR[window.location.pathname === '/' ? 'home' : 'page'][next];
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

/**
 * The haptics switch: a setting, so it stands with the other settings here
 * and not among the links at the foot of a page. Shown only where a device
 * can buzz.
 */
type Buzz = 'hidden' | 'on' | 'off';
const subscribeBuzz = (cb: () => void) => {
  window.addEventListener('hapticschange', cb);
  return () => window.removeEventListener('hapticschange', cb);
};
const readBuzz = (): Buzz => (hapticsAvailable() ? (hapticsEnabled() ? 'on' : 'off') : 'hidden');
const readBuzzServer = (): Buzz => 'hidden';

function HapticsToggle() {
  const state = useSyncExternalStore(subscribeBuzz, readBuzz, readBuzzServer);
  const toggle = useCallback(() => {
    const on = readBuzz() !== 'on';
    setHapticsEnabled(on);
    window.dispatchEvent(new Event('hapticschange'));
    // Turning it on answers with the thing itself.
    if (on) haptic('light');
  }, []);
  if (state === 'hidden') return null;
  return (
    <button type="button" className="nav-haptics" role="switch" aria-checked={state === 'on'} aria-label="Haptics" title={state === 'on' ? 'Haptics: on' : 'Haptics: off'} onClick={toggle}>
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <rect x="6.75" y="1.75" width="6.5" height="12.5" rx="1.6" />
        <g className="nav-haptics-waves">
          <path d="M3.9 5v6M1.2 6.6v2.8M16.1 5v6M18.8 6.6v2.8" />
        </g>
        <path className="nav-haptics-off" d="M4.4 14.2 15.6 1.8" />
      </svg>
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
      <Link href="/" ahead="intent" className="nav-mark plate" aria-label="Arav Jain, home" onClick={() => haptic('selection')}>
        <span>Arav Jain</span>
      </Link>
      <nav className="nav-links plate" aria-label="Main">
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
        <SoundToggle />
        <HapticsToggle />
        <ThemeToggle />
      </nav>
    </header>
  );
}
