/**
 * The name: eight plates of clear lake ice, sawn from the sheet and stood on
 * end on a stretch of the lake that the wind has swept bare.
 *
 * The ground. Lake ice blown clear of snow is dark: nearly black, glassy,
 * with white stress cracks standing in it, bubbles frozen deep in it, and
 * the sky sliding on it at a glancing angle. A broad field of it lies under
 * and round the name (the ice field's nameSwept says where), snow drifts
 * feather in across its edges and thin snakes of snow blow over it. It
 * mirrors what stands on it once: each plate's image lies in it, sharp at
 * the foot and gone a little over half the plate's height down.
 *
 * The plates. Each letter is a plate of its own (see name.ts): its outline
 * carried straight back through a fifth of its height, with sawn faces and
 * arrises that are chipped here and there, never rounded. Its front is
 * saw-cut and lightly frosted, so it holds light and the letter reads; its
 * body is clear. The low sun stands behind the name and to one side, so the
 * plates are lit through: they glow from within, brightest where the ice is
 * thin and at the edges, deepening to blue-green toward the foot; fracture
 * planes and veils of bubbles in them catch that light; the arrises are
 * clear, and the far shore is seen bent in them. Each throws a long shade
 * toward the eye with the light that came through it lying in the shade.
 * Before dawn a low moon stands where the sun did.
 *
 * A plate has its own place and turn (uLtA, uLtQ), so it settles, tips and
 * founders at its own moment, is seen through the water where it has gone
 * under, and rides on flat as a berg. A ray is tried against a plate only
 * inside that plate's own box, and against none outside the box that holds
 * them all.
 *
 * Needs the ice field's uniforms and nameSeat, nameSwept, nameFoot, gIceCr;
 * the stations' common block (snowOn, inAir); and iceInside, fracture,
 * lodFor, keyDir, simUv, stars, sunBloom, RW declared before it.
 */
export const NAME_ICE = `
// (The checks' own switches: each takes one part of the name's work out, to weigh it. The engine never sets them.)
#ifdef DBG_NO_NFLOOR
#define DBG_FLOOR false &&
#else
#define DBG_FLOOR
#endif
#ifdef DBG_NO_NMIR
#define DBG_MIR false &&
#else
#define DBG_MIR
#endif
#ifdef DBG_NO_NSNAKE
#define DBG_SNAKE false &&
#else
#define DBG_SNAKE
#endif
uniform vec4 uNameP;       // x: how far from the plates' feet meltwater lies on the sheet px, y: 0..1 how wet the plates and the ice round them are, z: 0..1 the fractures have run out from their feet, w: 0..1 the sheet has begun to open under them
uniform vec4 uLtA[PLATES]; // each plate: xyz its middle, w its capitals' height
uniform vec4 uLtQ[PLATES]; // its turn: a quaternion from the plate's own frame (x across, y back through it, z up it) to the world's
uniform vec4 uLtG[PLATES]; // xy: where its outline's middle lies in the raster, z: half its width, w: half its depth
uniform vec4 uLtT;         // the raster: xy: how far a capital's height is in it, zw: how far from a cell's middle an outline is looked for, in capitals' heights
uniform vec4 uNameBx;      // the ground all eight plates stand or ride on: xy its least corner, zw its greatest

// The first camera: the swept ice and the first frame's words are measured in its picture.
vec3 gNmC = vec3(0.0);
void nameFrame() {
  gNmC = vec3(uIce.x + uIce.z * 0.5, uIceP.x, uIceP.y);
}

// How much of this pixel the plates cover: the glare of the snow round them is kept off them.
float gNmCov = 0.0;
// The outline's gradient at the last place asked.
vec2 gNmGrad = vec2(0.0, 1.0);
// The plates' shade on the sheet at this pixel, and how much of the light that came through a plate lies in it, found
// once (before the air) and used again on the swept ice.
float gNmShade = 0.0;
float gNmPool = 0.0;

#ifdef F_NAME
vec3 qTo(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec3 qFrom(vec4 q, vec3 v) { return v - 2.0 * cross(q.xyz, q.w * v - cross(q.xyz, v)); }

/**
 * A plate's outline: the distance, in world units, from a place in the
 * plate's own upright plane (x across, z up, from its middle) to the
 * letter's edge, negative inside.
 */
float plateSd(int i, vec2 xz) {
  float H = uLtA[i].w;
  vec2 c = xz / H;
  vec2 cc = clamp(c, -uLtT.zw, uLtT.zw);
  vec4 s = textureLod(uIceSdf, uLtG[i].xy + cc * uLtT.xy, 0.0);
  gNmGrad = s.ba;
  return (s.r + length(c - cc)) * H;
}

/**
 * Where a piece has come away at an arris: how far the plate's surface
 * stands in from its sawn outline there, in capitals' heights. A chip is at
 * the front edge or at the back, never through the whole depth, and has
 * flat sides. (Sines, not a texture: it is asked at every step of a march.)
 */
float plateChip(float fi, vec2 c, float yd) {
  float a = sin(c.x * 12.0 + fi * 7.1 + 2.3 * sin(c.y * 9.0 + fi));
  float b = sin(c.y * 15.0 + 1.9 * sin(c.x * 7.0 + 2.0 * fi) + fi * 3.3);
  float k = clamp((a * b - 0.9) * 10.0, 0.0, 1.0);
  float w = a > 0.0 ? max(1.0 - yd / 0.42, 0.0) : max(1.0 - (1.0 - yd) / 0.36, 0.0);
  return 0.034 * k * w;
}

/**
 * A ray against one plate. Returns how much of the pixel the plate covers.
 * tH: where the ray meets it; pl: that place in the plate's own frame; nl:
 * the face's normal there; grad: the outline's gradient; sd: the outline's
 * distance; thick: how much ice the ray then crosses; kind: 0 the sawn
 * front, 1 the back, 2 an edge (a side, a top), 3 a chip.
 */
float plateHit(int i, vec3 ro, vec3 rd, out float tH, out vec3 pl, out vec3 nl, out vec2 grad, out float sd, out float thick, out float kind) {
  tH = 0.0; pl = vec3(0.0); nl = vec3(0.0, -1.0, 0.0); grad = vec2(0.0, 1.0); sd = 1e3; thick = 0.0; kind = 0.0;
  vec4 A = uLtA[i];
  vec4 G = uLtG[i];
  vec3 o = qFrom(uLtQ[i], ro - A.xyz);
  vec3 d = qFrom(uLtQ[i], rd);
  float H = A.w;
  vec3 hb = vec3(G.z + 0.03 * H, G.w, 0.5 * H);
  vec3 inv = 1.0 / (abs(d) + 1e-6) * sign(d + 1e-9);
  vec3 ta = (-hb - o) * inv;
  vec3 tb = (hb - o) * inv;
  vec3 tn = min(ta, tb);
  vec3 tf = max(ta, tb);
  float tA = max(max(tn.x, tn.y), max(tn.z, 0.0));
  float tB = min(min(tf.x, tf.y), tf.z);
  if (tA >= tB) return 0.0;
  float fi = float(i);
  // How fast the ray crosses the outline's plane, and what a pixel spans there.
  float rate = length(d.xz) + 1e-4;
  float aa = 0.75 * tA * uPxAng;
  float t = tA;
  float best = 1e3;
  float chipAt = 0.0;
  bool hit = false;
  bool first = false;
  for (int k = 0; k < 14; k++) {
    vec3 p = o + d * t;
    float chip = plateChip(fi, p.xz / H, clamp(0.5 + 0.5 * p.y / hb.y, 0.0, 1.0)) * H;
    float s = plateSd(i, p.xz) + chip;
    if (s < best) { best = s; tH = t; grad = gNmGrad; chipAt = chip; }
    if (s < 0.0) { hit = true; first = k == 0; break; }
    // (Where a chip is near, the surface changes through the plate's depth: the ray goes on by short steps.)
    t += min(max(s, 0.3 * aa + 0.04) / rate, chip > 0.0 ? 0.24 * hb.y / max(abs(d.y), 0.05) : 1e9);
    if (t > tB) break;
  }
  if (best > aa) return 0.0;
  sd = best;
  pl = o + d * tH;
  vec2 gd = normalize(grad + vec2(1e-4, 0.0));
  bool yFace = tn.y >= tn.x && tn.y >= tn.z;
  if (hit && first && yFace) {
    kind = d.y > 0.0 ? 0.0 : 1.0;
    nl = vec3(0.0, d.y > 0.0 ? -1.0 : 1.0, 0.0);
  } else if (hit && first && tn.z > tn.y && tn.z >= tn.x) {
    // (A sawn top, or the foot it stood on.)
    kind = 2.0;
    nl = vec3(0.0, 0.0, d.z > 0.0 ? -1.0 : 1.0);
    grad = vec2(0.0, nl.z);
  } else {
    // An edge of the outline; where a chip has come away, a flat that leans to the face it broke from.
    float ck = clamp(chipAt / (0.012 * H), 0.0, 1.0);
    kind = 2.0 + ck;
    nl = normalize(vec3(gd.x, (pl.y < 0.0 ? -1.0 : 1.0) * 0.9 * ck, gd.y));
  }
  // Where the ray leaves the plate's depth: how much ice it crosses.
  vec3 pB = o + d * tB;
  float sB = plateSd(i, pB.xz);
  float s0 = min(best, -0.01);
  thick = (tB - tH) * (sB < 0.0 ? 1.0 : clamp(-s0 / (sB - s0), 0.05, 1.0));
  // (An edge that the ray only grazes covers part of the pixel; one it goes in by covers it all.)
  if (!hit) return 1.0 - smoothstep(-aa, aa, best);
  if (first) return 1.0 - smoothstep(-aa, aa, min(best, sB));
  vec3 pI = o + d * min(tH + (2.0 * aa + 1.0) / rate, tB);
  return 1.0 - smoothstep(-aa, aa, min(best, plateSd(i, pI.xz)));
}
#endif

/** The sky as a dark, glassy mirror gives it back: its colours, the sun's glow, and before dawn the curtain's wash and the stars. */
vec3 nameSky(vec3 rn, float starK) {
  float h = max(rn.z, 0.0);
  vec3 sky = mix(mix(S.hor, S.mid, smoothstep(0.0, 0.2, h)), S.zen, smoothstep(0.07, 0.62, h));
  float az = max(dot(normalize(rn.xy + 1e-5), normalize(S.sun.xy)), 0.0);
  float az2 = az * az;
  sky += S.band * exp(-h * 15.0) * az2 * az2 * 0.4 + sunBloom(max(dot(rn, S.sun), 0.0)) * (1.0 - 0.5 * uNight);
  if (uNight > 0.0) {
    float up = h - 0.27;
    if (uSkyK.y > 0.0) sky += mix(vec3(0.16, 0.92, 0.6), vec3(0.42, 0.22, 0.9), smoothstep(0.0, 1.32, up)) * (smoothstep(-0.05, 0.03, up) * exp(-max(up, 0.0) / 0.55) * 0.1) * uNight * uSkyK.y;
    if (starK > 0.0) sky += vec3(0.8, 0.88, 1.0) * stars(rn) * uNight * (1.0 - gDusk) * (1.0 - gDusk) * starK;
  }
  return sky;
}

/** The swept ice as it lies round the plates, taken broadly: what is seen through clear ice and what lies on a wet face. */
vec3 nameLake() {
  return mix(vec3(0.05, 0.085, 0.14), vec3(0.012, 0.02, 0.034) + uAurora * 0.03, uNight);
}

/**
 * What stands behind the name, taken broadly, for what clear ice bends and
 * what a wet face gives back: the sky, the ranges in their haze along the
 * far shore, the pale sheet under them, the dark ice near by.
 */
vec3 nameEnv(vec3 d) {
  float h = d.z;
  if (h >= 0.0) {
    vec3 sky = nameSky(normalize(vec3(d.xy, h + 0.004)), 0.0);
    vec3 shore = mix(vec3(0.3, 0.4, 0.56) * (S.amb * 1.5 + S.key * 0.05), S.hor * 0.5 + vec3(0.01, 0.014, 0.022), uNight);
    return mix(shore, sky, smoothstep(0.012, 0.07, h));
  }
  vec3 far = mix(vec3(0.8, 0.86, 0.93) * (S.amb * 1.1 + S.key * 0.16), vec3(0.2, 0.26, 0.36) * S.amb * 2.4, uNight);
  return mix(far, nameLake(), smoothstep(0.015, 0.2, -h));
}

#ifdef F_NAME
/**
 * The ice of a plate where the eye's ray meets it. The rest as plateHit gave
 * them; rd: the ray, in the world; t: how far along it; soft: 1 when the
 * plate is drawn as its image in the ice or through the water (its fine
 * inner work is not looked for).
 */
vec3 plateLook(int i, vec3 pl, vec3 nl, vec2 grad, vec3 rd, float t, float sd, float thick, float kind, float soft) {
  vec4 A = uLtA[i];
  vec4 Q = uLtQ[i];
  vec4 G = uLtG[i];
  float H = A.w;
  float fi = float(i);
  vec3 n = qTo(Q, nl);
  vec3 L = keyDir();
  float px = max(t * uPxAng, 0.02);
  // The place on the letter, in capitals' heights from its middle; how far up it; how far in from its edge.
  vec2 c = pl.xz / H;
  float hK = clamp(c.y + 0.5, 0.0, 1.0);
  float e = max(-sd, 0.0) / H;
  float yd = clamp(0.5 + 0.5 * pl.y / max(G.w, 1.0), 0.0, 1.0);
  bool isF = kind < 1.5;
  vec2 gd = normalize(grad + vec2(1e-4, 0.0));
  // A place on the face, in a measure that is the world's on a wide screen: on a sawn face, the letter's own; on an edge, along the outline and back through the plate.
  vec2 q = isF ? c * 232.0 + fi * 61.0 : vec2(dot(c, vec2(-gd.y, gd.x)) * 232.0 + 113.0 + fi * 37.0, pl.y / H * 370.0 + 57.0);
  float pxq = px * 232.0 / H;
  float wet = uNameP.y;
  // How upright it stands (1), or lies afloat (0): a plate lying in the water has only the sky over it.
  float up = clamp(qTo(Q, vec3(0.0, 0.0, 1.0)).z, 0.0, 1.0);

  // ---- the light that comes through it. Clear ice takes the red first: a hand of it is pale, a plate's depth is
  // turquoise, and along a plate's length it is a deep blue-green.
  float dK = thick / H;
  vec3 T = exp(-vec3(6.4, 1.5, 0.9) * dK);
  // (Moonlight through ice is a greyer blue than the sun's turquoise.)
  T = mix(T, vec3(dot(T, vec3(0.2, 0.5, 0.3))) * vec3(0.8, 0.98, 1.16), 0.55 * uNight);
  // By day the low sun stands behind the plates and comes through them: more of it the nearer the eye looks toward
  // the sun. Before dawn it is the moon that stands there, and the sky's own light in the ice.
  float toward = max(dot(rd, L), 0.0);
  float tw = toward * toward;
  tw *= tw;
  vec3 behind = mix(S.key * (0.05 + 0.23 * tw) * (0.3 + 0.7 * up) + S.amb * 0.56, S.key * (0.16 + 1.0 * tw) + S.amb * 1.25 + uAurora * 0.04, uNight);
  // It deepens toward the foot: the light has further to come down the plate, and the black ice under it gives none back.
  float deep = mix(mix(0.22, 0.34, uNight), 1.0, smoothstep(0.0, 0.7, hK)) * mix(1.0, 0.78, (1.0 - up) * (1.0 - uNight));
  vec3 footT = exp(-vec3(3.6, 0.42, 0.2) * (1.0 - hK) * (1.0 - hK) * up);
  vec3 col = behind * T * footT * deep;
  // Which way the light comes along the face: an edge turned to the sun is where it pours in.
  vec3 Ll = qFrom(Q, L);
  vec2 sunG = normalize(Ll.xz + vec2(1e-4, 0.3));
  float toSun = clamp(0.5 + 0.5 * dot(gd, sunG), 0.0, 1.0);
  vec3 cold = mix(vec3(1.0, 0.97, 0.9), vec3(0.78, 0.9, 1.05), uNight);
  vec3 keyL = mix(S.key, S.key * 4.0 + S.amb * 1.6, uNight);

  if (isF) {
    // ---- a sawn face: the letter itself.
    // Trapped air: slow clouds and curtains drawn up through the ice, white where the light finds them.
    vec4 sm = textureLod(uSnow, q / vec2(820.0, 960.0) + 0.37, 0.0);
    float streak = textureLod(uSnow, vec2(q.x / 330.0, q.y / 2700.0) + 0.23, 0.0).g;
    float cloud = smoothstep(0.08, 0.62, sm.r * 0.9 + streak * 0.6 + 0.25 * (hK - 0.5)) * (1.0 - 0.4 * wet);
    col = mix(col, behind * (0.4 + 0.6 * T) * vec3(0.86, 0.94, 0.98) * mix(0.8, 1.0, hK), cloud * 0.36);
    // Where there is none the eye goes through the plate to the dark ice beyond it.
    float clearK = (1.0 - cloud) * smoothstep(0.2, -0.3, sm.g);
    col = mix(col, nameLake() * T + col * 0.42, clearK * mix(0.5, 0.56, uNight) * up);
    vec2 across = vec2(dot(rd, qTo(Q, vec3(1.0, 0.0, 0.0))), dot(rd, qTo(Q, vec3(0.0, 0.0, 1.0)))) / max(-dot(rd, n), 0.3) / 1.31;
    if (soft < 0.5) {
      // What is in it: veils of air, and fracture planes at three depths, each a hairline and a flash where it lies to the light.
      vec3 in_ = iceInside(q * 1.7 + 31.0, across, thick * 1.7 * 232.0 / H, pxq * 1.7, 2.0 + fi);
      col = mix(col, behind * vec3(0.94, 0.98, 1.0) * mix(1.05, 1.5, uNight), in_.x * 0.42);
      float shift = 0.55 + 0.9 * n1(uTime * 0.45 + q.x / 170.0 + q.y / 90.0);
      col += cold * (keyL * mix(0.2, 0.05, uNight) + S.amb * 0.45 + uAurora * 0.14) * in_.y * shift * 1.2;
      // The broad planes of cleavage: the ice either side of one takes the light a little differently.
      vec3 f3 = fracture(q / vec2(118.0, 176.0) + 5.3 + fi * 1.7);
      col *= 0.84 + 0.3 * f3.y + 0.04 * sin(uTime * 0.5 + f3.z * 40.0);
      float fl = (1.0 - smoothstep(0.0, 0.012 + 1.3 * pxq / 118.0, f3.x)) * step(0.3, f3.z);
      col += cold * (keyL * mix(0.12, 0.03, uNight) + S.amb * 0.4 + uAurora * 0.08) * fl * 0.5 * shift * (0.4 + 0.6 * f3.y);
    }
    // The saw's marks: fine, nearly level, each blade's pass a little brighter or duller than the last. They hold the
    // frost, and the frost holds the sky's light: this is what makes a clear plate a letter.
    float ang = (hash11(fi * 3.7 + 1.3) - 0.5) * 0.36;
    vec2 sw = vec2(q.x * cos(ang) + q.y * sin(ang), q.y * cos(ang) - q.x * sin(ang));
    float fine = textureLod(uGrain, vec2(sw.x / 7000.0, sw.y / 330.0) + 0.21, 0.0).g;
    float pass = textureLod(uGrain, vec2(sw.x / 20000.0 + 0.5, sw.y / 1900.0 + fi * 0.13), 0.0).b;
    float mark = (fine - 0.5) * (1.0 - smoothstep(1.0, 3.0, pxq)) + (pass - 0.5) * 0.9;
    col *= 1.0 + 0.3 * mark;
    // (Under its top a plate is rimed; toward its foot it is wet and clear.)
    float frost = clamp(mix(0.24, 0.13, uNight) + 0.3 * mark + 0.16 * smoothstep(0.55, 1.0, hK) - 0.12 * (1.0 - hK), 0.04, 0.8) * (1.0 - 0.45 * wet);
    vec3 skyLit = mix(S.amb * 1.3 + S.key * 0.03, S.amb * 3.4 + uAurora * 0.2 + S.key * 0.4, uNight);
    // (Its edges are clear: the frost stops a finger's breadth short of every arris.)
    float edge = 1.0 - smoothstep(0.003, 0.014, e);
    col = mix(col, vec3(0.9, 0.94, 0.98) * skyLit * (0.86 + 0.28 * hK), frost * (1.0 - edge));
    // The arris. The ice is thin there and the light pours through: brightest on the edges turned to the sun; and it
    // comes on into the ice a hand's breadth, so a thin stroke is lit right through and a broad one has a deeper heart.
    float sunE = toSun * toSun;
    col += cold * (keyL * mix(0.26, 0.55, uNight) + S.amb * 0.4) * (0.04 + 0.96 * sunE * toSun) * exp(-e / mix(0.009, 0.014, uNight)) * (0.35 + 0.65 * up);
    col += vec3(0.62, 0.95, 1.0) * (keyL * 0.08 + S.amb * 0.1) * toSun * toSun * exp(-e / 0.06) * (0.4 + 0.6 * up);
    if (edge > 0.0 && soft < 0.5) {
      // Through the clear edge the far shore is seen, bent.
      vec3 bent = normalize(rd + qTo(Q, vec3(gd.x, 0.0, gd.y)) * (0.5 - 0.9 * e / 0.022));
      col = mix(col, nameEnv(bent) * (0.6 + 0.4 * T) + col * 0.5, edge * 0.42);
    }
    // A line of rime along a top edge, where the wind has left it.
    float rime = exp(-e / 0.008) * smoothstep(0.55, 0.95, gd.y) * (1.0 - wet) * smoothstep(0.3, 0.6, textureLod(uGrain, q / 260.0 + 0.11, 0.0).g + 0.25);
    col = mix(col, vec3(0.95, 0.97, 1.0) * skyLit * 1.25, rime * 0.75 * up);
    // Meltwater runs down it in its own lanes: a moving sheen.
    if (wet > 0.0 && soft < 0.5) {
      float lane = textureLod(uGrain, vec2(q.x / 420.0 + 0.2, 0.37 + q.y / 9000.0), 0.0).g;
      float film = wet * smoothstep(0.5, 0.68, lane);
      float gw = textureLod(uGrain, vec2(q.x / 420.0, (q.y + uTime * (26.0 + 26.0 * lane)) / 1500.0) + 0.6, 0.0).g;
      col *= 1.0 + film * (gw - 0.5) * 0.5;
      col += (uAurora * 0.4 + S.amb * 0.25 * (1.0 - uNight)) * film * smoothstep(0.45, 0.9, gw);
    }
  } else {
    // ---- an edge: a sawn side or a top, clear, the plate's whole body seen through it; or a chip, which glints.
    float chip = clamp(kind - 2.0, 0.0, 1.0);
    float flute = textureLod(uGrain, vec2(q.x / 520.0 + 0.4, q.y / 2400.0 + 0.2), lodFor(pxq, 520.0, 256.0)).g;
    col *= 0.8 + 0.4 * flute;
    // (A chip is a clean break: clear ice that the light finds.)
    col += cold * (keyL * 0.12 + S.amb * 0.5) * chip;
    // (The side the sun comes in by is lit through from end to end.)
    col += vec3(0.6, 0.95, 1.0) * (keyL * 0.16 + S.amb * 0.2) * toSun * toSun * (0.4 + 0.6 * up) * (1.0 - 0.5 * chip);
    // The arrises of an edge are its two sawn lines, front and back: each catches the light.
    float ar = exp(-min(yd, 1.0 - yd) * 2.0 * G.w / (0.012 * H));
    col += cold * (keyL * 0.13 + S.amb * 0.35) * ar * (0.3 + 0.7 * toSun);
    if (soft < 0.5) {
      vec3 bent = normalize(rd + n * 0.45);
      col = mix(col, nameEnv(bent) * (0.5 + 0.5 * T) + col * 0.5, 0.3 * (1.0 - chip));
    }
    // A top is sawn and clear: a line of rime lies along its front edge and no more.
    float top = smoothstep(0.5, 0.9, n.z) * up;
    if (top > 0.0) col = mix(col, vec3(0.93, 0.95, 0.98) * mix(S.amb * 1.25 + S.key * 0.12, S.amb * 5.0 + uAurora * 0.2 + S.key, uNight), top * (1.0 - smoothstep(0.04, 0.2, yd)) * 0.6 * (1.0 - wet));
  }
  // Every face is glass at a glance: it gives back what stands over it, more the more aslant the eye meets it.
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  if (soft < 0.5) {
    vec3 rf = reflect(rd, n);
    col = mix(col, nameEnv(rf), fres * (isF ? 0.55 + 0.4 * wet : 0.9));
    // (And the low sun itself on what is turned to it: a top, a lit flank, a chip.)
    float nh = max(dot(n, normalize(L - rd)), 0.0);
    col += keyL * pow(nh, isF ? 36.0 : 90.0) * step(0.0, dot(n, L)) * (isF ? 0.1 : 0.55) * (1.0 - 0.4 * uNight);
  }
  // Where it stands in water: wet and dark at the waterline.
  float zw = (A.xyz + qTo(Q, pl)).z + gFree;
  col *= 1.0 - 0.4 * uNameP.w * (1.0 - smoothstep(1.0, 9.0, zw)) * (1.0 - soft);
  return col;
}
#endif

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
  vec3 litN = S.amb * 1.6 + uAurora * 0.05 + S.key * 0.2 * (1.0 - shade);
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
    // The plane below it lies toward the eye from its top edge.
    float side = dot(dk, vd);
    // (A pixel covers far more of the sheet along the eye's line than across it: a hairline that runs across the view
    // is measured against that, and thins away with distance instead of breaking into dots.)
    float wpx = px * mix(1.0, 1.0 / max(-dir.z, 0.05), abs(side));
    hairs += (1.0 - smoothstep(0.45 * wpx, 1.0 * wpx, dl)) * min(1.0, 1.5 * px / wpx) * cut * (k == 2 ? 0.6 : 1.0);
    float dist = (side > 0.0 ? 1.0 - s : s) * gap;
    float vl = clamp(1.0 - dist / (abs(side) * DEEP_ICE + px), 0.0, 1.0);
    veils += vl * vl * cut * (0.25 + 0.75 * w2.a) * (k == 2 ? 0.6 : 1.0);
    // (The plates between the cracks do not lie quite level with each other.)
    tilt += (vec2(hash11(id * 3.7 + fk * 11.0), hash11(id * 5.1 + fk * 7.0)) - 0.5) * cut;
  }
  tiltOut = tilt * 0.028;
  float nearK = 1.0 - smoothstep(1.6, 4.0, px);
  col += white * (veils * 0.3 + hairs * 0.75) * mix(1.0, 0.5, uNight) * (0.35 + 0.65 * nearK);
  // Bubbles: white beads frozen in columns, the deeper ones seen nearer the eye and dimmer.
  if (nearK > 0.0) {
    float cl = smoothstep(0.5, 0.8, textureLod(uGrain, il / 1100.0 + 0.7, 0.0).b);
    // (They hang in clusters: between the clusters none is looked for.)
    if (cl > 0.0) {
      float bub = 0.0;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        bub += (1.0 - smoothstep(0.05, 0.13, textureLod(uGrain, (il + vd * (3.0 + 8.0 * fk)) / 640.0 + 0.13 + fk * 0.31, 0.0).a)) * (1.0 - 0.3 * fk);
      }
      col += white * bub * cl * nearK * 0.4;
    }
  }
  // The light that came through a plate lies in its shade: a blue-green pool in the ice, brightest at its core.
  col += mix(vec3(0.14, 0.7, 0.92) * S.key * 0.07, vec3(0.3, 0.74, 1.0) * S.key * 0.5, uNight) * gNmPool * (0.6 + 0.4 * under) * (1.0 + 2.0 * veils);
  // Meltwater standing on it: the ice under a film of water is darker and glassier, and its cracks are drowned.
  col *= 1.0 - 0.3 * wet;
  // The sky on it: little from above, more and more toward the horizon; all of it where meltwater lies.
  vec3 nr = normalize(vec3(-slope - tiltOut * (1.0 - wet), 1.0));
  float cosi = clamp(dot(-dir, nr), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  vec3 rf = reflect(dir, nr);
  rf.z = abs(rf.z) + 0.01;
  vec3 sky = nameSky(normalize(rf), 1.0 - wet);
  // (In a block's shade a little less of it: the frost on the ice is unlit there.)
  col = mix(col, sky, clamp(fres * mix(0.15, 0.3, uNight) * (1.0 + mix(1.5, 0.8, uNight) * wet) * (1.0 - 0.45 * shade), 0.0, 0.95));
  // The sun's path: under the sun the ice's scratches and its frost throw the light back in a long broken column that
  // comes down the lake toward the eye, close and bright far off, sparser near. A plate's shade cuts it.
  // (Before dawn it is the moon's, fainter and colder.)
  vec2 lxy = normalize(keyDir().xy);
  float al = dot(normalize(rf.xy + 1e-6), lxy);
  float path = exp(-(1.0 - al) / 0.002);
  if (path > 0.004 && shade < 1.0) {
    // (Long soft dashes that lie along the eye's line, as scratched ice gives a low sun back: never a point of light.)
    vec2 vq = vec2(dot(il, vec2(vd.y, -vd.x)), dot(il, vd));
    float ga = textureLod(uSnow, vq / vec2(300.0, 5200.0) + 0.17, 0.0).r;
    float gb = textureLod(uSnow, vq / vec2(900.0, 9000.0) + vec2(0.37, 0.11) + vec2(0.0, 0.002) * uTime, 0.0).g;
    float low = exp(-max(rf.z - keyDir().z, 0.0) / 0.3);
    float glint = 0.55 + 0.45 * smoothstep(-0.3, 0.6, ga + 0.6 * gb);
    col += mix(mix(S.band, vec3(1.0), 0.5) * 0.14, vec3(0.5, 0.62, 0.8) * 0.06, uNight) * path * low * glint * (1.0 - shade) * (1.0 - 0.5 * wet);
  }
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

#ifdef F_NAME
/**
 * What stands under the water. A plate that has gone down is still all
 * there: the eye's ray goes into the water in front of it, is bent down by
 * the surface, and meets the plate lower than it would have. So what is sunk
 * of each letter hangs under its waterline drawn short, pale turquoise near
 * the surface and lost in the deep further down, and every ripple shakes
 * it. onWater: how much of the pixel is open water.
 */
vec3 nameUnder(vec3 col, vec3 dir, float onWater) {
  float tW = (uCamPos.z + gFree) / -dir.z;
  vec3 at = uCamPos + dir * tW;
  // (A sunk plate is seen through water no further off than its own height.)
  float room = 1.2 * uNameB.z;
  if (at.x < uNameBx.x - room || at.x > uNameBx.z + room || at.y < uNameBx.y - 2.2 * room || at.y > uNameBx.w + room) return col;
  // The surface there: the simulation's waves and the pool's own small ripples.
  vec2 slope = textureLod(uWave, simUv(at.xy), 0.0).zw * 2.2;
  slope += (textureLod(uGrain, at.xy / 96.0 + vec2(0.011, 0.007) * uTime, 0.0).gb - 0.5) * 0.07;
  // (Bent a little less than water truly bends it: from this low the sunk part of a letter would be drawn a third as
  // tall as it is. It is drawn short, and moves with the surface, and that says water.)
  vec3 rr = normalize(mix(dir, refract(dir, normalize(vec3(-slope, 1.0)), 0.752), 0.55));
  for (int i = 0; i < PLATES; i++) {
    float tH;
    vec3 pl;
    vec3 nl;
    vec2 grad;
    float sd;
    float thick;
    float kind;
    float cov = plateHit(i, at, rr, tH, pl, nl, grad, sd, thick, kind);
    if (cov <= 0.0) continue;
    vec3 c = plateLook(i, pl, nl, grad, rr, tW + tH, sd, thick, kind, 1.0);
    // The water takes the red first and then the rest: pale turquoise just under the surface, the lake's own dark below.
    float down = max(-(at.z + rr.z * tH + gFree), 0.0);
    float path = tH + down;
    vec3 thru = exp(-path * mix(vec3(0.021, 0.0064, 0.0048), vec3(0.015, 0.0058, 0.0046), uNight));
    vec3 deep = mix(vec3(0.004, 0.035, 0.05) * (S.amb * 1.2 + S.key * 0.12), vec3(0.002, 0.009, 0.014) + uAurora * 0.004, uNight);
    c = c * mix(vec3(0.6, 0.94, 1.0), vec3(0.6, 0.9, 0.95), uNight) * thru + deep * (1.0 - thru.g);
    // (The surface gives back some of the sky over it: a little, from this high; and what is deep is dim.)
    col = mix(col, c, cov * (0.9 - 0.1 * uNight) * mix(1.0, thru.g, 0.4) * onWater);
  }
  return col;
}
#endif

vec3 nameIce(vec3 col, vec3 dir, float tG, float onIce, float tWall) {
  if (uNameG.w < 0.5) return col;
  nameFrame();
#ifndef DBG_NO_NFIELD
  if (tG < 1e8 && dir.z < -0.0006) col = nameField(col, uCamPos.xy + dir.xy * tG, dir, tG * uPxAng, onIce, tWall < 1e8 ? 0.0 : 1.0 - onIce);
#endif
#if defined(F_NAME) && !defined(DBG_NO_NHIT)
  // Most of the frame's rays pass nowhere near the plates: that is settled against the one box that holds all eight.
  {
    float top = 2.2 * uNameB.z;
    vec3 lo = vec3(uNameBx.xy, -gFree - top);
    vec3 hi = vec3(uNameBx.zw, top);
    vec3 inv = 1.0 / (abs(dir) + 1e-6) * sign(dir + 1e-9);
    vec3 ta = (lo - uCamPos) * inv;
    vec3 tb = (hi - uCamPos) * inv;
    vec3 tn = min(ta, tb);
    vec3 tf = max(ta, tb);
    if (max(max(tn.x, tn.y), max(tn.z, 0.0)) >= min(min(tf.x, tf.y), tf.z)) return col;
  }
  // What stands under the water, seen through it: before the plates themselves, which stand in front of it.
  if (uNameM.z > 0.5 && tG < 1e8 && dir.z < -0.0006 && onIce < 1.0 && tWall >= 1e8) col = nameUnder(col, dir, 1.0 - onIce);
  // (The far row first: the near one stands in front of it.)
  for (int i = 0; i < PLATES; i++) {
    float tH;
    vec3 pl;
    vec3 nl;
    vec2 grad;
    float sd;
    float thick;
    float kind;
    float cov = plateHit(i, uCamPos, dir, tH, pl, nl, grad, sd, thick, kind);
    if (cov <= 0.0) continue;
    vec3 p = uCamPos + dir * tH;
    // Below the sheet's top a plate is seen only through an opening, and only if it stands nearer than the opening's far wall.
    if (p.z < 0.0 && tH > tG) {
      cov *= (1.0 - onIce) * step(tH, tWall);
      // (What stands under the water is seen through the water, bent by it: see nameUnder. Here, only what stands over it.)
      cov *= smoothstep(-0.6, 0.6, (p.z + gFree) / max(tH * uPxAng, 0.05));
    }
    if (cov <= 0.0) continue;
    // (Where words stand in the frame nothing is busy behind them: a berg that rides under them is let go there.)
    cov *= 1.0 - 0.85 * wordsNear();
    vec3 c = plateLook(i, pl, nl, grad, dir, tH, sd, thick, kind, 0.0);
    // (The plates stand close under the eye and are kept clear of most of the lake's haze; a berg far down the lake is in it.)
    col = mix(col, mix(c, inAir(c, dir, tH), mix(0.04, 0.7, smoothstep(1800.0, 5200.0, tH))), cov);
    gNmCov = max(gNmCov, cov);
  }
#endif
  return col;
}

#ifdef F_NAME
/**
 * What the plates do to the sheet they stand on, before the air. Each
 * throws a long shade toward the eye, away from the low sun behind it, and
 * the light that came through the plate lies in that shade: a blue-green
 * pool, brightest at its core. p: the place on the sheet's top; onIce: how
 * much of the pixel is that top.
 */
vec3 nameGround(vec3 col, vec2 p, vec3 dir, float foot, float onIce) {
  gNmShade = 0.0;
  gNmPool = 0.0;
  if (uNameG.w < 0.5 || onIce <= 0.0) return col;
  nameFrame();
  vec3 L = keyDir();
  if (L.z <= 0.02) return col;
  // (The shade lies from the plates away from the light, and is gone this far out.)
  const float REACH = 2400.0;
  vec2 way = normalize(L.xy) * REACH;
  vec2 lo = uNameBx.xy - max(way, 0.0) - 60.0;
  vec2 hi = uNameBx.zw - min(way, 0.0) + 60.0;
  if (p.x < lo.x || p.y < lo.y || p.x > hi.x || p.y > hi.y) return col;
  float shade = 0.0;
  float pool = 0.0;
  for (int i = 0; i < PLATES; i++) {
    float stands = uLtR[i].w;
    if (stands < 0.02) continue;
    vec4 A = uLtA[i];
    vec4 G = uLtG[i];
    vec3 o = qFrom(uLtQ[i], vec3(p, 0.0) - A.xyz);
    vec3 d = qFrom(uLtQ[i], L);
    if (abs(d.y) < 0.03) continue;
    // (Toward the light, to the plate's middle plane.)
    float s = -o.y / d.y;
    if (s <= 0.0 || s > REACH) continue;
    vec2 h = o.xz + d.xz * s;
    if (abs(h.x) > G.z + 0.12 * A.w || abs(h.y) > 0.56 * A.w) continue;
    float soft = 1.2 + s * 0.022;
    float sdv = plateSd(i, h);
    float m = (1.0 - smoothstep(-soft, soft, sdv)) * exp(-s / 1250.0) * stands * (1.0 - smoothstep(0.46, 0.54, abs(h.y) / A.w));
    shade = max(shade, m);
    // (The light that came through lies in the shade's heart: a soft pool, never a second image of the letter.)
    pool = max(pool, (1.0 - smoothstep(-0.2 * A.w, 0.16 * A.w, sdv)) * exp(-s / (3.2 * A.w)) * stands * (1.0 - smoothstep(0.3, 0.54, abs(h.y) / A.w)));
  }
  // (It stops short of where the first frame's words stand: they stand on calm snow.)
  float keep = smoothstep(0.02, 0.2, wordsClear(p));
  shade *= keep;
  pool *= keep;
  gNmShade = shade;
  gNmPool = pool;
  // (On snow: a blue shade, with the turquoise of the plate lying in it.)
  vec3 dayS = mix(vec3(0.5, 0.63, 0.82), vec3(0.62, 0.98, 1.02), pool * 0.6);
  vec3 nightS = mix(vec3(0.72, 0.76, 0.84), vec3(0.8, 0.98, 1.04), pool * 0.5);
  return col * mix(vec3(1.0), mix(dayS, nightS, uNight), shade * onIce);
}
#endif

/**
 * The swept field, laid over the sheet after the air (it lies close under
 * the eye, and black ice in haze is grey): the bare ice, the drifts that
 * feather in across its edges, the blocks' image in it and in the open
 * water once it has opened, the meltwater at their feet, and the snow
 * blowing over it.
 */
// What the swept field is at this pixel's place on the lake, worked out once (nameCover) before the sheet's own top is
// drawn: how far out in the field the place is, how much of the pixel the bare ice covers, and the snow's level there.
float gNfD = 9.0;
float gNfK = 0.0;
float gNfLvlS = 0.0;
// The snow's three fields at that place (the broad drifts, the middle ones, the fine), as nameCover read them: the
// sheet's own top is drawn from the same three and takes them from here (w: 1 when they have been read).
vec4 gNfSnow = vec4(0.0);
/**
 * How much of a place on the sheet the swept field's bare ice covers, 0..1. Where it covers all of it the sheet's own
 * top is not seen at all, so the ground need not work it out. p, foot: the place and a pixel's size there.
 */
float nameCover(vec2 p, vec3 dir, float foot) {
  gNfD = 9.0;
  gNfK = 0.0;
  if (uNameG.w < 0.5) return 0.0;
  nameFrame();
  float d = nameSwept(p);
  gNfD = d;
  if (d > 1.32) return 0.0;
  vec2 il = p - uIce.xy;
  vec2 wl = RW * il;
  // The snow's own lie (the sheet's drifts are drawn from the same field): swept, there is less of it, and at the
  // field's heart none. What is left at the edges is the crests of the drifts, reaching in along the wind.
  float fin = textureLod(uSnow, wl / vec2(420.0, 110.0) + vec2(0.71, 0.29), 0.0).b;
  float bigS = textureLod(uSnow, wl / vec2(2290.0, 790.0), 0.0).r;
  float midS = textureLod(uSnow, wl / vec2(860.0, 195.0) + vec2(0.37, 0.11), 0.0).g;
  gNfSnow = vec4(bigS, midS, fin, 1.0);
  float lvl = 0.5 + 0.26 * bigS + 0.18 * midS + 0.085 * fin;
  float lvlS = lvl - 0.44 * (1.0 - smoothstep(0.5, 1.0, d)) - 0.12 * (1.0 - smoothstep(0.15, 0.6, d));
  // (How much of the sheet a pixel covers along the eye's line: far off, the finest of the drifts is under a pixel and is let go.)
  float footL = foot / max(-dir.z, 0.05);
  float ew = 0.004 + 0.005 * foot + 0.002 * footL;
  // (Before dawn the sheet round the field is clear dark ice already: no drift cuts into it.)
  float drift = smoothstep(0.5 - ew, 0.5 + ew, lvlS) * (1.0 - uNight);
  // (Past its edge the bare ice goes under a dusting, in streaks, not all at once.)
  float K = (1.0 - drift) * mix(1.0 - smoothstep(0.0, 0.03 + 0.004 * footL, d - 1.0 + (lvl - 0.5) * 0.6 + fin * 0.16 * (1.0 - smoothstep(4.0, 12.0, footL))), 1.0 - smoothstep(0.45, 1.3, d), uNight);
  // (The first frame's words stand at the foot of the frame, on calm snow: whatever the screen's shape, the bare ice and
  // the image in it stop short of them, under drifts.)
  // (Between the two blocks, where there are two, it may come on toward the eye.)
  // (They are measured in the first frame, and this is asked of the place on the lake, not of the pixel: where the
  // snow was left for the words it lies still when the eye has moved on, and no ruled line travels over the ice.)
  float dycH = p.y - uIceP.x;
  float zcH = max(dycH * uIceP.z + uIceP.y * uIceP.w, 1.0);
  vec2 hv = vec2(0.5 + 0.5 * (p.x - gNmC.x) / zcH / (uNameT * uLens.y), 0.5 + 0.5 * (dycH * uIceP.w - uIceP.y * uIceP.z) / zcH / uNameT);
  // (No longer: the eye now flies out over this ground, and a ruled side to the snow would be seen from there.)
  const float between = 0.0;
  // (By day the edge is drifted snow; before dawn the sheet there is dark ice too, and the image only fades.)
  // (The drifts only ever hold it further back from the words, never let it nearer.)
  float clearW = smoothstep(0.0, mix(0.008, 0.045, uNight), hv.y - mix(uNameW.z + 0.004, 0.0, between) - clamp(0.012 + (lvl - 0.5) * 0.05 + fin * 0.025, 0.0, 0.04) * (1.0 - uNight));
  // (On a small or a very wide screen the words stand right under the letters' feet: the ice is bare as far as the feet all the same,
  // so no letter ever stands on snow.)
  // (Never into the words themselves: where they stand that close, they win.)
  K *= max(clearW, smoothstep(-1.035, -1.005, nameSeat(p).y) * smoothstep(0.004, 0.012, hv.y - uNameW.z) * (1.0 - uNight));
  // (Before dawn, once the letters have gone and the sheet is plates, the plates here are rimed like the rest: pale tops on dark water.)
  K *= 1.0 - uNight * smoothstep(0.5, 0.64, uIceA.z);
  gNfK = K;
  gNfLvlS = lvlS;
  return K;
}

vec3 nameField(vec3 col, vec2 p, vec3 dir, float foot, float onIce, float onWater) {
  float d = gNfD;
  if (d > 1.32 || onIce + onWater <= 0.0) return col;
  float K = gNfK;
  // (Nothing of the field is at this pixel: no bare ice, and no water for the blocks' image to lie in.)
  if (K * onIce <= 0.0 && onWater <= 0.0) return col;
  float lvlS = gNfLvlS;
  vec2 il = p - uIce.xy;
  vec2 wl = RW * il;
  float footL = foot / max(-dir.z, 0.05);
  // How far the nearest plate's footing is. (Where the sheet's own field has just asked this of this very place, its answer is taken.)
  float fd = all(lessThan(abs(gFootAt - p), vec2(0.01))) ? gFootD : nameFoot(p);
  // The meltwater on the sheet at the blocks' feet: its edge wanders.
  float aaF = max(foot * 1.6, 1.2);
  float pond = 0.0;
  // (It wanders, more the further it has spread: further out than that there is none, and its edge is not looked for.)
  float wander = 0.5 + uNameP.x / 50.0;
  if (fd < uNameP.x + aaF + 15.0 * wander && onIce > 0.0) {
    float wob = ((textureLod(uGrain, p / 310.0, 0.0).g - 0.5) * 22.0 + (textureLod(uGrain, p / 71.0 + 0.3, 0.0).b - 0.5) * 7.0) * wander;
    pond = (1.0 - smoothstep(uNameP.x - aaF, uNameP.x + aaF, fd + wob)) * onIce;
  }
  vec2 slope = vec2(0.0);
  vec2 pw = p + dir.xy / max(-dir.z, 1e-3) * gFree;
  // (A film of it lies on the ice well out in front of them, thinner with distance: the pointer's waves run in all of it.)
  float film = (1.0 - smoothstep(uNameP.x * 3.0, uNameP.x * 8.0, fd)) * onIce;
  if (film > 0.0 || onWater > 0.0) {
    // (The waves the pointer and the melt make in it, and at the feet its own: the air moves it a little, always.)
    slope = textureLod(uWave, simUv(mix(pw, p, onIce)), 0.0).zw * 1.1 * max(film, onWater);
    slope += ((textureLod(uGrain, p / 96.0 + vec2(0.011, 0.007) * uTime, 0.0).gb - 0.5) * 0.05 + (textureLod(uGrain, p / 41.0 - vec2(0.017, 0.009) * uTime + 0.4, 0.0).gb - 0.5) * 0.03) * max(pond, onWater);
  }
  vec2 tilt = vec2(0.0);
  if (DBG_FLOOR K * onIce > 0.0) {
    vec3 fl = nameFloor(p, il, dir, foot, gNmShade, pond, slope, tilt);
    // (A dusting lies on the ice ahead of each drift.)
    float dust = smoothstep(0.12, 0.5, lvlS) * 0.18 * (1.0 - uNight);
    fl = mix(fl, mix(vec3(0.9, 0.92, 0.95) * (S.key * 0.24 * (1.0 - 0.5 * gNmShade) + S.amb * 0.8), vec3(0.4, 0.47, 0.6) * (S.amb * 1.4), uNight), dust);
    // (A dark wet line where each plate meets the sheet.)
    fl *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 4.0, fd));
    col = mix(col, mix(fl, inAir(fl, dir, length(vec3(p, 0.0) - uCamPos)), 0.07), K * onIce);
  }
  // The sheet's fractures on the bare ice, and those that run out from the plates' feet as the sheet weakens: each
  // a break going down into the ice, white where it catches the light, uneven in width, and dark along its middle
  // where it has begun to open.
  if (K * onIce > 0.0 && footL < 16.0) {
    float cw = max(foot * 0.9, 0.5);
    float crk = gIceCr;
    float wide = 1.0;
    if (uNameP.z > 0.0) {
      // (They leave the rows at their own angles, wander, and stop: none is ruled, none crosses the whole field.)
      vec2 q2 = p + textureLod(uSnow, il / vec2(700.0, 520.0) + 0.37, 0.0).rg * 90.0 + (textureLod(uGrain, il / 170.0, 0.0).gb - 0.5) * 9.0;
      float len = uNameB.z * 4.6 * uNameP.z;
      for (int i = 0; i < PLATES; i++) {
        float fi = float(i);
        vec4 row = i < 4 ? uRowA : uRowB;
        float fx = (fi - (i < 4 ? 1.5 : 5.5)) / 1.5;
        vec2 a = row.xy + vec2(fx * row.z * 0.86, 0.0);
        float ang = fx * 0.75 + (hash11(fi * 3.7 + 1.3) - 0.5) * 1.1;
        vec2 d = vec2(sin(ang), (i == 2 || i == 5 ? 1.0 : -1.0) * cos(ang));
        float l = len * (0.5 + 0.7 * hash11(fi * 5.1 + 2.2));
        float t = clamp(dot(q2 - a, d), 0.0, l);
        float di = length(q2 - a - d * t) + 6.0 * smoothstep(0.7, 1.0, t / l);
        if (di < crk) { crk = di; wide = 0.6 + 1.6 * (1.0 - t / l) * uNameP.w; }
      }
    }
    if (crk < 24.0 * cw) {
      float un = 0.6 + 0.8 * textureLod(uGrain, il / 230.0 + 0.6, 0.0).r;
      vec3 whiteF = mix(vec3(0.88, 0.94, 1.0) * (S.amb * 1.1 + S.key * 0.15 * (1.0 - gNmShade)), vec3(0.5, 0.64, 0.78) * (S.amb * 2.4 + uAurora * 0.2 + S.key * 0.6), uNight);
      // (The break below its top edge, seen a little toward the eye.)
      float veil = exp(-crk / (3.0 * cw * un)) * 0.16 + (1.0 - smoothstep(0.4 * cw, 1.1 * cw * un, crk)) * 0.5;
      col = mix(col, whiteF, clamp(veil, 0.0, 1.0) * K * onIce * (1.0 - 0.5 * pond) / max(1.0, 0.5 * cw));
      col *= 1.0 - 0.85 * (1.0 - smoothstep(0.25 * cw * wide, 0.7 * cw * wide, crk)) * K * onIce * min(1.0, wide);
    }
  }
  // The plates' image: once, in the black ice. Sharp at each foot, it is gone a little over half the plate's height
  // down, where the ice's scratches and its frost take over; meltwater standing on the ice holds it clearer, and the
  // pointer's waves in that water shake it.
#ifdef F_NAME
  float mirK = K * onIce;
  if (DBG_MIR mirK > 0.0 && fd < 3.2 * uNameB.z) {
    vec3 from = vec3(p, 0.0);
    vec3 rf = normalize(vec3(dir.xy + slope * 4.0 + tilt * 0.35 * (1.0 - pond), -dir.z));
    float mir = 0.0;
    vec3 mc = vec3(0.0);
    for (int i = 0; i < PLATES; i++) {
      float stands = uLtR[i].w;
      if (stands < 0.02) continue;
      vec4 A = uLtA[i];
      vec4 G = uLtG[i];
      vec3 o = qFrom(uLtQ[i], from - A.xyz);
      vec3 d = qFrom(uLtQ[i], rf);
      if (d.y < 0.03) continue;
      // (To the plate's sawn front.)
      float s2 = (-G.w - o.y) / d.y;
      if (s2 <= 0.0) continue;
      vec2 h = o.xz + d.xz * s2;
      float zUp = h.y / A.w + 0.5;
      if (abs(h.x) > G.z + 0.04 * A.w || zUp > 0.64 || zUp < -0.02) continue;
      float sdm = plateSd(i, h);
      float m = (1.0 - smoothstep(-0.5 - s2 * 0.012, 0.5 + s2 * 0.03, sdm)) * (1.0 - smoothstep(0.0, 0.6, zUp)) * stands;
      if (m > mir) {
        mir = m;
        mc = plateLook(i, vec3(h.x, -G.w, h.y), vec3(0.0, -1.0, 0.0), gNmGrad, rf, s2 + length(from - uCamPos), sdm, 2.0 * G.w, 0.0, 1.0);
      }
    }
    col = mix(col, mc * mix(vec3(0.7, 0.84, 0.98), vec3(0.6, 0.78, 0.95), uNight), mir * mix(0.46, 0.66, pond) * mirK);
  }
#endif
  // Snow snakes: thin streamers the wind drives across the bare ice.
  if (DBG_SNAKE K * onIce > 0.0) {
    float gust = smoothstep(-0.1, 0.35, textureLod(uSnow, (wl - vec2(uTime * 40.0, 0.0)) / vec2(5200.0, 2300.0) + 0.61, 0.0).b);
    // (They come in gusts: between two gusts, and under the meltwater, there is none to look for.)
    if (gust > 0.0 && pond < 1.0) {
      vec2 ws = wl - vec2(uTime * 85.0, 0.0);
      float wander = textureLod(uSnow, wl / vec2(2600.0, 1900.0) + 0.43, 0.0).g;
      float sn = textureLod(uSnow, (ws + vec2(0.0, wander * 260.0)) / vec2(1500.0, 150.0) + vec2(0.13, 0.57), 0.0).r + 0.5 * textureLod(uSnow, (ws * 1.3 + vec2(0.0, wander * 180.0)) / vec2(640.0, 64.0) + vec2(0.7, 0.2), 0.0).g;
      // (Far off a streamer is thinner than a pixel: there it is a soft veil, not a dotted line.)
      float thinK = clamp(footL / 50.0, 0.0, 0.35);
      float snake = smoothstep(0.42 - thinK, 0.78 + 0.3 * thinK, sn) * gust * (1.0 - 1.6 * thinK);
      col = mix(col, mix(vec3(0.9, 0.92, 0.95) * (S.key * 0.24 * (1.0 - 0.5 * gNmShade) + S.amb * 0.8), vec3(0.36, 0.44, 0.58) * (S.amb * 1.5), uNight), snake * 0.34 * K * onIce * (1.0 - pond));
    }
  }
  return col;
}
`;
