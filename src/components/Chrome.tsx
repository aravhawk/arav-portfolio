'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { InnerNav } from './inner/InnerNav';

/**
 * The flight's own chrome (the nav with its sound and haptics switches, the
 * smooth scroll, the reveals) is a chunk of its own: it is rendered on the
 * server for the routes that fly, and no other route ever asks for it.
 */
const FlightChrome = dynamic(() => import('./FlightChrome'));

/** The routes that run a scene: the home page and the lab. */
const flies = (pathname: string) => pathname === '/' || pathname.startsWith('/lab');

/**
 * What stands over a page. The pages that fly keep the chrome they have
 * always had. Every other page (the work, the writing, a missing page) gets
 * four things and no runtime: the name, Work, Writing, the theme switch.
 */
export function Chrome() {
  const pathname = usePathname();
  return flies(pathname) ? <FlightChrome /> : <InnerNav pathname={pathname} />;
}
