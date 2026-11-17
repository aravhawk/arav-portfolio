/**
 * The name: letters of pale glacier ice, standing on a stretch of the lake
 * that the wind has swept bare.
 *
 * The ground. Lake ice blown clear of snow is dark: nearly black, glassy,
 * with white stress cracks standing in it, bubbles frozen deep in it, and
 * the sky sliding on it at a glancing angle. A broad field of it lies under
 * and round the name (the ice field's nameSwept says where), snow drifts
 * feather in across its edges and thin snakes of snow blow over it. It
 * mirrors what stands on it: the letters' image lies in it, softened, and
 * broken where the plates between the cracks tilt.
 *
 * The letters. Each line of the name is a row of upright blocks: the
 * letters' outlines (the name's distance field) carried straight back
 * through a depth of ice, laid in an upright plane as the first camera
 * sees them, so from there the faces are the type itself. They are hewn,
 * not sawn: the outline wanders by a hair, pieces have come away at the
 * arrises, the tops are not level. The low sun stands behind them, so they
 * are lit through: pale blue-white ice, brightest where it is thin (the
 * edges turned to the sun), cloudy with trapped air at the heart, clear and
 * deeper blue where there is none, with fracture planes and strata of
 * bubbles that catch the light. Their tops are wind-swept ice with packed
 * snow lying back from the edge; their sides are the block's depth seen
 * aslant, darker than the faces, so the faces alone are the letters.
 *
 * A ray is marched only through the box the blocks stand in (two rows on a
 * phone), a bounded number of steps; the ground's work is done only inside
 * the field.
 *
 * Needs the ice field's uniforms and nameSeat, nameSwept, nameFoot; the
 * stations' common block (snowOn, inAir); and iceInside, fracture, lodFor,
 * keyDir, simUv, stars, sunBloom, RW declared before it.
 */
export const NAME_ICE = `
uniform vec4 uNameP;       // x: how far from the blocks' feet meltwater lies on the sheet px, y: 0..1 how wet the blocks are, z: 0..1 the sheet has opened under them, w: 0..1 the pool has opened behind them

// The first camera, for which the outlines are laid: where it is, how deep the name's middle lies from it, and the slope of its line of sight to that middle.
vec3 gNmC = vec3(0.0);
float gNmZ0 = 1.0;
float gNmTy0 = 0.0;
void nameFrame() {
  gNmC = vec3(uIce.x + uIce.z * 0.5, uIceP.x, uIceP.y);
  float dy0 = uIce.y + uIce.w * 0.5 - uIceP.x;
  gNmZ0 = dy0 * uIceP.z + uIceP.y * uIceP.w;
  gNmTy0 = (dy0 * uIceP.w - uIceP.y * uIceP.z) / gNmZ0;
}

// How much of this pixel the blocks cover: the glare of the snow round them is kept off them.
float gNmCov = 0.0;
// The outline's gradient at the last place asked.
vec2 gNmGrad = vec2(0.0, 1.0);
// The blocks' shade on the sheet at this pixel, found once (before the air) and used again on the swept ice.
float gNmShade = 0.0;

/**
 * The hew: how far the block's surface stands in from the drawn outline at a
 * place, in the raster's px. The faces wander by a hair, here and there a
 * piece has come away at an arris, and it changes through the block's
 * depth, so no top is level. (Sines, not a texture: it is asked at every
 * step of the march.)
 */
float nameHew(float x, float z, float yd) {
  float a = sin(x * 0.047 + 2.3 * sin(z * 0.031 + 0.7) + yd * 2.1);
  float b = sin(z * 0.058 + 1.9 * sin(x * 0.027 + 2.0) - yd * 1.3);
  float c = sin(x * 0.131 + z * 0.093 + 4.0 * a + yd * 0.9);
  float chip = smoothstep(0.5, 0.95, a * b);
  return 1.0 * a * b + 0.5 * c + 3.2 * chip;
}

/**
 * A row of blocks in section: the distance, in the raster's true px, from a
 * place in the row's upright plane (x across, z up) to the letters' outline,
 * negative inside. yd: how far back through the block the place is, 0..1.
 * g: that place in the raster's units from its middle.
 */
float nameSd(int i, float x, float z, float yd, out vec2 g) {
  float yf = i == 0 ? uNameG.x : uNameG.y;
  float base = i == 0 ? uNameB.x : uNameB.y;
  vec3 e = vec3(x, yf, z + uNameM.z) - gNmC;
  float zc = max(e.y * uIceP.z - e.z * uIceP.w, 1.0);
  g = vec2(e.x * gNmZ0 / zc, ((e.y * uIceP.w + e.z * uIceP.z) / zc - gNmTy0) * gNmZ0);
  // (Under its baseline a block goes on down as it stands, into the sheet and the water.)
  vec2 gq = vec2(g.x, max(g.y, base + 1.5));
  vec2 uv = vec2(0.5 + gq.x / uIce.z, 0.5 + gq.y * (gNmZ0 / uIceP.y) / uIce.w);
  vec2 cl = clamp(uv, 0.002, 0.998);
  vec4 s = textureLod(uIceSdf, cl, 0.0);
  gNmGrad = s.ba;
  float sd = s.r + length((uv - cl) * vec2(uIce.z, uIce.w * uIceP.y / gNmZ0)) + uNameM.x;
  // (A blade is smooth: what was hewn has melted away.)
  sd += nameHew(g.x, g.y, yd) * clamp(uNameM.y / max(uNameB.w, 1.0) * 1.3 - 0.2, 0.0, 1.0);
  // (Two lines are two rows: each is only its own letters.)
  return max(sd, i == 0 ? uNameG.z - g.y : g.y - uNameG.z);
}

/**
 * A ray against one row. Returns how much of the pixel the row covers.
 * tH: where the ray meets it; g, sd, grad: the outline there; front: 1 on a
 * front face; thick: how much ice the ray then crosses; sBack: the
 * outline's distance where the ray reaches the row's back.
 */
float nameHit(vec3 ro, vec3 rd, int i, out float tH, out vec2 g, out float sd, out vec2 grad, out float front, out float thick, out float sBack) {
  tH = 0.0; g = vec2(0.0); sd = 1e3; grad = vec2(0.0, 1.0); front = 0.0; thick = 0.0; sBack = -1e3;
  float yf = i == 0 ? uNameG.x : uNameG.y;
  float y0 = yf + (uNameB.w - uNameM.y) * 0.5;
  float dep = max(uNameM.y, 1.0);
  vec3 lo = vec3(gNmC.x - 0.5 * uIce.z, y0, -FREEBOARD - 60.0 * uNameP.z);
  vec3 hi = vec3(gNmC.x + 0.5 * uIce.z, y0 + uNameM.y, uNameB.z * 1.3);
  vec3 inv = 1.0 / (abs(rd) + 1e-6) * sign(rd + 1e-9);
  vec3 ta = (lo - ro) * inv;
  vec3 tb = (hi - ro) * inv;
  vec3 tn = min(ta, tb);
  vec3 tf = max(ta, tb);
  float tA = max(max(tn.x, tn.y), max(tn.z, 0.0));
  float tB = min(min(tf.x, tf.y), tf.z);
  if (tA >= tB) return 0.0;
  bool faceOn = tn.y >= tn.x && tn.y >= tn.z && rd.y > 0.0;
  // How fast the ray crosses the outline's plane, in the raster's px for each unit of its length.
  float zc = (yf - gNmC.y) * uIceP.z + gNmC.z * uIceP.w;
  float rate = gNmZ0 / max(zc * 0.86, 1.0) * length(rd.xz) + 1e-4;
  float aa = 0.75 * tA * uPxAng * gNmZ0 / max(zc, 1.0);
  float t = tA;
  float best = 1e3;
  bool hit = false;
  vec2 gk;
  for (int k = 0; k < 24; k++) {
    vec3 p = ro + rd * t;
    float s = nameSd(i, p.x, p.z, (p.y - y0) / dep, gk);
    if (s < best) { best = s; tH = t; g = gk; grad = gNmGrad; }
    if (s < 0.0) { hit = true; front = k == 0 && faceOn ? 1.0 : 0.0; break; }
    t += max(s, 0.45 * aa + 0.05) / rate;
    if (t > tB) break;
  }
  if (best > aa) return 0.0;
  sd = best;
  // Further in, and where the ray leaves the row's depth: how deep in the ice it goes, and how much of it it crosses.
  float tIn = min(tH + (2.0 * aa + 1.0) / rate, tB);
  vec3 pI = ro + rd * tIn;
  float sI = nameSd(i, pI.x, pI.z, (pI.y - y0) / dep, gk);
  vec3 pB = ro + rd * tB;
  float sB = nameSd(i, pB.x, pB.z, 1.0, gk);
  sBack = sB;
  thick = (tB - tH) * (sB < 0.0 ? 1.0 : clamp(-min(sI, -0.01) / (sB - min(sI, -0.01)), 0.06, 1.0));
  // (An edge that the ray only grazes covers part of the pixel; one it goes in by covers it all.)
  return 1.0 - smoothstep(-aa, aa, min(best, hit ? min(sI, sB) : best));
}

/** The sky as a dark, glassy mirror gives it back: its colours, the sun's glow, and before dawn the curtain's wash and the stars. */
vec3 nameSky(vec3 rn, float starK) {
  float h = max(rn.z, 0.0);
  vec3 sky = mix(mix(S.hor, S.mid, smoothstep(0.0, 0.2, h)), S.zen, smoothstep(0.07, 0.62, h));
  float az = max(dot(normalize(rn.xy + 1e-5), normalize(S.sun.xy)), 0.0);
  float az2 = az * az;
  sky += S.band * exp(-h * 15.0) * az2 * az2 * 0.4 + sunBloom(max(dot(rn, S.sun), 0.0)) * (1.0 - 0.5 * uNight);
  if (uNight > 0.0) {
    float up = h - 0.27;
    if (uSkyK.y > 0.0) sky += mix(vec3(0.16, 0.92, 0.6), vec3(0.42, 0.22, 0.9), smoothstep(0.0, 1.32, up)) * (smoothstep(-0.05, 0.03, up) * exp(-max(up, 0.0) / 0.55) * 0.16) * uNight * uSkyK.y;
    if (starK > 0.0) sky += vec3(0.8, 0.88, 1.0) * stars(rn) * uNight * (1.0 - gDusk) * (1.0 - gDusk) * starK;
  }
  return sky;
}

/** The swept ice as it lies round the blocks, taken broadly: what is seen through clear ice and what lies on a wet face. */
vec3 nameLake() {
  return mix(vec3(0.05, 0.085, 0.14), vec3(0.012, 0.02, 0.034) + uAurora * 0.03, uNight);
}

/**
 * The ice of a block where the eye's ray enters it. p: where; i: which row;
 * soft: 1 when it is drawn as its mirror image (its fine inner work is not
 * looked for); the rest as nameHit gave them.
 */
vec3 nameLook(vec3 p, vec3 rd, float t, int i, vec2 g, float sd, vec2 grad, float front, float thick, float soft) {
  vec3 L = keyDir();
  float px = max(t * uPxAng, 0.02);
  float base = i == 0 ? uNameB.x : uNameB.y;
  float yf = i == 0 ? uNameG.x : uNameG.y;
  float y0 = yf + (uNameB.w - uNameM.y) * 0.5;
  float cap = max(uNameB.z, 1.0);
  float up = g.y - base;
  float hK = clamp(up / cap, 0.0, 1.3);
  float whole = clamp(uNameM.y / max(uNameB.w, 1.0), 0.0, 1.0);
  float melt = 1.0 - whole;
  vec2 gd = normalize(grad + vec2(1e-4, 0.0));
  bool isF = front > 0.5;
  vec3 n = isF ? vec3(0.0, -1.0, 0.0) : normalize(vec3(gd.x, -0.06, gd.y));
  float top = isF ? 0.0 : smoothstep(0.3, 0.72, n.z);
  // A place on the face: on a front, the outline's own; on a side or a top, along the outline and back through the block.
  vec2 q = isF ? g : vec2(dot(g, vec2(-gd.y, gd.x)) + 113.0, (p.y - y0) * 1.6 + 57.0);
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  vec3 tv = cross(n, tu);
  // (Read coarsely: the ice has no speckle in it, only slow clouds and broad swells.)
  vec4 g0 = textureLod(uGrain, q / 1500.0 + 0.37, 0.0);
  vec4 g1 = textureLod(uGrain, q / 560.0 + 0.11, lodFor(px, 560.0, 256.0));
  // How far in from the nearest arris: on a front, from the outline; on a side or a top, from the front or the back.
  float e = isF ? max(-sd, 0.0) : max(min(p.y - y0, y0 + uNameM.y - p.y), 0.0);
  vec2 sunG = normalize(vec2(L.x, 0.6));
  float toSun = isF ? clamp(0.5 + 0.5 * dot(gd, sunG), 0.0, 1.0) : 0.5 + 0.5 * clamp(dot(n.xz, sunG), -1.0, 1.0);
  // The light in it. By day the low sun stands behind the blocks and comes through them: more of it toward the sun's
  // side of the frame. Before dawn the ice holds the sky's and the aurora's light in its trapped air.
  float thru = pow(max(dot(rd, L), 0.0), 3.0);
  vec3 litD = S.amb * 1.2 + S.key * (0.05 + 0.26 * thru);
  vec3 litN = S.amb * 6.0 + uAurora * 0.12 + vec3(0.09, 0.06, 0.04) * uNight;
  vec3 lit = mix(litD, litN, uNight);
  vec3 lake = nameLake();
  // Meltwater on the face: it finds its own lanes down, and runs.
  float wet = 0.3 + 0.7 * uNameP.y;
  float lane = textureLod(uGrain, vec2(q.x / 420.0 + 0.2, 0.37 + q.y / 9000.0), 0.0).g;
  float film = wet * smoothstep(0.5, 0.68, lane) * (1.0 - top) * (isF ? 1.0 : 0.4);
  vec4 gw = vec4(0.5);
  if (film > 0.0 && soft < 0.5) gw = textureLod(uGrain, vec2(q.x / 420.0, (q.y + uTime * (26.0 + 26.0 * lane)) / 1500.0) + 0.6, 0.0);
  vec3 col;
  if (isF) {
    // ---- a front face: the letter itself
    float core = clamp(e / (0.1 * cap), 0.0, 1.0);
    float dK = clamp(thick / max(uNameB.w, 1.0), 0.0, 1.3);
    // Trapped air: curtains drawn up through the ice, and level strata that run through every letter alike.
    // (Smooth fields, about -0.7..0.7 each: the clouds, the curtains, the strata.)
    vec4 sm = textureLod(uSnow, q / vec2(820.0, 960.0) + 0.37, 0.0);
    float streak = textureLod(uSnow, vec2(q.x / 330.0, q.y / 2700.0) + 0.23, 0.0).g;
    float band = textureLod(uSnow, vec2(q.x / 3600.0 + 0.2, q.y / 560.0 + q.x / 2900.0), 0.0).b;
    float cloud = smoothstep(-0.12, 0.5, sm.r * 0.85 + streak * 0.6 + band * 0.5 + 0.4 * (core - 0.5)) * (1.0 - 0.6 * melt);
    // Clear ice a hand deep is pale blue; through the block's whole depth it is a deeper blue; air in it is white.
    vec3 body = mix(vec3(0.4, 0.62, 0.84), vec3(0.16, 0.38, 0.66), smoothstep(0.35, 1.1, dK) * 0.6 * whole);
    body = mix(body, vec3(0.82, 0.91, 0.98), 0.08 + 0.6 * cloud);
    // (Before dawn it is palest under the tops, and darker and clearer toward its foot.)
    col = mix(body, vec3(0.8, 0.87, 0.93), 0.55 * uNight) * lit * mix(0.86 + 0.24 * hK, 0.6 + 1.9 * pow(min(hK, 1.0), 1.2), uNight);
    // Where there is no air in it the eye goes through to the dark ice beyond.
    float win = (1.0 - cloud) * smoothstep(0.1, -0.3, sm.g) * (0.45 + 0.3 * uNight) * whole;
    col = mix(col, lake * exp(-vec3(1.6, 0.7, 0.3) * dK) + col * 0.3, win);
    vec2 across_ = vec2(dot(rd, tu), dot(rd, tv)) / max(-dot(rd, n), 0.3) / 1.31;
    if (soft < 0.5) {
      // What is in it: veils of air, and fracture planes at three depths, each a hairline and a flash where it lies to the light.
      vec2 across = across_;
      vec3 in_ = iceInside(q * 1.7 + 31.0, across, thick * 1.7, px * 1.7, 2.0);
      col = mix(col, mix(vec3(0.9, 0.95, 0.99), vec3(0.6, 0.8, 0.86), uNight) * lit * mix(1.0, 1.6, uNight), in_.x * 0.3);
      // (The light in the fractures shifts: by day as the sun's glitter does, before dawn with the curtain.)
      float shift = 0.72 + 0.56 * n1(uTime * 0.45 + g.x / 170.0 + g.y / 90.0);
      col += mix(vec3(0.92, 0.97, 1.0) * (S.key * 0.2 + S.amb * 0.5), vec3(0.7, 1.0, 0.95) * (litN * 0.35 + uAurora * 0.16), uNight) * in_.y * shift * 0.8;
      // The broad planes of cleavage: the ice either side of one takes the light a little differently.
      vec3 f3 = fracture(q / vec2(118.0, 176.0) + 5.3);
      col *= 0.86 + 0.26 * f3.y + 0.05 * sin(uTime * 0.5 + f3.z * 40.0);
      float fl = (1.0 - smoothstep(0.0, 0.012 + 1.3 * px / 118.0, f3.x)) * step(0.3, f3.z);
      col += mix(vec3(0.9, 0.97, 1.0) * (S.key * 0.1 + S.amb * 0.5), vec3(0.7, 1.0, 0.95) * (litN * 0.3 + uAurora * 0.08), uNight) * fl * 0.32 * shift * (0.4 + 0.6 * f3.y);
    }
    // The edges. The ice is thin at an arris and the light pours through it: brightest on the edges turned to the sun.
    // Just inside, the ice turns the light away. (Before dawn nothing outlines a letter: the upper edges only catch the sky.)
    float rim = exp(-e / 2.6);
    float sunE = toSun * toSun * toSun;
    col += mix(vec3(1.0, 0.95, 0.88) * (S.key * 0.2 + S.amb * 0.45) * (0.05 + 0.95 * sunE), vec3(0.9, 1.0, 1.05) * litN * 0.5 * smoothstep(0.1, 0.8, gd.y), uNight) * rim;
    // (An edge turned from the sun gives back the dark ice it stands on instead: a deeper line, not a bright one.)
    col *= 1.0 - (0.3 * exp(-e / 4.0) * (1.0 - toSun) * (1.0 - toSun) + 0.13 * smoothstep(3.0, 7.0, e) * (1.0 - smoothstep(8.0, 20.0, e))) * (1.0 - uNight);
    // (The side of each stroke the sun comes in by is the lighter.)
    col *= mix(1.0 + 0.16 * (toSun - 0.5) * exp(-e / (0.14 * cap)), 1.0, uNight);
    if (px < 1.1 && soft < 0.5) {
      // Bubbles strung in the strata: only from close by.
      float bead = smoothstep(0.955, 1.0, textureLod(uGrain, (q + across_ * 14.0) / 300.0 + 0.43, 0.0).r) * smoothstep(0.1, 0.45, band) * (1.0 - smoothstep(0.6, 1.1, px));
      col += mix(vec3(0.95, 0.98, 1.0) * (S.key * 0.2 + S.amb * 0.5), litN * 0.8, uNight) * bead;
    }
    // Frost: rime on the face, most under the tops and at the shoulders.
    float rime = smoothstep(0.6, 0.92, g0.g * 0.56 + g1.b * 0.2 + 0.36 * exp(-e / 10.0) * smoothstep(0.1, 0.8, gd.y)) * (1.0 - 0.8 * film) * (1.0 - 0.7 * melt);
    col = mix(col, mix(vec3(0.92, 0.95, 0.98) * (S.amb * 1.3 + S.key * 0.1), vec3(1.1, 1.14, 1.18) * litN * 1.6, uNight), rime * mix(0.4, 0.4, uNight));
    // The meltwater running down it: a moving sheen, and before dawn the aurora slides down in it.
    col *= 1.0 + film * (gw.g - 0.5) * 0.5;
    col += uAurora * film * smoothstep(0.45, 0.9, gw.g) * 0.45;
    // Wet at the foot: clear and dark, where the meltwater stands against it.
    col *= 1.0 - 0.42 * (1.0 - smoothstep(0.0, 0.085 * cap, up)) * (1.0 - 0.5 * uNight);
  } else {
    // ---- a side: the block's depth seen aslant, hewn and fluted, darker than the face
    float flute = textureLod(uGrain, vec2(q.x / 520.0 + 0.4, q.y / 2400.0 + 0.2), lodFor(px, 520.0, 256.0)).g;
    vec3 body = mix(vec3(0.07, 0.14, 0.25), vec3(0.2, 0.31, 0.46), 0.2 + 0.55 * flute + 0.25 * toSun);
    col = body * mix(lit, vec3(dot(lit, vec3(0.3, 0.5, 0.2))) * vec3(0.8, 0.95, 1.2), 0.6 * uNight) * mix(0.55 + 0.2 * hK, 0.26 + 0.34 * hK, uNight);
    col += mix(vec3(0.9, 0.96, 1.0) * (S.key * 0.1 + S.amb * 0.4), vec3(0.9, 1.0, 1.05) * litN * 0.3, uNight) * exp(-e / 2.4) * 0.7;
    col = mix(col, mix(vec3(0.8, 0.88, 0.95) * (S.amb * 1.1), vec3(0.9, 0.95, 1.0) * litN, uNight), smoothstep(0.62, 0.9, g0.g * 0.7 + g1.b * 0.3) * 0.3);
    // The top: wind-swept ice with the sky on it, and packed snow lying back from the front edge.
    if (top > 0.0) {
      float din = clamp((p.y - y0) / max(uNameM.y, 1.0), 0.0, 1.0);
      float lump = g0.b * 0.55 + g1.g * 0.45;
      float snowK = smoothstep(0.42, 0.56, din * 0.62 + lump * 0.6 - 0.5 * melt) * (1.0 - smoothstep(0.55, 0.9, melt));
      vec3 sn = mix(snowOn(n, (g1.r - 0.5) * 0.5), vec3(1.45, 1.5, 1.55) * litN, uNight) * (0.9 + 0.2 * g1.a);
      vec3 bare = mix(vec3(0.02, 0.05, 0.095) * litD + S.mid * 0.025, mix(vec3(0.16, 0.25, 0.34), vec3(0.8, 0.86, 0.92), smoothstep(0.62, 0.8, g0.b * 0.7 + g1.g * 0.3)) * litN, uNight);
      col = mix(col, mix(bare, sn, snowK * (1.0 - 0.75 * uNight)), top);
    }
  }
  // Where a block stands in water: a dark wet notch, and the bright line of the water's own edge.
  float zw = p.z + gFree;
  col *= 1.0 - 0.45 * uNameP.z * (1.0 - smoothstep(2.0, 12.0, zw));
  col += mix(vec3(0.8, 0.93, 1.0) * S.amb * 0.9, uAurora * 0.3, uNight) * (1.0 - smoothstep(0.0, 1.6, abs(zw - 1.2))) * uNameP.z * (1.0 - soft);
  return col;
}

/**
 * The swept ice: bare lake ice, nearly black, that the sky slides on. White
 * stress cracks stand in it, each a hairline at the top and a veil going
 * down into the ice (seen a little toward the eye, as anything under the
 * surface is); bubbles hang in it in columns. il: the place in the sheet's
 * frame; shade: the blocks' shade there; wet: 0..1 meltwater lies on it;
 * slope: that water's. Sets tiltOut: how the plate it is part of leans.
 */
vec3 nameFloor(vec2 p, vec2 il, vec3 dir, float foot, float shade, float wet, vec2 slope, out vec2 tiltOut) {
  vec2 vd = normalize(dir.xy + 1e-6);
  float px = max(foot, 0.3);
  float under = textureLod(uDetail, p / 760.0 + 0.31, 0.0).r;
  vec3 litD = S.amb * (1.0 - 0.3 * shade) + S.key * 0.035 * (1.0 - shade);
  vec3 litN = S.amb * 1.6 + uAurora * 0.05;
  vec3 lit = mix(litD, litN, uNight);
  // The ice's own depth: blue-black, a little paler where the water under it is shallow of air.
  vec3 col = mix(vec3(0.005, 0.016, 0.034), vec3(0.014, 0.04, 0.075), smoothstep(0.3, 0.85, under) * 0.7) * lit;
  vec3 white = mix(vec3(0.86, 0.92, 0.98) * (S.amb * 1.1 + S.key * 0.16 * (1.0 - shade)), vec3(0.5, 0.62, 0.74) * (S.amb * 2.2 + uAurora * 0.16), uNight);
  // Stress cracks, in three sets that run their own ways and cross.
  float hairs = 0.0;
  float veils = 0.0;
  vec2 tilt = vec2(0.0);
  const float DEEP_ICE = 30.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 dk = k == 0 ? vec2(0.97, 0.243) : (k == 1 ? vec2(0.82, -0.572) : vec2(-0.5, 0.866));
    float gap = k == 0 ? 520.0 : (k == 1 ? 760.0 : 400.0);
    vec4 w1 = textureLod(uSnow, il / vec2(5200.0, 3900.0) + fk * 0.37 + 0.11, 0.0);
    vec4 w2 = textureLod(uGrain, il / 2900.0 + fk * 0.23 + 0.5, 0.0);
    float sf = dot(il, dk) / gap + w1.r * 0.45 + fk * 0.31;
    float s = fract(sf);
    float id = floor(sf);
    // (Each runs a length and stops: none crosses the whole field.)
    float cut = smoothstep(0.46, 0.6, w2.g + 0.3 * w1.g + 0.3 * (hash11(id * 7.3 + fk * 3.1) - 0.5));
    float dl = min(s, 1.0 - s) * gap;
    hairs += (1.0 - smoothstep(0.2 * px, 1.0 * px, dl)) * cut * (k == 2 ? 0.6 : 1.0);
    // The plane below it lies toward the eye from its top edge.
    float side = dot(dk, vd);
    float dist = (side > 0.0 ? 1.0 - s : s) * gap;
    float vl = clamp(1.0 - dist / (abs(side) * DEEP_ICE + px), 0.0, 1.0);
    veils += vl * vl * cut * (0.25 + 0.75 * w2.a) * (k == 2 ? 0.6 : 1.0);
    // (The plates between the cracks do not lie quite level with each other.)
    tilt += (vec2(hash11(id * 3.7 + fk * 11.0), hash11(id * 5.1 + fk * 7.0)) - 0.5) * cut;
  }
  tiltOut = tilt * 0.012;
  float nearK = 1.0 - smoothstep(1.6, 4.0, px);
  col += white * (veils * 0.3 + hairs * 0.75) * mix(1.0, 0.5, uNight) * (0.35 + 0.65 * nearK);
  // Bubbles: white beads frozen in columns, the deeper ones seen nearer the eye and dimmer.
  if (nearK > 0.0) {
    float cl = smoothstep(0.5, 0.8, textureLod(uGrain, il / 1100.0 + 0.7, 0.0).b);
    float bub = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      bub += (1.0 - smoothstep(0.05, 0.13, textureLod(uGrain, (il + vd * (3.0 + 8.0 * fk)) / 640.0 + 0.13 + fk * 0.31, 0.0).a)) * (1.0 - 0.3 * fk);
    }
    col += white * bub * cl * nearK * 0.4;
  }
  // The sky on it: little from above, more and more toward the horizon; all of it where meltwater lies.
  vec3 nr = normalize(vec3(-slope - tiltOut * (1.0 - wet), 1.0));
  float cosi = clamp(dot(-dir, nr), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  vec3 rf = reflect(dir, nr);
  rf.z = abs(rf.z) + 0.01;
  vec3 sky = nameSky(normalize(rf), 1.0 - wet);
  // (In a block's shade a little less of it: the frost on the ice is unlit there.)
  col = mix(col, sky, clamp(fres * mix(0.22, 0.3, uNight) * (1.0 + 0.9 * wet) * (1.0 - 0.3 * shade), 0.0, 0.95));
  return col;
}

/**
 * The blocks, and the swept ice they stand on, over the finished ground.
 * tG: how far along the ray the ground's plane lies; onIce: how much of the
 * pixel there is the sheet's top; tWall: how far off the sheet's cut face
 * is at this pixel, if one is seen (a block's foot below the sheet's top is
 * hidden by either).
 */
vec3 nameField(vec3 col, vec2 p, vec3 dir, float foot, float onIce, float onWater);
vec3 nameIce(vec3 col, vec3 dir, float tG, float onIce, float tWall) {
  if (uNameG.w < 0.5) return col;
  nameFrame();
  if (tG < 1e8 && dir.z < -0.0006) col = nameField(col, uCamPos.xy + dir.xy * tG, dir, tG * uPxAng, onIce, tWall < 1e8 ? 0.0 : 1.0 - onIce);
  if (uNameM.w <= 0.0) return col;
  for (int k = 0; k < 2; k++) {
    // (The far row first: the near one stands in front of it.)
    if (k == 1 && uNameG.z < -5e3) break;
    float tH;
    vec2 g;
    float sd;
    vec2 grad;
    float front;
    float thick;
    float sBack;
    float cov = nameHit(uCamPos, dir, k, tH, g, sd, grad, front, thick, sBack);
    if (cov <= 0.0) continue;
    vec3 p = uCamPos + dir * tH;
    // Below the sheet's top a block is seen only through an opening, and only if it stands nearer than the opening's far wall.
    float sunk = 0.0;
    if (p.z < 0.0 && tH > tG) {
      cov *= (1.0 - onIce) * step(tH, tWall);
      // (Under the water it is still there to see, dimmer and bluer the deeper it goes.)
      sunk = max(-gFree - p.z, 0.0);
    }
    if (cov <= 0.0) continue;
    vec3 c = nameLook(p, dir, tH, k, g, sd, grad, front, thick, 0.0);
    if (sunk > 0.0) {
      c = c * exp(-sunk * vec3(0.03, 0.014, 0.01)) * mix(vec3(0.5, 0.74, 0.86), vec3(0.42, 0.7, 0.74), uNight);
      cov *= mix(0.72, 0.2, smoothstep(0.0, 90.0, sunk));
    }
    // (The blocks stand close under the eye and are kept clear of most of the lake's haze.)
    col = mix(col, mix(c, inAir(c, dir, tH), 0.04), cov * uNameM.w);
    gNmCov = max(gNmCov, cov * uNameM.w);
  }
  return col;
}

/**
 * What the blocks do to the sheet they stand on, before the air: each
 * throws a long soft blue shade toward the eye, away from the low sun.
 * p: the place on the sheet's top; onIce: how much of the pixel is that top.
 */
vec3 nameGround(vec3 col, vec2 p, vec3 dir, float foot, float onIce) {
  gNmShade = 0.0;
  if (uNameG.w < 0.5 || uNameM.w <= 0.0 || onIce <= 0.0 || uNight >= 1.0) return col;
  nameFrame();
  float dx = abs(p.x - gNmC.x) - 0.5 * uIce.z;
  if (dx > 1300.0 || p.y > uNameG.x + uNameB.w || p.y < uNameG.y - 2600.0) return col;
  vec3 L = keyDir();
  if (L.y <= 0.05) return col;
  float lenL = length(L.xy);
  float shade = 0.0;
  vec2 g;
  for (int i = 0; i < 2; i++) {
    if (i == 1 && uNameG.z < -5e3) break;
    float yf = i == 0 ? uNameG.x : uNameG.y;
    float y0 = yf + (uNameB.w - uNameM.y) * 0.5;
    if (p.y >= y0) continue;
    float s = (y0 - p.y) / L.y;
    float len = s * lenL;
    if (len < 3000.0 && L.z * s < uNameB.z * 1.3) {
      float soft = 1.2 + len * 0.06;
      shade = max(shade, (1.0 - smoothstep(-soft, soft, nameSd(i, p.x + L.x * s, L.z * s, 0.0, g))) * exp(-len / 900.0));
    }
  }
  gNmShade = shade * uNameM.w;
  // (A block's shade is blue: the light that reaches the snow there has come through ice.)
  return col * (1.0 - gNmShade * vec3(0.46, 0.34, 0.19) * (1.0 - uNight) * onIce);
}

/**
 * The swept field, laid over the sheet after the air (it lies close under
 * the eye, and black ice in haze is grey): the bare ice, the drifts that
 * feather in across its edges, the blocks' image in it and in the open
 * water once it has opened, the meltwater at their feet, and the snow
 * blowing over it.
 */
vec3 nameField(vec3 col, vec2 p, vec3 dir, float foot, float onIce, float onWater) {
  float d = nameSwept(p);
  if (d > 1.32 || onIce + onWater <= 0.0) return col;
  vec2 il = p - uIce.xy;
  vec2 wl = RW * il;
  // The snow's own lie (the sheet's drifts are drawn from the same field): swept, there is less of it, and at the
  // field's heart none. What is left at the edges is the crests of the drifts, reaching in along the wind.
  float fin = textureLod(uSnow, wl / vec2(420.0, 110.0) + vec2(0.71, 0.29), 0.0).b;
  float lvl = 0.5 + 0.26 * textureLod(uSnow, wl / vec2(2290.0, 790.0), 0.0).r + 0.18 * textureLod(uSnow, wl / vec2(860.0, 195.0) + vec2(0.37, 0.11), 0.0).g + 0.085 * fin;
  float lvlS = lvl - 0.44 * (1.0 - smoothstep(0.5, 1.0, d)) - 0.12 * (1.0 - smoothstep(0.15, 0.6, d));
  float ew = 0.004 + 0.005 * foot;
  // (Before dawn the sheet round the field is clear dark ice already: no drift cuts into it.)
  float drift = smoothstep(0.5 - ew, 0.5 + ew, lvlS) * (1.0 - uNight);
  // (Past its edge the bare ice goes under a dusting, in streaks, not all at once.)
  float K = (1.0 - drift) * (1.0 - smoothstep(0.0, mix(0.03, 0.3, uNight), d - 1.0 + ((lvl - 0.5) * 0.6 + fin * 0.16) * (1.0 - uNight)));
  float fd = nameFoot(p);
  // The meltwater on the sheet at the blocks' feet: its edge wanders.
  float wob = (textureLod(uGrain, p / 310.0, 0.0).g - 0.5) * 22.0 + (textureLod(uGrain, p / 71.0 + 0.3, 0.0).b - 0.5) * 7.0;
  float aaF = max(foot * 1.6, 1.2);
  float pond = (1.0 - smoothstep(uNameP.x - aaF, uNameP.x + aaF, fd + wob)) * onIce;
  vec2 slope = vec2(0.0);
  vec2 pw = p + dir.xy / max(-dir.z, 1e-3) * gFree;
  if (pond > 0.0 || onWater > 0.0) {
    // (The waves the pointer and the melt make in it, and its own: the air moves it a little, always.)
    slope = textureLod(uWave, simUv(mix(pw, p, onIce)), 0.0).zw * 0.6;
    slope += (textureLod(uGrain, p / 96.0 + vec2(0.011, 0.007) * uTime, 0.0).gb - 0.5) * 0.05 + (textureLod(uGrain, p / 41.0 - vec2(0.017, 0.009) * uTime + 0.4, 0.0).gb - 0.5) * 0.03;
    slope *= max(pond, onWater);
  }
  vec2 tilt = vec2(0.0);
  if (K * onIce > 0.0) {
    vec3 fl = nameFloor(p, il, dir, foot, gNmShade, pond, slope, tilt);
    // (A dusting lies on the ice ahead of each drift.)
    float dust = smoothstep(0.12, 0.5, lvlS) * 0.22 * (1.0 - uNight);
    fl = mix(fl, mix(vec3(0.9, 0.92, 0.95) * (S.key * 0.24 * (1.0 - 0.5 * gNmShade) + S.amb * 0.8), vec3(0.4, 0.47, 0.6) * (S.amb * 1.4), uNight), dust);
    // (A dark wet line where each block meets the sheet.)
    fl *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 5.0, fd));
    col = mix(col, mix(fl, inAir(fl, dir, length(vec3(p, 0.0) - uCamPos)), 0.07), K * onIce);
  }
  // (Before dawn the water the field leaves is dark, as the ice was: it holds the curtain's light dimly, and the pale
  // letters stand against it.)
  col *= 1.0 - 0.84 * uNight * onWater * (1.0 - onIce) * (1.0 - smoothstep(0.95, 1.3, d));
  // The blocks' image: in the black ice, softened with distance and broken where the plates tilt; clearer in
  // meltwater; and in open water, shaken by its waves.
  float mirK = max(K * onIce, onWater) * uNameM.w;
  if (mirK > 0.0) {
    float mir = 0.0;
    vec3 mc = vec3(0.0);
    vec2 g;
    vec3 from = vec3(mix(pw, p, onIce), -gFree * (1.0 - onIce));
    vec3 rf = normalize(vec3(dir.xy + slope * mix(1.0, 4.0, onWater) + tilt * (1.0 - pond), -dir.z));
    for (int i = 0; i < 2; i++) {
      if (i == 1 && uNameG.z < -5e3) break;
      float yf = i == 0 ? uNameG.x : uNameG.y;
      float y0 = yf + (uNameB.w - uNameM.y) * 0.5;
      if (from.y >= y0) continue;
      float s2 = (y0 - from.y) / max(rf.y, 0.05);
      float z2 = from.z + rf.z * s2;
      if (z2 > uNameB.z * 1.3 || s2 > 900.0) continue;
      float sdm = nameSd(i, from.x + rf.x * s2, z2, 0.0, g);
      float blur = mix(0.05, 0.13, onWater * (1.0 - onIce));
      float m = (1.0 - smoothstep(-1.0 - s2 * 0.4 * blur, 1.0 + s2 * blur, sdm)) * (1.0 - smoothstep(0.2 * uNameB.z, 1.1 * uNameB.z, z2));
      if (m > mir) {
        mir = m;
        mc = nameLook(vec3(from.x + rf.x * s2, y0, z2), rf, s2 + length(from - uCamPos), i, g, sdm, gNmGrad, 1.0, uNameM.y, 1.0);
      }
    }
    float cosw = clamp(-dir.z, 0.0, 1.0);
    // (Water is a poorer mirror than black ice from here, and what stands under it shows through: the image there is faint.)
    float strength = mix(mix(0.34, 0.5, pond), mix(0.26, 0.16, smoothstep(0.1, 0.6, cosw)), onWater * (1.0 - onIce));
    col = mix(col, mc * mix(vec3(0.6, 0.76, 0.96), vec3(0.6, 0.8, 0.95), uNight), mir * strength * mirK);
  }
  // Snow snakes: thin streamers the wind drives across the bare ice.
  if (K * onIce > 0.0) {
    vec2 ws = wl - vec2(uTime * 85.0, 0.0);
    float wander = textureLod(uSnow, wl / vec2(2600.0, 1900.0) + 0.43, 0.0).g;
    float gust = smoothstep(-0.1, 0.35, textureLod(uSnow, (wl - vec2(uTime * 40.0, 0.0)) / vec2(5200.0, 2300.0) + 0.61, 0.0).b);
    float sn = textureLod(uSnow, (ws + vec2(0.0, wander * 260.0)) / vec2(1500.0, 150.0) + vec2(0.13, 0.57), 0.0).r + 0.5 * textureLod(uSnow, (ws * 1.3 + vec2(0.0, wander * 180.0)) / vec2(640.0, 64.0) + vec2(0.7, 0.2), 0.0).g;
    // (Far off a streamer is thinner than a pixel: there it is a soft veil, not a dotted line.)
    float thinK = clamp(foot / max(-dir.z, 0.05) / 50.0, 0.0, 0.35);
    float snake = smoothstep(0.42 - thinK, 0.78 + 0.3 * thinK, sn) * gust * (1.0 - 1.6 * thinK);
    col = mix(col, mix(vec3(0.9, 0.92, 0.95) * (S.key * 0.24 * (1.0 - 0.5 * gNmShade) + S.amb * 0.8), vec3(0.36, 0.44, 0.58) * (S.amb * 1.5), uNight), snake * 0.34 * K * onIce * (1.0 - pond));
  }
  return col;
}
`;
