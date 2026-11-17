/**
 * The last four stations' subjects, as pieces of the flight's shading pass.
 * Each is ice standing in (or over) the water, found by a ray, and each is
 * only worked out while its station is the one near the camera (uStation).
 *
 * They are composed over the finished ground: a subject covers what lies
 * behind it, and the water in front of it carries its mirror image.
 */

import { COLS, DAM, SLUICES, T2 } from '../world';

const f = (n: number) => n.toFixed(1);

/** What every station shares: where the eye's ray meets the water, and the air between. */
export const STATION_COMMON = `
uniform vec4 uSt;          // how much of each of the last four stations' subjects is there to see (0 far off): columns, dam, lattice, canyon
uniform vec4 uColH;        // station 5: each column's height
uniform vec3 uGate;        // station 6: how far open each sluice is, 0..1
uniform vec3 uSurge;       // station 6: 0..1, the surge running down each channel since it opened

/** The air between the eye and something t away. */
vec3 inAir(vec3 c, vec3 dir, float t) {
  float thin = (1.0 - exp(-uCamPos.z / 320.0)) / max(uCamPos.z / 320.0, 1e-3);
  float fog = 1.0 - exp(-t * 0.00021 * S.haze * thin);
  vec3 air = airAt(dir.xy);
  air = mix(air, mix(S.hor, air, 0.45), uNight);
  return mix(c, air, fog);
}
/** Clear glacier ice seen through a thickness of it: pale at an edge, deep blue at the heart. */
vec3 iceBody(float path) {
  return mix(vec3(0.66, 0.85, 0.93), vec3(0.1, 0.38, 0.56), clamp(path, 0.0, 1.0));
}
`;

/** Station 5: four rough-cut columns of ice, each as tall as its model's pulls. */
export const COLUMNS = `
const float COL_Y = ${f(COLS.y)};
const float COL_R = ${f(COLS.r)};
const vec4 COL_X = vec4(${COLS.xs.map(f).join(', ')});
float colX(int i) { return i == 0 ? COL_X.x : i == 1 ? COL_X.y : i == 2 ? COL_X.z : COL_X.w; }
float colH(int i) { return i == 0 ? uColH.x : i == 1 ? uColH.y : i == 2 ? uColH.z : uColH.w; }

// A column is six upright faces, none quite the same width, under a top that is cut a little out of level.
float colHit(vec3 ro, vec3 rd, int i, out vec3 n, out float tF) {
  float fi = float(i);
  vec3 o = ro - vec3(colX(i), COL_Y + 14.0 * sin(fi * 2.3), -FREEBOARD);
  float h = colH(i);
  float tN = 0.0;
  tF = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  for (int k = 0; k < 7; k++) {
    vec3 pn;
    float d;
    if (k < 6) {
      float fk = float(k);
      float a = fi * 0.9 + fk * 1.0472 + 0.16 * sin(fk * 2.7 + fi * 5.0);
      pn = vec3(cos(a), sin(a), 0.0);
      d = COL_R * (0.86 + 0.24 * fract(sin(fk * 12.9 + fi * 7.0) * 43.7));
    } else {
      pn = normalize(vec3(0.16 * sin(fi * 3.1 + 1.0), 0.14 * cos(fi * 1.7), 1.0));
      d = h * pn.z;
    }
    float den = dot(rd, pn);
    float num = d - dot(o, pn);
    if (den < -1e-5) { float t = num / den; if (t > tN) { tN = t; n = pn; } }
    else if (den > 1e-5) tF = min(tF, num / den);
    else if (num < 0.0) return -1.0;
  }
  return tN < tF && tN > 0.0 ? tN : -1.0;
}

vec3 colColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, int i) {
  float fi = float(i);
  float h = colH(i);
  vec3 hp = ro + rd * t - vec3(colX(i), COL_Y + 14.0 * sin(fi * 2.3), -FREEBOARD);
  vec3 L = keyDir();
  float path = (tF - t) / (COL_R * 2.1);
  vec3 ice = iceBody(path * 0.9 + 0.08);
  // Lit through: the side turned from the sun still glows.
  float thru = 0.55 + 0.45 * max(dot(n, L), 0.0) + 0.3 * max(dot(-n, L), 0.0);
  float ang = atan(hp.y, hp.x);
  vec4 gr = textureLod(uGrain, vec2(ang * 0.6 + fi * 0.37, hp.z / 190.0), 0.0);
  // Fracture planes inside: each face is its own broken sheet of them.
  float faceId = floor(atan(n.y, n.x) * 0.9549 + 0.5);
  vec3 fr3 = fracture(vec2(ang * 1.4 + faceId * 3.7, hp.z / 74.0) + fi * 5.1);
  ice *= 0.72 + 0.5 * fr3.y;
  float crack = (1.0 - smoothstep(0.0, 0.03, fr3.x)) * step(0.4, fr3.z);
  vec3 col = ice * (S.key * (0.1 + 0.2 * thru * thru) + S.amb * 0.95) * (0.88 + 0.24 * gr.r) * (0.8 + 0.4 * max(dot(n, L), 0.0));
  col += vec3(0.8, 0.93, 1.0) * S.key * 0.07 * crack * (1.0 - uNight);
  col = mix(col, ice * (S.amb * 2.4 + uAurora * (0.16 + 0.3 * gr.g)) + vec3(0.004, 0.012, 0.016), uNight);
  float top = smoothstep(0.6, 0.8, n.z);
  if (top < 1.0) {
    // Meltwater runs down the faces: bright wet threads, quicker and more of them the taller the column.
    float much = clamp(h / ${f(COLS.hMax)}, 0.12, 1.0);
    float run = uTime * (26.0 + 30.0 * much);
    float lane = textureLod(uGrain, vec2(ang * 0.7 + fi * 0.51, 0.3 + hp.z / 2600.0), 0.0).g;
    float bead = textureLod(uGrain, vec2(ang * 0.7 + fi * 0.51, (hp.z + run * (0.6 + 0.8 * lane)) / 240.0), 0.0).r;
    float thread = smoothstep(0.7 - 0.14 * much, 0.84, lane) * smoothstep(0.4, 0.75, bead);
    vec3 wetC = mix(vec3(0.86, 0.96, 1.0) * (S.key * 0.3 + S.amb * 1.1), vec3(0.35, 0.75, 0.7) * 0.4 + uAurora * 0.5, uNight);
    col = mix(col, wetC, thread * 0.45);
    // The waterline: a dark wet notch the shallows have eaten.
    col *= 1.0 - 0.45 * (1.0 - smoothstep(2.0, 11.0 + 5.0 * gr.b, hp.z));
  }
  // The sky lies on a wet face at a glancing angle.
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
  col = mix(col, skyColor(reflect(rd, n), 0.0), fr * 0.5 * (1.0 - top));
  // Snow on the top, and hanging a little way down.
  float hang = 5.0 + 9.0 * gr.g;
  float snowK = max(top, smoothstep(h - hang - 1.0, h - hang + 1.0, hp.z) * step(26.0, h));
  vec3 sn = mix(vec3(0.93, 0.94, 0.96), vec3(0.6, 0.68, 0.8), uNight) * (S.key * mix(0.26, L.z, uNight) * (0.5 + 0.9 * max(dot(normalize(n + vec3(0.0, 0.0, 1.0)), L), 0.0)) + S.amb * 0.85 + uAurora * 0.04);
  return mix(col, sn, snowK);
}

/** The columns over the finished ground, and in the water before them. tw: where the ray meets the water, or -1. */
vec3 columns(vec3 col, vec3 dir, float tw) {
  vec3 pwp = uCamPos + dir * max(tw, 0.0);
  // (Water is only seen where the land above it is not in the way.)
  bool wet = tw > 0.0 && textureLod(uBedA, bedUv(pwp.xy), 0.0).r < -2.0 && textureLod(uBedA, bedUv(uCamPos.xy + dir.xy * (uCamPos.z / -dir.z)), 0.0).r < 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 c = vec3(colX(i), COL_Y, 0.0);
    // (Each is only looked for near its own line of sight.)
    vec3 toC = c - uCamPos;
    float along = dot(toC.xy, normalize(dir.xy + 1e-6));
    if (along < 0.0) continue;
    vec2 off = toC.xy - normalize(dir.xy + 1e-6) * along;
    bool near = dot(off, off) < 4.0 * COL_R * COL_R;
    if (!near && !wet) continue;
    vec3 n;
    float tF;
    float t = near ? colHit(uCamPos, dir, i, n, tF) : -1.0;
    if (t > 0.0 && (tw < 0.0 || t < tw)) {
      // Its outline is geometry: smoothed by counting two more rays.
      float cov = 1.0;
      vec3 n2;
      float tF2;
      for (int k = 0; k < 2; k++) {
        vec3 rd = normalize(dir + (uCamR * (k == 0 ? 0.5 : -0.5) + uCamU * (k == 0 ? -0.5 : 0.5)) * uPxAng);
        if (colHit(uCamPos, rd, i, n2, tF2) < 0.0) cov -= 0.33;
      }
      col = mix(col, inAir(colColor(uCamPos, dir, t, tF, n, i), dir, t), cov * uSt.x);
    } else if (wet) {
      float d = length(pwp.xy - c.xy);
      float h = colH(i);
      // Its mirror image, shaken by its own rings.
      float much = clamp(h / ${f(COLS.hMax)}, 0.1, 1.0);
      float ring = sin(d * 0.1 - uTime * 4.2 + float(i) * 1.7) * exp(-max(d - COL_R, 0.0) / (70.0 + 150.0 * much)) * (0.35 + 0.65 * much);
      vec3 rd2 = normalize(vec3(dir.xy, -dir.z) + vec3(0.012 * ring + 0.003 * sin(pwp.y * 0.21 + uTime * 0.9), 0.0, 0.0));
      float t2 = near ? colHit(pwp, rd2, i, n, tF) : -1.0;
      if (t2 > 0.0) col = mix(col, inAir(colColor(pwp, rd2, t2, tF, n, i), dir, tw + t2) * 0.74, 0.58 * uSt.x);
      // The rings themselves: each column stands in its own, the tallest in the widest.
      col *= 1.0 + ring * 0.2 * smoothstep(COL_R * 0.8, COL_R * 1.1, d) * uSt.x;
      // A dark, wet foot where it meets the water.
      col *= 1.0 - 0.35 * (1.0 - smoothstep(COL_R * 0.9, COL_R * 1.5, d)) * uSt.x;
    }
  }
  return col;
}
// (The shallows the columns stand in are a hand deep: the pale bed shows through.)
float shallowsAt(vec2 p) {
  return smoothstep(${f(T2 + 380)}, ${f(T2 + 640)}, p.y) * (1.0 - smoothstep(${f(T2 + 1420)}, ${f(T2 + 1700)}, p.y));
}
`;

const sluiceX = (i: number) => {
  const l = SLUICES[i];
  // (The channel's middle at a distance d below the dam: straight runs between its points.)
  let out = `${f(l[l.length - 1].x)}`;
  for (let k = l.length - 2; k >= 0; k--) {
    out = `(d < ${f(l[k + 1].y - DAM.y)} ? mix(${f(l[k].x)}, ${f(l[k + 1].x)}, clamp((d - ${f(l[k].y - DAM.y)}) / ${f(l[k + 1].y - l[k].y)}, 0.0, 1.0)) : ${out})`;
  }
  return out;
};

/** Station 6: a low dam of ice, three sluices, a plate of ice in each; one lifted. */
export const DAM_ICE = `
const float DAM_Y = ${f(DAM.y)};
const float DAM_T = ${f(DAM.thick)};
const float DAM_H = ${f(DAM.h)};
const vec3 GATE_X = vec3(${DAM.gates.map(f).join(', ')});
const float GATE_W = ${f(DAM.gw / 2)};
float gateOf(int i) { return i == 0 ? uGate.x : i == 1 ? uGate.y : uGate.z; }
float gateX(int i) { return i == 0 ? GATE_X.x : i == 1 ? GATE_X.y : GATE_X.z; }

float boxHit(vec3 ro, vec3 rd, vec3 lo, vec3 hi, out vec3 n, out float tF) {
  vec3 inv = 1.0 / (rd + vec3(equal(rd, vec3(0.0))) * 1e-6);
  vec3 a = (lo - ro) * inv;
  vec3 b = (hi - ro) * inv;
  vec3 t0 = min(a, b);
  vec3 t1 = max(a, b);
  float tN = max(max(t0.x, t0.y), t0.z);
  tF = min(min(t1.x, t1.y), t1.z);
  n = -sign(rd) * vec3(step(t0.yzx, t0.xyz) * step(t0.zxy, t0.xyz));
  return tN < tF && tN > 0.0 ? tN : -1.0;
}
// The nearest of the dam's seven pieces: four lengths of wall, three plates. kind: 0 wall, 1 plate.
float damHit(vec3 ro, vec3 rd, out vec3 n, out float tF, out float kind) {
  float best = -1.0;
  vec3 n1;
  float f1;
  kind = 0.0;
  if (boxHit(ro, rd, vec3(${f(DAM.x0)}, DAM_Y, -FREEBOARD - 4.0), vec3(${f(DAM.x1)}, DAM_Y + DAM_T, DAM_H + 110.0), n1, f1) < 0.0) return -1.0;
  for (int i = 0; i < 4; i++) {
    float xa = i == 0 ? ${f(DAM.x0)} : gateX(i - 1) + GATE_W;
    float xb = i == 3 ? ${f(DAM.x1)} : gateX(i) - GATE_W;
    float t = boxHit(ro, rd, vec3(xa, DAM_Y, -FREEBOARD - 4.0), vec3(xb, DAM_Y + DAM_T, DAM_H - FREEBOARD + (i == 1 || i == 2 ? 6.0 : 0.0)), n1, f1);
    if (t > 0.0 && (best < 0.0 || t < best)) { best = t; n = n1; tF = f1; kind = 0.0; }
  }
  for (int i = 0; i < 3; i++) {
    float up = gateOf(i) * (DAM_H - 8.0);
    float t = boxHit(ro, rd, vec3(gateX(i) - GATE_W - 5.0, DAM_Y + 20.0, up - FREEBOARD - 4.0), vec3(gateX(i) + GATE_W + 5.0, DAM_Y + 36.0, up + DAM_H - 10.0 - FREEBOARD), n1, f1);
    if (t > 0.0 && (best < 0.0 || t < best)) { best = t; n = n1; tF = f1; kind = 1.0; }
  }
  return best;
}
vec3 damColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, float kind) {
  vec3 hp = ro + rd * t;
  vec3 L = keyDir();
  float z = hp.z + FREEBOARD;
  vec2 uv = abs(n.z) > 0.5 ? hp.xy / 160.0 : vec2((abs(n.x) > 0.5 ? hp.y : hp.x) / 160.0, z / 110.0);
  vec4 gr = textureLod(uGrain, uv, 0.0);
  vec3 fr3 = fracture(uv * 2.6 + kind * 3.0);
  vec3 ice = iceBody(mix(0.5, 0.16, kind) + 0.4 * clamp((tF - t) / 160.0, 0.0, 1.0)) * (0.74 + 0.46 * fr3.y);
  float lit = 0.55 + 0.45 * max(dot(n, L), 0.0) + 0.3 * max(dot(-n, L), 0.0);
  vec3 col = ice * (S.key * (0.1 + 0.2 * lit * lit) + S.amb * 0.95) * (0.88 + 0.24 * gr.r) * (0.8 + 0.4 * max(dot(n, L), 0.0));
  col += vec3(0.8, 0.93, 1.0) * S.key * 0.06 * (1.0 - smoothstep(0.0, 0.03, fr3.x)) * step(0.4, fr3.z) * (1.0 - uNight);
  col = mix(col, ice * (S.amb * 2.4 + uAurora * (0.16 + 0.3 * gr.g)) + vec3(0.004, 0.012, 0.016), uNight);
  // Wet and dark at the waterline.
  col *= 1.0 - 0.4 * (1.0 - smoothstep(2.0, 10.0 + 5.0 * gr.b, z)) * (1.0 - kind * 0.5);
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
  col = mix(col, skyColor(reflect(rd, n), 0.0), fr * mix(0.4, 0.6, kind) * step(n.z, 0.5));
  // Snow lies along the wall's top; the plates are bare, clear ice.
  float snowK = (1.0 - kind) * max(step(0.5, n.z), smoothstep(DAM_H - 13.0 - 8.0 * gr.g, DAM_H - 11.0 - 8.0 * gr.g, z));
  vec3 sn = mix(vec3(0.93, 0.94, 0.96), vec3(0.6, 0.68, 0.8), uNight) * (S.key * mix(0.26, L.z, uNight) * (0.5 + 0.9 * max(dot(normalize(n + vec3(0.0, 0.0, 1.0)), L), 0.0)) + S.amb * 0.85 + uAurora * 0.04);
  return mix(col, sn, snowK);
}
`;

/** Station 6, the water: full and white below the open sluice, a trickle below the shut ones. */
export const DAM_WATER = `
vec3 dam(vec3 col, vec3 dir, float tw) {
  vec3 n;
  float tF;
  float kind;
  float t = damHit(uCamPos, dir, n, tF, kind);
  if (t > 0.0 && (tw < 0.0 || t < tw)) return mix(col, inAir(damColor(uCamPos, dir, t, tF, n, kind), dir, t), uSt.y);
  if (tw < 0.0) return col;
  vec3 pwp = uCamPos + dir * tw;
  if (textureLod(uBedA, bedUv(pwp.xy), 0.0).r > -2.0) return col;
  float d = pwp.y - DAM_Y;
  if (d < DAM_T) {
    // The head pond: the dam's mirror image, and the draw toward the open sluice.
    vec3 rd2 = normalize(vec3(dir.xy, -dir.z) + vec3(0.003 * sin(pwp.y * 0.2 + uTime * 0.8), 0.0, 0.0));
    float t2 = damHit(pwp, rd2, n, tF, kind);
    if (t2 > 0.0) col = mix(col, inAir(damColor(pwp, rd2, t2, tF, n, kind), dir, tw + t2) * 0.74, 0.55 * uSt.y);
    for (int i = 0; i < 3; i++) {
      vec2 q = pwp.xy - vec2(gateX(i), DAM_Y);
      float pull = gateOf(i) * exp(-length(q * vec2(1.0, 0.55)) / 90.0);
      float streak = textureLod(uGrain, vec2(atan(q.x, -q.y) * 0.9, (length(q) + uTime * 70.0) / 900.0), 1.5).r;
      col = mix(col, vec3(0.9, 0.96, 1.0) * (S.key * 0.25 + S.amb), pull * smoothstep(0.45, 0.8, streak) * 0.6 * uSt.y);
    }
    return col;
  }
  if (d > 1010.0) return col;
  int i = pwp.x < 1170.0 ? 0 : pwp.x < 1430.0 ? 1 : 2;
  float cx = i == 0 ? ${sluiceX(0)} : i == 1 ? ${sluiceX(1)} : ${sluiceX(2)};
  float sg = i == 0 ? uSurge.x : i == 1 ? uSurge.y : uSurge.z;
  float front = DAM_T + sg * 1100.0;
  float open = gateOf(i) * (1.0 - smoothstep(front - 30.0, front + 30.0, d));
  float fade = (1.0 - smoothstep(720.0, 980.0, d)) * uSt.y;
  float side = pwp.x - cx;
  float off = abs(side);
  vec4 gr = textureLod(uGrain, pwp.xy / 760.0, 2.5);
  // Shut: the bed lies nearly bare, pale wet ice and gravel, a thread of water down its middle.
  vec3 bare = mix(vec3(0.42, 0.5, 0.56), vec3(0.24, 0.33, 0.4), gr.r) * (S.key * 0.2 + S.amb * 0.9) * (0.8 + 0.3 * gr.g);
  bare = mix(bare, vec3(0.05, 0.08, 0.1) + uAurora * 0.05, uNight * 0.8);
  float thread = 1.0 - smoothstep(5.0 + 9.0 * gr.b, 12.0 + 12.0 * gr.b, abs(side - 20.0 * sin(d * 0.021 + float(i)) - 9.0 * sin(d * 0.057)));
  col = mix(col, bare, (1.0 - open) * (1.0 - 0.9 * thread) * 0.86 * fade);
  // Open: white water, hardest under the sluice, and a white head on the surge.
  float white = textureLod(uGrain, vec2(pwp.x / 260.0, (d - uTime * 240.0) / 1500.0), 1.5).r;
  float fall = 0.12 + exp(-(d - DAM_T) / 170.0) + 0.9 * exp(-abs(d - front) / 55.0) * step(sg, 0.98);
  col = mix(col, vec3(0.93, 0.97, 1.0) * (S.key * mix(0.3, 0.1, uNight) + S.amb * 1.1), clamp(min(fall * 1.6, 1.0) * smoothstep(0.42, 0.7, white + 0.45 * fall), 0.0, 1.0) * open * (1.0 - smoothstep(48.0, 72.0, off)) * fade);
  return col;
}
`;
