/**
 * Simulation shaders. Everything here runs at a fraction of screen
 * resolution on half-float targets.
 *
 * Shared layout
 *   bedA  RGBA16F  r: signed distance to the bank in CSS px (negative = water)
 *                  g: unused, b,a: unit gradient of the distance field
 *   bedB  RGBA8    r,g: flow direction * speed (0.5 centred), b: agitation
 *   wave  RGBA16F  r: surface height, g: its velocity, b,a: height gradient
 *   vel   RGBA16F  r,g: velocity added by the pointer (px/s), b: pressure, a: divergence
 *   dye   RGBA16F  r: foam, g: meltwater silt, b: unused
 */

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
`;

/** World position (CSS px) of a simulation texel centre. */
const SIM_COMMON = `
uniform vec4 uSim;      // x: world y of row 0 edge, y: texel size px, z: sim w, w: sim h
uniform vec2 uBedSize;  // bed texture size in texels
uniform float uBedDiv;  // CSS px per bed texel
uniform sampler2D uBedA;
uniform sampler2D uBedB;
vec2 simWorld(vec2 uv) {
  return vec2(uv.x * uSim.z * uSim.y, uSim.x + uv.y * uSim.w * uSim.y);
}
vec2 bedUv(vec2 world) { return world / (uBedSize * uBedDiv); }
float bedSd(vec2 world) { return texture(uBedA, bedUv(world)).r; }
vec3 bedFlow(vec2 world) {
  vec3 f = texture(uBedB, bedUv(world)).rgb;
  return vec3((f.rg - 0.5019608) * 2.0, f.b);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

/**
 * Build bedA and bedB from the CPU-side rasters: gradient of the distance
 * field, and a blur of the flow map so direction turns smoothly.
 */
export const BED_A = `${HEAD}
uniform sampler2D uSd;   // R32F, texels are CSS px of signed distance
void main() {
  ivec2 sz = textureSize(uSd, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  #define S(dx, dy) texelFetch(uSd, clamp(p + ivec2(dx, dy), ivec2(0), sz - 1), 0).r
  float c = S(0, 0);
  // Sobel gradient: smoother than central differences on a coarse field.
  float gx = (S(1, -1) + 2.0 * S(1, 0) + S(1, 1)) - (S(-1, -1) + 2.0 * S(-1, 0) + S(-1, 1));
  float gy = (S(-1, 1) + 2.0 * S(0, 1) + S(1, 1)) - (S(-1, -1) + 2.0 * S(0, -1) + S(1, -1));
  vec2 g = vec2(gx, gy);
  float l = length(g);
  g = l > 1e-5 ? g / l : vec2(0.0);
  // A light blur of the distance removes the last stair steps on diagonals.
  float s = (c * 4.0 + S(1, 0) + S(-1, 0) + S(0, 1) + S(0, -1)) / 8.0;
  o = vec4(s, 0.0, g);
}`;

export const BED_B = `${HEAD}
uniform sampler2D uRaw;  // RGBA8 flow raster
void main() {
  vec2 px = 1.0 / vec2(textureSize(uRaw, 0));
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int y = -3; y <= 3; y++) {
    for (int x = -3; x <= 3; x++) {
      float w = exp(-float(x * x + y * y) / 6.0);
      acc += texture(uRaw, vUv + vec2(float(x), float(y)) * px).rgb * w;
      wsum += w;
    }
  }
  o = vec4(acc / wsum, 1.0);
}`;

/**
 * Surface waves: the linear wave equation on the water mask, with banks as
 * reflecting walls. Scroll moves the window in whole texels (uShift) so the
 * field is never resampled and never blurs.
 */
export const WAVE = `${HEAD}
${SIM_COMMON}
uniform sampler2D uWave;
uniform vec2 uShift;        // whole texels the window moved since the last step
uniform float uDt;
uniform float uTime;
uniform vec4 uPtr;          // pointer segment: prev.xy -> cur.xy in world px
uniform vec2 uPtrForce;     // x: strength (speed based), y: radius px
uniform vec4 uDrop;         // x,y world, z radius, w strength (one discrete splash)
uniform vec4 uIce;          // ice name rect in world px: x, y, w, h
uniform sampler2D uIceSdf;
uniform vec2 uIceMelt;      // x: erosion px, y: melt rate (drips)
uniform float uAmbient;     // strength of flow-driven ripples
uniform sampler2D uDetail;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

vec4 fetchWave(ivec2 q, ivec2 sz) {
  if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) return vec4(0.0);
  return texelFetch(uWave, q, 0);
}

void main() {
  ivec2 sz = ivec2(uSim.zw);
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 world = simWorld(vUv);
  float sd = bedSd(world);
  if (sd > 0.0) { o = vec4(0.0); return; }

  ivec2 q = p + ivec2(uShift);
  vec4 c = fetchWave(q, sz);
  float h = c.r;
  float v = c.g;

  float dx = uSim.y;
  // Neighbours on land mirror the centre: a wall the wave reflects from.
  float sl = bedSd(world + vec2(-dx, 0.0));
  float sr = bedSd(world + vec2(dx, 0.0));
  float su = bedSd(world + vec2(0.0, -dx));
  float sdn = bedSd(world + vec2(0.0, dx));
  float hl = sl > 0.0 ? h : fetchWave(q + ivec2(-1, 0), sz).r;
  float hr = sr > 0.0 ? h : fetchWave(q + ivec2(1, 0), sz).r;
  float hu = su > 0.0 ? h : fetchWave(q + ivec2(0, -1), sz).r;
  float hd = sdn > 0.0 ? h : fetchWave(q + ivec2(0, 1), sz).r;

  float lap = hl + hr + hu + hd - 4.0 * h;
  // Shallow water is slower: waves bend toward the banks as they arrive.
  float depth = clamp(-sd / 40.0, 0.12, 1.0);
  float c2 = 0.42 * mix(0.45, 1.0, depth);   // (c dt / dx)^2, stable below 0.5
  v += c2 * lap;
  v *= exp(-uDt * mix(2.4, 0.9, depth));
  h += v;
  h += 0.02 * lap;                           // a little viscosity kills grid noise
  h *= exp(-uDt * 0.35);

  // Pointer: a finger pushed through water leaves a trough along its path.
  if (uPtrForce.x > 0.0) {
    float d = segDist(world, uPtr.xy, uPtr.zw);
    float g = exp(-d * d / (uPtrForce.y * uPtrForce.y));
    h -= uPtrForce.x * g;
  }
  // One discrete splash (a tap, a gate closing).
  if (uDrop.w != 0.0) {
    float d = length(world - uDrop.xy);
    float g = exp(-d * d / (uDrop.z * uDrop.z));
    h -= uDrop.w * g;
  }
  // Flow that meets a bank or an inlet stirs the surface.
  vec3 fl = bedFlow(world);
  float speed = length(fl.xy);
  if (uAmbient > 0.0) {
    // Band-limited noise that boils in place: smooth in space and time.
    float n = texture(uDetail, world / 170.0 + vec2(0.31, -0.23) * uTime).r
            - texture(uDetail, world / 120.0 - vec2(0.27, 0.19) * uTime + 0.5).r;
    float stir = fl.z * 1.5 + speed * smoothstep(-14.0, -2.0, sd) * 0.22;
    v += n * stir * uAmbient * 0.016;
  }
  // Meltwater dripping off the ice edge.
  if (uIceMelt.y > 0.0) {
    vec2 iuv = (world - uIce.xy) / uIce.zw;
    if (iuv.x > 0.0 && iuv.x < 1.0 && iuv.y > 0.0 && iuv.y < 1.0) {
      float isd = texture(uIceSdf, iuv).r + uIceMelt.x;
      float edge = exp(-isd * isd / 18.0);
      float n = texture(uDetail, world / 60.0 + vec2(0.9, 0.7) * uTime).r;
      v -= edge * smoothstep(0.62, 0.9, n) * uIceMelt.y * 0.05;
    }
  }

  // Soft absorbing band at the top and bottom of the window.
  float edgeFade = smoothstep(0.0, 6.0, float(p.y)) * smoothstep(0.0, 6.0, float(sz.y - 1 - p.y));
  h *= mix(0.9, 1.0, edgeFade);
  v *= mix(0.9, 1.0, edgeFade);
  o = vec4(h, v, 0.0, 0.0);
}`;

/** Height gradient, stored so the shading pass needs one tap for normals. */
export const WAVE_GRAD = `${HEAD}
uniform sampler2D uWave;
void main() {
  ivec2 sz = textureSize(uWave, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(uWave, p, 0);
  float l = texelFetch(uWave, clamp(p + ivec2(-1, 0), ivec2(0), sz - 1), 0).r;
  float r = texelFetch(uWave, clamp(p + ivec2(1, 0), ivec2(0), sz - 1), 0).r;
  float u = texelFetch(uWave, clamp(p + ivec2(0, -1), ivec2(0), sz - 1), 0).r;
  float d = texelFetch(uWave, clamp(p + ivec2(0, 1), ivec2(0), sz - 1), 0).r;
  o = vec4(c.r, c.g, (r - l) * 0.5, (d - u) * 0.5);
}`;

/**
 * Pointer-driven velocity. Advected by the bed's flow plus itself, damped,
 * forced by the moving pointer, and made divergence free below.
 */
export const VEL_ADVECT = `${HEAD}
${SIM_COMMON}
uniform sampler2D uVel;
uniform vec2 uShift;
uniform float uDt;
uniform float uFlowSpeed;   // px/s at flow = 1
uniform vec4 uPtr;
uniform vec3 uPtrVel;       // xy: pointer velocity px/s, z: radius px
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  vec2 world = simWorld(vUv);
  float sd = bedSd(world);
  if (sd > 0.0) { o = vec4(0.0); return; }
  vec2 texel = 1.0 / uSim.zw;
  vec2 here = vUv + uShift * texel;
  vec2 u0 = texture(uVel, here).rg;
  vec2 total = bedFlow(world).xy * uFlowSpeed + u0;
  vec2 src = here - total * uDt / uSim.y * texel;
  vec2 u = texture(uVel, src).rg;
  u *= exp(-uDt * 0.9);
  if (uPtrVel.z > 0.0) {
    float d = segDist(world, uPtr.xy, uPtr.zw);
    float g = exp(-d * d / (uPtrVel.z * uPtrVel.z));
    u += uPtrVel.xy * g * 0.55;
  }
  // No slip into the bank.
  u *= smoothstep(0.0, -6.0, sd);
  float l = length(u);
  if (l > 900.0) u *= 900.0 / l;
  o = vec4(u, texture(uVel, here).b, 0.0);
}`;

export const VEL_DIV = `${HEAD}
uniform sampler2D uVel;
void main() {
  ivec2 sz = textureSize(uVel, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  #define V(dx, dy) texelFetch(uVel, clamp(p + ivec2(dx, dy), ivec2(0), sz - 1), 0)
  vec4 c = V(0, 0);
  float div = 0.5 * (V(1, 0).r - V(-1, 0).r + V(0, 1).g - V(0, -1).g);
  o = vec4(c.rg, c.b * 0.8, div);
}`;

export const VEL_PRESSURE = `${HEAD}
uniform sampler2D uVel;
void main() {
  ivec2 sz = textureSize(uVel, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  #define V(dx, dy) texelFetch(uVel, clamp(p + ivec2(dx, dy), ivec2(0), sz - 1), 0)
  vec4 c = V(0, 0);
  float pr = (V(-1, 0).b + V(1, 0).b + V(0, -1).b + V(0, 1).b - c.a) * 0.25;
  o = vec4(c.rg, pr, c.a);
}`;

export const VEL_PROJECT = `${HEAD}
uniform sampler2D uVel;
void main() {
  ivec2 sz = textureSize(uVel, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  #define V(dx, dy) texelFetch(uVel, clamp(p + ivec2(dx, dy), ivec2(0), sz - 1), 0)
  vec4 c = V(0, 0);
  vec2 grad = 0.5 * vec2(V(1, 0).b - V(-1, 0).b, V(0, 1).b - V(0, -1).b);
  o = vec4(c.rg - grad, c.b, c.a);
}`;

/** Foam and meltwater silt, carried by the full velocity field. */
export const DYE = `${HEAD}
${SIM_COMMON}
uniform sampler2D uDye;
uniform sampler2D uVel;
uniform sampler2D uWave;
uniform vec2 uShift;
uniform float uDt;
uniform float uTime;
uniform float uFlowSpeed;
uniform vec4 uPtr;
uniform vec2 uPtrForce;
uniform vec4 uIce;
uniform sampler2D uIceSdf;
uniform vec2 uIceMelt;
uniform sampler2D uDetail;
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  vec2 world = simWorld(vUv);
  float sd = bedSd(world);
  if (sd > 0.0) { o = vec4(0.0); return; }
  vec2 texel = 1.0 / uSim.zw;
  vec2 here = vUv + uShift * texel;
  vec3 fl = bedFlow(world);
  vec2 total = fl.xy * uFlowSpeed + texture(uVel, here).rg;
  vec2 src = here - total * uDt / uSim.y * texel;
  vec4 d = texture(uDye, src);
  // Silt spreads as it travels: a cloud, never a hard edge.
  vec4 dn4 = texture(uDye, src + vec2(texel.x, 0.0)) + texture(uDye, src - vec2(texel.x, 0.0))
           + texture(uDye, src + vec2(0.0, texel.y)) + texture(uDye, src - vec2(0.0, texel.y));
  d = mix(d, dn4 * 0.25, 0.22);
  float foam = d.r * exp(-uDt * 0.55);
  float silt = d.g * exp(-uDt * 0.2);

  // Foam where the surface is steep or the flow is stirred.
  vec4 w = texture(uWave, here);
  float steep = length(w.ba);
  float n = texture(uDetail, world / 90.0 + vec2(0.4, 0.3) * uTime).r;
  foam += smoothstep(0.012, 0.05, steep) * 0.04;
  foam += fl.z * smoothstep(0.5, 0.8, n) * 0.07;
  if (uPtrForce.x > 0.0) {
    float dd = segDist(world, uPtr.xy, uPtr.zw);
    foam += exp(-dd * dd / (uPtrForce.y * uPtrForce.y * 0.6)) * uPtrForce.x * 1.4;
  }
  // The melting ice sheds pale silt that the current carries off.
  if (uIceMelt.y > 0.0) {
    vec2 iuv = (world - uIce.xy) / uIce.zw;
    if (iuv.x > 0.0 && iuv.x < 1.0 && iuv.y > 0.0 && iuv.y < 1.0) {
      float isd = texture(uIceSdf, iuv).r + uIceMelt.x;
      silt += exp(-isd * isd / 60.0) * uIceMelt.y * 0.9;
    }
  }
  o = vec4(min(foam, 1.5), min(silt, 1.5), 0.0, 0.0);
}`;

/**
 * Tileable detail field, baked once: surface height, its gradient, and the
 * caustic that surface casts on a bed below it.
 *
 * The caustic is the real thing in miniature: light refracted by a surface
 * h lands at x + D grad h, so brightness is one over the Jacobian of that
 * map, |(1 + D hxx)(1 + D hyy) - (D hxy)^2|. Where the Jacobian folds to
 * zero, light piles up into the bright filaments.
 */
export const DETAIL = `${HEAD}
// Periodic gradient noise with quintic fade, so second derivatives are
// continuous and the caustic has no lattice seams.
vec2 g2(vec2 p, float per) {
  p = mod(p, per);
  float n = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  float a = n * 6.2831853;
  return vec2(cos(a), sin(a));
}
float gn(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(g2(i, per), f);
  float b = dot(g2(i + vec2(1.0, 0.0), per), f - vec2(1.0, 0.0));
  float c = dot(g2(i + vec2(0.0, 1.0), per), f - vec2(0.0, 1.0));
  float d = dot(g2(i + vec2(1.0, 1.0), per), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float field(vec2 p) {
  // A slow warp makes crests meander like wind-worked water.
  vec2 w = vec2(gn(p * 3.0 + 1.7, 3.0), gn(p * 3.0 + 5.2, 3.0));
  vec2 q = p + w * 0.09;
  float h = 0.0;
  h += 0.62 * gn(q * 6.0, 6.0);
  h += 0.30 * gn(q * 11.0 + 3.1, 11.0);
  h += 0.13 * gn(q * 19.0 + 7.9, 19.0);
  return h * 1.25;
}
void main() {
  float e = 1.0 / 512.0;
  float c = field(vUv);
  float l = field(vUv - vec2(e, 0.0));
  float r = field(vUv + vec2(e, 0.0));
  float u = field(vUv - vec2(0.0, e));
  float d = field(vUv + vec2(0.0, e));
  float ul = field(vUv + vec2(-e, -e));
  float ur = field(vUv + vec2(e, -e));
  float dl = field(vUv + vec2(-e, e));
  float dr = field(vUv + vec2(e, e));
  vec2 g = vec2(r - l, d - u) / (2.0 * e);
  float hxx = (l + r - 2.0 * c) / (e * e);
  float hyy = (u + d - 2.0 * c) / (e * e);
  float hxy = (dr - dl - ur + ul) / (4.0 * e * e);
  const float D = 0.00115;
  float J = (1.0 + D * hxx) * (1.0 + D * hyy) - D * D * hxy * hxy;
  float I = 1.0 / max(abs(J), 0.11);
  // Packed for RGBA8: height, gradient / 16, caustic / 6.
  o = vec4(c * 0.5 + 0.5, clamp(g / 16.0 * 0.5 + 0.5, 0.0, 1.0), clamp(I / 6.0, 0.0, 1.0));
}`;

/** Tileable grain: stone speckle, mottling, ice inclusions, dither. */
export const GRAIN = `${HEAD}
float h21(vec2 p) {
  p = mod(p, 256.0);
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p, float period) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(mod(i, period));
  float b = h21(mod(i + vec2(1.0, 0.0), period));
  float c = h21(mod(i + vec2(0.0, 1.0), period));
  float d = h21(mod(i + vec2(1.0, 1.0), period));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float worley(vec2 p, float period) {
  vec2 i = floor(p), f = fract(p);
  float m = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 cell = mod(i + g, period);
    vec2 o2 = vec2(h21(cell), h21(cell + 91.7));
    m = min(m, length(g + o2 - f));
  }
  return m;
}
void main() {
  vec2 p = vUv * 256.0;
  float speck = h21(floor(p));
  float mott = 0.5 * vnoise(p / 16.0, 16.0) + 0.3 * vnoise(p / 6.0, 256.0 / 6.0) + 0.2 * vnoise(p / 2.5, 256.0 / 2.5);
  float cells = worley(p / 21.333, 12.0);
  float fine = worley(p / 5.333, 48.0);
  o = vec4(speck, mott, cells, fine);
}`;
