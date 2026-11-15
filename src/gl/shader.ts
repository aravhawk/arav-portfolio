/**
 * One drop: a raymarched body of liquid glass.
 * Authored forms are signed distance functions; up to three are blended at once
 * so a morph can always be interrupted. Glass is real refraction: the ray bends
 * on entry, is marched through the body, and leaves once per colour channel
 * with its own index of refraction, which is what produces the dispersion.
 */
export const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const FRAG = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uBound;
uniform mat3 uRot;
uniform ivec3 uShape;
uniform vec3 uW;
uniform vec3 uGround;
uniform vec3 uInk;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform sampler2D uMask;
uniform float uMaskAmt;
uniform vec3 uLight;
uniform float uVel;
uniform float uGather;
uniform vec4 uP;      // x: switch, y: grow, z: pulse, w: wobble
uniform float uGlow;
uniform float uShadow;
uniform vec4 uOrb[3];  // xy px (top-left origin), z radius px, w strength
uniform vec3 uOrbCol[3];
uniform int uSteps;
uniform int uInner;
uniform float uEngine; // weight of the engine form, for the plume

const float IOR = 1.46;
const float DISP = 0.055;

float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdCyl(vec3 p, float r, float h, float rr){ vec2 d = vec2(length(p.xz) - r + rr, abs(p.y) - h + rr); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rr; }

float shDrop(vec3 p){
  // A pebble: two nearly flat faces and a fully rounded rim, so the middle shows what is behind it
  // almost unbent and the rim does the bending. Slow surface waves keep it liquid.
  vec2 d2 = vec2(length(p.xy * vec2(1.0, 1.04)) - 0.7, abs(p.z) - 0.03);
  float d = min(max(d2.x, d2.y), 0.0) + length(max(d2, 0.0)) - 0.2;
  return d + 0.035 * sin(p.x * 3.1 + uTime * 0.9) * sin(p.y * 2.7 - uTime * 0.7) + 0.02 * sin(p.x * 5.3 - uTime * 0.5 + p.y * 4.1);
}
// Infiniview: a lens in a housing ring, with three probes that keep hitting it.
float shLens(vec3 p){
  float a = length(p - vec3(0.0, 0.0, -0.78)) - 1.2;
  float b = length(p - vec3(0.0, 0.0, 0.78)) - 1.2;
  float d = smax(a, b, 0.08);
  float ring = length(vec2(length(p.xy) - 0.99, p.z)) - 0.075;
  d = smin(d, ring, 0.07);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float an = fi * 2.094 + uTime * 0.23;
    vec3 dir = normalize(vec3(cos(an) * 0.62, sin(an) * 0.62, 0.78));
    float r = 0.5 + 0.62 * (0.5 + 0.5 * sin(uTime * 1.5 + fi * 2.3));
    d = smin(d, length(p - dir * r) - 0.105, 0.2);
  }
  return d;
}
// Open source: a branch that merges back into the trunk.
float shMerge(vec3 p){
  float d = sdCapsule(p, vec3(0.32, -0.9, 0.0), vec3(0.32, 0.9, 0.0), 0.085);
  d = smin(d, sdCapsule(p, vec3(-0.46, -0.9, 0.12), vec3(-0.46, -0.3, 0.12), 0.085), 0.08);
  d = smin(d, sdCapsule(p, vec3(-0.46, -0.3, 0.12), vec3(0.32, 0.32, 0.0), 0.085), 0.12);
  d = smin(d, length(p - vec3(0.32, 0.9, 0.0)) - 0.25, 0.1);
  d = smin(d, length(p - vec3(0.32, -0.9, 0.0)) - 0.21, 0.1);
  d = smin(d, length(p - vec3(-0.46, -0.9, 0.12)) - 0.21, 0.1);
  d = smin(d, length(p - vec3(0.32, 0.32, 0.0)) - 0.17, 0.1);
  float tr = fract(uTime * 0.22);
  vec3 pk = mix(vec3(-0.46, -0.3, 0.12), vec3(0.32, 0.32, 0.0), tr);
  return smin(d, length(p - pk) - 0.12, 0.12);
}
// Kilo Bench: four bars on a plate, the third one wins.
float shBars(vec3 p){
  float d = sdRoundBox(p - vec3(0.0, -0.9, 0.0), vec3(0.98, 0.07, 0.34), 0.07);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float h = (i == 0 ? 0.42 : i == 1 ? 0.62 : i == 2 ? 0.92 : 0.52);
    h *= 0.12 + 0.88 * uP.y + 0.03 * sin(uTime * 1.2 + fi * 1.7);
    d = smin(d, sdRoundBox(p - vec3(-0.69 + 0.46 * fi, -0.83 + h, 0.0), vec3(0.165, h, 0.165), 0.06), 0.05);
  }
  return d;
}
// Agent Bridge: a Dot, a Bot, a bridge, and a packet in transit.
float shBridge(vec3 p){
  float d = length(p - vec3(-0.74, 0.0, 0.0)) - 0.43;
  vec3 q = p - vec3(0.74, 0.0, 0.0);
  q.xz *= rot2(0.5);
  d = min(d, sdRoundBox(q, vec3(0.34), 0.1));
  d = smin(d, sdCapsule(p, vec3(-0.5, 0.0, 0.0), vec3(0.5, 0.0, 0.0), 0.06), 0.1);
  float x = 0.42 * sin(uTime * 1.25);
  return smin(d, length(p - vec3(x, 0.0, 0.0)) - 0.13, 0.14);
}
// Open models: four discs, radius proportional to the square root of real pulls.
float shStack(vec3 p){
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float r = (i == 0 ? 0.95 : i == 1 ? 0.84 : i == 2 ? 0.36 : 0.2);
    float g = clamp(uP.y * 4.0 - fi * 0.8, 0.0, 1.0);
    g = 1.0 - (1.0 - g) * (1.0 - g);
    float y = -0.58 + 0.36 * fi + (1.0 - g) * 1.4;
    d = smin(d, sdCyl(p - vec3(0.0, y, 0.0), r, 0.125, 0.1), 0.05);
  }
  return d;
}
// cc-switch: a toggle. Click the drop to flip it.
float shSwitch(vec3 p){
  vec3 q = p;
  q.z *= 1.5;
  float d = (sdCapsule(q, vec3(-0.44, 0.0, 0.0), vec3(0.44, 0.0, 0.0), 0.47)) / 1.5;
  float kx = mix(-0.44, 0.44, uP.x);
  return smin(d, length(p - vec3(kx, 0.0, 0.26)) - 0.4, 0.05);
}
// TensorPoW: a 3x3x3 lattice.
float shTensor(vec3 p){
  float s = 0.6 + 0.025 * sin(uTime * 0.8);
  vec3 q = p - s * clamp(round(p / s), -1.0, 1.0);
  return sdRoundBox(q, vec3(0.2), 0.055);
}
// Merlin: an engine bell with chamber, manifold and turbopump.
float shEngine(vec3 p){
  p.y -= 0.14;
  float r = length(p.xz);
  float t = clamp((0.15 - p.y) / 1.1, 0.0, 1.0);
  float R = 0.16 + 0.5 * pow(t, 0.62);
  float bell = max(abs(r - R) - 0.032, abs(p.y + 0.4) - 0.55) * 0.55;
  float d = bell;
  d = smin(d, sdCyl(p - vec3(0.0, 0.42, 0.0), 0.25, 0.27, 0.08), 0.05);
  d = smin(d, length(p - vec3(0.0, 0.7, 0.0)) - 0.2, 0.08);
  float Rm = 0.16 + 0.5 * pow(0.6, 0.62);
  d = smin(d, (length(vec2(r - Rm - 0.03, p.y + 0.51)) - 0.05) , 0.03);
  d = smin(d, (length(vec2(r - 0.675, p.y + 0.93)) - 0.04), 0.03);
  d = smin(d, length(p - vec3(0.46, 0.44, 0.0)) - 0.16, 0.04);
  d = smin(d, sdCapsule(p, vec3(0.46, 0.44, 0.0), vec3(0.2, 0.5, 0.0), 0.05), 0.04);
  d = smin(d, sdCapsule(p, vec3(0.5, 0.36, 0.0), vec3(0.58, -0.5, 0.0), 0.035), 0.04);
  return d;
}
// Work and blog: a thick pane.
float shSlab(vec3 p){
  p.z += 0.12 * p.x * p.x;
  return sdRoundBox(p, vec3(0.92, 0.6, 0.13), 0.13);
}
// More: seven bodies on one orbit.
float shOrbit(vec3 p){
  float d = length(vec2(length(p.xz) - 0.86, p.y)) - 0.028;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float an = fi * 0.8976 + uTime * 0.25;
    float rr = 0.12 + 0.07 * fract(sin(fi * 12.9898) * 43758.5453);
    d = smin(d, length(p - vec3(cos(an) * 0.86, 0.0, sin(an) * 0.86)) - rr, 0.08);
  }
  return smin(d, length(p) - 0.3, 0.1);
}
// 404: the drop, cracked in two.
float shSplit(vec3 p){
  float crack = 0.07 * sin(p.y * 7.0) + 0.04 * sin(p.y * 15.0 + 1.0);
  float px = abs(p.x + crack) - 0.2;
  vec3 q = vec3(px, p.y + sign(p.x + crack) * 0.08, p.z);
  return smax(length(q) - 0.84, -px - 0.0, 0.03);
}

float shape(int id, vec3 p){
  if (id == 0) return shDrop(p);
  if (id == 1) return shLens(p);
  if (id == 2) return shMerge(p);
  if (id == 3) return shBars(p);
  if (id == 4) return shBridge(p);
  if (id == 5) return shStack(p);
  if (id == 6) return shSwitch(p);
  if (id == 7) return shTensor(p);
  if (id == 8) return shEngine(p);
  if (id == 9) return shSlab(p);
  if (id == 10) return shOrbit(p);
  return shSplit(p);
}

float map(vec3 p){
  float st = abs(uVel) * 0.22;
  p.y /= (1.0 + st);
  p.xz *= (1.0 + st * 0.5);
  float gs = mix(0.16, 1.0, uGather);
  vec3 q = p / gs;
  float d = 0.0;
  // One call site for all three slots keeps the compiled program small.
  for (int k = 0; k < 3; k++) {
    float wk = k == 0 ? uW.x : k == 1 ? uW.y : uW.z;
    if (wk > 0.002) d += wk * shape(k == 0 ? uShape.x : k == 1 ? uShape.y : uShape.z, q);
  }
  d += uP.w * 0.05 * sin(q.x * 4.0 + uTime * 1.3) * sin(q.y * 4.2 + uTime * 1.1) * sin(q.z * 3.7 - uTime * 0.9);
  d -= uP.z * 0.05 * sin(length(q) * 9.0 - uTime * 9.0) * exp(-length(q));
  d *= gs;
  // Satellite droplets. They stream in and merge while the page loads.
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float an = fi * 1.2566 + uTime * (0.16 + 0.03 * fi);
    vec3 dir = normalize(vec3(cos(an), sin(an * 1.3 + fi), sin(an) * 0.55));
    float far = mix(5.2 + fi * 0.5, 0.0, uGather * uGather * (3.0 - 2.0 * uGather));
    float orbit = (1.22 + 0.1 * sin(uTime * 0.6 + fi * 2.0)) * uGather;
    float rr = (0.055 + 0.03 * fract(fi * 0.618)) * (i < 3 ? 1.0 : 1.0 - uGather * 0.999);
    rr = mix(0.16, rr, uGather);
    d = smin(d, length(p - dir * (orbit + far)) - rr, 0.26);
  }
  return d * 0.86;
}

vec3 calcNormal(vec3 p){
  const float h = 0.0018;
  vec3 n = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
    n += e * map(p + e * h);
  }
  return normalize(n);
}

vec3 backdrop(vec2 px, float lod){
  vec3 c = uGround;
  vec2 tl = vec2(px.x, uRes.y - px.y);
  for (int i = 0; i < 3; i++) {
    float f = 1.0 - smoothstep(0.0, uOrb[i].z, length(tl - uOrb[i].xy));
    c = mix(c, uOrbCol[i], f * f * uOrb[i].w);
  }
  float m = textureLod(uMask, vec2(px.x, uRes.y - px.y) / uRes, lod).r;
  return mix(c, uInk, m * uMaskAmt);
}

vec3 envLight(vec3 r, float rough){
  float up = smoothstep(-0.4, 0.9, r.y);
  vec3 e = mix(uGround * 0.55, mix(uGround, vec3(1.0), 0.7), up) + vec3(0.1, 0.12, 0.16) * up;
  // A dark card on the horizon, the way glass is lit in a studio: on light grounds it draws the edges.
  float lum = dot(uGround, vec3(0.3, 0.6, 0.1));
  e *= 1.0 - 0.62 * lum * (1.0 - smoothstep(0.0, 0.3, abs(r.y + 0.18)));
  float k = max(dot(r, uLight), 0.0);
  e += vec3(1.0) * (pow(k, 110.0) * 5.0 + pow(k, 14.0) * 0.4);
  float box = smoothstep(0.5, 0.62, r.y) * (1.0 - smoothstep(0.18, 0.5, abs(r.x + 0.25)));
  e += vec3(1.0) * box * 0.9;
  vec3 l2 = normalize(vec3(0.75, -0.35, 0.55));
  e += vec3(0.72, 0.84, 1.0) * pow(max(dot(r, l2), 0.0), 28.0) * 0.7;
  return e;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 sp = (frag - uCenter) / uRadius;
  float sl = length(sp);

  // Contact shadow and a little coloured light spilled under the body.
  vec2 sq = (sp - vec2(0.16, -1.12)) / vec2(0.95, 0.19);
  float sh = exp(-dot(sq, sq) * 1.6) * uShadow * uGather;
  vec4 under = vec4(0.0, 0.0, 0.0, sh);
  vec2 cq = (sp - vec2(0.3, -1.1)) / vec2(0.5, 0.1);
  under.rgb += mix(uTintA, uTintB, 0.5 + 0.5 * sin(sp.x * 4.0 + uTime * 0.4)) * exp(-dot(cq, cq) * 2.2) * 0.2 * uShadow * 4.0 * uGather;

  // Engine plume: shock diamonds, throttle follows scroll velocity.
  if (uEngine > 0.01) {
    float yy = -0.8 - sp.y;
    if (yy > 0.0) {
      float len = 0.55 + abs(uVel) * 0.5;
      float w = 0.2 + yy * 0.12;
      float core = exp(-sp.x * sp.x / (w * w)) * exp(-yy / len) * smoothstep(0.0, 0.06, yy);
      float dia = 0.55 + 0.45 * pow(abs(cos(yy * 13.0 - uTime * 5.0)), 3.0);
      vec3 pc = mix(vec3(1.0, 0.42, 0.08), vec3(0.75, 0.88, 1.0), exp(-sp.x * sp.x / (w * w * 0.2)));
      under.rgb += pc * core * dia * uEngine * 0.9;
    }
  }

  if (sl > uBound) { outColor = under; return; }

  mat3 R = uRot;
  mat3 Rt = transpose(R);
  vec3 roW = vec3(0.0, 0.0, 6.0);
  vec3 rdW = normalize(vec3(sp, -6.0));
  vec3 ro = Rt * roW;
  vec3 rd = Rt * rdW;

  float b = dot(roW, rdW);
  float c = dot(roW, roW) - (uBound + 0.4) * (uBound + 0.4);
  float h = b * b - c;
  if (h < 0.0) { outColor = under; return; }
  h = sqrt(h);
  float t = max(-b - h, 0.0);
  float tf = -b + h;

  float px = 1.4 / uRadius;
  float minD = 1e5;
  float tMin = t;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    if (i >= uSteps) break;
    float d = map(ro + rd * t);
    if (d < minD) { minD = d; tMin = t; }
    if (d < 0.0012) { hit = true; break; }
    t += d;
    if (t > tf) break;
  }
  float cov = 1.0;
  if (!hit) {
    if (minD > px) { outColor = under; return; }
    cov = 1.0 - minD / px;
    t = tMin;
  }

  vec3 pos = ro + rd * t;
  vec3 n = calcNormal(pos);
  float ndv = max(dot(n, -rd), 0.0);
  float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);

  // Inside the body.
  vec3 ri = refract(rd, n, 1.0 / IOR);
  float ti = 0.03;
  for (int j = 0; j < 40; j++) {
    if (j >= uInner) break;
    float di = -map(pos + ri * ti);
    if (di < 0.003) break;
    ti += max(di, 0.012);
    if (ti > 3.2) break;
  }
  vec3 pe = pos + ri * ti;
  vec3 ne = -calcNormal(pe);
  vec3 peW = R * pe;
  float persp = 6.0 / (6.0 - peW.z);
  vec2 exitPx = uCenter + peW.xy * persp * uRadius;
  float disp = DISP * (1.0 + abs(uVel) * 1.6);
  float lod = 0.4 + ti * 0.55;

  vec3 refr;
  for (int ch = 0; ch < 3; ch++) {
    float ior = IOR * (1.0 + disp * (float(ch) - 1.0));
    vec3 ro2 = refract(ri, ne, ior);
    if (dot(ro2, ro2) < 0.001) ro2 = reflect(ri, ne);
    vec3 oW = R * ro2;
    vec2 off = oW.xy / max(-oW.z, 0.35) * 0.42 * uRadius;
    vec3 s = backdrop(exitPx + off, lod);
    if (ch == 0) refr.r = s.r; else if (ch == 1) refr.g = s.g; else refr.b = s.b;
  }

  vec3 tint = mix(uTintA, uTintB, 0.5 + 0.5 * dot(n, normalize(vec3(0.6, 0.7, 0.2))));
  refr *= exp(-ti * 0.42 * (1.0 - tint));
  float film = 0.5 + 0.5 * cos(6.2831 * (ti * 0.55 + ndv * 0.6));
  refr += tint * (uGlow * (0.35 + 0.65 * film) * (0.25 + 0.75 * (1.0 - ndv)));

  vec3 rl = R * reflect(rd, n);
  vec3 refl = envLight(rl, 0.0);
  vec3 col = mix(refr, refl, F);
  float spec = pow(max(dot(rl, uLight), 0.0), 220.0);
  col += vec3(1.0) * spec * 1.4;
  // On dark grounds the body is read by its rim: a cool edge light scaled by the glow amount.
  col += vec3(0.72, 0.86, 1.0) * pow(1.0 - ndv, 3.0) * uGlow * 1.6;
  // Thickness: darken slightly where the body is deep, the way a real pane does at its edge.
  col *= 1.0 - 0.1 * smoothstep(0.6, 0.0, ndv);

  outColor = vec4(col * cov, cov) + under * (1.0 - cov);
}`;
