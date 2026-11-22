'use client';

import { Link } from '@/components/Link';
import { usePathname } from 'next/navigation';
import { useCallback, useSyncExternalStore } from 'react';
import { haptic, hapticsAvailable, hapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { THEME_COLOR } from '@/lib/site';
import './nav.css';
import './sound.css';

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

/** The theme switch: role switch, on is dark. Its looks and motion are in nav.css; why this file stays short is in docs/site-system/performance.md. */
function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const toggle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.toggleAttribute('data-instant', e.detail === 0); // a click from the keyboard has no press count: nothing animates
    // Haptic and visual change in the same handler, on the same frame.
    haptic('light');
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }, []);
  return (
    <button
      type="button"
      className="nav-toggle"
      role="switch"
      onClick={toggle}
      aria-label="Dark theme"
      aria-checked={theme === 'dark'}
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

/* The sound control (sound.css, src/lib/sound-control.ts): its markup, and its name set right as it is parsed for a reader who had muted. */
const SOUND_WAITS = 'Sound is on and starts at your first click or key. Mute (M)';
const SOUND_NAME = `(function(b){if(document.documentElement.dataset.sound==='off'){b.setAttribute('aria-label','Turn sound on');b.title='Turn sound on (M)'}})(document.currentScript.previousElementSibling)`;

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
        {pathname === '/' && (
          <button type="button" className="nav-sound" aria-label="Mute sound" aria-keyshortcuts="M" title={SOUND_WAITS} suppressHydrationWarning>
            <span className="nav-sound-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
        )}
        {pathname === '/' && <script dangerouslySetInnerHTML={{ __html: SOUND_NAME }} />}
        {pathname === '/' && <span className="nav-sound-status sr-only" role="status" />}
        <HapticsToggle />
        <ThemeToggle />
      </nav>
    </header>
  );
}
