/**
 * The flight's finish. The scene is drawn in linear light to a
 * floating-point target; these passes turn it into a picture.
 *
 * Bloom: only what is brighter than a threshold (the sun, glitter, the
 * aurora in the water) is carried down three half-steps and added back, so
 * a highlight has a soft halo and nothing else changes. The scene itself
 * is never blurred.
 *
 * Then, in one pass: the bloom, a gentle vignette, the filmic curve, and a
 * fine grain that moves.
 */

/** Half the size: four taps, each the mean of four texels. uCut > 0 keeps only the highlights. */
export const BLOOM_DOWN = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;   // one texel of the source
uniform float uCut;    // keep what is brighter than this (0: keep all)
in vec2 vUv;
out vec4 o;
vec3 keep(vec3 c) {
  // Bounded, so one hot pixel cannot flicker the whole halo.
  c = min(c, vec3(24.0));
  if (uCut <= 0.0) return c;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uCut, 0.0);
  return c * (k * k / (k + 0.5 * uCut)) / max(l, 1e-4);
}
void main() {
  vec3 s = keep(texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb)
         + keep(texture(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb)
         + keep(texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb)
         + keep(texture(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
  o = vec4(s * 0.25, 1.0);
}`;

export const FINISH = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform sampler2D uB3;
uniform vec2 uTexel3;  // one texel of the smallest bloom level
uniform float uBloom;
uniform float uTime;
uniform float uEnd;    // 1: the top-down last frame, which is the page's own water and takes no finish
in vec2 vUv;
out vec4 o;
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 col = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb;
  float fin = 1.0 - uEnd;
  if (uBloom > 0.0) {
    // The widest level is read as a tent, so its texels never show.
    vec3 wide = texture(uB3, vUv + uTexel3 * vec2(-0.5, -0.5)).rgb + texture(uB3, vUv + uTexel3 * vec2(0.5, -0.5)).rgb
              + texture(uB3, vUv + uTexel3 * vec2(-0.5, 0.5)).rgb + texture(uB3, vUv + uTexel3 * vec2(0.5, 0.5)).rgb;
    vec3 bloom = texture(uB1, vUv).rgb * 0.34 + texture(uB2, vUv).rgb * 0.33 + wide * 0.25 * 0.33;
    col += bloom * uBloom * fin;
  }
  vec2 c = vUv - 0.5;
  col *= 1.0 - dot(c, c) * 0.42 * fin;
  col = mix(aces(col * 1.12), col, uEnd);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  // Grain: fine, moving, strongest in the middle tones; it is also the dither.
  float g = hash21(gl_FragCoord.xy + fract(uTime * 7.31) * vec2(317.0, 113.0)) - 0.5;
  float l = dot(col, vec3(0.3, 0.6, 0.1));
  col += g * (1.6 / 255.0 + 0.022 * fin * (0.35 + 2.6 * l * (1.0 - l)));
  o = vec4(col, 1.0);
}`;
