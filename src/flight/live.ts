/**
 * The live layer: weather and light over the played flight.
 *
 * The flight's picture is rendered ahead of time (player.ts), so at rest it
 * is a still. This lays a little life over it, on a canvas of its own above
 * the picture's. It never touches the picture: with this layer off, the
 * page is the played frames and nothing else.
 *
 *  - Air. Blown snow in the world, not on the glass: a box of small soft
 *    flakes that travels with the camera, each placed in world space and
 *    seen through the camera of the frame shown, so they pass with real
 *    depth as the camera flies. One wind. More over the open lake and at
 *    the canyon's mouth, almost none in the still light of the ending.
 *  - Water. Where the frame shows open water (a small mask of every frame
 *    says where: tools/flight/mask.mjs), glints that come and go in
 *    slow bands and a faint ripple of light, anchored to the water, so a
 *    held frame is never dead. Nothing on snow, ice or sky, and nothing
 *    where words stand (their own boxes on the page say where).
 *  - The pointer. On water a soft ring spreads from it and fades in a
 *    second and a half; on ice a faint cold light lies under it.
 *  - The first screen breathes: the drawn frame drifts by a fraction of a
 *    degree, by the clock, and settles at once when the reader scrolls.
 *  - cc-switch's gate. The sluice the chosen profile runs through is lit,
 *    with its name over it, placed through the camera.
 *
 * Two small programs. It draws only when the player's frame calls it, so
 * it stops with the tab and with the picture. Where frames run long with
 * the picture at rest it halves the flakes, then goes.
 */

import type { SignalCam } from '@/lib/signals';
import { CAM_STRIDE, type Plan, type Shape } from './types';

const DIR = '/flight';
/** The water's level in the world (FLIGHT_FREEBOARD in the renderer). */
const WATER_Z = -22;
/** Flakes placed, and the box of air they fill round the camera (world units). */
const FLAKES = 2600;
const BOX = [560, 560, 320];
/** The wind: where it blows and how fast (world units a second), and how fast a flake falls. */
const WIND = [10.5, 6.5, -2.1];
/** The pointer's rings on water: how many may spread at once, and how long each lives (s). */
const RINGS = 6;
const RING_LIFE = 1.5;
/** The first screen's breath: how far the frame drifts (of the window's height), and its two periods (s). */
const BREATH = 0.003;
const BREATH_X = 11;
const BREATH_Y = 7.3;
/** How long the lit gate takes to change (ms). */
const GATE_MS = 200;

const VERT = `#version 300 es
layout(location=0) in vec2 p;
out vec2 v;
void main() {
  v = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

/** Water, the pointer and the gate: one pass over the window. */
const FRAG = `#version 300 es
precision highp float;
in vec2 v;
out vec4 o;
uniform sampler2D uMask;
// Soft noise (a small tile of random values, smoothed by the sampler), for the light that moves over the water.
uniform sampler2D uNoise;
// The window's cut of the frame; the camera between the two masks; each mask's own camera (see warp.ts).
uniform vec4 uFit;
uniform vec3 uP[4];
uniform vec3 uCa[4];
uniform vec3 uCb[4];
// Where each mask lies on its sheet (xy), a cell's size on it (zw of uCellA), half a texel of a cell.
// Where words stand on the window (x0, y0, x1, y1 each): nothing of the layer is drawn there.
uniform vec4 uCellA;
uniform vec2 uCellB;
uniform vec2 uIn;
uniform vec4 uWords[4];
// x: the second mask's share, y: 1 when there is a mask, z: the window's width over its height, w: a pixel's angle.
uniform vec4 uM;
// x: time, y: night, z: the water's gain, w: the pointer's gain.
uniform vec4 uT;
uniform vec4 uGlow;
uniform vec4 uRing[${RINGS}];
uniform vec4 uGate[2];
uniform vec4 uGateR[2];
// Each lit gate's channel, from the dam down: five points of the world.
uniform vec2 uLine[10];

vec3 seen(vec3 x, vec3 c[4]) {
  vec3 a = x - c[0];
  float z = dot(a, c[1]);
  return vec3(0.5 + 0.5 * dot(a, c[2]) / z, 0.5 - 0.5 * dot(a, c[3]) / z, z);
}
// What a mask says is at a place in its frame: 0 sky, 0.5 solid ground or ice, 1 open water.
float maskAt(vec2 f, vec2 cell) {
  return texture(uMask, cell + clamp(f, uIn, 1.0 - uIn) * uCellA.zw).r;
}
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// Glints on the water: a few cells of the water's plane hold one, anywhere in the cell, of a size of its own, and
// each wakes and dies by its own slow clock. Most of the time most of them are dark: it is never a pattern.
float glints(vec2 w, float c) {
  vec2 id = floor(w / c);
  float h = hash(id);
  if (h < 0.8) return 0.0;
  vec2 at = (id + 0.14 + 0.72 * vec2(hash(id + 7.1), hash(id + 3.7))) * c;
  vec2 d = (w - at) / c;
  float wake = sin(uT.x * (0.5 + 0.9 * hash(id + 1.3)) + h * 400.0);
  return (1.0 - smoothstep(0.0, 0.003 + 0.014 * hash(id + 5.5), dot(d, d))) * pow(max(wake, 0.0), 9.0);
}
void main() {
  vec2 f = (v - uFit.zw) / uFit.xy;
  vec3 d = uP[1] + uP[2] * (f.x * 2.0 - 1.0) + uP[3] * (1.0 - f.y * 2.0);
  float t = d.z < -1e-5 ? min((${WATER_Z.toFixed(1)} - uP[0].z) / d.z, 2.0e6) : 2.0e6;
  vec3 x = uP[0] + d * t;
  float m = 0.0;
  if (uM.y > 0.5) {
    m = maskAt(uM.x > 0.0 ? seen(x, uCa).xy : f, uCellA.xy);
    if (uM.x > 0.0) m = mix(m, maskAt(seen(x, uCb).xy, uCellB), uM.x);
  }
  float water = smoothstep(0.78, 0.96, m);
  float solid = smoothstep(0.24, 0.44, m) * (1.0 - smoothstep(0.58, 0.8, m));
  // Clear of the words: a soft margin round each of their boxes.
  vec2 a = vec2(uM.z, 1.0);
  float clear = 1.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uWords[i];
    if (r.z > r.x) clear = min(clear, smoothstep(0.012, 0.05, length(max(max(r.xy - v, v - r.zw), 0.0) * a)));
  }
  vec3 light = vec3(0.0);
  float shade = 0.0;
  vec2 w = x.xy;
  if (water * clear > 0.003) {
    // A pixel's size on the water. Glints are kept a few pixels across at any distance: two sizes, one giving way to the next.
    float foot = t * uM.w;
    float l = log2(max(foot, 0.02) * 15.0);
    float l0 = floor(l);
    float g = mix(glints(w, exp2(l0)), glints(w, exp2(l0 + 1.0)), l - l0);
    // They come in slow bands that travel down the water.
    float band = smoothstep(0.35, 1.0, 0.5 + 0.5 * sin(dot(w, vec2(0.0021, 0.0034)) - uT.x * 0.11 + 1.7 * sin(dot(w, vec2(-0.0013, 0.0009)) + uT.x * 0.05)));
    // And under them a faint ripple of light, where it is near enough to be seen as one.
    float near = 1.0 - smoothstep(1.2, 4.0, foot);
    // (Two soft fields drifting across each other: where they agree the water is a shade lighter, where they part a
    // shade darker. Broad and faint: it is felt as the water moving, never seen as a line.)
    float rip = 0.0;
    if (near > 0.0) {
      float na = texture(uNoise, (w * 0.034 + vec2(uT.x * 0.1, uT.x * 0.06)) / 64.0).r;
      float nb = texture(uNoise, (w * 0.052 - vec2(uT.x * 0.08, -uT.x * 0.045) + 13.7) / 64.0).r;
      float net = 1.0 - abs(na - nb) * 2.4;
      rip = net > 0.0 ? net * net : -0.4 * min(-net, 1.0);
    }
    vec3 tint = mix(vec3(1.0, 0.99, 0.96), vec3(0.62, 0.78, 1.0), uT.y);
    float k = water * clear * uT.z;
    light += tint * k * (g * (0.1 + 0.9 * band) * mix(0.8, 0.42, uT.y) + max(rip, 0.0) * near * mix(0.026, 0.016, uT.y));
    shade += k * max(-rip, 0.0) * near * 0.03;
    // The pointer's rings: each spreads from where it was dropped and fades.
    for (int i = 0; i < ${RINGS}; i++) {
      vec4 r = uRing[i];
      if (r.z >= 1.0) continue;
      float e = 1.0 - (1.0 - r.z) * (1.0 - r.z);
      float dist = length(w - r.xy) / r.w;
      float ring = (dist - mix(10.0, 96.0, e)) / mix(7.0, 26.0, e);
      float amp = exp(-ring * ring) * (1.0 - r.z) * (1.0 - r.z) * min(r.z * 9.0, 1.0) * water * clear * uT.w;
      light += tint * amp * mix(0.15, 0.1, uT.y);
      shade += amp * 0.06 * smoothstep(0.0, 1.0, -ring);
    }
  }
  // On ice and snow the pointer raises a faint cold light.
  if (uGlow.w > 0.002) {
    vec2 q = (v - uGlow.xy) * a / uGlow.z;
    float gl = exp(-dot(q, q) * 2.2) * uGlow.w * solid * clear * uT.w;
    light += mix(vec3(0.5, 0.74, 1.0), vec3(0.3, 0.56, 0.95), uT.y) * gl * mix(0.13, 0.12, uT.y);
    shade += gl * mix(0.13, 0.0, uT.y);
  }
  // The chosen gate: a cold light in its opening, its image on the water at its foot, and its channel lit from the
  // dam down, strongest at the gate.
  for (int i = 0; i < 2; i++) {
    if (uGate[i].w < 0.002) continue;
    vec2 q = (v - uGate[i].xy) * a / vec2(uGate[i].z * 0.72, uGate[i].z);
    float on = exp(-dot(q, q) * 1.8) * clear;
    vec2 qr = (v - uGateR[i].xy) * a / vec2(uGateR[i].z, uGateR[i].z * 2.2);
    on += exp(-dot(qr, qr) * 1.6) * 0.4 * water * clear;
    if (water > 0.003) {
      float best = 1e9;
      float along = 0.0;
      for (int k = 0; k < 4; k++) {
        vec2 p0 = uLine[i * 5 + k];
        vec2 e = uLine[i * 5 + k + 1] - p0;
        float h = clamp(dot(w - p0, e) / dot(e, e), 0.0, 1.0);
        float dd = length(w - p0 - e * h);
        if (dd < best) {
          best = dd;
          along = (float(k) + h) * 0.25;
        }
      }
      on += exp(-best * best / 5200.0) * (1.0 - 0.6 * along) * 1.25 * water * clear;
    }
    on *= uGate[i].w;
    light += mix(vec3(0.36, 0.84, 1.0), vec3(0.3, 0.74, 1.0), uT.y) * on * mix(0.3, 0.2, uT.y);
    shade += on * mix(0.26, 0.0, uT.y);
  }
  o = vec4(light, shade);
}`;

/** The flakes: points in the world, seen through the frame's camera. */
const SNOW_VERT = `#version 300 es
precision highp float;
layout(location=0) in vec4 a;
uniform vec3 uShift;
uniform vec3 uBox;
uniform vec3 uF;
uniform vec3 uR;
uniform vec3 uU;
uniform vec4 uFit;
uniform vec4 uWords[4];
// x: how many of the flakes are out (0..1), y: a flake's size (px at one unit off), z: time, w: gain.
uniform vec4 uK;
// x: the window's width over its height, y: the largest a flake is drawn (px).
uniform vec2 uS;
out float vA;
void main() {
  vec3 rel = mod(a.xyz * uBox + uShift, uBox) - 0.5 * uBox;
  // (Each wanders a little about its own path.)
  vec3 at = rel + vec3(sin(uK.z * (0.5 + a.w) + a.w * 61.0), cos(uK.z * (0.4 + a.w) + a.w * 37.0), 0.0) * 2.4;
  float z = dot(at, uF);
  vec2 n = vec2(dot(at, uR), dot(at, uU)) / max(z, 1e-3);
  vec2 f = vec2(0.5 + 0.5 * n.x, 0.5 - 0.5 * n.y);
  vec2 w = f * uFit.xy + uFit.zw;
  vec3 e = abs(rel) / (0.5 * uBox);
  float fade = (1.0 - smoothstep(0.72, 1.0, max(e.x, max(e.y, e.z)))) * smoothstep(14.0, 44.0, z);
  float size = uK.y * (0.55 + 0.9 * fract(a.w * 7.31)) / max(z, 1.0);
  // (None where words stand.)
  float clear = 1.0;
  for (int i = 0; i < 4; i++) {
    vec4 r = uWords[i];
    if (r.z > r.x) clear = min(clear, smoothstep(0.006, 0.04, length(max(max(r.xy - w, w - r.zw), 0.0) * vec2(uS.x, 1.0))));
  }
  // (One too small to draw as a disc is drawn a pixel across and fainter.)
  vA = fade * smoothstep(0.0, 0.06, uK.x - a.w) * clear * uK.w * (0.4 + 0.5 * fract(a.w * 3.17)) * min(size, 1.0);
  gl_PointSize = clamp(size, 1.0, uS.y);
  gl_Position = z < 1.0 || vA < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(w.x * 2.0 - 1.0, 1.0 - w.y * 2.0, 0.0, 1.0);
}`;

const SNOW_FRAG = `#version 300 es
precision mediump float;
in float vA;
uniform vec3 uTint;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float k = vA * (1.0 - smoothstep(0.1, 1.0, dot(d, d)));
  o = vec4(uTint * k, k);
}`;

interface MaskIndex {
  w: number;
  h: number;
  cols: number;
  rows: number;
  per: number;
  step: number;
  from: number;
  n: number;
  sheets: number;
  frames: number;
}

/** What the player hands the layer each frame. */
export interface LiveFrame {
  now: number;
  dt: number;
  /** the place in the flight (screens), and how fast it is changing (screens a second) */
  s: number;
  v: number;
  /** the camera of the place shown, or null while the cameras are not in */
  cam: SignalCam | null;
  /** every frame's camera, for the two masks either side of the place */
  cams: Float32Array | null;
  aspect: number;
  fit: ArrayLike<number>;
  shape: Shape;
  night: boolean;
  viewW: number;
  viewH: number;
  /** whether the picture is the flight by scroll (not the entrance) and is up */
  on: boolean;
  /** whether the picture stands still on its own frame */
  rest: boolean;
}

export interface Live {
  frame(f: LiveFrame): void;
  /** For the measurements: draw the last frame again; the layer's context; what it is doing. */
  redraw(): void;
  gl: WebGL2RenderingContext | null;
  stats(): Record<string, unknown>;
  /** For the checks: hold the governor at a step (0 whole, 1 half the flakes, 2 gone), or hand it back. */
  holdStep(n: number | null): void;
  destroy(): void;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * `stage` holds the picture's canvas: the layer's own canvas goes in after it, and the first screen's breath moves
 * the stage (so the picture, a dissolve's copy of it and this layer move as one).
 */
export function mountLive(stage: HTMLElement, plan: Plan): Live {
  const canvas = document.createElement('canvas');
  canvas.className = 'flight-live';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'default' });
  let destroyed = false;
  let last: LiveFrame | null = null;
  /** The governor: 0 whole, 1 half the flakes, 2 gone. Only ever down. */
  let step = 0;
  let heldStep: number | null = null;
  let slow = 0;
  let restFrames = 0;
  /** The display's own frame time, as the first frames give it (ms). */
  let period = 0;
  const early: number[] = [];
  const cost = { compileMs: 0, cpuMs: 0, cpuMax: 0, frames: 0 };

  /* ---------- the first screen's breath ---------- */

  let breath = 0;
  let breathSet = '';
  function breathe(f: LiveFrame) {
    // (It comes in slowly once the entrance is over and the page is at rest at its top, and goes at once with a scroll.)
    const want = f.on && f.s < 0.004 && Math.abs(f.v) < 0.002 ? 1 : 0;
    breath += (want - breath) * (1 - Math.exp(-f.dt / (want ? 1.4 : 0.09)));
    if (breath < 0.002) breath = want ? breath : 0;
    let set = '';
    if (breath > 0) {
      const t = f.now / 1000;
      const a = BREATH * f.viewH * breath;
      const x = a * Math.sin((t * 2 * Math.PI) / BREATH_X);
      const y = a * 0.6 * Math.sin((t * 2 * Math.PI) / BREATH_Y + 1);
      // (A little larger than the window, by as much as it drifts, so no edge of the frame ever shows.)
      set = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${(1 + 2.4 * BREATH * breath).toFixed(5)})`;
    }
    if (set !== breathSet) {
      breathSet = set;
      stage.style.transform = set;
    }
  }

  /* ---------- the gate's name ---------- */

  const fork = document.querySelector<HTMLElement>('.fl-fork');
  const forkWords = fork?.closest<HTMLElement>('.fl-words') ?? null;
  const names = Array.from(fork?.querySelectorAll<HTMLElement>('.switch-opt') ?? [], (b) => b.textContent ?? '');
  const tag = document.createElement('span');
  tag.className = 'fl-call-label mono fl-gate-tag';
  tag.setAttribute('aria-hidden', 'true');
  let gate = Math.min(2, Math.max(0, Number(fork?.dataset.active) || 0));
  let gateWas = gate;
  /** When the gate last changed (ms; far in the past: it stands), and where on the window the control that changed it is. */
  let gateAt = -1e9;
  let gateFrom: [number, number] | null = null;
  let byKey = false;
  let tagSet = '';
  let tagOpacity = '';
  /** How far the gate's light and its name are up (they come and go with the station's words). */
  let gateK = 0;
  tag.textContent = names[gate] ?? '';
  const onForkKey = () => (byKey = true);
  const onForkDown = () => (byKey = false);
  const forkWatch = new MutationObserver(() => {
    const g = Math.min(2, Math.max(0, Number(fork?.dataset.active) || 0));
    if (g === gate) return;
    gateWas = gate;
    gate = g;
    // (Chosen with the keys, it changes at once: nothing is animated for a keyboard action.)
    gateAt = byKey ? -1e9 : performance.now();
    const r = fork?.querySelectorAll<HTMLElement>('.switch-opt')[g]?.getBoundingClientRect();
    gateFrom = r && last ? [(r.left + r.width / 2) / last.viewW, (r.top + r.height / 2) / last.viewH] : null;
    tag.textContent = names[g] ?? '';
  });
  if (fork) {
    forkWatch.observe(fork, { attributes: true, attributeFilter: ['data-active'] });
    fork.addEventListener('keydown', onForkKey);
    fork.addEventListener('pointerdown', onForkDown);
  }
  /** A point of the world on the window (0..1 each way), and how far off it is; null behind the eye. */
  function place(f: LiveFrame, c: SignalCam, x: number, y: number, z: number): [number, number, number] | null {
    const dx = x - c.pos[0];
    const dy = y - c.pos[1];
    const dz = z - c.pos[2];
    const depth = dx * c.f[0] + dy * c.f[1] + dz * c.f[2];
    if (depth < 1) return null;
    const u = 0.5 + (0.5 * (dx * c.r[0] + dy * c.r[1] + dz * c.r[2])) / (depth * c.tan * f.aspect);
    const v = 0.5 - (0.5 * (dx * c.u[0] + dy * c.u[1] + dz * c.u[2])) / (depth * c.tan);
    return [u * f.fit[0] + f.fit[2], v * f.fit[1] + f.fit[3], depth];
  }
  const gateU = new Float32Array(8);
  const gateRU = new Float32Array(8);
  const lineU = new Float32Array(20);
  let gateLit = false;
  let gateTick = 0;
  let gateShown = false;
  function gates(f: LiveFrame) {
    const c = f.cam;
    // (Whether the station's words are up is looked at a few times a second.)
    if (gateTick++ % 6 === 0) gateShown = !!forkWords?.hasAttribute('data-on');
    const shown = !!c && gateShown && f.on;
    gateK += ((shown ? 1 : 0) - gateK) * (1 - Math.exp(-f.dt / 0.07));
    if (gateK < 0.004) gateK = 0;
    // (Away from the dam nothing of this is worked out or handed over.)
    if (gateK === 0 && !gateLit) return;
    gateLit = gateK > 0;
    stale[0] |= 4;
    gateU.fill(0);
    gateRU.fill(0);
    const k = Math.min(1, Math.max(0, (f.now - gateAt) / GATE_MS));
    const e = 1 - (1 - k) ** 3;
    let set = '';
    let seen = false;
    if (c && gateK > 0) {
      for (let i = 0; i < 2; i++) {
        const g = i === 0 ? gate : gateWas;
        const amount = (i === 0 ? e : 1 - e) * gateK;
        if (amount < 0.002 || (i === 1 && g === gate)) continue;
        const [gx, gy, gz, gw] = plan.gates[g];
        const at = place(f, c, gx, gy, gz);
        const below = place(f, c, gx, gy, 2 * WATER_Z - gz);
        if (!at || !below) continue;
        // (Its size on the window: the gate's own width, seen from there.)
        const r = (gw * 0.9) / (at[2] * c.tan * 2) * f.fit[1];
        let x = at[0];
        let y = at[1];
        if (i === 0 && gateFrom && k < 1) {
          // (It sets out from the control that chose it: the last tenth of the way.)
          x += (gateFrom[0] - x) * 0.1 * (1 - e);
          y += (gateFrom[1] - y) * 0.1 * (1 - e);
        }
        gateU.set([x, y, r, amount], i * 4);
        gateRU.set([below[0], below[1], r, 0], i * 4);
        lineU.set(plan.sluices[g], i * 10);
        if (i === 0) {
          const top = place(f, c, gx, gy, plan.gates[g][4]);
          if (top && top[0] > 0.04 && top[0] < 0.96 && top[1] > 0.08 && top[1] < 0.92) {
            seen = true;
            // (It rises the last few pixels into its place as it comes.)
            set = `translate3d(${(top[0] * f.viewW).toFixed(1)}px,${(top[1] * f.viewH - 8 + 6 * (1 - e)).toFixed(1)}px,0) translate(-50%,-100%)`;
          }
        }
      }
    }
    if (set && set !== tagSet) {
      tagSet = set;
      tag.style.transform = set;
    }
    const opacity = seen ? (e * gateK).toFixed(2) : '0';
    if (opacity !== tagOpacity) {
      tagOpacity = opacity;
      tag.style.opacity = opacity;
    }
  }

  /* ---------- where the words stand ---------- */

  // Nothing of the layer is drawn behind words: the boxes of the blocks now showing, and of the captions at their
  // points, are read from the page (when the blocks change, when the window does, and when the picture comes to rest:
  // never every frame) and handed to both programs.
  const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-fl-from]'));
  const wordsU = new Float32Array(16);
  let wordsKey = '';
  let wordsDue = 0;
  let wordsAgain = 0;
  let wasRest = false;
  /** What has changed since each program was last told: bit 1 the words' boxes, 2 the theme, 4 the gate, 8 the rings. */
  const stale = [15, 15];
  let wordsTick = 0;
  function words(f: LiveFrame) {
    // (Which blocks are showing is looked at a few times a second, not every frame.)
    if (wordsTick++ % 6 === 0) {
      let key = `${f.viewW}x${f.viewH}`;
      for (let i = 0; i < blocks.length; i++) if (blocks[i].hasAttribute('data-on')) key += `,${i}`;
      if (key !== wordsKey) {
        wordsKey = key;
        // (Now, and again once the block's pieces have set.)
        wordsDue = f.now;
        wordsAgain = f.now + 700;
      }
    }
    if (f.rest && !wasRest) wordsDue = f.now;
    wasRest = f.rest;
    if (wordsAgain && f.now >= wordsAgain) {
      wordsAgain = 0;
      wordsDue = f.now;
    }
    if (!wordsDue || f.now < wordsDue) return;
    wordsDue = 0;
    stale[0] |= 1;
    stale[1] |= 1;
    wordsU.fill(0);
    let n = 0;
    const take = (els: Iterable<Element>) => {
      let x0 = 1e9;
      let y0 = 1e9;
      let x1 = -1e9;
      let y1 = -1e9;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        x0 = Math.min(x0, r.left);
        y0 = Math.min(y0, r.top);
        x1 = Math.max(x1, r.right);
        y1 = Math.max(y1, r.bottom);
      }
      if (x1 > x0 && n < 4 && y1 > 0 && y0 < f.viewH) wordsU.set([x0 / f.viewW, y0 / f.viewH, x1 / f.viewW, y1 / f.viewH], n++ * 4);
    };
    for (const b of blocks) if (b.hasAttribute('data-on')) take(b.children);
    for (const c of document.querySelectorAll('.fl-call[data-on] .fl-call-label')) take([c]);
  }

  /* ---------- the pointer ---------- */

  /** Where it is on the window (px), whether it is there at all, and when it last moved. */
  const ptr = { x: 0, y: 0, here: false, moved: -1e9 };
  /** The cold light follows it through a spring; its strength comes and goes. */
  const glow = { x: 0.5, y: 0.5, vx: 0, vy: 0, k: 0 };
  const rings = new Float32Array(RINGS * 4).fill(1);
  const ringBorn = new Float64Array(RINGS).fill(-1e9);
  let ringNext = 0;
  let ringAt = -1e9;
  let ringX = 0;
  let ringY = 0;
  function drop(now: number) {
    const f = last;
    const c = f?.cam;
    if (!f || !c) return;
    // Where the pointer's ray meets the water.
    const u = (ptr.x / f.viewW - f.fit[2]) / f.fit[0];
    const v = (ptr.y / f.viewH - f.fit[3]) / f.fit[1];
    const nx = (u * 2 - 1) * f.aspect * c.tan;
    const ny = (1 - v * 2) * c.tan;
    const dz = c.f[2] + c.r[2] * nx + c.u[2] * ny;
    if (dz >= -1e-3) return;
    const t = (WATER_Z - c.pos[2]) / dz;
    if (t > 9000) return;
    const i = ringNext++ % RINGS;
    rings[i * 4] = c.pos[0] + (c.f[0] + c.r[0] * nx + c.u[0] * ny) * t;
    rings[i * 4 + 1] = c.pos[1] + (c.f[1] + c.r[1] * nx + c.u[1] * ny) * t;
    // (A ring is sized by the window, not by the world: a pixel's width on the water where it was dropped.)
    rings[i * 4 + 3] = (t * 2 * c.tan) / (f.viewH * f.fit[1]);
    ringBorn[i] = now;
    ringAt = now;
    ringX = ptr.x;
    ringY = ptr.y;
  }
  function moved(x: number, y: number) {
    const now = performance.now();
    if (!ptr.here) {
      glow.x = x / (last?.viewW ?? 1);
      glow.y = y / (last?.viewH ?? 1);
    }
    ptr.x = x;
    ptr.y = y;
    ptr.here = true;
    ptr.moved = now;
    // (A new ring only once the pointer has gone some way and the last has had time to open: a wake, not a trail.)
    if (now - ringAt > 230 && Math.hypot(x - ringX, y - ringY) > 26) drop(now);
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') moved(e.clientX, e.clientY);
  };
  const onTouch = (e: TouchEvent) => {
    const t = e.touches[0];
    if (t) moved(t.clientX, t.clientY);
  };
  const onLeave = () => (ptr.here = false);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchend', onLeave, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  let ringsLive = false;
  function pointer(f: LiveFrame) {
    if (ringsLive || f.now - ringAt < 100) {
      ringsLive = false;
      for (let i = 0; i < RINGS; i++) {
        rings[i * 4 + 2] = Math.min(1, (f.now - ringBorn[i]) / (RING_LIFE * 1000));
        if (rings[i * 4 + 2] < 1) ringsLive = true;
      }
      stale[0] |= 8;
    }
    // (The light is there while the pointer is in use, and goes a few seconds after it stops.)
    const want = ptr.here && f.now - ptr.moved < 3200 ? 1 : 0;
    glow.k += (want - glow.k) * (1 - Math.exp(-f.dt / (want ? 0.22 : 0.5)));
    // A critically damped spring, a third of a second: the same at any frame rate.
    const w = 2 * Math.PI / 0.36;
    const e = Math.exp(-w * f.dt);
    let d = glow.x - ptr.x / f.viewW;
    let n = (glow.vx + w * d) * f.dt;
    glow.vx = (glow.vx - w * n) * e;
    glow.x = ptr.x / f.viewW + (d + n) * e;
    d = glow.y - ptr.y / f.viewH;
    n = (glow.vy + w * d) * f.dt;
    glow.vy = (glow.vy - w * n) * e;
    glow.y = ptr.y / f.viewH + (d + n) * e;
  }

  /* ---------- the masks ---------- */

  let index: MaskIndex | null = null;
  let indexFor: Shape | '' = '';
  /** Sheets on the GPU, by number: a few, the one in use and its neighbours. */
  const sheets = new Map<number, { tex: WebGLTexture | null; used: number }>();
  let tick = 0;
  /** How much of the water's light is up: it comes in once the place's own mask is here. */
  let maskK = 0;
  function openMasks(shape: Shape) {
    indexFor = shape;
    index = null;
    for (const s of sheets.values()) if (s.tex) gl?.deleteTexture(s.tex);
    sheets.clear();
    fetch(`${DIR}/${shape}.mask.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!destroyed && indexFor === shape) index = j;
      })
      .catch(() => {});
  }
  function sheet(k: number): WebGLTexture | null {
    if (!gl || !index || k < 0 || k >= index.sheets) return null;
    const had = sheets.get(k);
    if (had) {
      had.used = tick;
      return had.tex;
    }
    const entry = { tex: null as WebGLTexture | null, used: tick };
    sheets.set(k, entry);
    const shape = indexFor;
    fetch(`${DIR}/${shape}.mask-${k}.webp`)
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b))
      .then((img) => {
        if (destroyed || indexFor !== shape || sheets.get(k) !== entry) return img.close();
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, img);
        img.close();
        entry.tex = tex;
        if (sheets.size > 4) {
          let old = -1;
          let at = Infinity;
          for (const [n, s] of sheets) {
            if (s.used < at && s.tex) {
              at = s.used;
              old = n;
            }
          }
          if (old >= 0 && old !== k) {
            gl.deleteTexture(sheets.get(old)!.tex);
            sheets.delete(old);
          }
        }
      })
      .catch(() => sheets.delete(k));
    return null;
  }

  /* ---------- the programs ---------- */

  type Locs = Record<string, WebGLUniformLocation | null>;
  let water: { prog: WebGLProgram; u: Locs } | null = null;
  let snow: { prog: WebGLProgram; u: Locs } | null = null;
  let quad: WebGLVertexArrayObject | null = null;
  let flakes: WebGLVertexArrayObject | null = null;
  // The two programs are built off the page's thread where the browser can (KHR_parallel_shader_compile): they are
  // asked for here and taken up in whichever frame finds them done. Nothing waits on them.
  const par = gl?.getExtension('KHR_parallel_shader_compile') ?? null;
  const start = (vs: string, fs: string) => {
    const prog = gl!.createProgram();
    for (const [type, src] of [[gl!.VERTEX_SHADER, vs], [gl!.FRAGMENT_SHADER, fs]] as const) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      gl!.attachShader(prog, s);
    }
    gl!.linkProgram(prog);
    return prog;
  };
  const take = (prog: WebGLProgram, names: string[]) => {
    if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) return null;
    const u: Locs = {};
    for (const n of names) u[n] = gl!.getUniformLocation(prog, n);
    return { prog, u };
  };
  let pending: [WebGLProgram, WebGLProgram] | null = null;
  /** Whether the programs are in: asked each frame until they are (or have failed: then the layer is only the breath). */
  let ok = false;
  let failed = !gl;
  function ready() {
    if (ok || failed || !gl || !pending) return ok;
    if (par && !(gl.getProgramParameter(pending[0], par.COMPLETION_STATUS_KHR) && gl.getProgramParameter(pending[1], par.COMPLETION_STATUS_KHR))) return false;
    const t0 = performance.now();
    water = take(pending[0], ['uMask', 'uNoise', 'uFit', 'uP', 'uCa', 'uCb', 'uCellA', 'uCellB', 'uIn', 'uWords', 'uM', 'uT', 'uGlow', 'uRing', 'uGate', 'uGateR', 'uLine']);
    snow = take(pending[1], ['uShift', 'uBox', 'uF', 'uR', 'uU', 'uFit', 'uWords', 'uK', 'uS', 'uTint']);
    cost.compileMs += performance.now() - t0;
    pending = null;
    ok = !!water && !!snow;
    failed = !ok;
    if (ok) stage.append(canvas, tag);
    return ok;
  }
  if (gl) {
    const t0 = performance.now();
    pending = [start(VERT, FRAG), start(SNOW_VERT, SNOW_FRAG)];
    cost.compileMs = performance.now() - t0;
    quad = gl.createVertexArray();
    gl.bindVertexArray(quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // The flakes: a place in the box each, and a number of its own. (The same ones every visit.)
    const seeds = new Float32Array(FLAKES * 4);
    let r = 0x2545f491;
    for (let i = 0; i < seeds.length; i++) {
      r ^= r << 13;
      r ^= r >>> 17;
      r ^= r << 5;
      seeds[i] = (r >>> 0) / 4294967296;
    }
    // (In order of that number: fewer flakes out is then a shorter run of the same buffer.)
    const order = Array.from({ length: FLAKES }, (_, i) => i).sort((a, b) => seeds[a * 4 + 3] - seeds[b * 4 + 3]);
    const sorted = new Float32Array(seeds.length);
    order.forEach((from, to) => sorted.set(seeds.subarray(from * 4, from * 4 + 4), to * 4));
    flakes = gl.createVertexArray();
    gl.bindVertexArray(flakes);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, sorted, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    // The noise: 64 x 64 random values, repeating, smoothed by the sampler. (The same every visit.)
    const grain = new Uint8Array(64 * 64);
    for (let i = 0; i < grain.length; i++) {
      r ^= r << 13;
      r ^= r >>> 17;
      r ^= r << 5;
      grain[i] = r & 255;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 64, 64, 0, gl.RED, gl.UNSIGNED_BYTE, grain);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
  }

  /** How much snow is in the air at a place in the world (0..1), from the plan's keys along the valley. */
  function airAt(y: number) {
    const keys = plan.air;
    if (y <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (y < keys[i][0]) {
        const [y0, k0] = keys[i - 1];
        return k0 + (keys[i][1] - k0) * smooth(y0, keys[i][0], y);
      }
    }
    return keys[keys.length - 1][1];
  }

  const three = new Float32Array(12);
  const camTo = (out: Float32Array, c: ArrayLike<number>, at: number, aspect: number, seen: boolean) => {
    const tan = c[at + 12];
    for (let k = 0; k < 3; k++) {
      out[k] = c[at + k];
      out[3 + k] = c[at + 3 + k];
      out[6 + k] = seen ? c[at + 6 + k] / (tan * aspect) : c[at + 6 + k] * tan * aspect;
      out[9 + k] = seen ? c[at + 9 + k] / tan : c[at + 9 + k] * tan;
    }
    return out;
  };
  const flat = new Float32Array(13);
  let night: boolean | null = null;
  let gain = 0;
  /** The canvas's pixels to a CSS pixel (`__flightLiveScale`: the measurements try others). */
  const scaleHeld = (window as unknown as { __flightLiveScale?: number }).__flightLiveScale;
  let scale = 1;
  let sizedTo = '';

  function draw(f: LiveFrame) {
    if (!gl || !water || !snow || !f.cam) return;
    const c = f.cam;
    // The canvas: the window's own size, a pixel to a CSS pixel on a large screen (the layer is soft; the picture under
    // it is what is sharp), a quarter finer on a phone, where a CSS pixel is three of the screen's.
    scale = scaleHeld ?? (f.viewW * f.viewH < 600000 ? Math.min(window.devicePixelRatio || 1, 1.25) : 1);
    const size = `${f.viewW}x${f.viewH}x${scale}`;
    if (size !== sizedTo) {
      sizedTo = size;
      canvas.width = Math.max(2, Math.round(f.viewW * scale));
      canvas.height = Math.max(2, Math.round(f.viewH * scale));
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    tick++;

    // The two masks either side of this place, and where they lie on their sheet.
    let tex: WebGLTexture | null = null;
    let mix = 0;
    let cellA = [0, 0];
    let cellB = [0, 0];
    let ia = 0;
    let ib = 0;
    if (f.shape !== indexFor) openMasks(f.shape);
    const ix = index;
    if (ix && f.cams) {
      const m = Math.min(ix.n - 1, Math.max(0, ((f.s - ix.from) * ix.frames) / ix.step));
      let a = Math.floor(m);
      mix = m - a;
      if (mix > 0.998) {
        a++;
        mix = 0;
      } else if (mix < 0.002) mix = 0;
      const k = Math.min(ix.sheets - 1, Math.floor(a / ix.per));
      tex = sheet(k);
      // (The sheet the reader is heading for is asked for ahead.)
      if (a - k * ix.per > ix.per * 0.6 || f.v > 0.2) sheet(k + 1);
      if (f.v < -0.2) sheet(k - 1);
      const ca = a - k * ix.per;
      const cb = Math.min(ca + 1, ix.per);
      cellA = [(ca % ix.cols) / ix.cols, Math.floor(ca / ix.cols) / ix.rows];
      cellB = [(cb % ix.cols) / ix.cols, Math.floor(cb / ix.cols) / ix.rows];
      const frames = f.cams.length / CAM_STRIDE;
      ia = Math.min(frames - 1, Math.round(ix.from * ix.frames) + a * ix.step);
      ib = Math.min(frames - 1, ia + ix.step);
    }
    maskK += ((tex ? 1 : 0) - maskK) * (1 - Math.exp(-f.dt / 0.35));
    const t = f.now / 1000;

    flat.set(c.pos, 0);
    flat.set(c.f, 3);
    flat.set(c.r, 6);
    flat.set(c.u, 9);
    flat[12] = c.tan;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    // Water, the pointer, the gate.
    gl.disable(gl.BLEND);
    gl.useProgram(water.prog);
    gl.bindVertexArray(quad);
    const u = water.u;
    if (f.night !== night) {
      night = f.night;
      stale[0] |= 2;
      stale[1] |= 2;
    }
    const s0 = stale[0];
    if (s0 & 2) {
      gl.uniform1i(u.uMask, 0);
      gl.uniform1i(u.uNoise, 1);
    }
    gl.uniform4f(u.uFit, f.fit[0], f.fit[1], f.fit[2], f.fit[3]);
    gl.uniform3fv(u.uP, camTo(three, flat, 0, f.aspect, false));
    if (tex && ix && f.cams) {
      gl.uniform3fv(u.uCa, camTo(three, f.cams, ia * CAM_STRIDE, f.aspect, true));
      gl.uniform3fv(u.uCb, camTo(three, f.cams, ib * CAM_STRIDE, f.aspect, true));
      gl.uniform4f(u.uCellA, cellA[0], cellA[1], 1 / ix.cols, 1 / ix.rows);
      gl.uniform2f(u.uCellB, cellB[0], cellB[1]);
      gl.uniform2f(u.uIn, 0.5 / ix.w, 0.5 / ix.h);
    }
    if (s0 & 1) gl.uniform4fv(u.uWords, wordsU);
    gl.uniform4f(u.uM, mix, tex ? 1 : 0, f.viewW / f.viewH, (2 * c.tan) / (f.viewH * f.fit[1]));
    // (Where the camera comes to rest the sea is a still mirror with its own path of light: the water's light is all but let go there.)
    const still = 1 - 0.7 * smooth(plan.settle - 1.6, plan.settle - 0.3, f.s);
    gl.uniform4f(u.uT, t % 3600, f.night ? 1 : 0, gain * maskK * still, gain * maskK);
    gl.uniform4f(u.uGlow, glow.x, glow.y, 0.13, glow.k);
    if (s0 & 8) gl.uniform4fv(u.uRing, rings);
    if (s0 & 4) {
      gl.uniform4fv(u.uGate, gateU);
      gl.uniform4fv(u.uGateR, gateRU);
      gl.uniform2fv(u.uLine, lineU);
    }
    stale[0] = 0;
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // The air.
    const density = airAt(c.pos[1]) * (step ? 0.5 : 1);
    const count = Math.min(FLAKES, Math.ceil(FLAKES * (density + 0.07)));
    if (density > 0.004 && gain > 0.004) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(snow.prog);
      gl.bindVertexArray(flakes);
      const n = snow.u;
      // (The wind comes and goes a little. The box's place is worked out here, where the numbers are exact.)
      const blown = t + 9 * Math.sin(t * 0.07);
      for (let k = 0; k < 3; k++) three[k] = (((WIND[k] * blown - c.pos[k]) % BOX[k]) + BOX[k]) % BOX[k];
      gl.uniform3f(n.uShift, three[0], three[1], three[2]);
      const s1 = stale[1];
      if (s1 & 2) gl.uniform3f(n.uBox, BOX[0], BOX[1], BOX[2]);
      gl.uniform3f(n.uF, c.f[0], c.f[1], c.f[2]);
      gl.uniform3f(n.uR, c.r[0] / (c.tan * f.aspect), c.r[1] / (c.tan * f.aspect), c.r[2] / (c.tan * f.aspect));
      gl.uniform3f(n.uU, c.u[0] / c.tan, c.u[1] / c.tan, c.u[2] / c.tan);
      gl.uniform4f(n.uFit, f.fit[0], f.fit[1], f.fit[2], f.fit[3]);
      if (s1 & 1) gl.uniform4fv(n.uWords, wordsU);
      // (A flake's size follows the window's height, as everything in the frame does.)
      gl.uniform4f(n.uK, density, (0.12 * canvas.height * f.fit[1]) / c.tan, t % 3600, gain);
      gl.uniform2f(n.uS, f.viewW / f.viewH, 4.5 * scale * Math.max(1, f.viewH / 900));
      if (s1 & 2) {
        if (f.night) gl.uniform3f(n.uTint, 0.5, 0.6, 0.78);
        else gl.uniform3f(n.uTint, 1, 1, 1);
      }
      stale[1] = 0;
      gl.drawArrays(gl.POINTS, 0, count);
    }
    gl.bindVertexArray(null);
  }

  return {
    gl,
    frame(f) {
      if (destroyed) return;
      const t0 = performance.now();
      last = f;
      breathe(f);
      if (!ready()) return;
      // The governor. With the picture at rest this layer is all that is drawn: if frames run long then, it is the
      // layer's doing. It gives up half its flakes first, then itself.
      if (early.length < 40) {
        early.push(f.dt * 1000);
        if (early.length === 40) period = [...early].sort((a, b) => a - b)[8];
      } else if (f.rest && heldStep === null && step < 2) {
        restFrames++;
        if (restFrames > 20) {
          slow += f.dt * 1000 > Math.max(period * 1.4, period + 4) ? 1 : -0.25;
          slow = Math.max(0, slow);
          if (slow > 45) {
            step++;
            slow = 0;
          }
        }
      } else restFrames = 0;
      const now = heldStep ?? step;
      if (now >= 2) {
        if (canvas.style.display !== 'none') {
          canvas.style.display = 'none';
          tag.style.opacity = tagOpacity = '0';
        }
        return;
      }
      if (canvas.style.display === 'none') canvas.style.display = '';
      gain += ((f.on ? 1 : 0) - gain) * (1 - Math.exp(-f.dt / 0.5));
      pointer(f);
      words(f);
      gates(f);
      draw(f);
      const ms = performance.now() - t0;
      cost.cpuMs += ms;
      cost.cpuMax = Math.max(cost.cpuMax, ms);
      cost.frames++;
    },
    redraw() {
      if (last) draw(last);
    },
    stats: () => ({ ok, parallel: !!par, step: heldStep ?? step, period, compileMs: cost.compileMs, cpuMs: cost.frames ? cost.cpuMs / cost.frames : 0, cpuMax: cost.cpuMax, frames: cost.frames, w: canvas.width, h: canvas.height, mask: !!index, sheets: sheets.size, maskK, gain, breath, flakes: FLAKES }),
    holdStep(n) {
      heldStep = n;
    },
    destroy() {
      destroyed = true;
      forkWatch.disconnect();
      fork?.removeEventListener('keydown', onForkKey);
      fork?.removeEventListener('pointerdown', onForkDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onLeave);
      document.removeEventListener('pointerleave', onLeave);
      stage.style.transform = '';
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
      tag.remove();
    },
  };
}
