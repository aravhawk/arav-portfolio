/**
 * The flight's frames, fetched and decoded off the main thread.
 *
 * The page tells this worker one thing, again and again: which frame of
 * which track it is showing, and which way it is going (`want`). The
 * worker keeps a short window of decoded frames round that place and hands
 * each to the page as it comes out of the decoder. Everything else follows
 * from that:
 *
 *  - bytes: a stream is fetched a few groups of frames at a time, by byte
 *    range, round the reader and ahead of the way they are going; never
 *    the whole file. What lies far behind is let go (the browser's own
 *    cache still has it).
 *  - decoding: every group begins with a keyframe, so any frame is at most
 *    half a screen of scroll's frames away from one. The decoder is fed a
 *    group from its keyframe up to the furthest frame the window wants,
 *    and goes on from there while the reader travels forward.
 *  - memory: only the window is ever held; the page gives a frame back
 *    (`release`) the moment it falls out of it.
 */

import { AHEAD, BEHIND, type Codec, type StreamIndex, type Track } from './types';

interface Open {
  type: 'open';
  /** the set's address without its extension: /flight/wide-day */
  base: string;
  gen: number;
  /** for the checks: this stream and no other ('none': no stream at all, as on a browser with no decoder) */
  only?: string;
}
interface Want {
  type: 'want';
  gen: number;
  track: Track['id'];
  frame: number;
  /** +1 forward, -1 back */
  dir: number;
  /** tracks that will be wanted soon: their first bytes are fetched ahead */
  soon?: Track['id'][];
}
interface Release {
  type: 'release';
  keys: number[];
}
type In = Open | Want | Release | { type: 'close' };

/** How many groups of bytes are fetched ahead of the reader and kept behind, and how far off a group is let go. */
const FETCH_AHEAD = 3;
const FETCH_BEHIND = 2;
const KEEP_GROUPS = 14;

const scope = self as unknown as { postMessage(msg: unknown, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<In>) => void) | null };

let gen = 0;
let base = '';
let codec: Codec = 'av1';
let index: StreamIndex | null = null;
/** each track's frames' offsets in the stream (one more than its frames: the end) */
const offsets = new Map<string, Float64Array>();
const order: string[] = [];
let decoder: VideoDecoder | null = null;
/** group bytes: `${track}:${group}` */
const bytes = new Map<string, Uint8Array>();
const fetching = new Set<string>();
/** frames the page now holds, and frames the decoder has been given and not yet returned */
const sent = new Set<number>();
const inflight = new Set<number>();
let want: Want | null = null;
/** where the decoder stands: it can go on from `next` in this group without a keyframe */
let open: { track: string; group: number; next: number } | null = null;
let fetched = 0;
let decodeMs = 0;
let decoded = 0;
/** when the batch now in the decoder was handed to it */
let batchAt = 0;

const keyOf = (track: string, i: number) => order.indexOf(track) * 100000 + i;
const trackOf = (id: string) => index?.tracks.find((t) => t.id === id) ?? null;

async function supports(config: VideoDecoderConfig): Promise<boolean> {
  try {
    return !!(await VideoDecoder.isConfigSupported(config)).supported;
  } catch {
    return false;
  }
}

async function start(msg: Open) {
  const mine = msg.gen;
  gen = mine;
  base = msg.base;
  index = null;
  want = null;
  open = null;
  bytes.clear();
  fetching.clear();
  sent.clear();
  inflight.clear();
  offsets.clear();
  order.length = 0;
  try {
    decoder?.close();
  } catch {
    // (Already closed.)
  }
  decoder = null;
  if (typeof VideoDecoder !== 'function') return scope.postMessage({ type: 'none', gen: mine, why: 'no VideoDecoder' });
  for (const c of (['av1', 'hevc'] as Codec[]).filter((x) => !msg.only || msg.only === x)) {
    let ix: StreamIndex;
    try {
      const res = await fetch(`${base}.${c}.json`);
      if (!res.ok) continue;
      ix = (await res.json()) as StreamIndex;
    } catch {
      continue;
    }
    if (gen !== mine) return;
    const config: VideoDecoderConfig = { codec: ix.codec, codedWidth: ix.w, codedHeight: ix.h, optimizeForLatency: true };
    if (ix.description) config.description = Uint8Array.from(atob(ix.description), (ch) => ch.charCodeAt(0));
    if (!(await supports(config))) continue;
    if (gen !== mine) return;
    codec = c;
    index = ix;
    for (const t of ix.tracks) {
      const off = new Float64Array(t.sizes.length + 1);
      off[0] = t.at;
      for (let i = 0; i < t.sizes.length; i++) off[i + 1] = off[i] + t.sizes[i];
      offsets.set(t.id, off);
      order.push(t.id);
    }
    configure(config);
    scope.postMessage({ type: 'ready', gen: mine, codec: c, w: ix.w, h: ix.h, tracks: ix.tracks.map((t) => ({ id: t.id, from: t.from, per: t.per, fps: t.fps, n: t.sizes.length, key: t.key })) });
    return;
  }
  scope.postMessage({ type: 'none', gen: mine, why: 'no stream this browser can decode' });
}

let config: VideoDecoderConfig | null = null;
function configure(c: VideoDecoderConfig) {
  config = c;
  const mine = gen;
  decoder = new VideoDecoder({
    output(frame) {
      const key = frame.timestamp;
      const mineToo = inflight.delete(key);
      if (mineToo) {
        // (A frame's cost: the time since the frame before it came out, or since the batch went in.)
        const now = performance.now();
        decodeMs += now - batchAt;
        batchAt = now;
        decoded++;
      }
      const keep = mineToo && gen === mine && wanted(key);
      if (!keep) frame.close();
      else {
        sent.add(key);
        scope.postMessage({ type: 'frame', gen: mine, key, track: order[Math.floor(key / 100000)], i: key % 100000, frame }, [frame]);
      }
      if (!inflight.size) pump();
    },
    error(err) {
      if (gen !== mine) return;
      scope.postMessage({ type: 'none', gen: mine, why: `decoder: ${err.message}` });
    },
  });
  decoder.configure(c);
}

/** The window round the reader: the frames of the wanted track that are kept, by index. */
function span(w: Want, n: number): [number, number] {
  const lo = w.frame - (w.dir < 0 ? AHEAD : BEHIND);
  const hi = w.frame + (w.dir < 0 ? BEHIND : AHEAD);
  return [Math.max(0, lo), Math.min(n - 1, hi)];
}
function wanted(key: number): boolean {
  if (!want) return false;
  const t = trackOf(want.track);
  if (!t || order[Math.floor(key / 100000)] !== want.track) return false;
  const [lo, hi] = span(want, t.sizes.length);
  const i = key % 100000;
  return i >= lo && i <= hi;
}

/** Fetch a run of groups of a track in one request. */
function fetchGroups(t: Track, g0: number, g1: number) {
  const off = offsets.get(t.id)!;
  const n = t.sizes.length;
  const a = off[g0 * t.key];
  const b = off[Math.min(n, (g1 + 1) * t.key)];
  const mine = gen;
  for (let g = g0; g <= g1; g++) fetching.add(`${t.id}:${g}`);
  const done = () => {
    for (let g = g0; g <= g1; g++) fetching.delete(`${t.id}:${g}`);
  };
  fetch(`${base}.${codec}`, { headers: { Range: `bytes=${a}-${b - 1}` } })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.arrayBuffer().then((buf) => ({ buf, whole: res.status === 200 }));
    })
    .then(({ buf, whole }) => {
      if (gen !== mine) return;
      done();
      // (A server that does not answer ranges sends the whole stream: the part asked for is cut from it.)
      const data = whole ? new Uint8Array(buf, a, b - a) : new Uint8Array(buf);
      fetched += whole ? buf.byteLength : data.byteLength;
      for (let g = g0; g <= g1; g++) {
        const from = off[g * t.key] - a;
        const to = off[Math.min(n, (g + 1) * t.key)] - a;
        bytes.set(`${t.id}:${g}`, data.subarray(from, to));
      }
      scope.postMessage({ type: 'bytes', gen: mine, fetched, at: performance.now() });
      pump();
    })
    .catch(() => {
      if (gen !== mine) return;
      done();
      // (Asked for again the next time the reader wants it.)
      setTimeout(pump, 1500);
    });
}

/** The groups round the reader, and the first of any track wanted soon: asked for where they are neither here nor on their way. */
function feed(w: Want) {
  const t = trackOf(w.track);
  if (!t) return;
  const groups = Math.ceil(t.sizes.length / t.key);
  const g = Math.floor(w.frame / t.key);
  const lo = Math.max(0, g - (w.dir < 0 ? FETCH_AHEAD : FETCH_BEHIND));
  const hi = Math.min(groups - 1, g + (w.dir < 0 ? FETCH_BEHIND : FETCH_AHEAD));
  const missing = (id: string, k: number) => !bytes.has(`${id}:${k}`) && !fetching.has(`${id}:${k}`);
  // The reader's own group first, alone, so it is not held up by the rest.
  if (missing(t.id, g)) fetchGroups(t, g, g);
  let run = -1;
  for (let k = lo; k <= hi + 1; k++) {
    const miss = k <= hi && missing(t.id, k);
    if (miss && run < 0) run = k;
    if (!miss && run >= 0) {
      fetchGroups(t, run, k - 1);
      run = -1;
    }
  }
  for (const id of w.soon ?? []) {
    const s = trackOf(id);
    if (s && missing(id, 0)) fetchGroups(s, 0, Math.min(1, Math.ceil(s.sizes.length / s.key) - 1));
  }
  for (const k of bytes.keys()) {
    const [id, at] = k.split(':');
    if (id === t.id && Math.abs(Number(at) - g) > KEEP_GROUPS) bytes.delete(k);
  }
}

/** Give the decoder what the window still lacks, nearest the reader first. */
function pump() {
  const w = want;
  if (!w || !index || !decoder || decoder.state !== 'configured' || inflight.size) return;
  const t = trackOf(w.track);
  if (!t) return;
  feed(w);
  const [lo, hi] = span(w, t.sizes.length);
  const have = (i: number) => sent.has(keyOf(t.id, i));
  // The frame the reader is on, then those ahead of the way they are going, then those behind.
  let m = -1;
  const at = Math.min(hi, Math.max(lo, w.frame));
  if (!have(at)) m = at;
  for (let d = 1; m < 0 && d <= AHEAD + BEHIND; d++) {
    const a = at + d * (w.dir < 0 ? -1 : 1);
    const b = at - d * (w.dir < 0 ? -1 : 1);
    if (a >= lo && a <= hi && !have(a)) m = a;
    else if (b >= lo && b <= hi && !have(b)) m = b;
  }
  if (m < 0) return;
  const g = Math.floor(m / t.key);
  const data = bytes.get(`${t.id}:${g}`);
  if (!data) return;
  const g0 = g * t.key;
  const gEnd = Math.min(t.sizes.length, g0 + t.key) - 1;
  // Up to the furthest frame of this group the window wants.
  const upTo = Math.min(gEnd, Math.max(m, hi));
  const goOn = open && open.track === t.id && open.group === g && open.next <= m;
  const from = goOn ? open!.next : g0;
  const off = offsets.get(t.id)!;
  batchAt = performance.now();
  for (let i = from; i <= upTo; i++) {
    const key = keyOf(t.id, i);
    inflight.add(key);
    decoder.decode(new EncodedVideoChunk({ type: i === g0 ? 'key' : 'delta', timestamp: key, data: data.subarray(off[i] - off[g0], off[i + 1] - off[g0]) }));
  }
  open = { track: t.id, group: g, next: upTo + 1 };
  // (A decoder that holds frames back until it is told there are no more would stall the page: it is told.)
  const mine = gen;
  const batch = upTo;
  setTimeout(() => {
    if (gen !== mine || !decoder || !inflight.size || !open || open.next !== batch + 1) return;
    open = null;
    void decoder.flush().catch(() => {});
  }, 400);
}

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'open') void start(msg);
  else if (msg.type === 'release') {
    for (const k of msg.keys) sent.delete(k);
  } else if (msg.type === 'want') {
    if (msg.gen !== gen || !index) return;
    const prev = want;
    want = msg;
    // The reader has gone somewhere the frames now in the decoder do not serve: they are dropped, and it starts again.
    if (inflight.size && decoder && config && prev && (prev.track !== msg.track || Math.abs(prev.frame - msg.frame) > AHEAD + BEHIND)) {
      let useful = false;
      for (const k of inflight) if (wanted(k)) useful = true;
      if (!useful) {
        inflight.clear();
        open = null;
        decoder.reset();
        decoder.configure(config);
      }
    }
    pump();
    scope.postMessage({ type: 'stats', gen, fetched, decoded, decodeMs, held: sent.size, groups: bytes.size });
  } else if (msg.type === 'close') {
    gen = -1;
    try {
      decoder?.close();
    } catch {
      // (Already closed.)
    }
    bytes.clear();
  }
};
