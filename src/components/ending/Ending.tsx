'use client';

import { Link } from '@/components/Link';
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

/** The row's links, in the order he gave them. Each opens in a new tab. */
const WAYS = [
  { label: 'X', href: CONTACT.x },
  { label: 'LinkedIn', href: CONTACT.linkedin },
  { label: 'GitHub', href: CONTACT.github },
  { label: 'Resume', href: CONTACT.resume },
];

/**
 * The ways to reach him: one row of links in one face, none set apart from the rest. There is no email address
 * here or anywhere on the site. (The feed is a way to follow the writing, not to reach him: the home page's ending
 * sets it by the newsletter's field, an inner page's footer among the ways round the site. The haptics switch is a
 * setting and stands in the nav.)
 */
export function Contact() {
  return (
    <ul className="ending-links">
      {WAYS.map((way) => (
        <li key={way.label}>
          <a className="end-link" href={way.href} target="_blank" rel="noopener noreferrer" onClick={() => haptic('medium')}>
            {way.label} <Arrow out />
          </a>
        </li>
      ))}
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
          <Link className="foot-mark" href="/" ahead="intent" aria-label="Arav Jain, home">
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
