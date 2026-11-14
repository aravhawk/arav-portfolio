'use client';

import { usePathname } from 'next/navigation';
import TLink from './TLink';

const items = [
  { href: '/work', label: 'Work' },
  { href: '/blog', label: 'Writing' },
  { href: '/#contact', label: 'Contact' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="nav">
      <TLink href="/" className="nav-mark" aria-label="Arav Jain, home">
        <span aria-hidden="true" className="nav-glyph" />
        Arav Jain
      </TLink>
      <nav aria-label="Primary">
        <ul>
          {items.map((it) => {
            const current = it.href !== '/#contact' && pathname.startsWith(it.href);
            return (
              <li key={it.href}>
                <TLink href={it.href} className="nav-link" aria-current={current ? 'page' : undefined}>
                  {it.label}
                </TLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
