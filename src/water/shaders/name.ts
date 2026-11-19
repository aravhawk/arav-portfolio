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
 * the stations' common block (snowOn, inAir); and clearIce, fracture,
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
  // Small triangular bites in the sawn outline. The gradient follows
  // the two flanks, so a grazing ray sees a cut surface at each bite.
  vec2 along = vec2(0.73, 0.68);
  float coordinate = dot(c, along) * 9.0 + dot(cell,vec2(7.1,13.7));
  float phase = fract(coordinate) - 0.5;
  float depth = 0.023 * max(0.0, fract(floor(coordinate)*0.618+cell.x*17.0)-0.16);
  float chip = max(0.0, depth - abs(phase) * 0.19);
  gNmGrad = s.ba - (chip > 0.0 ? along * sign(phase) * 1.71 : vec2(0));
  return (s.r + length(c - cc) + chip) * H;
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
  vec3 hb = vec3(G.z + 0.02*A.w, G.w, 0.5*A.w);
  vec3 from = A.xyz-ro;
  vec3 normalDistance = from-rd*dot(from,rd);
  if (dot(normalDistance,normalDistance) > dot(hb,hb)+1.0) return vec2(1.0,0.0);
  vec4 m0 = uLtM0[i];
  vec4 m1 = uLtM1[i];
  vec4 m2 = uLtM2[i];
  gPlO = vec3(dot(m0.xyz, ro) + m0.w, dot(m1.xyz, ro) + m1.w, dot(m2.xyz, ro) + m2.w);
  gPlD = vec3(dot(m0.xyz, rd), dot(m1.xyz, rd), dot(m2.xyz, rd));
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
  // A long saw cut wanders slightly. Its normal changes the refracted
  // shore while the chipped outline still comes from the hit test.
  if (kind < 1.5) {
    vec2 sweep = pl.xz/A.w;
    nl = normalize(nl + vec3(0.026*sin(9.0*sweep.x+fi),0.0,0.019*sin(12.0*sweep.y-fi)));
  }
  vec3 n = qTo(Q,nl);
  vec3 p = A.xyz + qTo(Q,pl);
  vec2 q = kind < 1.5 ? pl.xz : vec2(dot(pl.xz,vec2(-grad.y,grad.x)), pl.y);
  float edge = kind < 1.5 ? max(-sd,0.0) : max(G.w-abs(pl.y),0.0);
  vec3 bent = refract(rd,n,0.763);
  vec3 exitPoint = p + bent * thick;
  vec3 behind;
  if (bent.z < -0.02) {
    vec2 floorPoint = exitPoint.xy + bent.xy * max(0.0,exitPoint.z+gFree) / -bent.z;
    float snow = textureLod(uSnow, RW*floorPoint/vec2(2290.0,790.0),0.0).r;
    behind = mix(nameLake(), S.amb + S.key * 0.16, smoothstep(-0.05,0.35,snow));
  } else {
    behind = nameEnv(bent.z);
  }
  float h = clamp(pl.z/A.w+0.5,0.0,1.0);
  vec3 light = (S.amb * mix(1.3,2.8,uNight) + S.key * mix(0.48,1.7,uNight) + uAurora*0.08)
    * mix(0.52,1.0,h);
  float wet = max(uNameP.y * (0.32 + 0.68 * (1.0-h)), uNameP.w * (1.0-smoothstep(0.0,9.0,p.z+gFree)));
  return clearIce(n,rd,q*232.0/A.w+fi*61.0,t*uPxAng*232.0/A.w,thick*232.0/A.w,
    edge*232.0/A.w, kind < 1.5 ? 0.0 : 1.0,wet,
    (behind * 0.58 + light*0.22) * mix(vec3(0.23,0.42,0.49),vec3(1),h), light*(1.0-0.25*soft), nameEnv(reflect(rd,n).z),
    kind < 1.5 ? mix(0.19,0.52,uNight) * smoothstep(0.0,0.052,edge/A.w) : 0.0);
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
  vec2 tilt = textureLod(uGrain,il/2100.0,0.0).gb - 0.5;
  tiltOut = tilt * 0.018;
  vec3 n = normalize(vec3(-slope-tiltOut*(1.0-wet),1.0));
  vec3 light = S.amb + S.key * (0.12 * (1.0-shade));
  vec3 reflected = reflect(dir,n);
  vec3 sky = nameEnv(abs(reflected.z));
  vec3 col = clearIce(n,dir,il*0.65,foot,60.0,1e3,0.0,wet,
    nameLake()*0.5,light*0.15,min(sky,S.hor*1.8)*mix(0.15,0.36,wet));
  col += vec3(0.14,0.7,0.84)*S.key*gNmPool*mix(0.09,0.48,uNight);
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
float gMirK = 0.0;
vec3 gMirRd = vec3(0,0,1);

vec3 nameIce(vec3 col, vec3 dir, float tG, float onIce, float tWall) {
  if (uNameG.w < 0.5) return col;
  nameFrame();
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
  vec3 rdL = dir;
  float tW = 0.0;
  // Trace one path at a time through the same solid. Both the reflected
  // and underwater paths can be skipped once the eye sees an opaque face.
  vec3 lo = vec3(uNameBx.xy, -gFree - 0.6*uNameM.x);
  vec3 hi = vec3(uNameBx.zw, uNameM.x);
  for (int path=0; path<3; path++) {
    vec3 origin = uCamPos;
    vec3 ray = dir;
    float traveled = 0.0;
    if (path > 0 && bCov >= 0.5) break;
    if (path == 1) {
#ifdef DBG_NO_NUNDER
      continue;
#endif
      if (uNameM.z <= 0.5 || tG >= 1e8 || dir.z >= -0.0006 || onIce >= 1.0 || tWall < 1e8) continue;
      traveled = (uCamPos.z + gFree)/-dir.z;
      origin += dir*traveled;
      vec2 slope = textureLod(uWave,simUv(origin.xy),0.0).zw*2.2
        + (textureLod(uGrain,origin.xy/96.0+vec2(0.011,0.007)*uTime,0.0).gb-0.5)*0.07;
      ray = normalize(mix(dir,refract(dir,normalize(vec3(-slope,1.0)),0.752),0.55));
    } else if (path == 2) {
      if (gMirK <= bCov) continue;
      traveled = tG;
      origin = vec3(uCamPos.xy+dir.xy*tG,0);
      ray = gMirRd;
    }
    vec3 inv = sign(ray+1e-9)/(abs(ray)+1e-6);
    vec3 a = (lo-origin)*inv, b = (hi-origin)*inv;
    vec3 tn = min(a,b), tf = max(a,b);
    if (max(max(tn.x,tn.y),max(tn.z,0.0)) >= min(min(tf.x,tf.y),tf.z)) continue;
    float nearest = 1e9;
    for (int i=0; i<PLATES; i++) {
      vec2 ab = plateBox(i,origin,ray);
      if (ab.x >= min(ab.y,nearest)) continue;
      float t, sd, thick, kind;
      vec3 point,normal;
      vec2 grad;
      float cov = plateHit(uLtG[i].xy,uLtA[i].w,gPlO,gPlD,gPlN,ab,t,point,normal,grad,sd,thick,kind);
      float z = origin.z + ray.z*t;
      if (path == 0 && z < 0.0 && t > tG)
        cov *= (1.0-onIce)*step(t,tWall)*smoothstep(-0.6,0.6,(z+gFree)/max(t*uPxAng,0.05));
      if (path == 1) cov *= 1.0-onIce;
      if (path == 2) cov *= gMirK*(1.0-smoothstep(0.0,0.65,z/uLtA[i].w));
      if (cov > 0.0 && t < nearest && (mode == float(path) || cov > bCov)) {
        nearest=t; bi=i; bCov=cov; bT=t; bPl=point; bNl=normal; bGrad=grad;
        bK=vec3(sd,thick,kind); mode=float(path); rdL=ray; tW=traveled;
      }
    }
  }
  bCov *= 1.0-0.85*wordsNear();
  if (bi >= 0 && bCov > 0.0) {
#ifdef DBG_NO_NLOOK
    vec3 c = vec3(0.3, 0.6, 0.7);
#else
    vec3 c = plateLook(uLtA[bi], uLtQ[bi], uLtG[bi], float(bi), bPl, bNl, bGrad, rdL, bT + tW, bK.x, bK.y, bK.z, mode > 0.5 ? 1.0 : 0.0);
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
    if (in_ == 0.0 || stands == 0.0) continue;
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
    gMirRd = normalize(vec3(dir.xy+slope*4.0+tilt*0.35*(1.0-pond),-dir.z));
    gMirK = mirK*mix(0.46,0.66,pond);
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
  // A steep view through the swept sheet shows deep water, even where a
  // film has filled its cracks. At grazing angles the sky still mirrors.
  float deep = smoothstep(0.035, 0.21, -dir.z) * (1.0-smoothstep(0.72,1.24,d));
  return col * (1.0 - 0.48 * deep);
}
`;
