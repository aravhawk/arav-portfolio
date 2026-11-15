const NOISE = /* glsl */ `
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), u.x), mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
`;

/* The sky as a function of direction. Shared by the dome and (through the mirror) the water. */
const SKY_FN = /* glsl */ `
uniform vec3 uZen; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uBand; uniform vec3 uSun; uniform float uStars; uniform float uTod; uniform float uTime;
${NOISE}
vec3 skyColor(vec3 d){
  float h = max(d.y, 0.0);
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.15, h)); col = mix(col, uZen, smoothstep(0.06, 0.62, h));
  // the warm band hugs the horizon on the sun's side
  vec2 a = normalize(d.xz + 1e-5); vec2 s = normalize(uSun.xz);
  float az = max(dot(a, s), 0.0);
  float band = exp(-h * 9.0) * pow(az, 5.0);
  col += uBand * band * 0.55;
  col += uBand * exp(-h * 30.0) * pow(az, 2.0) * 0.16;
  // sun glow and disc
  float sd = max(dot(normalize(d), uSun), 0.0);
  col += uBand * pow(sd, 90.0) * 0.9 * smoothstep(0.6, 1.0, uTod);
  col += vec3(1.0, 0.86, 0.62) * smoothstep(0.99985, 0.99994, sd) * 26.0 * smoothstep(0.86, 1.0, uTod);
  // high cloud, lit from below as the sun nears
  if (d.y > 0.012) {
    vec2 p = d.xz / (d.y + 0.14);
    float c = fbm(p * vec2(0.55, 1.5) + vec2(uTime * 0.004, 0.0));
    c = smoothstep(0.5, 0.86, c) * smoothstep(0.012, 0.12, d.y) * (1.0 - smoothstep(0.45, 0.9, d.y));
    vec3 lit = uHor * 0.4 + uBand * (0.12 + 0.5 * pow(az, 3.0)) * exp(-h * 4.5);
    col = mix(col, lit, c * 0.5 * (0.35 + 0.65 * pow(az, 2.0)));
  }
  // stars
  vec3 n = normalize(d); vec3 g = n * 190.0; vec3 id = floor(g); vec3 f = fract(g) - 0.5;
  float rnd = hash21(id.xy + id.z * 37.0);
  float star = smoothstep(0.09, 0.0, length(f)) * step(0.972, rnd);
  float tw = 0.65 + 0.35 * sin(uTime * (1.0 + rnd * 3.0) + rnd * 90.0);
  col += vec3(0.8, 0.9, 1.0) * star * tw * uStars * smoothstep(0.02, 0.22, d.y) * (0.5 + rnd) * 1.6;
  return col;
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }
`;
export const SKY_FRAG = /* glsl */ `
precision highp float; varying vec3 vDir;
${SKY_FN}
void main(){ vec3 d = normalize(vDir); gl_FragColor = vec4(skyColor(vec3(d.x, abs(d.y), d.z)), 1.0); }
`;

export const RIDGE_VERT = /* glsl */ `
varying float vY;
void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const RIDGE_FRAG = /* glsl */ `
precision highp float; varying float vY;
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uBand; uniform float uDark; uniform float uTop;
void main(){
  vec3 ink = uZen * 0.5;
  vec3 c = mix(uHor, ink, uDark);
  c = mix(c, uHor + uBand * 0.05, exp(-max(vY, 0.0) / (uTop * 0.2)) * 0.6);
  gl_FragColor = vec4(c, 1.0);
}
`;

export const WATER_VERT = /* glsl */ `
uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
export const WATER_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse; uniform vec3 uCam; uniform vec3 color;
varying vec4 vUv; varying vec3 vWorld;
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uBand; uniform vec3 uSun; uniform float uTod; uniform float uTime;
${NOISE}
float cell(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g = vec2(float(x), float(y)); vec2 o = vec2(hash21(i+g), hash21(i+g+7.7)); float d = length(g + o - f); if(d < d1){ d2 = d1; d1 = d; } else if(d < d2){ d2 = d; } }
  return d2 - d1; }
void main(){
  vec3 toCam = uCam - vWorld; float dist = length(toCam); vec3 V = toCam / dist;
  // ripples: two crossing wave fields, calmer with distance
  vec2 p = vWorld.xz; float t = uTime;
  vec2 n = vec2(vnoise(p * 0.11 + vec2(t * 0.22, t * 0.1)) - 0.5, vnoise(p * 0.09 + vec2(-t * 0.15, t * 0.2) + 31.0) - 0.5);
  n += 0.5 * vec2(vnoise(p * 0.5 + vec2(t * 0.5, 0.0)) - 0.5, vnoise(p * 0.44 + vec2(0.0, t * 0.45) + 9.0) - 0.5);
  float calm = 1.0 / (1.0 + dist * 0.008);
  vec4 uv = vUv; uv.xy += n * vec2(0.7, 2.2) * calm * uv.w * 0.011;
  vec3 refl = texture2DProj(tDiffuse, uv).rgb;
  float fres = 0.34 + 0.66 * pow(1.0 - max(V.y, 0.0), 3.0);
  // salt crust under a skin of water, only where you look down at it
  float crust = smoothstep(0.07, 0.0, cell(p * 0.16)) * (1.0 - fres) * exp(-dist * 0.012);
  vec3 bed = uHor * 0.05 + uZen * 0.5 + (uHor * 0.5 + 0.02) * crust * 0.5;
  vec3 col = mix(bed, refl, fres);
  // haze to the horizon
  col = mix(col, uHor + uBand * 0.02, 1.0 - exp(-dist * 0.00022));
  gl_FragColor = vec4(col, 1.0);
}
`;

export const SWARM_VERT = /* glsl */ `
precision highp float;
attribute vec2 ref;
uniform sampler2D tPosA; uniform sampler2D tPosB; uniform sampler2D tAuxA; uniform sampler2D tAuxB; uniform sampler2D tColA; uniform sampler2D tColB;
uniform float uMix; uniform float uTime; uniform float uPx; uniform float uFocus; uniform float uAperture; uniform float uSize; uniform float uGain; uniform float uFog;
uniform vec3 uRayO; uniform vec3 uRayD; uniform float uPush;
uniform float uSpinA; uniform float uSpinB; uniform vec3 uSpinPivot; uniform mat3 uSpinMat;
varying vec3 vCol; varying float vAlpha; varying float vBokeh;

vec3 flowAt(vec3 p, vec4 aux, float ph){ float on = step(1e-5, abs(aux.w)); return p + aux.xyz * (fract(uTime * aux.w + ph) - 0.5) * on; }
vec3 spin(vec3 p, float on){ vec3 r = p - uSpinPivot; float near = on * step(dot(r.xz, r.xz), 900.0) * step(abs(r.y), 28.0); return mix(p, uSpinPivot + uSpinMat * r, near); }
vec3 swirl(vec3 p){ return vec3(sin(p.y * 0.21 + p.z * 0.13), sin(p.z * 0.17 + p.x * 0.19), sin(p.x * 0.15 + p.y * 0.23)); }

void main(){
  vec4 pa = texture2D(tPosA, ref); vec4 pb = texture2D(tPosB, ref);
  vec4 xa = texture2D(tAuxA, ref); vec4 xb = texture2D(tAuxB, ref);
  vec4 ca = texture2D(tColA, ref); vec4 cb = texture2D(tColB, ref);
  float rnd = ca.a; float rnd2 = fract(rnd * 71.37 + ref.x * 13.1);
  vec3 A = spin(flowAt(pa.xyz, xa, rnd), uSpinA);
  vec3 B = spin(flowAt(pb.xyz, xb, cb.a), uSpinB);
  // staggered departure: each light leaves on its own cue and eases into its new place
  float S = 1.25; float loc = clamp(uMix * (1.0 + S) - rnd2 * S, 0.0, 1.0);
  float e = loc * loc * (3.0 - 2.0 * loc);
  vec3 p = mix(A, B, e);
  float arc = sin(3.14159 * e);
  float far = clamp(length(B - A) / 160.0, 0.0, 1.0);
  p += swirl(p * 0.6 + rnd * 20.0 + uTime * 0.2) * arc * (5.0 + 18.0 * far) * (0.4 + rnd);
  p.y += arc * far * (5.0 + 34.0 * rnd2 * rnd2);
  // breathing
  p += swirl(p * 2.3 + uTime * 0.6 + rnd * 50.0) * 0.05;
  // the pointer parts the swarm
  vec3 rel = p - uRayO; vec3 cl = uRayO + uRayD * dot(rel, uRayD); vec3 off = p - cl; float d2 = dot(off, off);
  p += normalize(off + 1e-4) * uPush * 3.2 * exp(-d2 / 30.0);
  p.y = max(p.y, 0.08);

  vec4 mv = viewMatrix * vec4(p, 1.0);
  float depth = max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;

  float size = mix(pa.w, pb.w, e) * uSize;
  float base = size * uPx * 0.0024 * 100.0 / depth;           // diameter in px of the light itself
  float coc = abs(depth - uFocus) / depth * uAperture * uPx * 0.026;  // blur added by the lens
  float d = base + coc;
  float clampD = min(d, uPx * 0.05);
  gl_PointSize = max(clampD, 1.0);
  float energy = (base * base) / (clampD * clampD + 1e-3);
  float a = pow(clamp(energy, 0.0, 1.0), 0.62) * min(1.0, base * base * 0.9 + 0.12);
  vBokeh = clamp(coc / (base + 1.0), 0.0, 1.0);
  float tw = 0.82 + 0.18 * sin(uTime * (1.2 + rnd * 3.0) + rnd * 60.0);
  vec3 c = mix(ca.rgb, cb.rgb, e) * (1.0 + arc * 0.5);
  vCol = c * tw * uGain * exp(-depth * uFog);
  vAlpha = a;
}
`;
export const SWARM_FRAG = /* glsl */ `
precision highp float;
varying vec3 vCol; varying float vAlpha; varying float vBokeh;
void main(){
  vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 3.2);
  float disc = smoothstep(1.0, 0.82, r) * (0.72 + 0.4 * smoothstep(0.55, 0.95, r));
  float s = mix(core, disc, vBokeh);
  gl_FragColor = vec4(vCol * s * vAlpha, 1.0);
}
`;

export const FINAL_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
export const FINAL_FRAG = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime; uniform float uMove; uniform float uExp; uniform float uFade;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 c = vUv - 0.5; float r2 = dot(c, c);
  // lens fringing grows with speed and toward the edges
  vec2 off = c * r2 * (0.012 + 0.07 * uMove);
  vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
  col *= uExp * 1.15;
  col *= 1.0 - r2 * 0.85;
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  col += (h(vUv * 900.0 + fract(uTime) * 61.0) - 0.5) * 0.022;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;
