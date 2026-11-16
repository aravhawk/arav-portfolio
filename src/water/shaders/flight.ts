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

/** The water sits this far below the land, world units. */
export const FLIGHT_FREEBOARD = 22;

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
uniform sampler2D uGround; // the baked snow: height, slope, a second field
uniform float uIceH;
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

const float FREEBOARD = ${FLIGHT_FREEBOARD}.0;
const float DEEP = 130.0;
const vec3 POOL = vec3(0.1, 0.62, 0.7);

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
  vec3 dz = vec3(0.075, 0.2, 0.52), dm = vec3(0.24, 0.43, 0.74), dh = vec3(0.66, 0.76, 0.86), db = vec3(1.25, 1.02, 0.74);
  // The hour before dawn: a deep blue sky, first light low behind the
  // ranges. The dark ending's light, earlier.
  vec3 nz = vec3(0.004, 0.011, 0.04), nm = vec3(0.012, 0.032, 0.085), nh = vec3(0.075, 0.07, 0.085), nb = vec3(0.62, 0.27, 0.085);
  S.zen = mix(dz, nz, uNight); S.mid = mix(dm, nm, uNight); S.hor = mix(dh, nh, uNight); S.band = mix(db, nb, uNight);
  float az = mix(-0.92, 0.225, uNight);
  float el = mix(0.215, -0.03, uNight);
  S.sun = vec3(sin(az) * cos(el), cos(az) * cos(el), sin(el));
  // What lights the ground: the sun by day; before dawn a faint raking
  // light from where the sun will be, and the sky.
  S.key = mix(vec3(1.0, 0.9, 0.74) * 2.9, vec3(0.5, 0.36, 0.3) * 0.05, uNight);
  S.amb = mix(vec3(0.27, 0.38, 0.56), vec3(0.013, 0.025, 0.055), uNight);
  S.haze = mix(1.0, 1.15, uNight);
}

/** The direction the ground is lit from: the sun, or before dawn a low light on its bearing. */
vec3 keyDir() {
  float az = mix(-0.92, 0.225, uNight);
  float el = mix(0.215, 0.12, uNight);
  return vec3(sin(az) * cos(el), cos(az) * cos(el), sin(el));
}

vec3 sunBloom(float sd) {
  return S.band * (pow(sd, 9.0) * 0.07 + pow(sd, 60.0) * 0.22 + pow(sd, 420.0) * 0.5 + pow(sd, 2600.0) * 0.5);
}

/** The colour of the air at the horizon toward a bearing: what distance fades to. */
vec3 airAt(vec2 dxy) {
  float a = max(dot(normalize(dxy + 1e-5), normalize(S.sun.xy)), 0.0);
  return S.hor + S.band * (pow(a, 5.0) * 0.3 + pow(a, 2.0) * 0.08) * mix(0.5, 1.0, uNight);
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
  col += sunBloom(sd) * (1.0 - 0.5 * uNight);
  col += vec3(1.0, 0.9, 0.7) * (smoothstep(0.9996, 0.99999, sd) * 2.4 + smoothstep(0.9999, 1.0, sd) * 1.6) * (1.0 - uNight);
  if (clouds > 0.0) {
    // Thin high cloud: white where the sun finds it by day, a faint warm
    // underside before dawn.
    float c = fbm2(vec2(atan(d.x, d.y) * 3.2 + uTime * 0.004, h * 8.0));
    float cloud = smoothstep(0.48, 0.86, c) * smoothstep(0.03, 0.2, h) * (1.0 - smoothstep(0.4, 0.85, h));
    vec3 lit = mix(vec3(0.82, 0.86, 0.92) + S.band * 0.1 * pow(az, 2.0), col * 0.8 + S.band * 0.07 * pow(az, 3.0), uNight);
    col = mix(col, lit, cloud * mix(0.42, 0.55, uNight) * clouds);
  }
  return col;
}

float ridgeH(float x) {
  return (1.0 - abs(n1(x) * 2.0 - 1.0)) * 0.56 + (1.0 - abs(n1(x * 2.7 + 3.1) * 2.0 - 1.0)) * 0.27
    + (1.0 - abs(n1(x * 6.3 + 1.7) * 2.0 - 1.0)) * 0.12 + n1(x * 17.0) * 0.05;
}
float ridgeBroad(float x) {
  return (1.0 - abs(n1(x) * 2.0 - 1.0)) * 0.56 + (1.0 - abs(n1(x * 2.7 + 3.1) * 2.0 - 1.0)) * 0.27;
}

/**
 * Four ranges, furthest first, each a profile in elevation over bearing.
 * By day they are under snow: the faces turned to the sun are bright, the
 * others lie in blue shadow, and each range further back stands in more
 * air, so it is paler. Before dawn they are dark shapes against the first
 * light.
 */
vec3 withRidges(vec3 col, vec3 d) {
  float el = asin(clamp(d.z, -1.0, 1.0));
  if (el > 0.13) return col;
  float az = atan(d.x, d.y);
  float sunAz = atan(S.sun.x, S.sun.y);
  float off = abs(az - sunAz);
  float side = clamp((sunAz - az) * 3.0, -1.0, 1.0);
  float aa = uPxAng * 1.5 + 1e-4;
  vec3 air = airAt(d.xy);
  float cover = 0.0;
  for (int i = 0; i < 4; i++) {
    float near = float(i) / 3.0;
    float f = mix(4.2, 9.0, near);
    float x = az * f + 9.7 * float(i);
    float r = ridgeH(x);
    float amp = mix(0.1, 0.04, near);
    float height = amp * (0.22 + 0.78 * r * r);
    float m = 1.0 - smoothstep(height - aa, height + aa, el);
    if (m > 0.0) {
      float rel = clamp(el / max(height, 1e-4), 0.0, 1.0);
      float slope = (ridgeBroad(x + 0.06) - ridgeBroad(x - 0.06)) / 0.12;
      float spur = n1(x * 3.4 + (1.0 - rel) * 4.0 * side + 3.0 * float(i)) - 0.5;
      float lit = clamp(0.5 - side * slope * 0.4 + spur * 0.8, 0.0, 1.0);
      lit = smoothstep(0.12, 0.88, lit);
      vec3 shade = mix(S.zen * 0.55 + S.mid * 0.5, S.zen * 0.22 + S.mid * 0.06, uNight);
      vec3 sunlit = mix(vec3(0.86, 0.87, 0.9) + S.band * 0.12, S.mid * 0.34 + S.hor * 0.2 + S.band * 0.07 * exp(-off * 1.6), uNight);
      vec3 rock = mix(shade, sunlit, lit * (0.55 + 0.45 * rel));
      // Bare rock shows through the snow low on the nearer ranges.
      rock *= 1.0 - (1.0 - uNight) * 0.3 * near * smoothstep(0.55, 0.2, rel) * smoothstep(0.35, 0.6, n1(x * 9.0 + 2.0));
      rock += S.band * 0.1 * exp(-off * 3.0) * smoothstep(0.8, 1.0, rel) * uNight;
      float airK = mix(mix(0.62, 0.4, uNight), mix(0.16, 0.0, uNight), near) * S.haze;
      rock = mix(rock, air, clamp(airK + (1.0 - rel) * (1.0 - rel) * 0.3, 0.0, 0.92));
      float a = m * step(0.0, el + 0.002);
      col = mix(col, rock, a);
      cover = max(cover, a);
    }
  }
  float sd = max(dot(d, S.sun), 0.0);
  col += sunBloom(sd) * 0.5 * cover * uNight;
  // A thin band of mist lies along the foot of the ranges.
  col = mix(col, air, exp(-max(el, 0.0) / 0.006) * 0.75);
  return col;
}

/** What a ray that leaves the world sees. */
vec3 skyAll(vec3 d, float clouds) { return withRidges(skyColor(d, clouds), d); }

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

/* ---------- the slab ---------- */

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
  face = step(tn.x, tn.y) * step(tn.z, tn.y) * step(0.0, d.y);
  uv = vec2(h.x / uSlabSize.x + 0.5, h.z / uSlabSize.y);
  return tN;
}

/** The slab's face: the product picture, lit like a screen at dusk. */
vec3 slabColor(vec2 uv, float face, float t, vec3 rd) {
  // The picture is 2200 px across: pick the level a pixel covers.
  float lod = log2(max(t * uPxAng * 2200.0 / uSlabSize.x, 1.0));
  vec3 img = pow(textureLod(uSlabTex, vec2(uv.x, 1.0 - uv.y), lod).rgb, vec3(2.2));
  // A screen in daylight holds its own; before dawn it is the brightest
  // made thing in the frame and glows a little.
  vec3 front = img * mix(0.86, 0.82, uNight) + img * img * 0.25 * uNight;
  // Glass: a little of the sky lies on it, more at a glancing angle.
  float cosi = clamp(-dot(rd.xy, uSlabDir.xy), 0.0, 1.0);
  front += S.hor * (0.012 + 0.2 * pow(1.0 - cosi, 5.0)) * mix(1.0, 0.5, uNight);
  // A hairline frame.
  vec2 e = min(uv, 1.0 - uv) * uSlabSize.xy;
  float frame = 1.0 - smoothstep(1.2, 2.2, min(e.x, e.y));
  vec3 metal = mix(vec3(0.05, 0.055, 0.06), vec3(0.012, 0.014, 0.018), uNight) + S.hor * 0.05;
  front = mix(front, metal, frame);
  return mix(metal * 1.4, front, face);
}

/* ---------- the bed ---------- */

float bedShore;
vec4 bedAt(vec2 w) {
  vec4 b = textureLod(uBedA, bedUv(w), 0.0);
  bedShore = (textureLod(uGrain, w / 800.0, 0.0).g - 0.5) * 9.0 + (textureLod(uGrain, w / 2600.0 + 0.3, 0.0).b - 0.5) * 22.0;
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
  vec4 b = snowTile(p, GB, 1130.0, 52.0, vec2(0.71, 0.29));
  vec4 c = snowTile(p, GC, 263.0, 3.2, vec2(0.37, 0.11));
  vec2 rel = a.yz + b.yz + c.yz;
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
  vec4 gr = textureGrad(uGrain, p / 150.0, gGx / 150.0, gGy / 150.0);
  vec3 snow = mix(vec3(0.93, 0.94, 0.95), vec3(0.74, 0.8, 0.9), uNight);
  vec3 stone = mix(vec3(0.085, 0.09, 0.1), vec3(0.05, 0.055, 0.07), uNight) * (0.7 + 0.7 * gr.g);
  vec3 blue = mix(vec3(0.3, 0.52, 0.62), vec3(0.2, 0.36, 0.46), uNight);
  vec3 alb = mix(snow, stone, bare);
  alb = mix(alb, blue, glaze * 0.8);
  vec3 col = alb * (S.key * L.z * sun + S.amb * (0.62 + 0.38 * n.z));
  // Hollows hold a little more of the sky's shade than crowns.
  col *= 1.0 + (a.x - 0.5) * 0.1 + (b.x - 0.5) * 0.05;
  // Sparkle: single crystals turned to the sun, only close to the eye.
  float near = 1.0 - smoothstep(0.25, 0.9, foot);
  if (near > 0.0) {
    float glint = smoothstep(0.972, 1.0, gr.r) * smoothstep(0.4, 0.9, fract(gr.a * 7.0 + dot(dir.xy, vec2(3.1, 2.3)) * 6.0));
    col += S.key * 0.5 * glint * near * (1.0 - bare) * step(0.3, sun) * (1.0 - uNight);
  }
  // Wet shore: dark and glossy at the water.
  float wet = 1.0 - smoothstep(1.0, 16.0, sd);
  col = mix(col, col * vec3(0.5, 0.62, 0.7), wet * 0.7);
  // A cold sheen: snow is a little glossy at a glancing angle.
  float cosi = clamp(dot(-dir, n), 0.0, 1.0);
  col += S.hor * pow(1.0 - cosi, 4.0) * mix(0.08, 0.2, uNight) * (1.0 - 0.6 * bare);
  return col;
}

/* ---------- the ice sheet ---------- */

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
  float lvl = snowAt(wl, big) - less;
  float ew = 0.006;
  float lvlT = lvl;
  if (uQuality > 0.5) {
    lvlT = snowAt(RW * (il + LXY * 3.0), big) - less;
    float lvlS = snowAt(RW * (il + vec2(-LXY.y, LXY.x) * 3.0), big) - less;
    ew = clamp(length(vec2(lvlT - lvl, lvlS - lvl)) / 3.0 * foot * 0.9, 0.0025, 0.03);
  }
  float drift = smoothstep(0.512 - ew, 0.512 + ew, lvl);
  float dust = smoothstep(0.438 - ew, 0.438 + ew, lvl) * (1.0 - 0.5 * wet);
  float lip = 0.0;
  float lee = 0.0;
  if (uQuality > 0.5) {
    float toward = smoothstep(0.512 - ew, 0.512 + ew, lvlT);
    lip = clamp(drift - toward, 0.0, 1.0);
    lee = clamp(toward - drift, 0.0, 1.0);
  }
  vec2 rel = (textureLod(uDetail, wl / vec2(1500.0, 420.0), lodFor(foot, 1500.0, 512.0)).gb - 0.5) * 0.5;
  float lodG = lodFor(foot, 128.0, 256.0);
  vec4 g = textureLod(uGrain, il / 128.0, lodG);
  rel *= 1.0 + 0.9 * uNight;
  vec3 n = normalize(vec3(-rel, 1.0));
  vec3 lit = lightOn(n, 1.0);
  // Clear ice: dark, blue-green; what is under it shows a little.
  float lodU = lodFor(foot, 230.0, 512.0);
  float under = textureLod(uDetail, p / 700.0 + vec2(0.004, 0.003) * uTime, 0.0).r;
  float netU = textureLod(uDetail, p / 230.0 + vec2(0.007, 0.004) * uTime, lodU).a;
  vec3 clear = uIceCol * mix(vec3(0.2, 0.42, 0.52), vec3(0.016, 0.036, 0.062), uNight) * (0.78 + 0.34 * under) + uScatter * mix(2.0, 0.3, uNight);
  clear += (S.hor * 0.05 * (1.0 - uNight) + POOL * 0.03 * uNight) * smoothstep(0.22, 0.6, netU) * (1.0 - dust);
  vec3 white = mix(vec3(0.9, 0.92, 0.95), vec3(0.4, 0.47, 0.6), uNight) * lit * (0.97 + 0.03 * big);
  clear *= 1.0 - 0.3 * smoothstep(0.438, 0.35, lvl);
  vec3 col = mix(clear, white, mix(0.42 + 0.34 * smoothstep(0.445, 0.512, lvl), 0.2, uNight) * dust);
  col = mix(col, white, drift);
  col = mix(col, white * 1.12, lip * 0.7);
  col *= 1.0 - lee * mix(0.2, 0.42, uNight);
  col *= 1.0 + ((g.r - 0.5) * mix(0.03, 0.085, drift) + (g.a - 0.45) * 0.05);
  if (uQuality > 0.5 && drift < 0.99 && foot < 2.2) {
    vec3 fr = fracture(il / 210.0 + vec2(3.7, 1.9));
    float hw = 0.006 * max(1.0, foot);
    float hair = (1.0 - smoothstep(0.0, hw, fr.x)) * step(0.55, fr.y) * (1.0 - drift) * smoothstep(18.0, 70.0, nameD) * (1.0 - smoothstep(1.2, 2.2, foot));
    // (Before dawn a hairline is a faint thread: nothing on the dark ice is bright but the name.)
    col = mix(col, uIceCol * mix(1.04, 0.2, uNight), hair * mix(0.55, 0.3, uNight));
  }
  // A pressure crack: a hairline of shadow, refrozen white either side.
  float cw = max(1.0, foot * 0.9);
  float seam = 1.0 - smoothstep(1.5 * cw, 2.7 * cw, cr.x);
  float plane = exp(-cr.x / (3.2 * cw)) * (0.5 + 0.5 * step(0.5, cr.y));
  col = mix(col, white * (1.06 + 0.1 * uLake.z), clamp(seam * 0.92 + plane * 0.3, 0.0, 1.0) / cw * (1.0 - 0.85 * uNight));
  col *= 1.0 - mix(0.5, 0.62, uNight) * (1.0 - smoothstep(0.3 * cw, 0.85 * cw, cr.x)) / cw;
  // The mirror: wet and clear ice carry the sky and the ranges.
  vec3 nr = normalize(vec3(-rel * 0.25, 1.0));
  float cosi = clamp(dot(-dir, nr), 0.0, 1.0);
  float gloss = 1.0 - 0.9 * max(drift, dust * 0.7);
  float fres = 0.03 + 0.97 * pow(1.0 - cosi, 5.0);
  vec3 rf = reflect(dir, nr);
  rf.z = abs(rf.z) + 0.02;
  col = mix(col, skyAll(normalize(rf), 0.0), fres * gloss * (0.55 + 0.4 * wet));
  // The lip of a cut: a hair of snow, then the edge itself.
  float edge = 1.0 - smoothstep(0.0, 2.2 * cw, -f0);
  col *= 1.0 + 0.07 * edge;
  col = mix(col, white * 1.3 + POOL * 0.25, uNight * uGlow * 0.6 * (1.0 - smoothstep(0.0, 1.5 * cw, -f0)));
  // The lit water spills a little of its light onto the ice at every cut.
  col += POOL * uNight * uGlow * (0.3 * exp(f0 / 4.0) + 0.05 * exp(f0 / 24.0));
  return col;
}

/** A cut face of the sheet. s: 0 at the top arris, 1 at the waterline. tall: its height in device px. */
vec3 iceCut(vec2 p, float s, float tall) {
  float streak = textureLod(uGrain, vec2(p.x / 9.0, p.y / 300.0), 0.0).g;
  vec3 top = uIceCol * mix(vec3(0.115, 0.34, 0.43), vec3(0.03, 0.09, 0.125), uNight) + uScatter * mix(1.5, 0.8, uNight);
  vec3 foot = uIceCol * mix(vec3(0.035, 0.15, 0.205), vec3(0.008, 0.03, 0.045), uNight) + uScatter * mix(1.2, 0.6, uNight);
  vec3 face = mix(top, foot, smoothstep(0.1, 0.92, s)) * (0.8 + 0.4 * streak);
  float w = 1.6 / max(tall, 1.0);
  face = mix(face, uIceCol * vec3(0.88, 0.98, 1.0) * (1.0 + 0.12 * uNight), (1.0 - smoothstep(w * 0.7, w * 1.5, s)) * 0.92);
  float glow = uGlow * uNight;
  face *= 1.0 - 0.55 * smoothstep(0.84, 0.9, s) * (1.0 - glow);
  face = mix(face, POOL * mix(0.5, 1.05, smoothstep(0.0, 1.0, s)) * (0.85 + 0.3 * streak), glow * (1.0 - 0.9 * (1.0 - smoothstep(w * 0.7, w * 1.5, s))));
  return face;
}

/* ---------- water ---------- */

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
  float bankShade = smoothstep(-5.0, 5.0, textureLod(uBedA, bedUv(pw + toSun * FREEBOARD), 0.0).r);
  float shade = max(bankShade, iceShade) * (1.0 - 0.6 * uNight);

  float lodB = lodFor(footL, 256.0, 256.0);
  vec4 gb = textureLod(uGrain, pb / 256.0, lodB);
  vec4 gs = textureLod(uGrain, pb / 330.0, lodB);
  vec3 bed = uBed * (1.0 + (gb.r - 0.5) * 0.03 + (gs.b - 0.42) * 0.17 + (gb.a - 0.4) * 0.12);
  float shadow = 1.0 - 0.6 * shade;
  float fineW = 1.0 - smoothstep(0.12, 0.6, dn);
  float broadW = smoothstep(0.06, 0.4, dn);
  float net = 1.0 - smoothstep(0.55, 0.96, dn);
  float shaft = 0.45 + 1.1 * textureLod(uDetail, R2 * pw / 2300.0 + vec2(0.006, -0.004) * uTime, 0.0).r;
  vec3 lightOnBed;
  float nfil = 0.0;
  // The net of light on the bed: one focus of the summed curvature of the
  // moving layers. Each layer is read at the level its pixel covers, so far
  // off the net eases to even light before it can shimmer.
  if (uQuality > 0.5) {
    vec3 t = mix(textureLod(uCurv, uv0, lod0).rgb, textureLod(uCurv, uv1, lod0).rgb, wphase) * (fa * fineW);
    t += turn(textureLod(uCurv, wuv2, lod2).rgb, R2) * (0.5 * fineW);
    t += turn(textureLod(uCurv, wuv1, lod1).rgb, R1) * (0.95 * broadW);
    // (The curvature texture has no finer levels of its own: fade it by hand.)
    t *= 1.0 - smoothstep(0.35, 1.6, footL / 9.0);
    vec2 e = 1.6 / uSim.zw;
    float gx1 = textureLod(uWave, suv + vec2(e.x, 0.0), 0.0).b;
    float gx0 = textureLod(uWave, suv - vec2(e.x, 0.0), 0.0).b;
    float gy1 = textureLod(uWave, suv + vec2(0.0, e.y), 0.0).a;
    float gy0 = textureLod(uWave, suv - vec2(0.0, e.y), 0.0).a;
    t.xy -= vec2(gx1 - gx0, gy1 - gy0) * 5.0 * inSim;
    float f = uLight.z * mix(0.46, 0.8, dn);
    float caust = focus(t, f);
    vec3 c3 = vec3(caust);
    c3 = max(c3, 0.62 + 0.38 * c3);
    float gather = clamp((caust - 1.0) / 3.6, 0.0, 1.0);
    nfil = pow(gather, 1.5) * net * (0.3 + 0.7 * shallow);
    c3 = mix(c3, 0.36 + (c3 - 0.62) * 0.1, uNight);
    c3 = mix(vec3(shaft), c3, net);
    lightOnBed = uLight.x * 0.9 + uLight.y * shadow * c3;
  } else {
    float caust = mix(shaft, min(df.a * 6.0, 4.0), net * clamp(uLight.z * 0.5, 0.0, 1.0));
    lightOnBed = vec3(uLight.x * 0.9 + uLight.y * shadow * caust);
  }
  float caust = dot(lightOnBed, vec3(0.3333)) / (uLight.x * 0.9 + uLight.y);
  bed *= lightOnBed / (uLight.x + uLight.y);

  float path = (depth + 7.0) * (1.0 + 1.0 / max(-r.z, 0.35));
  vec3 trans = exp(-uAbsorb * path);
  float turbid = 1.0 - exp(-path * 0.011);
  vec3 body = uScatter * (0.5 + 0.5 * shadow) * (0.5 + 0.62 * min(caust, 3.0));
  vec3 water = bed * trans + body * turbid * (1.0 - trans * 0.35);
  // Before dawn the water is lit from within: a body of light with depth
  // (brightest over the shallows, falling off into the deep and into the
  // dark at the banks' shade) that the net of light rides on.
  if (uNight > 0.0) {
    float deepK = smoothstep(0.25, 1.0, dn);
    vec3 pool = POOL * (0.5 + 0.2 * shaft) * mix(1.0, 0.42, deepK) * (0.82 + 0.18 * shallow);
    pool += POOL * vec3(0.7, 1.0, 1.05) * nfil * 2.2;
    // Under the sheet the lake is brightest: the name is the light.
    pool *= 1.0 + 0.5 * uGlow * lakeK;
    water = mix(water, pool, uNight * 0.93);
  }
  // Meltwater brightens and cools the water it runs through.
  water *= 1.0 + 0.25 * uMeltAct * lakeK;

  // A wave is seen as real ripples are: the face turned to the light is
  // brighter, the far face darker.
  float wf = dot(wv.ba, -LXY) * 9.0;
  water *= 1.0 + clamp(wf * 6.5, -0.3, 0.7);

  // ---- the surface: a mirror that grows toward the horizon
  vec3 nr = normalize(vec3(-slope * 0.6, 1.0));
  float cosi = clamp(dot(-dir, nr), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  vec3 rf = reflect(dir, nr);
  rf.z = abs(rf.z) + 0.015;
  rf = normalize(rf);
  vec3 refl = skyAll(rf, uQuality > 1.5 ? 1.0 : 0.0);
  // The slab stands in the water: its mirror image, broken by the ripples.
  if (slabOn > 0.0) {
    vec2 suvS;
    float faceS;
    float tS = slabHit(vec3(pw, -FREEBOARD), rf, suvS, faceS);
    if (tS > 0.0) refl = slabColor(suvS, faceS, tS, rf) * 0.86;
  }
  refl *= 1.0 - 0.5 * shade * (1.0 - uNight);
  // The top-down view at the end is the page's water: the mirror gives way.
  fres *= 1.0 - 0.7 * uEnd;
  vec3 col = mix(water, refl, fres);
  // The sun on ripple faces turned toward it: a broad, graded sheen.
  float sd = max(dot(rf, S.sun), 0.0);
  col += S.band * (pow(sd, 240.0) * 1.6 + pow(sd, 40.0) * 0.12) * (1.0 - shade) * (1.0 - uNight);
  // The last move ends on the ending's own first frame: the page's open
  // water seen from above, in the colour and with the net the ending draws.
  if (uEnd > 0.0) {
    vec3 day = vec3(0.048, 0.272, 0.325) * (1.0 + 0.38 * (min(caust, 3.0) - 1.0) * net);
    vec3 night = vec3(0.0104, 0.0385, 0.0494) + vec3(0.095, 0.38, 0.437) * nfil;
    col = mix(col, mix(day, night, uNight), uEnd * uEnd);
  }
  // Waterline: a dark wet seam by day; before dawn the light gathers there.
  float line = smoothstep(-3.0 - foot, 0.0, bw.r);
  col *= 1.0 - 0.3 * line * (1.0 - uNight);
  col += POOL * uNight * line * 0.25;
  return col;
}

void main() {
  skyKey();
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
        slabCov += 0.25;
        slabCol += slabColor(suv, face, t, rd) * 0.25;
        slabT = min(slabT, t);
      }
    }
    if (slabCov > 0.0) slabCol /= slabCov;
  }

  if (slabCov > 0.999) {
    col = slabCol;
  } else if (dir.z > -0.0006) {
    // ---- above the horizon
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
    bool hasIce = uIce.z > 0.0 && p.y > uLake.x - 80.0 && p.y < uLake.y + 80.0 && sd0 < 40.0;
    if (hasIce) {
      f0 = iceF(p, sd0, cr, il);
      float aaI = 0.75 * foot / mix(1.0, sinE, 0.6);
      aIce = 1.0 - smoothstep(-aaI, aaI, f0);
      if (aIce < 1.0) {
        vec3 c1;
        vec2 i1;
        vec2 pf = p + tilt * uIceH;
        float f1 = iceF(pf, bedAt(pf).r, c1, i1);
        aCut = (1.0 - aIce) * (1.0 - smoothstep(-aaI, aaI, f1));
        cutS = clamp(f0 / max(f0 - f1, 1e-3), 0.0, 1.0);
        if (aCut < 1.0 && uQuality > 0.5) {
          vec3 L = keyDir();
          vec2 ps = pf + normalize(L.xy) * min(length(L.xy) / L.z, 1.5) * uIceH * 0.5;
          float fs = iceF(ps, bedAt(ps).r, c1, i1);
          iceShade = (1.0 - smoothstep(-1.0, 1.0, fs)) * (0.5 + 0.5 * smoothstep(0.0, uIceH * 0.5, -fs));
        }
      }
    }

    // ---- the slab's shade and its own light on the ground round it
    float slabShade = 1.0;
    vec3 slabLight = vec3(0.0);
    float slabOn = 0.0;
    if (uSlabSize.x > 0.0) {
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
    if (aLand > 0.0) col = (landColor(p, sd0, b0.ba, foot, dir, slabShade) + slabLight * 0.5) * aLand;
    if (aLand < 1.0 && aIce < 0.999) {
      vec2 pw = p + tilt * FREEBOARD;
      vec4 bw = bedAt(pw);
      float aWall = smoothstep(-aa, aa, bw.r);
      vec3 cut = vec3(0.0);
      if (aWall > 0.0) {
        // The far bank's face above the waterline: packed snow over ice,
        // bluer and darker toward the water.
        float f = clamp(-sd0 / max(length(tilt) * FREEBOARD, 1.0), 0.0, 1.0);
        vec3 nW = normalize(vec3(-bw.ba, 0.35));
        vec4 gw = textureLod(uGrain, vec2(dot(p, vec2(bw.a, -bw.b)) / 180.0, f * 0.35), 0.0);
        vec3 wall = mix(vec3(0.84, 0.88, 0.93), vec3(0.3, 0.48, 0.6), smoothstep(0.25, 1.0, f)) * (0.9 + 0.2 * gw.g);
        wall = mix(wall, wall * vec3(0.55, 0.7, 0.85), uNight * 0.6);
        wall *= lightOn(nW, 1.0);
        wall *= mix(1.0, 0.7, f * f);
        wall += POOL * uNight * (0.1 + 0.5 * f * f);
        cut += wall * aWall;
      }
      if (aWall < 1.0) cut += (waterColor(pw, bw, dir, foot, footL, iceShade, slabOn) + slabLight * 0.12) * (1.0 - aWall);
      col += cut * (1.0 - aLand);
    }
    if (aCut > 0.0) col = mix(col, iceCut(p, cutS, length(tilt) * uIceH / max(foot / sinE, 1e-3)), aCut);
    if (aIce > 0.0) col = mix(col, iceTop(p, il, cr, f0, sd0, dir, foot), aIce);

    // ---- the air: haze that lies low and thickens with distance. From
    // high up the ray crosses less of it; near the ground it hides the far
    // end of the world.
    const float HF = 320.0;
    float thin = (1.0 - exp(-uCamPos.z / HF)) / max(uCamPos.z / HF, 1e-3);
    float fog = 1.0 - exp(-t * 0.00034 * S.haze * thin);
    vec3 air = airAt(dir.xy);
    // (Before dawn the ground's haze is the cold air, warmed only toward the light.)
    air = mix(air, mix(S.hor, air, 0.45), uNight);
    col = mix(col, air, fog * (1.0 - 0.9 * uEnd));
    // The horizon is soft: the same mist that lies at the ranges' foot.
    col = mix(col, air, exp(dir.z / 0.006) * 0.75);
  }
  if (slabCov > 0.0 && slabCov <= 0.999) col = mix(col, slabCol, slabCov);

  // Finish as the ending does: gentle vignette, filmic roll-off, dither.
  vec2 c = vUv - 0.5;
  col *= 1.0 - dot(c, c) * 0.35 * (1.0 - uEnd);
  col = mix(aces(col * 1.12), col, uEnd);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0 * 1.6;
  o = vec4(col, 1.0);
}`;
