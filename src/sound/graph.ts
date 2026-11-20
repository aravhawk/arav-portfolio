/**
 * The graph: every node the place's sound is made of, built on whichever
 * context it is given. The page gives it an AudioContext; the checks give
 * it an OfflineAudioContext and get the same sound as a file.
 *
 * Nothing here is a recording. One buffer of noise made on the spot is
 * read by three sources at three speeds, and filters make of it a wind, a
 * drift of snow and three kinds of water; the ice is a few short voices
 * made when it speaks.
 *
 *   noise x0.5  -> low-pass (tone) + a wandering band -> breath -> wind --+
 *   noise x0.93 -> band, 1.7 kHz -> gusts -> drift ------------------------+
 *   noise x1    -> run (three resonances, each fluttering) --+             |
 *               -> fall (a wide band) -----------------------+-> pan ------+-> high-pass -> soft limit -> on/off -> out
 *               -> lap (a band, swelling slowly) ------------+             |
 *   ice voices -> far (low-pass) -> ice -+---------------------------------+
 *                                        +-> two echoes, crossed ----------+
 *
 * After it is built, a standing parameter is only ever told to glide
 * (setTargetAtTime): no step, so no click, whatever the page does.
 */
import type { Targets } from './mapping';

/** The limiter's ceiling: nothing leaves above this (0.72 is -2.9 dBFS at the curve's end). */
export const CEILING = 0.9;
/** The whole, before the limiter: set so a walk through the page measures about -20 LUFS (scripts/sound/render.mjs). */
export const TRIM = 2.75;
/** Seconds: how quickly a standing parameter follows what it is told. */
export const GLIDE = 0.17;
/** Seconds: how quickly the whole comes up when asked for, and goes when not. */
export const FADE = { up: 0.3, down: 0.07 };

export interface Graph {
  /** The last node before the destination. */
  out: AudioNode;
  /** Glide every standing parameter to `to`, from time `t`. Only what has moved is told. */
  set(to: Targets, t: number): void;
  /** Sound on or off, as a glide of `tau` seconds. */
  power(on: boolean, t: number, tau: number): void;
  /** A far-off crack of the lake's ice at `t`. `deep`: a boom, else a ping. `a`, `b`, `c`: random numbers in [0, 1). */
  crack(t: number, deep: boolean, a: number, b: number, c: number): void;
}

const KEYS = ['wind', 'tone', 'drift', 'run', 'fall', 'lap', 'ice'] as const;
const pause = () => new Promise<void>((r) => setTimeout(r, 0));

/** Seconds at the end of the noise that are faded into its start: a loop stops short of them, so it comes round without a seam. */
const SEAM = 0.1;

/** One channel of noise whose power falls 3 dB an octave (Paul Kellet's filter), its start faded in from its last SEAM seconds. */
function pink(d: Float32Array, rate: number, rng: () => number) {
  const n = d.length;
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  const x = Math.round(SEAM * rate);
  for (let i = 0; i < x; i++) {
    const k = i / x;
    d[i] = d[i] * k + d[n - x + i] * (1 - k);
  }
}

/** A slow random curve between -1 and 1 that ends where it began: what makes water flutter without a period to hear. */
function wander(d: Float32Array, step: number, rng: () => number) {
  const points = d.length / step;
  const first = rng() * 2 - 1;
  let from = first;
  for (let p = 0; p < points; p++) {
    const to = p + 1 === points ? first : rng() * 2 - 1;
    for (let i = 0; i < step; i++) d[p * step + i] = from + (to - from) * (0.5 - 0.5 * Math.cos((Math.PI * i) / step));
    from = to;
  }
}

export async function build(ctx: BaseAudioContext, rng: () => number): Promise<Graph> {
  const rate = ctx.sampleRate;
  const gain = (v: number) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const filter = (type: BiquadFilterType, hz: number, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    return f;
  };
  const chain = (...nodes: AudioNode[]) => {
    for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
    return nodes[nodes.length - 1];
  };
  const loop = (buffer: AudioBuffer, speed: number, from: number, seam = 0) => {
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.loopEnd = buffer.duration - seam;
    s.playbackRate.value = speed;
    s.start(0, from * buffer.duration);
    return s;
  };
  /** A slow sine added to a parameter, `depth` either way. */
  const sway = (param: AudioParam, hz: number, depth: number) => {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    chain(o, gain(depth)).connect(param);
    o.start();
  };
  const pan = (v: number) => {
    const p = ctx.createStereoPanner();
    p.pan.value = v;
    return p;
  };

  // Ten seconds of noise, two channels that share nothing; a pause between them so making it holds the page for no longer than one does.
  const noise = ctx.createBuffer(2, Math.round(10 * rate), rate);
  pink(noise.getChannelData(0), rate, rng);
  await pause();
  pink(noise.getChannelData(1), rate, rng);
  // Eight seconds of slow curve, read at a fifth of its speed: forty seconds before it comes round.
  const curve = ctx.createBuffer(2, 64000, 8000);
  wander(curve.getChannelData(0), 250, rng);
  wander(curve.getChannelData(1), 250, rng);
  const flutter = ctx.createChannelSplitter(2);
  loop(curve, 0.2, 0).connect(flutter);
  /** One channel of the slow curve added to a parameter, `depth` either way. */
  const waver = (param: AudioParam, side: number, depth: number) => {
    const g = gain(depth);
    flutter.connect(g, side);
    g.connect(param);
  };

  // Soft limiter: straight where the sound lives, bending to a ceiling it cannot pass.
  const limit = ctx.createWaveShaper();
  const shape = new Float32Array(2049);
  for (let i = 0; i < shape.length; i++) shape[i] = CEILING * Math.tanh((i / 1024 - 1) / CEILING);
  limit.curve = shape;
  const mix = filter('highpass', 55, 0.6);
  const on = gain(0);
  chain(mix, gain(TRIM), limit, on, ctx.destination);

  // The wind: the bed, and a band in it that wanders so it is never the same wind twice.
  const air = loop(noise, 0.5, 0, SEAM);
  const tone = filter('lowpass', 420, 0.5);
  const moan = filter('bandpass', 430, 2.2);
  const breath = gain(1);
  const wind = gain(0);
  // (Nothing under 100 Hz: a small speaker cannot play it and a large one makes a rumble of it.)
  const body = chain(air, filter('highpass', 105, 0.5));
  chain(body, tone, filter('lowpass', 1500, 0.5), breath, wind, mix);
  chain(body, moan, gain(0.55), breath);
  sway(moan.frequency, 0.043, 110);
  sway(moan.frequency, 0.071, 60);
  sway(breath.gain, 0.057, 0.2);
  sway(breath.gain, 0.091, 0.13);

  // Blown snow: lighter and higher, in gusts.
  const gusts = gain(0.6);
  const drift = gain(0);
  chain(loop(noise, 0.93, 0.31, SEAM), filter('bandpass', 1700, 0.6), filter('lowpass', 3000, 0.5), gusts, drift, mix);
  sway(gusts.gain, 0.13, 0.24);
  sway(gusts.gain, 0.21, 0.14);
  waver(gusts.gain, 0, 0.12);

  // Water. One source, folded to the middle and set a little to the right, where the river leaves the picture.
  const water = filter('highpass', 200, 0.5);
  water.channelCount = 1;
  water.channelCountMode = 'explicit';
  const bank = pan(0.22);
  loop(noise, 1, 0.67, SEAM).connect(water);
  bank.connect(mix);
  const run = gain(0);
  const fall = gain(0);
  const lap = gain(0);
  [
    [360, 0],
    [590, 1],
    [930, 0],
  ].forEach(([hz, side], i) => {
    const g = gain(0.75);
    chain(water, filter('bandpass', hz, 4.5), g, run);
    // Each resonance has its own flutter: one curve, its other channel, and the first turned over.
    waver(g.gain, side, i === 2 ? -0.66 : 0.66);
  });
  chain(water, filter('lowpass', 520, 0.5), gain(0.9), run, bank);
  const pour = gain(0.9);
  chain(water, filter('highpass', 320, 0.5), filter('lowpass', 2400, 0.5), pour, fall, bank);
  waver(pour.gain, 1, 0.1);
  const swell = gain(0.66);
  chain(water, filter('bandpass', 620, 0.8), filter('lowpass', 1300, 0.5), swell, lap, bank);
  sway(swell.gain, 0.17, 0.4);
  sway(swell.gain, 0.29, 0.22);

  // The ice: far off, so it comes through a low-pass and twice more off the far shore.
  const far = filter('lowpass', 2200, 0.5);
  const ice = gain(1);
  chain(far, ice, mix);
  const left = ctx.createDelay(1);
  const right = ctx.createDelay(1);
  left.delayTime.value = 0.31;
  right.delayTime.value = 0.47;
  chain(ice, left, filter('lowpass', 900, 0.5), gain(0.34), pan(-0.6), mix);
  chain(ice, right, filter('lowpass', 700, 0.5), gain(0.3), pan(0.6), mix);
  chain(left, gain(0.3), right);
  chain(right, gain(0.3), left);

  const params: Record<(typeof KEYS)[number], AudioParam> = {
    wind: wind.gain,
    tone: tone.frequency,
    drift: drift.gain,
    run: run.gain,
    fall: fall.gain,
    lap: lap.gain,
    ice: ice.gain,
  };
  const told = { wind: 0, tone: 420, drift: 0, run: 0, fall: 0, lap: 0, ice: 1 };

  /** A voice's whole life as ramps: up from nothing, away to nothing. */
  const envelope = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(peak * 1e-4, t + attack + decay);
    g.gain.linearRampToValueAtTime(0, t + attack + decay + 0.03);
    return t + attack + decay + 0.05;
  };

  return {
    out: on,
    set(to, t) {
      for (const k of KEYS) {
        const v = to[k];
        if (Math.abs(v - told[k]) <= 1e-4 + 0.004 * Math.abs(told[k])) continue;
        told[k] = v;
        params[k].setTargetAtTime(v, t, GLIDE);
      }
    },
    power(up, t, tau) {
      on.gain.setTargetAtTime(up ? 1 : 0, t, tau);
    },
    crack(t, deep, a, b, c) {
      const place = pan(b * 1.4 - 0.7);
      place.connect(far);
      const o = ctx.createOscillator();
      const g = gain(0);
      chain(o, g, place);
      o.start(t);
      if (deep) {
        // A boom: the sheet giving somewhere out on the lake. A low thump and the rumble that follows it.
        const hz = 58 + 26 * a;
        o.frequency.setValueAtTime(hz * 1.7, t);
        o.frequency.exponentialRampToValueAtTime(hz, t + 0.22);
        o.stop(envelope(g, t, 0.1 + 0.06 * c, 0.008, 1.1 + 0.6 * a));
        const s = ctx.createBufferSource();
        const r = gain(0);
        s.buffer = noise;
        chain(s, filter('lowpass', 170 + 90 * c, 0.9), r, place);
        s.start(t, b * 7, 2.2);
        s.stop(envelope(r, t, 0.2 + 0.12 * c, 0.012, 1.3 + 0.5 * a));
      } else {
        // A ping: the high sound arrives first through ice, so the note falls as it comes.
        const hz = 520 + 620 * a;
        o.frequency.setValueAtTime(hz * 3.2, t);
        o.frequency.exponentialRampToValueAtTime(hz, t + 0.12 + 0.1 * c);
        o.stop(envelope(g, t, 0.03 + 0.03 * c, 0.004, 0.5 + 0.5 * a));
      }
    },
  };
}
