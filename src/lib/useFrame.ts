'use client';

import { useEffect, useRef } from 'react';
import { onFrame, type FrameFn } from './story';

/** Subscribe to the shared animation loop for the life of the component. */
export function useFrame(fn: FrameFn) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => onFrame((now) => ref.current(now)), []);
}
