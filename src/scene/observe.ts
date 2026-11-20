/**
 * What the picture is showing now, for anything that follows it without
 * drawing (the sound layer does). The scene system writes here once a
 * frame; a reader only looks. Four numbers, no allocation, no callback.
 */
export interface Sight {
  /** The scene under the picture: its place in the registry. */
  readonly from: number;
  /** The scene the whiteout is bringing in (the next one, or the far end of a jump). */
  readonly to: number;
  /** How far the whiteout between them has gone: 0 all `from`, 1 all `to`. */
  readonly mix: number;
  /** How far the camera's push into `from` has gone, 0 to 1. */
  readonly progress: number;
}

const now = { from: 0, to: 0, mix: 0, progress: 0 };

/** Read-only: where the picture is. Only meaningful while the canvas draws (`data-flight="live"`). */
export const sight: Sight = now;

/** For the scene system alone. */
export function see(from: number, to: number, mix: number, progress: number) {
  now.from = from;
  now.to = to;
  now.mix = mix;
  now.progress = progress;
}
