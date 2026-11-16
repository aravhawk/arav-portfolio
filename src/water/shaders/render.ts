/**
 * The shading pass. One full-resolution fragment shader draws the whole
 * world: dry land (a machined mineral slab), channel walls, the terraced bed
 * under refracting water, caustics, surface light, foam, and the ice name.
 *
 * Coordinates: x right, y down the page, z up toward the camera. All lengths
 * are CSS px. The land plane z = 0 maps 1:1 to the document, which is what
 * lets the DOM sit exactly on dry land.
 */

export const RENDER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;

uniform vec2 uView;        // canvas size in CSS px
uniform float uTop;        // world y of the canvas top edge
uniform vec4 uSim;         // x: world y of sim row 0, y: texel px, z: w, w: h
uniform vec2 uBedSize;
uniform float uBedDiv;
uniform vec3 uCam;         // xy: optical centre in world px, z: eye height
uniform float uTime;
uniform float uFlowSpeed;  // px/s where flow = 1
uniform float uQuality;    // 0 low, 1 mid, 2 high
uniform int uMode;         // 0 colour, 1 effect mask (for the overlap test)

uniform sampler2D uBedA;
uniform sampler2D uBedB;
uniform sampler2D uWave;   // h, v, gx, gy
uniform sampler2D uVel;
uniform sampler2D uDye;
uniform sampler2D uDetail;
uniform sampler2D uGrain;
uniform sampler2D uIceSdf; // sd px (texture space), _, gx, gy
uniform sampler2D uHeat;

uniform vec4 uIce;         // world rect of the ice texture: x, y, w, h (w = 0: no ice)
uniform vec4 uIceState;    // x: erosion px, y: thickness 0..1, z: stroke half-width left px, w: frost 0..1

// Palette, already mixed for the current theme, linear light.
uniform vec3 uLand;
uniform vec3 uBed;
uniform vec3 uAbsorb;      // per channel absorption per px of path
uniform vec3 uScatter;     // colour water takes on with depth
uniform vec3 uSky;         // what the surface reflects
uniform vec3 uFoam;
uniform vec3 uIceCol;
uniform vec4 uLight;       // x: ambient, y: key, z: caustic gain, w: glint gain
uniform vec3 uGrainAmt;    // x: speckle, y: mottling, z: vignette

const vec3 L = vec3(-0.5145, -0.6174, 0.5952);     // to the key light: upper left, raised
uniform vec3 uPanel;        // unit vector to the soft overhead light panel
#define LS uPanel
const float FREEBOARD = 5.0;
const float DEEP = 70.0;
const float CHAMFER = 5.0;

vec2 bedUv(vec2 w) { return w / (uBedSize * uBedDiv); }
vec2 simUv(vec2 w) { return vec2(w.x / (uSim.z * uSim.y), (w.y - uSim.x) / (uSim.w * uSim.y)); }

float terrace(float sd, out float riser) {
  // Treads widen and drop further toward the middle, like a real basin.
  float d = max(-sd, 0.0);
  float k; float e0; float e1; float h0; float h1;
  if (d < 9.0) { e0 = 0.0; e1 = 9.0; h0 = 0.0; h1 = 10.0; }
  else if (d < 22.0) { e0 = 9.0; e1 = 22.0; h0 = 10.0; h1 = 22.0; }
  else if (d < 40.0) { e0 = 22.0; e1 = 40.0; h0 = 22.0; h1 = 36.0; }
  else if (d < 64.0) { e0 = 40.0; e1 = 64.0; h0 = 36.0; h1 = 52.0; }
  else { e0 = 64.0; e1 = 92.0; h0 = 52.0; h1 = 70.0; }
  float f = clamp((d - e0) / (e1 - e0), 0.0, 1.0);
  float rw = 3.6 / (e1 - e0);
  riser = 1.0 - smoothstep(rw * 0.5, rw, f);
  return mix(h0, h1, smoothstep(0.0, rw, f));
}

vec3 landColor(vec2 p, float sd, vec2 grad, vec2 scr) {
  vec4 gr = texture(uGrain, p / 256.0);
  float mott = texture(uGrain, p / 1900.0).g;
  vec3 col = uLand * (1.0 + (gr.r - 0.5) * uGrainAmt.x + (mott - 0.5) * uGrainAmt.y);
  // The machined chamfer where land meets a channel catches or loses the key.
  float ch = 1.0 - smoothstep(0.0, CHAMFER, sd);
  vec3 n = normalize(vec3(-grad * ch * 1.25, 1.0));
  float lit = (uLight.x + uLight.y * max(dot(n, L), 0.0)) / (uLight.x + uLight.y * L.z);
  col *= lit;
  // A studio light above the upper left of the frame: the slab is lit, not flat.
  float fall = length((scr - vec2(0.22, 0.12)) * vec2(1.0, 0.8));
  col *= 1.0 + uGrainAmt.z * (0.5 - smoothstep(0.0, 1.15, fall));
  return col;
}

void main() {
  vec2 scr = vec2(vUv.x, 1.0 - vUv.y);
  vec2 p = vec2(scr.x * uView.x, uTop + scr.y * uView.y);
  vec2 tilt = (p - uCam.xy) / uCam.z;
  vec3 dir = normalize(vec3(tilt, -1.0));

  // ---- ice: decide first, because ice bends what is seen beneath it
  float iceIn = 0.0;        // 0 outside, >0 distance inside in px
  vec3 iceN = vec3(0.0, 0.0, 1.0);
  float iceX = 0.0;
  float iceShadow = 0.0;
  vec2 q = p;               // where the scene under this pixel is sampled
  if (uIce.z > 0.0) {
    vec2 iuv = (p - uIce.xy) / uIce.zw;
    if (iuv.x > 0.0 && iuv.x < 1.0 && iuv.y > 0.0 && iuv.y < 1.0) {
      vec4 it = texture(uIceSdf, iuv);
      float heat = texture(uHeat, iuv).r;
      float rough = texture(uGrain, p / 300.0).g;
      float erode = uIceState.x * (0.8 + 0.4 * rough) + heat * 26.0;
      float isd = it.r + erode;
      if (isd < 0.0) {
        iceIn = -isd;
        float bev = clamp(uIceState.z * 0.9, 3.0, 22.0);
        float x = clamp(iceIn / bev, 0.0, 1.0);
        iceX = x;
        float inv = 1.0 - x;
        float slope = inv / sqrt(max(1.0 - inv * inv, 0.02)) * 0.9 * uIceState.y;
        // Fine pitting on the top face keeps the big flat counters alive.
        vec4 pit = texture(uDetail, p / 190.0);
        vec2 pg = (pit.gb - 0.5) * 0.5 * smoothstep(0.3, 1.0, x);
        iceN = normalize(vec3(it.ba * slope + pg, 1.0));
        q = p - iceN.xy * (26.0 * uIceState.y + 6.0);
      }
      // Contact shadow the ice throws on the water, toward the lower right.
      vec2 suv = (p + L.xy * 16.0 - uIce.xy) / uIce.zw;
      float ssd = texture(uIceSdf, suv).r + uIceState.x;
      iceShadow = (1.0 - smoothstep(-6.0, 9.0, ssd)) * uIceState.y;
    }
  }

  vec4 b0 = texture(uBedA, bedUv(q));
  float sd0 = b0.r;

  if (uMode == 1) {
    float m = max(step(sd0, 0.75), step(0.001, iceIn));
    o = vec4(m, m, m, 1.0);
    return;
  }

  vec3 col;
  if (sd0 > 0.0) {
    col = landColor(q, sd0, b0.ba, scr);
  } else {
    // ---- into the channel
    vec2 pw = q + tilt * FREEBOARD;
    vec4 bw = texture(uBedA, bedUv(pw));
    if (bw.r > 0.0) {
      // The wall above the waterline.
      vec3 n = normalize(vec3(-bw.ba, 0.35));
      float lit = uLight.x + uLight.y * max(dot(n, L), 0.0);
      col = uLand * lit / (uLight.x + uLight.y * L.z) * 0.82;
    } else {
      vec2 suv = simUv(pw);
      vec4 wv = texture(uWave, suv);
      vec3 fl = texture(uBedB, bedUv(pw)).rgb;
      vec2 flow = (fl.rg - 0.5019608) * 2.0;
      vec2 vel = flow * uFlowSpeed + texture(uVel, suv).rg * 0.7;

      // Detail: one layer carried by the current (two phases, cross-faded so
      // it never stretches), one pair of slow wind layers so still pools live.
      float ph0 = fract(uTime * 0.19);
      float ph1 = fract(uTime * 0.19 + 0.5);
      float wphase = abs(ph0 * 2.0 - 1.0);
      const float DS = 430.0;
      vec2 duv = pw / DS;
      vec4 d0 = texture(uDetail, duv - vel * (ph0 * 2.6) / DS);
      vec4 d1 = texture(uDetail, duv - vel * (ph1 * 2.6) / DS + vec2(0.37, 0.61));
      vec4 df = mix(d0, d1, wphase);
      // The wind layers are rotated off the lattice so nothing lines up
      // with the screen axes.
      const mat2 R1 = mat2(0.7986, -0.6018, 0.6018, 0.7986);
      const mat2 R2 = mat2(0.5299, 0.8480, -0.8480, 0.5299);
      vec2 wuv1 = R1 * pw / 610.0 + vec2(0.011, 0.017) * uTime;
      vec4 dw = texture(uDetail, wuv1);
      vec4 dw2 = texture(uDetail, R2 * pw / 340.0 - vec2(0.019, 0.009) * uTime + vec2(0.5, 0.2));
      dw.gb = (dw.gb - 0.5) * R1 + 0.5;
      dw2.gb = (dw2.gb - 0.5) * R2 + 0.5;
      float speed = clamp(length(vel) / max(uFlowSpeed, 1.0), 0.0, 1.5);
      float fa = 0.35 + 0.65 * speed;
      vec2 dgrad = ((df.gb - 0.5) * fa * 1.15 + (dw.gb - 0.5) * 0.55 + (dw2.gb - 0.5) * 0.4) * 0.05;
      // Two drifting caustic sheets; where both are bright, the filaments.
      float ctex = sqrt(df.a * dw.a) * 6.0 * 0.62 + sqrt(df.a * dw2.a) * 6.0 * 0.38;

      vec2 slope = wv.ba * 3.4 + dgrad;
      // Meniscus: the surface climbs the bank.
      float men = smoothstep(-5.0, -0.5, bw.r);
      slope += bw.ba * men * 0.42;
      vec3 n = normalize(vec3(-slope, 1.0));

      vec3 r = refract(dir, n, 0.75);
      float riser0;
      float d0p = terrace(bw.r, riser0);
      vec2 pb = pw + r.xy / max(-r.z, 0.2) * d0p;
      vec4 bb = texture(uBedA, bedUv(pb));
      float riser;
      float depth = terrace(min(bb.r, -0.01), riser);

      // ---- the bed
      vec4 gb = texture(uGrain, pb / 256.0);
      vec3 bed = uBed * (1.0 + (gb.r - 0.5) * uGrainAmt.x * 1.6);
      vec3 nb = normalize(vec3(-bb.ba * riser * 1.6, 1.0));
      vec3 lr = normalize(vec3(L.xy * 0.72, L.z));
      float direct = max(dot(nb, lr), 0.0) / lr.z;
      // The bank on the light's side shades the bed below it.
      float shadow = 1.0;
      if (uQuality > 0.5) {
        float reach = (depth + FREEBOARD) * 0.62;
        float ssd = texture(uBedA, bedUv(pb + normalize(L.xy) * reach)).r;
        shadow = 1.0 - 0.62 * smoothstep(-2.0, 5.0, ssd);
      } else {
        float near = 1.0 - smoothstep(0.0, depth * 0.8 + 4.0, -bb.r);
        shadow = 1.0 - 0.6 * near * max(dot(bb.ba, normalize(L.xy)), 0.0);
      }
      // Caustics: light focused by the curvature of the surface above.
      float wlap = 0.0;
      if (uQuality > 0.5) {
        vec2 e = 1.0 / uSim.zw;
        float gx1 = texture(uWave, suv + vec2(e.x, 0.0)).b;
        float gx0 = texture(uWave, suv - vec2(e.x, 0.0)).b;
        float gy1 = texture(uWave, suv + vec2(0.0, e.y)).a;
        float gy0 = texture(uWave, suv - vec2(0.0, e.y)).a;
        wlap = (gx1 - gx0 + gy1 - gy0) * 0.5;
      }
      float dn = clamp(depth / DEEP, 0.0, 1.0);
      float fbase = (0.3 + 0.7 * dn) * wlap * 16.0;
      float ripple = min(1.0 / max(abs(1.0 - fbase), 0.24), 3.4);
      // Shallow water has no room to focus: the pattern sharpens with depth.
      float cdepth = smoothstep(0.0, 0.5, dn);
      float caust = mix(1.0, mix(1.0, min(ctex * ctex * 0.72, 3.6), cdepth) * ripple, uLight.z);
      vec3 lightOnBed = vec3(uLight.x * 0.9 + uLight.y * direct * shadow * caust);
      if (uQuality > 1.5) {
        // A touch of dispersion: caustic edges split into colour.
        vec2 cs = normalize(vel + vec2(0.7, 0.4)) * 0.0022;
        float wr = texture(uDetail, wuv1 + cs).a;
        float wb = texture(uDetail, wuv1 - cs).a;
        float tr = sqrt(df.a * wr) * 6.0 * 0.62 + sqrt(df.a * dw2.a) * 6.0 * 0.38;
        float tb = sqrt(df.a * wb) * 6.0 * 0.62 + sqrt(df.a * dw2.a) * 6.0 * 0.38;
        float cr = mix(1.0, mix(1.0, min(tr * tr * 0.72, 3.6), cdepth) * ripple, uLight.z);
        float cb = mix(1.0, mix(1.0, min(tb * tb * 0.72, 3.6), cdepth) * ripple, uLight.z);
        lightOnBed = uLight.x * 0.9 + uLight.y * direct * shadow * vec3(cr, caust, cb);
      }
      bed *= lightOnBed / (uLight.x + uLight.y);

      // ---- the water column
      float path = depth * (1.0 + 1.0 / max(-r.z, 0.3));
      vec4 dye = texture(uDye, suv);
      vec3 trans = exp(-uAbsorb * path);
      float turbid = 1.0 - exp(-path * 0.011);
      // Deep water still carries soft shafts of the light above it.
      vec3 body = uScatter * (0.55 + 0.45 * shadow) * (0.82 + 0.3 * caust);
      col = bed * trans + body * turbid * (1.0 - trans * 0.35);
      // Meltwater silt clouds the column.
      col = mix(col, uIceCol * 0.82, clamp(dye.g * 0.42, 0.0, 0.55));

      // ---- the surface
      float cosi = clamp(dot(-dir, n), 0.0, 1.0);
      float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
      vec3 rf = reflect(dir, n);
      float panel = smoothstep(0.9905, 0.9992, dot(rf, LS));
      // Ripple faces turned toward the key light flash; calm water does not.
      float crest = smoothstep(0.035, 0.2, dot(slope, -normalize(L.xy)));
      col += uSky * (fres * 0.6 + panel * 0.05 + crest * crest * 0.5 * uLight.w);
      // Foam rides the current as broken cells, not a white wash.
      float cells = texture(uGrain, (pw - vel * 0.35) / 150.0).a;
      float foam = clamp(dye.r, 0.0, 1.0);
      col += uFoam * foam * (0.1 + 0.9 * smoothstep(0.42, 0.1, cells)) * 0.42;
      // Waterline: a dark wet seam with a bright lip.
      col *= 1.0 - 0.18 * smoothstep(-2.2, 0.0, bw.r);
    }
    col *= 1.0 - iceShadow * 0.5 * step(iceIn, 0.0);
  }

  // ---- ice on top
  if (iceIn > 0.0) {
    float x = iceX;
    vec4 gi = texture(uGrain, p / 420.0);
    vec4 gf = texture(uGrain, p / 96.0);
    // Cloudy core, clear bevel: how real ice freezes, and what keeps the
    // letterforms solid and readable. Refraction is strong only in the
    // bevel band; the interior stays calm.
    float core = smoothstep(0.12, 0.92, x);
    float frost = core * (0.8 + 0.14 * gi.g + 0.06 * gf.b) * uIceState.w;
    vec2 nxy = normalize(iceN.xy + 1e-4);
    float toLight = dot(nxy, normalize(L.xy));
    float lit = 0.86 + 0.16 * max(dot(iceN, L), 0.0) / L.z;
    vec3 body = uIceCol * lit;
    // The clear band at the edge shows the deep water, darker and bent.
    col = mix(col * mix(0.62, 1.0, core), body, clamp(frost, 0.0, 0.97));
    // Fracture planes and trapped air through the core.
    float crack = (1.0 - smoothstep(0.0, 0.035, abs(gi.b - 0.42))) * core;
    float vein = smoothstep(0.1, 0.0, abs(gf.a - 0.34)) * core;
    col += uIceCol * (vein * 0.05 + crack * 0.09) * uIceState.w;
    col *= 1.0 - 0.07 * core * smoothstep(0.35, 0.75, gi.g);
    // The bevel that faces the light flashes; the far one falls into shade.
    float rim = (1.0 - core) * smoothstep(0.02, 0.2, x);
    col += uSky * rim * pow(max(toLight, 0.0), 1.6) * 0.62 * uIceState.y;
    col *= 1.0 - 0.42 * rim * max(-toLight, 0.0);
    // A hairline of light right on the edge keeps every letter crisp.
    float lip = smoothstep(0.0, 0.06, x) * (1.0 - smoothstep(0.06, 0.22, x));
    col += uSky * lip * 0.22 * uIceState.y;
  }

  // Display transform and a blue-noise-ish dither against banding.
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  float dn2 = texture(uGrain, gl_FragCoord.xy / 256.0).r;
  col += (dn2 - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;
