/**
 * What the pre-rendered flight is made of, as the renderer (tools/flight)
 * writes it and the player (player.ts) reads it.
 *
 * A **set** is the whole flight photographed for one window shape and one
 * theme: `wide` (16:9) or `tall` (a phone held upright), by `day` (the
 * light theme) or `night` (the dark one). Each set is one stream a codec:
 * every frame's compressed bytes end to end, with an index beside it that
 * says where each frame lies. A stream holds several **tracks**:
 *
 *  - `main`: the flight by scroll, a frame every 1/`per` of a screen;
 *  - `enter`: the first screen's entrance, by time (played once on a load at
 *    the top of the page);
 *  - `dawn`: the light event at the ending, by time (played once, when the
 *    camera first comes to rest there);
 *  - `after`: the last stretch by scroll with the light risen (shown there
 *    once the dawn has played);
 *  - `gate1`, `gate2`: the stretch round the sluices by scroll with the
 *    second or the third gate open (the switch in cc-switch's words).
 */

/** The flight's timeline, as the page hands it to the player (plain numbers: no engine code is loaded for them). */
export interface Plan {
  /** where the scroll ends, and where the camera has come to rest, in screens */
  end: number;
  settle: number;
  /** the first section's stretch of scroll, in screens (the sections are sized in it) */
  hero: number;
  /** the scroll over which the lake melts */
  melt: [number, number];
  /** where each section begins, and where each stands composed */
  starts: number[];
  stops: number[];
  /** seconds into the entrance at which the first frame's words may set */
  heroWords: number;
  /** the ending's light event, by the clock: when its lift, its line of light and its ribbon run, and when it is over (DAWN in moments.ts) */
  dawn: { lift: number[]; ray: number[]; rise: number[]; over: number };
  /** the sluices: seconds for a gate to lift, to drop, and for its surge to run (GATE in moments.ts) */
  gate: { up: number; down: number; surge: number };
  /** the day's turn (0..1) every quarter screen, for the sound */
  day: number[];
  /** each later station's reach: lane, x, y, from, to (see stationsNear), for the sound */
  near: number[][];
}

export type Shape = 'wide' | 'tall';
export type Theme = 'day' | 'night';
export type Codec = 'av1' | 'hevc';

export interface Track {
  id: 'main' | 'enter' | 'dawn' | 'after' | 'gate1' | 'gate2';
  /** by scroll: the first frame's position in screens, and frames a screen. By time: frames a second. */
  from?: number;
  per?: number;
  fps?: number;
  /** where its first frame's bytes begin in the stream, and each frame's size */
  at: number;
  sizes: number[];
  /** a keyframe every this many frames, from the first */
  key: number;
}

/** A stream's index: `<shape>-<theme>.<codec>.json` beside `<shape>-<theme>.<codec>`. */
export interface StreamIndex {
  /** the WebCodecs codec string, and (HEVC) the decoder's configuration record, base64 */
  codec: string;
  description?: string;
  w: number;
  h: number;
  tracks: Track[];
}

/** Floats to a frame in `<shape>.cam`: the camera each frame of `main` was drawn from (pos, forward, right, up, tan). */
export const CAM_STRIDE = 13;

/** Narrower than this (width over height) a window is shown the tall set: where the flight itself turns to its upright compositions. */
export const TALL_BELOW = 0.9;

/**
 * The window of decoded frames kept round the reader: this many ahead of the way they are going, this many behind.
 * (A decoded 2560 x 1440 frame is about 5.5 MB: the window is what the player's memory is.)
 */
export const AHEAD = 8;
export const BEHIND = 4;
