/**
 * The last four stations' subjects, as pieces of the flight's shading pass.
 * Each is ice standing in (or over) the water, found by a ray, and each is
 * only worked out while its station is the one near the camera (uSt).
 *
 * They are composed over the finished ground: a subject covers what lies
 * behind it, and the water in front of it carries its mirror image.
 *
 * All four are made of one ice (iceLook): the eye sees through it to what
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
/** Snow lying on ice: lit as the land's snow is, lumped a little. */
vec3 snowOn(vec3 n, float lump) {
  vec3 L = keyDir();
  return mix(vec3(0.93, 0.94, 0.96), vec3(0.6, 0.68, 0.8), uNight) * (S.key * mix(0.26, L.z, uNight) * (0.42 + 0.9 * max(dot(normalize(n + vec3(lump, lump * 0.6, 1.0)), L), 0.0)) + S.amb * 0.85 + uAurora * 0.04);
}
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
// 1 while a subject is drawn as its mirror image in the water: its fine inner work is not looked for.
float gMirror = 0.0;
// How much trapped air the ice has: 1 in a block that froze in a season, less in a glacier's old pressed ice.
float gAiry = 1.0;
// How rough its faces are: 1 a cut face that melt has only scalloped; more where it broke off and weathered.
float gRough = 1.0;
/**
 * Ice, where the eye's ray enters it.
 * p: where; n: the face; rd: the ray; t: how far off; thick: how much ice the ray crosses;
 * q: the place on the face (across, up); edge: how far from the nearest arris;
 * wet: 0..1 meltwater running down the face; seed: which piece.
 */
vec3 iceLook(vec3 p, vec3 n, vec3 rd, float t, float thick, vec2 q, float edge, float wet, float seed) {
  vec3 L = keyDir();
  float px = max(t * uPxAng, 0.02);
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  vec3 tv = cross(n, tu);
  // The face is not flat: melt has scalloped it, and where water runs down it the water ripples it.
  vec4 g0 = textureLod(uGrain, q / 230.0 + seed * 1.7, 0.0);
  vec4 g1 = textureLod(uGrain, q / 52.0 + seed, lodFor(px, 52.0, 256.0));
  vec2 bump = ((g0.gb - 0.5) * 0.34 + (g1.rg - 0.5) * 0.15) * gRough;
  float film = 0.0;
  if (wet > 0.0 && gMirror < 0.5) {
    // (Water finds its own lanes down a face, and runs faster in the fuller ones.)
    float lane = textureLod(uGrain, vec2(q.x / 70.0 + seed, 0.37 + q.y / 3000.0), 0.0).g;
    film = wet * smoothstep(0.5, 0.66, lane);
    vec4 gw = textureLod(uGrain, vec2(q.x / 24.0, (q.y + uTime * (36.0 + 34.0 * lane)) / 120.0) + seed * 2.3, lodFor(px, 24.0, 256.0));
    bump = mix(bump, bump * 0.35 + (gw.rg - 0.5) * 0.55, film);
  }
  // (What is seen through the ice and on it and how much of a mirror it is go by the face's broad lie: each small
  // scallop would otherwise flip the view between sky and ground, and the face would be spotted. The scallops are in its shading.)
  vec3 nb = normalize(n + (tu * bump.x + tv * bump.y) * (0.3 / gRough));
  vec3 nn = normalize(n + tu * bump.x + tv * bump.y);
  float cosi = max(dot(-rd, nb), 0.0);
  float fres = 0.03 + 0.97 * pow(1.0 - cosi, 5.0);
  vec3 ri = refract(rd, nb, 0.763);
  // Through it: what lies beyond, bent, and coloured by the ice the light crossed (ice takes the red first).
  vec3 tr = exp(-vec3(0.019, 0.0052, 0.0026) * thick);
  // (Before dawn the sky seen through ice is dimmer than the sky itself: the ice keeps most of so little light.)
  // (A canyon's wall has only more ice behind it: nothing is looked for through it.)
  vec3 col = gShut > 0.0 ? vec3(0.3, 0.62, 0.8) * (S.amb * 1.1 + S.key * 0.05) * (1.0 - 0.6 * uNight) * tr : beyond(p + ri * min(thick, 400.0), normalize(rd + (ri - rd) * 1.8)) * tr * (1.0 - 0.74 * uNight);
  // The heart of a block froze last and is white with trapped air, drawn up in threads; its skin is clear.
  // (What lies inside shifts against the face by the face's own lie, not by each scallop on it.)
  vec3 r0 = refract(rd, n, 0.763);
  vec2 par = vec2(dot(r0, tu), dot(r0, tv)) / max(-dot(r0, n), 0.35);
  float heart = thick / (thick + 70.0);
  vec2 qa = q + par * min(thick * 0.5, 40.0);
  float streak = textureLod(uGrain, vec2(qa.x / 34.0, qa.y / 420.0) + seed * 0.7, lodFor(px, 34.0, 256.0)).b;
  float air = heart * smoothstep(0.46, 0.86, g0.r * 0.62 + streak * 0.52);
  // (Lit through: turned from the sun it still glows, and toward the sun it is brightest.)
  vec3 lit = S.amb * 1.2 + S.key * (0.09 + 0.17 * max(dot(n, L), 0.0) + 0.5 * pow(max(dot(rd, L), 0.0), 3.0));
  // (Before dawn glacier ice is blue-black: it keeps the sky's cold light and only a breath of the aurora.)
  vec3 milk = mix(vec3(0.6, 0.83, 0.94) * lit, vec3(0.2, 0.36, 0.6) * (S.amb * 3.0 + uAurora * 0.05) + vec3(0.002, 0.007, 0.022), uNight);
  col = mix(col, milk, clamp(0.1 + 0.16 * heart + 0.55 * air, 0.0, 0.8) * gAiry);
  if (gAiry < 0.9) {
    // A glacier's old pressed ice has no net of cracks. It was laid down in sheets, and where two have parted a
    // thread of light runs along the wall between them.
    if (gMirror < 0.5 && px < 0.9) {
      vec4 gc = textureLod(uGrain, vec2(q.x / 560.0 + seed, q.y / 74.0 + 0.25 * g0.r), lodFor(px, 74.0, 256.0));
      float thr = (1.0 - smoothstep(0.0, 0.014 + 0.05 * px, abs(gc.g - 0.5))) * smoothstep(0.42, 0.66, gc.b) * (1.0 - smoothstep(0.45, 0.9, px));
      col += vec3(0.84, 0.94, 1.0) * mix(S.amb * 0.5 + S.key * 0.05, uAurora * 0.2 + vec3(0.006, 0.016, 0.03), uNight) * thr;
      col *= 1.0 - 0.14 * smoothstep(0.5, 0.56, gc.g) * (1.0 - smoothstep(0.56, 0.7, gc.g));
    }
  } else {
    // Fracture planes inside, at two depths: each a sheet, a bright hairline where it is seen edge on, and a flash where it turns to the light.
    float near = 1.0 - smoothstep(1.2, 4.5, px);
    if (near > 0.0 && gMirror < 0.5) {
      for (int k = 0; k < 2; k++) {
        // (The deeper sheets are only looked for from close by.)
        if (k == 1 && px > 0.9) break;
        float dep = k == 0 ? 7.0 : 28.0;
        float sc = k == 0 ? 62.0 : 124.0;
        vec3 f3 = fracture((q + par * dep) / vec2(sc, sc * 1.5) + seed * 3.1 + float(k) * 7.3);
        // (A crack runs a way and stops: it does not close a cell.)
        float has = step(0.42, f3.z) * smoothstep(0.3, 0.52, k == 0 ? g0.a : g0.r);
        float hair = 1.0 - smoothstep(0.0, 0.014 + 1.5 * px / sc, f3.x);
        vec3 fn = normalize(n + tu * (f3.y - 0.5) * 1.3 + tv * (f3.z - 0.5) * 1.3);
        float flash = pow(max(dot(reflect(rd, fn), L), 0.0), 12.0);
        // (Before dawn the aurora is caught in them: a fracture is the one bright thing in the ice.)
        vec3 inC = mix(S.key * (0.07 * hair + 0.2 * flash) + S.amb * 0.4 * hair, (uAurora * 0.34 + vec3(0.006, 0.016, 0.03)) * (hair + 0.7 * flash), uNight);
        col += vec3(0.84, 0.94, 1.0) * inC * has * near * (k == 0 ? 1.0 : 0.6) * (0.35 + 0.65 * heart);
        col *= mix(1.0, 0.8 + 0.36 * f3.y, near * (k == 0 ? 1.0 : 0.6));
      }
    }
  }
  // The face itself: the sky and the country lie on it, more at a glancing angle and more where it is wet.
  vec3 rr = reflect(rd, nb);
  // (Before dawn a wet lane is a mirror for the aurora overhead. Between a canyon's walls a face mostly mirrors
  // the wall across from it, and the sky only where it looks up past that wall's rim.)
  vec3 mir = beyond(p, rr);
  if (gShut > 0.0) mir = mix(mix(vec3(0.16, 0.42, 0.62) * (S.amb * 0.9 + S.key * 0.03), vec3(0.004, 0.012, 0.03), uNight), mir * (1.0 - 0.6 * uNight), smoothstep(0.8 * gShut - 0.12, 0.8 * gShut + 0.3, rr.z));
  col = mix(col, mir, clamp(fres * (0.85 + 0.3 * film) + (0.05 + 0.1 * uNight) * film, 0.0, 1.0));
  col += S.band * pow(max(dot(rr, S.sun), 0.0), 220.0) * (0.5 + 1.6 * film) * (1.0 - uNight) * step(0.0, S.sun.z);
  // The scallops: each small hollow in the face is a little lighter on the side turned to the sky and the light.
  col *= 1.0 + 0.5 * (dot(nn, normalize(L + vec3(0.0, 0.0, 0.8))) - dot(n, normalize(L + vec3(0.0, 0.0, 0.8))));
  // An arris catches the light; just inside it the ice turns the light away.
  // (An arris is not a ruled line: it is chipped along its length, bright where it is whole.)
  float ar = (1.0 - smoothstep(0.5, 2.2 + px, edge)) * (0.25 + 0.75 * smoothstep(0.3, 0.62, g1.b)) / gRough;
  col += mix(vec3(0.8, 0.93, 1.0) * (S.key * 0.15 + S.amb * 0.8), uAurora * 0.1 + vec3(0.01, 0.022, 0.04), uNight) * ar;
  col *= 1.0 - 0.2 * smoothstep(2.0, 5.0, edge) * (1.0 - smoothstep(6.0, 18.0, edge));
  return col;
}
/** Where ice stands in water: a dark wet notch the water has eaten, and the bright line of the water's own edge. */
vec3 waterlineOn(vec3 col, float z, float g) {
  col *= 1.0 - 0.45 * (1.0 - smoothstep(2.0, 11.0 + 5.0 * g, z));
  return col + mix(vec3(0.8, 0.93, 1.0) * S.amb * 0.9, uAurora * 0.3, uNight) * (1.0 - smoothstep(0.0, 1.6, abs(z - 1.2)));
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
  // (Meltwater runs down every face; more of it on the tall ones. A serac's faces are where it broke: rough.)
  gRough = 1.9;
  vec3 col = iceLook(ro + rd * t, n, rd, t, tF - t, q, edge, (0.55 + 0.45 * size) * (1.0 - top), fi * 0.61 + 0.2 + float(part) * 0.23);
  gRough = 1.0;
  // It is glacier ice: laid down a year at a time, and the years run through pillar, shoulder and block alike.
  float lay = textureLod(uGrain, vec2(fi * 0.13 + 0.2, (hp.z + 0.22 * hp.x) / 210.0), 0.0).g;
  col *= 0.86 + 0.3 * smoothstep(0.3, 0.7, lay);
  // A face that leans back lies open to the sky and is paler; one that overhangs is in its own shade.
  col *= 1.0 + 0.22 * clamp(n.z, -0.6, 0.6) * (1.0 - top);
  if (top < 1.0) {
    // The waterline notch: the water has eaten a hollow round its foot. Dark and wet inside, its upper lip catching the light.
    float nz = (3.5 + 9.0 * size) * (0.75 + 0.5 * gr.b);
    col *= 1.0 - 0.6 * (1.0 - smoothstep(nz * 0.45, nz, hp.z));
    col += mix(vec3(0.8, 0.93, 1.0) * (S.amb * 0.7 + S.key * 0.06), uAurora * 0.12 + vec3(0.01, 0.02, 0.035), uNight) * ((1.0 - smoothstep(0.0, 1.0 + t * uPxAng, abs(hp.z - nz * 1.08))) * 0.7 + (1.0 - smoothstep(0.0, 1.4, abs(hp.z - 1.0))));
  }
  // Snow holds only where the break lies easy: the long slope of its top, the shoulder's head. The steep chips are bare ice.
  return mix(col, snowOn(n, (gr.r - 0.5) * 0.5) * (0.92 + 0.16 * gr.a), top);
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
  vec3 e3 = min(hp - lo, hi - hp);
  bool hipF = abs(n.x) > 0.3 && n.z > 0.3;
  // (The leaning face runs out at the wall's foot, not at the box round it.)
  float edge = abs(n.x) > 0.5 ? min(e3.y, e3.z) : n.z > 0.9 ? min(e3.x, e3.y) : min(e3.x, n.z > 0.2 ? hi.z - hp.z : e3.z);
  vec2 q = abs(n.x) > 0.5 ? vec2(hp.y, z) : n.z > 0.9 ? hp.xy : vec2(hp.x, z * (1.0 + n.z));
  vec4 gr = textureLod(uGrain, q / 160.0 + kind * 0.31, 0.0);
  // (A gate is a hand of clear ice; the wall is old ice a body thick.)
  // (The wall is old pressed ice, laid in sheets; a gate froze in a season and is clear.)
  gAiry = kind > 0.5 ? 1.0 : 0.7;
  vec3 col = iceLook(hp, n, rd, t, kind > 0.5 ? 16.0 : tF - t, q, hipF ? 1e3 : edge, kind > 0.5 ? 0.9 : 0.35 * step(n.z, 0.9), kind * 0.47 + floor(hp.x / 260.0) * 0.13);
  gAiry = 1.0;
  // (The leaning face is laid in courses: one year's ice on the last, each a shade its own.)
  if (kind < 0.5 && n.z > 0.2 && n.z < 0.9) col *= 0.88 + 0.2 * textureLod(uGrain, vec2(hp.x / 2600.0, z / 150.0), 0.0).g;
  if (n.z < 0.9) col = waterlineOn(col, z, gr.b);
  // (Inside a cut, under the lintel, the day does not reach.)
  if (n.z < -0.5) col *= 0.45;
  // Snow lies along the crest and hangs a little over it, and is drifted up the wall's two ends; the gates are bare, clear ice.
  float hang = 5.0 + 9.0 * gr.g;
  float snowK = kind > 0.5 ? 0.0 : max(max(step(0.9, n.z), hipF ? 1.0 : 0.0), smoothstep(DAM_H - hang - 1.0, DAM_H - hang + 1.0, z) * step(n.z, 0.2) * step(-0.5, n.z));
  col *= 1.0 - 0.28 * (1.0 - snowK) * smoothstep(DAM_H - hang - 8.0, DAM_H - hang - 1.0, z) * step(n.z, 0.2) * step(kind, 0.5);
  return mix(col, snowOn(n, (gr.r - 0.5) * 0.5) * (0.92 + 0.16 * gr.a), snowK);
}
`;

/** Station 6, the water: fast and white below the open sluice, a bare wet bed below the shut ones. */
export const DAM_WATER = `
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
      float streak = textureLod(uGrain, vec2(atan(q.x, -q.y) * 0.9, (length(q) + uTime * 70.0) / 900.0), 1.5).r;
      col = mix(col, vec3(0.9, 0.96, 1.0) * (S.key * 0.25 + S.amb), pull * smoothstep(0.45, 0.8, streak) * 0.6 * gSt.y);
    }
    return col;
  }
  int i = ${channelOf()};
  float cx = i == 0 ? ${sluiceX(0)} : i == 1 ? ${sluiceX(1)} : ${sluiceX(2)};
  float sg = i == 0 ? uSurge.x : i == 1 ? uSurge.y : uSurge.z;
  float front = sg * 1120.0;
  float open = gateOf(i) * (1.0 - smoothstep(front - 30.0, front + 30.0, d));
  float fade = (1.0 - smoothstep(720.0, 980.0, d)) * gSt.y;
  float side = pwp.x - cx;
  float inCh = 1.0 - smoothstep(50.0, 70.0, abs(side) + 22.0 * (1.0 - smoothstep(60.0, 260.0, d)));
  float lod = lodFor(tw * uPxAng, 60.0, 256.0);
  vec4 gr = textureLod(uGrain, pwp.xy / 760.0, 2.5);
  // Shut: a dry bed. Dark washed gravel and cobbles, a skin of ice in its hollows, a little snow blown in at its edges.
  vec4 gs = textureLod(uGrain, pwp.xy / 46.0, lodFor(tw * uPxAng, 46.0, 256.0));
  float edgeD = 65.0 - abs(side);
  vec3 stone = mix(vec3(0.13, 0.14, 0.16), vec3(0.25, 0.26, 0.275), smoothstep(0.3, 0.75, gs.r)) * (0.7 + 0.6 * gr.g);
  float skin = smoothstep(0.6, 0.7, gr.b + 0.2 * gs.g) * (1.0 - smoothstep(10.0, 40.0, abs(side - 16.0 * sin(d * 0.019 + float(i) * 2.0))));
  stone = mix(stone, vec3(0.5, 0.62, 0.7), skin * 0.7);
  stone = mix(stone, vec3(0.86, 0.89, 0.93), smoothstep(0.52, 0.7, gs.b + 0.4 * (1.0 - smoothstep(0.0, 26.0, edgeD))) * 0.8);
  vec3 bare = stone * (S.key * mix(0.2, 0.03, uNight) + S.amb * mix(0.9, 1.6, uNight));
  col = mix(col, bare, (1.0 - open) * fade);
  // Open: fast water. A glassy tongue through the sluice, the boil where it lands, then long white streaks and
  // standing waves off both banks all the way down, and a white head on the surge while the channel fills.
  float run = uTime * 320.0;
  float s1 = textureLod(uGrain, vec2(side / 96.0 + float(i) * 0.3, (d - run) / 2400.0), lod).r;
  float s2 = textureLod(uGrain, vec2(side / 30.0 + 0.37, (d - run * 1.3) / 760.0), lod).g;
  float chev = 0.5 + 0.5 * sin(d * 0.055 - abs(side) * 0.13 - uTime * 2.2);
  float boil = exp(-max(d - DAM_T - 16.0, 0.0) / 190.0) * smoothstep(${f(DAM.thick)}, DAM_T + 26.0, d);
  float head = exp(-abs(d - front) / 60.0) * step(sg, 0.98);
  // (Broad soft rafts of foam carry the streaks: white water has a body, it is not scratched on.)
  float raft = textureLod(uGrain, vec2(side / 170.0 + float(i) * 0.3, (d - run * 0.8) / 1000.0), lod + 2.0).b;
  float whiteK = clamp(0.5 + 1.2 * boil + head, 0.0, 1.0) * smoothstep(0.36, 0.64, 0.4 * raft + 0.34 * s1 + 0.26 * s2 + 0.5 * boil + 0.5 * head + 0.14 * chev);
  // (Before dawn white water is the brightest thing on the ground: it holds the sky's light and the aurora's.)
  vec3 white = vec3(0.93, 0.97, 1.0) * (S.key * mix(0.3, 0.1, uNight) + S.amb * mix(1.1, 4.0, uNight) + uAurora * 0.22 + vec3(0.07, 0.09, 0.1) * uNight);
  // (Between the white the fast water is deep and green, and glassy; all of it is milky with air.)
  // (By day that green is what tells it from the snow: a running channel is aqua under its white, never white on white.)
  col = mix(col, col * vec3(0.5, 0.8, 0.86), open * inCh * 0.5 * fade);
  col = mix(col, mix(vec3(0.1, 0.62, 0.7) * (S.key * 0.24 + S.amb * 1.1), vec3(0.05, 0.14, 0.15) + uAurora * 0.2, uNight), open * inCh * mix(0.62, 0.3, uNight) * fade);
  col = mix(col, white, whiteK * open * inCh * fade);
  return mix(col, mist, clamp(spray * 0.5, 0.0, 0.6) * gSt.y);
}
`;

const cubeSizes = () =>
  Array.from({ length: 16 }, (_, k) => {
    const a = fr(Math.sin((k % 4) * 127.1 + Math.floor(k / 4) * 311.7 + 4.7) * 43758.5453);
    const b = fr(Math.sin((k % 4) * 269.5 + Math.floor(k / 4) * 183.3 + 9.1) * 43758.5453);
    return `vec2(${((LATTICE.size / 2) * (0.88 + 0.2 * a)).toFixed(2)}, ${(LATTICE.h * (0.78 + 0.5 * b)).toFixed(2)})`;
  }).join(', ');

/** Station 7: sixteen cubes of ice in a still pool, one thread of current round them all, a light passing through them in turn. */
export const LATTICE_ICE = `
const vec2 LAT_C = vec2(${f(LATTICE.x)}, ${f(LATTICE.y)});
const float LAT_P = ${f(LATTICE.pitch)};
const float LAT_S = ${f(LATTICE.size / 2)};
const float LAT_H = ${f(LATTICE.h)};
const float LAT_IN = ${f(Math.hypot(2 * LATTICE.pitch, LATTICE.pitch * 2 + 110 - 2 * LATTICE.pitch))};
const float LAT_LAP = ${f(4 * LATTICE.pitch + (Math.PI * LATTICE.pitch) / 2)};
float segD(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 ab = b - a;
  h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * h);
}
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
// (No two cubes are quite the same: each has melted to its own size.) x: half its width, y: its height.
const vec2 LAT_SZ[16] = vec2[16](${cubeSizes()});
vec2 cubeSize(vec2 ij) { return LAT_SZ[int(ij.x) + 4 * int(ij.y)]; }
float cubesHit(vec3 ro, vec3 rd, out vec3 n, out float tF, out vec2 id) {
  vec3 n1;
  float f1;
  float ext = 1.5 * LAT_P + LAT_S * 1.1;
  if (boxHit(ro, rd, vec3(LAT_C - ext, -FREEBOARD - 4.0), vec3(LAT_C + ext, LAT_H * 1.3 - FREEBOARD), n1, f1) < 0.0) return -1.0;
  float best = -1.0;
  for (int k = 0; k < 16; k++) {
    vec2 ij = vec2(float(k - (k / 4) * 4), float(k / 4));
    vec2 c = LAT_C + (ij - 1.5) * LAT_P;
    vec2 sz = cubeSize(ij);
    float t = boxHit(ro, rd, vec3(c - sz.x, -FREEBOARD - 4.0), vec3(c + sz.x, sz.y - FREEBOARD), n1, f1);
    if (t > 0.0 && (best < 0.0 || t < best)) { best = t; n = n1; tF = f1; id = ij; }
  }
  return best;
}
vec3 cubeColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, vec2 id) {
  vec3 hp = ro + rd * t;
  vec2 c = LAT_C + (id - 1.5) * LAT_P;
  vec2 sz = cubeSize(id);
  vec3 lp = vec3(hp.xy - c, hp.z + FREEBOARD);
  float glow = cubeGlow(id.x, id.y);
  vec2 q = n.z > 0.5 ? lp.xy : vec2(abs(n.x) > 0.5 ? lp.y : lp.x, lp.z);
  vec2 e = n.z > 0.5 ? sz.x - abs(lp.xy) : vec2(sz.x - abs(q.x), sz.y - lp.z);
  vec4 gr = textureLod(uGrain, q / 120.0 + id * 0.37, 0.0);
  vec3 col = iceLook(hp, n, rd, t, tF - t, q + id * 53.0, min(e.x, e.y), 0.25 * step(n.z, 0.5), dot(id, vec2(0.37, 0.61)));
  if (n.z < 0.5) col = waterlineOn(col, lp.z, gr.b);
  // Its top is frosted: a thin rime, thicker toward the middle.
  col = mix(col, snowOn(n, (gr.r - 0.5) * 0.4), step(0.5, n.z) * (0.2 + 0.5 * gr.g) * smoothstep(0.0, 14.0, min(e.x, e.y)));
  // The light inside: it stands at the cube's heart, so it is brightest where the eye looks through the most ice
  // and toward the middle of each face, and the air trapped in the cube carries it.
  vec3 mid = hp + rd * (tF - t) * 0.5 - vec3(c, sz.y * 0.45 - FREEBOARD);
  float core = exp(-dot(mid, mid) / (sz.x * sz.x * 0.9));
  float thickK = clamp((tF - t) / (sz.x * 2.0), 0.0, 1.0);
  col += vec3(0.3, 0.84, 1.0) * glow * (1.7 * core + 0.3 * thickK + 0.35 * smoothstep(0.55, 0.8, gr.r)) * mix(0.8, 1.1, uNight);
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
    vec2 id2;
    for (int k = 0; k < 2; k++) {
      if (uLean > 0.5) break;
      vec3 rd = normalize(dir + (uCamR * (k == 0 ? 0.5 : -0.5) + uCamU * (k == 0 ? -0.5 : 0.5)) * uPxAng);
      if (cubesHit(uCamPos, rd, n2, tF2, id2) < 0.0) cov -= 0.33;
    }
    return mix(col, inAir(cubeColor(uCamPos, dir, t, tF, n, id), dir, t), cov * gSt.z);
  }
  if (tw < 0.0) return col;
  vec3 pwp = uCamPos + dir * tw;
  vec2 q = pwp.xy - LAT_C;
  if (max(abs(q.x), abs(q.y)) > 2.0 * LAT_P + 300.0 || textureLod(uBedA, bedUv(pwp.xy), 0.0).r > -2.0) return col;
  // The thread of current: the one place the mirror is broken. Deeper, darker water with the light running on it.
  float s;
  float d = threadAt(q, s);
  float band = 1.0 - smoothstep(9.0, 34.0, d);
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
  float lines = smoothstep(0.42, 0.8, 0.55 * run + 0.45 * fine);
  col = mix(col, vec3(0.88, 0.96, 1.0) * (S.key * mix(0.24, 0.06, uNight) + S.amb * 0.95) + uAurora * 0.3, lines * band * 0.85 * gSt.z);
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
float canyonAir(vec3 p) {
  float z = p.z + FREEBOARD;
  float along = (p.x + p.y) * 0.7;
  float relief = 13.0 * sin(along * 0.021 + 1.6 * sin(z * 0.017)) + 5.0 * sin(z * 0.09 + along * 0.004) + 4.0 * sin(along * 0.083 + z * 0.05);
  // (Only the hall's east wall is cut plumb: nowhere else is it asked.)
  float plumb = p.x > ${f(FACE.x - 160)} ? faceNear(p) : 0.0;
  return CY_W + (CY_LEAN * z + relief) * (1.0 - plumb) - canyonD(p.xy);
}
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
// frame. Its middle is seen clean; toward its edges the ice is rougher and bends it away to nothing; fractures cross
// it and set its pieces a hair apart; before dawn it is lit from within and lights the ice round it.
vec3 faceIn(vec3 col, vec3 p, vec3 n, vec3 rd, float pic) {
  vec2 q = vec2(${f(FACE.y + FACE.w / 2)} - p.y, p.z - ${f(FACE.z)}) / vec2(${f(FACE.w)}, ${f(FACE.h)});
  if (n.x > -0.5 || p.x < ${f(FACE.x - 60)} || any(lessThan(q, vec2(-0.3))) || any(greaterThan(q, vec2(1.3)))) return col;
  vec2 e = min(q, 1.0 - q) * vec2(${f(FACE.w)}, ${f(FACE.h)});
  float edge = min(e.x, e.y);
  float dist = length(p - uCamPos);
  float lod = max(0.0, log2(dist * uPxAng * 1280.0 / ${f(FACE.w)}));
  vec4 gi = textureLod(uGrain, p.yz / 84.0 + 0.4, 1.0);
  vec4 gj = textureLod(uGrain, p.yz / 330.0 + 0.1, 0.0);
  // The ice over it is clear in a patch of no particular shape: round that patch it is white with rime and trapped
  // air, which closes in over the picture's edges, so the picture has no outline of its own.
  float fe = edge + 26.0 * (gj.g - 0.5) + 9.0 * (gi.r - 0.5);
  float clear = smoothstep(1.0, 15.0, fe);
  float rough = 1.0 - smoothstep(4.0, 26.0, fe);
  vec3 fr3 = gMirror > 0.5 ? vec3(1.0, 0.5, 0.5) : fracture(q * vec2(2.9, 1.9) + 3.0);
  vec2 qi = q + rd.yz / max(rd.x, 0.3) * vec2(-9.0 / ${f(FACE.w)}, 9.0 / ${f(FACE.h)}) + (fr3.yz - 0.5) * 0.0045 + (gi.rg - 0.5) * (0.0012 + 0.02 * rough);
  vec2 ei = min(qi, 1.0 - qi) * vec2(${f(FACE.w)}, ${f(FACE.h)});
  float aPic = smoothstep(-1.0, 5.0, min(ei.x, ei.y)) * clear;
  vec3 img = pow(textureLod(uSlabTex, vec2(qi.x, 1.0 - qi.y), lod + 1.5 * rough).rgb, vec3(2.2));
  vec3 glow = pow(textureLod(uSlabTex, vec2(0.5), 7.0).rgb, vec3(2.2));
  // (By day the day lights it through the ice; before dawn it is its own light.)
  vec3 lit = img * mix(S.amb * 1.05 + S.key * 0.2, vec3(0.5), uNight);
  // The ice it is seen through: its blue lies over the picture, more of it toward the edges.
  lit = mix(lit, lit * vec3(0.78, 0.93, 1.0) + iceBody(0.5) * mix(S.amb * 0.1, glow * 0.05, uNight), 0.3 + 0.5 * rough);
  float crack = (1.0 - smoothstep(0.0, 0.004 + 1.5 * dist * uPxAng / ${f(FACE.w)}, fr3.x)) * (0.35 + 0.65 * step(0.5, fr3.z));
  lit += vec3(0.82, 0.94, 1.0) * mix(S.amb * 0.42 + S.key * 0.05, glow * 0.16 + uAurora * 0.1, uNight) * crack;
  // The rime round it: white by day; before dawn it holds the picture's own light, brightest at the clear patch's rim.
  float rime = (1.0 - clear) * smoothstep(-64.0, -2.0, edge + 20.0 * (gj.r - 0.5)) * (0.86 + 0.14 * gi.b);
  float nearPic = exp(-max(-edge, 0.0) / 44.0);
  vec3 frost = mix(vec3(0.72, 0.85, 0.93) * (S.amb * 1.25 + S.key * 0.1), vec3(0.2, 0.36, 0.6) * S.amb * 3.0 + glow * vec3(0.55, 0.85, 1.0) * 0.3 * nearPic, uNight);
  col = mix(col, frost, rime * 0.8 * pic);
  col = mix(col, lit, aPic * pic);
  // The wall's own wet face lies over it all: a little of the sky on the ice.
  vec3 nn = normalize(n + vec3(0.0, gi.b - 0.5, gi.a - 0.5) * 0.05);
  float fr = 0.03 + 0.97 * pow(1.0 - max(dot(-rd, nn), 0.0), 5.0);
  return mix(col, beyond(p, reflect(rd, nn)), fr * 0.3);
}
// The glacier's top. Its front is an ice cliff with a ragged foot; behind it the surface rolls, and is crevassed across the flow.
float glacierTop(vec2 p) {
  vec2 e = min(p - CY_LO, CY_HI - p);
  float m = min(e.x, e.y);
  float rag = 44.0 * sin(p.x * 0.011 + 1.3) * sin(p.y * 0.013 + 0.4) + 20.0 * sin(p.x * 0.031 + p.y * 0.027);
  float rise = smoothstep(0.0, 170.0, m + rag - 40.0);
  float roll = 0.92 + 0.05 * sin(p.x * 0.006 + 0.7) * sin(p.y * 0.0052 + 2.0) + 0.03 * sin(p.y * 0.021 + p.x * 0.004);
  float cv = sin(p.y * 0.05 + 3.0 * sin(p.x * 0.004) + 1.7 * sin(p.x * 0.013));
  // (The crevasses lie well back from the canyon: its rim is one unbroken lip of snow.)
  float slot = smoothstep(0.84, 0.98, cv) * smoothstep(150.0, 300.0, m) * smoothstep(600.0, 760.0, abs(p.x - 1660.0));
  return CY_H * rise * roll - 30.0 * slot;
}
// The first ice a ray meets before tMax. wall: 0 the glacier's top, 1 the canyon's side, 2 the crevasse's side, 3 its floor.
float glacierHit(vec3 ro, vec3 rd, float tMax, int steps, out float wall) {
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
  for (int i = 0; i < 44; i++) {
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
    float w = canyonAir(p) * 0.6;
    // (Well inside the glacier and well under its top, the top is not what a ray meets next: it is not worked out.)
    vec2 eg = min(p.xy - CY_LO, CY_HI - p.xy);
    float top = min(eg.x, eg.y) > 320.0 && p.z < ${f(CANYON.h * 0.84 - 60)} ? -12.0 : (p.z - glacierTop(p.xy)) * 0.42;
    float d = max(w, top);
    // (What is far off is found to within a pixel, not a hair: the steps there are longer.)
    if (d < 0.4 + t * 0.002) { wall = w > top ? 1.0 : 0.0; return t; }
    near = d;
    t += d * (1.0 + min(t, 1600.0) * 0.00025);
  }
  // (A ray that runs out of steps sliding along a wall has, to the eye, met it.)
  if (near < 16.0) { wall = 1.0; return t; }
  return -1.0;
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
    float bareK = smoothstep(0.75, 1.5, steep + 0.3 * (gr.b - 0.5));
    if (bareK <= 0.0) return sn;
    // (The cliff is fluted: it breaks off in upright slabs.)
    float flute = textureLod(uGrain, vec2((p.x + p.y) / 150.0, p.z / 1400.0), 0.0).g;
    float up = clamp(p.z / CY_H, 0.0, 1.0);
    vec3 ice = iceBody(0.95 - 0.6 * up) * (0.7 + 0.6 * flute) * (S.amb * 1.15 + S.key * (0.06 + 0.3 * max(dot(n, L), 0.0)));
    ice = mix(ice, vec3(0.2, 0.36, 0.6) * (0.7 + 0.5 * flute) * (S.amb * 2.6 + uAurora * 0.06) + vec3(0.002, 0.006, 0.014), uNight);
    float fr = 0.03 + 0.97 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    ice = mix(ice, beyond(p, reflect(rd, n)), fr * 0.4);
    return mix(sn, ice, bareK);
  }
  if (gMirror > 0.5) {
    // (Its mirror image in moving water keeps the wall's colour and its bands, and nothing finer.)
    float upM = clamp((p.z + FREEBOARD) / (topZ + FREEBOARD), 0.0, 1.0);
    vec3 cm = mix(iceBody(1.0 - 0.7 * upM * upM), vec3(0.2, 0.36, 0.6), uNight) * (0.7 + 0.3 * sin(p.z * 0.15)) * mix(S.amb * (0.8 + 0.5 * upM) + S.key * 0.08 * upM, S.amb * 2.4 + uAurora * 0.1 * upM, uNight);
    return p.x > ${f(FACE.x - 60)} ? faceIn(cm, p, vec3(-1.0, 0.0, 0.0), rd, pic) : cm;
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
  // Old ice: laid down in bands, bluest at the bottom where the least sky reaches and the most ice lies behind.
  float along = (p.x + p.y) * 0.7;
  vec4 g2 = textureLod(uGrain, vec2(along / 1900.0, p.z / 900.0), 1.0);
  float band = 0.5 + 0.5 * sin(p.z * 0.15 + 2.5 * g2.b + along * 0.006);
  float sky = 0.14 + 0.86 * up * up;
  float smooth_ = wall > 1.5 ? 0.0 : faceNear(p);
  gAiry = 0.45;
  gShut = 1.0 - 0.72 * up;
  vec3 col = iceLook(p, n, rd, t, mix(300.0, 90.0, up * up), vec2(along, p.z * 1.4), 1e3, 0.3 * (1.0 - smooth_), 0.83);
  gAiry = 1.0;
  col *= (0.74 + 0.36 * band) * mix(0.55, 1.0, sky);
  // The sun finds the faces turned to it, most near the top; near its top the wall is thin enough for the day to come through.
  col += iceBody(0.3) * S.key * (0.09 * max(dot(n, L), 0.0) * up + 0.05 * smoothstep(0.72, 1.0, up)) * (1.0 - uNight);
  // (Before dawn the aurora overhead finds the upper walls, and the faces that lean back to it.)
  col += uAurora * vec3(0.4, 0.8, 1.0) * (0.03 * up * up + 0.05 * max(n.z, 0.0) * up) * (0.6 + 0.4 * band);
  if (smooth_ > 0.0) col = faceIn(col, p, vec3(-1.0, 0.0, 0.0) * step(0.5, smooth_) + n * (1.0 - step(0.5, smooth_)), rd, pic);
  gShut = 0.0;
  // Wet and dark at the waterline; snow hangs over the lip.
  vec4 gr = textureLod(uGrain, vec2(along / 520.0, p.z / 190.0), 0.0);
  if (wall < 1.5) col = waterlineOn(col, p.z + FREEBOARD, gr.b);
  float lip = smoothstep(topZ - 8.0 - 14.0 * gr.g, topZ - 5.0 - 14.0 * gr.g, p.z);
  return mix(col, snowOn(vec3(n.xy * 0.4, 1.0), 0.0) * mix(1.0, 0.7, uNight), lip);
}
/** The glacier over the finished ground, and its walls in the water between them. */
vec3 canyon(vec3 col, vec3 dir, float tw) {
  float wall;
  float t = glacierHit(uCamPos, dir, tw > 0.0 ? tw : 1e5, uLean > 0.5 ? 32 : 44, wall);
  // Cold air lies between the walls: what is far down the canyon stands in it, paler, and the day at the canyon's end shows through it.
  float inK = smoothstep(CY_LO.y - 60.0, CY_LO.y + 120.0, uCamPos.y) * (1.0 - smoothstep(CY_HI.y - 120.0, CY_HI.y + 60.0, uCamPos.y)) * step(uCamPos.z, CY_H);
  // (Before dawn that air is the night's own blue: the aurora is overhead, not between the walls.)
  vec3 mistC = mix(S.hor * 0.9 + S.band * 0.1, S.hor * 0.2 + vec3(0.008, 0.026, 0.064) + uAurora * 0.03, uNight);
  if (t > gDepth || (t < 0.0 && tw > gDepth)) return col;
  if (t >= 0.0) {
    gDepth = t;
    vec3 c = inAir(glacierColor(uCamPos, dir, t, wall, 1.0), dir, t);
    c = mix(c, mistC, (1.0 - exp(-t / 2600.0)) * inK * (1.0 - 0.8 * faceNear(uCamPos + dir * t)));
    return mix(col, c, gSt.w);
  }
  if (tw < 0.0) return col;
  vec3 pwp = uCamPos + dir * tw;
  if (any(lessThan(pwp.xy, CY_LO)) || any(greaterThan(pwp.xy, CY_HI)) || canyonD(pwp.xy) > CY_W + 12.0) return col;
  vec4 wv = textureLod(uGrain, pwp.xy / 300.0 + vec2(0.0, -uTime * 0.25), 1.0);
  vec3 rd2 = normalize(vec3(dir.xy, -dir.z) + vec3((wv.rg - 0.5) * 0.09, 0.0));
  float t2 = uLean < 1.5 ? glacierHit(pwp + vec3(0.0, 0.0, 1.0), rd2, 700.0, 14, wall) : -1.0;
  if (t2 >= 0.0) {
    gMirror = 1.0;
    // (By day the water keeps its own colour under the walls' image.)
    col = mix(col, inAir(glacierColor(pwp, rd2, t2, wall, mix(0.3, 0.12, uNight)), dir, tw + t2) * 0.8, mix(0.36, 0.6, uNight) * gSt.w);
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
  // (Little of the night sky reaches the water between the walls.)
  float deep = uNight * gSt.w * smoothstep(0.0, 120.0, glacierTop(pwp.xy));
  col = mix(col, min(col * 0.4, vec3(0.05, 0.085, 0.09)), deep);
  return mix(col, mistC, (1.0 - exp(-tw / 5200.0)) * inK * gSt.w);
}
`;
