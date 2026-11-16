/**
 * The ending: the one place the camera looks up.
 *
 * The page is seen from above all the way down. Here the stream runs out
 * into open water, the camera sinks and pitches up, and a horizon and a sky
 * appear for the first and only time. The composition is v2's ending screen
 * (the part of the earlier builds worth keeping): one picture, the words set
 * in it, a sky from a simple physical model, hazed ridge lines mirrored in
 * calm water, a low sun. New here: the sun lays a glitter path on the water
 * instead of a bloom smear, the side the words stand on is kept calm and in
 * shade so they always read, and it renders at full resolution.
 */

export const ENDING_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;

uniform vec2 uRes;       // device px
uniform float uTime;
uniform float uProg;     // 0 looking straight down, 1 arrived
uniform float uTheme;    // 0 blue hour (light), 1 first light (dark)
uniform float uSunUp;    // 0..1, the sun climbing after arrival
uniform vec3 uShallow;   // the page's water seen from above, linear
uniform vec3 uDeep;      // open water body colour, linear
uniform float uHorizon;  // where the horizon rests, in v (-1 bottom .. 1 top)
uniform float uSunAz;    // the sun's bearing, radians right of straight ahead
uniform float uCalm;     // u (0..1) left of which the water is kept calm for the words

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
  d.zen = vec3(0.007, 0.027, 0.085); d.mid = vec3(0.036, 0.08, 0.14); d.hor = vec3(0.4, 0.2, 0.075);
  d.band = vec3(2.6, 1.12, 0.24);
  Sky l; // the blue hour, just before the sun
  l.zen = vec3(0.016, 0.06, 0.21); l.mid = vec3(0.06, 0.14, 0.36); l.hor = vec3(0.6, 0.34, 0.3);
  l.band = vec3(1.7, 0.72, 0.5);
  Sky s;
  s.zen = mix(l.zen, d.zen, uTheme); s.mid = mix(l.mid, d.mid, uTheme); s.hor = mix(l.hor, d.hor, uTheme);
  s.band = mix(l.band, d.band, uTheme);
  float el = mix(0.02, 0.012, uTheme) + uSunUp * mix(0.04, 0.045, uTheme);
  s.sun = normalize(vec3(sin(uSunAz) * cos(el), sin(el), cos(uSunAz) * cos(el)));
  s.haze = mix(0.85, 1.0, uTheme);
  return s;
}

vec3 skyColor(vec3 d, Sky s) {
  float h = max(d.y, 0.0);
  vec3 col = mix(s.hor, s.mid, smoothstep(0.0, 0.17, h));
  col = mix(col, s.zen, smoothstep(0.07, 0.6, h));
  vec2 a = normalize(d.xz + 1e-5);
  vec2 sa = normalize(s.sun.xz);
  float az = max(dot(a, sa), 0.0);
  // Warmth pools on the sun's side of the horizon; it is not a stripe.
  col += s.band * exp(-h * 15.0) * pow(az, 5.0) * 0.5;
  col += s.band * exp(-h * 30.0) * pow(az, 2.0) * 0.14;
  // The sun: a soft disc inside two wide skirts of glow.
  float sd = max(dot(normalize(d), s.sun), 0.0);
  col += s.band * (pow(sd, 9.0) * 0.07 + pow(sd, 60.0) * 0.2 + pow(sd, 420.0) * 0.55);
  col += vec3(1.0, 0.9, 0.7) * smoothstep(0.99972, 0.99995, sd) * 7.0;
  // High thin cloud, lit from below near the sun.
  float c = fbm2(vec2(atan(d.x, d.z) * 3.2 + uTime * 0.004, h * 9.0));
  float cloud = smoothstep(0.5, 0.86, c) * smoothstep(0.03, 0.2, h) * (1.0 - smoothstep(0.4, 0.8, h));
  col = mix(col, col * 0.8 + s.band * 0.07 * pow(az, 3.0), cloud * 0.55);
  return col;
}

// Four ridge lines as silhouettes in elevation over azimuth, nearest last.
// Each drops away where the sun comes up, which opens the bright gap, and
// each stands in more haze than the one in front of it.
vec3 withRidges(vec3 col, vec3 d, Sky s) {
  float az = atan(d.x, d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float sunAz = atan(s.sun.x, s.sun.z);
  float off = abs(az - sunAz);
  float gap = mix(0.16, 1.0, smoothstep(0.04, 0.5, off));
  float aa = fwidth(el) * 1.5 + 1e-4;
  for (int i = 0; i < 4; i++) {
    float near = float(i) / 3.0;
    float f = mix(4.2, 9.0, near);
    float x = az * f + 9.7 * float(i);
    // Ridged noise: peaks are creases, not bumps.
    float r = (1.0 - abs(n1(x) * 2.0 - 1.0)) * 0.56 + (1.0 - abs(n1(x * 2.7 + 3.1) * 2.0 - 1.0)) * 0.27
      + (1.0 - abs(n1(x * 6.3 + 1.7) * 2.0 - 1.0)) * 0.12 + n1(x * 17.0) * 0.05;
    float height = mix(0.072, 0.03, near) * (0.22 + 0.78 * r * r) * gap;
    float m = 1.0 - smoothstep(height - aa, height + aa, el);
    vec3 rock = mix(s.mid * 0.5 + s.hor * 0.1, s.zen * 0.26, near);
    // Light from behind picks out the far crests next to the sun.
    rock += s.band * 0.05 * (1.0 - near) * exp(-off * 3.5);
    // Haze gathers at the foot of each ridge.
    float foot = 1.0 - smoothstep(0.0, height + 1e-4, el);
    rock = mix(rock, s.hor * 0.8, s.haze * (0.5 - 0.3 * near) * foot);
    col = mix(col, rock, m * step(0.0, el + 0.002));
  }
  return col;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  Sky s = skyKey();

  // The move: sink and pitch up, eased so it settles.
  float p = clamp(uProg / 0.82, 0.0, 1.0);
  float e = p * p * (3.0 - 2.0 * p);
  float pitchFinal = atan(-uHorizon * TAN_HALF);
  // It starts already lifting: the first frame is water in perspective.
  float pitch = mix(-1.0, pitchFinal, e);
  float eye = mix(H0, H1, e * e);
  vec3 d = normalize(vec3(uv.x * aspect * TAN_HALF, uv.y * TAN_HALF, 1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp + d.z * sp, -d.y * sp + d.z * cp);

  // The side the words stand on: in the lee, calm and a little shaded.
  float lee = (1.0 - smoothstep(uCalm - 0.16, uCalm + 0.14, vUv.x)) * e;

  vec3 col;
  if (d.y >= 0.0) {
    col = withRidges(skyColor(d, s), d, s);
  } else {
    float t = eye / -d.y;
    vec3 P = vec3(d.x * t, 0.0, d.z * t);
    float dist = length(P.xz);
    float fog = 1.0 - exp(-dist * 0.011 * s.haze);
    // Water: ripples compress with distance; reflect the sky; add the body.
    vec2 q = P.xz;
    float calm = (1.0 / (1.0 + dist * 0.07)) * (1.0 - 0.55 * lee);
    float tt = uTime * 0.32;
    vec2 g = vec2(
      fbm2(q * 1.7 + vec2(tt, 0.3 * tt)) - fbm2(q * 1.7 + vec2(tt, 0.3 * tt) + vec2(0.11, 0.0)),
      fbm2(q * 1.7 + vec2(tt, 0.3 * tt)) - fbm2(q * 1.7 + vec2(tt, 0.3 * tt) + vec2(0.0, 0.11)));
    g += 0.5 * vec2(
      n2(q * 5.3 - vec2(0.2 * tt, tt)) - n2(q * 5.3 - vec2(0.2 * tt, tt) + vec2(0.06, 0.0)),
      n2(q * 5.3 - vec2(0.2 * tt, tt)) - n2(q * 5.3 - vec2(0.2 * tt, tt) + vec2(0.0, 0.06)));
    vec3 n = normalize(vec3(g.x * 1.25 * calm, 1.0, g.y * 1.25 * calm));
    vec3 r = reflect(d, n);
    r.y = abs(r.y);
    float cosi = clamp(dot(-d, n), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
    vec3 refl = withRidges(skyColor(r, s), r, s);
    // Seen from above the water shows its depth; at a glancing angle, the sky.
    vec3 body = uDeep * (0.5 + 0.5 * max(s.sun.y * 3.0, 0.3));
    // From straight above it is still the page's water: the same colour, the
    // same net of light on the bed. It gives way as the camera comes down.
    float down = 1.0 - e;
    vec2 w = q * 2.1 + 0.5 * vec2(fbm2(q * 1.1 + tt * 0.15), fbm2(q * 1.1 + 7.0 - tt * 0.15));
    float c1 = 1.0 - abs(n2(w + vec2(tt * 0.22, 0.0)) * 2.0 - 1.0);
    float c2 = 1.0 - abs(n2(w * 1.6 + 3.3 - vec2(0.0, tt * 0.19)) * 2.0 - 1.0);
    float net = pow(c1, 7.0) * 0.75 + pow(c2, 7.0) * 0.5;
    body = mix(body, uShallow * (0.8 + net), down * down);
    col = mix(body, refl, clamp(fres + 0.05 * e, 0.0, 1.0));
    // Sun glitter: a broken streak toward the sun.
    float sd = max(dot(r, s.sun), 0.0);
    col += vec3(1.0, 0.86, 0.62) * (pow(sd, 900.0) * 14.0 + pow(sd, 90.0) * 0.55) * mix(0.75, 1.0, uTheme) * (1.0 - lee) * e;
    col = mix(col, s.hor, fog * e);
    col *= 1.0 - 0.56 * lee;
  }

  // Finish as a photograph would: gentle vignette, filmic roll-off, dither.
  vec2 c = vUv - 0.5;
  col *= 1.0 - dot(c, c) * 0.5 * e;
  col = mix(col, aces(col * 1.12), max(e, 0.0001));
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0 * 1.6;
  o = vec4(col, 1.0);
}`;
