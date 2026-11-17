/**
 * Two clocks, and the map between them.
 *
 * The picture runs on the page's clock (the time each animation frame is
 * given, in milliseconds). Sound runs on the audio context's clock (seconds
 * of samples). A sound that must be heard with a frame has to be asked for
 * at the audio time that frame's moment will be coming out of the speaker,
 * so this keeps two offsets, each fed once a frame:
 *
 * - the render head: the audio time the context has rendered up to. The
 *   page's reading of it steps forward a device buffer at a time, so at any
 *   instant it may be stale by up to a buffer; the true head is the upper
 *   edge of those readings. Nothing can be asked for before it.
 * - what is heard: the audio time coming out of the device now, which lags
 *   the head by the device's latency. The browser says this directly where
 *   it has `getOutputTimestamp`; where it does not, it is the head less the
 *   latency the context reports.
 *
 * Pure arithmetic: the page feeds it readings, the offline renders give it
 * a fixed offset, and the tests feed it made-up ones.
 */

export interface Reading {
  /** the page's clock, ms */
  perf: number;
  /** AudioContext.currentTime, seconds */
  audio: number;
  /** getOutputTimestamp(), where the browser has it and it has begun to count */
  out?: { contextTime?: number; performanceTime?: number } | null;
  /** baseLatency + outputLatency, seconds, as far as the context reports them */
  latency?: number;
}

/** How long a reading of the head counts for, ms: long enough to have caught the head fresh many times, short enough to follow the two clocks' drift and a dropped buffer. */
const WINDOW = 2000;

export class ClockMap {
  /** audio seconds = perf seconds + head, at the render head */
  private head = NaN;
  /** audio seconds = perf seconds + ear, at the speaker */
  private ear = NaN;
  private at = 0;
  private seen: [number, number][] = [];

  /** A map that never moves: for a render with no device (audio time is the page's time less `zero` ms, heard as it is made). */
  static fixed(zeroMs: number): ClockMap {
    const m = new ClockMap();
    m.head = m.ear = -zeroMs / 1000;
    return m;
  }

  get ready() {
    return Number.isFinite(this.head);
  }

  feed(r: Reading) {
    const off = r.audio - r.perf / 1000;
    const dt = this.at ? Math.max(0, (r.perf - this.at) / 1000) : 0;
    this.at = r.perf;
    // (A reading far from the edge is a context that was suspended or has only just started: begin again from it.)
    if (!Number.isFinite(this.head) || Math.abs(off - this.head) > 0.25) this.seen = [];
    this.seen.push([r.perf, off]);
    while (this.seen.length > 1 && (r.perf - this.seen[0][0] > WINDOW || this.seen.length > 400)) this.seen.shift();
    // The head is the upper edge of the readings: the freshest any of them caught it.
    let head = -Infinity;
    for (const s of this.seen) if (s[1] > head) head = s[1];
    this.head = head;
    const lat = Math.max(0, r.latency ?? 0);
    let ear = this.head - lat;
    const o = r.out;
    if (o && o.performanceTime && o.contextTime && o.performanceTime > 0 && o.contextTime > 0) {
      const said = o.contextTime - o.performanceTime / 1000;
      // (Taken only when it is believable: behind the head, and not by more than half a second.)
      if (said <= this.head + 0.005 && said > this.head - 0.5) ear = said;
    }
    // What is heard moves smoothly: one odd reading does not shift a scheduled sound.
    this.ear = !Number.isFinite(this.ear) || Math.abs(ear - this.ear) > 0.1 ? ear : this.ear + (ear - this.ear) * Math.min(1, dt / 0.4 + 0.02);
  }

  /** The audio time the context has rendered up to, at a moment of the page's clock. */
  headAt(perfMs: number) {
    return perfMs / 1000 + this.head;
  }

  /** The audio time to ask for, for a sound to be heard at a moment of the page's clock. */
  heardAt(perfMs: number) {
    return perfMs / 1000 + this.ear;
  }

  /** The moment of the page's clock at which an audio time is heard. */
  toPerf(audio: number) {
    return (audio - this.ear) * 1000;
  }

  /** How far what is heard lags what is rendered, seconds. */
  get lag() {
    return this.head - this.ear;
  }
}

/** How far ahead, on the picture's clock, its moments are looked for and set, seconds. */
export const LOOK = 0.25;

/**
 * The start to ask for.
 * @param want the audio time the sound should start at to be heard on its frame
 * @param head the render head now
 * @param guard how far past the head a start must be to begin whole (a render quantum and a little)
 */
export const startAt = (want: number, head: number, guard = 0.004) => Math.max(want, head + guard);

/**
 * When, on the page's clock, a moment of the picture's clock is to be
 * heard: in the middle of the frame that shows it.
 *
 * The picture's clock runs with the page's, so the moment itself falls at
 * `clockAt + (tau - clock)`. The frame that shows it is the first to begin
 * at or after that. Frames begin on the display's own beat, which the
 * frame being made now is on, so that frame's beginning is known too; the
 * sound is asked for half a frame into it, where neither clock's jitter can
 * put it outside.
 * @param tau the moment, on the picture's clock (seconds)
 * @param clock the picture's clock as last drawn, and `clockAt` the time (ms) of the frame that drew it
 * @param frameMs how long a frame is here
 * @param frameAt the time (ms) of the frame being made now
 */
export function frameFor(tau: number, clock: number, clockAt: number, frameMs: number, frameAt: number) {
  const exact = clockAt + (tau - clock) * 1000;
  // (A moment that falls on a frame's own beginning, as the gates' do, is shown by that frame: hence the hair of
  // slack, a few hundredths of a millisecond, for the arithmetic that brought it there.)
  const n = Math.ceil((exact - frameAt) / frameMs - 0.002);
  return frameAt + (n + 0.5) * frameMs;
}
