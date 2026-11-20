/**
 * An audio context with no audio: it builds nothing and plays nothing, and
 * writes down everything a parameter is told. A parameter made before
 * `seal()` is a standing one (the graph's own); one made after belongs to
 * a voice that comes and goes (the ice).
 */
export type Call = { how: 'value' | 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime' | 'setTargetAtTime'; value: number; t: number; tau?: number };

export class Param {
  calls: Call[] = [];
  private v = 0;
  constructor(
    readonly name: string,
    readonly standing: boolean,
    private readonly sealed: () => boolean,
  ) {}
  get value() {
    return this.v;
  }
  set value(value: number) {
    this.v = value;
    // Before the graph is finished a value is where a parameter starts, not a change.
    if (this.sealed()) this.calls.push({ how: 'value', value, t: -1 });
  }
  private note(how: Call['how'], value: number, t: number, tau?: number) {
    if (!Number.isFinite(value) || !Number.isFinite(t)) throw Error(`${this.name}: ${how}(${value}, ${t})`);
    if (how === 'exponentialRampToValueAtTime' && value <= 0) throw Error(`${this.name}: an exponential ramp to ${value}`);
    this.calls.push({ how, value, t, tau });
    return this;
  }
  setValueAtTime = (v: number, t: number) => this.note('setValueAtTime', v, t);
  linearRampToValueAtTime = (v: number, t: number) => this.note('linearRampToValueAtTime', v, t);
  exponentialRampToValueAtTime = (v: number, t: number) => this.note('exponentialRampToValueAtTime', v, t);
  setTargetAtTime = (v: number, t: number, tau: number) => this.note('setTargetAtTime', v, t, tau);
}

export class FakeContext {
  sampleRate = 8000;
  currentTime = 0;
  params: Param[] = [];
  started: { kind: string; at: number; stop?: number }[] = [];
  destination = this.node('destination');
  private isSealed = false;
  seal() {
    this.isSealed = true;
  }
  /** Parameters told anything since the graph was finished. */
  get voices() {
    return this.params.filter((p) => !p.standing);
  }
  get standing() {
    return this.params.filter((p) => p.standing);
  }
  private param(name: string) {
    const p = new Param(name, !this.isSealed, () => this.isSealed);
    this.params.push(p);
    return p;
  }
  private node(kind: string, params: string[] = []) {
    const node: Record<string, unknown> = { kind, connect: (to: unknown) => to };
    for (const name of params) node[name] = this.param(`${kind}.${name}`);
    return node;
  }
  private source(kind: string, params: string[]) {
    const entry: { kind: string; at: number; stop?: number } = { kind, at: -1 };
    return Object.assign(this.node(kind, params), {
      start: (t = 0) => {
        entry.at = t;
        this.started.push(entry);
      },
      stop: (t: number) => {
        entry.stop = t;
      },
    });
  }
  createGain = () => this.node('gain', ['gain']);
  createBiquadFilter = () => this.node('filter', ['frequency', 'Q', 'gain', 'detune']);
  createStereoPanner = () => this.node('pan', ['pan']);
  createDelay = () => this.node('delay', ['delayTime']);
  createWaveShaper = () => this.node('shaper');
  createChannelSplitter = () => this.node('splitter');
  createOscillator = () => this.source('oscillator', ['frequency', 'detune']);
  createBufferSource = () => this.source('source', ['playbackRate', 'detune']);
  createBuffer = (channels: number, length: number, rate: number) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { duration: length / rate, length, numberOfChannels: channels, sampleRate: rate, getChannelData: (c: number) => data[c] };
  };
}
