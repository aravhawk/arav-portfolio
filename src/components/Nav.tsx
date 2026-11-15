'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Glass from './Glass';

const links = [
  { href: '/work', label: 'Work', note: 'Projects and archive' },
  { href: '/blog', label: 'Blog', note: 'Writing' },
  { href: '/#contact', label: 'Contact', note: 'Say hi' },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.__lenis?.stop();
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.__lenis?.start();
      document.body.style.overflow = '';
    };
  }, [open]);

  const current = (href: string) => (href === '/work' ? pathname.startsWith('/work') : href === '/blog' ? pathname.startsWith('/blog') : false);

  return (
    <>
      <header className="nav">
        <Glass as="nav" className="nav-bar" refract radius={999} aria-label="Primary">
          <Link href="/" className="nav-name" aria-current={pathname === '/' ? 'page' : undefined} onClick={() => setOpen(false)}>
            <span className="nav-dot" aria-hidden="true" />
            Arav Jain
          </Link>
          <div className="nav-links">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link" data-magnet aria-current={current(l.href) ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
          </div>
          <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
            <span />
            <span />
          </button>
        </Glass>
      </header>
      <div id="menu" className="menu" data-open={open} aria-hidden={!open} inert={!open}>
        {links.map((l, i) => (
          <Link key={l.href} href={l.href} style={{ '--i': i } as React.CSSProperties} onClick={() => setOpen(false)} aria-current={current(l.href) ? 'page' : undefined}>
            {l.label}
            <small>{l.note}</small>
          </Link>
        ))}
      </div>
    </>
  );
}
