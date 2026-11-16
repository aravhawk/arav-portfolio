/**
 * The ending: the one place the camera looks up.
 *
 * The page is seen from straight above all the way down. Here the stream
 * runs out into open water, the camera sinks and pitches up, and a horizon
 * and a sky appear for the first and only time. The composition is v2's
 * ending screen (the part of the earlier builds worth keeping): a sky from a
 * simple physical model, three hazed ridge lines, a low sun, one calm sheet
 * of water. New here: the water is lit by a sun glitter path instead of
 * bloom, the words stand on dry land, and it renders at full resolution.
 */

export const ENDING_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;

uniform vec2 uRes;       // device px
uniform float uTime;
uniform float uProg;     // 0 looking straight down, 1 arrived
uniform float uTheme;    // 0 morning (light), 1 first light (dark)
uniform float uSunUp;    // 0..1, the sun climbing after arrival
uniform vec3 uLand;      // dry slab colour, linear
uniform vec3 uDeep;      // water body colour, linear
uniform float uHorizon;  // where the horizon rests, in v (-1 bottom .. 1 top)

const float TAN_HALF = 0.3249;   // 36 degree vertical field of view
const float H0 = 8.0;            // eye height looking down
const float H1 = 1.0;            // eye height on arrival

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }

struct Sky { vec3 zen; vec3 mid; vec3 hor; vec3 band; vec3 sun; float haze; };

Sky skyKey() {
  Sky d; // first light
  d.zen = vec3(0.011, 0.04, 0.1); d.mid = vec3(0.045, 0.095, 0.125); d.hor = vec3(0.3, 0.17, 0.07);
  d.band = vec3(2.3, 1.05, 0.22);
  Sky l; // morning
  l.zen = vec3(0.17, 0.37, 0.66); l.mid = vec3(0.46, 0.64, 0.82); l.hor = vec3(0.9, 0.88, 0.84);
  l.band = vec3(1.25, 1.0, 0.74);
  Sky s;
  s.zen = mix(l.zen, d.zen, uTheme); s.mid = mix(l.mid, d.mid, uTheme); s.hor = mix(l.hor, d.hor, uTheme);
  s.band = mix(l.band, d.band, uTheme);
  float el = mix(0.2, 0.022, uTheme) + uSunUp * mix(0.03, 0.05, uTheme);
  s.sun = normalize(vec3(sin(0.2) * cos(el), sin(el), cos(0.2) * cos(el)));
  s.haze = mix(0.6, 1.0, uTheme);
  return s;
}

vec3 skyColor(vec3 d, Sky s) {
  float h = max(d.y, 0.0);
  vec3 col = mix(s.hor, s.mid, smoothstep(0.0, 0.15, h));
  col = mix(col, s.zen, smoothstep(0.06, 0.62, h));
  vec2 a = normalize(d.xz + 1e-5);
  vec2 sa = normalize(s.sun.xz);
  float az = max(dot(a, sa), 0.0);
  // Warmth pools on the sun's side of the horizon; it is not a stripe.
  col += s.band * exp(-h * 15.0) * pow(az, 5.0) * 0.55;
  col += s.band * exp(-h * 30.0) * pow(az, 2.0) * 0.16;
  float sd = max(dot(normalize(d), s.sun), 0.0);
  col += s.band * pow(sd, 260.0) * 0.5;
  col += vec3(1.0, 0.86, 0.62) * smoothstep(0.99986, 0.99996, sd) * 9.0;
  // High thin cloud, lit from below near the sun.
  float c = fbm2(vec2(atan(d.x, d.z) * 3.2 + uTime * 0.004, h * 9.0));
  float cloud = smoothstep(0.52, 0.86, c) * smoothstep(0.03, 0.22, h) * (1.0 - smoothstep(0.4, 0.8, h));
  col = mix(col, col * 0.78 + s.band * 0.05 * pow(az, 3.0), cloud * 0.5);
  return col;
}

// Three ridge lines as silhouettes in elevation over azimuth. Each drops
// away where the sun comes up, which is what opens the bright gap.
vec3 withRidges(vec3 col, vec3 d, Sky s) {
  float az = atan(d.x, d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float sunAz = atan(s.sun.x, s.sun.z);
  float gap = mix(0.22, 1.0, smoothstep(0.05, 0.42, abs(az - sunAz)));
  float aa = fwidth(el) * 1.5 + 1e-4;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float f = mix(5.0, 11.0, fi / 2.0);
    float r = n1(az * f + 7.3 * fi) * 0.6 + n1(az * f * 2.3 + 3.1 * fi) * 0.28 + n1(az * f * 5.1 + fi) * 0.12;
    r = 1.0 - abs(r * 2.0 - 1.0) * 0.55;
    float height = mix(0.034, 0.014, fi / 2.0) * (0.35 + 0.65 * r) * gap;
    float m = 1.0 - smoothstep(height - aa, height + aa, el);
    float dark = mix(0.5, 0.9, fi / 2.0);
    vec3 ridge = mix(col, s.hor * (1.0 - dark) * 0.5 + s.band * 0.012, dark);
    // Haze gathers at the foot of each ridge.
    ridge = mix(ridge, s.hor, s.haze * 0.35 * (1.0 - smoothstep(0.0, height + 1e-4, el)) * (1.0 - fi * 0.3));
    col = mix(col, ridge, m * step(0.0, el + 0.002));
  }
  return col;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  Sky s = skyKey();

  // The move: sink and pitch up, eased so it settles.
  float p = uProg;
  float e = p * p * (3.0 - 2.0 * p);
  float pitchFinal = atan(-uHorizon * TAN_HALF);
  float pitch = mix(-1.5707963, pitchFinal, e);
  float eye = mix(H0, H1, e * e);
  vec3 d = normalize(vec3(uv.x * aspect * TAN_HALF, uv.y * TAN_HALF, 1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp + d.z * sp, -d.y * sp + d.z * cp);

  // The shoreline is one straight edge in the world: at the start it reads
  // as the bank the page has had all along, at the end it runs to the
  // vanishing point.
  float shoreX = 0.19 * H0 * TAN_HALF * aspect;

  vec3 col;
  if (d.y >= 0.0) {
    col = withRidges(skyColor(d, s), d, s);
  } else {
    float t = eye / -d.y;
    vec3 P = vec3(d.x * t, 0.0, d.z * t);
    float dist = length(P.xz);
    float fog = 1.0 - exp(-dist * 0.012 * s.haze);
    float edge = P.x - shoreX;
    float pix = t * TAN_HALF * 2.0 / uRes.y;   // world size of a pixel here
    if (edge < 0.0) {
      // Dry land: the same slab, now catching low light.
      float grain = hash21(floor(P.xz * 90.0)) - 0.5;
      float sunny = max(s.sun.y, 0.0) * 2.2 + 0.25;
      vec3 land = uLand * (1.0 + grain * 0.03) * mix(1.0, 0.75 + 0.5 * sunny, 0.5);
      // Warm grazing light from the sun's side.
      land += s.band * mix(0.003, 0.0022, uTheme) * smoothstep(-5.0, 0.0, edge) * e;
      // The chamfer at the water's edge.
      float ch = smoothstep(-0.05 - pix * 2.0, 0.0, edge);
      land *= 1.0 + 0.16 * ch;
      col = mix(land, s.hor, fog * 0.9);
    } else {
      // Water: ripples compress with distance; reflect the sky; add the body.
      vec2 q = P.xz;
      float calm = 1.0 / (1.0 + dist * 0.07);
      float tt = uTime * 0.32;
      vec2 g = vec2(
        fbm2(q * 1.7 + vec2(tt, 0.3 * tt)) - fbm2(q * 1.7 + vec2(tt, 0.3 * tt) + vec2(0.11, 0.0)),
        fbm2(q * 1.7 + vec2(tt, 0.3 * tt)) - fbm2(q * 1.7 + vec2(tt, 0.3 * tt) + vec2(0.0, 0.11)));
      g += 0.5 * vec2(
        n2(q * 5.3 - vec2(0.2 * tt, tt)) - n2(q * 5.3 - vec2(0.2 * tt, tt) + vec2(0.06, 0.0)),
        n2(q * 5.3 - vec2(0.2 * tt, tt)) - n2(q * 5.3 - vec2(0.2 * tt, tt) + vec2(0.0, 0.06)));
      vec3 n = normalize(vec3(g.x * 1.5 * calm, 1.0, g.y * 1.5 * calm));
      vec3 r = reflect(d, n);
      r.y = abs(r.y);
      float cosi = clamp(dot(-d, n), 0.0, 1.0);
      float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
      vec3 refl = withRidges(skyColor(r, s), r, s);
      // Seen from above the water shows its depth; at a glancing angle, the sky.
      vec3 body = uDeep * (0.5 + 0.5 * max(s.sun.y * 3.0, 0.3));
      // From straight above, the same caustic light the page's water has.
      float cn = fbm2(q * 2.6 + vec2(tt * 0.4, -tt * 0.3));
      float cl = 1.0 - abs(cn * 2.0 - 1.0);
      body *= 1.0 + (1.0 - e) * (pow(cl, 5.0) * 2.2 - 0.25);
      col = mix(body, refl, clamp(fres + 0.06, 0.0, 1.0));
      // Sun glitter: a broken streak toward the sun, not a bloom disc.
      float sd = max(dot(r, s.sun), 0.0);
      col += vec3(1.0, 0.88, 0.66) * (pow(sd, 900.0) * 14.0 + pow(sd, 90.0) * 0.5) * mix(0.55, 1.0, uTheme);
      // A dark wet seam and a bright lip where water meets the slab.
      float seam = 1.0 - smoothstep(0.0, 0.05 + pix * 3.0, edge);
      col *= 1.0 - 0.45 * seam;
      col = mix(col, s.hor, fog);
    }
  }

  // Finish as a photograph would: gentle vignette, filmic roll-off, dither.
  vec2 c = vUv - 0.5;
  col *= 1.0 - dot(c, c) * 0.55;
  col = aces(col * 1.12);
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0 * 1.6;
  o = vec4(col, 1.0);
}`;
