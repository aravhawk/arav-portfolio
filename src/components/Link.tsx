'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore, type ComponentProps } from 'react';
import { isCalm, onCalm } from '@/lib/calm';

type Props = Omit<ComponentProps<typeof NextLink>, 'prefetch' | 'href'> & {
  href: string;
  /**
   * When the page this leads to is fetched ahead:
   *  - 'calm' (the default): as the framework does it, when the link is on
   *    screen, but not before this page has shown its first frame and is
   *    idle (src/lib/calm.ts).
   *  - 'intent': only when the reader reaches for it (pointer over it, a
   *    touch, focus). For the way home from an inner page: the home page's
   *    route carries the flight's own code, which no inner page needs.
   */
  ahead?: 'calm' | 'intent';
};

const never = () => false;

/**
 * The site's link between its own pages: next/link, with the fetching ahead
 * held back until it cannot compete with the page being read.
 */
export function Link({ ahead = 'calm', href, onPointerEnter, onTouchStart, onFocus, ...rest }: Props) {
  const calm = useSyncExternalStore(onCalm, isCalm, never);
  const router = useRouter();
  const auto = ahead === 'calm' && calm;
  // (Reaching for a link fetches its page at once, whatever the page is doing: the reader is about to need it.)
  const reach = () => {
    if (!auto) router.prefetch(href);
  };
  return (
    <NextLink
      {...rest}
      href={href}
      prefetch={auto ? null : false}
      onPointerEnter={(e) => {
        reach();
        onPointerEnter?.(e);
      }}
      onTouchStart={(e) => {
        reach();
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        reach();
        onFocus?.(e);
      }}
    />
  );
}
