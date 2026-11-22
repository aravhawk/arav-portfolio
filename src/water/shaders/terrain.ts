/**
 * What the flight bakes once at start-up, so that nothing fine is computed
 * per pixel at a low angle: the snow's relief (a tileable height field: its
 * slope, and where each place lies in the shadow of another), read each
 * frame through a full mip chain with anisotropic filtering.
 */

import { SUN } from '../geography';

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
`;

/** Periodic gradient noise with a quintic fade (the detail field's). */
export const PNOISE = `
vec2 tg2(vec2 p, vec2 per) {
  p = mod(p, per);
  float n = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  float a = n * 6.2831853;
  return vec2(cos(a), sin(a));
}
float tgn(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(tg2(i, per), f);
  float b = dot(tg2(i + vec2(1.0, 0.0), per), f - vec2(1.0, 0.0));
  float c = dot(tg2(i + vec2(0.0, 1.0), per), f - vec2(0.0, 1.0));
  float d = dot(tg2(i + vec2(1.0, 1.0), per), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float tgn(vec2 p, float per) { return tgn(p, vec2(per)); }
`;

/** The wind's heading across the snow: radians from +y toward +x. Every ridge on the land runs this way. */
export const WIND = 0.96;
/**
 * The two bearings the snow's cast shadows are baked for: the morning's sun
 * through the stations, and the low light before dawn (and late in the day).
 * The picture leans between the two as the light comes round.
 */
export const SHADE_AZ = { a: -0.44, b: 0.3 };
/** A bearing in the world, turned into the snow tile's own frame (x along the wind). */
const inTile = (az: number): [number, number] => {
  const w = [Math.sin(WIND), Math.cos(WIND)];
  const l = [Math.sin(az), Math.cos(az)];
  return [l[0] * w[0] + l[1] * w[1], -l[0] * w[1] + l[1] * w[0]];
};
export const SHADE_DIRS = [...inTile(SHADE_AZ.a), ...inTile(SHADE_AZ.b)];

/**
 * The snow, as a height field one tile wide, in units of the tile (so a
 * slope here is a slope in the world at whatever size the tile is laid).
 * The wind blows along +x. Four things, all cut by it:
 *  - a low swell, too gentle ever to shade itself;
 *  - drifts: long banks with a gentle windward ramp and a crisp lee edge;
 *  - sastrugi: narrow ridges, many to a drift, sharp-crested, where the
 *    wind has worked the surface, and calm snow between those places;
 *  - a finer set riding on them.
 * The edges are steep on purpose: under a sun five degrees up, a crest is a
 * bright line with a clean shadow beside it.
 */
const SNOW_FIELD = `
float tent(float n, float gentle, float steep) { return smoothstep(-gentle, 0.0, n) * (1.0 - smoothstep(0.0, steep, n)); }
float swell(vec2 q) { return 0.008 * (0.6 * tgn(q * vec2(2.0, 3.0), vec2(2.0, 3.0)) + 0.4 * tgn(q * vec2(3.0, 5.0) + 3.1, vec2(3.0, 5.0))); }
float cut(vec2 q) {
  float nd = tgn(q * vec2(2.0, 7.0) + 7.7, vec2(2.0, 7.0)) + 0.3 * tgn(q * vec2(4.0, 15.0) + 1.3, vec2(4.0, 15.0));
  float drift = tent(nd - 0.1, 0.64, 0.17);
  float worked = smoothstep(-0.02, 0.26, tgn(q * 3.0 + 9.3, 3.0));
  float ns = tgn(q * vec2(3.0, 25.0) + 2.2, vec2(3.0, 25.0)) + 0.22 * tgn(q * vec2(5.0, 47.0) + 4.4, vec2(5.0, 47.0));
  float sast = tent(ns - 0.04, 0.3, 0.06) * worked;
  float worked2 = smoothstep(0.0, 0.28, tgn(q * 5.0 + 3.9, 5.0));
  float nf = tgn(q * vec2(5.0, 59.0) + 6.1, vec2(5.0, 59.0));
  float fine = tent(nf - 0.05, 0.3, 0.12) * worked2;
  // The wind scours broad lanes clean between patches of ridged snow.
  float cover = smoothstep(-0.25, 0.19, tgn(q * 2.0 + 8.6, 2.0));
  return cover * (0.0031 * drift + 0.00065 * sast + 0.00019 * fine);
}
vec2 bent(vec2 p) {
  return p + vec2(0.12 * tgn(p * 2.0 + 1.7, 2.0), 0.17 * tgn(p * 2.0 + 5.2, 2.0));
}
`;

/** The cut forms alone (drifts, sastrugi), kept in half floats: what the shadows are marched through. */
export const SNOW_H = `${HEAD}
${PNOISE}
${SNOW_FIELD}
void main() { o = vec4(cut(bent(vUv)), 0.0, 0.0, 1.0); }`;

/**
 * The snow as the picture reads it. rg: the slope of the whole field.
 * b, a: for each of the two baked bearings, the horizon toward the light
 * (the steepest rise to any snow that way, as a tangent): where it stands
 * above the sun, the place is in shade. Kept as a tangent and not as a
 * shadow, so the edge is cut in the picture at whatever size the tile is
 * seen, and stays an edge when the tile is laid large.
 */
export const GROUND = `${HEAD}
${PNOISE}
${SNOW_FIELD}
uniform sampler2D uH;
uniform vec4 uDirs;
float whole(vec2 p) { vec2 q = bent(p); return swell(q) + cut(q); }
float horizon(vec2 d, float h0, float lean) {
  const float E = 1.0 / 1024.0;
  float m = -1.0;
  for (int i = 2; i <= 46; i++) {
    float s = E * (float(i) + 0.055 * float(i * i));
    m = max(m, (textureLod(uH, vUv + d * s, 0.0).r - h0) / s);
  }
  return m + lean;
}
void main() {
  const float e = 0.5 / 1024.0;
  vec2 g = vec2(whole(vUv + vec2(e, 0.0)) - whole(vUv - vec2(e, 0.0)), whole(vUv + vec2(0.0, e)) - whole(vUv - vec2(0.0, e))) / (2.0 * e);
  // (The swell is a plane over the length of any shadow: its own lean toward the light is added to the cut forms' horizon.)
  vec2 q = bent(vUv);
  vec2 gs = vec2(swell(bent(vUv + vec2(e, 0.0))) - swell(bent(vUv - vec2(e, 0.0))), swell(bent(vUv + vec2(0.0, e))) - swell(bent(vUv - vec2(0.0, e)))) / (2.0 * e);
  float h0 = cut(q);
  float ha = max(horizon(uDirs.xy, h0, dot(gs, uDirs.xy)), dot(g, uDirs.xy));
  float hb = max(horizon(uDirs.zw, h0, dot(gs, uDirs.zw)), dot(g, uDirs.zw));
  o = vec4(g, ha, hb);
}`;

/** What the panorama of the ranges covers: bearings either side of +y, and elevations from the horizon up. */
/** (On a screen that can show it the panorama is drawn finer than a pixel of the picture; elsewhere at the smaller size.) */
export const PANO = { az: 1.75, el: 0.11, w: 8192, h: 384, wSmall: 4096, hSmall: 256 };

/**
 * The country the ranges are cut from: a ridged height field, tileable.
 * Each finer ridge grows only where the coarser one stands, which is what
 * gives spurs running down from crests and not noise laid on a cone.
 */
export const MOUNT_H = `${HEAD}
${PNOISE}
void main() {
  vec2 p = vUv;
  vec2 w = vec2(tgn(p * 4.0 + 1.7, 4.0), tgn(p * 4.0 + 5.2, 4.0));
  vec2 q = p + w * 0.035;
  float h = 0.0, a = 0.5, f = 3.0, wgt = 1.0;
  // (Eight sizes of ridge: the last are the gullies and ribs that give a face its drawing from across the valley.)
  for (int i = 0; i < 8; i++) {
    float r = 1.0 - min(abs(tgn(q * f + float(i) * 3.7, f)) * 2.2, 1.0);
    r *= r;
    h += a * r * wgt;
    wgt = clamp(r * 1.7, 0.0, 1.0);
    a *= 0.5;
    f *= 2.0;
  }
  // Massifs, with lower country between them.
  h *= 0.3 + 0.7 * smoothstep(-0.25, 0.3, tgn(p * 2.0 + 8.1, 2.0));
  o = vec4(h, 0.0, 0.0, 1.0);
}`;

/**
 * The ranges as the eye at the middle of the world sees them, marched once:
 * for each bearing and elevation, the first slope the ray meets. Kept per
 * texel: how much morning sun the slope gets (its own facing, and the long
 * shadows other slopes throw on it), how much sky it sees, whether snow
 * lies on it (not where it is steep), and how far off it stands, which is
 * how much air lies in front of it. Open sky is distance 1.
 */
export const MOUNT_PANO = `${HEAD}
uniform sampler2D uH;
const float SPAN = 64000.0;
const float R0 = 15000.0;
const float R1 = 96000.0;
float H(vec2 xy) {
  float r = length(xy);
  return textureLod(uH, xy / SPAN + 0.5, 0.0).r * (1150.0 + 0.062 * r) * smoothstep(R0, R0 + 9000.0, r);
}
void main() {
  float az = (vUv.x - 0.5) * ${(2 * PANO.az).toFixed(4)};
  float tz = tan(vUv.y * ${PANO.el.toFixed(4)});
  vec2 hd = vec2(sin(az), cos(az));
  float u = R0;
  bool hit = false;
  for (int i = 0; i < 200; i++) {
    float un = u * 1.0095;
    if (H(hd * un) > un * tz) {
      float lo = u, hi = un;
      for (int k = 0; k < 7; k++) {
        float mid = 0.5 * (lo + hi);
        if (H(hd * mid) > mid * tz) hi = mid; else lo = mid;
      }
      u = hi;
      hit = true;
      break;
    }
    u = un;
  }
  if (!hit) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 xy = hd * u;
  float z = H(xy);
  const float E = 46.0;
  vec3 n = normalize(vec3(H(xy - vec2(E, 0.0)) - H(xy + vec2(E, 0.0)), H(xy - vec2(0.0, E)) - H(xy + vec2(0.0, E)), 2.0 * E));
  vec3 sun = vec3(sin(${SUN.az.toFixed(4)}) * cos(${SUN.el.toFixed(4)}), cos(${SUN.az.toFixed(4)}) * cos(${SUN.el.toFixed(4)}), sin(${SUN.el.toFixed(4)}));
  float sh = 1.0;
  for (int j = 1; j <= 40; j++) {
    float s = 100.0 * float(j) + 6.0 * float(j * j);
    float clear = z + 30.0 + s * sun.z / length(sun.xy) - H(xy + normalize(sun.xy) * s);
    // (A shadow's edge is narrow: the sun is a small disc.)
    sh = min(sh, clamp(clear / (s * 0.014), 0.0, 1.0));
  }
  float light = max(dot(n, sun), 0.0) * sh;
  float rough = textureLod(uH, xy / SPAN * 7.3 + 0.21, 0.0).r;
  float snow = smoothstep(0.66, 0.8, n.z + 0.25 * (rough - 0.3));
  o = vec4(light, 0.5 + 0.5 * n.z, snow, clamp((u - R0) / (R1 - R0), 0.0, 0.84));
}`;

/**
 * Sky texels just above a ridgeline take the slope's values from below
 * them, so that where the picture blends ridge into sky the ridge keeps its
 * own light to its very edge. Distance is left alone: it is what says sky.
 */
export const MOUNT_EDGE = `${HEAD}
uniform sampler2D uPano;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(uPano, p, 0);
  if (c.a > 0.9) {
    for (int k = 1; k <= 9; k++) {
      vec4 d = texelFetch(uPano, ivec2(p.x, max(p.y - k, 0)), 0);
      if (d.a < 0.9) { c.rgb = d.rgb; break; }
    }
  }
  o = c;
}`;
