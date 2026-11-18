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
import { NAME_ICE } from './name';
import { CANYON_ICE, COLUMNS, DAM_ICE, DAM_WATER, LATTICE_ICE, STATION_COMMON } from './stations';
import { PANO, SHADE_AZ, WIND } from './terrain';
import { BASIN, BOARD, BOARD_DEPTH, boardSpan, CONF_RIVER, FIELD_ROLL, CONF_Y, DELTA, ISLAND, LAKE, LIP, lipY, OUTLET, POOL, ROCK_FACES, rockFaces, ROCKS, SHARDS, SHEET, slabFaces, STREAM, T2, TARN, TARN_BAY, TRIBS } from '../world';

/** The water sits this far below the land, world units. */
export const FLIGHT_FREEBOARD = 22;

/** The way from the snow's first baked bearing to its second, over its own length squared: what a bearing between them is measured along. */
const shD = (() => {
  const d = [Math.sin(SHADE_AZ.b) - Math.sin(SHADE_AZ.a), Math.cos(SHADE_AZ.b) - Math.cos(SHADE_AZ.a)];
  const l = d[0] * d[0] + d[1] * d[1];
  return [d[0] / l, d[1] / l];
})();

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
uniform vec4 uCapBox;      // where the captions tied to their points stand, in vUv: x0, y0, x1, y1
uniform float uCapK;       // 0..1 how much the picture is calmed behind them
uniform vec4 uRay;         // the ribbon of light at the ending. x: 0..1 how far its line has run out across the water, y: 0..1 how far it has risen from it, z: its strength (0: not there), w: how far it leans as it climbs, and which way
uniform vec4 uRib;         // xy: the bearing its foot stands on (a unit vector on the ground), zw: the strip of the frame it can be in (u from, u to)

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
uniform sampler2D uGround; // the baked snow: its slope, and its horizon toward each of two lights
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
  return S.band * (a * 0.07 * (1.0 - 0.7 * gDusk * (1.0 - uNight)) + b * 0.22 + c * 0.5 + e * 0.5);
}

/** The colour of the air at the horizon toward a bearing: what distance fades to. */
vec3 airAt(vec2 dxy) {
  float a = max(dot(normalize(dxy + 1e-5), normalize(S.sun.xy)), 0.0);
  return S.hor + S.band * (pow(a, 5.0) * 0.3 + pow(a, 2.0) * 0.08) * mix(0.5, 1.0, max(uNight, gDusk));
}

/**
 * The aurora, before dawn. Three curtains hang across the north, one behind
 * another: a far one low over the ranges, one in the middle of the sky, and
 * a near one high overhead. Each is a thin sheet of rays seen from below:
 * a sharp lower border, wandering in slow folds, and from it fine upright
 * rays of very different lengths that fade into red and violet as they
 * climb. It is bright only in its rays; between them, and between its
 * folds, the sky is dark and the stars show. Where a fold turns along the
 * line of sight the sheet is seen edge on and its light piles up. The rays
 * drift, and a ripple runs along each border.
 * Nothing in it can clip: its light is bounded below white.
 */
// A dull mirror (the ice) shows the aurora without its fine rays: the curtains' broad light alone.
bool gDull = false;
// 0..1: how much of the sky's own detail this pixel sees (1 the sky itself, 0 a mirror's picture of it).
float gSkyQ = 1.0;
// The bearing of the ray the night sky is being asked about: worked out once, for the curtains and the stars.
float gAz = 0.0;
vec3 aurora(vec3 d) {
  float h = max(d.z, 0.0);
  if (h > 0.985) return vec3(0.0);
  float az = gAz;
  // (A mirror that has been asked to be lean, and the ice, see the curtains without their finest work.)
  float soft = gDull ? 1.0 : gWash;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    // (Each curtain is only looked for where it can be: no more than two of them stand on any line of sight.)
    if (i == 0 ? h > 0.34 : (i == 1 ? (h < 0.09 || h > 0.75) : h < 0.34)) continue;
    // (The curtain overhead is the faintest, and a mirror shows it only steeply under the eye, where water and ice
    // are least a mirror: it is left to the sky itself.)
    if (i == 2 && (gDull || gSkyQ <= 0.0)) break;
    float k = float(i) * 0.5;
    float a = az * (1.0 - 0.2 * k) + k * 3.8;
    // Its border: a slow fold, a quicker one, and a ripple that runs along it.
    float p1 = a * (1.9 + 0.8 * k) + 0.6 + 2.3 * k + uTime * 0.028;
    float amp = 0.03 + 0.05 * k;
    float s1 = sin(p1);
    float hem = (0.064 + 0.14 * k + 0.24 * k * k) + amp * s1;
    float tall = 0.085 + 0.2 * k;
    // (Its rays' tips thin out before the next curtain's border.)
    float top = i == 0 ? 1.0 - smoothstep(0.22, 0.34, h) : (i == 1 ? 1.0 - smoothstep(0.55, 0.75, h) : 1.0);
    // Overhead the rays are seen from below, along their length: dimmer, and running together.
    float gain = (0.34 - 0.12 * k) * (1.0 - 0.7 * smoothstep(0.55, 0.95, h)) * top;
    float fr = 46.0 - 26.0 * k;
    if (soft >= 1.0) {
      // The curtain's broad light alone: its border, its bundles, its colour.
      float upS = h - hem;
      if (upS < -0.03) continue;
      float bunS = n1(a * fr * 0.6 + uTime * 0.03 + 5.0 * k);
      float tS = max(upS, 0.0) / tall;
      vec3 tintS = mix(vec3(0.17, 0.95, 0.52), vec3(0.3, 0.3, 0.8), smoothstep(0.15, 1.6, tS));
      sum += tintS * smoothstep(-0.03, 0.01, upS) * exp(-max(upS, 0.0) / (tall * (0.5 + 0.9 * bunS))) * (0.3 + 0.7 * bunS) * 0.62 * gain;
      continue;
    }
    // (A mirror's picture of it keeps the slow fold and lets the border's small ripples go.)
    if (gSkyQ > 0.0) hem += 0.02 * sin(a * 5.3 - uTime * 0.05 + 4.0 * k) + 0.008 * (1.0 + k) * sin(a * 14.0 - uTime * 0.5 + 1.7 * k);
    float up = h - hem;
    if (up < -0.07) continue;
    // Where it hangs at all: in lengths, with clear sky between them.
    float fold = n1(a * 3.1 + uTime * 0.02 + k * 14.0);
    float reach = i == 0 ? smoothstep(0.2, 0.62, fold + 0.25 * s1) : smoothstep(0.34, 0.74, fold - 0.22 * s1);
    if (reach <= 0.0) continue;
    // Its rays: bundles, and the fine upright threads the bundles are made of. (One read of the baked grain, along a
    // slanting line so the pattern never comes round: its broad field is the bundles, its fine one the threads.)
    vec4 rg = textureLod(uGrain, vec2(a * fr * 0.0625 + fold * 0.56 + uTime * 0.007, a * fr * 0.008 + k * 0.37 - uTime * 0.0026), 0.0);
    float bun = smoothstep(0.4, 0.78, rg.g);
    float thr = 0.2 + 0.8 * smoothstep(0.1, 0.52, rg.a);
    // (Only the sky itself shows the finest threads: a mirror's picture of them would shimmer.)
    thr *= gSkyQ > 0.0 ? 0.7 + 0.3 * rg.r : 0.85;
    thr = mix(thr, 0.55, soft);
    float ray = (0.1 + 0.9 * bun * bun) * (0.16 + 0.84 * thr * 1.8);
    // (A bright bundle stands taller than a faint one: the curtain's top is its rays' own tips.)
    float len = tall * (0.3 + 1.25 * bun);
    // Edge on at a fold's turn, the light piles up.
    float pile = 1.0 + 0.45 * sqrt(max(1.0 - s1 * s1, 0.0));
    // (The border is sharp under a bright bundle and soft under a faint one: it is never one ruled arc.)
    float border = smoothstep(-0.006 - 0.012 * soft - 0.03 * (1.0 + k) * (1.0 - bun), 0.004, up);
    float prof = border * (exp(-max(up, 0.0) / len) + 0.3 * bun * exp(-max(up, 0.0) / (0.02 + 0.02 * k)));
    // Green at the border; then teal, violet and, at the tips of the tallest rays, deep red.
    float t = max(up, 0.0) / tall;
    vec3 tint = mix(vec3(0.17, 0.95, 0.52), vec3(0.24, 0.42, 0.9), smoothstep(0.15, 1.05, t));
    tint = mix(tint, vec3(0.62, 0.16, 0.5), smoothstep(0.8, 2.3, t));
    // (Under the brightest of the border, a thin rose fringe.)
    if (gSkyQ > 0.0) tint = max(tint + vec3(0.5, -0.25, 0.1) * (1.0 - smoothstep(-0.007, 0.006, up)) * bun, 0.0);
    sum += tint * prof * ray * pile * reach * gain;
  }
  // Nothing of it toward the dawn.
  float dawn = max(dot(normalize(d.xy + 1e-5), normalize(S.sun.xy)), 0.0);
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
  vec3 col = mix(S.hor, S.mid, smoothstep(0.0, mix(0.24, mix(0.17, 0.2, gDusk * (1.0 - uNight)), max(uNight, gDusk)), h));
  col = mix(col, S.zen, smoothstep(0.07, 0.62, h));
  float az = max(dot(normalize(d.xy + 1e-5), normalize(S.sun.xy)), 0.0);
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
  col += vec3(1.0, 0.9, 0.7) * disc * (1.0 - uNight * (1.0 - gDusk)) * gSunK * gDiscK;
#else
  col += vec3(1.0, 0.9, 0.7) * (smoothstep(0.9996, 0.99999, sd) * 2.4 + smoothstep(0.9999, 1.0, sd) * 1.6) * (1.0 - uNight * (1.0 - gDusk)) * gSunK;
#endif
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
    if (gDirect) col += starSky(d) * uNight * (1.0 - gDusk) * (1.0 - gDusk) * (1.0 - min(dot(au, vec3(2.2)), 0.88));
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
    float lod = log2(max(uPxAng * float(textureSize(uPano, 0).x) / (2.0 * PANO_AZ), 1.0)) + soft;
    vec4 m = textureLod(uPano, uv, lod);
    float cover = 1.0 - smoothstep(0.86, 0.97, m.a);
    if (cover > 0.0) {
      // (By day snow holds only on the easier slopes: the steep faces are bare rock, which is what gives a range its drawing.)
      // (Snow lies only where the ground is easy: every steeper face, by day and before dawn, is the rock itself.)
      float snowK = m.b * mix(smoothstep(0.885, 0.965, m.g), smoothstep(0.84, 0.95, m.g), uNight);
      vec3 alb = mix(mix(vec3(0.085, 0.09, 0.105), vec3(0.05, 0.055, 0.07), uNight), mix(vec3(0.92, 0.93, 0.95), vec3(0.5, 0.56, 0.66), uNight), snowK);
      float sunAz = max(dot(normalize(d.xy + 1e-5), normalize(S.sun.xy)), 0.0);
      // (What the sun does not reach is lit by the sky alone: blue, and deep in the folds.)
      // (The sun is low and behind them: level snow is only grazed by it, and it is the faces turned to it that are bright.)
      vec3 day = S.key * 0.95 * m.r * smoothstep(0.015, 0.21, m.r) + S.amb * vec3(0.78, 0.93, 1.14) * (0.02 + 0.36 * m.g * m.g);
      // Before dawn: the sky's own light, and the first warmth on what faces it.
      // (And the faces the coming light will find first already hold a little of it: a range has its drawing before dawn too.)
      // (The night's cold light comes from the side the curtains hang on, which is the side the morning sun will
      // come from: the faces it finds are pale blue, with the shadows the country throws, and the rest is deep.)
      float lumA = dot(S.amb, vec3(0.2126, 0.7152, 0.0722));
      vec3 night = S.amb * (0.3 + 0.7 * m.g) + (lumA * vec3(0.42, 0.9, 1.32) * 5.2 + uAurora * 0.05) * m.r * smoothstep(0.01, 0.2, m.r)
        + S.band * 0.035 * pow(sunAz, 3.0) * m.g + S.band * 0.06 * m.r * (0.2 + 0.8 * sunAz);
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
        float crest = 0.4 * clamp((textureLod(uPano, uv + vec2(0.0, 0.016), lod + 2.0).a - m.a) / 0.3, 0.0, 1.0)
          + 0.28 * clamp((textureLod(uPano, uv + vec2(0.0, 0.04), lod + 3.0).a - m.a) / 0.3, 0.0, 1.0)
          + 0.2 * clamp((textureLod(uPano, uv + vec2(0.0, 0.08), lod + 3.0).a - m.a) / 0.3, 0.0, 1.0)
          + 0.12 * clamp((textureLod(uPano, uv + vec2(0.0, 0.14), lod + 4.0).a - m.a) / 0.3, 0.0, 1.0);
        vec3 shade = S.zen * 0.08 + S.mid * 0.02 + S.hor * 0.02;
        vec3 sunlit = S.mid * 0.05 + S.hor * 0.06 + S.band * 0.024 * exp(-off * 1.6);
        vec3 low = mix(shade, sunlit, found);
        low += S.band * (0.016 + 0.2 * exp(-off * 2.2)) * crest * crest * (0.3 + 0.7 * m.g * m.g);
        rock = mix(rock, low, gDusk);
        // (They are darker than the sky behind them: only the furthest stand deep in the lit air.)
        airK = mix(airK, clamp(0.02 + far * 0.26 * S.haze, 0.0, 0.6), gDusk);
        airR = mix(airR, S.hor * 0.42 + S.band * 0.06 * pow(sunAz, 4.0), gDusk);
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

/** The bearing of the first light, low over the ranges. */
vec3 dawnDir() { return normalize(vec3(S.sun.xy, 0.14)); }

/** The night sky as a face of ice gives it back: no stars, no rays, the curtain as a soft wash. Below the horizon, dark water. */
vec3 skyNightOn(vec3 r) {
  float h = max(r.z, 0.0);
  vec3 c = mix(mix(S.hor, S.mid, smoothstep(0.0, 0.2, h)), S.zen, smoothstep(0.07, 0.62, h));
  float az = max(dot(normalize(r.xy + 1e-5), normalize(S.sun.xy)), 0.0);
  c += S.band * exp(-h * 9.0) * az * az * az * 0.34;
  float up = h - 0.27;
  // (Ice gives the curtain back colder than it is: a little of its green is lost in the blue of the ice.)
  c += mix(vec3(0.13, 0.76, 0.66), vec3(0.36, 0.22, 0.95), smoothstep(0.0, 1.32, up)) * (smoothstep(-0.05, 0.03, up) * exp(-max(up, 0.0) / 0.55) * 0.8) * uSkyK.y;
  return mix(vec3(0.004, 0.011, 0.02), c, smoothstep(-0.12, 0.02, r.z));
}

/**
 * Ice before dawn. n: the face's broad lie (what it mirrors goes by this); nf: the face with its scallops;
 * rd: the eye's ray; thick: how much ice the ray crosses; gloss: 0..1 how glazed this place on the face is
 * (meltwater keeps to lanes: the sky lies in them and slides as the eye moves, and between them the face is dull);
 * shut: 0..1 how closed in by other ice the face is (a canyon's wall mirrors the wall across from it, not the sky).
 */
vec3 iceNight(vec3 n, vec3 nf, vec3 rd, float thick, float gloss, float shut) {
  float cosi = max(dot(-rd, n), 0.0);
  // The body: blue-black, a little lighter on what looks up at the sky; and the cold sky through what is thin.
  float thin = exp(-max(thick, 0.0) / 90.0);
  // (What light there is comes from the sky overhead and from low on the dawn's side: a piece of ice has a lit side and a dark one.)
  float form = 0.5 + 0.5 * dot(n, dawnDir());
  vec3 col = S.amb * vec3(0.26, 0.34, 0.42) * (0.3 + 0.5 * max(nf.z, 0.0) + 0.75 * form * form) * (1.0 - 0.5 * shut) + vec3(0.011, 0.03, 0.058) * thin * (1.0 - 0.6 * shut);
  // What lies on the face: the sky, the more the more glancing the eye, and most in the glazed lanes.
  vec3 rr = reflect(rd, n);
  vec3 sky = mix(skyNightOn(rr), vec3(0.004, 0.012, 0.03), shut * (1.0 - smoothstep(0.5, 0.9, rr.z)));
  float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  col = mix(col, sky, clamp(fres * (0.22 + 0.7 * gloss) + 0.04 * gloss, 0.0, 1.0));
  // The first light: a face turned to the dawn takes a breath of its warmth, most where the eye skims it.
  // (By the face's broad lie: laid on every scallop it would be a rash.)
  float toDawn = max(dot(n, dawnDir()), 0.0);
  col += S.band * (0.004 * toDawn + 0.03 * toDawn * pow(1.0 - cosi, 2.0)) * (1.0 - shut);
  // The curtain's light on what looks up at it: ice gives back its cold part.
  col += uAurora * vec3(0.45, 0.72, 1.0) * 0.02 * max(nf.z, 0.0) * (1.0 - 0.7 * shut);
  return col;
}

/** Snow on ice before dawn: the palest thing on it, a shade over the night's own snow; the dawn's side a little warm, the curtain's light on what lies level. */
vec3 snowNight(vec3 n) {
  vec3 dw = dawnDir();
  return vec3(0.74, 0.8, 0.9) * (S.amb * vec3(5.2, 3.4, 2.2) * (0.7 + 0.3 * max(n.z, 0.0)) + S.band * 0.03 * max(dot(n, dw), 0.0)) + uAurora * vec3(0.5, 0.75, 1.0) * 0.03 * max(n.z, 0.0);
}

/* ---------- the pictures ---------- */

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

/* ---------- the slab ---------- */

float lodFor(float foot, float scale, float n);
float gSlabThick;
float shallowsAt(vec2 p);
vec3 fracture(vec2 x);
// (Stations 1 to 4 are made of the same glacier ice as the later ones: it is written with them, further on.)
vec3 iceGlacier(vec3 p, vec3 n, vec3 rd, float t, vec2 q, float thick, float sky, float sun, float cups, float edge, float seed);
vec3 corniceOn(vec3 col, vec3 n, float dz, float hang, float px);
vec3 iciclesOn(vec3 col, float along, float dz, float px, float reach);
vec3 waterlineOn(vec3 col, float z, float g);
vec3 snowOn(vec3 n, float lump);

// The block's faces, in its own frame (x across its front, y into it, z up from the water): the way each looks, and how far
// it is from the middle of the front's foot. 0 is the polished front, 5 the foot; 4, 6, 7 and 10 look up and carry the snow.
const int SLN = ${slabFaces().length};
const vec4 SLF[${slabFaces().length}] = vec4[${slabFaces().length}](${slabFaces()
  .map((f) => `vec4(${f.map((v) => v.toFixed(5)).join(', ')})`)
  .join(', ')});

/**
 * A ray against the block (a solid cut by flat faces). Returns the
 * distance, or -1. hl: where it is met, in the block's frame. face: which
 * face.
 */
float slabHit(vec3 ro, vec3 rd, out vec3 hl, out float face) {
  vec3 lo = ro - uSlabPos;
  vec3 a = vec3(dot(lo.xy, uSlabDir.zw), -dot(lo.xy, uSlabDir.xy), lo.z);
  vec3 d = vec3(dot(rd.xy, uSlabDir.zw), -dot(rd.xy, uSlabDir.xy), rd.z);
  float tN = -1e9;
  float tF = 1e9;
  hl = vec3(0.0);
  face = 0.0;
  for (int j = 0; j < SLN; j++) {
    vec4 pl = SLF[j];
    float den = dot(d, pl.xyz);
    float num = pl.w - dot(a, pl.xyz);
    if (den < -1e-6) { float t = num / den; if (t > tN) { tN = t; face = float(j); } }
    else if (den > 1e-6) tF = min(tF, num / den);
    else if (num < 0.0) return -1.0;
  }
  if (tN > tF || tN < 0.0) return -1.0;
  gSlabThick = tF - tN;
  hl = a + d * tN;
  return tN;
}

// 1 while the block is drawn as a mirror image in moving water: no hairline survives that.
float gSlabSoft = 0.0;

/**
 * What is seen inside a piece of glacier ice. Three depths are looked at
 * along the eye's ray, each a little further across the face than the last,
 * so what is in the ice shifts against its skin as the eye moves: thin veils
 * of trapped air in upright curtains, bubbles strung in level bands (each a
 * winter's snow), hairline fractures, and the broad planes of cleavage that
 * flash where they lie to the light.
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
    veil += smoothstep(0.66, 0.86 + 0.2 * g1.b, cloud) * dim * 0.48;
    if (gSlabSoft < 0.5) {
      // A fracture: a long, nearly straight break across the block, in a
      // set of two or three. Its edge is a hairline; the break itself is a
      // plane that catches the light on one side of that line, brightest
      // where it lies to the eye, and is gone a way in. Each is cut to a
      // length by the ice round it.
      vec2 dk = k == 0 ? vec2(0.83, 0.56) : (k == 1 ? vec2(-0.47, 0.88) : vec2(0.97, -0.24));
      float gap = 96.0 + 60.0 * fk;
      float sf = dot(a, dk) / gap + g2.g * 0.7 + seed * 0.37;
      float s = fract(sf);
      float cut = smoothstep(0.4, 0.52, g2.b + 0.3 * (g1.g - 0.5)) * smoothstep(0.35, 0.6, g1.b + 0.25 * g2.g);
      float w = (0.9 + foot * 1.2) / gap;
      float hair = 1.0 - smoothstep(0.0, w, min(s, 1.0 - s));
      // (Each plane lies its own way: it flashes as the eye passes the angle it mirrors.)
      float lie = fract(sin(floor(sf) * 91.7 + fk * 7.3) * 43758.5);
      float flash = smoothstep(0.55, 1.0, 1.0 - abs(fract(lie + dot(v, dk) * 0.9 + dot(v, vec2(dk.y, -dk.x)) * 0.5) * 2.0 - 1.0));
      float film = pow(1.0 - s, 5.0) * (0.14 + 0.5 * g1.a + 1.5 * flash);
      // Bubbles: single bright beads, strung in level bands through the ice.
      float band = smoothstep(0.55, 0.9, sin(a.y / 19.0 + 5.0 * g2.g + fk * 2.0));
      float bead = smoothstep(0.955, 1.0, textureLod(uGrain, a / vec2(170.0, 170.0) + fk * 0.17, 0.0).r) * (0.25 + 0.75 * band) * (1.0 - smoothstep(0.5, 1.4, foot));
      spark += ((hair * mix(0.85, 0.12, uNight) + film * 0.5) * cut + bead * mix(0.9, 0.3, uNight) + band * 0.05) * dim * (1.0 - smoothstep(2.0, 6.0, foot));
    }
    seen = d;
  }
  return vec3(min(veil, 1.0), spark, seen);
}

// The way the basin's sea runs: its sets come in from the south-west and go on to the north-east.
const vec2 SEA_K = vec2(0.5547, 0.8321);
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
/** How much of the sea reaches a place by the block, 0..1: all of it on the weather side, none in the lee. */
float blockWeather(vec4 bf) {
  return smoothstep(-0.55, 0.35, -dot(bf.zw, SEA_K));
}
/**
 * The phase of the sea at a place: it grows with time, so a crest moves on.
 * Out in the basin the crests are long and straight and run with the sea;
 * close to the block each bends round to meet the face it will break on.
 */
float blockPhase(vec2 pw, vec4 bf) {
  float wrap = exp(-bf.x / 110.0);
  vec2 rel = pw - uSlabPos.xy;
  float open = dot(rel, SEA_K) * -0.058 + 1.4 * sin(dot(rel, vec2(-SEA_K.y, SEA_K.x)) * 0.006 + 0.4);
  float shore = bf.x * 0.062 + bf.y * 0.021;
  return uTime * 1.7 + 1.6 * sin(uTime * 0.23 + bf.y * 0.007) + mix(open, shore, wrap) + 2.2 * sin(bf.x * 0.011 + bf.y * 0.013 + 1.3);
}
/** How high the sea is running at a place: it comes in sets, and each set has its own place along the crest. */
float blockSet(vec2 pw) {
  float along = dot(pw, vec2(-SEA_K.y, SEA_K.x));
  return clamp(0.5 + 0.34 * sin(dot(pw, SEA_K) * 0.0052 - uTime * 0.31) + 0.3 * sin(along * 0.011 + uTime * 0.17 + 2.0 * sin(along * 0.004)), 0.0, 1.0);
}
/** The slope those waves give the water (added to what it had): steeper as they close on the block, and in its lee a slick, where even the small ripples die. */
vec2 blockSwell(vec2 pw, vec2 slope) {
  vec4 bf = blockFoot(pw);
  float wk = blockWeather(bf);
  slope *= 1.0 - 0.85 * (1.0 - wk) * (1.0 - smoothstep(120.0, 330.0, bf.x));
  float amp = (1.0 - smoothstep(190.0, 620.0, bf.x)) * smoothstep(0.0, 30.0, bf.x) * (0.25 + 0.75 * blockSet(pw)) * wk;
  vec2 way = normalize(mix(-SEA_K, bf.zw, exp(-bf.x / 110.0)));
  // (Before dawn the water is a mirror, and a mirror shows every slope: the swell is held lower.)
  return slope + way * cos(blockPhase(pw, bf)) * mix(0.21, 0.07, uNight) * amp;
}
/**
 * White water in the basin. The sea comes from one side: a crest whitens as
 * it steepens on the way in, breaks on the faces that meet it (a surge of
 * foam that widens as it lands and trails lace as it drains), runs along
 * the block's flanks in streaks, and leaves a slick of still water in its
 * lee. The island's and the basin's own shores take the same sea.
 * sd: the bed's distance here (negative in water). na, nb: two fields of the moving surface.
 */
vec3 blockWater(vec3 col, vec2 pw, float sd, float na, float nb, float sim) {
  vec4 bf = blockFoot(pw);
  float wk = blockWeather(bf);
  float set_ = blockSet(pw);
  float beat = blockBeat(bf.y) * (0.2 + 0.8 * wk);
  float ph = blockPhase(pw, bf);
  float crest = 0.5 + 0.5 * sin(ph - 1.5708);
  float cap = smoothstep(0.74, 0.97, crest) * (1.0 - smoothstep(40.0, 330.0, bf.x)) * smoothstep(0.36, 0.62, na + 0.3 * nb + 0.3 * (set_ - 0.5)) * set_ * wk;
  float land_ = beat * beat;
  float dS = bf.x + 46.0 * (nb - 0.5) + 22.0 * sin(bf.y * 0.05 + uTime * 0.6);
  float surge = (1.0 - smoothstep(4.0 + 46.0 * land_, 22.0 + 104.0 * land_, dS)) * smoothstep(0.2, 0.46, na + 0.5 * beat + 0.2 * nb) * (0.3 + 0.7 * wk);
  // (Foam that has drained off the weather faces is drawn out down the sea, past the block's flanks.)
  float down = dot(pw - uSlabPos.xy, SEA_K);
  float lace = (1.0 - smoothstep(50.0, 240.0, bf.x)) * smoothstep(0.56, 0.76, nb + 0.22 * beat) * (0.3 + 0.5 * beat) * (0.35 + 0.65 * wk) * (1.0 - smoothstep(60.0, 260.0, down) * (1.0 - wk));
  // The shores: a band that comes and goes with its own waves.
  float ang = atan(pw.y - uSlabPos.y, pw.x - uSlabPos.x);
  float beatS = clamp(0.5 + 0.5 * sin(uTime * 1.5 + ang * 5.0 + 2.0 * sin(uTime * 0.5 + ang * 2.0)) + sim, 0.0, 1.0);
  float band = (1.0 - smoothstep(3.0, 8.0 + 18.0 * beatS, -sd)) * smoothstep(0.35, 0.6, na + 0.35 * beatS);
  float laceS = (1.0 - smoothstep(10.0, 46.0, -sd)) * smoothstep(0.62, 0.8, nb + 0.2 * beatS) * beatS * 0.5;
  float nearB = 1.0 - smoothstep(700.0, 1000.0, length(pw - uSlabPos.xy));
  // The slick in the lee: flat water that holds the sky, a shade darker than the sea round it.
  float lee = (1.0 - wk) * (1.0 - smoothstep(120.0, 330.0, bf.x)) * nearB;
  col *= 1.0 - 0.16 * lee * (1.0 - uNight);
  vec3 white = mix(vec3(0.93, 0.96, 1.0) * (S.amb * 1.25 + S.key * 0.28), vec3(0.34, 0.5, 0.56) * 0.3 + uAurora * 0.14, uNight);
  return mix(col, white, clamp(max(surge * 0.95 + cap * 0.8 + lace, (band * 0.85 + laceS) * (1.0 - 0.7 * lee)), 0.0, 1.0) * nearB);
}

/**
 * The block: a great piece of ice calved from a glacier's face, with the
 * product picture frozen in it, standing in the basin's water at the
 * island's shore. It is rough-hewn: leaning sides, a sloping top, corners
 * and arrises broken away. One face is cut flat and polished, so the picture
 * is seen clean through a hand of clear ice; the eye goes on into the ice
 * round it, which is dark and blue-green in its depth and bright at its
 * edges, where the light comes back out. The other faces are the break
 * itself: frosted, fluted by melt, scalloped. Snow lies deep on everything
 * that looks up and hangs over the faces, and the water has eaten a deep
 * notch along the foot, where the waves break white.
 * hl: where the eye's ray meets it, in the block's frame. foot: how much of it a pixel covers.
 * Returns the colour and, in a, how much of the pixel it covers (its
 * outline is worn, not ruled).
 */
vec4 slabColor(vec3 hl, float face, float t, vec3 rd) {
  vec3 L = keyDir();
  int fi = int(face + 0.5);
  vec3 nl = SLF[fi].xyz;
  bool front = fi == 0;
  bool top = nl.z > 0.7;
  vec3 dl = vec3(dot(rd.xy, uSlabDir.zw), -dot(rd.xy, uSlabDir.xy), rd.z);
  // How near the nearest arris is on this face, and how near the block's outline (an arris whose other face is turned from the eye).
  float edgeD = 1e3;
  float silD = 1e3;
  for (int j = 0; j < SLN; j++) {
    if (j == fi) continue;
    vec4 pj = SLF[j];
    float c = dot(pj.xyz, nl);
    float sd = (pj.w - dot(hl, pj.xyz)) / sqrt(max(1.0 - c * c, 0.02));
    // (The foot stands in the water: it is no edge of the ice.)
    if (j == 5) continue;
    edgeD = min(edgeD, sd);
    if (dot(dl, pj.xyz) > 0.0) silD = min(silD, sd);
  }
  // The face's own plane: across it, and up it (or, on a face that looks up, back along it).
  // (The foot looks straight down: it has no way "across" of its own, and is given the top's.)
  bool level = abs(nl.z) > 0.7;
  vec3 tu = front || level ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-nl.y, nl.x, 0.0));
  vec3 tv = level ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec2 q = vec2(dot(hl, tu) + uSlabSize.x * 0.5, dot(hl, tv));
  float foot = t * uPxAng;
  float lodF = lodFor(foot, 64.0, 256.0);
  vec4 gr = textureLod(uGrain, q / 64.0 + face * 0.37, lodF);
  vec4 gr2 = textureLod(uGrain, q / 210.0 + face * 0.19 + 0.5, lodFor(foot, 210.0, 256.0));
  vec3 n = vec3(uSlabDir.zw * nl.x - uSlabDir.xy * nl.y, nl.z);
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  float zUp = hl.z;
  // How high the snow's surface stands over this place.
  float zTop = min(min((SLF[4].w - dot(SLF[4].xy, hl.xy)) / SLF[4].z, (SLF[6].w - dot(SLF[6].xy, hl.xy)) / SLF[6].z), min((SLF[7].w - dot(SLF[7].xy, hl.xy)) / SLF[7].z, (SLF[10].w - dot(SLF[10].xy, hl.xy)) / SLF[10].z));
  // The ray inside the ice: bent toward the face's own line, so it moves less across the face than it did in air.
  vec2 across = vec2(dot(dl, tu), dot(dl, tv)) / max(-dot(dl, nl), 0.25) / 1.31;
  float thick = gSlabThick;
  vec3 in_ = iceInside(q, across, thick, foot, face);
  // The body. Clear ice takes the red out of the light that crosses it and then the green: where the eye looks
  // through a hand of it, it is pale; through the block's heart it is dark, blue toward green.
  float deepK = 1.0 - exp(-max(thick, 0.0) / 85.0);
  float heart = smoothstep(2.0, 52.0, edgeD);
  vec3 body = mix(vec3(0.36, 0.68, 0.8), vec3(0.008, 0.075, 0.115), deepK * (0.58 + 0.42 * heart));
  body *= 0.86 + 0.28 * gr2.g;
  // Light comes through it from the sun's side, and what is in it catches that light.
  float thru = 0.55 + 0.45 * max(dot(n, L), 0.0) + 0.5 * max(dot(-n, L), 0.0);
  vec3 airC = mix(vec3(0.82, 0.91, 0.96), vec3(0.42, 0.62, 0.7), uNight);
  vec3 lightD = S.key * 0.2 * thru + S.amb * 0.92;
  vec3 col = mix(body, airC, in_.x * 0.2) * lightD;
  col += vec3(0.85, 0.95, 1.0) * (S.key * 0.24 + S.amb * 0.56) * in_.y;
  // Its edges are where the light inside it comes back out: a bright rim to every face, widest where the ice is thin.
  float rim = (1.0 - smoothstep(0.0, 22.0, edgeD)) * (0.35 + 0.65 * gr2.b);
  col += vec3(0.5, 0.86, 0.95) * (S.amb * 0.5 + S.key * 0.1) * rim * rim * rim;
  if (uNight > 0.0) {
    // Before dawn it is the night's ice (iceNight): blue-black, the sky on its faces, the cold through its thin edges.
    // The veils of air in it are paler clouds in the dark, and what its fractures catch is the picture's own light.
    vec3 nc = iceNight(n, n, rd, min(thick, 40.0 + 6.0 * edgeD), front ? 0.25 : smoothstep(0.45, 0.75, gr2.g), 0.0);
    nc += S.amb * vec3(0.5, 0.62, 0.72) * in_.x * 0.7;
    nc += (skyNightOn(vec3(n.xy, 0.6)) * 0.05 + uSlabTint * 0.3) * in_.y;
    col = mix(col, nc, uNight);
  }
  float aCov = 1.0;
  if (front) {
    // The polished front. The picture lies a little way in: it shifts
    // against the face as the eye moves. It is seen clean through a hand of
    // clear ice: nothing bends it but the last hair of its own edge.
    const float MX = 30.0;
    float iw = uSlabSize.x - 2.0 * MX;
    vec2 ts = vec2(textureSize(uSlabTex, 0));
    float ih = iw * ts.y / ts.x;
    vec2 io = vec2(MX, uSlabSize.y - 86.0 - ih);
    vec2 pq = q + across * 16.0;
    vec2 e0 = min(pq - io, io + vec2(iw, ih) - pq);
    float nearE = 1.0 - smoothstep(0.0, 4.0, min(e0.x, e0.y));
    pq += (gr.gb - 0.5) * 3.0 * nearE;
    vec2 iuv = (pq - io) / vec2(iw, ih);
    float inImg = smoothstep(0.0, 2.5, min(e0.x, e0.y));
    vec3 img;
    if (gSlabSoft > 0.5) {
      // (Its image in moving water is light, not letters: the water keeps the picture's colours and breaks its words.)
      // (Read far down its chain of smaller copies: its headline is a soft glow there, never a smudge of white.)
      img = pow(textureLod(uSlabTex, vec2(iuv.x, 1.0 - iuv.y), 6.4).rgb, vec3(2.2));
    } else {
      // (Where the two rays beside this one meet the face: how far the picture moves under one device pixel.)
      vec3 ca = hl - dl * t;
      vec3 d1 = normalize(rd + uCamR * uPxAng);
      vec3 d2 = normalize(rd + uCamU * uPxAng);
      d1 = vec3(dot(d1.xy, uSlabDir.zw), -dot(d1.xy, uSlabDir.xy), d1.z);
      d2 = vec3(dot(d2.xy, uSlabDir.zw), -dot(d2.xy, uSlabDir.xy), d2.z);
      float den = SLF[0].w - dot(ca, nl);
      vec3 h1 = ca + d1 * (den / dot(d1, nl));
      vec3 h2 = ca + d2 * (den / dot(d2, nl));
      vec2 u1 = (vec2(h1.x + uSlabSize.x * 0.5, h1.z) + vec2(d1.x, d1.z) / max(-dot(d1, nl), 0.25) / 1.31 * 16.0 - io) / vec2(iw, ih);
      vec2 u2 = (vec2(h2.x + uSlabSize.x * 0.5, h2.z) + vec2(d2.x, d2.z) / max(-dot(d2, nl), 0.25) / 1.31 * 16.0 - io) / vec2(iw, ih);
      vec2 u0 = (q + across * 16.0 - io) / vec2(iw, ih);
      img = pow(picRead(uSlabTex, vec2(iuv.x, 1.0 - iuv.y), (u1 - u0) * vec2(1.0, -1.0), (u2 - u0) * vec2(1.0, -1.0)), vec3(2.2));
    }
    // (By day it keeps its own blacks and whites: only a breath of the ice's blue lies over it. Before dawn it is a screen lit from behind.)
    vec3 seen = img * mix(vec3(0.9, 0.96, 0.99), vec3(0.95, 1.05, 1.08), uNight) + img * img * 0.3 * uNight + vec3(0.003, 0.008, 0.011) * (1.0 - uNight);
    // (The first veil of air and a hairline or two lie in front of it, faintly: it is in the ice, not on it.)
    seen += vec3(0.75, 0.9, 1.0) * S.amb * 0.5 * in_.y * 0.1;
    // (Its edge is a break in the ice: a bright line of refracted light round it, and a thin shade outside that.)
    float dImg = max(-min(e0.x, e0.y), 0.0);
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 16.0, dImg)) * (1.0 - inImg);
    col += mix(vec3(0.6, 0.9, 1.0) * (S.amb * 0.5 + S.key * 0.1), uSlabTint * 0.6, uNight) * (1.0 - smoothstep(0.0, 2.2 + foot, abs(dImg - 2.0))) * (1.0 - inImg) * (0.5 + 0.5 * gr.g);
    col = mix(col, seen, inImg);
    // (Before dawn the picture is the light in the block: its own colours spill into the ice round it, and fall away to dark.)
    if (uNight > 0.0 && inImg < 1.0) {
      vec3 spill = pow(textureLod(uSlabTex, vec2(clamp(iuv.x, 0.04, 0.96), 1.0 - clamp(iuv.y, 0.04, 0.96)), 5.5).rgb, vec3(2.2));
      col += (min(spill * 2.4, vec3(0.5)) + uSlabTint * 1.2 + vec3(0.012, 0.04, 0.05)) * exp(-dImg / 64.0) * (0.3 + 0.6 * in_.x + 0.9 * in_.y + 0.5 * gr2.g) * (1.0 - inImg) * uNight;
    }
    // Polished, but not flat: the sky lies on it at a glancing angle, and in the slow swells melt has left in the face.
    vec2 bump = (gr2.gb - 0.5) * 0.16 * (1.0 - inImg * 0.8);
    float cosB = clamp(dot(-rd, normalize(n + vec3(uSlabDir.zw * bump.x, bump.y))), 0.0, 1.0);
    col += S.hor * (mix(0.02, 0.005, inImg) + 0.5 * pow(1.0 - cosi, 5.0) + 0.9 * pow(1.0 - cosB, 4.0) * (1.0 - inImg)) * mix(1.0, 0.4, uNight);
  } else if (!top) {
    // The broken faces: the ice parted here. They are the glacier's own ice, as the seracs and the dam are: strata,
    // fracture planes, melt cups, threads of meltwater, by day and before dawn.
    vec3 pW = uSlabPos + vec3(uSlabDir.zw * hl.x - uSlabDir.xy * hl.y, hl.z);
    col = iceGlacier(pW, n, rd, gSlabSoft > 0.5 ? t * 3.0 : t, vec2(q.x + face * 131.0, zUp), thick, 1.0, 1.0, 1.0, edgeD, 1.7 + face * 0.61);
    // (Before dawn the picture's light is in the ice of the faces beside it.)
    col += uSlabTint * 0.5 * exp(-edgeD / 60.0) * uNight;
  }
  // Where two faces meet the edge is worn round: it catches the sky, and the light inside the block leaves by it.
  float arris = 1.0 - smoothstep(0.5, 7.0, edgeD);
  // (Before dawn an arris is no line: the cold comes through it where it is whole, and is lost where it is chipped.)
  // (A broken face has its arrises from its own ice.)
  col += mix(vec3(0.78, 0.9, 1.0) * (S.key * 0.16 + S.amb * 0.8) * (0.6 + 0.4 * gr.g), (vec3(0.012, 0.032, 0.06) + uSlabTint * 0.12) * smoothstep(0.3, 0.7, gr2.b), uNight) * arris * (front || top ? 1.0 : 0.25);
  // Snow: deep on the top, hanging over every face in lobes, a soft shade under each.
  float lobes = textureLod(uGrain, vec2(q.x / 1500.0 + face * 0.13, 0.37), 0.0).g;
  float hang = 20.0 + 26.0 * smoothstep(0.3, 0.75, lobes) + 5.0 * gr2.g;
  float below = zTop - hang - zUp;
  float snowK = top ? 1.0 : 1.0 - smoothstep(-1.0 - foot, 1.0 + foot, below);
  // (Its face rounds over toward the foot of each lobe.)
  vec3 nS = top ? normalize(n + vec3((gr2.gb - 0.5) * 0.7, 0.6)) : normalize(n * (0.45 + 0.8 * smoothstep(12.0, 0.0, -below)) + vec3(0.0, 0.0, 0.75 - 0.9 * smoothstep(9.0, 0.0, -below)));
  // (Snow is lit as the land's is: level snow at one brightness whatever the sun's height, a lobe's face
  // turned to the sun brighter, one turned away in the sky's blue shade, its underside darkest. Before dawn
  // it has the sky's light, the curtain's and what the block itself gives off, so it is the palest thing on the block.)
  float toSun = dot(normalize(nS.xy + 1e-4), normalize(L.xy));
  float lobeSh = top ? 1.0 : 1.0 - 0.22 * smoothstep(10.0, 0.0, -below);
  vec3 sn = vec3(0.93, 0.94, 0.96) * (S.key * 0.24 * (top ? 0.86 + 0.5 * toSun * (1.0 - nS.z) : 0.9 + 0.45 * toSun) + S.amb * 0.8 * (0.62 + 0.38 * nS.z)) * lobeSh;
  if (uNight > 0.0) sn = mix(sn, (snowNight(nS) * 1.5 + uSlabTint * 0.2) * lobeSh, uNight);
  if (!top) col *= 1.0 - 0.34 * (1.0 - smoothstep(0.0, 13.0, below)) * step(0.0, below);
  col = mix(col, sn * (0.92 + 0.16 * gr.g), snowK);
  if (!top) {
    // The notch the basin has eaten along the foot: deep, wet and dark, undercut, the water's light moving
    // on its roof, and a bright lip of clear ice over it.
    float nh = 30.0 + 18.0 * gr2.b + 8.0 * sin(q.x / 37.0 + face);
    float notch = 1.0 - smoothstep(nh - 7.0, nh + 2.0, zUp);
    vec3 under = col * vec3(0.16, 0.34, 0.46) + mix(vec3(0.05, 0.2, 0.24) * S.amb * (0.4 + 0.9 * gr.b * smoothstep(0.0, nh, zUp)), S.amb * 0.1, uNight);
    col = mix(col, under, notch * 0.9);
    col += mix(vec3(0.82, 0.93, 1.0) * S.amb * 0.9, (S.amb * 0.9 + uAurora * 0.02) * (0.3 + 0.7 * gr.g), uNight) * (1.0 - smoothstep(0.0, 2.6 + foot, abs(zUp - nh - 1.5))) * 0.75;
    // The waves break on it: white water thrown up the face, higher with each wave that lands.
    float beat = blockBeat(q.x + face * 190.0) * (fi == 3 || fi == 1 ? 0.3 : 1.0);
    float reach = 10.0 + 44.0 * beat * beat;
    float spray = (1.0 - smoothstep(reach * (0.35 + 0.65 * gr.b), reach * (0.75 + 0.9 * gr.b) + 2.0, zUp)) * (0.55 + 0.45 * beat);
    vec3 white = mix(vec3(0.93, 0.96, 1.0) * (S.amb * 1.25 + S.key * 0.28), vec3(0.3, 0.4, 0.5) * 0.3 + uAurora * 0.05, uNight);
    col = mix(col, white, clamp(spray, 0.0, 1.0) * (0.45 + 0.45 * gr.a) * (1.0 - gSlabSoft * 0.5));
    // The outline is worn and chipped: no edge that stands against the sky or the water is a ruled line.
    float px = max(foot, 0.2);
    vec4 gw = textureLod(uGrain, q / vec2(900.0, 1400.0) + face * 0.41, 0.0);
    float wear = 1.5 + 12.0 * smoothstep(0.38, 0.8, gw.g) + 5.0 * smoothstep(0.5, 0.9, gw.b) * step(0.5, gr2.a) + 2.0 * gr.g;
    aCov *= smoothstep(wear - px, wear + px, silD);
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

/* ---------- the ground: wind-cut snow ---------- */

const mat2 RW = mat2(0.9563, -0.2924, 0.2924, 0.9563);
// The world, turned so that x runs with the wind: the baked snow's own frame.
const mat2 GS = mat2(${Math.sin(WIND).toFixed(5)}, ${(-Math.cos(WIND)).toFixed(5)}, ${Math.cos(WIND).toFixed(5)}, ${Math.sin(WIND).toFixed(5)});
// The two bearings its shadows were baked for, and the way from the first to the second.
const vec2 SH_A = vec2(${Math.sin(SHADE_AZ.a).toFixed(5)}, ${Math.cos(SHADE_AZ.a).toFixed(5)});
const vec2 SH_D = vec2(${shD[0].toFixed(5)}, ${shD[1].toFixed(5)});
// How high the night's cold light stands over the snow, as a tangent.
const float NIGHT_TAN = 0.13;

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
  if (vUv.y > uCalmBox.w + 0.2 || vUv.y < uCalmBox.y - 0.2 || vUv.x > uCalmBox.z + 0.2 || vUv.x < uCalmBox.x - 0.2) return 0.0;
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
  vec2 Lxy = normalize(L.xy + 1e-5);
  float tanEl = L.z / max(length(L.xy), 0.05);
  // How far the light has come round from the first baked bearing to the second.
  float kAz = clamp(dot(Lxy - SH_A, SH_D), 0.0, 1.0);
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
  float kA = 1.0 - 0.72 * high;
  float kB = 1.0 - 0.55 * high;
  vec2 sA = a.xy * GS * kA;
  float mA = dot(sA, Lxy);
  // (A shade's edge is cut over a narrow band of the horizon; where a size is seen smaller than it was baked the band is wider, so the edge stays a pixel wide and does not crawl.)
  float shade = smoothstep(0.0, 0.07 * clamp(foot / 6.0, 1.0, 3.0), mix(a.z, a.w, kAz) - tanEl);
  vec2 rel = sA;
  float lit = 1.0 - 0.6 * kA * shade;
  // Before dawn the snow has a second light: the sky's own, cold, from the side the curtains hang on (the first
  // baked bearing, which the morning will use). Its shade is read from the same texels and cut as crisply as the day's.
  float mC = dot(sA, SH_A);
  float litC = uNight > 0.0 ? 1.0 - 0.6 * kA * smoothstep(0.0, 0.07 * clamp(foot / 6.0, 1.0, 3.0), a.z - NIGHT_TAN) : 1.0;
  if (fb > 0.0) {
    vec4 b = snowTile(p, 1330.0, vec2(0.71, 0.29));
    vec2 sB = b.xy * GS * kB;
    // (A ridge on a drift that leans from the light throws a longer shade: the drift's own lean is added to its horizon.)
    lit *= 1.0 - 0.8 * kB * mix(0.14, smoothstep(0.0, 0.07 * clamp(foot / 1.3, 1.0, 3.0), mix(b.z, b.w, kAz) + mA - tanEl), fb);
    if (uNight > 0.0) litC *= 1.0 - 0.8 * kB * mix(0.14, smoothstep(0.0, 0.07 * clamp(foot / 1.3, 1.0, 3.0), b.z + mC - NIGHT_TAN), fb);
    rel += sB * fb;
    mA += dot(sB, Lxy) * fb;
    mC += dot(sB, SH_A) * fb;
  } else { lit *= 1.0 - 0.112 * kB; litC *= 1.0 - 0.112 * kB; }
  if (fc > 0.0) {
    vec4 c = snowTile(p, 286.0, vec2(0.37, 0.11));
    lit *= 1.0 - 0.88 * mix(0.14, smoothstep(0.0, 0.07 * clamp(foot / 0.28, 1.0, 3.0), mix(c.z, c.w, kAz) + mA - tanEl), fc);
    if (uNight > 0.0) litC *= 1.0 - 0.88 * mix(0.14, smoothstep(0.0, 0.07 * clamp(foot / 0.28, 1.0, 3.0), c.z + mC - NIGHT_TAN), fc);
    rel += (c.xy * GS) * fc;
  } else { lit *= 0.877; litC *= 0.877; }
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
  float ch = 1.0 - smoothstep(0.0, 26.0, sd);
  n = normalize(n + vec3(-grad * ch * ch * 0.9, 0.0));

  float ew = clamp(foot * 0.004, 0.004, 0.1);
  float bare = 0.0;

  float ndl = dot(n, L);
  // Snow is lit through as much as onto: a face turned from a low sun still
  // glows a little, in the sky's blue. Level snow is the reference. What is
  // crisp in it is the shade one form throws on the next.
  float sun = clamp(ndl / max(L.z, 0.05), 0.0, 2.4);
  // (Under the words the ridges' shade is thin: the ground there is calm.)
  sun = mix(1.0, sun, 0.4) * mix(1.0, lit, 1.0 - 0.9 * calm) * slabShade;
  vec4 gr = textureLod(uGrain, p / 150.0, lodFor(foot, 150.0, 256.0));
  // (Before dawn there is no glare to hide the snow's grain: the crust shows, a little, in the cold light.)
  vec3 snow = mix(vec3(0.93, 0.94, 0.95), vec3(0.74, 0.8, 0.9), uNight) * (0.965 + 0.07 * gr.g + uNight * (0.22 * (gr.g - 0.5) + 0.12 * (gr.a - 0.5)));
  vec3 stone = mix(vec3(0.085, 0.09, 0.1), vec3(0.05, 0.055, 0.07), uNight) * (0.7 + 0.7 * gr.g);
  vec3 blue = mix(vec3(0.3, 0.52, 0.62), vec3(0.2, 0.36, 0.46), uNight);
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
  alb = mix(alb, blue * 1.15, lipK * 0.85 * (1.0 - gRock));
  // The shelf's own top edge: a hair of bright refrozen ice over the water.
  alb = mix(alb, mix(vec3(0.86, 0.95, 1.0), vec3(0.62, 0.8, 0.9), uNight), (1.0 - smoothstep(0.5, 3.0 + foot, sd)) * 0.8);
  // (Level snow is held at one brightness whatever the sun's height; the
  // low sun is in how strongly every slope answers it, and in the shade.
  // Before dawn the aurora lends the snow a faint green, most on what faces it.)
  vec3 col = uNight < 1.0 ? alb * (S.key * 0.24 * sun + S.amb * 0.8 * (0.62 + 0.38 * n.z)) : vec3(0.0);
  // Before dawn the same relief is lit by the night. Three lights, so a form has three tones: the sky's cold
  // light from the curtains' side, which a crest catches and a lee does not; the first warm light, low on the
  // dawn's bearing, raking the faces turned to it; and under both the deep blue the whole sky gives, which is all
  // a hollow has. A hollow is dark blue, never a black stroke, and every shade has its lit crest beside it.
  float warmN = 1.0;
  float coolN = 1.0;
  if (uNight > 0.0) {
    float kc = 1.0 - 0.9 * calm;
    vec3 Lc = vec3(SH_A * 0.9917, 0.1289);
    coolN = mix(1.0, clamp(dot(n, Lc) / Lc.z, 0.0, 2.4), 0.42 * (1.0 - 0.6 * calm)) * mix(1.0, litC, kc);
    // (The first light is low and far: level snow has little of it, and a face turned to it a great deal.)
    float wr = clamp(ndl / max(L.z, 0.05), 0.0, 2.6);
    // (Under the words it lies evenly: a light this low would pick out every ripple the calm ground has left.)
    warmN = mix(wr * wr / 2.6, 0.385, 0.85 * calm) * mix(1.0, lit, kc) * slabShade;
    float ambL = dot(S.amb, vec3(0.2126, 0.7152, 0.0722));
    // (The curtains' colour breathes on the slopes that face them: faintly, in the cold light, never a green ground.)
    vec3 coolC = ambL * vec3(0.42, 0.9, 1.32) * 1.5 + uAurora * 0.024;
    vec3 warmC = S.key * 0.105;
    vec3 fillC = S.amb * (0.5 + 0.25 * n.z);
    col = mix(col, alb * (fillC + coolC * coolN + warmC * warmN), uNight);
  }
  // Sparkle, only on snow the sun reaches. (Before dawn: a few cold glints, on the crests the sky's light finds.)
  float glintK = (1.0 - smoothstep(2.0, 9.0, foot)) * (1.0 - bare) * (1.0 - calm);
  if (glintK > 0.0) {
    float sp = sparkle(p, foot, dir);
    col += (S.key * 0.55 * lit * step(0.3, sun) * (1.0 - uNight) + (vec3(0.5, 0.74, 1.0) * 0.07 + uAurora * 0.12) * smoothstep(0.9, 1.5, coolN) * uNight) * sp * glintK;
  }
  // Wet shore: dark and glossy at the water.
  float wet = 1.0 - smoothstep(1.0, 16.0, sd);
  col = mix(col, col * vec3(0.62, 0.74, 0.82), wet * 0.6 * smoothstep(1.5, 5.0, sd));
  // A cold sheen: snow is a little glossy at a glancing angle.
  float cosi = clamp(dot(-dir, n), 0.0, 1.0);
  float glance = pow(1.0 - cosi, 4.0);
  col += S.hor * glance * mix(0.08, 0.07, uNight) * (1.0 - 0.6 * bare);
  if (uNight > 0.0) {
    // Before dawn the crust shines where it throws the low light at the eye: the first light along the dawn's
    // bearing, on the faces tilted to carry it, and the sky's cold light everywhere else. It is the relief that
    // carries it, so it is a shine on forms and not a wash.
    vec3 rr = reflect(dir, n);
    float toDawn = max(dot(normalize(rr.xy + 1e-5), normalize(S.sun.xy)), 0.0);
    float low = exp(-max(rr.z, 0.0) * 9.0);
    float td = toDawn * toDawn; td *= td;
    col += (S.band * 0.11 * td * td * warmN + S.mid * 0.5 * coolN) * glance * low * uNight * (1.0 - 0.6 * bare) * (1.0 - 0.9 * calm);
  }
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
  float less = wet * 0.14 + lane * 0.06 + uNight * (0.03 + 0.25 * (1.0 - smoothstep(60.0, 760.0, nameD)));
  less += farK * mix(0.2, 0.06, uNight) + nearK * mix(-0.24, 0.3, uNight);
  // More snow lies on the near ice, where the first frame's words stand.
  less -= 0.09 * (1.0 - smoothstep(uLake.x + 120.0, uLake.x + 520.0, p.y)) * (1.0 - uLake.z) * (1.0 - uNight);
  // By day wind-packed snow lies thickest round the name: bright ground for dark letters.
  less -= 0.11 * (1.0 - smoothstep(60.0, 520.0, nameD)) * (1.0 - uLake.z) * (1.0 - uNight);
  gSnowFine = 1.0 - uNight * smoothstep(1.2, 7.0, foot / pow(max(-dir.z, 0.02), 0.75));
  float lvl = snowAt(wl, big) - less;
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
  // The near snow, where the first frame's words stand. It is calm for them, and calm is not soft: its broad swells are
  // held nearer one tone, and what is left to see is what wind-packed snow has close to: fine ridges cut by the wind,
  // each with a thin crisp shade on its lee, and a grain. (By day; before dawn that ice is bare.)
  float nearSnow = nearK * (1.0 - uNight) * (1.0 - smoothstep(3.0, 7.6, foot));
  if (nearSnow > 0.0) {
    vec3 flatLit = lightOn(vec3(0.0, 0.0, 1.0), 1.0);
    float tanEl = L.z / max(length(L.xy), 0.05);
    float kAz = clamp(dot(LXY - SH_A, SH_D), 0.0, 1.0);
    vec4 sc = snowTile(p, 286.0, vec2(0.37, 0.11));
    vec4 sb = snowTile(p, 96.0, vec2(0.71, 0.29));
    float shC = smoothstep(0.0, 0.07 * clamp(foot / 0.28, 1.0, 3.0), mix(sc.z, sc.w, kAz) - tanEl);
    float shB = smoothstep(0.0, 0.07 * clamp(foot / 0.1, 1.0, 3.0), mix(sb.z, sb.w, kAz) - tanEl) * (1.0 - smoothstep(0.6, 2.2, foot));
    vec3 fine = flatLit * (1.0 - 0.19 * shC - 0.11 * shB) * (1.0 + 0.7 * dot(sc.xy, LXY) + 0.03 * (g.g - 0.5));
    white = mix(white, mix(vec3(0.9, 0.92, 0.95) * fine, white, 0.32), nearSnow);
  }
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
  // (Before dawn the sheet's mirror is nearly flat: a mirror that rolled with the drifts' relief broke the sky
  // into short bright dashes, and the lake read as a rippled sea.)
  vec3 nr = normalize(vec3(-rel * 0.25 * (1.0 - 0.86 * uNight), 1.0));
  float cosi = clamp(dot(-dir, nr), 0.0, 1.0);
  float gloss = 1.0 - 0.9 * max(drift, dust * 0.7);
  float fres = 0.03 + 0.97 * pow(1.0 - cosi, 5.0);
  vec3 rf = reflect(dir, nr);
  rf.z = abs(rf.z) + 0.02;
  // (Ice is a poorer mirror than water, and before dawn that difference is what draws the name.)
  gDull = true;
  vec3 mir = airAt(rf.xy);
  // Toward the far shore, by day, the swept ice holds a soft, broken mirror
  // of what stands over it: the ranges hang down into it from the shore,
  // paler than they are, and the snow lying on the ice breaks the picture
  // up. This is what says ice and not snow. (The near lake, where the first
  // frame's words stand, has none of it.)
  float farDay = farK * (1.0 - uNight);
  if (gL2 < 1.0) {
    vec3 rn = normalize(rf);
    vec3 far = vec3(0.0);
    if (farDay > 0.0) {
      // (The ranges stand a long way behind the far shore, and a true mirror
      // seen from this high would hold only the sky over them: so this one is
      // leaned, as the eye expects of a lake under mountains, until their
      // foot lies at the shore and they hang down from it toward the eye.)
      float dep = asin(clamp(-dir.z, 0.0, 1.0)) - atan(uCamPos.z, max(uLake.y - 260.0 - uCamPos.y, 1.0));
      float elF = clamp(dep * 0.95 + rel.y * 0.05 + (g.b - 0.5) * 0.006, 0.0015, 0.6);
      vec3 rl = vec3(normalize(rf.xy + 1e-6) * cos(elF), sin(elF));
      far = withRidges(skyColor(rl, 0.0), rl, 0.6) * vec3(0.84, 0.92, 1.0);
    }
    mir = mix(mix(skyAll(rn, 0.0), far, farDay), mir, gL2);
  }
  float mirK = fres * gloss * (0.55 + 0.4 * wet) * (1.0 - 0.5 * farK * (1.0 - uNight)) * (1.0 - 0.74 * uNight);
  mirK = mix(mirK, min(fres * 1.25, 0.94) * gloss * (0.75 + 0.25 * wet), farDay);
  // (Once the sheet is plates and the eye has left the first frame, a plate's top is ice with a little sky on it, not a pane of blue.)
  mirK *= 1.0 - 0.6 * smoothstep(0.5, 0.72, uIceA.z) * (1.0 - uNight);
  col = mix(col, mir, mirK);
  if (farDay > 0.0) {
    // The sun's column: under the sun the ice gives its light back in a long broken streak that comes down the lake toward the eye.
    float daz = atan(rf.x, rf.y) - atan(S.sun.x, S.sun.y);
    float colm = exp(-daz * daz / 0.0022) * (0.35 + 0.65 * smoothstep(0.3, 0.7, g.g)) * (0.5 + 0.5 * smoothstep(0.35, 0.65, big + 0.5));
    col += S.band * colm * gloss * farDay * 0.42 * step(0.0, S.sun.z);
  }
  gFarMir = farDay * gloss;
  gDull = false;
  // (Before dawn the ice round the name is the darkest on the lake: nothing there competes with the light in the letters.)
  col *= 1.0 - 0.7 * uNight * (1.0 - smoothstep(40.0, 1500.0, nameD));
  if (uNight > 0.0) {
    // Before dawn the sheet is ice, and reads as ice: black glass with air
    // clouded in it, frost and wind-drifted snow lying on it in the sky's
    // blue-grey, long fractures that catch the sky's light as pale threads,
    // and over the bare ice a hard sheen: the curtains and the first light
    // lie in it softly, broken by the snow and the sheet's own grain. It is
    // a floor, lit from above; the water the melt opens is a depth.
    // (Its snow lies nearly level: lit across its full relief by the low first light it banded like a swell.)
    vec3 nN = normalize(vec3(-rel * 0.2, 1.0));
    vec3 snowN = vec3(0.74, 0.8, 0.9) * (S.key * max(dot(nN, L), 0.0) + (S.amb * 0.8 + uAurora * 0.035) * (0.62 + 0.38 * nN.z)) * (0.94 + 0.12 * g.r);
    // (Air is clouded in it in long drifts of its own, where the snow lies thickest.)
    float cloudI = 0.5 + 0.7 * big;
    vec3 iceN = vec3(0.011, 0.028, 0.046) * (0.7 + 0.5 * under) + vec3(0.016, 0.036, 0.05) * smoothstep(0.45, 0.8, cloudI) * (1.0 - 0.6 * nearK);
    // (Once the sheet is breaking into plates each plate is rimed: its top is pale against the water round it, wherever it lies.)
    float broken = smoothstep(0.28, 0.55, uIceA.z);
    iceN = mix(iceN, snowN * (0.62 + 0.3 * cloudI), 0.42 * broken);
    vec3 cN = mix(iceN, snowN * 0.8, dust * 0.5);
    cN = mix(cN, snowN, drift);
    cN = mix(cN, snowN * 1.18, lip * 0.6);
    cN *= 1.0 - lee * 0.38;
    cN *= 1.0 + (cr.y - 0.5) * 0.16 * smoothstep(0.45, 0.6, uIceA.z);
    // The sheen. (Under the eye, where the first frame's words stand, the ice keeps to itself.)
    float sheen = min(fres * 1.7 + 0.04, 0.8) * gloss * (0.72 + 0.28 * smoothstep(0.35, 0.7, cloudI)) * (1.0 - 0.75 * nearK);
    // (A lean frame's mirror holds only the air's own colour, which is paler than the sky it stands for: less of it is laid on.)
    cN += mir * sheen * (1.0 - 0.6 * gL2);
    // A fracture: a thread of the sky's light, never wider than a hair however near the eye, brighter along
    // some of its length than the rest; and beside it the break itself going down into the ice, faintly lit.
    float cwN = max(foot * 0.9, 0.22);
    float thread = (1.0 - smoothstep(0.6 * cwN, 1.5 * cwN, cr.x)) * crK * min(1.0, 1.0 / (foot * 0.9));
    vec3 crackC = (vec3(0.075, 0.15, 0.165) + uAurora * 0.08) * (0.35 + 0.9 * smoothstep(0.2, 0.62, g.b)) * (0.7 + 0.6 * cr.y);
    cN += crackC * plane / cw * 0.16 * (1.0 - 0.8 * drift);
    cN = mix(cN, crackC, thread * (1.0 - 0.7 * drift));
    float leanK = gL2 * (1.0 - smoothstep(0.0, 0.01, uIceA.y));
    if (leanK > 0.0) {
      // A lean frame has let the sheet's wandering fractures go until the melt needs them. Before dawn they are
      // what says ice and not swell, so two sets of long, nearly straight ones are drawn in their place: lines
      // that cost almost nothing, bent a little by the snow's own field, and never across the name.
      float d1 = abs(fract(dot(il, vec2(0.94, 0.34)) / 470.0 + 0.3 * big) - 0.5) * 470.0;
      float d2 = abs(fract(dot(il, vec2(-0.5, 0.87)) / 690.0 + 0.17 - 0.2 * big) - 0.5) * 690.0;
      float ln = (1.0 - smoothstep(0.8 * cwN, 2.0 * cwN, min(d1, d2))) * min(1.0, 1.4 / (foot * 0.9));
      cN = mix(cN, crackC * 1.5, ln * leanK * (1.0 - 0.7 * drift) * (1.0 - 0.75 * nearK) * smoothstep(60.0, 300.0, nameD));
    }
    // (The ice round the name is the darkest on the lake: nothing there competes with the light in the letters.)
    // (Only while the name stands: once it has gone the plates there are ice like the rest.)
    cN *= 1.0 - 0.62 * (1.0 - smoothstep(40.0, 1100.0, nameD)) * (1.0 - broken);
    col = mix(col, cN, uNight);
  }
  // The lip of a cut: a hair of snow, then the edge itself.
  float edge = 1.0 - smoothstep(0.0, 2.2 * cw, -f0);
  col *= 1.0 + 0.07 * edge * (1.0 - gPond);
  // Before dawn the arris catches the sky: a thin cold line round every cut.
  col = mix(col, white * 0.7 + uAurora * 0.22, uNight * 0.12 * (1.0 - smoothstep(0.0, 1.5 * cw, -f0)) * (1.0 - gPond));
  if (gPond > 0.0) {
    // A pond has no lip. The ice meets its water at a soft wet edge: a hair
    // of slush, darker and bluer than the snow, the same all the way round.
    float sw = max(uIceN.x * 0.16, 1.6 * cw);
    float slush = (1.0 - smoothstep(0.0, sw, -f0)) * gPond;
    vec3 wetIce = mix(vec3(0.33, 0.58, 0.72) * (S.amb * 1.3 + S.key * 0.25), vec3(0.05, 0.12, 0.15) * (S.amb * 1.1 + uAurora * 0.2) + col * 0.5, uNight);
    col = mix(col, wetIce, slush * mix(0.62, 0.5, uNight));
    // (And round that the ice is wet a little way back from the water: bare, and faintly blue.)
    float damp = exp(f0 / (uIceN.x * 0.55)) * gPond * (1.0 - uNight);
    col = mix(col, vec3(0.6, 0.82, 0.92) * (S.amb * 1.3 + S.key * 0.25), damp * 0.3);
  }
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
  // (Before dawn it is the ice's thickness under the sky: a pale cold band, a little greener and brighter toward
  // the water, where the curtain's light comes back up off it. It is lit, it does not shine.)
  vec3 top = mix(vec3(0.36, 0.74, 0.93), vec3(0.02, 0.055, 0.075), uNight);
  vec3 foot = mix(vec3(0.07, 0.38, 0.66), vec3(0.04, 0.13, 0.14) + uAurora * 0.035, uNight);
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
/**
 * How far north of its straight line the cliff stands at x: it is bent in
 * plan, in buttresses that come forward and bays that go back, and every
 * stream has cut a bay of its own where it goes over.
 */
float lipBend(float x) {
  float b = 40.0 * sin(x / 151.0 + 1.3) + 18.0 * sin(x / 63.0 + 0.4) + 8.0 * sin(x / 27.0 + 2.2);
  for (int i = 0; i < ${TRIBS.length}; i++) {
    float w = uTribW[i];
    float d = (x - TRIB_M[i].x) * LIP_LEN / (w * 0.5 + 30.0);
    // (At a stream's mouth the cliff is where the stream was carved to: the bay is cut back from there.)
    b = mix(b, 0.0, exp(-d * d * 0.5) * step(0.5, w));
  }
  return b;
}
/** Where the cliff's second face (the one that runs north along the river that leaves) stands at y: bent as the first is. */
// (From the basin that face is seen almost edge on, and a bent face seen edge on cannot be found by the ray: it was drawn as
// torn zigzags at the cliff's west end. From far off it is straight and the snowfield eases down to the land toward it,
// so no face stands there at all; the field takes its height and the face its bends as the eye comes round to them.)
#define LIPW_K smoothstep(${(CONF_Y - 2300).toFixed(1)}, ${(CONF_Y - 1500).toFixed(1)}, uCamPos.y)
float lipWest(float y) { return LIP_W + (24.0 * sin(y / 137.0 + 0.8) + 11.0 * sin(y / 53.0 + 2.6)) * LIPW_K; }
/** How much of its height the snowfield (and the cliff under it) has at a place, for its west end. */
float lipEase(vec2 q) { return mix(smoothstep(0.0, 460.0, q.x - lipWest(q.y)), 1.0, LIPW_K); }
// How steeply the snowfield climbs toward its back where the eye's ray last came down on it.
float gFieldG = 0.0;
/**
 * How high the snowfield stands at a place on it. From the cliff's lip it
 * climbs in long slopes toward the ranges, each roll a little higher than
 * the last, to a crest far back; beyond the crest it comes down to the land.
 */
float fieldTop(vec2 q) {
  float behind = q.y - lipY(q.x);
  // (Its long rolls are written out: world.ts's fieldRoll, which the captions' points are measured by.)
  float roll = 0.5 + ${FIELD_ROLL.a.toFixed(2)} * sin(q.x / ${FIELD_ROLL.ax.toFixed(1)} + 1.3) * cos(q.y / ${FIELD_ROLL.ay.toFixed(1)} + 0.4) + ${FIELD_ROLL.bk.toFixed(2)} * sin((q.x + q.y) / ${FIELD_ROLL.b.toFixed(1)} + 2.1);
  float climb = smoothstep(60.0, 1250.0, behind);
  // (Its small rolls are low: a roll as steep as a far ray's own fall hides the snow behind it, and the field was drawn in torn bands.)
  float up = 1.0 + climb * (0.55 + 0.7 * roll) + 0.022 * sin(behind / 150.0 + 4.0 * roll) * smoothstep(120.0, 420.0, behind);
  float back = 1.0 - smoothstep(${(LIP.back + 80).toFixed(1)}, ${(LIP.back + 80 + 3 * LIP.backRamp).toFixed(1)}, q.y + 260.0 * (roll - 0.5));
  return LIP_H * up * back * lipEase(q);
}
/** 1 while the confluence is near enough to be seen. */
bool confNear() { return uCamPos.y > ${(CONF_Y - 3300).toFixed(1)} && uCamPos.y < ${(CONF_Y + 1500).toFixed(1)}; }
/**
 * How far above the land the ground under a ray lies: the snowfield's
 * height where the ray comes down on it, nothing anywhere else.
 */
float confLift(vec3 dir) {
  gFieldG = 0.0;
  if (!confNear()) return 0.0;
  // Where the ray first comes down on the field: the greatest height h at which the field, under the place the ray
  // crosses that height, stands at least h. (The field climbs away from the eye about as steeply as a far ray comes
  // down to it, so stepping from a guess to the field's height there never settled, and the far streams were drawn
  // away from where they run. The ray is followed down from above the field's highest roll until it is under the
  // snow, and the place is then found between the last two heights.)
  float hA = LIP_H * 2.45;
  float fA = -1.0;
  float h = -1.0;
  vec2 q = uCamPos.xy + dir.xy * ((uCamPos.z - LIP_H * 0.98) / -dir.z);
  // (A ray that is still short of the cliff when it has come down to the lip's height never reaches the field: most of the frame.)
  if (q.y < lipY(q.x) - 70.0) return 0.0;
  for (int i = 1; i <= 6; i++) {
    float hB = LIP_H * (2.45 - 0.245 * float(i));
    q = uCamPos.xy + dir.xy * ((uCamPos.z - hB) / -dir.z);
    float fB = fieldTop(q) - hB;
    if (fB >= 0.0) {
      // (Under the snow at hB, over it at hA: halved five times, then the chord.)
      for (int k = 0; k < 5; k++) {
        float hM = 0.5 * (hA + hB);
        q = uCamPos.xy + dir.xy * ((uCamPos.z - hM) / -dir.z);
        float fM = fieldTop(q) - hM;
        if (fM >= 0.0) { hB = hM; fB = fM; } else { hA = hM; fA = fM; }
      }
      h = hB + (hA - hB) * fB / max(fB - fA, 1e-4);
      break;
    }
    hA = hB;
    fA = fB;
  }
  // (A ray that never comes under the snow passes over the field: it lands on the country beyond.)
  if (h < 0.0) return 0.0;
  q = uCamPos.xy + dir.xy * ((uCamPos.z - h) / -dir.z);
  h = fieldTop(q);
  if (q.y < lipY(q.x) + lipBend(q.x) || q.x < lipWest(q.y)) return 0.0;
  gFieldG = (fieldTop(q + vec2(0.0, 14.0)) - h) / 14.0;
  return h;
}
// Where the eye's ray meets the cliff, and the ray: set by whoever asks for the cliff's ice.
vec3 gCliffP = vec3(0.0);
vec3 gCliffRd = vec3(0.0, 1.0, 0.0);
/**
 * The ice of a cliff's face: the glacier's own, as the seracs and the dam are (strata, ledges, fracture planes, melt
 * cups, threads of meltwater), pale under its lip where it is thin and deep blue toward the water; a cornice of snow
 * along the lip with one clean lower edge and icicles under it; a dark wet notch at the water.
 * f: 0 at its lip, 1 at the water. along: a measure along it. nP: the way it faces, in plan.
 */
vec3 cliffIce(float f, float along, float tall, float px, vec2 nP) {
  vec3 L = keyDir();
  vec3 n = normalize(vec3(nP, 0.22));
  float up = (1.0 - f) * tall;
  float thick = 50.0 + 520.0 * smoothstep(0.03, 0.8, f);
  vec3 c = iceGlacier(gCliffP, n, gCliffRd, px / uPxAng, vec2(along, up), thick, 1.0, 0.45 + 0.55 * step(0.0, dot(n, L)), 1.0, 1e3, 5.3);
  // (It stands in buttresses, with deep clefts between them.)
  float cleft = 1.0 - smoothstep(0.0, 0.09, abs(sin(along / 733.0 + 0.7) * sin(along / 291.0 + 2.0)));
  c *= 1.0 - 0.4 * cleft * smoothstep(0.05, 0.3, f);
  // The cornice: packed snow over the lip, its lower edge one line that rises and falls along the cliff.
  float hang = 11.0 + 7.0 * sin(along / 97.0 + 1.0) + 4.0 * sin(along / 31.0);
  float dz = f * tall - hang;
  c = iciclesOn(c, along, dz, px, 18.0);
  c = corniceOn(c, n, dz, hang, px);
  // Wet and dark where it stands in the water.
  return waterlineOn(c, up, 0.5 + 0.5 * sin(along * 0.05));
}
/** The air between the eye and something t away, laid over its colour. */
vec3 confAir(vec3 c, vec3 dir, float t) {
  float thin = (1.0 - exp(-uCamPos.z / 320.0)) / max(uCamPos.z / 320.0, 1e-3);
  vec3 air = airAt(dir.xy);
  air = mix(air, mix(S.hor, air, 0.45), uNight);
  // (The same air as the ground it stands on, at any distance: far off the cliff is a low shelf of ice in the land's own light, never a paler shape hung in front of it.)
  return mix(c, air, 1.0 - exp(-t * 0.00021 * S.haze * thin));
}
/** The cliff's second face: from the corner north along the river that leaves, looking west. */
vec3 confWest(vec3 col, vec3 dir, float landAt0) {
  // (It is seen only from the west of it.)
  if (dir.x < 1e-4 || uCamPos.x > LIP_W - 40.0) return col;
  float tc = (LIP_W - uCamPos.x) / dir.x;
  if (tc <= 0.0) return col;
  tc = (lipWest(uCamPos.y + dir.y * tc) - uCamPos.x) / dir.x;
  vec3 h = uCamPos + dir * tc;
  if (h.y < lipY(h.x) + lipBend(h.x)) return col;
  float top = fieldTop(h.xy);
  float px = max(tc * uPxAng, 0.05);
  if (top < 1.0 || h.z > top + px || h.z < -FREEBOARD) return col;
  float aC = (1.0 - smoothstep(top - px, top + px, h.z)) * smoothstep(0.0, 2.0 * px, h.y - lipY(h.x) - lipBend(h.x));
  if (h.z < 0.0) aC *= 1.0 - landAt0;
  if (aC <= 0.0) return col;
  gCliffP = h;
  gCliffRd = dir;
  vec3 c = cliffIce((top - h.z) / (top + FREEBOARD), h.y + 400.0, top + FREEBOARD, px, vec2(-1.0, 0.0));
  return mix(col, confAir(c, dir, tc), aC);
}
/**
 * The cliff and what comes over it. Glacier ice under a cornice of snow,
 * fluted, blue toward the water, standing in buttresses and bays with a
 * ragged crest; and where a stream reaches the lip, a fall: glassy at the
 * brink, then white strands that open as they drop, and mist standing at
 * the foot. Each fall is as wide as its stream; a great one leaves the lip
 * with way on it and comes down clear of the ice, a dark gap behind it.
 * landAt0: how much of this pixel's ground at the land's level is land (the ledge at the cliff's foot stands in front of it).
 */
vec3 confCliff(vec3 col, vec3 dir, float landAt0) {
  if (!confNear()) return col;
  col = confWest(col, dir, landAt0);
  float den = dot(dir.xy, LIP_N);
  if (den > -1e-4) return col;
  float t0 = dot(LIP_O - uCamPos.xy, LIP_N) / den;
  if (t0 <= 0.0) return col;
  // The face is bent in plan: the ray is met where the bend stands at the place it reaches (found in two steps).
  float tc = t0;
  for (int i = 0; i < 2; i++) tc = t0 - lipBend(uCamPos.x + dir.x * tc) / LIP_LEN / den;
  vec3 h = uCamPos + dir * tc;
  if (h.x < lipWest(h.y)) return col;
  float px = max(tc * uPxAng, 0.05);
  float rise = LIP_H * 1.5;
  if (LIP_H < 1.0 || h.z > rise || h.z < -FREEBOARD) return col;
  // The crest is ragged: snow banked along the lip in drifts of its own height, and blocks of the ice standing
  // proud between clefts. (Not where a stream goes over: there the lip is cut down to the stream.)
  float berm = LIP_H * (0.1 * n1(h.x / 210.0 + 2.0) + 0.07 * n1(h.x / 61.0 + 7.0) + 0.035 * n1(h.x / 17.0)) + 2.0;
  for (int i = 0; i < ${TRIBS.length}; i++) {
    float w = uTribW[i];
    if (w > 0.0) berm *= smoothstep(w * 0.5 + 1.0, w * 0.5 + 11.0, abs(h.x - TRIB_M[i].x) * LIP_LEN);
  }
  float ease = lipEase(h.xy);
  float top = (LIP_H + berm) * ease;
  float aC = (1.0 - smoothstep(top - px, top + px, h.z)) * smoothstep(0.0, 2.0 * px, h.x - lipWest(h.y));
  if (h.z < 0.0) aC *= 1.0 - landAt0;
  float tall = top + FREEBOARD;
  float f = (top - h.z) / tall;
  float along = h.x * LIP_LEN;
  // (The way the face looks, in plan: turned by the bend.)
  float turnB = (lipBend(h.x + 4.0) - lipBend(h.x - 4.0)) / (8.0 * LIP_LEN);
  vec2 nP = normalize(LIP_N + vec2(1.0, ${(-LIP.m).toFixed(3)}) * turnB / LIP_LEN);
  gCliffP = h;
  gCliffRd = dir;
  vec3 c = aC > 0.0 ? cliffIce(f, along, tall, px, nP) : col;
  // (A bay holds less of the sky than a buttress's nose, and of a buttress's two flanks one is turned to the brighter half of it.)
  float bay = smoothstep(-30.0, 46.0, lipBend(h.x));
  c *= (1.0 - 0.34 * bay) * (1.0 + 0.42 * clamp(turnB * sign(keyDir().x + 1e-4), -0.7, 0.7)) * (0.84 + 0.3 * smoothstep(0.75, 0.0, f) * (1.0 - bay));

  // The falls.
  float zs = LIP_H * ease - FREEBOARD;
  // (Before dawn white water holds the sky's light: pale and cold, never a lamp.)
  vec3 white = mix(vec3(0.95, 0.98, 1.0) * (S.amb * 1.2 + S.key * 0.3), vec3(0.38, 0.5, 0.6) * 0.62 + uAurora * 0.3, uNight);
  vec3 glass = mix(vec3(0.2, 0.56, 0.66) * (S.amb * 1.1 + S.key * 0.2), vec3(0.02, 0.09, 0.1) + uAurora * 0.12, uNight);
  float mist = 0.0;
  float aAll = aC;
  for (int i = 0; i < ${TRIBS.length}; i++) {
    float w = uTribW[i];
    if (w <= 0.0) continue;
    float fi = float(i);
    // A great fall stands off the ice: the further it has dropped, the further out. The ray meets its sheet in front of the face.
    float way = clamp((w - 50.0) / 130.0, 0.0, 1.0);
    vec3 hf = h;
    float tf = tc;
    if (way > 0.0) {
      float off = 0.0;
      for (int k = 0; k < 2; k++) {
        tf = tc + off / den;
        hf = uCamPos + dir * tf;
        off = way * (5.0 + 40.0 * sqrt(clamp((zs - hf.z) / max(zs + FREEBOARD, 1.0), 0.0, 1.0)));
      }
    }
    float d = (hf.x - TRIB_M[i].x) * LIP_LEN;
    float reach = w * 0.5 + 70.0;
    if (abs(d) > reach) continue;
    if (hf.z > zs) {
      // The stream's own water in its notch, sliding to the brink.
      float aN = (1.0 - smoothstep(w * 0.5 - px, w * 0.5 + px, abs(d))) * (1.0 - smoothstep(top - px, top + px, hf.z));
      float rush = textureLod(uGrain, vec2(d / 240.0 + fi * 0.31, (hf.z - zs) / 90.0 + uTime * 0.12 + fi), 0.0).g;
      c = mix(c, mix(glass, white, smoothstep(0.5, 0.85, rush) * 0.45 + 0.35 * smoothstep(8.0, 0.0, hf.z - zs)), aN);
      aAll = max(aAll, aN);
    } else if (hf.z > -FREEBOARD) {
      float v = (zs - hf.z) / max(zs + FREEBOARD, 1.0);
      // (Behind a fall that stands off it the ice is in the fall's shade: a dark gap, seen past the sheet's edge and between its strands.)
      float dC = (h.x - TRIB_M[i].x) * LIP_LEN;
      c *= 1.0 - 0.66 * way * (1.0 - smoothstep(w * 0.5 - 6.0, w * 0.5 + 14.0 + 44.0 * v, abs(dC))) * smoothstep(zs + 6.0, zs - 16.0, h.z) * step(1e-4, aC);
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
      // (A sheet that stands clear is round: its middle is lit, its two edges turn away into shade.)
      fall *= 1.0 - 0.28 * way * smoothstep(0.45, 1.0, abs(d) / half_);
      // (The brink: the water bends over it, glassy.)
      fall = mix(glass * 1.3, fall, smoothstep(0.0, 0.1, v));
      c = mix(c, fall, aF);
      aAll = max(aAll, aF);
    }
    // Mist where it lands: it stands up the cliff, higher under a greater fall, billows and drifts.
    float up = (hf.z + FREEBOARD) / (18.0 + 0.3 * w);
    float lat = d / (w * 0.5 + 30.0);
    float puff = textureLod(uGrain, vec2(d / 170.0 + uTime * 0.02, up * 0.2 - uTime * 0.03) + fi * 0.2, 0.0).g;
    float m = exp(-lat * lat) * exp(-up * (0.7 + 0.9 * puff)) * (0.5 + 0.009 * w) * (0.7 + 0.5 * puff) * step(-FREEBOARD, hf.z);
    mist += m;
    aAll = max(aAll, min(m, 0.85));
  }
  if (aAll <= 0.0) return col;
  c = mix(c, white * 0.96, clamp(mist, 0.0, 0.85));
  // The same air as the ground it stands on.
  return mix(col, confAir(c, dir, tc), aAll);
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
      milkK += inB * (0.42 + 0.58 * fresh) * (0.62 + 0.38 * cos(float(i) * 3.1416));
      seam += (1.0 - smoothstep(0.0, 4.6 + 2.2 * footL, abs(out_ + wob - a1))) * (0.6 + 0.4 * fresh) * k;
      inner = a1;
    }
    // The boil at its foot: a fan of broken water, wider under a wider fall.
    vec2 d = vec2((pw.x - mx) * LIP_LEN, out_);
    float r2 = dot(d * vec2(1.0, 1.25), d * vec2(1.0, 1.25));
    boil += exp(-r2 / (w * w * 0.5 + 1100.0)) * (0.75 + 0.005 * w) * step(-6.0, out_);
  }
  // Streaks, long down the current, in the pale water.
  float streak = 0.55 + 0.45 * smoothstep(0.3, 0.7, textureLod(uDetail, vec2(pw.y / 70.0, (pw.x + uTime * uFlowSpeed * 0.7) / 900.0), lodFor(footL, 70.0, 512.0)).r);
  col = mix(col, milk, clamp(milkK, 0.0, 1.0) * streak * 0.8 * far);
  col = mix(col, white, clamp(seam, 0.0, 1.0) * (0.7 + 0.3 * na) * far * (1.0 - 0.4 * shade));
  float churn = smoothstep(0.26, 0.6, mix(na, nb, 0.5) + 0.5 * clamp(boil, 0.0, 1.0) - 0.1);
  col = mix(col, white, clamp(boil, 0.0, 1.0) * churn * 0.95);
  return col;
}

/* ---------- the rock pool and the results on its bed ---------- */

const vec2 POOL_C = vec2(${(POOL.x + POOL.w / 2).toFixed(1)}, ${(POOL.y + POOL.h / 2).toFixed(1)});
const vec2 POOL_H = vec2(${(POOL.w / 2).toFixed(1)}, ${(POOL.h / 2).toFixed(1)});
/** 0..1: inside the pool's reach. */
float poolAt(vec2 p) {
  vec2 pq = abs(p - POOL_C) - POOL_H;
  return 1.0 - smoothstep(-10.0, 40.0, max(pq.x, pq.y));
}
/** 1 while the pool is near enough to be seen. */
bool poolNear() { return abs(uCamPos.x - POOL_C.x) < 2300.0 && abs(uCamPos.y - POOL_C.y) < 2300.0; }
// The results lie on the bed as one dark slab, the table set on it in type. (The type is a mask drawn for the screen
// it is seen on: uSheetTex holds how much of each place a letter covers, all five columns of it.)
// (A narrow frame is shown the first columns, a wide one all five. This is world.ts's sheetCols.)
#define SH_N (uLens.y < 0.62 ? 2 : (uLens.y < 0.9 ? 3 : (uLens.y < 1.72 ? 2 : (uLens.y < 2.2 ? 3 : (uLens.y < 2.7 ? 4 : 5)))))
const float SH_SPAN[6] = float[6](0.0, ${[1, 2, 3, 4, 5].map((n) => boardSpan(n).toFixed(1)).join(', ')});
const vec2 SH_O = vec2(${SHEET.x0.toFixed(1)}, ${SHEET.y.toFixed(1)});
const float SH_HALF = ${(BOARD_DEPTH / 2).toFixed(1)};
const float SH_HEAD = ${BOARD.head.toFixed(1)};
const float SH_ROW = ${BOARD.row.toFixed(1)};
/** How far outside the slab a place on the bed is (negative on it). Its corners are round. */
float sheetEdge(vec2 pb) {
  float w = SH_SPAN[SH_N];
  vec2 sq = abs(pb - vec2(SH_O.x + w * 0.5, SH_O.y)) - vec2(w * 0.5, SH_HALF) + 7.0;
  return length(max(sq, 0.0)) + min(max(sq.x, sq.y), 0.0) - 7.0;
}
/**
 * The table where it lies: a dark slab, a hairline under the header and between the rows, and the type. The type is
 * read so that it stays type at every size: smaller than it was drawn, along the tilt and a little finer than the
 * plain rule; larger, its edge is put where the mask says it is and drawn as narrow as a device pixel allows.
 * a: 1 on the slab.
 */
vec4 sheetPic(vec2 pb, float footL) {
  // From the slab's far west corner: x east, y toward the eye (down the table).
  vec2 l = vec2(pb.x - SH_O.x, SH_O.y + SH_HALF - pb.y);
  vec2 full = vec2(SH_SPAN[5], 2.0 * SH_HALF);
  vec2 uv = l / full;
  // (How far the table moves under one device pixel: the ground's own measure of a pixel.)
  vec2 dx = gGx * vec2(1.0, -1.0) / full;
  vec2 dy = gGy * vec2(1.0, -1.0) / full;
  vec2 size = vec2(textureSize(uSheetTex, 0));
  float px = max(length(dx * size), length(dy * size));
  float cov = 0.0;
  if (px < 1.0) {
    float k = clamp(0.35 * px, 0.04, 0.5);
    cov = smoothstep(0.5 - k, 0.5 + k, textureLod(uSheetTex, uv, 0.0).r);
  }
  if (px > 0.7) cov = mix(cov, textureGrad(uSheetTex, uv, dx * 0.8, dy * 0.8).r, smoothstep(0.7, 1.0, px));
  // (Nothing is set in the slab's margin, or past the last column shown.)
  cov *= step(0.0, l.x) * step(l.x, SH_SPAN[SH_N] - 4.0);
  float aa = max(footL, 0.25);
  // The rules: one under the header, a fainter one between two rows.
  float ry = l.y - SH_HEAD;
  float rule = (1.0 - smoothstep(0.45, 0.45 + aa, abs(ry))) * 0.75;
  if (ry > 0.5 * SH_ROW) rule = (1.0 - smoothstep(0.35, 0.35 + aa, abs(mod(ry + 0.5 * SH_ROW, SH_ROW) - 0.5 * SH_ROW))) * 0.45 * step(ry, 2.5 * SH_ROW);
  rule *= min(1.0, 0.9 / aa);
  float edge = -sheetEdge(pb);
  // (A fine pale line runs round the slab just inside its edge: it is a made thing lying on the silt.)
  float rim = (1.0 - smoothstep(0.5, 0.5 + aa, abs(edge - 1.6))) * min(1.0, 0.9 / aa);
  float head = 1.0 - smoothstep(-0.5, 0.5, ry);
  vec3 ground = vec3(0.0085, 0.011, 0.0145) * (1.0 + 0.5 * head);
  vec3 col = ground + vec3(0.05, 0.058, 0.066) * max(rule, rim * 0.8);
  // The header is quieter than the results under it.
  col = mix(col, mix(vec3(0.74, 0.77, 0.79), vec3(0.4, 0.44, 0.47), head), cov);
  return vec4(col, 1.0 - smoothstep(-aa, aa, -edge));
}
/** The light the table gives off before dawn. */
vec3 sheetGlow() {
  return vec3(0.036, 0.082, 0.098);
}
/**
 * The pool's bed. Round the shore pale glacial silt drawn into ripple marks,
 * with stones lying on it, each lit from the sun's side with its shade
 * beside it; toward the middle the silt gives way to the dark rock of the
 * deep. deep: 0 in the shallows, 1 over the deep.
 */
vec3 poolBed(vec2 pb, float footL, vec3 L, float deep) {
  vec4 g = textureLod(uGrain, pb / 300.0, lodFor(footL, 300.0, 256.0));
  vec3 silt = mix(vec3(0.42, 0.64, 0.67), vec3(0.035, 0.06, 0.075), deep) * (0.88 + 0.24 * g.g);
  // Ripple marks: long wandering ridges across the current, each with a lit face and a shaded one.
  float warp = textureLod(uGrain, pb / 2600.0 + 0.4, 0.0).g;
  float ph = (pb.y * 0.92 + pb.x * 0.38) / 9.5 + warp * 9.0;
  float rip = sin(ph) + 0.35 * sin(ph * 2.0 + 1.0);
  float ripK = smoothstep(0.35, 0.6, textureLod(uGrain, pb / 1700.0 + 0.7, 0.0).g) * (1.0 - smoothstep(1.5, 5.0, footL));
  silt *= 1.0 + 0.11 * rip * ripK;
  // Stones, two sizes: a broken piece to a cell, most cells empty.
  float off = sheetEdge(pb);
  vec2 sun2 = normalize(L.xy + 1e-4);
  for (int k = 0; k < 2; k++) {
    float cell = k == 0 ? 74.0 : 27.0;
    vec2 q = pb / cell + (k == 0 ? 0.0 : 13.7);
    vec2 id = floor(q);
    vec2 h = hash2(id + float(k) * 31.0);
    // (They lie in drifts, thickest toward the banks, and most of them are small.)
    float drift = textureLod(uGrain, id / (k == 0 ? 9.0 : 23.0) + 0.3, 0.0).g + 0.25 * smoothstep(40.0, 150.0, off) - 0.16 * deep;
    float there = step(k == 0 ? 0.6 : 0.5, fract(h.x * 17.3 + h.y * 5.1)) * step(0.52, drift);
    float rad = cell * (0.12 + 0.24 * h.y * h.y);
    vec2 c = (id + 0.5 + (h - 0.5) * 0.44) * cell - (k == 0 ? vec2(0.0) : vec2(13.7 * cell));
    // (None lies on the picture.)
    there *= step(rad + 4.0, sheetEdge(c));
    if (there < 0.5) continue;
    vec2 d = pb - c;
    float ang = h.x * 6.283;
    vec2 dl = vec2(cos(ang) * d.x + sin(ang) * d.y, (-sin(ang) * d.x + cos(ang) * d.y) * (1.25 + 0.5 * h.y));
    // (Its outline has corners: a stone is a broken piece, not a pebble.)
    float rr = (length(dl) + 0.34 * rad * (abs(dl.x) * (0.4 + h.x) - abs(dl.y) * (0.3 + h.y)) / max(length(dl), 1e-3) * 0.5) / rad;
    // Its shade on the silt, away from the light.
    vec2 ds = d + sun2 * rad * 0.55;
    silt *= 1.0 - 0.42 * (1.0 - smoothstep(0.55, 1.25, length(ds) / rad));
    float aS = 1.0 - smoothstep(1.0 - 1.5 * footL / rad, 1.0 + 0.5 * footL / rad, rr);
    if (aS > 0.0) {
      float dome = sqrt(max(1.0 - rr * rr, 0.0));
      // (Flat faces, turned each its own way.)
      vec3 nS = normalize(vec3(floor(d / rad * 1.7 + h * 3.0 + 0.5) / 1.7 * 0.9, 0.35 + dome));
      float tone = fract(h.x * 9.7 + h.y * 3.3);
      vec3 stone = mix(vec3(0.1, 0.115, 0.13), vec3(0.46, 0.5, 0.5), tone) * (0.75 + 0.5 * textureLod(uGrain, pb / 37.0 + h, lodFor(footL, 37.0, 256.0)).g) * (1.0 - 0.6 * deep);
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
  float reach = 9.0 + 20.0 * g.g * g.g + 7.0 * g.b;
  float px = max(footL, 0.3);
  float a = 1.0 - smoothstep(reach - px, reach + px, inside);
  if (a <= 0.0) return vec4(0.0);
  float edge = 1.0 - smoothstep(0.0, 3.0 + px, reach - inside);
  float dust = 1.0 - smoothstep(reach * 0.2, reach * 0.75, inside + 6.0 * (g.a - 0.5));
  vec3 ice = mix(vec3(0.58, 0.8, 0.88) * (S.amb * 0.95 + S.key * 0.2), S.amb * vec3(0.5, 0.62, 0.74) + vec3(0.006, 0.016, 0.03), uNight);
  vec3 snow = mix(vec3(0.93, 0.94, 0.96) * (S.key * 0.24 + S.amb * 0.8), snowNight(vec3(0.0, 0.0, 1.0)), uNight);
  vec3 col = mix(ice, snow, dust * 0.85) + sky * 0.14;
  // (Before dawn its lip is thin ice with the cold in it, not a lit line.)
  col += mix(vec3(0.85, 0.96, 1.0) * (S.amb * 0.7 + S.key * 0.14), vec3(0.011, 0.03, 0.058) * (0.4 + 0.6 * g.b), uNight) * edge;
  // The picture's light, from underneath.
  float dS = max(sheetEdge(pw), 0.0);
  col += sheetGlow() * (0.5 + 1.2 * edge) * exp(-dS / 150.0) * uNight * uSheetOn;
  return vec4(col, a * (0.82 + 0.18 * edge));
}
// The blocks of ice that stand in the pool. xy: where, z: a sphere round each that holds all of it above the water.
const vec3 RK[${ROCKS.length}] = vec3[${ROCKS.length}](${ROCKS.map((r) => `vec3(${r.x.toFixed(1)}, ${r.y.toFixed(1)}, ${(Math.hypot(r.a, r.h) * 1.08).toFixed(1)})`).join(', ')});
// Each one's faces: the way the face looks, and how far it is from the block's middle at the waterline.
const vec4 RKF[${ROCKS.length * ROCK_FACES}] = vec4[${ROCKS.length * ROCK_FACES}](${ROCKS.map((_, i) =>
  rockFaces(i)
    .map((f) => `vec4(${f.map((v) => v.toFixed(4)).join(', ')})`)
    .join(', '),
).join(', ')});
// How much of the pixel the block last met covers (its outline is blended over a pixel), and how near an arris it was met.
float gRockA = 0.0;
float gRockE = 1e3;
// Which block that was, how much of its ice the ray crosses, and the ray.
int gRockI = 0;
float gRockThick = 0.0;
vec3 gRockRd = vec3(0.0, 1.0, 0.0);
/**
 * A ray against the blocks: each a solid cut by flat faces, standing in
 * the water. Returns the distance to the nearest (or -1), and its face's
 * normal there.
 */
float rockHit(vec3 ro, vec3 rd, out vec3 n) {
  float best = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < ${ROCKS.length}; i++) {
    vec3 o = ro - vec3(RK[i].xy, -FREEBOARD);
    float b = dot(o, rd);
    if (b * b - dot(o, o) + RK[i].z * RK[i].z < 0.0) continue;
    float tN = -1e9;
    float tN2 = -1e9;
    float tF = 1e9;
    vec3 nn = vec3(0.0, 0.0, 1.0);
    vec3 nn2 = nn;
    for (int j = 0; j < ${ROCK_FACES}; j++) {
      vec4 pl = RKF[i * ${ROCK_FACES} + j];
      float den = dot(rd, pl.xyz);
      float num = pl.w - dot(o, pl.xyz);
      if (den < -1e-5) { float t = num / den; if (t > tN) { tN2 = tN; nn2 = nn; tN = t; nn = pl.xyz; } else if (t > tN2) { tN2 = t; nn2 = pl.xyz; } }
      else if (den > 1e-5) tF = min(tF, num / den);
      else if (num < 0.0) tF = -1e9;
    }
    if (tN < tF && tN > 0.0 && tN < best) {
      best = tN;
      gRockA = clamp((tF - tN) / (3.0 * tN * uPxAng), 0.0, 1.0);
      gRockE = tN - tN2;
      gRockI = i;
      gRockThick = tF - tN;
      gRockRd = rd;
      // (An arris is a break, a hair worn: near one the face turns a little toward its neighbour.)
      n = normalize(mix(nn + nn2, nn * 2.0, smoothstep(0.0, 2.5, gRockE)));
    }
  }
  return best < 1e8 ? best : -1.0;
}
/**
 * A block of ice in the pool: a piece of the glacier, the same ice as the
 * seracs and the dam, lying where it grounded, so its strata lie at its own
 * tilt. Snow lies whole on every face level enough to hold it and hangs a
 * hand over the faces below in one clean line; the water has cut a dark wet
 * notch round its foot.
 */
vec3 rockColor(vec3 hp, vec3 n, float t) {
  float px = max(t * uPxAng, 0.02);
  float up = hp.z + FREEBOARD;
  float fi = float(gRockI);
  vec3 o = hp - vec3(RK[gRockI].xy, -FREEBOARD);
  // How far under the nearest face that carries snow this place is.
  float dTop = 1e3;
  for (int j = 5; j < ${ROCK_FACES}; j++) {
    vec4 pl = RKF[gRockI * ${ROCK_FACES} + j];
    if (pl.z > 0.62) dTop = min(dTop, pl.w - dot(o, pl.xyz));
  }
  // (It tipped as it grounded: its strata lie at its own tilt.)
  vec3 axis = normalize(vec3(0.42 * sin(fi * 2.4 + 0.7), 0.42 * cos(fi * 1.7 + 0.2), 1.0));
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  float along = dot(o, tu);
  vec2 q = vec2(along + fi * 91.0, dot(o, axis) * 1.6);
  // (Before dawn the pool lies low between its banks: less of the sky's light reaches a block than a wall that stands in the open.)
  vec3 col = iceGlacier(hp, n, gRockRd, t, q, gRockThick, mix(1.0, 0.62, uNight), 1.0, 0.7, gRockE * 2.0, 3.1 + fi * 1.37);
  bool top = n.z > 0.62;
  // Snow. On a level face it lies whole, in soft low drifts; over the faces below it hangs in one clean line.
  if (top) {
    float lump = 0.22 * sin(o.x * 0.11 + fi * 2.0) * sin(o.y * 0.13 + fi) + 0.1 * sin(o.x * 0.31 - o.y * 0.27);
    col = snowOn(n, lump);
  } else {
    float hang = 3.2 + 1.3 * sin(along * 0.09 + fi * 3.0) + 0.6 * sin(along * 0.23 + fi);
    col = iciclesOn(col, along + fi * 40.0, dTop - hang, px, 7.0);
    col = corniceOn(col, n, dTop - hang, hang * 1.6, px);
  }
  // Where it stands in the water.
  if (!top) col = waterlineOn(col, up, 0.5 + 0.5 * sin(along * 0.07 + fi));
  // Before dawn the table's light reaches the faces turned to it.
  col += sheetGlow() * vec3(0.3, 0.5, 0.6) * 2.2 * exp(-max(sheetEdge(hp.xy), 0.0) / 200.0) * (top ? 0.5 : 1.0) * uNight * uSheetOn;
  return col;
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
// The pond's tuning: x how bright the curtain lies in it before dawn, y its stars, z how much of the day sky it gives back.
const vec3 PONDK = vec3(1.3, 1.0, 0.3);
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
  if (slabOn > 0.0) slope = blockSwell(pw, slope);
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
  float shalK = pb.y > ${(T2 + 380).toFixed(1)} && pb.y < ${(T2 + 1700).toFixed(1)} ? shallowsAt(pb) : 0.0;
  if (shalK > 0.0) depth = mix(depth, min(depth, 13.0 + 12.0 * textureLod(uDetail, pb / 900.0 + 0.2, 0.0).r), shalK);
  // The clear pool: a foot of still water over a pale bed, and the picture lying on it.
  float poolK = poolAt(pb);
  float picK = 0.0;
  float deepP = 0.0;
  vec3 sheetC = vec3(0.0);
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
    bed = mix(bed, poolBed(pb, footL, L, deepP), poolK * 0.92);
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
  // The net of light as the surface focuses it, before the hour's light is put through it: 1 where it is even.
  float netRaw = 1.0;
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
  if (poolK > 0.0) {
    float netP = poolNet(pb, footL);
    netP = mix(netP, 1.0 + (netP - 1.0) * 0.45, deepP);
    netP = mix(netP, 1.04 + (netP - 1.04) * 0.3, picK);
    lightOnBed = mix(lightOnBed, vec3(uLight.x * 0.9 + uLight.y * shadow * mix(netP, 0.9 + (netP - 0.9) * 0.35, uNight)), poolK);
    nfil *= 1.0 - poolK;
  }
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
    vec3 lightN = mix(S.amb, vec3(dot(S.amb, vec3(0.3333))), 0.45) * 1.25 + uAurora * 0.05 + S.key * 0.25;
    vec3 bedN = vec3(0.26, 0.6, 0.66) * (0.78 + 0.5 * gb.g) * (1.0 + (gs.b - 0.42) * 0.4);
    // (The net is faint: the aurora is a soft light. It is there in the shallows and gone in the deep.)
    float netN = 1.0 + (clamp(netRaw, 0.35, 2.6) - 1.0) * 0.36;
    vec3 transN = trans;
    vec3 deepN = vec3(0.0022, 0.0085, 0.0135) * (0.72 + 0.28 * shaft);
    vec3 pool = bedN * lightN * transN * netN * (1.0 - 0.45 * shade) + deepN * (1.0 - 0.6 * transN.g);
    // (The clear pool is a foot deep everywhere and its bed is silt and stones: they are seen.)
    if (poolK > 0.0) pool = mix(pool, min(bed, vec3(0.8)) * lightN * 0.62, poolK * (1.0 - picK));

    water = mix(water, pool, uNight * 0.93);
    // The picture glows softly up through the water.
    water = mix(water, sheetC * 2.3 + vec3(0.004, 0.011, 0.014) + water * 0.12, picK * uNight * 0.94);
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
  float sheetK = smoothstep(0.75, 1.0, uGlow) * lakeK;
  // The name's own water while it is a melt pond.
  float pondK = gPond * lakeK;
  float fres0 = fres;
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
    rf = normalize(mix(rf, vec3(azd * sqrt(1.0 - el * el), el), sheetK * (1.0 - uNameG.w * uNight)));
  }
  // (Before dawn the thin cloud is too faint to be seen in moving water: it is not asked for.)
  gWash = gL1;
  gSkyQ = 0.0;
  gSunK = 1.0 - sheetK * (1.0 - uNight);
  vec3 refl = skyColor(rf, uQuality > 1.5 ? (1.0 - uNight) * (1.0 - gL1) * (1.0 - pondK) : 0.0);
  // (A pond mirrors the sky alone: the ranges, small and upside down in a letter, would only be a dark torn band.)
  if (pondK < 1.0) refl = mix(withRidges(refl, rf, uQuality > 1.5 ? 1.5 * gL1 : 1.5), refl, pondK);
  gWash = 0.0;
  gSkyQ = 1.0;
  gSunK = 1.0;
  if (sheetK > 0.0 && uNight < 1.0 && pondK < 1.0) {
    // (Dark water deepens what it mirrors: the ranges' shaded faces and the blue over them stand further from the pale air than they do above.)
    float rl = max(dot(refl, vec3(0.3, 0.6, 0.1)), 1e-3);
    // (And cools it: even the glare under the sun comes back as blue water, not as grey.)
    refl = mix(refl, mix(refl, vec3(rl), 0.65) * vec3(0.52, 0.88, 1.32) * min(clamp(pow(rl / 0.6, 1.3), 0.22, 1.5), 0.5 / rl), sheetK * (1.0 - uNight) * (1.0 - pondK));
  }
  if (sheetK * uNight > 0.0 && pondK < 1.0 && uNameG.w < 0.5) {
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
  if (pondK * uNight > 0.0 && uNameG.w < 0.5) {
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
  fres = mix(fres, max(fres * 1.3 + 0.1, mix(0.97, 0.66, smoothstep(0.27, 0.44, cosi)) * sheetK * (1.0 - uNameG.w)), uNight);
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
    float shoalP = smoothstep(0.44, 0.84, textureLod(uSnow, pw / vec2(900.0, 2700.0) + 0.57, 0.0).g + 0.5) * (1.0 - uNameG.w);
    float hw = min(0.03 + 2.0 * pow(z, 1.5), mix(9.0, 2.1, shoalP));
    vec3 thru = exp(-vec3(2.7, 0.95, 1.0) * hw);
    // The net of light lies on the shallow bed by day.
    float netP = smoothstep(0.3, 0.75, df.a) * (1.0 - uNight) * (1.0 - smoothstep(1.5, 4.0, footL));
    // (Before dawn the shelf round the standing letters' water is only a little paler than the water: a bright rim to every bay of its shore was a scribble.)
    vec3 lightP = mix(S.amb * 1.3 + S.key * 0.25, (S.amb * 2.0 + uAurora * 0.7 + vec3(0.05, 0.13, 0.15)) * mix(1.0, 0.4, uNameG.w), uNight);
    vec3 deepP = mix(vec3(0.0003, 0.015, 0.016), vec3(0.002, 0.009, 0.014), uNight) * (0.75 + 0.5 * shaft);
    vec3 body = vec3(0.7, 0.9, 0.97) * thru * lightP * (0.84 + 0.42 * netP) + deepP * (1.0 - thru.g);
    body *= 1.0 + clamp(wf * 6.5, -0.3, 0.7);
    water = mix(water, body, pondK);
    // (Dark water cools what it mirrors.)
    refl = mix(refl, refl * vec3(0.45, 0.9, 1.0), pondK * (1.0 - uNight));
    // By day a pond seen from this high is mostly its own colour, with a little sky on it; before dawn still dark water is nearly a whole mirror, a little less of one over the pale shelf.
    fres = mix(fres, mix(clamp(fres0 * PONDK.z + 0.02, 0.03, 0.4) + 0.1 * pawP, mix(mix(0.92, 0.4, thru.g), clamp(fres0 * 1.5 + 0.12, 0.0, 0.6), uNameG.w), uNight), pondK);
  }
  vec3 col = mix(water, refl, fres);
  if (sheetK > 0.0 && gFarK > 0.0) col = cutFoot(col, pw, dir, slope, foot, sheetK);
  // The sun on ripple faces turned toward it: a broad, graded sheen.
  float sd = max(dot(rf, S.sun), 0.0);
  col += S.band * (pow(sd, 240.0) * 1.6 + pow(sd, 40.0) * 0.12) * (1.0 - shade) * (1.0 - uNight) * (1.0 - gDeep);
#ifdef SEA
  // The delta, late in the day. The sun is low and ahead, so each bar lays a long shade on the water behind it and
  // the channels away from the light are deep teal; only where a channel crosses the sun's bearing does it burn.
  float dlt = pw.y > ${(DELTA.apex.y - 260).toFixed(1)} ? smoothstep(${(DELTA.apex.y - 260).toFixed(1)}, ${(DELTA.y + 120).toFixed(1)}, pw.y) * (1.0 - uNight) : 0.0;
  float longShade = shade;
  if (dlt > 0.0) {
    // (Two looks toward the sun: a bank a long way off still shades this water.)
    if (open < 1.0) longShade = max(shade, max(smoothstep(-6.0, 6.0, textureLod(uBedA, bedUv(pw + LXY * 64.0), 0.0).r), 0.75 * smoothstep(-6.0, 6.0, textureLod(uBedA, bedUv(pw + LXY * 150.0), 0.0).r)));
    col = mix(col, col * vec3(0.16, 0.4, 0.5) + vec3(0.0, 0.008, 0.016), dlt * (0.72 + 0.26 * longShade));
  }
  if (uSea.x > 0.0 && S.sun.z > 0.0) {
    float daS = atan(dir.x, dir.y) - atan(S.sun.x, S.sun.y);
    // (By day the path is narrow: contrast, not more light everywhere, is what makes it blaze.)
    float pathS = exp(-daS * daS / mix(0.03, 0.1, uNight));
    if (pathS > 0.01) {
      // Every ripple face turned to the sun throws it back whole: the braids blaze where they cross its bearing,
      // in broad flashing faces with a fine sparkle over them that comes and goes.
      // (By day they are fewer and far brighter, with dark water between them: a wash of light would turn the channels to sand.)
      float face = smoothstep(mix(0.55, 0.5, uNight), mix(0.8, 0.78, uNight), mix(dw2.r, df.r, 0.45));
      face = mix(face, mix(0.2, 0.34, uNight), smoothstep(2.0, 9.0, footL));
      float spark = smoothstep(0.7, 0.92, n2(pw / 9.0 + vec2(uTime * 1.1, -uTime * 0.8))) * (1.0 - smoothstep(1.2, 4.0, footL));
      vec3 gold = mix(S.band, vec3(2.4, 1.7, 1.0), 0.5 * (1.0 - uNight));
      col += gold * pathS * (mix(0.05, 0.16, uNight) + mix(16.0, 5.5, uNight) * face * face * face + mix(8.0, 4.0, uNight) * spark * face) * (0.35 + 0.65 * fres) * uSea.x * (1.0 - longShade) * mix(1.0, 0.45, uNight);
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
      float glint = spark * 5.0 + face * face * 0.22 * (1.0 - 0.85 * pondK);
      // (A glint finer than a pixel is its even mean.)
      glint = mix(glint, 0.12 * (1.0 - pondK), smoothstep(2.0, 6.0, footL) * (1.0 - 0.6 * pondK));
      // (It is the name's own: once the sheet is plates the sun's true path on the open lake takes over.)
      // (Not where the letters stand as blocks: on that water single glints were specks round the word.)
      col += S.band * path * glint * mix(1.0, 0.7, nearK) * gDeep * sheetK * sheetK * (1.0 - uNameG.w);
    }
  }
  // A few plates of ice lie afloat in the name's water, turning slowly:
  // angular, of different sizes, each with its own thin shade.
  // (Where the letters stand as blocks the pieces that come away from them are drawn with them: see the name's own shader.)
  if (sheetK > 0.0 && uNameG.w < 0.5 && gIceF1 > 6.0 && gIceF > shelfP * 1.6 * pondK && footL < 12.0) {
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
  // The lake's own current, once the name's meltwater has found its way out: the water in the pool draws toward the
  // mouth of the lead behind the letters, and runs off down the lead toward the outlet. It is seen as water is seen
  // moving: fine threads of light on it, torn, travelling the way it goes.
  if (lakeK > 0.0 && uNameL.x > 0.0 && footL < 26.0) {
    vec2 us = uIceB.xy + (pw - uIceB.xy) * uIceB.z;
    float yM = max(uNameG.x, uNameG.y) + uNameB.w;
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
  // The confluence: seven trails of paler meltwater along the cliff's foot, and a boil under each fall.
  if (pw.x > 700.0 && pw.x < 2500.0 && pw.y > ${(lipY(LIP.x0) - 900).toFixed(1)} && pw.y < ${(lipY(700) + 40).toFixed(1)}) col = confRiver(col, pw, footL, df.r, dw2.r, shade);
  // White water where the basin's waves strike the block and the shores round it.
  if (slabOn > 0.0) col = blockWater(col, pw, bw.r, df.r, dw2.r, abs(wv.r) * 30.0 + length(wv.ba) * 40.0);
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
  // (Four straight sides at angles of its own: a broken piece, no two alike.)
  float c1 = fract(hq.y * 13.0), c2 = fract(hq.x * 29.0);
  return max(max(abs(l.x) * (0.8 + 0.5 * c1) + abs(l.y) * 0.42, abs(l.y) * (1.0 + 0.6 * c2)), max(l.x * 0.9 - l.y * (0.3 + 0.6 * c2), -l.x * 0.7 + l.y * (0.2 + 0.7 * c1))) - sz;
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
  float dustK = exp(-a / 0.017) * (1.0 - smoothstep(0.05, 0.08, a)) * (0.55 + 0.45 * shim);
  if (dustK > 0.004) {
    float side = gRib.y < 0.0 ? 17.0 : 0.0;
    float px = uPxAng;
    float r0 = max(0.0006, 0.85 * px);
    float r1 = max(0.001, 0.85 * px);
    float r2 = max(0.0015, 0.85 * px);
    float dust = (motes(vec2(e, a) / 0.0028 - uTime * vec2(0.16, 0.1), vec2(r0 / 0.0028), 3.0 + side) + motes(vec2(e, a) / 0.0028 - uTime * vec2(0.11, 0.14) + 0.5, vec2(r0 / 0.0028), 47.0 + side)) * 2.2 * (0.0006 * 0.0006) / (r0 * r0)
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
  gSunK = 1.0 - 0.6 * still;
  gDiscK = 1.0 - still;
  vec3 refl = withRidges(skyColor(r, 0.0), r, 1.0 - still);
  gSunK = 1.0;
  gDiscK = 1.0;
  // Seen from above the water shows its depth; at a glancing angle, the sky.
  // (Before dawn the sea's own body is dark and without colour of its own: no green in it.)
  vec3 deep = mix(vec3(0.004, 0.026, 0.078), vec3(0.008, 0.012, 0.026), uNight);
  vec3 body = mix(deep * (0.5 + 0.5 * max(S.sun.z * 3.0, 0.3)), vec3(0.01, 0.07, 0.11) * (S.amb.b * 1.6 + 0.12), (1.0 - gDusk) * (1.0 - uNight));
  // (By day the sea is a rougher mirror than at the still ends of the day: more of its own deep colour shows.)
  float dayK = (1.0 - gDusk) * (1.0 - uNight);
  // (Late in the day it is a deep body with the pale sky only glancing on it: the sun's path is the one bright thing.)
  float mir = clamp(fres + 0.05, 0.0, 1.0) * (1.0 - 0.68 * dayK) * (1.0 - 0.12 * lee * still);
  vec3 col = mix(body, refl, mir);
  float inv = inversesqrt(max(dot(dir.xy, dir.xy), 1e-6));
  vec2 dn = dir.xy * inv;
  // (How far under the horizon the eye's ray dips, as a tangent.)
  float em = -dir.z * inv;
  float up = smoothstep(-0.02, 0.012, S.sun.z);
  float da = atan(dir.x, dir.y) - atan(S.sun.x, S.sun.y);
  float nearK = 1.0 / (1.0 + dist * 0.03);
  if (still < 1.0) {
    // Under way, the sea moves: sun glitter as a broken streak toward the sun.
    float sd = max(dot(r, S.sun), 0.0);
    float s90 = pow(sd, 90.0);
    float s900 = pow(sd, 900.0);
    col += vec3(1.0, 0.86, 0.62) * (s900 * 14.0 + s90 * mix(0.42, 0.55, uNight)) * mix(0.8, 1.0, uNight) * (1.0 - lee) * up * mix(0.6, 1.0, gDusk) * (1.0 - still);
    // By day the broad lobe is held back and the light is carried by a path
    // of separate glints: wide and sparse near the eye, narrowing to a thread
    // at the horizon.
    float day = (1.0 - uNight) * up * (1.0 - still);
    if (day > 0.0) {
      float wide = mix(0.028, mix(0.085, 0.11, gDusk), nearK) * mix(1.12, 1.0, gDusk);
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
      vec3 rm = normalize(mix(vec3(dir.xy, -dir.z), r, 0.12));
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
      vec3 warm = mix(vec3(1.0, 0.9, 0.74), vec3(1.0, 0.82, 0.5), uNight);
      col += warm * S.band * 0.55 * (glint + 0.05 * exp(-em / 0.02)) * max(pathS, shore) * mix(1.0, 0.8, uNight) * still;
      col += vec3(1.0, 0.97, 0.92) * (glint * 0.8) * pathR * still;
    }
    // (A soft even light under the sun, so the path has a body between its points.)
    col += S.band * pathS * (0.05 + 0.1 * exp(-em / 0.05)) * still;
    col += line * still;
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

#ifdef SEA
/**
 * The delta's bars late in the day. A bar is a low dome of snow: the low sun finds the rim turned to it, warm, and
 * the rim turned away lies in the bar's own blue shade. (sd: how far inside the shore; ba: the way the land rises.)
 */
vec3 deltaBar(vec3 col, float y, float sd, vec2 ba) {
  float k = smoothstep(${(DELTA.apex.y - 200).toFixed(1)}, ${(DELTA.y - 60).toFixed(1)}, y) * (1.0 - uNight) * (1.0 - gDusk);
  if (k <= 0.0) return col;
  float toSun = dot(-ba, normalize(keyDir().xy));
  float lit = smoothstep(0.05, 0.75, toSun) * (1.0 - smoothstep(3.0, 44.0, sd));
  float lee = smoothstep(0.05, 0.75, -toSun) * (1.0 - smoothstep(8.0, 96.0, sd));
  col = mix(col, col * vec3(0.56, 0.68, 0.9), 0.75 * lee * k);
  return col + S.key * vec3(1.0, 0.84, 0.62) * 0.17 * lit * k;
}
#endif

${STATION_COMMON}
${NAME_ICE}
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
  // (Between crossings it rests at the foot of the shard it has reached, dimmer: it is never nowhere.)
  float on = c < 3.5 ? mix(0.45, 1.0, step(c, 3.0)) : mix(0.45, 1.0, step(c, 6.5));
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
/** The tarn is still, not glass: the long slow swell that bends what stands in it. The slope it gives the water at a place. */
vec2 tarnSwell(vec2 p) {
  return vec2(sin(p.y * 0.052 + p.x * 0.013 + uTime * 0.5) + 0.6 * sin(p.y * 0.117 - p.x * 0.031 - uTime * 0.72), 0.5 * sin(p.x * 0.043 + p.y * 0.021 + uTime * 0.4)) * 0.0085;
}
// A shard is a piece of the glacier that stands on end: five leaning faces that draw together, two shoulders broken away
// below the point, the point itself snapped off aslant, and a chip or two out of its arrises. A convex solid, cut by planes.
// How far behind the face the ray meets, along the ray, the next face would have been met: small at an arris.
float gShardEdge = 1e3;
float shardHit(vec3 ro, vec3 rd, vec4 s, float turn, out vec3 n, out float tF) {
  float tN = 0.0;
  float tN2 = -1e3;
  tF = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  vec3 o = ro - vec3(s.xy, -FREEBOARD - 6.0);
  // (Most rays pass nowhere near it: a ball that holds all of it is asked first.)
  vec3 oc = o - vec3(0.0, 0.0, s.z * 0.45);
  float bq = dot(oc, rd);
  if (bq * bq - dot(oc, oc) + s.z * s.z * 0.4 < 0.0) return -1.0;
  for (int k = 0; k < 13; k++) {
    vec3 pn = vec3(0.0, 0.0, -1.0);
    float d = 30.0;
    float fk = float(k);
    if (k == 8) {
      // The point, snapped off: one slanting facet where the needle was.
      float a = turn * 3.0 + 1.0;
      pn = normalize(vec3(cos(a) * 0.9, sin(a) * 0.9, 1.0));
      d = pn.z * s.z * 0.8;
    } else if (k > 8) {
      // A chip out of it: a small face of its own, at its own height, looking a little up.
      float ck = fk - 8.0;
      float a = turn * 2.0 + ck * 1.9 + 0.7 * sin(ck * 3.3 + turn * 9.0);
      float z0 = s.z * (0.1 + 0.15 * ck + 0.05 * sin(ck * 5.1 + turn * 4.0));
      float r0 = s.w * (1.0 - z0 / s.z) * 0.8;
      pn = normalize(vec3(cos(a), sin(a), 0.2 + 0.5 * fract(sin(ck * 7.7 + turn * 13.0) * 43.7)));
      d = dot(pn, vec3(cos(a) * r0, sin(a) * r0, z0));
    } else if (k != 5) {
      bool sh = k > 5;
      float a = sh ? turn + 0.63 + (fk - 6.0) * 2.6 : turn + fk * 1.2566 + 0.34 * sin(fk * 2.7 + turn * 5.0);
      float rr = s.w * (sh ? 0.9 + 0.12 * (fk - 6.0) : 0.78 + 0.5 * fract(sin(fk * 12.9 + turn * 7.0) * 43.7));
      float hk = s.z * (sh ? 0.56 + 0.2 * (fk - 6.0) : 0.72 + 0.28 * fract(sin(fk * 5.3 + turn * 3.0) * 91.3));
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
 * A shard's ice: the glacier's own, as the block's broken faces, the seracs
 * and the dam are. Strata at its own tilt, fracture planes, melt cups,
 * threads of meltwater; clear, so dark and blue through its thick foot and
 * pale where it is thin, with what stands behind it showing through its
 * edges; snow on the facet where its point broke off, and a wet notch at
 * the water. Its light is in the ice, not on it: a fine thread up its
 * heart that each face bends its own way, and a blue glow in the ice round
 * that, brighter while a pulse rests in it.
 */
vec3 shardColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, vec4 s, float glow) {
  float thick = max(tF - t, 0.0);
  vec3 p = ro + rd * t;
  vec3 hp = p - vec3(s.xy, -FREEBOARD);
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  float foot = t * uPxAng;
  float faceId = fract(n.x * 7.31 + n.y * 3.17);
  // (Drawn as its image in the water, its fine inner work is not looked for.)
  float soft = gSlabSoft;
  float wasM = gMirror;
  gMirror = soft;
  vec3 axis = normalize(vec3(0.32 * sin(s.x), 0.32 * cos(s.x * 1.3), 1.0));
  float along = dot(hp, tu);
  vec2 q = vec2(along + faceId * 170.0, dot(hp, axis));
  vec3 col = iceGlacier(p, n, rd, t, q, thick, 1.0, 1.0, 0.8, gShardEdge * 1.6, s.x * 0.013 + floor(faceId * 3.0));
  gMirror = wasM;
  bool top = n.z > 0.62;
  // Snow on what looks up; under its edge a hand of it hangs over the face below.
  if (top) col = snowOn(n, 0.2 * sin(hp.x * 0.13 + s.x) * sin(hp.y * 0.11));
  // The light inside. The ray's nearest approach to the heart's line says how much of the glow it crosses.
  vec3 mp = ro + rd * (t + tF) * 0.5 - vec3(s.xy, -FREEBOARD);
  float up = clamp(mp.z / s.z, 0.0, 1.0);
  float rise = smoothstep(-0.04, 0.1, mp.z / s.z) * (1.0 - smoothstep(0.34, 0.6, up));
  // (Each face bends the thread a little its own way: it wavers as it climbs, and is never a ruled tube.)
  vec2 bent = mp.xy + (tu.xy * (faceId - 0.5) * 0.12 + n.xy * 0.05 * sin(mp.z * 0.045 + faceId * 9.0)) * s.w;
  float axisD = length(bent) / s.w;
  float axis0 = length(mp.xy) / s.w;
  // (It is not even: brighter lengths climb it slowly.)
  float lengths = 0.7 + 0.3 * smoothstep(0.25, 0.75, n1(mp.z / 23.0 - uTime * 0.35 + s.x));
  float thread = exp(-axisD * axisD / 0.004) * rise * lengths * (1.0 - 0.8 * soft);
  // (Before dawn the glow keeps close to the thread: it lights the ice near it, and the rest of the shard is the night's.)
  float halo = exp(-axis0 / mix(0.34, 0.2, uNight)) * rise;
  float lamp = glow * mix(0.9, 1.0, uNight);
  if (!top) col += (vec3(0.6, 0.95, 1.0) * thread * mix(0.5, 0.42, uNight) + vec3(0.2, 0.72, 0.95) * halo * mix(0.3, 0.55, uNight)) * lamp;
  // Where it stands in the water.
  if (!top) col = waterlineOn(col, hp.z, 0.5 + 0.5 * sin(along * 0.07 + s.x));
  // (Its image in the water is the water's: darker than the ice that throws it, and bluer.)
  if (soft > 0.5) col *= mix(vec3(0.58, 0.72, 0.84), vec3(0.7, 0.8, 0.9), uNight);
  // (Seen from far off it stands in the valley's air, as the land round it does.)
  float thin = (1.0 - exp(-uCamPos.z / 320.0)) / max(uCamPos.z / 320.0, 1e-3);
  vec3 air = airAt(rd.xy);
  return mix(col, mix(air, mix(S.hor, air, 0.45), uNight), (1.0 - exp(-t * 0.00021 * S.haze * thin)) * (1.0 - soft));
}

void main() {
  skyKey();
  gL1 = clamp(uLean, 0.0, 1.0);
  gL2 = clamp(uLean - 1.0, 0.0, 1.0);
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 dir = normalize(uCamF + uCamR * (ndc.x * uLens.y * uLens.x) + uCamU * (ndc.y * uLens.x));
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
  bool slabNear = uSlabSize.x > 0.0 && vUv.x > uSlabBox.x && vUv.x < uSlabBox.z && vUv.y > uSlabBox.y && vUv.y < uSlabBox.w;
  if (slabNear) {
    // Four rays to a pixel find how much of it the block covers (its edges
    // are geometry, so they are smoothed by counting). The ice itself is
    // worked out once for each face the pixel sees: one, or two at an arris.
    vec3 uvA = vec3(0.0);
    vec3 uvB = vec3(0.0);
    vec3 rdA = dir;
    vec3 rdB = dir;
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

  // (Between the canyon's walls: where ice stands on this line of sight, nothing behind it is worked out.)
  if (canyonEye()) canyonFirst(dir);
  if (slabCov > 0.999) {
    col = slabCol;
  } else if (gWallT >= 0.0) {
    col = vec3(0.0);
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
      // While the name stands it is a melt pond: its water lies flush with
      // the sheet, and nothing stands round it, so no edge of a letter is
      // lit or shaded differently from any other. (Only the name's own
      // water: a lead along a fracture shows the sheet's thickness from the
      // start. Once the ponds have run together they have melted through,
      // and the thickness stands round that opening too.)
      if (uIceN.y > 0.0) {
        gPond = uIceN.y * (1.0 - smoothstep(40.0 + uIceN.z, 130.0 + uIceN.z, gIceBoxD));
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
        vec3 suv;
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
    // (The snowfield climbs away from the low sun: its slopes stand in the sky's blue shade, their crests in the light.)
    if (gFieldG != 0.0) col *= mix(vec3(1.0), mix(vec3(0.74, 0.83, 0.96), vec3(1.06, 1.04, 1.0), smoothstep(0.1, -0.05, gFieldG)), (1.0 - uNight) * smoothstep(0.0, 0.03, abs(gFieldG)));
#ifdef SEA
    if (aLand > 0.0 && p.y > ${(DELTA.apex.y - 200).toFixed(1)} && sd0 < 100.0) col = deltaBar(col, p.y, sd0, b0.ba) * 1.0;
#endif
    // The island is ice-bound: a shelf of old blue ice stands round its shore, glazed, and before dawn it holds
    // the sky's light and the block's, so the island is never a dark shape on bright water.
    if (aLand > 0.0 && gRock > 0.0) {
      float shelf = (1.0 - smoothstep(16.0, 62.0, sd0 + 14.0 * (textureLod(uGrain, p / 900.0, 0.0).g - 0.5))) * smoothstep(0.0, 0.1, gRock);
      vec3 iceI = mix(vec3(0.5, 0.74, 0.86), vec3(0.2, 0.42, 0.52), uNight) * (0.86 + 0.28 * textureLod(uGrain, p / 300.0, lodFor(foot, 300.0, 256.0)).g);
      // (Before dawn the shelf is the night's ice too: the curtain's light on it is its cold part, never a green ring round the block.)
      vec3 litI = iceI * mix(S.key * 0.2 * slabShade + S.amb * 0.9, S.amb * 2.6 + uAurora * vec3(0.45, 0.72, 1.0) * 0.1 + slabLight * 3.0, uNight);
      col = mix(col, litI * aLand, shelf * 0.8);
      col += (S.amb * 0.45 + uAurora * vec3(0.45, 0.72, 1.0) * 0.05) * uNight * (1.0 - shelf) * aLand * smoothstep(0.0, 0.1, gRock);
    }
    if (aLand < 1.0 && aIce < 0.999) {
      vec2 pw = p + tilt * gFree;
      vec4 bw = bedAt(pw);
      float aWall = smoothstep(-aa, aa, bw.r);
      vec3 cut = vec3(0.0);
      if (aWall > 0.0) {
        // The far bank's face above the waterline. The snow ends in a shelf
        // of ice that overhangs the water: its cut edge is bright, the hollow
        // the water has eaten under it lies in shade, and below that old blue
        // ice goes down to a dark wet foot. Each of these ends at an edge a
        // pixel wide, so the bank is drawn, not smeared.
        float f = clamp(-sd0 / max(length(tilt) * gFree, 1.0), 0.0, 1.0);
        float af = clamp(1.2 * foot / gFree, 0.012, 0.22);
        vec3 nW = normalize(vec3(-bw.ba, 0.35));
        float alongB = dot(p, vec2(bw.a, -bw.b));
        vec4 gw = textureLod(uGrain, vec2(alongB / 180.0, f * 0.35), lodFor(foot, 180.0, 256.0));
        float rimF = 0.085 + 0.05 * textureLod(uGrain, vec2(alongB / 760.0, 0.21), 0.0).g;
        // (The hollow's lower edge hangs unevenly: it is where the melt has cut furthest.)
        float underF = rimF + 0.16 + 0.22 * textureLod(uGrain, vec2(alongB / 430.0, 0.37), 0.0).g;
        vec3 iceF_ = mix(vec3(0.6, 0.79, 0.9), vec3(0.2, 0.44, 0.6), smoothstep(underF, 1.0, f)) * (0.86 + 0.28 * gw.g);
        vec3 wall = iceF_ * lightOn(nW, 1.0);
        wall = mix(iceF_ * vec3(0.5, 0.62, 0.8) * S.amb * 0.62, wall, smoothstep(underF - 1.5 * af, underF + 1.5 * af, f));
        wall = mix(mix(vec3(0.95, 0.97, 1.0), vec3(0.7, 0.82, 0.92), uNight) * (S.key * mix(0.27, 0.0, uNight) + S.amb * mix(0.86, 1.5, uNight) + uAurora * 0.2), wall, smoothstep(rimF - af, rimF + af, f));
        wall *= 1.0 - 0.5 * smoothstep(0.87 - af, 0.91 + af, f);
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
          wall = mix(wall, iceW * lightOn(nW, 1.0) * mix(1.0, 0.7, f * f), gWalled * smoothstep(0.07, 0.16, f + (gw.g - 0.5) * 0.1));
        }
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
        // (By day the shallows along the coast stand in the same clear air as the deep beside them.)
        gSea = max(gSea, smoothstep(${(DELTA.sea - 300).toFixed(1)}, ${(DELTA.sea + 300).toFixed(1)}, pw.y) * (1.0 - gDusk) * (1.0 - uNight) * (1.0 - aWall) * (1.0 - aLand));
        cut += wc * (1.0 - aWall);
#else
        cut += (waterColor(pw, bw, dir, foot, footL, iceShade, slabOn) + slabLight * 0.26) * (1.0 - aWall);
#endif
      }
      col += cut * (1.0 - aLand);
    }
    if (aCut > 0.0) col = mix(col, iceCut(p, cutS, length(tilt) * uIceH * (1.0 - gPond) / max(foot / sinE, 1e-3)), aCut);
    if (aIce > 0.0) col = mix(col, iceTop(p, il, cr, f0, sd0, dir, foot), aIce);
    // The name's blocks stand on the sheet: their shade, their image and the meltwater at their feet lie on it.
    col = nameGround(col, p, dir, foot, aIce);
    gndT = t;
    gndIce = max(aIce, aLand);
    if (aCut > 0.5) gndWall = t + cutS * uIceH / sinE;

    // ---- the air: haze that lies low and thickens with distance. From
    // high up the ray crosses less of it; near the ground it hides the far
    // end of the world.
    const float HF = 320.0;
    float thin = (1.0 - exp(-uCamPos.z / HF)) / max(uCamPos.z / HF, 1e-3);
    float fog = 1.0 - exp(-t * 0.00021 * S.haze * thin);
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
    // The horizon is soft: the same mist that lies at the ranges' foot.
#ifdef SEA
    // (Over the still sea it is a fine line of mist on the waterline, no more: the mirror begins right under it.)
    col = mix(col, air, exp(dir.z / mix(0.006, 0.0032, stillM)) * mix(0.75, 0.42, stillM));
#else
    col = mix(col, air, exp(dir.z / 0.006) * 0.75);
#endif
    // The cliff at the confluence and its falls stand in front of what lies behind them.
    col = confCliff(col, dir, aLand);
#ifdef SEA
    // The lee's shade, on the water the words stand over, while the camera is still coming in. (At the ending there is
    // none: the water there is dark of itself, it mirrors the deep of the sky, and the lee only keeps it calm.)
    col *= 1.0 - 0.56 * (1.0 - gDusk) * gLee;
#endif
  }
  // The boulders of the rock pool stand in front of its water and its far bank.
  if (poolNear()) {
    vec3 nR;
    float tR = rockHit(uCamPos, dir, nR);
    if (tR > 0.0) {
      vec3 hp = uCamPos + dir * tR;
      float aR = gRockA * smoothstep(0.0, 1.5 * tR * uPxAng, hp.z + FREEBOARD);
      if (aR > 0.0) col = mix(col, rockColor(hp, nR, tR), aR);
    }
  }
  col = nameIce(col, dir, gndT, gndIce, gndWall);
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
        vec2 away = -normalize(L.xy);
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
  if (uSt.x + uSt.y + uSt.z + uSt.w > 0.0) {
    float twS = dir.z < -0.0006 ? (uCamPos.z + FREEBOARD) / -dir.z : -1.0;
    gSt = smoothstep(0.0, 0.3, uSt);
    if (uSt.x > 0.0) col = columns(col, dir, twS);
    if (uSt.y > 0.0) col = dam(col, dir, twS);
    if (uSt.z > 0.0) col = lattice(col, dir, twS);
    if (uSt.w > 0.0) col = canyon(col, dir, twS);
  }
  if (slabCov > 0.0 && slabCov <= 0.999) col = mix(col, slabCol, slabCov);
#ifdef SEA
  // The ribbon of light stands in front of the ranges: it is only looked for in the strip of the frame it can be in.
  if (uRay.z > 0.0 && dir.z > -0.0006 && vUv.x > uRib.z && vUv.x < uRib.w) col += ribbonSky(dir);
#endif

  // ---- the finish, in this same pass: the glow of the last frame's
  // highlights, a gentle vignette, the filmic curve, and a fine grain that
  // moves (it is also the dither).
  col = max(col, 0.0);
  // (Before dawn, while the name is cut in the sheet, the letters are light in a slot, not a lamp: they throw almost no halo over the ice.)
  if (uBloom > 0.0) col += textureLod(uGlowTex, vUv, 0.0).rgb * uBloom * (1.0 - 0.86 * uNight * smoothstep(0.75, 1.0, uGlow)) * (1.0 - 0.85 * gNmCov);
  vec2 vc = vUv - 0.5;
  col *= 1.0 - dot(vc, vc) * mix(0.42, 0.5, uSea.y);
  // The words' lee. Where words stand the picture keeps itself readable
  // behind them, softly: under dark words nothing is left darker than a
  // light haze, under light words nothing brighter than a deep shade. Only
  // the pixels that would fight the words are touched, and the edge of the
  // lee is wide and soft, so it reads as air and shade, never as a plate.
  // (Most of the frame is nowhere near them: it is let go at once.)
  // (The ending's words need none of it: they stand over the near sea, which is deep and dark of itself. Nothing is
  // laid over that picture.)
  if (uCalmK.x > 0.0 && uCalmK.y < 0.5 && vUv.y < uCalmBox.w + 0.17 && vUv.y > uCalmBox.y - 0.17 && vUv.x < uCalmBox.z + 0.17 && vUv.x > uCalmBox.x - 0.17) {
    vec2 cq = abs(vUv - (uCalmBox.xy + uCalmBox.zw) * 0.5) - (uCalmBox.zw - uCalmBox.xy) * 0.5;
    cq.x *= uLens.y;
    float cd = length(max(cq, 0.0)) + min(max(cq.x, cq.y), 0.0);
    float ck = 1.0 - smoothstep(-0.014, 0.17, cd);
    ck *= ck * uCalmK.x;
    if (ck > 0.0) {
      float l = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
      float shadeK = uNight;
      const float CAP = 0.082;
      const float FLOOR = 0.165;
      float capped = 0.5 * (l + CAP - sqrt((l - CAP) * (l - CAP) + 0.09 * CAP * CAP));
      float lifted = 0.5 * (l + FLOOR + sqrt((l - FLOOR) * (l - FLOOR) + 0.09 * FLOOR * FLOOR));
      col *= mix(1.0, capped / l, ck * shadeK);
      col += (lifted - l) * vec3(0.95, 1.0, 1.07) * ck * (1.0 - shadeK);
    }
  }
  // The captions' lee: the same rule behind the small captions that stand at their points, held closer round them:
  // only what would fight a caption is touched, by as little as lets it be read.
  if (uCapK > 0.0 && vUv.y < uCapBox.w + 0.07 && vUv.y > uCapBox.y - 0.07 && vUv.x < uCapBox.z + 0.07 && vUv.x > uCapBox.x - 0.07) {
    vec2 cq = abs(vUv - (uCapBox.xy + uCapBox.zw) * 0.5) - (uCapBox.zw - uCapBox.xy) * 0.5;
    cq.x *= uLens.y;
    float cd = length(max(cq, 0.0)) + min(max(cq.x, cq.y), 0.0);
    float ck = 1.0 - smoothstep(-0.006, 0.07, cd);
    ck *= ck * uCapK;
    if (ck > 0.0) {
      float l = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
      const float CAP = 0.082;
      const float FLOOR = 0.165;
      float capped = 0.5 * (l + CAP - sqrt((l - CAP) * (l - CAP) + 0.09 * CAP * CAP));
      float lifted = 0.5 * (l + FLOOR + sqrt((l - FLOOR) * (l - FLOOR) + 0.09 * FLOOR * FLOOR));
      col *= mix(1.0, capped / l, ck * uNight);
      col += (lifted - l) * vec3(0.95, 1.0, 1.07) * ck * (1.0 - uNight);
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
