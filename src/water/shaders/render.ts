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

import { ICE_FIELD } from './ice';

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
uniform sampler2D uCurv;   // curvature of the detail field: xx, yy, xy
uniform sampler2D uGrain;
uniform sampler2D uHeat;   // warmth the pointer left on the sheet, over the lake's own rect
uniform float uIceH;       // how thick the sheet stands above the water, px
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
${ICE_FIELD}
vec2 simUv(vec2 w) { return vec2(w.x / (uSim.z * uSim.y), (w.y - uSim.x) / (uSim.w * uSim.y)); }

/**
 * The bed field with a natural shoreline: slow noise moves the bank in and
 * out by about two px, far inside the 14 px that text keeps from water.
 */
float bedShore;   // what the last bedAt moved the bank by
vec4 bedAt(vec2 w) {
  vec4 b = texture(uBedA, bedUv(w));
  bedShore = (texture(uGrain, w / 800.0).g - 0.5) * 7.0;
  b.r += bedShore;
  b.g += bedShore;
  return b;
}

/**
 * The distance the bed's depth is read from: the true one at the bank, the
 * smoothed one away from it, so the floor has no ridge where two banks are
 * equally near and no facets round a corner.
 */
float bedSoft(vec4 b) { return mix(b.r, b.g, smoothstep(3.0, 16.0, -b.r)); }

/**
 * How deep the bed lies at a distance from the bank. It shelves smoothly:
 * steep at first, then easing, and it never stops falling, so wide water is
 * deepest in its middle and a narrow channel gets a U section.
 */
float bedDepth(float sd, out float slope) {
  float d = max(-sd, 0.0) / uScale;
  // A shelf by the bank, then the floor. A narrow run never gets past the
  // shelf, so it stays shallow and its bed shows; a pool or a basin has
  // room to fall away to deep water in its middle.
  float e = exp(-d / 12.0);
  float wide = smoothstep(15.0, 90.0, d);
  slope = (2.4 * e + 0.5 * wide) / uScale;
  return 3.0 + 30.0 * (1.0 - e) + 0.95 * d * wide;
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
    // By night the stone is seen by raking light: its grain stands out.
    rel += vec2(hx - h0, hy - h0) * (0.42 + 0.75 * uNight);
  }
  // Night: the slab is lit unevenly along the page, as a floor is by a few
  // far lamps, so the ground has light and dark country of its own.
  col *= 1.0 + uNight * (0.7 * (cloud - 0.5) + 0.36 * (mott - 0.5));
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
  // Night: the water's glow spills a little cool light onto the stone
  // beside it, and the grain there catches it.
  float spill = exp(-max(sd, 0.0) / 34.0) * uNight;
  col += uRim * spill * (0.13 + 0.45 * max(dot(n, hv), 0.0) + 2.5 * gloss) * (0.75 + 0.5 * g0.r);
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
  // The nearest cell's own neighbours are enough for a hairline: the rare
  // wall they miss is one this picture never draws.
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + hash2(n + g) - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(dr)));
    }
  }
  return vec3(md, hash2(n + mg));
}

/**
 * How much wind-blown snow lies at a point of the sheet (given in the
 * wind's own frame). Long slow shapes carry the drifts; two finer layers
 * give their edges a ragged, hard line: snow lying on ice ends at an edge.
 */
float snowAt(vec2 wl, float big) {
  float mid = texture(uGrain, wl / vec2(2300.0, 520.0) + vec2(0.37, 0.11)).g;
  float fin = texture(uGrain, wl / vec2(980.0, 130.0) + vec2(0.71, 0.29)).g;
  float tooth = texture(uGrain, wl / vec2(330.0, 50.0) + vec2(0.13, 0.57)).g;
  return big * 0.48 + mid * 0.33 + fin * 0.14 + tooth * 0.05;
}

/**
 * The top of the sheet: lake ice seen from above, in three hard-edged
 * layers. Clear ice, dark, where you sense the water under it. A thin
 * dusting of snow over that. And drifts the wind has packed: white, raised
 * enough to catch the key light on one edge and drop a hairline of shadow
 * off the other. Pressure cracks cross all of it: a dark fissure with a
 * refrozen seam on either side.
 *
 * By night it is the same sheet under a low cool light: the clear ice is
 * near black over black water and takes up most of the lake, and the drifts
 * and seams are the pale accents.
 */
vec3 iceTop(vec2 p, vec2 il, vec3 cr, float f0, float shore, vec3 dir, vec2 scr) {
  // The wind's direction, a little off the page's axes.
  const mat2 RW = mat2(0.9563, -0.2924, 0.2924, 0.9563);
  vec2 wl = RW * il;
  float big = texture(uGrain, wl / vec2(6100.0, 2100.0)).g;
  vec2 huv = vec2(p.x / uView.x, (p.y - uLake.x) / max(uLake.y - uLake.x, 1.0));
  float heat = texture(uHeat, huv).r;
  // Ice is thinner and wetter by the bank, in a lead, under a warm hand
  // and, once the melt has begun, everywhere.
  float bank = 1.0 - smoothstep(3.0, 70.0, -shore);
  float lane = exp(-cr.x / 8.0);
  float rim = 1.0 - smoothstep(0.0, 22.0, -f0);
  float wet = clamp(uLake.z * 0.75 + heat * 0.9 + bank * 0.35 + rim * uLake.z * 0.6, 0.0, 1.0);
  // Less snow lies where the ice is wet, and less by night, when the dark
  // ice is the ground of the picture.
  float less = wet * 0.14 + lane * 0.06 + uNight * 0.075;
  float lvl = snowAt(wl, big) - less;
  float drift = smoothstep(0.512, 0.524, lvl);
  float dust = smoothstep(0.438, 0.449, lvl) * (1.0 - 0.5 * wet);
  // The same drift, a little way toward the light: where the two differ is
  // the drift's lit edge on one side and its shadow on the other.
  float lip = 0.0;
  float lee = 0.0;
  if (uQuality > 0.5) {
    float toward = smoothstep(0.512, 0.524, snowAt(RW * (il + LXY * 2.2), big) - less);
    lip = clamp(drift - toward, 0.0, 1.0);
    lee = clamp(toward - drift, 0.0, 1.0);
  }
  // Relief: the drifts are low, but the key light finds them, and a low
  // light by night finds them more.
  vec2 rel = (texture(uDetail, wl / vec2(1500.0, 420.0)).gb - 0.5) * 0.5;
  vec4 g = texture(uGrain, il / 128.0);
  if (uQuality > 0.5) {
    float hx = texture(uGrain, (il + vec2(0.5, 0.0)) / 128.0).a;
    float hy = texture(uGrain, (il + vec2(0.0, 0.5)) / 128.0).a;
    rel += vec2(hx - g.a, hy - g.a) * 0.16 * (0.3 + 0.7 * drift);
  }
  rel *= 1.0 + 0.9 * uNight;
  vec3 n = normalize(vec3(-rel, 1.0));
  float lit = landLight(n);
  // Clear ice: dark, blue-green, and what is under it shows a little: the
  // depth of the water and, faintly, the light moving on its bed.
  float under = texture(uDetail, p / 700.0 + vec2(0.004, 0.003) * uTime).r;
  float netU = texture(uDetail, p / 230.0 + vec2(0.007, 0.004) * uTime).a;
  vec3 clear = uIceCol * mix(vec3(0.21, 0.44, 0.54), vec3(0.085, 0.16, 0.225), uNight) * (0.78 + 0.34 * under) + uScatter * mix(2.0, 0.9, uNight);
  clear += (uSky * 0.05 * (1.0 - uNight) + uRim * 0.9 * uNight) * smoothstep(0.22, 0.6, netU) * (1.0 - dust);
  vec3 white = uIceCol * (0.97 + 0.06 * (big - 0.5)) * lit * (1.0 - 0.2 * uNight);
  // Windows of clear ice are deepest in their middle; the dusting thickens
  // toward the drift it blew off. Soft tones, under hard edges.
  clear *= 1.0 - 0.3 * smoothstep(0.438, 0.35, lvl);
  vec3 col = mix(clear, white, mix(0.42 + 0.34 * smoothstep(0.445, 0.512, lvl), 0.1, uNight) * dust);
  col = mix(col, white, drift);
  col = mix(col, uIceCol * 1.07, lip * 0.7);
  col *= 1.0 - lee * mix(0.2, 0.42, uNight);
  // Frost grain: fine and sharp on the snow, quieter on clear ice.
  col *= 1.0 + (g.r - 0.5) * mix(0.03, 0.085, drift) + (g.a - 0.45) * 0.05;
  if (uQuality > 0.5 && drift < 0.99) {
    // Hairline cracks inside the clear ice, in a few places only.
    vec3 fr = fracture(il / 210.0 + vec2(3.7, 1.9));
    float hair = (1.0 - smoothstep(0.0, 0.006, fr.x)) * step(0.55, fr.y) * (1.0 - drift);
    col = mix(col, uIceCol * 1.04, hair * mix(0.55, 0.3, uNight));
  }
  // A pressure crack is a real fissure: a hairline of shadow down its
  // middle, refrozen white on either side of it, brighter as meltwater
  // finds it, and a faint sheet of light in the ice beside it.
  float seam = 1.0 - smoothstep(1.5, 2.7, cr.x);
  float plane = exp(-cr.x / 3.2) * (0.5 + 0.5 * step(0.5, cr.y));
  col = mix(col, uIceCol * (1.06 + 0.1 * uLake.z), clamp(seam * 0.92 + plane * 0.3, 0.0, 1.0));
  col *= 1.0 - mix(0.5, 0.62, uNight) * (1.0 - smoothstep(0.3, 0.85, cr.x));
  // One soft band of the light overhead lies across the sheet; wet and
  // clear ice carry more of it than snow does. By night it is faint.
  vec3 rf = reflect(dir, normalize(vec3(-rel * 0.3, 1.0)));
  float gloss = 1.0 - 0.75 * max(drift, dust * 0.6);
  float dim = 1.0 - 0.72 * uNight;
  col += env(rf, 1.0) * (0.6 + 2.4 * gloss) * dim;
  float band = 1.0 - smoothstep(0.0, 0.2, abs(scr.y - 0.5 - (scr.x - 0.5) * 0.07 + rel.y * 0.25));
  col += uSky * band * band * (0.012 + 0.05 * gloss) * (0.3 + 0.7 * uLight.y) * dim;
  // The lip of a cut: a hair of snow, then the edge itself. By night it is
  // the line of light that draws the letters.
  float edge = 1.0 - smoothstep(0.0, 2.2, -f0);
  col *= 1.0 + 0.07 * edge;
  col = mix(col, uIceCol * 1.1, uNight * 0.75 * (1.0 - smoothstep(0.0, 1.5, -f0)));
  // The room's light falls off across the sheet as it does across the slab.
  float fall = length((scr - vec2(0.2, 0.08)) * vec2(1.0, 0.82));
  col *= 1.0 + mix(0.12, 0.3, uNight) * (0.42 - smoothstep(0.0, 1.2, fall));
  return col;
}

/**
 * A cut face of the sheet: dark glass with one crisp bright line where the
 * top turns over (the arris), darker toward the waterline. It is plainly
 * darker than the top of the sheet, so a small counter reads as a hole with
 * a wall in it and not as a second outline.
 * s: 0 at the arris, 1 at the waterline. tall: the face's height on screen px.
 */
vec3 iceCut(vec2 p, float s, float tall) {
  float streak = texture(uGrain, vec2(p.x / 7.0, p.y / 300.0)).g;
  vec3 top = uIceCol * mix(vec3(0.115, 0.34, 0.43), vec3(0.03, 0.09, 0.125), uNight) + uScatter * mix(1.5, 0.8, uNight);
  vec3 foot = uIceCol * mix(vec3(0.035, 0.15, 0.205), vec3(0.008, 0.03, 0.045), uNight) + uScatter * mix(1.2, 0.6, uNight);
  vec3 face = mix(top, foot, smoothstep(0.1, 0.92, s)) * (0.8 + 0.4 * streak);
  // The arris: about one px, whatever the face's height.
  float w = max(uPx, 0.8) / max(tall, 1.0);
  face = mix(face, uIceCol * vec3(0.88, 0.98, 1.0) * (1.0 + 0.12 * uNight), (1.0 - smoothstep(w * 0.7, w * 1.5, s)) * 0.92);
  // The waterline: a thin dark wet line at the foot, hard-edged.
  face *= 1.0 - 0.55 * smoothstep(0.84, 0.9, s);
  return face;
}

void main() {
  vec2 scr = vec2(vUv.x, 1.0 - vUv.y);
  vec2 p = vec2(scr.x * uView.x, uTop + scr.y * uView.y);
  vec2 tilt = (p - uCam.xy) / uCam.z + OBLIQUE;
  vec3 dir = normalize(vec3(tilt, -1.0));
  float aa = uPx * 0.75;

  vec2 q = p;
  vec4 b0 = bedAt(q);
  float sd0 = b0.r;

  // ---- the ice sheet: decided first, because it hides what is under it.
  // Its top is level with the slab. Where it is cut, the camera's slant
  // shows the far face of the cut, and the sheet shades the water below.
  float aIce = 0.0;        // how much of this pixel is the top of the sheet
  float aCut = 0.0;        // how much is a cut face
  float cutS = 0.0;        // 0 at the top arris, 1 at the waterline
  float iceShade = 0.0;
  float f0 = 1e3;
  vec3 cr = vec3(1e3, 0.0, 0.0);
  vec2 il = vec2(0.0);
  bool hasIce = uIce.z > 0.0 && p.y > uLake.x - 60.0 && p.y < uLake.y + 60.0 && sd0 < 30.0;
  if (hasIce) {
    f0 = iceF(p, sd0, cr, il);
    aIce = 1.0 - smoothstep(-aa, aa, f0);
    if (aIce < 1.0) {
      vec3 c1;
      vec2 i1;
      vec2 pf = p + tilt * uIceH;
      float f1 = iceF(pf, bedAt(pf).r, c1, i1);
      aCut = (1.0 - aIce) * (1.0 - smoothstep(-aa, aa, f1));
      cutS = clamp(f0 / max(f0 - f1, 1e-3), 0.0, 1.0);
      if (aCut < 1.0 && uQuality > 0.5) {
        vec2 ps = pf + L.xy / L.z * uIceH * 0.5;
        float fs = iceF(ps, bedAt(ps).r, c1, i1);
        // A crisp edge, and inside it the shade deepens toward the wall
        // that throws it: a shadow in a hole, not a band beside an outline.
        iceShade = (1.0 - smoothstep(-1.0, 1.0, fs)) * (0.5 + 0.5 * smoothstep(0.0, uIceH * 0.5, -fs));
      }
    }
  }

  if (uMode == 1) {
    float m = step(sd0, 0.75);
    o = vec4(m, m, m, 1.0);
    return;
  }

  float aLand = smoothstep(-aa, aa, sd0);
  vec3 col = vec3(0.0);
  if (aLand > 0.0) col = landColor(q, sd0, b0.ba, scr) * aLand;
  // Under the whole sheet there is nothing to work out: the ice hides it.
  if (aLand < 1.0 && aIce < 0.999) {
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
      const mat2 R0 = mat2(0.3090, 0.9511, -0.9511, 0.3090);
      // No two reaches show the same water: the moving detail is bent by
      // one large slow warp and one smaller one, so the net never lines up
      // with itself from one part of the page to the next.
      vec4 reach = texture(uDetail, pw / 2900.0 + vec2(0.13, 0.41));
      // Sines, not a texture: a magnified 8 bit warp would step.
      vec2 warp = vec2(
        sin(dot(pw, vec2(0.0021, 0.0027)) + 1.3) + 0.6 * sin(dot(pw, vec2(-0.0043, 0.0019)) + 4.1),
        sin(dot(pw, vec2(-0.0024, 0.0031)) + 2.9) + 0.6 * sin(dot(pw, vec2(0.0037, 0.0036)) + 0.7)) * 0.8
        + vec2(sin(dot(pw, vec2(0.011, -0.007)) + 0.4), sin(dot(pw, vec2(0.006, 0.012)) + 5.2)) * 0.16;
      vec2 duv = pw / DS + warp;
      // A run is water that is going somewhere: the channel's own current.
      float runK = smoothstep(0.5, 0.85, length(flow)) * (1.0 - smoothstep(34.0, 80.0, -bw.r));
      // Where the current turns sharply it carries the pattern less far.
      // Carried the whole way, the pattern is wrung round the turn and shows
      // as lines fanning out of the inside of a sharp bend.
      float calm = 1.0;
      if (runK > 0.01) {
        // (Looked for along the current, ahead and behind.)
        vec2 fd = flow / max(length(flow), 0.02) * 28.0;
        vec2 fa2 = texture(uBedB, bedUv(pw + fd)).rg - 0.5019608;
        vec2 fb2 = texture(uBedB, bedUv(pw - fd)).rg - 0.5019608;
        float la = length(fa2), lb = length(fb2);
        float wring = 1.6 * length(fa2 / max(la, 0.02) - fb2 / max(lb, 0.02)) * smoothstep(0.08, 0.22, min(la, lb));
        calm = 1.0 - 0.94 * smoothstep(0.3, 1.0, wring);
      }
      vec2 carried = flow * uFlowSpeed * calm + (vel - flow * uFlowSpeed);
      vec2 uv0 = duv - carried * (ph0 * 2.6) / DS;
      vec2 uv1 = duv - carried * (ph1 * 2.6) / DS + vec2(0.37, 0.61);
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
      float fa = 0.35 + 0.65 * speed + 0.35 * runK;
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
      float d0p = bedDepth(bedSoft(bw), sl0);
      vec2 pb = pw + r.xy / max(-r.z, 0.2) * d0p;
      vec4 bb = bedAt(pb);
      float sl;
      float depth = bedDepth(min(bedSoft(bb), -0.01), sl);
      // The mouth of the stream is a wide shoal, not a deep lake: sand bars
      // lie a little under the surface, so the bed and the light on it show
      // all the way across.
      float shoalK = smoothstep(uShoal - 30.0, uShoal + 150.0, pb.y);
      if (shoalK > 0.0) {
        float bars = texture(uDetail, vec2(pb.x / 2100.0, pb.y / 1300.0)).r;
        depth = mix(depth, min(depth, 30.0 + 24.0 * bars), shoalK);
      }
      // The lake is a wide basin, not a pit: its floor lies where light
      // still reaches it, so the net shows on the bed all the way across.
      float lakeK = smoothstep(uLake.y + 30.0, uLake.y - 90.0, pb.y);
      if (lakeK > 0.0) {
        float floorH = texture(uDetail, pb / 1700.0 + 0.4).r;
        depth = mix(depth, min(depth, 70.0 + 34.0 * floorH), lakeK);
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
      float shade = max(bankShade, iceShade);

      // ---- the bed: silt, small stones and faint ripple marks, so the
      // water is plainly a layer over a floor.
      vec4 gb = texture(uGrain, pb / 256.0);
      vec4 gs = texture(uGrain, pb / 330.0);
      float marks = sin(dot(pb, vec2(0.34, 0.94)) / 5.2 + gs.g * 11.0);
      vec3 bed = uBed * (1.0 + (gb.r - 0.5) * uGrainAmt.x * 0.5 + (gs.b - 0.42) * 0.17 + (gb.a - 0.4) * 0.12 + marks * 0.06 * shallow);
      // The floor's own slope, from the smoothed field: it eases to level in
      // the middle of the water instead of turning over along a line.
      float s0 = bedSoft(vec4(bb.r - bedShore, bb.g - bedShore, 0.0, 0.0));
      vec2 fall = vec2(bedSoft(texture(uBedA, bedUv(pb + vec2(4.0, 0.0)))), bedSoft(texture(uBedA, bedUv(pb + vec2(0.0, 4.0))))) - s0;
      fall = fall / 4.0;
      fall /= max(length(fall), 1.0);
      vec3 nb = normalize(vec3(-fall * sl * 0.55, 1.0));
      vec3 lr = normalize(vec3(L.xy * 0.72, L.z));
      float direct = max(dot(nb, lr), 0.0) / lr.z;
      // The bank on the light's side shades the bed below it.
      float shadow = 1.0;
      if (uQuality > 0.5) {
        float reach = (min(depth, 70.0) + FREEBOARD) * 0.62;
        float ssd = texture(uBedA, bedUv(pb + LXY * reach)).r;
        shadow = 1.0 - 0.62 * smoothstep(-3.0, 7.0, ssd);
        shadow *= 1.0 - 0.7 * iceShade;
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
        t.xy -= vec2(gx1 - gx0, gy1 - gy0) * 3.2;
        // The net is tighter in one reach and looser in the next.
        float f = uLight.z * mix(0.46, 0.8, dn) * (0.78 + 0.5 * reach.r);
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
      // Under the night sheet the water body is darker than in the open
      // stream: the ice keeps the sky off it. It is the dark the lit net
      // and the lit cut are seen against. It eases off as the sheet opens.
      float underIce = uNight * lakeK * step(0.5, uIce.z) * (1.0 - smoothstep(0.1, 0.55, uIceA.z));
      water *= 1.0 - 0.46 * underIce;
      // Night: the net is what lights the water. Cool cyan-white, strongest
      // in the shallows by the banks, gone in the deep.
      water += uRim * nfil * 36.0 * uNight * (0.4 + 0.6 * shadow) * (0.45 + 0.55 * trans.g) * (1.0 - 0.4 * underIce);
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
      // A soft sheen on ripple faces turned toward the key light: shading,
      // wide and graded, never a line.
      float face = dot(slope, -LXY);
      float glint = smoothstep(0.05, 0.3, face) * 0.3;
      // A wave is seen the way real ripples are: the face turned to the
      // light is brighter, the far face darker. No layer is drawn over it.
      float wf = dot(wv.ba, -LXY) * 9.0;
      water *= 1.0 + clamp(wf * 3.4, -0.2, 0.36);
      water += sky * (1.0 + fres * 6.0) * (1.0 + clamp(wf * 8.0, -0.4, 1.0)) + uSky * glint * 0.11 * uLight.w * (1.0 - 0.8 * shade);
      // Waterline: a dark wet seam where day water meets a bank; by night a
      // cool rim of light instead.
      float line = smoothstep(-2.6, 0.0, bw.r);
      // The bank that faces the light is lit where the water meets it: a
      // thin bright line on that side, the bank's shadow on the other.
      float toLight = max(dot(bw.ba, -LXY), 0.0);
      float lite = smoothstep(-3.4, -1.2, bw.r) * (1.0 - smoothstep(-1.0, 0.4, bw.r)) * toLight * (1.0 - shade);
      water *= 1.0 - 0.22 * line * (1.0 - uNight) * (1.0 - toLight);
      water += uSky * lite * 0.34 * uLight.y * (1.0 - uNight);
      water += uRim * uNight * (line * 2.2 + smoothstep(-9.0, 0.0, bw.r) * 0.5) * (0.55 + 1.1 * toLight);
      // ---- the current, seen: long fine threads of light that ride a run,
      // lying along it (they keep their distance from the bank, as drift
      // lines do) and carried down it. Still water has none.
      if (runK > 0.01) {
        // The threads on one side of a run are not the mirror of the other
        // side's, so they never close on its middle like a seam.
        float side = step(0.0, vel.x * bw.a - vel.y * bw.b);
        float lane = -bw.r + (reach.a - 0.5) * 9.0 + side * 311.0;
        float th = texture(uGrain, vec2(lane / 46.0, 0.37 + reach.r * 0.6)).g;
        float th2 = texture(uGrain, vec2(lane / 19.0 + 0.5, 0.71 + reach.g * 0.6)).g;
        float lines = smoothstep(0.62, 0.72, th) * 0.7 + smoothstep(0.68, 0.76, th2) * 0.45;
        // Broken into dashes by a pattern the current carries, in two
        // phases cross-faded so it never stretches.
        vec2 su = pw / 210.0 + warp * 0.3;
        float carry = 5.2 / 210.0;
        float b0 = texture(uGrain, su - carried * (ph0 * carry)).b;
        float b1 = texture(uGrain, su - carried * (ph1 * carry) + vec2(0.53, 0.17)).b;
        float dash = smoothstep(0.46, 0.62, mix(b0, b1, wphase));
        float thread = min(lines, 1.0) * dash * runK * smoothstep(3.0, 9.0, -bw.r) * smoothstep(0.4, 0.75, length(vec2(dFdx(bw.r), dFdy(bw.r))) / uPx);
        water += (uSky * 0.24 * (1.0 - uNight) + uRim * 3.2 * uNight + water * 0.6) * thread * (1.0 - 0.6 * shade);
      }
      cut += water * (1.0 - aWall);
    }
    col += cut * (1.0 - aLand);
  }

  // ---- the sheet goes on last
  if (aCut > 0.0) col = mix(col, iceCut(p, cutS, length(tilt) * uIceH), aCut);
  if (aIce > 0.0) col = mix(col, iceTop(p, il, cr, f0, sd0, dir, scr), aIce);

  // Display transform and a blue-noise-ish dither against banding.
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  float dn2 = texture(uGrain, gl_FragCoord.xy / 256.0).r;
  col += (dn2 - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;
