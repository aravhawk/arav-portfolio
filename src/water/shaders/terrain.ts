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
