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

import { CLEAR_ICE, ICE_FIELD } from './ice';
import { NAME_ICE } from './name';
import { BOX_HIT, DEEP_ICE_FEATURES, GLACIER_ICE, SEG_D, SHALLOWS, STATION_COMMON } from './stations';
import { PANO, SHADE_AZ, WIND } from './terrain';
import { customSubjects, subjects } from '../registry';
import { F_DEFINES } from '../variants';
import { BASIN, DELTA, ISLAND, LAKE, LIP, lipY, OUTLET, SHARDS, STREAM, T2, TARN, TARN_BAY, TRIBS } from '../world';

/** The water sits this far below the land, world units. */
export const FLIGHT_FREEBOARD = 22;

/** The way from the snow's first baked bearing to its second, over its own length squared: what a bearing between them is measured along. */
const shD = (() => {
  const d = [Math.sin(SHADE_AZ.b) - Math.sin(SHADE_AZ.a), Math.cos(SHADE_AZ.b) - Math.cos(SHADE_AZ.a)];
  const l = d[0] * d[0] + d[1] * d[1];
  return [d[0] / l, d[1] / l];
})();

/** Blend between the two baked snow horizons for this frame's light. */
export function snowShadowBearing(x: number, y: number) {
  const weight = (x - Math.sin(SHADE_AZ.a)) * shD[0] + (y - Math.cos(SHADE_AZ.a)) * shD[1];
  return Math.max(0, Math.min(1, weight));
}

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
 * The pass comes in variants. A subject's code slows every frame that
 * carries it, even where it never runs (the driver's cost follows the whole
 * shader's shape), so each stretch of the flight is drawn by a variant that
 * carries only the subjects that can be seen there. One source: a variant
 * is this text with a line of `#define` for each subject it keeps (see
 * variants.ts for the subjects, and for which a frame needs).
 * @param features the subjects to keep: bits of F
 * @param defines any further names to define (DAY or NIGHT: the theme, known when it is compiled; and the checks' own)
 */
export const flightSource = (features: number, defines: string[] = []) => {
  let src = FLIGHT_SRC.replace('//#DEFS', [...F_DEFINES.filter((_, i) => features & (1 << i)), ...defines.filter((d) => !d.includes('='))].map((n) => `#define ${n}`).join('\n'));
  // (The checks' own experiment, DBG_LIVE=n: n values worked out at the top of main and kept to its end, to weigh what a
  // value that must be held across the whole pass costs.)
  const live = defines.find((d) => d.startsWith('DBG_LIVE='));
  if (live) {
    const n = Number(live.split('=')[1]);
    const mk = (i: number) => `vec4(sin(vUv.x * ${i + 1}.0), cos(vUv.y * ${i + 2}.0), sin(vUv.x * ${i + 3}.0 + vUv.y), cos(vUv.x - vUv.y * ${i + 1}.0))`;
    src = src
      .replace('//#DBG_A', Array.from({ length: n }, (_, i) => `  vec4 dl${i} = ${mk(i)};`).join('\n'))
      .replace('//#DBG_B', `  col += (${Array.from({ length: n }, (_, i) => `dl${i}`).join(' + ')}).rgb * 1e-6;`);
  }
  return src;
};

const FLIGHT_SRC = `#version 300 es
//#DEFS
#if defined(F_COLS) || defined(F_DAM) || defined(F_LAT) || defined(F_CANYON)
#define F_STATION
#endif
#if defined(F_STATION) || defined(F_SLAB) || defined(F_CONF) || defined(F_POOL) || defined(F_SHARDS)${customSubjects.map(s => " || defined(" + s.define + ")").join("")}
#define F_GLACIER
#endif
// (The letters stand on the swept field, and the field lies on the sheet.)
#if defined(F_NAME) && !defined(F_FIELD)
#define F_FIELD
#endif
#if defined(F_FIELD) && !defined(F_ICE)
#define F_ICE
#endif
precision highp float;
in vec2 vUv;
in vec3 vRay;
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
${subjects.filter(s => s.event).map(s => `#ifdef ${s.define}
uniform float uProgress_${s.define};
#endif`).join('\n')}
uniform float uTime;
uniform float uFlowSpeed;
uniform float uQuality;    // 0 low, 1 mid, 2 high
uniform float uLean;       // 0..2: how many steps leaner the governor has asked the shading to be (fractions while a step fades)
// The theme. A variant compiled for the day alone (DAY) or for the hour before dawn alone (NIGHT) knows which it
// is, so the other's work is not in it at all; one compiled for neither is told each frame, and draws the turn
// from one theme to the other.
#if defined(DAY)
const float uNight = 0.0;
#elif defined(NIGHT)
const float uNight = 1.0;
#else
uniform float uNight;      // 0 morning, 1 the hour before dawn
#endif
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
uniform vec4 uShadow;   // key slope, snow horizon blend, sun azimuth, bank-shadow reach per unit height
uniform vec4 uBearings; // unit vectors in the ground plane, sun then key
// For the renderer's mask track (tools/flight): 1 writes what the frame shows in place of its colour (open water, solid ground, the words' lee).
uniform float uMaskOut;
float gMkW = 0.0;
float gMkG = 0.0;
float gMkFloe = 0.0;
// (What stands in front of the ground at this pixel: each object says so where its own ray test finds it.)
float gMkOcc = 0.0;
float mkChg(vec3 a, vec3 b) { return smoothstep(0.25, 0.7, length(a - b) / (max(max(a.r, a.g), a.b) + 0.05)); }
uniform vec4 uFilm;     // vignette strength, grain phase, grain amplitude, lunar haze gain
uniform vec4 uLee;      // centre and reciprocal radii of the words' lee
uniform vec3 uAmbCol;
uniform vec4 uMoon;        // the first screen's moon before dawn: xyz where it stands, w: how much of it there is (none by day, none once the eye has left the lake)
uniform vec4 uSkyK;        // x: haze, y: how much aurora is left, z: 0..1 how far the sky has come to the ending's, w: the light left in the water's own body
uniform vec3 uDistanceAir; // valley extinction slope, intercept, and strength of the blue-hour band
uniform vec4 uAir;         // the hour's air. x: mist lying low over the water, y: a veil of high cloud, z: how many of the stars are left, w: air extinction from the camera
uniform float uArrive;     // 0..1: how far the first screen's light has arrived (1 everywhere else)
uniform vec4 uHour;        // the hour's ground. x: how strongly a slope answers a low light (0: the morning's even snow), y: how much snow the wind is lifting, z: 0..1 the last light: only what stands high still has the sun, w: extinction in low mist
uniform vec4 uRange;       // how the ranges are lit. x: by the side the morning finds, y: from overhead, z: by the side the evening finds; w: 0..1 the first rose light on the highest peaks
uniform vec4 uSea;         // x: 1 when the open sea is near enough to be seen, y: 0..1 the camera has settled on the ending, z: u left of which the water is kept calm for the words, w: v under which it is (narrow screens), or 0
uniform vec4 uCalmBox;     // where the words now showing stand, in vUv: x0, y0, x1, y1
uniform vec2 uCalmK;       // x: 0..1 how much the picture is calmed for them, y: 1 when they are light in both themes (the ending)
uniform vec4 uCapBox;      // centre and inverse radii of the caption group in screen UV
uniform float uCapK;       // 0..1 how much the picture is calmed behind them
uniform vec4 uRay;         // the ribbon of light at the ending. x: 0..1 how far its line has run out across the water, y: 0..1 how far it has risen from it, z: its strength (0: not there), w: how far it leans as it climbs, and which way
uniform vec4 uRib;         // xy: the bearing its foot stands on (a unit vector on the ground), zw: the strip of the frame it can be in (u from, u to)

uniform sampler2D uBedA;
uniform sampler2D uBedB;
uniform sampler2D uWave;   // h, v, gx, gy
uniform sampler2D uVel;
uniform sampler2D uCurv;
uniform sampler2D uGrain;
uniform sampler2D uIceInclusions;
uniform sampler2D uHeat;
uniform sampler2D uSlabTex;
uniform sampler2D uSheetTex; // the picture on the pool's bed
uniform float uSheetOn;
uniform float uShardOn;    // 1 when the tarn's two shards are near enough to be seen
uniform sampler2D uPano;   // the ranges: sun, sky, snow, distance
uniform sampler2D uGround; // the baked snow: its slope, and its horizon toward each of two lights
uniform sampler2D uGlowTex; // the last frame's highlights, small and soft
uniform float uBloom;
uniform float uIceH;
// (What the melt does to the lake's water and to the glow is told to every variant: one that does not carry the sheet
// may draw the lake once the sheet has gone, or the valley while the lake is behind the eye.)
uniform float uGlow;       // 0..1: how much of the lake's sheet is still there to glow under
uniform float uMeltAct;
#ifdef F_ICE
uniform float uIceOn;      // 0 once the whole sheet has melted: the field is not asked at all
#else
// (A variant of the pass for where the lake's sheet has gone: what the engine would send, known when it is compiled.)
const float uIceOn = 0.0;
#endif

uniform vec3 uSlabPos;     // the middle of the slab's foot
uniform vec4 uSlabDir;     // xy: the way its face looks, zw: its right as the viewer sees it
uniform vec3 uSlabSize;    // width, height, thickness
uniform vec4 uSlabBox;     // where it can be on screen: x0, y0, x1, y1 in vUv
uniform vec4 uSlabTint;    // linear spill colour and display visibility through the air

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
// 0..1: this is the name's own water (or the ice at its edge) while the name is a melt pond, lying flush with the sheet.
float gPond = 0.0;
// 0..1: how near the name this place on the lake is.
float gNameK = 0.0;
// 0..1: this ice is the far lake's bare, mirroring ice, by day.
float gFarMir = 0.0;
float walledAt(float y) { return smoothstep(${STEP.y0.toFixed(1)}, ${STEP.y1.toFixed(1)}, y) * (1.0 - smoothstep(${STEP.out0.toFixed(1)}, ${STEP.out1.toFixed(1)}, y)); }

const float PANO_AZ = ${PANO.az.toFixed(4)};
const float PANO_EL = ${PANO.el.toFixed(4)};
// What the aurora lends to things under it: zero by day.
vec3 uAurora = vec3(0.0);
// White water before dawn: it is still the palest thing on the river, lit by the sky alone, cold and without the curtain's green.
vec3 gFoamN = vec3(0.0);
// The governor's two steps, each 0..1 as it fades in.
float gL1 = 0.0;
float gL2 = 0.0;
// 0..1: how far a mirror's aurora has eased from rays to a plain wash.
float gWash = 0.0;

vec2 bedUv(vec2 w) { return w / (uBedSize * uBedDiv); }
#ifndef F_ICE
#define NO_ICE_FIELD
#endif
${ICE_FIELD}
// FIELD is registered only for the lake with standing plates. The water
// on that sheet has neither a cut-letter pond nor its glitter and floes.
#ifdef F_FIELD
#define STANDING_NAME 1.0
#else
#define STANDING_NAME uNameG.w
#endif
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
  gFoamN = (mix(S.amb, vec3(dot(S.amb, vec3(0.3333))), 0.55) * 1.9 + S.key * 0.35) * vec3(0.82, 0.89, 0.96) + uAurora * 0.012;
}

/** The direction the ground is lit from: the sun, or before dawn a low light on its bearing. */
vec3 keyDir() { return uKeyDir; }

vec3 sunBloom(float sd) {
  // (Powers by squaring: 8, 64, 512, 2048.)
  float a = sd * sd; a *= a; a *= a;
  float b = a * a; b *= b; b *= b;
  float c = b * b; c *= c; c *= c;
  float e = c * c; e *= e;
  // (Under the light ending's deep blue the widest of it is held back: gold laid thinly over blue is lavender.)
  // (And at first light too: the morning's sky is deep blue almost down to the ranges.)
  return S.band * (a * 0.07 * (1.0 - gDusk * mix(0.7, 0.8, uNight)) + b * 0.22 + c * 0.5 + e * 0.5);
}

float airLoss(float t) {
  return 1.0 - exp(-max(t * uAir.w, t * uDistanceAir.x + uDistanceAir.y));
}

/** The colour of the air at the horizon toward a bearing: what distance fades to. */
vec3 airAt(vec2 dxy) {
  vec2 bearing = normalize(dxy + 1e-5);
  float a = max(dot(bearing, uBearings.xy), 0.0);
  // (Late in the day the air is gold only toward the sun: away from it distance fades to the sky's own blue, so
  // far snow and dark water are not laid over with the horizon's warmth.)
  vec3 hz = mix(S.hor, S.amb * 1.45 + S.hor * 0.12, uHour.x * (1.0 - a * a));
  vec3 c = hz + S.band * (pow(a, 5.0) * 0.3 + pow(a, 2.0) * 0.08) * mix(0.5, 1.0, max(uNight, gDusk));
  // (Before dawn the air is brightest under the moon, while it is up.)
  if (uNight > 0.0 && uMoon.w > 0.0) {
    float am = max(dot(bearing, uBearings.zw), 0.0);
    float am2 = am * am;
    c += S.key * (am2 * am2 * am2 * 0.42 + am2 * 0.1) * uFilm.w;
  }
  return c;
}

/** The hour's low mist: paler than the air it lies in, lit by whatever lights the ground, most toward that light. */
vec3 mistColor(vec2 dxy) {
  float a = max(dot(normalize(dxy + 1e-5), uBearings.zw), 0.0);
  return S.hor * 0.72 + S.amb * 0.12 + S.key * (0.085 + 0.07 * a * a * a);
}

/**
 * The aurora, before dawn: two broad curtains, one behind the other, low
 * over the ranges and in the middle of the sky. Each is a soft sheet of
 * light: a lower border a hand wide that wanders in slow folds, the light
 * brightest just over it and falling away a long way upward, green going to
 * a pale blue and, far up, to a breath of violet. Along its length it
 * hangs in broad drapes, brighter where a fold turns along the line of
 * sight and the sheet is seen edge on. Nothing in it is finer than a
 * drape: it has no rays and no threads, so it is the same picture in the
 * sky, in a mirror and in ice. It moves slowly.
 * Nothing in it can clip: its light is bounded below white.
 */
// A dull mirror (the ice) shows the aurora as the sky does: it has nothing fine to lose.
bool gDull = false;
// 0..1: how much of the sky's own detail this pixel sees (1 the sky itself, 0 a mirror's picture of it).
float gSkyQ = 1.0;
// The bearing of the ray the night sky is being asked about: worked out once, for the curtains and the stars.
float gAz = 0.0;
vec3 aurora(vec3 d) {
  float h = max(d.z, 0.0);
  if (h > 0.985) return vec3(0.0);
  float az = gAz;
  vec3 sum = vec3(0.0);
  // (A sheet of ice is a mirror only at a glance: it shows the low curtain alone.)
  for (int i = 0; i < (gDull ? 1 : 2); i++) {
    float k = float(i) * 0.5;
    float a = az * (1.0 - 0.2 * k) + k * 3.8;
    // Its border: a slow fold, and a ripple that runs along it.
    float p1 = a * (1.9 + 0.8 * k) + 0.6 + 2.3 * k + uTime * 0.028;
    float s1 = sin(p1);
    float hem = (0.048 + 0.27 * k) + (0.026 + 0.07 * k) * s1;
    // (A mirror's picture of it, in ice or in water, is its broad light alone: the ripple along its border and the
    // drift of its drapes are the sky's own, and are not worked out twice for a pixel.)
    bool whole = !gDull && gSkyQ > 0.0;
    if (whole) hem += 0.004 * (1.0 + k) * sin(a * 14.0 - uTime * 0.5 + 1.7 * k);
    float tall = 0.17 + 0.42 * k;
    float up = h - hem;
    if (up < -0.06) continue;
    // Where it hangs: in lengths, brighter and fainter, and it is never quite gone between them.
    float fold = n1(a * 3.1 + uTime * 0.02 + k * 14.0);
    float reach = i == 0 ? smoothstep(0.2, 0.62, fold + 0.25 * s1) : smoothstep(0.34, 0.74, fold - 0.22 * s1);
    // Its drapes: broad, leaning a little as they climb, drifting along it.
    float drape = 0.58 + 0.42 * sin(a * (11.0 - 3.0 * k) + 2.2 * s1 + up * 3.4 - uTime * 0.03 + 4.0 * k) * (whole ? 0.3 + 0.7 * n1(a * 2.3 + 7.0 * k + uTime * 0.01) : 0.62);
    // Edge on at a fold's turn, the light piles up.
    float pile = 1.0 + 0.55 * sqrt(max(1.0 - s1 * s1, 0.0));
    // (A soft border, widest under the faint lengths; then the long fall upward.)
    float prof = smoothstep(-0.05 + 0.02 * reach, 0.026, up) * exp(-max(up, 0.0) / (tall * (0.55 + 0.6 * reach)));
    float t = max(up, 0.0) / tall;
    vec3 tint = mix(vec3(0.2, 1.0, 0.36), vec3(0.16, 0.6, 0.8), smoothstep(0.15, 1.2, t));
    tint = mix(tint, vec3(0.5, 0.26, 0.7), 0.7 * smoothstep(0.9, 2.4, t));
    sum += tint * prof * drape * pile * (0.07 + 0.93 * reach) * (0.56 - 0.14 * k);
  }
  // Nothing of it toward the dawn.
  float dawn = max(dot(normalize(d.xy + 1e-5), uBearings.xy), 0.0);
  sum *= 1.0 - 0.85 * dawn * dawn * dawn * (1.0 - smoothstep(0.14, 0.4, h));
  // Its light is bounded: however the curtains overlap, it stays under white.
  float m = max(sum.g, max(sum.r, sum.b));
  return sum / sqrt(1.0 + 5.0 * m * m);
}

// Stars are drawn only where the sky is seen directly: a point in moving water is noise.
bool gDirect = false;
// 0 where a mirror shows the sun as broken glitter instead of a smooth glow (the water in the name).
float gSunK = 1.0;
// 0 where a mirror gives back the sun's glow but not its hard disc (the still sea at the ending: there is one sun).
float gDiscK = 1.0;
/** Stars: one to a cell of the sky, a pixel or two wide, lost in the haze low down. */
float stars(vec3 d) {
  vec2 g = vec2(atan(d.x, d.y), d.z) * 150.0;
  vec2 c = floor(g);
  float r = hash21(c);
  // (Most cells hold a star too faint to see: nothing more is worked out for them.)
  if (r < 0.84) return 0.0;
  vec2 at = c + 0.2 + 0.6 * vec2(hash21(c + 17.3), hash21(c + 41.7));
  float px = max(uPxAng * 150.0, 0.02);
  float dot_ = 1.0 - smoothstep(0.45 * px, 1.25 * px, length(g - at));
  return dot_ * pow(r, 34.0) * 5.0 * smoothstep(0.03, 0.2, d.z);
}
// The Milky Way's plane: it rises from behind the ranges on the left and leans away over the lake.
const vec3 MW_N = vec3(0.7850, 0.4283, 0.4471);
const vec3 MW_U = vec3(-0.4789, 0.8778, 0.0);
/**
 * The night sky's own light: a few bright stars of different colours, a
 * great many faint ones, and the Milky Way: a band of stars too fine to
 * tell apart, with dark lanes in it, where the faint stars crowd.
 */
vec3 starSky(vec3 d) {
  float low = smoothstep(0.012, 0.17, d.z);
  if (low <= 0.0) return vec3(0.0);
  float off = dot(d, MW_N);
  float band = exp(-off * off / 0.022);
  vec3 col = vec3(0.0);
  float cloud = 0.5;
  if (band > 0.02) {
    // (Laid out along the band and across it; one read gives its clouds and the dust lanes in front of them.)
    vec2 mu = vec2(dot(d, MW_U) * 0.9 + dot(d, cross(MW_N, MW_U)) * 0.35, off * 1.3);
    vec4 t = textureLod(uDetail, mu * 0.42 + vec2(0.2, 0.6), 1.0);
    cloud = t.r;
    // (Its dark lanes are dust in front of it: they lie along its middle.)
    float lane = smoothstep(0.5, 0.72, t.g + 0.3 * exp(-off * off / 0.004) - 0.08);
    col += vec3(0.5, 0.58, 0.78) * band * smoothstep(0.3, 0.75, cloud) * (1.0 - 0.75 * lane) * 0.032;
  }
  // (A star is never finer than the eye can find on a dense screen.)
  float px = max(uPxAng * 150.0, 0.14);
  // The bright ones: one to a cell, each with a colour of its own, and a slow twinkle.
  vec2 g = vec2(gAz, d.z) * 150.0;
  vec2 c = floor(g);
  float r = hash21(c);
  if (r > 0.93) {
    vec2 h2 = vec2(hash21(c + 17.3), hash21(c + 41.7));
    float dot_ = 1.0 - smoothstep(0.45 * px, 1.25 * px, length(g - c - 0.2 - 0.6 * h2));
    float mag = pow((r - 0.93) / 0.07, 4.0);
    float tw = 0.84 + 0.16 * sin(uTime * (1.3 + 2.4 * h2.x) + h2.y * 40.0);
    col += mix(vec3(1.0, 0.84, 0.66), vec3(0.74, 0.86, 1.0), smoothstep(0.2, 0.7, h2.x)) * dot_ * (0.035 + 3.2 * mag) * tw;
  }
  // The faint ones: finer cells, most of them empty, crowding toward the Milky Way.
  vec2 g2 = g * 2.7 + 31.0;
  vec2 c2 = floor(g2);
  float r2 = hash21(c2);
  float dens = 0.035 + 0.45 * band * smoothstep(0.25, 0.7, cloud);
  if (r2 < dens) {
    float px2 = px * 2.7;
    float dot2 = 1.0 - smoothstep(0.4 * px2, 1.1 * px2, length(g2 - c2 - 0.25 - 0.5 * vec2(hash21(c2 + 9.1), hash21(c2 + 23.7))));
    col += vec3(0.78, 0.86, 1.0) * dot2 * (0.025 + 0.22 * fract(r2 * 57.0) * fract(r2 * 57.0));
  }
  // (A star is a point of light, not a white pixel.)
  return min(col, vec3(0.62)) * low;
}

vec3 skyColor(vec3 d, float clouds) {
  float h = max(d.z, 0.0);
  // Where a station's words stand in the night sky, the sky is composed for them: the band they stand in holds
  // the one tone of its own upper edge, so the horizon's glow keeps lower, under the words, and the curtains
  // hang to either side and above. It is the sky's own fall of light, held level there and eased back to itself
  // over a wide margin: there is no shape to see.
  float calmS = 0.0;
  if (gDirect && uNight > 0.0 && uCalmK.x > 0.0 && uCalmK.y < 0.5) {
    vec2 cs = max(abs(vUv - (uCalmBox.xy + uCalmBox.zw) * 0.5) - (uCalmBox.zw - uCalmBox.xy) * 0.5, 0.0);
    calmS = (1.0 - smoothstep(0.0, 0.36, cs.x * uLens.y)) * (1.0 - smoothstep(0.0, 0.2, cs.y)) * uCalmK.x * uNight;
    if (calmS > 0.0) {
      vec3 dt = normalize(uCamF + uCamR * ((vUv.x * 2.0 - 1.0) * uLens.y * uLens.x) + uCamU * ((uCalmBox.w * 2.0 - 1.0) * uLens.x));
      h = mix(h, max(h, dt.z), calmS);
    }
  }
  // (Under the light ending's low sun the gold climbs further before it gives way to the blue: a long even fall, not a band.)
  vec3 col = mix(S.hor, S.mid, smoothstep(0.0, mix(0.24, mix(0.17, mix(0.165, 0.115, uNight), gDusk), max(uNight, gDusk)), h));
  col = mix(col, S.zen, smoothstep(0.07, 0.62, h));
  float az = max(dot(normalize(d.xy + 1e-5), uBearings.xy), 0.0);
  // Warmth pools on the sun's side of the horizon; it is not a stripe.
  // (And the warmth that pools toward the dawn is thinner in that band: it is one tone from end to end.)
  float warm = mix(0.45, 1.0, max(uNight, gDusk)) * (1.0 - 0.65 * calmS);
  col += S.band * exp(-h * 15.0) * pow(az, 5.0) * 0.5 * warm;
  col += S.band * exp(-h * 30.0) * pow(az, 2.0) * 0.14 * warm;
  float sd = max(dot(d, S.sun), 0.0);
  col += sunBloom(sd) * (1.0 - 0.5 * uNight * (1.0 - gDusk)) * gSunK * (1.0 - 0.65 * calmS);
#ifdef SEA
  // (At the ending the sun is a clean limb standing on the crest: a small hard disc, and the glow round it is the bloom's.)
  float disc = mix(smoothstep(0.9996, 0.99999, sd) * 2.4 + smoothstep(0.9999, 1.0, sd) * 1.6, smoothstep(0.999838, 0.999888, sd) * 5.0, gDusk);
  col += vec3(1.0, 0.9, 0.7) * disc * (1.0 - uNight * (1.0 - gDusk)) * gSunK * gDiscK * (1.0 - uAir.y);
#else
  col += vec3(1.0, 0.9, 0.7) * (smoothstep(0.9996, 0.99999, sd) * 2.4 + smoothstep(0.9999, 1.0, sd) * 1.6) * (1.0 - uNight * (1.0 - gDusk)) * gSunK * (1.0 - uAir.y);
#endif
  if (uNight > 0.0 && uMoon.w > 0.0) {
    // The first screen's moon: low behind the name, a small pale disc a little past full, with a thin cold glow round
    // it. It is what lights the plates before dawn.
    float md = max(dot(d, uMoon.xyz), 0.0);
    if (md > 0.99) {
      vec3 side = normalize(cross(uMoon.xyz, vec3(0.0, 0.0, 1.0)));
      float lit = smoothstep(-0.0035, -0.0015, dot(d - uMoon.xyz, side * 0.8 + cross(side, uMoon.xyz) * 0.6));
      float face = smoothstep(0.999952, 0.999968, md);
      col += vec3(0.74, 0.82, 0.95) * (face * (0.08 + 0.92 * lit) * 0.9 + exp((md - 1.0) / 0.0004) * 0.06 + exp((md - 1.0) / 0.003) * 0.035) * uMoon.w * gSunK;
    }
    // (And the air round it holds a little of its light, a long way out.)
    float mw = md * md; mw *= mw; mw *= mw; mw *= mw;
    col += S.key * (mw * mw * 0.16 + mw * 0.05) * uMoon.w * gSunK;
  }
  if (uNight > 0.0) {
    // (The aurora fades as the first light comes, and the stars thin.)
    gAz = atan(d.x, d.y);
    vec3 au = uSkyK.y > 0.0 ? aurora(d) * uSkyK.y : vec3(0.0);
    // (Where a station's words stand in the sky, the sky there is quiet.)
    if (gDirect && uCalmK.x > 0.0) {
      vec2 cq = max(abs(vUv - (uCalmBox.xy + uCalmBox.zw) * 0.5) - (uCalmBox.zw - uCalmBox.xy) * 0.5, 0.0);
      au *= 1.0 - 0.95 * uCalmK.x * (1.0 - smoothstep(0.0, 0.2, length(cq * vec2(uLens.y, 1.0))));
    }
    col += au * uNight;
    // (The stars show between the rays, and thin as the first light comes.)
    // (At first light the last of them are still there, high up, where the sky is still deep.)
    float starK = 1.0 - gDusk * (1.0 - 0.62 * smoothstep(0.1, 0.34, h));
    if (gDirect) col += starSky(d) * uNight * starK * starK * uAir.z * (1.0 - min(dot(au, vec3(2.2)), 0.88));
  }
  if (clouds > 0.0 && (uAir.y > 0.0 || (h > 0.03 && h < 0.85))) {
    // Thin high cloud: white where the sun finds it by day, a faint warm
    // underside before dawn.
    // (Two reads of the baked noise, laid over the dome from above so there is no seam.)
    vec2 cu = d.xy / (0.35 + d.z);
    float c = 0.62 * textureLod(uDetail, cu * 0.11 + vec2(uTime * 0.0006, 0.0), 1.0).r + 0.38 * textureLod(uDetail, cu * 0.37 + 0.31, 2.0).r;
    // (Under a veil the same cloud is the whole sky: thin, pale and without an edge, a little brighter where the sun stands behind it.)
    float cloud = mix(smoothstep(0.5, 0.74, c) * smoothstep(0.03, 0.2, h) * (1.0 - smoothstep(0.4, 0.85, h)), 0.55 + 0.45 * smoothstep(0.2, 0.75, c), uAir.y);
    float low = max(uNight, gDusk);
    vec3 lit = mix(vec3(0.82, 0.86, 0.92) + S.band * 0.1 * pow(az, 2.0), col * 0.8 + S.band * 0.07 * pow(az, 3.0), low);
    lit = mix(lit, S.mid * 1.22 + S.band * (0.12 + 0.3 * sd * sd * sd * sd), uAir.y);
    col = mix(col, lit, cloud * mix(mix(0.42, 0.55, low), 0.8, uAir.y) * clouds);
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
vec3 ridgeImage(vec3 d, float clouds, float soft, float pond, bool onIce, vec3 iceSky) {
  // An opaque range hides the dome. Resolve coverage first so that its
  // pixels never sample the stars or clouds behind the mountain.
  bool nearHorizon = d.z <= 0.14 && pond < 1.0;
  float el = nearHorizon ? asin(clamp(d.z, -1.0, 1.0)) : 0.0;
  vec2 uv = vec2(0.0);
  float lod = 0.0;
  float cover = 0.0;
  vec4 m = vec4(0.0);
  if (nearHorizon && el < PANO_EL) {
    uv = vec2(atan(d.x, d.y) / (2.0 * PANO_AZ) + 0.5, max(el, 0.0) / PANO_EL);
    lod = log2(max(uPxAng * float(textureSize(uPano, 0).x) / (2.0 * PANO_AZ), 1.0)) + soft;
    m = textureLod(uPano, uv, lod);
    cover = 1.0 - smoothstep(0.86, 0.97, m.a);
  }
  vec3 sky = onIce ? iceSky : (cover < 1.0 || pond > 0.0 ? skyColor(d, clouds) : vec3(0.0));
  if (!nearHorizon) return sky;
  vec3 col = sky;
  vec3 air = airAt(d.xy);
  if (cover > 0.0) {
    // (By day snow holds only on the easier slopes: the steep faces are bare rock, which is what gives a range its drawing.)
    // (Snow lies only where the ground is easy: every steeper face, by day and before dawn, is the rock itself.)
    float snowK = m.b * mix(smoothstep(0.885, 0.965, m.g), smoothstep(0.84, 0.95, m.g), uNight);
    vec3 alb = mix(mix(vec3(0.085, 0.09, 0.105), vec3(0.05, 0.055, 0.07), uNight), mix(vec3(0.92, 0.93, 0.95), vec3(0.5, 0.56, 0.66), uNight), snowK);
    float sunAz = max(dot(normalize(d.xy + 1e-5), uBearings.xy), 0.0);
    // (What the sun does not reach is lit by the sky alone: blue, and deep in the folds.)
    // (The sun is low and behind them: level snow is only grazed by it, and it is the faces turned to it that are bright.)
    // (The hour says which faces the light finds: the ones the morning's low sun was baked on, the ones turned
    // from it, which a light from the other side finds, and, under a high sun, whatever lies open to the sky.)
    float foundD = uRange.x * m.r * smoothstep(0.015, 0.21, m.r) + uRange.y * m.g * m.g * 0.62 + uRange.z * m.g * (1.0 - smoothstep(0.02, 0.34, m.r)) * 0.8;
    vec3 day = S.key * 0.95 * foundD + S.amb * vec3(0.78, 0.93, 1.14) * (0.02 + 0.36 * m.g * m.g);
    // Before dawn: the sky's own light, and the first warmth on what faces it.
    // (And the faces the coming light will find first already hold a little of it: a range has its drawing before dawn too.)
    // (The night's cold light comes from the side the curtains hang on, which is the side the morning sun will
    // come from: the faces it finds are pale blue, with the shadows the country throws, and the rest is deep.)
    // (Before dawn the one light is the moon's, on the faces the hour says it finds, with the shadows the country
    // throws; the rest has the sky's glow alone. When the moon has gone, the sky's glow is all there is, until the
    // first rose light touches the highest peaks, far off, on the faces turned to it.)
    vec3 night = S.amb * (0.3 + 0.7 * m.g) + (S.key * 0.8 + uAurora * 0.04) * foundD
      + S.band * 0.035 * pow(sunAz, 3.0) * m.g
      + vec3(1.0, 0.4, 0.38) * (0.2 * uRange.w * smoothstep(0.022, 0.06, el) * (0.35 + 0.65 * sunAz) * (0.3 + 0.7 * m.b) * (0.4 + 0.6 * m.g));
    vec3 rock = alb * mix(day, night, uNight);
    float far = clamp(m.a / 0.84, 0.0, 1.0);
    // (The air is thin in front of the near ranges and gathers with distance: they stand dark and drawn, and each
    // range behind them is paler.)
    float airK = 1.0 - exp(-(mix(0.015, 0.04, uNight) + far * mix(0.3, 0.5, uNight) + far * far * mix(1.25, 2.4, uNight)) * S.haze);
    // (Against the morning sun a range is a shape before it is a surface: less of the sun's own glare lies in front of it than behind.)
    vec3 airR = mix(air, mix(S.hor * 0.9, air, 0.4), (1.0 - uNight) * (1.0 - gDusk));
    // (Before dawn the air in front of them is the cold air the ground lies in, warm only toward the light.)
    airR = mix(airR, mix(S.hor, air, 0.45), uNight * (1.0 - gDusk));
#ifdef SEA
    if (gDusk > 0.0) {
      // Against the low light the ranges are the ending's: shaded faces
      // in the sky's own deep colour, the faces the light finds a little
      // warmer, a thin bright edge on the crest toward the sun, and each
      // range further off deeper in the lit air.
      float off = acos(clamp(sunAz, 0.0, 1.0));
      float found = smoothstep(0.02, 0.3, m.r) * 0.55 + 0.45 * m.g * m.b;
      // (A crest is where a little higher is a good deal further off: the next range, or the sky. The low light
      // behind the ranges catches every one of them.)
      // (Four blunt looks higher and higher: the light lies on a crest and falls away down the slope under it, more
      // on the ground that faces up, so it is a lit top that fades and never a line drawn round the range.)
      float crest = 0.5 * clamp((textureLod(uPano, uv + vec2(0.0, 0.012), lod + 2.0).a - m.a) / 0.3, 0.0, 1.0)
        + 0.3 * clamp((textureLod(uPano, uv + vec2(0.0, 0.03), lod + 3.0).a - m.a) / 0.3, 0.0, 1.0)
        + 0.2 * clamp((textureLod(uPano, uv + vec2(0.0, 0.065), lod + 3.0).a - m.a) / 0.3, 0.0, 1.0);
      // (Against the light a range has three tones. Its body is deep and warm: rock and shaded snow with the
      // light behind them. Snow that lies open to the sky overhead holds a little of the sky's blue, which is
      // what draws the snowfields from the faces. And the light comes over each crest and falls a way down the
      // slope under it, most toward the sun.)
      vec3 shade = S.hor * 0.04 + S.zen * 0.15 + S.mid * 0.02;
      vec3 open = shade + S.mid * 0.3 * m.g * m.g;
      // (A face turned from the morning's side is turned toward this light: it is the paler of the two.)
      vec3 low = mix(shade, open, m.b * smoothstep(0.8, 0.98, m.g)) * (1.5 - 0.95 * smoothstep(0.02, 0.4, m.r));
      low += S.band * (0.005 + 0.13 * exp(-off * 3.0)) * crest * crest * (0.3 + 0.7 * m.g * m.g);
      rock = mix(rock, low, gDusk);
      // (The air between the ranges is lit: each one further off is paler and nearer the glow's own colour,
      // and toward the sun the air is brightest, so the ranges under it melt into the light.)
      float glow = sunAz * sunAz; glow *= glow; glow *= glow;
      airK = mix(airK, clamp((0.008 + far * 0.2 + far * far * 0.62) * S.haze + 0.1 * glow, 0.0, 0.8), gDusk);
      airR = mix(airR, S.hor * (0.4 + 0.3 * far) + S.band * (0.05 + 0.1 * far) * glow, gDusk);
    }
#endif
    rock = mix(rock, airR, airK);
    col = mix(col, rock, cover);
#ifdef SEA
    // The sun's glow spills over whatever stands in front of it.
    if (gDusk > 0.0) col += sunBloom(max(dot(d, S.sun), 0.0)) * 0.42 * cover * gDusk * gSunK;
#endif
  }
  // A thin band of mist lies along the foot of the ranges.
  // (At the ending it is the evening's (or the morning's) haze over the water: deeper, lit from behind, and it
  // thins away upward with no edge, so the ranges stand out of it and there is no bar of light on the waterline.)
  float elp = max(el, 0.0);
  float mist = mix(exp(-elp / 0.004) * 0.6, exp(-elp / 0.006) * 0.2 + exp(-elp / 0.014) * 0.16, gDusk);
  col = mix(col, air, mist);
  // (An hour that has mist has it here too: it lies deeper along their foot, lit, and the ranges stand clear above it.)
  if (uAir.x > 0.0) col = mix(col, mistColor(d.xy), uAir.x * exp(-elp / 0.011) * 0.8);
  return mix(col, sky, pond);
}

vec3 withRidges(vec3 d, float clouds, float soft, float pond) {
  return ridgeImage(d,clouds,soft,pond,false,vec3(0));
}

/** What a ray that leaves the world sees. */
vec3 skyAll(vec3 d, float clouds) { return withRidges(d, clouds, clouds > 0.5 ? 0.0 : 1.5, 0.0); }



/* ---------- ice before dawn ---------- */

/**
 * Before dawn ice has no light of its own and almost none falls on it: it
 * is seen by what it catches. Its body is blue-black. The sky lies on its
 * faces as on dark glass, more the more glancing the eye and the wetter
 * the face: the curtain overhead, the deep blue, and low toward the dawn
 * the first light. Where it is thin (an edge, a point, a broken lip) the
 * cold sky comes through it. Every piece of ice in the flight is lit by
 * these, so the block, the cliff, the shards, the seracs, the dam, the
 * lattice and the canyon are one ice at night as they are by day.
 */

/** Where the night's one light stands, low: the moon while it is up, then the first light. */
vec3 dawnDir() { return uKeyDir; }

/** The night sky as a face of ice gives it back: no stars, no rays, the curtain as a soft wash. Below the horizon, dark water. */
vec3 skyNightOn(vec3 r) {
  float h = max(r.z, 0.0);
  vec3 c = mix(mix(S.hor, S.mid, smoothstep(0.0, 0.2, h)), S.zen, smoothstep(0.07, 0.62, h));
  float az = max(dot(normalize(r.xy + 1e-5), uBearings.xy), 0.0);
  c += S.band * exp(-h * 9.0) * az * az * az * 0.34;
  float up = h - 0.27;
  // (Ice gives the curtain back colder than it is: a little of its green is lost in the blue of the ice.)
  c += mix(vec3(0.13, 0.76, 0.66), vec3(0.36, 0.22, 0.95), smoothstep(0.0, 1.32, up)) * (smoothstep(-0.05, 0.03, up) * exp(-max(up, 0.0) / 0.55) * 0.8) * uSkyK.y;
  return mix(vec3(0.004, 0.011, 0.02), c, smoothstep(-0.12, 0.02, r.z));
}



/** Snow on ice before dawn: the palest thing on it, a shade over the night's own snow; the dawn's side a little warm, the curtain's light on what lies level. */
vec3 snowNight(vec3 n) {
  vec3 dw = dawnDir();
  return vec3(0.84, 0.85, 0.87) * (S.amb * (0.62 + 0.3 * max(n.z, 0.0)) + S.key * 0.62 * mix(1.0, 0.15, gDusk) * clamp(dot(n, dw) / max(dw.z, 0.09), 0.0, 2.2)) + uAurora * vec3(0.5, 0.75, 1.0) * 0.03 * max(n.z, 0.0);
}

/* ---------- the pictures ---------- */

#if defined(F_SLAB) || defined(F_CANYON)
/**
 * A real picture set in ice or lying under water, read so that its type
 * stays type at every size.
 * uv: where in it. dx, dy: how far uv moves for one device pixel to the
 * right and one up (worked out from the eye's own rays, so a face seen at
 * an angle is known to be long and thin under each pixel).
 *
 * Smaller than it was made (a device pixel spans more than one of its own):
 * its chain of smaller copies is read along the tilt, as many times as the
 * device allows, a little finer than the plain rule would choose, so small
 * letters keep their counters and do not swim.
 *
 * Larger than it was made: its own pixels are joined by a smooth curve
 * through four of them each way (not the straight line that leaves every
 * edge a ramp several pixels wide), and where two of its tones meet (the
 * edge of a letter) the meeting is drawn as narrow as a device pixel
 * allows. Nothing is added: an edge is put where the picture's own pixels
 * say it is, and flat tone and soft gradients are left exactly as they are.
 */
vec3 picRead(sampler2D tex, vec2 uv, vec2 dx, vec2 dy) {
  vec2 size = vec2(textureSize(tex, 0));
  float px = max(length(dx * size), length(dy * size));
  if (px >= 1.0) return textureGrad(tex, uv, dx * 0.72, dy * 0.72).rgb;
  vec2 sp = uv * size;
  vec2 tc = floor(sp - 0.5) + 0.5;
  vec2 f = sp - tc;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (tc - 1.0) / size;
  vec2 t3 = (tc + 2.0) / size;
  vec2 t12 = (tc + w2 / w12) / size;
  vec3 c = textureLod(tex, vec2(t0.x, t0.y), 0.0).rgb * (w0.x * w0.y) + textureLod(tex, vec2(t12.x, t0.y), 0.0).rgb * (w12.x * w0.y) + textureLod(tex, vec2(t3.x, t0.y), 0.0).rgb * (w3.x * w0.y)
    + textureLod(tex, vec2(t0.x, t12.y), 0.0).rgb * (w0.x * w12.y) + textureLod(tex, vec2(t12.x, t12.y), 0.0).rgb * (w12.x * w12.y) + textureLod(tex, vec2(t3.x, t12.y), 0.0).rgb * (w3.x * w12.y)
    + textureLod(tex, vec2(t0.x, t3.y), 0.0).rgb * (w0.x * w3.y) + textureLod(tex, vec2(t12.x, t3.y), 0.0).rgb * (w12.x * w3.y) + textureLod(tex, vec2(t3.x, t3.y), 0.0).rgb * (w3.x * w3.y);
  // What lies one of its own pixels to each side of this place: the darkest and the lightest of them (and of this
  // place itself) are the two tones that meet here. (Read between its pixels, so they change smoothly from place to place.)
  vec2 o = 1.0 / size;
  vec3 a = textureLod(tex, uv + vec2(o.x, 0.0), 0.0).rgb;
  vec3 b = textureLod(tex, uv - vec2(o.x, 0.0), 0.0).rgb;
  vec3 d = textureLod(tex, uv + vec2(0.0, o.y), 0.0).rgb;
  vec3 e = textureLod(tex, uv - vec2(0.0, o.y), 0.0).rgb;
  const vec3 LW = vec3(0.3, 0.59, 0.11);
  vec4 l = vec4(dot(a, LW), dot(b, LW), dot(d, LW), dot(e, LW));
  float lc = dot(c, LW);
  float lo = min(min(min(l.x, l.y), min(l.z, l.w)), lc);
  float hi = max(max(max(l.x, l.y), max(l.z, l.w)), lc);
  vec3 cLo = lc == lo ? c : (l.x == lo ? a : (l.y == lo ? b : (l.z == lo ? d : e)));
  vec3 cHi = lc == hi ? c : (l.x == hi ? a : (l.y == hi ? b : (l.z == hi ? d : e)));
  float t = clamp((lc - lo) / max(hi - lo, 1e-4), 0.0, 1.0);
  // (The meeting is about one of the picture's pixels wide as the curve draws it: it is narrowed to a device pixel and a bit.)
  float k = clamp(0.65 * px, 0.08, 0.5);
  float st = clamp((t - 0.5) / (2.0 * k) + 0.5, 0.0, 1.0);
  st = st * st * (3.0 - 2.0 * st);
  float gate = smoothstep(0.07, 0.22, hi - lo) * (1.0 - smoothstep(0.6, 1.0, px));
  return mix(clamp(c, 0.0, 1.0), mix(cLo, cHi, st), gate);
}

#endif
/* ---------- the slab ---------- */

float lodFor(float foot, float scale, float n);
${CLEAR_ICE}
float gSlabThick;
float shallowsAt(vec2 p);
vec3 fracture(vec2 x);
// (Stations 1 to 4 are made of the same glacier ice as the later ones: it is written with them, further on.)
vec3 iceGlacier(vec3 p, vec3 n, vec3 rd, float t, vec2 q, float thick, float sky, float sun, float cups, float edge, float seed);
#if ${DEEP_ICE_FEATURES}
vec3 iceGlacier(vec3 p, vec3 n, vec3 rd, float t, vec2 q, float thick, float sky, float sun, float cups, float edge, float seed, bool deepFace);
#endif
vec3 corniceOn(vec3 col, vec3 n, float dz, float hang, float px);
vec3 iciclesOn(vec3 col, float along, float dz, float px, float reach);
vec3 waterlineOn(vec3 col, float z, float g);
vec3 snowOn(vec3 n, float lump);

${subjects.find(s => s.pass === 'slab')?.shader?.source ?? "float gSlabSoft = 0.0;"}
/* ---------- the bed ---------- */

float bedShore;
vec4 bedAt(vec2 w) {
#ifdef SEA
  // The painted map ends in open sea across its full width.
  if (w.y >= ${(T2 + 9900 - 60).toFixed(1)}) { bedShore = 0.0; return vec4(-2000.0, -2000.0, 0.0, 0.0); }
#endif
  // The lake's far shore. Past the world's sides the bed repeats its last
  // column, so the coast there would be a ruled line: it is bent into long
  // low headlands and bays, big enough to be seen from across the lake.
  // (Not in front of the outlet: the river leaves where it was carved.)
  if (w.y > ${(LAKE.y1 - 2300).toFixed(1)} && w.y < ${(LAKE.y1 + 1500).toFixed(1)}) {
    // (It eases in over a long reach either side of the outlet: eased in quickly, the shore beside the river's mouth was sheared into a ruled edge, and its shallows into square blocks.)
    float side = 1.0 - smoothstep(330.0, 1230.0, w.x) * (1.0 - smoothstep(1730.0, 2630.0, w.x));
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
  // The painted world ends a little north of the western cape, and past its edge the bed repeats its last row:
  // the cape's shallows, and the lie of its shore, would run on from there to the horizon (a pale wedge on the
  // sea, with a strip of half-land along the skyline where a far shore's edge is blended widest). By that edge
  // all water is the deep open sea, with no shore near it.
  if (w.y > ${(T2 + 9900 - 330).toFixed(1)} && b.r < 0.0) {
    float north = smoothstep(${(T2 + 9900 - 330).toFixed(1)}, ${(T2 + 9900 - 60).toFixed(1)}, w.y);
    b.rg = mix(b.rg, vec2(-2000.0), north);
    b.ba *= 1.0 - north;
  }
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
vec3 fractureDistance(vec2 x, bool hairline) {
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
  vec2 seed = hash2(n + mg);
  // Only a few cells carry a hairline in bare lake ice. Their neighbours
  // still determine the nearest cell, but unmarked cells need no edge.
  if (hairline && (seed.x < 0.7 || seed.y > 0.5)) return vec3(8.0, seed);
  md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + hash2(n + g) - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(dr)));
    }
  }
  return vec3(md, seed);
}
vec3 fracture(vec2 x) { return fractureDistance(x, false); }

/* ---------- the ground: wind-cut snow ---------- */

const mat2 RW = mat2(0.9563, -0.2924, 0.2924, 0.9563);
// The world, turned so that x runs with the wind: the baked snow's own frame.
const mat2 GS = mat2(${Math.sin(WIND).toFixed(5)}, ${(-Math.cos(WIND)).toFixed(5)}, ${Math.cos(WIND).toFixed(5)}, ${Math.sin(WIND).toFixed(5)});
/** The size of a pixel on the ground, as two vectors: set once per pixel. */
vec2 gGx;
vec2 gGy;

/**
 * The baked snow at one size: its slope (along the wind, across it) and
 * its horizon toward each baked light. It is laid at three sizes, one
 * heading: the wind blows one way over all of it.
 */
vec4 snowTile(vec2 p, float scale, vec2 off) {
  return textureGrad(uGround, GS * p / scale + off, GS * gGx / scale, GS * gGy / scale);
}

/** 0..1: how near the words now showing this pixel is. The ground is quiet under them. */
float wordsNear() {
  if (uCalmK.x <= 0.0 || uCalmK.y > 0.5) return 0.0;
  float nearX = 0.2 / min(uLens.y, 1.0);
  if (vUv.y > uCalmBox.w + 0.2 || vUv.y < uCalmBox.y - 0.2 || vUv.x > uCalmBox.z + nearX || vUv.x < uCalmBox.x - nearX) return 0.0;
  vec2 cq = abs(vUv - (uCalmBox.xy + uCalmBox.zw) * 0.5) - (uCalmBox.zw - uCalmBox.xy) * 0.5;
  cq.x *= uLens.y;
  float cd = length(max(cq, 0.0)) + min(max(cq.x, cq.y), 0.0);
  return (1.0 - smoothstep(-0.01, 0.2, cd)) * uCalmK.x;
}

/**
 * Sparkle: single crystals whose faces happen to be turned to throw the
 * light at the eye. Each is fixed to the ground, a pixel or so across at
 * any distance (two sizes of cell, cross-faded, so none appears at once),
 * and each flashes over a narrow range of the eye's bearing: as the eye
 * moves, one goes out and another lights. Still, they are still.
 */
float sparkle(vec2 p, float foot, vec3 dir) {
  float lv = log2(max(foot, 0.04) * 3.4);
  float l0 = floor(lv);
  float f = lv - l0;
  float det = gGx.x * gGy.y - gGx.y * gGy.x;
  float s = 0.0;
  for (int i = 0; i < 2; i++) {
    float cell = exp2(l0 + float(i));
    vec2 g = p / cell;
    vec2 id = floor(g);
    float r = hash21(id + 31.7 * (l0 + float(i)));
    // (Before dawn only a few are turned to the little light there is.)
    if (r < mix(0.9, 0.972, uNight)) continue;
    vec2 at = id + 0.25 + 0.5 * vec2(hash21(id + 3.7), hash21(id + 9.1));
    // (How far off its middle, in pixels of the screen: it is a round point however low the eye.)
    vec2 dw = (g - at) * cell;
    vec2 px = vec2(dw.x * gGy.y - dw.y * gGy.x, dw.y * gGx.x - dw.x * gGx.y) / (abs(det) + 1e-9);
    float spot = 1.0 - smoothstep(0.55, 1.35, length(px));
    if (spot <= 0.0) continue;
    float ph = fract(r * 97.0 + dot(dir.xy, vec2(5.3, 3.9)) * 7.0 + dir.z * 11.0);
    float flash = smoothstep(0.55, 1.0, 1.0 - abs(ph * 2.0 - 1.0));
    s += spot * flash * (i == 0 ? 1.0 - f : f);
  }
  return s;
}

vec3 landColor(vec2 p, float sd, vec2 grad, float foot, vec3 dir, float slabShade) {
  vec3 L = keyDir();
  vec2 Lxy = uBearings.zw;
  float tanEl = uShadow.x;
  // How far the light has come round from the first baked bearing to the second.
  float kAz = uShadow.y;
  float calm = wordsNear();

  // Three sizes of the same wind-cut field: the valley's long drifts, the
  // drifts and ridges of the middle distance, the sastrugi under the eye.
  // (A size whose ridges have come down to a pixel is let go, and its shade
  // eases to its mean: nothing is read that cannot be drawn.)
  vec4 a = snowTile(p, 6200.0, vec2(0.13, 0.57));
  float fb = 1.0 - smoothstep(15.0, 38.0, foot);
  float fc = 1.0 - smoothstep(3.0, 7.6, foot);
  // Seen from high above, snow is a plain the wind has lined, not a country of hills: the long drifts and the
  // middle size keep little of their roll and their shade, and the sastrugi carry the picture.
  float high = smoothstep(280.0, 600.0, uCamPos.z);
  // (Under a low raking light even a plain has its long forms: they are kept then.)
  float kA = 1.0 - 0.72 * high * (1.0 - 0.6 * uHour.x);
  float kB = 1.0 - 0.55 * high * (1.0 - 0.6 * uHour.x);
  vec2 sA = a.xy * GS * kA;
  float mA = dot(sA, Lxy);
  // (A shade's edge is cut over a narrow band of the horizon; where a size is seen smaller than it was baked the band is wider, so the edge stays a pixel wide and does not crawl.)
  float shade = smoothstep(0.0, 0.07 * clamp(foot / 6.0, 1.0, 3.0), mix(a.z, a.w, kAz) - tanEl);
  vec2 rel = sA;
  float lit = 1.0 - 0.6 * kA * shade;
  if (fb > 0.0) {
    vec4 b = snowTile(p, 1330.0, vec2(0.71, 0.29));
    vec2 sB = b.xy * GS * kB;
    // (A ridge on a drift that leans from the light throws a longer shade: the drift's own lean is added to its horizon.)
    lit *= 1.0 - 0.8 * kB * mix(0.14, smoothstep(0.0, 0.07 * clamp(foot / 1.3, 1.0, 3.0), mix(b.z, b.w, kAz) + mA - tanEl), fb);
    rel += sB * fb;
    mA += dot(sB, Lxy) * fb;
  } else { lit *= 1.0 - 0.112 * kB; }
  if (fc > 0.0) {
    vec4 c = snowTile(p, 286.0, vec2(0.37, 0.11));
    // (Before dawn the finest size is the last thing seen: the moon draws the drifts and the wind's ridges, and the
    // sastrugi under the eye are a quiet grain on them, not a crumpled surface.)
    // (And under a low raking light seen from high up: the long forms carry the gold and the shade, and the fine
    // work is a grain on them.)
    float fineN = (1.0 - 0.88 * uNight) * (1.0 - 0.6 * uHour.x * high);
    lit *= 1.0 - 0.88 * fineN * mix(0.14, smoothstep(0.0, 0.07 * clamp(foot / 0.28, 1.0, 3.0), mix(c.z, c.w, kAz) + mA - tanEl), fc);
    rel += (c.xy * GS) * fc * fineN;
  } else { lit *= 0.877; }
  // (Rock is rougher than snow, and it breaks in blocks: each block has its own tilt.)
  vec3 blockR = vec3(1.0, 0.5, 0.5);
  float lvl = 0.5;
  if (gRock > 0.0) {
    blockR = fracture(p / 86.0 + rel * 0.4);
    rel += (rel * 0.6 + (blockR.yz - 0.5) * 0.9 * (1.0 - smoothstep(3.0, 9.0, foot))) * gRock;
    lvl = textureLod(uGrain, p / 1100.0, 0.0).g;
  }
  // (Under the words the ground is calm: its forms are still there, low, and their shade is thin.)
  rel *= 1.0 - 0.72 * calm;
  vec3 n = normalize(vec3(-rel, 1.0));
  // The bank rolls over into the cut.
  float ch = 1.0 - smoothstep(0.0, 48.0, sd);
  n = normalize(n + vec3(-grad * ch * (0.13 + 0.17 * a.z), 0.0));

  float ew = clamp(foot * 0.004, 0.004, 0.1);
  float bare = 0.0;

  float ndl = dot(n, L);
  // Snow is lit through as much as onto: a face turned from a low sun still
  // glows a little, in the sky's blue. Level snow is the reference. What is
  // crisp in it is the shade one form throws on the next.
  float sun = clamp(ndl / max(L.z, 0.05), 0.0, 2.4);
  // (Under the words the ridges' shade is thin: the ground there is calm.)
  // (Late in the day the light is low and coloured, and it is the slopes that carry it: a face turned to the sun is
  // gold, a face turned from it is left to the sky's blue. Under the words the ground stays even.)
  sun = mix(1.0, sun, 0.4 + 0.5 * uHour.x * (1.0 - calm)) * mix(1.0, lit, 1.0 - 0.9 * calm) * slabShade;
  vec4 gr = textureLod(uGrain, p / 150.0, lodFor(foot, 150.0, 256.0));
  // (Before dawn there is no glare to hide the snow's grain: the crust shows, a little, in the cold light.)
  vec3 snow = mix(vec3(0.93, 0.94, 0.95), vec3(0.84, 0.85, 0.87), uNight) * (0.965 + 0.07 * gr.g + uNight * (0.1 * (gr.g - 0.5) + 0.05 * (gr.a - 0.5)));
  vec3 stone = mix(vec3(0.085, 0.09, 0.1), vec3(0.05, 0.055, 0.07), uNight) * (0.7 + 0.7 * gr.g);
  // The outcrop: dark bedded rock, wet at its foot, snow only in its hollows.
  if (gRock > 0.0) {
    float bedding = textureLod(uGrain, vec2(dot(p, vec2(0.34, 0.94)) / 37.0, dot(p, vec2(0.94, -0.34)) / 900.0), lodFor(foot, 37.0, 256.0)).g;
    stone *= (0.75 + 0.9 * bedding) * mix(vec3(1.0), vec3(0.8, 0.9, 1.05), 0.5);
    stone = (stone * 2.1 + vec3(0.012, 0.014, 0.018)) * (0.7 + 0.6 * blockR.y);
    // A joint between two blocks is a dark seam.
    stone *= 1.0 - 0.7 * (1.0 - smoothstep(0.0, 0.035 + foot * 0.012, blockR.x)) * (1.0 - smoothstep(3.0, 9.0, foot));
    bare = gRock * smoothstep(0.45 - ew, 0.55 + ew, lvl + 0.3 * (1.0 - smoothstep(10.0, 70.0, sd)));
  }
  vec3 alb = mix(snow, stone, bare);

  // The bank's lip is wet ice all along the water: a blue edge under the white.
  float lipK = 1.0 - smoothstep(2.0, 13.0 + 6.0 * gr.b, sd);
  lipK *= smoothstep(0.30,0.68,gr.b) * (1.0-gRock);
  // (Level snow is held at one brightness whatever the sun's height; the
  // low sun is in how strongly every slope answers it, and in the shade.
  // Before dawn the aurora lends the snow a faint green, most on what faces it.)
  vec3 col = uNight < 1.0 ? alb * (S.key * 0.24 * sun + S.amb * 0.8 * (0.62 + 0.38 * n.z)) : vec3(0.0);
  // Before dawn the same relief is lit as night is lit: by one key, the moon, low and cold. A face turned to it
  // takes it and a lee does not, and each form throws the shade the day's does; under it there is only the sky's
  // glow, which is all a hollow has: dark blue, never black. When the moon has set the sky's glow is the whole
  // light, even and without shade, until the first light comes low from the dawn's side.
  float moonN = 1.0;
  if (uNight > 0.0) {
    float kc = 1.0 - 0.9 * calm;
    float wr = clamp(ndl / max(L.z, 0.07), 0.0, 2.6);
    // (Under the words it lies evenly: a light this low would pick out every ripple the calm ground has left.)
    moonN = mix(1.0, wr, 0.94 * (1.0 - 0.8 * calm)) * mix(1.0, lit, kc) * slabShade;
    // (At the ending the first sun is far brighter than a moon: the snow takes a little of it and stays the morning's blue.)
    vec3 keyN = S.key * 0.62 * mix(1.0, 0.15, gDusk);
    // (Under the aurora the snow that looks up at it holds a breath of its colour.)
    col = mix(col, alb * (keyN * moonN + S.amb * (0.62 + 0.3 * n.z) + uAurora * 0.04 * (0.5 + 0.5 * n.z)), uNight);
  }
  if (lipK > 0.0) {
    vec3 light = S.amb * 0.8 + S.key * (0.24*sun);
    vec3 lip = clearIce(n,dir,p,foot,26.0,1e3,0.7,0.8,light*0.55,light,S.hor);
    col = mix(col,lip,lipK*0.58);
  }
  // Sparkle, only on snow the light reaches. (Before dawn: hoar, glittering where the moon glances off the snow toward the eye.)
  float glintK = (1.0 - smoothstep(2.0, 9.0, foot)) * (1.0 - bare) * (1.0 - calm);
  vec3 rr = reflect(dir, n);
  float toKey = max(dot(rr, L), 0.0);
  // A rough crystal flashes only near the reflected light, and only on the lit side.
  if (glintK > 0.0 && toKey > 0.72 && lit > 0.25 && mix(sun, moonN, uNight) >= 0.3) {
    float sp = sparkle(p, foot, dir);
    float tk = toKey * toKey; tk *= tk;
    col += (S.key * 0.55 * lit * step(0.3, sun) * (1.0 - uNight) + S.key * (0.03 + 7.0 * tk * tk) * step(0.3, moonN) * uNight) * sp * glintK;
  }
  // Snow the wind lifts: thin veils of it streaming over the ground along the wind, low, lit by the low sun and
  // brightest against it. They come and go and they travel.
  if (uNight < 1.0 && uHour.y > 0.0) {
    vec2 wq = GS * p;
    float lodW = lodFor(foot, 520.0, 256.0);
    float veilW = textureLod(uGrain, vec2(wq.x / 2600.0 - uTime * 0.021, wq.y / 520.0 + 0.11 * sin(wq.x / 900.0)), lodW).g;
    float gust = 0.5 + 0.5 * sin(wq.x / 1700.0 - uTime * 0.11 + 2.0 * sin(wq.y / 1300.0));
    float toSunW = max(dot(normalize(dir.xy + 1e-5), uBearings.zw), 0.0);
    col += (S.key * (0.02 + 0.11 * toSunW * toSunW) + S.amb * 0.05) * smoothstep(0.6, 0.92, veilW) * (0.25 + 0.75 * gust) * uHour.y * (1.0 - bare) * (1.0 - calm);
  }
  // Wet shore: dark and glossy at the water.
  float wet = 1.0 - smoothstep(1.0, 16.0, sd);
  col = mix(col, col * vec3(0.62, 0.74, 0.82), wet * 0.36);
  // A cold sheen: snow is a little glossy at a glancing angle.
  float cosi = clamp(dot(-dir, n), 0.0, 1.0);
  float glance = pow(1.0 - cosi, 4.0);
  col += S.hor * glance * mix(0.08, 0.07, uNight) * (1.0 - 0.6 * bare);
  if (uNight > 0.0) {
    // Before dawn the crust shines where it throws the moon at the eye: a path of light on the snow under the
    // moon, carried by the relief, so it is a shine on forms and not a wash; and the sky's glow at a glance.
    float tk2 = toKey * toKey; tk2 *= tk2; tk2 *= tk2;
    col += (S.key * 1.5 * tk2 * moonN + S.mid * 0.3 * exp(-max(rr.z, 0.0) * 9.0)) * glance * uNight * (1.0 - 0.6 * bare) * (1.0 - 0.9 * calm);
  }
  return col;
}

#if defined(F_ICE)
/* ---------- the ice sheet ---------- */

/**
 * Where a place on the lake stands in the first camera's frame, in half
 * heights of the name: 1 at the letters' far edge, -1 at their near edge,
 * about 4 at the far shore, falling toward the eye.
 */
float nameRow(float y) {
  return nameSeat(vec2(uIce.x + uIce.z * 0.5, y)).y;
}

// The snow's three fields at this pixel's place on the lake, where the swept field has already read them (gSnowHad: 1).
vec3 gSnowWas = vec3(0.0);
float gSnowHad = 0.0;
// How much of the snow's finer drifting is drawn (1 by day). Before dawn, far down the lake, thin pale streaks
// on dark ice read as ripples on a sea: there only the broad drifts are kept.
float gSnowFine = 1.0;
float snowAt(vec2 wl, float big) {
  float mid = textureLod(uSnow, wl / vec2(860.0, 195.0) + vec2(0.37, 0.11), 0.0).g;
  float fin = textureLod(uSnow, wl / vec2(420.0, 110.0) + vec2(0.71, 0.29), 0.0).b;
  return 0.5 + big * 0.26 + mid * 0.18 * gSnowFine + fin * 0.085 * gSnowFine;
}

/**
 * The top of the sheet: clear dark ice, a dusting of snow, and drifts the
 * wind has packed, with pressure cracks across all of it (the page's
 * sheet). Seen at an angle it gets what it never had from above: the sky
 * and the ranges lie in the clear, wet ice, more of them the lower the eye.
 */
vec3 iceTop(vec2 p, vec2 il, vec3 cr, float f0, float shore, vec3 dir, float foot) {
  vec3 L = keyDir();
  vec2 LXY = uBearings.zw;
  vec2 wl = RW * il;
  // (Where the swept field has just read the snow's three fields at this very place, they are taken from it.)
  // (While the sheet's own frame is the lake's: late in the melt it gathers toward the outlet, and the two places part.)
  bool snowHad = gSnowHad > 0.5 && uIceB.z == 1.0;
  float big = snowHad ? gSnowWas.x : textureLod(uSnow, wl / vec2(2290.0, 790.0), 0.0).r;
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
  float less = wet * 0.14 + lane * 0.06 + uNight * (0.03 + 0.25 * (1.0 - smoothstep(60.0, 760.0, nameD)));
  less += farK * mix(0.2, 0.06, uNight) + nearK * mix(-0.24, 0.3, uNight);
  // More snow lies on the near ice, where the first frame's words stand.
  less -= 0.09 * (1.0 - smoothstep(uLake.x + 120.0, uLake.x + 520.0, p.y)) * (1.0 - uLake.z) * (1.0 - uNight);
  // By day wind-packed snow lies thickest round the name: bright ground for dark letters.
  less -= 0.11 * (1.0 - smoothstep(60.0, 520.0, nameD)) * (1.0 - uLake.z) * (1.0 - uNight);
  gSnowFine = 1.0 - uNight * smoothstep(1.2, 7.0, foot / pow(max(-dir.z, 0.02), 0.75));
  float lvl = (snowHad ? 0.5 + big * 0.26 + gSnowWas.y * 0.18 * gSnowFine + gSnowWas.z * 0.085 * gSnowFine : snowAt(wl, big)) - less;
  // (A lean frame does not measure how soft each drift's edge should be. Before dawn a hard-edged drift on dark ice
  // is a ripple on a sea: there its edges are all taken soft.)
  float ew = 0.006 + 0.03 * uNight * gL2;
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
  vec3 white = mix(vec3(0.9, 0.92, 0.95), vec3(0.4, 0.47, 0.6), uNight) * lit * (0.97 + 0.03 * big);
  // The near snow, where the first frame's words stand. It is calm for them, and calm is not soft: its broad swells are
  // held nearer one tone, and what is left to see is what wind-packed snow has close to: fine ridges cut by the wind,
  // each with a thin crisp shade on its lee, and a grain. (By day; before dawn that ice is bare.)
  float nearSnow = nearK * (1.0 - uNight) * (1.0 - smoothstep(3.0, 7.6, foot));
  if (nearSnow > 0.0) {
    vec3 flatLit = lightOn(vec3(0.0, 0.0, 1.0), 1.0);
    float tanEl = uShadow.x;
    float kAz = uShadow.y;
    vec4 sc = snowTile(p, 286.0, vec2(0.37, 0.11));
    vec4 sb = snowTile(p, 96.0, vec2(0.71, 0.29));
    float shC = smoothstep(0.0, 0.07 * clamp(foot / 0.28, 1.0, 3.0), mix(sc.z, sc.w, kAz) - tanEl);
    float shB = smoothstep(0.0, 0.07 * clamp(foot / 0.1, 1.0, 3.0), mix(sb.z, sb.w, kAz) - tanEl) * (1.0 - smoothstep(0.6, 2.2, foot));
    vec3 fine = flatLit * (1.0 - 0.19 * shC - 0.11 * shB) * (1.0 + 0.7 * dot(sc.xy, LXY) + 0.03 * (g.g - 0.5));
    white = mix(white, mix(vec3(0.9, 0.92, 0.95) * fine, white, 0.32), nearSnow);
  }
  if (uNight > 0.0) {
    vec3 nn = normalize(vec3(-rel*0.2,1.0));
    vec3 powder = vec3(0.84,0.85,0.87) * (S.key*max(dot(nn,L),0.0)
      + (S.amb*0.8+uAurora*0.035)*(0.62+0.38*nn.z));
    white = mix(white,powder*(0.94+0.12*g.r),uNight);
  }
  white *= (1.0+0.1*lip)*(1.0-0.25*lee)*(1.0+0.08*(g.r-0.5));
  float snowCover = mix(dust*0.38,1.0,drift);
  float cw = max(foot*0.9,0.5);
  float split = (1.0-uIceC.y)*(1.0-smoothstep(0.5,3.2+cw,cr.x));
  if (snowCover >= 1.0 && split == 0.0 && -f0 > 2.0*cw) return white;
  vec3 normal = normalize(vec3(-rel*0.07,1.0));
  vec3 mirror = reflect(dir,normal);
  vec3 sky = mix(S.hor,S.mid,smoothstep(0.0,0.35,mirror.z));
  // Level ice sees the same ranges as the eye at a shallow grazing angle.
  if (mirror.z < 0.14 && mirror.z > 0.0 && snowCover < 0.99) {
    // The sheet supplies the dome and direct specular. Add only the
    // mountains on this ray, at the panorama's native resolution.
    sky = ridgeImage(mirror,0.0,0.0,0.0,true,sky);
  }
  float wetEdge = 1.0-smoothstep(0.0,12.0,-f0);
  vec3 bed = uBed*(S.amb+S.key*0.05);
  vec3 sheet = clearIce(normal,dir,il,foot,uIceH*2.0,-f0,0.0,wet,bed,
    S.amb+S.key*0.12,sky);
  vec3 col = mix(sheet,white,snowCover*(1.0-0.18*wetEdge*wet));
  col = mix(col,white,split*0.55);
  col *= 1.0-split*(1.0-smoothstep(0.0,cw,cr.x))*0.65;
  gFarMir = farK*(1.0-snowCover)*(1.0-uNight);
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
vec3 iceCut(vec2 p, vec3 dir, float px, float s, float tall) {
  vec3 n = vec3(-normalize(dir.xy + 1e-5), 0.0);
  vec3 lit = S.amb + S.key * 0.2;
  vec3 face = clearIce(n, dir, vec2(dot(p, vec2(-n.y,n.x)), s*uIceH), px,
    uIceH, s*uIceH, 1.0, s*s, lit*0.4, lit, S.hor);
  // The lip: packed snow standing over the cut.
  float w = min(1.4 / max(tall, 1.0), 0.3);
  vec3 lip = vec3(0.9, 0.93, 0.95) * lit;
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
  // The mirrored wall: pale, strongest at the waterline, gone a wall's height down.
  float img = exp(-d * d * 1.7);
  vec3 wall = mix(vec3(0.42, 0.62, 0.74) * (S.amb * 1.15 + S.key * 0.07), vec3(0.3, 0.46, 0.56) * (S.amb * 2.4 + uAurora * 0.1), uNight);
  col = mix(col, wall, img * on * mix(0.3, 0.3, uNight));
  // The shelf: the ice goes on a little way under the water at the wall's foot, pale green, and the depth takes it.
  col += mix(vec3(0.02, 0.1, 0.11) * (S.amb * 1.1 + S.key * 0.08), vec3(0.008, 0.04, 0.04), uNight) * exp(-d / 0.5) * on;
  return col;
}

#endif
${subjects.find(s => s.pass === 'confluence')?.shader?.source ?? ''}
#if defined(F_POOL)
${subjects.find(s => s.pass === 'pool')?.shader?.source ?? ''}
#else
// (No pool in this variant of the pass: nowhere is inside its reach.)
#define poolAt(p) 0.0
#define poolUnder(pb, pw) 0.0
#endif
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
// The pond's tuning: x how bright the curtain lies in it before dawn, y its stars, z how much of the day sky it gives back.
const vec3 PONDK = vec3(1.3, 1.0, 0.3);
// The ice field where the eye's ray crosses the top of the sheet: how far inside an opening this water is seen.
float gIceF = 1e3;

vec3 waterColor(vec2 pw, vec4 bw, vec3 dir, float foot, float footL, float iceShade, float slabOn) {
  vec3 L = keyDir();
  vec2 LXY = uBearings.zw;
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
#ifdef F_SLAB
  if (slabOn > 0.0) slope = blockSwell(pw, slope);
#endif
  // (The clear pool is measuring-still: what lies on its bed is read.)
  slope *= 1.0 - 0.72 * poolAt(pw);
  float men = smoothstep(-5.0, -0.5, bw.r);
  slope += bw.ba * men * 0.12;
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
  // (The lake's bays reach a little past its south end: they are the lake's deep water too, not the river's. A ruled line across them is what drew square shallows there.)
  float lakeK = smoothstep(uLake.y + 290.0, uLake.y + 150.0, pb.y);
  // The sill at the lake's outlet: the bed comes up to the river's mouth in
  // a pale shoal, a fan with bays and tongues that grades out into the deep.
  // (Looked for only at the lake's south end.)
  if (lakeK > 0.0 && pb.y > uLake.y - 1100.0) {
    vec2 so = (pb - vec2(${OUTLET.x.toFixed(1)}, uLake.y + 110.0)) / vec2(520.0, 700.0);
    float sn = textureLod(uSnow, pb / 1300.0 + 0.4, 0.0).r * 1.1 + (textureLod(uDetail, pb / 520.0 + 0.2, 0.0).r - 0.5) * 0.5;
    lakeK *= smoothstep(0.42, 1.0, length(so) + sn);
  }
  if (lakeK > 0.0) {
    float floorH = textureLod(uDetail, pb / 1700.0 + 0.4, 0.0).r;
    depth = mix(depth, min(depth, 70.0 + 34.0 * floorH), lakeK);
  }
  // The shallows the columns stand in: a hand of water over a pale bed.
#ifdef F_SHALLOWS_OFF
  float shalK = 0.0;
#else
  float shalK = pb.y > ${(T2 + 380).toFixed(1)} && pb.y < ${(T2 + 1700).toFixed(1)} ? shallowsAt(pb) : 0.0;
#endif
  if (shalK > 0.0) depth = mix(depth, min(depth, 13.0 + 12.0 * textureLod(uDetail, pb / 900.0 + 0.2, 0.0).r), shalK);
  // The clear pool: a foot of still water over a pale bed, and the picture lying on it.
  float poolK = poolUnder(pb, pw);
  float picK = 0.0;
  float deepP = 0.0;
  vec3 sheetC = vec3(0.0);
#if defined(F_POOL)
  if (poolK > 0.0) {
    // (It shelves from a hand of water at the rim to the dark of its middle; the plates lie on a ledge a little way down.)
    deepP = smoothstep(14.0, 80.0, -bb.r + 24.0 * (textureLod(uGrain, pb / 900.0 + 0.6, 0.0).g - 0.5));
    float se = sheetEdge(pb);
    depth = mix(depth, mix(8.0 + 84.0 * deepP, 32.0, 1.0 - smoothstep(0.0, 46.0, se)), poolK);
    if (se < 2.0 && uSheetOn > 0.5) {
      vec4 sp = sheetPic(pb, footL);
      sheetC = sp.rgb;
      picK = sp.a * poolK;
    }
  }
#endif
  float dn = clamp(depth / DEEP, 0.0, 1.0);
  float shallow = 1.0 - smoothstep(0.08, 0.5, dn);

  // The bank on the light's side shades the water below it. The light is
  // low, so the shade is long; it is kept to a few bank heights.
  vec2 toSun = LXY * uShadow.w;
  // (Far from any bank there is no bank's shade to look for.)
  float bankShade = bw.r > -(2.6 * gFree + 12.0) ? smoothstep(-5.0, 5.0, textureLod(uBedA, bedUv(pw + toSun * gFree), 0.0).r) : 0.0;
  float shade = max(bankShade, iceShade) * (1.0 - 0.6 * uNight);

  float lodB = lodFor(footL, 256.0, 256.0);
  vec4 gb = textureLod(uGrain, pb / 256.0, lodB);
  vec4 gs = gb;
  vec3 bed = uBed * (1.0 + (gb.r - 0.5) * 0.03 + (gs.b - 0.42) * 0.17 + (gb.a - 0.4) * 0.12);
#if defined(F_POOL)
  if (picK == 1.0) bed = sheetC;
  else if (poolK > 0.0) {
    // Silt and stones; the picture's sheet with a hair of shade along its edge.
    bed = mix(bed, poolBed(pb, footL, L, deepP), poolK * 0.92);
    bed *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 7.0, sheetEdge(pb))) * step(0.0, sheetEdge(pb)) * uSheetOn;
    bed = mix(bed, sheetC, picK);
  }
#endif
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
  // The net of light as the surface focuses it, before the hour's light is put through it: 1 where it is even.
  float netRaw = 1.0;
  // The net of light on the bed: one focus of the summed curvature of the
  // moving layers. Each layer is read at the level its pixel covers, so far
  // off the net eases to even light before it can shimmer.
  float cheapC = mix(shaft, min(df.a * 6.0, 4.0), net * clamp(uLight.z * 0.5, 0.0, 1.0));
  // The pool supplies its own daylight caustic over this entire pixel.
  if (uQuality > 0.5 && gL2 < 1.0 && (poolK < 1.0 || uNight > 0.0)) {
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
    netRaw = mix(1.0, caust, net * (1.0 - gL2));
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
#if defined(F_POOL)
  if (poolK > 0.0) {
    float netP = poolNet(pb, footL);
    netP = mix(netP, 1.0 + (netP - 1.0) * 0.45, deepP);
    netP = mix(netP, 1.04 + (netP - 1.04) * 0.3, picK);
    lightOnBed = mix(lightOnBed, vec3(uLight.x * 0.9 + uLight.y * shadow * mix(netP, 0.9 + (netP - 0.9) * 0.35, uNight)), poolK);
    nfil *= 1.0 - poolK;
  }
#endif
  float caust = dot(lightOnBed, vec3(0.3333)) / (uLight.x * 0.9 + uLight.y);
  bed *= lightOnBed / (uLight.x + uLight.y);

  float path = (depth + 7.0) * (1.0 + 1.0 / max(-r.z, 0.35));
  vec3 trans = exp(-uAbsorb * path);
  float turbid = (1.0 - exp(-path * 0.011)) * (1.0 - 0.8 * poolK) * (1.0 - 0.7 * picK);
  trans = mix(trans, exp(-vec3(0.016, 0.0045, 0.0035) * depth) * vec3(0.9, 0.97, 0.98), poolK);
  vec3 body = uScatter * (0.5 + 0.5 * shadow) * (0.5 + 0.62 * min(caust, 3.0));
  vec3 water = (bed * trans + body * turbid * (1.0 - trans * 0.35)) * uSkyK.w;
  // Before dawn the water has no light of its own. It is dark, deep and
  // clear: the sky's faint light goes down into it and comes back from the
  // pale bed in the shallows, netted by the ripples as the day's is, and is
  // lost in the deep. What is seen on it is the sky.
  if (uNight > 0.0) {
    // (A shore is a pale shelf of ice seen through shallow water: it takes the light the snow beside it takes, and
    // gives back less of it. It never glows.)
    vec3 lightN = S.amb * 0.9 + S.key * 0.5 * mix(1.0, 0.15, gDusk) * (1.0 - 0.7 * shade) + uAurora * 0.03;
    vec3 bedN = vec3(0.44, 0.54, 0.62) * 0.42 * (0.78 + 0.5 * gb.g) * (1.0 + (gs.b - 0.42) * 0.4);
    // (The net is faint: the aurora is a soft light. It is there in the shallows and gone in the deep.)
    float netN = 1.0 + (clamp(netRaw, 0.35, 2.6) - 1.0) * 0.36;
    vec3 transN = trans;
    vec3 deepN = vec3(0.0022, 0.0085, 0.0135) * (0.72 + 0.28 * shaft);
    vec3 pool = bedN * lightN * transN * netN * (1.0 - 0.45 * shade) + deepN * (1.0 - 0.6 * transN.g);
    // (The clear pool is a foot deep everywhere and its bed is silt and stones: they are seen.)
#ifdef F_POOL
    if (poolK > 0.0) pool = mix(pool, min(bed, vec3(0.8)) * lightN * 0.62, poolK * (1.0 - picK));
#endif

    water = mix(water, pool, uNight * 0.93);
    // The picture glows softly up through the water.
    water = mix(water, sheetC * 2.3 + vec3(0.004, 0.011, 0.014) + water * 0.12, picK * uNight * 0.94);
    // (And lights the silt and the stones round it.)
#ifdef F_POOL
    if (poolK > 0.0 && uSheetOn > 0.5) water += sheetGlow() * bed * 1.3 * exp(-max(sheetEdge(pb), 0.0) / 120.0) * (1.0 - picK) * poolK * uNight;
#endif
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
  // (A ring the simulation raises is seen before dawn as light and shade
  // of the water's own colour: it does not swing the mirror down to the
  // warm horizon, which drew every ring in rust.)
  vec2 slopeM = slope - wv.ba * 9.0 * 0.72 * uNight;
  // (And the mirror is shaken along the view far more than across it: a
  // curtain's rays lie in the water as long broken strokes, not as scribbles.)
  vec2 vdx = vec2(-vdw.y, vdw.x);
  vec2 rs = mix(slopeM * 0.6, vdw * dot(slopeM, vdw) * 1.7 + vdx * dot(slopeM, vdx) * 0.3, uNight);
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
  // (Before dawn the running river mirrors what stands over it: the dark
  // ranges, the warm band at their foot on its far reaches, the curtains
  // nearer the eye. Its ripples break that light into strokes.)
  float streamK = smoothstep(0.25, 0.6, length(flow)) * (1.0 - lakeK) * (1.0 - shoalK) * (1.0 - gWalled);
#ifdef F_ICE
  float sheetK = smoothstep(0.75, 1.0, uGlow) * lakeK;
  // The name's own water while it is a melt pond.
  float pondK = gPond * lakeK;
#else
  // (The sheet has gone: neither is there.)
  const float sheetK = 0.0;
  const float pondK = 0.0;
#endif
  float fres0 = fres;
#if defined(F_ICE)
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
    vec2 azd = normalize(rf.xy + vec2(1e-6));
    if (pondK > 0.0) {
      // A pond holds one sky, seen through every letter at once. By day it
      // is the soft blue well over the ranges, deepening toward the eye.
      // Before dawn it is the high curtain: the dark under its hem and the
      // stars in it at the letters' far side, then the hem itself wandering
      // from letter to letter, and the rays standing up from it toward the
      // eye. Every ripple, and the pointer's wake, shakes the picture.
      float elP = mix(0.3 + 0.34 * up, 0.2 + 0.42 * up, uNight) + dot(slope, vdw) * mix(1.0, 2.0, uNight);
      el = mix(el, elP, pondK);
      azd = normalize(azd + vec2(-vdw.y, vdw.x) * dot(slope, vec2(-vdw.y, vdw.x)) * 0.7 * pondK);
    }
    el = clamp(el, 0.002, 0.95);
    // (Before dawn the water round the standing letters is not leaned at the curtain: it holds the sky that truly stands over it.)
    rf = normalize(mix(rf, vec3(azd * sqrt(1.0 - el * el), el), sheetK * (1.0 - STANDING_NAME * uNight)));
  }
#endif
  // (Before dawn the thin cloud is too faint to be seen in moving water: it is not asked for.)
  gWash = gL1;
  gSkyQ = 0.0;
  gSunK = 1.0 - sheetK * (1.0 - uNight);
#ifdef DBG_NO_REFL
  vec3 refl = S.mid;
#else
  float clouds = uQuality > 1.5 ? (1.0 - uNight) * (1.0 - gL1) * (1.0 - pondK) : 0.0;
  vec3 refl = withRidges(rf, clouds, uQuality > 1.5 ? 1.5 * gL1 : 1.5, pondK);
#endif
  gWash = 0.0;
  gSkyQ = 1.0;
  gSunK = 1.0;
  if (sheetK > 0.0 && uNight < 1.0 && pondK < 1.0) {
    // (Dark water deepens what it mirrors: the ranges' shaded faces and the blue over them stand further from the pale air than they do above.)
    float rl = max(dot(refl, vec3(0.3, 0.6, 0.1)), 1e-3);
    // (And cools it: even the glare under the sun comes back as blue water, not as grey.)
    refl = mix(refl, mix(refl, vec3(rl), 0.65) * vec3(0.52, 0.88, 1.32) * min(clamp(pow(rl / 0.6, 1.3), 0.22, 1.5), 0.5 / rl), sheetK * (1.0 - uNight) * (1.0 - pondK));
  }
  if (sheetK * uNight > 0.0 && pondK < 1.0 && STANDING_NAME < 0.5) {
    // Before dawn the letters hold the curtain itself: its rays stand in
    // the water as long strokes with dark water between them, green where
    // the far side of each letter catches the hem and turning violet in
    // the deeper water under the eye.
    float azv = atan(rf.x, rf.y);
    float ray = n1(azv * 46.0 + 3.0 * n1(azv * 7.0 + uTime * 0.03) + uTime * 0.04);
    float ray2 = n1(azv * 15.0 - uTime * 0.025 + 4.0);
    float deepV = smoothstep(0.75, -0.9, gCutA);
    vec3 cur = refl * (0.56 + 1.5 * ray * ray * ray) * (0.7 + 0.9 * ray2) * mix(vec3(1.0), vec3(0.76, 0.86, 1.42), deepV * 0.8) * 1.62;
    refl = mix(refl, cur, sheetK * uNight * (1.0 - pondK));
  }
  if (pondK * uNight > 0.0 && STANDING_NAME < 0.5) {
    // Still water holds the stars too: in the dark under the hem and between the rays.
    vec3 md = normalize(vec3(dir.xy, -dir.z) + vec3(slope * 0.5, 0.0));
    // The curtain in it is the high one, drawn here in full whatever the
    // governor has asked of the sky: its hem wanders from letter to letter,
    // its rays stand from the hem toward the eye, green turning violet.
    // (On a tall screen the name is two lines deep: both lie in the curtain's bright foot.)
    float upP = max(1.0 - gCutA, 0.0) * 0.5 * mix(0.5, 1.0, smoothstep(0.6, 0.9, uLens.y)) + dot(slope, vdw) * 2.0;
    // (As many rays across the frame through any lens.)
    float aP = atan(rf.x, rf.y) * 0.8 * (0.64 / atan(uLens.x * uLens.y)) + 1.9;
    // (Its broad shapes sway where they hang and do not travel: how much light lies in the name stays the same from minute to minute.)
    float foldP = n1(aP * 3.1 + 7.0 + 0.45 * sin(uTime * 0.035));
    // (The hem swoops: over most of the name it stands clear of the letters' far side, and here and there it dips well into them, with the dark sky and its stars beyond it.)
    float xP = upP - (-0.06 + 0.3 * sin(aP * 2.6 + 0.6 + 0.3 * sin(uTime * 0.06)) + 0.08 * sin(aP * 7.3 - uTime * 0.017));
    // (Rays with dark water between them: what a mirror of a curtain is, and what a lamp is not.)
    float raysP = (0.17 + 0.83 * smoothstep(0.1, 0.52, n1(aP * 19.0 + foldP * 9.0 + uTime * 0.05))) * (0.56 + 0.44 * n1(aP * 57.0 - uTime * 0.08));
    float profP = smoothstep(-0.04, 0.02, xP) * (0.74 + 0.26 * exp(-max(xP, 0.0) / 0.5));
    // (Its colour changes along it, fold by fold, and not from the top of a letter to its foot: a picture that followed the letters would be paint.)
    vec3 curP = mix(vec3(0.16, 0.92, 0.6), vec3(0.32, 0.5, 1.0), 0.75 * smoothstep(0.45, 0.8, n1(aP * 6.3 + 2.0 + 0.35 * sin(uTime * 0.045))) + 0.15 * smoothstep(0.4, 1.3, xP)) * profP * raysP * (0.62 + 0.38 * foldP) * PONDK.x * uSkyK.y;
    vec3 nightP = S.zen * 0.6 + curP + vec3(0.8, 0.88, 1.0) * stars(md) * PONDK.y * (1.0 - min(dot(curP, vec3(1.3)), 0.9));
    refl = mix(refl, nightP, pondK * uNight);
  }
  // (On the running river that light is broken along the current: brighter on the ripple faces, dimmer in their troughs.)
  refl *= 1.0 + (0.5 * (df.r - 0.5) + 0.3 * (dw2.r - 0.5)) * uNight * streamK;
  if (uNight > 0.0) {
    // The still reaches hold the stars: points that tremble with the water and are gone where it runs.
    float stillK = (1.0 - smoothstep(0.05, 0.28, length(flow))) * (1.0 - pondK) * (1.0 - smoothstep(1.2, 2.6, footL)) * (1.0 - gDusk) * (1.0 - gDusk);
    if (stillK > 0.0) refl += vec3(0.8, 0.88, 1.0) * stars(normalize(vec3(dir.xy, -dir.z) + vec3(rs * 0.12, 0.0))) * 0.55 * stillK * uNight * (1.0 - min(dot(refl, vec3(2.2)), 0.88));
    // A ring on the water is a brighter face and a darker one, in the mirror's own colour.
    refl *= 1.0 + clamp(dot(wv.ba, -LXY) * 58.0, -0.34, 0.7) * uNight;
  }
#if defined(F_SLAB)
  // The slab stands in the water: its mirror image, broken by the ripples.
  if (slabOn > 0.0) {
    vec3 suvS;
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
      // It is light on moving water, not a picture of the block: each ripple's face gives back a sliver of it and the
      // trough behind gives back the sky, in long thin dashes that lie across the way the block looks; whole at the
      // block's foot, it comes apart the further out it lies.
      vec2 dsS = pw - uSlabPos.xy;
      vec2 lbS = vec2(dot(dsS, uSlabDir.zw), dot(dsS, uSlabDir.xy));
      float sl1 = textureLod(uDetail, vec2(lbS.x / 330.0 + 0.011 * uTime, lbS.y / 30.0 - 0.045 * uTime), lodFor(footL, 30.0, 512.0)).r;
      float sl2 = textureLod(uDetail, vec2(lbS.x / 190.0 - 0.017 * uTime + 0.4, lbS.y / 17.0 + 0.06 * uTime + 0.7), lodFor(footL, 17.0, 512.0)).r;
      float faceR = clamp(0.5 + (sl1 - 0.5) * 3.2 + (sl2 - 0.5) * 2.2, 0.0, 1.0);
      float farS = smoothstep(0.0, uSlabSize.y * 1.2, tS);
      float keepS = mix(1.0, smoothstep(0.34 + 0.2 * farS, 0.44 + 0.2 * farS, faceR), 0.35 + 0.65 * farS);
      refl = mix(refl, scS.rgb * (0.5 + 0.3 * faceR), scS.a * keepS);
      fres = max(fres, 0.3 * scS.a * keepS);
    }
  }
#endif
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
  fres = mix(fres, max(fres * 1.3 + 0.1, mix(0.97, 0.66, smoothstep(0.27, 0.44, cosi)) * sheetK * (1.0 - STANDING_NAME)), uNight);
  // A bank stands over the water at its edge: there the mirror shows the dark bank, not the sky.
  // (Wider in the walled basin, where the project's words stand over the near bank.)
  refl *= 1.0 - mix(0.3, 0.8, gWalled) * uNight * (1.0 - smoothstep(4.0, mix(46.0, 150.0, gWalled), -bw.r)) * (1.0 - sheetK);
  // (By day the sheet's own walls stand round that water: less of the pale sky reaches it.)
#ifdef F_ICE
  gDeep = lakeDay * smoothstep(0.5, 1.0, uGlow);
#endif
  // (By day it is dark water you look down into under the eye, and more of a mirror toward the far side of each letter.)
  // (The far side of each letter gives back the most of what stands over the lake; the near side is depth.)
  float farL = smoothstep(-1.15, 1.0, gCutA);
  fres = mix(fres, mix(0.04, 0.33, farL * farL * farL * farL * sqrt(farL)), gDeep);
  if (sheetK > 0.0) {
    // Cat's-paws: where a breath of air roughens the water it gives back more sky, in long thin dashes that drift.
    float paw = textureLod(uDetail, pw / vec2(330.0, 130.0) + vec2(0.006, 0.002) * uTime, lodFor(footL, 130.0, 512.0)).r;
    float pawK = smoothstep(0.6, 0.72, paw) * (1.0 - smoothstep(0.74, 0.86, paw));
    fres += pawK * mix(0.08 + 0.12 * farL, -0.22, uNight) * sheetK * (1.0 - pondK * uNight);
  }
  float shelfP = 1.0;
  if (pondK > 0.0) {
    // (A breath of air on it: thin drifting dashes that give back a little more sky.)
    float pawQ = textureLod(uDetail, pw / vec2(330.0, 130.0) + vec2(0.006, 0.002) * uTime, lodFor(footL, 130.0, 512.0)).r;
    float pawP = smoothstep(0.6, 0.72, pawQ) * (1.0 - smoothstep(0.74, 0.86, pawQ));
    // The pond's bed is the ice itself. Just inside the outline it is a
    // hand of water over pale ice: luminous turquoise. It shelves off
    // quickly, and along the middle of every stroke the water is deep and
    // dark blue-teal. No raised thing is shaded so: this is what says water.
    // (The shelf is never one width: wider here, narrower there, as a pond's is, and wider as the pond spreads.)
    float un = textureLod(uDetail, pw / vec2(1100.0, 3300.0) + 0.3, 0.0).r;
    shelfP = max(uIceN.x, 1.0) * (0.065 + 0.25 * un * un) + uIceN.z * 0.3;
    float z = max(gIceF, 0.0) / shelfP;
    // (Its bed is not level either: here and there a shoal of ice comes up under the middle of a stroke, and the deep water over it is teal, not black.)
    // (Not where the letters stand as blocks: that water is the lake's own depth, dark all through, and pale ice stands in it.)
    float shoalP = smoothstep(0.44, 0.84, textureLod(uSnow, pw / vec2(900.0, 2700.0) + 0.57, 0.0).g + 0.5) * (1.0 - STANDING_NAME);
    float hw = min(0.03 + 2.0 * pow(z, 1.5), mix(9.0, 2.1, shoalP));
    vec3 thru = exp(-vec3(2.7, 0.95, 1.0) * hw);
    // The net of light lies on the shallow bed by day.
    float netP = smoothstep(0.3, 0.75, df.a) * (1.0 - uNight) * (1.0 - smoothstep(1.5, 4.0, footL));
    // (Before dawn the shelf round the standing letters' water is only a little paler than the water: a bright rim to every bay of its shore was a scribble.)
    vec3 lightP = mix(S.amb * 1.3 + S.key * 0.25, (S.amb * 2.0 + uAurora * 0.7 + vec3(0.05, 0.13, 0.15)) * mix(1.0, 0.4, STANDING_NAME), uNight);
    vec3 deepP = mix(vec3(0.0003, 0.015, 0.016), vec3(0.002, 0.009, 0.014), uNight) * (0.75 + 0.5 * shaft);
    vec3 body = vec3(0.7, 0.9, 0.97) * thru * lightP * (0.84 + 0.42 * netP) + deepP * (1.0 - thru.g);
    body *= 1.0 + clamp(wf * 6.5, -0.3, 0.7);
    water = mix(water, body, pondK);
    // (Dark water cools what it mirrors.)
    refl = mix(refl, refl * vec3(0.45, 0.9, 1.0), pondK * (1.0 - uNight));
    // By day a pond seen from this high is mostly its own colour, with a little sky on it; before dawn still dark water is nearly a whole mirror, a little less of one over the pale shelf.
    fres = mix(fres, mix(clamp(fres0 * PONDK.z + 0.02, 0.03, 0.4) + 0.1 * pawP, mix(mix(0.92, 0.4, thru.g), clamp(fres0 * 1.5 + 0.12, 0.0, 0.6), STANDING_NAME), uNight), pondK);
  }
  vec3 col = mix(water, refl, fres);
#ifdef F_ICE
  if (sheetK > 0.0 && gFarK > 0.0) col = cutFoot(col, pw, dir, slope, foot, sheetK);
#endif
  // The sun on ripple faces turned toward it: a broad, graded sheen.
  float sd = max(dot(rf, S.sun), 0.0);
  col += S.band * (pow(sd, 240.0) * 1.6 + pow(sd, 40.0) * 0.12) * (1.0 - shade) * (1.0 - uNight) * (1.0 - gDeep);
  // A low, wide horizon band is reflected by the ripple faces that turn toward it.
  float horizon = max(dot(rf.xy, uBearings.xy), 0.0);
  horizon *= horizon;
  col += S.band * (0.30 * uDistanceAir.z * horizon * horizon * horizon * (1.0 - shade));
  // Before dawn, the moon's: every ripple face turned to it throws it back, so its path lies down the water toward
  // the eye, bright and close-set under the moon and breaking up toward the near bank.
  if (uNight > 0.0 && uMoon.w > 0.0 && uMoon.z > -0.03) {
    float mdw = max(dot(rf, uMoon.xyz), 0.0);
    float m8 = mdw * mdw; m8 *= m8; m8 *= m8;
    float m64 = m8 * m8; m64 *= m64; m64 *= m64;
    float m512 = m64 * m64; m512 *= m512; m512 *= m512;
    col += S.key * (m512 * m512 * 30.0 + m512 * 1.1 + m64 * 0.1 + m8 * 0.02) * uMoon.w * (1.0 - shade) * smoothstep(-0.03, 0.04, uMoon.z);
  }
#ifdef SEA
  // The delta, late in the day. The sun is low and ahead, so each bar lays a long shade on the water behind it and
  // the channels away from the light are deep teal; only where a channel crosses the sun's bearing does it burn.
  float dlt = pw.y > ${(DELTA.apex.y - 260).toFixed(1)} ? smoothstep(${(DELTA.apex.y - 260).toFixed(1)}, ${(DELTA.y + 120).toFixed(1)}, pw.y) * (1.0 - uNight) : 0.0;
  float longShade = shade;
  if (dlt > 0.0) {
    // (Two looks toward the sun: a bank a long way off still shades this water.)
    if (open < 1.0) longShade = max(shade, max(smoothstep(-6.0, 6.0, textureLod(uBedA, bedUv(pw + LXY * 64.0), 0.0).r), 0.75 * smoothstep(-6.0, 6.0, textureLod(uBedA, bedUv(pw + LXY * 150.0), 0.0).r)));
    col = mix(col, col * vec3(0.16, 0.4, 0.5) + vec3(0.0, 0.008, 0.016), dlt * (0.72 + 0.26 * longShade));
    // Ice under the shallows returns the light that survives the round trip to the bed.
    col += dlt * (1.0 - fres) * trans * trans * vec3(0.08, 0.16, 0.17) * (S.amb + S.key * (0.10 * (1.0 - longShade)));
  }
  if (uSea.x > 0.0 && S.sun.z > 0.0) {
    float daS = atan(dir.x, dir.y) - uShadow.z;
    // (By day the path is narrow: contrast, not more light everywhere, is what makes it blaze.)
    float pathS = exp(-daS * daS / mix(0.014, 0.1, uNight));
    if (pathS > 0.01) {
      // Every ripple face turned to the sun throws it back whole: the braids blaze where they cross its bearing,
      // in broad flashing faces with a fine sparkle over them that comes and goes.
      // (By day they are fewer and far brighter, with dark water between them: a wash of light would turn the channels to sand.)
      float face = smoothstep(mix(0.6, 0.5, uNight), mix(0.8, 0.78, uNight), mix(dw2.r, df.r, 0.45));
      face = mix(face, mix(0.2, 0.34, uNight), smoothstep(2.0, 9.0, footL));
      float spark = smoothstep(0.7, 0.92, n2(pw / 9.0 + vec2(uTime * 1.1, -uTime * 0.8))) * (1.0 - smoothstep(1.2, 4.0, footL));
      // (By day a glint is the sun itself, white with a little of its gold: a dim tan fleck reads as silt on the water.)
      vec3 gold = mix(S.band, vec3(2.6, 2.3, 1.8), mix(0.85, 0.3, uNight));
      // (Before dawn the broad faces are faint and it is the fine sparkle that carries the first light: big pale flakes on dark water are confetti.)
      col += gold * pathS * (mix(0.05, 0.1, uNight) + mix(16.0, 0.2, uNight) * face * face * face + mix(8.0, 3.0, uNight) * spark * face * face) * (0.35 + 0.65 * fres) * uSea.x * (1.0 - longShade) * mix(1.0, 0.45, uNight);
    }
  }
#endif
#if defined(F_ICE)
  // In the name the sun's path is broken glitter: single ripple faces
  // catching it, a column of them coming down the water from under the
  // sun toward the eye, close and fine at the far side, wider and sparser
  // near. (The sun stands at the frame's edge: its path is leaned in over
  // the first letters, as the mirror is.)
  if (gDeep > 0.0) {
    float lim = atan(uLens.x * uLens.y) * 0.56;
    float azC = clamp(uShadow.z, -lim, lim);
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
      float glint = spark * 5.0 + face * face * 0.22 * (1.0 - 0.85 * pondK);
      // (A glint finer than a pixel is its even mean.)
      glint = mix(glint, 0.12 * (1.0 - pondK), smoothstep(2.0, 6.0, footL) * (1.0 - 0.6 * pondK));
      // (It is the name's own: once the sheet is plates the sun's true path on the open lake takes over.)
      // (Not where the letters stand as blocks: on that water single glints were specks round the word.)
      col += S.band * path * glint * mix(1.0, 0.7, nearK) * gDeep * sheetK * sheetK * (1.0 - STANDING_NAME);
    }
  }
#endif
  // A few plates of ice lie afloat in the name's water, turning slowly:
  // angular, of different sizes, each with its own thin shade.
  // (Where the letters stand as blocks the pieces that come away from them are drawn with them: see the name's own shader.)
  if (sheetK > 0.0 && STANDING_NAME < 0.5 && gIceF1 > 6.0 && gIceF > shelfP * 1.6 * pondK && footL < 12.0) {
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
      col *= 1.0 - 0.34 * (1.0 - smoothstep(0.0, 5.0, chip)) * sheetK * (1.0 - aC);
      if (aC > 0.0) {
        vec3 lit = S.amb + S.key * 0.22;
        vec3 plate = clearIce(vec3(0,0,1),dir,ql+hq*256.0,foot,sz,-chip,0.7,0.3,col,lit,S.mid);
        col = mix(col,plate,aC);
      }
    }
  }
  // The lake's own current, once the name's meltwater has found its way out: the water in the pool draws toward the
  // mouth of the lead behind the letters, and runs off down the lead toward the outlet. It is seen as water is seen
  // moving: fine threads of light on it, torn, travelling the way it goes.
  if (lakeK > 0.0 && uNameL.x > 0.0 && footL < 26.0) {
    vec2 us = uIceB.xy + (pw - uIceB.xy) * uIceB.z;
    float yM = uNameB.x;
    vec2 ld = leadAt(us.y);
    float inPool = 1.0 - smoothstep(yM - 30.0, yM + 70.0, us.y);
    float acr = us.x - ld.x;
    float runL = uTime * 44.0;
    vec2 toM = us - vec2(leadAt(yM).x, yM + 40.0);
    float rho = length(toM);
    float lodT = lodFor(footL, 70.0, 512.0);
    float thL = textureLod(uDetail, vec2(acr / 120.0 + 0.3, (us.y - runL) / 2400.0), lodT).r;
    float thP = textureLod(uDetail, vec2(atan(toM.x, -toM.y) * 1.2 + 0.2, (rho + runL * 0.7) / 1700.0), lodT).r;
    float th = mix(thL, thP, inPool);
    // (Soft and long: a sheen that travels, not a scratch.)
    float lineT = 1.0 - smoothstep(0.0, 0.05 + footL * 0.004, abs(th - 0.56));
    float tornT = smoothstep(0.38, 0.7, textureLod(uDetail, vec2(acr / 330.0 + 0.6, (us.y - runL * 1.2) / 900.0), lodFor(footL, 330.0, 512.0)).r);
    float kL = exp(-acr * acr / (uNameL.y * uNameL.y * 1.4 + 400.0)) * (1.0 - smoothstep(uNameL.x - 0.08, uNameL.x - 0.01, ld.y));
    // (In the pool it is fainter, and it keeps behind the letters: nothing is drawn across what stands under the water in front of them.)
    float kP = (1.0 - smoothstep(150.0, 380.0, rho)) * smoothstep(60.0, 200.0, rho) * 0.55 * smoothstep(yM - 120.0, yM - 50.0, us.y);
    float kT = mix(kL, kP, inPool) * smoothstep(0.03, 0.25, uNameL.x) * (1.0 - smoothstep(0.86, 0.99, uIceA.z)) * (1.0 - smoothstep(8.0, 26.0, footL));
    vec3 foamT = mix(vec3(0.8, 0.93, 1.0) * (S.amb * 1.2 + S.key * 0.22), gFoamN * 0.8, uNight);
    col = mix(col, foamT, lineT * lineT * tornT * kT * mix(0.13, 0.12, uNight));
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
    vec3 foam = mix(vec3(0.9, 0.96, 1.0) * (S.amb * 1.2 + S.key * 0.26), gFoamN * 0.85, uNight);
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
      vec3 plate = mix(vec3(0.86, 0.92, 0.96) * (S.amb * 1.3 + S.key * 0.3), gFoamN * 0.7, uNight);
      col = mix(col * (1.0 - 0.35 * (1.0 - smoothstep(-0.5, 5.0, chip)) * runK * mid), plate, aC);
    }
  }
  // Where the river steps down into the basin it breaks: white water across
  // the stream, streaked the way it runs, and a boil below that thins out.
  if (pw.y > ${(STEP.y0 - 60).toFixed(1)} && pw.y < ${(STEP.y1 + 260).toFixed(1)} && footL < 60.0) {
    float lipS = smoothstep(${(STEP.y0 - 40).toFixed(1)}, ${(STEP.y0 + 70).toFixed(1)}, pw.y) * (1.0 - smoothstep(${(STEP.y1 - 20).toFixed(1)}, ${(STEP.y1 + 120).toFixed(1)}, pw.y));
    if (lipS > 0.0) {
      float runS = uTime * uFlowSpeed * 1.4;
      float boilS = mix(df.r, dw2.r, 0.5);
      // Foam in fine lines drawn out the way the water runs, each pointed at both ends: drawn, so each has an edge
      // a pixel wide at any distance (a noise stretched along the current was a streaked blur close under the eye).
      float lw = pw.x / 6.5 + 1.4 * sin(pw.y * 0.011) + 0.6 * sin(pw.y * 0.037 + 1.3);
      float lid = floor(lw);
      float lx = (lw - lid - 0.5) * 6.5;
      float h1 = hash11(lid * 1.31 + 7.0);
      float seg = (pw.y - runS * (0.75 + 0.5 * h1)) / (46.0 + 90.0 * h1) + h1 * 9.0;
      float sid = floor(seg);
      float sf = seg - sid;
      // (Thickest where it breaks over the step and where it boils below; thinning out into the basin.)
      float dens = clamp(0.12 + 0.7 * lipS * (0.45 + 0.9 * boilS), 0.0, 0.92);
      float half_ = (0.35 + 1.5 * hash11(lid * 3.1 + sid * 5.7)) * smoothstep(0.0, 0.4, sf) * (1.0 - smoothstep(0.5, 1.0, sf));
      float pxS = 0.6 * max(footL, 0.15);
      float lineS = step(1.0 - dens, hash11(sid * 3.7 + lid * 11.3 + 0.5)) * (1.0 - smoothstep(half_ - pxS, half_ + pxS, abs(lx))) * min(1.0, 1.4 * half_ / pxS);
      float whiteS = lineS * lipS * smoothstep(8.0, 40.0, -bw.r) * (1.0 - smoothstep(20.0, 60.0, footL));
      vec3 foamS = mix(vec3(0.93, 0.97, 1.0) * (S.amb * 1.25 + S.key * 0.3), gFoamN * 1.15, uNight);
      col = mix(col, foamS, whiteS * 0.85);
    }
  }
#if defined(F_CONF)
  // The confluence: seven trails of paler meltwater along the cliff's foot, and a boil under each fall.
  if (pw.x > 700.0 && pw.x < 2500.0 && pw.y > ${(lipY(LIP.x0) - 900).toFixed(1)} && pw.y < ${(lipY(700) + 40).toFixed(1)}) col = confRiver(col, pw, footL, df.r, dw2.r, shade);
#endif
#if defined(F_SLAB)
  // White water where the basin's waves strike the block and the shores round it.
  if (slabOn > 0.0) col = blockWater(col, pw, bw.r, df.r, dw2.r, abs(wv.r) * 30.0 + length(wv.ba) * 40.0);
#endif
#if defined(F_POOL)
  // The pool's own surface: the sky lies on its far side, and a shelf of ice stands out over it all round.
  float poolS = poolAt(pw);
  if (poolS > 0.0) {
    // The sky lies on the far water, more of it the lower the eye looks across it; and each boulder stands over its own dark image.
    float low = 1.0 - smoothstep(0.34, 0.8, -dir.z);
    float mirK = low * low * mix(0.5, 0.16, uNight) * (1.0 - 0.75 * picK);
    vec3 mir = refl;
    vec3 nR;
    vec3 rfR = reflect(dir, normalize(vec3(-slope * 2.2, 1.0)));
    float tR = rockHit(vec3(pw, -FREEBOARD), rfR, nR);
    if (tR > 0.0) {
      mir = mix(mir, rockColor(vec3(pw, -FREEBOARD) + rfR * tR, nR, tR * 3.0) * 0.5, gRockA);
      mirK = max(mirK, mix(0.42, 0.3, uNight) * gRockA * (1.0 - 0.5 * picK));
    }
    col = mix(col, mir, mirK * poolS);
    // (Before dawn it is dark water round the lit table: it gives back less of the curtain than the river does.)
    col = mix(col, water * 1.4 + refl * 0.012, 0.74 * uNight * poolS * (1.0 - picK));
    // (Over the plates the sky's veil is thin by day and gone before dawn: their ground stays dark, their letters light.)
    col = mix(col, water, picK * mix(0.4, 0.8, uNight) * poolS);
    vec4 rim = poolRim(pw, -bw.r, footL, dir, col, refl);
    // (The shelf's shade on the bed under it.)
    col *= 1.0 - 0.22 * (1.0 - smoothstep(20.0, 54.0, -bw.r)) * poolS * (1.0 - uNight);
    col = mix(col, rim.rgb, rim.a * poolS);
  }
#endif
  // The water's edge: under the bank's ice shelf a short soft shade, and
  // where the current runs against the bank a fine line of foam.
  float line = smoothstep(-3.0 - foot, 0.0, bw.r);
  col *= 1.0 - 0.16 * line * (1.0 - uNight);
  float edgeF = (1.0 - smoothstep(1.5 + foot, 5.0 + 2.0 * foot, -bw.r)) * smoothstep(0.15, 0.7, dot(flow, bw.ba)) * smoothstep(0.34, 0.72, df.r) * (1.0 - smoothstep(14.0, 40.0, footL));
  vec3 edgeC = mix(vec3(0.9, 0.96, 1.0) * (S.amb * 1.2 + S.key * 0.24), gFoamN, uNight);
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

/** Two finite differences of n2. Adjacent samples usually share the same four lattice values. */
vec2 seaSlope(vec2 p, float stepSize) {
  vec2 cell = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec4 h = vec4(hash21(cell), hash21(cell + vec2(1, 0)), hash21(cell + vec2(0, 1)), hash21(cell + vec2(1)));
  vec2 col = mix(h.xy, h.zw, u.y);
  vec2 row = mix(h.xz, h.yw, u.x);
  float centre = mix(row.x, row.y, u.y);
  vec2 next = f + stepSize;
  vec2 v = fract(next);
  v = v * v * (3.0 - 2.0 * v);
  if (next.x >= 1.0) col = vec2(col.y, mix(hash21(cell + vec2(2, 0)), hash21(cell + vec2(2, 1)), u.y));
  if (next.y >= 1.0) row = vec2(row.y, mix(hash21(cell + vec2(0, 2)), hash21(cell + vec2(1, 2)), u.x));
  return centre - mix(vec2(col.x, row.x), vec2(col.y, row.y), v);
}

/** The swell's two differences, accumulated at the same four frequencies as its height. */
vec2 seaRelief(vec2 p) {
  float a = 0.5, stepSize = 0.11;
  vec2 slope = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= 2 && gL2 >= 1.0) break;
    slope += a * seaSlope(p, stepSize) * (i >= 2 ? 1.0 - gL2 : 1.0);
    p = p * 2.03 + 11.7;
    stepSize *= 2.03;
    a *= 0.5;
  }
  return slope;
}
/**
 * Drift ice: plates the river has carried out past the delta, fewer the
 * further the land falls behind, none where the camera comes to rest.
 * Returns how far a place is from the nearest plate's edge (under 0: on it).
 */
float floeAt(vec2 p, out vec2 normal) {
  normal = vec2(0,1);
  float dens = 0.58 * smoothstep(${(T2 + 8700).toFixed(1)}, ${(T2 + 8950).toFixed(1)}, p.y) * (1.0 - smoothstep(${(T2 + 9650).toFixed(1)}, ${(T2 + 10220).toFixed(1)}, p.y));
  vec2 q = p / 210.0;
  vec2 c = floor(q);
  vec2 hq = hash2(c + 7.0);
  if (hq.y > dens) return 1e3;
  // (Each rides the swell a little, and turns very slowly.)
  vec2 l = (fract(q) - 0.5 - (hq - 0.5) * 0.3) * 210.0 - vec2(sin(uTime * 0.11 + hq.y * 40.0), cos(uTime * 0.09 + hq.x * 31.0)) * 8.0;
  float ang = hq.y * 17.0 + uTime * 0.02 * (hq.x - 0.5);
  mat2 rotation = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  l = rotation * l;
  float big = fract(hq.x * 37.0);
  float sz = 12.0 + 42.0 * big * big;
  // (Four straight sides at angles of its own: a broken piece, no two alike.)
  float c1 = fract(hq.y * 13.0), c2 = fract(hq.x * 29.0);
  vec2 face = sign(l) * vec2(0.8 + 0.5*c1,0.42);
  float d = dot(l,face);
  vec2 side = vec2(0,sign(l.y)*(1.0+0.6*c2));
  if (dot(l,side) > d) { face = side; d = dot(l,side); }
  side = vec2(0.9,-0.3-0.6*c2);
  if (dot(l,side) > d) { face = side; d = dot(l,side); }
  side = vec2(-0.7,0.2+0.7*c1);
  if (dot(l,side) > d) { face = side; d = dot(l,side); }
  normal = face * rotation;
  return d - sz;
}
// The lee at this pixel: the shade it lays on the water is put on after the air.
float gLee = 0.0;
// How much of this pixel is open sea.
float gSea = 0.0;

/* ---------- the ribbon of light ---------- */

/**
 * Fine points of light, one to a cell, each coming and going in its own
 * time. p: a place, in cells. rad: a point's radius, in cells (never under a
 * pixel's, so a point is soft at any resolution).
 */
float motes(vec2 p, vec2 rad, float seed) {
  vec2 c = floor(p);
  vec2 h = hash2(c + seed);
  float life = fract(h.x * 61.7 + h.y * 17.3);
  vec2 dd = (fract(p) - (0.3 + 0.4 * h)) / rad;
  float tw = max(sin(uTime * (0.7 + 2.0 * life) + life * 50.0), 0.0);
  return exp(-dot(dd, dd)) * life * life * tw * tw;
}

/**
 * Soft discs of light along the far waterline: what a lens makes of glitter that is far out of focus. One to a
 * cell at most, each a round even disc with a slightly brighter rim, of its own size, coming and going slowly.
 * p: a place, in cells. px: a pixel, in cells (a disc's edge is never harder than that).
 */
float bokeh(vec2 p, float px, float seed) {
  vec2 c = floor(p);
  vec2 h = hash2(c + seed);
  float life = fract(h.x * 61.7 + h.y * 17.3);
  if (life < 0.42) return 0.0;
  float rad = 0.13 + 0.25 * h.x * h.x;
  vec2 at = vec2(rad) + (1.0 - 2.0 * rad) * vec2(h.y, fract(h.x * 13.7));
  float d = length(fract(p) - at) / rad;
  float tw = 0.5 + 0.5 * sin(uTime * (0.25 + 0.6 * h.y) + h.x * 40.0);
  float e = max(px / rad, 0.1);
  return (1.0 - smoothstep(1.0 - e, 1.0, d)) * (0.62 + 0.38 * smoothstep(0.55, 0.95, d)) * (life - 0.42) * 1.7 * (0.35 + 0.65 * tw * tw);
}

// Half the width of the ribbon's solid core, and how far from it any of its light reaches (radians, near enough).
const float RIB_W = 0.0027;
const float RIB_REACH = 0.13;
// The height (as a tangent) over which it turns from upright to its lean.
const float RIB_E0 = 0.1;
// The ribbon's own frame for the direction last asked: how high along it (the tangent of the height above the horizon), and how far off its centre line to the right.
vec2 gRib = vec2(0.0);
/**
 * The ribbon of light. The river's light leaves the water where the sea
 * meets the far shore and climbs: upright at its foot, leaning over as it
 * rises, up and out of the top of the frame. It is a shape in the sky, so a
 * mirror shows it too: asked with the mirror's direction it is its own
 * image on the water, which is the line of light the river ran out along.
 * Returns how far a direction is from its centre line (under 0: to its left).
 */
float ribbonAt(vec3 d) {
  float inv = inversesqrt(max(dot(d.xy, d.xy), 1e-6));
  vec2 dn = d.xy * inv;
  if (dot(dn, uRib.xy) < 0.8) return 1e3;
  float x = dn.x * uRib.y - dn.y * uRib.x;
  float e = abs(d.z) * inv;
  float q = e / RIB_E0;
  float root = sqrt(1.0 + q * q);
  float off = x - uRay.w * RIB_E0 * (root - 1.0);
  float slope = uRay.w * q / root;
  gRib = vec2(e, off);
  return off * inversesqrt(1.0 + slope * slope);
}
/** Its light at a distance from its centre line. x: the solid core, y: the glow round it. fat: how much wider it is (a mirror in moving water). */
vec2 ribbonLight(float dist, float fat) {
  // (Several pixels of solid light, a little heavier where it leaves the water; its edge is never harder than a pixel.)
  float w = RIB_W * mix(1.22, 0.86, smoothstep(0.0, 0.3, gRib.x)) + fat;
  float aa = max(0.42 * w, 0.9 * uPxAng);
  float a = abs(dist);
  float core = 1.0 - smoothstep(w - aa, w + aa, a);
  // (Its glow runs out to nothing well inside the strip it is drawn in.)
  float win = 1.0 - smoothstep(0.04, RIB_REACH, a);
  return vec2(core, (exp(-a / (w * 3.0)) * 0.3 + exp(-a / (w * 12.0)) * 0.075) * win);
}
/** The ribbon in the sky, as the eye sees it: the core, the glow, and the fine dust that drifts off it. */
vec3 ribbonSky(vec3 d) {
  float dist = ribbonAt(d);
  if (abs(dist) > RIB_REACH) return vec3(0.0);
  float e = gRib.x;
  float rise = uRay.y;
  // It is drawn from the water upward: its head climbs, and is the brightest of it while it does.
  float head = 0.012 + 0.33 * rise + 4.0 * smoothstep(0.92, 1.0, rise);
  float shown = (1.0 - smoothstep(head - 0.035, head, e)) * (1.0 - smoothstep(0.75, 1.2, e)) * smoothstep(0.0, 0.04, rise);
  if (shown <= 0.0) return vec3(0.0);
  vec2 l = ribbonLight(dist, 0.0);
  float tip = exp(-pow((e - head) / 0.024, 2.0)) * (1.0 - smoothstep(0.85, 1.0, rise));
  // (A slow shimmer runs up it.)
  float shim = 0.8 + 0.2 * n1(e * 44.0 - uTime * 0.6) + 0.12 * (n1(e * 9.0 - uTime * 0.17) - 0.5);
  // (Brightest where it leaves the water.)
  float foot = exp(-e / 0.03);
  // (Its head is a round light on its own line: the glow round the ribbon is not lit across its whole width there.)
  float light = l.x * (4.4 * shim + 4.0 * foot + 5.0 * tip) + l.y * (1.0 + 2.2 * foot) + exp(-dist * dist / 0.00016) * tip * 1.4;
  light += exp(-(e * e + gRib.y * gRib.y) / 0.0003) * 1.2;
  // The dust: fine points that leave the ribbon to either side and thin away, each coming and going.
  float a = abs(gRib.y);
  float dustK = (exp(-a / 0.017) + 0.5 * exp(-a / 0.006)) * (1.0 - smoothstep(0.05, 0.08, a)) * (0.55 + 0.45 * shim);
  if (dustK > 0.004) {
    float side = gRib.y < 0.0 ? 17.0 : 0.0;
    float px = uPxAng;
    float r0 = max(0.0006, 0.85 * px);
    float r1 = max(0.001, 0.85 * px);
    float r2 = max(0.0015, 0.85 * px);
    // (The finest of it is a grain that hugs the ribbon: many points, each small, so the cloud has weight without lumps.)
    float rf = max(0.00042, 0.8 * px);
    float dust = (motes(vec2(e, a) / 0.0017 - uTime * vec2(0.2, 0.12), vec2(rf / 0.0017), 61.0 + side) + motes(vec2(e, a) / 0.0017 - uTime * vec2(0.13, 0.17) + 0.5, vec2(rf / 0.0017), 83.0 + side)
      + motes(vec2(e, a) / 0.0021 - uTime * vec2(0.09, 0.2) + 0.25, vec2(rf / 0.0021), 97.0 + side)) * 2.4 * (0.00042 * 0.00042) / (rf * rf) * exp(-a / 0.02)
      + (motes(vec2(e, a) / 0.0028 - uTime * vec2(0.16, 0.1), vec2(r0 / 0.0028), 3.0 + side) + motes(vec2(e, a) / 0.0028 - uTime * vec2(0.11, 0.14) + 0.5, vec2(r0 / 0.0028), 47.0 + side)) * 2.2 * (0.0006 * 0.0006) / (r0 * r0)
      + motes(vec2(e, a) / 0.0058 - uTime * vec2(0.1, 0.07) + 0.37, vec2(r1 / 0.0058), 9.0 + side) * 2.6 * (0.001 * 0.001) / (r1 * r1)
      + motes(vec2(e, a) / 0.013 - uTime * vec2(0.06, 0.045) + 0.71, vec2(r2 / 0.013), 21.0 + side) * 1.5 * exp(-a / 0.03) / max(exp(-a / 0.017), 1e-3);
    light += dust * dustK * (1.0 + 1.5 * foot + 2.0 * tip);
  }
  return mix(vec3(1.0, 0.975, 0.94), vec3(1.0, 0.9, 0.7), 0.55 * foot) * (light * shown * uRay.z);
}

/**
 * The sea toward the light (the old ending's water, in this world). Ripples
 * that close up with distance, the sky and the ranges mirrored in them, a
 * dark body under the eye, the sun's path as glitter, and on the side the
 * words stand a lee: calmer water with no glitter in it. Where the camera
 * comes to rest the sea is still: a clean mirror out by the far shore, a
 * band of glitter along that shore, ripples only near the eye.
 * t: how far along the ray the water is. footL: a pixel's length on it.
 */
vec3 seaColor(vec2 pw, vec3 dir, float t, float footL) {
  float e = uSea.y;
  // The lee has no edge and no corner: it is deepest under the words and thins away from them in every direction,
  // to nothing at the horizon, so it is never seen as a shape. (uSea.w below zero: how high the words stand, on a wide screen.)
  float topV = uSea.w < -0.001 ? -uSea.w : 0.42;
  float lee = (1.0 - smoothstep(0.0, 1.0, length(max((vUv - vec2(uSea.z - 0.06, topV - 0.04)) / vec2(0.3, max(0.6 - topV, 0.1)), 0.0)))) * e;
  // (On a narrow screen the words run the width of the frame and stand at its foot: the line of light comes down to them and stops.)
  float leeFoot = step(0.001, uSea.w) * (1.0 - smoothstep(uSea.w - 0.02, uSea.w + 0.2, vUv.y)) * e;
  lee = max(lee, leeFoot);
  // How still the sea is: the ending's own water, as the camera settles on it.
  float still = e * gDusk;
  vec2 q = pw / SEA_S;
  float dist = length(pw - uCamPos.xy) / SEA_S;
  // (A ripple finer than a pixel is let go before it can shimmer.)
  float px = footL / SEA_S;
  float fine = 1.0 - smoothstep(0.05, 0.16, px);
  float broad = 1.0 - smoothstep(0.16, 0.5, px);
  float calm = (1.0 / (1.0 + dist * 0.07)) * (1.0 - 0.55 * lee);
  // (At rest there are ripples only near the eye, and they are gentle: further out the water is glass.)
  calm *= mix(1.0, 0.8 * exp(-dist * dist / 42.0), still);
  float tt = uTime * 0.32;
  vec2 qa = q * 1.7 + vec2(tt, 0.3 * tt);
  vec2 g = vec2(0.0);
  if (broad > 0.0 && calm > 1e-7) g = seaRelief(qa) * broad;
  // (A lean frame lets the finest ripples go.)
  fine *= 1.0 - gL2;
  if (fine > 0.0 && calm > 1e-7) {
    vec2 qb = q * 5.3 - vec2(0.2 * tt, tt);
    g += 0.5 * fine * seaSlope(qb, 0.06);
  }
  g *= 1.25 * calm;
  // At rest the near water is not glass and not a flat tone: a long slow swell passes under it, too low to break
  // the mirror by the far shore, and here and there a breath of air has roughened a patch, which lies a shade
  // lighter on the dark water and drifts. Under the words it is all but still.
  float paw = 0.0;
  float heave = 0.0;
  if (still > 0.0) {
    vec2 qs = q * 0.19 + vec2(0.011, 0.024) * uTime;
    vec2 sw = seaSlope(qs, 0.3);
    g += sw * (0.06 * still * exp(-dist * dist / 700.0) * (1.0 - 0.7 * lee));
    // (The swell's faces turned to the eye hold a breath more of the sky and those turned away a breath less: long soft bands, moving.)
    heave = clamp(sw.y * 5.0 + sw.x * 1.5, -1.0, 1.0) * exp(-dist * dist / 1500.0) * (1.0 - 0.45 * lee) * still;
    vec2 qp = q * vec2(0.085, 0.16) + vec2(0.006, -0.011) * uTime;
    paw = smoothstep(0.46, 0.76, 0.65 * n2(qp) + 0.35 * n2(qp * 2.7 + 3.1)) * exp(-dist * dist / 9000.0) * (1.0 - smoothstep(0.03, 0.12, px)) * (1.0 - 0.62 * lee) * still;
  }
  // (A touch on the water is the simulation's: its rings cross the sea too.)
  vec2 suv = simUv(pw);
  if (suv.y > 0.0 && suv.y < 1.0 && suv.x > 0.0 && suv.x < 1.0) g -= textureLod(uWave, suv, 0.0).ba * 7.0 * smoothstep(0.0, 0.03, suv.y) * (1.0 - smoothstep(0.97, 1.0, suv.y)) * smoothstep(0.0, 0.03, suv.x) * (1.0 - smoothstep(0.97, 1.0, suv.x));
  vec3 n = normalize(vec3(g, 1.0));
  vec3 r = reflect(dir, n);
  // (By day a sea is darker than the sky it meets: its waves turn the mirror up, past the pale air at the horizon to the blue above it.)
  // (At rest the water nearer the eye is darker of itself, as water is: the further under the horizon the eye looks,
  // the more its mirror is turned up past the gold to the deep of the sky. It is a level change, so it is the sea's
  // and no shape; where the words stand it comes a little sooner.)
  float dipK = -dir.z * inversesqrt(max(dot(dir.xy, dir.xy), 1e-6));
  r.z = abs(r.z) + 0.24 * (1.0 - gDusk) * (1.0 - uNight) + (0.32 * smoothstep(0.0, 0.32, dipK) + 0.09 * lee) * still;
  r = normalize(r);
  float cosi = clamp(dot(-dir, n), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  // (Still water gives the ranges back as sharp as they stand, and the sun as a soft light under them: its path is the glitter's to draw.)
  // (By day a moving sea does not hold the sun's glow as a smooth patch either: every facet throws it or does
  // not, and that is the glitter's to draw. The mirror keeps a little of the glow and none of the disc.)
  // (Before dawn it does, until the first light is on its way: then that light too is carried by glitter.)
  float blobN = uNight * (1.0 - smoothstep(0.0, 0.22, gDusk));
  gSunK = mix(mix(0.22, 1.0, blobN), 0.4, still);
  gDiscK = (1.0 - still) * blobN;
  vec3 refl = withRidges(r, 0.0, 1.0 - still, 0.0);
  gSunK = 1.0;
  gDiscK = 1.0;
  // Seen from above the water shows its depth; at a glancing angle, the sky.
  // (Before dawn the sea's own body is dark and without colour of its own: no green in it.)
  vec3 deep = mix(vec3(0.004, 0.026, 0.078), mix(vec3(0.008, 0.012, 0.026), vec3(0.005, 0.014, 0.05), gDusk), uNight);
  vec3 body = mix(deep * (0.5 + 0.5 * max(S.sun.z * 3.0, 0.3)), vec3(0.01, 0.07, 0.11) * (S.amb.b * 1.6 + 0.12), (1.0 - gDusk) * (1.0 - uNight));
  // (By day the sea is a rougher mirror than at the still ends of the day: more of its own deep colour shows.)
  float dayK = (1.0 - gDusk) * (1.0 - uNight);
  // (Late in the day it is a deep body with the pale sky only glancing on it: the sun's path is the one bright thing.)
  float mir = clamp(fres + 0.05, 0.0, 1.0) * (1.0 - 0.68 * dayK) * (1.0 - 0.12 * lee * still);
  vec3 col = mix(body, refl, mir);
  // (A roughened patch gives back a wider piece of the sky than a mirror does: a little of the lighter sky lower
  // down, in fine level streaks.)
  col *= 1.0 + 0.16 * heave;
  if (paw > 0.0) {
    float streak = 0.55 + 0.45 * n2(q * vec2(1.3, 7.0) + vec2(0.05, -0.2) * uTime);
    col += (S.mid * 0.5 + S.hor * 0.015) * paw * streak;
  }
  float inv = inversesqrt(max(dot(dir.xy, dir.xy), 1e-6));
  vec2 dn = dir.xy * inv;
  // (How far under the horizon the eye's ray dips, as a tangent.)
  float em = -dir.z * inv;
  float up = smoothstep(-0.02, 0.012, S.sun.z);
  float da = atan(dir.x, dir.y) - uShadow.z;
  float nearK = 1.0 / (1.0 + dist * 0.03);
  if (still < 1.0) {
    // Under way, the sea moves: sun glitter as a broken streak toward the sun.
    float sd = max(dot(r, S.sun), 0.0);
    float s90 = pow(sd, 90.0);
    float s900 = pow(sd, 900.0);
    // (By day almost none of it is a smooth lobe: a lobe on calm far water is a column of light standing on the sea.)
    col += vec3(1.0, 0.86, 0.62) * (s900 * 14.0 + s90 * mix(0.42, 0.55, uNight)) * mix(0.8, 1.0, uNight) * (1.0 - lee) * up * mix(0.6, 1.0, gDusk) * (1.0 - still) * mix(0.1, 1.0, blobN);
    // By day the broad lobe is held back and the light is carried by a path
    // of separate glints: wide and sparse near the eye, narrowing to a thread
    // at the horizon.
    float day = (1.0 - blobN) * up * (1.0 - still);
    if (day > 0.0) {
      // (A thread under the sun at the far shore, opening toward the eye: never a band of one width.)
      float wide = mix(0.009, mix(0.085, 0.11, gDusk), nearK * nearK) * mix(1.12, 1.0, gDusk);
      float path = exp(-da * da / (wide * wide));
      if (path > 0.003) {
        vec2 gq = q * vec2(30.0, 15.0);
        float sp = 0.6 * n2(gq + vec2(tt * 2.0, -tt * 3.0)) + 0.4 * n2(gq * 2.6 - vec2(tt * 3.0, tt));
        float lo = mix(0.5, 0.68, nearK);
        // Each glint has a soft shoulder: a spark on a ripple, not a cut-out.
        float glint = smoothstep(lo - 0.16, lo + 0.26, sp);
        glint *= glint;
        // Far off a ripple is finer than a pixel, and the light is still glitter: separate points, each a pixel
        // or two of the screen, coming and going, with dark water between them. (Level dashes laid out by
        // bearing and by how far under the horizon the eye looks, as on the still sea.)
        float farG = smoothstep(0.35, 1.1, px * 15.0);
        // (Before dawn the near ones are few and small: broad flashing faces belong to a sun that is up.)
        glint *= mix(1.0, 0.14 * smoothstep(0.55, 0.9, glint), uNight);
        if (farG > 0.0) {
          float r0 = max(0.0006, 0.85 * uPxAng);
          vec2 spA = vec2(sin(da), em);
          float fineG = (motes(spA / vec2(0.0085, 0.003) + vec2(0.0, uTime * 0.02), vec2(3.0 * r0 / 0.0085, r0 / 0.003), 5.0)
            + motes(spA / vec2(0.0085, 0.003) + vec2(0.5, 0.5 - uTime * 0.016), vec2(3.0 * r0 / 0.0085, r0 / 0.003), 31.0)
            + 0.7 * motes(spA / vec2(0.019, 0.0052) + vec2(0.3, uTime * 0.011), vec2(3.5 * r0 / 0.019, r0 / 0.0052), 13.0)) * (0.0006 * 0.0006) / (r0 * r0);
          glint = mix(glint, min(fineG * 2.6, 1.6), farG);
        }
        // The sun's reflected bloom is broken by the same facets, so it is not a patch. (It is taken away by as much
        // as the path is there: taken whole up to the path's edge, it left a seam down the water at that edge.)
        col = max(col - sunBloom(sd) * mir * mix(0.85, 0.3, gDusk) * (1.0 - glint) * day * smoothstep(0.003, 0.12, path), 0.0);
        col += mix(vec3(1.0, 0.76, 0.44), vec3(1.0, 0.88, 0.7), gDusk) * path * glint * mix(0.6, 0.42, nearK) * day * (1.0 - lee) * mix(20.0, 1.0, gDusk);
      }
    }
  }
  if (still > 0.0) {
    // At rest the light lies on the water in three ways, all of them fine points that come and go.
    // The sun's path: a thread under the sun at the far shore, opening toward the eye, never a patch.
    float xs = sin(da);
    float wS = 0.006 + 0.15 * em;
    float pathS = exp(-xs * xs / (wS * wS)) * step(0.0, cos(da)) * up * (1.0 - lee);
    // The ribbon's image, when it stands: its own glitter lies round it.
    float pathR = 0.0;
    float lineK = 0.0;
    vec3 line = vec3(0.0);
    if (uRay.z > 0.0 && vUv.x > uRib.z && vUv.x < uRib.w) {
      // (The mirror is the water's, ripples and all, but it is the river's light: it keeps to its line, carried a little by each ripple it crosses.)
      // (By the slow swell only: the fine ripples would notch its edge, and a notched edge at 2x is a stair.)
      vec3 rm = normalize(vec3(dir.xy, -dir.z) + vec3(g * 0.05, 0.0));
      float dR = ribbonAt(rm);
      if (abs(dR) < RIB_REACH) {
        float eR = gRib.x;
        // The line runs out across the water from under the eye to where the ribbon will stand.
        float run = smoothstep(0.0, 0.62, uRay.x);
        // (It sets out from the foot of the frame: no part of its run is spent out of sight.)
        float headM = mix(0.47, -0.05, run);
        float shownM = smoothstep(headM, headM + 0.045, eR) * (1.0 - leeFoot) * (1.0 - leeFoot);
        float tipM = exp(-pow((eR - headM - 0.02) / 0.03, 2.0)) * (1.0 - smoothstep(0.9, 1.0, run));
        // (A mirror in moving water is a little wider the nearer the eye.)
        vec2 l = ribbonLight(dR, 0.0045 * smoothstep(0.03, 0.4, eR));
        float shim = 0.8 + 0.2 * n1(eR * 44.0 - uTime * 0.6);
        float foot = exp(-eR / 0.03);
        // (Light lying on water: the faces turned to it carry it, the others a little less.)
        float carry = 0.7 + 0.3 * smoothstep(-0.02, 0.02, g.y);
        lineK = (l.x * (3.4 * shim * carry + 4.0 * foot + 5.0 * tipM) + l.y * (0.8 + 2.2 * foot) + exp(-dR * dR / 0.00016) * tipM * 1.4) * shownM;
        lineK += exp(-(eR * eR + gRib.y * gRib.y) / 0.0003) * 1.2 * smoothstep(0.0, 0.3, uRay.y) * shownM;
        line = mix(vec3(1.0, 0.975, 0.94), vec3(1.0, 0.9, 0.7), 0.55 * exp(-eR / 0.03)) * lineK * uRay.z;
        pathR = exp(-abs(gRib.y) / (0.004 + 0.05 * eR)) * shownM * uRay.z * (1.0 - smoothstep(0.03, 0.06, abs(gRib.y)));
        // (And its light lies on the water round it: a soft sheen that widens toward the eye and is gone well inside its strip.)
        line += vec3(0.62, 0.78, 1.0) * (0.05 * exp(-abs(dR) / (0.012 + 0.09 * eR)) * (1.0 - smoothstep(0.04, RIB_REACH, abs(dR))) * smoothstep(0.0, 0.5, uRay.y) * shownM * uRay.z);
      }
    }
    // The far shore: a band of glitter along the waterline, brightest under the light.
    float shore = exp(-em / 0.0075) * (0.22 + 0.78 * exp(-xs * xs / 0.05));
    float env = max(max(pathS, pathR), shore);
    if (env > 0.002) {
      float pa = uPxAng;
      float r0 = max(0.0006, 0.85 * pa);
      float r1 = max(0.001, 0.85 * pa);
      vec2 sp = vec2(xs, em);
      // (Near the eye a glint rides a ripple: it is brighter on the faces turned to the light.)
      float face = mix(1.0, smoothstep(-0.012, 0.03, g.y - abs(g.x) * 0.3) * 1.5, smoothstep(0.02, 0.2, em));
      // (A glint on water is a short level dash, not a dot: each is a few times as long as it is tall.)
      float fineG = motes(sp / vec2(0.0085, 0.003) + vec2(0.0, uTime * 0.012), vec2(3.0 * r0 / 0.0085, r0 / 0.003), 5.0) * (0.0006 * 0.0006) / (r0 * r0)
        + motes(sp / vec2(0.0085, 0.003) + vec2(0.5, 0.5 - uTime * 0.01), vec2(3.0 * r0 / 0.0085, r0 / 0.003), 31.0) * (0.0006 * 0.0006) / (r0 * r0);
      float bigG = motes(sp / vec2(0.026, 0.0068) + vec2(0.3, uTime * 0.008), vec2(4.5 * r1 / 0.026, r1 / 0.0068), 13.0) * (0.001 * 0.001) / (r1 * r1);
      // (Far off the points are finer than a pixel and run together: there the path is their even light.)
      float glint = fineG * mix(5.0, 3.0, smoothstep(0.0, 0.25, em)) + bigG * 4.5 * smoothstep(0.03, 0.22, em) * face;
      vec3 warm = mix(vec3(1.0, 0.9, 0.74), vec3(1.0, 0.9, 0.78), uNight);
      col += warm * S.band * 0.55 * glint * max(pathS, shore) * mix(1.0, 0.8, uNight) * still;
      col += vec3(1.0, 0.97, 0.92) * (glint * 0.8) * pathR * still;
    }
    // Along the far shore the glitter is far out of focus: soft discs of light lie in a band on the waterline,
    // most of them under the light, with a soft even glow behind them that has no edge.
    float band = exp(-em / 0.03) * (0.2 + 0.8 * exp(-xs * xs / 0.09)) * step(0.0, cos(da));
    if (band > 0.004) {
      float bk = bokeh(vec2(xs, em) / vec2(0.034, 0.017) + vec2(0.0, 0.11), uPxAng / 0.017, 7.0)
        + 0.7 * bokeh(vec2(xs, em) / vec2(0.019, 0.0095) + vec2(0.4, 0.23), uPxAng / 0.0095, 19.0);
      col += mix(vec3(1.0, 0.9, 0.74), vec3(1.0, 0.9, 0.8), uNight) * S.band * (0.27 * bk * smoothstep(0.0, 0.004, em) + 0.04 * exp(-em / 0.012)) * band * still;
    }
    // (A soft even light under the sun, so the path has a body between its points.)
    col += S.band * pathS * (0.05 + 0.1 * exp(-em / 0.05)) * still;
    col += line * still;
  }
  // Drift ice on the way out: each plate a hand of ice above the water, snow on its top, a blue wall on the side
  // the eye sees, and the pale skirt of the ice under water round it.
  if (pw.y < ${(T2 + 10230).toFixed(1)} && footL < 26.0) {
    const float FH = 5.5;
    vec2 sideGradient, topGradient;
    vec2 travel = dir.xy / max(-dir.z,0.02) * FH;
    float base = floeAt(pw, sideGradient);
    float top = floeAt(pw-travel, topGradient);
    float pxF = max(footL * 0.7, 0.25);
    float far = 1.0 - smoothstep(12.0, 26.0, footL);
    float aTop = (1.0 - smoothstep(-pxF, pxF, top)) * far;
    float aSide = (1.0 - aTop) * (1.0 - smoothstep(-pxF, pxF, base)) * far;

    // (Before dawn its snow takes the sky's cold light more than the first warm light: it is ice, not earth.)
    vec3 lightF = mix(S.key * 0.26 * 0.9 + S.amb * 0.85, vec3(dot(S.key, vec3(0.3333))) * vec3(0.9, 1.0, 1.15) * 0.3 + S.amb * 2.4 + S.mid * 0.5, uNight);
    col = mix(col, mix(vec3(0.16, 0.56, 0.6), vec3(0.03, 0.09, 0.1), uNight) * (S.amb * 1.5 + S.key * 0.12), (1.0 - smoothstep(0.0, 15.0, base)) * 0.55 * far);
    // Follow the same face from its foot along the reflected water ray.
    float approach = -dot(sideGradient, travel);
    float imageHeight = base / max(approach, 0.01);
    float image = base > 0.0 && approach > 0.0 ? far * (1.0-smoothstep(0.0,1.0,imageHeight)) : 0.0;
    if (aSide + image > 0.0) {
      vec3 normal = vec3(normalize(sideGradient),0.0);
      float height = clamp(abs(base)/max(abs(approach),0.01),0.0,1.0);
      vec2 point = pw + travel * (image > 0.0 ? height : -height);
      vec2 face = vec2(dot(point,vec2(-normal.y,normal.x)),height*FH);
      vec3 side = clearIce(normal, vec3(dir.xy,image > 0.0 ? -dir.z : dir.z), face,
        footL, FH*3.0, FH*(1.0-height), 1.0, 1.0-height, lightF*0.4, lightF, S.hor);
      col = mix(col,side,max(aSide,image*0.38));
    }
    // (Its top is wind-packed snow; its edge has been rounded and glazed by the swell.)
    float rim = 1.0 - smoothstep(0.0, 4.0, -top);
    // (Against the low light its thin edge glows: the light comes through it.)
    col = mix(col, mix(vec3(0.93, 0.94, 0.96), vec3(0.62, 0.72, 0.86), uNight) * (lightF + S.hor * 0.22 * uNight) * (1.0 - 0.22 * rim) + S.band * 0.16 * rim * gDusk, aTop);
    lee *= 1.0 - max(aTop, aSide);
    gMkFloe = max(aTop, aSide);
  }
  gLee = lee;
  return col;
}
#endif

#ifdef SEA
/**
 * The delta's bars late in the day. A bar is a low dome of snow: the low sun finds the rim turned to it, warm, and
 * the rim turned away lies in the bar's own blue shade. (sd: how far inside the shore; ba: the way the land rises.)
 */
vec3 deltaBar(vec3 col, float y, float sd, vec2 ba) {
  float k = smoothstep(${(DELTA.apex.y - 200).toFixed(1)}, ${(DELTA.y - 60).toFixed(1)}, y) * (1.0 - uNight) * (1.0 - gDusk);
  if (k <= 0.0) return col;
  float toSun = dot(-ba, uBearings.zw);
  float lit = smoothstep(0.05, 0.75, toSun) * (1.0 - smoothstep(3.0, 44.0, sd));
  // (Its shade keeps to the rim: a wide band of it round every bar is a smear, and it is the sky's blue, not mauve.)
  float lee = smoothstep(0.05, 0.75, -toSun) * (1.0 - smoothstep(6.0, 46.0, sd));
  col = mix(col, vec3(dot(col, vec3(0.3333))) * vec3(0.66, 0.8, 1.06), 0.62 * lee * k);
  // The broad shoulder receives the same key as the rest of the snow.
  return col * (1.0 + 0.12 * lit * k);
}
#endif

${STATION_COMMON}
#ifdef F_GLACIER
${GLACIER_ICE}
#endif
#ifdef F_FIELD
${NAME_ICE}
#else
float gNmCov = 0.0;
#endif
${SHALLOWS}
#ifdef F_COLS
${subjects.find(s => s.pass === 'columns')?.shader?.source ?? ''}
#endif
#if defined(F_DAM) || defined(F_LAT) || defined(F_CANYON)
${BOX_HIT}
#endif
#ifdef F_DAM
${subjects.find(s => s.pass === 'dam')?.shader?.source ?? ''}
#endif
#if defined(F_LAT) || defined(F_CANYON)
${SEG_D}
#endif
#ifdef F_LAT
${subjects.find(s => s.pass === 'lattice')?.shader?.source ?? ''}
#endif
#ifdef F_CANYON
${subjects.find(s => s.pass === 'canyon')?.shader?.source ?? ''}
#endif
#ifdef F_SHARDS
${subjects.find(s => s.pass === 'shards')?.shader?.source ?? ''}
#endif

${customSubjects.map(s => `#ifdef ${s.define}
${s.shader.source}
#endif`).join('\n')}
void main() {
  skyKey();
  gL1 = clamp(uLean, 0.0, 1.0);
  gL2 = clamp(uLean - 1.0, 0.0, 1.0);
  vec3 dir = normalize(vRay);
//#DBG_A
#ifdef DBG_EMPTY
  o = vec4(vUv, 0.5, 1.0);
  return;
#endif
#ifdef DBG_BED
  {
    float tb_ = uCamPos.z / max(-dir.z, 1e-4);
    vec4 bb_ = bedAt(uCamPos.xy + dir.xy * tb_);
    o = vec4(bb_.rgb * 0.01, 1.0);
    return;
  }
#endif
  vec3 col;
  // What the name's blocks need to know of the ground at this pixel: how far off its plane is, how much of the pixel is
  // the sheet's top (or land), and how far off the sheet's cut face is, where one is seen.
  float gndT = 1e9;
  float gndIce = 0.0;
  float gndWall = 1e9;

  // ---- the slab, in front of everything it covers
  float slabCov = 0.0;
  vec3 slabCol = vec3(0.0);
  float slabT = 1e9;
#if defined(F_SLAB)
  // Every vertex lies within one block width of its foot in plan.
  // Beyond this bound, even the nearest hit has completely faded.
  const float slabFadeEnd = 2500.0;
  bool slabNear = distance(uCamPos.xy,uSlabPos.xy) < slabFadeEnd + uSlabSize.x && uSlabSize.x > 0.0 && vUv.x > uSlabBox.x && vUv.x < uSlabBox.z && vUv.y > uSlabBox.y && vUv.y < uSlabBox.w;
  if (slabNear) {
    // Four rays to a pixel find how much of it the block covers (its edges
    // are geometry, so they are smoothed by counting). The ice itself is
    // worked out once for each face the pixel sees: one, or two at an arris.
    vec3 uvA = vec3(0.0);
    vec3 uvB = vec3(0.0);
    vec3 rdA = dir;
    vec3 rdB = dir;
    vec4 firstSample = vec4(0.0);
    bool firstShaded = false;
    vec4 hA = vec4(0.0); // face, distance, thickness, how many rays
    vec4 hB = vec4(0.0);
    for (int i = 0; i < 4; i++) {
      vec2 j = vec2(i == 0 || i == 3 ? 0.125 : -0.125, i < 2 ? 0.375 : -0.375);
      if (i == 1 || i == 3) j = j.yx;
      vec3 rd = normalize(dir + (uCamR * j.x + uCamU * j.y) * uPxAng);
      vec3 suv;
      float face;
      float t = slabHit(uCamPos, rd, suv, face);
      if (t > 0.0) {
        slabT = min(slabT, t);
        if (hA.w < 0.5 || face == hA.x) {
          if (hA.w < 0.5) { uvA = suv; rdA = rd; hA.xyz = vec3(face, t, gSlabThick); }
          hA.w += 1.0;
          if (i == 0) {
            firstSample = slabColor(suv,face,t,rd);
            firstShaded = true;
            // All four subpixel rays fit inside the same flat face. Its
            // wear mask is sampled once per face in either path.
            if (gSlabMargin > 2.0) { hA.w = 4.0; break; }
          }
        } else {
          if (hB.w < 0.5) { uvB = suv; rdB = rd; hB.xyz = vec3(face, t, gSlabThick); }
          hB.w += 1.0;
        }
      }
    }
    if (hA.w > 0.5) {
      gSlabThick = hA.z;
      vec4 sc = firstShaded ? firstSample : slabColor(uvA, hA.x, hA.y, rdA);
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
    slabCov *= 1.0 - smoothstep(2000.0, slabFadeEnd, slabT);
    // (And it stands in the valley's air like everything else at its distance: the hour's haze lies in front of it,
    // and the hour's mist, so far off it comes out of the air and is never a pale ghost of itself on a clear horizon.)
    if (slabCov > 0.0) {
      slabCol = mix(slabCol, airAt(dir.xy), airLoss(slabT));
      if (uAir.x > 0.0) {
        slabCol = mix(slabCol, mistColor(dir.xy), (1.0 - exp(-max(slabT - 420.0, 0.0) * uHour.w)) * 0.9 * uAir.x);
      }
    }
  }

#endif
#ifdef F_CANYON
  // (Between the canyon's walls: where ice stands on this line of sight, nothing behind it is worked out.)
  if (canyonEye()) canyonFirst(dir);
#endif
  if (slabCov > 0.999) {
    col = slabCol;
#ifdef F_CANYON
  } else if (gWallT >= 0.0) {
    col = vec3(0.0);
#endif
  } else if (dir.z > -0.0006) {
    // ---- above the horizon
    gDirect = true;
#ifdef DBG_NO_SKY
    col = vec3(0.5);
#else
    col = skyAll(dir, 1.0);
#endif
  } else {
    // (At the confluence the snowfield stands above the land: there the ground under the ray is higher.)
#ifdef F_CONF
    float t = (uCamPos.z - confLift(dir)) / -dir.z;
#else
    float t = uCamPos.z / -dir.z;
#endif
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
#if defined(F_ICE)
    bool hasIce = uIceOn > 0.5 && uIce.z > 0.0 && p.y > uLake.x - 80.0 && p.y < uLake.y + 80.0 && sd0 < 40.0;
    if (hasIce) {
      f0 = iceF(p, sd0, cr, il);
      gIceF = f0;
      // While the name stands it is a melt pond: its water lies flush with
      // the sheet, and nothing stands round it, so no edge of a letter is
      // lit or shaded differently from any other. (Only the name's own
      // water: a lead along a fracture shows the sheet's thickness from the
      // start. Once the ponds have run together they have melted through,
      // and the thickness stands round that opening too.)
      if (uIceN.y > 0.0) {
        // (Not where the name stands as plates: the water that opens under them is the lake's own, and the sheet's
        // thickness stands round it from the first.)
        gPond = uIceN.y * (1.0 - STANDING_NAME) * (1.0 - smoothstep(40.0 + uIceN.z, 130.0 + uIceN.z, gIceBoxD));
        gNameK = uIceN.y * (1.0 - smoothstep(0.0, 1500.0, gIceBoxD));
        gNameK *= gNameK;
        gFree *= 1.0 - gPond;
      }
      float iceH = uIceH * (1.0 - gPond);
      float aaI = 0.75 * foot / mix(1.0, sinE, 0.6);
      aIce = 1.0 - smoothstep(-aaI, aaI, f0);
      // The cut face and the sheet's shade lie within a known reach of the
      // edge (the field is a distance, near enough): past it, open water
      // is only open water, and the field is not asked again.
      // (While the name stands the wall's image in the water is looked for too, a little further out.)
      float reach = length(tilt) * iceH * (1.5 + 1.9 * smoothstep(0.75, 1.0, uGlow)) + 2.0 * aaI + 6.0;
      if (aIce < 1.0 && f0 < reach && gPond < 1.0) {
        vec3 c1;
        vec2 i1;
        vec2 pf = p + tilt * iceH;
        float f1 = iceF(pf, bedAt(pf).r, c1, i1);
        gIceF1 = f1;
        // (The field falls at the rate of 1 toward the wall the eye faces, and rises at it away from the edge behind.)
        gFarK = clamp((f0 - f1) / max(length(tilt) * iceH, 1.0), 0.0, 1.0);
        aCut = (1.0 - aIce) * (1.0 - smoothstep(-aaI, aaI, f1)) * smoothstep(0.0, 0.3, 1.0 - gPond);
        cutS = clamp(f0 / max(f0 - f1, 1e-3), 0.0, 1.0);
      }
    }

#endif
    // ---- the slab's shade and its own light on the ground round it
    float slabShade = 1.0;
    vec3 slabLight = vec3(0.0);
    float slabOn = 0.0;
#if defined(F_SLAB)
    if (uSlabSize.x > 0.0 && length(uCamPos.xy - uSlabPos.xy) < 5200.0) {
      vec2 ds = p - uSlabPos.xy;
      float dd = dot(ds, ds);
      float reach = uSlabSize.x * 4.0;
      if (dd < reach * reach) {
        slabOn = 1.0;
        // Only the land and its grounded shelf use the block's shadow.
        if (sd0 > -aa) {
          vec3 L = keyDir();
          vec3 suv;
          float face;
          // Three rays toward the light, a little apart: a soft-edged shadow.
          float sh = 0.0;
          // Only a strip down-light of the footprint can see the block.
          // Pad its cross-light radius for the two outer penumbra rays.
          vec2 keyXY = uBearings.zw;
          float radius = length(vec2(uSlabSize.x * 0.55, uSlabSize.z * 1.1));
          if (dot(ds, keyXY) <= radius && abs(dot(ds, vec2(-keyXY.y, keyXY.x))) <= radius + 0.031 * reach) {
            for (int i = 0; i < 3; i++) {
              vec3 l = normalize(L + vec3(-L.y, L.x, 0.0) * (float(i) - 1.0) * 0.03 + vec3(0.0, 0.0, (float(i) - 1.0) * 0.012));
              sh += slabHit(vec3(p, 0.5), l, suv, face) > 0.0 ? 1.0 : 0.0;
            }
          }
          slabShade = 1.0 - sh / 3.0 * mix(0.92, 0.5, uNight);
          // Where it stands on the ground the corner is dark.
          float along = clamp(dot(ds, uSlabDir.zw), -uSlabSize.x * 0.5, uSlabSize.x * 0.5);
          float dFoot = length(ds - uSlabDir.zw * along);
          slabShade *= 1.0 - 0.6 * exp(-dFoot / 9.0);
        }
        // The screen throws its light forward onto what lies before it.
        vec3 toP = vec3(ds, -uSlabSize.y * 0.5);
        float facing = max(dot(normalize(toP.xy + 1e-4), uSlabDir.xy), 0.0);
        slabLight = uSlabTint.rgb * facing * 9000.0 / (dd + 9000.0) * mix(0.05, 0.42, uNight);
      }
    }

#endif
    float aLand = smoothstep(-aa, aa, sd0);
    col = vec3(0.0);
#ifdef DBG_NO_LAND
    if (aLand > 0.0) col = vec3(0.8) * aLand;
#else
    if (aLand > 0.0) col = (landColor(p, sd0, b0.ba, foot, dir, slabShade) + slabLight * mix(0.5, 1.1, gRock)) * aLand;
#endif
#if defined(F_CONF)
    // (The snowfield climbs away from the low sun: its slopes stand in the sky's blue shade, their crests in the light.)
    if (gFieldG != 0.0) col *= mix(vec3(1.0), mix(vec3(0.74, 0.83, 0.96), vec3(1.06, 1.04, 1.0), smoothstep(0.1, -0.05, gFieldG)), (1.0 - uNight) * smoothstep(0.0, 0.03, abs(gFieldG)));
#endif
#ifdef SEA
    if (aLand > 0.0 && p.y > ${(DELTA.apex.y - 200).toFixed(1)} && sd0 < 100.0) col = deltaBar(col, p.y, sd0, b0.ba) * 1.0;
#endif
    // The island is ice-bound: a shelf of old blue ice stands round its shore, glazed, and before dawn it holds
    // the sky's light and the block's, so the island is never a dark shape on bright water.
    if (aLand > 0.0 && gRock > 0.0) {
      float shelf = (1.0 - smoothstep(16.0, 62.0, sd0 + 14.0 * (textureLod(uGrain, p / 900.0, 0.0).g - 0.5))) * smoothstep(0.0, 0.1, gRock);
      if (shelf > 0.0) {
        vec3 light = S.amb + S.key * 0.18 * slabShade + slabLight;
        vec3 shelfIce = clearIce(vec3(0,0,1), dir, p, foot, 38.0, sd0, 0.6,
          0.7, light * 0.32, light, S.hor);
        col = mix(col, shelfIce * aLand, shelf * 0.8);
      }
      col += (S.amb * 0.45 + uAurora * vec3(0.45, 0.72, 1.0) * 0.05) * uNight * (1.0 - shelf) * aLand * smoothstep(0.0, 0.1, gRock);
    }
    if (aLand < 1.0 && aIce < 0.999) {
      vec2 pw = p + tilt * gFree;
      vec4 bw = bedAt(pw);
      float aWall = smoothstep(-aa, aa, bw.r);
      gMkW = 1.0 - aWall;
      vec3 cut = vec3(0.0);
      if (aWall > 0.0) {
        // The visible wall turns from an undercut hollow into wet blue ice.
        float f = clamp(-sd0 / max(length(tilt) * gFree, 1.0), 0.0, 1.0);
        float af = clamp(1.2 * foot / gFree, 0.012, 0.22);
        vec3 nW = normalize(vec3(-bw.ba, 0.35));
        float alongB = dot(p, vec2(bw.a, -bw.b));
        vec4 gw = textureLod(uGrain, vec2(alongB / 180.0, f * 0.35), lodFor(foot, 180.0, 256.0));
        float underF = 0.28 + 0.21 * gw.g;
        vec3 lit = lightOn(nW,1.0);
        vec3 wall = clearIce(nW,dir,vec2(alongB,-f*gFree),foot,
          gFree*(0.8+3.0*f),1e3,0.85,f*f,lit*0.48,lit,S.hor);
        wall *= 0.74+0.26*smoothstep(underF-0.16-af,underF+0.16+af,f);
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
        // (By day the shallows along the coast stand in the same clear air as the deep beside them.)
        gSea = max(gSea, smoothstep(${(DELTA.sea - 300).toFixed(1)}, ${(DELTA.sea + 300).toFixed(1)}, pw.y) * (1.0 - gDusk) * (1.0 - uNight) * (1.0 - aWall) * (1.0 - aLand));
        cut += wc * (1.0 - aWall);
#elif defined(DBG_NO_WATER)
        cut += vec3(0.05, 0.2, 0.3) * (1.0 - aWall);
#else
        cut += (waterColor(pw, bw, dir, foot, footL, iceShade, slabOn) + slabLight * 0.26) * (1.0 - aWall);
#endif
      }
      col += cut * (1.0 - aLand);
    }
#if defined(F_ICE)
    if (aCut > 0.0) col = mix(col, iceCut(p, dir, foot, cutS, length(tilt) * uIceH * (1.0 - gPond) / max(foot / sinE, 1e-3)), aCut);
    // (Where the name's swept field lies over all of this pixel the sheet's own top is not seen: it is not worked out.)
#if defined(DBG_NO_NAME) || !defined(F_FIELD)
    const float nmK = 0.0;
#else
    float nmK = nameCover(p, dir, foot);
    gSnowWas = gNfSnow.xyz;
    gSnowHad = gNfSnow.w;
#endif
#ifdef DBG_NO_ICETOP
    if (aIce > 0.0) col = mix(col, vec3(0.7), aIce);
#elif defined(DBG_ALL_ICETOP)
    if (aIce > 0.0) col = mix(col, iceTop(p, il, cr, f0, sd0, dir, foot), aIce);
#else
    if (aIce > 0.0 && !(aIce >= 1.0 && nmK >= 1.0)) col = mix(col, iceTop(p, il, cr, f0, sd0, dir, foot), aIce);
#endif
    // The name's blocks stand on the sheet: their shade, their image and the meltwater at their feet lie on it.
#if defined(F_FIELD) && !defined(DBG_NO_NAME)
    col = nameGround(col, p, dir, foot, aIce);
#endif
#endif
    gMkW *= (1.0 - aLand) * (1.0 - aIce) * (1.0 - aCut) * (1.0 - gMkFloe);
    gMkG = 1.0;
    gndT = t;
    gndIce = max(aIce, aLand);
    if (aCut > 0.5) gndWall = t + cutS * uIceH / sinE;

    // ---- the air: haze that lies low and thickens with distance. From
    // high up the ray crosses less of it; near the ground it hides the far
    // end of the world.
    float fog = airLoss(t);
    // (Water the air has all but hidden is not open water to the eye.)
    gMkW *= 1.0 - smoothstep(0.3, 0.75, fog);
    // (Before dawn the air over the name is clear: the ice round a mirror of the sky is the darkest on the lake.)
    fog *= 1.0 - 0.8 * uNight * gNameK * max(aIce, gPond);
    // (And by day the cold air over the far lake's bare ice is clear enough to leave its mirror something to show.)
    fog *= 1.0 - 0.45 * gFarMir * aIce;
    vec3 air = airAt(dir.xy);
    // (Before dawn the ground's haze is the cold air, warmed only toward the light.)
    air = mix(air, mix(S.hor, air, 0.45), uNight);
    // (The cut water close under the eye is kept out of the haze: the name is the darkest thing in the frame.)
    float clearK = gDeep * (1.0 - aLand) * (1.0 - aIce) * (1.0 - aCut) * (1.0 - smoothstep(4200.0, 7000.0, t));
#ifdef SEA
    // (Over the open sea at the end of the day the air is clearer: the water keeps its depth out to the mist on the horizon.)
    // (And where the camera comes to rest the far water is a mirror: almost none of the air lies on it, so the ranges stand in it whole.)
    // (Late in the day, before the blue hour, it is clearest of all: a deep sea under the low sun, not a pale band.)
    float stillM = uSea.y * gDusk * gSea;
    col = mix(col, air, fog * (1.0 - clearK) * (1.0 - gSea * mix(mix(0.82, 0.55, gDusk), 0.94, uSea.y * gDusk)));
#else
    col = mix(col, air, fog * (1.0 - clearK));
#endif
    // The hour's mist. It lies low, in a layer a few times a man's height, thickest over the water and along its
    // banks, in long banks with thinner air between; near the eye there is none, and it gathers with distance until
    // the far reach is lost in it. It is lit by whatever lights the ground.
    if (uAir.x > 0.0 && t > 420.0) {
      float overW = 1.0 - smoothstep(0.0, 520.0, sd0);
      float bankM = 0.72 + 0.28 * sin(p.x * 0.0029 + 1.7 * sin(p.y * 0.0021 + uTime * 0.012) + uTime * 0.008);
      float mistK = (1.0 - exp(-max(t - 420.0, 0.0) * uHour.w * bankM)) * mix(0.25, 1.0, overW) * uAir.x;
      col = mix(col, mistColor(dir.xy), mistK * 0.9 * (1.0 - clearK));
    }
    // The horizon is soft: the same mist that lies at the ranges' foot.
#ifdef SEA
    // (Over the still sea it is a fine line of mist on the waterline, no more: the mirror begins right under it.)
    // (At rest: the haze the ranges stand in lies on the far water too, and thins toward the eye with no edge.)
    col = mix(col, air, mix(exp(dir.z / 0.006) * 0.75, exp(dir.z / 0.007) * 0.17 + exp(dir.z / 0.02) * 0.12, stillM));
#else
    col = mix(col, air, exp(dir.z / 0.006) * 0.75);
#endif
#ifdef F_CONF
    // The cliff at the confluence and its falls stand in front of what lies behind them.
    vec3 mkBefore = col;
    col = confCliff(col, dir, aLand);
    gMkW *= 1.0 - mkChg(mkBefore, col);
#endif
#ifdef SEA
    // The lee's shade, on the water the words stand over, while the camera is still coming in. (At the ending there is
    // none: the water there is dark of itself, it mirrors the deep of the sky, and the lee only keeps it calm.)
    col *= 1.0 - 0.56 * (1.0 - gDusk) * gLee;
#endif
  }
#if defined(F_POOL)
  // The boulders of the rock pool stand in front of its water and its far bank.
  if (poolNear()) {
    vec3 nR;
    float tR = rockHit(uCamPos, dir, nR);
    if (tR > 0.0) {
      vec3 hp = uCamPos + dir * tR;
      float aR = gRockA * smoothstep(0.0, 1.5 * tR * uPxAng, hp.z + FREEBOARD);
      if (aR > 0.0) col = mix(col, rockColor(hp, nR, tR), aR);
      gMkOcc = max(gMkOcc, aR);
    }
  }
#endif
#if defined(F_FIELD) && !defined(DBG_NO_NAME)
  vec3 mkName = col;
  col = nameIce(col, dir, gndT, gndIce, gndWall);
  gMkOcc = max(gMkOcc, mkChg(mkName, col));
#endif
#ifdef F_SHARDS
  if (uShardOn > 0.5) {
    vec4 pl = pulseAt();
    vec3 L = keyDir();
    // Where this pixel's ray meets the water, if it does.
    float tw = dir.z < -0.0006 ? (uCamPos.z + FREEBOARD) / -dir.z : -1.0;
    vec3 pwp = uCamPos + dir * max(tw, 0.0);
    vec2 te = (pwp.xy - vec2(${TARN.x.toFixed(1)}, ${TARN.y.toFixed(1)})) / vec2(${TARN.rx.toFixed(1)}, ${TARN.ry.toFixed(1)});
    // (The bay where the river comes in is the tarn's water too: the shards' images reach across it toward the eye.)
    float onTarn = tw > 0.0 ? max(1.0 - smoothstep(0.86, 1.0, length(te)), 1.0 - smoothstep(0.82, 0.98, length(pwp.xy - vec2(${TARN_BAY.x.toFixed(1)}, ${TARN_BAY.y.toFixed(1)})) / ${TARN_BAY.r.toFixed(1)})) : 0.0;
    // (Before dawn the tarn is the night's own water: dark, deep and still, with the sky lying in it. Nothing is
    // laid over it, or over the country beyond it, to make it so: that shade stood behind the next station's words as a scrim.)
    vec3 rings = vec3(0.0);
    if (onTarn > 0.0) {
      rings = pulseRings(pwp.xy) * onTarn;
      // Water takes no sharp shadow: where each shard keeps the low sun off it, the water only gives back a little less sky,
      // in a long soft lane that widens and fades away from the shard's foot.
      if (uNight < 1.0 && L.z > 0.02) {
        vec2 away = -uBearings.zw;
        float shd = 0.0;
        for (int i = 0; i < 2; i++) {
          vec4 s = i == 0 ? SH0 : SH1;
          vec2 d = pwp.xy - s.xy;
          float al = dot(d, away);
          float reach = s.z / max(L.z, 0.08) * length(L.xy);
          float wd = s.w * 0.9 + al * 0.16;
          float sd = dot(d, vec2(-away.y, away.x)) / max(wd, 1.0);
          shd += smoothstep(-s.w, s.w * 2.0, al) * (1.0 - smoothstep(reach * 0.25, reach, al)) * exp(-sd * sd * 1.4);
        }
        col *= 1.0 - 0.2 * min(shd, 1.0) * (1.0 - uNight) * onTarn;
      }
      // The rings: light on the faces turned to the sky, shade behind them.
      vec3 pc = mix(vec3(0.62, 0.86, 0.95), vec3(0.45, 1.0, 0.92), uNight);
      col += pc * max(rings.z, 0.0) * mix(0.5, 0.3, uNight);
      col *= 1.0 + min(rings.z, 0.0) * mix(0.42, 0.3, uNight);
      // The pulse itself: a bead of light skimming the water, its tail behind it.
      vec2 A = SH0.xy;
      vec2 B = SH1.xy;
      vec2 ab = normalize(B - A);
      vec2 pp = mix(A, B, pl.x);
      vec2 rel = pwp.xy - pp;
      bool back = mod(uTime, 7.0) >= 3.5;
      float along = dot(rel, ab) * (back ? 1.0 : -1.0);
      float side = dot(rel, vec2(-ab.y, ab.x));
      float bead = exp(-dot(rel, rel) / 170.0) * 3.6 + exp(-dot(rel, rel) / 2400.0) * 0.6;
      float tail = along > 0.0 ? exp(-along / 170.0) * exp(-side * side / (30.0 + along * 0.9)) * 0.9 : 0.0;
      // (The way between the two is a hair of light on the water: it is there at every moment, and the message is the bright place on it.)
      float span = dot(pwp.xy - A, ab);
      float seam = exp(-side * side / (5.0 + 0.9 * tw * uPxAng * tw * uPxAng)) * smoothstep(0.0, 40.0, span) * (1.0 - smoothstep(length(B - A) - 40.0, length(B - A), span)) * (0.55 + 0.45 * sin(span * 0.09 - uTime * 2.4 * (back ? -1.0 : 1.0)));
      // (By day it is white on the water, a dark ring of its own shade round it: it reads on a bright tarn as on a dark one.)
      col *= 1.0 - 0.3 * exp(-dot(rel, rel) / 1500.0) * (1.0 - exp(-dot(rel, rel) / 260.0)) * pl.w * (1.0 - uNight) * onTarn;
      col += mix(vec3(0.9, 0.97, 1.0) * 1.25, pc, uNight) * ((bead + tail) * pl.w + seam * mix(0.16, 0.22, uNight)) * onTarn;
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
        gMkOcc = 1.0;
      } else if (onTarn > 0.0) {
        // Its mirror image in the still water: clean, until a ring crosses it.
        // (Clean at the shard's foot, bent by the tarn's slow swell further out, and broken where a ring crosses it.)
        vec3 rd2 = reflect(dir, normalize(vec3(-rings.xy * 9.0 - tarnSwell(pwp.xy), 1.0)));
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
      // (Before dawn it is a small glow close round the lit thread, not a haze over the whole shard.)
      if (alongC > 0.0) col += vec3(0.25, 0.7, 0.8) * glow * mix(0.05, 0.06, uNight) * exp(-length(c - dir * alongC) / (s.w * mix(1.9, 1.1, uNight))) * mix(0.3, 1.0, uNight);
      // And on the water at its foot.
      if (onTarn > 0.0) {
        float df = length(pwp.xy - s.xy);
        col += vec3(0.2, 0.68, 0.82) * glow * exp(-df / (s.w * 2.2)) * mix(0.05, 0.2, uNight) * onTarn;
      }
    }
  }
#endif
#ifdef F_STATION
  if (uSt.x + uSt.y + uSt.z + uSt.w > 0.0) {
    float twS = dir.z < -0.0006 ? (uCamPos.z + FREEBOARD) / -dir.z : -1.0;
    gSt = smoothstep(0.0, 0.3, uSt);
${subjects.flatMap(s => s.proximity && s.shader ? [`#ifdef ${s.define}
    if (uSt.${'xyzw'[s.proximity.lane]} > 0.0) col = ${s.shader.fn}(col, dir, twS);
#endif`] : []).join('\n')}
  }
#endif
${customSubjects.map(s => `#ifdef ${s.define}
  col = ${s.shader.fn}(col, dir, ${s.event ? 'uProgress_' + s.define : '0.0'});
#endif`).join('\n')}
  float mkOver = max(gMkOcc, slabCov);
  if (slabCov > 0.0 && slabCov <= 0.999) col = mix(col, slabCol, slabCov);
#ifdef SEA
  // The ribbon of light stands in front of the ranges: it is only looked for in the strip of the frame it can be in.
  if (uRay.z > 0.0 && dir.z > -0.0006 && vUv.x > uRib.z && vUv.x < uRib.w) col += ribbonSky(dir);
#endif

//#DBG_B
  // ---- the finish, in this same pass: the glow of the last frame's
  // highlights, a gentle vignette, the filmic curve, and a fine grain that
  // moves (it is also the dither).
  col = max(col, 0.0);
  // (Before dawn, while the name is cut in the sheet, the letters are light in a slot, not a lamp: they throw almost no halo over the ice.)
  if (uBloom > 0.0) col += textureLod(uGlowTex, vUv, 0.0).rgb * uBloom * (1.0 - 0.86 * uNight * smoothstep(0.75, 1.0, uGlow)) * (1.0 - 0.85 * gNmCov);
  vec2 vc = vUv - 0.5;
  col *= 1.0 - dot(vc, vc) * uFilm.x;
  // The words' lee. Where words stand the picture keeps itself readable
  // behind them, softly: under dark words nothing is left darker than a
  // light haze, under light words nothing brighter than a deep shade. Only
  // the pixels that would fight the words are touched, and the edge of the
  // lee is wide and soft, so it reads as air and shade, never as a plate.
  // (Most of the frame is nowhere near them: it is let go at once.)
  // (The ending's words need none of it: they stand over the near sea, which is deep and dark of itself. Nothing is
  // laid over that picture.)
  // The falloff follows an ellipse around the ink. Its centre has no flat plateau,
  // and the density falls to zero before the support boundary.
  if (uCalmK.x > 0.0 && uCalmK.y < 0.5) {
    vec2 q = (vUv - uLee.xy) * uLee.zw;
    float r2 = dot(q, q);
    float ck = (1.0 - smoothstep(0.0, 4.0, r2)) * uCalmK.x;
#ifdef F_FIELD
    // Above the hero copy, keep the bare, transmitting sheet out of the
    // snow fill. Keep its full strength on the words and their margin.
    ck *= 1.0 - gNfK * smoothstep(0.012, 0.085, vUv.y-uCalmBox.w);
#endif
    if (ck > 0.002) {
      float l = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
      float shadeK = uNight;
      float CAP = clamp(S.key.g * 0.8 - 0.08, 0.038, 0.084);
      float FLOOR = 0.165 + 0.08 * uHour.z;
      float capped = 0.5 * (l + CAP - sqrt((l - CAP) * (l - CAP) + 0.09 * CAP * CAP));
      float lifted = 0.5 * (l + FLOOR + sqrt((l - FLOOR) * (l - FLOOR) + 0.09 * FLOOR * FLOOR));
      col *= mix(1.0, capped / l, ck * shadeK);
      col += (lifted - l) * vec3(0.95, 1.0, 1.07) * ck * (1.0 - shadeK);
    }
  }
  // The captions' lee: the same rule behind the small captions that stand at their points, held closer round them:
  // only what would fight a caption is touched, by as little as lets it be read.
  if (uCapK > 0.0) {
    vec2 q = (vUv - uCapBox.xy) * uCapBox.zw;
    float ck = (1.0 - smoothstep(0.0, 3.0, dot(q, q))) * uCapK;
    if (ck > 0.002) {
      float l = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
      const float CAP = 0.082;
      const float FLOOR = 0.165;
      float capped = 0.5 * (l + CAP - sqrt((l - CAP) * (l - CAP) + 0.09 * CAP * CAP));
      float lifted = 0.5 * (l + FLOOR + sqrt((l - FLOOR) * (l - FLOOR) + 0.09 * FLOOR * FLOOR));
      col *= mix(1.0, capped / l, ck * uNight);
      col += (lifted - l) * vec3(0.95, 1.0, 1.07) * ck * (1.0 - uNight);
    }
  }
  if (uMaskOut > 0.5) {
    float mkLee = 0.0;
    if (uCalmK.x > 0.0) {
      vec2 q = (vUv - uLee.xy) * uLee.zw;
      mkLee = (1.0 - smoothstep(0.0, 4.0, dot(q, q))) * uCalmK.x;
    }
    if (uCapK > 0.0) {
      vec2 q = (vUv - uCapBox.xy) * uCapBox.zw;
      mkLee = max(mkLee, (1.0 - smoothstep(0.0, 3.0, dot(q, q))) * uCapK);
    }
    o = vec4(gMkW * (1.0 - mkOver), max(gMkG, mkOver), mkLee, 1.0);
    return;
  }
  mediump vec3 xa = min(col * 1.12, 64.0);
  // Display-referred fit to the filmic response: a lifted toe, a long shoulder
  // below display white, and the transfer to screen space in one quotient.
  mediump vec3 display = 0.994 - 0.9813 / (1.0 + xa * (6.0 + 4.2 * xa));
  // Interleaved gradient noise in display space. The offset advances the grain without moving the scene.
  float gn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)) + uFilm.y)) - 0.5;
  mediump float lum = dot(display, vec3(0.3, 0.6, 0.1));
  display += gn * (1.4 / 255.0 + uFilm.z * (0.35 + 1.3 * min(lum, 1.0 - lum)));
  o = vec4(display, 1.0);
}`;
