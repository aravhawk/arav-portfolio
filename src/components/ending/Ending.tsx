'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CONTACT } from '@/content/projects';
import { haptic } from '@/lib/haptics';
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
      <a className="end-link end-primary" href={`mailto:${CONTACT.email}`} onClick={() => haptic('medium')}>
        Email
      </a>
      <button type="button" className="end-copy label" onClick={copy} aria-label="Copy email address">
        {/* At rest the control is its mark; what happened is said in words when it happens. */}
        {state === 'idle' ? (
          <svg className="end-copy-mark" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 3.2H4.4c-.9 0-1.6.7-1.6 1.6v6.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ) : null}
        <span aria-live="polite" className={state === 'idle' ? 'sr-only' : undefined}>
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed. Use the link.' : 'Copy'}
        </span>
      </button>
    </span>
  );
}

/**
 * The ways to reach him. `feed`: the row also carries the feed (the home
 * page's ending, which has no footer under it). Email is the one action and
 * leads the row. (The haptics switch is a setting and stands in the nav.)
 */
export function Contact({ feed = false }: { feed?: boolean }) {
  return (
    <ul className="ending-links">
      {/* The one action comes first; the rest is a quiet row. */}
      <li>
        <CopyEmail />
      </li>
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
      {feed ? (
        <li>
          <a className="end-link" href="/feed.xml">
            RSS
          </a>
        </li>
      ) : null}
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
          {note ? <p className="foot-note">{note}</p> : null}
        </div>
        <Contact />
        <nav className="foot-meta label" aria-label="Site">
          <Link href="/work">Work</Link>
          <Link href="/blog">Writing</Link>
          <a href="/feed.xml">RSS</a>
        </nav>
      </div>
    </footer>
  );
}
