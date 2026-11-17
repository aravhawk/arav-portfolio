import { describe, expect, it } from 'vitest';
import { ClockMap, LOOK, frameFor, startAt } from '@/audio/clock';

/** A device that renders `buffer` ms at a time: the page's reading of the audio clock is the end of the last buffer rendered. */
const reading = (perf: number, zero: number, buffer: number) => (Math.floor((perf - zero) / buffer) * buffer) / 1000;

describe('the map between the page’s clock and the audio clock', () => {
  it('finds the render head as the upper edge of stale readings', () => {
    const m = new ClockMap();
    // One reading a frame for a second, the device rendering 20 ms at a time: each reading is up to 20 ms stale.
    let worst = 0;
    for (let i = 0; i < 60; i++) {
      const perf = 5000 + i * 16.667;
      const audio = reading(perf, 3000, 20);
      worst = Math.max(worst, (perf - 3000) / 1000 - audio);
      m.feed({ perf, audio });
    }
    expect(worst).toBeGreaterThan(0.015);
    expect(m.ready).toBe(true);
    // The head at any moment is within a millisecond or two of where a continuous clock would be, and never behind a reading.
    for (const perf of [6000, 6007.3, 6013.9]) {
      expect(m.headAt(perf)).toBeGreaterThanOrEqual(reading(perf, 3000, 20));
      expect(Math.abs(m.headAt(perf) - (perf - 3000) / 1000)).toBeLessThan(0.002);
    }
  });

  it('what is heard lags the head by the device’s latency: taken from the output timestamp where there is one, from the reported latency where there is not', () => {
    const a = new ClockMap();
    const b = new ClockMap();
    for (let i = 0; i < 90; i++) {
      const perf = 5000 + i * 16.667;
      const audio = reading(perf, 3000, 10);
      a.feed({ perf, audio, latency: 0.022 });
      // The device is playing the sample from 31 ms ago.
      b.feed({ perf, audio, latency: 0.022, out: { contextTime: (perf - 3000) / 1000 - 0.031, performanceTime: perf } });
    }
    expect(a.lag).toBeCloseTo(0.022, 3);
    expect(b.lag).toBeCloseTo(0.031, 2);
    // A timestamp that shows no latency at all (some browsers') does not undo what the context reports.
    const c = new ClockMap();
    for (let i = 0; i < 90; i++) {
      const perf = 5000 + i * 16.667;
      c.feed({ perf, audio: reading(perf, 3000, 10), latency: 0.011, out: { contextTime: (perf - 3000) / 1000 - 0.0002, performanceTime: perf } });
    }
    expect(c.lag).toBeCloseTo(0.011, 2);
    // A sound to be heard at a moment is asked for that much earlier on the audio clock, and the two directions agree.
    const want = 7000;
    expect(a.heardAt(want)).toBeCloseTo(a.headAt(want) - 0.022, 3);
    expect(a.toPerf(a.heardAt(want))).toBeCloseTo(want, 6);
    expect(b.toPerf(b.heardAt(want))).toBeCloseTo(want, 6);
  });

  it('does not believe an output timestamp that has not begun to count, or that is ahead of the head', () => {
    const m = new ClockMap();
    for (let i = 0; i < 30; i++) m.feed({ perf: 1000 + i * 16.667, audio: (i * 16.667) / 1000, latency: 0.01, out: { contextTime: 0, performanceTime: 0 } });
    expect(m.lag).toBeCloseTo(0.01, 4);
    const n = new ClockMap();
    for (let i = 0; i < 30; i++) n.feed({ perf: 1000 + i * 16.667, audio: (i * 16.667) / 1000, latency: 0.01, out: { contextTime: (i * 16.667) / 1000 + 0.2, performanceTime: 1000 + i * 16.667 } });
    expect(n.lag).toBeCloseTo(0.01, 4);
  });

  it('begins again when the context has been suspended, and follows a dropped buffer within two seconds', () => {
    const m = new ClockMap();
    for (let i = 0; i < 60; i++) m.feed({ perf: 1000 + i * 16.667, audio: (i * 16.667) / 1000 });
    const before = m.headAt(2000);
    // Suspended for three seconds: the audio clock stood still.
    for (let i = 0; i < 5; i++) m.feed({ perf: 5000 + i * 16.667, audio: 1 + (i * 16.667) / 1000 });
    expect(m.headAt(5000 + 4 * 16.667)).toBeCloseTo(1 + (4 * 16.667) / 1000, 3);
    expect(before).toBeCloseTo(1, 2);
    // A buffer dropped: the audio clock falls 20 ms behind where it was. Within two seconds the head has followed.
    const k = new ClockMap();
    for (let i = 0; i < 60; i++) k.feed({ perf: 1000 + i * 16.667, audio: (i * 16.667) / 1000 });
    for (let i = 60; i < 200; i++) k.feed({ perf: 1000 + i * 16.667, audio: (i * 16.667) / 1000 - 0.02 });
    expect(k.headAt(1000 + 200 * 16.667)).toBeCloseTo((200 * 16.667) / 1000 - 0.02, 3);
  });

  it('a fixed map, for a render with no device', () => {
    const m = ClockMap.fixed(1000);
    expect(m.heardAt(1500)).toBeCloseTo(0.5, 9);
    expect(m.headAt(1500)).toBeCloseTo(0.5, 9);
    expect(m.lag).toBe(0);
  });

  it('nothing is asked for before the render head', () => {
    expect(startAt(1.2, 1.0)).toBe(1.2);
    expect(startAt(0.9, 1.0)).toBeCloseTo(1.004, 9);
    expect(LOOK).toBeGreaterThanOrEqual(0.25);
  });
});

describe('a moment of the picture’s clock is set for the frame that shows it', () => {
  it('whatever the display’s rate: heard in the middle of the frame that shows it', () => {
    const map = ClockMap.fixed(0);
    // The picture's clock runs with the page's. A moment falls anywhere between two frames.
    for (const frame of [1000 / 60, 1000 / 120, 1000 / 144]) {
      for (let n = 0; n < 200; n++) {
        const tau = 10 + n * 0.01337;
        // Frames at 0, frame, 2 frame...; the clock reads 0 at the first.
        const shows = Math.ceil((tau * 1000 - 0.5) / frame) * frame;
        // Set from a frame a quarter of a second before, when the clock as last drawn was the frame before that one's.
        const from = Math.floor((tau * 1000 - 250) / frame);
        const heard = map.toPerf(map.heardAt(frameFor(tau, ((from - 1) * frame) / 1000, (from - 1) * frame, frame, from * frame)));
        expect(heard - shows).toBeCloseTo(frame / 2, 6);
      }
    }
  });

  it('a moment that falls on a frame’s own beginning (a gate coming home) is shown by that frame, and heard in it', () => {
    const frame = 1000 / 60;
    const map = ClockMap.fixed(0);
    // The gate's time is the clock of a frame fifteen frames on, to the last bit or a hair off it either way.
    for (const hair of [0, 1e-7, -1e-7]) {
      const tau = (615 * frame) / 1000 + hair;
      const heard = map.toPerf(map.heardAt(frameFor(tau, (599 * frame) / 1000, 599 * frame, frame, 600 * frame)));
      expect(heard - 615 * frame).toBeCloseTo(frame / 2, 3);
    }
  });

  it('a frame that comes late shows its moment late; the sound keeps to the moment, and is ahead of that frame by no more than it was late', () => {
    const frame = 1000 / 60;
    const map = ClockMap.fixed(0);
    const tau = 10.001;
    const heard = map.toPerf(map.heardAt(frameFor(tau, 9.75 - frame / 1000, 9750 - frame, frame, 9750)));
    // On time, the frame at 10 016.7 ms would have shown it. It was missed; the next one does.
    const onTime = Math.ceil((tau * 1000) / frame) * frame;
    expect(heard - onTime).toBeCloseTo(frame / 2, 6);
    expect(heard - (onTime + frame)).toBeCloseTo(-frame / 2, 6);
  });

  it('with latency the start is asked for that much sooner, so it is heard on time all the same', () => {
    const m = new ClockMap();
    for (let i = 0; i < 90; i++) m.feed({ perf: 1000 + i * 16.667, audio: (i * 16.667) / 1000, latency: 0.045 });
    const perf = frameFor(3.2, 3.0, 4000, 16.667, 4016.667);
    const T = m.heardAt(perf);
    // It leaves the graph 45 ms before it is heard.
    expect(m.headAt(perf) - T).toBeCloseTo(0.045, 3);
    expect(m.toPerf(T)).toBeCloseTo(perf, 6);
  });
});
