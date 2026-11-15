import type { Engine } from './engine';

/** One mutable record shared by the canvas and the DOM. No React state on the frame path. */
type State = { engine: Engine | null; status: 'boot' | 'loading' | 'ready' | 'static'; done: number; total: number; count: number };
const state: State = { engine: null, status: 'boot', done: 0, total: 10, count: 65536 };
const subs = new Set<() => void>();

export const world = {
  get: () => state,
  set(patch: Partial<State>) { Object.assign(state, patch); snapshot = { ...state }; subs.forEach((f) => f()); },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  snapshot: () => snapshot,
};
let snapshot: State = { ...state };
export const serverSnapshot: State = { ...state };
