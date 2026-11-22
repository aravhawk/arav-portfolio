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
  // The first step down from full size is one read: the mean of the four texels under it.
  if (uCut > 0.0) { o = vec4(keep(texture(uSrc, vUv).rgb), 1.0); return; }
  vec3 s = keep(texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb)
         + keep(texture(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb)
         + keep(texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb)
         + keep(texture(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
  o = vec4(s * 0.25, 1.0);
}`;

/** Two levels into one: the finer as it is, the coarser read as a tent so its texels never show. */
export const BLOOM_UP = `#version 300 es
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec2 uTexelB;  // one texel of the coarser level
uniform vec2 uW;       // the share of each
in vec2 vUv;
out vec4 o;
void main() {
  vec3 wide = texture(uB, vUv + uTexelB * vec2(-0.5, -0.5)).rgb + texture(uB, vUv + uTexelB * vec2(0.5, -0.5)).rgb
            + texture(uB, vUv + uTexelB * vec2(-0.5, 0.5)).rgb + texture(uB, vUv + uTexelB * vec2(0.5, 0.5)).rgb;
  o = vec4(texture(uA, vUv).rgb * uW.x + wide * 0.25 * uW.y, 1.0);
}`;

export const FINISH = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uGlow;   // the gathered highlights, at half size
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
  if (uBloom > 0.0) col += texture(uGlow, vUv).rgb * uBloom * fin;
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


/**
 * The highlights of the picture that has just been drawn, for the next
 * frame's glow. The source is the finished frame at a quarter size (tone
 * curve and all), so what outshone the curve's shoulder is found by how
 * near white it is, and given back the strength the curve took from it.
 */
export const BLOOM_KEEP = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uCut;    // keep what is brighter than this, in the frame's own (display) light
uniform float uGain;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = pow(texture(uSrc, vUv).rgb, vec3(2.2));
  float l = max(c.r, max(c.g, c.b));
  float k = clamp((l - uCut) / (1.0 - uCut), 0.0, 1.0);
  o = vec4(c * k * k * uGain / max(l, 1e-3), 1.0);
}`;

/**
 * A scene drawn at a lower resolution (while the camera travels), brought to the screen's in one pass: each pixel
 * is read between the scene's own, sharpened against its four neighbours by an amount that follows the local
 * contrast and never leaves the range of the five (so an edge is firmer and nothing rings), and the film's grain
 * is laid on at the screen's own resolution, as the scene's own pass lays it at rest.
 */
export const RECONSTRUCT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uSceneSize;  // the scene's size in its own pixels
uniform vec2 uInvTarget;  // one texel of the texture it lies in
uniform vec2 uGrain;      // the grain's phase and amplitude (the scene pass's uFilm.yz)
uniform float uStrength;
out vec4 o;
vec3 at(vec2 pixel) {
  return textureLod(uSrc, clamp(pixel, vec2(0.5), uSceneSize - 0.5) * uInvTarget, 0.0).rgb;
}
void main() {
  vec2 p = vUv * uSceneSize;
  vec3 m = at(p);
  vec3 a = at(p + vec2(1.0, 0.0)), b = at(p - vec2(1.0, 0.0));
  vec3 c = at(p + vec2(0.0, 1.0)), d = at(p - vec2(0.0, 1.0));
  vec3 lo = min(m, min(min(a, b), min(c, d)));
  vec3 hi = max(m, max(max(a, b), max(c, d)));
  vec3 rgb = clamp(m + uStrength * (1.0 - hi + lo) * (m - 0.25 * (a + b + c + d)), lo, hi);
  float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)) + uGrain.x)) - 0.5;
  float l = dot(rgb, vec3(0.3, 0.6, 0.1));
  rgb += grain * (1.4 / 255.0 + uGrain.y * (0.35 + 1.3 * min(l, 1.0 - l)));
  o = vec4(rgb, 1.0);
}`;
