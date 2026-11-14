'use client';

import { useRef, useState } from 'react';
import { person } from '@/lib/content';
import { Arrow } from './Arrow';

export default function Contact() {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(person.email);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${person.email}`;
    }
  };

  return (
    <section className="contact g-yellow" id="contact" data-chapter="contact" data-ground="#ffd60a" aria-labelledby="contact-title">
      <div className="pin front contact-pin">
        <div className="contact-top">
          <h2 id="contact-title" className="label mono">
            Contact
          </h2>
          <p className="contact-lead">Building with agents, or breaking them? Write to me.</p>
        </div>
        <div className="contact-bottom">
          <a className="contact-mail" href={`mailto:${person.email}`} data-cursor="Write">
            {person.email}
          </a>
          <footer className="contact-foot">
            <ul className="contact-links mono">
              <li>
                <button type="button" className="btn" onClick={copy} aria-live="polite">
                  {copied ? 'Address copied' : 'Copy the address'}
                </button>
              </li>
              {person.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer">
                    <span className="link">{l.label}</span> <Arrow out />
                  </a>
                </li>
              ))}
            </ul>
            <span className="mono">© 2026 Arav Jain</span>
          </footer>
        </div>
      </div>
    </section>
  );
}
