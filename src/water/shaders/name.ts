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
uniform vec4 uLtM0[PLATES]; // the same the other way, as three rows: a place in the world, in the plate's own frame (xyz the row, w what is added)
uniform vec4 uLtM1[PLATES];
uniform vec4 uLtM2[PLATES];
uniform vec4 uLtG[PLATES]; // xy: where its outline's middle lies in the raster, z: half its width, w: half its depth
uniform vec4 uLtT;         // the raster: xy: how far a capital's height is in it, zw: how far from a cell's middle an outline is looked for, in capitals' heights
uniform vec4 uRowT[2];     // each row whole in the raster (the far one, the near one): xy where its middle and its baseline lie, z: how far from its middle it is looked for, in capitals' heights
uniform vec4 uRowH;        // xy: each row's capitals' height, zw: 0..1 how much of each row still stands in the light
uniform vec4 uNameBx;      // the ground all eight plates stand or ride on: xy its least corner, zw its greatest
uniform vec4 uFrac[PLATES]; // the fractures that run out from the rows as the sheet weakens: xy where each leaves its row, zw the way it runs
uniform float uFracL[PLATES]; // how long each is, as a share of the longest

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

/**
 * A row's outline, as its plates stand side by side: the distance, in world
 * units, from a place in the row's upright plane (x across from its middle,
 * z up from the sheet) to the nearest letter's edge, negative inside. What is
 * asked of a whole row at once (its shade, its image in the ice) asks this,
 * so no plate need be found first.
 */
float rowSd(int r, vec2 xz) {
  float H = r == 0 ? uRowH.x : uRowH.y;
  vec4 T = uRowT[r];
  vec2 c = xz / H;
  vec2 cc = vec2(clamp(c.x, -T.z, T.z), clamp(c.y, -0.13, 1.13));
  vec4 s = textureLod(uIceSdf, T.xy + cc * uLtT.xy, 0.0);
  gNmGrad = s.ba;
  return (s.r + length(c - cc)) * H;
}

#ifdef F_NAME
vec3 qTo(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec3 qFrom(vec4 q, vec3 v) { return v - 2.0 * cross(q.xyz, q.w * v - cross(q.xyz, v)); }

/**
 * A plate's outline: the distance, in world units, from a place in the
 * plate's own upright plane (x across, z up, from its middle) to the
 * letter's edge, negative inside. cell: where the plate's outline lies in
 * the raster; H: its capitals' height. (A plate's own numbers are handed in,
 * never looked up by a number worked out for the pixel: that is slow here.)
 */
float plateSd(vec2 cell, float H, vec2 xz) {
  vec2 c = xz / H;
  vec2 cc = clamp(c, -uLtT.zw, uLtT.zw);
  vec4 s = textureLod(uIceSdf, cell + cc * uLtT.xy, 0.0);
  gNmGrad = s.ba;
  return (s.r + length(c - cc)) * H;
}

/**
 * Where a piece has come away at an arris: 0..1, how much of a chip lies at
 * a place on a plate's face (c: capitals' heights from its middle). A chip
 * has flat sides. (It is drawn on the face, not cut from the plate: the
 * plate's own shape is its sawn outline, which is what a ray is tried
 * against.)
 */
float plateChip(float fi, vec2 c) {
  float a = sin(c.x * 12.0 + fi * 7.1 + 2.3 * sin(c.y * 9.0 + fi));
  float b = sin(c.y * 15.0 + 1.9 * sin(c.x * 7.0 + 2.0 * fi) + fi * 3.3);
  return clamp((a * b - 0.86) * 9.0, 0.0, 1.0);
}

// A ray in a plate's own frame, and where it crosses the plate's box (gPlA: in, gPlB: out; none when in >= out).
vec3 gPlO = vec3(0.0);
vec3 gPlD = vec3(0.0, 1.0, 0.0);
vec3 gPlN = vec3(0.0);
vec3 gPlF = vec3(0.0);
/** Where a ray crosses plate i's own box: x where it goes in, y where it comes out (x >= y: it does not). Sets gPlO, gPlD, gPlN (the box's faces it comes in by). */
vec2 plateBox(int i, vec3 ro, vec3 rd) {
  vec4 A = uLtA[i];
  vec4 G = uLtG[i];
  vec4 m0 = uLtM0[i];
  vec4 m1 = uLtM1[i];
  vec4 m2 = uLtM2[i];
  gPlO = vec3(dot(m0.xyz, ro) + m0.w, dot(m1.xyz, ro) + m1.w, dot(m2.xyz, ro) + m2.w);
  gPlD = vec3(dot(m0.xyz, rd), dot(m1.xyz, rd), dot(m2.xyz, rd));
  vec3 hb = vec3(G.z + 0.02 * A.w, G.w, 0.5 * A.w);
  vec3 inv = 1.0 / (abs(gPlD) + 1e-6) * sign(gPlD + 1e-9);
  vec3 ta = (-hb - gPlO) * inv;
  vec3 tb = (hb - gPlO) * inv;
  vec3 tn = min(ta, tb);
  vec3 tf = max(ta, tb);
  gPlN = tn;
  gPlF = hb;
  return vec2(max(max(tn.x, tn.y), max(tn.z, 0.0)), min(min(tf.x, tf.y), tf.z));
}

/**
 * A ray against one plate, inside that plate's box (ab: where the ray
 * crosses it, as plateBox gave it, with the ray in the plate's frame: o, d,
 * and tn the faces it comes in by). Returns how much of the pixel the plate
 * covers. tH: where the ray meets it; pl: that place in the plate's own
 * frame; nl: the face's normal there; grad: the outline's gradient; sd: the
 * outline's distance; thick: how much ice the ray then crosses; kind: 0 the
 * sawn front, 1 the back, 2 an edge (a side, a top).
 */
float plateHit(vec2 cell, float H, vec3 o, vec3 d, vec3 tn, vec2 ab, out float tH, out vec3 pl, out vec3 nl, out vec2 grad, out float sd, out float thick, out float kind) {
  tH = ab.x; pl = vec3(0.0); nl = vec3(0.0, -1.0, 0.0); grad = vec2(0.0, 1.0); sd = 1e3; thick = 0.0; kind = 0.0;
  if (ab.x >= ab.y) return 0.0;
  // How fast the ray crosses the outline's plane, and what a pixel spans there.
  float rate = length(d.xz) + 1e-4;
  float aa = 0.75 * ab.x * uPxAng;
  float t = ab.x;
  float best = 1e3;
  bool hit = false;
  bool first = false;
  for (int k = 0; k < 5; k++) {
    float s = plateSd(cell, H, o.xz + d.xz * t);
    if (s < best) { best = s; tH = t; grad = gNmGrad; }
    if (s < 0.0) { hit = true; first = k == 0; break; }
    t += max(s, 0.3 * aa + 0.04) / rate;
    if (t > ab.y) break;
  }
  if (best > aa) return 0.0;
  sd = best;
  pl = o + d * tH;
  vec2 gd = normalize(grad + vec2(1e-4, 0.0));
  if (hit && first && tn.y >= tn.x && tn.y >= tn.z) {
    kind = d.y > 0.0 ? 0.0 : 1.0;
    nl = vec3(0.0, d.y > 0.0 ? -1.0 : 1.0, 0.0);
  } else if (hit && first && tn.z > tn.y && tn.z >= tn.x) {
    // (A sawn top, or the foot it stood on.)
    kind = 2.0;
    nl = vec3(0.0, 0.0, d.z > 0.0 ? -1.0 : 1.0);
    grad = vec2(0.0, nl.z);
  } else {
    kind = 2.0;
    nl = vec3(gd.x, 0.0, gd.y);
  }
  // Where the ray leaves the plate's depth: how much ice it crosses.
  float sB = plateSd(cell, H, o.xz + d.xz * ab.y);
  float s0 = min(best, -0.01);
  thick = (ab.y - tH) * (sB < 0.0 ? 1.0 : clamp(-s0 / (sB - s0), 0.05, 1.0));
  // (An edge that the ray only grazes covers part of the pixel; one it goes in by covers it all.)
  return 1.0 - smoothstep(-aa, aa, hit && !first ? -aa : min(best, hit ? sB : best));
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
 * far shore, the pale sheet under them, the dark ice near by. (A few mixes:
 * it is asked for every pixel of a plate.)
 */
vec3 nameEnv(float h) {
  vec3 sky = mix(mix(S.hor, S.mid, smoothstep(0.0, 0.2, h)), S.zen, smoothstep(0.07, 0.62, h)) + uAurora * 0.5 * smoothstep(0.2, 0.6, h);
  vec3 shore = mix(vec3(0.3, 0.4, 0.56) * (S.amb * 1.5 + S.key * 0.05), S.hor * 0.5 + vec3(0.01, 0.014, 0.022), uNight);
  vec3 far = mix(vec3(0.8, 0.86, 0.93) * (S.amb * 1.1 + S.key * 0.16), vec3(0.2, 0.26, 0.36) * S.amb * 2.4, uNight);
  vec3 up = mix(shore, sky, smoothstep(0.012, 0.07, h));
  vec3 down = mix(far, nameLake(), smoothstep(0.015, 0.2, -h));
  return h >= 0.0 ? up : down;
}

#ifdef F_NAME
/**
 * The ice of a plate where the eye's ray meets it. The rest as plateHit gave
 * them; rd: the ray, in the world; t: how far along it; soft: 1 when the
 * plate is drawn as its image in the ice or through the water (its finest
 * inner work is let go).
 */
vec3 plateLook(vec4 A, vec4 Q, vec4 G, float fi, vec3 pl, vec3 nl, vec2 grad, vec3 rd, float t, float sd, float thick, float kind, float soft) {
  float H = A.w;
  vec3 n = qTo(Q, nl);
  vec3 L = keyDir();
  float px = max(t * uPxAng, 0.02);
  // The place on the letter, in capitals' heights from its middle; how far up it; how far in from its edge.
  vec2 c = pl.xz / H;
  float hK = clamp(c.y + 0.5, 0.0, 1.0);
  float e = max(-sd, 0.0) / H;
  float yd = clamp(0.5 + 0.5 * pl.y / max(G.w, 1.0), 0.0, 1.0);
  float isF = kind < 1.5 ? 1.0 : 0.0;
  vec2 gd = normalize(grad + vec2(1e-4, 0.0));
  // A place on the face, in a measure that is the world's on a wide screen: on a sawn face, the letter's own; on an edge, along the outline and back through the plate.
  vec2 q = mix(vec2(dot(c, vec2(-gd.y, gd.x)) * 232.0 + 113.0 + fi * 37.0, pl.y / H * 370.0 + 57.0), c * 232.0 + fi * 61.0, isF);
  float pxq = px * 232.0 / H;
  float wet = uNameP.y;
  // How upright it stands (1), or lies afloat (0): a plate lying in the water has only the sky over it.
  vec3 upW = qTo(Q, vec3(0.0, 0.0, 1.0));
  float up = clamp(upW.z, 0.0, 1.0);
  float live = 1.0 - soft;

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
  // (Before dawn the plates are ice in moonlight: clear and dark in the body, the sky's own colour in the frost of
  // their sawn faces, and the moon in their edges. As the first screen comes up the light arrives across them, from
  // the moon's side to the other.)
  vec3 keyP = mix(S.key, vec3(dot(S.key, vec3(0.2126, 0.7152, 0.0722))), 0.74 * uNight) * mix(1.0, mix(0.3, 1.0, smoothstep(0.0, 0.3, uArrive * 1.45 - vUv.x)), uNight);
  vec3 behind = mix(S.key * (0.05 + 0.23 * tw) * (0.3 + 0.7 * up) + S.amb * 0.56, keyP * (0.05 + 0.62 * tw) + S.amb * 0.8 + uAurora * 0.03, uNight);
  // It deepens toward the foot: the light has further to come down the plate, and the black ice under it gives none back.
  float deep = mix(mix(0.22, 0.56, uNight), 1.0, smoothstep(0.0, 0.7, hK)) * mix(1.0, 0.78, (1.0 - up) * (1.0 - uNight));
  vec3 footT = exp(-vec3(3.6, 0.42, 0.2) * (1.0 - hK) * (1.0 - hK) * up * (1.0 - 0.5 * uNight));
  vec3 col = behind * T * footT * deep;
  // Which way the light comes along the face: an edge turned to the sun is where it pours in.
  vec3 Ll = qFrom(Q, L);
  vec2 sunG = normalize(Ll.xz + vec2(1e-4, 0.3));
  float toSun = clamp(0.5 + 0.5 * dot(gd, sunG), 0.0, 1.0);
  vec3 cold = mix(vec3(1.0, 0.97, 0.9), vec3(0.91, 0.96, 1.0), uNight);
  vec3 keyL = mix(S.key, keyP * 4.8 + S.amb * 1.0, uNight);
  vec3 skyLit = mix(S.amb * 1.3 + S.key * 0.03, mix(S.amb, vec3(dot(S.amb, vec3(0.3333))), 0.75) * 2.7 + uAurora * 0.1 + keyP * 0.45, uNight);
  vec3 lake = nameLake();

  // What is in it, read once for a face and an edge alike: slow clouds of trapped air, curtains drawn up through
  // the ice, and fracture planes seen a little way in (they shift against the face as the eye moves).
  vec2 across = vec2(dot(rd, qTo(Q, vec3(1.0, 0.0, 0.0))), dot(rd, upW)) / max(-dot(rd, n), 0.3);
  vec4 sm = textureLod(uSnow, q / vec2(820.0, 960.0) + 0.37, 0.0);
  float streak = textureLod(uSnow, vec2(q.x / 330.0, q.y / 2700.0) + 0.23, 0.0).g;
  vec4 fp = textureLod(uSnow, (q + across * 34.0) / vec2(430.0, 610.0) + 0.61 + fi * 0.17, 0.0);
  // The saw's marks: fine, nearly level, each blade's pass a little brighter or duller than the last.
  float ang = (fract(fi * 0.618 + 0.3) - 0.5) * 0.36;
  vec2 sw = vec2(q.x + q.y * ang, q.y - q.x * ang);
  vec4 gs = textureLod(uGrain, vec2(sw.x / 7000.0, sw.y / 330.0) + 0.21, 0.0);
  float mark = (gs.g - 0.5) * (1.0 - smoothstep(1.0, 3.0, pxq)) + (gs.b - 0.5) * 0.5 + 0.35 * streak;

  // ---- a sawn face: the letter itself.
  float cloud = smoothstep(0.08, 0.62, sm.r * 0.9 + streak * 0.6 + 0.25 * (hK - 0.5)) * (1.0 - 0.4 * wet);
  vec3 face = mix(col, behind * (0.4 + 0.6 * T) * vec3(0.86, 0.94, 0.98) * mix(0.8, 1.0, hK), cloud * 0.36);
  // Where there is no air in it the eye goes through the plate to the dark ice beyond it.
  float clearK = (1.0 - cloud) * smoothstep(0.2, -0.3, sm.g);
  face = mix(face, lake * T + face * 0.42, clearK * mix(0.5, 0.36, uNight) * up);
  // Fracture planes: each a hairline where it breaks the light, and on one side of it the break itself, a pale
  // sheet going back into the ice that the light behind fills. They come and go a little as that light shifts.
  float lineW = 0.012 + 0.02 * pxq;
  float hair = (1.0 - smoothstep(0.0, lineW, abs(fp.r))) + 0.7 * (1.0 - smoothstep(0.0, lineW, abs(fp.b - 0.12)));
  float sheet = step(0.0, fp.r) * exp(-fp.r * 9.0) + 0.6 * step(0.12, fp.b) * exp(-(fp.b - 0.12) * 12.0);
  float cut = smoothstep(-0.1, 0.25, fp.g);
  float shift = 0.7 + 0.5 * sin(uTime * 0.45 + fp.g * 9.0 + fi);
  face += cold * (keyL * mix(0.16, 0.04, uNight) + S.amb * 0.4 + uAurora * 0.1) * (hair * 0.3 + sheet * 0.34 * shift) * cut * (0.4 + 0.6 * live) * (0.5 + 0.5 * T);
  face *= 1.0 + 0.3 * mark;
  // The frost the saw left holds the sky's light: this is what makes a clear plate a letter. (Under its top a plate
  // is rimed; toward its foot it is wet and clear. Its edges are clear: the frost stops a finger's breadth short of every arris.)
  float frost = clamp(mix(0.24, 0.2, uNight) + 0.3 * mark + 0.16 * smoothstep(0.55, 1.0, hK) - 0.12 * (1.0 - hK), 0.04, 0.8) * (1.0 - 0.45 * wet);
  float edge = 1.0 - smoothstep(0.003, 0.014, e);
  face = mix(face, vec3(0.9, 0.94, 0.98) * skyLit * (0.86 + 0.28 * hK), frost * (1.0 - edge));
  // The arris. The ice is thin there and the light pours through: brightest on the edges turned to the sun; and it
  // comes on into the ice a hand's breadth, so a thin stroke is lit right through and a broad one has a deeper heart.
  float sunE = toSun * toSun * toSun;
  face += cold * (keyL * mix(0.26, 0.7, uNight) + S.amb * 0.4) * (mix(0.04, 0.2, uNight) + mix(0.96, 0.8, uNight) * sunE) * exp(-e / mix(0.009, 0.02, uNight)) * (0.35 + 0.65 * up);
  face += vec3(0.62, 0.95, 1.0) * (keyL * 0.08 + S.amb * 0.1) * toSun * toSun * exp(-e / 0.06) * (0.4 + 0.6 * up);
  // Through the clear edge what stands behind is seen, bent: over a top edge the far shore and the sky, at a side the dark ice.
  face = mix(face, mix(lake, skyLit * vec3(0.8, 0.9, 1.0), smoothstep(0.3, 0.9, gd.y) * up) * (0.6 + 0.4 * T) + face * 0.5, edge * 0.42 * live);
  // A chip at an arris: a clean break, clear ice that the light finds.
  float chip = plateChip(fi, c) * (1.0 - smoothstep(0.012, 0.05, e)) * live;
  face += cold * (keyL * 0.2 + S.amb * 0.7) * chip * (0.4 + 0.6 * toSun);
  // A line of rime along a top edge, where the wind has left it.
  float rime = exp(-e / 0.008) * smoothstep(0.55, 0.95, gd.y) * (1.0 - wet) * smoothstep(0.3, 0.6, gs.a + 0.25);
  face = mix(face, vec3(0.95, 0.97, 1.0) * skyLit * 1.25, rime * 0.75 * up);
  // Meltwater runs down it in its own lanes: a moving sheen.
  float lane = smoothstep(0.0, 0.3, sm.b + 0.4 * streak);
  float gw = 0.5 + 0.5 * sin((q.y + uTime * (26.0 + 26.0 * lane)) / 38.0 + sm.r * 9.0 + q.x / 17.0);
  face *= 1.0 + wet * lane * (gw - 0.5) * 0.4 * live;
  face += (uAurora * 0.4 + S.amb * 0.25 * (1.0 - uNight)) * wet * lane * smoothstep(0.55, 0.95, gw) * live;

  // ---- an edge: a sawn side or a top, clear, the plate's whole body seen through it.
  vec3 side = col * (0.8 + 0.4 * (0.5 + streak));
  // (The side the sun comes in by is lit through from end to end.)
  side += vec3(0.6, 0.95, 1.0) * (keyL * 0.16 + S.amb * 0.2) * toSun * toSun * (0.4 + 0.6 * up);
  // (Its two sawn lines, front and back, each catch the light.)
  float ar = exp(-min(yd, 1.0 - yd) * 2.0 * G.w / (0.012 * H));
  side += cold * (keyL * 0.13 + S.amb * 0.35) * ar * (0.3 + 0.7 * toSun);
  side += cold * (keyL * 0.05 + S.amb * 0.3) * (hair * 0.5 + sheet * 0.4) * cut;
  side = mix(side, lake * (0.5 + 0.5 * T) + side * 0.5, 0.3 * live);
  // (A top is sawn and clear: a line of rime lies along its front edge and no more.)
  float top = smoothstep(0.5, 0.9, n.z) * up;
  side = mix(side, vec3(0.93, 0.95, 0.98) * skyLit, top * (1.0 - smoothstep(0.04, 0.2, yd)) * 0.6 * (1.0 - wet));

  col = mix(side, face, isF);
  // Every face is glass at a glance: it gives back what stands over it, more the more aslant the eye meets it.
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  float fr5 = 1.0 - cosi;
  float fres = 0.02 + 0.98 * fr5 * fr5 * fr5 * fr5 * fr5;
  vec3 rfl = reflect(rd, n);
  col = mix(col, nameEnv(rfl.z), fres * mix(0.9, 0.55 + 0.4 * wet, isF) * live);
  // (And the low sun itself on what is turned to it: a top, a lit flank.)
  float nh = max(dot(n, normalize(L - rd)), 0.0);
  float nh8 = nh * nh; nh8 *= nh8; nh8 *= nh8; nh8 *= nh8; nh8 *= nh8;
  col += keyL * nh8 * mix(nh8, 1.0, isF) * step(0.0, dot(n, L)) * mix(0.55, 0.1, isF) * (1.0 - 0.4 * uNight) * live;
  // Where it stands in water: wet and dark at the waterline.
  float zw = (A.xyz + qTo(Q, pl)).z + gFree;
  col *= 1.0 - 0.4 * uNameP.w * (1.0 - smoothstep(1.0, 9.0, zw)) * live;
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
  col = mix(col, sky, clamp(fres * mix(0.15, 0.3, uNight) * (1.0 + mix(0.9, 0.6, uNight) * wet) * (1.0 - 0.45 * shade), 0.0, 0.95));
  // The sun's path: under the sun the ice's scratches and its frost throw the light back in a long broken column that
  // comes down the lake toward the eye, close and bright far off, sparser near. A plate's shade cuts it.
  // (Before dawn it is the moon's, fainter and colder.)
  vec2 lxy = normalize(keyDir().xy);
  float al = dot(normalize(rf.xy + 1e-6), lxy);
  float path = exp(-(1.0 - al) / 0.002);
  if (path > 0.004 && shade < 1.0) {
    // (Long soft dashes that lie along the eye's line, as scratched ice gives a low sun back: never a point of light.)
    vec2 vq = vec2(dot(il, vec2(vd.y, -vd.x)), dot(il, vd));
    vec4 gp = textureLod(uSnow, vq / vec2(300.0, 5200.0) + vec2(0.17, 0.17 + 0.002 * uTime), 0.0);
    float low = exp(-max(rf.z - keyDir().z, 0.0) / 0.3);
    float glint = 0.55 + 0.45 * smoothstep(-0.3, 0.6, gp.r + 0.6 * gp.g);
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

// The plates' image in the ice at this pixel, as the swept field found it (the plate, the place on its face, how
// strong the image is there): it is given its ice with the plates themselves, in nameIce.
int gMirI = -1;
vec4 gMirH = vec4(0.0);
vec2 gMirG = vec2(0.0, 1.0);
float gMirK = 0.0;
vec3 gMirRd = vec3(0.0, 1.0, 0.0);
vec4 gMirPA = vec4(0.0, 0.0, 0.0, 1.0);
vec4 gMirPG = vec4(0.0);

vec3 nameIce(vec3 col, vec3 dir, float tG, float onIce, float tWall) {
  if (uNameG.w < 0.5) return col;
  nameFrame();
  gMirI = -1;
  gMirK = 0.0;
#ifndef DBG_NO_NFIELD
  if (tG < 1e8 && dir.z < -0.0006) col = nameField(col, uCamPos.xy + dir.xy * tG, dir, tG * uPxAng, onIce, tWall < 1e8 ? 0.0 : 1.0 - onIce);
#endif
#if defined(F_NAME) && !defined(DBG_NO_NHIT)
  // What of a plate this pixel shows, if anything: the plate itself; or, where the eye's ray goes into open water
  // before it meets one, the plate as it stands under the water (the ray is bent down by the surface, so what is
  // sunk of each letter hangs under its waterline drawn short, and every ripple shakes it); or the plate's image in
  // the ice. Whichever it is, its ice is worked out once.
  int bi = -1;
  float bCov = 0.0;
  float bT = 0.0;
  vec3 bPl = vec3(0.0);
  vec3 bNl = vec3(0.0, -1.0, 0.0);
  vec2 bGrad = vec2(0.0, 1.0);
  vec3 bK = vec3(0.0);
  float mode = 0.0;
  vec4 bA = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 bQ = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 bG = vec4(0.0);
  vec3 rdL = dir;
  float tW = 0.0;
  // Most of the frame's rays pass nowhere near the plates: that is settled against the one box that holds all eight.
  vec3 lo = vec3(uNameBx.xy, -gFree - 0.6 * uNameM.x);
  vec3 hi = vec3(uNameBx.zw, uNameM.x);
  vec3 inv = 1.0 / (abs(dir) + 1e-6) * sign(dir + 1e-9);
  vec3 ta = (lo - uCamPos) * inv;
  vec3 tb = (hi - uCamPos) * inv;
  vec3 tn = min(ta, tb);
  vec3 tf = max(ta, tb);
  if (max(max(tn.x, tn.y), max(tn.z, 0.0)) < min(min(tf.x, tf.y), tf.z)) {
    // The two plates whose boxes the ray comes to first: it may pass through the first one's open side and meet the next.
    int i1 = -1;
    int i2 = -1;
    vec2 ab1 = vec2(1e9);
    vec2 ab2 = vec2(1e9);
    vec3 o1 = vec3(0.0), d1 = vec3(0.0), n1_ = vec3(0.0), o2 = vec3(0.0), d2 = vec3(0.0), n2_ = vec3(0.0), f1 = vec3(1.0);
    vec4 A1 = vec4(0.0, 0.0, 0.0, 1.0), Q1 = vec4(0.0, 0.0, 0.0, 1.0), G1 = vec4(0.0), A2 = vec4(0.0, 0.0, 0.0, 1.0), Q2 = vec4(0.0, 0.0, 0.0, 1.0), G2 = vec4(0.0);
    for (int i = 0; i < PLATES; i++) {
      vec2 ab = plateBox(i, uCamPos, dir);
      if (ab.x >= ab.y) continue;
      if (ab.x < ab1.x) { i2 = i1; ab2 = ab1; o2 = o1; d2 = d1; n2_ = n1_; A2 = A1; Q2 = Q1; G2 = G1; i1 = i; ab1 = ab; o1 = gPlO; d1 = gPlD; n1_ = gPlN; f1 = gPlF; A1 = uLtA[i]; Q1 = uLtQ[i]; G1 = uLtG[i]; }
      else if (ab.x < ab2.x) { i2 = i; ab2 = ab; o2 = gPlO; d2 = gPlD; n2_ = gPlN; A2 = uLtA[i]; Q2 = uLtQ[i]; G2 = uLtG[i]; }
    }
    float tH;
    vec3 pl;
    vec3 nl;
    vec2 grad;
    float sd;
    float thick;
    float kind;
    for (int k = 0; k < 2; k++) {
      int ii = k == 0 ? i1 : i2;
      if (ii < 0 || bCov >= 0.99) break;
      float cov = plateHit(k == 0 ? G1.xy : G2.xy, k == 0 ? A1.w : A2.w, k == 0 ? o1 : o2, k == 0 ? d1 : d2, k == 0 ? n1_ : n2_, k == 0 ? ab1 : ab2, tH, pl, nl, grad, sd, thick, kind);
      float pz = uCamPos.z + dir.z * tH;
      // Below the sheet's top a plate is seen only through an opening, and only if it stands nearer than the opening's far wall.
      if (pz < 0.0 && tH > tG) {
        cov *= (1.0 - onIce) * step(tH, tWall);
        // (What stands under the water is seen through the water: below. Here, only what stands over it.)
        cov *= smoothstep(-0.6, 0.6, (pz + gFree) / max(tH * uPxAng, 0.05));
      }
      if (cov > bCov) { bi = ii; bCov = cov; bT = tH; bPl = pl; bNl = nl; bGrad = grad; bK = vec3(sd, thick, kind); bA = k == 0 ? A1 : A2; bQ = k == 0 ? Q1 : Q2; bG = k == 0 ? G1 : G2; }
    }
#ifndef DBG_NO_NUNDER
    if (bCov < 0.5 && uNameM.z > 0.5 && tG < 1e8 && dir.z < -0.0006 && onIce < 1.0 && tWall >= 1e8) {
      // Through the water. The surface there: the simulation's waves and the pool's own small ripples.
      tW = (uCamPos.z + gFree) / -dir.z;
      vec3 at = uCamPos + dir * tW;
      vec2 slope = textureLod(uWave, simUv(at.xy), 0.0).zw * 2.2;
      slope += (textureLod(uGrain, at.xy / 96.0 + vec2(0.011, 0.007) * uTime, 0.0).gb - 0.5) * 0.07;
      // (Bent a little less than water truly bends it: from this low the sunk part of a letter would be drawn a third
      // as tall as it is. It is drawn short, and moves with the surface, and that says water.)
      vec3 rr = normalize(mix(dir, refract(dir, normalize(vec3(-slope, 1.0)), 0.752), 0.55));
      // (The plate whose box the eye's own ray came to first is the one that stands in this water. The bent ray is
      // taken into that plate's own frame as the eye's ray was: a foundered plate leans only a little.)
      if (i1 >= 0) {
        vec3 oU = o1 + d1 * tW;
        vec3 dU = normalize(d1 + rr - dir);
        vec3 invU = 1.0 / (abs(dU) + 1e-6) * sign(dU + 1e-9);
        vec3 taU = (-f1 - oU) * invU;
        vec3 tbU = (f1 - oU) * invU;
        vec3 tnU = min(taU, tbU);
        vec3 tfU = max(taU, tbU);
        vec2 abU = vec2(max(max(tnU.x, tnU.y), max(tnU.z, 0.0)), min(min(tfU.x, tfU.y), tfU.z));
        float cov = plateHit(G1.xy, A1.w, oU, dU, tnU, abU, tH, pl, nl, grad, sd, thick, kind) * (1.0 - onIce);
        if (cov > bCov) { bi = i1; bCov = cov; bT = tH; bPl = pl; bNl = nl; bGrad = grad; bK = vec3(sd, thick, kind); mode = 1.0; rdL = rr; bA = A1; bQ = Q1; bG = G1; }
      }
    }
#endif
  }
  // (Where words stand in the frame nothing is busy behind them: a berg that rides under them is let go there.)
  bCov *= 1.0 - 0.85 * wordsNear();
  // Its image in the ice, where no plate itself is seen.
  if (bCov < 0.5 && gMirI >= 0 && gMirK > bCov) {
    bi = gMirI; bCov = gMirK; bT = gMirH.w; bPl = vec3(gMirH.x, -gMirPG.w, gMirH.y); bNl = vec3(0.0, -1.0, 0.0); bGrad = gMirG; bK = vec3(gMirH.z, 2.0 * gMirPG.w, 0.0); mode = 2.0; rdL = gMirRd; bA = gMirPA; bQ = vec4(0.0, 0.0, 0.0, 1.0); bG = gMirPG;
  }
  if (bi >= 0 && bCov > 0.0) {
#ifdef DBG_NO_NLOOK
    vec3 c = vec3(0.3, 0.6, 0.7);
#else
    vec3 c = plateLook(bA, bQ, bG, float(bi), bPl, bNl, bGrad, rdL, bT + tW, bK.x, bK.y, bK.z, mode > 0.5 ? 1.0 : 0.0);
#endif
    if (mode < 0.5) {
      // (The plates stand close under the eye and are kept clear of most of the lake's haze; a berg far down the lake is in it.)
      col = mix(col, mix(c, inAir(c, dir, bT), mix(0.04, 0.7, smoothstep(1800.0, 5200.0, bT))), bCov);
      gNmCov = max(gNmCov, bCov);
    } else if (mode < 1.5) {
      // The water takes the red first and then the rest: pale turquoise just under the surface, the lake's own dark below.
      float down = max(-(uCamPos.z + dir.z * tW + rdL.z * bT + gFree), 0.0);
      vec3 thru = exp(-(bT + down) * mix(vec3(0.021, 0.0064, 0.0048), vec3(0.015, 0.0058, 0.0046), uNight));
      vec3 deepW = mix(vec3(0.004, 0.035, 0.05) * (S.amb * 1.2 + S.key * 0.12), vec3(0.002, 0.009, 0.014) + uAurora * 0.004, uNight);
      c = c * mix(vec3(0.6, 0.94, 1.0), vec3(0.6, 0.9, 0.95), uNight) * thru + deepW * (1.0 - thru.g);
      // (The surface gives back some of the sky over it: a little, from this high; and what is deep is dim.)
      col = mix(col, c, bCov * (0.9 - 0.1 * uNight) * mix(1.0, thru.g, 0.4));
    } else {
      col = mix(col, c * mix(vec3(0.7, 0.84, 0.98), vec3(0.6, 0.78, 0.95), uNight), bCov);
    }
  }
#endif
  return col;
}

/**
 * What the plates do to the sheet they stand on, before the air. Each
 * throws a long shade toward the eye, away from the low sun behind it, and
 * the light that came through the plate lies in that shade: a blue-green
 * pool, brightest at its core. p: the place on the sheet's top; onIce: how
 * much of the pixel is that top. (It is the swept field's work, not the
 * plates' own: it lies a long way out from them, and the plates' own code is
 * carried only close round them.)
 */
vec3 nameGround(vec3 col, vec2 p, vec3 dir, float foot, float onIce) {
  gNmShade = 0.0;
  gNmPool = 0.0;
#ifdef DBG_NO_NGROUND
  return col;
#endif
  if (uNameG.w < 0.5 || onIce <= 0.0) return col;
  nameFrame();
  vec3 L = keyDir();
  if (L.z <= 0.02) return col;
  // (The shade lies from the plates away from the light, and is gone this far out.)
  const float REACH = 1100.0;
  vec2 way = normalize(L.xy) * REACH;
  vec2 lo = uNameBx.xy - max(way, 0.0) - 60.0;
  vec2 hi = uNameBx.zw - min(way, 0.0) + 60.0;
  if (p.x < lo.x || p.y < lo.y || p.x > hi.x || p.y > hi.y) return col;
  // (Each row is taken as it stands, upright: the plate of it whose shade this place can lie in is found by its
  // place across the row, and that one's outline is looked at once.)
  float shade = 0.0;
  float pool = 0.0;
  for (int r = 0; r < 2; r++) {
    bool near = r == 1;
    vec4 row = near ? uRowB : uRowA;
    float H = near ? uRowH.y : uRowH.x;
    float stands = (near ? uRowH.w : uRowH.z) * (near || uNameG.z > 0.0 ? 1.0 : 0.0);
    float s = (row.y - p.y) / L.y;
    vec2 h = vec2(p.x + L.x * s - row.x, L.z * s);
    float in_ = step(0.0, s) * step(s, REACH) * step(abs(h.x), row.z + 0.12 * H) * step(h.y, 1.06 * H);
    float soft = 1.2 + s * 0.022;
    float sdv = rowSd(r, h);
    float fade = stands * in_ * (1.0 - smoothstep(0.6 * REACH, REACH, s));
    shade = max(shade, (1.0 - smoothstep(-soft, soft, sdv)) * exp(-s / 800.0) * fade * (1.0 - smoothstep(0.96, 1.04, h.y / H)));
    // (The light that came through lies in the shade's heart: a soft pool, never a second image of the letter.)
    pool = max(pool, (1.0 - smoothstep(-0.2 * H, 0.16 * H, sdv)) * exp(-s / (3.2 * H)) * fade * (1.0 - smoothstep(0.8, 1.04, h.y / H)));
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
#ifndef DBG_NO_NFRAC
  if (K * onIce > 0.0 && footL < 16.0) {
    float cw = max(foot * 0.9, 0.5);
    float crk = gIceCr;
    float wide = 1.0;
    if (uNameP.z > 0.0) {
      // (They leave the rows at their own angles, wander, and stop: none is ruled, none crosses the whole field.)
      vec2 q2 = p + textureLod(uSnow, il / vec2(700.0, 520.0) + 0.37, 0.0).rg * 90.0;
      float len = uNameB.z * 4.6 * uNameP.z;
      for (int i = 0; i < PLATES; i++) {
        vec4 fr = uFrac[i];
        float l = len * uFracL[i];
        vec2 v = q2 - fr.xy;
        float t = clamp(dot(v, fr.zw), 0.0, l);
        float di = length(v - fr.zw * t) + 6.0 * smoothstep(0.7, 1.0, t / l);
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
#endif
  // The plates' image: once, in the black ice. Sharp at each foot, it is gone a little over half the plate's height
  // down, where the ice's scratches and its frost take over; meltwater standing on the ice holds it clearer, and the
  // pointer's waves in that water shake it.
#ifdef F_NAME
  float mirK = K * onIce;
  if (DBG_MIR mirK > 0.0 && fd < 290.0) {
    vec3 from = vec3(p, 0.0);
    vec3 rf = normalize(vec3(dir.xy + slope * 4.0 + tilt * 0.35 * (1.0 - pond), -dir.z));
    float mir = 0.0;
    int mi = -1;
    vec4 mh = vec4(0.0);
    vec2 mg = vec2(0.0, 1.0);
    // (Each row is taken as it stands, upright: the plate of it whose image this place can hold is found by its
    // place across the row, and that one's outline is looked at once. The near row's image is the one kept.)
    float ry = max(rf.y, 0.03);
    vec4 mA = vec4(0.0, 0.0, 0.0, 1.0);
    vec4 mG = vec4(0.0);
    for (int r = 0; r < 2; r++) {
      bool near = r == 1;
      vec4 row = near ? uRowB : uRowA;
      float H = near ? uRowH.y : uRowH.x;
      float stands = (near ? uRowH.w : uRowH.z) * (near || uNameG.z > 0.0 ? 1.0 : 0.0);
      // (To the row's sawn fronts.)
      float s2 = (row.y - row.w - from.y) / ry;
      vec2 h = vec2(from.x + rf.x * s2 - row.x, rf.z * s2);
      float zUp = h.y / H;
      float sdm = rowSd(r, h);
      float m = (1.0 - smoothstep(-0.5 - s2 * 0.012, 0.5 + s2 * 0.03, sdm)) * (1.0 - smoothstep(0.0, 0.6, zUp)) * stands * step(0.0, s2) * step(abs(h.x), row.z + 0.04 * H);
      // (The image is given the row's own ice as a plate of its height and depth has it, a place on its face.)
      if (m > mir) { mi = r; mir = m; mh = vec4(h.x, h.y - 0.5 * H, sdm, s2); mg = gNmGrad; mA = vec4(row.x, row.y, 0.5 * H, H); mG = vec4(0.0, 0.0, row.z, row.w); }
    }
    // (It is given its ice with the plates themselves: see nameIce.)
    if (mi >= 0 && mir > 0.0) { gMirI = mi; gMirPA = mA; gMirPG = mG; gMirH = mh; gMirH.w += length(from - uCamPos); gMirG = mg; gMirK = mir * mix(0.46, 0.66, pond) * mirK; gMirRd = rf; }
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
