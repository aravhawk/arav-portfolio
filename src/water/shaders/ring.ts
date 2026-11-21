/**
 * Ask Around's place: a ring of seven standing stones of ice round a small round pool, on the river's bank.
 *
 * It is built from what the world already had. Each stone is a convex piece cut by planes, as the tarn's shards and
 * the shallows' seracs are, and is shaded by the same glacier ice the seracs are made of (`iceGlacier`, the deep
 * face). The light inside a stone is the shards' own: a fine thread up its heart and a blue glow in the ice round it.
 * Six stones hold that light and one does not. The pool is carved in the bed like any other water (`paintRing`), so
 * the pass's own water is its surface; this piece adds the stones' image in it and their light on it.
 *
 * It is a registered subject with no pass of its own (see `customSubjects` in the registry): the pass calls
 * `ringIce(colour, ray, progress)` over the finished ground and water.
 */

import { RING, ringStones } from '../geography';

const f = (n: number) => n.toFixed(1);

/** How many planes cut a stone. */
const PLANES = 10;

/**
 * A stone's planes, in the world's axes, from its foot (outward normal, distance). A standing stone is a slab on end:
 * wider than it is deep, drawing in a little as it rises, its head broken aslant in two facets, a chip out of one
 * arris. No two are cut alike.
 */
function stonePlanes(i: number, h: number, w: number, turn: number): string[] {
  const rnd = (k: number) => {
    const v = Math.sin(i * 91.7 + k * 47.3 + 1.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const out: [number, number, number, number][] = [];
  const add = (n: [number, number, number], p: [number, number, number]) => {
    const l = Math.hypot(n[0], n[1], n[2]);
    const u = [n[0] / l, n[1] / l, n[2] / l];
    // (From the stone's own frame, x across its broad face, into the world's.)
    const wn: [number, number, number] = [u[0] * c - u[1] * s, u[0] * s + u[1] * c, u[2]];
    const wp: [number, number, number] = [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
    out.push([wn[0], wn[1], wn[2], wn[0] * wp[0] + wn[1] * wp[1] + wn[2] * wp[2]]);
  };
  // Six faces round it: the two broad ones nearly flat, the narrow ends in two faces each.
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6 + (rnd(k) - 0.5) * 0.5;
    const broad = Math.abs(Math.sin(a));
    const r = w * (0.56 + 0.44 * (1 - broad)) * (0.86 + 0.28 * rnd(k + 10));
    // (It draws in as it rises: the face would meet the middle line this far up.)
    const apex = h * (2.3 + 2.6 * rnd(k + 20));
    add([Math.cos(a) * apex, Math.sin(a) * apex, r], [Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  // The head, broken aslant: one long facet and a shorter, steeper one against it.
  const b = rnd(30) * Math.PI * 2;
  add([Math.cos(b) * 0.5, Math.sin(b) * 0.5, 1], [0, 0, h * 0.985]);
  add([Math.cos(b + 2.4) * 1.5, Math.sin(b + 2.4) * 1.5, 1], [Math.cos(b + 2.4) * w * 0.34, Math.sin(b + 2.4) * w * 0.34, h * 0.93]);
  // A chip out of an arris, part way up.
  const ch = rnd(40) * Math.PI * 2;
  const cz = h * (0.34 + 0.3 * rnd(41));
  add([Math.cos(ch), Math.sin(ch), 0.42], [Math.cos(ch) * w * 0.74, Math.sin(ch) * w * 0.74, cz]);
  // Its foot is in the snow.
  add([0, 0, -1], [0, 0, -10]);
  if (out.length !== PLANES) throw new Error('ring planes');
  return out.map(([x, y, z, d]) => `vec4(${x.toFixed(5)}, ${y.toFixed(5)}, ${z.toFixed(5)}, ${d.toFixed(3)})`);
}

const STONES = ringStones();

export const RING_ICE = `// ---- the ring: seven standing stones of ice round a small round pool
const int RG_N = ${STONES.length};
const vec2 RG_C = vec2(${f(RING.x)}, ${f(RING.y)});
const float RG_POOL = ${f(RING.pool)};
// Each stone: where its foot stands, how tall it is, its half width.
const vec4 RG_S[${STONES.length}] = vec4[${STONES.length}](${STONES.map((s) => `vec4(${f(s.x)}, ${f(s.y)}, ${f(s.h)}, ${f(s.w)})`).join(', ')});
// How much light each holds: one holds none.
const float RG_LIT[${STONES.length}] = float[${STONES.length}](${STONES.map((s) => (s.lit ? '1.0' : '0.0')).join(', ')});
const vec4 RG_P[${STONES.length * PLANES}] = vec4[${STONES.length * PLANES}](${STONES.flatMap((s, i) => stonePlanes(i, s.h, s.w, s.turn)).join(', ')});
// How far the ray would have to go on, past the face it meets, to meet the next: small at an arris.
float gRingEdge = 1e3;
float ringHit(vec3 ro, vec3 rd, int i, out vec3 n, out float tF) {
  vec4 s = RG_S[i];
  vec3 o = ro - vec3(s.xy, 0.0);
  n = vec3(0.0, 0.0, 1.0);
  tF = 1e9;
  // (Most rays pass nowhere near it: a ball that holds all of it is asked first.)
  vec3 oc = o - vec3(0.0, 0.0, s.z * 0.5);
  float bq = dot(oc, rd);
  float rr = s.z * 0.5 + s.w + 14.0;
  if (bq * bq - dot(oc, oc) + rr * rr < 0.0) return -1.0;
  float tN = 0.0;
  float tN2 = -1e3;
  for (int k = 0; k < ${PLANES}; k++) {
    vec4 pl = RG_P[i * ${PLANES} + k];
    float den = dot(rd, pl.xyz);
    float num = pl.w - dot(o, pl.xyz);
    if (den < -1e-6) { float t = num / den; if (t > tN) { tN2 = tN; tN = t; n = pl.xyz; } else if (t > tN2) tN2 = t; }
    else if (den > 1e-6) tF = min(tF, num / den);
    else if (num < 0.0) return -1.0;
    if (tN > tF) return -1.0;
  }
  gRingEdge = tN - tN2;
  return tN > 0.0 ? tN : -1.0;
}
/**
 * A stone's ice: the seracs' own. Clear glacier ice with its years running through it, pale at its arrises and deep
 * blue through its thick foot; snow where its broken head lies easy. The six that have answered hold the shards'
 * light: a thread up the heart, a glow in the ice round it. The seventh is only ice, and stands a shade darker.
 */
vec3 ringColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, int i, float soft) {
  vec4 s = RG_S[i];
  float fi = float(i);
  float lit = RG_LIT[i];
  vec3 p = ro + rd * t;
  vec3 hp = p - vec3(s.xy, 0.0);
  float thick = max(tF - t, 0.0);
  bool top = n.z > 0.62;
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  float along = dot(hp, tu);
  float faceId = fract(n.x * 7.31 + n.y * 3.17);
  vec2 q = vec2(along + fi * 91.0 + faceId * 170.0, hp.z + 0.22 * hp.x + 0.1 * hp.y);
  float wasM = gMirror;
  gMirror = max(gMirror, soft);
  vec3 col = iceGlacier(p, n, rd, t, q, thick, 1.0, 1.0, top ? 0.0 : 0.9, gRingEdge * 1.5, fi * 0.61 + 0.37, true);
  gMirror = wasM;
  // A face that leans back lies open to the sky and is paler; one that overhangs is in its own shade.
  col *= 1.0 + 0.2 * clamp(n.z, -0.6, 0.6) * (top ? 0.0 : 1.0);
  // The one that holds no light: the same ice, unlit from within, and so the darker for standing among the others.
  col *= mix(vec3(0.52, 0.6, 0.72), vec3(1.0), lit);
  // The light inside. The ray's nearest approach to the heart's line says how much of the glow it crosses.
  vec3 mp = ro + rd * (t + min(tF, t + 4.0 * s.w)) * 0.5 - vec3(s.xy, 0.0);
  float up = clamp(mp.z / s.z, 0.0, 1.0);
  float rise = smoothstep(0.02, 0.16, up) * (1.0 - smoothstep(0.66, 0.92, up));
  // (Each face bends the thread a little its own way: it wavers as it climbs, and is never a ruled tube.)
  vec2 bent = mp.xy + (tu.xy * (faceId - 0.5) * 0.14 + n.xy * 0.06 * sin(mp.z * 0.045 + faceId * 9.0 + fi)) * s.w;
  float axisD = length(bent) / s.w;
  float axis0 = length(mp.xy) / s.w;
  float lengths = 0.72 + 0.28 * smoothstep(0.25, 0.75, n1(mp.z / 23.0 - uTime * 0.3 + fi * 3.7));
  float thread = exp(-axisD * axisD / 0.012) * rise * lengths * (1.0 - 0.8 * soft);
  float halo = exp(-axis0 / mix(0.52, 0.34, uNight)) * rise;
  if (!top) col += (vec3(0.72, 0.97, 1.0) * thread * mix(2.4, 1.0, uNight) + vec3(0.3, 0.8, 0.98) * halo * mix(1.5, 1.1, uNight)) * lit * mix(S.amb.g * 1.7 + 0.25, 1.0, uNight);
  // Snow on what looks up.
  if (top) col = snowOn(n, 0.2 * sin(hp.x * 0.13 + fi) * sin(hp.y * 0.11)) * mix(vec3(1.1), vec3(0.62, 0.84, 1.22), uNight);
  // Its foot in the snow: a little drift lies against it, and it is in its own shade there.
  if (!top) {
    float drift = 5.0 + 5.0 * sin(along * 0.11 + fi * 2.0);
    col *= 1.0 - mix(0.22, 0.1, uNight) * (1.0 - smoothstep(drift, drift + 26.0, hp.z));
  }
  // (Its image in the water is the water's: darker than the ice that throws it, and bluer.)
  if (soft > 0.5) col *= mix(vec3(0.58, 0.72, 0.84), vec3(0.7, 0.8, 0.9), uNight);
  return col;
}
/** The nearest stone on a ray, or -1. */
float ringNearest(vec3 ro, vec3 rd, out vec3 n, out float tF, out int which, out float edge) {
  float best = -1.0;
  which = 0;
  n = vec3(0.0, 0.0, 1.0);
  tF = 0.0;
  edge = 1e3;
  for (int i = 0; i < RG_N; i++) {
    vec3 n1_;
    float f1;
    float t = ringHit(ro, rd, i, n1_, f1);
    if (t > 0.0 && (best < 0.0 || t < best)) { best = t; n = n1_; tF = f1; which = i; edge = gRingEdge; }
  }
  return best;
}
/** The ring over the finished ground and water. */
vec3 ringIce(vec3 col, vec3 dir, float progress) {
  // (It is let go with distance, whole: half there, it would be a ghost.)
  float nearK = 1.0 - smoothstep(2850.0, 3250.0, length(uCamPos.xy - RG_C));
  if (nearK <= 0.0) return col;
  // Most of the frame has nothing of it: neither a stone on its line of sight nor its ground under it.
  vec3 toC = vec3(RG_C, 120.0) - uCamPos;
  float alongC = dot(toC, dir);
  vec3 offC = toC - dir * alongC;
  bool sight = alongC > 0.0 && dot(offC, offC) < ${f((RING.r + 120) * (RING.r + 120) + 160 * 160)};
  float tl = dir.z < -0.0006 ? uCamPos.z / -dir.z : -1.0;
  vec2 pg = uCamPos.xy + dir.xy * max(tl, 0.0);
  bool ground = tl > 0.0 && length(pg - RG_C) < ${f(RING.r + 520)};
  if (!sight && !ground) return col;
  vec3 n;
  float tF;
  int bi;
  float edge;
  float best = sight ? ringNearest(uCamPos, dir, n, tF, bi, edge) : -1.0;
  vec3 Ls = keyDir();
  if (best < 0.0 && ground) {
    float tw = (uCamPos.z + FREEBOARD) / -dir.z;
    vec2 pw = uCamPos.xy + dir.xy * tw;
    float sdL = textureLod(uBedA, bedUv(pg), 0.0).r;
    float rP = length(pw - RG_C);
    bool wet = sdL < 0.0 && rP < RG_POOL + 30.0 && textureLod(uBedA, bedUv(pw), 0.0).r < -1.0;
    vec3 ps = wet ? vec3(pw, -FREEBOARD) : vec3(pg, 0.0);
    // Each stone's shade lies long across the snow and the pool, away from the light.
    float sh = 0.0;
    // And the light the six throw on the ground at their feet, and on the water.
    float glow = 0.0;
    for (int i = 0; i < RG_N; i++) {
      vec4 s = RG_S[i];
      vec2 toS = s.xy - ps.xy;
      float d = length(toS);
      vec2 l2 = normalize(Ls.xy + 1e-5);
      float al = dot(toS, l2);
      float off = length(toS - l2 * al);
      float len = s.z * length(Ls.xy) / max(Ls.z, 0.03);
      float wide = s.w * (0.8 + al / 1700.0);
      sh = max(sh, step(0.0, al) * (1.0 - smoothstep(wide * 0.6, wide * 1.35, off)) * (1.0 - smoothstep(len * 0.55, len, al)) * exp(-al / 620.0));
      // (A dark, close shade where it meets the snow.)
      sh = max(sh, 0.5 * (1.0 - smoothstep(s.w * 0.8, s.w * 1.9, d)));
      glow += RG_LIT[i] * exp(-d / (s.w * mix(1.5, 2.6, uNight)));
    }
    col *= 1.0 - sh * mix(wet ? 0.3 : 0.4, 0.14, uNight) * nearK;
    col += vec3(0.2, 0.68, 0.82) * glow * mix(0.03, wet ? 0.3 : 0.16, uNight) * nearK;
    if (wet) {
      // The pool is still, and holds them: each stone's image stands in it, clean, bent only by the pool's slow swell.
      vec2 swell = vec2(sin(pw.y * 0.052 + pw.x * 0.013 + uTime * 0.5), 0.5 * sin(pw.x * 0.043 + pw.y * 0.021 + uTime * 0.4)) * 0.006;
      vec3 rd2 = reflect(dir, normalize(vec3(-swell, 1.0)));
      vec3 n2;
      float tF2;
      int b2;
      float e2;
      float t2 = ringNearest(vec3(pw, -FREEBOARD), rd2, n2, tF2, b2, e2);
      float inPool = 1.0 - smoothstep(RG_POOL - 14.0, RG_POOL + 2.0, rP);
      if (t2 > 0.0) {
        gRingEdge = e2;
        vec3 mc = ringColor(vec3(pw, -FREEBOARD), rd2, t2, tF2, n2, b2, 1.0);
        float cosw = clamp(-dir.z, 0.0, 1.0);
        float mir = mix(0.9, 0.62, smoothstep(0.1, 0.6, cosw)) * (1.0 - smoothstep(0.0, 620.0, t2) * 0.35);
        col = mix(col, inAir(mc, dir, tw + t2) * 0.86, mir * inPool * nearK);
      }
    }
    return col;
  }
  if (best < 0.0) return col;
  // Its outline is geometry: smoothed by counting four more rays.
  float cov = 1.0;
  vec3 nA;
  float fA;
  for (int k = 0; k < 4; k++) {
    vec2 o2 = k == 0 ? vec2(0.5, 0.2) : k == 1 ? vec2(-0.2, 0.5) : k == 2 ? vec2(-0.5, -0.2) : vec2(0.2, -0.5);
    vec3 rdA = normalize(dir + (uCamR * o2.x + uCamU * o2.y) * uPxAng);
    if (ringHit(uCamPos, rdA, bi, nA, fA) < 0.0) cov -= 0.2;
  }
  gRingEdge = edge;
  vec3 c = inAir(ringColor(uCamPos, dir, best, tF, n, bi, 0.0), dir, best);
  gMkOcc = max(gMkOcc, cov * nearK);
  return mix(col, c, cov * nearK);
}`;
