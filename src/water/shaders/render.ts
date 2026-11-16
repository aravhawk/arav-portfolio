/**
 * The shading pass. One full-resolution fragment shader draws the whole
 * world: dry land (a honed mineral slab), the walls of the channels cut into
 * it, the terraced bed under refracting water, caustics, the light the
 * surface reflects, foam, and the ice name.
 *
 * Coordinates: x right, y down the page, z up toward the camera. All lengths
 * are CSS px. The land plane z = 0 maps 1:1 to the document, which is what
 * lets the DOM sit exactly on dry land.
 *
 * The camera stands a little south of what it looks at (down the page) and
 * looks north and down. So everything below the land plane is seen at a
 * slant: the north wall of every channel shows, the water sits visibly
 * below the slab, the bed sits visibly below the water, and all three slide
 * against each other as the page scrolls. The land plane itself does not
 * move, so text never does.
 */

export const FREEBOARD = 14;

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
uniform float uScale;      // how wide the bed's steps are: 1 on a desktop, tighter on a phone's narrow channels

uniform sampler2D uBedA;
uniform sampler2D uBedB;
uniform sampler2D uWave;   // h, v, gx, gy
uniform sampler2D uVel;
uniform sampler2D uDye;
uniform sampler2D uDetail;
uniform sampler2D uCurv;   // curvature of the detail field: xx, yy, xy
uniform sampler2D uGrain;
uniform sampler2D uIceSdf; // sd px, _, gx, gy
uniform sampler2D uIceLow; // the same field, heavily smoothed: what a melting edge rounds toward
uniform sampler2D uHeat;

uniform vec4 uIce;         // world rect of the ice texture: x, y, w, h (w = 0: no ice)
uniform vec4 uIceState;    // x: erosion px, y: height above the water 0..1, z: rounding 0..1, w: frost 0..1
uniform float uIceAlive;   // 1 until the last of it, then 0: clear ice going back to water

// Palette, already mixed for the current theme, linear light.
uniform vec3 uLand;
uniform vec3 uBed;
uniform vec3 uAbsorb;      // per channel absorption per px of path
uniform vec3 uScatter;     // colour water takes on with depth
uniform vec3 uSky;         // what the surface reflects
uniform vec3 uFoam;
uniform vec3 uIceCol;
uniform vec4 uLight;       // x: ambient, y: key, z: caustic gain, w: glint gain
uniform vec3 uGrainAmt;    // x: speckle, y: mottling, z: falloff

const vec3 L = vec3(-0.5145, -0.6174, 0.5952);     // to the key light: upper left, raised
const vec2 OBLIQUE = vec2(0.0, -0.36);             // the camera's slant
const float FREEBOARD = ${FREEBOARD}.0;            // the water sits this far below the slab
const float DEEP = 70.0;

vec2 bedUv(vec2 w) { return w / (uBedSize * uBedDiv); }
vec2 simUv(vec2 w) { return vec2(w.x / (uSim.z * uSim.y), (w.y - uSim.x) / (uSim.w * uSim.y)); }

float terrace(float sd, out float riser) {
  // Treads widen and drop further toward the middle, like a real basin, and
  // past the last step the floor keeps falling away.
  float d = max(-sd, 0.0) / uScale;
  if (d >= 92.0) { riser = 0.0; return 70.0 + (d - 92.0) * 0.2; }
  float e0; float e1; float h0; float h1;
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

/** What a reflecting surface sees above it: a soft sky and two long lights. */
vec3 env(vec3 rf, float lights) {
  vec2 a = rf.xy / max(rf.z, 0.25);
  float far = smoothstep(0.3, -1.3, a.y);
  vec2 c = a - vec2(-0.04, -0.4);
  float box = (1.0 - smoothstep(0.5, 1.15, abs(c.x))) * (1.0 - smoothstep(0.012, 0.05, abs(c.y)));
  vec2 c2 = a - vec2(0.1, -0.52);
  float bar = (1.0 - smoothstep(0.4, 0.9, abs(c2.x))) * (1.0 - smoothstep(0.005, 0.018, abs(c2.y)));
  return uSky * (0.012 + 0.03 * far + (box * 0.19 + bar * 0.13) * lights);
}

/** A symmetric 2x2 tensor (xx, yy, xy) seen through a rotated layer. */
vec3 turn(vec3 h, mat2 R) {
  mat2 M = transpose(R) * mat2(h.x, h.z, h.z, h.y) * R;
  return vec3(M[0][0], M[1][1], M[0][1]);
}

float focus(vec3 t, float f) {
  float det = (1.0 + f * t.x) * (1.0 + f * t.y) - f * f * t.z * t.z;
  return min(1.0 / max(abs(det), 0.13), 5.5);
}

float landLight(vec3 n) {
  return (uLight.x + uLight.y * max(dot(n, L), 0.0)) / (uLight.x + uLight.y * L.z);
}

vec3 stone(vec2 p) {
  vec4 gr = texture(uGrain, p / 256.0);
  float mott = texture(uGrain, p / 1900.0).g;
  float cloud = texture(uGrain, p / 5200.0).b;
  return uLand * (1.0 + (gr.r - 0.5) * uGrainAmt.x + (mott - 0.5) * uGrainAmt.y + (cloud - 0.5) * uGrainAmt.y * 1.5);
}

vec3 landColor(vec2 p, float sd, vec2 grad, vec2 scr) {
  vec3 col = stone(p);
  // The arris where the slab meets a channel is a crisp machined facet: it
  // catches the key on one side of a channel and loses it on the other.
  float ch = 1.0 - smoothstep(1.9, 2.7, sd);
  vec3 n = normalize(vec3(-grad * ch, 1.0));
  col *= mix(1.0, landLight(n), ch);
  // One hairline step milled parallel to every bank, inside the margin that
  // text keeps from water, so it never runs under a word.
  float u = sd - 7.5;
  float lit = dot(grad, normalize(L.xy));
  col *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.8, abs(u + 0.5))) * (0.6 + 0.4 * lit);
  col *= 1.0 + 0.07 * (1.0 - smoothstep(0.0, 0.8, abs(u - 0.6))) * (0.5 - 0.5 * lit);
  col += vec3(0.012, 0.014, 0.016) * (1.0 - smoothstep(0.0, 0.8, abs(u - 0.6))) * (1.0 - smoothstep(0.0, 0.25, uLand.g));
  // The room's light falls off across the slab, and stays with the viewer.
  float fall = length((scr - vec2(0.2, 0.08)) * vec2(1.0, 0.82));
  col *= 1.0 + uGrainAmt.z * (0.42 - smoothstep(0.0, 1.2, fall));
  // Honed stone is a little glossy: the long light overhead lies across it
  // as a soft band, and the page slides under that band as it scrolls.
  float band = 1.0 - smoothstep(0.02, 0.2, abs(scr.y - 0.36 - (scr.x - 0.5) * 0.05));
  col *= 1.0 + 0.045 * band;
  col += uSky * band * 0.0022 * (1.0 - smoothstep(0.0, 0.25, uLand.g));
  return col;
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

/** x: distance to the nearest cell wall, yz: a random pair for the cell. */
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
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + hash2(n + g) - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(dr)));
    }
  }
  return vec3(md, hash2(n + mg));
}

/** Signed distance to the melting name at a world point, px. Negative inside. */
float iceField(vec2 w, out vec4 it) {
  it = vec4(1e3, 0.0, 0.0, 0.0);
  vec2 iuv = (w - uIce.xy) / uIce.zw;
  if (iuv.x <= 0.0 || iuv.x >= 1.0 || iuv.y <= 0.0 || iuv.y >= 1.0) return 1e3;
  it = texture(uIceSdf, iuv);
  float low = texture(uIceLow, iuv).r;
  float heat = texture(uHeat, iuv).r;
  float rough = texture(uGrain, (w - uIce.xy) / 300.0).g;
  // A melting edge does not thin evenly: it rounds, and the thin parts go first.
  return mix(it.r, low, uIceState.z) + uIceState.x * (0.86 + 0.28 * rough) + heat * 26.0;
}

void main() {
  vec2 scr = vec2(vUv.x, 1.0 - vUv.y);
  vec2 p = vec2(scr.x * uView.x, uTop + scr.y * uView.y);
  vec2 tilt = (p - uCam.xy) / uCam.z + OBLIQUE;
  vec3 dir = normalize(vec3(tilt, -1.0));

  // ---- ice: decide first, because ice bends what is seen beneath it.
  // The block stands out of the water: its top face is level with the slab
  // at rest, and its south faces show because of the camera's slant.
  float iceTop = 0.0;       // > 0: px inside the top face
  float iceSide = -1.0;     // >= 0: this pixel is a side face, 0 at its top, 1 at the waterline
  vec4 it = vec4(0.0);
  vec2 ipt = p;             // where on the ice this pixel lands
  vec3 iceN = vec3(0.0, 0.0, 1.0);
  vec2 q = p;               // where the scene under this pixel is sampled
  bool hasIce = uIce.z > 0.0 && uIceAlive > 0.001
    && p.x > uIce.x - 40.0 && p.x < uIce.x + uIce.z + 40.0 && p.y > uIce.y - 40.0 && p.y < uIce.y + uIce.w + 60.0;
  if (hasIce) {
    float sunk = 1.0 - uIceState.y;
    ipt = p + tilt * FREEBOARD * sunk;
    float isd = iceField(ipt, it);
    if (isd < 0.0) {
      iceTop = -isd;
    } else {
      vec4 its;
      for (int i = 1; i <= 5; i++) {
        float s = float(i) / 5.0;
        vec2 w = p + tilt * FREEBOARD * mix(sunk, 1.0, s);
        if (iceField(w, its) < 0.0) { iceSide = s; ipt = w; it = its; break; }
      }
    }
    if (iceTop > 0.0) {
      float bev = 3.2;
      float x = clamp(iceTop / bev, 0.0, 1.0);
      vec2 il = ipt - uIce.xy;
      // The top face is not flat: it melted and refroze, so it rolls gently.
      vec2 und = (texture(uDetail, il / 760.0).gb - 0.5) * 0.3;
      iceN = normalize(vec3(it.ba * (1.0 - x) * 1.25 + und * x, 1.0));
      // Thick ice bends what is under it a long way; what is left at the
      // end is a thin clear lens.
      q = p - iceN.xy * (30.0 * uIceState.y + 12.0) * uIceAlive;
    }
  }

  vec4 b0 = texture(uBedA, bedUv(q));
  float sd0 = b0.r;

  if (uMode == 1) {
    float m = max(step(sd0, 0.75), max(step(0.001, iceTop), step(0.0, iceSide)));
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
      // The wall of the cut, above the waterline: honed stone, darker and
      // wetter toward the water. Its normal is horizontal.
      float f = clamp(-sd0 / max(length(tilt) * FREEBOARD, 1.0), 0.0, 1.0);
      vec3 n = normalize(vec3(-bw.ba, 0.12));
      float lit = (uLight.x * 0.82 + uLight.y * max(dot(n, L), 0.0)) / (uLight.x + uLight.y * L.z);
      col = stone(q * vec2(1.0, 2.6)) * lit * mix(1.0, 0.7, f * f);
      col = mix(col, col * (uScatter / max(uScatter.b, 1e-3) * 0.55 + 0.45), 0.5 * f);
      // The water throws its moving light back up the wall.
      float glim = texture(uDetail, vec2(q.x / 210.0 + uTime * 0.021, q.y / 60.0 - uTime * 0.034)).a;
      col += (uScatter * 3.0 + uSky * 0.25) * min(glim * glim * 14.0, 1.6) * 0.07 * (0.3 + 0.7 * f) * uLight.y;
      // A thin bright seam where the water touches the wall.
      col += uSky * smoothstep(0.86, 0.97, f) * 0.05;
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
      vec2 uv0 = duv - vel * (ph0 * 2.6) / DS;
      vec2 uv1 = duv - vel * (ph1 * 2.6) / DS + vec2(0.37, 0.61);
      vec4 d0 = texture(uDetail, uv0);
      vec4 d1 = texture(uDetail, uv1);
      vec4 df = mix(d0, d1, wphase);
      // The wind layers are rotated off the lattice so nothing lines up
      // with the screen axes.
      const mat2 R1 = mat2(0.7986, -0.6018, 0.6018, 0.7986);
      const mat2 R2 = mat2(0.5299, 0.8480, -0.8480, 0.5299);
      vec2 wuv1 = R1 * pw / 610.0 + vec2(0.021, 0.033) * uTime;
      vec4 dw = texture(uDetail, wuv1);
      vec2 wuv2 = R2 * pw / 340.0 - vec2(0.037, 0.018) * uTime + vec2(0.5, 0.2);
      vec4 dw2 = texture(uDetail, wuv2);
      dw.gb = (dw.gb - 0.5) * R1 + 0.5;
      dw2.gb = (dw2.gb - 0.5) * R2 + 0.5;
      float speed = clamp(length(vel) / max(uFlowSpeed, 1.0), 0.0, 1.5);
      float fa = 0.35 + 0.65 * speed;
      vec2 dgrad = ((df.gb - 0.5) * fa * 1.15 + (dw.gb - 0.5) * 0.55 + (dw2.gb - 0.5) * 0.4) * 0.05;

      vec2 slope = wv.ba * 7.4 + dgrad;
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

      // ---- shade thrown across the water by the bank and by the ice
      vec2 toSun = L.xy / L.z;
      float bankShade = smoothstep(-1.2, 1.2, texture(uBedA, bedUv(pw + toSun * FREEBOARD)).r);
      float iceShade = 0.0;
      if (hasIce && iceTop <= 0.0) {
        vec4 its;
        float ssd = iceField(pw + toSun * FREEBOARD * uIceState.y, its);
        iceShade = (1.0 - smoothstep(-1.5, 1.5, ssd)) * smoothstep(0.0, 0.25, uIceState.y);
      }
      float shade = max(bankShade, iceShade);

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
        if (hasIce) {
          vec4 its;
          float isd2 = iceField(pb + toSun * (FREEBOARD * uIceState.y + depth * 0.55), its);
          shadow *= 1.0 - 0.5 * (1.0 - smoothstep(-4.0, 10.0, isd2)) * (0.25 + 0.75 * uIceState.y) * uIceAlive;
        }
      } else {
        float near = 1.0 - smoothstep(0.0, depth * 0.8 + 4.0, -bb.r);
        shadow = 1.0 - 0.6 * near * max(dot(bb.ba, normalize(L.xy)), 0.0);
      }
      // Caustics: light focused by the curvature of the surface above. The
      // curvature of every moving layer and of the simulated waves is added
      // up first and focused once, so the net on the bed is one net: it
      // drifts, stretches along the current and tightens around a wake.
      float dn = clamp(depth / DEEP, 0.0, 1.0);
      float reach = 0.42 + 0.58 * dn;
      vec3 lightOnBed;
      if (uQuality > 0.5) {
        vec3 t = mix(texture(uCurv, uv0).rgb, texture(uCurv, uv1).rgb, wphase) * (fa * 1.0);
        t += turn(texture(uCurv, wuv1).rgb, R1) * 0.34;
        t += turn(texture(uCurv, wuv2).rgb, R2) * 0.44;
        // A wide stencil: the curvature of the waves, not of the grid.
        vec2 e = 1.6 / uSim.zw;
        float gx1 = texture(uWave, suv + vec2(e.x, 0.0)).b;
        float gx0 = texture(uWave, suv - vec2(e.x, 0.0)).b;
        float gy1 = texture(uWave, suv + vec2(0.0, e.y)).a;
        float gy0 = texture(uWave, suv - vec2(0.0, e.y)).a;
        t.xy -= vec2(gx1 - gx0, gy1 - gy0) * 7.5;
        float f = reach * uLight.z;
        float caust = focus(t, f);
        vec3 c3 = vec3(caust);
        if (uQuality > 1.5) {
          // A touch of dispersion: red focuses a little short, blue a little long.
          c3 = vec3(focus(t, f * 0.93), caust, focus(t, f * 1.07));
        }
        lightOnBed = uLight.x * 0.9 + uLight.y * direct * shadow * c3;
      } else {
        float caust = mix(1.0, min(df.a * 6.0, 4.0), clamp(reach * uLight.z, 0.0, 1.0));
        lightOnBed = vec3(uLight.x * 0.9 + uLight.y * direct * shadow * caust);
      }
      float caust = dot(lightOnBed, vec3(0.3333)) / (uLight.x * 0.9 + uLight.y);
      bed *= lightOnBed / (uLight.x + uLight.y);

      // ---- the water column
      float path = depth * (1.0 + 1.0 / max(-r.z, 0.3));
      vec4 dye = texture(uDye, suv);
      vec3 trans = exp(-uAbsorb * path);
      float turbid = 1.0 - exp(-path * 0.011);
      // Deep water still carries soft shafts of the light above it.
      vec3 body = uScatter * (0.5 + 0.5 * shadow) * (0.5 + 0.62 * min(caust, 3.0)) * (1.0 - 0.3 * shade);
      col = bed * trans + body * turbid * (1.0 - trans * 0.35);
      // Meltwater is cold and clear: it lifts the water's own colour a
      // little where it runs, it does not fog it.
      col += uScatter * clamp(dye.g, 0.0, 1.0) * 0.6;

      // ---- the surface
      float cosi = clamp(dot(-dir, n), 0.0, 1.0);
      float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
      vec3 rf = reflect(dir, n);
      vec3 sky = env(rf, 0.0) * (1.0 - 0.75 * shade);
      // Ripple faces turned toward the key light flash; calm water does not.
      float crest = smoothstep(0.05, 0.42, dot(slope, -normalize(L.xy)));
      float spark = pow(max(dot(rf, L), 0.0), 90.0);
      col += sky * (1.0 + fres * 6.0) + uSky * (crest * crest * 0.34 + spark * 0.7) * uLight.w * (1.0 - 0.8 * shade);
      // Foam rides the current as broken cells, not a white wash.
      float streak = texture(uGrain, (pw - vel * 0.35) / 210.0).g;
      float foam = clamp(dye.r, 0.0, 1.0);
      col += uFoam * foam * (0.3 + 0.7 * smoothstep(0.35, 0.7, streak)) * 0.16;
      // Waterline: a dark wet seam where the water meets a bank.
      col *= 1.0 - 0.2 * smoothstep(-2.2, 0.0, bw.r);
    }
  }

  // ---- ice on top
  if (iceTop > 0.0) {
    float x = clamp(iceTop / 3.2, 0.0, 1.0);
    float live = uIceAlive;
    vec2 il = ipt - uIce.xy;
    vec4 g1 = texture(uGrain, il / 520.0);
    vec4 g2 = texture(uGrain, il / 130.0);
    vec4 g3 = texture(uGrain, il / 41.0);
    float core = smoothstep(0.25, 1.0, x);
    // Cloudy where air froze in, clear where it did not; clear at every
    // edge. As it melts the frost goes and the block turns to clear glass.
    float cloud = smoothstep(0.3, 0.68, g1.g * 0.66 + g2.g * 0.34);
    float opacity = core * mix(0.26, 0.92, cloud) * uIceState.w;
    vec3 frac3 = fracture(il / 96.0 + vec2(3.7, 1.9));
    float facet = 1.0 + (frac3.y - 0.5) * 0.085;
    vec3 body = uIceCol * (0.94 + 0.08 * g1.g) * facet * (0.8 + 0.2 * landLight(iceN));
    // What is under the block shows through it, bent, and cooler.
    vec3 under = col * vec3(0.86, 0.97, 1.0) * mix(0.72, 1.0, core) + uScatter * 0.55;
    under = mix(col, under, live * (0.35 + 0.65 * uIceState.w));
    col = mix(under, body, clamp(opacity, 0.0, 0.95));
    // Fracture planes: fine bright seams with a soft sheet of light to one side.
    float seam = (1.0 - smoothstep(0.006, 0.02, frac3.x)) * step(0.3, frac3.z);
    float sheet = exp(-frac3.x * 11.0) * step(0.3, frac3.z);
    col += uSky * (seam * 0.3 + sheet * 0.07) * core * uIceState.w;
    // Trapped air.
    float air = smoothstep(0.93, 0.98, g3.r) * cloud * core;
    col += uSky * air * 0.09 * uIceState.w;
    // Wet ice is glossy: the lights above cross the name as the page moves.
    vec3 rf = reflect(dir, iceN);
    float cosi = clamp(dot(-dir, iceN), 0.0, 1.0);
    col += env(rf, 1.0) * (1.5 + 4.0 * pow(1.0 - cosi, 4.0)) * live;
    // The bevel that faces the light flashes; the far one falls into shade.
    vec2 nxy = normalize(it.ba + 1e-4);
    float toLight = dot(nxy, normalize(L.xy));
    float rim = 1.0 - core;
    float stand = 0.3 + 0.7 * uIceState.y;
    col += uSky * rim * pow(max(toLight, 0.0), 1.3) * 0.75 * live * stand;
    col *= 1.0 - 0.42 * rim * max(-toLight, 0.0) * live * stand;
    // A hairline of light right on the edge keeps every letter crisp.
    float lip = smoothstep(0.0, 0.1, x) * (1.0 - smoothstep(0.1, 0.34, x));
    col += uSky * lip * 0.2 * live;
  } else if (iceSide >= 0.0) {
    // The cut face of the block, seen at a slant: clear ice over dark water,
    // paler at the top arris, bluer and wet at the waterline.
    vec2 il = ipt - uIce.xy;
    float streak = texture(uGrain, vec2(il.x / 26.0, il.y / 190.0)).g;
    vec3 face = mix(uIceCol * 0.62, uScatter * 2.6 + uIceCol * 0.1, 0.25 + 0.6 * iceSide);
    face *= 0.9 + 0.2 * streak;
    col = mix(col * 0.55, face, 0.5 + 0.32 * uIceState.w);
    col += uSky * (1.0 - smoothstep(0.0, 0.3, iceSide)) * 0.14;
    col += uSky * smoothstep(0.8, 1.0, iceSide) * 0.08;
  }

  // Display transform and a blue-noise-ish dither against banding.
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  float dn2 = texture(uGrain, gl_FragCoord.xy / 256.0).r;
  col += (dn2 - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;
