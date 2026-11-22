/**
 * envfetch's place: a block of glacier ice standing in a closed pool (the kettle), with slivers of ice sealed in it.
 *
 * It is built from what the world already had. The block is a convex piece cut by planes, as the tarn's shards, the
 * seracs and the basin's block are, and it is shaded by the same glacier ice (`iceGlacier`). It is rimed over, as ice
 * that has stood through a night is. The slivers inside hold the light the tarn's shards hold: a fine thread up the
 * heart of each and a blue glow in the ice round it.
 *
 * Its event is the reader's arrival. The rime clears from the face turned to the eye, outward from one place on it,
 * and it clears ridge by ridge: the rings a warm fingertip leaves on a frosted pane. As the face clears the slivers
 * behind it light, one after another. Scrolled back, they go out and the rime closes.
 *
 * The pool is carved in the bed like any other water (`paintKettle`), so the pass's own water is its surface; this
 * piece adds the block's shade, its image in the pool and the light it throws on the water.
 *
 * It is a registered subject with no pass of its own (see `customSubjects` in the registry): the pass calls
 * `vaultIce(colour, ray, progress)` over the finished ground and water.
 */

import { KETTLE, VAULT, VAULT_GROUND, VAULT_LIT, VAULT_SLIVERS } from '../geography';

const f = (n: number) => n.toFixed(1);
const f3 = (n: number) => n.toFixed(4);

/** The block's own axes in the world's: across its front, and into it. */
const EX: [number, number] = [Math.cos(VAULT.turn), Math.sin(VAULT.turn)];
const EY: [number, number] = [-Math.sin(VAULT.turn), Math.cos(VAULT.turn)];

/**
 * The block's faces, in the world's axes from the middle of its foot (outward normal, distance). It is a piece that
 * has calved and come to rest, not a cut box: its front leans back a little, its sides lean in, its top slopes, two
 * corners of the top have broken away and each arris of the front has lost a chip. The front is plane 0.
 */
export function vaultPlanes(): [number, number, number, number][] {
  const hw = VAULT.w / 2;
  const hd = VAULT.d / 2;
  const h = VAULT.h;
  const local: [[number, number, number], [number, number, number]][] = [
    [[0, -1, 0.07], [0, -hd, 0]], // 0: the front, which the rime clears from
    [[0.05, 1, 0.1], [0, hd, 0]], // 1: the back
    [[-1, 0.04, 0.08], [-hw, 0, 0]], // 2: its left side
    [[1, -0.05, 0.05], [hw, 0, 0]], // 3: its right side
    [[0.07, 0.1, 1], [0, 0, h]], // 4: the top, sloping
    [[0, 0, -1], [0, 0, -44]], // 5: the foot, under the water
    [[-0.6, -0.12, 0.79], [-hw, 0, h - 50]], // 6: the top's left corner, broken away
    [[0.5, 0.46, 0.73], [hw - 8, hd - 8, h - 42]], // 7: its right corner, at the back
    [[0.74, -0.66, 0.1], [hw - 13, -hd, 0]], // 8: the front's right arris
    [[-0.76, -0.62, 0.2], [-hw + 9, -hd, 0]], // 9: the front's left arris
  ];
  return local.map(([n, p]) => {
    const l = Math.hypot(n[0], n[1], n[2]);
    const u = [n[0] / l, n[1] / l, n[2] / l];
    const wn = [u[0] * EX[0] + u[1] * EY[0], u[0] * EX[1] + u[1] * EY[1], u[2]];
    const wp = [p[0] * EX[0] + p[1] * EY[0], p[0] * EX[1] + p[1] * EY[1], p[2]];
    return [wn[0], wn[1], wn[2], wn[0] * wp[0] + wn[1] * wp[1] + wn[2] * wp[2]];
  });
}

const PLANES = vaultPlanes();
/** A sliver's ends in the world's axes, from the middle of the block's foot. */
const world = (p: [number, number, number]) => `vec3(${f(p[0] * EX[0] + p[1] * EY[0])}, ${f(p[0] * EX[1] + p[1] * EY[1])}, ${f(p[2])})`;
/** A ball that holds the whole block, from the middle of its foot. */
const BALL = { z: VAULT.h * 0.42, r: Math.hypot(VAULT.w / 2, VAULT.d / 2, VAULT.h * 0.58 + 44) + 6 };

export const VAULT_ICE = `// ---- the vault: a rimed block of ice in a closed pool, slivers of ice sealed in it
const vec3 VT_C = vec3(${f(VAULT.x)}, ${f(VAULT.y)}, 0.0);
const vec2 VT_EX = vec2(${f3(EX[0])}, ${f3(EX[1])});
const vec2 VT_POOL = vec2(${f(KETTLE.x)}, ${f(KETTLE.y)});
const vec4 VT_P[${PLANES.length}] = vec4[${PLANES.length}](${PLANES.map(([x, y, z, d]) => `vec4(${x.toFixed(5)}, ${y.toFixed(5)}, ${z.toFixed(5)}, ${d.toFixed(3)})`).join(', ')});
const int VT_N = ${VAULT_SLIVERS.length};
const vec3 VT_A[${VAULT_SLIVERS.length}] = vec3[${VAULT_SLIVERS.length}](${VAULT_SLIVERS.map((s) => world(s.a)).join(', ')});
const vec3 VT_B[${VAULT_SLIVERS.length}] = vec3[${VAULT_SLIVERS.length}](${VAULT_SLIVERS.map((s) => world(s.b)).join(', ')});
const float VT_R[${VAULT_SLIVERS.length}] = float[${VAULT_SLIVERS.length}](${VAULT_SLIVERS.map((s) => f(s.r)).join(', ')});
// How far the ray would have to go on, past the face it meets, to meet the next: small at an arris.
float gVaultEdge = 1e3;
/** Where a ray meets the block, or -1: its face's normal, which face, and where it would leave. (o: the ray's start from the middle of the block's foot.) */
float vaultHit(vec3 o, vec3 rd, out vec3 n, out int face, out float tF) {
  n = vec3(0.0, 0.0, 1.0);
  face = 0;
  tF = 1e9;
  // (Most rays pass nowhere near it: a ball that holds all of it is asked first.)
  vec3 oc = o - vec3(0.0, 0.0, ${f(BALL.z)});
  float bq = dot(oc, rd);
  if (bq * bq - dot(oc, oc) + ${f(BALL.r * BALL.r)} < 0.0) return -1.0;
  float tN = 0.0;
  float tN2 = -1e3;
  for (int k = 0; k < ${PLANES.length}; k++) {
    vec4 pl = VT_P[k];
    float den = dot(rd, pl.xyz);
    float num = pl.w - dot(o, pl.xyz);
    if (den < -1e-6) { float t = num / den; if (t > tN) { tN2 = tN; tN = t; n = pl.xyz; face = k; } else if (t > tN2) tN2 = t; }
    else if (den > 1e-6) tF = min(tF, num / den);
    else if (num < 0.0) return -1.0;
    if (tN > tF) return -1.0;
  }
  gVaultEdge = tN - tN2;
  return tN > 0.0 ? tN : -1.0;
}
/**
 * How much rime lies at a place on the front (across, up), 0 clear to 1 white. It clears outward from one place, and
 * its edge is not a line: inside the band that is clearing, the rime is left in ridges that run round that place, each
 * bent a little and none a true circle, and the ridges nearer the middle are the first to go.
 */
float vaultRime(vec2 uv, float progress, float px) {
  vec2 d = (uv - vec2(${f(VAULT.touch[0])}, ${f(VAULT.touch[1])})) * vec2(1.0, 0.84);
  float r = length(d);
  float a = atan(d.y, d.x);
  // (A whorl: the ridges lean as they go round, and waver.)
  float bent = r + 4.2 * sin(a * 2.0 + 0.6) + 1.3 * sin(a * 3.0 - r * 0.03) + 1.1 * sin(uv.x * 0.11 + uv.y * 0.07);
  float open = ${f(VAULT.clear)} * smoothstep(0.04, 0.74, progress);
  float band = 22.0 + 0.16 * open;
  float k = smoothstep(open - band, open, bent);
  // (A ridge under a pixel wide is its mean: the rings never shimmer from far off.)
  float fine = 1.0 - smoothstep(0.5, 1.6, px / 4.4);
  float ridge = mix(0.5, 0.5 + 0.5 * sin(bent * ${f3((Math.PI * 2) / 4.4)}), fine);
  float rime = smoothstep(0.22, 0.78, k + (ridge - 0.5) * 0.85 * sin(3.14159 * k));
  // (What has cleared keeps the faintest print of them.)
  rime += 0.035 * ridge * (1.0 - k) * smoothstep(0.25 * open, open, bent) * step(0.001, progress);
  // (And the rime is never laid on evenly.)
  return clamp(rime * (0.93 + 0.07 * sin(uv.x * 0.37 + 1.7 * sin(uv.y * 0.19))), 0.0, 1.0);
}
/** How lit each sliver is: they light one after another as the face clears. */
float vaultLit(int i, float progress) {
  float from = ${f3(VAULT_LIT.from)} + ${f3(VAULT_LIT.step)} * float(i);
  return smoothstep(from, from + ${f3(VAULT_LIT.over)}, progress);
}
/** The slivers on a ray through the block, from where it enters to where it leaves: (their own pale ice, their threads, their glow). */
vec3 vaultSlivers(vec3 o, vec3 rd, float t0, float t1, float progress) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < VT_N; i++) {
    vec3 a = VT_A[i];
    vec3 ab = VT_B[i] - a;
    // The nearest the ray comes to the sliver's own line, inside the block.
    vec3 w = o - a;
    float bb = dot(ab, ab);
    float bd = dot(ab, rd);
    float wb = dot(w, ab);
    float wd = dot(w, rd);
    float den = max(bb - bd * bd, 1e-4);
    float sp = clamp((wb - bd * wd) / den, 0.0, 1.0);
    float tr = clamp(dot(a + ab * sp - o, rd), t0, t1);
    sp = clamp(dot(o + rd * tr - a, ab) / bb, 0.0, 1.0);
    float dist = length(o + rd * tr - a - ab * sp);
    // (A sliver is widest below its middle and comes to a point at either end.)
    float girth = VT_R[i] * (0.18 + 0.82 * sin(3.14159 * pow(sp, 0.8)));
    float lit = vaultLit(i, progress);
    float body = 1.0 - smoothstep(girth * 0.7, girth * 1.15, dist);
    float lengths = 0.74 + 0.26 * smoothstep(0.25, 0.75, n1(sp * 5.0 - uTime * 0.3 + float(i) * 3.7));
    float thread = exp(-dist * dist / (0.045 * girth * girth)) * lengths * smoothstep(0.0, 0.12, sp) * (1.0 - smoothstep(0.86, 1.0, sp));
    float halo = exp(-dist / (VT_R[i] * mix(2.6, 2.2, uNight)));
    sum += vec3(body * (0.35 + 0.65 * lit), thread * lit, halo * lit);
  }
  return sum;
}
/** The block's ice at a hit. soft: 1 where it is drawn as its image in the water. */
vec3 vaultColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, int face, float progress, float soft) {
  vec3 p = ro + rd * t;
  vec3 hp = p - VT_C;
  float thick = max(tF - t, 0.0);
  bool top = n.z > 0.62;
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  float along = dot(hp, tu);
  float faceId = fract(n.x * 7.31 + n.y * 3.17);
  vec2 q = vec2(along + faceId * 170.0, hp.z + 0.22 * hp.x + 0.1 * hp.y);
  float px = max(t * uPxAng, 0.02);
  float wasM = gMirror;
  gMirror = max(gMirror, soft);
  vec3 col = iceGlacier(p, n, rd, t, q, thick, 1.0, 1.0, top ? 0.0 : 0.7, gVaultEdge * 1.5, 0.83);
  gMirror = wasM;
  vec3 light = gIceLight;
  // A face that leans back lies open to the sky and is paler; one that overhangs is in its own shade.
  col *= 1.0 + 0.2 * clamp(n.z, -0.6, 0.6) * (top ? 0.0 : 1.0);
  // The rime. On the front it is the event's; on every other face it lies as the night left it, thinner toward the
  // arrises, where the day reaches first.
  float rime = face == 0
    ? vaultRime(vec2(dot(hp.xy, VT_EX), hp.z), progress, px)
    : 0.4 + 0.24 * sin(along * 0.043 + faceId * 9.0) * sin(hp.z * 0.037 + faceId * 4.0);
  rime *= smoothstep(0.0, 16.0, gVaultEdge) * 0.25 + 0.75;
  // (At the waterline the pool keeps the ice wet and clear.)
  rime *= smoothstep(-FREEBOARD - 2.0, 10.0 - FREEBOARD, hp.z);
  float clear = 1.0 - rime;
  // What is sealed inside: seen whole through the cleared face, and as a glow in the ice through the rime.
  if (!top) {
    vec3 ri = normalize(mix(rd, -n, 0.16));
    vec3 inside = soft > 0.5 ? vec3(0.0) : vaultSlivers(ro - VT_C + rd * t, ri, 0.0, min(thick, 260.0), progress);
    float seen = face == 0 ? clear : 0.12;
    // (Clear ice an arm's length deep is dark and blue: the cleared face is a window into it.)
    col = mix(col, col * vec3(0.4, 0.6, 0.8) + light * vec3(0.015, 0.05, 0.08), seen * 0.85);
    col = mix(col, light * vec3(0.44, 0.66, 0.8) + col * 0.4, inside.x * seen * 0.42);
    float lamp = mix(S.amb.g * 1.7 + 0.25, 1.0, uNight);
    col += vec3(0.72, 0.97, 1.0) * inside.y * mix(1.7, 1.0, uNight) * lamp * seen;
    col += vec3(0.3, 0.8, 0.98) * inside.z * mix(0.17, 0.3, uNight) * lamp * mix(0.4, 1.0, seen);
  }
  // The rime itself: fine white frost, lit as snow is, with the ice's own blue still under it.
  vec3 frost = snowOn(normalize(n + vec3(0.0, 0.0, 0.45)), 0.0) * mix(vec3(0.9, 0.95, 1.0), vec3(0.66, 0.84, 1.16), uNight);
  if (!top) col = mix(col, mix(frost, col, 0.24), rime * 0.84);
  // Snow on what looks up.
  if (top) col = snowOn(n, 0.2 * sin(hp.x * 0.13) * sin(hp.y * 0.11)) * mix(vec3(1.1), vec3(0.62, 0.84, 1.22), uNight);
  // (Its image in the water is the water's: darker than the ice that throws it, and bluer.)
  if (soft > 0.5) col *= mix(vec3(0.58, 0.72, 0.84), vec3(0.7, 0.8, 0.9), uNight);
  return col;
}
/** The vault over the finished ground and water. */
vec3 vaultIce(vec3 col, vec3 dir, float progress) {
  // (It is let go with distance, whole: half there, it would be a ghost.)
  float nearK = 1.0 - smoothstep(2500.0, 2900.0, length(uCamPos.xy - VT_C.xy));
  if (nearK <= 0.0) return col;
  // Most of the frame has nothing of it: neither the block on its line of sight nor its ground under it.
  vec3 toC = VT_C + vec3(0.0, 0.0, ${f(BALL.z)}) - uCamPos;
  float alongC = dot(toC, dir);
  vec3 offC = toC - dir * alongC;
  bool sight = alongC > 0.0 && dot(offC, offC) < ${f(BALL.r * BALL.r)};
  float tl = dir.z < -0.0006 ? uCamPos.z / -dir.z : -1.0;
  vec2 pg = uCamPos.xy + dir.xy * max(tl, 0.0);
  float fromPool = length(pg - VT_POOL);
  bool ground = tl > 0.0 && fromPool < ${f(KETTLE.r + VAULT_GROUND)};
  if (!sight && !ground) return col;
  vec3 n;
  int face;
  float tF;
  float best = sight ? vaultHit(uCamPos - VT_C, dir, n, face, tF) : -1.0;
  float edge = gVaultEdge;
  // (What a ray meets under the pool's surface is seen through the water: there the water is drawn, with the block's image on it.)
  if (best > 0.0 && uCamPos.z + dir.z * best < -FREEBOARD) { best = -1.0; ground = tl > 0.0; }
  // (All five lit: how much light the block gives out.)
  float glowAll = 0.0;
  for (int i = 0; i < VT_N; i++) glowAll += vaultLit(i, progress);
  glowAll /= float(VT_N);
  if (best < 0.0 && ground) {
    vec3 Ls = keyDir();
    float tw = (uCamPos.z + FREEBOARD) / -dir.z;
    vec2 pw = uCamPos.xy + dir.xy * tw;
    float sdL = textureLod(uBedA, bedUv(pg), 0.0).r;
    bool wet = sdL < 0.0 && length(pw - VT_POOL) < ${f(KETTLE.r + 110)} && textureLod(uBedA, bedUv(pw), 0.0).r < -1.0;
    vec3 ps = wet ? vec3(pw, -FREEBOARD) : vec3(pg, 0.0);
    // Its shade lies long across the pool and the snow, away from the light.
    vec2 toS = VT_C.xy - ps.xy;
    float d = length(toS);
    vec2 l2 = normalize(Ls.xy + 1e-5);
    float al = dot(toS, l2);
    float off = length(toS - l2 * al);
    float len = ${f(VAULT.h)} * length(Ls.xy) / max(Ls.z, 0.03);
    float wide = ${f(VAULT.w * 0.5)} * (0.8 + al / 1700.0);
    float sh = step(0.0, al) * (1.0 - smoothstep(wide * 0.6, wide * 1.3, off)) * (1.0 - smoothstep(len * 0.55, len, al)) * exp(-al / 620.0);
    // (Its shade and its light end within the ground the block is looked for on: nothing of it lies further out.)
    float within = 1.0 - smoothstep(${f(KETTLE.r + VAULT_GROUND - 130)}, ${f(KETTLE.r + VAULT_GROUND - 10)}, fromPool);
    col *= 1.0 - sh * mix(wet ? 0.3 : 0.4, 0.14, uNight) * nearK * within;
    // The light it throws on the water at its foot, once it is lit.
    col += vec3(0.2, 0.68, 0.82) * glowAll * exp(-d / mix(120.0, 190.0, uNight)) * mix(0.03, wet ? 0.3 : 0.14, uNight) * nearK * within;
    if (wet) {
      // The pool is still, and holds it: its image stands in the water, bent only by the pool's slow swell.
      vec2 swell = vec2(sin(pw.y * 0.052 + pw.x * 0.013 + uTime * 0.5), 0.5 * sin(pw.x * 0.043 + pw.y * 0.021 + uTime * 0.4)) * 0.006;
      vec3 rd2 = reflect(dir, normalize(vec3(-swell, 1.0)));
      vec3 n2;
      int f2;
      float tF2;
      float t2 = vaultHit(vec3(pw, -FREEBOARD) - VT_C, rd2, n2, f2, tF2);
      if (t2 > 0.0) {
        vec3 mc = vaultColor(vec3(pw, -FREEBOARD), rd2, t2, tF2, n2, f2, progress, 1.0);
        // (The light inside shows in the image as a glow, never as its threads.)
        mc += vec3(0.3, 0.8, 0.98) * glowAll * mix(0.1, 0.22, uNight) * (f2 == 0 ? 1.0 : 0.4);
        float cosw = clamp(-dir.z, 0.0, 1.0);
        float mir = mix(0.9, 0.62, smoothstep(0.1, 0.6, cosw)) * (1.0 - smoothstep(0.0, 520.0, t2) * 0.35);
        col = mix(col, inAir(mc, dir, tw + t2) * 0.86, mir * nearK);
      }
    }
    return col;
  }
  if (best < 0.0) return col;
  // Its outline is geometry: smoothed by counting four more rays.
  float cov = 1.0;
  vec3 nA;
  int fA;
  float tA;
  for (int k = 0; k < 4; k++) {
    vec2 o2 = k == 0 ? vec2(0.5, 0.2) : k == 1 ? vec2(-0.2, 0.5) : k == 2 ? vec2(-0.5, -0.2) : vec2(0.2, -0.5);
    vec3 rdA = normalize(dir + (uCamR * o2.x + uCamU * o2.y) * uPxAng);
    if (vaultHit(uCamPos - VT_C, rdA, nA, fA, tA) < 0.0) cov -= 0.2;
  }
  gVaultEdge = edge;
  vec3 c = inAir(vaultColor(uCamPos, dir, best, tF, n, face, progress, 0.0), dir, best);
  return mix(col, c, cov * nearK);
}`;
