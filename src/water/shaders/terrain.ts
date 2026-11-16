/**
 * What the flight bakes once at start-up, so that nothing fine is computed
 * per pixel at a low angle: the snow's relief (a tileable height field with
 * its slope), read each frame through a full mip chain with anisotropic
 * filtering.
 */

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

/**
 * The snow. Broad smooth dunes, and across a part of them a few long drift
 * ridges the wind has cut: each a gentle windward ramp that ends in a crisp
 * lee edge. Most of the field is smooth on purpose, so the forms that are
 * there read. The wind blows along +x of the tile.
 *
 * Out: r height, gb its slope (packed), a a second smooth field for where
 * bare stone and ice show.
 */
export const GROUND = `${HEAD}
${PNOISE}
float snowH(vec2 p) {
  vec2 w = vec2(tgn(p * 2.0 + 1.7, 2.0), tgn(p * 2.0 + 5.2, 2.0));
  vec2 q = p + w * 0.07;
  // Dunes.
  float h = 0.62 * tgn(q * 3.0, 3.0) + 0.3 * tgn(q * 5.0 + 3.1, 5.0) + 0.1 * tgn(q * 9.0 + 7.9, 9.0);
  // Drift ridges: long along the wind, in the places the wind worked.
  float worked = smoothstep(0.02, 0.32, tgn(q * 2.0 + 9.3, 2.0));
  float s = fract(q.y * 7.0 + 1.6 * tgn(q * vec2(2.0, 4.0) + 2.2, vec2(2.0, 4.0)));
  float ramp = smoothstep(0.0, 0.82, s) * (1.0 - smoothstep(0.82, 1.0, s));
  float len = smoothstep(-0.1, 0.25, tgn(q * vec2(3.0, 7.0) + 4.4, vec2(3.0, 7.0)));
  return h + 0.16 * ramp * worked * len;
}
void main() {
  float e = 1.0 / 1024.0;
  float c = snowH(vUv);
  vec2 g = vec2(snowH(vUv + vec2(e, 0.0)) - snowH(vUv - vec2(e, 0.0)), snowH(vUv + vec2(0.0, e)) - snowH(vUv - vec2(0.0, e))) / (2.0 * e);
  float m = 0.6 * tgn(vUv * 4.0 + 6.1, 4.0) + 0.3 * tgn(vUv * 9.0 + 2.3, 9.0) + 0.14 * tgn(vUv * 23.0 + 8.8, 23.0);
  // Packed for RGBA8: slopes of the field run to about 8 either way.
  o = vec4(c * 0.5 + 0.5, clamp(g / 16.0 + 0.5, 0.0, 1.0), m * 0.5 + 0.5);
}`;

/** Where the morning sun stands: bearing from +y toward +x, and height, radians. */
export const SUN = { az: -0.52, el: 0.088 };
/** What the panorama of the ranges covers: bearings either side of +y, and elevations from the horizon up. */
export const PANO = { az: 1.75, el: 0.11, w: 4096, h: 256 };

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
  for (int i = 0; i < 6; i++) {
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
  const float E = 90.0;
  vec3 n = normalize(vec3(H(xy - vec2(E, 0.0)) - H(xy + vec2(E, 0.0)), H(xy - vec2(0.0, E)) - H(xy + vec2(0.0, E)), 2.0 * E));
  vec3 sun = vec3(sin(${SUN.az.toFixed(4)}) * cos(${SUN.el.toFixed(4)}), cos(${SUN.az.toFixed(4)}) * cos(${SUN.el.toFixed(4)}), sin(${SUN.el.toFixed(4)}));
  float sh = 1.0;
  for (int j = 1; j <= 40; j++) {
    float s = 100.0 * float(j) + 6.0 * float(j * j);
    float clear = z + 30.0 + s * sun.z / length(sun.xy) - H(xy + normalize(sun.xy) * s);
    sh = min(sh, clamp(clear / (s * 0.035), 0.0, 1.0));
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
    for (int k = 1; k <= 6; k++) {
      vec4 d = texelFetch(uPano, ivec2(p.x, max(p.y - k, 0)), 0);
      if (d.a < 0.9) { c.rgb = d.rgb; break; }
    }
  }
  o = c;
}`;
