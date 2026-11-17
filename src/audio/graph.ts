/**
 * The graph: every node the site's sound is made of, built on whichever
 * context it is given. The page gives it an AudioContext; the checks give
 * it an OfflineAudioContext and get the same sound as a file.
 *
 * Nothing here is a recording. Wind, water, ice, bells and the bed are all
 * synthesised: oscillators, a bubble model running in a worklet (water.ts),
 * and noise made as it is needed.
 *
 *   bed   pad voices -> low-pass -+-> bed bus ----------------------+
 *         bells, bass, aurora ----+                                 |
 *   world wind, water (worklet) -> world bus -> low-pass (canyon) --+-> mix -> on/off -> compressor -> ceiling -> out
 *   fx    drops, ice, shards, plucks, gate, wake -> fx bus ---------+
 *   ui    ticks -> ui bus -------------------------------------------+
 *         sends from each -> the place: three rooms, cross-faded ----+
 *         world, fx -> the canyon's slap (a delay, timed by its walls)+
 */

import { type Crack, chirpAt, chirpLen } from './mapping';
import { type Rng, hz } from './theory';
import { type Water, makeWater } from './water';

/** How loud each bus is in the mix. The bed sits well under the effects' peaks. */
export const LEVEL = { pad: 0.034, bell: 0.45, bass: 0.03, aurora: 0.011, world: 0.85, water: 0.3, fx: 0.62, ui: 0.16, verb: 0.5, ceiling: 0.84 };
/** The compressor adds this much of its own below its threshold (measured: +4.1 dB at these settings); it is taken back after it. */
const MAKEUP = 0.624;

/** How much is built. The lean tier is for phones: fewer oscillators, fewer bubbles, and one small reverb in place of three rooms. */
export interface Tier {
  lean: boolean;
  /** how many bubbles may sound at once */
  bubbles: number;
}
export const FULL: Tier = { lean: false, bubbles: 72 };
export const LEAN: Tier = { lean: true, bubbles: 26 };

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
  tier: Tier;
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
  wake: Steer;
  wakeHz: Steer;
  wakePan: Steer;
  aurora: Steer;
  shimmer: { gain: Steer; pan: Steer }[];
  worldCut: Steer;
  echo: Steer;
  fxEcho: Steer;
  echoTime: Steer;
  worldSend: Steer;
  /** Cross-fade the place: how much of the open room, the canyon and the still room. */
  rooms(w: [number, number, number], t: number): void;
  water: Water;
  padIn: GainNode;
  bellIn: GainNode;
  fx: GainNode;
  ui: GainNode;
  verb: GainNode;
  noise: AudioBuffer;
  /** slow movement the pad's notes borrow, so no two of them breathe alike */
  lfo: OscillatorNode[];
  /** each bus's way into the place, so a bus can be heard alone with its own room and no one else's */
  sends: { bed: GainNode; world: GainNode; fx: GainNode; ui: GainNode };
  /** each bus's last nodes, for a check that wants to hear one alone */
  buses: { bed: AudioNode[]; world: AudioNode[]; fx: AudioNode[]; ui: AudioNode[] };
  bass: { osc: OscillatorNode[]; gain: GainNode; midi: number };
  rng: Rng;
}

const pause = () => new Promise<void>((r) => setTimeout(r, 0));

/** Noise whose power falls by 3 dB an octave (Paul Kellet's filter), two channels that share nothing. Only for a browser without a worklet. */
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

/** What makes a room: how long, how its first reflections fall, how its tail darkens, how wide it is. */
interface Room {
  seconds: number;
  /** sixty decibels down in about 6.9 / decay seconds */
  decay: number;
  /** the tail's low-pass: where it starts, where it ends, how fast it closes (Hz, Hz, per second) */
  from: number;
  to: number;
  close: number;
  /** first reflections: how many, over how long (seconds), how strong */
  taps: number;
  span: number;
  tap: number;
  /** 0..1: how different the two sides are */
  wide: number;
  /** seconds for the tail to come up: a soft start instead of a slap */
  soft: number;
}

export const ROOMS: { open: Room; canyon: Room; still: Room } = {
  // The open lake and the sea: long and wide, a few reflections far apart.
  open: { seconds: 3.4, decay: 2.3, from: 9000, to: 900, close: 2.4, taps: 6, span: 0.16, tap: 0.22, wide: 1, soft: 0.014 },
  // The canyon: short, dense and dark, the walls close on both sides.
  canyon: { seconds: 1.0, decay: 7.2, from: 3600, to: 600, close: 5, taps: 34, span: 0.07, tap: 0.3, wide: 0.45, soft: 0.003 },
  // The tarn and the pools: a short bright tail over still water.
  still: { seconds: 0.8, decay: 9, from: 13000, to: 5200, close: 3, taps: 9, span: 0.045, tap: 0.2, wide: 0.8, soft: 0.006 },
};

/** A room, generated: a few early reflections, then a tail that darkens as it dies. */
export function impulse(ctx: BaseAudioContext, rng: Rng, room: Room): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.round(room.seconds * sr);
  const buf = ctx.createBuffer(2, n, sr);
  let energy = 0;
  const shared = new Float32Array(n);
  for (let i = 0; i < n; i++) shared[i] = rng() * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    let a = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // (The low-pass closes slowly: its coefficient is worked out every few milliseconds.)
      if ((i & 127) === 0) a = Math.exp((-2 * Math.PI * (room.to + (room.from - room.to) * Math.exp(-t * room.close))) / sr);
      const w = room.wide * (rng() * 2 - 1) + (1 - room.wide) * shared[i];
      lp = a * lp + (1 - a) * w;
      d[i] = lp * Math.exp(-t * room.decay) * Math.min(1, t / room.soft);
    }
    for (let k = 0; k < room.taps; k++) {
      const at = Math.round(sr * (0.004 + room.span * rng()));
      d[at] += (rng() < 0.5 ? -1 : 1) * room.tap * (1 - k / (room.taps + 2));
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
export async function buildGraph(ctx: BaseAudioContext, rng: Rng, tier: Tier = FULL): Promise<Graph> {
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
  const panner = (p = 0) => {
    const n = ctx.createStereoPanner();
    n.pan.value = p;
    return n;
  };
  const osc = (type: OscillatorType, f: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.start(0);
    return o;
  };

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

  // The water model, and the live noise that comes with it.
  const water = await makeWater(ctx, Math.floor(rng() * 4294967295) + 1, tier.bubbles);
  await pause();

  // The place. Every send arrives at `verb` and is shared out between the rooms by where the camera is.
  const verb = gain(1);
  const sends = { bed: gain(1), world: gain(1), fx: gain(1), ui: gain(1) };
  for (const s of Object.values(sends)) s.connect(verb);
  let rooms: Graph['rooms'];
  if (!tier.lean) {
    const sends: Steer[] = [];
    const specs: [Room, number, number][] = [
      [ROOMS.open, 0.026, 1],
      [ROOMS.canyon, 0.006, 1.05],
      [ROOMS.still, 0.012, 0.85],
    ];
    for (const [room, pre, trim] of specs) {
      const send = gain(room === ROOMS.open ? 1 : 0);
      const delay = ctx.createDelay(0.1);
      delay.delayTime.value = pre;
      const conv = ctx.createConvolver();
      conv.normalize = false;
      conv.buffer = impulse(ctx, rng, room);
      await pause();
      verb.connect(send).connect(delay).connect(conv).connect(gain(LEVEL.verb * trim)).connect(mix);
      sends.push(new Steer(send.gain, 0.35, room === ROOMS.open ? 1 : 0));
    }
    rooms = (w, t) => sends.forEach((s, i) => s.to(w[i], t));
  } else {
    // One small reverb for a phone: six delays that feed themselves through a low-pass. How long it rings and how
    // dark it is follow the place, instead of three rooms.
    const back: Steer[] = [];
    const damp: Steer[] = [];
    const verbOut = gain(LEVEL.verb * 0.42);
    [0.0297, 0.0371, 0.0411, 0.0437, 0.0533, 0.0617].forEach((d, i) => {
      const delay = ctx.createDelay(0.1);
      delay.delayTime.value = d;
      // (No peak at all in the loop's low-pass, or the loop would ring at it: a low-pass with any resonance gains more than one just under its corner.)
      const lp = filter('lowpass', 4200, -3);
      const fb = gain(0.84);
      verb.connect(delay);
      delay.connect(lp).connect(fb).connect(delay);
      lp.connect(panner(i % 2 ? 0.7 : -0.7)).connect(verbOut);
      back.push(new Steer(fb.gain, 0.3, 0.84));
      damp.push(new Steer(lp.frequency, 0.3, 4200));
    });
    verbOut.connect(mix);
    rooms = (w, t) => {
      const fb = 0.86 * w[0] + 0.7 * w[1] + 0.62 * w[2];
      const cut = 4200 * w[0] + 1500 * w[1] + 7000 * w[2];
      back.forEach((s) => s.to(fb, t));
      damp.forEach((s) => s.to(cut, t));
    };
  }

  // Slow movement, shared: four rates that never line up. The pad's notes each borrow two.
  const lfo = [0.071, 0.113, 0.167, 0.229].map((f) => osc('sine', f));

  // The bed.
  const bedBus = gain(1);
  bedBus.connect(mix);
  const padIn = gain(1);
  const padLP = filter('lowpass', 1800, 0.5);
  const padOut = gain(LEVEL.pad);
  const air = gain(0.3);
  padIn.connect(padLP).connect(padOut).connect(bedBus);
  padOut.connect(air).connect(sends.bed);
  // (The pad's brightness is never quite still: its low-pass leans a little either way, slowly.)
  const sway = gain(110);
  lfo[0].connect(sway).connect(padLP.detune);
  const bellIn = gain(LEVEL.bell);
  bellIn.connect(bedBus);
  // The bass: one voice with its own overtones, so its line is still there on a speaker that has no bass.
  const bassGain = gain(0);
  const bassLP = filter('lowpass', tier.lean ? 620 : 440, 0.5);
  const bassOut = gain(LEVEL.bass);
  bassGain.connect(bassLP).connect(bassOut).connect(bedBus);
  const bassOsc = ctx.createOscillator();
  bassOsc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, 0.5, 0.3, 0.16, 0.08, 0.04])));
  bassOsc.frequency.value = hz(38);
  bassOsc.connect(bassGain);
  bassOsc.start(0);

  // The aurora: a few very high partials, each coming and going with the curtains.
  const auroraBus = gain(0);
  auroraBus.connect(bedBus);
  const auroraSend = gain(0.9);
  auroraBus.connect(auroraSend).connect(sends.bed);
  const trem = [osc('sine', 4.3), osc('sine', 6.1)];
  const shimmer = (tier.lean ? [98, 102, 105] : [98, 100, 102, 105, 107]).map((m, i) => {
    const o = osc('sine', hz(m) * (1 + 0.002 * (i - 2)));
    const g = gain(0);
    const flutter = gain(1);
    const depth = gain(0.3);
    trem[i % 2].connect(depth).connect(flutter.gain);
    const p = panner();
    o.connect(g).connect(flutter).connect(p).connect(auroraBus);
    return { gain: new Steer(g.gain, 0.5, 0), pan: new Steer(p.pan, 0.5, 0) };
  });

  // The world, heard through the place it is in.
  const worldBus = gain(LEVEL.world);
  const worldLP = filter('lowpass', 18000, 0.5);
  worldBus.connect(worldLP).connect(mix);
  const worldSend = gain(0.1);
  worldLP.connect(worldSend).connect(sends.world);
  // The canyon's slap: one clear echo off the wall, and what is left of it off the other.
  const echoSend = gain(0);
  const fxEcho = gain(0);
  const echo = ctx.createDelay(0.5);
  echo.delayTime.value = 0.127;
  const echoBack = gain(0.34);
  const echoLP = filter('lowpass', 1900, 0.5);
  worldLP.connect(echoSend).connect(echo);
  echo.connect(echoLP).connect(echoBack).connect(echo);
  echoLP.connect(mix);

  const white = whiteBuffer(ctx, rng, 2.6);
  await pause();

  // Wind: a broad band of noise, and a thin whistle over it. The noise is made live where the browser can.
  const windSrc: AudioNode = water.pink ?? loop(ctx, pinkBuffer(ctx, rng, 6.3));
  await pause();
  const windBP = filter('bandpass', 400, 0.7);
  const windGain = gain(0);
  const whistleBP = filter('bandpass', 1300, 11);
  const whistleGain = gain(0);
  const windPan = panner();
  windSrc.connect(windBP).connect(windGain).connect(windPan);
  windSrc.connect(whistleBP).connect(whistleGain).connect(windPan);
  windPan.connect(worldBus);

  // The water.
  if (water.out) water.out.connect(gain(LEVEL.water)).connect(worldBus);

  // Effects, and the air the pointer moves over the water.
  const fx = gain(LEVEL.fx);
  fx.connect(mix);
  fx.connect(fxEcho).connect(echo);
  const ui = gain(LEVEL.ui);
  ui.connect(mix);
  const wakeSrc: AudioNode = water.white ?? loop(ctx, white, 1.3);
  const wakeBP = filter('bandpass', 900, 1.3);
  const wakeGain = gain(0);
  const wakePan = panner();
  const wakeSend = gain(0.12);
  wakeSrc.connect(wakeBP).connect(wakeGain).connect(wakePan).connect(fx);
  wakePan.connect(wakeSend).connect(sends.fx);

  return {
    ctx,
    tier,
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
    wake: new Steer(wakeGain.gain, 0.035, 0),
    wakeHz: new Steer(wakeBP.frequency, 0.04, 900),
    wakePan: new Steer(wakePan.pan, 0.04, 0),
    aurora: new Steer(auroraBus.gain, 0.6, 0),
    shimmer,
    worldCut: new Steer(worldLP.frequency, 0.15, 18000),
    echo: new Steer(echoSend.gain, 0.15, 0),
    fxEcho: new Steer(fxEcho.gain, 0.15, 0),
    echoTime: new Steer(echo.delayTime, 0.25, 0.127),
    worldSend: new Steer(worldSend.gain, 0.15, 0.1),
    rooms,
    water,
    padIn,
    bellIn,
    fx,
    ui,
    verb,
    noise: white,
    lfo,
    sends,
    buses: { bed: [bedBus, sends.bed], world: [worldLP, sends.world], fx: [fx, sends.fx], ui: [ui, sends.ui] },
    bass: { osc: [bassOsc], gain: bassGain, midi: 38 },
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
    p.connect(s).connect(bus === g.bellIn ? g.sends.bed : bus === g.ui ? g.sends.ui : g.sends.fx);
  }
  return head;
}

/** Take back a voice that was set for a time that will not come (the picture's clock was disturbed): it is silenced before it begins, or let go in a few milliseconds if it has begun. */
export function hush(head: GainNode, t: number) {
  head.gain.cancelScheduledValues(t);
  head.gain.setTargetAtTime(0, t, 0.004);
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
 * A note of the pad. Two triangles a few cents apart, one to each side of
 * where the voice sits, an octave above them by day and an octave below
 * before dawn. And it breathes: each oscillator's tuning drifts at its own
 * slow rate (so the chorus is never a fixed beat), the note's level leans a
 * little in and out, and it begins with a breath of air at its own pitch.
 */
export function padOn(g: Graph, midi: number, t: number, level: number, fade: number, night: number, pan = 0): PadNote {
  const f = hz(midi);
  const lean = g.tier.lean;
  const gn = g.ctx.createGain();
  gn.gain.setValueAtTime(0, t);
  gn.gain.setTargetAtTime(level, t, fade / 3);
  const swell = g.ctx.createGain();
  const lean0 = g.ctx.createGain();
  lean0.gain.value = 0.07 + 0.08 * g.rng();
  g.lfo[1 + Math.floor(g.rng() * 3)].connect(lean0).connect(swell.gain);
  gn.connect(swell).connect(g.padIn);
  const parts: [OscillatorType, number, number, number, number][] = [
    ['triangle', f, -4 - 2 * g.rng(), 0.5, pan - 0.4],
    ['triangle', f, 3 + 2 * g.rng(), 0.5, pan + 0.4],
    ['sine', f * 2, 3, lean ? 0 : 0.2 * (1 - night), pan],
    ['sine', f / 2, -2, 0.42 * night, 0],
  ];
  const oscs: OscillatorNode[] = [];
  parts.forEach(([type, freq, cents, amp, where], i) => {
    if (amp < 0.01) return;
    const o = g.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = cents;
    if (i < 2) {
      // The two triangles drift against each other: a few cents, each at a rate of its own.
      const drift = g.ctx.createGain();
      drift.gain.value = (i ? 1 : -1) * (2.5 + 3.5 * g.rng());
      g.lfo[(Math.floor(g.rng() * 4) + i) % 4].connect(drift).connect(o.detune);
    }
    const a = g.ctx.createGain();
    a.gain.value = amp;
    const p = g.ctx.createStereoPanner();
    p.pan.value = Math.min(1, Math.max(-1, where));
    o.connect(a).connect(p).connect(gn);
    o.start(t);
    oscs.push(o);
  });
  if (!lean && level > 0) {
    // The breath: air at the note's own pitch as it comes in, gone within a second or two.
    const n = burst(g, t, 2.4, 'bandpass', Math.min(6000, f * 2), 5);
    const e = g.ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.5 * level, t + Math.min(0.7, fade * 0.3));
    e.gain.setTargetAtTime(0, t + Math.min(0.7, fade * 0.3), 0.55);
    const p = g.ctx.createStereoPanner();
    p.pan.value = Math.min(1, Math.max(-1, pan * 1.6));
    n.connect(e).connect(p).connect(g.padIn);
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
export function bell(g: Graph, midi: number, t: number, vel: number, pan: number, o: BellOpts): GainNode {
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
  parts.forEach(([ratio, amp, life], i) => {
    if (amp < 0.01 || f * ratio > 11000 || (g.tier.lean && i > 2)) return;
    const osc = sine(g, f * ratio, t, t + tau * life * 7 + 0.1);
    const e = g.ctx.createGain();
    pluckEnv(e.gain, t, amp, 0.004, tau * life);
    osc.connect(e).connect(head);
  });
  return head;
}

/** A drop into water: a sine that leaps up as the surface closes over it, and the small splash it leaves. */
export function drop(g: Graph, t: number, f: number, gainV: number, pan: number, cut: number, send: number): GainNode {
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
  return head;
}

/**
 * One arrival of a crack through the sheet: a sine that begins at `top`
 * and falls as the sheet's dispersion says it must (see `chirpAt`), loudest
 * where it sweeps fastest, its top worn away by distance.
 */
function chirp(g: Graph, head: AudioNode, t: number, disp: number, top: number, foot: number, amp: number) {
  const len = Math.max(0.012, chirpLen(disp, top, foot));
  const N = 40;
  const fs = new Float32Array(N);
  const as = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const at = (len * i) / (N - 1);
    const f = chirpAt(at, disp, top);
    fs[i] = f;
    const k = i / (N - 1);
    as[i] = i === 0 || i === N - 1 ? 0 : amp * Math.min(1, Math.pow(f / 2400, 0.75)) * Math.exp(-f / (top * 1.3)) * 2.2 * (k > 0.75 ? (1 - k) / 0.25 : 1);
  }
  const o = g.ctx.createOscillator();
  o.frequency.setValueCurveAtTime(fs, t, len);
  const e = g.ctx.createGain();
  e.gain.setValueAtTime(0, 0);
  e.gain.setValueCurveAtTime(as, t, len);
  o.connect(e).connect(head);
  o.start(t);
  o.stop(t + len + 0.02);
}

/**
 * A crack in the ice, as the sheet carries it: the snap itself (heard only
 * from near), the falling chirp that follows it, a second, slower arrival
 * under that, a low body under the big ones, and from the whole sheet what
 * comes back off the far shore, later, longer and to the other side.
 */
export function iceCrack(g: Graph, t: number, v: Crack, gainV = 1): GainNode {
  const head = route(g, g.fx, v.pan, v.send);
  head.gain.value = 0.26 * v.gain * gainV;
  const lean = g.tier.lean;
  if (v.tick > 0.03) {
    const ticks = 1 + Math.floor(g.rng() * 2 + v.body * 2);
    let at = t;
    for (let i = 0; i < ticks; i++) {
      const n = burst(g, at, 0.04, 'bandpass', 2600 + 2600 * g.rng(), 1.8);
      const e = g.ctx.createGain();
      pluckEnv(e.gain, at, v.tick * (i === 0 ? 1 : 0.3 + 0.4 * g.rng()), 0.0012, 0.004 + 0.012 * g.rng());
      n.connect(e).connect(head);
      at += 0.005 + 0.025 * g.rng();
    }
  }
  chirp(g, head, t, v.disp, v.top, v.foot, 1);
  // A second way through the sheet: slower, lower, softer. It is what makes the ping a twang.
  if (!lean) chirp(g, head, t + 0.002 + v.disp * 0.0012, v.disp * 1.55, v.top * 0.62, v.foot * 0.8, 0.36);
  if (v.body > 0.02) {
    const f = 96 - 40 * v.body;
    const o = sine(g, f * 1.7, t, t + 2.2);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(f * 0.72, t + 1.6);
    const e = g.ctx.createGain();
    pluckEnv(e.gain, t, 0.75 * v.body, 0.008, 0.16 + 0.3 * v.body);
    o.connect(e).connect(head);
  }
  if (v.echo > 0.08 && !lean) {
    // The far shore's answer.
    const back = route(g, g.fx, -0.6 * v.pan, 0.9);
    back.gain.value = 0.26 * v.gain * gainV * 0.3 * v.echo;
    chirp(g, back, t + 0.3 + 0.5 * g.rng(), v.disp * (2.3 + 1.2 * g.rng()), v.top * 0.5, v.foot * 0.75, 1);
  }
  return head;
}

/** Two floes touch: a short dry knock of ice on ice, high and small. */
export function clink(g: Graph, t: number, f: number, gainV: number, pan: number, send: number): GainNode {
  const head = route(g, g.fx, pan, send);
  head.gain.value = 0.1 * gainV;
  for (const [k, a, tau] of [
    [1, 1, 0.03],
    [2.32, 0.5, 0.016],
    [4.25, 0.2, 0.008],
  ]) {
    const o = sine(g, f * k, t, t + 0.3);
    const e = g.ctx.createGain();
    pluckEnv(e.gain, t, a, 0.001, tau);
    o.connect(e).connect(head);
  }
  return head;
}

/** The ice lying whole: a long low boom, two notes that lean on each other, far away, and sometimes the sheet's own slow call over it. */
export function groan(g: Graph, t: number, pan: number, call: number): GainNode {
  const head = route(g, g.fx, pan, 0.85);
  head.gain.value = 0.055;
  const f = 52 + 30 * g.rng();
  const len = 1.6 + 1.8 * g.rng();
  for (const k of [1, 1.493]) {
    const o = sine(g, f * k, t, t + len + 2);
    o.frequency.linearRampToValueAtTime(f * k * (0.86 + 0.12 * g.rng()), t + len);
    const e = g.ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(k === 1 ? 1 : 0.5, t + len * 0.35);
    e.gain.setTargetAtTime(0, t + len * 0.5, len * 0.3);
    o.connect(e).connect(head);
  }
  // (From very far the whole of a crack is one long falling note.)
  if (call > 0) chirp(g, head, t + 0.2 + 0.4 * g.rng(), 22 + 12 * g.rng(), 2600, 150, 2.4 * call);
  return head;
}

/** One cube of the lattice: a short, clear pluck. */
export function pluck(g: Graph, midi: number, t: number, gainV: number, pan: number, cut: number, send: number): GainNode {
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
  return head;
}

/** A shard's voice: glass, with a breath at its start. */
export function shard(g: Graph, midi: number, t: number, gainV: number, pan: number, cut: number, send: number, night: number): GainNode {
  const head = g.ctx.createGain();
  head.connect(g.fx);
  bell(g, midi, t, 0.42 * gainV, pan, { bright: 0.7 - 0.4 * night, long: 3.4 + 1.4 * night, send, bus: head });
  bell(g, midi - 12, t + 0.012, 0.15 * gainV, pan, { bright: 0.1, long: 2.6, send, bus: head });
  const air = route(g, head, pan, send);
  air.gain.value = 0.025 * gainV;
  const n = burst(g, t, 0.3, 'bandpass', Math.min(cut, hz(midi) * 2), 3);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, 0.02, 0.07);
  n.connect(e).connect(air);
  return head;
}

/** A drip: a very small drop, high and dry. */
export function drip(g: Graph, t: number, midi: number, gainV: number, pan: number, send: number): GainNode {
  const f = hz(midi);
  const head = route(g, g.fx, pan, send);
  head.gain.value = 0.09 * gainV;
  const o = sine(g, f * 0.75, t, t + 0.4);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.02);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, 0.003, 0.035);
  o.connect(e).connect(head);
  return head;
}

/** A link or a control, hovered or pressed: one small tuned tick. */
export function tick(g: Graph, t: number, midi: number, gainV: number, pan: number, cut: number, send: number, press: boolean): GainNode {
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
  return head;
}

/** The switch is thrown: the latch lets go, and the gate that is to open scrapes upward for as long as it takes to lift. */
export function gateLift(g: Graph, t: number, pan: number): GainNode {
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
  return head;
}

/** A gate comes to rest: set down, a low knock of ice on ice on the key's root; fully lifted, a lighter one a fifth above. */
export function gateSet(g: Graph, t: number, pan: number, down: boolean): GainNode {
  const head = route(g, g.fx, pan, 0.3);
  head.gain.value = down ? 0.3 : 0.16;
  const f = hz(down ? 38 : 45);
  const o = sine(g, f * 1.8, t, t + 0.9);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  const e = g.ctx.createGain();
  pluckEnv(e.gain, t, 1, 0.004, down ? 0.13 : 0.07);
  o.connect(e).connect(head);
  // (Its second and third partials: the knock is still a knock on a speaker with no bass.)
  const o2 = sine(g, f * 3, t, t + 0.4);
  const e2 = g.ctx.createGain();
  pluckEnv(e2.gain, t, 0.35, 0.003, down ? 0.05 : 0.03);
  o2.connect(e2).connect(head);
  const n = burst(g, t, 0.12, 'lowpass', down ? 420 : 900, 0.7);
  const en = g.ctx.createGain();
  pluckEnv(en.gain, t, down ? 0.7 : 0.4, 0.002, 0.03);
  n.connect(en).connect(head);
  return head;
}

/** Air moving: a band of noise that sweeps from one colour to another. For a change of page and a change of theme. */
export function whoosh(g: Graph, t: number, dur: number, from: number, to: number, gainV: number, pan: number): GainNode {
  const head = route(g, g.fx, pan, 0.3);
  head.gain.value = gainV;
  const n = burst(g, t, dur + 0.3, 'bandpass', from, 1.1);
  n.frequency.exponentialRampToValueAtTime(to, t + dur);
  const e = g.ctx.createGain();
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(1, t + dur * 0.45);
  e.gain.setTargetAtTime(0, t + dur * 0.5, dur * 0.2);
  n.connect(e).connect(head);
  return head;
}

/** A low bloom: the moment the last of the ice has gone, and the moment the sun clears the ranges. */
export function bloom(g: Graph, t: number, midi: number, gainV: number, len: number): GainNode {
  const head = route(g, g.fx, 0, 0.5);
  head.gain.value = 0.1 * gainV;
  for (const [k, a] of [
    [1, 1],
    [1.5, 0.45],
    [2, 0.3],
    [3, 0.12],
  ]) {
    const o = sine(g, hz(midi) * k, t, t + len * 3 + 1);
    const e = g.ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.setTargetAtTime(a, t, len * 0.3);
    e.gain.setTargetAtTime(0, t + len, len * 0.45);
    o.connect(e).connect(head);
  }
  return head;
}
