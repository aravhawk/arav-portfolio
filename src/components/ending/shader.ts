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
uniform float uPre;      // 0..1 while the picture is still scrolling into view: the camera starts to lift
uniform float uTheme;    // 0 blue hour (light), 1 first light (dark)
uniform float uSunUp;    // 0..1, the sun climbing after arrival
uniform vec3 uShallow;   // the page's water seen from above, linear
uniform vec3 uDeep;      // open water body colour, linear
uniform float uHorizon;  // where the horizon rests, in v (-1 bottom .. 1 top)
uniform float uSunAz;    // the sun's bearing, radians right of straight ahead
uniform float uCalm;     // u (0..1) left of which the water is kept calm for the words
uniform vec2 uNet;       // x: how strongly the net of light shows on the shoal by day
uniform vec3 uGlow;      // the light the net gives the water by night, linear
uniform float uNear;     // v (0..1 from the bottom) under which the water is kept calm on a narrow screen; 0 when unused

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

// Gradient noise with a quintic fade: its second derivatives are continuous,
// which a caustic needs (it is made of them).
vec2 gdir(vec2 p) { float a = hash21(p) * 6.2831853; return vec2(cos(a), sin(a)); }
float gn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(dot(gdir(i), f), dot(gdir(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(gdir(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(gdir(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
/** The surface over the shoal: three layers that slide past each other, as the page's do. */
float surf(vec2 p, float t) {
  return 0.62 * gn(p + vec2(0.02, 0.03) * t) + 0.3 * gn(p * 1.83 + 3.1 - vec2(0.05, 0.03) * t) + 0.13 * gn(p * 3.17 + 7.9 + vec2(0.03, -0.06) * t);
}
/**
 * Light on the bed under that surface: one over the Jacobian of where the
 * refracted light lands, the same lens the page's water uses.
 */
float bedNet(vec2 p, float t) {
  // A slow warp makes the crests meander, so the net is long threads and
  // not a honeycomb.
  p = (p + vec2(gn(p * 0.5 + 1.7), gn(p * 0.5 + 5.2)) * 0.7) * 1.0;
  const float e = 0.045;
  float c = surf(p, t);
  float l = surf(p - vec2(e, 0.0), t), r = surf(p + vec2(e, 0.0), t);
  float u = surf(p - vec2(0.0, e), t), d = surf(p + vec2(0.0, e), t);
  float ul = surf(p + vec2(-e, -e), t), ur = surf(p + vec2(e, -e), t);
  float dl = surf(p + vec2(-e, e), t), dr = surf(p + vec2(e, e), t);
  const float F = 0.07;
  float hxx = F * (l + r - 2.0 * c) / (e * e);
  float hyy = F * (u + d - 2.0 * c) / (e * e);
  float hxy = F * (dr - dl - ur + ul) / (4.0 * e * e);
  float det = (1.0 + hxx) * (1.0 + hyy) - hxy * hxy;
  return min(1.0 / max(abs(det), 0.16), 4.6);
}

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

vec3 sunBloom(float sd, Sky s) {
  return s.band * (pow(sd, 9.0) * 0.07 + pow(sd, 60.0) * 0.22 + pow(sd, 420.0) * 0.5 + pow(sd, 2600.0) * 0.5);
}

/** The colour of the air at the horizon toward a bearing: what distance fades to. */
vec3 airAt(float az, Sky s) {
  float a = max(cos(az - atan(s.sun.x, s.sun.z)), 0.0);
  return s.hor + s.band * (pow(a, 5.0) * 0.3 + pow(a, 2.0) * 0.08);
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
  col += sunBloom(sd, s);
  // The disc has no hard rim: it is the brightest part of its own glow.
  col += vec3(1.0, 0.9, 0.7) * (smoothstep(0.9996, 0.99999, sd) * 2.4 + smoothstep(0.9999, 1.0, sd) * 1.6);
  // High thin cloud, lit from below near the sun.
  float c = fbm2(vec2(atan(d.x, d.z) * 3.2 + uTime * 0.004, h * 9.0));
  float cloud = smoothstep(0.5, 0.86, c) * smoothstep(0.03, 0.2, h) * (1.0 - smoothstep(0.4, 0.8, h));
  col = mix(col, col * 0.8 + s.band * 0.07 * pow(az, 3.0), cloud * 0.55);
  return col;
}

// Four ranges, furthest first. Each is a profile in elevation over bearing
// with a little relief inside it: the faces turned to the sun are lit, the
// others are in shade, and spurs run down from the crests. Each range
// further back stands in more air, so it is paler and nearer the sky's own
// colour. The ranges drop where the sun comes up, and its glow spills over
// them.
float ridgeH(float x) {
  return (1.0 - abs(n1(x) * 2.0 - 1.0)) * 0.56 + (1.0 - abs(n1(x * 2.7 + 3.1) * 2.0 - 1.0)) * 0.27
    + (1.0 - abs(n1(x * 6.3 + 1.7) * 2.0 - 1.0)) * 0.12 + n1(x * 17.0) * 0.05;
}

/** The same profile without its fine teeth: what the light sees as a slope. */
float ridgeBroad(float x) {
  return (1.0 - abs(n1(x) * 2.0 - 1.0)) * 0.56 + (1.0 - abs(n1(x * 2.7 + 3.1) * 2.0 - 1.0)) * 0.27;
}

vec3 withRidges(vec3 col, vec3 d, Sky s) {
  float az = atan(d.x, d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float sunAz = atan(s.sun.x, s.sun.z);
  float off = abs(az - sunAz);
  float side = clamp((sunAz - az) * 9.0, -1.0, 1.0);
  float gap = mix(0.72, 1.0, smoothstep(0.03, 0.5, off));
  float aa = fwidth(el) * 1.5 + 1e-4;
  vec3 air = airAt(az, s);
  float cover = 0.0;
  for (int i = 0; i < 4; i++) {
    float near = float(i) / 3.0;
    float f = mix(4.2, 9.0, near);
    float x = az * f + 9.7 * float(i);
    float r = ridgeH(x);
    float amp = mix(0.074, 0.03, near) * gap;
    float height = amp * (0.22 + 0.78 * r * r);
    float m = 1.0 - smoothstep(height - aa, height + aa, el);
    if (m > 0.0) {
      float rel = clamp(el / max(height, 1e-4), 0.0, 1.0);
      // A face that falls away toward the sun is lit; one that rises toward it is not.
      float slope = (ridgeBroad(x + 0.06) - ridgeBroad(x - 0.06)) / 0.12;
      // Spurs lean away from the crest, so the relief reads as slopes, not stripes.
      float spur = n1(x * 3.4 + (1.0 - rel) * 4.0 * side + 3.0 * float(i)) - 0.5;
      float lit = clamp(0.5 - side * slope * 0.4 + spur * 0.8, 0.0, 1.0);
      lit = smoothstep(0.12, 0.88, lit);
      vec3 shade = s.zen * 0.22 + s.mid * 0.06;
      vec3 sunlit = s.mid * 0.34 + s.hor * 0.2 + s.band * 0.07 * exp(-off * 1.6);
      vec3 rock = mix(shade, sunlit, lit * (0.55 + 0.45 * rel));
      // A thin bright edge on the crest where the light comes over it.
      rock += s.band * 0.1 * exp(-off * 3.0) * smoothstep(0.8, 1.0, rel);
      // Aerial perspective, and the air that pools at the foot.
      float airK = mix(0.4, 0.0, near) * s.haze;
      rock = mix(rock, air, clamp(airK + (1.0 - rel) * (1.0 - rel) * 0.22, 0.0, 0.9));
      float a = m * step(0.0, el + 0.002);
      col = mix(col, rock, a);
      cover = max(cover, a);
    }
  }
  // The sun's glow spills over whatever stands in front of it.
  float sd = max(dot(normalize(d), s.sun), 0.0);
  col += sunBloom(sd, s) * 0.5 * cover;
  // A thin band of mist lies on the waterline.
  col = mix(col, air, exp(-max(el, 0.0) / 0.0035) * 0.6);
  return col;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  Sky s = skyKey();

  // The move: sink and pitch up, eased so it settles.
  // One move from the first pixel to the last. While the picture is still
  // coming into view the look lifts from straight down until the horizon is
  // just above the frame: the water is already seen receding. Once it fills
  // the screen the horizon comes in at once and the move settles slowly.
  float p = clamp(uProg / 0.82, 0.0, 1.0);
  float q1 = 1.0 - p;
  float e = 1.0 - q1 * q1 * mix(1.0, q1, 0.5);
  float pitchFinal = atan(-uHorizon * TAN_HALF);
  float pre = uPre * uPre * (3.0 - 2.0 * uPre);
  float pitch = mix(mix(-1.3, -0.37, pre), pitchFinal, e);
  float eye = mix(H0, H1, e * e);
  vec3 d = normalize(vec3(uv.x * aspect * TAN_HALF, uv.y * TAN_HALF, 1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp + d.z * sp, -d.y * sp + d.z * cp);

  // The side the words stand on: in the lee, calm and a little shaded.
  float lee = (1.0 - smoothstep(uCalm - 0.16, uCalm + 0.14, vUv.x)) * e;
  // On a narrow screen the words run nearly the full width, so the whole
  // near reach is the lee and the glitter keeps to the water beyond it.
  lee = max(lee, step(0.001, uNear) * (1.0 - smoothstep(uNear - 0.01, uNear + 0.13, vUv.y)) * e);

  vec3 col;
  if (d.y >= 0.0) {
    col = withRidges(skyColor(d, s), d, s);
  } else {
    float t = eye / -d.y;
    vec3 P = vec3(d.x * t, 0.0, d.z * t);
    float dist = length(P.xz);
    float fog = 1.0 - exp(-dist * 0.0045 * s.haze);
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
    float topK = down * down;
    if (topK > 0.002) {
      // The page's water runs out here over a wide shoal, so this is the
      // same water: the same colour, the same net of light on the bed (one
      // lens focus of a summed surface, as the page computes it), the same
      // slow drift down the page. The net lies on the bed in the world, so
      // as the look lifts it is seen receding toward where the horizon
      // will be. It gives way as the camera comes down.
      float bars = fbm2(q * 0.22 + vec2(tt * 0.05, -tt * 0.03));
      vec2 gs = vec2(n2(q * 0.9 + vec2(tt * 0.4, 0.0)) - 0.5, n2(q * 0.9 + 5.0 - vec2(0.0, tt * 0.4)) - 0.5);
      // Its ripples are seen the way the page's are: one face lighter, one
      // darker.
      float rip = clamp((gs.x * 0.6 + gs.y * 0.8) * 0.5 + (g.x * 0.6 + g.y * 0.8) * 1.2, -0.14, 0.18) / (1.0 + dist * 0.012);
      // Far off the net is finer than a pixel: it eases out before it can shimmer.
      float reach = 1.0 - smoothstep(16.0, 46.0, dist);
      float c = 1.0;
      float glow = 0.0;
      if (reach > 0.0) {
        c = bedNet(q + vec2(0.0, uTime * 0.2 * (1.0 - 0.6 * pre)), uTime);
        c = max(c, 0.62 + 0.38 * c);
        float gather = clamp((c - 1.0) / 3.6, 0.0, 1.0);
        glow = pow(gather, 1.5) * reach;
        c = mix(1.0, c, reach);
      }
      vec3 day = uShallow * (1.0 + uNet.x * (c - 1.0));
      vec3 night = uShallow + uGlow * glow;
      vec3 shoal = mix(day, night, uTheme) * (0.9 + 0.2 * bars) * (1.0 + rip);
      body = mix(body, shoal, topK);
    }
    fres *= 1.0 - 0.85 * topK;
    col = mix(body, refl, clamp(fres + 0.05 * e, 0.0, 1.0));
    // Sun glitter: a broken streak toward the sun.
    float sd = max(dot(r, s.sun), 0.0);
    // By day the broad lobe is held back and the light is carried by a path
    // of separate glints: wide and sparse near the eye, narrowing to a
    // thread at the horizon.
    col += vec3(1.0, 0.86, 0.62) * (pow(sd, 900.0) * 14.0 + pow(sd, 90.0) * mix(0.1, 0.55, uTheme)) * mix(0.75, 1.0, uTheme) * (1.0 - lee) * e;
    float da = atan(d.x, d.z) - atan(s.sun.x, s.sun.z);
    float nearK = 1.0 / (1.0 + dist * 0.03);
    float wide = mix(0.028, 0.11, nearK);
    float path = exp(-da * da / (wide * wide));
    vec2 gq = q * vec2(30.0, 15.0);
    float sp = 0.6 * n2(gq + vec2(tt * 2.0, -tt * 3.0)) + 0.4 * n2(gq * 2.6 - vec2(tt * 3.0, tt));
    float lo = mix(0.5, 0.68, nearK);
    float glint = smoothstep(lo, lo + 0.08, sp);
    // Far off a glint is finer than a pixel: there the path is its even mean.
    float fine = smoothstep(0.35, 1.1, fwidth(gq.y));
    glint = mix(glint, 0.3, fine);
    float day = (1.0 - uTheme) * e;
    // The sun's reflected bloom is broken by the same facets, so it is not a patch.
    col = max(col - sunBloom(sd, s) * clamp(fres + 0.05 * e, 0.0, 1.0) * 0.85 * (1.0 - glint) * day, 0.0);
    col += vec3(1.0, 0.88, 0.7) * path * glint * mix(1.3, 0.95, nearK) * day * (1.0 - lee);
    vec3 air = airAt(atan(d.x, d.z), s);
    // Before the horizon is in frame its light already is: the far water
    // at the top of the picture warms as the look comes up.
    float pre4 = uPre * uPre; pre4 *= pre4;
    col = mix(col, air, fog * max(e, 0.4 * pre4));
    // The same mist, seen on the water side of the line.
    col = mix(col, air, exp(d.y / 0.0035) * 0.6 * e);
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
