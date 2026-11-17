'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CONTACT } from '@/content/projects';
import { haptic, hapticsAvailable, hapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { Arrow } from '../bits';
import './ending.css';

/**
 * The contact row and its small controls. The home page sets them in the
 * last frame of its flight (src/app/page.tsx); inner pages end with the
 * plain Footer below.
 */

interface Props {
  /** e.g. "Numbers read Nov 15, 2026, 4:40 AM CT" */
  note?: string;
}

function CopyEmail() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef(0);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      haptic('success');
      setState('copied');
    } catch {
      haptic('error');
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <span className="end-email">
      <a className="end-link" href={`mailto:${CONTACT.email}`}>
        Email
      </a>
      <button type="button" className="end-copy label" onClick={copy} aria-label="Copy email address">
        <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed. Use the link.' : 'Copy'}</span>
      </button>
    </span>
  );
}

/** The user's own switch for haptics. Shown only where a device can buzz. */
type HapticsState = 'hidden' | 'on' | 'off';
const subscribeHaptics = (cb: () => void) => {
  window.addEventListener('hapticschange', cb);
  return () => window.removeEventListener('hapticschange', cb);
};
const readHaptics = (): HapticsState => (hapticsAvailable() ? (hapticsEnabled() ? 'on' : 'off') : 'hidden');
const readHapticsServer = (): HapticsState => 'hidden';

export function HapticsSetting() {
  const state = useSyncExternalStore(subscribeHaptics, readHaptics, readHapticsServer);
  if (state === 'hidden') return null;
  const toggle = () => {
    const on = state !== 'on';
    setHapticsEnabled(on);
    window.dispatchEvent(new Event('hapticschange'));
    // Turning it on answers with the thing itself.
    if (on) haptic('light');
  };
  return (
    <button type="button" className="end-haptics" role="switch" aria-checked={state === 'on'} onClick={toggle}>
      Haptics {state}
    </button>
  );
}

export function Contact() {
  return (
    <ul className="ending-links">
      <li>
        <a className="end-link" href={CONTACT.github} target="_blank" rel="noopener noreferrer" onClick={() => haptic('medium')}>
          GitHub <Arrow out />
        </a>
      </li>
      <li>
        <a className="end-link" href={CONTACT.x} target="_blank" rel="noopener noreferrer" onClick={() => haptic('medium')}>
          X <Arrow out />
        </a>
      </li>
      <li>
        <a className="end-link" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" onClick={() => haptic('medium')}>
          LinkedIn <Arrow out />
        </a>
      </li>
      <li>
        <CopyEmail />
      </li>
    </ul>
  );
}

/**
 * Inner pages end on one composed row, on the same snow as the page: his
 * name and when the numbers were read, the ways to reach him, the ways
 * round the site.
 */
export function Footer({ note }: Props) {
  return (
    <footer className="foot" aria-label="Contact">
      <div className="foot-row wrap">
        <div className="foot-brand">
          <Link className="foot-mark" href="/" aria-label="Arav Jain, home">
            Arav Jain
          </Link>
          {note ? <p className="label foot-note">{note}</p> : null}
        </div>
        <Contact />
        <nav className="foot-meta label" aria-label="Site">
          <Link href="/work">Work</Link>
          <Link href="/blog">Writing</Link>
          <a href="/feed.xml">RSS</a>
          <HapticsSetting />
        </nav>
      </div>
    </footer>
  );
}
