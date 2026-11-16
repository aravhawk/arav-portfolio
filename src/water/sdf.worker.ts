/**
 * The distance transform, off the main thread. A page-sized field is about
 * a million texels; doing it here keeps startup free of long tasks.
 */
import { signedDistance } from './sdf';

interface Job {
  id: number;
  alpha: Uint8ClampedArray;
  w: number;
  h: number;
  stride: number;
  clamp: number;
  scale: number;
}

self.onmessage = (e: MessageEvent<Job>) => {
  const { id, alpha, w, h, stride, clamp, scale } = e.data;
  const sd = signedDistance(alpha, w, h, stride, 0, clamp);
  let min = 0;
  for (let i = 0; i < sd.length; i++) {
    sd[i] *= scale;
    if (sd[i] < min) min = sd[i];
  }
  (self as unknown as Worker).postMessage({ id, sd, min }, [sd.buffer]);
};
