/**
 * The shading pass. One full-resolution fragment shader draws the whole
 * world: dry land (a lit stone slab with a wet shore), the walls of the
 * channels cut into it, a bed that shelves away under refracting water,
 * caustics that change with depth, the light the surface reflects, and the
 * ice name.
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
 *
 * Edges: land against channel, wall against water and ice against water are
 * each blended across about one device pixel from the distance fields, so
 * no boundary is a hard per-pixel decision.
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
uniform float uScale;      // how fast the bed falls away: 1 on a desktop, tighter on a phone's narrow channels
uniform float uPx;         // CSS px per device pixel: the width every edge is blended across
uniform float uShoal;      // world y where the wide shallows before the ending begin
uniform float uNight;      // 0 day, 1 night: the dark theme is lit differently, not just recoloured

uniform sampler2D uBedA;
uniform sampler2D uBedB;
uniform sampler2D uWave;   // h, v, gx, gy
uniform sampler2D uVel;
uniform sampler2D uDetail;
uniform sampler2D uCurv;   // curvature of the detail field: xx, yy, xy
uniform sampler2D uGrain;
uniform sampler2D uIceSdf; // sd px, _, gx, gy
uniform sampler2D uIceLow; // the same field, heavily smoothed: what a melting edge rounds toward
uniform sampler2D uHeat;

uniform vec4 uIce;         // world rect of the ice texture: x, y, w, h (w = 0: no ice)
uniform vec4 uIceState;    // x: erosion px, y: height above the water 0..1, z: rounding 0..1, w: body 0..1
uniform float uIceHalf;    // half the thickest stroke, px
uniform float uIceAlive;   // 1 while any ice is left, easing to 0 as the last lenses clear
uniform float uMeltAct;    // 0..1: how hard the name is melting right now
uniform vec4 uMeltPath;    // xy: the lake's outlet, z: how far the thread runs on, w: stream width

// Palette, already mixed for the current theme, linear light.
uniform vec3 uLand;
uniform vec3 uBed;
uniform vec3 uAbsorb;      // per channel absorption per px of path
uniform vec3 uScatter;     // colour water takes on with depth
uniform vec3 uSky;         // what the surface reflects
uniform vec3 uRim;         // the cool light that edges night water
uniform vec3 uMelt;        // what meltwater lends the water it runs through
uniform vec3 uIceCol;
uniform vec4 uLight;       // x: ambient, y: key, z: caustic gain, w: glint gain
uniform vec3 uGrainAmt;    // x: speckle and relief, y: mottling, z: falloff

const vec3 L = vec3(-0.5145, -0.6174, 0.5952);     // to the key light: upper left, raised
const vec2 LXY = vec2(-0.6402, -0.7682);           // its direction on the ground
const vec2 OBLIQUE = vec2(0.0, -0.36);             // the camera's slant
const float FREEBOARD = ${FREEBOARD}.0;            // the water sits this far below the slab
const float DEEP = 130.0;

vec2 bedUv(vec2 w) { return w / (uBedSize * uBedDiv); }
vec2 simUv(vec2 w) { return vec2(w.x / (uSim.z * uSim.y), (w.y - uSim.x) / (uSim.w * uSim.y)); }

/**
 * The bed field with a natural shoreline: slow noise moves the bank in and
 * out by about two px, far inside the 14 px that text keeps from water.
 */
vec4 bedAt(vec2 w) {
  vec4 b = texture(uBedA, bedUv(w));
  b.r += (texture(uGrain, w / 800.0).g - 0.5) * 7.0;
  return b;
}

/**
 * How deep the bed lies at a distance from the bank. It shelves smoothly:
 * steep at first, then easing, and it never stops falling, so wide water is
 * deepest in its middle and a narrow channel gets a U section.
 */
float bedDepth(float sd, out float slope) {
  float d = max(-sd, 0.0) / uScale;
  float e = exp(-d / 22.0);
  slope = (2.6 * e + 0.3) / uScale;
  return 3.0 + 58.0 * (1.0 - e) + 0.3 * d;
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

/**
 * The same room seen in open water: the long light overhead lies across the
 * surface as one broad soft band, and every ripple breaks it up.
 */
vec3 envWater(vec3 rf) {
  vec2 a = rf.xy / max(rf.z, 0.25);
  float far = smoothstep(0.3, -1.3, a.y);
  vec2 c = a - vec2(-0.1, -0.43);
  float band = (1.0 - smoothstep(0.3, 1.3, abs(c.x))) * (1.0 - smoothstep(0.015, 0.11, abs(c.y)));
  // By night the band is faint: the water is lit from within, not from above.
  // What it reflects is a cool sky, in the water's own hue: reflected light
  // may brighten the lake but never greys it.
  vec3 cool = uSky * vec3(0.3, 0.82, 0.94);
  return uSky * 0.008 + cool * (0.011 * far * (1.0 - 0.6 * uNight) + band * mix(0.03, 0.016, uNight));
}

/** A symmetric 2x2 tensor (xx, yy, xy) seen through a rotated layer. */
vec3 turn(vec3 h, mat2 R) {
  mat2 M = transpose(R) * mat2(h.x, h.z, h.z, h.y) * R;
  return vec3(M[0][0], M[1][1], M[0][1]);
}

float focus(vec3 t, float f) {
  float det = (1.0 + f * t.x) * (1.0 + f * t.y) - f * f * t.z * t.z;
  return min(1.0 / max(abs(det), 0.16), 4.6);
}

float landLight(vec3 n) {
  return (uLight.x + uLight.y * max(dot(n, L), 0.0)) / (uLight.x + uLight.y * L.z);
}

float stoneH(vec4 g) { return g.a * 0.6 + g.b * 0.4; }

/**
 * The slab: stone with a grain you can see. A fine pitted relief and a slow
 * roll are lit by the key light; near water the stone is wet, so it is
 * darker, glossier, and picks up the light the water throws.
 */
vec3 landColor(vec2 p, float sd, vec2 grad, vec2 scr) {
  vec4 g0 = texture(uGrain, p / 128.0);
  float mott = texture(uGrain, p / 1900.0).g;
  float cloud = texture(uGrain, p / 5200.0).b;
  vec3 col = uLand * (1.0 + (g0.r - 0.5) * uGrainAmt.x * 0.7 + (mott - 0.5) * uGrainAmt.y + (cloud - 0.5) * uGrainAmt.y * 1.5);
  vec2 rel = (texture(uDetail, p / 330.0).gb - 0.5) * 0.1;
  if (uQuality > 0.5) {
    float h0 = stoneH(g0);
    float hx = stoneH(texture(uGrain, (p + vec2(0.5, 0.0)) / 128.0));
    float hy = stoneH(texture(uGrain, (p + vec2(0.0, 0.5)) / 128.0));
    rel += vec2(hx - h0, hy - h0) * 0.42;
  }
  // The arris where the slab meets a cut is eased, not machined: a narrow
  // round that catches the key on one side and loses it on the other.
  float ch = 1.0 - smoothstep(0.4, 2.2, sd);
  vec3 n = normalize(vec3(-rel - grad * ch * 0.4, 1.0));
  col *= landLight(n);
  // Wet shore.
  float wet = 1.0 - smoothstep(0.5, 11.0, sd);
  col *= 1.0 - 0.24 * wet;
  vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float gloss = pow(max(dot(n, hv), 0.0), 26.0);
  float glim = texture(uDetail, vec2(p.x / 190.0 + uTime * 0.021, p.y / 150.0 - uTime * 0.027)).a;
  col += (uSky * 0.05 + uRim * 0.5 * uNight) * wet * (gloss * 2.2 + min(glim * glim * 9.0, 1.2) * 0.35 * wet) * uLight.y;
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
  // A melting edge rounds as it wears back: corners go before flats. The
  // wear is even along a stroke and capped by the engine well inside the
  // thinnest stroke, so a letter softens but can never break. The rounded
  // field may only ever take ice away from a corner; it is never allowed
  // to thin a stroke further than the wear itself does.
  float soft = mix(it.r, max(it.r, min(low, it.r + uIceState.x)), uIceState.z);
  // Warmth from the pointer wears it a little more, inside the same cap.
  return soft + uIceState.x + heat * min(26.0, uIceHalf * 0.14);
}

void main() {
  vec2 scr = vec2(vUv.x, 1.0 - vUv.y);
  vec2 p = vec2(scr.x * uView.x, uTop + scr.y * uView.y);
  vec2 tilt = (p - uCam.xy) / uCam.z + OBLIQUE;
  vec3 dir = normalize(vec3(tilt, -1.0));
  float aa = uPx * 0.75;

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
      // A narrow eased arris, then a top face that rolls gently: it melted
      // and refroze. That roll is what bends the lake bed seen through it.
      float x = clamp(iceTop / 2.4, 0.0, 1.0);
      vec2 il = ipt - uIce.xy;
      vec2 und = (texture(uDetail, il / 620.0).gb - 0.5) * 0.42;
      iceN = normalize(vec3(it.ba * (1.0 - x) * 0.9 + und * x * 0.12, 1.0));
      // Thick ice bends what is under it a long way and magnifies it a
      // little; a thin melted lens hardly bends it at all.
      q = p - (iceN.xy + und * x * 0.9) * (34.0 * uIceState.y + 10.0) * uIceAlive + tilt * 10.0 * uIceState.y;
    }
  }

  vec4 b0 = bedAt(q);
  float sd0 = b0.r;

  if (uMode == 1) {
    float m = max(step(sd0, 0.75), max(step(0.001, iceTop), step(0.0, iceSide)));
    o = vec4(m, m, m, 1.0);
    return;
  }

  float aLand = smoothstep(-aa, aa, sd0);
  vec3 col = vec3(0.0);
  if (aLand > 0.0) col = landColor(q, sd0, b0.ba, scr) * aLand;
  if (aLand < 1.0) {
    // ---- into the channel
    vec2 pw = q + tilt * FREEBOARD;
    vec4 bw = bedAt(pw);
    float aWall = smoothstep(-aa, aa, bw.r);
    vec3 cut = vec3(0.0);
    if (aWall > 0.0) {
      // The wall of the cut, above the waterline: stone, wetter and darker
      // toward the water, and never the same for long along its length.
      float f = clamp(-sd0 / max(length(tilt) * FREEBOARD, 1.0), 0.0, 1.0);
      vec3 n = normalize(vec3(-bw.ba, 0.12));
      float lit = (uLight.x * 0.82 + uLight.y * max(dot(n, L), 0.0)) / (uLight.x + uLight.y * L.z);
      vec4 gw = texture(uGrain, q * vec2(1.0, 2.6) / 256.0);
      float along = texture(uGrain, q / 310.0).g;
      vec3 wall = uLand * (1.0 + (gw.r - 0.5) * uGrainAmt.x + (gw.g - 0.5) * 0.16 + (along - 0.5) * 0.34);
      wall *= lit * mix(1.0, 0.62, f * f);
      wall = mix(wall, wall * (uScatter / max(uScatter.g, 1e-3) * 0.55 + 0.45), 0.5 * f);
      // The water throws its moving light back up the wall.
      float glim = texture(uDetail, vec2(q.x / 210.0 + uTime * 0.021, q.y / 60.0 - uTime * 0.034)).a;
      wall += (uScatter * 3.0 + uSky * 0.25 + uRim * 2.0 * uNight) * min(glim * glim * 14.0, 1.6) * 0.07 * (0.3 + 0.7 * f) * uLight.y;
      // A thin bright seam where the water touches the wall; at night it is
      // the cool rim that draws the water's outline.
      wall += (uSky * 0.05 + uRim * uNight) * smoothstep(0.8, 0.97, f);
      cut += wall * aWall;
    }
    if (aWall < 1.0) {
      vec2 suv = simUv(pw);
      vec4 wv = texture(uWave, suv);
      vec3 fl = texture(uBedB, bedUv(pw)).rgb;
      vec2 flow = (fl.rg - 0.5019608) * 2.0;
      vec2 vel = flow * uFlowSpeed + texture(uVel, suv).rg * 0.7;
      float open = smoothstep(36.0, 150.0, -bw.r);

      // Detail: one fine layer carried by the current (two phases,
      // cross-faded so it never stretches), one fine and one broad wind
      // layer so still pools live. A wake moves the carried layer, which is
      // how a wake bends the light under it.
      float ph0 = fract(uTime * 0.19);
      float ph1 = fract(uTime * 0.19 + 0.5);
      float wphase = abs(ph0 * 2.0 - 1.0);
      const float DS = 132.0;
      vec2 duv = pw / DS;
      vec2 uv0 = duv - vel * (ph0 * 2.6) / DS;
      vec2 uv1 = duv - vel * (ph1 * 2.6) / DS + vec2(0.37, 0.61);
      vec4 df = mix(texture(uDetail, uv0), texture(uDetail, uv1), wphase);
      // The wind layers are rotated off the lattice so nothing lines up
      // with the screen axes.
      const mat2 R1 = mat2(0.7986, -0.6018, 0.6018, 0.7986);
      const mat2 R2 = mat2(0.5299, 0.8480, -0.8480, 0.5299);
      vec2 wuv1 = R1 * pw / 520.0 + vec2(0.017, 0.026) * uTime;
      vec4 dw = texture(uDetail, wuv1);
      vec2 wuv2 = R2 * pw / 96.0 - vec2(0.045, 0.022) * uTime + vec2(0.5, 0.2);
      vec4 dw2 = texture(uDetail, wuv2);
      dw.gb = (dw.gb - 0.5) * R1 + 0.5;
      dw2.gb = (dw2.gb - 0.5) * R2 + 0.5;
      float speed = clamp(length(vel) / max(uFlowSpeed, 1.0), 0.0, 1.5);
      float fa = 0.35 + 0.65 * speed;
      vec2 dgrad = ((df.gb - 0.5) * fa * 0.9 + (dw.gb - 0.5) * 0.75 + (dw2.gb - 0.5) * 0.34) * 0.05;

      // One long slow swell crosses open water, far bigger than the ripples.
      const vec2 K1 = vec2(0.0066, 0.0043);
      const vec2 K2 = vec2(-0.0037, 0.0079);
      float s1 = dot(pw, K1) - uTime * 0.52;
      float s2 = dot(pw, K2) - uTime * 0.38 + 1.7;
      vec2 swell = (K1 * cos(s1) + K2 * cos(s2) * 0.8) * 2.2 * open;
      float lift = (sin(s1) + 0.8 * sin(s2)) * open;

      vec2 slope = wv.ba * 9.0 + dgrad + swell;
      // Meniscus: the surface climbs the bank.
      float men = smoothstep(-5.0, -0.5, bw.r);
      slope += bw.ba * men * 0.42;
      vec3 n = normalize(vec3(-slope, 1.0));

      vec3 r = refract(dir, n, 0.75);
      float sl0;
      float d0p = bedDepth(bw.r, sl0);
      vec2 pb = pw + r.xy / max(-r.z, 0.2) * d0p;
      vec4 bb = bedAt(pb);
      float sl;
      float depth = bedDepth(min(bb.r, -0.01), sl);
      // The mouth of the stream is a wide shoal, not a deep lake: sand bars
      // lie a little under the surface, so the bed and the light on it show
      // all the way across.
      float shoalK = smoothstep(uShoal - 30.0, uShoal + 150.0, pb.y);
      if (shoalK > 0.0) {
        float bars = texture(uDetail, vec2(pb.x / 2100.0, pb.y / 1300.0)).r;
        depth = mix(depth, min(depth, 30.0 + 24.0 * bars), shoalK);
      }
      float dn = clamp(depth / DEEP, 0.0, 1.0);
      float shallow = 1.0 - smoothstep(0.08, 0.5, dn);

      // ---- shade thrown across the water by the bank and by the ice. A
      // few taps a pixel apart, because the field is coarser than the screen.
      vec2 toSun = L.xy / L.z;
      vec2 sp = pw + toSun * FREEBOARD;
      float bankShade;
      if (uQuality > 0.5) {
        bankShade = smoothstep(-2.4, 2.4, texture(uBedA, bedUv(sp + vec2(1.1, 0.4))).r)
                  + smoothstep(-2.4, 2.4, texture(uBedA, bedUv(sp + vec2(-0.4, 1.1))).r)
                  + smoothstep(-2.4, 2.4, texture(uBedA, bedUv(sp + vec2(-1.1, -0.4))).r)
                  + smoothstep(-2.4, 2.4, texture(uBedA, bedUv(sp + vec2(0.4, -1.1))).r);
        bankShade *= 0.25;
      } else {
        bankShade = smoothstep(-2.4, 2.4, texture(uBedA, bedUv(sp)).r);
      }
      float iceShade = 0.0;
      if (hasIce && iceTop <= 0.0) {
        vec4 its;
        float ssd = iceField(pw + toSun * FREEBOARD * uIceState.y, its);
        iceShade = (1.0 - smoothstep(-2.0, 2.0, ssd)) * smoothstep(0.0, 0.25, uIceState.y);
      }
      float shade = max(bankShade, iceShade);

      // ---- the bed: silt, small stones and faint ripple marks, so the
      // water is plainly a layer over a floor.
      vec4 gb = texture(uGrain, pb / 256.0);
      vec4 gs = texture(uGrain, pb / 330.0);
      float marks = sin(dot(pb, vec2(0.34, 0.94)) / 5.2 + gs.g * 11.0);
      vec3 bed = uBed * (1.0 + (gb.r - 0.5) * uGrainAmt.x * 0.5 + (gs.b - 0.42) * 0.17 + (gb.a - 0.4) * 0.12 + marks * 0.06 * shallow);
      vec3 nb = normalize(vec3(-bb.ba * sl * 0.55, 1.0));
      vec3 lr = normalize(vec3(L.xy * 0.72, L.z));
      float direct = max(dot(nb, lr), 0.0) / lr.z;
      // The bank on the light's side shades the bed below it.
      float shadow = 1.0;
      if (uQuality > 0.5) {
        float reach = (min(depth, 70.0) + FREEBOARD) * 0.62;
        float ssd = texture(uBedA, bedUv(pb + LXY * reach)).r;
        shadow = 1.0 - 0.62 * smoothstep(-3.0, 7.0, ssd);
        if (hasIce) {
          vec4 its;
          float isd2 = iceField(pb + toSun * (FREEBOARD * uIceState.y + min(depth, 70.0) * 0.55), its);
          shadow *= 1.0 - 0.5 * (1.0 - smoothstep(-4.0, 10.0, isd2)) * (0.25 + 0.75 * uIceState.y) * uIceAlive;
        }
      } else {
        float near = 1.0 - smoothstep(0.0, depth * 0.8 + 4.0, -bb.r);
        shadow = 1.0 - 0.6 * near * max(dot(bb.ba, LXY), 0.0);
      }
      // Caustics: light focused by the curvature of the surface above. The
      // curvature of every moving layer and of the simulated waves is added
      // up first and focused once, so the net on the bed is one net. What
      // goes into the sum depends on depth: the fine layers in the shallows,
      // the broad one further down, and nothing in the deep, where only
      // slow shafts of light are left.
      float fineW = 1.0 - smoothstep(0.12, 0.6, dn);
      float broadW = smoothstep(0.06, 0.4, dn);
      float net = 1.0 - smoothstep(0.55, 0.96, dn);
      float shaft = 0.45 + 1.1 * texture(uDetail, R2 * pw / 2300.0 + vec2(0.006, -0.004) * uTime).r;
      vec3 lightOnBed;
      float nfil = 0.0;    // how much of the net's light is gathered here, for the night's glow
      if (uQuality > 0.5) {
        vec3 t = mix(texture(uCurv, uv0).rgb, texture(uCurv, uv1).rgb, wphase) * (fa * fineW);
        t += turn(texture(uCurv, wuv2).rgb, R2) * (0.5 * fineW);
        t += turn(texture(uCurv, wuv1).rgb, R1) * (0.95 * broadW);
        // A wide stencil: the curvature of the waves, not of the grid.
        vec2 e = 1.6 / uSim.zw;
        float gx1 = texture(uWave, suv + vec2(e.x, 0.0)).b;
        float gx0 = texture(uWave, suv - vec2(e.x, 0.0)).b;
        float gy1 = texture(uWave, suv + vec2(0.0, e.y)).a;
        float gy0 = texture(uWave, suv - vec2(0.0, e.y)).a;
        t.xy -= vec2(gx1 - gx0, gy1 - gy0) * 4.5;
        float f = uLight.z * mix(0.46, 0.8, dn);
        float caust = focus(t, f);
        vec3 c3 = vec3(caust);
        if (uQuality > 1.5) {
          // A touch of dispersion: red focuses a little short, blue a little long.
          c3 = vec3(focus(t, f * 0.93), caust, focus(t, f * 1.07));
        }
        // Where the surface spreads the light the bed is only a little
        // dimmer: the net is bright lines on a calm floor, not an embossing.
        c3 = max(c3, 0.62 + 0.38 * c3);
        // By night it is the same net, seen in less light: the same filled
        // filaments with the same soft falloff, fewer of them (only where
        // the light is truly gathered) and dimmer. Nothing is thresholded
        // into a line, so nothing can read as an outline.
        float gather = clamp((caust - 1.0) / 3.6, 0.0, 1.0);
        nfil = pow(gather, 1.5) * net * (0.3 + 0.7 * shallow);
        c3 = mix(c3, 0.36 + (c3 - 0.62) * 0.1, uNight);
        c3 = mix(vec3(shaft), c3, net);
        lightOnBed = uLight.x * 0.9 + uLight.y * direct * shadow * c3;
      } else {
        float caust = mix(shaft, min(df.a * 6.0, 4.0), net * clamp(uLight.z * 0.5, 0.0, 1.0));
        lightOnBed = vec3(uLight.x * 0.9 + uLight.y * direct * shadow * caust);
      }
      float caust = dot(lightOnBed, vec3(0.3333)) / (uLight.x * 0.9 + uLight.y);
      bed *= lightOnBed / (uLight.x + uLight.y);

      // ---- the water column
      float path = (depth + 7.0) * (1.0 + 1.0 / max(-r.z, 0.3));
      vec3 trans = exp(-uAbsorb * path);
      float turbid = 1.0 - exp(-path * 0.011);
      // Deep water still carries soft shafts of the light above it.
      vec3 body = uScatter * (0.5 + 0.5 * shadow) * (0.5 + 0.62 * min(caust, 3.0)) * (1.0 - 0.3 * shade) * (1.0 + 0.1 * lift);
      vec3 water = bed * trans + body * turbid * (1.0 - trans * 0.35);
      // The deep is never a flat fill: one long swell crosses open water and
      // soft shafts of light drift in it, slowly. Light only; no haze.
      float deepK = smoothstep(0.5, 0.95, dn);
      if (deepK > 0.0) {
        float bend = texture(uDetail, pw / 2600.0 + vec2(0.003, 0.0) * uTime).r;
        float swell = sin(dot(pw, vec2(0.0019, 0.0041)) - uTime * 0.2 + bend * 3.2);
        float sh = texture(uDetail, vec2(pw.x + pw.y * 0.45, pw.y * 0.3) / 1100.0 + vec2(0.004, -0.002) * uTime).r;
        water *= (1.0 - 0.42 * deepK * uNight) * (1.0 + deepK * (0.15 * swell + 0.55 * (sh - 0.45)));
      }
      // Night: the net is what lights the water. Cool cyan-white, strongest
      // in the shallows by the banks, gone in the deep.
      water += uRim * nfil * 36.0 * uNight * (0.4 + 0.6 * shadow) * (0.45 + 0.55 * trans.g);
      // Meltwater is cold and clear: it brightens and cools the water it
      // runs through. It never fogs it.
      // It is drawn, not simulated: fine streaks that lie along the current
      // from the letters to the outlet, and one brighter thread down the
      // first channel. Only light is added, in the water's own hue, so it
      // can never grey or soften the lake; and it is tied to the melt
      // itself, so it is gone within a second of the melt stopping.
      if (uMeltAct > 0.002 && uIce.z > 0.0) {
        vec2 to = uMeltPath.xy - pw;
        float dist = length(to);
        float mw = 0.0;
        if (pw.y < uMeltPath.y) {
          // Lake: lines that converge on the outlet and slide toward it.
          // The lines wander as a current does: never ruled rays.
          float wob = (texture(uDetail, pw / 1500.0 + vec2(0.0, uTime * 0.006)).r - 0.5) * 0.9;
          float ang = atan(to.x, max(to.y, 1.0)) + wob * smoothstep(40.0, 420.0, dist);
          float along = dist / 520.0 + uTime * 0.2;
          float n1 = texture(uGrain, vec2(ang * 1.9 + 0.31, along * 0.11)).g;
          float n2 = texture(uGrain, vec2(ang * 5.3 - 0.17, along * 0.23 + 0.4)).g;
          float st = smoothstep(0.52, 0.66, n1) * 0.7 + smoothstep(0.56, 0.68, n2) * 0.5;
          // Between the name and the outlet only: a fan whose top edge is
          // the row of letters.
          float icy = uIce.y + uIce.w * 0.5;
          float span = max(uMeltPath.y - icy, 1.0);
          float v = clamp((pw.y - icy) / span, 0.0, 1.0);
          float cxm = mix(uIce.x + uIce.z * 0.5, uMeltPath.x, v);
          float halfw = mix(uIce.z * 0.5, uMeltPath.w * 0.8, v * v);
          float fan = 1.0 - smoothstep(0.7, 1.0, abs(pw.x - cxm) / max(halfw, 1.0));
          float head = smoothstep(icy - uIce.w * 0.3, icy + uIce.w * 0.25, pw.y);
          float brk = 0.35 + 0.65 * smoothstep(0.3, 0.62, texture(uGrain, vec2(ang * 2.7, along * 0.8)).g);
          mw = min(st * brk, 0.85) * fan * head * (0.5 + 0.5 * v) * smoothstep(30.0, 200.0, dist);
        } else if (uMeltPath.z > 0.0) {
          // Channel: one thread down the middle, breaking up as it goes.
          float run = (pw.y - uMeltPath.y) / uMeltPath.z;
          float mid = smoothstep(uMeltPath.w * 0.16, uMeltPath.w * 0.42, -bw.r);
          float n = texture(uGrain, vec2(pw.x / 90.0, pw.y / 900.0 - uTime * 0.16)).g;
          mw = mid * (0.55 + 0.45 * smoothstep(0.35, 0.7, n)) * (1.0 - smoothstep(0.35, 1.0, run));
        }
        mw *= uMeltAct;
        water += (water * 0.55 + uMelt) * mw;
      }

      // ---- the surface
      // The mirror is gentler than the lens: a steep wave face must not
      // turn into a flat sheet of reflected sky.
      vec3 nr = normalize(vec3(-slope * 0.5, 1.0));
      float cosi = clamp(dot(-dir, nr), 0.0, 1.0);
      float fres = min(0.02 + 0.98 * pow(1.0 - cosi, 5.0), 0.16);
      vec3 rf = reflect(dir, nr);
      vec3 sky = envWater(rf) * (1.0 - 0.75 * shade);
      // Small sharp glints on steep ripple faces turned toward the key
      // light. Calm water has none; a wake throws a line of them.
      float face = dot(slope, -LXY);
      float glint = smoothstep(0.1, 0.13, face) * (1.0 - smoothstep(0.15, 0.24, face));
      // A wave is seen the way real ripples are: the face turned to the
      // light is brighter, the far face darker. No layer is drawn over it.
      float wf = dot(wv.ba, -LXY) * 9.0;
      water *= 1.0 + clamp(wf * 4.0, -0.32, 0.4);
      water += sky * (1.0 + fres * 6.0) * (1.0 + clamp(wf * 9.0, -0.6, 1.1)) + uSky * glint * 0.11 * uLight.w * (1.0 - 0.8 * shade);
      // Waterline: a dark wet seam where day water meets a bank; by night a
      // cool rim of light instead.
      float line = smoothstep(-2.6, 0.0, bw.r);
      water *= 1.0 - 0.22 * line * (1.0 - uNight);
      water += uRim * uNight * (line * 2.2 + smoothstep(-9.0, 0.0, bw.r) * 0.5);
      cut += water * (1.0 - aWall);
    }
    col += cut * (1.0 - aLand);
  }

  // ---- ice on top
  if (iceTop > 0.0) {
    vec3 scene = col;
    float live = uIceAlive;
    float bodyK = uIceState.w;
    vec2 il = ipt - uIce.xy;
    vec4 g1 = texture(uGrain, il / 560.0);
    vec4 g3 = texture(uGrain, il / 170.0);
    float core = smoothstep(0.0, 2.4, iceTop);
    // Clear glacier ice: the lake bed and its light show through, bent,
    // cooler and lighter, under one even milky scatter. No cloud, no marble.
    // The scatter is a little brighter toward the light, as it is in a
    // real block: one slow gradient across the whole name.
    vec2 ic = il / uIce.zw - 0.5;
    // Thick ice is bluer than thin ice, as a glacier is.
    float thick = smoothstep(1.0, 20.0, iceTop);
    vec3 tint = mix(vec3(1.0), vec3(0.74, 0.93, 1.0), thick);
    vec3 lit = uIceCol * tint * (0.9 + 0.1 * landLight(iceN)) * (1.0 - 0.2 * dot(ic, -LXY));
    // Light that went in through the top comes back focused off the floor
    // of the block: a slow, magnified net seen inside the letters.
    float inl = texture(uDetail, q / 380.0 + vec2(0.011, 0.007) * uTime).a;
    vec3 under = col * vec3(1.0, 1.22, 1.3) + uScatter * 0.9 + uIceCol * tint * min(inl * inl * 5.0, 1.0) * 0.2 * (0.3 + 0.7 * uLight.y);
    // Rime: frost only at the edges of the top face.
    float rime = (1.0 - smoothstep(1.0, 5.5, iceTop)) * (0.5 + 0.5 * g3.g);
    col = mix(under, lit, clamp(0.4 + 0.4 * rime, 0.0, 0.9) * bodyK);
    // Fracture planes: few, fine. Each is a thin bright seam, with a soft
    // sheet of light in the cell on one side of it and frost inside it.
    vec3 fr = fracture(il / 290.0 + vec2(3.7, 1.9));
    float seam = 1.0 - smoothstep(0.0015, 0.0045, fr.x);
    float sheet = exp(-fr.x * 6.0) * step(0.5, fr.y);
    col += uSky * (seam * 0.34 + sheet * 0.16) * core * bodyK * (0.35 + 0.65 * uLight.y);
    // A few trails of small bubbles, where air was caught as it froze.
    float trail = 1.0 - smoothstep(0.0, 0.012, abs(g1.g - 0.53));
    float bub = (1.0 - smoothstep(0.08, 0.2, texture(uGrain, il / 60.0).a)) * trail * core;
    col += uSky * bub * 0.3 * bodyK;
    // Wet ice is glossy: one soft band of the light above crosses the name.
    vec3 rf = reflect(dir, iceN);
    float cosi = clamp(dot(-dir, iceN), 0.0, 1.0);
    col += env(rf, 1.0) * (1.5 + 4.0 * pow(1.0 - cosi, 4.0)) * live;
    float gband = 1.0 - smoothstep(0.0, 0.11, abs(ic.y + 0.16 - ic.x * 0.3 + iceN.y * 0.6));
    col += uSky * gband * gband * 0.13 * live * core * (0.3 + 0.7 * uLight.y);
    // The arris facing the light is one crisp bright line; the opposite
    // inner edge carries a thin dark line, the bank of the lens.
    vec2 nxy = normalize(it.ba + 1e-4);
    float toLight = dot(nxy, LXY);
    float stand = 0.35 + 0.65 * uIceState.y;
    float arris = 1.0 - smoothstep(0.2, 1.5, iceTop);
    col += uSky * arris * pow(max(toLight, 0.0), 1.4) * 0.8 * live * stand;
    float inner = smoothstep(0.6, 1.6, iceTop) * (1.0 - smoothstep(2.0, 3.6, iceTop));
    col *= 1.0 - 0.4 * inner * max(-toLight, 0.0) * live * stand;
    col *= 1.0 - 0.1 * (1.0 - core) * live;
    // The edge is one device pixel wide at every stage. When the low,
    // intact letters go into the water they go as a whole: the same crisp
    // shape, clearing evenly.
    col = mix(scene, col, smoothstep(0.0, uPx, iceTop) * live);
  } else if (iceSide >= 0.0) {
    // The cut face of the block, seen at a slant: dark blue-green glass
    // with fine vertical streaks, brightest at the top arris.
    vec3 scene = col;
    vec2 il = ipt - uIce.xy;
    float streak = texture(uGrain, vec2(il.x / 9.0, il.y / 240.0)).g;
    vec3 face = mix(uIceCol * 0.34, uScatter * 2.2 + uIceCol * 0.05, 0.2 + 0.7 * iceSide);
    face *= 0.78 + 0.44 * streak;
    col = mix(col * 0.5, face, 0.62 + 0.2 * uIceState.w);
    col += uSky * (1.0 - smoothstep(0.0, 0.26, iceSide)) * 0.2 * (0.35 + 0.65 * uLight.y);
    col += (uSky * 0.06 + uRim * uNight) * smoothstep(0.8, 1.0, iceSide);
    col = mix(scene, col, uIceAlive);
  }

  // Display transform and a blue-noise-ish dither against banding.
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  float dn2 = texture(uGrain, gl_FragCoord.xy / 256.0).r;
  col += (dn2 - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;
