/**
 * The flight's shading pass: the same world as the page's (a bed, water
 * over it, the ice name), seen through a pitched perspective camera.
 *
 * Coordinates: x right, y forward, z up, in world units. The land plane is
 * z = 0. For each pixel a ray leaves the camera. If it reaches the land
 * plane, the point it reaches (p) and its slope (tilt: how far the ray
 * moves sideways per unit of depth) are what the page's pass works from,
 * so water, bed, walls, ice and its cut are found the same way here. If it
 * never reaches the ground it sees the sky and the ranges, which is also
 * what water and wet ice reflect.
 *
 * Seen at a low angle a ground shimmers unless its detail is filtered by
 * distance. Every fine term here is read at a level of detail chosen from
 * the size of a pixel on the ground (foot), so it eases to its mean before
 * it can alias. No screen derivative is used anywhere: every level is
 * explicit, so the pass may branch freely.
 *
 * The sky model, the ranges and the tone curve are the ending's, so the two
 * belong to one film.
 */

import { ICE_FIELD } from './ice';
import { PANO, SUN } from './terrain';
import { BASIN, CONF_Y, ISLAND, STREAM, TRIBS } from '../world';

/** The water sits this far below the land, world units. */
export const FLIGHT_FREEBOARD = 22;

const smoothJs = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Where the stream steps down into the basin, and where the land has come down to the water again. */
const STEP = { y0: BASIN.y - 330, y1: BASIN.y - 150, out0: BASIN.y + BASIN.h + 500, out1: BASIN.y + BASIN.h + 1300, more: 1.7 };
/** How far below the land the water lies at a distance down the valley: the basin is walled. */
export function freeboardAt(y: number) {
  return FLIGHT_FREEBOARD * (1 + STEP.more * smoothJs(STEP.y0, STEP.y1, y) * (1 - smoothJs(STEP.out0, STEP.out1, y)));
}

export const FLIGHT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;

uniform vec3 uCamPos;
uniform vec3 uCamF;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform vec2 uLens;        // x: tan of half the vertical field of view, y: aspect
uniform float uPxAng;      // the angle one device pixel spans, radians
uniform vec4 uSim;         // x: world y of sim row 0, y: texel size, z: w, w: h
uniform vec2 uBedSize;
uniform float uBedDiv;
uniform float uTime;
uniform float uFlowSpeed;
uniform float uQuality;    // 0 low, 1 mid, 2 high
uniform float uLean;       // 0..2: how many steps leaner the governor has asked the shading to be (fractions while a step fades)
uniform float uNight;      // 0 morning, 1 the hour before dawn
uniform float uWorldW;
uniform float uShoal;      // world y where the river has become open water
uniform float uEnd;        // 0..1: the last move, up and over open water

uniform sampler2D uBedA;
uniform sampler2D uBedB;
uniform sampler2D uWave;   // h, v, gx, gy
uniform sampler2D uVel;
uniform sampler2D uCurv;
uniform sampler2D uGrain;
uniform sampler2D uHeat;
uniform sampler2D uSlabTex;
uniform sampler2D uPano;   // the ranges: sun, sky, snow, distance
uniform sampler2D uGround; // the baked snow: height, slope, a second field
uniform sampler2D uGlowTex; // the last frame's highlights, small and soft
uniform float uBloom;
uniform float uIceH;
uniform float uIceOn;      // 0 once the whole sheet has melted: the field is not asked at all
uniform float uGlow;       // 0..1: how much of the lake's sheet is still there to glow under
uniform float uMeltAct;

uniform vec3 uSlabPos;     // the middle of the slab's foot
uniform vec4 uSlabDir;     // xy: the way its face looks, zw: its right as the viewer sees it
uniform vec3 uSlabSize;    // width, height, thickness
uniform vec4 uSlabBox;     // where it can be on screen: x0, y0, x1, y1 in vUv
uniform vec3 uSlabTint;    // the picture's mean colour, linear: the light it throws

uniform vec3 uBed;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform vec3 uIceCol;
uniform vec4 uLight;       // x: ambient, y: key, z: caustic gain, w: glint gain
uniform float uTribW[${TRIBS.length}]; // each stream's width at its mouth, 0 where there is none

const float FREEBOARD = ${FLIGHT_FREEBOARD}.0;
const float DEEP = 130.0;
// The water's depth below the land at this pixel (deeper in the walled basin), and 0..1 how walled it is.
float gFree = FREEBOARD;
float gWalled = 0.0;
// 0..1: on the outcrop the object stands on.
float gRock = 0.0;
float walledAt(float y) { return smoothstep(${STEP.y0.toFixed(1)}, ${STEP.y1.toFixed(1)}, y) * (1.0 - smoothstep(${STEP.out0.toFixed(1)}, ${STEP.out1.toFixed(1)}, y)); }

const float PANO_AZ = ${PANO.az.toFixed(4)};
const float PANO_EL = ${PANO.el.toFixed(4)};
const float PANO_W = ${PANO.w}.0;
const float SUN_AZ = ${SUN.az.toFixed(4)};
const float SUN_EL = ${SUN.el.toFixed(4)};
// What the aurora lends to things under it: zero by day.
vec3 uAurora = vec3(0.0);
// The governor's two steps, each 0..1 as it fades in.
float gL1 = 0.0;
float gL2 = 0.0;
// 0..1: how far a mirror's aurora has eased from rays to a plain wash.
float gWash = 0.0;

vec2 bedUv(vec2 w) { return w / (uBedSize * uBedDiv); }
${ICE_FIELD}
vec2 simUv(vec2 w) { return vec2(w.x / (uSim.z * uSim.y), (w.y - uSim.x) / (uSim.w * uSim.y)); }

/* ---------- small noise (the ending's) ---------- */

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }

/* ---------- the sky, the sun and the ranges ---------- */

struct Sky { vec3 zen; vec3 mid; vec3 hor; vec3 band; vec3 sun; vec3 key; vec3 amb; float haze; };
Sky S;

void skyKey() {
  // Morning at a high latitude: cold clear daylight, a low sun off to the
  // left, a pale sky that deepens overhead.
  vec3 dz = vec3(0.06, 0.17, 0.48), dm = vec3(0.19, 0.37, 0.7), dh = vec3(0.5, 0.65, 0.84), db = vec3(1.25, 1.02, 0.74);
  // The hour before dawn: a deep blue sky, first light low behind the
  // ranges. The dark ending's light, earlier.
  vec3 nz = vec3(0.004, 0.011, 0.04), nm = vec3(0.012, 0.032, 0.085), nh = vec3(0.075, 0.07, 0.085), nb = vec3(0.62, 0.27, 0.085);
  S.zen = mix(dz, nz, uNight); S.mid = mix(dm, nm, uNight); S.hor = mix(dh, nh, uNight); S.band = mix(db, nb, uNight);
  float az = mix(SUN_AZ, 0.225, uNight);
  float el = mix(SUN_EL, -0.03, uNight);
  S.sun = vec3(sin(az) * cos(el), cos(az) * cos(el), sin(el));
  // What lights the ground: the sun by day; before dawn a faint raking
  // light from where the sun will be, and the sky.
  S.key = mix(vec3(1.0, 0.9, 0.74) * 2.9, vec3(0.5, 0.36, 0.3) * 0.05, uNight);
  S.amb = mix(vec3(0.27, 0.38, 0.56), vec3(0.013, 0.025, 0.055), uNight);
  S.haze = mix(1.0, 1.15, uNight);
  // What the aurora lends everything under it.
  uAurora = vec3(0.1, 0.62, 0.42) * uNight;
}

/** The direction the ground is lit from: the sun, or before dawn a low light on its bearing. */
vec3 keyDir() {
  float az = mix(SUN_AZ, 0.225, uNight);
  float el = mix(SUN_EL, 0.12, uNight);
  return vec3(sin(az) * cos(el), cos(az) * cos(el), sin(el));
}

vec3 sunBloom(float sd) {
  // (Powers by squaring: 8, 64, 512, 2048.)
  float a = sd * sd; a *= a; a *= a;
  float b = a * a; b *= b; b *= b;
  float c = b * b; c *= c; c *= c;
  float e = c * c; e *= e;
  return S.band * (a * 0.07 + b * 0.22 + c * 0.5 + e * 0.5);
}

/** The colour of the air at the horizon toward a bearing: what distance fades to. */
vec3 airAt(vec2 dxy) {
  float a = max(dot(normalize(dxy + 1e-5), normalize(S.sun.xy)), 0.0);
  return S.hor + S.band * (pow(a, 5.0) * 0.3 + pow(a, 2.0) * 0.08) * mix(0.5, 1.0, uNight);
}

/**
 * The aurora: two curtains hung across the north. Each has a sharp lower
 * hem and fades upward a long way; green at the hem, violet at the top;
 * and it is made of rays, which drift. The low one stands behind the
 * ranges; the high one is what the water and the ice mirror.
 */
// A dull mirror (the ice) shows the aurora without its rays: only the high curtain's wash.
bool gDull = false;
vec3 aurora(vec3 d) {
  float h = max(d.z, 0.0);
  vec3 wash = vec3(0.0);
  if (gDull || gWash > 0.0) {
    float up = h - 0.27;
    wash = mix(vec3(0.16, 0.92, 0.6), vec3(0.42, 0.22, 0.9), smoothstep(0.0, 1.32, up)) * (smoothstep(-0.05, 0.03, up) * exp(-max(up, 0.0) / 0.55) * 0.55);
    if (gDull) return wash;
    // (A leaner mirror keeps the curtain's light and lets its rays go.)
    wash *= 1.75;
  }
  float az = atan(d.x, d.y);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    if (gWash >= 1.0) break;
    float k = float(i);
    // (Each curtain is only looked for where it can be: the low one low, the high one above its hem.)
    if (i == 0 ? h > 0.5 : h < 0.16) continue;
    float a = az * mix(1.0, 0.8, k) + k * 1.9;
    float hem = mix(0.065, 0.27, k) + mix(0.03, 0.07, k) * sin(a * 1.9 + 0.6 + uTime * 0.011) + 0.02 * sin(a * 5.3 - uTime * 0.017);
    float up = h - hem;
    float tall = mix(0.1, 0.55, k);
    float prof = smoothstep(-0.012, 0.006, up) * exp(-max(up, 0.0) / tall);
    float fold = n1(a * 3.1 + uTime * 0.02 + k * 7.0);
    float rays = mix(0.45, 0.4, k) + mix(0.55, 0.6, k) * n1(a * mix(46.0, 19.0, k) + fold * 9.0 + uTime * 0.05) * (0.6 + 0.4 * n1(a * mix(131.0, 57.0, k) - uTime * 0.08));
    // Overhead the rays run together into a soft, dimmer wash.
    float over = k * smoothstep(0.4, 0.95, h);
    rays = mix(rays, 0.62, over * 0.6) * (1.0 - 0.6 * over);
    float reach = mix(smoothstep(0.2, 0.62, fold + 0.25 * sin(a * 0.9 + 1.0)), 0.55 + 0.45 * fold, k);
    vec3 tint = mix(vec3(0.16, 0.92, 0.6), vec3(0.42, 0.22, 0.9), smoothstep(0.0, tall * mix(1.5, 2.4, k), up));
    sum += tint * prof * rays * reach * mix(0.55, 2.15, k);
  }
  // Nothing of it toward the dawn.
  float dawn = max(dot(normalize(d.xy + 1e-5), normalize(S.sun.xy)), 0.0);
  return mix(sum * (1.0 - 0.8 * pow(dawn, 3.0) * (1.0 - smoothstep(0.14, 0.32, h))), wash, gWash);
}

// Stars are drawn only where the sky is seen directly: a point in moving water is noise.
bool gDirect = false;
// 0 where a mirror shows the sun as broken glitter instead of a smooth glow (the water in the name).
float gSunK = 1.0;
/** Stars: one to a cell of the sky, a pixel or two wide, lost in the haze low down. */
float stars(vec3 d) {
  vec2 g = vec2(atan(d.x, d.y), d.z) * 150.0;
  vec2 c = floor(g);
  float r = hash21(c);
  vec2 at = c + 0.2 + 0.6 * vec2(hash21(c + 17.3), hash21(c + 41.7));
  float px = max(uPxAng * 150.0, 0.02);
  float dot_ = 1.0 - smoothstep(0.45 * px, 1.25 * px, length(g - at));
  return dot_ * pow(r, 34.0) * 5.0 * smoothstep(0.03, 0.2, d.z);
}

vec3 skyColor(vec3 d, float clouds) {
  float h = max(d.z, 0.0);
  vec3 col = mix(S.hor, S.mid, smoothstep(0.0, mix(0.24, 0.17, uNight), h));
  col = mix(col, S.zen, smoothstep(0.07, 0.62, h));
  float az = max(dot(normalize(d.xy + 1e-5), normalize(S.sun.xy)), 0.0);
  // Warmth pools on the sun's side of the horizon; it is not a stripe.
  float warm = mix(0.45, 1.0, uNight);
  col += S.band * exp(-h * 15.0) * pow(az, 5.0) * 0.5 * warm;
  col += S.band * exp(-h * 30.0) * pow(az, 2.0) * 0.14 * warm;
  float sd = max(dot(d, S.sun), 0.0);
  col += sunBloom(sd) * (1.0 - 0.5 * uNight) * gSunK;
  col += vec3(1.0, 0.9, 0.7) * (smoothstep(0.9996, 0.99999, sd) * 2.4 + smoothstep(0.9999, 1.0, sd) * 1.6) * (1.0 - uNight) * gSunK;
  if (uNight > 0.0) {
    vec3 au = aurora(d);
    col += au * uNight;
    if (gDirect) col += vec3(0.8, 0.88, 1.0) * stars(d) * uNight * (1.0 - min(dot(au, vec3(1.5)), 0.8));
  }
  if (clouds > 0.0) {
    // Thin high cloud: white where the sun finds it by day, a faint warm
    // underside before dawn.
    // (Two reads of the baked noise, laid over the dome from above so there is no seam.)
    vec2 cu = d.xy / (0.35 + d.z);
    float c = 0.62 * textureLod(uDetail, cu * 0.11 + vec2(uTime * 0.0006, 0.0), 1.0).r + 0.38 * textureLod(uDetail, cu * 0.37 + 0.31, 2.0).r;
    float cloud = smoothstep(0.5, 0.74, c) * smoothstep(0.03, 0.2, h) * (1.0 - smoothstep(0.4, 0.85, h));
    vec3 lit = mix(vec3(0.82, 0.86, 0.92) + S.band * 0.1 * pow(az, 2.0), col * 0.8 + S.band * 0.07 * pow(az, 3.0), uNight);
    col = mix(col, lit, cloud * mix(0.42, 0.55, uNight) * clouds);
  }
  return col;
}

/**
 * The ranges: the baked panorama, lit now. Snow where the slopes are easy
 * and rock where they are steep; the morning sun on one side of every
 * ridge and blue shade on the other; and each range further off stands in
 * more air, so it is paler and bluer. Before dawn they are dark country
 * under the sky, their snow faintly lit by it.
 * soft: how many levels blunter to read it (a mirror image in moving water is not sharp).
 */
vec3 withRidges(vec3 col, vec3 d, float soft) {
  // (Well above the ranges and their mist there is only sky.)
  if (d.z > 0.14) return col;
  float el = asin(clamp(d.z, -1.0, 1.0));
  vec3 air = airAt(d.xy);
  if (el < PANO_EL) {
    float az = atan(d.x, d.y);
    vec2 uv = vec2(az / (2.0 * PANO_AZ) + 0.5, max(el, 0.0) / PANO_EL);
    float lod = log2(max(uPxAng * PANO_W / (2.0 * PANO_AZ), 1.0)) + soft;
    vec4 m = textureLod(uPano, uv, lod);
    float cover = 1.0 - smoothstep(0.86, 0.97, m.a);
    if (cover > 0.0) {
      vec3 alb = mix(mix(vec3(0.13, 0.125, 0.13), vec3(0.05, 0.055, 0.07), uNight), mix(vec3(0.92, 0.93, 0.95), vec3(0.5, 0.56, 0.66), uNight), m.b);
      float sunAz = max(dot(normalize(d.xy + 1e-5), normalize(S.sun.xy)), 0.0);
      vec3 day = S.key * 0.8 * m.r + S.amb * (0.1 + 0.62 * m.g);
      // Before dawn: the sky's own light, and the first warmth on what faces it.
      vec3 night = S.amb * (0.5 + 1.6 * m.g) + S.band * 0.035 * pow(sunAz, 3.0) * m.g + uAurora * 0.02 * m.g;
      vec3 rock = alb * mix(day, night, uNight);
      float far = clamp(m.a / 0.84, 0.0, 1.0);
      float airK = 1.0 - exp(-(mix(0.07, 0.1, uNight) + far * mix(1.25, 1.9, uNight)) * S.haze);
      rock = mix(rock, air, airK);
      col = mix(col, rock, cover);
    }
  }
  // A thin band of mist lies along the foot of the ranges.
  col = mix(col, air, exp(-max(el, 0.0) / 0.004) * 0.6);
  return col;
}

/** What a ray that leaves the world sees. */
vec3 skyAll(vec3 d, float clouds) { return withRidges(skyColor(d, clouds), d, clouds > 0.5 ? 0.0 : 1.5); }



/* ---------- the slab ---------- */

float lodFor(float foot, float scale, float n);
vec3 fracture(vec2 x);

/**
 * A ray against the slab (a box). Returns the distance, or -1. uv: where on
 * its face, face: 1 on the front, 0 on an edge or the back.
 */
float slabHit(vec3 ro, vec3 rd, out vec2 uv, out float face) {
  vec3 lo = ro - uSlabPos;
  vec3 a = vec3(dot(lo.xy, uSlabDir.zw), -dot(lo.xy, uSlabDir.xy), lo.z);
  vec3 d = vec3(dot(rd.xy, uSlabDir.zw), -dot(rd.xy, uSlabDir.xy), rd.z);
  vec3 lo3 = vec3(-uSlabSize.x * 0.5, 0.0, 0.0);
  vec3 hi3 = vec3(uSlabSize.x * 0.5, uSlabSize.z, uSlabSize.y);
  vec3 inv = 1.0 / (abs(d) + 1e-6) * sign(d + 1e-9);
  vec3 t0 = (lo3 - a) * inv;
  vec3 t1 = (hi3 - a) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  float tN = max(max(tn.x, tn.y), tn.z);
  float tF = min(min(tf.x, tf.y), tf.z);
  uv = vec2(0.0);
  face = 0.0;
  if (tN > tF || tF < 0.0 || tN < 0.0) return -1.0;
  vec3 h = a + d * tN;
  // 1: the front, 2: the top, 3: a side, 0: the back.
  face = tn.y >= tn.x && tn.y >= tn.z ? step(0.0, d.y) : (tn.z > tn.x ? 2.0 : 3.0);
  if (face > 2.5) { uv = vec2(h.y / uSlabSize.z, h.z / uSlabSize.y); return tN; }
  if (face > 1.5) { uv = vec2(h.x / uSlabSize.x + 0.5, h.y / uSlabSize.z); return tN; }
  uv = vec2(h.x / uSlabSize.x + 0.5, h.z / uSlabSize.y);
  return tN;
}

/**
 * The block: a great piece of glacier ice with the product picture frozen
 * in it. Its front is cut flat and polished, so the picture is seen clean
 * through a hand of clear ice; the other faces are rough and fractured,
 * snow lies on its top and hangs over its edges, and the basin has eaten a
 * notch along its foot. Light goes through it.
 * Returns the colour and, in a, how much of the pixel it covers (its
 * outline is chipped, not ruled).
 */
// 1 while the block is drawn as a mirror image in moving water: no hairline survives that.
float gSlabSoft = 0.0;
vec4 slabColor(vec2 uv, float face, float t, vec3 rd) {
  vec3 L = keyDir();
  vec2 sz = face > 2.5 ? uSlabSize.zy : (face > 1.5 ? uSlabSize.xz : uSlabSize.xy);
  vec2 q = uv * sz;
  float lodF = lodFor(t * uPxAng, 64.0, 256.0);
  vec4 gr = textureLod(uGrain, q / 64.0 + face * 0.37, lodF);
  vec4 gr2 = textureLod(uGrain, q / 210.0 + face * 0.19 + 0.5, 0.0);
  vec3 n = face > 2.5 ? vec3(uSlabDir.zw * sign(dot(-rd.xy, uSlabDir.zw)), 0.0) : (face > 1.5 ? vec3(0.0, 0.0, 1.0) : vec3(-uSlabDir.xy, 0.0) * (face > 0.5 ? -1.0 : 1.0));
  n = face > 0.5 && face < 1.5 ? vec3(uSlabDir.xy, 0.0) : n;
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  // Fracture planes inside the ice: each catches the light by its own tilt.
  vec3 fr = fracture(q / vec2(120.0, 190.0) + face * 3.1);
  float plane = fr.y;
  float crackL = (1.0 - smoothstep(0.0, 0.012 + t * uPxAng * 0.01, fr.x)) * (1.0 - gSlabSoft);
  // The body: blue ice, lit through from the sun's side, the sky in it.
  float thru = 0.5 + 0.5 * max(dot(n, L), 0.0) + 0.35 * max(dot(-n, L), 0.0);
  vec3 body = mix(vec3(0.1, 0.33, 0.47), vec3(0.3, 0.6, 0.74), plane * 0.6 + 0.4 * gr2.r);
  // (Thick ice is deepest in colour at its heart and palest where the light has least of it to cross: toward every edge.)
  vec2 eB = min(q, sz - q);
  float heart = smoothstep(0.0, 90.0, min(eB.x, eB.y));
  body *= mix(1.25, 0.62, heart) * (0.9 + 0.2 * gr.r);
  crackL *= step(0.45, plane) * (0.35 + 0.65 * gr2.g);
  vec3 day = body * (S.key * 0.17 * thru + S.amb * 0.9) + vec3(0.8, 0.93, 1.0) * S.key * 0.11 * crackL;
  vec3 night = body * (S.amb * 2.2 + uAurora * (0.1 + 0.34 * plane)) + uSlabTint * 0.2 * (0.5 + plane) + (uAurora * 0.3 + uSlabTint * 0.2) * crackL;
  vec3 col = mix(day, night, uNight);
  float aCov = 1.0;
  float zUp = face > 1.5 && face < 2.5 ? uSlabSize.y : q.y;
  if (face > 0.5 && face < 1.5) {
    // The polished front. The picture lies a little way in: it shifts
    // against the face as the eye moves, and bends only near the edges.
    vec3 dl = vec3(dot(rd.xy, uSlabDir.zw), -dot(rd.xy, uSlabDir.xy), rd.z);
    const float MX = 30.0;
    float iw = uSlabSize.x - 2.0 * MX;
    float ih = iw * ${(1376 / 2200).toFixed(4)};
    vec2 io = vec2(MX, uSlabSize.y - 44.0 - ih);
    vec2 pq = q + dl.xz / max(dl.y, 0.2) * (16.0 / 1.31);
    vec2 e0 = min(pq - io, io + vec2(iw, ih) - pq);
    float nearE = 1.0 - smoothstep(0.0, 22.0, min(e0.x, e0.y));
    pq += (gr.gb - 0.5) * 9.0 * nearE;
    vec2 iuv = (pq - io) / vec2(iw, ih);
    float inImg = smoothstep(0.0, 2.5, min(e0.x, e0.y));
    float lod = log2(max(t * uPxAng * 2200.0 / iw, 1.0));
    vec3 img = pow(textureLod(uSlabTex, vec2(iuv.x, 1.0 - iuv.y), lod).rgb, vec3(2.2));
    vec3 seen = img * mix(vec3(0.84, 0.93, 0.97), vec3(0.95, 1.05, 1.08), uNight) + img * img * 0.3 * uNight + vec3(0.012, 0.03, 0.04) * (1.0 - uNight);
    // (A few hairline fractures cross in front of it, faintly.)
    seen += vec3(0.7, 0.9, 1.0) * crackL * step(0.8, plane) * mix(0.09, 0.03, uNight);
    col = mix(col, seen, inImg);
    // Polished: the sky lies on it at a glancing angle.
    col += S.hor * (0.02 + 0.5 * pow(1.0 - cosi, 5.0)) * mix(1.0, 0.4, uNight);
  } else {
    // Rough faces: broken facets, some turned to the sun.
    col *= 0.8 + 0.5 * gr.g;
    col += S.key * 0.16 * smoothstep(0.75, 1.0, plane) * max(dot(n, L), 0.0) * (1.0 - uNight);
    col += S.hor * 0.3 * pow(1.0 - cosi, 4.0) * mix(1.0, 0.4, uNight);
  }
  // Bright refracting arrises where two faces meet.
  vec2 e2 = min(q, sz - q);
  float arris = 1.0 - smoothstep(0.5, 5.0, min(e2.x, face > 1.5 && face < 2.5 ? e2.y : 1e3));
  col += mix(vec3(0.75, 0.9, 1.0) * (S.key * 0.2 + S.amb * 0.9), uAurora * 0.5 + vec3(0.03, 0.06, 0.08), uNight) * arris;
  // Snow: all of the top, and hanging a little way down every face.
  float hang = 13.0 + 22.0 * textureLod(uGrain, q / 900.0 + 0.61, 0.0).g + 3.0 * gr2.g;
  float snowK = face > 1.5 && face < 2.5 ? 1.0 : smoothstep(uSlabSize.y - hang - 1.5, uSlabSize.y - hang + 1.5, zUp);
  vec3 sn = mix(vec3(0.93, 0.94, 0.96), vec3(0.6, 0.68, 0.8), uNight) * (S.key * mix(0.26, L.z, uNight) * (0.5 + 0.9 * max(dot(normalize(n + vec3(0.0, 0.0, 1.0)), L), 0.0)) + (S.amb * 0.85 + uAurora * 0.04));
  col = mix(col, sn * (0.9 + 0.2 * gr.g), snowK);
  if (face < 1.5 || face > 2.5) {
    // The notch the basin has eaten along the foot: wet, darker, undercut.
    float nh = 20.0 + 12.0 * gr2.b;
    float notch = 1.0 - smoothstep(nh - 5.0, nh + 3.0, zUp);
    col = mix(col, col * vec3(0.3, 0.5, 0.62) + S.hor * 0.03, notch * 0.75);
    col += mix(vec3(0.8, 0.92, 1.0) * S.amb, uAurora * 0.25, uNight) * (1.0 - smoothstep(0.0, 2.2, abs(zUp - nh - 1.0))) * 0.6;
    // The outline is chipped along the top and down the sides.
    vec4 gr3 = textureLod(uGrain, q / 1100.0 + face * 0.23, 0.0);
    float chipT = uSlabSize.y - 7.0 * smoothstep(0.35, 0.75, gr3.r) - 1.0 * gr2.b;
    float px = max(t * uPxAng, 0.2);
    aCov *= 1.0 - smoothstep(chipT - px, chipT + px, zUp);
    float sideIn = (3.0 + 7.0 * smoothstep(0.4, 0.8, textureLod(uGrain, vec2(0.3 + face * 0.2, q.y / 1300.0), 0.0).g)) * step(face, 1.5);
    aCov *= smoothstep(sideIn - px, sideIn + px, e2.x + (face > 1.5 ? 1e3 : 0.0));
  }
  return vec4(col, aCov);
}

/* ---------- the bed ---------- */

float bedShore;
vec4 bedAt(vec2 w) {
  vec4 b = textureLod(uBedA, bedUv(w), 0.0);
  // The shoreline's own unevenness: read only within reach of a shore,
  // easing out past it, where nothing can show it.
  float nearShore = 1.0 - smoothstep(70.0, 130.0, abs(b.r));
  bedShore = 0.0;
  if (nearShore > 0.0) {
    // Meltwater eats a bank in soft bays: no cusp, no tooth.
    float sc = textureLod(uGrain, w / 1400.0, 0.0).g;
    bedShore = ((sc - 0.5) * 30.0 + (textureLod(uGrain, w / 2600.0 + 0.3, 0.0).b - 0.5) * 22.0) * nearShore;
  }
  b.r += bedShore;
  b.g += bedShore;
  return b;
}
float bedSoft(vec4 b) { return mix(b.r, b.g, smoothstep(3.0, 16.0, -b.r)); }
float bedDepth(float sd, out float slope) {
  float d = max(-sd, 0.0);
  float e = exp(-d / 14.0);
  float wide = smoothstep(15.0, 90.0, d);
  slope = 2.4 * e + 0.5 * wide;
  return 3.0 + 30.0 * (1.0 - e) + 0.95 * d * wide;
}

vec3 turn(vec3 h, mat2 R) {
  mat2 M = transpose(R) * mat2(h.x, h.z, h.z, h.y) * R;
  return vec3(M[0][0], M[1][1], M[0][1]);
}
float focus(vec3 t, float f) {
  float det = (1.0 + f * t.x) * (1.0 + f * t.y) - f * f * t.z * t.z;
  return min(1.0 / max(abs(det), 0.16), 4.6);
}

/** The level of detail at which a tiling texture of n texels over scale units is read. */
float lodFor(float foot, float scale, float n) { return max(log2(max(foot, 1e-4) * n / scale), 0.0); }

/** Light on a surface with normal n: the key and the sky. */
vec3 lightOn(vec3 n, float shadow) {
  vec3 L = keyDir();
  float k = max(dot(n, L), 0.0);
  return S.key * k * shadow + S.amb * (0.55 + 0.45 * n.z);
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
vec3 fracture(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + hash2(n + g) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + hash2(n + g) - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(dr)));
    }
  }
  return vec3(md, hash2(n + mg));
}

/* ---------- the ground: wind-packed snow over pale stone ---------- */

const mat2 RW = mat2(0.9563, -0.2924, 0.2924, 0.9563);
// The baked snow is laid down three times, at scales and headings that do
// not line up, so no tile is ever seen.
const mat2 GA = mat2(0.9063, 0.4226, -0.4226, 0.9063);
const mat2 GB = mat2(0.7547, -0.6561, 0.6561, 0.7547);
const mat2 GC = mat2(0.9816, 0.1908, -0.1908, 0.9816);

/** The size of a pixel on the ground, as two vectors: set once per pixel. */
vec2 gGx;
vec2 gGy;

/** The baked snow at one scale: height, the slope in world terms, the second field. */
vec4 snowTile(vec2 p, mat2 R, float scale, float amp, vec2 off) {
  vec4 t = textureGrad(uGround, R * p / scale + off, R * gGx / scale, R * gGy / scale);
  vec2 g = (t.gb - 0.5) * 16.0 * (amp / scale);
  return vec4(t.r, g * R, t.a);
}

vec3 landColor(vec2 p, float sd, vec2 grad, float foot, vec3 dir, float slabShade) {
  // Dunes, the forms on them, and the wind's fine work close by.
  vec4 a = snowTile(p, GA, 3400.0, 270.0, vec2(0.13, 0.57));
  // (A layer whose whole tile is smaller than a few pixels has eased to
  // its mean: it is not read. Each fades out before it is dropped.)
  float fb = 1.0 - smoothstep(40.0, 80.0, foot);
  float fc = (1.0 - smoothstep(9.0, 18.0, foot)) * (1.0 - gL2);
  vec4 b = vec4(0.5, 0.0, 0.0, 0.5);
  vec4 c = b;
  if (fb > 0.0) b = mix(b, snowTile(p, GB, 1130.0, 52.0, vec2(0.71, 0.29)), fb);
  if (fc > 0.0) c = mix(c, snowTile(p, GC, 263.0, 3.2, vec2(0.37, 0.11)), fc);
  vec2 rel = a.yz + b.yz + c.yz;
  // (Rock is rougher than snow, and it breaks in blocks: each block has its own tilt.)
  vec3 blockR = vec3(1.0, 0.5, 0.5);
  if (gRock > 0.0) {
    blockR = fracture(p / 86.0 + (a.yz + b.yz) * 0.4);
    rel += ((b.yz * 1.6 + c.yz * 5.0) + (blockR.yz - 0.5) * 0.9 * (1.0 - smoothstep(3.0, 9.0, foot))) * gRock;
  }
  vec3 n = normalize(vec3(-rel, 1.0));
  // The bank rolls over into the cut.
  float ch = 1.0 - smoothstep(0.0, 26.0, sd);
  n = normalize(n + vec3(-grad * ch * ch * 0.9, 0.0));

  // Near the water the snow thins: bare dark stone, and old blue ice at the edge.
  float nearW = 1.0 - smoothstep(14.0, 190.0, sd);
  float lvl = b.w * 0.62 + c.w * 0.38;
  float ew = clamp(foot * 0.004, 0.004, 0.1);
  float cut = mix(0.9, 0.52, nearW * nearW);
  float bare = smoothstep(cut - ew, cut + ew, lvl);
  float glaze = (1.0 - smoothstep(4.0, 30.0, sd)) * smoothstep(0.38 - ew, 0.38 + ew, b.w);

  vec3 L = keyDir();
  float ndl = dot(n, L);
  // Snow is lit through as much as onto: a face turned from a low sun still
  // glows a little, in the sky's blue. Level snow is the reference.
  float sun = clamp(ndl / max(L.z, 0.05), 0.0, 2.4);
  sun = mix(sun, 1.0, 0.1) * slabShade;
  vec4 gr = textureLod(uGrain, p / 150.0, lodFor(foot, 150.0, 256.0));
  vec3 snow = mix(vec3(0.93, 0.94, 0.95), vec3(0.74, 0.8, 0.9), uNight);
  vec3 stone = mix(vec3(0.085, 0.09, 0.1), vec3(0.05, 0.055, 0.07), uNight) * (0.7 + 0.7 * gr.g);
  vec3 blue = mix(vec3(0.3, 0.52, 0.62), vec3(0.2, 0.36, 0.46), uNight);
  // The outcrop: dark bedded rock, wet at its foot, snow only in its hollows.
  if (gRock > 0.0) {
    float bedding = textureLod(uGrain, vec2(dot(p, vec2(0.34, 0.94)) / 37.0, dot(p, vec2(0.94, -0.34)) / 900.0), lodFor(foot, 37.0, 256.0)).g;
    stone *= (0.75 + 0.9 * bedding) * mix(vec3(1.0), vec3(0.8, 0.9, 1.05), 0.5);
    stone = (stone * 2.1 + vec3(0.012, 0.014, 0.018)) * (0.7 + 0.6 * blockR.y);
    // A joint between two blocks is a dark seam.
    stone *= 1.0 - 0.7 * (1.0 - smoothstep(0.0, 0.035 + foot * 0.012, blockR.x)) * (1.0 - smoothstep(3.0, 9.0, foot));
    bare = max(bare, gRock * smoothstep(0.45 - ew, 0.55 + ew, lvl + 0.3 * (1.0 - smoothstep(10.0, 70.0, sd))));
    glaze *= 1.0 - gRock;
  }
  vec3 alb = mix(snow, stone, bare);
  alb = mix(alb, blue, glaze * 0.8);
  // The bank's lip is wet ice all along the water: a blue edge under the white.
  float lipK = 1.0 - smoothstep(2.0, 13.0 + 6.0 * b.w, sd);
  alb = mix(alb, blue * 1.15, lipK * 0.85 * (1.0 - gRock));
  // The shelf's own top edge: a hair of bright refrozen ice over the water.
  alb = mix(alb, mix(vec3(0.86, 0.95, 1.0), vec3(0.62, 0.8, 0.9), uNight), (1.0 - smoothstep(0.5, 3.0 + foot, sd)) * 0.8);
  // (Level snow is held at one brightness whatever the sun's height; the
  // low sun is in how strongly every slope answers it. Before dawn the
  // aurora lends the snow a faint green.)
  vec3 col = alb * (S.key * mix(0.24, L.z, uNight) * sun + (S.amb * 0.8 + uAurora * 0.035) * (0.62 + 0.38 * n.z));
  // Hollows hold a little more of the sky's shade than crowns.
  col *= 1.0 + (a.x - 0.5) * 0.1 + (b.x - 0.5) * 0.05;
  // Sparkle: single crystals turned to the sun, only close to the eye.
  float near = (1.0 - smoothstep(0.25, 0.9, foot)) * (1.0 - gL2);
  if (near > 0.0) {
    float glint = smoothstep(0.972, 1.0, gr.r) * smoothstep(0.4, 0.9, fract(gr.a * 7.0 + dot(dir.xy, vec2(3.1, 2.3)) * 6.0));
    col += S.key * 0.5 * glint * near * (1.0 - bare) * step(0.3, sun) * (1.0 - uNight);
  }
  // Wet shore: dark and glossy at the water.
  float wet = 1.0 - smoothstep(1.0, 16.0, sd);
  col = mix(col, col * vec3(0.62, 0.74, 0.82), wet * 0.6 * smoothstep(1.5, 5.0, sd));
  // A cold sheen: snow is a little glossy at a glancing angle.
  float cosi = clamp(dot(-dir, n), 0.0, 1.0);
  col += S.hor * pow(1.0 - cosi, 4.0) * mix(0.08, 0.2, uNight) * (1.0 - 0.6 * bare);
  return col;
}

/* ---------- the ice sheet ---------- */

float snowAt(vec2 wl, float big) {
  float mid = textureLod(uSnow, wl / vec2(860.0, 195.0) + vec2(0.37, 0.11), 0.0).g;
  float fin = textureLod(uSnow, wl / vec2(420.0, 110.0) + vec2(0.71, 0.29), 0.0).b;
  return 0.5 + big * 0.26 + mid * 0.18 + fin * 0.085;
}

/**
 * The top of the sheet: clear dark ice, a dusting of snow, and drifts the
 * wind has packed, with pressure cracks across all of it (the page's
 * sheet). Seen at an angle it gets what it never had from above: the sky
 * and the ranges lie in the clear, wet ice, more of them the lower the eye.
 */
vec3 iceTop(vec2 p, vec2 il, vec3 cr, float f0, float shore, vec3 dir, float foot) {
  vec3 L = keyDir();
  vec2 LXY = normalize(L.xy);
  vec2 wl = RW * il;
  float big = textureLod(uSnow, wl / vec2(2290.0, 790.0), 0.0).r;
  vec2 huv = vec2(p.x / uWorldW, (p.y - uLake.x) / max(uLake.y - uLake.x, 1.0));
  float heat = textureLod(uHeat, huv, 0.0).r;
  float bank = 1.0 - smoothstep(3.0, 70.0, -shore);
  float lane = exp(-cr.x / 8.0);
  float rim = 1.0 - smoothstep(0.0, 22.0, -f0);
  float wet = clamp(uLake.z * 0.75 + heat * 0.9 + bank * 0.35 + rim * uLake.z * 0.6, 0.0, 1.0);
  vec2 nb = abs(il - uIceBox.xy) - uIceBox.zw;
  float nameD = length(max(nb, 0.0)) + min(max(nb.x, nb.y), 0.0);
  float less = wet * 0.14 + lane * 0.06 + uNight * (0.1 + 0.1 * (1.0 - smoothstep(20.0, 300.0, nameD)));
  // More snow lies on the near ice, where the first frame's words stand.
  less -= 0.09 * (1.0 - smoothstep(uLake.x + 120.0, uLake.x + 520.0, p.y)) * (1.0 - uLake.z) * (1.0 - uNight);
  // By day wind-packed snow lies thickest round the name: bright ground for dark letters.
  less -= 0.07 * (1.0 - smoothstep(60.0, 520.0, nameD)) * (1.0 - uLake.z) * (1.0 - uNight);
  float lvl = snowAt(wl, big) - less;
  float ew = 0.006;
  float lvlT = lvl;
  if (uQuality > 0.5 && gL2 < 1.0) {
    lvlT = snowAt(RW * (il + LXY * 3.0), big) - less;
    float lvlS = snowAt(RW * (il + vec2(-LXY.y, LXY.x) * 3.0), big) - less;
    ew = mix(clamp(length(vec2(lvlT - lvl, lvlS - lvl)) / 3.0 * foot * 0.9, 0.0025, 0.03), 0.006, gL2);
  }
  float drift = smoothstep(0.512 - ew, 0.512 + ew, lvl);
  float dust = smoothstep(0.438 - ew, 0.438 + ew, lvl) * (1.0 - 0.5 * wet);
  float lip = 0.0;
  float lee = 0.0;
  if (uQuality > 0.5 && gL2 < 1.0) {
    float toward = smoothstep(0.512 - ew, 0.512 + ew, lvlT);
    lip = clamp(drift - toward, 0.0, 1.0) * (1.0 - gL2);
    lee = clamp(toward - drift, 0.0, 1.0) * (1.0 - gL2);
  }
  vec2 rel = (textureLod(uDetail, wl / vec2(1500.0, 420.0), lodFor(foot, 1500.0, 512.0)).gb - 0.5) * 0.5;
  float lodG = lodFor(foot, 128.0, 256.0);
  vec4 g = textureLod(uGrain, il / 128.0, lodG);
  rel *= 1.0 + 0.9 * uNight;
  vec3 n = normalize(vec3(-rel, 1.0));
  vec3 lit = lightOn(n, 1.0);
  // Clear ice: dark, blue-green; what is under it shows a little.
  float lodU = lodFor(foot, 230.0, 512.0);
  float under = 0.5;
  float netU = 0.0;
  if (gL2 < 1.0) {
    under = mix(textureLod(uDetail, p / 700.0 + vec2(0.004, 0.003) * uTime, 0.0).r, 0.5, gL2);
    netU = textureLod(uDetail, p / 230.0 + vec2(0.007, 0.004) * uTime, lodU).a * (1.0 - gL2);
  }
  vec3 clear = uIceCol * mix(vec3(0.2, 0.42, 0.52), vec3(0.013, 0.04, 0.078), uNight) * (0.78 + 0.34 * under) + uScatter * mix(2.0, 0.3, uNight);
  clear += (S.hor * 0.05 * (1.0 - uNight) + uAurora * 0.03) * smoothstep(0.22, 0.6, netU) * (1.0 - dust);
  vec3 white = mix(vec3(0.9, 0.92, 0.95), vec3(0.4, 0.47, 0.6), uNight) * lit * (0.97 + 0.03 * big);
  clear *= 1.0 - 0.3 * smoothstep(0.438, 0.35, lvl);
  vec3 col = mix(clear, white, mix(0.42 + 0.34 * smoothstep(0.445, 0.512, lvl), 0.2, uNight) * dust);
  col = mix(col, white, drift);
  col = mix(col, white * 1.12, lip * 0.7);
  col *= 1.0 - lee * mix(0.2, 0.42, uNight);
  col *= 1.0 + ((g.r - 0.5) * mix(0.03, 0.085, drift) + (g.a - 0.45) * 0.05);
  if (uQuality > 0.5 && gL1 < 1.0 && drift < 0.99 && foot < 2.2) {
    // (Hairlines: short wandering threads, a few to a plate; never a closed cell.)
    vec2 hw2 = (textureLod(uDetail, il / 900.0 + 0.4, 0.0).gb - 0.5) * 420.0 + (g.gb - 0.5) * 30.0;
    vec3 fr = fracture((il + hw2) / 330.0 + vec2(3.7, 1.9));
    float hw = 0.006 * max(1.0, foot);
    float hair = (1.0 - smoothstep(0.0, hw, fr.x)) * step(0.7, fr.y) * step(fr.z, 0.5) * (1.0 - drift) * smoothstep(18.0, 70.0, nameD) * (1.0 - smoothstep(1.2, 2.2, foot)) * (1.0 - gL1);
    // (Before dawn a hairline is a faint thread: nothing on the dark ice is bright but the name.)
    col = mix(col, uIceCol * mix(1.04, 0.2, uNight), hair * mix(0.55, 0.3, uNight));
  }
  // A pressure crack: a hairline of shadow, refrozen white either side.
  float cw = max(1.0, foot * 0.9);
  // (The cracks go as the sheet becomes plates, and a lean frame lets them go while they are only hairlines.)
  float crK = (1.0 - uIceC.y) * (1.0 - gL2 * (1.0 - smoothstep(0.0, 0.01, uIceA.y)));
  cr.x = mix(1e3, cr.x, crK > 0.0 ? 1.0 : 0.0);
  float seam = (1.0 - smoothstep(1.5 * cw, 2.7 * cw, cr.x)) * crK;
  float plane = exp(-cr.x / (3.2 * cw)) * (0.5 + 0.5 * step(0.5, cr.y)) * crK;
  col = mix(col, white * (1.06 + 0.1 * uLake.z), clamp(seam * 0.92 + plane * 0.3, 0.0, 1.0) / cw * (1.0 - 0.85 * uNight));
  col *= 1.0 - mix(0.5, 0.62, uNight) * (1.0 - smoothstep(0.3 * cw, 0.85 * cw, cr.x)) / cw * crK;
  // The mirror: wet and clear ice carry the sky and the ranges.
  vec3 nr = normalize(vec3(-rel * 0.25, 1.0));
  float cosi = clamp(dot(-dir, nr), 0.0, 1.0);
  float gloss = 1.0 - 0.9 * max(drift, dust * 0.7);
  float fres = 0.03 + 0.97 * pow(1.0 - cosi, 5.0);
  vec3 rf = reflect(dir, nr);
  rf.z = abs(rf.z) + 0.02;
  // (Ice is a poorer mirror than water, and before dawn that difference is what draws the name.)
  gDull = true;
  vec3 mir = airAt(rf.xy);
  if (gL2 < 1.0) mir = mix(skyAll(normalize(rf), 0.0), mir, gL2);
  col = mix(col, mir, fres * gloss * (0.55 + 0.4 * wet) * (1.0 - 0.74 * uNight));
  gDull = false;
  // The lip of a cut: a hair of snow, then the edge itself.
  float edge = 1.0 - smoothstep(0.0, 2.2 * cw, -f0);
  col *= 1.0 + 0.07 * edge;
  // Before dawn the arris catches the sky: a thin cold line round every cut.
  col = mix(col, white * 0.7 + uAurora * 0.22, uNight * 0.45 * (1.0 - smoothstep(0.0, 1.5 * cw, -f0)));
  return col;
}

/**
 * A cut face of the sheet, seen across the opening: the ice's thickness.
 * It is lit through, so it is the brightest blue in the frame after the
 * snow: a band of clear blue-white ice under a crisp lip of snow, a little
 * deeper where it meets the water. It is never dark: a dark wall reads as
 * the side of a raised shape, and this is a hole.
 * s: 0 at the top arris, 1 at the waterline. tall: its height in device px.
 */
vec3 iceCut(vec2 p, float s, float tall) {
  float streak = textureLod(uGrain, vec2(p.x / 7.0, p.y / 260.0), 0.0).g;
  vec3 top = mix(vec3(0.6, 0.83, 0.93), vec3(0.3, 0.62, 0.56), uNight);
  vec3 foot = mix(vec3(0.24, 0.55, 0.72), vec3(0.1, 0.34, 0.33), uNight);
  vec3 face = mix(top, foot, smoothstep(0.2, 1.0, s)) * (0.9 + 0.2 * streak);
  // The lip: packed snow standing over the cut.
  float w = min(1.5 / max(tall, 1.0), 0.3);
  vec3 lip = mix(vec3(0.95, 0.97, 1.0), vec3(0.62, 0.8, 0.78), uNight);
  face = mix(face, lip, 1.0 - smoothstep(w * 0.6, w * 1.3, s));
  return face;
}

/* ---------- water ---------- */

/** Where the stream's middle lies at a distance down the valley. */
float streamX(float y) {
  const vec2 P[${STREAM.length}] = vec2[${STREAM.length}](${STREAM.map((q) => `vec2(${q.x.toFixed(1)}, ${q.y.toFixed(1)})`).join(', ')});
  float x = P[0].x;
  for (int i = 0; i < ${STREAM.length - 1}; i++) {
    if (y > P[i].y) {
      float t = clamp((y - P[i].y) / (P[i + 1].y - P[i].y), 0.0, 1.0);
      x = mix(P[i].x, P[i + 1].x, t * t * (3.0 - 2.0 * t));
    }
  }
  return x;
}

// 1 over the lake's dark water while the sheet stands round it, by day.
float gDeep = 0.0;
// The ice field where the eye's ray crosses the top of the sheet: how far inside an opening this water is seen.
float gIceF = 1e3;

vec3 waterColor(vec2 pw, vec4 bw, vec3 dir, float foot, float footL, float iceShade, float slabOn) {
  vec3 L = keyDir();
  vec2 LXY = normalize(L.xy);
  vec2 suv = simUv(pw);
  // The simulation covers a window of the world: outside it the surface is
  // the drawn ripples alone.
  float inSim = smoothstep(0.0, 0.03, suv.y) * (1.0 - smoothstep(0.97, 1.0, suv.y)) * step(0.0, suv.x) * step(suv.x, 1.0);
  vec4 wv = textureLod(uWave, suv, 0.0) * inSim;
  vec3 fl = textureLod(uBedB, bedUv(pw), 0.0).rgb;
  vec2 flow = (fl.rg - 0.5019608) * 2.0;
  vec2 vel = flow * uFlowSpeed + textureLod(uVel, suv, 0.0).rg * 0.7 * inSim;
  float open = smoothstep(36.0, 150.0, -bw.r);

  float ph0 = fract(uTime * 0.19);
  float ph1 = fract(uTime * 0.19 + 0.5);
  float wphase = abs(ph0 * 2.0 - 1.0);
  const float DS = 150.0;
  vec2 warp = vec2(
    sin(dot(pw, vec2(0.0021, 0.0027)) + 1.3) + 0.6 * sin(dot(pw, vec2(-0.0043, 0.0019)) + 4.1),
    sin(dot(pw, vec2(-0.0024, 0.0031)) + 2.9) + 0.6 * sin(dot(pw, vec2(0.0037, 0.0036)) + 0.7)) * 0.8;
  vec2 duv = pw / DS + warp;
  vec2 uv0 = duv - vel * (ph0 * 2.6) / DS;
  vec2 uv1 = duv - vel * (ph1 * 2.6) / DS + vec2(0.37, 0.61);
  float lod0 = lodFor(footL, DS, 512.0);
  vec4 df = mix(textureLod(uDetail, uv0, lod0), textureLod(uDetail, uv1, lod0), wphase);
  const mat2 R1 = mat2(0.7986, -0.6018, 0.6018, 0.7986);
  const mat2 R2 = mat2(0.5299, 0.8480, -0.8480, 0.5299);
  vec2 wuv1 = R1 * pw / 620.0 + vec2(0.017, 0.026) * uTime;
  float lod1 = lodFor(footL, 620.0, 512.0);
  vec4 dw = textureLod(uDetail, wuv1, lod1);
  vec2 wuv2 = R2 * pw / 110.0 - vec2(0.045, 0.022) * uTime + vec2(0.5, 0.2);
  float lod2 = lodFor(footL, 110.0, 512.0);
  vec4 dw2 = textureLod(uDetail, wuv2, lod2);
  dw.gb = (dw.gb - 0.5) * R1 + 0.5;
  dw2.gb = (dw2.gb - 0.5) * R2 + 0.5;
  float speed = clamp(length(vel) / max(uFlowSpeed, 1.0), 0.0, 1.5);
  float fa = 0.35 + 0.65 * speed;
  vec2 dgrad = ((df.gb - 0.5) * fa * 0.9 + (dw.gb - 0.5) * 0.75 + (dw2.gb - 0.5) * 0.34) * 0.05;

  const vec2 K1 = vec2(0.0066, 0.0043);
  const vec2 K2 = vec2(-0.0037, 0.0079);
  float s1 = dot(pw, K1) - uTime * 0.52;
  float s2 = dot(pw, K2) - uTime * 0.38 + 1.7;
  vec2 swell = (K1 * cos(s1) + K2 * cos(s2) * 0.8) * 2.2 * open * (1.0 - smoothstep(40.0, 160.0, footL));

  vec2 slope = wv.ba * 9.0 + dgrad + swell;
  float men = smoothstep(-5.0, -0.5, bw.r);
  slope += bw.ba * men * 0.42;
  vec3 n = normalize(vec3(-slope, 1.0));

  // ---- under the surface
  vec3 r = refract(dir, n, 0.75);
  float sl0;
  float d0p = bedDepth(bedSoft(bw), sl0);
  vec2 pb = pw + r.xy / max(-r.z, 0.35) * d0p;
  vec4 bb = bedAt(pb);
  float sl;
  float depth = bedDepth(min(bedSoft(bb), -0.01), sl);
  float shoalK = smoothstep(uShoal - 200.0, uShoal + 500.0, pb.y);
  if (shoalK > 0.0) {
    float bars = textureLod(uDetail, vec2(pb.x / 2100.0, pb.y / 1300.0), 0.0).r;
    depth = mix(depth, min(depth, 30.0 + 24.0 * bars), shoalK);
  }
  float lakeK = smoothstep(uLake.y + 30.0, uLake.y - 90.0, pb.y);
  if (lakeK > 0.0) {
    float floorH = textureLod(uDetail, pb / 1700.0 + 0.4, 0.0).r;
    depth = mix(depth, min(depth, 70.0 + 34.0 * floorH), lakeK);
  }
  float dn = clamp(depth / DEEP, 0.0, 1.0);
  float shallow = 1.0 - smoothstep(0.08, 0.5, dn);

  // The bank on the light's side shades the water below it. The light is
  // low, so the shade is long; it is kept to a few bank heights.
  vec2 toSun = LXY * min(L.z > 0.0 ? length(L.xy) / L.z : 0.0, 2.6);
  // (Far from any bank there is no bank's shade to look for.)
  float bankShade = bw.r > -(2.6 * gFree + 12.0) ? smoothstep(-5.0, 5.0, textureLod(uBedA, bedUv(pw + toSun * gFree), 0.0).r) : 0.0;
  float shade = max(bankShade, iceShade) * (1.0 - 0.6 * uNight);

  float lodB = lodFor(footL, 256.0, 256.0);
  vec4 gb = textureLod(uGrain, pb / 256.0, lodB);
  vec4 gs = gb;
  vec3 bed = uBed * (1.0 + (gb.r - 0.5) * 0.03 + (gs.b - 0.42) * 0.17 + (gb.a - 0.4) * 0.12);
  float shadow = 1.0 - 0.6 * shade;
  float fineW = 1.0 - smoothstep(0.12, 0.6, dn);
  float broadW = smoothstep(0.06, 0.4, dn);
  float net = 1.0 - smoothstep(0.55, 0.96, dn);
  // (The lake is deep and dark: no net of light is seen on its bed, so none is worked out.)
  if (lakeK > 0.99) net = 0.0;
  // Broad, slow unevenness in the light under water: the wide ripple layer's own field.
  float shaft = 0.45 + 1.1 * dw.r;
  vec3 lightOnBed;
  float nfil = 0.0;
  // The net of light on the bed: one focus of the summed curvature of the
  // moving layers. Each layer is read at the level its pixel covers, so far
  // off the net eases to even light before it can shimmer.
  float cheapC = mix(shaft, min(df.a * 6.0, 4.0), net * clamp(uLight.z * 0.5, 0.0, 1.0));
  if (uQuality > 0.5 && gL2 < 1.0) {
    vec3 t = vec3(0.0);
    // (The curvature texture has no finer levels of its own: fade it by hand.
    // Where it has faded out, or the water is too deep for a net, it is not read.)
    float fadeC = 1.0 - smoothstep(0.35, 1.6, footL / 9.0);
    if (fadeC > 0.0 && net > 0.0) {
      if (fineW > 0.0) {
        t = mix(textureLod(uCurv, uv0, lod0).rgb, textureLod(uCurv, uv1, lod0).rgb, wphase) * (fa * fineW);
        t += turn(textureLod(uCurv, wuv2, lod2).rgb, R2) * (0.5 * fineW);
      }
      if (broadW > 0.0) t += turn(textureLod(uCurv, wuv1, lod1).rgb, R1) * (0.95 * broadW);
      t *= fadeC;
    }
    // (Still water has no ripple to focus: its neighbours are not read.)
    if (inSim > 0.0 && net > 0.0 && dot(wv, wv) > 2e-9) {
      vec2 e = 1.6 / uSim.zw;
      float gx1 = textureLod(uWave, suv + vec2(e.x, 0.0), 0.0).b;
      float gx0 = textureLod(uWave, suv - vec2(e.x, 0.0), 0.0).b;
      float gy1 = textureLod(uWave, suv + vec2(0.0, e.y), 0.0).a;
      float gy0 = textureLod(uWave, suv - vec2(0.0, e.y), 0.0).a;
      t.xy -= vec2(gx1 - gx0, gy1 - gy0) * 5.0 * inSim;
    }
    float f = uLight.z * mix(0.46, 0.8, dn);
    float caust = focus(t, f);
    vec3 c3 = vec3(caust);
    c3 = max(c3, 0.62 + 0.38 * c3);
    float gather = clamp((caust - 1.0) / 3.6, 0.0, 1.0);
    nfil = pow(gather, 1.5) * net * (0.3 + 0.7 * shallow);
    c3 = mix(c3, 0.36 + (c3 - 0.62) * 0.1, uNight);
    c3 = mix(vec3(shaft), c3, net);
    nfil *= 1.0 - gL2;
    lightOnBed = uLight.x * 0.9 + uLight.y * shadow * mix(c3, vec3(cheapC), gL2);
  } else {
    lightOnBed = vec3(uLight.x * 0.9 + uLight.y * shadow * cheapC);
  }
  float caust = dot(lightOnBed, vec3(0.3333)) / (uLight.x * 0.9 + uLight.y);
  bed *= lightOnBed / (uLight.x + uLight.y);

  float path = (depth + 7.0) * (1.0 + 1.0 / max(-r.z, 0.35));
  vec3 trans = exp(-uAbsorb * path);
  float turbid = 1.0 - exp(-path * 0.011);
  vec3 body = uScatter * (0.5 + 0.5 * shadow) * (0.5 + 0.62 * min(caust, 3.0));
  vec3 water = bed * trans + body * turbid * (1.0 - trans * 0.35);
  // Before dawn the water has no light of its own: a dark body, a little
  // paler over the shallows. What is seen in it is the sky.
  if (uNight > 0.0) {
    float deepK = smoothstep(0.25, 1.0, dn);
    vec3 pool = vec3(0.006, 0.02, 0.028) * (0.6 + 0.4 * shaft) * mix(1.0, 0.5, deepK);
    // In the shallows the bed shows, and the sky's light is netted on it.
    pool += (uBed * vec3(0.02, 0.05, 0.06) * (0.5 + 0.5 * gb.g) + uAurora * 0.1 * (0.35 + nfil * 2.2)) * shallow;
    pool += uAurora * 0.05 * nfil;

    water = mix(water, pool, uNight * 0.93);
  }
  // The lake is deep: by day its water is dark, and under the sheet, where
  // no wind reaches it, darker still. That is what draws the name.
  float lakeDay = lakeK * (1.0 - uNight);
  if (lakeDay > 0.0) water = mix(water, vec3(0.0025, 0.016, 0.027) * (0.75 + 0.5 * shaft) + water * 0.04, lakeDay * 0.95);
  // Meltwater brightens and cools the water it runs through.
  water *= 1.0 + 0.25 * uMeltAct * lakeK;

  // A wave is seen as real ripples are: the face turned to the light is
  // brighter, the far face darker.
  float wf = dot(wv.ba, -LXY) * 9.0;
  water *= 1.0 + clamp(wf * 6.5, -0.3, 0.7);

  // ---- the surface: a mirror that grows toward the horizon
  // (Before dawn the sky is all there is to see in it, so its ripples are
  // what make it water: they tilt the mirror more, and most along the view,
  // which is what draws a reflection out into broken vertical strokes.)
  vec2 vdw = normalize(dir.xy + 1e-6);
  vec2 rs = slope * (0.6 + 0.5 * uNight);
  rs += vdw * dot(slope, vdw) * 0.9 * uNight;
  // (Between walls of ice no wind reaches the water: it lies stiller than the open lake, and holds a picture.)
  rs *= 1.0 - 0.55 * smoothstep(0.75, 1.0, uGlow) * smoothstep(uLake.y + 30.0, uLake.y - 90.0, pw.y);
  vec3 nr = normalize(vec3(-rs, 1.0));
  float cosi = clamp(dot(-dir, nr), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  vec3 rf = reflect(dir, nr);
  rf.z = abs(rf.z) + 0.015;
  rf = normalize(rf);
  // The water in the name lies still between walls of ice. The eye is high
  // over it, and a true mirror at that angle would show only blank sky: so
  // this mirror is leaned, as a long lens leans one, until what lies in the
  // letters is what stands over the lake. By day that is the ranges, the
  // warm air at their foot and the sun's path; before dawn it is the body
  // of the high curtain, well clear of its hem.
  float sheetK = smoothstep(0.75, 1.0, uGlow) * lakeK;
  if (sheetK > 0.0) {
    rf.z = mix(rf.z, mix(max((rf.z - 0.2) * 0.42, 0.004), rf.z + 0.11, uNight), sheetK);
    rf = normalize(rf);
  }
  // (Before dawn the thin cloud is too faint to be seen in moving water: it is not asked for.)
  gWash = gL1;
  gSunK = 1.0 - sheetK * (1.0 - uNight);
  vec3 refl = withRidges(skyColor(rf, uQuality > 1.5 ? (1.0 - uNight) * (1.0 - gL1) : 0.0), rf, uQuality > 1.5 ? 1.5 * gL1 : 1.5);
  gWash = 0.0;
  gSunK = 1.0;
  // (Toward the sun the low air is far brighter than the rest: in the letters it is held to the sky's own
  // brightness, so the letter nearest the sun is still a letter. The sun itself comes back as glitter.)
  if (sheetK > 0.0) {
    // (And dark water deepens what it mirrors: the ranges' shaded faces stand out from the sky more than they do above.)
    float rl = max(dot(refl, vec3(0.3, 0.6, 0.1)), 1e-3);
    refl *= mix(1.0, min(pow(rl / 0.56, 1.6), 0.5 / rl), sheetK * (1.0 - uNight));
  }
  if (sheetK * uNight > 0.0) {
    // Before dawn the letters hold the curtain itself: its rays, drifting,
    // green where the far letters catch its hem and turning violet in the
    // deeper water under the eye.
    float azv = atan(rf.x, rf.y);
    float ray = n1(azv * 52.0 + 3.0 * n1(azv * 7.0 + uTime * 0.03) + uTime * 0.04);
    float ray2 = n1(azv * 17.0 - uTime * 0.025 + 4.0);
    float deepV = smoothstep(0.27, 0.44, cosi);
    vec3 cur = refl * (0.5 + 0.8 * ray) * (0.72 + 0.5 * ray2) * mix(vec3(1.0), vec3(0.74, 0.7, 1.3), deepV * 0.7) * 1.5;
    refl = mix(refl, cur, sheetK * uNight);
  }
  // The slab stands in the water: its mirror image, broken by the ripples.
  if (slabOn > 0.0) {
    vec2 suvS;
    float faceS;
    // (Its image is held together: the ripples bend it a little, they do not scatter it.)
    vec3 rfS = reflect(dir, normalize(vec3(-slope * 0.7, 1.0)));
    rfS.z = abs(rfS.z) + 0.015;
    rfS = normalize(rfS);
    float tS = slabHit(vec3(pw, -gFree), rfS, suvS, faceS);
    if (tS > 0.0) {
      gSlabSoft = 1.0;
      vec4 scS = slabColor(suvS, faceS, tS * 6.0, rfS);
      gSlabSoft = 0.0;
      refl = mix(refl, scS.rgb * 0.7, scS.a);
      fres = max(fres, 0.3 * scS.a * (1.0 - uEnd));
    }
  }
  refl *= 1.0 - 0.5 * shade * (1.0 - uNight);
  // The top-down view at the end is the page's water: the mirror gives way.
  // Still dark water is a better mirror than this angle alone would make
  // it: before dawn the surface is held to at least that much mirror, so
  // the aurora is what the water and the name show.
  // (Under the sheet the water is stillest, and the name is cut into it:
  // there it is nearly a whole mirror.)
  // Elsewhere it falls off as water does: a mirror toward the horizon, and
  // close under the eye dark water you look down into.
  // (Steeply under the eye it is a little less of a mirror: you look down into it.)
  fres = mix(fres, max(fres * 1.25 + 0.05, mix(0.97, 0.66, smoothstep(0.27, 0.44, cosi)) * sheetK), uNight);
  // A bank stands over the water at its edge: there the mirror shows the dark bank, not the sky.
  // (Wider in the walled basin, where the project's words stand over the near bank.)
  refl *= 1.0 - mix(0.3, 0.8, gWalled) * uNight * (1.0 - smoothstep(4.0, mix(46.0, 150.0, gWalled), -bw.r)) * (1.0 - sheetK);
  // (By day the sheet's own walls stand round that water: less of the pale sky reaches it.)
  gDeep = lakeDay * smoothstep(0.5, 1.0, uGlow);
  // (By day it is dark water you look down into under the eye, and more of a mirror toward the far side of each letter.)
  fres = mix(fres, mix(0.105, 0.008, smoothstep(0.27, 0.44, cosi)), gDeep);
  // The sheet stands over the water at the near edge of an opening: a faint, short shade.
  water *= 1.0 - 0.3 * sheetK * (1.0 - smoothstep(0.0, 16.0, gIceF));
  fres *= 1.0 - 0.7 * uEnd;
  vec3 col = mix(water, refl, fres);
  // The sun on ripple faces turned toward it: a broad, graded sheen.
  float sd = max(dot(rf, S.sun), 0.0);
  col += S.band * (pow(sd, 240.0) * 1.6 + pow(sd, 40.0) * 0.12) * (1.0 - shade) * (1.0 - uNight) * (1.0 - gDeep);
  // In the name the sun's path is broken glitter: single ripple faces
  // catching it, thickest under the sun and thinning to either side.
  if (gDeep > 0.0) {
    float face = smoothstep(0.6, 0.84, mix(dw2.r, df.r, 0.45));
    col += S.band * (pow(sd, 12.0) * (0.01 + 1.2 * face) * 0.38 + pow(sd, 90.0) * (0.03 + 1.8 * face)) * gDeep;
  }
  // A few small chips of ice lie afloat in the name's water, turning slowly.
  if (sheetK > 0.0 && gIceF > 7.0 && footL < 12.0) {
    vec2 q = pw / vec2(84.0, 130.0);
    vec2 hq = hash2(floor(q) + 3.0);
    if (hq.x > 0.8) {
      vec2 bob = vec2(sin(uTime * 0.21 + hq.y * 40.0), cos(uTime * 0.17 + hq.x * 31.0)) * 5.0;
      vec2 ql = (fract(q) - 0.5 - (hq - 0.5) * 0.5) * vec2(84.0, 130.0) - bob;
      float ang = hq.y * 6.283 + uTime * 0.05 * (hq.x - 0.86) * 8.0;
      ql = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * ql;
      float sz = 3.0 + 5.5 * fract(hq.x * 37.0);
      float chip = max(abs(ql.x) + abs(ql.y) * 0.5, max(abs(ql.y) * 1.2, abs(ql.x * 0.8 - ql.y * 0.6))) - sz;
      float aC = (1.0 - smoothstep(-0.7 * foot, 0.7 * foot, chip)) * sheetK * smoothstep(7.0, 12.0, gIceF);
      vec3 plate = mix(vec3(0.82, 0.9, 0.95) * (S.amb * 1.3 + S.key * 0.26), vec3(0.5, 0.74, 0.7) * 0.5, uNight);
      // (Each rides a little under its own rim of shade.)
      col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 4.0, chip)) * sheetK * (1.0 - aC);
      col = mix(col, plate, aC);
    }
  }
  // The current, drawn: fine bright threads that run with the stream,
  // quicker and whiter in the narrows, and the odd small plate of ice
  // carried down. Both live in the stream's own frame (along it, across it).
  float fmag = length(flow);
  float inBasin = smoothstep(${(BASIN.y - 60).toFixed(1)}, ${(BASIN.y + 80).toFixed(1)}, pw.y) * (1.0 - smoothstep(${(BASIN.y + BASIN.h - 40).toFixed(1)}, ${(BASIN.y + BASIN.h + 120).toFixed(1)}, pw.y));
  float runK = smoothstep(0.25, 0.6, fmag) * (1.0 - inBasin) * (1.0 - lakeK) * (1.0 - shoalK) * smoothstep(3.0, 16.0, -bw.r) * (1.0 - uEnd);
  if (runK > 0.0 && footL < 40.0) {
    float along = pw.y;
    float across = pw.x - streamX(pw.y);
    // (The threads keep to the stream itself, and are gone where it opens out.)
    if (pw.y < ${(BASIN.y + BASIN.h + 300).toFixed(1)}) runK *= (1.0 - smoothstep(150.0, 300.0, abs(across)));
    // (Where the river runs across the valley its threads run across too.)
    else if (abs(flow.x) > abs(flow.y)) { across = pw.y; along = flow.x > 0.0 ? pw.x : -pw.x; }
    // (On a diagonal neither frame fits: the threads rest there.)
    if (pw.y > ${(BASIN.y + BASIN.h + 300).toFixed(1)}) runK *= smoothstep(0.1, 0.5, abs(abs(flow.x) - abs(flow.y)) / max(fmag, 1e-3));
    float run = uTime * uFlowSpeed * (0.35 + 0.65 * fmag);
    float fadeT = 1.0 - smoothstep(2.5, 7.0, footL);
    // (Thin lines are where a smooth field crosses its middle; drawn long along the stream.)
    float th = textureLod(uDetail, vec2(across / 150.0, (along - run) / 2600.0), lodFor(footL, 150.0, 512.0)).r;
    float th2 = gL1 < 1.0 ? textureLod(uDetail, vec2(across / 64.0 + 0.4, (along - run * 1.3) / 1500.0 + 0.27), lodFor(footL, 64.0, 512.0)).r : 9.0;
    float quick = smoothstep(0.7, 1.15, fmag);
    float wT = 0.006 + 0.01 * quick + clamp(footL * 0.004, 0.0, 0.03);
    float thread = (1.0 - smoothstep(0.0, wT, abs(th - 0.58))) * 0.6 + (1.0 - smoothstep(0.0, wT * 0.8, abs(th2 - 0.4))) * (0.4 + 0.5 * quick) * (1.0 - gL1);
    vec3 foam = mix(vec3(0.9, 0.96, 1.0) * (S.amb * 1.2 + S.key * 0.26), vec3(0.3, 0.42, 0.5) * 0.12 + uAurora * 0.16, uNight);
    col = mix(col, foam, clamp(thread, 0.0, 1.0) * runK * fadeT * (0.42 + 0.3 * quick) * (1.0 - 0.6 * shade));
    // A plate of ice: a few to a reach, each an angular chip riding the stream.
    vec2 q = vec2(across / 64.0, (along - run * 0.8) / 120.0);
    vec2 qi = floor(q);
    vec2 hq = hash2(qi);
    if (hq.x > 0.86) {
      vec2 ql = (fract(q) - 0.5 - (hq - 0.5) * 0.3) * vec2(64.0, 120.0);
      float ang = hq.y * 6.283;
      ql = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * ql;
      float sz = 7.0 + 9.0 * fract(hq.x * 37.0);
      float chip = max(abs(ql.x) + abs(ql.y) * 0.45, abs(ql.y) * 1.1) - sz;
      float mid = smoothstep(26.0, 60.0, -bw.r);
      float aC = (1.0 - smoothstep(-0.8 * foot - 0.4, 0.8 * foot + 0.4, chip)) * runK * mid * (1.0 - smoothstep(6.0, 16.0, footL));
      vec3 plate = mix(vec3(0.86, 0.92, 0.96) * (S.amb * 1.3 + S.key * 0.3), vec3(0.2, 0.26, 0.34) * 0.2 + uAurora * 0.05, uNight);
      col = mix(col * (1.0 - 0.35 * (1.0 - smoothstep(-0.5, 5.0, chip)) * runK * mid), plate, aC);
    }
  }
  // The confluence: each stream drops into the river over a short fall,
  // white at its foot, and its paler meltwater trails away downstream.
  if (pw.y > ${(CONF_Y - 260).toFixed(1)} && pw.y < ${(CONF_Y + 420).toFixed(1)} && pw.x > 300.0) {
    const vec2 M[${TRIBS.length}] = vec2[${TRIBS.length}](${TRIBS.map((t) => `vec2(${t.mouth.x.toFixed(1)}, ${t.mouth.y.toFixed(1)})`).join(', ')});
    float fall = 0.0;
    float plume = 0.0;
    for (int i = 0; i < ${TRIBS.length}; i++) {
      float w = uTribW[i];
      if (w <= 0.0) continue;
      vec2 d = pw - M[i];
      // The fall: a bar of broken water across the stream's mouth.
      float bar = (1.0 - smoothstep(w * 0.5, w * 0.62 + 4.0, abs(d.x + d.y * 0.3))) * exp(-abs(d.y - 4.0) / (9.0 + w * 0.16));
      // Its boil below: a fan that spreads and thins.
      float boil = exp(-dot(d, d) / (w * w * 0.5 + 900.0)) * step(d.y, 14.0);
      fall += bar * 1.4 + boil * (0.22 + 0.012 * w);
      // The plume: carried down the river (toward -x), spreading as it goes.
      float dn = max(-d.x, 0.0);
      float half_ = w * 0.4 + 10.0 + dn * 0.07;
      float lat = (d.y + 75.0 - dn * 0.3) / half_;
      plume += exp(-lat * lat) * exp(-dn / (260.0 + 5.0 * w)) * smoothstep(-w * 0.5, w * 0.3, -d.x) * (0.45 + 0.012 * w);
    }
    plume = clamp(plume, 0.0, 1.0);
    vec3 milk = mix(vec3(0.5, 0.86, 0.9) * (S.amb * 1.1 + S.key * 0.17), vec3(0.04, 0.1, 0.11) + uAurora * 0.07, uNight);
    float streak = 0.6 + 0.4 * smoothstep(0.3, 0.7, textureLod(uDetail, vec2(pw.y / 90.0, (pw.x + uTime * uFlowSpeed * 0.7) / 900.0), lodFor(footL, 90.0, 512.0)).r);
    col = mix(col, milk, plume * streak * 0.42 * (1.0 - smoothstep(20.0, 60.0, footL)));
    vec3 white = mix(vec3(0.94, 0.97, 1.0) * (S.amb * 1.25 + S.key * 0.3), vec3(0.36, 0.5, 0.56) * 0.3 + uAurora * 0.15, uNight);
    float churn = smoothstep(0.3, 0.62, mix(df.r, dw2.r, 0.5) + 0.45 * clamp(fall, 0.0, 1.0) - 0.12);
    col = mix(col, white, clamp(fall, 0.0, 1.0) * churn * 0.92);
  }
  // White water where the basin's waves strike the block's footing: it
  // comes and goes round the shore with each wave.
  if (slabOn > 0.0) {
    vec2 ds = pw - vec2(${ISLAND.x.toFixed(1)}, ${ISLAND.y.toFixed(1)});
    float nearB = 1.0 - smoothstep(${(ISLAND.rx * 1.5).toFixed(1)}, ${(ISLAND.rx * 2.2).toFixed(1)}, length(ds));
    float ang = atan(ds.y, ds.x);
    float beat = 0.5 + 0.5 * sin(uTime * 1.9 + ang * 3.0 + 2.0 * sin(uTime * 0.6 + ang));
    float strike = clamp(beat * 0.75 + abs(wv.r) * 30.0 + length(wv.ba) * 40.0, 0.0, 1.0);
    float band = (1.0 - smoothstep(3.0, 9.0 + 16.0 * strike, -bw.r)) * smoothstep(0.35, 0.6, df.r + 0.35 * strike);
    float lace = (1.0 - smoothstep(10.0, 40.0, -bw.r)) * smoothstep(0.62, 0.8, dw2.r + 0.2 * strike) * strike * 0.5;
    vec3 white = mix(vec3(0.92, 0.96, 1.0) * (S.amb * 1.25 + S.key * 0.28), vec3(0.34, 0.5, 0.56) * 0.3 + uAurora * 0.14, uNight);
    col = mix(col, white, clamp(band * 0.85 + lace, 0.0, 1.0) * nearB * (1.0 - uEnd));
  }
  // The last move ends on the ending's own first frame: the page's open
  // water seen from above, in the colour and with the net the ending draws.
  if (uEnd > 0.0) {
    vec3 day = vec3(0.048, 0.272, 0.325) * (1.0 + 0.38 * (min(caust, 3.0) - 1.0) * net);
    vec3 night = vec3(0.0104, 0.0385, 0.0494) + vec3(0.095, 0.38, 0.437) * nfil;
    col = mix(col, mix(day, night, uNight), uEnd * uEnd);
  }
  // The water's edge: under the bank's ice shelf a short soft shade, and
  // where the current runs against the bank a fine line of foam.
  float line = smoothstep(-3.0 - foot, 0.0, bw.r);
  col *= 1.0 - 0.16 * line * (1.0 - uNight);
  float edgeF = (1.0 - smoothstep(1.5 + foot, 5.0 + 2.0 * foot, -bw.r)) * (0.25 + 0.75 * smoothstep(0.2, 0.7, fmag)) * (0.55 + 0.45 * df.r) * (1.0 - smoothstep(14.0, 40.0, footL));
  vec3 edgeC = mix(vec3(0.9, 0.96, 1.0) * (S.amb * 1.2 + S.key * 0.24), vec3(0.3, 0.44, 0.5) * 0.3 + uAurora * 0.12, uNight);
  col = mix(col, edgeC, edgeF * mix(0.6, 0.3, uNight) * (1.0 - uEnd) * (1.0 - lakeK * smoothstep(0.0, 0.3, uGlow)));

  return col;
}

void main() {
  skyKey();
  gL1 = clamp(uLean, 0.0, 1.0);
  gL2 = clamp(uLean - 1.0, 0.0, 1.0);
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 dir = normalize(uCamF + uCamR * (ndc.x * uLens.y * uLens.x) + uCamU * (ndc.y * uLens.x));
  vec3 col;

  // ---- the slab, in front of everything it covers
  float slabCov = 0.0;
  vec3 slabCol = vec3(0.0);
  float slabT = 1e9;
  bool slabNear = uSlabSize.x > 0.0 && vUv.x > uSlabBox.x && vUv.x < uSlabBox.z && vUv.y > uSlabBox.y && vUv.y < uSlabBox.w;
  if (slabNear) {
    // Four rays to a pixel: the slab's edges are geometry, so they are
    // smoothed by counting.
    for (int i = 0; i < 4; i++) {
      vec2 j = vec2(i == 0 || i == 3 ? 0.125 : -0.125, i < 2 ? 0.375 : -0.375);
      if (i == 1 || i == 3) j = j.yx;
      vec3 rd = normalize(dir + (uCamR * j.x + uCamU * j.y) * uPxAng);
      vec2 suv;
      float face;
      float t = slabHit(uCamPos, rd, suv, face);
      if (t > 0.0) {
        vec4 sc = slabColor(suv, face, t, rd);
        slabCov += 0.25 * sc.a;
        slabCol += sc.rgb * 0.25 * sc.a;
        slabT = min(slabT, t);
      }
    }
    if (slabCov > 0.0) slabCol /= slabCov;
    // Far down the valley it is lost in the air: nothing stands behind the name.
    // (From the statement's frame it is not there at all: the valley's air has it.)
    slabCov *= 1.0 - smoothstep(1900.0, 2500.0, slabT);
  }

  if (slabCov > 0.999) {
    col = slabCol;
  } else if (dir.z > -0.0006) {
    // ---- above the horizon
    gDirect = true;
    col = skyAll(dir, 1.0);
  } else {
    float t = uCamPos.z / -dir.z;
    vec2 p = uCamPos.xy + dir.xy * t;
    vec2 tilt = dir.xy / -dir.z;
    // The size of a pixel on the ground: across the view, and along it.
    float foot = t * uPxAng;
    float sinE = -dir.z;
    float footL = foot / pow(sinE, 0.75);
    vec2 vd = normalize(dir.xy + 1e-6);
    float fs = t * dot(dir, uCamF) * uPxAng;
    gGx = uCamR.xy * fs;
    gGy = (uCamU.xy + dir.xy * (uCamU.z / -dir.z)) * fs;

    gWalled = walledAt(p.y);
    gFree = FREEBOARD * (1.0 + ${STEP.more.toFixed(2)} * gWalled);
    if (gWalled > 0.0) {
      vec2 ro = (p - vec2(${ISLAND.x.toFixed(1)}, ${ISLAND.y.toFixed(1)})) / vec2(${(ISLAND.rx * 1.25).toFixed(1)}, ${(ISLAND.ry * 1.45).toFixed(1)});
      // (The block's footing is ice-bound rock under snow, not bare stone.)
      gRock = 0.28 * (1.0 - smoothstep(0.8, 1.0, dot(ro, ro)));
    }
    vec4 b0 = bedAt(p);
    float sd0 = b0.r;
    // An edge is blended over a pixel, measured the way the edge faces.
    float aa = 0.75 * foot * mix(1.0, 1.0 / sinE, abs(dot(b0.ba, vd)));

    // ---- the ice sheet
    float aIce = 0.0;
    float aCut = 0.0;
    float cutS = 0.0;
    float iceShade = 0.0;
    float f0 = 1e3;
    vec3 cr = vec3(1e3, 0.0, 0.0);
    vec2 il = vec2(0.0);
    bool hasIce = uIceOn > 0.5 && uIce.z > 0.0 && p.y > uLake.x - 80.0 && p.y < uLake.y + 80.0 && sd0 < 40.0;
    if (hasIce) {
      f0 = iceF(p, sd0, cr, il);
      gIceF = f0;
      float aaI = 0.75 * foot / mix(1.0, sinE, 0.6);
      aIce = 1.0 - smoothstep(-aaI, aaI, f0);
      // The cut face and the sheet's shade lie within a known reach of the
      // edge (the field is a distance, near enough): past it, open water
      // is only open water, and the field is not asked again.
      float reach = length(tilt) * uIceH * 1.5 + 2.0 * aaI + 6.0;
      if (aIce < 1.0 && f0 < reach) {
        vec3 c1;
        vec2 i1;
        vec2 pf = p + tilt * uIceH;
        float f1 = iceF(pf, bedAt(pf).r, c1, i1);
        aCut = (1.0 - aIce) * (1.0 - smoothstep(-aaI, aaI, f1));
        cutS = clamp(f0 / max(f0 - f1, 1e-3), 0.0, 1.0);
      }
    }

    // ---- the slab's shade and its own light on the ground round it
    float slabShade = 1.0;
    vec3 slabLight = vec3(0.0);
    float slabOn = 0.0;
    if (uSlabSize.x > 0.0 && length(uCamPos.xy - uSlabPos.xy) < 5200.0) {
      vec2 ds = p - uSlabPos.xy;
      float dd = dot(ds, ds);
      float reach = uSlabSize.x * 4.0;
      if (dd < reach * reach) {
        slabOn = 1.0;
        vec3 L = keyDir();
        vec2 suv;
        float face;
        // Three rays toward the light, a little apart: a soft-edged shadow.
        float sh = 0.0;
        for (int i = 0; i < 3; i++) {
          vec3 l = normalize(L + vec3(-L.y, L.x, 0.0) * (float(i) - 1.0) * 0.03 + vec3(0.0, 0.0, (float(i) - 1.0) * 0.012));
          sh += slabHit(vec3(p, 0.5), l, suv, face) > 0.0 ? 1.0 : 0.0;
        }
        slabShade = 1.0 - sh / 3.0 * mix(0.92, 0.5, uNight);
        // Where it stands on the ground the corner is dark.
        float along = clamp(dot(ds, uSlabDir.zw), -uSlabSize.x * 0.5, uSlabSize.x * 0.5);
        float dFoot = length(ds - uSlabDir.zw * along);
        slabShade *= 1.0 - 0.6 * exp(-dFoot / 9.0);
        // The screen throws its light forward onto what lies before it.
        vec3 toP = vec3(ds, -uSlabSize.y * 0.5);
        float facing = max(dot(normalize(toP.xy + 1e-4), uSlabDir.xy), 0.0);
        slabLight = uSlabTint * facing * 9000.0 / (dd + 9000.0) * mix(0.05, 0.42, uNight);
      }
    }

    float aLand = smoothstep(-aa, aa, sd0);
    col = vec3(0.0);
    if (aLand > 0.0) col = (landColor(p, sd0, b0.ba, foot, dir, slabShade) + slabLight * mix(0.5, 1.1, gRock)) * aLand;
    if (aLand < 1.0 && aIce < 0.999) {
      vec2 pw = p + tilt * gFree;
      vec4 bw = bedAt(pw);
      float aWall = smoothstep(-aa, aa, bw.r);
      vec3 cut = vec3(0.0);
      if (aWall > 0.0) {
        // The far bank's face above the waterline: packed snow over ice,
        // bluer and darker toward the water.
        float f = clamp(-sd0 / max(length(tilt) * gFree, 1.0), 0.0, 1.0);
        vec3 nW = normalize(vec3(-bw.ba, 0.35));
        vec4 gw = textureLod(uGrain, vec2(dot(p, vec2(bw.a, -bw.b)) / 180.0, f * 0.35), 0.0);
        vec3 wall = mix(vec3(0.84, 0.88, 0.93), vec3(0.3, 0.48, 0.6), smoothstep(0.25, 1.0, f)) * (0.9 + 0.2 * gw.g);
        wall = mix(wall, wall * vec3(0.55, 0.7, 0.85), uNight * 0.6);
        // The basin's walls are rock under a cap of snow: bedded, dark, wet at the waterline.
        if (gWalled > 0.0) {
          float beds = textureLod(uGrain, vec2(dot(p, vec2(bw.a, -bw.b)) / 420.0, f * 0.9 + 0.2), 0.0).b;
          vec3 rockW = mix(vec3(0.16, 0.17, 0.19), vec3(0.06, 0.075, 0.095), smoothstep(0.5, 1.0, f)) * (0.6 + 0.9 * beds);
          rockW = mix(rockW, rockW * vec3(0.5, 0.6, 0.8), uNight * 0.5);
          wall = mix(wall, rockW, gWalled * smoothstep(0.1, 0.22, f + (gw.g - 0.5) * 0.12) * mix(1.0, 0.0, 0.0));
        }
        wall *= lightOn(nW, 1.0);
        wall *= mix(1.0, 0.7, f * f);
        // (Before dawn a bank's face is ice under the aurora, not a black rim.)
        wall += (vec3(0.03, 0.05, 0.07) + uAurora * 0.06) * uNight * (1.0 - 0.6 * gWalled);

        cut += wall * aWall;
      }
      if (aWall < 1.0) cut += (waterColor(pw, bw, dir, foot, footL, iceShade, slabOn) + slabLight * 0.26) * (1.0 - aWall);
      col += cut * (1.0 - aLand);
    }
    if (aCut > 0.0) col = mix(col, iceCut(p, cutS, length(tilt) * uIceH / max(foot / sinE, 1e-3)), aCut);
    if (aIce > 0.0) col = mix(col, iceTop(p, il, cr, f0, sd0, dir, foot), aIce);

    // ---- the air: haze that lies low and thickens with distance. From
    // high up the ray crosses less of it; near the ground it hides the far
    // end of the world.
    const float HF = 320.0;
    float thin = (1.0 - exp(-uCamPos.z / HF)) / max(uCamPos.z / HF, 1e-3);
    float fog = 1.0 - exp(-t * 0.00021 * S.haze * thin);
    vec3 air = airAt(dir.xy);
    // (Before dawn the ground's haze is the cold air, warmed only toward the light.)
    air = mix(air, mix(S.hor, air, 0.45), uNight);
    // (The cut water close under the eye is kept out of the haze: the name is the darkest thing in the frame.)
    float clearK = gDeep * (1.0 - aLand) * (1.0 - aIce) * (1.0 - aCut) * (1.0 - smoothstep(2500.0, 4500.0, t));
    col = mix(col, air, fog * (1.0 - 0.9 * uEnd) * (1.0 - clearK));
    // The horizon is soft: the same mist that lies at the ranges' foot.
    col = mix(col, air, exp(dir.z / 0.006) * 0.75);
  }
  if (slabCov > 0.0 && slabCov <= 0.999) col = mix(col, slabCol, slabCov);

  // ---- the finish, in this same pass: the glow of the last frame's
  // highlights, a gentle vignette, the filmic curve, and a fine grain that
  // moves (it is also the dither). The top-down last frame is the page's
  // own water and takes none of it.
  col = max(col, 0.0);
  float fin = 1.0 - uEnd;
  if (uBloom > 0.0) col += textureLod(uGlowTex, vUv, 0.0).rgb * uBloom * fin;
  vec2 vc = vUv - 0.5;
  col *= 1.0 - dot(vc, vc) * 0.42 * fin;
  vec3 xa = col * 1.12;
  col = mix(clamp((xa * (2.51 * xa + 0.03)) / (xa * (2.43 * xa + 0.59) + 0.14), 0.0, 1.0), col, uEnd);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  float gn = hash21(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(317.0, 113.0)) - 0.5;
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col += gn * (1.6 / 255.0 + 0.022 * fin * (0.35 + 2.6 * lum * (1.0 - lum)));
  o = vec4(col, 1.0);
}`;
