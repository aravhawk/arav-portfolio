/**
 * The graph: every node the site's sound is made of, built on whichever
 * context it is given. The page gives it an AudioContext; the checks give
 * it an OfflineAudioContext and get the same sound as a file.
 *
 * Nothing here is a recording. Wind, water, ice, bells and the bed are all
 * synthesised: oscillators, and noise this file generates and filters.
 *
 *   bed   pad voices -> low-pass -+-> bed bus ---------------------+
 *         bells, bass ------------+                                |
 *   world wind, stream, rush, sea -> world bus -> low-pass (canyon) +-> mix -> on/off -> compressor -> ceiling -> out
 *   fx    drops, cracks, shards, plucks, gate, wake -> fx bus ------+
 *   ui    ticks -> ui bus ------------------------------------------+
 *         sends from each -> pre-delay -> reverb -------------------+
 *         world -> echo (the canyon's walls) -----------------------+
 */

import { type Rng, hz } from './theory';

/** How loud each bus is in the mix. The bed sits well under the effects' peaks. */
export const LEVEL = { pad: 0.032, bell: 0.45, bass: 0.032, world: 0.85, fx: 0.62, ui: 0.16, verb: 0.5, ceiling: 0.84 };
/** The compressor adds this much of its own below its threshold (measured: +4.1 dB at these settings); it is taken back after it. */
const MAKEUP = 0.624;

/** A parameter that is steered every frame: it is only told when its target has moved, and it glides there. */
export class Steer {
  private last = NaN;
  constructor(
    private param: AudioParam,
    private tau: number,
    start: number,
  ) {
    param.value = start;
    this.last = start;
  }
  to(v: number, t: number, slow = 1) {
    if (!Number.isFinite(v)) return;
    if (Math.abs(v - this.last) <= 1e-4 + 0.004 * Math.abs(this.last)) return;
    this.last = v;
    this.param.setTargetAtTime(v, t, this.tau * slow);
  }
}

export interface PadNote {
  midi: number;
  gain: GainNode;
  oscs: OscillatorNode[];
}

export interface Graph {
  ctx: BaseAudioContext;
  /** the last node before the destination: a check can listen here */
  out: GainNode;
  on: AudioParam;
  bed: Steer;
  padCut: Steer;
  air: Steer;
  wind: Steer;
  windHz: Steer;
  whistle: Steer;
  whistleHz: Steer;
  windPan: Steer;
  stream: Steer;
  streamRate: Steer[];
  streamCut: Steer;
  streamPan: Steer;
  rush: Steer;
  rushHz: Steer;
  rushPan: Steer;
  sea: Steer;
  seaCut: Steer;
  wake: Steer;
  wakeHz: Steer;
  wakePan: Steer;
  worldCut: Steer;
  echo: Steer;
  worldSend: Steer;
  padIn: GainNode;
  bellIn: GainNode;
  fx: GainNode;
  ui: GainNode;
  verb: GainNode;
  noise: AudioBuffer;
  /** each bus's last node, for a check that wants to hear one alone */
  buses: { bed: GainNode; world: AudioNode; fx: GainNode; ui: GainNode };
  bass: { osc: OscillatorNode[]; gain: GainNode; midi: number };
  rng: Rng;
}

const pause = () => new Promise<void>((r) => setTimeout(r, 0));

/** Noise whose power falls by 3 dB an octave (Paul Kellet's filter), two channels that share nothing. */
function pinkBuffer(ctx: BaseAudioContext, rng: Rng, seconds: number): AudioBuffer {
  const n = Math.round(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
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
    // The loop's two ends are cross-faded into each other, so it has no seam.
    const x = Math.round(0.08 * ctx.sampleRate);
    for (let i = 0; i < x; i++) {
      const k = i / x;
      d[i] = d[i] * k + d[n - x + i] * (1 - k);
    }
    // (A finite stretch of pink noise has a mean of its own; looped, that would be a standing offset.)
    let mean = 0;
    for (let i = 0; i < n; i++) mean += d[i];
    mean /= n;
    for (let i = 0; i < n; i++) d[i] -= mean;
  }
  return buf;
}

function whiteBuffer(ctx: BaseAudioContext, rng: Rng, seconds: number): AudioBuffer {
  const n = Math.round(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (rng() * 2 - 1) * 0.5;
  }
  return buf;
}

/**
 * Running water, the way it is made: thousands of small bubbles, each a
 * short sine that rises as it dies. Many of them together are a stream.
 * The bubbles wrap round the buffer's end, so it loops without a seam.
 */
function streamBuffer(ctx: BaseAudioContext, rng: Rng, seconds: number, perSecond: number, lo: number, hi: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.round(seconds * sr);
  const buf = ctx.createBuffer(2, n, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const count = Math.round(seconds * perSecond);
  for (let b = 0; b < count; b++) {
    const start = Math.floor(rng() * n);
    // Small bubbles are high, short and many; large ones low, longer and few.
    const u = Math.pow(rng(), 0.7);
    const f0 = lo * Math.pow(hi / lo, u);
    const len = Math.round(sr * (0.006 + 0.05 * (lo / f0) * (0.5 + rng())));
    const rise = 0.06 + 0.5 * rng();
    const amp = (0.25 + 0.75 * rng() * rng()) * Math.pow(lo / f0, 0.35);
    const pan = rng();
    const gl = Math.cos((pan * Math.PI) / 2) * amp;
    const gr = Math.sin((pan * Math.PI) / 2) * amp;
    const damp = 5.5 / len;
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len;
      ph += (2 * Math.PI * f0 * (1 + rise * k)) / sr;
      const e = Math.min(1, i / 24) * Math.exp(-damp * i);
      const v = Math.sin(ph) * e;
      const at = (start + i) % n;
      L[at] += v * gl;
      R[at] += v * gr;
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = peak ? 0.5 / peak : 1;
  for (let i = 0; i < n; i++) {
    L[i] *= k;
    R[i] *= k;
  }
  return buf;
}

/** The place the sound sits in: a few early reflections, then a tail that darkens as it dies. */
function impulse(ctx: BaseAudioContext, rng: Rng, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.round(seconds * sr);
  const buf = ctx.createBuffer(2, n, sr);
  let energy = 0;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // The tail's top goes first: its low-pass closes from 9 kHz to about 900 Hz.
      const fc = 900 + 8100 * Math.exp(-t * 2.4);
      const a = Math.exp((-2 * Math.PI * fc) / sr);
      lp = a * lp + (1 - a) * (rng() * 2 - 1);
      // (Sixty decibels down in about two and three quarter seconds, and a soft start instead of a slap.)
      d[i] = lp * Math.exp(-t * 2.5) * Math.min(1, t / 0.012);
    }
    for (let k = 0; k < 7; k++) {
      const at = Math.round(sr * (0.004 + 0.07 * rng()));
      d[at] += (rng() < 0.5 ? -1 : 1) * 0.25 * (1 - k / 9);
    }
    // No tail is cut off: the last tenth fades to nothing.
    const fade = Math.round(n * 0.1);
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
    for (let i = 0; i < n; i++) energy += d[i] * d[i];
  }
  const k = 1 / Math.sqrt(energy / 2);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] *= k;
  }
  return buf;
}

/** The ceiling: nothing leaves above it. Straight up to 0.6, then bent over so it can never pass `top`. */
function ceilingCurve(top: number): Float32Array<ArrayBuffer> {
  const n = 4097;
  const c = new Float32Array(n);
  const knee = 0.6;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + (top - knee) * Math.tanh((a - knee) / (top - knee));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

function loop(ctx: BaseAudioContext, buf: AudioBuffer, offset = 0): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.start(0, offset);
  return src;
}

/** Build the graph. It is built in pieces with a breath between them, so turning sound on never holds a frame. */
export async function buildGraph(ctx: BaseAudioContext, rng: Rng): Promise<Graph> {
  const gain = (v: number) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const filter = (type: BiquadFilterType, f: number, q: number) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };
  const panner = () => ctx.createStereoPanner();

  // The way out: the sum, the on/off fade, a gentle compressor, the ceiling.
  const mix = gain(1);
  const onGain = gain(0);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const level = gain(MAKEUP);
  // (Nothing below hearing goes out: no standing offset, no sub-bass a small speaker would only rattle at.)
  const floor = filter('highpass', 24, 0.7);
  const ceiling = ctx.createWaveShaper();
  ceiling.curve = ceilingCurve(LEVEL.ceiling);
  const out = gain(1);
  mix.connect(floor).connect(onGain).connect(comp).connect(level).connect(ceiling).connect(out).connect(ctx.destination);

  // The place.
  const verb = gain(1);
  const pre = ctx.createDelay(0.1);
  pre.delayTime.value = 0.022;
  const conv = ctx.createConvolver();
  conv.normalize = false;
  conv.buffer = impulse(ctx, rng, 3.1);
  await pause();
  const verbOut = gain(LEVEL.verb);
  verb.connect(pre).connect(conv).connect(verbOut).connect(mix);

  // The bed.
  const bedBus = gain(1);
  bedBus.connect(mix);
  const padIn = gain(1);
  const padLP = filter('lowpass', 1800, 0.5);
  const padOut = gain(LEVEL.pad);
  const air = gain(0.3);
  padIn.connect(padLP).connect(padOut).connect(bedBus);
  padOut.connect(air).connect(verb);
  const bellIn = gain(LEVEL.bell);
  bellIn.connect(bedBus);
  const bassGain = gain(0);
  const bassLP = filter('lowpass', 240, 0.5);
  const bassOut = gain(LEVEL.bass);
  bassGain.connect(bassLP).connect(bassOut).connect(bedBus);
  const bassOsc = [ctx.createOscillator(), ctx.createOscillator()];
  bassOsc[0].type = 'sine';
  bassOsc[1].type = 'triangle';
  const bassTri = gain(0.35);
  bassOsc[0].connect(bassGain);
  bassOsc[1].connect(bassTri).connect(bassGain);
  for (const o of bassOsc) {
    o.frequency.value = hz(38);
    o.start(0);
  }

  // The world, heard through the place it is in.
  const worldBus = gain(LEVEL.world);
  const worldLP = filter('lowpass', 18000, 0.5);
  worldBus.connect(worldLP).connect(mix);
  const worldSend = gain(0.1);
  worldLP.connect(worldSend).connect(verb);
  const echoSend = gain(0);
  const echo = ctx.createDelay(0.5);
  echo.delayTime.value = 0.127;
  const echoBack = gain(0.38);
  const echoLP = filter('lowpass', 1700, 0.5);
  worldLP.connect(echoSend).connect(echo);
  echo.connect(echoLP).connect(echoBack).connect(echo);
  echoLP.connect(mix);

  const pink = pinkBuffer(ctx, rng, 6.3);
  await pause();
  const pink2 = pinkBuffer(ctx, rng, 7.9);
  await pause();
  const white = whiteBuffer(ctx, rng, 4.7);
  await pause();

  // Wind: a broad band of noise, and a thin whistle over it.
  const windSrc = loop(ctx, pink);
  const windBP = filter('bandpass', 400, 0.7);
  const windGain = gain(0);
  const whistleBP = filter('bandpass', 1300, 11);
  const whistleGain = gain(0);
  const windPan = panner();
  windSrc.connect(windBP).connect(windGain).connect(windPan);
  windSrc.connect(whistleBP).connect(whistleGain).connect(windPan);
  windPan.connect(worldBus);

  // Running water: two streams of bubbles of different lengths, so the pair never comes round together.
  const bubA = streamBuffer(ctx, rng, 8.3, 150, 480, 5200);
  await pause();
  const bubB = streamBuffer(ctx, rng, 6.1, 60, 300, 2400);
  await pause();
  const srcA = loop(ctx, bubA);
  const srcB = loop(ctx, bubB);
  const streamLP = filter('lowpass', 3000, 0.5);
  const streamGain = gain(0);
  const streamPan = panner();
  const bGain = gain(0.7);
  srcA.connect(streamLP);
  srcB.connect(bGain).connect(streamLP);
  streamLP.connect(streamGain).connect(streamPan).connect(worldBus);

  // White water.
  const rushSrc = loop(ctx, white);
  const rushBP = filter('bandpass', 1200, 0.8);
  const rushGain = gain(0);
  const rushPan = panner();
  rushSrc.connect(rushBP).connect(rushGain).connect(rushPan).connect(worldBus);

  // The sea: low noise, opened and closed by the swell.
  const seaSrc = loop(ctx, pink2);
  const seaLP = filter('lowpass', 600, 0.6);
  const seaGain = gain(0);
  seaSrc.connect(seaLP).connect(seaGain).connect(worldBus);

  // Effects and the pointer's wake.
  const fx = gain(LEVEL.fx);
  fx.connect(mix);
  const ui = gain(LEVEL.ui);
  ui.connect(mix);
  const wakeSrc = loop(ctx, white, 1.3);
  const wakeBP = filter('bandpass', 900, 1.3);
  const wakeGain = gain(0);
  const wakePan = panner();
  const wakeSend = gain(0.12);
  wakeSrc.connect(wakeBP).connect(wakeGain).connect(wakePan).connect(fx);
  wakePan.connect(wakeSend).connect(verb);

  return {
    ctx,
    out,
    on: onGain.gain,
    bed: new Steer(bedBus.gain, 0.25, 1),
    padCut: new Steer(padLP.frequency, 0.3, 1800),
    air: new Steer(air.gain, 0.3, 0.3),
    wind: new Steer(windGain.gain, 0.06, 0),
    windHz: new Steer(windBP.frequency, 0.08, 400),
    whistle: new Steer(whistleGain.gain, 0.1, 0),
    whistleHz: new Steer(whistleBP.frequency, 0.1, 1300),
    windPan: new Steer(windPan.pan, 0.2, 0),
    stream: new Steer(streamGain.gain, 0.05, 0),
    streamRate: [new Steer(srcA.playbackRate, 0.1, 1), new Steer(srcB.playbackRate, 0.1, 1)],
    streamCut: new Steer(streamLP.frequency, 0.06, 3000),
    streamPan: new Steer(streamPan.pan, 0.08, 0),
    rush: new Steer(rushGain.gain, 0.05, 0),
    rushHz: new Steer(rushBP.frequency, 0.06, 1200),
    rushPan: new Steer(rushPan.pan, 0.08, 0),
    sea: new Steer(seaGain.gain, 0.12, 0),
    seaCut: new Steer(seaLP.frequency, 0.12, 600),
    wake: new Steer(wakeGain.gain, 0.035, 0),
    wakeHz: new Steer(wakeBP.frequency, 0.04, 900),
    wakePan: new Steer(wakePan.pan, 0.04, 0),
    worldCut: new Steer(worldLP.frequency, 0.15, 18000),
    echo: new Steer(echoSend.gain, 0.15, 0),
    worldSend: new Steer(worldSend.gain, 0.15, 0.1),
    padIn,
    bellIn,
    fx,
    ui,
    verb,
    noise: white,
    buses: { bed: bedBus, world: worldLP, fx, ui },
    bass: { osc: bassOsc, gain: bassGain, midi: 38 },
    rng,
  };
}

/* ---------- voices ---------- */

/** A rise to `peak` in `attack` seconds, then an exponential fall with time constant `tau`. */
function pluckEnv(p: AudioParam, t: number, peak: number, attack: number, tau: number) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0, t + attack, tau);
}

/** A voice's way out: panned, to a bus, with a share to the reverb. */
function route(g: Graph, bus: AudioNode, pan: number, send: number): GainNode {
  const head = g.ctx.createGain();
  const p = g.ctx.createStereoPanner();
  p.pan.value = Math.min(1, Math.max(-1, pan));
  head.connect(p).connect(bus);
  if (send > 0) {
    const s = g.ctx.createGain();
    s.gain.value = send;
    p.connect(s).connect(g.verb);
  }
  return head;
}

function sine(g: Graph, f: number, t: number, stop: number, type: OscillatorType = 'sine'): OscillatorNode {
  const o = g.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(stop);
  return o;
}

/** A burst of noise through a filter. */
function burst(g: Graph, t: number, dur: number, type: BiquadFilterType, f: number, q: number): BiquadFilterNode {
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  const b = g.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.setValueAtTime(f, t);
  b.Q.value = q;
  src.connect(b);
  src.start(t, g.rng() * (g.noise.duration - dur - 0.05), dur + 0.05);
  return b;
}

/**
 * A note of the pad: two triangles a few cents apart, one to each side of
 * where the voice sits, so the chord is wide and slowly turning; an octave
 * above them by day, an octave below before dawn.
 */
export function padOn(g: Graph, midi: number, t: number, level: number, fade: number, night: number, pan = 0): PadNote {
  const f = hz(midi);
  const gn = g.ctx.createGain();
  gn.gain.setValueAtTime(0, t);
  gn.gain.setTargetAtTime(level, t, fade / 3);
  gn.connect(g.padIn);
  const parts: [OscillatorType, number, number, number, number][] = [
    ['triangle', f, -4, 0.5, pan - 0.4],
    ['triangle', f, 3, 0.5, pan + 0.4],
    ['sine', f * 2, 3, 0.2 * (1 - night), pan],
    ['sine', f / 2, -2, 0.42 * night, 0],
  ];
  const oscs: OscillatorNode[] = [];
  for (const [type, freq, cents, amp, where] of parts) {
    if (amp < 0.01) continue;
    const o = g.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = cents;
    const a = g.ctx.createGain();
    a.gain.value = amp;
    const p = g.ctx.createStereoPanner();
    p.pan.value = Math.min(1, Math.max(-1, where));
    o.connect(a).connect(p).connect(gn);
    o.start(t);
    oscs.push(o);
  }
  return { midi, gain: gn, oscs };
}

export function padOff(note: PadNote, t: number, fade: number) {
  note.gain.gain.setTargetAtTime(0, t, fade / 3);
  for (const o of note.oscs) o.stop(t + fade * 2.4);
}

/** The bass: it breathes out, takes its new note, and swells back in. */
export function bassTo(g: Graph, midi: number, t: number, level: number) {
  const b = g.bass;
  if (midi !== b.midi) {
    b.gain.gain.setTargetAtTime(0, t, 0.3);
    for (const o of b.osc) o.frequency.setValueAtTime(hz(midi), t + 1.1);
    b.gain.gain.setTargetAtTime(level, t + 1.1, 0.9);
    b.midi = midi;
  } else {
    b.gain.gain.setTargetAtTime(level, t, 0.9);
  }
}

export interface BellOpts {
  /** 0..1: how much of the upper partials */
  bright: number;
  /** seconds for the fundamental to fall to a twentieth */
  long: number;
  send: number;
  /** where it goes: the bed's bells, or the effects */
  bus?: AudioNode;
}

/** Glass struck softly: a fundamental and partials that are not its harmonics, each dying faster than the one below. */
export function bell(g: Graph, midi: number, t: number, vel: number, pan: number, o: BellOpts) {
  const f = hz(midi);
  const head = route(g, o.bus ?? g.bellIn, pan, o.send);
  head.gain.value = 0.2 * vel;
  const tau = o.long / 3;
  const parts: [number, number, number][] = [
    [1, 1, 1],
    [2, 0.22, 0.8],
    [2.76, 0.4 * o.bright, 0.5],
    [5.4, 0.18 * o.bright, 0.28],
    [8.93, 0.07 * o.bright, 0.15],
  ];
  for (const [ratio, amp, life] of parts) {
    if (amp < 0.01 || f * ratio > 11000) continue;
    const osc = sine(g, f * ratio, t, t + tau * life * 7 + 0.1);
    const e = g.ctx.createGain();
    pluckEnv(e.gain, t, amp, 0.004, tau * life);
    osc.connect(e).connect(head);
  }
}

/** A drop into water: a sine that leaps up as the surface closes over it, and the small splash it leaves. */
export function drop(g: Graph, t: number, f: number, gainV: number, pan: number, cut: number, send: number) {
  const head = route(g, g.fx, pan, send);
  head.gain.value = 0.5 * gainV;
  const o = sine(g, f * 0.62, t, t + 0.7);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
  o.frequency.exponentialRampToValueAtTime(f * 1.06, t + 0.3);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, 0.006, 0.075);
  const lp = g.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cut;
  o.connect(e).connect(lp).connect(head);
  // The ring it leaves: an octave and a fifth up, shorter.
  const o2 = sine(g, f * 1.5, t + 0.03, t + 0.5);
  o2.frequency.exponentialRampToValueAtTime(f * 2.02, t + 0.09);
  const e2 = g.ctx.createGain();
  pluckEnv(e2.gain, t + 0.03, 0.3, 0.004, 0.05);
  o2.connect(e2).connect(lp);
  // The surface breaking.
  const n = burst(g, t, 0.05, 'bandpass', Math.min(9000, f * 3), 1.2);
  const en = g.ctx.createGain();
  pluckEnv(en.gain, t, 0.22, 0.002, 0.012);
  n.connect(en).connect(lp);
}

/** A crack in the ice: a sharp tear of a few ticks, a low body under the big ones, and from far off the falling ring the sheet carries. */
export function crack(g: Graph, t: number, gainV: number, pan: number, cut: number, send: number, body: number, ring: number) {
  const head = route(g, g.fx, pan, send);
  head.gain.value = 0.5 * gainV;
  const ticks = 1 + Math.floor(g.rng() * 3 + body * 2);
  let at = t;
  for (let i = 0; i < ticks; i++) {
    const n = burst(g, at, 0.05, 'bandpass', cut * (0.8 + 0.5 * g.rng()), 2.2);
    const e = g.ctx.createGain();
    pluckEnv(e.gain, at, i === 0 ? 1 : 0.35 + 0.4 * g.rng(), 0.0012, 0.006 + 0.03 * g.rng() * (0.4 + body));
    n.connect(e).connect(head);
    at += 0.006 + 0.03 * g.rng();
  }
  if (body > 0.02) {
    const f = 150 - 60 * body;
    const o = sine(g, f * 1.5, t, t + 0.8);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const e = g.ctx.createGain();
    pluckEnv(e.gain, t, 0.8 * body, 0.004, 0.11);
    o.connect(e).connect(head);
  }
  if (ring > 0.05) {
    // A crack heard through the sheet arrives high notes first: a chirp that falls.
    const o = sine(g, 2600 + 1400 * g.rng(), t + 0.01, t + 0.6);
    o.frequency.exponentialRampToValueAtTime(380 + 200 * g.rng(), t + 0.2 + 0.1 * g.rng());
    const e = g.ctx.createGain();
    pluckEnv(e.gain, t + 0.01, 0.16 * ring, 0.006, 0.07);
    o.connect(e).connect(head);
  }
}

/** The ice lying whole: a low moan, two notes that lean on each other, far away. */
export function groan(g: Graph, t: number, pan: number) {
  const head = route(g, g.fx, pan, 0.8);
  head.gain.value = 0.05;
  const f = 58 + 30 * g.rng();
  const len = 1.4 + 1.4 * g.rng();
  for (const k of [1, 1.493]) {
    const o = sine(g, f * k, t, t + len + 1.5);
    o.frequency.linearRampToValueAtTime(f * k * (0.9 + 0.16 * g.rng()), t + len);
    const e = g.ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(k === 1 ? 1 : 0.5, t + len * 0.35);
    e.gain.setTargetAtTime(0, t + len * 0.5, len * 0.25);
    o.connect(e).connect(head);
  }
}

/** One cube of the lattice: a short, clear pluck. */
export function pluck(g: Graph, midi: number, t: number, gainV: number, pan: number, cut: number, send: number) {
  const f = hz(midi);
  const head = route(g, g.fx, pan, send);
  head.gain.value = 0.2 * gainV;
  const lp = g.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cut;
  lp.connect(head);
  const o = sine(g, f, t, t + 1.4, 'triangle');
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, 0.003, 0.16);
  o.connect(e).connect(lp);
  const o2 = sine(g, f * 2, t, t + 0.6);
  const e2 = g.ctx.createGain();
  pluckEnv(e2.gain, t, 0.3, 0.002, 0.05);
  o2.connect(e2).connect(lp);
}

/** A shard's voice: glass, with a breath at its start. */
export function shard(g: Graph, midi: number, t: number, gainV: number, pan: number, cut: number, send: number, night: number) {
  bell(g, midi, t, 0.42 * gainV, pan, { bright: 0.7 - 0.4 * night, long: 3.4 + 1.4 * night, send, bus: g.fx });
  bell(g, midi - 12, t + 0.012, 0.15 * gainV, pan, { bright: 0.1, long: 2.6, send, bus: g.fx });
  const head = route(g, g.fx, pan, send);
  head.gain.value = 0.025 * gainV;
  const n = burst(g, t, 0.3, 'bandpass', Math.min(cut, hz(midi) * 2), 3);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, 0.02, 0.07);
  n.connect(e).connect(head);
}

/** A drip: a very small drop, high and dry. */
export function drip(g: Graph, t: number, midi: number, gainV: number, pan: number, send: number) {
  const f = hz(midi);
  const head = route(g, g.fx, pan, send);
  head.gain.value = 0.09 * gainV;
  const o = sine(g, f * 0.75, t, t + 0.4);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.02);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, 0.003, 0.035);
  o.connect(e).connect(head);
}

/** A link or a control, hovered or pressed: one small tuned tick. */
export function tick(g: Graph, t: number, midi: number, gainV: number, pan: number, cut: number, send: number, press: boolean) {
  const f = hz(midi);
  const head = route(g, g.ui, pan, send);
  head.gain.value = (press ? 0.34 : 0.24) * gainV;
  const lp = g.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cut;
  lp.connect(head);
  const o = sine(g, f, t, t + 0.6);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, press ? 0.002 : 0.004, press ? 0.05 : 0.028);
  o.connect(e).connect(lp);
  if (press) {
    // A press has a body: the fifth below, shorter.
    const o2 = sine(g, f / 1.5, t, t + 0.4);
    const e2 = g.ctx.createGain();
    pluckEnv(e2.gain, t, 0.5, 0.002, 0.03);
    o2.connect(e2).connect(lp);
  }
}

/** The switch is thrown: the latch lets go, and the gate that is to open scrapes upward for as long as it takes to lift. */
export function gateLift(g: Graph, t: number, pan: number) {
  const head = route(g, g.fx, pan, 0.25);
  head.gain.value = 0.3;
  const f = hz(50);
  const o = sine(g, f * 1.6, t, t + 0.5);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 0.5, 0.003, 0.05);
  o.connect(e).connect(head);
  const s = burst(g, t, 0.5, 'bandpass', 2100, 4);
  s.frequency.exponentialRampToValueAtTime(3600, t + 0.45);
  const es = g.ctx.createGain();
  es.gain.setValueAtTime(0, t);
  es.gain.linearRampToValueAtTime(0.12, t + 0.1);
  es.gain.setTargetAtTime(0, t + 0.3, 0.06);
  s.connect(es).connect(head);
}

/** A gate comes to rest: set down, a low knock of ice on ice on the key's root; fully lifted, a lighter one a fifth above. */
export function gateSet(g: Graph, t: number, pan: number, down: boolean) {
  const head = route(g, g.fx, pan, 0.3);
  head.gain.value = down ? 0.3 : 0.16;
  const f = hz(down ? 38 : 45);
  const o = sine(g, f * 1.8, t, t + 0.9);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, 0.004, down ? 0.13 : 0.07);
  o.connect(e).connect(head);
  const n = burst(g, t, 0.12, 'lowpass', down ? 420 : 900, 0.7);
  const en = g.ctx.createGain();
  pluckEnv(en.gain, t, down ? 0.7 : 0.4, 0.002, 0.03);
  n.connect(en).connect(head);
}

/** Air moving: a band of noise that sweeps from one colour to another. For a change of page and a change of theme. */
export function whoosh(g: Graph, t: number, dur: number, from: number, to: number, gainV: number, pan: number) {
  const head = route(g, g.fx, pan, 0.3);
  head.gain.value = gainV;
  const n = burst(g, t, dur + 0.3, 'bandpass', from, 1.1);
  n.frequency.exponentialRampToValueAtTime(to, t + dur);
  const e = g.ctx.createGain();
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(1, t + dur * 0.45);
  e.gain.setTargetAtTime(0, t + dur * 0.5, dur * 0.2);
  n.connect(e).connect(head);
}

/** A low bloom: the moment the last of the ice has gone, and the moment the sun clears the ranges. */
export function bloom(g: Graph, t: number, midi: number, gainV: number, len: number) {
  const head = route(g, g.fx, 0, 0.5);
  head.gain.value = 0.1 * gainV;
  for (const [k, a] of [
    [1, 1],
    [1.5, 0.45],
    [2, 0.3],
  ]) {
    const o = sine(g, hz(midi) * k, t, t + len * 3 + 1);
    const e = g.ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.setTargetAtTime(a, t, len * 0.3);
    e.gain.setTargetAtTime(0, t + len, len * 0.45);
    o.connect(e).connect(head);
  }
}
