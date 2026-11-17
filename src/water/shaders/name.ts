/**
 * The name, standing on the frozen lake as letters of glacier ice.
 *
 * Each line of the name is a row of upright blocks: the letters' outlines
 * (the name's distance field, the one the page's ice is cut with) carried
 * straight back through a depth of ice. The outlines are laid in an upright
 * plane as the first camera sees them, so from there the faces are the type
 * itself, square-on and true, and the blocks' tops and inner sides are what
 * that camera sees of their depth.
 *
 * A ray is marched only through the box the blocks stand in (two rows on a
 * phone), a bounded number of steps, so the cost is where the name is.
 *
 * The ice is the stations' ice (the same recipe as iceLook, with its helpers)
 * pressed older and deeper: thick ice takes all the red and most of the
 * green out of what lies beyond it, so a block is deep blue at its heart and
 * pale only where it is thin; strata of trapped air run through all the
 * letters alike, as through one piece of glacier sawn into ten; fracture
 * planes stand in it at two depths; its tops carry snow, its sawn faces
 * frost; the edges the low sun finds are lit through.
 *
 * Needs the ice field's uniforms (uIce, uIceP, uIceSdf, uNameG, uNameB,
 * uNameM), the stations' common block (beyond, snowOn, inAir) and fracture,
 * lodFor, keyDir, simUv declared before it.
 */
export const NAME_ICE = `
uniform vec4 uNameP;       // x: how far from the blocks' feet meltwater lies on the sheet px, y: 0..1 how wet the blocks are, z: 0..1 the sheet has opened under them

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
/**
 * A row of blocks in section: the distance, in the raster's true px, from a
 * place in the row's upright plane (x across, z up) to the letters' outline,
 * negative inside. g: that place in the raster's units from its middle.
 */
float nameSd(int i, float x, float z, out vec2 g) {
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
  // (Two lines are two rows: each is only its own letters.)
  return max(sd, i == 0 ? uNameG.z - g.y : g.y - uNameG.z);
}

/**
 * A ray against one row. Returns how much of the pixel the row covers.
 * tH: where the ray meets it; g, sd, grad: the outline there; front: 1 on a
 * sawn front face; thick: how much ice the ray then crosses; sBack: the
 * outline's distance where the ray reaches the row's back (the far side of
 * the block, as it is seen through the block).
 */
float nameHit(vec3 ro, vec3 rd, int i, out float tH, out vec2 g, out float sd, out vec2 grad, out float front, out float thick, out float sBack) {
  tH = 0.0; g = vec2(0.0); sd = 1e3; grad = vec2(0.0, 1.0); front = 0.0; thick = 0.0; sBack = -1e3;
  float yf = i == 0 ? uNameG.x : uNameG.y;
  float y0 = yf + (uNameB.w - uNameM.y) * 0.5;
  vec3 lo = vec3(gNmC.x - 0.5 * uIce.z, y0, -FREEBOARD);
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
    float s = nameSd(i, p.x, p.z, gk);
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
  float sI = nameSd(i, pI.x, pI.z, gk);
  vec3 pB = ro + rd * tB;
  float sB = nameSd(i, pB.x, pB.z, gk);
  sBack = sB;
  thick = (tB - tH) * (sB < 0.0 ? 1.0 : clamp(-min(sI, -0.01) / (sB - min(sI, -0.01)), 0.06, 1.0));
  // (An edge that the ray only grazes covers part of the pixel; one it goes in by covers it all.)
  return 1.0 - smoothstep(-aa, aa, min(best, hit ? min(sI, sB) : best));
}

/** The lake as it lies round the blocks, lit: what is seen through thin ice and what lies on a wet face. */
vec3 nameLake() {
  vec3 day = vec3(0.9, 0.92, 0.95) * (S.key * 0.24 + S.amb * 0.8);
  vec3 night = vec3(0.1, 0.16, 0.2) * (S.amb * 3.0 + uAurora * 0.05);
  return mix(day, night, uNight);
}

/** The ice of a block where the eye's ray enters it. p: where; i: which row; the rest as nameHit gave them. */
vec3 nameLook(vec3 p, vec3 rd, float t, int i, vec2 g, float sd, vec2 grad, float front, float thick, float sBack) {
  vec3 L = keyDir();
  float px = max(t * uPxAng, 0.02);
  float base = i == 0 ? uNameB.x : uNameB.y;
  float yf = i == 0 ? uNameG.x : uNameG.y;
  float y0 = yf + (uNameB.w - uNameM.y) * 0.5;
  float up = g.y - base;
  float melt = clamp(1.0 - uNameM.y / max(uNameB.w, 1.0), 0.0, 1.0);
  vec2 gd = normalize(grad + vec2(1e-4, 0.0));
  vec3 n = front > 0.5 ? vec3(0.0, -1.0, 0.0) : normalize(vec3(gd.x, -0.06, gd.y));
  float top = front > 0.5 ? 0.0 : smoothstep(0.3, 0.72, n.z);
  // A place on the face: on a front, the outline's own; on a side or a top, along the outline and back through the block.
  vec2 q = front > 0.5 ? g : vec2(dot(g, vec2(-gd.y, gd.x)) + 113.0, (p.y - y0) * 1.6 + 57.0);
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  vec3 tv = cross(n, tu);
  vec4 g0 = textureLod(uGrain, q / 230.0 + 0.37, 0.0);
  vec4 g1 = textureLod(uGrain, q / 52.0 + 0.11, lodFor(px, 52.0, 256.0));
  // A sawn face is flat, with the slow swells melt has left in it; where meltwater runs down it the water ripples it.
  vec2 bump = (g0.gb - 0.5) * 0.12 + (g1.rg - 0.5) * 0.05;
  // (Even whole, the faces the low sun warms sweat a little.)
  float wet = 0.1 + 0.9 * uNameP.y;
  float lane = textureLod(uGrain, vec2(q.x / 64.0 + 0.2, 0.37 + q.y / 3000.0), 0.0).g;
  float film = wet * smoothstep(0.5, 0.68, lane) * (1.0 - top);
  if (film > 0.0) {
    vec4 gw = textureLod(uGrain, vec2(q.x / 22.0, (q.y + uTime * (30.0 + 30.0 * lane)) / 110.0) + 0.6, lodFor(px, 22.0, 256.0));
    bump = mix(bump, bump * 0.4 + (gw.rg - 0.5) * 0.5, film);
  }
  vec3 nn = normalize(n + tu * bump.x + tv * bump.y);
  float cosi = max(dot(-rd, nn), 0.0);
  float fres = 0.025 + 0.975 * pow(1.0 - cosi, 5.0);
  vec3 ri = refract(rd, nn, 0.763);
  vec3 lake = nameLake();
  float hK = clamp(up / uNameB.z, 0.0, 1.0);
  vec2 sunG = normalize(vec2(L.x, 0.55));
  float edge = front > 0.5 ? -sd : min(p.y - y0, 6.0);
  float toSun = front > 0.5 ? clamp(0.5 + 0.6 * dot(gd, sunG), 0.0, 1.0) : 0.5 + 0.5 * clamp(dot(n.xz, sunG), -1.0, 1.0);
  // Through it: what lies beyond, bent, and coloured by the ice the light crossed. Old pressed ice takes the red at
  // once and the green soon after: a whole block's depth of it leaves only a deep blue.
  vec3 od = normalize(rd + (ri - rd) * 1.6);
  vec3 bey = od.z > 0.0 ? beyond(p, od) : lake;
  // (Near an edge the ray soon leaves by the side: the ice there is paler, but never thin enough to be pale.)
  float dK = clamp(thick / max(uNameB.w, 1.0), 0.78 * (1.0 - melt), 1.6);
  vec3 tr = exp(-vec3(7.0, 5.0, 3.6) * dK);
  // The light inside it. By day the low sun stands behind the blocks: what it sends through them is deep blue in the
  // heart, and paler where it came in near by: under the tops and inside the edges turned to it. Before dawn there
  // is no sun: the ice holds the sky's and the aurora's light in its trapped air, palest under the tops, and is
  // darker and clearer toward its foot.
  float thru = pow(max(dot(rd, L), 0.0), 3.0);
  vec3 litD = S.amb * 1.25 + S.key * (0.05 + 0.1 * max(dot(n, L), 0.0) + 0.3 * thru);
  vec3 litN = S.amb * 6.0 + uAurora * 0.12 + vec3(0.09, 0.06, 0.04) * uNight;
  vec3 lit = mix(litD, litN, uNight);
  float inBy = 0.42 * pow(hK, 3.0) + 0.9 * exp(-max(edge, 0.0) / 2.6) * toSun * front;
  vec3 deepD = (vec3(0.0013, 0.0092, 0.045) + vec3(0.011, 0.072, 0.165) * inBy) * litD * (front > 0.5 ? 1.0 : mix(0.5, 1.7, toSun) * (0.7 + 0.5 * hK));
  // Before dawn nothing lights the lake but the sky and the aurora, and the ice gathers that light as the dark, clear
  // sheet round it cannot: its trapped air holds it, most under the snow of the tops, least at the foot, and where
  // the ice is clear of air the dark lake shows through.
  float clearN = smoothstep(0.6, 0.36, textureLod(uGrain, q / vec2(1100.0, 1700.0) + 0.7, 0.0).g * 0.85 + g0.r * 0.15 + 0.3 * hK);
  vec3 deepN = mix(vec3(0.44, 0.62, 0.76), vec3(1.9, 1.92, 1.95), pow(hK, 1.2)) * litN * (1.0 - 0.6 * clearN) * (front > 0.5 ? 1.0 : 0.5);
  vec3 col = bey * tr + mix(deepD, deepN, uNight) * (1.0 - tr.g);
  // Strata of trapped air: bands that run through every letter alike, a little out of level, seen at their own depth.
  vec2 par = vec2(dot(ri, tu), dot(ri, tv)) / max(-dot(ri, n), 0.35);
  float heart = dK / (dK + 0.8);
  vec2 qa = q + par * min(thick * 0.5, 30.0);
  float band = textureLod(uGrain, vec2(qa.x / 1900.0 + 0.2, qa.y / 150.0 + qa.x / 1300.0), 0.0).b;
  float air = heart * smoothstep(0.46, 0.8, band * 0.8 + g0.r * 0.34);
  vec3 milk = mix(vec3(0.04, 0.16, 0.38) * litD, vec3(1.3, 1.36, 1.4) * litN, uNight);
  col = mix(col, milk, mix(0.16, 0.3, uNight) * air);
  // The far side of the block, seen through it: where the eye's ray leaves by an edge before it reaches the back the
  // ice is thinner and the lake's light comes through, and the back face's own outline shows as a fine bright line
  // inside the front's. That second outline is what says the block is clear, and solid.
  if (front > 0.5) {
    float thin = smoothstep(-0.5, 5.0, sBack) * (1.0 - melt);
    float back = (1.0 - smoothstep(0.0, 0.9 + px, abs(sBack))) * (1.0 - melt);
    col += mix(vec3(0.004, 0.026, 0.07) * litD, -col * 0.35, uNight) * thin;
    col += mix(vec3(0.5, 0.8, 1.0) * (S.key * 0.024 + S.amb * 0.16), vec3(0.9, 1.0, 1.05) * litN * 0.35, uNight) * back;
  }
  // Fracture planes inside, at three depths: each set runs its own way, in short lengths. A plane is a hairline
  // where it is seen edge on and a veil on one side of that line, where it turns the light back to the eye.
  float near = 1.0 - smoothstep(1.4, 4.5, px);
  if (near > 0.0) {
    float veil = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      vec2 a = q + par * (k == 0 ? 5.0 : (k == 1 ? 16.0 : 30.0)) + fk * 113.0;
      vec2 dk = k == 0 ? vec2(0.83, 0.56) : (k == 1 ? vec2(-0.5, 0.87) : vec2(0.97, -0.24));
      float gap = 104.0 + 58.0 * fk;
      vec4 w1 = textureLod(uGrain, a / vec2(1150.0, 2900.0) + fk * 0.37, 0.0);
      vec4 w2 = textureLod(uGrain, a / 1900.0 + 0.31 + fk * 0.19, 0.0);
      float fs = fract(dot(a, dk) / gap + w1.g * 0.3 + w2.b * 0.5);
      float cut = smoothstep(0.47, 0.58, w2.g + 0.3 * (w1.b - 0.5));
      float hw = (0.55 + 1.2 * px) / gap;
      float hair = 1.0 - smoothstep(0.0, hw, min(fs, 1.0 - fs));
      float sheet = pow(1.0 - fs, 6.0) * (0.25 + 0.75 * w1.a);
      veil += (hair * 0.9 + sheet * 0.3) * cut * exp(-fk * 0.45);
    }
    veil *= near * (0.45 + 0.55 * heart);
    col += mix(vec3(0.72, 0.9, 1.0) * (S.key * 0.038 + S.amb * 0.24), vec3(0.7, 1.0, 0.95) * (litN * 0.6 + uAurora * 0.12), uNight) * veil;
    // Single bubbles, strung in the strata: only from close by.
    float bead = smoothstep(0.975, 1.0, textureLod(uGrain, qa / vec2(150.0, 110.0) + 0.43, 0.0).r) * smoothstep(0.45, 0.8, band) * (1.0 - smoothstep(0.35, 0.9, px));
    col += mix(vec3(0.8, 0.93, 1.0) * (S.key * 0.12 + S.amb * 0.5), litN * 0.8, uNight) * bead * heart;
  }
  // The face itself: the lake and the sky lie on it, more at a glancing angle and more where it is wet.
  vec3 rr = reflect(rd, nn);
  vec3 on = rr.z > 0.0 ? beyond(p, rr) : lake;
  // (A side is seen at a glancing angle and would be all mirror: it is rough-sawn, and keeps most of its own colour.)
  col = mix(col, on, clamp(fres * (mix(0.34, 0.6, uNight) + 0.6 * film) * (front > 0.5 ? 1.0 : 0.12) + 0.03 * film * uNameP.y, 0.0, 1.0));
  col += S.band * pow(max(dot(rr, S.sun), 0.0), 200.0) * (0.4 + 1.6 * film) * (1.0 - uNight) * step(0.0, S.sun.z);
  // The edges. On a front the outline is the arris: by day the ones turned to the sun are lit through; before dawn
  // the upper ones only catch the sky, faintly, and nothing outlines a letter.
  float ar = 1.0 - smoothstep(0.35, 1.7 + px, edge);
  vec3 arC = mix(vec3(0.8, 0.94, 1.0) * (S.key * 0.2 + S.amb * 0.8), vec3(0.9, 1.0, 1.05) * litN * 0.5, uNight);
  col += arC * ar * mix(0.1 + 0.9 * toSun * toSun, 0.7 * smoothstep(0.1, 0.8, gd.y), uNight);
  // Frost: rime on the sawn faces, more of it under the tops and toward the corners, less where meltwater has run.
  // (By day the faces are sawn smooth and dark: the rime is in soft patches. Before dawn it is the fine frost that holds the light.)
  float rime = smoothstep(0.6, 0.92, g0.g * 0.62 + g1.b * mix(0.06, 0.16, uNight) + 0.3 * exp(-max(edge, 0.0) / 12.0) * smoothstep(0.2, 0.8, gd.y)) * (1.0 - 0.8 * film) * (1.0 - 0.7 * melt);
  col = mix(col, mix(vec3(0.3, 0.54, 0.8) * litD, vec3(1.1, 1.14, 1.18) * litN, uNight), rime * mix(0.18, 0.4, uNight) * (1.0 - top));
  // Snow: on the tops and ledges, drifted unevenly, with bare wet ice showing where it has melted through.
  if (top > 0.0) {
    float bare = smoothstep(0.5, 0.66, g0.b * 0.6 + g1.g * 0.4 + 0.55 * melt);
    vec3 sn = mix(snowOn(n, (g1.r - 0.5) * 0.5), vec3(1.45, 1.5, 1.55) * litN, uNight) * (0.9 + 0.2 * g1.a);
    // (Thin, lit ice under it: the palest ice of the block.)
    vec3 ledge = mix(vec3(0.3, 0.62, 0.84) * litD, vec3(0.6, 0.78, 0.9) * litN, uNight);
    col = mix(col, mix(sn, ledge, bare * (1.0 - 0.6 * uNight)), top);
    // (The top's own front arris, where it meets the sawn face.)
    col += arC * (1.0 - smoothstep(0.5, 2.0 + px, p.y - y0)) * 0.5 * top * (1.0 - uNight);
  }
  // Where a block stands in water: a dark wet notch, and the bright line of the water's own edge.
  float zw = p.z + FREEBOARD;
  col *= 1.0 - 0.45 * uNameP.z * (1.0 - smoothstep(2.0, 12.0, zw));
  col += mix(vec3(0.8, 0.93, 1.0) * S.amb * 0.9, uAurora * 0.3, uNight) * (1.0 - smoothstep(0.0, 1.6, abs(zw - 1.2))) * uNameP.z;
  // (As a block thins it clears: less of it stands between the eye and what lies behind.)
  return col;
}

/**
 * The blocks, over the finished ground. tG: how far along the ray the
 * ground's plane lies; onIce: how much of the pixel there is the sheet's
 * top; tWall: how far off the sheet's cut face is at this pixel, if one is
 * seen (a block's foot below the sheet's top is hidden by either).
 */
vec3 nameIce(vec3 col, vec3 dir, float tG, float onIce, float tWall) {
  if (uNameG.w < 0.5 || uNameM.w <= 0.0) return col;
  nameFrame();
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
    if (p.z < 0.0 && tH > tG) {
      cov *= (1.0 - onIce) * step(tH, tWall);
      if (p.z < -FREEBOARD + 0.5) cov = 0.0;
    }
    if (cov <= 0.0) continue;
    vec3 c = nameLook(p, dir, tH, k, g, sd, grad, front, thick, sBack);
    // (The blocks stand close under the eye and are kept clear of most of the lake's haze: they are the deepest blue in the frame.)
    col = mix(col, mix(c, inAir(c, dir, tH), 0.04), cov * uNameM.w);
    gNmCov = max(gNmCov, cov * uNameM.w);
  }
  return col;
}

/**
 * What the blocks do to the sheet they stand on: each throws a long soft
 * blue shade toward the eye, away from the low sun; meltwater lies round
 * their feet, moved by the same waves as the open water; and the wet,
 * polished ice before them carries their image.
 * p: the place on the sheet's top; onIce: how much of the pixel is that top.
 */
vec3 nameGround(vec3 col, vec2 p, vec3 dir, float foot, float onIce) {
  if (uNameG.w < 0.5 || uNameM.w <= 0.0 || onIce <= 0.0) return col;
  nameFrame();
  float dx = abs(p.x - gNmC.x) - 0.5 * uIce.z;
  if (dx > 1100.0 || p.y > uNameG.x + uNameB.w + 160.0 || p.y < uNameG.y - 2200.0) return col;
  vec3 L = keyDir();
  float lenL = length(L.xy);
  float fd = nameFoot(p);
  // The meltwater on the sheet: its edge wanders.
  float wob = (textureLod(uGrain, p / 310.0, 0.0).g - 0.5) * 22.0 + (textureLod(uGrain, p / 71.0 + 0.3, 0.0).b - 0.5) * 7.0;
  float aaF = max(foot * 1.6, 1.2);
  float pond = 1.0 - smoothstep(uNameP.x - aaF, uNameP.x + aaF, fd + wob);
  // (The waves the pointer and the melt make in it.)
  vec2 slope = pond > 0.0 ? textureLod(uWave, simUv(p), 0.0).zw * 0.6 : vec2(0.0);
  float shade = 0.0;
  float mir = 0.0;
  vec2 g;
  for (int i = 0; i < 2; i++) {
    if (i == 1 && uNameG.z < -5e3) break;
    float yf = i == 0 ? uNameG.x : uNameG.y;
    float y0 = yf + (uNameB.w - uNameM.y) * 0.5;
    if (p.y >= y0) continue;
    if (L.y > 0.05 && uNight < 1.0) {
      float s = (y0 - p.y) / L.y;
      float len = s * lenL;
      if (len < 2600.0 && L.z * s < uNameB.z * 1.3) {
        float soft = 1.2 + len * 0.03;
        shade = max(shade, (1.0 - smoothstep(-soft, soft, nameSd(i, p.x + L.x * s, L.z * s, g))) * exp(-len / 640.0));
      }
    }
    vec3 rf = normalize(vec3(dir.xy + slope, -dir.z));
    float s2 = (y0 - p.y) / max(rf.y, 0.05);
    float z2 = rf.z * s2;
    if (z2 < uNameB.z * 1.3) mir = max(mir, (1.0 - smoothstep(-1.0, 1.0 + s2 * 0.02, nameSd(i, p.x + rf.x * s2, z2, g))) * (1.0 - 0.5 * smoothstep(0.0, uNameB.z, z2)));
  }
  // Meltwater on ice: the snow under it is gone, the ice shows dark and blue through it, and the sky lies on it.
  vec3 wetC = mix(vec3(0.13, 0.4, 0.56) * (S.amb * 1.2 + S.key * 0.1), vec3(0.2, 0.34, 0.42) * S.amb * 1.5, uNight);
  vec3 skyC = mix(S.hor * 0.9, S.mid * 0.8 + uAurora * 0.03, uNight);
  float cosi = clamp(-dir.z, 0.0, 1.0);
  float fr = 0.03 + 0.97 * pow(1.0 - cosi, 5.0);
  vec3 water = mix(wetC, skyC, clamp(fr * 1.6 + length(slope) * 0.6, 0.0, 0.8));
  col = mix(col, water, pond * 0.82 * onIce);
  // (A block's shade is blue: the light that reaches the snow there has come through ice.)
  col *= 1.0 - shade * vec3(0.4, 0.3, 0.17) * (1.0 - uNight) * onIce * (1.0 - 0.5 * pond);
  // The blocks' image: clear in the meltwater, faint in the polished ice beyond it.
  vec3 img = mix(vec3(0.012, 0.07, 0.19) * (S.amb * 1.3 + S.key * 0.2), vec3(0.5, 0.64, 0.74) * (S.amb * 6.0 + uAurora * 0.22), uNight);
  col = mix(col, img, mir * mix(0.1 + 0.62 * pond, 0.03 + 0.08 * pond, uNight) * onIce * uNameM.w);
  // A dark wet line where each block meets the sheet.
  col *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 5.0, fd)) * onIce;
  return col;
}
`;
