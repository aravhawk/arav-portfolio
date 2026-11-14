'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { useShell } from './Shell';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

/**
 * Internal link that plays the page wipe.
 * Keyboard activation (click detail 0) skips the animation: keyboard actions never animate.
 */
export default function TLink({ href, onClick, children, ...rest }: Props) {
  const { go } = useShell();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    go(href, e.detail !== 0);
  };
  return (
    <Link href={href} onClick={handle} {...rest}>
      {children}
    </Link>
  );
}
