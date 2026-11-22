/**
 * What the flight and the inner pages' scene band share that is not the
 * engine: the handle a mounted world puts on the window for the checks, and
 * the distance transforms (in a worker when there is one).
 *
 * (The page's own top-down water, which this file used to mount, is gone:
 * the home page is the flight (flight.ts) and every inner page opens on a
 * band of the same world (scene-band.ts).)
 */

import type { WaterEngine } from './engine';
import { signedDistance } from './sdf';

export interface StageHandle {
  destroy(): void;
  engine: WaterEngine;
  rebuild(): void;
}

/* ---------- distance transforms, in a worker when there is one ---------- */

interface SdJob {
  alpha: Uint8ClampedArray;
  w: number;
  h: number;
  clamp: number;
  scale: number;
}
interface SdResult {
  sd: Float32Array;
  min: number;
}

export function makeSolver() {
  let worker: Worker | null = null;
  let seq = 0;
  const waiting = new Map<number, (r: SdResult) => void>();
  try {
    worker = new Worker(new URL('./sdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; sd: Float32Array; min: number }>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      done?.({ sd: e.data.sd, min: e.data.min });
    };
    worker.onerror = () => {
      // Fall back to the main thread for anything still waiting.
      worker?.terminate();
      worker = null;
      waiting.forEach((done) => done({ sd: new Float32Array(0), min: 0 }));
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  const local = (job: SdJob): SdResult => {
    const sd = signedDistance(job.alpha, job.w, job.h, 4, 0, job.clamp);
    let min = 0;
    for (let i = 0; i < sd.length; i++) {
      sd[i] *= job.scale;
      if (sd[i] < min) min = sd[i];
    }
    return { sd, min };
  };
  return {
    async solve(job: SdJob): Promise<SdResult> {
      if (!worker) return local(job);
      const id = ++seq;
      const res = await new Promise<SdResult>((resolve) => {
        waiting.set(id, resolve);
        worker!.postMessage({ id, alpha: job.alpha, w: job.w, h: job.h, stride: 4, clamp: job.clamp, scale: job.scale });
      });
      return res.sd.length ? res : local(job);
    },
    dispose() {
      worker?.terminate();
      worker = null;
    },
  };
}
