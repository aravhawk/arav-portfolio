/**
 * The last four stations' subjects, as pieces of the flight's shading pass.
 * Each is ice standing in (or over) the water, found by a ray, and each is
 * only worked out while its station is the one near the camera (uSt).
 *
 * They are composed over the finished ground: a subject covers what lies
 * behind it, and the water in front of it carries its mirror image.
 *
 * All four are made of one ice (clearIce): the eye sees through it to what
 * lies beyond, bent and tinted by the ice the light crossed; its heart is
 * white with trapped air; fracture planes stand inside it at two depths; the
 * sky and the country lie on its faces, and where meltwater runs down them
 * the faces ripple.
 */

import { BENDS, CANYON, COLS, DAM, FACE, HALL, LATTICE, SLUICES, T2 } from '../world';

const f = (n: number) => n.toFixed(1);

const fr = (x: number) => x - Math.floor(x);
const v3 = (a: number, b: number, c: number) => `vec3(${a.toFixed(5)}, ${b.toFixed(5)}, ${c.toFixed(4)})`;
/**
 * A serac's planes. Each of the four is three convex pieces: the pillar (ten planes), its shoulder (eight) and the
 * block that has fallen from it (six). They are worked out here in the pillar's own measure (one unit is its
 * radius, so it stands 1 / K units tall) and written out for the shader in the space the ray is tested in
 * (x and y over the radius, z over the height): there a plane is xyz, and w how far out it stands.
 */
const SER_N = 24;
const seracPlanes = () => {
  const K = COLS.r / COLS.hMax;
  const H = 1 / K;
  const rnd = (i: number, k: number) => fr(Math.sin(i * 127.1 + k * 311.7 + 3.3) * 43758.5453);
  const out: string[] = [];
  for (let i = 0; i < 4; i++) {
    const planes: [number, number, number, number][] = [];
    // (A plane in the pillar's measure: a unit normal and how far out it stands.)
    const add = (nx: number, ny: number, nz: number, px: number, py: number, pz: number) => {
      const l = Math.hypot(nx, ny, nz);
      planes.push([nx / l, ny / l, nz / l, (nx * px + ny * py + nz * pz) / l]);
    };
    const phi = COLS.lean[i];
    const apex: [number, number, number] = [COLS.apex * Math.cos(phi), COLS.apex * Math.sin(phi), H];
    // The pillar: six faces, none the same width. It leans: the faces on that side overhang, the ones behind lie back.
    for (let k = 0; k < 6; k++) {
      const a = i * 0.9 + k * 1.0472 + 0.3 * (rnd(i, k) - 0.5);
      const toward = Math.cos(a - phi);
      const rho = 0.84 + 0.26 * rnd(i, k + 10);
      const tan = 0.05 - 0.085 * toward + 0.03 * (rnd(i, k + 20) - 0.5);
      add(Math.cos(a), Math.sin(a), tan, rho * Math.cos(a), rho * Math.sin(a), 0);
    }
    // Its top is broken, not sawn: one long slope falling away behind the lean, two short chips before it. All three
    // pass through its highest point, which no other plane cuts: that point is the height the model's pulls give it.
    for (const [da, t] of [
      [Math.PI, 0.7 + 0.2 * rnd(i, 31)],
      [0.9, 0.35 + 0.3 * rnd(i, 32)],
      [-1.25, 1.1 + 0.5 * rnd(i, 33)],
    ]) {
      add(Math.cos(phi + da) * t, Math.sin(phi + da) * t, 1, apex[0], apex[1], apex[2]);
    }
    // One arris is chipped away in its upper third.
    {
      const a = phi + 2.2 + 1.2 * rnd(i, 40);
      const at = 0.5 + 0.2 * rnd(i, 41);
      add(Math.cos(a), Math.sin(a), 0.55, 1.02 * Math.cos(a), 1.02 * Math.sin(a), at * H);
      const c = planes[planes.length - 1];
      c[3] = Math.max(c[3], c[0] * apex[0] + c[1] * apex[1] + c[2] * apex[2] + 0.06);
    }
    // The shoulder: a lower pillar against its back.
    const psi = phi + Math.PI + 0.9 * (rnd(i, 50) - 0.5);
    const bx = 0.98 * Math.cos(psi);
    const by = 0.98 * Math.sin(psi);
    const sh = (0.3 + 0.26 * rnd(i, 51)) * H;
    for (let k = 0; k < 5; k++) {
      const a = i * 1.7 + k * 1.2566 + 0.35 * (rnd(i, k + 60) - 0.5);
      const rho = 0.56 + 0.22 * rnd(i, k + 70);
      add(Math.cos(a), Math.sin(a), 0.03 + 0.07 * rnd(i, k + 80), bx + rho * Math.cos(a), by + rho * Math.sin(a), 0);
    }
    add(Math.cos(psi) * 0.45, Math.sin(psi) * 0.45, 1, bx, by, sh);
    add(Math.cos(psi + 1.9) * 1.4, Math.sin(psi + 1.9) * 1.4, 1, bx, by, sh - 0.15);
    add(0, 0, 1, 0, 0, sh + 0.4);
    // The fallen block: a tilted lump lying half in the water, on the side the eye comes from.
    const th = -2.05 + 1.5 * (rnd(i, 90) - 0.5);
    const cx = 1.85 * Math.cos(th);
    const cy = 1.85 * Math.sin(th);
    const yaw = 6.283 * rnd(i, 91);
    const tip = 0.3 + 0.25 * rnd(i, 92);
    const ax: [number, number, number][] = [
      [Math.cos(yaw) * Math.cos(tip), Math.sin(yaw) * Math.cos(tip), Math.sin(tip)],
      [-Math.sin(yaw), Math.cos(yaw), 0],
      [-Math.cos(yaw) * Math.sin(tip), -Math.sin(yaw) * Math.sin(tip), Math.cos(tip)],
    ];
    const half = [0.5 + 0.2 * rnd(i, 93), 0.3 + 0.12 * rnd(i, 94), 0.24 + 0.1 * rnd(i, 95)];
    for (let j = 0; j < 3; j++) {
      for (const sg of [1, -1]) {
        add(sg * ax[j][0], sg * ax[j][1], sg * ax[j][2], cx + sg * ax[j][0] * half[j], cy + sg * ax[j][1] * half[j], 0.1 + sg * ax[j][2] * half[j]);
      }
    }
    if (planes.length !== SER_N) throw new Error('serac planes');
    // (Into the tested space: z is measured over the height, which is 1 / K radii.)
    for (const [nx, ny, nz, d] of planes) out.push(`vec4(${nx.toFixed(5)}, ${ny.toFixed(5)}, ${(nz * H).toFixed(5)}, ${d.toFixed(5)})`);
  }
  return out.join(', ');
};

/** What every station shares: the air, what lies beyond a piece of ice, and the ice itself. */
export const STATION_COMMON = `
uniform vec4 uSt;          // how near each of the last four stations' subjects is (0 far off): columns, dam, lattice, canyon
uniform vec4 uColH;        // station 5: each column's height
uniform vec3 uGate;        // station 6: how far open each sluice is, 0..1
uniform vec3 uSurge;       // station 6: 0..1, the surge running down each channel since it opened

// How much of each subject is drawn. (One that is in sight at all is drawn whole and left to the air: half there, it would be a ghost.)
vec4 gSt = vec4(0.0);
// How far off the nearest of these subjects already drawn at this pixel is: one further off is not drawn over it, nor is its water.
float gDepth = 1e9;
// Over 0 where ice stands closed in by more ice (a canyon's walls): the horizon is not seen from there, and the
// deeper between the walls (toward 1) the steeper a mirror must look up to find any sky.
float gShut = 0.0;
/** The air between the eye and something t away. */
vec3 inAir(vec3 c, vec3 dir, float t) {
  float fog = airLoss(t);
  vec3 air = airAt(dir.xy);
  air = mix(air, mix(S.hor, air, 0.45), uNight);
  return mix(c, air, fog);
}
/** Clear glacier ice seen through a thickness of it: pale at an edge, deep blue at the heart. */
vec3 iceBody(float path) {
  return mix(vec3(0.66, 0.85, 0.93), vec3(0.1, 0.38, 0.56), clamp(path, 0.0, 1.0));
}
/** Snow lying on ice: lit as the land's snow is, lumped a little. */
vec3 snowOn(vec3 n, float lump) {
  vec3 L = keyDir();
  vec3 nl = normalize(n + vec3(lump, lump * 0.6, 1.0));
  vec3 day = vec3(0.93, 0.94, 0.96) * (S.key * 0.26 * (0.42 + 0.9 * max(dot(nl, L), 0.0)) + S.amb * 0.85);
  return uNight > 0.0 ? mix(day, snowNight(nl), uNight) : day;
}
// 1 while a subject is drawn as its mirror image in the water: its fine inner work is not looked for.
float gMirror = 0.0;
bool gMirrorOn() { return gMirror > 0.5; }
`;

/** The glacier's own ice, which every station is made of: only in a variant of the pass that draws one. */
export const GLACIER_ICE = `
/**
 * What a ray that has left a piece of ice goes on to: the sky and the ranges
 * if it rises, the snow or the water if it falls. (Blunt: it is only ever
 * seen bent through ice, or lying on a wet face.)
 */
vec3 beyond(vec3 ro, vec3 rd) {
  if (rd.z > 0.0) {
    // (The sky's own colours and the sun's glow; the aurora as its wash. Nothing finer survives the ice.)
    float h = rd.z;
    vec3 sky = mix(mix(S.hor, S.mid, smoothstep(0.0, 0.2, h)), S.zen, smoothstep(0.07, 0.62, h));
    float az = max(dot(normalize(rd.xy + 1e-5), normalize(S.sun.xy)), 0.0);
    // (Between a canyon's walls before dawn no horizon is seen: none of its warmth lies on the ice.)
    sky += (S.band * exp(-h * 15.0) * az * az * az * az * 0.4 + sunBloom(max(dot(rd, S.sun), 0.0)) * (1.0 - 0.5 * uNight)) * (1.0 - min(gShut * 4.0, 1.0) * uNight);
    if (uNight > 0.0 && uSkyK.y > 0.0) {
      float up = h - 0.27;
      sky += mix(vec3(0.16, 0.92, 0.6), vec3(0.42, 0.22, 0.9), smoothstep(0.0, 1.32, up)) * (smoothstep(-0.05, 0.03, up) * exp(-max(up, 0.0) / 0.55) * 0.9) * uNight * uSkyK.y;
    }
    return sky;
  }
  float t = min((ro.z + FREEBOARD) / max(-rd.z, 0.03), 800.0);
  float sd = textureLod(uBedA, bedUv(ro.xy + rd.xy * t), 0.0).r;
  vec3 L = keyDir();
  vec3 snow = mix(vec3(0.93, 0.94, 0.96) * (S.key * 0.2 + S.amb * 0.85), vec3(0.6, 0.68, 0.8) * 0.24 * (S.key * L.z + S.amb * 0.85 + uAurora * 0.04), uNight);
  vec3 water = mix(vec3(0.07, 0.36, 0.42) * (S.key * 0.2 + S.amb * 1.2) * uSkyK.w, vec3(0.004, 0.02, 0.026) + uAurora * 0.07, uNight);
  vec3 c = mix(water, snow, smoothstep(-6.0, 6.0, sd));
  return mix(c, mix(S.hor, vec3(0.012, 0.03, 0.06), min(gShut * 4.0, 1.0) * uNight), exp(rd.z / 0.04) * 0.7);
}
float cyH(float x) { return fract(sin(x * 12.9898 + 4.1) * 43758.5453); }
vec3 gIceLamp = vec3(0.0);
// The body colour and the light of the ice last asked for: what stands on it (snow's shade, icicles) is lit the same.
vec3 gLastIce = vec3(0.0);
vec3 gIceLight = vec3(0.0);
// Gather the station's incident light and the terrain or sky on the bent
// ray. The same optical material also receives lake and letter hits.
vec3 iceGlacier(vec3 p, vec3 n, vec3 rd, float t, vec2 q, float thick, float sky, float sun, float cups, float edge, float seed) {
  vec3 ri = refract(rd, n, 0.763);
  vec3 reflected = reflect(rd,n);
  vec3 light = S.amb * (0.55 + sky * mix(1.1, 2.0, uNight)) + gIceLamp
    + S.key * sun * (0.12 + 0.62 * max(dot(n,keyDir()),0.0))
    + uAurora * (0.07 * sky * uNight);
  // Fractures scatter some of the horizon that the shadowed face sees.
  light += S.hor * (0.16 * sky * uNight);
  vec3 backing = light * 0.21;
  float through = 1.0 - smoothstep(145.0,270.0,thick);
  if (gShut <= 0.0 && through > 0.0)
    backing = mix(backing,beyond(p + ri * thick,ri),through);
  vec3 skyImage = gShut > 0.0 && reflected.z < gShut * 0.8
    ? light * vec3(0.09,0.22,0.32) : beyond(p,reflected);
  float wet = 1.0 - smoothstep(-FREEBOARD, 9.0-FREEBOARD, p.z);
  vec3 color = clearIce(n, rd, q + seed * 133.0, max(0.03,t*uPxAng), thick,
    edge, cups, wet, backing, light, skyImage);
  gIceLight = light;
  gLastIce = color;
  return color;
}
/**
 * Icicles under a lip of snow or ice. along: the place along the lip; dz: how far under it; px: a pixel's size there.
 * (They hang in runs, where the lip drips; most are short. Each is clear ice in the round: dark at its sides, a line of light down its middle.)
 */
vec3 iciclesOn(vec3 col, float along, float dz, float px, float reach) {
  if (dz <= 0.0 || px > 1.3 || gMirror > 0.5) return col;
  float iw = along / 5.2;
  float iid = floor(iw);
  float ix = (iw - iid - 0.5) * 5.2 - 1.2 * (cyH(iid + 0.7) - 0.5);
  float runK = smoothstep(0.1, 0.6, sin(along * 0.023 + 0.6) + 0.5 * sin(along * 0.061));
  float len = (5.0 + reach * pow(cyH(iid * 1.31 + 5.0), 3.0)) * runK;
  float wHalf = (0.5 + 1.5 * cyH(iid + 2.9)) * max(1.0 - dz / max(len, 0.1), 0.0);
  float ic = step(dz, len) * (1.0 - smoothstep(wHalf - 0.6 * px, wHalf + 0.6 * px, abs(ix))) * (1.0 - smoothstep(0.8, 1.3, px)) * (1.0 - 0.85 * wordsNear());
  float coreI = 1.0 - smoothstep(0.0, 0.45, abs(ix) / max(wHalf, 0.05));
  return mix(col, gLastIce * 0.75 + vec3(0.8, 0.93, 1.0) * gIceLight * (0.2 + 0.75 * coreI * coreI), ic * 0.92);
}
/**
 * A cornice: snow along the top of a face of ice, hanging over it by hang, its lower edge one clean line. It lays
 * its shade on the ice under it; its own face rounds under, so its upper part looks at the sky and its under edge at
 * the ground. dz: how far under the snow's lower edge a place is (under 0: on the snow). n: the face.
 */
vec3 corniceOn(vec3 col, vec3 n, float dz, float hang, float px) {
  col *= 1.0 - 0.34 * (1.0 - smoothstep(0.0, hang, dz)) * step(0.0, dz);
  float snowK = 1.0 - smoothstep(-0.7 * px, 0.7 * px, dz);
  if (snowK <= 0.0) return col;
  float sU = clamp(-dz / hang, 0.0, 1.0);
  vec3 nS = normalize(vec3(n.xy * (1.0 - 0.6 * sU), -0.75 + 1.9 * sU));
  // (Before dawn it is the palest thing on the ice and it is blue: it has only the sky's light.)
  vec3 sn = snowOn(nS, 0.0) * mix(vec3(0.6, 0.72, 0.9), vec3(1.12), smoothstep(0.0, 0.7, sU)) * mix(vec3(1.0), vec3(0.62, 0.84, 1.22), uNight);
  return mix(col, sn, snowK);
}
/** Where ice stands in water: a dark wet notch the water has eaten, and the bright line of the water's own edge. */
vec3 waterlineOn(vec3 col, float z, float g) {
  col = mix(col, col * mix(vec3(0.55), vec3(0.6, 0.7, 0.86), uNight), 1.0 - smoothstep(2.0, 11.0 + 5.0 * g, z));
  // (Before dawn the water's edge is a dull glint of the sky, broken along its length: never a lit line.)
  return col + mix(vec3(0.8, 0.93, 1.0) * S.amb * 0.9, (S.amb * 0.9 + uAurora * 0.03) * (0.3 + 0.7 * g), uNight) * (1.0 - smoothstep(0.0, 1.6, abs(z - 1.2)));
}
`;

/** Station 5: four seracs, one to a model. Each is cut to the same measure, so the ice in it is in proportion to its pulls; each is broken in its own way. */
export const COLUMNS = `
const float COL_Y = ${f(COLS.y)};
const float COL_K = ${(COLS.r / COLS.hMax).toFixed(4)};
const vec4 COL_X = vec4(${COLS.xs.map(f).join(', ')});
float colX(int i) { return i == 0 ? COL_X.x : i == 1 ? COL_X.y : i == 2 ? COL_X.z : COL_X.w; }
float colH(int i) { return i == 0 ? uColH.x : i == 1 ? uColH.y : i == 2 ? uColH.z : uColH.w; }
vec3 colAt(int i) { return vec3(colX(i), COL_Y + 26.0 * sin(float(i) * 2.3), -FREEBOARD); }

// A serac is three convex pieces, each cut by planes: the pillar (it leans, and its top is broken to one highest
// point), a shoulder against its back, and a block fallen from it into the water. (The planes are worked out once,
// in the space where x and y are measured over its radius and z over its height: a ray is tested there.)
const vec4 SER[${4 * SER_N}] = vec4[${4 * SER_N}](${seracPlanes()});
// No edge of it is ruled. Where the ray passes its middle line fixes a height on it, and at that height the whole
// piece is a little off its line and a little wider or narrower: its outline swells, necks and wanders as it rises.
// (Only sideways: its highest point stays at its height.) o, d: the ray in the tested space; returns where it starts there.
vec3 colWarp(vec3 o, vec3 d, float fi) {
  float zc = clamp(o.z + d.z * max(-dot(o.xy, d.xy) / max(dot(d.xy, d.xy), 1e-12), 0.0), -0.1, 1.1);
  o.xy += vec2(sin(zc * 6.4 + fi * 2.0), sin(zc * 5.1 + fi * 4.1)) * 0.06 + vec2(sin(zc * 15.0 + fi), cos(zc * 12.0 + fi * 3.0)) * 0.018;
  o.xy *= 1.0 + 0.06 * sin(zc * 8.3 + fi * 5.0) + 0.02 * sin(zc * 21.0 + fi);
  return o;
}
// part: 0 the pillar, 1 its shoulder, 2 the fallen block.
float colHit(vec3 ro, vec3 rd, int i, out vec3 n, out float tF, out int part) {
  float h = colH(i);
  vec3 sc = vec3(h * COL_K, h * COL_K, h);
  vec3 o = (ro - colAt(i)) / sc;
  vec3 d = rd / sc;
  o = colWarp(o, d, float(i));
  float best = -1.0;
  n = vec3(0.0, 0.0, 1.0);
  tF = 0.0;
  part = 0;
  for (int pt = 0; pt < 3; pt++) {
    int k0 = pt == 0 ? 0 : pt == 1 ? 10 : 18;
    int k1 = pt == 0 ? 10 : pt == 1 ? 18 : 24;
    float tN = 0.0;
    float tX = 1e9;
    vec3 nn = vec3(0.0, 0.0, 1.0);
    for (int k = 0; k < 10; k++) {
      if (k0 + k >= k1) break;
      vec4 pl = SER[i * ${SER_N} + k0 + k];
      float den = dot(d, pl.xyz);
      float num = pl.w - dot(o, pl.xyz);
      if (den < -1e-9) { float t = num / den; if (t > tN) { tN = t; nn = pl.xyz; } }
      else if (den > 1e-9) tX = min(tX, num / den);
      else if (num < 0.0) tX = -1.0;
      if (tN > tX) break;
    }
    if (tN < tX && tN > 0.0 && (best < 0.0 || tN < best)) { best = tN; n = normalize(nn / sc); tF = tX; part = pt; }
  }
  return best;
}

vec3 colColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, int i, int part) {
  float fi = float(i);
  float h = colH(i);
  float size = h / ${f(COLS.hMax)};
  vec3 sc = vec3(h * COL_K, h * COL_K, h);
  vec3 hp = ro + rd * t - colAt(i);
  float top = smoothstep(0.62, 0.8, n.z);
  // How far this place is from the face's nearest arris: the least room left inside the piece's other faces.
  // (Measured where the ray was tested, so it follows the outline's wander.)
  vec3 hw = colWarp((ro - colAt(i)) / sc, rd / sc, fi) + rd / sc * t;
  float edge = 1e3;
  int k0 = part == 0 ? 0 : part == 1 ? 10 : 18;
  int k1 = part == 0 ? 10 : part == 1 ? 18 : 24;
  for (int k = 0; k < 10; k++) {
    if (k0 + k >= k1) break;
    vec4 pl = SER[i * ${SER_N} + k0 + k];
    vec3 pw = pl.xyz / sc;
    float l = length(pw);
    if (dot(pw / l, n) > 0.999) continue;
    edge = min(edge, (pl.w - dot(hw, pl.xyz)) / l);
  }
  vec2 q = vec2(dot(hp.xy, normalize(vec2(-n.y, n.x) + 1e-5)) + fi * 91.0 + atan(n.y, n.x) * 40.0 + float(part) * 37.0, hp.z);
  vec4 gr = textureLod(uGrain, q / 190.0 + fi * 0.37, 0.0);
  // It is the glacier's ice, clear: the years run through pillar, shoulder and block alike (they dip a little, the
  // way the glacier lay), the eye sees into it, and where a piece is thin the country behind shows through, bent.
  vec3 col = iceGlacier(ro + rd * t, n, rd, t, vec2(q.x, hp.z + 0.22 * hp.x + 0.1 * hp.y), tF - t, 1.0, 1.0, 1.0 - top, edge, fi * 0.61 + 0.2);
  // A face that leans back lies open to the sky and is paler; one that overhangs is in its own shade.
  col *= 1.0 + 0.22 * clamp(n.z, -0.6, 0.6) * (1.0 - top);
  if (top < 1.0) {
    // The waterline notch: the water has eaten a hollow round its foot. Dark and wet inside, its upper lip catching the light.
    float nz = (3.5 + 9.0 * size) * (0.9 + 0.18 * sin(q.x * 0.05 + fi));
    // (Before dawn the hollow is only a shade darker and stays blue: the night's air over a black foot would turn it rust.)
    col = mix(col, col * mix(vec3(0.4), vec3(0.5, 0.62, 0.8), uNight), 1.0 - smoothstep(nz * 0.45, nz, hp.z));
    col += mix(vec3(0.8, 0.93, 1.0) * (S.amb * 0.7 + S.key * 0.06), (S.amb * 0.8 + uAurora * 0.02) * (0.3 + 0.7 * gr.g), uNight) * ((1.0 - smoothstep(0.0, 1.0 + t * uPxAng, abs(hp.z - nz * 1.08))) * 0.7 + (1.0 - smoothstep(0.0, 1.4, abs(hp.z - 1.0))));
  }
  // Snow holds only where the break lies easy: the long slope of its top, the shoulder's head. The steep chips are bare ice.
  return mix(col, snowOn(n, 0.0) * mix(vec3(1.12), vec3(0.62, 0.84, 1.22), uNight), top);
}

/** The columns over the finished ground, and in the water before them. tw: where the ray meets the water, or -1. */
vec3 columns(vec3 col, vec3 dir, float tw) {
  vec3 pwp = uCamPos + dir * max(tw, 0.0);
  // Most of the frame has nothing of them in it: neither a column on its line of sight nor the shallows under it.
  vec2 fwd = normalize(dir.xy + 1e-6);
  bool rect = tw > 0.0 && abs(pwp.x - 1340.0) < 800.0 && abs(pwp.y - COL_Y) < 560.0;
  // The nearest column on this line of sight, if any. (The ice itself is shaded once, for that one.)
  float best = -1.0;
  int bi = 0;
  int bp = 0;
  vec3 n;
  float tF;
  for (int i = 0; i < 4; i++) {
    vec3 n1;
    float f1;
    int p1;
    vec2 toC = colAt(i).xy - uCamPos.xy;
    float along = dot(toC, fwd);
    vec2 off = toC - fwd * along;
    // (Its shoulder and its fallen block stand out past the pillar.)
    float reach = 2.7 * COL_K * colH(i);
    if (along < 0.0 || dot(off, off) > reach * reach) continue;
    float t = colHit(uCamPos, dir, i, n1, f1, p1);
    if (t > 0.0 && (best < 0.0 || t < best)) { best = t; bi = i; bp = p1; n = n1; tF = f1; }
  }
  if (best < 0.0 && !rect) return col;
  if (best > gDepth || (best < 0.0 && tw > gDepth)) return col;
  if (best < 0.0 || (tw > 0.0 && best > tw)) {
    // Each column's shade lies long across the water and the snow, away from the low light.
    vec3 Ls = keyDir();
    float tl = uCamPos.z / max(-dir.z, 1e-3);
    bool land = textureLod(uBedA, bedUv(uCamPos.xy + dir.xy * tl), 0.0).r > 0.0;
    vec3 ps = land ? uCamPos + dir * tl : pwp + vec3(0.0, 0.0, 0.5);
    float sh = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 toC = colAt(i).xy - ps.xy;
      float along = dot(toC, normalize(Ls.xy));
      float rI = COL_K * colH(i);
      // (Soft at its sides, and fainter the further it has run: the sun is not a point.)
      float wide = rI * (0.85 + along / 2200.0);
      float off = length(toC - normalize(Ls.xy) * along);
      float len = colH(i) * length(Ls.xy) / max(Ls.z, 0.03);
      sh = max(sh, step(0.0, along) * (1.0 - smoothstep(wide * 0.55, wide * 1.25, off)) * (1.0 - smoothstep(len * 0.5, len, along)) * exp(-along / 520.0));
    }
    col *= 1.0 - sh * mix(land ? 0.42 : 0.3, 0.12, uNight) * gSt.x;
  }
  if (best > 0.0 && (tw < 0.0 || best < tw)) {
    // Its outline is geometry: smoothed by counting two more rays.
    float cov = 1.0;
    vec3 n2;
    float tF2;
    int p2;
    if (uLean < 0.5) {
      for (int k = 0; k < 2; k++) {
        vec3 rd = normalize(dir + (uCamR * (k == 0 ? 0.5 : -0.5) + uCamU * (k == 0 ? -0.5 : 0.5)) * uPxAng);
        if (colHit(uCamPos, rd, bi, n2, tF2, p2) < 0.0) cov -= 0.33;
      }
    }
    gDepth = best;
    return mix(col, inAir(colColor(uCamPos, dir, best, tF, n, bi, bp), dir, best), cov * gSt.x);
  }
  // (Water is only seen where the land above it is not in the way.)
  if (!rect || textureLod(uBedA, bedUv(pwp.xy), 0.0).r > -2.0 || textureLod(uBedA, bedUv(uCamPos.xy + dir.xy * (uCamPos.z / -dir.z)), 0.0).r > 0.0) return col;
  // Water carries the column it is nearest to: its mirror image, shaken by the rings its meltwater makes.
  int i = int(clamp(floor((pwp.x - COL_X.x) / (COL_X.y - COL_X.x) + 0.5), 0.0, 3.0));
  vec3 c0 = colAt(i);
  float d = length(pwp.xy - c0.xy);
  if (d > 520.0) return col;
  float h = colH(i);
  float rI = h * COL_K;
  float much = clamp(h / ${f(COLS.hMax)}, 0.1, 1.0);
  // Meltwater drips from the column into the water at its foot: each drop's ring spreads, thins and dies, and another falls.
  float rings = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k) + float(i) * 3.0;
    float period = 2.1 + 1.3 * fract(fk * 0.618);
    float born = uTime + fk * 1.37;
    float age = mod(born, period);
    float a = fk * 2.4 + floor(born / period) * 1.9;
    float dd = length(pwp.xy - c0.xy - vec2(cos(a), sin(a)) * rI * 1.9);
    float rad = age * (30.0 + 22.0 * much);
    rings += sin((dd - rad) * 0.36) * exp(-abs(dd - rad) / (7.0 + 5.0 * age)) * exp(-age * 0.9) * smoothstep(0.0, 0.2, age) * (0.5 + 0.5 * much);
  }
  rings *= 1.0 - smoothstep(4.0, 12.0, tw * uPxAng);
  if (uLean < 1.5) {
    vec3 rd2 = normalize(vec3(dir.xy, -dir.z) + vec3(0.03 * rings + 0.003 * sin(pwp.y * 0.21 + uTime * 0.9), 0.0, 0.0));
    float t2 = colHit(pwp, rd2, i, n, tF, bp);
    if (t2 > 0.0) {
      gMirror = 1.0;
      col = mix(col, inAir(colColor(pwp, rd2, t2, tF, n, i, bp), dir, tw + t2) * 0.74, 0.6 * gSt.x);
      gMirror = 0.0;
    }
  }
  // (Before dawn a ring is a cold glint, not a brighter band of the warm sky the water holds.)
  col *= 1.0 + rings * mix(0.42, 0.1, uNight) * smoothstep(rI * 0.8, rI * 1.1, d) * gSt.x;
  col += (uAurora * 0.12 + vec3(0.006, 0.014, 0.024)) * max(rings, 0.0) * smoothstep(rI * 0.8, rI * 1.1, d) * gSt.x;
  // A dark, wet foot where it meets the water.
  col *= 1.0 - 0.35 * (1.0 - smoothstep(rI * 0.9, rI * 1.5 + 8.0, d)) * gSt.x;
  return col;
}
`;

/** The shallows the columns stand in: the water looks for them by place, so every variant of the pass carries this. */
export const SHALLOWS = `
// (The shallows the columns stand in are a hand deep: the pale bed shows through.)
// (Only round its shore: out where the seracs stand the pool goes down into the blue.)
float shallowsAt(vec2 p) {
  float k = smoothstep(${f(T2 + 380)}, ${f(T2 + 640)}, p.y) * (1.0 - smoothstep(${f(T2 + 1420)}, ${f(T2 + 1700)}, p.y));
  if (k <= 0.0) return 0.0;
  float sd = -textureLod(uBedA, bedUv(p), 0.0).r;
  float deep = smoothstep(34.0, 150.0, sd + 22.0 * sin(p.x * 0.013 + 1.0) * sin(p.y * 0.017));
  return k * (1.0 - 0.86 * deep);
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
/** The gates from west to east, and the lengths of wall between them. */
const GATES_WE = [...DAM.gates].sort((a, b) => a - b);
const HALF = DAM.gw / 2;
const SEGS: [number, number][] = [
  [DAM.x0, GATES_WE[0] - HALF],
  [GATES_WE[0] + HALF, GATES_WE[1] - HALF],
  [GATES_WE[1] + HALF, GATES_WE[2] - HALF],
  [GATES_WE[2] + HALF, DAM.x1],
];
/** Which sluice's channel a place below the dam belongs to: by which side of the two bars between them it lies. */
const channelOf = () => {
  const order = DAM.gates.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  return `(pwp.x < ${f((order[0].x + order[1].x) / 2)} ? ${order[0].i} : pwp.x < ${f((order[1].x + order[2].x) / 2)} ? ${order[1].i} : ${order[2].i})`;
};
const HIP_L = Math.hypot(1, DAM.hip);

/**
 * Station 6: one dam of ice across the river, upright toward its pond and leaning back below. Three sluices are cut
 * through the lean down to the water; over each the crest runs on as a lintel, and at the head of each cut stands a
 * gate of clear ice that lifts into the wall. Its two ends run down into the banks under drifted snow.
 */
export const DAM_ICE = `
const float DAM_Y = ${f(DAM.y)};
const float DAM_T = ${f(DAM.thick + DAM.h * DAM.batter)};
const float DAM_H = ${f(DAM.h)};
const float DAM_ZT = ${f(DAM.h)} - FREEBOARD;
const float DAM_LZ = ${f(DAM.h - DAM.lintel)} - FREEBOARD;
const vec3 GATE_X = vec3(${DAM.gates.map(f).join(', ')});
const float GATE_W = ${f(HALF)};
const vec2 DAM_SEG[4] = vec2[4](${SEGS.map(([a, b]) => `vec2(${f(a)}, ${f(b)})`).join(', ')});
const vec3 DAM_BN = ${v3(0, 1 / Math.hypot(1, DAM.batter), DAM.batter / Math.hypot(1, DAM.batter))};
const vec3 DAM_HIP = ${v3(1 / HIP_L, 0, DAM.hip / HIP_L)};
float gateOf(int i) { return i == 0 ? uGate.x : i == 1 ? uGate.y : uGate.z; }
float gateX(int i) { return i == 0 ? GATE_X.x : i == 1 ? GATE_X.y : GATE_X.z; }

// A length of the wall: upright toward the pond, leaning back below, a level crest. hip: 1 where its west (x) or
// east (y) end is the dam's own and runs down into the bank.
float wallHit(vec3 ro, vec3 rd, vec2 x, vec2 hip, out vec3 n, out float tF) {
  float tN = 0.0;
  tF = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  for (int k = 0; k < 6; k++) {
    vec3 pn = k == 0 ? (hip.x > 0.5 ? DAM_HIP * vec3(-1.0, 1.0, 1.0) : vec3(-1.0, 0.0, 0.0)) : k == 1 ? (hip.y > 0.5 ? DAM_HIP : vec3(1.0, 0.0, 0.0)) : k == 2 ? vec3(0.0, -1.0, 0.0) : k == 3 ? DAM_BN : k == 4 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 0.0, -1.0);
    float d = k == 0 ? pn.x * x.x : k == 1 ? pn.x * x.y : k == 2 ? -DAM_Y : k == 3 ? (DAM_Y + ${f(DAM.thick)}) * DAM_BN.y + DAM_ZT * DAM_BN.z : k == 4 ? DAM_ZT : FREEBOARD + 4.0;
    float den = dot(rd, pn);
    float num = d - dot(ro, pn);
    if (den < -1e-5) { float t = num / den; if (t > tN) { tN = t; n = pn; } }
    else if (den > 1e-5) tF = min(tF, num / den);
    else if (num < 0.0) return -1.0;
  }
  return tN < tF && tN > 0.0 ? tN : -1.0;
}
// The nearest of the dam's pieces: four lengths of wall, three lintels, three gates. kind: 0 wall, 1 gate. lo, hi: the piece's own bounds.
float damHit(vec3 ro, vec3 rd, out vec3 n, out float tF, out float kind, out vec3 lo, out vec3 hi) {
  float best = -1.0;
  vec3 n1;
  float f1;
  kind = 0.0;
  if (boxHit(ro, rd, vec3(${f(DAM.x0)}, DAM_Y - 2.0, -FREEBOARD - 4.0), vec3(${f(DAM.x1)}, DAM_Y + DAM_T + 2.0, DAM_ZT + 1.0), n1, f1) < 0.0) return -1.0;
  for (int i = 0; i < 4; i++) {
    float t = wallHit(ro, rd, DAM_SEG[i], vec2(i == 0 ? 1.0 : 0.0, i == 3 ? 1.0 : 0.0), n1, f1);
    if (t > 0.0 && (best < 0.0 || t < best)) {
      best = t; n = n1; tF = f1; kind = 0.0;
      // (An end that runs into the bank has no arris there; a cut's cheek has.)
      lo = vec3(DAM_SEG[i].x - (i == 0 ? 400.0 : 0.0), DAM_Y, -FREEBOARD - 4.0);
      hi = vec3(DAM_SEG[i].y + (i == 3 ? 400.0 : 0.0), DAM_Y + DAM_T, DAM_ZT);
    }
  }
  for (int i = 0; i < 3; i++) {
    float gx = gateX(i);
    // (The crest runs on over each sluice: one wall, three cuts through it.)
    vec3 l1 = vec3(gx - GATE_W, DAM_Y, DAM_LZ);
    vec3 h1 = vec3(gx + GATE_W, DAM_Y + ${f(DAM.thick)}, DAM_ZT);
    float t = boxHit(ro, rd, l1, h1, n1, f1);
    if (t > 0.0 && (best < 0.0 || t < best)) {
      best = t; n = n1; tF = f1; kind = 0.0;
      lo = l1 - vec3(400.0, 0.0, 0.0);
      hi = h1 + vec3(400.0, 0.0, 0.0);
    }
    // The gate: a plate of clear ice at the head of the cut. Open, it has gone up into the wall and only its foot shows.
    float up = gateOf(i) * ${f(DAM.lift)};
    vec3 l2 = vec3(gx - GATE_W, DAM_Y + 12.0, up - FREEBOARD - 4.0);
    vec3 h2 = vec3(gx + GATE_W, DAM_Y + 26.0, min(up + DAM_LZ + 6.0, DAM_ZT - 2.0));
    t = boxHit(ro, rd, l2, h2, n1, f1);
    if (t > 0.0 && (best < 0.0 || t < best)) { best = t; n = n1; tF = f1; kind = 1.0; lo = l2 - vec3(400.0, 0.0, 0.0); hi = h2 + vec3(400.0, 0.0, 400.0); }
  }
  return best;
}
vec3 damColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, float kind, vec3 lo, vec3 hi) {
  vec3 hp = ro + rd * t;
  float z = hp.z + FREEBOARD;
  float px = max(t * uPxAng, 0.02);
  vec3 e3 = min(hp - lo, hi - hp);
  bool hipF = abs(n.x) > 0.3 && n.z > 0.3;
  // (The leaning face runs out at the wall's foot, not at the box round it.)
  float edge = abs(n.x) > 0.5 ? min(e3.y, e3.z) : n.z > 0.9 ? min(e3.x, e3.y) : min(e3.x, n.z > 0.2 ? hi.z - hp.z : e3.z);
  // (Map the broken cheek and the polished face in their own planes.)
  vec2 q = abs(n.x) > 0.5 ? vec2(hp.y + hp.x, z) : n.z > 0.9 ? hp.xy : vec2(hp.x, z);
  // The wall is the glacier's own ice, a body thick; a gate froze in a season: a hand of clear ice the pond shows through.
  vec3 col = iceGlacier(hp, n, rd, t, q, kind > 0.5 ? 16.0 : clamp(tF - t, 0.0, 400.0) + 170.0, 1.0, 1.0, kind > 0.5 ? 0.2 : 1.0, hipF || kind < 0.5 && n.z > 0.2 ? 1e3 : edge, 0.31 + kind * 0.47);
  // (Before dawn the wall is darkest at its foot, where the most ice stands behind each face, and palest under its crest.)
  if (kind < 0.5 && n.z < 0.9) col *= mix(1.0, 0.66 + 0.5 * smoothstep(0.0, DAM_H, z), uNight);
  if (n.z < 0.9) col = waterlineOn(col, z, 0.5 + 0.5 * sin(hp.x * 0.05));
  // (Inside a cut, under the lintel, the day does not reach.)
  if (n.z < -0.5) col *= 0.45;
  if (kind > 0.5 || gMirror > 0.5 && n.z < 0.9) return col;
  // Snow lies along the crest in one cornice and is drifted up the wall's two ends; icicles hang under it and under
  // each lintel. The gates are bare, clear ice.
  if (n.z > 0.9 || hipF) return snowOn(n, 0.12 * sin(hp.x * 0.07) * sin(hp.y * 0.09)) * mix(vec3(1.2), vec3(0.62, 0.84, 1.22), uNight);
  if (n.z < -0.5) return col;
  float hang = 9.0 + 3.0 * sin(q.x * 0.027 + 1.0) + 2.0 * sin(q.x * 0.083 + 2.0);
  float dz = DAM_H - hang - z;
  if (dz < 50.0) col = corniceOn(iciclesOn(col, q.x, dz, px, 30.0), n, dz, hang, px);
  return col;
}
`;

/** A ray against a box: the dam, the lattice and the canyon all ask. */
export const BOX_HIT = `
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
`;

/** Station 6, the water: fast and white below the open sluice, a bare wet bed below the shut ones. */
export const DAM_WATER = `
// The middle of sluice i's channel, d below the dam.
float sluiceMid(int i, float d) { return i == 0 ? ${sluiceX(0)} : i == 1 ? ${sluiceX(1)} : ${sluiceX(2)}; }
vec3 dam(vec3 col, vec3 dir, float tw) {
  vec3 n;
  float tF;
  float kind;
  vec3 lo;
  vec3 hi;
  // (From the seracs it lies a long way down the valley, straight behind them: it comes out of the air as the eye leaves them.)
  gSt.y *= 1.0 - smoothstep(1800.0, 2500.0, length(uCamPos.xy - vec2(1300.0, DAM_Y)));
  if (gSt.y <= 0.0) return col;
  float t = damHit(uCamPos, dir, n, tF, kind, lo, hi);
  // Spray stands in the air over the foot of the open sluice.
  float spray = 0.0;
  for (int i = 0; i < 3; i++) {
    float g = gateOf(i);
    if (g < 0.02) continue;
    vec3 c = vec3(gateX(i), DAM_Y + DAM_T + 34.0, -FREEBOARD + 16.0) - uCamPos;
    float along = dot(c, dir);
    if (along < 0.0 || (t > 0.0 && t < along - 40.0)) continue;
    vec3 off = c - dir * along;
    float puff = textureLod(uGrain, vec2(off.x + off.y, off.z - uTime * 26.0) / 190.0, 1.0).r;
    spray += g * exp(-dot(off * vec3(1.0, 1.0, 1.7), off) / 2600.0) * (0.35 + 0.65 * puff);
  }
  vec3 mist = mix(vec3(0.93, 0.97, 1.0) * (S.key * 0.24 + S.amb * 1.05), vec3(0.3, 0.45, 0.5) * 0.3 + uAurora * 0.2, uNight);
  if (t > gDepth || (t < 0.0 && tw > gDepth)) return col;
  if (t > 0.0 && (tw < 0.0 || t < tw)) {
    gDepth = t;
    col = mix(col, inAir(damColor(uCamPos, dir, t, tF, n, kind, lo, hi), dir, t), gSt.y);
    return mix(col, mist, clamp(spray * 0.5, 0.0, 0.6) * gSt.y);
  }
  if (tw < 0.0) return col;
  vec3 pwp = uCamPos + dir * tw;
  float d = pwp.y - DAM_Y;
  if (d < ${f(-DAM.pond - 120)} || d > 1010.0 || abs(pwp.x - 1300.0) > 640.0) return col;
  if (textureLod(uBedA, bedUv(pwp.xy), 0.0).r > -2.0) return col;
  // The dam's mirror image lies on the water either side of it.
  if (uLean < 1.5 && d > -260.0 && d < 420.0) {
    vec3 rd2 = normalize(vec3(dir.xy, -dir.z) + vec3(0.004 * sin(pwp.y * 0.2 + uTime * 0.8), 0.0, 0.0));
    float t2 = damHit(pwp, rd2, n, tF, kind, lo, hi);
    if (t2 > 0.0) {
      gMirror = 1.0;
      col = mix(col, inAir(damColor(pwp, rd2, t2, tF, n, kind, lo, hi), dir, tw + t2) * 0.74, 0.5 * gSt.y * (d < 0.0 ? 1.0 : 0.5));
      gMirror = 0.0;
    }
  }
  if (d < 0.0) {
    // The head pond is deep: by day it is dark water, and the wall's pale crest stands against it.
    float pond = smoothstep(${f(-DAM.pond - 100)}, ${f(-DAM.pond + 160)}, d) * (1.0 - uNight) * gSt.y;
    col = mix(col, col * vec3(0.2, 0.36, 0.5) + vec3(0.004, 0.02, 0.04) * S.amb.b, 0.86 * pond);
    // The draw toward the open sluice.
    for (int i = 0; i < 3; i++) {
      if (gateOf(i) < 0.02) continue;
      vec2 q = pwp.xy - vec2(gateX(i), DAM_Y);
      float pull = gateOf(i) * exp(-length(q * vec2(1.0, 0.55)) / 90.0);
      // (The pond's surface dips toward the gate and runs in: a smooth dark dimple, no more.)
      col *= 1.0 - 0.34 * pull * gSt.y;
    }
    return col;
  }
  int i = ${channelOf()};
  // (The channel turns in curves, not at corners: what is drawn along it follows the curve.)
  float cx = 0.25 * (sluiceMid(i, d - 80.0) + 2.0 * sluiceMid(i, d) + sluiceMid(i, d + 80.0));
  float sg = i == 0 ? uSurge.x : i == 1 ? uSurge.y : uSurge.z;
  float front = sg * 1120.0;
  float open = gateOf(i) * (1.0 - smoothstep(front - 30.0, front + 30.0, d));
  float fade = (1.0 - smoothstep(720.0, 980.0, d)) * gSt.y;
  float side = pwp.x - cx;
  float halfW = 60.0 - 20.0 * (1.0 - smoothstep(60.0, 260.0, d));
  float inCh = 1.0 - smoothstep(halfW - 8.0, halfW + 8.0, abs(side));
  float px = max(tw * uPxAng, 0.05);
  float fi = float(i);
  float quiet = 1.0 - 0.85 * wordsNear();
  // (How far in from the channel's side a place is, 0 at the side to 1 in its middle.)
  float mid = clamp(1.0 - abs(side) / halfW, 0.0, 1.0);
  vec3 skyUp = mix(beyond(pwp, normalize(vec3(dir.xy, -dir.z + 0.25))), skyNightOn(normalize(vec3(dir.xy, -dir.z + 0.25))), uNight);
  float fresW = 0.03 + 0.97 * pow(1.0 - clamp(-dir.z, 0.0, 1.0), 5.0);
  if (open < 1.0) {
    // Shut: the bed lies bare. It is the glacier's own ice, washed smooth and still wet: blue-grey, striped along the
    // way the water ran, the sky lying on it as a sheen. Washed stones lie where the water dropped them, most along
    // its sides; snow has blown in at its edges; and down its middle one thread of water still finds its way.
    float lane = side * 0.42 + 1.6 * sin(d * 0.012 + fi * 2.0) + 2.4 * sin(side * 0.09 + fi);
    float lid = floor(lane);
    float lh = cyH(lid + fi * 17.0);
    float stripe = 1.0 - smoothstep(0.08, 0.08 + 0.3 * px, abs(fract(lane) - 0.5) - 0.5 + 0.12 * lh);
    vec3 ice = mix(vec3(0.2, 0.36, 0.5), vec3(0.4, 0.58, 0.7), 0.25 + 0.5 * lh) * (1.0 - 0.22 * stripe * quiet);
    // (Deeper blue down its middle, where the water cut furthest.)
    ice *= 1.0 - 0.28 * smoothstep(0.35, 1.0, mid);
    vec3 bare = ice * (S.key * mix(0.13, 0.02, uNight) + S.amb * mix(1.05, 2.2, uNight));
    bare = mix(bare, skyUp, clamp(0.16 + 1.6 * fresW, 0.0, 0.7) * mix(1.0, 0.8, uNight));
    // The stones.
    float stoneK = (1.0 - smoothstep(1.2, 2.6, px)) * quiet;
    if (stoneK > 0.0) {
      vec2 sx = pwp.xy / 10.0;
      vec2 sc = floor(sx);
      vec2 sf = sx - sc;
      float best = 8.0;
      vec2 br = vec2(0.0);
      float bh = 0.0;
      for (int jj = -1; jj <= 1; jj++) {
        for (int ii = -1; ii <= 1; ii++) {
          vec2 g = vec2(float(ii), float(jj));
          vec2 h2 = hash2(sc + g);
          vec2 r = g + 0.2 + 0.6 * h2 - sf;
          float dd = dot(r, r);
          if (dd < best) { best = dd; br = r; bh = h2.x * 0.7 + h2.y * 0.3; }
        }
      }
      // (Few in the middle, where the water ran clean; more toward the sides and on the inside of each turn.)
      float want = 0.3 + 0.55 * smoothstep(0.55, 0.1, mid) + 0.25 * sin(d * 0.013 + fi * 1.7);
      float rad = (0.1 + 0.34 * fract(bh * 7.3) * fract(bh * 7.3)) * step(1.0 - 0.8 * want, fract(bh * 3.1 + 0.5));
      float dS = sqrt(best);
      float aS = px / 10.0;
      float on = (1.0 - smoothstep(rad - aS, rad + aS, dS)) * step(0.01, rad);
      vec3 Ls = keyDir();
      // (Each is a rounded lump: lit on the side turned to the light, wet and dark, with its own small shade beside it.)
      vec3 nSt = normalize(vec3(-br / max(rad, 0.05) * 0.9, 0.55));
      vec3 stone = mix(vec3(0.1, 0.11, 0.13), vec3(0.3, 0.31, 0.33), fract(bh * 13.7)) * (S.key * mix(0.26, 0.05, uNight) * (0.15 + 0.85 * max(dot(nSt, Ls), 0.0)) + S.amb * mix(0.9, 4.2, uNight) * (0.6 + 0.4 * nSt.z));
      // (Wet: a small glint of the sky on the shoulder turned to the light.)
      stone += skyUp * 0.3 * pow(max(dot(nSt, normalize(vec3(Ls.xy, 0.9))), 0.0), 6.0);
      float shade = (1.0 - smoothstep(rad, rad + 0.22, length(br - normalize(Ls.xy) * 0.16))) * step(0.01, rad);
      bare *= 1.0 - 0.4 * shade * stoneK * (1.0 - uNight * 0.5);
      bare = mix(bare, stone, on * stoneK);
    }
    // The thread: a hand of clear water, bright at its edges, with the light running down it.
    float mx = 15.0 * sin(d * 0.014 + fi * 2.0) + 5.0 * sin(d * 0.041 + fi);
    float tW = (4.2 + 1.8 * sin(d * 0.023 + fi * 3.0)) * smoothstep(0.0, 60.0, halfW - abs(mx) - 6.0);
    float dT = abs(side - mx);
    float thr = 1.0 - smoothstep(tW - 0.7 * px, tW + 0.7 * px, dT);
    vec3 trC = mix(vec3(0.1, 0.5, 0.6) * (S.key * 0.2 + S.amb * 1.15), vec3(0.01, 0.045, 0.06) + uAurora * 0.05, uNight);
    trC = mix(trC, skyUp, 0.35 + 0.4 * fresW);
    float glint = smoothstep(0.72, 1.0, sin(d * 0.21 - uTime * 5.0 + 3.0 * sin(side * 0.4))) * smoothstep(0.2, 1.0, sin(d * 0.037 - uTime * 0.8 + fi));
    trC += vec3(0.9, 0.97, 1.0) * (S.key * mix(0.22, 0.03, uNight) + S.amb * mix(0.9, 2.0, uNight)) * glint * 0.7;
    bare = mix(bare, trC, thr * 0.92);
    bare += vec3(0.85, 0.95, 1.0) * (S.key * mix(0.12, 0.01, uNight) + S.amb * mix(0.6, 1.2, uNight)) * (1.0 - smoothstep(0.0, 0.5 + px, abs(dT - tW))) * 0.6 * step(0.5, tW);
    // Snow blown in along its edges: one clean drift line.
    float drift = 1.0 - smoothstep(0.0, 4.0 + 2.0 * px, halfW - abs(side) - 9.0 - 6.0 * sin(d * 0.021 + fi * 3.0 + sign(side)) - 3.0 * sin(d * 0.067));
    bare = mix(bare, snowOn(vec3(0.0, 0.0, 1.0), 0.0), drift * 0.9);
    col = mix(col, bare, (1.0 - open) * fade);
  }
  if (open > 0.0) {
    // Open: fast, clear water. Deep green-blue down its middle and pale over the shallows at its sides; standing
    // waves off both banks, fixed in place while the water runs through them; foam in thin lines drawn out along the
    // flow; and white only where it lands at the sluice's foot, and on the head of the surge while the channel fills.
    float run = uTime * 300.0;
    float land = d - DAM_T - 10.0;
    float boil = exp(-max(land, 0.0) / 80.0) * smoothstep(${f(DAM.thick)}, DAM_T + 14.0, d);
    float head = exp(-abs(d - front) / 60.0) * step(sg, 0.98);
    vec3 deepC = mix(vec3(0.02, 0.26, 0.36), vec3(0.16, 0.6, 0.66), smoothstep(0.75, 0.15, mid)) * (S.key * 0.22 + S.amb * 1.15);
    deepC = mix(deepC, mix(vec3(0.006, 0.03, 0.045), vec3(0.02, 0.07, 0.09), smoothstep(0.75, 0.15, mid)) + uAurora * 0.05, uNight);
    vec3 wc = mix(col, deepC, 0.72);
    // The standing waves: a chevron off each bank, strongest below the landing; the face turned up the channel is
    // dark, the one turned to the sky bright.
    float chev = d * 0.15 - (1.0 - mid) * halfW * 0.2;
    float amp = (0.35 + 0.65 * exp(-max(land, 0.0) / 420.0)) * smoothstep(0.0, 40.0, land) * (0.45 + 0.55 * smoothstep(1.0, 0.3, mid));
    float wv = sin(chev + 0.6 * sin(side * 0.07)) + 0.4 * sin(chev * 1.7 + 1.0 + side * 0.05 - uTime * 1.3);
    wc *= 1.0 + 0.42 * amp * wv;
    wc = mix(wc, skyUp, clamp((0.1 + 1.8 * fresW) * (0.6 + 0.5 * amp * wv), 0.0, 0.75));
    wc += vec3(0.9, 0.97, 1.0) * (S.key * mix(0.2, 0.02, uNight) + S.amb * mix(0.5, 1.6, uNight)) * pow(max(wv / 1.45, 0.0), 6.0) * amp * 0.5;
    // The foam: lines, each a hair wide and many times as long, carried down faster in the middle than at the sides.
    float foam = 0.0;
    for (int k = 0; k < 2; k++) {
      float cw = k == 0 ? 8.5 : 14.0;
      // (They wander across the channel as they go: no two run side by side for long.)
      float lx = side / cw + 0.9 * sin(d * 0.0063 + float(k) * 2.0 + fi) + float(k) * 0.37;
      float id = floor(lx);
      float h = cyH(id * 3.71 + fi * 13.0 + float(k) * 5.0);
      float sp = run * (0.62 + 0.38 * mid) * (0.85 + 0.3 * h);
      float seg = (d - sp) / (110.0 + 240.0 * h) + h * 7.0;
      float fs = fract(seg);
      float on = step(0.66 - 0.36 * exp(-max(land, 0.0) / 200.0) - 0.16 * smoothstep(0.5, 0.0, mid), cyH(id + floor(seg) * 7.3 + float(k)));
      // (Each is drawn out to a point at both ends.)
      float wl = (0.035 + 0.06 * h) * sin(3.1416 * fs);
      foam = max(foam, on * step(0.004, wl) * (1.0 - smoothstep(wl, wl + 0.6 * px / cw + 0.008, abs(fract(lx) - 0.5 - 0.3 * (h - 0.5)))));
    }
    // (Before dawn white water is the palest thing on the ground: it holds the sky's light, cold.)
    vec3 white = mix(vec3(0.93, 0.97, 1.0) * (S.key * 0.3 + S.amb * 1.1), gFoamN * 1.5 + vec3(0.02, 0.03, 0.035), uNight);
    wc = mix(wc, white, foam * 0.85 * smoothstep(0.0, 30.0, land) * quiet);
    // The landing: the tongue comes through the cut glassy and green, and breaks white where it meets the channel.
    vec4 gb = textureLod(uGrain, vec2(side / 60.0 + fi * 0.3, (d - run * 0.5) / 190.0), lodFor(px, 60.0, 256.0));
    float churn = clamp(boil * (0.75 + 0.9 * gb.r) + head * (0.6 + 0.6 * gb.g), 0.0, 1.0);
    wc = mix(wc, white, smoothstep(0.3, 0.75, churn));
    col = mix(col, wc, open * inCh * fade);
  }
  return mix(col, mist, clamp(spray * 0.5, 0.0, 0.6) * gSt.y);
}
`;

/** How far a place is from a stretch of line: the lattice's thread and the canyon's plan both ask. */
export const SEG_D = `
float segD(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 ab = b - a;
  h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * h);
}
`;

const cubeRnd = (k: number, m: number) => fr(Math.sin((k % 4) * 127.1 + Math.floor(k / 4) * 311.7 + m * 74.7 + 4.7) * 43758.5453);
/** Each cube's half width, its height, and how far its upright and its top edges have melted back. */
const cubeSizes = () =>
  Array.from({ length: 16 }, (_, k) => {
    const half = (LATTICE.size / 2) * (0.86 + 0.24 * cubeRnd(k, 0));
    const h = LATTICE.h * (0.7 + 0.75 * cubeRnd(k, 1));
    return `vec4(${half.toFixed(2)}, ${h.toFixed(2)}, ${(7 + 12 * cubeRnd(k, 2)).toFixed(2)}, ${(6 + 10 * cubeRnd(k, 3)).toFixed(2)})`;
  }).join(', ');
/** How unevenly each cube's four corners have melted (x, y: toward which side more). */
const cubeLean = () => Array.from({ length: 16 }, (_, k) => `vec2(${(1.6 * cubeRnd(k, 4) - 0.8).toFixed(3)}, ${(1.6 * cubeRnd(k, 5) - 0.8).toFixed(3)})`).join(', ');
/** How each cube has settled: turned a little on the water, and tipped a little out of level. (A mat3's columns: where its own axes point.) */
const cubeFrames = () =>
  Array.from({ length: 16 }, (_, k) => {
    const yaw = 0.3 * (cubeRnd(k, 6) - 0.5);
    const tx = 0.16 * (cubeRnd(k, 7) - 0.5);
    const ty = 0.16 * (cubeRnd(k, 8) - 0.5);
    const cz = Math.cos(yaw), sz = Math.sin(yaw), cx = Math.cos(tx), sx = Math.sin(tx), cy = Math.cos(ty), sy = Math.sin(ty);
    // Rz(yaw) * Rx(tx) * Ry(ty)
    const rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
    const ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
    const rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
    const mul = (a: number[][], b: number[][]) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
    const r = mul(rz, mul(rx, ry));
    const col = (j: number) => `${r[0][j].toFixed(5)}, ${r[1][j].toFixed(5)}, ${r[2][j].toFixed(5)}`;
    return `mat3(${col(0)}, ${col(1)}, ${col(2)})`;
  }).join(', ');

/** Station 7: sixteen cubes of ice in a still pool, one thread of current round them all, a light passing through them in turn. */
export const LATTICE_ICE = `
const vec2 LAT_C = vec2(${f(LATTICE.x)}, ${f(LATTICE.y)});
const float LAT_P = ${f(LATTICE.pitch)};
const float LAT_S = ${f(LATTICE.size / 2)};
const float LAT_H = ${f(LATTICE.h)};
const float LAT_IN = ${f(Math.hypot(2 * LATTICE.pitch, LATTICE.pitch * 2 + 110 - 2 * LATTICE.pitch))};
const float LAT_LAP = ${f(4 * LATTICE.pitch + (Math.PI * LATTICE.pitch) / 2)};
// The thread: in from the pool's head, along the upstream side of each row in turn, out at its foot.
// Returns how far off it a place is; s is how far along it.
float threadAt(vec2 q, out float s) {
  float h;
  float best = segD(q, vec2(0.0, -2.0 * LAT_P - 110.0), vec2(-2.0 * LAT_P, -2.0 * LAT_P), h);
  s = h * LAT_IN;
  for (int j = 0; j < 4; j++) {
    float fj = float(j);
    float y = (fj - 2.0) * LAT_P;
    float sgn = (j == 1 || j == 3) ? -1.0 : 1.0;
    float d = segD(q, vec2(-2.0 * LAT_P * sgn, y), vec2(2.0 * LAT_P * sgn, y), h);
    if (d < best) { best = d; s = LAT_IN + fj * LAT_LAP + h * 4.0 * LAT_P; }
    if (j < 3) {
      // The turn at the row's end, round to the next.
      vec2 c = vec2(2.0 * LAT_P * sgn, y + 0.5 * LAT_P);
      vec2 r = q - c;
      if (r.x * sgn > 0.0) {
        d = abs(length(r) - 0.5 * LAT_P);
        if (d < best) { best = d; s = LAT_IN + fj * LAT_LAP + 4.0 * LAT_P + (atan(r.y, r.x * sgn) + 1.5708) * 0.5 * LAT_P; }
      }
    }
  }
  float d = segD(q, vec2(-2.0 * LAT_P, LAT_P), vec2(0.0, 2.0 * LAT_P + 110.0), h);
  if (d < best) { best = d; s = LAT_IN + 3.0 * LAT_LAP + 4.0 * LAT_P + h * LAT_IN; }
  return best;
}
// Where the light is along the thread now, and how lit the cube in column i of row j is by it.
float latPulse() { return fract(uTime / 9.0) * (LAT_IN * 2.0 + 3.0 * LAT_LAP + 4.0 * LAT_P + 500.0) - 250.0; }
float cubeGlow(float i, float j) {
  float along = mod(j, 2.0) < 0.5 ? i : 3.0 - i;
  float at = LAT_IN + j * LAT_LAP + (along + 0.5) * LAT_P;
  float d = (latPulse() - at) / (0.8 * LAT_P);
  return exp(-d * d);
}
// No two cubes are the same: each has melted to its own size, settled a little askew on the water, and lost its
// corners. xy: half its width and its height; zw: how far its upright and its top edges have melted back.
const vec4 LAT_SZ[16] = vec4[16](${cubeSizes()});
const vec2 LAT_V[16] = vec2[16](${cubeLean()});
const mat3 LAT_R[16] = mat3[16](${cubeFrames()});
vec2 cubeSize(vec2 ij) { return LAT_SZ[int(ij.x) + 4 * int(ij.y)].xy; }
float cubeRndG(vec2 ij) { return fract(sin(ij.x * 127.1 + ij.y * 311.7 + 9.1) * 43758.5453); }
float cubeGlowAt(vec2 ij) { return all(greaterThanEqual(ij, vec2(0.0))) && all(lessThanEqual(ij, vec2(3.0))) ? cubeGlow(ij.x, ij.y) : 0.0; }
// One cube: where a ray meets it, or -1.
float cubeOne(int k, vec3 ro, vec3 rd, out vec3 n, out float tF) {
  vec2 ij = vec2(float(k - (k / 4) * 4), float(k / 4));
  vec3 c = vec3(LAT_C + (ij - 1.5) * LAT_P, -FREEBOARD);
  vec4 sz = LAT_SZ[k];
  // (Most rays pass a cube by: a ball round it is asked first.)
  vec3 oc = c + vec3(0.0, 0.0, sz.y * 0.5) - ro;
  float tc = dot(oc, rd);
  if (dot(oc, oc) - tc * tc > 2.0 * sz.x * sz.x + 0.3 * sz.y * sz.y) return -1.0;
  // (The ray in the cube's own frame.)
  vec3 ol = (ro - c) * LAT_R[k];
  vec3 dl = rd * LAT_R[k];
  vec3 n1;
  float f1;
  float t = boxHit(ol, dl, vec3(-sz.x, -sz.x, -12.0), vec3(sz.x, sz.x, sz.y), n1, f1);
  if (t < 0.0) return -1.0;
  // Its corners have melted back: four upright edges and the four edges of its top are cut away, no two by as much.
  float tN = t;
  float tX = f1;
  vec3 nn = n1;
  for (int e = 0; e < 8; e++) {
    vec3 pn;
    float d;
    if (e < 4) {
      vec2 sg = vec2(e < 2 ? 1.0 : -1.0, e == 0 || e == 2 ? 1.0 : -1.0);
      pn = vec3(sg, 0.0) * 0.70711;
      d = (2.0 * sz.x - sz.z * (1.0 + 0.5 * sg.x * LAT_V[k].x + 0.5 * sg.y * LAT_V[k].y)) * 0.70711;
    } else {
      float sg = e < 6 ? 1.0 : -1.0;
      bool onX = e == 4 || e == 6;
      pn = (onX ? vec3(sg, 0.0, 1.0) : vec3(0.0, sg, 1.0)) * 0.70711;
      d = (sz.x + sz.y - sz.w * (1.0 + 0.5 * sg * (onX ? LAT_V[k].y : LAT_V[k].x))) * 0.70711;
    }
    float den = dot(dl, pn);
    float num = d - dot(ol, pn);
    if (den < -1e-6) { float tt = num / den; if (tt > tN) { tN = tt; nn = pn; } }
    else if (den > 1e-6) tX = min(tX, num / den);
    else if (num < 0.0) tX = -1.0;
  }
  if (tN >= tX) return -1.0;
  n = LAT_R[k] * nn;
  tF = tX;
  return tN;
}
float cubesHit(vec3 ro, vec3 rd, out vec3 n, out float tF, out vec2 id) {
  vec3 n1;
  float f1;
  float ext = 1.5 * LAT_P + LAT_S * 1.5;
  if (boxHit(ro, rd, vec3(LAT_C - ext, -FREEBOARD - 12.0), vec3(LAT_C + ext, LAT_H * 1.7 - FREEBOARD), n1, f1) < 0.0) return -1.0;
  float best = -1.0;
  for (int k = 0; k < 16; k++) {
    float t = cubeOne(k, ro, rd, n1, f1);
    if (t > 0.0 && (best < 0.0 || t < best)) { best = t; n = n1; tF = f1; id = vec2(float(k - (k / 4) * 4), float(k / 4)); }
  }
  return best;
}
vec3 cubeColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, vec2 id) {
  int k = int(id.x) + 4 * int(id.y);
  vec3 hp = ro + rd * t;
  vec3 c = vec3(LAT_C + (id - 1.5) * LAT_P, -FREEBOARD);
  vec4 sz = LAT_SZ[k];
  vec3 lp = (hp - c) * LAT_R[k];
  vec3 nl = n * LAT_R[k];
  float glow = cubeGlow(id.x, id.y);
  vec3 hf = vec3(sz.x, sz.x, sz.y);
  vec3 nw = n;
  bool isTop = nl.z > 0.6;
  vec2 q = isTop ? lp.xy : vec2(abs(nl.x) > abs(nl.y) ? lp.y : lp.x, lp.z);
  vec4 gr = textureLod(uGrain, q / 120.0 + id * 0.37, 0.0);
  // (How far this place is from the nearest of the cube's edges, along its face.)
  vec3 de = vec3(hf.xy - abs(lp.xy), hf.z - lp.z);
  float edge = max(min(de.x, de.y), min(max(de.x, de.y), de.z));
  // The cut faces keep their geometric normals down to the last chip.
  vec2 a = abs(lp.xy + 5.0 * vec2(sin(id.x * 2.3 + id.y), cos(id.y * 1.9 + id.x))) / sz.x;
  float capD = length(max(a - 0.5, 0.0)) - 0.24 - 0.05 * sin(lp.x * 0.11 + id.x * 2.0) * sin(lp.y * 0.13 + id.y) - 0.1 * cubeRndG(id);
  float aa = max(t * uPxAng, 0.02) / sz.x;
  float cap = isTop ? 1.0 - smoothstep(-aa,aa,capD) : 0.0;
  vec3 col = vec3(0.0);
  if (cap < 1.0) col = iceGlacier(hp, nw, rd, t, q * vec2(1.0, 1.7) + id * 53.0, tF - t, 1.0, 1.0, isTop ? 0.0 : 0.7, edge + 1.0, dot(id, vec2(0.37, 0.61)));
  if (!isTop) col = waterlineOn(col, lp.z, 0.5);
  else {
    vec3 nS = normalize(nw + LAT_R[k] * vec3(lp.xy / sz.x, 0.0) * 1.3 * smoothstep(-0.3, 0.0, capD));
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.14, capD)) * (1.0 - cap);
    col = mix(col, snowOn(nS, 0.0) * mix(vec3(1.12), vec3(0.62, 0.84, 1.22), uNight), cap);
  }
  // The light inside: it stands at the cube's heart, so it is brightest where the eye looks through the most ice
  // and toward the middle of each face, and the air trapped in the cube carries it.
  vec3 mid = hp + rd * (tF - t) * 0.5 - vec3(c.xy, sz.y * 0.45 - FREEBOARD);
  float core = exp(-dot(mid, mid) / (sz.x * sz.x * 0.9));
  float thickK = clamp((tF - t) / (sz.x * 2.0), 0.0, 1.0);
  col += vec3(0.3, 0.84, 1.0) * glow * (1.7 * core + 0.3 * thickK + 0.35 * smoothstep(0.55, 0.8, gr.r)) * mix(0.8, 1.1, uNight);
  // And the light its neighbours hold falls on it: on the face turned to a lit cube, and a little on its top.
  float nb = isTop
    ? 0.2 * (cubeGlowAt(id + vec2(1.0, 0.0)) + cubeGlowAt(id - vec2(1.0, 0.0)) + cubeGlowAt(id + vec2(0.0, 1.0)) + cubeGlowAt(id - vec2(0.0, 1.0)))
    : cubeGlowAt(id + (abs(nl.x) > abs(nl.y) ? vec2(sign(nl.x), 0.0) : vec2(0.0, sign(nl.y)))) * (0.45 + 0.55 * (1.0 - clamp(lp.z / sz.y, 0.0, 1.0)));
  col += vec3(0.22, 0.74, 0.95) * nb * mix(0.5, 0.8, uNight) * (0.7 + 0.5 * gr.a);
  return col;
}
/** The lattice over the finished ground, its mirror image, the thread, and the light on the water. */
vec3 lattice(vec3 col, vec3 dir, float tw) {
  vec3 n;
  float tF;
  vec2 id;
  float t = cubesHit(uCamPos, dir, n, tF, id);
  if (t > gDepth || (t < 0.0 && tw > gDepth)) return col;
  if (t > 0.0 && (tw < 0.0 || t < tw)) {
    gDepth = t;
    float cov = 1.0;
    vec3 n2;
    float tF2;
    // (Its outline is counted on the cube that was met: the others are not asked again.)
    for (int k = 0; k < 2; k++) {
      if (uLean > 0.5) break;
      vec3 rd = normalize(dir + (uCamR * (k == 0 ? 0.5 : -0.5) + uCamU * (k == 0 ? -0.5 : 0.5)) * uPxAng);
      if (cubeOne(int(id.x) + 4 * int(id.y), uCamPos, rd, n2, tF2) < 0.0) cov -= 0.33;
    }
    return mix(col, inAir(cubeColor(uCamPos, dir, t, tF, n, id), dir, t), cov * gSt.z);
  }
  if (tw < 0.0) return col;
  vec3 pwp = uCamPos + dir * tw;
  vec2 q = pwp.xy - LAT_C;
  if (max(abs(q.x), abs(q.y)) > 2.0 * LAT_P + 300.0 || textureLod(uBedA, bedUv(pwp.xy), 0.0).r > -2.0) return col;
  // The thread of current: the one place the mirror is broken. Deeper, darker water with the light running on it.
  float s;
  // (It runs close under the row it is about to light: on the far side of each lane, where the eye sees it past the row before.)
  float d = threadAt(q - vec2(0.0, ${f((LATTICE.pitch - LATTICE.size) * 0.21)}), s);
  float band = 1.0 - smoothstep(8.0, 26.0, d);
  float lodT = lodFor(tw * uPxAng, 40.0, 256.0);
  float run = textureLod(uGrain, vec2(d / 120.0, (s - uTime * 120.0) / 1500.0), lodT).r;
  float fine = textureLod(uGrain, vec2(d / 40.0 + 0.3, (s - uTime * 150.0) / 520.0), lodT).g;
  float head = exp(-abs(s - latPulse()) / 110.0);
  vec3 rd2 = normalize(vec3(dir.xy, -dir.z) + vec3(band * (run - 0.5) * 0.07, 0.0, 0.0));
  float t2 = uLean < 1.5 ? cubesHit(pwp, rd2, n, tF, id) : -1.0;
  if (t2 > 0.0) {
    gMirror = 1.0;
    col = mix(col, inAir(cubeColor(pwp, rd2, t2, tF, n, id), dir, tw + t2) * 0.8, 0.68 * gSt.z);
    gMirror = 0.0;
  }
  col = mix(col, col * mix(vec3(0.36, 0.66, 0.76), vec3(0.7, 0.9, 0.9), uNight), band * 0.75 * gSt.z);
  // (Moving water: soft bright faces that travel along it, never an outline.)
  // (Each a hair wide and many times as long, carried along it: drawn, so they are lines at any distance.)
  float lc = d / 6.5;
  float lcId = floor(lc);
  float lcH = cyH(lcId * 5.3 + 1.0);
  float lcSeg = (s - uTime * (110.0 + 60.0 * lcH)) / (90.0 + 160.0 * lcH) + lcH * 9.0;
  float lcW = (0.06 + 0.1 * lcH) * sin(3.1416 * fract(lcSeg));
  float lines = step(0.6, cyH(lcId + floor(lcSeg) * 7.3)) * step(0.004, lcW) * (1.0 - smoothstep(lcW * 0.6, lcW * 0.6 + 0.09 * max(tw * uPxAng, 0.05) + 0.006, abs(fract(lc) - 0.5 - 0.3 * (lcH - 0.5)))) * (1.0 - 0.85 * wordsNear());
  // (And the water in it is ruffled: small waves across it that travel with it, lit on the side turned to the sky.)
  float ruf = sin(s * 0.3 - uTime * 4.0 + 0.9 * sin(d * 0.09 + s * 0.013)) * (0.35 + 0.65 * smoothstep(-0.2, 0.6, sin(s * 0.021 - uTime * 0.5))) * band * (1.0 - smoothstep(1.0, 3.0, tw * uPxAng)) * (1.0 - 0.85 * wordsNear());
  col *= 1.0 + 0.1 * ruf * gSt.z;
  col += vec3(0.8, 0.93, 1.0) * (S.key * mix(0.12, 0.02, uNight) + S.amb * mix(0.5, 1.2, uNight) + uAurora * 0.08) * pow(max(ruf, 0.0), 4.0) * 0.3 * gSt.z;
  col = mix(col, vec3(0.88, 0.96, 1.0) * (S.key * mix(0.24, 0.06, uNight) + S.amb * 0.95) + uAurora * 0.3, lines * band * 0.8 * gSt.z);
  col += vec3(0.3, 0.84, 1.0) * band * head * mix(0.5, 0.8, uNight) * gSt.z;
  // Each lit cube throws its light on the water round it.
  vec2 cell = clamp(floor(q / LAT_P + 2.0), 0.0, 3.0);
  float gl = cubeGlow(cell.x, cell.y) * exp(-max(length(q - (cell - 1.5) * LAT_P) - LAT_S, 0.0) / 52.0);
  col += vec3(0.2, 0.64, 0.78) * gl * mix(0.2, 0.36, uNight) * gSt.z;
  // A dark wet foot under each.
  vec2 fq = abs(q - (cell - 1.5) * LAT_P) - cubeSize(cell).x;
  col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 14.0, max(fq.x, fq.y))) * gSt.z;
  return col;
}
`;

/** Station 8: a glacier the river has cut a canyon through, two tight bends back to back. */
export const CANYON_ICE = `
const float CY_R = ${f(CANYON.r)};
const float CY_W = ${f(CANYON.w / 2 - 16)};
const float CY_H = ${f(CANYON.h)};
const float CY_LEAN = ${CANYON.lean.toFixed(3)};
const vec2 CY_C1 = vec2(${f(BENDS[0].x)}, ${f(BENDS[0].y)});
const vec2 CY_LO = vec2(${f(CANYON.x0)}, ${f(CANYON.y0)});
const vec2 CY_HI = vec2(${f(CANYON.x1)}, ${f(CANYON.y1)});
const float CY_XE = ${f(BENDS[1].x + CANYON.r)};
// How far a place is from the river's middle line. (The second bend's outside is cut square.)
float canyonD(vec2 p) {
  float h;
  float d = segD(p, vec2(1300.0, ${f(T2 + 5000)}), vec2(1300.0, CY_C1.y), h);
  vec2 r1 = p - CY_C1;
  if (r1.x < 0.0 && r1.y > 0.0) d = min(d, abs(length(r1) - CY_R));
  d = min(d, segD(p, vec2(CY_C1.x, CY_C1.y + CY_R), vec2(${f(BENDS[1].x)}, CY_C1.y + CY_R), h));
  d = min(d, segD(p, vec2(CY_XE, ${f(BENDS[1].y)}), vec2(CY_XE, ${f(T2 + 7700)}), h));
  // (The hall: measured square, so its walls meet at true corners.)
  vec2 b = abs(p - vec2(${f((HALL.x0 + HALL.x1) / 2)}, ${f((HALL.y0 + HALL.y1) / 2)})) - vec2(${f((HALL.x1 - HALL.x0) / 2)}, ${f((HALL.y1 - HALL.y0) / 2)});
  return min(d, max(b.x, b.y) + CY_W);
}
// 0..1: by the face in the hall's east wall, where the wall stands plumb and smooth over the picture.
float faceNear(vec3 p) {
  return (1.0 - smoothstep(${f(FACE.w * 0.5 + 10)}, ${f(FACE.w * 0.5 + 90)}, abs(p.y - ${f(FACE.y)}))) * smoothstep(${f(FACE.x - 150)}, ${f(FACE.x - 40)}, p.x);
}
// How far inside the canyon's open air a place is (under 0: in the ice). The walls lean back as they rise,
// and the water has scalloped them: long hollows along the flow, ledges where one year's ice lies on the last.
// (D: how far the place is from the river's middle line.)
float canyonAirD(vec3 p, float D) {
  float z = p.z + FREEBOARD;
  float plumb = p.x > ${f(FACE.x - 160)} ? faceNear(p) : 0.0;
  if (plumb >= 1.0) return CY_W - D;
  float along = (p.x + p.y) * 0.7;
  float relief = 9.0 * sin(along * 0.021 + 1.6 * sin(z * 0.017)) + 4.0 * sin(z * 0.09 + along * 0.004) + 3.0 * sin(along * 0.083 + z * 0.05);
  return CY_W + (CY_LEAN * z + relief) * (1.0 - plumb) - D;
}
float canyonAir(vec3 p) { return canyonAirD(p, canyonD(p.xy)); }
// The crevasse. Where the river turns away at the first bend a dry slot runs straight on through the glacier, its
// floor above the water and its walls leaning apart as they rise: the first reach looks down it to the day beyond.
const float SL_X = 1300.0;
const float SL_Y = ${f(BENDS[0].y + 120)};
const float SL_A = 30.0;
const float SL_B = 0.19;
const float SL_F = 40.0;
float slotIn(vec3 p) {
  float z = p.z + FREEBOARD;
  return min(min(SL_A + SL_B * z - abs(p.x - SL_X), z - SL_F), p.y - SL_Y);
}
// Where a ray inside the crevasse leaves it. how: 0 out of its far end or its top (to the day), 1 by a wall, 2 by the floor, 3 back out of its mouth.
float slotOut(vec3 ro, vec3 rd, out float how) {
  float tF = 1e9;
  how = 0.0;
  float z = ro.z + FREEBOARD;
  for (int k = 0; k < 2; k++) {
    float sg = k == 0 ? 1.0 : -1.0;
    float den = sg * rd.x - SL_B * rd.z;
    if (den > 1e-6) { float t = (SL_A + SL_B * z - sg * (ro.x - SL_X)) / den; if (t < tF) { tF = t; how = 1.0; } }
  }
  if (rd.z < -1e-6) { float t = (SL_F - z) / rd.z; if (t < tF) { tF = t; how = 2.0; } }
  if (rd.y > 1e-6) { float t = (CY_HI.y - ro.y) / rd.y; if (t < tF) { tF = t; how = 0.0; } }
  if (rd.z > 1e-6) { float t = (CY_H + 1.0 - ro.z) / rd.z; if (t < tF) { tF = t; how = 0.0; } }
  if (rd.y < -1e-6) { float t = (SL_Y - ro.y) / rd.y; if (t < tF) { tF = t; how = 3.0; } }
  return max(tF, 0.0);
}
// The app, in the ice of the hall's east wall. It is not hung on the wall: it lies a hand inside clear ice, with no
// frame. It is seen clean, at its own contrast, from edge to edge of its words; only round its rim does rime close in
// over it and the rougher ice there bend it away, so it has no outline of its own. Before dawn it is a screen alight
// in the ice: dimmed to the night and taken into the ice's blue, lighting the rime round it and the water under it.
// gFaceK: how much of the pixel last asked is the picture itself (the air between the walls is not laid over it).
float gFaceK = 0.0;
// The light the app's page gives off before dawn (its white, linear), and where its middle is.
const vec3 FACE_LAMP = vec3(0.27, 0.32, 0.365);
const vec3 FACE_AT = vec3(${f(FACE.x)}, ${f(FACE.y)}, ${f(FACE.z + FACE.h * 0.5)});
// Where a place on the wall is in the picture (0..1 across, 0..1 up). The page's own top edge is its ground colour:
// it runs on a little way above and beside what was captured, under the rime.
vec2 faceUv(vec3 p, vec3 rd) {
  vec2 q = vec2(${f(FACE.y + FACE.w / 2)} - p.y, p.z - ${f(FACE.z)}) / vec2(${f(FACE.w)}, ${f(FACE.h)});
  q += rd.yz / max(rd.x, 0.3) * vec2(-9.0 / ${f(FACE.w)}, 9.0 / ${f(FACE.h)});
  return vec2(0.5 + (q.x - 0.5) * 1.07, q.y * 1.07);
}
vec3 faceIn(vec3 col, vec3 p, vec3 n, vec3 rd, float pic) {
  vec2 q = vec2(${f(FACE.y + FACE.w / 2)} - p.y, p.z - ${f(FACE.z)}) / vec2(${f(FACE.w)}, ${f(FACE.h)});
  if (n.x > -0.5 || p.x < ${f(FACE.x - 60)} || any(lessThan(q, vec2(-0.5))) || any(greaterThan(q, vec2(1.5)))) return col;
  float dist = length(p - uCamPos);
  float px = max(dist * uPxAng, 0.02);
  // The pane: clear, polished ice over the page, a hand wider than it all round, its corners round. It is the one
  // true shape in the hall: its edge is a line, never a torn one. (wd: how far outside it a place is; under 0, in it.)
  vec2 wb = abs((q - 0.5) * vec2(${f(FACE.w)}, ${f(FACE.h)})) - vec2(${f(FACE.w * 0.5 - 6)}, ${f(FACE.h * 0.5 - 6)});
  float wd = length(max(wb, 0.0)) + min(max(wb.x, wb.y), 0.0) - 18.0;
  float pane = 1.0 - smoothstep(-0.7 * px, 0.7 * px, wd);
  vec2 uv = faceUv(p, rd);
  vec3 img;
  if (gMirror > 0.5) {
    // (Its image in the moving water is its light, not its words: one even glow, with no dark marks where its lines were.)
    img = pow(textureLod(uSlabTex, mix(vec2(0.5), vec2(uv.x, 1.0 - uv.y), 0.12), 10.0).rgb, vec3(2.2));
  } else if (pane > 0.0) {
    // (Where the two rays beside this one meet the wall: how far the picture moves under one device pixel.)
    vec3 d1 = normalize(rd + uCamR * uPxAng);
    vec3 d2 = normalize(rd + uCamU * uPxAng);
    vec3 ro = p - rd * dist;
    vec2 u1 = faceUv(ro + d1 * ((p.x - ro.x) / max(d1.x, 1e-3)), d1) - uv;
    vec2 u2 = faceUv(ro + d2 * ((p.x - ro.x) / max(d2.x, 1e-3)), d2) - uv;
    img = pow(picRead(uSlabTex, vec2(uv.x, 1.0 - uv.y), u1 * vec2(1.0, -1.0), u2 * vec2(1.0, -1.0)), vec3(2.2));
  } else img = vec3(0.0);
  vec3 glow = pow(textureLod(uSlabTex, vec2(0.5), 7.0).rgb, vec3(2.2));
  // (By day the day lights it through the ice, and it keeps its own blacks and whites. Before dawn it is a lamp: the
  // page as it is, alight, its ground bright enough that its dark words are read against it; a little brighter at its middle.)
  vec3 lamp = FACE_LAMP * (0.86 + 0.14 * smoothstep(0.0, 80.0, -wd));
  vec3 lit = img * mix(mix(S.amb * 1.05 + S.key * 0.2, S.amb * 2.1 + S.key * 0.035, uHour.z), lamp, uNight);
  // (Before dawn its image in the water is a low afterglow: the water under the words stays dark and calm.)
  if (gMirror > 0.5) lit *= mix(1.0, 0.22, uNight);
  // (The page lies a hand inside the ice: the pane's own thickness shades its rim, and a breath of the ice's blue lies over it.)
  lit *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 7.0, -wd));
  lit = mix(lit, lit * vec3(0.8, 0.94, 1.0) + iceBody(0.5) * S.amb * 0.08 * (1.0 - uNight), 0.08);
  // Round the pane the wall is white with rime, thickest at the pane's edge and gone a body's length from it: fine
  // crystals, each a pixel or two. Before dawn it holds the page's light.
  vec4 gi = textureLod(uGrain, p.yz / 44.0 + 0.4, lodFor(px, 44.0, 256.0));
  float out_ = max(wd, 0.0);
  float rime = exp(-out_ / 17.0) * (0.72 + 0.28 * gi.g) * (1.0 - pane);
  vec3 frost = mix(vec3(0.74, 0.86, 0.94) * (S.amb * 1.25 + S.key * 0.1), vec3(0.3, 0.4, 0.55) * S.amb * 2.3 + glow * FACE_LAMP * vec3(0.8, 1.0, 1.15) * (0.1 + 0.75 * exp(-out_ / 26.0)), uNight);
  col = mix(col, frost * (0.9 + 0.2 * gi.r), rime * 0.85 * pic);
  // (The pane's edge is a break in the ice: a thin shade outside it, a line of bent light just inside.)
  col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 5.0, out_)) * (1.0 - pane) * pic;
  col = mix(col, lit, pane * pic);
  col += mix(vec3(0.7, 0.92, 1.0) * (S.amb * 0.55 + S.key * 0.08), glow * FACE_LAMP * 1.3, uNight) * (1.0 - smoothstep(0.0, 0.8 + px, abs(wd + 1.6))) * pic * (gMirror > 0.5 ? 0.0 : 0.8);
  gFaceK = pane * pic;
  // The pane's polished face lies over it all: a little of the sky on the ice (least over the page, seen square on).
  float fr = 0.03 + 0.97 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
  return mix(col, beyond(p, reflect(rd, n)), fr * mix(0.3, 0.1, pane) * (1.0 - 0.6 * uNight));
}
// The glacier's top. Its front is an ice cliff with a ragged foot; behind it the surface rolls, and is crevassed across the flow.
float glacierTop(vec2 p) {
  vec2 e = min(p - CY_LO, CY_HI - p);
  float m = min(e.x, e.y);
  if (m <= 0.0) return 0.0;
  // The ragged front varies by at most 60 units. Beyond 270 both rise factors are one.
  float rise = 1.0;
  if (m < 270.0) {
    float rag = 34.0 * sin(p.x * 0.011 + 1.3) * cos(p.y * 0.004) + 16.0 * sin(p.y * 0.012 + 0.4) * cos(p.x * 0.004) + 10.0 * sin((p.x + p.y) * 0.0171 + 2.0);
    rise = smoothstep(0.0, 170.0, m + rag - 40.0) * smoothstep(0.0, 60.0, m);
  }
  float roll = 0.92 + 0.05 * sin(p.x * 0.006 + 0.7) * sin(p.y * 0.0052 + 2.0) + 0.03 * sin(p.y * 0.021 + p.x * 0.004);
  float slot = 0.0;
  if (m > 150.0 && abs(p.x - 1660.0) > 600.0) {
    float cv = sin(p.y * 0.05 + 3.0 * sin(p.x * 0.004) + 1.7 * sin(p.x * 0.013));
    slot = smoothstep(0.84, 0.98, cv) * smoothstep(150.0, 300.0, m) * smoothstep(600.0, 760.0, abs(p.x - 1660.0));
  }
  return CY_H * rise * roll - 30.0 * slot;
}
// The hall's east wall is one flat plane where the picture lies. A ray the march has brought to that wall is set
// exactly on the plane, so the picture is never torn by a ray that stopped a little short of it.
float onFace(vec3 ro, vec3 rd, float t) {
  if (rd.x < 1e-4) return t;
  float tp = (${f(HALL.x1)} - ro.x) / rd.x;
  return abs(tp - t) < 70.0 && abs(ro.y + rd.y * tp - ${f(FACE.y)}) < ${f(FACE.w * 0.5 + 10)} ? tp : t;
}
// A ray the march has left a little inside a wall (or short of it) is set on the wall's true face: two steps by the
// wall's own measure, back out or on. Without it a far wall's scallops are cut off where the long steps happen to end.
float wallBack(vec3 ro, vec3 rd, float t) {
  for (int k = 0; k < 3; k++) {
    vec3 pb = ro + rd * t;
    t += clamp(canyonAirD(pb, canyonD(pb.xy)), -20.0, 6.0) * 0.9;
  }
  return t;
}
// The first ice a ray meets before tMax. wall: 0 the glacier's top, 1 the canyon's side, 2 the crevasse's side, 3 its floor.
// blunt: for a mirror image in moving water, where the walls' scallops are not looked for.
float glacierHit(vec3 ro, vec3 rd, float tMax, int steps, bool blunt, out float wall) {
  vec3 n1;
  float tF;
  float t = boxHit(ro, rd, vec3(CY_LO, -FREEBOARD - 8.0), vec3(CY_HI, CY_H + 1.0), n1, tF);
  bool inside = all(greaterThan(ro.xy, CY_LO)) && all(lessThan(ro.xy, CY_HI)) && ro.z < CY_H + 1.0;
  if (inside) t = 0.0;
  else if (t < 0.0) return -1.0;
  float tEnd = min(tMax, tF);
  wall = 0.0;
  float near = 1e5;
  bool slotSeen = false;
  int fine = 0;
  for (int i = 0; i < 40; i++) {
    if (i >= steps) break;
    if (t > tEnd) return -1.0;
    vec3 p = ro + rd * t;
    // (In the crevasse nothing is marched: a ray leaves it by a wall, by the floor, or into the day.)
    if (!slotSeen && p.y > SL_Y && abs(p.x - SL_X) < 90.0 && slotIn(p) > 0.0) {
      slotSeen = true;
      float how;
      float ts = slotOut(p, rd, how);
      if (how < 0.5) return -1.0;
      if (how > 2.5 || canyonAir(p + rd * ts) > 0.0) { t += ts + 0.5; continue; }
      if (t + ts > tEnd) return -1.0;
      wall = how > 1.5 ? 3.0 : 2.0;
      return t + ts;
    }
    // Out in the canyon's open air the walls' scallops cannot matter yet: the plain canyon, less the deepest a scallop
    // goes, is a safe and far cheaper measure of the room there, and it allows a longer step.
    float D = canyonD(p.xy);
    // (In the hall the wall ahead may be the plumb one: no lean is counted on there, or a long step would end inside it.)
    float room = CY_W + (p.x > ${f(HALL.x0 - 120)} ? 0.0 : CY_LEAN * (p.z + FREEBOARD)) - D - 16.0;
    float w;
    // (lo: the least a step may be.)
    float lo = 0.0;
    if (blunt) w = (room + 16.0) * 0.8;
    else if (room > 18.0) w = room * 0.9;
    else {
      // Close to a wall its true face is followed. A ray that slides along one takes steps that grow no smaller than
      // a few pixels: it never leaves the face it is following for the plain wall behind it, so a wall's outline is one line.
      w = canyonAirD(p, D) * 0.7;
      if (fine++ > 9) lo = 0.8 + 0.01 * t;
    }
    // (Well inside the glacier and well under its top, the top is not what a ray meets next: it is not worked out.)
    vec2 eg = min(p.xy - CY_LO, CY_HI - p.xy);
    // (Away from its ragged front the top rolls gently: a ray over it takes longer steps.)
    float top = (min(eg.x, eg.y) > 320.0 || blunt) && p.z < ${f(CANYON.h * 0.84 - 60)} ? -12.0 : (p.z - glacierTop(p.xy)) * (min(eg.x, eg.y) > 320.0 ? 0.85 : 0.42);
    float d = max(w, top);
    // (What is far off is found to within a pixel, not a hair: the steps there are longer.)
    if (d < 0.4 + t * 0.002) {
      // (Only a ray that ends on the glacier's top has met its top: one that a long step carried into a canyon wall has met
      // the wall. Far from the canyon there is no wall to meet: what a step carried into there is the glacier's own top or front.)
      wall = w > top || (top < -1.5 && w > -45.0) ? 1.0 : 0.0;
      if (wall < 0.5 || blunt) return t;
      return onFace(ro, rd, wallBack(ro, rd, t));
    }
    near = d;
    t += max(d, lo) * (1.0 + min(t, 1600.0) * 0.00025);
  }
  // A ray that has run out of steps sliding past a swell of the wall goes on to the plain wall behind it (a few long
  // steps, no scallops), and is then set on that wall's true face: the swell's outline against what lies beyond it is clean.
  if (!blunt) {
    for (int i = 0; i < 12; i++) {
      if (t > tEnd) return -1.0;
      vec3 p = ro + rd * t;
      float w = (CY_W + (p.x > ${f(HALL.x0 - 120)} ? 0.0 : CY_LEAN * (p.z + FREEBOARD)) - canyonD(p.xy)) * 0.9;
      vec2 eg = min(p.xy - CY_LO, CY_HI - p.xy);
      float top = min(eg.x, eg.y) > 320.0 ? (p.z < ${f(CANYON.h * 0.84 - 60)} ? -12.0 : (p.z - glacierTop(p.xy)) * 0.85) : (p.z - glacierTop(p.xy)) * 0.42;
      float d = max(w, top);
      if (d < 0.4 + t * 0.002) {
        wall = w > top || (top < -1.5 && w > -45.0) ? 1.0 : 0.0;
        return wall < 0.5 ? t : onFace(ro, rd, wallBack(ro, rd, t));
      }
      t += d;
    }
  }
  // (One that is still sliding along a wall has, to the eye, met it.)
  if (near < 16.0) { wall = 1.0; return blunt ? t : onFace(ro, rd, wallBack(ro, rd, t)); }
  return -1.0;
}
/**
 * A canyon wall: the glacier's own ice (iceGlacier), closed in by the wall across from it, lit down the slot; before
 * dawn the app's page is a lamp on every face turned to it. Snow lies along its lip in one clean cornice, and icicles
 * hang under that.
 * up: 0 at the water, 1 at the lip; topZ: how high the glacier's top is there; flat_: 0..1 the plumb, polished face.
 */
vec3 wallIce(vec3 p, vec3 n, vec3 rd, float t, float up, float topZ, float flat_) {
  float px = max(t * uPxAng, 0.02);
  float along = (p.x + p.y) * 0.7;
  bool mir = gMirror > 0.5;
  gIceLamp = vec3(0.0);
  if (uNight > 0.0 && p.x > ${f(HALL.x0 - 260)}) {
    vec3 toF = FACE_AT - p;
    float dF = dot(toF, toF);
    gIceLamp = FACE_LAMP * pow(textureLod(uSlabTex, vec2(0.5), 7.0).rgb, vec3(2.2)) * max(dot(n, toF) / sqrt(dF), 0.0) * 30000.0 / (dF + 30000.0) * smoothstep(0.0, 60.0, FACE_AT.x - p.x) * 1.6;
  }
  vec3 col = iceGlacier(p, n, rd, t, vec2(along, p.z + FREEBOARD), mix(300.0, 60.0, up), 0.16 + 0.84 * up * up, mix(0.5 * smoothstep(0.25, 1.0, up), 2.6 * smoothstep(0.6, 0.84, up), uHour.z), 1.0 - 0.9 * flat_, 1e3, 0.0);
  gIceLamp = vec3(0.0);
  if (mir) return col;
  // The lip: one cornice of snow along the wall's top, its lower edge a slow clean line; icicles hang under it.
  float hang = 13.0 + 5.0 * sin(along * 0.017 + 1.0) + 3.0 * sin(along * 0.053 + 2.0);
  float dz = topZ - hang - p.z;
  // (Only where the wall stands to the glacier's full height: where its front slopes down to the land there is no lip.)
  if (dz < 60.0 && topZ > CY_H * 0.8) col = corniceOn(iciclesOn(col, along, dz, px, 46.0), n, dz, hang, px);
  return col;
}
vec3 glacierColor(vec3 ro, vec3 rd, float t, float wall, float pic) {
  vec3 p = ro + rd * t;
  vec3 L = keyDir();
  float topZ = max(glacierTop(p.xy), 1.0);
  if (wall < 0.5) {
    // The top: wind-packed snow where it lies easy; blue ice where it is too steep to hold snow (the cliff, a crevasse's lip).
    vec2 g = vec2(glacierTop(p.xy + vec2(5.0, 0.0)), glacierTop(p.xy + vec2(0.0, 5.0))) - topZ;
    float steep = length(g) / 5.0;
    vec3 n = normalize(vec3(-g / 5.0, 1.0));
    vec4 gr = textureLod(uGrain, p.xy / 520.0, 1.0);
    vec3 sn = snowOn(n, (gr.r - 0.5) * 0.3) * mix(1.0, 0.7, uNight) * (0.92 + 0.16 * gr.g);
    // (Its front is one face of bare ice from the snow at its foot to the snow on its top.)
    float bareK = smoothstep(0.38, 0.62, steep);
    if (bareK <= 0.0) return sn;
    // (The cliff is the same ice as the canyon it guards: its fracture faces stand open to the day.)
    vec3 ice = iceGlacier(p, n, rd, t, vec2((p.x + p.y) * 0.7, p.z + FREEBOARD), 300.0, 1.0, 1.0, 1.0, 1e3, 0.0);
    return mix(sn, ice, bareK);
  }
  if (wall > 2.5) {
    // The crevasse's floor: drifted snow, in the walls' shade.
    vec4 gf = textureLod(uGrain, p.xy / 210.0, 0.0);
    return snowOn(vec3(0.0, 0.0, 1.0), (gf.r - 0.5) * 0.5) * (0.5 + 0.2 * gf.g) * mix(1.0, 0.7, uNight);
  }
  // The wall's true face: the slope of the canyon's own field. (The crevasse's walls are cut straight.)
  vec3 n;
  if (wall > 1.5) n = normalize(vec3(p.x > SL_X ? -1.0 : 1.0, 0.0, SL_B));
  else {
    float d0 = canyonAir(p);
    n = normalize(vec3(canyonAir(p + vec3(2.0, 0.0, 0.0)) - d0, canyonAir(p + vec3(0.0, 2.0, 0.0)) - d0, canyonAir(p + vec3(0.0, 0.0, 2.0)) - d0));
  }
  float up = clamp((p.z + FREEBOARD) / (topZ + FREEBOARD), 0.0, 1.0);
  float smooth_ = wall > 1.5 ? 0.0 : faceNear(p);
  gShut = 1.0 - 0.72 * up;
  // A fully covered display pixel replaces the wall beneath it. Keep the original ice
  // through its antialiased rim and wherever the water can show through the reflection.
  vec2 paneOffset = abs(p.yz - FACE_AT.yz);
  vec2 paneInterior = vec2(${f(FACE.w / 2 - 6)}, ${f(FACE.h / 2 - 6)}) - t * uPxAng;
  bool covered = pic == 1.0 && smooth_ == 1.0 && all(lessThan(paneOffset, paneInterior));
  vec3 col = covered ? vec3(0.0) : wallIce(p, n, rd, t, up, topZ, smooth_);
  if (smooth_ > 0.0) col = faceIn(col, p, vec3(-1.0, 0.0, 0.0) * step(0.5, smooth_) + n * (1.0 - step(0.5, smooth_)), rd, pic);
  gShut = 0.0;
  // Wet and dark at the waterline.
  if (wall < 1.5 && gMirror < 0.5) col = waterlineOn(col, p.z + FREEBOARD, 0.5 + 0.5 * sin((p.x + p.y) * 0.031));
  return col;
}
// While the eye is between the canyon's walls, most of the frame is wall. The wall on each line of sight is looked
// for before anything else is drawn, so that what lies behind it need not be worked out at all.
// gWallT: under -1.5 not looked for yet, -1 none, else how far off it is. gWallK: which face (see glacierHit).
float gWallT = -2.0;
float gWallK = 0.0;
bool canyonEye() { return uSt.w >= 0.3 && all(greaterThan(uCamPos.xy, CY_LO)) && all(lessThan(uCamPos.xy, CY_HI)) && uCamPos.z < CY_H; }
void canyonFirst(vec3 dir) {
  gWallT = glacierHit(uCamPos, dir, dir.z < -0.0006 ? (uCamPos.z + FREEBOARD) / -dir.z : 1e5, uLean > 0.5 ? 30 : 40, false, gWallK);
}
/** The glacier over the finished ground, and its walls in the water between them. */
vec3 canyon(vec3 col, vec3 dir, float tw) {
  float wall = gWallK;
  float t = gWallT > -1.5 ? gWallT : glacierHit(uCamPos, dir, tw > 0.0 ? tw : 1e5, uLean > 0.5 ? 30 : 40, false, wall);
  // Cold air lies between the walls: what is far down the canyon stands in it, paler, and the day at the canyon's end shows through it.
  float inK = smoothstep(CY_LO.y - 60.0, CY_LO.y + 120.0, uCamPos.y) * (1.0 - smoothstep(CY_HI.y - 120.0, CY_HI.y + 60.0, uCamPos.y)) * step(uCamPos.z, CY_H);
  // (Before dawn that air is the night's own blue: the aurora is overhead, not between the walls.)
  vec3 mistC = mix(S.hor * 0.9 + S.band * 0.1, S.hor * 0.2 + vec3(0.008, 0.026, 0.064) + uAurora * 0.03, uNight);
  if (t > gDepth || (t < 0.0 && tw > gDepth)) return col;
  if (t >= 0.0) {
    // (The glacier lies on the land: seen from outside, what of its side would stand under the land's own surface is not there to be seen.)
    vec3 hp = uCamPos + dir * t;
    // (Nor is a wall where the glacier has not yet any height: its front begins as snow on the land, not as an end of ice in the river.)
    if (gWallT < -1.5 && wall > 0.5 && wall < 1.5 && ((glacierTop(hp.xy) < 5.0 && hp.z < 8.0) || (hp.z < 0.5 && textureLod(uBedA, bedUv(hp.xy), 0.0).r > 0.0))) return col;
    gDepth = t;
    gFaceK = 0.0;
    vec3 c0 = glacierColor(uCamPos, dir, t, wall, 1.0);
    // (At its foot the glacier's front lies down into the land's own snow: no line is drawn where it begins.)
    // (From between the walls nothing was drawn behind it: there it is drawn whole.)
    float foot = wall < 1.5 && gWallT < -1.5 ? smoothstep(6.0, 44.0, glacierTop((uCamPos + dir * t).xy)) : 1.0;
    // (The picture is a few steps off through clear cold air: by day almost none of the valley's haze lies over it.)
    float veil = 1.0 - 0.85 * gFaceK;
    vec3 c = mix(c0, inAir(c0, dir, t), veil);
    // (Before dawn the air in and over the glacier is the night's own cold blue: seen from far off down the valley its
    // dark mouth is not warmed to brown by the horizon's first light.)
    if (uNight > 0.0) {
      c = mix(c, mix(c0, S.hor * 0.22 + vec3(0.012, 0.034, 0.078), airLoss(t)), 0.85 * uNight * veil);
    }
    c = mix(c, mistC, (1.0 - exp(-t / 2600.0)) * inK * (1.0 - 0.8 * faceNear(uCamPos + dir * t)) * veil);
    return mix(col, c, gSt.w * foot);
  }
  if (tw < 0.0) return col;
  vec3 pwp = uCamPos + dir * tw;
  if (any(lessThan(pwp.xy, CY_LO)) || any(greaterThan(pwp.xy, CY_HI)) || canyonD(pwp.xy) > CY_W + 12.0) return col;
  vec4 wv = textureLod(uGrain, pwp.xy / 300.0 + vec2(0.0, -uTime * 0.25), 1.0);
  vec3 rd2 = normalize(vec3(dir.xy, -dir.z) + vec3((wv.rg - 0.5) * 0.045, 0.0));
  // (Little of the night sky reaches the water between the walls: it is dark, and what it shows is what stands over it.)
  float deep = uNight * gSt.w * smoothstep(0.0, 120.0, glacierTop(pwp.xy));
  col = mix(col, min(col * 0.5, vec3(0.05, 0.085, 0.09)), deep);
  float t2 = uLean < 1.5 ? glacierHit(pwp + vec3(0.0, 0.0, 1.0), rd2, 700.0, 14, true, wall) : -1.0;
  if (t2 >= 0.0) {
    gMirror = 1.0;
    // The walls stand in the water: their fractures, their snow and the page, the more the lower the eye looks across it.
    // (By day the water keeps its own colour under their image where the eye looks down into it.)
    float mirK = mix(0.86, 0.4, smoothstep(0.06, 0.55, -dir.z));
    col = mix(col, inAir(glacierColor(pwp, rd2, t2, wall, mix(0.45, 0.9, uNight)), dir, tw + t2) * 0.82, mirK * mix(0.7, 0.92, uNight) * gSt.w);
    gMirror = 0.0;
  }
  // Fast water on the outside of each bend, piled white against the wall; slack on the inside.
  vec2 r1 = pwp.xy - CY_C1;
  float turn = atan(r1.y, -r1.x);
  float pile = smoothstep(4.0, ${f(CANYON.w * 0.4)}, length(r1) - CY_R) * smoothstep(-0.25, 0.35, turn) * (1.0 - smoothstep(1.3, 1.9, turn)) * step(r1.x, 60.0);
  float streak = textureLod(uGrain, vec2((length(r1) - CY_R) / 110.0, (turn * CY_R - uTime * 210.0) / 1300.0), 1.0).r;
  float east = smoothstep(CY_XE - 45.0, CY_XE + ${f(CANYON.w * 0.4)}, pwp.x) * smoothstep(${f(BENDS[1].y - CANYON.r - CANYON.w / 2 + 10)}, ${f(BENDS[1].y - CANYON.r)}, pwp.y) * (1.0 - smoothstep(${f(BENDS[1].y)}, ${f(BENDS[1].y + 160)}, pwp.y));
  float streak2 = textureLod(uGrain, vec2(pwp.x / 110.0, (pwp.y - uTime * 210.0) / 1300.0), 1.0).r;
  float foam = max(pile * smoothstep(0.34, 0.62, streak + 0.3 * pile), east * smoothstep(0.34, 0.62, streak2 + 0.3 * east));
  col = mix(col, vec3(0.92, 0.97, 1.0) * (S.key * mix(0.28, 0.08, uNight) + S.amb * 1.05), foam * 0.8 * gSt.w);
  // (Before dawn the app's page lights the water under it: a pool of its own cold light at the wall's foot.)
  if (uNight > 0.0 && pwp.x > ${f(FACE.x - 420)}) {
    vec2 df = pwp.xy - vec2(${f(FACE.x)}, ${f(FACE.y)});
    float pool_ = exp(-max(-df.x, 0.0) / 110.0) * exp(-df.y * df.y / 36000.0) * (0.7 + 0.6 * wv.g);
    col += pow(textureLod(uSlabTex, vec2(0.5), 7.0).rgb, vec3(2.2)) * FACE_LAMP * 0.16 * pool_ * uNight * gSt.w;
  }
  return mix(col, mistC, (1.0 - exp(-tw / 5200.0)) * inK * gSt.w);
}
`;
