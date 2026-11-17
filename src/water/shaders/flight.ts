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
import { CANYON_ICE, COLUMNS, DAM_ICE, DAM_WATER, LATTICE_ICE, STATION_COMMON } from './stations';
import { PANO } from './terrain';
import { BASIN, CONF_RIVER, CONF_Y, DELTA, ISLAND, LAKE, LIP, POOL, SHARDS, SHEET, SHEET_CROP, SHEET_CROP_TALL, STREAM, T2, TARN, TRIBS, lipY } from '../world';

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

/**
 * The pass comes in two variants. The sea's code slows every frame that
 * carries it, even where it never runs (the driver's cost follows the whole
 * shader's shape), so the flight is drawn by the variant without it, and
 * the one with it is used only while the camera is near the sea.
 */
export const flightSource = (sea: boolean) => FLIGHT_SRC.replace('//#SEA', sea ? '#define SEA' : '');

const FLIGHT_SRC = `#version 300 es
//#SEA
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
// The light, worked out once a frame from the theme and the time of day (see sky.ts).
uniform vec3 uSkyZen;
uniform vec3 uSkyMid;
uniform vec3 uSkyHor;
uniform vec3 uSkyBand;
uniform vec3 uSunDir;
uniform vec3 uKeyCol;
uniform vec3 uKeyDir;
uniform vec3 uAmbCol;
uniform vec4 uSkyK;        // x: haze, y: how much aurora is left, z: 0..1 how far the sky has come to the ending's, w: the light left in the water's own body
uniform vec4 uSea;         // x: 1 when the open sea is near enough to be seen, y: 0..1 the camera has settled on the ending, z: u left of which the water is kept calm for the words, w: v under which it is (narrow screens), or 0
uniform vec4 uCalmBox;     // where the words now showing stand, in vUv: x0, y0, x1, y1
uniform vec2 uCalmK;       // x: 0..1 how much the picture is calmed for them, y: 1 when they are light in both themes (the ending)
uniform vec4 uRay;         // the line of light at the ending. xy: where it comes ashore (the camera's rest), z: 0..1 how far it has run, w: its strength

uniform sampler2D uBedA;
uniform sampler2D uBedB;
uniform sampler2D uWave;   // h, v, gx, gy
uniform sampler2D uVel;
uniform sampler2D uCurv;
uniform sampler2D uGrain;
uniform sampler2D uHeat;
uniform sampler2D uSlabTex;
uniform sampler2D uSheetTex; // the picture on the pool's bed
uniform float uSheetOn;
uniform float uShardOn;    // 1 when the tarn's two shards are near enough to be seen
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
// The same field where that ray meets the water, and 0..1 how squarely the nearest edge there is the far one (the wall the eye sees across the opening).
float gIceF1 = 1e3;
float gFarK = 0.0;
// Where this water stands in the name as the first camera sees it: 1 at the letters' far edge, -1 at their near edge.
float gCutA = 0.0;
float walledAt(float y) { return smoothstep(${STEP.y0.toFixed(1)}, ${STEP.y1.toFixed(1)}, y) * (1.0 - smoothstep(${STEP.out0.toFixed(1)}, ${STEP.out1.toFixed(1)}, y)); }

const float PANO_AZ = ${PANO.az.toFixed(4)};
const float PANO_EL = ${PANO.el.toFixed(4)};
const float PANO_W = ${PANO.w}.0;
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

// 0..1: how far the sky has come to the ending's (the blue hour, or first light).
float gDusk = 0.0;
void skyKey() {
  // The keys are the hour's: morning to the blue hour in the light theme,
  // the polar night to first light in the dark one.
  S.zen = uSkyZen; S.mid = uSkyMid; S.hor = uSkyHor; S.band = uSkyBand;
  S.sun = uSunDir;
  // What lights the ground: the sun by day; before dawn a faint raking
  // light from where the sun will be, and the sky.
  S.key = uKeyCol;
  S.amb = uAmbCol;
  S.haze = uSkyK.x;
  gDusk = uSkyK.z;
  // What the aurora lends everything under it: it fades as the light comes.
  uAurora = vec3(0.1, 0.62, 0.42) * uNight * uSkyK.y;
}

/** The direction the ground is lit from: the sun, or before dawn a low light on its bearing. */
vec3 keyDir() { return uKeyDir; }

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
  return S.hor + S.band * (pow(a, 5.0) * 0.3 + pow(a, 2.0) * 0.08) * mix(0.5, 1.0, max(uNight, gDusk));
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
  vec3 col = mix(S.hor, S.mid, smoothstep(0.0, mix(0.24, 0.17, max(uNight, gDusk)), h));
  col = mix(col, S.zen, smoothstep(0.07, 0.62, h));
  float az = max(dot(normalize(d.xy + 1e-5), normalize(S.sun.xy)), 0.0);
  // Warmth pools on the sun's side of the horizon; it is not a stripe.
  float warm = mix(0.45, 1.0, max(uNight, gDusk));
  col += S.band * exp(-h * 15.0) * pow(az, 5.0) * 0.5 * warm;
  col += S.band * exp(-h * 30.0) * pow(az, 2.0) * 0.14 * warm;
  float sd = max(dot(d, S.sun), 0.0);
  col += sunBloom(sd) * (1.0 - 0.5 * uNight * (1.0 - gDusk)) * gSunK;
#ifdef SEA
  // (At the ending the sun is a clean limb standing on the crest: a small hard disc, and the glow round it is the bloom's.)
  float disc = mix(smoothstep(0.9996, 0.99999, sd) * 2.4 + smoothstep(0.9999, 1.0, sd) * 1.6, smoothstep(0.999838, 0.999888, sd) * 5.0, gDusk);
  col += vec3(1.0, 0.9, 0.7) * disc * (1.0 - uNight * (1.0 - gDusk)) * gSunK;
  // The pillar. In air this cold the light of a sun on the horizon stands up over it in a thin column; it rises once
  // the line of light has come in across the water, and holds: with the line it is one stroke through the sun.
  if (uRay.w > 0.0 && gDusk > 0.0) {
    float rise = smoothstep(0.6, 1.0, uRay.z);
    vec2 dn = normalize(d.xy + 1e-6);
    vec2 sn = normalize(S.sun.xy);
    float de = d.z - S.sun.z;
    if (rise > 0.0 && dot(dn, sn) > 0.9 && de > -0.03) {
      float da = dn.x * sn.y - dn.y * sn.x;
      // (It ends inside the frame, thinning into the sky: it is a column of light, not a beam that leaves the picture.)
      float top = 0.2 * rise;
      float wid = 0.0075 + 0.034 * max(de, 0.0);
      float prof = smoothstep(-0.02, 0.006, de) * exp(-max(de, 0.0) / 0.16) * (1.0 - smoothstep(top * 0.3, top, de));
      float shim = 0.86 + 0.14 * n1(de * 90.0 - uTime * 0.35);
      vec3 pc = mix(S.band, vec3(1.7, 1.5, 1.25), 0.55);
      col += pc * (exp(-da * da / (wid * wid)) * 0.42 + exp(-da * da / (wid * wid * 30.0)) * 0.09) * prof * shim * gDusk * uRay.w * gSunK;
    }
  }
#else
  col += vec3(1.0, 0.9, 0.7) * (smoothstep(0.9996, 0.99999, sd) * 2.4 + smoothstep(0.9999, 1.0, sd) * 1.6) * (1.0 - uNight * (1.0 - gDusk)) * gSunK;
#endif
  if (uNight > 0.0) {
    // (The aurora fades as the first light comes, and the stars thin.)
    vec3 au = uSkyK.y > 0.0 ? aurora(d) * uSkyK.y : vec3(0.0);
    col += au * uNight;
    if (gDirect) col += vec3(0.8, 0.88, 1.0) * stars(d) * uNight * (1.0 - gDusk) * (1.0 - gDusk) * (1.0 - min(dot(au, vec3(1.5)), 0.8));
  }
  if (clouds > 0.0) {
    // Thin high cloud: white where the sun finds it by day, a faint warm
    // underside before dawn.
    // (Two reads of the baked noise, laid over the dome from above so there is no seam.)
    vec2 cu = d.xy / (0.35 + d.z);
    float c = 0.62 * textureLod(uDetail, cu * 0.11 + vec2(uTime * 0.0006, 0.0), 1.0).r + 0.38 * textureLod(uDetail, cu * 0.37 + 0.31, 2.0).r;
    float cloud = smoothstep(0.5, 0.74, c) * smoothstep(0.03, 0.2, h) * (1.0 - smoothstep(0.4, 0.85, h));
    float low = max(uNight, gDusk);
    vec3 lit = mix(vec3(0.82, 0.86, 0.92) + S.band * 0.1 * pow(az, 2.0), col * 0.8 + S.band * 0.07 * pow(az, 3.0), low);
    col = mix(col, lit, cloud * mix(0.42, 0.55, low) * clouds);
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
      // (By day snow holds only on the easier slopes: the steep faces are bare rock, which is what gives a range its drawing.)
      float snowK = m.b * mix(smoothstep(0.86, 0.955, m.g), 1.0, uNight);
      vec3 alb = mix(mix(vec3(0.085, 0.09, 0.105), vec3(0.05, 0.055, 0.07), uNight), mix(vec3(0.92, 0.93, 0.95), vec3(0.5, 0.56, 0.66), uNight), snowK);
      float sunAz = max(dot(normalize(d.xy + 1e-5), normalize(S.sun.xy)), 0.0);
      // (What the sun does not reach is lit by the sky alone: blue, and deep in the folds.)
      // (The sun is low and behind them: level snow is only grazed by it, and it is the faces turned to it that are bright.)
      vec3 day = S.key * 0.95 * m.r * smoothstep(0.015, 0.21, m.r) + S.amb * vec3(0.78, 0.93, 1.14) * (0.02 + 0.36 * m.g * m.g);
      // Before dawn: the sky's own light, and the first warmth on what faces it.
      vec3 night = S.amb * (0.5 + 1.6 * m.g) + S.band * 0.035 * pow(sunAz, 3.0) * m.g + uAurora * 0.02 * m.g;
      vec3 rock = alb * mix(day, night, uNight);
      float far = clamp(m.a / 0.84, 0.0, 1.0);
      float airK = 1.0 - exp(-(mix(0.03, 0.1, uNight) + far * mix(0.95, 1.9, uNight)) * S.haze);
      // (Against the morning sun a range is a shape before it is a surface: less of the sun's own glare lies in front of it than behind.)
      vec3 airR = mix(air, mix(S.hor * 0.9, air, 0.4), (1.0 - uNight) * (1.0 - gDusk));
#ifdef SEA
      if (gDusk > 0.0) {
        // Against the low light the ranges are the ending's: shaded faces
        // in the sky's own deep colour, the faces the light finds a little
        // warmer, a thin bright edge on the crest toward the sun, and each
        // range further off deeper in the lit air.
        float off = acos(clamp(sunAz, 0.0, 1.0));
        float found = smoothstep(0.02, 0.3, m.r) * 0.55 + 0.45 * m.g * m.b;
        vec3 shade = S.zen * 0.22 + S.mid * 0.06;
        vec3 sunlit = S.mid * 0.34 + S.hor * 0.2 + S.band * 0.07 * exp(-off * 1.6);
        vec3 low = mix(shade, sunlit, found);
        low += S.band * 0.1 * exp(-off * 3.0) * cover * (1.0 - cover) * 4.0;
        rock = mix(rock, low, gDusk);
        airK = mix(airK, clamp(0.1 + far * 0.62 * S.haze, 0.0, 0.9), gDusk);
      }
#endif
      rock = mix(rock, airR, airK);
      col = mix(col, rock, cover);
#ifdef SEA
      // The sun's glow spills over whatever stands in front of it.
      if (gDusk > 0.0) col += sunBloom(max(dot(d, S.sun), 0.0)) * 0.5 * cover * gDusk * gSunK;
#endif
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
float gSlabThick;
float shallowsAt(vec2 p);
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
  gSlabThick = tF - tN;
  vec3 h = a + d * tN;
  // 1: the front, 2: the top, 3: a side, 0: the back.
  face = tn.y >= tn.x && tn.y >= tn.z ? step(0.0, d.y) : (tn.z > tn.x ? 2.0 : 3.0);
  if (face > 2.5) { uv = vec2(h.y / uSlabSize.z, h.z / uSlabSize.y); return tN; }
  if (face > 1.5) { uv = vec2(h.x / uSlabSize.x + 0.5, h.y / uSlabSize.z); return tN; }
  uv = vec2(h.x / uSlabSize.x + 0.5, h.z / uSlabSize.y);
  return tN;
}

// 1 while the block is drawn as a mirror image in moving water: no hairline survives that.
float gSlabSoft = 0.0;

/**
 * What is seen inside a piece of glacier ice. Three depths are looked at
 * along the eye's ray, each a little further across the face than the last,
 * so what is in the ice shifts against its skin as the eye moves: veils of
 * trapped air standing in upright curtains, hairline fractures in short
 * lengths, and the sheen of cleavage planes, sharp on one side.
 * q: where the ray enters, in the face's plane. v: how far the ray moves
 * across the face for each unit of depth. thick: the ice along the ray.
 * Returns x: the veils, y: the fractures' light, z: how deep the eye gets.
 */
vec3 iceInside(vec2 q, vec2 v, float thick, float foot, float seed) {
  float veil = 0.0;
  float spark = 0.0;
  float seen = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float d = k == 0 ? 9.0 : (k == 1 ? 40.0 : 104.0);
    if (d > thick + 4.0) break;
    vec2 a = q + v * d + seed * 37.0 + fk * 113.0;
    vec4 g1 = textureLod(uGrain, a / vec2(1250.0, 3400.0), lodFor(foot, 1250.0, 256.0));
    vec4 g2 = textureLod(uGrain, a / 2300.0 + 0.31, lodFor(foot, 2300.0, 256.0));
    float dim = exp(-d * 0.011);
    // Air: cloudy, in curtains that stand upright, each with one hard side.
    float cloud = g1.g * 0.62 + g2.g * 0.56;
    veil += smoothstep(0.6, 0.82 + 0.2 * g1.b, cloud) * dim * 0.48;
    if (gSlabSoft < 0.5) {
      // A fracture: a long, nearly straight break across the block, in a
      // set of two or three. Its edge is a hairline; the break itself is a
      // film that catches the light on one side of that line and is gone a
      // little way in. Each is cut to a length by the ice round it.
      vec2 dk = k == 0 ? vec2(0.83, 0.56) : (k == 1 ? vec2(-0.47, 0.88) : vec2(0.97, -0.24));
      float gap = 84.0 + 52.0 * fk;
      float s = fract(dot(a, dk) / gap + g2.g * 0.7 + seed * 0.37);
      float cut = smoothstep(0.4, 0.52, g2.b + 0.3 * (g1.g - 0.5)) * smoothstep(0.35, 0.6, g1.b + 0.25 * g2.g);
      float w = (0.9 + foot * 1.2) / gap;
      float hair = 1.0 - smoothstep(0.0, w, min(s, 1.0 - s));
      float film = pow(1.0 - s, 9.0) * (0.2 + 0.8 * g1.a);
      // Bubbles: single bright beads, strung in the curtains.
      float bead = smoothstep(0.972, 1.0, textureLod(uGrain, a / vec2(190.0, 310.0) + fk * 0.17, 0.0).r) * smoothstep(0.5, 0.75, cloud) * (1.0 - smoothstep(0.5, 1.4, foot));
      spark += ((hair * 0.85 + film * 0.5) * cut + bead * 0.8) * dim * (1.0 - smoothstep(2.0, 6.0, foot));
    }
    seen = d;
  }
  return vec3(min(veil, 1.0), spark, seen);
}

/** How hard the basin's waves are striking the block's foot at a place along it, 0..1: sets that come and go. */
float blockBeat(float along) {
  float set_ = 0.55 + 0.45 * sin(uTime * 0.37 + along * 0.004);
  float w = sin(uTime * 1.7 + along * 0.021 + 1.6 * sin(uTime * 0.23 + along * 0.007));
  return clamp((0.5 + 0.5 * w) * set_, 0.0, 1.0);
}

/** A place on the water against the block's foot. x: how far from it, y: where along it (the measure blockBeat takes), zw: the way straight out from it. */
vec4 blockFoot(vec2 pw) {
  vec2 ds = pw - uSlabPos.xy;
  vec2 lb = vec2(dot(ds, uSlabDir.zw), -dot(ds, uSlabDir.xy));
  vec2 c = clamp(lb, vec2(-uSlabSize.x * 0.5, 0.0), vec2(uSlabSize.x * 0.5, uSlabSize.z));
  vec2 o = lb - c;
  float d = length(o);
  vec2 dirL = d > 1e-3 ? o / d : vec2(0.0, -1.0);
  float along = lb.y < 0.0 ? c.x + uSlabSize.x * 0.5 + 190.0 : c.y + 570.0;
  return vec4(d, along, uSlabDir.zw * dirL.x - uSlabDir.xy * dirL.y);
}
/** The phase of the waves that run in on the block: it grows with time, so a crest moves inward. */
float blockPhase(vec4 bf) {
  return uTime * 1.7 + bf.y * 0.021 + 1.6 * sin(uTime * 0.23 + bf.y * 0.007) + bf.x * 0.062 + 2.2 * sin(bf.x * 0.011 + bf.y * 0.013 + 1.3);
}
/** The slope those waves give the water: steeper as they close on the block. */
vec2 blockSwell(vec2 pw) {
  vec4 bf = blockFoot(pw);
  float amp = (1.0 - smoothstep(150.0, 560.0, bf.x)) * smoothstep(0.0, 30.0, bf.x) * (0.55 + 0.45 * sin(uTime * 0.37 + bf.y * 0.004));
  // (Before dawn the water is a mirror, and a mirror shows every slope: the swell is held lower.)
  return bf.zw * cos(blockPhase(bf)) * mix(0.19, 0.07, uNight) * amp * (0.6 + 0.4 * sin(bf.y * 0.017 + uTime * 0.11));
}
/**
 * White water in the basin: every wave that reaches the block breaks on its
 * foot (a surge of foam that widens as it lands and trails lace as it
 * drains), the crests whiten as they steepen close in, and the island's and
 * the basin's own shores take the same sea.
 * sd: the bed's distance here (negative in water). na, nb: two fields of the moving surface.
 */
vec3 blockWater(vec3 col, vec2 pw, float sd, float na, float nb, float sim) {
  vec4 bf = blockFoot(pw);
  float beat = blockBeat(bf.y);
  float ph = blockPhase(bf);
  float crest = 0.5 + 0.5 * sin(ph - 1.5708);
  float cap = smoothstep(0.72, 0.97, crest) * (1.0 - smoothstep(40.0, 300.0, bf.x)) * smoothstep(0.34, 0.6, na + 0.3 * nb) * (0.6 + 0.4 * sin(uTime * 0.37 + bf.y * 0.004));
  float land_ = beat * beat;
  float dS = bf.x + 46.0 * (nb - 0.5) + 22.0 * sin(bf.y * 0.05 + uTime * 0.6);
  float surge = (1.0 - smoothstep(6.0 + 40.0 * land_, 30.0 + 90.0 * land_, dS)) * smoothstep(0.2, 0.46, na + 0.5 * beat + 0.2 * nb);
  float lace = (1.0 - smoothstep(50.0, 210.0, bf.x)) * smoothstep(0.56, 0.76, nb + 0.22 * beat) * (0.4 + 0.4 * beat);
  // The shores: a band that comes and goes with its own waves.
  float ang = atan(pw.y - uSlabPos.y, pw.x - uSlabPos.x);
  float beatS = clamp(0.5 + 0.5 * sin(uTime * 1.5 + ang * 5.0 + 2.0 * sin(uTime * 0.5 + ang * 2.0)) + sim, 0.0, 1.0);
  float band = (1.0 - smoothstep(3.0, 8.0 + 18.0 * beatS, -sd)) * smoothstep(0.35, 0.6, na + 0.35 * beatS);
  float laceS = (1.0 - smoothstep(10.0, 46.0, -sd)) * smoothstep(0.62, 0.8, nb + 0.2 * beatS) * beatS * 0.5;
  float nearB = 1.0 - smoothstep(700.0, 1000.0, length(pw - uSlabPos.xy));
  vec3 white = mix(vec3(0.93, 0.96, 1.0) * (S.amb * 1.25 + S.key * 0.28), vec3(0.34, 0.5, 0.56) * 0.3 + uAurora * 0.14, uNight);
  return mix(col, white, clamp(max(surge * 0.95 + cap * 0.8 + lace, band * 0.85 + laceS), 0.0, 1.0) * nearB);
}

/**
 * The block: a great piece of glacier ice with the product picture frozen
 * in it, standing in the basin's water at the island's shore. Its front is
 * cut flat and polished, so the picture is seen clean through a hand of
 * clear ice and the eye goes on into the ice round it; the other faces are
 * rough, frosted and fluted by melt. Snow lies deep on its top and hangs
 * over its edges, and the water has eaten a notch along its foot, where the
 * waves break white.
 * Returns the colour and, in a, how much of the pixel it covers (its
 * outline is worn, not ruled).
 */
vec4 slabColor(vec2 uv, float face, float t, vec3 rd) {
  vec3 L = keyDir();
  bool front = face > 0.5 && face < 1.5;
  bool top = face > 1.5 && face < 2.5;
  vec2 sz = face > 2.5 ? uSlabSize.zy : (top ? uSlabSize.xz : uSlabSize.xy);
  vec2 q = uv * sz;
  float foot = t * uPxAng;
  float lodF = lodFor(foot, 64.0, 256.0);
  vec4 gr = textureLod(uGrain, q / 64.0 + face * 0.37, lodF);
  vec4 gr2 = textureLod(uGrain, q / 210.0 + face * 0.19 + 0.5, lodFor(foot, 210.0, 256.0));
  vec3 n = face > 2.5 ? vec3(uSlabDir.zw * sign(dot(-rd.xy, uSlabDir.zw)), 0.0) : (top ? vec3(0.0, 0.0, 1.0) : vec3(-uSlabDir.xy, 0.0) * (face > 0.5 ? -1.0 : 1.0));
  n = front ? vec3(uSlabDir.xy, 0.0) : n;
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  float zUp = top ? uSlabSize.y : q.y;
  vec2 eB = min(q, sz - q);
  // The ray inside the ice: bent toward the face's own line, so it moves less across the face than it did in air.
  vec3 dl = vec3(dot(rd.xy, uSlabDir.zw), -dot(rd.xy, uSlabDir.xy), rd.z);
  vec2 across = face > 2.5 ? vec2(dl.y, dl.z) / max(abs(dl.x), 0.25) : (top ? vec2(dl.x, dl.y) / max(abs(dl.z), 0.25) : dl.xz / max(abs(dl.y), 0.25));
  across /= 1.31;
  float thick = gSlabThick;
  vec3 in_ = iceInside(q, across, thick, foot, face);
  // The body. Thick ice takes the red out of the light that crosses it: pale at an edge, deep blue at its heart.
  float deepK = 1.0 - exp(-max(thick, 0.0) / 95.0);
  float heart = smoothstep(0.0, 110.0, min(eB.x, eB.y));
  vec3 body = mix(vec3(0.46, 0.72, 0.85), vec3(0.03, 0.18, 0.36), deepK * (0.55 + 0.45 * heart));
  body *= 0.92 + 0.16 * gr2.g;
  // Light comes through it from the sun's side, and what is in it catches that light.
  float thru = 0.55 + 0.45 * max(dot(n, L), 0.0) + 0.5 * max(dot(-n, L), 0.0);
  vec3 airC = mix(vec3(0.82, 0.91, 0.96), vec3(0.42, 0.62, 0.7), uNight);
  vec3 lightD = S.key * 0.2 * thru + S.amb * 0.92;
  vec3 lightN = S.amb * 1.15 + uAurora * 0.05 + uSlabTint * 0.1;
  vec3 light = mix(lightD, lightN, uNight);
  vec3 col = mix(body, airC, in_.x * mix(0.55, 0.3, uNight)) * light;
  // (Before dawn a fracture is a thread of the sky's green, not a bright seam.)
  col += mix(vec3(0.85, 0.95, 1.0) * (S.key * 0.2 + S.amb * 0.5), uAurora * 0.26 + uSlabTint * 0.3 + vec3(0.012, 0.03, 0.04), uNight) * in_.y;
  float aCov = 1.0;
  if (front) {
    // The polished front. The picture lies a little way in: it shifts
    // against the face as the eye moves, and bends only near the edges.
    const float MX = 30.0;
    float iw = uSlabSize.x - 2.0 * MX;
    float ih = iw * ${(1376 / 2200).toFixed(4)};
    vec2 io = vec2(MX, uSlabSize.y - 66.0 - ih);
    vec2 pq = q + across * 16.0;
    vec2 e0 = min(pq - io, io + vec2(iw, ih) - pq);
    float nearE = 1.0 - smoothstep(0.0, 20.0, min(e0.x, e0.y));
    pq += (gr.gb - 0.5) * 8.0 * nearE;
    vec2 iuv = (pq - io) / vec2(iw, ih);
    float inImg = smoothstep(0.0, 2.5, min(e0.x, e0.y));
    float lod = log2(max(foot * 2200.0 / iw, 1.0));
    vec3 img = pow(textureLod(uSlabTex, vec2(iuv.x, 1.0 - iuv.y), lod).rgb, vec3(2.2));
    vec3 seen = img * mix(vec3(0.86, 0.94, 0.98), vec3(0.95, 1.05, 1.08), uNight) + img * img * 0.3 * uNight + vec3(0.012, 0.03, 0.04) * (1.0 - uNight);
    // (The first veil of air and a hairline or two lie in front of it, faintly: it is in the ice, not on it.)
    seen += mix(vec3(0.75, 0.9, 1.0) * S.amb * 0.5, uAurora * 0.12, uNight) * in_.y * 0.1;
    // (Its edge throws a thin shade into the ice round it.)
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 16.0, -min(e0.x, e0.y))) * (1.0 - inImg);
    col = mix(col, seen, inImg);
    // (Before dawn the picture is the light in the block: the ice round it glows with it, and falls away to dark.)
    float dImg = max(-min(e0.x, e0.y), 0.0);
    col += (uSlabTint * 1.6 + vec3(0.02, 0.07, 0.085)) * exp(-dImg / 60.0) * (0.35 + 0.65 * in_.x + 0.8 * in_.y) * (1.0 - inImg) * uNight;
    // Polished, but not flat: the sky lies on it at a glancing angle, and in the slow swells melt has left in the face.
    vec2 bump = (gr2.gb - 0.5) * 0.16 * (1.0 - inImg * 0.8);
    float cosB = clamp(dot(-rd, normalize(n + vec3(uSlabDir.zw * bump.x, bump.y))), 0.0, 1.0);
    col += S.hor * (0.02 + 0.5 * pow(1.0 - cosi, 5.0) + 0.9 * pow(1.0 - cosB, 4.0) * (1.0 - inImg)) * mix(1.0, 0.4, uNight);
  } else if (!top) {
    // The rough faces: a frosted skin, fluted where melt has run down it, with windows of clear ice between.
    float flute = textureLod(uGrain, vec2(q.x / 460.0 + 0.3, q.y / 5200.0), lodFor(foot, 460.0, 256.0)).g;
    float flute2 = textureLod(uGrain, vec2(q.x / 120.0, q.y / 2600.0 + 0.6), lodFor(foot, 120.0, 256.0)).g;
    float frost = clamp(0.2 + 1.5 * (flute - 0.38) + 0.7 * (gr2.g - 0.5), 0.0, 1.0) * 0.7 + 0.12;
    vec3 nF = normalize(n + vec3(uSlabDir.xy * (flute2 - 0.5) * 0.5, 0.0) + vec3(0.0, 0.0, (gr.g - 0.5) * 0.3));
    vec3 skin = mix(vec3(0.84, 0.9, 0.95), vec3(0.4, 0.52, 0.62), uNight) * (S.key * mix(0.3, 0.12, uNight) * (0.25 + 0.75 * max(dot(nF, L), 0.0)) + S.amb * mix(0.8, 1.6, uNight) + uAurora * 0.06);
    col = mix(col, skin * (0.88 + 0.24 * flute2), frost);
    // (A facet here and there is turned to the sun.)
    col += S.key * 0.2 * smoothstep(0.93, 1.0, gr.b + 0.25 * flute2) * max(dot(n, L), 0.0) * (1.0 - uNight);
    col += S.hor * 0.26 * pow(1.0 - cosi, 4.0) * mix(1.0, 0.4, uNight);
  }
  // Where two faces meet the edge is worn round: it catches the sky, and the light inside the block leaves by it.
  float arris = 1.0 - smoothstep(0.5, 7.0, top ? min(eB.x, eB.y) : eB.x);
  col += mix(vec3(0.78, 0.9, 1.0) * (S.key * 0.16 + S.amb * 0.8), uAurora * 0.5 + uSlabTint * 0.2 + vec3(0.03, 0.06, 0.08), uNight) * arris * (0.6 + 0.4 * gr.g);
  // Snow: deep on the top, hanging over every face in lobes, a soft shade under each.
  float lobes = textureLod(uGrain, vec2(q.x / 1500.0 + face * 0.13, 0.37), 0.0).g;
  float hang = 20.0 + 26.0 * smoothstep(0.3, 0.75, lobes) + 5.0 * gr2.g;
  float below = uSlabSize.y - hang - zUp;
  float snowK = top ? 1.0 : 1.0 - smoothstep(-1.0 - foot, 1.0 + foot, below);
  // (Its face rounds over toward the foot of each lobe.)
  vec3 nS = top ? normalize(vec3((gr2.gb - 0.5) * 0.7, 1.0)) : normalize(n * (0.45 + 0.8 * smoothstep(12.0, 0.0, -below)) + vec3(0.0, 0.0, 0.75 - 0.9 * smoothstep(9.0, 0.0, -below)));
  // (Snow is lit as the land's is: level snow at one brightness whatever the sun's height, a lobe's face
  // turned to the sun brighter, one turned away in the sky's blue shade, its underside darkest. Before dawn
  // it has the sky's light and what the block itself gives off, so it is the palest thing on the block.)
  float toSun = dot(normalize(nS.xy + 1e-4), normalize(L.xy));
  float lobeSh = top ? 1.0 : 1.0 - 0.22 * smoothstep(10.0, 0.0, -below);
  vec3 sn = mix(vec3(0.93, 0.94, 0.96), vec3(0.74, 0.8, 0.9), uNight) * (S.key * mix(0.24, max(L.z, 0.05), uNight) * (top ? 1.0 : 0.9 + 0.45 * toSun) + S.amb * mix(0.8, 2.4, uNight) * (0.62 + 0.38 * nS.z) + uAurora * 0.2 + uSlabTint * 0.3 * uNight) * lobeSh;
  if (!top) col *= 1.0 - 0.34 * (1.0 - smoothstep(0.0, 13.0, below)) * step(0.0, below);
  col = mix(col, sn * (0.92 + 0.16 * gr.g), snowK);
  if (!top) {
    // The notch the basin has eaten along the foot: wet, dark, undercut, with a bright lip over it.
    float nh = 17.0 + 12.0 * gr2.b;
    float notch = 1.0 - smoothstep(nh - 5.0, nh + 2.0, zUp);
    col = mix(col, col * vec3(0.28, 0.46, 0.58) + S.hor * 0.05 * (1.0 - uNight), notch * 0.8);
    col += mix(vec3(0.82, 0.93, 1.0) * S.amb * 0.9, uAurora * 0.3, uNight) * (1.0 - smoothstep(0.0, 2.6, abs(zUp - nh - 1.5))) * 0.7;
    // The waves break on it: white water thrown up the face, higher with each wave that lands.
    float beat = blockBeat(q.x + face * 190.0);
    float reach = 12.0 + 58.0 * beat * beat;
    float spray = (1.0 - smoothstep(reach * (0.35 + 0.65 * gr.b), reach * (0.75 + 0.9 * gr.b) + 2.0, zUp)) * (0.55 + 0.45 * beat);
    vec3 white = mix(vec3(0.93, 0.96, 1.0) * (S.amb * 1.25 + S.key * 0.28), vec3(0.34, 0.5, 0.56) * 0.34 + uAurora * 0.16, uNight);
    col = mix(col, white, clamp(spray, 0.0, 1.0) * (0.55 + 0.45 * gr.a) * (1.0 - gSlabSoft * 0.5));
    // The outline is worn: the snow's own mounds along the top, melt down the sides.
    float px = max(foot, 0.2);
    float crest = uSlabSize.y - 15.0 * (1.0 - smoothstep(0.2, 0.8, textureLod(uGrain, vec2(q.x / 1300.0 + face * 0.41, 0.83), 0.0).g)) - 2.0 * gr2.g;
    aCov *= 1.0 - smoothstep(crest - px, crest + px, zUp);
    // (Only an edge that stands against the sky is worn: where the front meets the side the eye sees, the ice goes on.)
    float sideIn = (2.0 + 9.0 * smoothstep(0.35, 0.8, textureLod(uGrain, vec2(0.3 + face * 0.2, q.y / 1900.0), 0.0).g) + 2.0 * gr.g) * step(face, 1.5);
    float eOut = face > 2.5 ? sz.x - q.x : (dl.x > 0.0 ? sz.x - q.x : q.x);
    aCov *= smoothstep(sideIn - px, sideIn + px, eOut);
  }
  return vec4(col, aCov);
}

/* ---------- the bed ---------- */

float bedShore;
vec4 bedAt(vec2 w) {
  // The lake's far shore. Past the world's sides the bed repeats its last
  // column, so the coast there would be a ruled line: it is bent into long
  // low headlands and bays, big enough to be seen from across the lake.
  // (Not in front of the outlet: the river leaves where it was carved.)
  if (w.y > ${(LAKE.y1 - 2300).toFixed(1)} && w.y < ${(LAKE.y1 + 1500).toFixed(1)}) {
    float side = 1.0 - smoothstep(960.0, 1230.0, w.x) * (1.0 - smoothstep(1730.0, 2000.0, w.x));
    if (side > 0.0) {
      float bend = 430.0 * sin(w.x / 1870.0 + 0.6) + 270.0 * sin(w.x / 790.0 + 2.1) + 130.0 * sin(w.x / 350.0 + 4.0) + 60.0 * sin(w.x / 137.0 + 1.3);
      w.y += bend * side * smoothstep(${(LAKE.y1 - 2300).toFixed(1)}, ${(LAKE.y1 - 1000).toFixed(1)}, w.y) * (1.0 - smoothstep(${(LAKE.y1 + 600).toFixed(1)}, ${(LAKE.y1 + 1500).toFixed(1)}, w.y));
    }
  }
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

/**
 * Where a place on the lake stands in the first camera's frame, in half
 * heights of the name: 1 at the letters' far edge, -1 at their near edge,
 * about 4 at the far shore, falling toward the eye.
 */
float nameRow(float y) {
  float dyc = y - uIceP.x;
  float zc = max(dyc * uIceP.z + uIceP.y * uIceP.w, 1.0);
  float dy0 = uIce.y + uIce.w * 0.5 - uIceP.x;
  float z0 = dy0 * uIceP.z + uIceP.y * uIceP.w;
  float kk = uIceP.y / (z0 * z0);
  float tv = (dyc * uIceP.w - uIceP.y * uIceP.z) / zc - (dy0 * uIceP.w - uIceP.y * uIceP.z) / z0;
  return (tv - (uIceBox.y - uIce.w * 0.5) * kk) / max(uIceBox.w * kk, 1e-5);
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
  // The lake as the first frame sees it. Beyond the name, toward the far
  // shore, the wind has swept it: clear dark ice with the ranges and the
  // sky lying in it, and the snow in crisp drifts. Under the eye, where the
  // first frame's words stand, it is one calm, even stretch: snow by day,
  // clear dark ice before dawn.
  float row = nameRow(p.y);
  float farK = smoothstep(1.2, 2.0, row);
  float nearK = smoothstep(-1.1, -1.75, row);
  float less = wet * 0.14 + lane * 0.06 + uNight * (0.1 + 0.16 * (1.0 - smoothstep(20.0, 420.0, nameD)));
  less += farK * mix(0.2, 0.06, uNight) + nearK * mix(-0.24, 0.3, uNight);
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
  float dust = smoothstep(0.438 - ew, 0.438 + ew, lvl) * (1.0 - 0.5 * wet) * (1.0 - 0.6 * farK);
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
  vec3 clear = uIceCol * mix(mix(vec3(0.2, 0.42, 0.52), vec3(0.035, 0.17, 0.33), farK), vec3(0.013, 0.04, 0.078), uNight) * (0.78 + 0.34 * under) + uScatter * mix(mix(2.0, 0.35, farK), 0.3, uNight);
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
  // (Once the sheet is plates each rides at its own small tilt: it takes the light a little differently from its neighbours.)
  col *= 1.0 + (cr.y - 0.5) * 0.16 * smoothstep(0.45, 0.6, uIceA.z);
  // A pressure crack: a hairline of shadow, refrozen white either side.
  float cw = max(1.0, foot * 0.9);
  // (The cracks go as the sheet becomes plates, and a lean frame lets them go while they are only hairlines.)
  float crK = (1.0 - uIceC.y) * (1.0 - gL2 * (1.0 - smoothstep(0.0, 0.01, uIceA.y))) * (1.0 - 0.75 * nearK * (1.0 - smoothstep(0.0, 0.02, uIceA.y)));
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
  col = mix(col, mir, fres * gloss * (0.55 + 0.4 * wet) * (1.0 - 0.5 * farK * (1.0 - uNight)) * (1.0 - 0.74 * uNight));
  gDull = false;
  // (Before dawn the ice round the name is the darkest on the lake: nothing there competes with the light in the letters.)
  col *= 1.0 - 0.6 * uNight * (1.0 - smoothstep(40.0, 560.0, nameD));
  // The lip of a cut: a hair of snow, then the edge itself.
  float edge = 1.0 - smoothstep(0.0, 2.2 * cw, -f0);
  col *= 1.0 + 0.07 * edge;
  // Before dawn the arris catches the sky: a thin cold line round every cut.
  col = mix(col, white * 0.7 + uAurora * 0.22, uNight * 0.12 * (1.0 - smoothstep(0.0, 1.5 * cw, -f0)));
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
  float band = textureLod(uGrain, vec2(p.x / 90.0, 0.37), 0.0).b;
  // By day the low sun stands behind it and comes through: clear blue ice
  // lit from within, palest under the lip, deepest where it meets the
  // water. Before dawn its only light is the water's: brightest at the
  // waterline, dying upward, so the letters read as light in a slot.
  vec3 top = mix(vec3(0.36, 0.74, 0.93), vec3(0.016, 0.06, 0.07), uNight);
  vec3 foot = mix(vec3(0.07, 0.38, 0.66), vec3(0.1, 0.4, 0.34), uNight);
  vec3 face = mix(top, foot, smoothstep(0.0, mix(0.9, 1.0, uNight), s) * mix(1.0, s, uNight)) * (0.84 + 0.3 * streak) * (0.9 + 0.2 * band);
  // The lip: packed snow standing over the cut.
  float w = min(1.4 / max(tall, 1.0), 0.3);
  vec3 lip = mix(vec3(0.97, 0.985, 1.0), vec3(0.12, 0.2, 0.24), uNight);
  face = mix(face, lip, 1.0 - smoothstep(w * 0.6, w * 1.3, s));
  return face;
}

/**
 * The water at the foot of a cut's far wall. The wall stands in it: its
 * mirror image hangs under the waterline, as tall as the wall and shaken by
 * the ripples, and under that the ice goes on down, a glow that the depth
 * takes. This is what says the letters are holes and the dark in them is
 * water.
 */
vec3 cutFoot(vec3 col, vec2 pw, vec3 dir, vec2 slope, float foot, float k) {
  float run = max(length(dir.xy) / max(-dir.z, 1e-3) * uIceH, 1.0);
  // How far this water is from the wall's foot, in wall heights as the eye sees them.
  float d = max(gIceF1 / run + dot(slope, normalize(dir.xy + 1e-6)) * 2.5, 0.0);
  float on = gFarK * gFarK * k;
  // The mirrored wall: clear blue, strongest at the waterline, gone a wall's height down.
  float img = exp(-d * d * 1.7);
  vec3 wall = mix(vec3(0.16, 0.5, 0.7) * (S.amb * 1.2 + S.key * 0.12), vec3(0.16, 0.5, 0.42) * 0.7, uNight);
  col = mix(col, wall, img * on * mix(0.5, 0.42, uNight));
  // The ice below the waterline: a glow the depth takes.
  col += mix(vec3(0.015, 0.11, 0.15) * (S.amb * 1.1 + S.key * 0.08), vec3(0.008, 0.05, 0.04), uNight) * exp(-d / 1.7) * on;
  return col;
}

/* ---------- the confluence: a snowfield above a cliff of ice, and seven falls ---------- */

// (The snowfield comes up to its height as the eye comes toward it down the valley, over a long stretch of the flight:
// from the basin it is a low shelf, and nothing ever appears at once.)
#define LIP_H (${LIP.h.toFixed(1)} * smoothstep(${(CONF_Y - 3300).toFixed(1)}, ${(CONF_Y - 2450).toFixed(1)}, uCamPos.y))
const vec2 LIP_O = vec2(${LIP.x0.toFixed(1)}, ${LIP.y0.toFixed(1)});
// The way the cliff faces, in plan: out over the river.
const vec2 LIP_N = vec2(${(-LIP.m / Math.hypot(1, LIP.m)).toFixed(5)}, ${(-1 / Math.hypot(1, LIP.m)).toFixed(5)});
const float LIP_LEN = ${Math.hypot(1, LIP.m).toFixed(5)};
const vec2 TRIB_M[${TRIBS.length}] = vec2[${TRIBS.length}](${TRIBS.map((t) => `vec2(${t.mouth.x.toFixed(1)}, ${t.mouth.y.toFixed(1)})`).join(', ')});
float lipY(float x) { return LIP_O.y + (LIP_O.x - x) * ${LIP.m.toFixed(3)}; }
// Where the cliff turns its corner: west of here there is no snowfield, and a second face runs north from it.
const float LIP_W = ${LIP.x1.toFixed(1)};
/** How high the snowfield stands at a place on it: it eases down to the land at its back. */
float fieldTop(vec2 q) { return LIP_H * (1.0 - smoothstep(${LIP.back.toFixed(1)}, ${(LIP.back + LIP.backRamp).toFixed(1)}, q.y)); }
/** 1 while the confluence is near enough to be seen. */
bool confNear() { return uCamPos.y > ${(CONF_Y - 3300).toFixed(1)} && uCamPos.y < ${(CONF_Y + 1500).toFixed(1)}; }
/**
 * How far above the land the ground under a ray lies: the snowfield's
 * height where the ray comes down on it, nothing anywhere else.
 */
float confLift(vec3 dir) {
  if (!confNear()) return 0.0;
  float h = LIP_H;
  vec2 q = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    q = uCamPos.xy + dir.xy * ((uCamPos.z - h) / -dir.z);
    h = fieldTop(q);
  }
  return q.y > lipY(q.x) && q.x > LIP_W ? h : 0.0;
}
/** The ice of a cliff's face. f: 0 at its lip, 1 at the water. along: a measure along it. nP: the way it faces, in plan. */
vec3 cliffIce(float f, float along, float tall, float px, vec2 nP) {
  float flute = textureLod(uGrain, vec2(along / 560.0, f * 0.07 + 0.3), 0.0).g;
  float flute2 = textureLod(uGrain, vec2(along / 150.0 + 0.4, f * 0.05 + 0.7), lodFor(px, 150.0, 256.0)).g;
  float seam = textureLod(uGrain, vec2(along / 3000.0 + 0.2, f * 0.5), 0.0).g;
  vec3 ice = mix(vec3(0.34, 0.64, 0.82), vec3(0.03, 0.2, 0.4), smoothstep(0.08, 0.9, f)) * (0.7 + 0.42 * flute + 0.22 * flute2);
  // (It stands in buttresses, with deep clefts between them.)
  float butt = textureLod(uGrain, vec2(along / 2300.0 + 0.11, 0.27), 0.0).g;
  float cleft = 1.0 - smoothstep(0.0, 0.05, abs(butt - 0.5));
  ice *= 1.0 - 0.5 * cleft * smoothstep(0.05, 0.3, f);
  ice = mix(ice, vec3(0.085, 0.095, 0.11) * (0.7 + 0.6 * flute2), smoothstep(0.6, 0.68, seam) * smoothstep(0.25, 0.42, f) * 0.7);
  // The cornice: packed snow over the lip, hanging in lobes, a soft shade under each.
  float lobes = textureLod(uGrain, vec2(along / 1500.0, 0.61), 0.0).g;
  float hang = (9.0 + 15.0 * smoothstep(0.3, 0.75, lobes) + 4.0 * flute2) / tall;
  ice *= 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.09, f - hang)) * step(hang, f);
  vec3 nC = normalize(vec3(nP + vec2(-nP.y, nP.x) * ((flute2 - 0.5) * 0.5 + (butt - 0.5) * 2.4), 0.22));
  // (A face of ice is lit through as well as on: turned from the sun it still holds the sky's light.)
  vec3 c = ice * (lightOn(nC, 1.0) * 0.62 + S.amb * 0.55);
  vec3 snow = mix(vec3(0.93, 0.94, 0.96), vec3(0.74, 0.8, 0.9), uNight) * (S.key * mix(0.24, max(keyDir().z, 0.05), uNight) + (S.amb * 0.8 + uAurora * 0.035) * 0.8);
  c = mix(c, snow, 1.0 - smoothstep(hang - 0.012, hang + 0.012, f));
  // Wet and dark where it stands in the water.
  c *= 1.0 - 0.45 * smoothstep(0.9, 1.0, f);
  return mix(c, c * vec3(0.6, 0.8, 0.95) + (vec3(0.03, 0.05, 0.07) + uAurora * 0.06), uNight * 0.6);
}
/** The air between the eye and something t away, laid over its colour. */
vec3 confAir(vec3 c, vec3 dir, float t) {
  float thin = (1.0 - exp(-uCamPos.z / 320.0)) / max(uCamPos.z / 320.0, 1e-3);
  vec3 air = airAt(dir.xy);
  air = mix(air, mix(S.hor, air, 0.45), uNight);
  // (Far off the cliff is lost in the air sooner than the ground is: from the basin it is a pale line, not a row of falls.)
  return mix(c, air, 1.0 - exp(-t * (1.0 + 5.0 * smoothstep(1500.0, 2400.0, t)) * 0.00021 * S.haze * thin));
}
/** The cliff's second face: from the corner north along the river that leaves, looking west. */
vec3 confWest(vec3 col, vec3 dir, float landAt0) {
  // (It is seen only from the west of it.)
  if (dir.x < 1e-4 || uCamPos.x > LIP_W) return col;
  float tc = (LIP_W - uCamPos.x) / dir.x;
  if (tc <= 0.0) return col;
  vec3 h = uCamPos + dir * tc;
  if (h.y < lipY(LIP_W)) return col;
  float top = fieldTop(h.xy);
  float px = max(tc * uPxAng, 0.05);
  if (top < 1.0 || h.z > top + px || h.z < -FREEBOARD) return col;
  float aC = (1.0 - smoothstep(top - px, top + px, h.z)) * smoothstep(0.0, 2.0 * px, h.y - lipY(LIP_W));
  if (h.z < 0.0) aC *= 1.0 - landAt0;
  if (aC <= 0.0) return col;
  vec3 c = cliffIce((top - h.z) / (top + FREEBOARD), h.y + 400.0, top + FREEBOARD, px, vec2(-1.0, 0.0));
  return mix(col, confAir(c, dir, tc), aC);
}
/**
 * The cliff and what comes over it. Glacier ice under a cornice of snow,
 * fluted, blue toward the water; and where a stream reaches the lip, a
 * fall: glassy at the brink, then white strands that open as they drop,
 * and mist standing at the foot. Each fall is as wide as its stream.
 * landAt0: how much of this pixel's ground at the land's level is land (the ledge at the cliff's foot stands in front of it).
 */
vec3 confCliff(vec3 col, vec3 dir, float landAt0) {
  if (!confNear()) return col;
  col = confWest(col, dir, landAt0);
  float den = dot(dir.xy, LIP_N);
  if (den > -1e-4) return col;
  float tc = dot(LIP_O - uCamPos.xy, LIP_N) / den;
  if (tc <= 0.0) return col;
  vec3 h = uCamPos + dir * tc;
  if (h.x < LIP_W) return col;
  float px = max(tc * uPxAng, 0.05);
  if (LIP_H < 1.0 || h.z > LIP_H + 22.0 || h.z < -FREEBOARD) return col;
  // Snow is banked along the lip in drifts of its own height: the cliff's crest is not a ruled line.
  // (Not where a stream goes over: there the lip is cut down to the stream.)
  float berm = 0.18 * LIP_H * smoothstep(0.3, 0.8, textureLod(uGrain, vec2(h.x / 2100.0 + 0.07, 0.43), 0.0).g) + 3.0 * textureLod(uGrain, vec2(h.x / 300.0, 0.91), 0.0).g;
  for (int i = 0; i < ${TRIBS.length}; i++) {
    float w = uTribW[i];
    if (w > 0.0) berm *= smoothstep(w * 0.5 + 2.0, w * 0.5 + 34.0, abs(h.x - TRIB_M[i].x) * LIP_LEN);
  }
  float top = LIP_H + berm;
  if (h.z > top + px) return col;
  float aC = (1.0 - smoothstep(top - px, top + px, h.z)) * smoothstep(0.0, 2.0 * px, h.x - LIP_W);
  if (h.z < 0.0) aC *= 1.0 - landAt0;
  if (aC <= 0.0) return col;
  float tall = top + FREEBOARD;
  float f = (top - h.z) / tall;
  float along = h.x * LIP_LEN;
  vec3 c = cliffIce(f, along, tall, px, LIP_N);

  // The falls.
  float zs = LIP_H - FREEBOARD;
  vec3 white = mix(vec3(0.95, 0.98, 1.0) * (S.amb * 1.2 + S.key * 0.3), vec3(0.4, 0.56, 0.6) * 0.75 + uAurora * 0.55, uNight);
  vec3 glass = mix(vec3(0.2, 0.56, 0.66) * (S.amb * 1.1 + S.key * 0.2), vec3(0.02, 0.09, 0.1) + uAurora * 0.12, uNight);
  float mist = 0.0;
  for (int i = 0; i < ${TRIBS.length}; i++) {
    float w = uTribW[i];
    if (w <= 0.0) continue;
    float d = (h.x - TRIB_M[i].x) * LIP_LEN;
    float reach = w * 0.5 + 70.0;
    if (abs(d) > reach) continue;
    float fi = float(i);
    if (h.z > zs) {
      // The stream's own water in its notch, sliding to the brink.
      float aN = 1.0 - smoothstep(w * 0.5 - px, w * 0.5 + px, abs(d));
      float rush = textureLod(uGrain, vec2(d / 240.0 + fi * 0.31, (h.z - zs) / 90.0 + uTime * 0.12 + fi), 0.0).g;
      c = mix(c, mix(glass, white, smoothstep(0.5, 0.85, rush) * 0.45 + 0.35 * smoothstep(8.0, 0.0, h.z - zs)), aN);
    } else {
      float v = (zs - h.z) / (zs + FREEBOARD);
      // (It quickens as it drops: its strands are drawn longer the further down.)
      float drop = v * (0.55 + 0.45 * v);
      float st1 = textureLod(uGrain, vec2(d / 52.0 + fi * 0.37, drop * 0.3 - uTime * 0.16), 0.0).g;
      float st2 = textureLod(uGrain, vec2(d / 19.0 + fi * 0.71, drop * 0.5 - uTime * 0.27 + 0.5), lodFor(px, 19.0, 256.0)).g;
      float strand = 0.55 * st1 + 0.45 * st2;
      // It opens as it falls, and its edges break into strands.
      float half_ = w * 0.5 * (1.0 + 0.1 * v) + 5.0 * v;
      float ragged = abs(d + 5.0 * sin(v * 5.0 + fi * 2.3) * v) + (strand - 0.5) * (6.0 + 14.0 * v);
      float aF = 1.0 - smoothstep(half_ - px - 1.5, half_ + px + 1.5, ragged);
      // A thin stream is a veil the ice shows through; a great one is solid.
      float body = clamp(0.5 + w / 150.0, 0.0, 1.0);
      aF *= mix(0.45 + 0.55 * smoothstep(0.3, 0.62, strand), 1.0, body * 0.8) * (0.35 + 0.65 * smoothstep(0.0, 0.07, v));
      vec3 fall = mix(mix(vec3(0.46, 0.7, 0.82), vec3(0.16, 0.3, 0.36), uNight) * (S.amb * 1.1 + S.key * 0.16 + uAurora * 0.1), white, smoothstep(0.34, 0.66, strand) * (0.45 + 0.55 * smoothstep(0.0, 0.25, v)));
      // (The brink: the water bends over it, glassy.)
      fall = mix(glass * 1.3, fall, smoothstep(0.0, 0.1, v));
      c = mix(c, fall, aF);
    }
    // Mist where it lands: it stands a little way up the cliff and drifts.
    float up = (h.z + FREEBOARD) / (16.0 + 0.16 * w);
    float lat = d / (w * 0.5 + 26.0);
    mist += exp(-lat * lat) * exp(-up) * (0.5 + 0.004 * w) * (0.7 + 0.5 * textureLod(uGrain, vec2(d / 170.0 + uTime * 0.02, up * 0.2 - uTime * 0.03) + fi * 0.2, 0.0).g);
  }
  c = mix(c, white * 0.96, clamp(mist, 0.0, 0.85));
  // The same air as the ground it stands on.
  return mix(col, confAir(c, dir, tc), aC);
}
/**
 * The river along the cliff's foot. Each stream's paler meltwater keeps to
 * the bank it came in by and is pushed out from it by the next: seven
 * trails side by side, a seam of foam between each and its neighbour, the
 * newest whitest. And where each fall lands, a boil.
 */
vec3 confRiver(vec3 col, vec2 pw, float footL, float na, float nb, float shade) {
  float bankY = lipY(pw.x) - ${LIP.foot.toFixed(1)};
  float out_ = (bankY - pw.y) / LIP_LEN;
  if (out_ < -40.0 || out_ > 760.0) return col;
  float far = 1.0 - smoothstep(20.0, 60.0, footL);
  vec3 white = mix(vec3(0.94, 0.97, 1.0) * (S.amb * 1.25 + S.key * 0.3), vec3(0.36, 0.5, 0.56) * 0.3 + uAurora * 0.15, uNight);
  vec3 milk = mix(vec3(0.56, 0.87, 0.9) * (S.amb * 1.1 + S.key * 0.17), vec3(0.05, 0.12, 0.13) + uAurora * 0.09, uNight);
  float inner = 0.0;
  float milkK = 0.0;
  float seam = 0.0;
  float boil = 0.0;
  for (int i = ${TRIBS.length - 1}; i >= 0; i--) {
    float w = uTribW[i];
    if (w <= 0.0) continue;
    float mx = TRIB_M[i].x;
    float k = smoothstep(mx + w * 0.5, mx - w * 0.5 - 60.0, pw.x);
    float bw = ${CONF_RIVER.add.toFixed(2)} * w * k;
    if (bw > 0.5) {
      float a1 = inner + bw;
      float age = max(mx - pw.x, 0.0);
      float fresh = exp(-age / (420.0 + 3.0 * w));
      float wob = 5.0 * sin(pw.x * 0.021 + float(i) * 2.1 + uTime * 0.5) * (1.0 - fresh * 0.5);
      float inB = smoothstep(inner - 1.5, inner + 3.0, out_ + wob) * (1.0 - smoothstep(a1 - 3.0, a1 + 1.5, out_ + wob));
      milkK += inB * (0.3 + 0.6 * fresh) * (0.7 + 0.3 * cos(float(i) * 3.1416));
      seam += (1.0 - smoothstep(0.0, 3.2 + 1.5 * footL, abs(out_ + wob - a1))) * (0.45 + 0.55 * fresh) * k;
      inner = a1;
    }
    // The boil at its foot: a fan of broken water, wider under a wider fall.
    vec2 d = vec2((pw.x - mx) * LIP_LEN, out_);
    float r2 = dot(d * vec2(1.0, 1.25), d * vec2(1.0, 1.25));
    boil += exp(-r2 / (w * w * 0.5 + 1100.0)) * (0.75 + 0.005 * w) * step(-6.0, out_);
  }
  // Streaks, long down the current, in the pale water.
  float streak = 0.55 + 0.45 * smoothstep(0.3, 0.7, textureLod(uDetail, vec2(pw.y / 70.0, (pw.x + uTime * uFlowSpeed * 0.7) / 900.0), lodFor(footL, 70.0, 512.0)).r);
  col = mix(col, milk, clamp(milkK, 0.0, 1.0) * streak * 0.62 * far);
  col = mix(col, white, clamp(seam, 0.0, 1.0) * (0.6 + 0.4 * na) * far * (1.0 - 0.5 * shade));
  float churn = smoothstep(0.26, 0.6, mix(na, nb, 0.5) + 0.5 * clamp(boil, 0.0, 1.0) - 0.1);
  col = mix(col, white, clamp(boil, 0.0, 1.0) * churn * 0.95);
  return col;
}

/* ---------- the clear pool and the picture on its bed ---------- */

const vec2 POOL_C = vec2(${(POOL.x + POOL.w / 2).toFixed(1)}, ${(POOL.y + POOL.h / 2).toFixed(1)});
const vec2 POOL_H = vec2(${(POOL.w / 2).toFixed(1)}, ${(POOL.h / 2).toFixed(1)});
const vec2 SHEET_C = vec2(${SHEET.x.toFixed(1)}, ${SHEET.y.toFixed(1)});
// (An upright screen is shown the table's first columns, at the same size on the bed.)
#define SHEET_S (uLens.y < 0.9 ? vec2(${((SHEET.w * SHEET_CROP_TALL.w) / SHEET_CROP.w).toFixed(1)}, ${SHEET.h.toFixed(1)}) : vec2(${SHEET.w.toFixed(1)}, ${SHEET.h.toFixed(1)}))
/** 0..1: inside the pool's reach. */
float poolAt(vec2 p) {
  if (p.y < ${(POOL.y - 70).toFixed(1)} || p.y > ${(POOL.y + POOL.h + 70).toFixed(1)} || p.x < ${(POOL.x - 70).toFixed(1)}) return 0.0;
  vec2 pq = abs(p - POOL_C) - POOL_H;
  return 1.0 - smoothstep(-40.0, 30.0, max(pq.x, pq.y));
}
/** How far outside the picture's sheet a place on the bed is (negative on it). */
float sheetEdge(vec2 pb) {
  vec2 sq = abs(pb - SHEET_C) - SHEET_S * 0.5;
  return max(sq.x, sq.y);
}
/** The picture where it lies: its own table, cropped out of the screenshot. */
vec3 sheetPic(vec2 pb, float footL) {
  vec2 su = (pb - SHEET_C) / SHEET_S;
  vec2 cx = uLens.y < 0.9 ? vec2(${(SHEET_CROP_TALL.x / SHEET_CROP.srcW).toFixed(5)}, ${(SHEET_CROP_TALL.w / SHEET_CROP.srcW).toFixed(5)}) : vec2(${(SHEET_CROP.x / SHEET_CROP.srcW).toFixed(5)}, ${(SHEET_CROP.w / SHEET_CROP.srcW).toFixed(5)});
  vec2 uv = vec2(cx.x + (su.x + 0.5) * cx.y, ${(SHEET_CROP.y / SHEET_CROP.srcH).toFixed(5)} + (0.5 - su.y) * ${(SHEET_CROP.h / SHEET_CROP.srcH).toFixed(5)});
  float lodS = clamp(log2(max(footL, 1e-3) * ${SHEET_CROP.w.toFixed(1)} / SHEET_S.x), 0.0, 6.0);
  vec3 pic = textureLod(uSheetTex, uv, lodS).rgb;
  return pic * pic;
}
/** The mean colour of the picture: the light it gives off before dawn. */
vec3 sheetGlow() {
  vec3 m = textureLod(uSheetTex, vec2(${((SHEET_CROP.x + SHEET_CROP.w / 2) / SHEET_CROP.srcW).toFixed(4)}, ${((SHEET_CROP.y + SHEET_CROP.h / 2) / SHEET_CROP.srcH).toFixed(4)}), 6.0).rgb;
  return m * m + vec3(0.03, 0.075, 0.09);
}
/**
 * The pool's bed round the picture: pale glacial silt drawn into ripple
 * marks by the slow current, and stones lying on it, each lit from the
 * sun's side with its shade on the silt beside it.
 */
vec3 poolBed(vec2 pb, float footL, vec3 L) {
  vec4 g = textureLod(uGrain, pb / 300.0, lodFor(footL, 300.0, 256.0));
  vec3 silt = vec3(0.4, 0.63, 0.67) * (0.88 + 0.24 * g.g);
  // Ripple marks: long wandering ridges across the current, each with a lit face and a shaded one.
  float warp = textureLod(uGrain, pb / 2600.0 + 0.4, 0.0).g;
  float ph = (pb.y * 0.92 + pb.x * 0.38) / 9.5 + warp * 9.0;
  float rip = sin(ph) + 0.35 * sin(ph * 2.0 + 1.0);
  float ripK = smoothstep(0.35, 0.6, textureLod(uGrain, pb / 1700.0 + 0.7, 0.0).g) * (1.0 - smoothstep(1.5, 5.0, footL));
  silt *= 1.0 + 0.11 * rip * ripK;
  // Stones, two sizes: a rounded dome to a cell, most cells empty.
  float off = sheetEdge(pb);
  vec2 sun2 = normalize(L.xy + 1e-4);
  for (int k = 0; k < 2; k++) {
    float cell = k == 0 ? 74.0 : 27.0;
    vec2 q = pb / cell + (k == 0 ? 0.0 : 13.7);
    vec2 id = floor(q);
    vec2 h = hash2(id + float(k) * 31.0);
    // (They lie in drifts, thickest toward the banks, and most of them are small.)
    float drift = textureLod(uGrain, id / (k == 0 ? 9.0 : 23.0) + 0.3, 0.0).g + 0.25 * smoothstep(40.0, 150.0, off);
    float there = step(k == 0 ? 0.6 : 0.5, fract(h.x * 17.3 + h.y * 5.1)) * step(0.52, drift);
    float rad = cell * (0.12 + 0.24 * h.y * h.y);
    vec2 c = (id + 0.5 + (h - 0.5) * 0.44) * cell - (k == 0 ? vec2(0.0) : vec2(13.7 * cell));
    // (None lies on the picture.)
    there *= step(rad + 4.0, sheetEdge(c));
    if (there < 0.5) continue;
    vec2 d = pb - c;
    float ang = h.x * 6.283;
    vec2 dl = vec2(cos(ang) * d.x + sin(ang) * d.y, (-sin(ang) * d.x + cos(ang) * d.y) * (1.25 + 0.5 * h.y));
    float rr = length(dl) / rad;
    // Its shade on the silt, away from the light.
    vec2 ds = d + sun2 * rad * 0.55;
    silt *= 1.0 - 0.42 * (1.0 - smoothstep(0.55, 1.25, length(ds) / rad));
    float aS = 1.0 - smoothstep(1.0 - 1.5 * footL / rad, 1.0 + 0.5 * footL / rad, rr);
    if (aS > 0.0) {
      float dome = sqrt(max(1.0 - rr * rr, 0.0));
      vec3 nS = normalize(vec3(d / rad * 0.9, 0.35 + dome));
      float tone = fract(h.x * 9.7 + h.y * 3.3);
      vec3 stone = mix(vec3(0.14, 0.16, 0.18), vec3(0.5, 0.53, 0.53), tone) * (0.75 + 0.5 * textureLod(uGrain, pb / 37.0 + h, lodFor(footL, 37.0, 256.0)).g);
      stone *= 0.5 + 0.95 * max(dot(nS, normalize(vec3(L.xy, max(L.z, 0.35)))), 0.0);
      silt = mix(silt, stone, aS);
    }
  }
  return silt;
}
/** The net of light on the pool's bed: two broad layers of the moving surface's own focus, drifting across each other. */
float poolNet(vec2 pb, float footL) {
  const mat2 RP = mat2(0.8090, -0.5878, 0.5878, 0.8090);
  float a = textureLod(uDetail, pb / 520.0 + vec2(0.011, 0.006) * uTime, lodFor(footL, 520.0, 512.0)).a;
  float b = textureLod(uDetail, RP * pb / 390.0 - vec2(0.008, 0.013) * uTime + 0.37, lodFor(footL, 390.0, 512.0)).a;
  float n = min(a, b) * 6.0;
  return 0.66 + 2.0 * smoothstep(0.7, 2.3, n) + 0.3 * n;
}
/**
 * The pool's rim: a shelf of clear ice standing out over the water from the
 * bank all round, a bright refracting edge to it, snow dusted on it toward
 * the land. Before dawn the picture lights it from below.
 * inside: how far out from the bank over the water. Returns the colour to
 * lay over the water and, in a, how much of it.
 */
vec4 poolRim(vec2 pw, float inside, float footL, vec3 sky) {
  vec4 g = textureLod(uGrain, pw / 420.0 + 0.2, lodFor(footL, 420.0, 256.0));
  float reach = 15.0 + 20.0 * g.g + 7.0 * g.b;
  float px = max(footL, 0.3);
  float a = 1.0 - smoothstep(reach - px, reach + px, inside);
  if (a <= 0.0) return vec4(0.0);
  float edge = 1.0 - smoothstep(0.0, 3.0 + px, reach - inside);
  float dust = 1.0 - smoothstep(reach * 0.2, reach * 0.75, inside + 6.0 * (g.a - 0.5));
  vec3 ice = mix(vec3(0.58, 0.8, 0.88), vec3(0.2, 0.42, 0.5), uNight) * (S.amb * mix(0.95, 2.2, uNight) + S.key * 0.2 + uAurora * 0.1);
  vec3 snow = mix(vec3(0.93, 0.94, 0.96), vec3(0.74, 0.8, 0.9), uNight) * (S.key * mix(0.24, 0.05, uNight) + S.amb * mix(0.8, 1.4, uNight) + uAurora * 0.04);
  vec3 col = mix(ice, snow, dust * 0.85) + sky * 0.14;
  col += mix(vec3(0.85, 0.96, 1.0) * (S.amb * 0.7 + S.key * 0.14), uAurora * 0.1, uNight) * edge;
  // The picture's light, from underneath.
  float dS = max(sheetEdge(pw), 0.0);
  col += sheetGlow() * (0.5 + 1.2 * edge) * exp(-dS / 150.0) * uNight * uSheetOn;
  return vec4(col, a * (0.82 + 0.18 * edge));
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
  // (In the basin the waves run in on the block.)
  if (slabOn > 0.0) slope += blockSwell(pw);
  // (The clear pool is measuring-still: what lies on its bed is read.)
  slope *= 1.0 - 0.72 * poolAt(pw);
  float men = smoothstep(-5.0, -0.5, bw.r);
  slope += bw.ba * men * 0.42;
  vec3 n = normalize(vec3(-slope, 1.0));

  // ---- under the surface
  vec3 r = refract(dir, n, 0.75);
  float sl0;
  float d0p = bedDepth(bedSoft(bw), sl0);
  // (The clear pool is a foot deep everywhere: the picture on its bed is bent by ripples, not by a deep bed.)
  d0p = mix(d0p, min(d0p, 14.0), poolAt(pw));
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
  // The shallows the columns stand in: a hand of water over a pale bed.
  float shalK = pb.y > ${(T2 + 380).toFixed(1)} && pb.y < ${(T2 + 1700).toFixed(1)} ? shallowsAt(pb) : 0.0;
  if (shalK > 0.0) depth = mix(depth, min(depth, 13.0 + 12.0 * textureLod(uDetail, pb / 900.0 + 0.2, 0.0).r), shalK);
  // The clear pool: a foot of still water over a pale bed, and the picture lying on it.
  float poolK = poolAt(pb);
  float picK = 0.0;
  vec3 sheetC = vec3(0.0);
  if (poolK > 0.0) {
    depth = mix(depth, min(depth, 14.0), poolK);
    float se = sheetEdge(pb);
    if (se < 2.0 && uSheetOn > 0.5) {
      sheetC = sheetPic(pb, footL);
      picK = (1.0 - smoothstep(-1.5, 1.5, se)) * poolK;
    }
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
  if (poolK > 0.0) {
    // Silt and stones; the picture's sheet with a hair of shade along its edge.
    bed = mix(bed, poolBed(pb, footL, L), poolK * 0.92);
    bed *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 7.0, sheetEdge(pb))) * step(0.0, sheetEdge(pb)) * uSheetOn;
    bed = mix(bed, sheetC, picK);
  }
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
  // (Over the picture the net of light is gentler, so it can be read.)
  // In the pool the light is one broad net drifting over the bed; over the picture it is gentler, so it can be read.
  if (poolK > 0.0) {
    float netP = poolNet(pb, footL);
    netP = mix(netP, 1.04 + (netP - 1.04) * 0.3, picK);
    lightOnBed = mix(lightOnBed, vec3(uLight.x * 0.9 + uLight.y * shadow * mix(netP, 0.9 + (netP - 0.9) * 0.35, uNight)), poolK);
    nfil *= 1.0 - poolK;
  }
  float caust = dot(lightOnBed, vec3(0.3333)) / (uLight.x * 0.9 + uLight.y);
  bed *= lightOnBed / (uLight.x + uLight.y);

  float path = (depth + 7.0) * (1.0 + 1.0 / max(-r.z, 0.35));
  vec3 trans = exp(-uAbsorb * path);
  float turbid = (1.0 - exp(-path * 0.011)) * (1.0 - 0.8 * poolK);
  trans = mix(trans, vec3(0.8, 0.95, 0.97), poolK);
  vec3 body = uScatter * (0.5 + 0.5 * shadow) * (0.5 + 0.62 * min(caust, 3.0));
  vec3 water = (bed * trans + body * turbid * (1.0 - trans * 0.35)) * uSkyK.w;
  // Before dawn the water has no light of its own: a dark body, a little
  // paler over the shallows. What is seen in it is the sky.
  if (uNight > 0.0) {
    float deepK = smoothstep(0.25, 1.0, dn);
    vec3 pool = vec3(0.006, 0.02, 0.028) * (0.6 + 0.4 * shaft) * mix(1.0, 0.5, deepK);
    // In the shallows the bed shows, and the sky's light is netted on it.
    pool += (uBed * vec3(0.02, 0.05, 0.06) * (0.5 + 0.5 * gb.g) + uAurora * 0.1 * (0.35 + nfil * 2.2)) * shallow;
    pool += uAurora * 0.05 * nfil;

    water = mix(water, pool, uNight * 0.93);
    // The picture glows softly up through the water.
    water = mix(water, sheetC * 1.25 + vec3(0.016, 0.034, 0.044) + water * 0.3, picK * uNight * 0.9);
    // (And lights the silt and the stones round it.)
    if (poolK > 0.0 && uSheetOn > 0.5) water += sheetGlow() * bed * 2.6 * exp(-max(sheetEdge(pb), 0.0) / 120.0) * (1.0 - picK) * poolK * uNight;
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
  // Before dawn the running river mirrors the curtain, not the dark country
  // under it: its ripples break the light into strokes, they do not punch
  // dark holes in it.
  float streamK = smoothstep(0.25, 0.6, length(flow)) * (1.0 - lakeK) * (1.0 - shoalK) * (1.0 - gWalled);
  if (uNight * streamK > 0.0) {
    rf.z = mix(rf.z, max(rf.z, 0.2 + 0.25 * rf.z), uNight * streamK);
    rf = normalize(rf);
  }
  float sheetK = smoothstep(0.75, 1.0, uGlow) * lakeK;
  if (sheetK > 0.0) {
    // Where the eye's ray came through the top of the sheet, in the first
    // camera's own frame: how far up the name this water is seen.
    gCutA = nameRow(pw.y + dir.y / min(dir.z, -1e-3) * gFree);
    // The picture in the letters is one picture, seen through all of them:
    // at their far edge the foot of the ranges, the ranges themselves hanging
    // down from it, and under them the sky deepening toward the eye. Before
    // dawn it is the high curtain from its hem up. Slow ripples shake it.
    float up = max(1.0 - gCutA, 0.0) * 0.5;
    float el = mix(0.004 + 0.21 * up, 0.262 + 0.3 * up, uNight);
    el += dot(dgrad, vdw) * mix(0.55, 1.5, uNight);
    el = clamp(el, 0.002, 0.95);
    vec2 azd = normalize(rf.xy + vec2(1e-6));
    rf = normalize(mix(rf, vec3(azd * sqrt(1.0 - el * el), el), sheetK));
  }
  // (Before dawn the thin cloud is too faint to be seen in moving water: it is not asked for.)
  gWash = gL1;
  gSunK = 1.0 - sheetK * (1.0 - uNight);
  vec3 refl = withRidges(skyColor(rf, uQuality > 1.5 ? (1.0 - uNight) * (1.0 - gL1) : 0.0), rf, uQuality > 1.5 ? 1.5 * gL1 : 1.5);
  gWash = 0.0;
  gSunK = 1.0;
  if (sheetK > 0.0 && uNight < 1.0) {
    // (Dark water deepens what it mirrors: the ranges' shaded faces and the blue over them stand further from the pale air than they do above.)
    float rl = max(dot(refl, vec3(0.3, 0.6, 0.1)), 1e-3);
    // (And cools it: even the glare under the sun comes back as blue water, not as grey.)
    refl = mix(refl, mix(refl, vec3(rl), 0.65) * vec3(0.52, 0.88, 1.32) * min(clamp(pow(rl / 0.6, 1.3), 0.22, 1.5), 0.5 / rl), sheetK * (1.0 - uNight));
  }
  if (sheetK * uNight > 0.0) {
    // Before dawn the letters hold the curtain itself: its rays stand in
    // the water as long strokes with dark water between them, green where
    // the far side of each letter catches the hem and turning violet in
    // the deeper water under the eye.
    float azv = atan(rf.x, rf.y);
    float ray = n1(azv * 46.0 + 3.0 * n1(azv * 7.0 + uTime * 0.03) + uTime * 0.04);
    float ray2 = n1(azv * 15.0 - uTime * 0.025 + 4.0);
    float deepV = smoothstep(0.75, -0.9, gCutA);
    vec3 cur = refl * (0.56 + 1.5 * ray * ray * ray) * (0.7 + 0.9 * ray2) * mix(vec3(1.0), vec3(0.76, 0.86, 1.42), deepV * 0.8) * 1.62;
    refl = mix(refl, cur, sheetK * uNight);
  }
  // (On the running river that light is broken along the current: brighter on the ripple faces, dimmer in their troughs.)
  refl *= 1.0 + (0.5 * (df.r - 0.5) + 0.3 * (dw2.r - 0.5)) * uNight * streamK;
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
      fres = max(fres, 0.3 * scS.a);
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
  // (The far side of each letter gives back the most of what stands over the lake; the near side is depth.)
  float farL = smoothstep(-1.15, 1.0, gCutA);
  fres = mix(fres, mix(0.04, 0.33, farL * farL * farL * farL * sqrt(farL)), gDeep);
  if (sheetK > 0.0) {
    // Cat's-paws: where a breath of air roughens the water it gives back more sky, in long thin dashes that drift.
    float paw = textureLod(uDetail, pw / vec2(330.0, 130.0) + vec2(0.006, 0.002) * uTime, lodFor(footL, 130.0, 512.0)).r;
    float pawK = smoothstep(0.6, 0.72, paw) * (1.0 - smoothstep(0.74, 0.86, paw));
    fres += pawK * mix(0.08 + 0.12 * farL, -0.22, uNight) * sheetK;
  }
  vec3 col = mix(water, refl, fres);
  if (sheetK > 0.0 && gFarK > 0.0) col = cutFoot(col, pw, dir, slope, foot, sheetK);
  // The sun on ripple faces turned toward it: a broad, graded sheen.
  float sd = max(dot(rf, S.sun), 0.0);
  col += S.band * (pow(sd, 240.0) * 1.6 + pow(sd, 40.0) * 0.12) * (1.0 - shade) * (1.0 - uNight) * (1.0 - gDeep);
#ifdef SEA
  // Near the sea the light is low and ahead: the channels catch it, a path
  // of glints on the ripple faces under the sun's bearing.
  if (uSea.x > 0.0 && S.sun.z > 0.0) {
    float daS = atan(dir.x, dir.y) - atan(S.sun.x, S.sun.y);
    float pathS = exp(-daS * daS / 0.1);
    if (pathS > 0.01) {
      // Every ripple face turned to the sun throws it back whole: the braids blaze where they cross its bearing,
      // in broad flashing faces with a fine sparkle over them that comes and goes.
      float face = smoothstep(0.5, 0.78, mix(dw2.r, df.r, 0.45));
      face = mix(face, 0.34, smoothstep(2.0, 9.0, footL));
      float spark = smoothstep(0.7, 0.92, n2(pw / 9.0 + vec2(uTime * 1.1, -uTime * 0.8))) * (1.0 - smoothstep(1.2, 4.0, footL));
      col += S.band * pathS * (0.16 + 5.5 * face * face * face + 4.0 * spark * face) * (0.35 + 0.65 * fres) * uSea.x * (1.0 - shade) * mix(1.0, 0.45, uNight);
    }
  }
#endif
  // In the name the sun's path is broken glitter: single ripple faces
  // catching it, a column of them coming down the water from under the
  // sun toward the eye, close and fine at the far side, wider and sparser
  // near. (The sun stands at the frame's edge: its path is leaned in over
  // the first letters, as the mirror is.)
  if (gDeep > 0.0) {
    float lim = atan(uLens.x * uLens.y) * 0.56;
    float azC = clamp(atan(S.sun.x, S.sun.y), -lim, lim);
    float da = atan(dir.x, dir.y) - azC;
    float nearK = smoothstep(1.0, -1.0, gCutA);
    // (As wide a share of the frame through any lens.)
    float wide = mix(0.06, 0.11, nearK) * min(lim / 0.357, 1.0);
    float path = exp(-da * da / (wide * wide));
    if (path > 0.004) {
      // Two fine fields that drift against each other: a glint is where both stand high, so it comes and goes.
      float ga = textureLod(uGrain, pw / vec2(640.0, 2300.0) + vec2(0.004, -0.007) * uTime, 0.0).a;
      float gb2 = textureLod(uGrain, pw / vec2(1300.0, 2500.0) + vec2(0.37, 0.11) - vec2(0.011, 0.008) * uTime, 0.0).g;
      // (No two the same size, and each comes and goes.)
      float spark = (1.0 - smoothstep(0.02, 0.06 + 0.26 * gb2 * gb2, ga)) * smoothstep(0.44, 0.64, gb2);
      float face = smoothstep(0.66, 0.86, mix(dw2.r, df.r, 0.45));
      float glint = spark * 5.0 + face * face * 0.22;
      // (A glint finer than a pixel is its even mean.)
      glint = mix(glint, 0.12, smoothstep(2.0, 6.0, footL));
      // (It is the name's own: once the sheet is plates the sun's true path on the open lake takes over.)
      col += S.band * path * glint * mix(1.0, 0.7, nearK) * gDeep * sheetK * sheetK;
    }
  }
  // A few plates of ice lie afloat in the name's water, turning slowly:
  // angular, of different sizes, each with its own thin shade.
  if (sheetK > 0.0 && gIceF1 > 6.0 && footL < 12.0) {
    vec2 q = pw / vec2(150.0, 330.0);
    vec2 hq = hash2(floor(q) + 3.0);
    if (hq.x > 0.64) {
      vec2 bob = vec2(sin(uTime * 0.21 + hq.y * 40.0), cos(uTime * 0.17 + hq.x * 31.0)) * 6.0;
      vec2 ql = (fract(q) - 0.5 - (hq - 0.5) * 0.44) * vec2(150.0, 330.0) - bob;
      float ang = hq.y * 6.283 + uTime * 0.04 * (hq.x - 0.82) * 8.0;
      ql = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * ql;
      float sz = 5.0 + 11.0 * fract(hq.x * 37.0) * fract(hq.x * 37.0);
      // (Four straight sides at angles of its own: a broken piece, not a disc.)
      float c1 = fract(hq.y * 13.0), c2 = fract(hq.y * 29.0);
      float chip = max(max(abs(ql.x) * (0.8 + 0.5 * c1) + abs(ql.y) * 0.42, abs(ql.y) * (1.0 + 0.5 * c2)), max(ql.x * 0.9 - ql.y * (0.3 + 0.6 * c2), -ql.x * 0.7 + ql.y * (0.2 + 0.7 * c1))) - sz;
      float aC = (1.0 - smoothstep(-0.7 * foot, 0.7 * foot, chip)) * sheetK * smoothstep(6.0, 14.0, gIceF1);
      float litC = 0.82 + 0.3 * fract(hq.x * 91.0);
      vec3 plate = mix(vec3(0.86, 0.93, 0.97) * (S.amb * 1.3 + S.key * 0.25) * litC, vec3(0.42, 0.62, 0.66) * 0.34 * litC, uNight);
      // (Its edge is clear ice, bluer than its snowy top.)
      plate = mix(plate * mix(vec3(0.5, 0.8, 0.95), vec3(0.6, 0.95, 0.9), uNight), plate, smoothstep(0.0, 2.2 + foot, -chip));
      col *= 1.0 - 0.34 * (1.0 - smoothstep(0.0, 5.0, chip)) * sheetK * (1.0 - aC);
      col = mix(col, plate, aC);
    }
  }
  // The current, drawn: fine bright threads that run with the stream,
  // quicker and whiter in the narrows, and the odd small plate of ice
  // carried down. Both live in the stream's own frame (along it, across it).
  float fmag = length(flow);
  float inBasin = smoothstep(${(BASIN.y - 60).toFixed(1)}, ${(BASIN.y + 80).toFixed(1)}, pw.y) * (1.0 - smoothstep(${(BASIN.y + BASIN.h - 40).toFixed(1)}, ${(BASIN.y + BASIN.h + 120).toFixed(1)}, pw.y));
  float runK = smoothstep(0.25, 0.6, fmag) * (1.0 - inBasin) * (1.0 - lakeK) * (1.0 - shoalK) * smoothstep(3.0, 16.0, -bw.r);
  // (The tarn is still: nothing is drawn on it.)
  runK *= smoothstep(0.85, 1.2, length((pw - vec2(${TARN.x.toFixed(1)}, ${TARN.y.toFixed(1)})) / vec2(${TARN.rx.toFixed(1)}, ${TARN.ry.toFixed(1)})));
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
    // (Foam on a current is torn: each thread is there for a stretch, thins and is gone, and it rides the ripples, brighter on their faces.)
    float torn = textureLod(uDetail, vec2(across / 310.0 + 0.2, (along - run * 1.1) / 560.0), lodFor(footL, 310.0, 512.0)).r;
    thread *= smoothstep(0.42, 0.66, torn) * (0.45 + 0.9 * df.r);
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
      float sz = 4.0 + 15.0 * fract(hq.x * 37.0) * fract(hq.x * 37.0);
      // (Each is a broken piece with sides of its own.)
      float c1 = fract(hq.y * 13.0), c2 = fract(hq.y * 29.0);
      float chip = max(max(abs(ql.x) * (0.75 + 0.6 * c1) + abs(ql.y) * 0.4, abs(ql.y) * (0.9 + 0.7 * c2)), max(ql.x * 0.9 - ql.y * (0.25 + 0.7 * c2), -ql.x * 0.65 + ql.y * (0.2 + 0.8 * c1))) - sz;
      float mid = smoothstep(26.0, 60.0, -bw.r);
      float aC = (1.0 - smoothstep(-0.8 * foot - 0.4, 0.8 * foot + 0.4, chip)) * runK * mid * (1.0 - smoothstep(6.0, 16.0, footL));
      vec3 plate = mix(vec3(0.86, 0.92, 0.96) * (S.amb * 1.3 + S.key * 0.3), vec3(0.2, 0.26, 0.34) * 0.2 + uAurora * 0.05, uNight);
      col = mix(col * (1.0 - 0.35 * (1.0 - smoothstep(-0.5, 5.0, chip)) * runK * mid), plate, aC);
    }
  }
  // Where the river steps down into the basin it breaks: white water across
  // the stream, streaked the way it runs, and a boil below that thins out.
  if (pw.y > ${(STEP.y0 - 60).toFixed(1)} && pw.y < ${(STEP.y1 + 260).toFixed(1)} && footL < 60.0) {
    float lipS = smoothstep(${(STEP.y0 - 40).toFixed(1)}, ${(STEP.y0 + 70).toFixed(1)}, pw.y) * (1.0 - smoothstep(${(STEP.y1 - 20).toFixed(1)}, ${(STEP.y1 + 230).toFixed(1)}, pw.y));
    if (lipS > 0.0) {
      float runS = uTime * uFlowSpeed * 1.4;
      float streakS = textureLod(uDetail, vec2(pw.x / 46.0, (pw.y - runS) / 520.0), lodFor(footL, 46.0, 512.0)).r;
      float boilS = mix(df.r, dw2.r, 0.5);
      float whiteS = smoothstep(0.42, 0.7, streakS * 0.6 + boilS * 0.55 + 0.3 * lipS - 0.12) * lipS * smoothstep(8.0, 40.0, -bw.r) * (1.0 - smoothstep(20.0, 60.0, footL));
      vec3 foamS = mix(vec3(0.93, 0.97, 1.0) * (S.amb * 1.25 + S.key * 0.3), vec3(0.34, 0.5, 0.56) * 0.3 + uAurora * 0.15, uNight);
      col = mix(col, foamS, whiteS * 0.85);
    }
  }
  // The confluence: seven trails of paler meltwater along the cliff's foot, and a boil under each fall.
  if (pw.x > 700.0 && pw.x < 2500.0 && pw.y > ${(lipY(LIP.x0) - 900).toFixed(1)} && pw.y < ${(lipY(700) + 40).toFixed(1)}) col = confRiver(col, pw, footL, df.r, dw2.r, shade);
  // White water where the basin's waves strike the block and the shores round it.
  if (slabOn > 0.0) col = blockWater(col, pw, bw.r, df.r, dw2.r, abs(wv.r) * 30.0 + length(wv.ba) * 40.0);
  // The pool's own surface: the sky lies on its far side, and a shelf of ice stands out over it all round.
  float poolS = poolAt(pw);
  if (poolS > 0.0) {
    float farK = smoothstep(${(POOL.y + POOL.h * 0.45).toFixed(1)}, ${(POOL.y + POOL.h + 30).toFixed(1)}, pw.y);
    col = mix(col, refl, farK * farK * mix(0.34, 0.2, uNight) * poolS * (1.0 - 0.6 * picK));
    vec4 rim = poolRim(pw, -bw.r, footL, refl);
    // (The shelf's shade on the bed under it.)
    col *= 1.0 - 0.22 * (1.0 - smoothstep(20.0, 54.0, -bw.r)) * poolS * (1.0 - uNight);
    col = mix(col, rim.rgb, rim.a * poolS);
  }
  // The water's edge: under the bank's ice shelf a short soft shade, and
  // where the current runs against the bank a fine line of foam.
  float line = smoothstep(-3.0 - foot, 0.0, bw.r);
  col *= 1.0 - 0.16 * line * (1.0 - uNight);
  float edgeF = (1.0 - smoothstep(1.5 + foot, 5.0 + 2.0 * foot, -bw.r)) * (0.25 + 0.75 * smoothstep(0.2, 0.7, fmag)) * (0.55 + 0.45 * df.r) * (1.0 - smoothstep(14.0, 40.0, footL));
  vec3 edgeC = mix(vec3(0.9, 0.96, 1.0) * (S.amb * 1.2 + S.key * 0.24), vec3(0.3, 0.44, 0.5) * 0.3 + uAurora * 0.12, uNight);
  col = mix(col, edgeC, edgeF * mix(0.6, 0.3, uNight) * (1.0 - lakeK * smoothstep(0.0, 0.3, uGlow)));

  return col;
}

#ifdef SEA
/* ---------- the open sea: the ending's water ---------- */

// The sea is drawn at the scale of the eye that comes to rest over it: this many units to one of its heights.
const float SEA_S = 60.0;

/**
 * How much of the water at a place is open sea: north of the delta's head,
 * and well clear of every shore. (The channels are too narrow to be far
 * from a bank anywhere, so they stay the river's own water; along the coast
 * the shallows grade out into the deep.)
 */
float seaAt(vec2 pw, float sd) {
  return uSea.x * step(${(DELTA.y - 250).toFixed(1)}, pw.y) * smoothstep(70.0, 310.0, -sd);
}

/**
 * The sea toward the light (the old ending's water, in this world). Ripples
 * that close up with distance, the sky and the ranges mirrored in them, a
 * dark body under the eye, the sun's path as glitter, and on the side the
 * words stand a lee: calmer water, a little shaded, with no glitter in it.
 * t: how far along the ray the water is. footL: a pixel's length on it.
 */
/** The sea's swell: four octaves, or the two broad ones when the governor has asked for its leanest frame. */
float seaH(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= 2 && gL2 >= 1.0) break;
    s += a * n2(p) * (i >= 2 ? 1.0 - gL2 : 1.0);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}
/**
 * Drift ice: plates the river has carried out past the delta, fewer the
 * further the land falls behind, none where the camera comes to rest.
 * Returns how far a place is from the nearest plate's edge (under 0: on it).
 */
float floeAt(vec2 p) {
  float dens = 0.58 * smoothstep(${(T2 + 8700).toFixed(1)}, ${(T2 + 8950).toFixed(1)}, p.y) * (1.0 - smoothstep(${(T2 + 9650).toFixed(1)}, ${(T2 + 10220).toFixed(1)}, p.y));
  vec2 q = p / 210.0;
  vec2 c = floor(q);
  vec2 hq = hash2(c + 7.0);
  if (hq.y > dens) return 1e3;
  // (Each rides the swell a little, and turns very slowly.)
  vec2 l = (fract(q) - 0.5 - (hq - 0.5) * 0.3) * 210.0 - vec2(sin(uTime * 0.11 + hq.y * 40.0), cos(uTime * 0.09 + hq.x * 31.0)) * 8.0;
  float ang = hq.y * 17.0 + uTime * 0.02 * (hq.x - 0.5);
  l = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * l;
  float big = fract(hq.x * 37.0);
  float sz = 12.0 + 42.0 * big * big;
  return max(abs(l.x) + abs(l.y) * 0.5, max(abs(l.y) * 1.25, abs(l.x * 0.8 - l.y * 0.6))) - sz;
}
// The lee at this pixel: the shade it lays on the water is put on after the air.
float gLee = 0.0;
// How much of this pixel is open sea.
float gSea = 0.0;
vec3 seaColor(vec2 pw, vec3 dir, float t, float footL) {
  float e = uSea.y;
  // The lee has no edge and no corner: it is deepest under the words and thins away from them in every direction,
  // to nothing at the horizon, so it is never seen as a shape. (uSea.w below zero: how high the words stand, on a wide screen.)
  float topV = uSea.w < -0.001 ? -uSea.w : 0.42;
  float lee = (1.0 - smoothstep(0.0, 1.0, length(max((vUv - vec2(uSea.z - 0.06, topV - 0.04)) / vec2(0.3, max(0.6 - topV, 0.1)), 0.0)))) * e;
  float leeFoot = step(0.001, uSea.w) * (1.0 - smoothstep(uSea.w - 0.01, uSea.w + 0.13, vUv.y)) * e;
  // (On a narrow screen the words run the width of the frame and stand at its foot: the line of light comes down to them and stops.)
  float leeRay = uSea.w > 0.001 ? leeFoot : lee;
  lee = max(lee, leeFoot);
  vec2 q = pw / SEA_S;
  float dist = length(pw - uCamPos.xy) / SEA_S;
  // (A ripple finer than a pixel is let go before it can shimmer.)
  float px = footL / SEA_S;
  float fine = 1.0 - smoothstep(0.05, 0.16, px);
  float broad = 1.0 - smoothstep(0.16, 0.5, px);
  float calm = (1.0 / (1.0 + dist * 0.07)) * (1.0 - 0.55 * lee);
  float tt = uTime * 0.32;
  vec2 qa = q * 1.7 + vec2(tt, 0.3 * tt);
  float f0 = seaH(qa);
  vec2 g = vec2(f0 - seaH(qa + vec2(0.11, 0.0)), f0 - seaH(qa + vec2(0.0, 0.11))) * broad;
  // (A lean frame lets the finest ripples go.)
  fine *= 1.0 - gL2;
  if (fine > 0.0) {
    vec2 qb = q * 5.3 - vec2(0.2 * tt, tt);
    float f1 = n2(qb);
    g += 0.5 * fine * vec2(f1 - n2(qb + vec2(0.06, 0.0)), f1 - n2(qb + vec2(0.0, 0.06)));
  }
  g *= 1.25 * calm;
  // (A touch on the water is the simulation's: its rings cross the sea too.)
  vec2 suv = simUv(pw);
  if (suv.y > 0.0 && suv.y < 1.0 && suv.x > 0.0 && suv.x < 1.0) g -= textureLod(uWave, suv, 0.0).ba * 7.0 * smoothstep(0.0, 0.03, suv.y) * (1.0 - smoothstep(0.97, 1.0, suv.y));
  vec3 n = normalize(vec3(g, 1.0));
  vec3 r = reflect(dir, n);
  // (By day a sea is darker than the sky it meets: its waves turn the mirror up, past the pale air at the horizon to the blue above it.)
  r.z = abs(r.z) + 0.24 * (1.0 - gDusk) * (1.0 - uNight);
  r = normalize(r);
  float cosi = clamp(dot(-dir, n), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  vec3 refl = withRidges(skyColor(r, 0.0), r, 1.0);
  // Seen from above the water shows its depth; at a glancing angle, the sky.
  // (Before dawn the sea's own body is dark and without colour of its own: no green in it.)
  vec3 deep = mix(vec3(0.004, 0.026, 0.078), vec3(0.008, 0.012, 0.026), uNight);
  vec3 body = mix(deep * (0.5 + 0.5 * max(S.sun.z * 3.0, 0.3)), vec3(0.01, 0.07, 0.11) * (S.amb.b * 1.6 + 0.12), (1.0 - gDusk) * (1.0 - uNight));
  // (By day the sea is a rougher mirror than at the still ends of the day: more of its own deep colour shows.)
  float dayK = (1.0 - gDusk) * (1.0 - uNight);
  float mir = clamp(fres + 0.05, 0.0, 1.0) * (1.0 - 0.5 * dayK);
  vec3 col = mix(body, refl, mir);
  // Sun glitter: a broken streak toward the sun.
  float sd = max(dot(r, S.sun), 0.0);
  float s90 = pow(sd, 90.0);
  float s900 = pow(sd, 900.0);
  float up = smoothstep(-0.02, 0.012, S.sun.z);
  col += vec3(1.0, 0.86, 0.62) * (s900 * 14.0 + s90 * mix(0.42, 0.55, uNight)) * mix(0.8, 1.0, uNight) * (1.0 - lee) * up * mix(0.6, 1.0, gDusk);
  // By day the broad lobe is held back and the light is carried by a path
  // of separate glints: wide and sparse near the eye, narrowing to a thread
  // at the horizon.
  float da = atan(dir.x, dir.y) - atan(S.sun.x, S.sun.y);
  float nearK = 1.0 / (1.0 + dist * 0.03);
  float day = (1.0 - uNight) * up;
  if (day > 0.0) {
    float wide = mix(0.028, 0.11, nearK) * mix(1.5, 1.0, gDusk);
    float path = exp(-da * da / (wide * wide));
    if (path > 0.003) {
      vec2 gq = q * vec2(30.0, 15.0);
      float sp = 0.6 * n2(gq + vec2(tt * 2.0, -tt * 3.0)) + 0.4 * n2(gq * 2.6 - vec2(tt * 3.0, tt));
      float lo = mix(0.5, 0.68, nearK);
      // Each glint has a soft shoulder: a spark on a ripple, not a cut-out.
      float glint = smoothstep(lo - 0.16, lo + 0.26, sp);
      glint *= glint;
      // Far off a glint is finer than a pixel: there the path is its even mean.
      glint = mix(glint, 0.3, smoothstep(0.35, 1.1, px * 15.0));
      // The sun's reflected bloom is broken by the same facets, so it is not a patch.
      col = max(col - sunBloom(sd) * mir * 0.3 * (1.0 - glint) * day, 0.0);
      col += vec3(1.0, 0.88, 0.7) * path * glint * mix(0.6, 0.42, nearK) * day * (1.0 - lee) * mix(9.0, 1.0, gDusk);
    }
  }
  // The line of light: when the sun's edge clears the ranges, one clean
  // line runs from its foot across the water to the eye, along the way
  // the river came out, and holds.
  if (uRay.w > 0.0) {
    vec2 u = normalize(S.sun.xy);
    vec2 rel = pw - uRay.xy;
    float along = dot(rel, u);
    float across = dot(rel, vec2(u.y, -u.x));
    // (The river's own wander, easing out toward the sun.)
    // (Under the eye it runs true; further out it keeps a little of the river's wander.)
    float line = across - (11.0 * sin(along / 340.0 + 2.6) + 3.5 * sin(along / 127.0 + 0.4)) * exp(-max(along, 0.0) / 2400.0) * smoothstep(120.0, 1100.0, along) - g.x * 2.0;
    // It is a line, not a band: a few pixels wide under the eye, a hair at the horizon. (On a narrow screen a pixel is small: it is drawn wider there.)
    float wpx = max(t * uPxAng, 1e-3) * (uSea.w > 0.001 ? 2.1 : 1.0);
    float w = wpx * mix(1.25, 2.6, exp(-max(along, 0.0) / 520.0));
    // It runs in from the horizon: its head is where the eye's ray dips to. (It has come in before the pillar rises.)
    float dip = uCamPos.z / max(along, 1.0);
    float run = smoothstep(0.0, 0.66, uRay.z);
    float head = run * 0.62;
    float shown = (1.0 - smoothstep(head * 0.82, head, dip)) * step(1.0, along);
    float core = exp(-line * line / (w * w));
    float halo = exp(-line * line / (w * w * 40.0)) * 0.14 + exp(-abs(line) / (w * 14.0)) * 0.06;
    float tip = exp(-pow((dip - head * 0.9) / max(head * 0.12, 1e-3), 2.0)) * (1.0 - smoothstep(0.9, 1.0, run));
    vec3 rayC = mix(vec3(1.0, 0.9, 0.78), vec3(1.0, 0.8, 0.46), uNight);
    // (It stops short of the words: in their lee the water keeps no light.)
    // (It is light lying on water: the ripples it crosses carry it, brighter on the faces turned to it.)
    float carry = 0.62 + 0.38 * smoothstep(-0.25, 0.25, g.y * 3.0) ;
    col += rayC * (core * 2.3 * carry + halo * 1.6) * shown * uRay.w * (1.0 + 2.0 * tip) * (1.0 - leeRay) * (1.0 - leeRay);
  }
  // Drift ice on the way out: each plate a hand of ice above the water, snow on its top, a blue wall on the side
  // the eye sees, and the pale skirt of the ice under water round it.
  if (pw.y < ${(T2 + 10230).toFixed(1)} && footL < 26.0) {
    const float FH = 5.5;
    float base = floeAt(pw);
    float top = floeAt(pw - dir.xy / max(-dir.z, 0.02) * FH);
    float pxF = max(footL * 0.7, 0.25);
    float far = 1.0 - smoothstep(12.0, 26.0, footL);
    float aTop = (1.0 - smoothstep(-pxF, pxF, top)) * far;
    float aSide = (1.0 - aTop) * (1.0 - smoothstep(-pxF, pxF, base)) * far;
    vec3 Lf = keyDir();
    // (Before dawn its snow takes the sky's cold light more than the first warm light: it is ice, not earth.)
    vec3 lightF = mix(S.key * 0.26 * 0.9 + S.amb * 0.85, vec3(dot(S.key, vec3(0.3333))) * vec3(0.9, 1.0, 1.15) * 0.3 + S.amb * 2.4 + S.mid * 0.5, uNight);
    col = mix(col, mix(vec3(0.16, 0.56, 0.6), vec3(0.03, 0.09, 0.1), uNight) * (S.amb * 1.5 + S.key * 0.12), (1.0 - smoothstep(0.0, 15.0, base)) * 0.55 * far);
    col = mix(col, mix(vec3(0.3, 0.62, 0.74), vec3(0.1, 0.22, 0.28), uNight) * (S.amb * 1.4 + S.key * 0.1), aSide);
    // (Its top is wind-packed snow; its edge has been rounded and glazed by the swell.)
    float rim = 1.0 - smoothstep(0.0, 4.0, -top);
    // (Against the low light its thin edge glows: the light comes through it.)
    col = mix(col, mix(vec3(0.93, 0.94, 0.96), vec3(0.62, 0.72, 0.86), uNight) * (lightF + S.hor * 0.22 * uNight) * (1.0 - 0.22 * rim) + S.band * 0.16 * rim * gDusk, aTop);
    lee *= 1.0 - max(aTop, aSide);
  }
  gLee = lee;
  return col;
}
#endif

${STATION_COMMON}
${COLUMNS}
${DAM_ICE}
${DAM_WATER}
${LATTICE_ICE}
${CANYON_ICE}
// ---- the tarn's two shards of ice, each lit from within
const vec4 SH0 = vec4(${SHARDS[0].x.toFixed(1)}, ${SHARDS[0].y.toFixed(1)}, ${SHARDS[0].h.toFixed(1)}, ${SHARDS[0].r.toFixed(1)});
const vec4 SH1 = vec4(${SHARDS[1].x.toFixed(1)}, ${SHARDS[1].y.toFixed(1)}, ${SHARDS[1].h.toFixed(1)}, ${SHARDS[1].r.toFixed(1)});
// The pulse crosses in three seconds, rests half a second, and comes back.
// x: where it is between the two, 0..1; y, z: how freshly one has landed at each; w: 1 while it is on the water.
vec4 pulseAt() {
  float c = mod(uTime, 7.0);
  float k = c < 3.5 ? clamp(c / 3.0, 0.0, 1.0) : 1.0 - clamp((c - 3.5) / 3.0, 0.0, 1.0);
  float on = c < 3.5 ? step(c, 3.0) : step(c, 6.5);
  return vec4(k, exp(-mod(c + 0.5, 7.0) * 1.1), c >= 3.0 ? exp(-(c - 3.0) * 1.1) : 0.0, on);
}
/**
 * What the pulse does to the tarn at a place. It skims the water and touches
 * it five times on the way across; each touch leaves a ring that widens and
 * fades behind it, and where it lands one more ring leaves the shard's foot.
 * Returns xy: the slope the rings give the water, z: their light and shade (-1..1).
 */
vec3 pulseRings(vec2 pw) {
  float c = mod(uTime, 7.0);
  bool back = c >= 3.5;
  float tc = back ? c - 3.5 : c;
  vec2 A = back ? SH1.xy : SH0.xy;
  vec2 B = back ? SH0.xy : SH1.xy;
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 6; j++) {
    // (The sixth is the landing, at the far shard's foot.)
    float f = j < 5 ? (float(j) + 0.6) / 5.4 : 1.0;
    float age = tc - 3.0 * f;
    if (age <= 0.0) continue;
    vec2 d = pw - mix(A, B, f);
    float dist = length(d);
    float rad = (j < 5 ? 10.0 : 60.0) + 58.0 * age;
    float wid = 9.0 + 5.0 * age;
    float x = (dist - rad) / wid;
    if (abs(x) > 3.2) continue;
    float amp = exp(-age * (j < 5 ? 0.85 : 0.6)) * (j < 5 ? 1.0 : 1.5);
    // A crest with a trough either side of it.
    float prof = exp(-x * x) * (1.0 - 1.4 * x * x * 0.5);
    float dprof = -x * exp(-x * x) * (3.4 - 1.4 * x * x);
    acc.xy += d / max(dist, 1.0) * dprof / wid * amp;
    acc.z += prof * amp;
  }
  return acc;
}
// A shard is five leaning faces that meet near a point: a convex solid, cut by planes.
// How far behind the face the ray meets, along the ray, the next face would have been met: small at an arris.
float gShardEdge = 1e3;
float shardHit(vec3 ro, vec3 rd, vec4 s, float turn, out vec3 n, out float tF) {
  float tN = 0.0;
  float tN2 = -1e3;
  tF = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  vec3 o = ro - vec3(s.xy, -FREEBOARD - 6.0);
  for (int k = 0; k < 6; k++) {
    vec3 pn = vec3(0.0, 0.0, -1.0);
    float d = 30.0;
    if (k < 5) {
      float fk = float(k);
      float a = turn + fk * 1.2566 + 0.34 * sin(fk * 2.7 + turn * 5.0);
      float rr = s.w * (0.78 + 0.5 * fract(sin(fk * 12.9 + turn * 7.0) * 43.7));
      float hk = s.z * (0.72 + 0.28 * fract(sin(fk * 5.3 + turn * 3.0) * 91.3));
      float len = sqrt(hk * hk + rr * rr);
      pn = vec3(cos(a) * hk, sin(a) * hk, rr) / len;
      d = rr * hk / len;
    }
    float den = dot(rd, pn);
    float num = d - dot(o, pn);
    if (den < -1e-5) { float t = num / den; if (t > tN) { tN2 = tN; tN = t; n = pn; } else if (t > tN2) tN2 = t; }
    else if (den > 1e-5) tF = min(tF, num / den);
    else if (num < 0.0) return -1.0;
  }
  gShardEdge = tN - tN2;
  return tN < tF && tN > 0.0 ? tN : -1.0;
}
/**
 * A shard's ice: the block's own. Pale and white where it is thin (its
 * edges, its point), deep blue through its thick foot; a frosted, fluted
 * skin on some faces and clear ice on others, with the veils and fractures
 * inside. Its light is in the ice, not on it: a white-hot thread up the
 * heart, a blue glow in the ice round it that the veils and every fracture
 * catch, and the frosted faces glowing through.
 */
vec3 shardColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, vec4 s, float glow) {
  vec3 L = keyDir();
  float thick = max(tF - t, 0.0);
  vec3 hp = ro + rd * t - vec3(s.xy, -FREEBOARD);
  // The face's own plane: across it, and up it.
  vec3 tu = normalize(vec3(-n.y, n.x, 0.0));
  vec3 tv = cross(n, tu);
  vec2 q = vec2(dot(hp, tu), dot(hp, tv));
  vec3 ri = refract(rd, n, 0.763);
  vec2 across = vec2(dot(ri, tu), dot(ri, tv)) / max(-dot(ri, n), 0.25);
  float foot = t * uPxAng;
  float faceId = fract(n.x * 7.31 + n.y * 3.17);
  float edgeK = 1.0 - smoothstep(0.5 + foot, 4.0 + 3.0 * foot, gShardEdge);
  // (A shard is a smaller piece than the block: what is in it is finer.)
  vec3 in_ = iceInside(q * 1.8, across, thick * 1.8, foot * 1.8, 3.0 + faceId * 5.0);
  float deepK = 1.0 - exp(-thick / (s.w * 0.9));
  vec3 body = mix(vec3(0.42, 0.7, 0.84), vec3(0.02, 0.12, 0.27), deepK);
  float thru = 0.55 + 0.45 * max(dot(n, L), 0.0) + 0.5 * max(dot(-n, L), 0.0);
  vec3 light = mix(S.key * 0.2 * thru + S.amb * 0.92, S.amb * 1.3 + uAurora * 0.06, uNight);
  vec3 airC = mix(vec3(0.82, 0.91, 0.96), vec3(0.42, 0.62, 0.7), uNight);
  vec3 col = mix(body, airC, in_.x * 0.34) * light;
  col += mix(vec3(0.85, 0.95, 1.0) * (S.key * 0.2 + S.amb * 0.5), uAurora * 0.5 + vec3(0.02, 0.04, 0.05), uNight) * in_.y * 0.8;
  // The skin: frosted and fluted on some faces, nearly clear on others.
  vec4 gr = textureLod(uGrain, q / vec2(380.0, 4200.0) + faceId, lodFor(foot, 380.0, 256.0));
  vec4 gr2 = textureLod(uGrain, q / vec2(110.0, 2100.0) + faceId * 3.0, lodFor(foot, 110.0, 256.0));
  float frost = clamp(0.06 + 1.5 * (gr.g - 0.46) + 0.6 * (faceId - 0.5), 0.0, 1.0) * 0.5 * (1.0 - gSlabSoft * 0.4);
  vec3 nF = normalize(n + tu * (gr2.g - 0.5) * 0.45);
  vec3 skin = mix(vec3(0.84, 0.9, 0.95), vec3(0.4, 0.52, 0.62), uNight) * (S.key * mix(0.3, 0.12, uNight) * (0.25 + 0.75 * max(dot(nF, L), 0.0)) + S.amb * mix(0.8, 1.6, uNight) + uAurora * 0.06);
  col = mix(col, skin * (0.88 + 0.24 * gr2.g), frost);
  // The light inside. The ray's nearest approach to the heart's line says how much of the glow it crosses.
  vec3 mp = ro + rd * (t + tF) * 0.5 - vec3(s.xy, -FREEBOARD);
  float up = clamp(mp.z / s.z, 0.0, 1.0);
  float rise = smoothstep(-0.04, 0.1, mp.z / s.z) * (1.0 - smoothstep(0.42, 0.82, up));
  float axis = length(mp.xy) / s.w;
  // (The thread is not even: brighter beads climb it slowly.)
  float thread = exp(-axis * axis / 0.007) * rise * (0.4 + 0.6 * smoothstep(0.3, 0.7, n1(mp.z / 13.0 - uTime * 0.35 + s.x)));
  float halo = exp(-axis / 0.34) * rise;
  float lamp = glow * mix(0.9, 1.0, uNight);
  vec3 hot = vec3(0.9, 1.0, 1.0) * thread * 2.6 + vec3(0.2, 0.72, 0.95) * halo * (0.3 + 1.7 * in_.x + 2.4 * in_.y) * mix(1.5, 0.9, uNight);
  // (Frost hides the thread and keeps the glow; clear ice shows both.)
  col += hot * lamp * (1.0 - 0.75 * frost) + vec3(0.2, 0.7, 0.92) * halo * frost * lamp * 0.55;
  // The sky on it, and the sun on a face turned its way.
  float cosi = max(dot(-rd, n), 0.0);
  float fr = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
  vec3 rf = reflect(rd, nF);
  rf.z = abs(rf.z);
  col = mix(col, skyColor(rf, 0.0), fr * 0.45);
  col += S.band * pow(max(dot(rf, S.sun), 0.0), 40.0) * 0.5 * (1.0 - uNight) * (1.0 - gSlabSoft);
  // Every arris is worn bright, and single crystals in the skin catch the light as the eye moves.
  col += mix(vec3(0.8, 0.92, 1.0) * (S.key * 0.2 + S.amb * 0.75), uAurora * 0.45 + vec3(0.03, 0.06, 0.08), uNight) * edgeK * (0.55 + 0.45 * gr2.g);
  float glint = smoothstep(0.975, 1.0, textureLod(uGrain, q / 46.0 + faceId, 0.0).r) * smoothstep(0.35, 0.8, fract(gr2.a * 7.0 + dot(rd.xy, vec2(3.1, 2.3)) * 6.0)) * (1.0 - smoothstep(0.4, 1.2, foot)) * (1.0 - gSlabSoft);
  col += mix(S.key * 0.5 + S.amb * 0.4, uAurora * 0.8, uNight) * glint;
  // The waterline: a dark wet band, a bright lip over it.
  float wl = hp.z;
  col = mix(col, col * vec3(0.3, 0.48, 0.6), (1.0 - smoothstep(4.0, 11.0, wl)) * 0.7);
  col += mix(vec3(0.82, 0.93, 1.0) * S.amb * 0.8, uAurora * 0.25, uNight) * (1.0 - smoothstep(0.0, 2.2, abs(wl - 12.0))) * 0.6;
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
    // Four rays to a pixel find how much of it the block covers (its edges
    // are geometry, so they are smoothed by counting). The ice itself is
    // worked out once for each face the pixel sees: one, or two at an arris.
    vec2 uvA = vec2(0.0);
    vec2 uvB = vec2(0.0);
    vec3 rdA = dir;
    vec3 rdB = dir;
    vec4 hA = vec4(0.0); // face, distance, thickness, how many rays
    vec4 hB = vec4(0.0);
    for (int i = 0; i < 4; i++) {
      vec2 j = vec2(i == 0 || i == 3 ? 0.125 : -0.125, i < 2 ? 0.375 : -0.375);
      if (i == 1 || i == 3) j = j.yx;
      vec3 rd = normalize(dir + (uCamR * j.x + uCamU * j.y) * uPxAng);
      vec2 suv;
      float face;
      float t = slabHit(uCamPos, rd, suv, face);
      if (t > 0.0) {
        slabT = min(slabT, t);
        if (hA.w < 0.5 || face == hA.x) {
          if (hA.w < 0.5) { uvA = suv; rdA = rd; hA.xyz = vec3(face, t, gSlabThick); }
          hA.w += 1.0;
        } else {
          if (hB.w < 0.5) { uvB = suv; rdB = rd; hB.xyz = vec3(face, t, gSlabThick); }
          hB.w += 1.0;
        }
      }
    }
    if (hA.w > 0.5) {
      gSlabThick = hA.z;
      vec4 sc = slabColor(uvA, hA.x, hA.y, rdA);
      slabCov += 0.25 * hA.w * sc.a;
      slabCol += sc.rgb * 0.25 * hA.w * sc.a;
    }
    if (hB.w > 0.5) {
      gSlabThick = hB.z;
      vec4 sc = slabColor(uvB, hB.x, hB.y, rdB);
      slabCov += 0.25 * hB.w * sc.a;
      slabCol += sc.rgb * 0.25 * hB.w * sc.a;
    }
    // Its foot is below the land: where the island's top lies between the eye and the block, the island hides it.
    if (slabCov > 0.0 && uCamPos.z + rdA.z * hA.y < 0.0 && rdA.z < -1e-4) {
      float t0 = uCamPos.z / -rdA.z;
      float sdI = bedAt(uCamPos.xy + rdA.xy * t0).r;
      float aaI = 0.75 * t0 * uPxAng / max(-rdA.z, 0.05);
      slabCov *= 1.0 - smoothstep(-aaI, aaI, sdI);
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
    // (At the confluence the snowfield stands above the land: there the ground under the ray is higher.)
    float t = (uCamPos.z - confLift(dir)) / -dir.z;
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
      vec2 ro = (p - vec2(${ISLAND.x.toFixed(1)}, ${(ISLAND.y - 60).toFixed(1)})) / vec2(${(ISLAND.rx * 1.42).toFixed(1)}, ${(ISLAND.ry * 2.1).toFixed(1)});
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
      // (While the name stands the wall's image in the water is looked for too, a little further out.)
      float reach = length(tilt) * uIceH * (1.5 + 1.9 * smoothstep(0.75, 1.0, uGlow)) + 2.0 * aaI + 6.0;
      if (aIce < 1.0 && f0 < reach) {
        vec3 c1;
        vec2 i1;
        vec2 pf = p + tilt * uIceH;
        float f1 = iceF(pf, bedAt(pf).r, c1, i1);
        gIceF1 = f1;
        // (The field falls at the rate of 1 toward the wall the eye faces, and rises at it away from the edge behind.)
        gFarK = clamp((f0 - f1) / max(length(tilt) * uIceH, 1.0), 0.0, 1.0);
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
    // The island is ice-bound: a shelf of old blue ice stands round its shore, glazed, and before dawn it holds
    // the sky's light and the block's, so the island is never a dark shape on bright water.
    if (aLand > 0.0 && gRock > 0.0) {
      float shelf = (1.0 - smoothstep(16.0, 62.0, sd0 + 14.0 * (textureLod(uGrain, p / 900.0, 0.0).g - 0.5))) * smoothstep(0.0, 0.1, gRock);
      vec3 iceI = mix(vec3(0.5, 0.74, 0.86), vec3(0.2, 0.42, 0.52), uNight) * (0.86 + 0.28 * textureLod(uGrain, p / 300.0, lodFor(foot, 300.0, 256.0)).g);
      vec3 litI = iceI * mix(S.key * 0.2 * slabShade + S.amb * 0.9, S.amb * 2.6 + uAurora * 0.34 + slabLight * 3.0, uNight);
      col = mix(col, litI * aLand, shelf * 0.8);
      col += (S.amb * 0.45 + uAurora * 0.1) * uNight * (1.0 - shelf) * aLand * smoothstep(0.0, 0.1, gRock);
    }
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
        // The basin's walls are the glacier's own ice under a cornice of snow: fluted where melt runs down them,
        // blue and deeper toward the water, with a seam or two of the dark moraine frozen into them.
        if (gWalled > 0.0) {
          float alongW = dot(p, vec2(bw.a, -bw.b));
          float flute = textureLod(uGrain, vec2(alongW / 560.0, f * 0.07 + 0.3), 0.0).g;
          float flute2 = textureLod(uGrain, vec2(alongW / 150.0 + 0.4, f * 0.05 + 0.7), 0.0).g;
          float seam = textureLod(uGrain, vec2(alongW / 3000.0 + 0.2, f * 0.5), 0.0).g;
          vec3 iceW = mix(vec3(0.6, 0.81, 0.92), vec3(0.1, 0.36, 0.56), smoothstep(0.12, 1.0, f)) * (0.66 + 0.5 * flute + 0.24 * flute2);
          iceW = mix(iceW, vec3(0.085, 0.095, 0.11) * (0.7 + 0.6 * flute2), smoothstep(0.6, 0.68, seam) * smoothstep(0.22, 0.4, f) * 0.75);
          iceW = mix(iceW, iceW * vec3(0.6, 0.8, 0.95) + uAurora * 0.05, uNight * 0.6);
          wall = mix(wall, iceW, gWalled * smoothstep(0.07, 0.16, f + (gw.g - 0.5) * 0.1));
        }
        wall *= lightOn(nW, 1.0);
        wall *= mix(1.0, 0.7, f * f);
        // (Before dawn a bank's face is ice under the aurora, not a black rim.)
        wall += (vec3(0.03, 0.05, 0.07) + uAurora * 0.06) * uNight * (1.0 - 0.6 * gWalled);

        cut += wall * aWall;
      }
      if (aWall < 1.0) {
#ifdef SEA
        // Past the delta's front the water is the open sea.
        float seaK = seaAt(pw, bw.r);
        vec3 wc = vec3(0.0);
        if (seaK < 1.0) wc = waterColor(pw, bw, dir, foot, footL, iceShade, slabOn) + slabLight * 0.26;
        if (seaK > 0.0) {
          wc = mix(wc, seaColor(pw, dir, (uCamPos.z + gFree) / -dir.z, footL), seaK);
          gLee *= seaK * (1.0 - aWall) * (1.0 - aLand);
          gSea = seaK * (1.0 - aWall) * (1.0 - aLand);
        }
        cut += wc * (1.0 - aWall);
#else
        cut += (waterColor(pw, bw, dir, foot, footL, iceShade, slabOn) + slabLight * 0.26) * (1.0 - aWall);
#endif
      }
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
    float clearK = gDeep * (1.0 - aLand) * (1.0 - aIce) * (1.0 - aCut) * (1.0 - smoothstep(4200.0, 7000.0, t));
#ifdef SEA
    // (Over the open sea at the end of the day the air is clearer: the water keeps its depth out to the mist on the horizon.)
    col = mix(col, air, fog * (1.0 - clearK) * (1.0 - gSea * mix(0.4, 0.55, gDusk)));
#else
    col = mix(col, air, fog * (1.0 - clearK));
#endif
    // The horizon is soft: the same mist that lies at the ranges' foot.
    col = mix(col, air, exp(dir.z / 0.006) * 0.75);
    // The cliff at the confluence and its falls stand in front of what lies behind them.
    col = confCliff(col, dir, aLand);
#ifdef SEA
    // The lee's shade, on the water the words stand over.
    col *= 1.0 - 0.56 * gLee;
#endif
  }
  if (uShardOn > 0.5) {
    vec4 pl = pulseAt();
    vec3 L = keyDir();
    // Where this pixel's ray meets the water, if it does.
    float tw = dir.z < -0.0006 ? (uCamPos.z + FREEBOARD) / -dir.z : -1.0;
    vec3 pwp = uCamPos + dir * max(tw, 0.0);
    vec2 te = (pwp.xy - vec2(${TARN.x.toFixed(1)}, ${TARN.y.toFixed(1)})) / vec2(${TARN.rx.toFixed(1)}, ${TARN.ry.toFixed(1)});
    float onTarn = tw > 0.0 ? 1.0 - smoothstep(0.86, 1.0, length(te)) : 0.0;
    // Before dawn the tarn is dark: deep, still water that gives back only a little of the sky, so its two lights carry.
    // (Toward the horizon it eases back into the night's own water: the far shore is not a ruled line.)
    if (tw > 0.0 && uNight > 0.0) col *= 1.0 - 0.76 * uNight * max(1.0 - smoothstep(1.15, 1.6, length(te)), smoothstep(${TARN.y.toFixed(1)}, ${(TARN.y + 350).toFixed(1)}, pwp.y)) * (1.0 - smoothstep(1400.0, 3600.0, tw));
    vec3 rings = vec3(0.0);
    if (onTarn > 0.0) {
      rings = pulseRings(pwp.xy) * onTarn;
      // Each shard's shade lies long across the water, away from the low sun.
      if (uNight < 1.0 && L.z > 0.02) {
        vec3 nS;
        float tS;
        float shd = 0.0;
        for (int i = 0; i < 2; i++) {
          vec4 s = i == 0 ? SH0 : SH1;
          float tn = i == 0 ? ${SHARDS[0].turn.toFixed(2)} : ${SHARDS[1].turn.toFixed(2)};
          // (Two rays a little apart: its edge is soft, and softer the further it lies.)
          for (int e = 0; e < 2; e++) {
            vec3 l2 = normalize(L + vec3(-L.y, L.x, 0.0) * (e == 0 ? -0.035 : 0.035));
            float th = shardHit(pwp, l2, s, tn, nS, tS);
            if (th > 0.0) shd = max(shd, shd + 0.5 * (1.0 - smoothstep(0.0, 1100.0, th)));
          }
        }
        col *= 1.0 - 0.34 * shd * (1.0 - uNight) * onTarn;
      }
      // The rings: light on the faces turned to the sky, shade behind them.
      vec3 pc = mix(vec3(0.62, 0.86, 0.95), vec3(0.45, 1.0, 0.92), uNight);
      col += pc * max(rings.z, 0.0) * mix(0.34, 0.3, uNight);
      col *= 1.0 + min(rings.z, 0.0) * 0.3;
      // The pulse itself: a bead of light skimming the water, its tail behind it.
      vec2 A = SH0.xy;
      vec2 B = SH1.xy;
      vec2 ab = normalize(B - A);
      vec2 pp = mix(A, B, pl.x);
      vec2 rel = pwp.xy - pp;
      bool back = mod(uTime, 7.0) >= 3.5;
      float along = dot(rel, ab) * (back ? 1.0 : -1.0);
      float side = dot(rel, vec2(-ab.y, ab.x));
      float bead = exp(-dot(rel, rel) / 150.0) * 3.2 + exp(-dot(rel, rel) / 1900.0) * 0.5;
      float tail = along > 0.0 ? exp(-along / 150.0) * exp(-side * side / (30.0 + along * 0.9)) * 0.85 : 0.0;
      col += pc * (bead + tail) * pl.w * onTarn * mix(0.8, 1.0, uNight);
    }
    for (int i = 0; i < 2; i++) {
      vec4 s = i == 0 ? SH0 : SH1;
      float turn = i == 0 ? ${SHARDS[0].turn.toFixed(2)} : ${SHARDS[1].turn.toFixed(2)};
      // (It holds a steady light, and flares as a pulse lands in it.)
      float glow = 0.55 + 1.35 * (i == 0 ? pl.y : pl.z);
      vec3 n;
      float tF;
      float t = shardHit(uCamPos, dir, s, turn, n, tF);
      if (t > 0.0 && (tw < 0.0 || t < tw)) {
        col = shardColor(uCamPos, dir, t, tF, n, s, glow);
      } else if (onTarn > 0.0) {
        // Its mirror image in the still water: clean, until a ring crosses it.
        vec3 rd2 = reflect(dir, normalize(vec3(-rings.xy * 9.0, 1.0)));
        float t2 = shardHit(pwp, rd2, s, turn, n, tF);
        if (t2 > 0.0) {
          gSlabSoft = 1.0;
          vec3 mc = shardColor(pwp, rd2, t2, tF, n, s, glow);
          gSlabSoft = 0.0;
          float cosw = clamp(-dir.z, 0.0, 1.0);
          float mir = mix(0.9, 0.6, smoothstep(0.1, 0.6, cosw)) * (1.0 - smoothstep(0.0, s.z * 1.6, t2) * 0.35);
          col = mix(col, mc * 0.86, mir * onTarn);
        }
      }
      // The light it throws into the air round it.
      vec3 c = vec3(s.xy, s.z * 0.3 - FREEBOARD) - uCamPos;
      float alongC = dot(c, dir);
      if (alongC > 0.0) col += vec3(0.25, 0.7, 0.8) * glow * mix(0.05, 0.13, uNight) * exp(-length(c - dir * alongC) / (s.w * 1.9)) * mix(0.3, 1.0, uNight);
      // And on the water at its foot.
      if (onTarn > 0.0) {
        float df = length(pwp.xy - s.xy);
        col += vec3(0.2, 0.68, 0.82) * glow * exp(-df / (s.w * 2.2)) * mix(0.05, 0.2, uNight) * onTarn;
      }
    }
  }
  if (uSt.x + uSt.y + uSt.z + uSt.w > 0.0) {
    float twS = dir.z < -0.0006 ? (uCamPos.z + FREEBOARD) / -dir.z : -1.0;
    gSt = smoothstep(0.0, 0.3, uSt);
    if (uSt.x > 0.0) col = columns(col, dir, twS);
    if (uSt.y > 0.0) col = dam(col, dir, twS);
    if (uSt.z > 0.0) col = lattice(col, dir, twS);
    if (uSt.w > 0.0) col = canyon(col, dir, twS);
  }
  if (slabCov > 0.0 && slabCov <= 0.999) col = mix(col, slabCol, slabCov);

  // ---- the finish, in this same pass: the glow of the last frame's
  // highlights, a gentle vignette, the filmic curve, and a fine grain that
  // moves (it is also the dither).
  col = max(col, 0.0);
  // (Before dawn, while the name is cut in the sheet, the letters are light in a slot, not a lamp: they throw almost no halo over the ice.)
  if (uBloom > 0.0) col += textureLod(uGlowTex, vUv, 0.0).rgb * uBloom * (1.0 - 0.86 * uNight * smoothstep(0.75, 1.0, uGlow));
  vec2 vc = vUv - 0.5;
  col *= 1.0 - dot(vc, vc) * mix(0.42, 0.5, uSea.y);
  // The words' lee. Where words stand the picture keeps itself readable
  // behind them, softly: under dark words nothing is left darker than a
  // light haze, under light words nothing brighter than a deep shade. Only
  // the pixels that would fight the words are touched, and the edge of the
  // lee is wide and soft, so it reads as air and shade, never as a plate.
  // (Most of the frame is nowhere near them: it is let go at once.)
  // (The ending's words stand in the frame's own corner: their lee runs out to the frame's edges and thins only
  // upward and toward the light, a long way, so it has no side to be seen as a shape.)
  bool endLee = uCalmK.y > 0.5;
  if (uCalmK.x > 0.0 && (endLee ? vUv.y < uCalmBox.w + 0.34 && vUv.x < uCalmBox.z + 0.34 : vUv.y < uCalmBox.w + 0.17 && vUv.y > uCalmBox.y - 0.17 && vUv.x < uCalmBox.z + 0.17 && vUv.x > uCalmBox.x - 0.17)) {
    vec2 cq = abs(vUv - (uCalmBox.xy + uCalmBox.zw) * 0.5) - (uCalmBox.zw - uCalmBox.xy) * 0.5;
    if (endLee) cq = vUv - uCalmBox.zw;
    cq.x *= uLens.y;
    float cd = length(max(cq, 0.0)) + min(max(cq.x, cq.y), 0.0);
    float ck = 1.0 - smoothstep(-0.014, endLee ? 0.34 : 0.17, cd);
    ck *= ck * uCalmK.x;
    if (ck > 0.0) {
      float l = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
      float shadeK = mix(uNight, 1.0, uCalmK.y);
      const float CAP = 0.082;
      const float FLOOR = 0.165;
      float capped = 0.5 * (l + CAP - sqrt((l - CAP) * (l - CAP) + 0.09 * CAP * CAP));
      float lifted = 0.5 * (l + FLOOR + sqrt((l - FLOOR) * (l - FLOOR) + 0.09 * FLOOR * FLOOR));
      col *= mix(1.0, capped / l, ck * shadeK);
      col += (lifted - l) * vec3(0.95, 1.0, 1.07) * ck * (1.0 - shadeK);
    }
  }
  vec3 xa = col * 1.12;
  col = clamp((xa * (2.51 * xa + 0.03)) / (xa * (2.43 * xa + 0.59) + 0.14), 0.0, 1.0);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  float gn = hash21(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(317.0, 113.0)) - 0.5;
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col += gn * (1.6 / 255.0 + 0.022 * (1.0 - 0.6 * uSea.y) * (0.35 + 2.6 * lum * (1.0 - lum)));
  o = vec4(col, 1.0);
}`;
