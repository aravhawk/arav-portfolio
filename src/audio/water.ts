/**
 * Water, made live. No recording and no loop.
 *
 * Running water is heard as its bubbles: each one rings at a pitch set by
 * its size (a millimetre across is about three kilohertz, a centimetre
 * three hundred hertz), rises a little as it nears the surface, and dies
 * faster the smaller it is. A trickle is a few small ones a second; a
 * stream is hundreds of every size; a fall adds the roar of the water's
 * own body; a still pool is one now and then. This file is that model: a
 * set of voices, each a stream of bubbles drawn at random from its own
 * range of sizes at its own rate, with a band of noise under it for the
 * body. It runs in an AudioWorklet, so it never waits on the page.
 *
 * `waterKernel` is the whole of the synthesis and names nothing outside
 * itself: its text is what the worklet runs, and the unit tests call the
 * same function directly.
 */

/** How many voices the model has, and how many numbers describe one. */
export const VOICES = 20;
export const PARAMS = 11;

/**
 * One voice's parameters, in the order they are sent:
 * gain (0..1), rate (bubbles a second), lo and hi (the bubbles' pitch
 * range, Hz), tilt (how much louder the large ones are: 0 all alike, 1 a
 * great deal), rise (how much each one's pitch climbs: 1 as in nature),
 * pan (-1..1), spread (0 all at `pan`, 1 across the whole field), noise
 * (the body's level against the bubbles': 0 none, 1 as loud, more for water
 * that is nearly all body, like the sea), nLo and nHi (the body's band, Hz).
 */
export type WaterVoice = [gain: number, rate: number, lo: number, hi: number, tilt: number, rise: number, pan: number, spread: number, noise: number, nLo: number, nHi: number];

export interface Kernel {
  set(v: number, p: ArrayLike<number>): void;
  /** A clump of `n` bubbles over `dur` seconds: a slap, a splash, a ring. */
  burst(n: number, lo: number, hi: number, amp: number, pan: number, spread: number, dur: number, tilt: number): void;
  render(L: Float32Array, R: Float32Array, n: number): void;
  /** Live noise for the wind and the air: pink on one pair, white on the other. */
  noise(pL: Float32Array, pR: Float32Array, wL: Float32Array, wR: Float32Array, n: number): void;
  /** How many bubbles are sounding. */
  alive(): number;
}

export function waterKernel() {
  return function make(sr: number, maxBubbles: number, seed: number, voices: number): Kernel {
    const NP = 11;
    const TAB = 4096;
    const sine = new Float32Array(TAB);
    for (let i = 0; i < TAB; i++) sine[i] = Math.sin((2 * Math.PI * i) / TAB);
    let rs = seed >>> 0 || 1;
    const rnd = () => {
      rs ^= rs << 13;
      rs >>>= 0;
      rs ^= rs >>> 17;
      rs ^= rs << 5;
      rs >>>= 0;
      return rs / 4294967296;
    };
    const cur = new Float32Array(voices * NP);
    const tgt = new Float32Array(voices * NP);
    const fresh = new Uint8Array(voices);
    const wait = new Float64Array(voices);
    const ns = new Float32Array(voices * 6);
    const was = new Float32Array(voices);
    for (let v = 0; v < voices; v++) {
      fresh[v] = 1;
      wait[v] = sr * rnd();
    }
    // The bubbles: each a phase, a step, how fast the step grows, a level, how fast the level dies, and where it sits.
    const bOn = new Uint8Array(maxBubbles);
    const bWait = new Float32Array(maxBubbles);
    const bPh = new Float32Array(maxBubbles);
    const bInc = new Float32Array(maxBubbles);
    const bRise = new Float32Array(maxBubbles);
    const bAmp = new Float32Array(maxBubbles);
    const bDec = new Float32Array(maxBubbles);
    const bAtt = new Float32Array(maxBubbles);
    const bL = new Float32Array(maxBubbles);
    const bR = new Float32Array(maxBubbles);
    let count = 0;
    let top = 0;
    const pinkS = new Float32Array(14);
    // A bubble does not begin at full level: it comes up over a third of a millisecond, so it is a bubble and not a tick.
    const attDec = Math.exp(-1 / (0.00035 * sr));

    const spawn = (f0: number, amp: number, pan: number, delay: number, rise: number) => {
      if (count >= maxBubbles || amp < 1e-5) return;
      let b = 0;
      while (b < maxBubbles && bOn[b]) b++;
      if (b >= maxBubbles) return;
      // A bubble's radius in metres is about three over its pitch; the smaller, the faster it dies.
      const r = 3 / f0;
      const damp = 0.13 / r + 0.0072 * Math.pow(r, -1.5);
      bOn[b] = 1;
      bWait[b] = delay;
      bPh[b] = 0;
      bInc[b] = f0 / sr;
      // Its pitch climbs as it nears the surface: by about a tenth of its damping, more for some than others.
      bRise[b] = 1 + (rise * 0.16 * rnd() * damp) / sr;
      bAmp[b] = amp;
      bAtt[b] = 1;
      bDec[b] = Math.exp(-damp / sr);
      const a = ((Math.min(1, Math.max(-1, pan)) + 1) * Math.PI) / 4;
      bL[b] = Math.cos(a);
      bR[b] = Math.sin(a);
      count++;
      if (b >= top) top = b + 1;
    };

    const one = (lo: number, hi: number, tilt: number, amp: number, pan: number, spread: number, delay: number, rise: number) => {
      // Small bubbles are many, large ones few; a few are loud and most are not.
      const f0 = lo * Math.pow(Math.max(1.001, hi / lo), Math.pow(rnd(), 0.62));
      const u = rnd();
      spawn(f0, amp * Math.pow(lo / f0, tilt) * (0.16 + 0.84 * u * u), pan + spread * (rnd() * 2 - 1), delay, rise);
    };

    const set = (v: number, p: ArrayLike<number>) => {
      if (v < 0 || v >= voices) return;
      const at = v * NP;
      for (let i = 0; i < NP; i++) tgt[at + i] = p[i];
      // A voice that has been silent takes its new colour at once: only its level glides in.
      if (fresh[v] || cur[at] < 1e-4) {
        for (let i = 1; i < NP; i++) cur[at + i] = p[i];
        fresh[v] = 0;
      }
    };

    const burst = (n: number, lo: number, hi: number, amp: number, pan: number, spread: number, dur: number, tilt: number) => {
      for (let i = 0; i < n; i++) one(lo, hi, tilt, amp, pan, spread, Math.floor(rnd() * dur * sr), 1);
    };

    const render = (L: Float32Array, R: Float32Array, n: number) => {
      for (let i = 0; i < n; i++) {
        L[i] = 0;
        R[i] = 0;
      }
      const k = 1 - Math.exp(-n / (0.045 * sr));
      for (let v = 0; v < voices; v++) {
        const at = v * NP;
        for (let i = 0; i < NP; i++) cur[at + i] += (tgt[at + i] - cur[at + i]) * k;
        const gain = cur[at];
        if (gain < 1e-4 && tgt[at] < 1e-4) {
          cur[at] = 0;
          was[v] = 0;
          continue;
        }
        const rate = cur[at + 1];
        // Bubbles arrive at random, at the voice's rate.
        if (rate > 0.01) {
          const mean = sr / rate;
          let t = wait[v];
          if (t > 4 * mean) t = mean * rnd();
          while (t < n) {
            one(cur[at + 2], cur[at + 3], cur[at + 4], gain, cur[at + 6], cur[at + 7], Math.floor(t), cur[at + 5]);
            t += -Math.log(1 - rnd() * 0.9999) * mean;
          }
          wait[v] = t - n;
        }
        // The body: a band of noise, its own on each side.
        const g1 = gain * cur[at + 8];
        const g0 = was[v];
        was[v] = g1;
        if (g1 > 1e-5 || g0 > 1e-5) {
          const aL = 1 - Math.exp((-2 * Math.PI * Math.min(cur[at + 10], sr * 0.45)) / sr);
          const aH = 1 - Math.exp((-2 * Math.PI * cur[at + 9]) / sr);
          const pa = ((Math.min(1, Math.max(-1, cur[at + 6])) + 1) * Math.PI) / 4;
          const sp = Math.min(1, cur[at + 7]);
          // (A wide body keeps both sides full; a narrow one sits at its pan.)
          const wl = Math.cos(pa) * (1 - sp) + 0.7071 * sp;
          const wr = Math.sin(pa) * (1 - sp) + 0.7071 * sp;
          const s = v * 6;
          let l1 = ns[s];
          let l2 = ns[s + 1];
          let lh = ns[s + 2];
          let r1 = ns[s + 3];
          let r2 = ns[s + 4];
          let rh = ns[s + 5];
          const dg = (g1 - g0) / n;
          let g = g0;
          for (let i = 0; i < n; i++) {
            rs ^= rs << 13;
            rs >>>= 0;
            rs ^= rs >>> 17;
            rs ^= rs << 5;
            rs >>>= 0;
            const a = (rs & 0xffff) / 32768 - 1;
            const b = (rs >>> 16) / 32768 - 1;
            l1 += aL * (a - l1);
            l2 += aL * (l1 - l2);
            lh += aH * (l2 - lh);
            r1 += aL * (b - r1);
            r2 += aL * (r1 - r2);
            rh += aH * (r2 - rh);
            g += dg;
            L[i] += (l2 - lh) * g * wl;
            R[i] += (r2 - rh) * g * wr;
          }
          ns[s] = l1;
          ns[s + 1] = l2;
          ns[s + 2] = lh;
          ns[s + 3] = r1;
          ns[s + 4] = r2;
          ns[s + 5] = rh;
        }
      }
      let last = 0;
      for (let b = 0; b < top; b++) {
        if (!bOn[b]) continue;
        last = b + 1;
        let from = bWait[b];
        if (from >= n) {
          bWait[b] = from - n;
          continue;
        }
        bWait[b] = 0;
        from = from | 0;
        let ph = bPh[b];
        let inc = bInc[b];
        let a = bAmp[b];
        let att = bAtt[b];
        const rise = bRise[b];
        const dec = bDec[b];
        const gl = bL[b];
        const gr = bR[b];
        for (let i = from; i < n; i++) {
          const s = sine[(ph * TAB) & 4095] * a * (1 - att);
          L[i] += s * gl;
          R[i] += s * gr;
          ph += inc;
          if (ph >= 1) ph -= 1;
          inc *= rise;
          a *= dec;
          att *= attDec;
        }
        if (a < 2e-5 || inc > 0.45) {
          bOn[b] = 0;
          count--;
        } else {
          bPh[b] = ph;
          bInc[b] = inc;
          bAmp[b] = a;
          bAtt[b] = att;
        }
      }
      top = last;
    };

    const noise = (pL: Float32Array, pR: Float32Array, wL: Float32Array, wR: Float32Array, n: number) => {
      for (let c = 0; c < 2; c++) {
        const o = c * 7;
        const pk = c ? pR : pL;
        const wh = c ? wR : wL;
        let b0 = pinkS[o];
        let b1 = pinkS[o + 1];
        let b2 = pinkS[o + 2];
        let b3 = pinkS[o + 3];
        let b4 = pinkS[o + 4];
        let b5 = pinkS[o + 5];
        let b6 = pinkS[o + 6];
        for (let i = 0; i < n; i++) {
          rs ^= rs << 13;
          rs >>>= 0;
          rs ^= rs >>> 17;
          rs ^= rs << 5;
          rs >>>= 0;
          const w = rs / 2147483648 - 1;
          // Noise whose power falls by 3 dB an octave (Paul Kellet's filter).
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          pk[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
          wh[i] = w * 0.5;
        }
        pinkS[o] = b0;
        pinkS[o + 1] = b1;
        pinkS[o + 2] = b2;
        pinkS[o + 3] = b3;
        pinkS[o + 4] = b4;
        pinkS[o + 5] = b5;
        pinkS[o + 6] = b6;
      }
    };

    return { set, burst, render, noise, alive: () => count };
  };
}

/**
 * The worklet's own code. Like the kernel it names nothing outside itself
 * but what a worklet is given. Messages are [time, voice, ...parameters]
 * for a voice and [time, -1, ...burst] for a clump; each is held until its
 * time, so a whole scene can be sent ahead (the offline renders do).
 */
function register(make: (sr: number, maxBubbles: number, seed: number, voices: number) => Kernel) {
  interface Scope {
    AudioWorkletProcessor: new () => { port: MessagePort };
    registerProcessor(name: string, ctor: unknown): void;
    sampleRate: number;
    currentTime: number;
  }
  const scope = globalThis as unknown as Scope;
  interface State {
    k: Kernel;
    q: number[][];
    at: number;
  }
  class Water extends scope.AudioWorkletProcessor {
    constructor(o: { processorOptions: { bubbles: number; seed: number; voices: number } }) {
      super();
      const p = o.processorOptions;
      const st = this as unknown as State;
      st.k = make(scope.sampleRate, p.bubbles, p.seed, p.voices);
      st.q = [];
      st.at = 0;
      this.port.onmessage = (e: MessageEvent) => {
        const m = e.data as number[] | string;
        if (typeof m === 'string') {
          // Echoed with the audio thread's own time: the page learns how far ahead of its reading the audio thread is.
          this.port.postMessage([m, scope.currentTime]);
          return;
        }
        // Kept in the order of their times; most arrive in it.
        const q = st.q;
        let i = q.length;
        while (i > st.at && q[i - 1][0] > m[0]) i--;
        if (i === q.length) q.push(m);
        else q.splice(i, 0, m);
      };
    }
    process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
      const st = this as unknown as State;
      const out = outputs[0];
      const n = out[0].length;
      const end = scope.currentTime + n / scope.sampleRate;
      const q = st.q;
      while (st.at < q.length && q[st.at][0] < end) {
        const m = q[st.at++];
        if (m[1] < 0) st.k.burst(m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9]);
        else st.k.set(m[1], m.slice(2));
      }
      if (st.at > 512) {
        q.splice(0, st.at);
        st.at = 0;
      }
      st.k.render(out[0], out[1] || out[0], n);
      if (outputs.length > 2) st.k.noise(outputs[1][0], outputs[1][1] || outputs[1][0], outputs[2][0], outputs[2][1] || outputs[2][0], n);
      return true;
    }
  }
  scope.registerProcessor('water', Water);
}

/** The text the worklet is given. */
export const workletSource = () => `(${register.toString()})((${waterKernel.toString()})());`;

/** The water as the graph holds it. */
export interface Water {
  /** true when the model is running; false when this browser has no worklet and noise stands in */
  live: boolean;
  /** the water's sound, and live pink and white noise for the air (null without a worklet) */
  out: AudioNode | null;
  pink: AudioNode | null;
  white: AudioNode | null;
  /** Steer a voice from time `t`. Only told when it has moved. */
  set(v: number, p: WaterVoice, t: number): void;
  burst(t: number, n: number, lo: number, hi: number, amp: number, pan: number, spread: number, dur: number, tilt: number): void;
  /** Resolves once everything sent so far has reached the audio thread, with the audio thread's time when it did. */
  flush(): Promise<number>;
}

const SILENT: WaterVoice = [0, 0, 400, 4000, 0.6, 1, 0, 0.5, 0, 200, 3000];

/** Load the worklet and start the model. Without a worklet the water is silent and the caller is told. */
export async function makeWater(ctx: BaseAudioContext, seed: number, bubbles: number): Promise<Water> {
  const none: Water = { live: false, out: null, pink: null, white: null, set() {}, burst() {}, flush: async () => NaN };
  if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') return none;
  let node: AudioWorkletNode;
  try {
    const url = URL.createObjectURL(new Blob([workletSource()], { type: 'text/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    node = new AudioWorkletNode(ctx, 'water', { numberOfInputs: 0, numberOfOutputs: 3, outputChannelCount: [2, 2, 2], processorOptions: { bubbles, seed, voices: VOICES } });
  } catch {
    return none;
  }
  const split = (i: number) => {
    const g = ctx.createGain();
    node.connect(g, i);
    return g;
  };
  const last: WaterVoice[] = Array.from({ length: VOICES }, () => SILENT.slice() as WaterVoice);
  let waiting: ((t: number) => void)[] = [];
  node.port.onmessage = (e: MessageEvent) => {
    const w = waiting;
    waiting = [];
    const t = Array.isArray(e.data) ? Number(e.data[1]) : NaN;
    w.forEach((f) => f(t));
  };
  return {
    live: true,
    out: split(0),
    pink: split(1),
    white: split(2),
    set(v, p, t) {
      const was = last[v];
      // (A silent voice that stays silent is not sent at all.)
      if (p[0] < 1e-4 && was[0] < 1e-4) return;
      let moved = false;
      for (let i = 0; i < PARAMS; i++) if (Math.abs(p[i] - was[i]) > 1e-3 + 0.01 * Math.abs(was[i])) moved = true;
      if (!moved) return;
      last[v] = p.slice() as WaterVoice;
      node.port.postMessage([t, v, ...p]);
    },
    burst(t, n, lo, hi, amp, pan, spread, dur, tilt) {
      node.port.postMessage([t, -1, n, lo, hi, amp, pan, spread, dur, tilt]);
    },
    flush: () =>
      new Promise<number>((res) => {
        waiting.push(res);
        node.port.postMessage('sync');
      }),
  };
}
