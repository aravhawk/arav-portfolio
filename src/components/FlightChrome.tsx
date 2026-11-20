'use client';

import { Nav } from './Nav';
import { Runtime } from './Runtime';
import type { StageHandle } from '@/water/stage';

declare global {
  interface Window {
    /** The old engine's handle, where a page of it is running (the home page's switch reads it). */
    __water?: StageHandle;
  }
}

/** The home page's nav and page runtime, loaded only where a scene runs (see Chrome.tsx). */
export default function FlightChrome() {
  return (
    <>
      <Nav />
      <Runtime />
    </>
  );
}
