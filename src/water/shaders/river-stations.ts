import { BOARD, BOARD_DEPTH, boardSpan, CONF_RIVER, FIELD_ROLL, CONF_Y, LIP, lipY, POOL, ROCK_FACES, rockFaces, ROCKS, SHARDS, SHEET, slabFaces, TRIBS } from '../geography';

export const BASIN_OBJECT = `#if defined(F_SLAB)
// The block's faces, in its own frame (x across its front, y into it, z up from the water): the way each looks, and how far
// it is from the middle of the front's foot. 0 is the polished front, 5 the foot; 4, 6, 7 and 10 look up and carry the snow.
const int SLN = ${slabFaces().length};
const vec4 SLF[${slabFaces().length}] = vec4[${slabFaces().length}](${slabFaces()
  .map((f) => `vec4(${f.map((v) => v.toFixed(5)).join(', ')})`)
  .join(', ')});

/**
 * A ray against the block (a solid cut by flat faces). Returns the
 * distance, or -1. hl: where it is met, in the block's frame. face: which
 * face.
 */
float slabHit(vec3 ro, vec3 rd, out vec3 hl, out float face) {
  vec3 lo = ro - uSlabPos;
  vec3 a = vec3(dot(lo.xy, uSlabDir.zw), -dot(lo.xy, uSlabDir.xy), lo.z);
  vec3 d = vec3(dot(rd.xy, uSlabDir.zw), -dot(rd.xy, uSlabDir.xy), rd.z);
  float tN = -1e9;
  float tF = 1e9;
  hl = vec3(0.0);
  face = 0.0;
  for (int j = 0; j < SLN; j++) {
    vec4 pl = SLF[j];
    float den = dot(d, pl.xyz);
    float num = pl.w - dot(a, pl.xyz);
    if (den < -1e-6) { float t = num / den; if (t > tN) { tN = t; face = float(j); } }
    else if (den > 1e-6) tF = min(tF, num / den);
    else if (num < 0.0) return -1.0;
    // Once the first six faces exclude the ray, the remaining cuts cannot admit it.
    if (j == 5 && (tN > tF || tF < 0.0)) return -1.0;
  }
  if (tN > tF || tN < 0.0) return -1.0;
  gSlabThick = tF - tN;
  hl = a + d * tN;
  return tN;
}

#endif
// 1 while the block is drawn as a mirror image in moving water: no hairline survives that.
float gSlabSoft = 0.0;

#if defined(F_SLAB)
// The way the basin's sea runs: its sets come in from the south-west and go on to the north-east.
const vec2 SEA_K = vec2(0.5547, 0.8321);
/** How hard the basin's waves are striking the block's foot at a place along it, 0..1: sets that come and go. */
float blockBeat(float along) {
  float set_ = 0.55 + 0.45 * sin(uTime * 0.37 + along * 0.004);
  float w = sin(uTime * 1.7 + along * 0.021 + 1.6 * sin(uTime * 0.23 + along * 0.007));
  return clamp((0.5 + 0.5 * w) * set_, 0.0, 1.0);
}

/** A place on the water against the block's foot. x: how far from it, y: where along it (the measure blockBeat takes), zw: the way straight out from it. */
vec4 blockFoot(vec2 pw) {
  vec2 ds = pw - uSlabPos.xy;
  vec2 lb = vec2(dot(ds, uSlabDir.zw), -dot(ds, uSlabDir.xy));
  vec2 c = clamp(lb, vec2(-uSlabSize.x * 0.5, 0.0), vec2(uSlabSize.x * 0.5, uSlabSize.z));
  vec2 o = lb - c;
  float d = length(o);
  vec2 dirL = d > 1e-3 ? o / d : vec2(0.0, -1.0);
  float along = lb.y < 0.0 ? c.x + uSlabSize.x * 0.5 + 190.0 : c.y + 570.0;
  return vec4(d, along, uSlabDir.zw * dirL.x - uSlabDir.xy * dirL.y);
}
/** How much of the sea reaches a place by the block, 0..1: all of it on the weather side, none in the lee. */
float blockWeather(vec4 bf) {
  return smoothstep(-0.55, 0.35, -dot(bf.zw, SEA_K));
}
/**
 * The phase of the sea at a place: it grows with time, so a crest moves on.
 * Out in the basin the crests are long and straight and run with the sea;
 * close to the block each bends round to meet the face it will break on.
 */
float blockPhase(vec2 pw, vec4 bf) {
  float wrap = exp(-bf.x / 110.0);
  vec2 rel = pw - uSlabPos.xy;
  float open = dot(rel, SEA_K) * -0.058 + 1.4 * sin(dot(rel, vec2(-SEA_K.y, SEA_K.x)) * 0.006 + 0.4);
  float shore = bf.x * 0.062 + bf.y * 0.021;
  return uTime * 1.7 + 1.6 * sin(uTime * 0.23 + bf.y * 0.007) + mix(open, shore, wrap) + 2.2 * sin(bf.x * 0.011 + bf.y * 0.013 + 1.3);
}
/** How high the sea is running at a place: it comes in sets, and each set has its own place along the crest. */
float blockSet(vec2 pw) {
  float along = dot(pw, vec2(-SEA_K.y, SEA_K.x));
  return clamp(0.5 + 0.34 * sin(dot(pw, SEA_K) * 0.0052 - uTime * 0.31) + 0.3 * sin(along * 0.011 + uTime * 0.17 + 2.0 * sin(along * 0.004)), 0.0, 1.0);
}
/** The slope those waves give the water (added to what it had): steeper as they close on the block, and in its lee a slick, where even the small ripples die. */
vec2 blockSwell(vec2 pw, vec2 slope) {
  vec4 bf = blockFoot(pw);
  float wk = blockWeather(bf);
  slope *= 1.0 - 0.85 * (1.0 - wk) * (1.0 - smoothstep(120.0, 330.0, bf.x));
  float amp = (1.0 - smoothstep(190.0, 620.0, bf.x)) * smoothstep(0.0, 30.0, bf.x) * (0.25 + 0.75 * blockSet(pw)) * wk;
  vec2 way = normalize(mix(-SEA_K, bf.zw, exp(-bf.x / 110.0)));
  // (Before dawn the water is a mirror, and a mirror shows every slope: the swell is held lower.)
  return slope + way * cos(blockPhase(pw, bf)) * mix(0.21, 0.07, uNight) * amp;
}
/**
 * White water in the basin. The sea comes from one side: a crest whitens as
 * it steepens on the way in, breaks on the faces that meet it (a surge of
 * foam that widens as it lands and trails lace as it drains), runs along
 * the block's flanks in streaks, and leaves a slick of still water in its
 * lee. The island's and the basin's own shores take the same sea.
 * sd: the bed's distance here (negative in water). na, nb: two fields of the moving surface.
 */
vec3 blockWater(vec3 col, vec2 pw, float sd, float na, float nb, float sim) {
  vec4 bf = blockFoot(pw);
  float wk = blockWeather(bf);
  float set_ = blockSet(pw);
  float beat = blockBeat(bf.y) * (0.2 + 0.8 * wk);
  float ph = blockPhase(pw, bf);
  float crest = 0.5 + 0.5 * sin(ph - 1.5708);
  float cap = smoothstep(0.74, 0.97, crest) * (1.0 - smoothstep(40.0, 330.0, bf.x)) * smoothstep(0.36, 0.62, na + 0.3 * nb + 0.3 * (set_ - 0.5)) * set_ * wk;
  float land_ = beat * beat;
  float dS = bf.x + 46.0 * (nb - 0.5) + 22.0 * sin(bf.y * 0.05 + uTime * 0.6);
  float surge = (1.0 - smoothstep(4.0 + 46.0 * land_, 22.0 + 104.0 * land_, dS)) * smoothstep(0.2, 0.46, na + 0.5 * beat + 0.2 * nb) * (0.3 + 0.7 * wk);
  // (Foam that has drained off the weather faces is drawn out down the sea, past the block's flanks.)
  float down = dot(pw - uSlabPos.xy, SEA_K);
  float lace = (1.0 - smoothstep(50.0, 240.0, bf.x)) * smoothstep(0.56, 0.76, nb + 0.22 * beat) * (0.3 + 0.5 * beat) * (0.35 + 0.65 * wk) * (1.0 - smoothstep(60.0, 260.0, down) * (1.0 - wk));
  // The shores: a band that comes and goes with its own waves.
  float ang = atan(pw.y - uSlabPos.y, pw.x - uSlabPos.x);
  float beatS = clamp(0.5 + 0.5 * sin(uTime * 1.5 + ang * 5.0 + 2.0 * sin(uTime * 0.5 + ang * 2.0)) + sim, 0.0, 1.0);
  float band = (1.0 - smoothstep(3.0, 8.0 + 18.0 * beatS, -sd)) * smoothstep(0.35, 0.6, na + 0.35 * beatS);
  float laceS = (1.0 - smoothstep(10.0, 46.0, -sd)) * smoothstep(0.62, 0.8, nb + 0.2 * beatS) * beatS * 0.5;
  float nearB = 1.0 - smoothstep(700.0, 1000.0, length(pw - uSlabPos.xy));
  // The slick in the lee: flat water that holds the sky, a shade darker than the sea round it.
  float lee = (1.0 - wk) * (1.0 - smoothstep(120.0, 330.0, bf.x)) * nearB;
  col *= 1.0 - 0.16 * lee * (1.0 - uNight);
  vec3 white = mix(vec3(0.93, 0.96, 1.0) * (S.amb * 1.25 + S.key * 0.28), vec3(0.34, 0.5, 0.56) * 0.3 + uAurora * 0.14, uNight);
  return mix(col, white, clamp(max(surge * 0.95 + cap * 0.8 + lace, (band * 0.85 + laceS) * (1.0 - 0.7 * lee)), 0.0, 1.0) * nearB);
}

/**
 * The block: a great piece of ice calved from a glacier's face, with the
 * product picture frozen in it, standing in the basin's water at the
 * island's shore. It is rough-hewn: leaning sides, a sloping top, corners
 * and arrises broken away. One face is cut flat and polished, so the picture
 * is seen clean through a hand of clear ice; the eye goes on into the ice
 * round it, which is dark and blue-green in its depth and bright at its
 * edges, where the light comes back out. The other faces are the break
 * itself: frosted, fluted by melt, scalloped. Snow lies deep on everything
 * that looks up and hangs over the faces, and the water has eaten a deep
 * notch along the foot, where the waves break white.
 * hl: where the eye's ray meets it, in the block's frame. foot: how much of it a pixel covers.
 * Returns the colour and, in a, how much of the pixel it covers (its
 * outline is worn, not ruled).
 */
float gSlabMargin = 0.0;
vec4 slabColor(vec3 hl, float face, float t, vec3 rd) {
  vec3 L = keyDir();
  int fi = int(face + 0.5);
  vec3 nl = SLF[fi].xyz;
  bool front = fi == 0;
  bool top = nl.z > 0.7;
  vec3 dl = vec3(dot(rd.xy, uSlabDir.zw), -dot(rd.xy, uSlabDir.xy), rd.z);
  // How near the nearest arris is on this face, and how near the block's outline (an arris whose other face is turned from the eye).
  float edgeD = 1e3;
  float silD = 1e3;
  for (int j = 0; j < SLN; j++) {
    if (j == fi) continue;
    vec4 pj = SLF[j];
    float c = dot(pj.xyz, nl);
    float sd = (pj.w - dot(hl, pj.xyz)) / sqrt(max(1.0 - c * c, 0.02));
    // (The foot stands in the water: it is no edge of the ice.)
    if (j == 5) continue;
    edgeD = min(edgeD, sd);
    if (dot(dl, pj.xyz) > 0.0) silD = min(silD, sd);
  }
  // The face's own plane: across it, and up it (or, on a face that looks up, back along it).
  // (The foot looks straight down: it has no way "across" of its own, and is given the top's.)
  bool level = abs(nl.z) > 0.7;
  vec3 tu = front || level ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-nl.y, nl.x, 0.0));
  vec3 tv = level ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec2 q = vec2(dot(hl, tu) + uSlabSize.x * 0.5, dot(hl, tv));
  float foot = t * uPxAng;
  // Radius on screen inside which another ray must hit this same face.
  gSlabMargin = min(edgeD, hl.z) * abs(dot(nl,dl)) / max(foot,1e-4);
  float lodF = lodFor(foot, 64.0, 256.0);
  vec4 gr = textureLod(uGrain, q / 64.0 + face * 0.37, lodF);
  vec4 gr2 = textureLod(uGrain, q / 210.0 + face * 0.19 + 0.5, lodFor(foot, 210.0, 256.0));
  vec3 n = vec3(uSlabDir.zw * nl.x - uSlabDir.xy * nl.y, nl.z);
  float cosi = clamp(dot(-rd, n), 0.0, 1.0);
  float zUp = hl.z;
  // How high the snow's surface stands over this place.
  float zTop = min(min((SLF[4].w - dot(SLF[4].xy, hl.xy)) / SLF[4].z, (SLF[6].w - dot(SLF[6].xy, hl.xy)) / SLF[6].z), min((SLF[7].w - dot(SLF[7].xy, hl.xy)) / SLF[7].z, (SLF[10].w - dot(SLF[10].xy, hl.xy)) / SLF[10].z));
  // The ray inside the ice: bent toward the face's own line, so it moves less across the face than it did in air.
  vec2 across = vec2(dot(dl, tu), dot(dl, tv)) / max(-dot(dl, nl), 0.25) / 1.31;
  float thick = gSlabThick;
  vec3 pW = uSlabPos + vec3(uSlabDir.zw * hl.x - uSlabDir.xy * hl.y, hl.z);
  // Snow: deep on the top, hanging over every face in lobes, a soft shade under each.
  float lobes = textureLod(uGrain, vec2(q.x / 1500.0 + face * 0.13, 0.37), 0.0).g;
  float hang = 20.0 + 26.0 * smoothstep(0.3, 0.75, lobes) + 5.0 * gr2.g;
  float below = zTop - hang - zUp;
  float snowK = top ? 1.0 : 1.0 - smoothstep(-1.0 - foot, 1.0 + foot, below);
  const float MX = 30.0;
  float iw = uSlabSize.x - 2.0 * MX;
  vec2 ts = vec2(textureSize(uSlabTex, 0));
  float ih = iw * ts.y / ts.x;
  vec2 io = vec2(MX, uSlabSize.y - 86.0 - ih);
  vec2 pq = q + across * 16.0;
  vec2 e0 = min(pq - io, io + vec2(iw, ih) - pq);
  float inImg = front ? smoothstep(0.0,2.5,min(e0.x,e0.y)) : 0.0;
  vec3 col = vec3(0);
  if (snowK < 1.0 && inImg * uSlabTint.a < 1.0)
    col = iceGlacier(pW,n,rd,t,q,thick,1.0,1.0,front ? 0.0 : 1.0,edgeD,face*0.61,true);
  float aCov = 1.0;
  if (front && uSlabTint.a > 0.0 && snowK < 1.0) {
    vec3 unlitFace = col;
    vec2 interior = fract((q + across * min(thick,16.0)) / 385.0);
    vec3 inclusions = textureLod(uIceInclusions, vec2(interior.x,interior.y*0.5),
      lodFor(foot,385.0,512.0)).rgb;
    float nearE = 1.0-smoothstep(0.0,4.0,min(e0.x,e0.y));
    pq += (gr.gb-0.5)*3.0*nearE;
    vec2 iuv = (pq-io)/vec2(iw,ih);
    vec3 seen = vec3(0.0);
    if (inImg > 0.0) {
      vec3 img;
      if (gSlabSoft > 0.5) {
        // (Its image in moving water is light, not letters: the water keeps the picture's colours and breaks its words.)
        // (Read far down its chain of smaller copies: its headline is a soft glow there, never a smudge of white.)
        img = pow(textureLod(uSlabTex, vec2(iuv.x, 1.0 - iuv.y), 6.4).rgb, vec3(2.2));
      } else {
        // (Where the two rays beside this one meet the face: how far the picture moves under one device pixel.)
        vec3 ca = hl - dl * t;
        vec3 d1 = normalize(rd + uCamR * uPxAng);
        vec3 d2 = normalize(rd + uCamU * uPxAng);
        d1 = vec3(dot(d1.xy, uSlabDir.zw), -dot(d1.xy, uSlabDir.xy), d1.z);
        d2 = vec3(dot(d2.xy, uSlabDir.zw), -dot(d2.xy, uSlabDir.xy), d2.z);
        float den = SLF[0].w - dot(ca, nl);
        vec3 h1 = ca + d1 * (den / dot(d1, nl));
        vec3 h2 = ca + d2 * (den / dot(d2, nl));
        vec2 u1 = (vec2(h1.x + uSlabSize.x * 0.5, h1.z) + vec2(d1.x, d1.z) / max(-dot(d1, nl), 0.25) / 1.31 * 16.0 - io) / vec2(iw, ih);
        vec2 u2 = (vec2(h2.x + uSlabSize.x * 0.5, h2.z) + vec2(d2.x, d2.z) / max(-dot(d2, nl), 0.25) / 1.31 * 16.0 - io) / vec2(iw, ih);
        vec2 u0 = (q + across * 16.0 - io) / vec2(iw, ih);
        img = pow(picRead(uSlabTex, vec2(iuv.x, 1.0 - iuv.y), (u1 - u0) * vec2(1.0, -1.0), (u2 - u0) * vec2(1.0, -1.0)), vec3(2.2));
      }
      // (By day it keeps its own blacks and whites: only a breath of the ice's blue lies over it. Before dawn it is a screen lit from behind.)
      seen = img * mix(vec3(0.9, 0.96, 0.99), vec3(0.95, 1.05, 1.08), uNight) + img * img * 0.3 * uNight + vec3(0.003, 0.008, 0.011) * (1.0 - uNight);
      // (The first veil of air and a hairline or two lie in front of it, faintly: it is in the ice, not on it.)
      seen += vec3(0.75, 0.9, 1.0) * S.amb * 0.05 * inclusions.g;
    }
    // (Its edge is a break in the ice: a bright line of refracted light round it, and a thin shade outside that.)
    float dImg = max(-min(e0.x, e0.y), 0.0);
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 16.0, dImg)) * (1.0 - inImg);
    col += mix(vec3(0.6, 0.9, 1.0) * (S.amb * 0.5 + S.key * 0.1), uSlabTint.rgb * 0.6, uNight) * (1.0 - smoothstep(0.0, 2.2 + foot, abs(dImg - 2.0))) * (1.0 - inImg) * (0.5 + 0.5 * gr.g);
    col = mix(col, seen, inImg);
    // (Before dawn the picture is the light in the block: its own colours spill into the ice round it, and fall away to dark.)
    if (uNight > 0.0 && inImg < 1.0) {
      vec3 spill = pow(textureLod(uSlabTex, vec2(clamp(iuv.x, 0.04, 0.96), 1.0 - clamp(iuv.y, 0.04, 0.96)), 5.5).rgb, vec3(2.2));
      col += (min(spill * 2.4, vec3(0.5)) + uSlabTint.rgb * 1.2 + vec3(0.012, 0.04, 0.05)) * exp(-dImg / 64.0) * (0.3 + 0.6 * inclusions.b + 0.9 * inclusions.r + 0.5 * gr2.g) * (1.0 - inImg) * uNight;
    }
    // The display sits under a polished skin, while bare ice has its
    // surface reflection from clearIce.
    col += S.hor * inImg * (0.005 + 0.5*pow(1.0-cosi,5.0)) * mix(1.0,0.4,uNight);
    col = mix(unlitFace, col, uSlabTint.a);
    // Above the largest splash and clear of the cornice and chipped
    // silhouette, a fully exposed display already owns the whole pixel.
    if (inImg == 1.0 && uSlabTint.a == 1.0 && below >= 13.0 &&
        zUp > 103.0 && silD > 21.0 + max(foot,0.2)) return vec4(col,1.0);
  } else if (!front && !top) {
    // (Before dawn the picture's light is in the ice of the faces beside it.)
    col += uSlabTint.rgb * 0.5 * exp(-edgeD / 60.0) * uNight;
  }
  // (Its face rounds over toward the foot of each lobe.)
  vec3 nS = top ? normalize(n + vec3((gr2.gb - 0.5) * 0.7, 0.6)) : normalize(n * (0.45 + 0.8 * smoothstep(12.0, 0.0, -below)) + vec3(0.0, 0.0, 0.75 - 0.9 * smoothstep(9.0, 0.0, -below)));
  // (Snow is lit as the land's is: level snow at one brightness whatever the sun's height, a lobe's face
  // turned to the sun brighter, one turned away in the sky's blue shade, its underside darkest. Before dawn
  // it has the sky's light, the curtain's and what the block itself gives off, so it is the palest thing on the block.)
  float toSun = dot(normalize(nS.xy + 1e-4), uBearings.zw);
  float lobeSh = top ? 1.0 : 1.0 - 0.22 * smoothstep(10.0, 0.0, -below);
  vec3 sn = vec3(0.93, 0.94, 0.96) * (S.key * 0.24 * (top ? 0.86 + 0.5 * toSun * (1.0 - nS.z) : 0.9 + 0.45 * toSun) + S.amb * 0.8 * (0.62 + 0.38 * nS.z)) * lobeSh;
  if (uNight > 0.0) sn = mix(sn, (snowNight(nS) * 1.5 + uSlabTint.rgb * 0.2) * lobeSh, uNight);
  if (!top) col *= 1.0 - 0.34 * (1.0 - smoothstep(0.0, 13.0, below)) * step(0.0, below);
  col = mix(col, sn * (0.92 + 0.16 * gr.g), snowK);
  if (!top) {
    // The notch the basin has eaten along the foot: deep, wet and dark, undercut, the water's light moving
    // on its roof, and a bright lip of clear ice over it.
    float nh = 30.0 + 18.0 * gr2.b + 8.0 * sin(q.x / 37.0 + face);
    float notch = 1.0 - smoothstep(nh - 7.0, nh + 2.0, zUp);
    vec3 under = col * vec3(0.16, 0.34, 0.46) + mix(vec3(0.05, 0.2, 0.24) * S.amb * (0.4 + 0.9 * gr.b * smoothstep(0.0, nh, zUp)), S.amb * 0.1, uNight);
    col = mix(col, under, notch * 0.9);
    col += mix(vec3(0.82, 0.93, 1.0) * S.amb * 0.9, (S.amb * 0.9 + uAurora * 0.02) * (0.3 + 0.7 * gr.g), uNight) * (1.0 - smoothstep(0.0, 2.6 + foot, abs(zUp - nh - 1.5))) * 0.75;
    // The waves break on it: white water thrown up the face, higher with each wave that lands.
    float beat = blockBeat(q.x + face * 190.0) * (fi == 3 || fi == 1 ? 0.3 : 1.0);
    float reach = 10.0 + 44.0 * beat * beat;
    float spray = (1.0 - smoothstep(reach * (0.35 + 0.65 * gr.b), reach * (0.75 + 0.9 * gr.b) + 2.0, zUp)) * (0.55 + 0.45 * beat);
    vec3 white = mix(vec3(0.93, 0.96, 1.0) * (S.amb * 1.25 + S.key * 0.28), vec3(0.3, 0.4, 0.5) * 0.3 + uAurora * 0.05, uNight);
    col = mix(col, white, clamp(spray, 0.0, 1.0) * (0.45 + 0.45 * gr.a) * (1.0 - gSlabSoft * 0.5));
    // The outline is worn and chipped: no edge that stands against the sky or the water is a ruled line.
    float px = max(foot, 0.2);
    vec4 gw = textureLod(uGrain, q / vec2(900.0, 1400.0) + face * 0.41, 0.0);
    float wear = 1.5 + 12.0 * smoothstep(0.38, 0.8, gw.g) + 5.0 * smoothstep(0.5, 0.9, gw.b) * step(0.5, gr2.a) + 2.0 * gr.g;
    aCov *= smoothstep(wear - px, wear + px, silD);
  }
  return vec4(col, aCov);
}

#endif`;

export const CONFLUENCE = `#if defined(F_CONF)
/* ---------- the confluence: a snowfield above a cliff of ice, and seven falls ---------- */

// (The snowfield comes up to its height as the eye comes toward it down the valley, over a long stretch of the flight:
// from the basin it is a low shelf, and nothing ever appears at once.)
#define LIP_H (${LIP.h.toFixed(1)} * smoothstep(${(CONF_Y - 3300).toFixed(1)}, ${(CONF_Y - 2450).toFixed(1)}, uCamPos.y))
const vec2 LIP_O = vec2(${LIP.x0.toFixed(1)}, ${LIP.y0.toFixed(1)});
// The way the cliff faces, in plan: out over the river.
const vec2 LIP_N = vec2(${(-LIP.m / Math.hypot(1, LIP.m)).toFixed(5)}, ${(-1 / Math.hypot(1, LIP.m)).toFixed(5)});
const float LIP_LEN = ${Math.hypot(1, LIP.m).toFixed(5)};
const vec2 TRIB_M[${TRIBS.length}] = vec2[${TRIBS.length}](${TRIBS.map((t) => `vec2(${t.mouth.x.toFixed(1)}, ${t.mouth.y.toFixed(1)})`).join(', ')});
float lipY(float x) { return LIP_O.y + (LIP_O.x - x) * ${LIP.m.toFixed(3)}; }
// Where the cliff turns its corner: west of here there is no snowfield, and a second face runs north from it.
const float LIP_W = ${LIP.x1.toFixed(1)};
/**
 * How far north of its straight line the cliff stands at x: it is bent in
 * plan, in buttresses that come forward and bays that go back, and every
 * stream has cut a bay of its own where it goes over.
 */
vec2 lipProfile(float x) {
  vec3 phase = x / vec3(151,63,27) + vec3(1.3,0.4,2.2);
  vec3 amplitudes = vec3(40,18,8);
  float bend = dot(amplitudes,sin(phase));
  float slope = dot(amplitudes/vec3(151,63,27),cos(phase));
  for (int i = 0; i < ${TRIBS.length}; i++) {
    float w = uTribW[i];
    float scale = LIP_LEN / (w*0.5+30.0);
    float d = (x-TRIB_M[i].x)*scale;
    float bay = exp(-0.5*d*d)*step(0.5,w);
    slope = slope*(1.0-bay) + bend*bay*d*scale;
    bend *= 1.0-bay;
  }
  return vec2(bend,slope);
}
float lipBend(float x) { return lipProfile(x).x; }
/** Where the cliff's second face (the one that runs north along the river that leaves) stands at y: bent as the first is. */
// (From the basin that face is seen almost edge on, and a bent face seen edge on cannot be found by the ray: it was drawn as
// torn zigzags at the cliff's west end. From far off it is straight and the snowfield eases down to the land toward it,
// so no face stands there at all; the field takes its height and the face its bends as the eye comes round to them.)
#define LIPW_K smoothstep(${(CONF_Y - 2300).toFixed(1)}, ${(CONF_Y - 1500).toFixed(1)}, uCamPos.y)
float lipWest(float y) { return LIP_W + (24.0 * sin(y / 137.0 + 0.8) + 11.0 * sin(y / 53.0 + 2.6)) * LIPW_K; }
/** How much of its height the snowfield (and the cliff under it) has at a place, for its west end. */
float lipEase(vec2 q) { if (LIPW_K >= 1.0) return 1.0; return mix(smoothstep(0.0, 460.0, q.x - lipWest(q.y)), 1.0, LIPW_K); }
// How steeply the snowfield climbs toward its back where the eye's ray last came down on it.
float gFieldG = 0.0;
/**
 * How high the snowfield stands at a place on it. From the cliff's lip it
 * climbs in long slopes toward the ranges, each roll a little higher than
 * the last, to a crest far back; beyond the crest it comes down to the land.
 */
float fieldTop(vec2 q) {
  // The roll displaces the rear boundary by at most 130 units.
  if (q.y > ${(LIP.back + 80 + 3 * LIP.backRamp + 130).toFixed(1)}) return 0.0;
  float behind = q.y - lipY(q.x);
  if (behind <= 60.0 && q.y < ${(LIP.back + 80 - 130).toFixed(1)}) return LIP_H * lipEase(q);
  // (Its long rolls are written out: world.ts's fieldRoll, which the captions' points are measured by.)
  float roll = 0.5 + ${FIELD_ROLL.a.toFixed(2)} * sin(q.x / ${FIELD_ROLL.ax.toFixed(1)} + 1.3) * cos(q.y / ${FIELD_ROLL.ay.toFixed(1)} + 0.4) + ${FIELD_ROLL.bk.toFixed(2)} * sin((q.x + q.y) / ${FIELD_ROLL.b.toFixed(1)} + 2.1);
  float climb = smoothstep(60.0, 1250.0, behind);
  // (Its small rolls are low: a roll as steep as a far ray's own fall hides the snow behind it, and the field was drawn in torn bands.)
  float up = 1.0 + climb * (0.55 + 0.7 * roll) + 0.022 * sin(behind / 150.0 + 4.0 * roll) * smoothstep(120.0, 420.0, behind);
  float back = 1.0 - smoothstep(${(LIP.back + 80).toFixed(1)}, ${(LIP.back + 80 + 3 * LIP.backRamp).toFixed(1)}, q.y + 260.0 * (roll - 0.5));
  return LIP_H * up * back * lipEase(q);
}
/** 1 while the confluence is near enough to be seen. */
bool confNear() { return uCamPos.y > ${(CONF_Y - 3300).toFixed(1)} && uCamPos.y < ${(CONF_Y + 1500).toFixed(1)}; }
/**
 * How far above the land the ground under a ray lies: the snowfield's
 * height where the ray comes down on it, nothing anywhere else.
 */
float confLift(vec3 dir) {
  gFieldG = 0.0;
  if (!confNear()) return 0.0;
  // Where the ray first comes down on the field: the greatest height h at which the field, under the place the ray
  // crosses that height, stands at least h. (The field climbs away from the eye about as steeply as a far ray comes
  // down to it, so stepping from a guess to the field's height there never settled, and the far streams were drawn
  // away from where they run. The ray is followed down from above the field's highest roll until it is under the
  // snow, and the place is then found between the last two heights.)
  float hA = LIP_H * 2.45;
  float fA = -1.0;
  float h = -1.0;
  vec2 q = uCamPos.xy + dir.xy * ((uCamPos.z - LIP_H * 0.98) / -dir.z);
  // (A ray that is still short of the cliff when it has come down to the lip's height never reaches the field: most of the frame.)
  if (q.y < lipY(q.x) - 70.0) return 0.0;
  vec2 high = uCamPos.xy + dir.xy * ((uCamPos.z - hA) / -dir.z);
  if (max(q.x, high.x) < LIP_W - 35.0 || min(q.y, high.y) > ${(LIP.back + 80 + 3 * LIP.backRamp + 130).toFixed(1)}) return 0.0;
  for (int i = 1; i <= 6; i++) {
    float hB = LIP_H * (2.45 - 0.245 * float(i));
    q = uCamPos.xy + dir.xy * ((uCamPos.z - hB) / -dir.z);
    float fB = fieldTop(q) - hB;
    if (fB >= 0.0) {
      // (Under the snow at hB, over it at hA: halved five times, then the chord.)
      for (int k = 0; k < 5; k++) {
        float hM = 0.5 * (hA + hB);
        q = uCamPos.xy + dir.xy * ((uCamPos.z - hM) / -dir.z);
        float fM = fieldTop(q) - hM;
        if (fM >= 0.0) { hB = hM; fB = fM; } else { hA = hM; fA = fM; }
      }
      h = hB + (hA - hB) * fB / max(fB - fA, 1e-4);
      break;
    }
    hA = hB;
    fA = fB;
  }
  // (A ray that never comes under the snow passes over the field: it lands on the country beyond.)
  if (h < 0.0) return 0.0;
  q = uCamPos.xy + dir.xy * ((uCamPos.z - h) / -dir.z);
  h = fieldTop(q);
  if (q.y < lipY(q.x) + lipBend(q.x) || q.x < lipWest(q.y)) return 0.0;
  if (uNight < 1.0) gFieldG = (fieldTop(q + vec2(0.0, 14.0)) - h) / 14.0;
  return h;
}
// Where the eye's ray meets the cliff, and the ray: set by whoever asks for the cliff's ice.
vec3 gCliffP = vec3(0.0);
vec3 gCliffRd = vec3(0.0, 1.0, 0.0);
/**
 * The ice of a cliff's face: the glacier's own, as the seracs and the dam are (strata, ledges, fracture planes, melt
 * cups, threads of meltwater), pale under its lip where it is thin and deep blue toward the water; a cornice of snow
 * along the lip with one clean lower edge and icicles under it; a dark wet notch at the water.
 * f: 0 at its lip, 1 at the water. along: a measure along it. nP: the way it faces, in plan.
 */
vec3 cliffIce(float f, float along, float tall, float px, vec2 nP) {
  vec3 L = keyDir();
  vec3 n = normalize(vec3(nP, 0.22));
  float up = (1.0 - f) * tall;
  float thick = 50.0 + 520.0 * smoothstep(0.03, 0.8, f);
  vec3 c = iceGlacier(gCliffP, n, gCliffRd, px / uPxAng, vec2(along, up), thick, 1.0, 0.45 + 0.55 * step(0.0, dot(n, L)), 1.0, 1e3, 5.3);
  // (It stands in buttresses, with deep clefts between them.)
  float cleft = 1.0 - smoothstep(0.0, 0.09, abs(sin(along / 733.0 + 0.7) * sin(along / 291.0 + 2.0)));
  c *= 1.0 - 0.4 * cleft * smoothstep(0.05, 0.3, f);
  // The cornice: packed snow over the lip, its lower edge one line that rises and falls along the cliff.
  float hang = 11.0 + 7.0 * sin(along / 97.0 + 1.0) + 4.0 * sin(along / 31.0);
  float dz = f * tall - hang;
  c = iciclesOn(c, along, dz, px, 18.0);
  c = corniceOn(c, n, dz, hang, px);
  // Wet and dark where it stands in the water.
  return waterlineOn(c, up, 0.5 + 0.5 * sin(along * 0.05));
}
/** The air between the eye and something t away, laid over its colour. */
vec3 confAir(vec3 c, vec3 dir, float t) {
  vec3 air = airAt(dir.xy);
  air = mix(air, mix(S.hor, air, 0.45), uNight);
  // (The same air as the ground it stands on, at any distance: far off the cliff is a low shelf of ice in the land's own light, never a paler shape hung in front of it.)
  return mix(c, air, airLoss(t));
}
/** The cliff's second face: from the corner north along the river that leaves, looking west. */
vec3 confWest(vec3 col, vec3 dir, float landAt0) {
  // (It is seen only from the west of it.)
  if (dir.x < 1e-4 || uCamPos.x > LIP_W - 40.0) return col;
  float tc = (LIP_W - uCamPos.x) / dir.x;
  if (tc <= 0.0) return col;
  tc = (lipWest(uCamPos.y + dir.y * tc) - uCamPos.x) / dir.x;
  vec3 h = uCamPos + dir * tc;
  if (h.y < lipY(h.x) + lipBend(h.x)) return col;
  float top = fieldTop(h.xy);
  float px = max(tc * uPxAng, 0.05);
  if (top < 1.0 || h.z > top + px || h.z < -FREEBOARD) return col;
  float aC = (1.0 - smoothstep(top - px, top + px, h.z)) * smoothstep(0.0, 2.0 * px, h.y - lipY(h.x) - lipBend(h.x));
  if (h.z < 0.0) aC *= 1.0 - landAt0;
  if (aC <= 0.0) return col;
  gCliffP = h;
  gCliffRd = dir;
  vec3 c = cliffIce((top - h.z) / (top + FREEBOARD), h.y + 400.0, top + FREEBOARD, px, vec2(-1.0, 0.0));
  return mix(col, confAir(c, dir, tc), aC);
}
/**
 * The cliff and what comes over it. Glacier ice under a cornice of snow,
 * fluted, blue toward the water, standing in buttresses and bays with a
 * ragged crest; and where a stream reaches the lip, a fall: glassy at the
 * brink, then white strands that open as they drop, and mist standing at
 * the foot. Each fall is as wide as its stream; a great one leaves the lip
 * with way on it and comes down clear of the ice, a dark gap behind it.
 * landAt0: how much of this pixel's ground at the land's level is land (the ledge at the cliff's foot stands in front of it).
 */
vec3 confCliff(vec3 col, vec3 dir, float landAt0) {
  if (!confNear()) return col;
  col = confWest(col, dir, landAt0);
  float den = dot(dir.xy, LIP_N);
  if (den > -1e-4) return col;
  float t0 = dot(LIP_O - uCamPos.xy, LIP_N) / den;
  if (t0 <= 0.0) return col;
  // The bend has a maximum displacement of 40 + 18 + 8 units.
  float straightZ = uCamPos.z + dir.z * t0;
  float zPad = abs(dir.z / (den * LIP_LEN)) * 66.0;
  if (straightZ > LIP_H * 1.5 + zPad || straightZ < -FREEBOARD - zPad) return col;
  // The face is bent in plan: the ray is met where the bend stands at the place it reaches (found in two steps).
  float tc = t0;
  for (int i = 0; i < 2; i++) tc = t0 - lipBend(uCamPos.x + dir.x * tc) / LIP_LEN / den;
  vec3 h = uCamPos + dir * tc;
  if (h.x < lipWest(h.y)) return col;
  float px = max(tc * uPxAng, 0.05);
  float rise = LIP_H * 1.5;
  if (LIP_H < 1.0 || h.z > rise || h.z < -FREEBOARD) return col;
  // The crest is ragged: snow banked along the lip in drifts of its own height, and blocks of the ice standing
  // proud between clefts. (Not where a stream goes over: there the lip is cut down to the stream.)
  float berm = LIP_H * (0.1 * n1(h.x / 210.0 + 2.0) + 0.07 * n1(h.x / 61.0 + 7.0) + 0.035 * n1(h.x / 17.0)) + 2.0;
  for (int i = 0; i < ${TRIBS.length}; i++) {
    float w = uTribW[i];
    if (w > 0.0) berm *= smoothstep(w * 0.5 + 1.0, w * 0.5 + 11.0, abs(h.x - TRIB_M[i].x) * LIP_LEN);
  }
  float ease = lipEase(h.xy);
  float top = (LIP_H + berm) * ease;
  float aC = (1.0 - smoothstep(top - px, top + px, h.z)) * smoothstep(0.0, 2.0 * px, h.x - lipWest(h.y));
  if (h.z < 0.0) aC *= 1.0 - landAt0;
  float tall = top + FREEBOARD;
  float f = (top - h.z) / tall;
  float along = h.x * LIP_LEN;
  vec3 c = col;
  if (aC > 0.0) {
    vec2 profile = lipProfile(h.x);
    float turnB = profile.y / LIP_LEN;
    vec2 nP = normalize(LIP_N + vec2(1.0,${(-LIP.m).toFixed(3)})*turnB/LIP_LEN);
    gCliffP = h;
    gCliffRd = dir;
    c = cliffIce(f,along,tall,px,nP);
    float bay = smoothstep(-30.0,46.0,profile.x);
    c *= (1.0-0.34*bay)*(1.0+0.42*clamp(turnB*sign(keyDir().x+1e-4),-0.7,0.7))
      *(0.84+0.3*smoothstep(0.75,0.0,f)*(1.0-bay));
  }
  // The falls.
  float zs = LIP_H * ease - FREEBOARD;
  // (Before dawn white water holds the sky's light: pale and cold, never a lamp.)
  vec3 white = mix(vec3(0.95, 0.98, 1.0) * (S.amb * 1.2 + S.key * 0.3), vec3(0.9, 0.95, 1.0) * (S.amb * 1.3 + S.key * 1.5) + uAurora * 0.05, uNight);
  vec3 glass = mix(vec3(0.2, 0.56, 0.66) * (S.amb * 1.1 + S.key * 0.2), vec3(0.22, 0.46, 0.6) * (S.amb * 1.1 + S.key * 0.3) + uAurora * 0.02, uNight);
  float mist = 0.0;
  float aAll = aC;
  for (int i = 0; i < ${TRIBS.length}; i++) {
    float w = uTribW[i];
    if (w <= 0.0) continue;
    float fi = float(i);
    // A great fall stands off the ice: the further it has dropped, the further out. The ray meets its sheet in front of the face.
    float way = clamp((w - 50.0) / 130.0, 0.0, 1.0);
    vec3 hf = h;
    float tf = tc;
    if (way > 0.0) {
      float off = 0.0;
      for (int k = 0; k < 2; k++) {
        tf = tc + off / den;
        hf = uCamPos + dir * tf;
        off = way * (5.0 + 40.0 * sqrt(clamp((zs - hf.z) / max(zs + FREEBOARD, 1.0), 0.0, 1.0)));
      }
    }
    float d = (hf.x - TRIB_M[i].x) * LIP_LEN;
    float reach = w * 0.5 + 70.0;
    if (abs(d) > reach) continue;
    if (hf.z > zs) {
      // The stream's own water in its notch, sliding to the brink.
      float aN = (1.0 - smoothstep(w * 0.5 - px, w * 0.5 + px, abs(d))) * (1.0 - smoothstep(top - px, top + px, hf.z));
      float rush = textureLod(uGrain, vec2(d / 240.0 + fi * 0.31, (hf.z - zs) / 90.0 + uTime * 0.12 + fi), 0.0).g;
      c = mix(c, mix(glass, white, smoothstep(0.5, 0.85, rush) * 0.45 + 0.35 * smoothstep(8.0, 0.0, hf.z - zs)), aN);
      aAll = max(aAll, aN);
    } else if (hf.z > -FREEBOARD) {
      float v = (zs - hf.z) / max(zs + FREEBOARD, 1.0);
      // (Behind a fall that stands off it the ice is in the fall's shade: a dark gap, seen past the sheet's edge and between its strands.)
      float dC = (h.x - TRIB_M[i].x) * LIP_LEN;
      c *= 1.0 - 0.66 * way * (1.0 - smoothstep(w * 0.5 - 6.0, w * 0.5 + 14.0 + 44.0 * v, abs(dC))) * smoothstep(zs + 6.0, zs - 16.0, h.z) * step(1e-4, aC);
      // (It quickens as it drops: its strands are drawn longer the further down.)
      float drop = v * (0.55 + 0.45 * v);
      float st1 = textureLod(uGrain, vec2(d / 52.0 + fi * 0.37, drop * 0.3 - uTime * 0.16), 0.0).g;
      float st2 = textureLod(uGrain, vec2(d / 19.0 + fi * 0.71, drop * 0.5 - uTime * 0.27 + 0.5), lodFor(px, 19.0, 256.0)).g;
      float strand = 0.55 * st1 + 0.45 * st2;
      // It opens as it falls, and its edges break into strands.
      float half_ = w * 0.5 * (1.0 + 0.1 * v) + 5.0 * v;
      float ragged = abs(d + 5.0 * sin(v * 5.0 + fi * 2.3) * v) + (strand - 0.5) * (6.0 + 14.0 * v);
      float aF = 1.0 - smoothstep(half_ - px - 1.5, half_ + px + 1.5, ragged);
      // A thin stream is a veil the ice shows through; a great one is solid.
      float body = clamp(0.5 + w / 150.0, 0.0, 1.0);
      aF *= mix(0.45 + 0.55 * smoothstep(0.3, 0.62, strand), 1.0, body * 0.8) * (0.35 + 0.65 * smoothstep(0.0, 0.07, v));
      vec3 fall = mix(mix(vec3(0.46, 0.7, 0.82), vec3(0.16, 0.3, 0.36), uNight) * (S.amb * 1.1 + S.key * 0.16 + uAurora * 0.1), white, smoothstep(0.34, 0.66, strand) * (0.45 + 0.55 * smoothstep(0.0, 0.25, v)));
      // (A sheet that stands clear is round: its middle is lit, its two edges turn away into shade.)
      fall *= 1.0 - 0.28 * way * smoothstep(0.45, 1.0, abs(d) / half_);
      // (The brink: the water bends over it, glassy.)
      fall = mix(glass * 1.3, fall, smoothstep(0.0, 0.1, v));
      c = mix(c, fall, aF);
      aAll = max(aAll, aF);
    }
    // Mist where it lands: it stands up the cliff, higher under a greater fall, billows and drifts.
    float up = (hf.z + FREEBOARD) / (18.0 + 0.3 * w);
    float lat = d / (w * 0.5 + 30.0);
    float puff = textureLod(uGrain, vec2(d / 170.0 + uTime * 0.02, up * 0.2 - uTime * 0.03) + fi * 0.2, 0.0).g;
    float m = exp(-lat * lat) * exp(-up * (0.7 + 0.9 * puff)) * (0.5 + 0.009 * w) * (0.7 + 0.5 * puff) * step(-FREEBOARD, hf.z);
    mist += m;
    aAll = max(aAll, min(m, 0.85));
  }
  if (aAll <= 0.0) return col;
  c = mix(c, white * 0.96, clamp(mist, 0.0, 0.85));
  // The same air as the ground it stands on.
  return mix(col, confAir(c, dir, tc), aAll);
}
/**
 * The river along the cliff's foot. Each stream's paler meltwater keeps to
 * the bank it came in by and is pushed out from it by the next: seven
 * trails side by side, a seam of foam between each and its neighbour, the
 * newest whitest. And where each fall lands, a boil.
 */
vec3 confRiver(vec3 col, vec2 pw, float footL, float na, float nb, float shade) {
  float bankY = lipY(pw.x) - ${LIP.foot.toFixed(1)};
  float out_ = (bankY - pw.y) / LIP_LEN;
  if (out_ < -40.0 || out_ > 760.0) return col;
  float far = 1.0 - smoothstep(20.0, 60.0, footL);
  vec3 white = mix(vec3(0.94, 0.97, 1.0) * (S.amb * 1.25 + S.key * 0.3), vec3(0.9, 0.95, 1.0) * (S.amb * 1.1 + S.key * 0.55) + uAurora * 0.03, uNight);
  vec3 milk = mix(vec3(0.56, 0.87, 0.9) * (S.amb * 1.1 + S.key * 0.17), vec3(0.42, 0.6, 0.7) * (S.amb * 1.0 + S.key * 0.2) + uAurora * 0.02, uNight);
  float inner = 0.0;
  float milkK = 0.0;
  float seam = 0.0;
  float boil = 0.0;
  for (int i = ${TRIBS.length - 1}; i >= 0; i--) {
    float w = uTribW[i];
    if (w <= 0.0) continue;
    float mx = TRIB_M[i].x;
    float k = smoothstep(mx + w * 0.5, mx - w * 0.5 - 60.0, pw.x);
    float bw = ${CONF_RIVER.add.toFixed(2)} * w * k;
    if (bw > 0.5) {
      float a1 = inner + bw;
      float age = max(mx - pw.x, 0.0);
      float fresh = exp(-age / (420.0 + 3.0 * w));
      float wob = 5.0 * sin(pw.x * 0.021 + float(i) * 2.1 + uTime * 0.5) * (1.0 - fresh * 0.5);
      float inB = smoothstep(inner - 1.5, inner + 3.0, out_ + wob) * (1.0 - smoothstep(a1 - 3.0, a1 + 1.5, out_ + wob));
      milkK += inB * (0.42 + 0.58 * fresh) * (0.62 + 0.38 * cos(float(i) * 3.1416));
      seam += (1.0 - smoothstep(0.0, 4.6 + 2.2 * footL, abs(out_ + wob - a1))) * (0.6 + 0.4 * fresh) * k;
      inner = a1;
    }
    // The boil at its foot: a fan of broken water, wider under a wider fall.
    vec2 d = vec2((pw.x - mx) * LIP_LEN, out_);
    float r2 = dot(d * vec2(1.0, 1.25), d * vec2(1.0, 1.25));
    boil += exp(-r2 / (w * w * 0.5 + 1100.0)) * (0.75 + 0.005 * w) * step(-6.0, out_);
  }
  // Streaks, long down the current, in the pale water.
  float streak = 0.55 + 0.45 * smoothstep(0.3, 0.7, textureLod(uDetail, vec2(pw.y / 70.0, (pw.x + uTime * uFlowSpeed * 0.7) / 900.0), lodFor(footL, 70.0, 512.0)).r);
  col = mix(col, milk, clamp(milkK, 0.0, 1.0) * streak * 0.8 * far);
  col = mix(col, white, clamp(seam, 0.0, 1.0) * (0.7 + 0.3 * na) * far * (1.0 - 0.4 * shade));
  float churn = smoothstep(0.26, 0.6, mix(na, nb, 0.5) + 0.5 * clamp(boil, 0.0, 1.0) - 0.1);
  col = mix(col, white, clamp(boil, 0.0, 1.0) * churn * 0.95);
  return col;
}

#endif`;

export const ROCK_POOL = `/* ---------- the rock pool and the results on its bed ---------- */

const vec2 POOL_C = vec2(${(POOL.x + POOL.w / 2).toFixed(1)}, ${(POOL.y + POOL.h / 2).toFixed(1)});
const vec2 POOL_H = vec2(${(POOL.w / 2).toFixed(1)}, ${(POOL.h / 2).toFixed(1)});
/** 0..1: inside the pool's reach. */
float poolAt(vec2 p) {
  vec2 pq = abs(p - POOL_C) - POOL_H;
  return 1.0 - smoothstep(-10.0, 40.0, max(pq.x, pq.y));
}
/**
 * 0..1: the bed under this water is the pool's. pb: the place on the bed the eye's bent ray reaches; pw: the place
 * on the water. (Only for water that lies by the pool itself: under deep open water the bed's place is taken a long
 * way from the water's, and a far reach of open water whose bed place happens to fall here is not the pool. 560 is
 * the reach variants.ts allows the pool's water.)
 */
float poolUnder(vec2 pb, vec2 pw) {
  vec2 pq = abs(pw - POOL_C) - POOL_H;
  return max(pq.x, pq.y) < 560.0 ? poolAt(pb) : 0.0;
}
/** 1 while the pool is near enough to be seen. */
bool poolNear() { return abs(uCamPos.x - POOL_C.x) < 2300.0 && abs(uCamPos.y - POOL_C.y) < 2300.0; }
// The results lie on the bed as one dark slab, the table set on it in type. (The type is a mask drawn for the screen
// it is seen on: uSheetTex holds how much of each place a letter covers, all five columns of it.)
// (A narrow frame is shown the first columns, a wide one all five. This is world.ts's sheetCols.)
#define SH_N (uLens.y < 0.62 ? 2 : (uLens.y < 0.9 ? 3 : (uLens.y < 1.72 ? 2 : (uLens.y < 2.2 ? 3 : (uLens.y < 2.7 ? 4 : 5)))))
const float SH_SPAN[6] = float[6](0.0, ${[1, 2, 3, 4, 5].map((n) => boardSpan(n).toFixed(1)).join(', ')});
const vec2 SH_O = vec2(${SHEET.x0.toFixed(1)}, ${SHEET.y.toFixed(1)});
const float SH_HALF = ${(BOARD_DEPTH / 2).toFixed(1)};
const float SH_HEAD = ${BOARD.head.toFixed(1)};
const float SH_ROW = ${BOARD.row.toFixed(1)};
/** How far outside the slab a place on the bed is (negative on it). Its corners are round. */
float sheetEdge(vec2 pb) {
  float w = SH_SPAN[SH_N];
  vec2 sq = abs(pb - vec2(SH_O.x + w * 0.5, SH_O.y)) - vec2(w * 0.5, SH_HALF) + 7.0;
  return length(max(sq, 0.0)) + min(max(sq.x, sq.y), 0.0) - 7.0;
}
/**
 * The table where it lies: a dark slab, a hairline under the header and between the rows, and the type. The type is
 * read so that it stays type at every size: smaller than it was drawn, along the tilt and a little finer than the
 * plain rule; larger, its edge is put where the mask says it is and drawn as narrow as a device pixel allows.
 * a: 1 on the slab.
 */
vec4 sheetPic(vec2 pb, float footL) {
  // From the slab's far west corner: x east, y toward the eye (down the table).
  vec2 l = vec2(pb.x - SH_O.x, SH_O.y + SH_HALF - pb.y);
  vec2 full = vec2(SH_SPAN[5], 2.0 * SH_HALF);
  vec2 uv = l / full;
  // (How far the table moves under one device pixel: the ground's own measure of a pixel.)
  vec2 dx = gGx * vec2(1.0, -1.0) / full;
  vec2 dy = gGy * vec2(1.0, -1.0) / full;
  vec2 size = vec2(textureSize(uSheetTex, 0));
  float px = max(length(dx * size), length(dy * size));
  float cov = 0.0;
  if (px < 1.0) {
    float k = clamp(0.35 * px, 0.04, 0.5);
    cov = smoothstep(0.5 - k, 0.5 + k, textureLod(uSheetTex, uv, 0.0).r);
  }
  if (px > 0.7) cov = mix(cov, textureGrad(uSheetTex, uv, dx * 0.8, dy * 0.8).r, smoothstep(0.7, 1.0, px));
  // (Nothing is set in the slab's margin, or past the last column shown.)
  cov *= step(0.0, l.x) * step(l.x, SH_SPAN[SH_N] - 4.0);
  float aa = max(footL, 0.25);
  // The rules: one under the header, a fainter one between two rows.
  float ry = l.y - SH_HEAD;
  float rule = (1.0 - smoothstep(0.45, 0.45 + aa, abs(ry))) * 0.75;
  if (ry > 0.5 * SH_ROW) rule = (1.0 - smoothstep(0.35, 0.35 + aa, abs(mod(ry + 0.5 * SH_ROW, SH_ROW) - 0.5 * SH_ROW))) * 0.45 * step(ry, 2.5 * SH_ROW);
  rule *= min(1.0, 0.9 / aa);
  float edge = -sheetEdge(pb);
  // (A fine pale line runs round the slab just inside its edge: it is a made thing lying on the silt.)
  float rim = (1.0 - smoothstep(0.5, 0.5 + aa, abs(edge - 1.6))) * min(1.0, 0.9 / aa);
  float head = 1.0 - smoothstep(-0.5, 0.5, ry);
  vec3 ground = vec3(0.0085, 0.011, 0.0145) * (1.0 + 0.5 * head);
  vec3 col = ground + vec3(0.05, 0.058, 0.066) * max(rule, rim * 0.8);
  // The header is quieter than the results under it.
  col = mix(col, mix(vec3(0.74, 0.77, 0.79), vec3(0.4, 0.44, 0.47), head), cov);
  return vec4(col, 1.0 - smoothstep(-aa, aa, -edge));
}
/** The light the table gives off before dawn. */
vec3 sheetGlow() {
  return vec3(0.036, 0.082, 0.098);
}
/**
 * The pool's bed. Round the shore pale glacial silt drawn into ripple marks,
 * with stones lying on it, each lit from the sun's side with its shade
 * beside it; toward the middle the silt gives way to the dark rock of the
 * deep. deep: 0 in the shallows, 1 over the deep.
 */
vec3 poolBed(vec2 pb, float footL, vec3 L, float deep) {
  vec4 g = textureLod(uGrain, pb / 300.0, lodFor(footL, 300.0, 256.0));
  vec3 silt = mix(vec3(0.42, 0.64, 0.67), vec3(0.035, 0.06, 0.075), deep) * (0.88 + 0.24 * g.g);
  // Ripple marks: long wandering ridges across the current, each with a lit face and a shaded one.
  float warp = textureLod(uGrain, pb / 2600.0 + 0.4, 0.0).g;
  float ph = (pb.y * 0.92 + pb.x * 0.38) / 9.5 + warp * 9.0;
  float rip = sin(ph) + 0.35 * sin(ph * 2.0 + 1.0);
  float ripK = smoothstep(0.35, 0.6, textureLod(uGrain, pb / 1700.0 + 0.7, 0.0).g) * (1.0 - smoothstep(1.5, 5.0, footL));
  silt *= 1.0 + 0.11 * rip * ripK;
  // Stones, two sizes: a broken piece to a cell, most cells empty.
  float off = sheetEdge(pb);
  vec2 sun2 = normalize(L.xy + 1e-4);
  for (int k = 0; k < 2; k++) {
    float cell = k == 0 ? 74.0 : 27.0;
    vec2 q = pb / cell + (k == 0 ? 0.0 : 13.7);
    vec2 id = floor(q);
    vec2 h = hash2(id + float(k) * 31.0);
    // (They lie in drifts, thickest toward the banks, and most of them are small.)
    float drift = textureLod(uGrain, id / (k == 0 ? 9.0 : 23.0) + 0.3, 0.0).g + 0.25 * smoothstep(40.0, 150.0, off) - 0.16 * deep;
    float there = step(k == 0 ? 0.6 : 0.5, fract(h.x * 17.3 + h.y * 5.1)) * step(0.52, drift);
    float rad = cell * (0.12 + 0.24 * h.y * h.y);
    vec2 c = (id + 0.5 + (h - 0.5) * 0.44) * cell - (k == 0 ? vec2(0.0) : vec2(13.7 * cell));
    // (None lies on the picture.)
    there *= step(rad + 4.0, sheetEdge(c));
    if (there < 0.5) continue;
    vec2 d = pb - c;
    float ang = h.x * 6.283;
    vec2 dl = vec2(cos(ang) * d.x + sin(ang) * d.y, (-sin(ang) * d.x + cos(ang) * d.y) * (1.25 + 0.5 * h.y));
    // (Its outline has corners: a stone is a broken piece, not a pebble.)
    float rr = (length(dl) + 0.34 * rad * (abs(dl.x) * (0.4 + h.x) - abs(dl.y) * (0.3 + h.y)) / max(length(dl), 1e-3) * 0.5) / rad;
    // Its shade on the silt, away from the light.
    vec2 ds = d + sun2 * rad * 0.55;
    silt *= 1.0 - 0.42 * (1.0 - smoothstep(0.55, 1.25, length(ds) / rad));
    float aS = 1.0 - smoothstep(1.0 - 1.5 * footL / rad, 1.0 + 0.5 * footL / rad, rr);
    if (aS > 0.0) {
      float dome = sqrt(max(1.0 - rr * rr, 0.0));
      // (Flat faces, turned each its own way.)
      vec3 nS = normalize(vec3(floor(d / rad * 1.7 + h * 3.0 + 0.5) / 1.7 * 0.9, 0.35 + dome));
      float tone = fract(h.x * 9.7 + h.y * 3.3);
      vec3 stone = mix(vec3(0.1, 0.115, 0.13), vec3(0.46, 0.5, 0.5), tone) * (0.75 + 0.5 * textureLod(uGrain, pb / 37.0 + h, lodFor(footL, 37.0, 256.0)).g) * (1.0 - 0.6 * deep);
      stone *= 0.5 + 0.95 * max(dot(nS, normalize(vec3(L.xy, max(L.z, 0.35)))), 0.0);
      silt = mix(silt, stone, aS);
    }
  }
  return silt;
}
/** The net of light on the pool's bed: two broad layers of the moving surface's own focus, drifting across each other. */
float poolNet(vec2 pb, float footL) {
  const mat2 RP = mat2(0.8090, -0.5878, 0.5878, 0.8090);
  float a = textureLod(uDetail, pb / 520.0 + vec2(0.011, 0.006) * uTime, lodFor(footL, 520.0, 512.0)).a;
  float b = textureLod(uDetail, RP * pb / 390.0 - vec2(0.008, 0.013) * uTime + 0.37, lodFor(footL, 390.0, 512.0)).a;
  float n = min(a, b) * 6.0;
  return 0.66 + 2.0 * smoothstep(0.7, 2.3, n) + 0.3 * n;
}
/**
 * The pool's rim: a shelf of clear ice standing out over the water from the
 * bank all round, a bright refracting edge to it, snow dusted on it toward
 * the land. Before dawn the picture lights it from below.
 * inside: how far out from the bank over the water. Returns the colour to
 * lay over the water and, in a, how much of it.
 */
vec4 poolRim(vec2 pw, float inside, float footL, vec3 dir, vec3 water, vec3 sky) {
  if (inside > 36.0 + max(footL, 0.3)) return vec4(0.0);
  vec4 g = textureLod(uGrain, pw / 420.0 + 0.2, lodFor(footL, 420.0, 256.0));
  float reach = 9.0 + 20.0 * g.g * g.g + 7.0 * g.b;
  float px = max(footL, 0.3);
  float a = 1.0 - smoothstep(reach - px, reach + px, inside);
  if (a <= 0.0) return vec4(0.0);
  float edge = 1.0 - smoothstep(0.0, 3.0 + px, reach - inside);
  float dust = 1.0 - smoothstep(reach * 0.2, reach * 0.75, inside + 6.0 * (g.a - 0.5));
  vec3 ice = clearIce(vec3(0,0,1),dir,pw,px,reach,reach-inside,0.35,
    0.7,water,S.amb+S.key*0.2,sky);
  vec3 snow = mix(vec3(0.93, 0.94, 0.96) * (S.key * 0.24 + S.amb * 0.8), snowNight(vec3(0.0, 0.0, 1.0)), uNight);
  vec3 col = mix(ice, snow, dust * 0.85);
  return vec4(col, a * (0.82 + 0.18 * edge));
}
// The blocks of ice that stand in the pool. xy: where, z: a sphere round each that holds all of it above the water.
const vec3 RK[${ROCKS.length}] = vec3[${ROCKS.length}](${ROCKS.map((r) => `vec3(${r.x.toFixed(1)}, ${r.y.toFixed(1)}, ${(Math.hypot(r.a, r.h) * 1.08).toFixed(1)})`).join(', ')});
// Each one's faces: the way the face looks, and how far it is from the block's middle at the waterline.
const vec4 RKF[${ROCKS.length * ROCK_FACES}] = vec4[${ROCKS.length * ROCK_FACES}](${ROCKS.map((_, i) =>
  rockFaces(i)
    .map((f) => `vec4(${f.map((v) => v.toFixed(4)).join(', ')})`)
    .join(', '),
).join(', ')});
// How much of the pixel the block last met covers (its outline is blended over a pixel), and how near an arris it was met.
float gRockA = 0.0;
float gRockE = 1e3;
// Which block that was, how much of its ice the ray crosses, and the ray.
int gRockI = 0;
float gRockThick = 0.0;
vec3 gRockRd = vec3(0.0, 1.0, 0.0);
/**
 * A ray against the blocks: each a solid cut by flat faces, standing in
 * the water. Returns the distance to the nearest (or -1), and its face's
 * normal there.
 */
float rockHit(vec3 ro, vec3 rd, out vec3 n) {
  float best = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  // Only a short interval around the waterline can contain any of the seven boulders.
  if (abs(rd.z) > 1e-5) {
    const float height = ${Math.ceil(Math.max(...ROCKS.map(r => Math.hypot(r.a, r.h) * 1.08)))}.0;
    float centre = (-FREEBOARD - ro.z) / rd.z;
    vec2 p = ro.xy + rd.xy * centre;
    vec2 pad = abs(rd.xy / rd.z) * height;
    if (centre + height / abs(rd.z) < 0.0 ||
        any(lessThan(p + pad, vec2(${Math.floor(Math.min(...ROCKS.map(r => r.x)))}, ${Math.floor(Math.min(...ROCKS.map(r => r.y)))}) - height)) ||
        any(greaterThan(p - pad, vec2(${Math.ceil(Math.max(...ROCKS.map(r => r.x)))}, ${Math.ceil(Math.max(...ROCKS.map(r => r.y)))}) + height))) return -1.0;
  }
  for (int i = 0; i < ${ROCKS.length}; i++) {
    vec3 o = ro - vec3(RK[i].xy, -FREEBOARD);
    float b = dot(o, rd);
    if (b * b - dot(o, o) + RK[i].z * RK[i].z < 0.0) continue;
    float tN = -1e9;
    float tN2 = -1e9;
    float tF = 1e9;
    vec3 nn = vec3(0.0, 0.0, 1.0);
    vec3 nn2 = nn;
    for (int j = 0; j < ${ROCK_FACES}; j++) {
      vec4 pl = RKF[i * ${ROCK_FACES} + j];
      float den = dot(rd, pl.xyz);
      float num = pl.w - dot(o, pl.xyz);
      if (den < -1e-5) { float t = num / den; if (t > tN) { tN2 = tN; nn2 = nn; tN = t; nn = pl.xyz; } else if (t > tN2) { tN2 = t; nn2 = pl.xyz; } }
      else if (den > 1e-5) tF = min(tF, num / den);
      else if (num < 0.0) tF = -1e9;
    }
    if (tN < tF && tN > 0.0 && tN < best) {
      best = tN;
      gRockA = clamp((tF - tN) / (3.0 * tN * uPxAng), 0.0, 1.0);
      gRockE = tN - tN2;
      gRockI = i;
      gRockThick = tF - tN;
      gRockRd = rd;
      // (An arris is a break, a hair worn: near one the face turns a little toward its neighbour.)
      n = normalize(mix(nn + nn2, nn * 2.0, smoothstep(0.0, 2.5, gRockE)));
    }
  }
  return best < 1e8 ? best : -1.0;
}
/**
 * A block of ice in the pool: a piece of the glacier, the same ice as the
 * seracs and the dam, lying where it grounded, so its strata lie at its own
 * tilt. Snow lies whole on every face level enough to hold it and hangs a
 * hand over the faces below in one clean line; the water has cut a dark wet
 * notch round its foot.
 */
vec3 rockColor(vec3 hp, vec3 n, float t) {
  float px = max(t * uPxAng, 0.02);
  float up = hp.z + FREEBOARD;
  float fi = float(gRockI);
  vec3 o = hp - vec3(RK[gRockI].xy, -FREEBOARD);
  // How far under the nearest face that carries snow this place is.
  float dTop = 1e3;
  for (int j = 5; j < ${ROCK_FACES}; j++) {
    vec4 pl = RKF[gRockI * ${ROCK_FACES} + j];
    if (pl.z > 0.62) dTop = min(dTop, pl.w - dot(o, pl.xyz));
  }
  // (It tipped as it grounded: its strata lie at its own tilt.)
  vec3 axis = normalize(vec3(0.42 * sin(fi * 2.4 + 0.7), 0.42 * cos(fi * 1.7 + 0.2), 1.0));
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  float along = dot(o, tu);
  vec2 q = vec2(along + fi * 91.0, dot(o, axis) * 1.6);
  // (Before dawn the pool lies low between its banks: less of the sky's light reaches a block than a wall that stands in the open.)
  vec3 col = iceGlacier(hp, n, gRockRd, t, q, gRockThick, mix(1.0, 0.62, uNight), 1.0, 0.7, gRockE * 2.0, 3.1 + fi * 1.37);
  bool top = n.z > 0.62;
  // Snow. On a level face it lies whole, in soft low drifts; over the faces below it hangs in one clean line.
  if (top) {
    float lump = 0.22 * sin(o.x * 0.11 + fi * 2.0) * sin(o.y * 0.13 + fi) + 0.1 * sin(o.x * 0.31 - o.y * 0.27);
    col = snowOn(n, lump);
  } else {
    float hang = 3.2 + 1.3 * sin(along * 0.09 + fi * 3.0) + 0.6 * sin(along * 0.23 + fi);
    col = iciclesOn(col, along + fi * 40.0, dTop - hang, px, 7.0);
    col = corniceOn(col, n, dTop - hang, hang * 1.6, px);
  }
  // Where it stands in the water.
  if (!top) col = waterlineOn(col, up, 0.5 + 0.5 * sin(along * 0.07 + fi));
  // Before dawn the table's light reaches the faces turned to it.
  col += sheetGlow() * vec3(0.3, 0.5, 0.6) * 2.2 * exp(-max(sheetEdge(hp.xy), 0.0) / 200.0) * (top ? 0.5 : 1.0) * uNight * uSheetOn;
  return col;
}

#ifdef DBG_POOL0
#define poolAt(p) 0.0
#define poolUnder(pb, pw) 0.0
#endif`;

export const TARN_OBJECT = `// ---- the tarn's two shards of ice, each lit from within
const vec4 SH0 = vec4(${SHARDS[0].x.toFixed(1)}, ${SHARDS[0].y.toFixed(1)}, ${SHARDS[0].h.toFixed(1)}, ${SHARDS[0].r.toFixed(1)});
const vec4 SH1 = vec4(${SHARDS[1].x.toFixed(1)}, ${SHARDS[1].y.toFixed(1)}, ${SHARDS[1].h.toFixed(1)}, ${SHARDS[1].r.toFixed(1)});
// The pulse crosses in three seconds, rests half a second, and comes back.
// x: where it is between the two, 0..1; y, z: how freshly one has landed at each; w: 1 while it is on the water.
vec4 pulseAt() {
  float c = mod(uTime, 7.0);
  float k = c < 3.5 ? clamp(c / 3.0, 0.0, 1.0) : 1.0 - clamp((c - 3.5) / 3.0, 0.0, 1.0);
  // (Between crossings it rests at the foot of the shard it has reached, dimmer: it is never nowhere.)
  float on = c < 3.5 ? mix(0.45, 1.0, step(c, 3.0)) : mix(0.45, 1.0, step(c, 6.5));
  return vec4(k, exp(-mod(c + 0.5, 7.0) * 1.1), c >= 3.0 ? exp(-(c - 3.0) * 1.1) : 0.0, on);
}
/**
 * What the pulse does to the tarn at a place. It skims the water and touches
 * it five times on the way across; each touch leaves a ring that widens and
 * fades behind it, and where it lands one more ring leaves the shard's foot.
 * Returns xy: the slope the rings give the water, z: their light and shade (-1..1).
 */
vec3 pulseRings(vec2 pw) {
  float c = mod(uTime, 7.0);
  bool back = c >= 3.5;
  float tc = back ? c - 3.5 : c;
  vec2 A = back ? SH1.xy : SH0.xy;
  vec2 B = back ? SH0.xy : SH1.xy;
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 6; j++) {
    // (The sixth is the landing, at the far shard's foot.)
    float f = j < 5 ? (float(j) + 0.6) / 5.4 : 1.0;
    float age = tc - 3.0 * f;
    if (age <= 0.0) continue;
    vec2 d = pw - mix(A, B, f);
    float dist = length(d);
    float rad = (j < 5 ? 10.0 : 60.0) + 58.0 * age;
    float wid = 9.0 + 5.0 * age;
    float x = (dist - rad) / wid;
    if (abs(x) > 3.2) continue;
    float amp = exp(-age * (j < 5 ? 0.85 : 0.6)) * (j < 5 ? 1.0 : 1.5);
    // A crest with a trough either side of it.
    float prof = exp(-x * x) * (1.0 - 1.4 * x * x * 0.5);
    float dprof = -x * exp(-x * x) * (3.4 - 1.4 * x * x);
    acc.xy += d / max(dist, 1.0) * dprof / wid * amp;
    acc.z += prof * amp;
  }
  return acc;
}
/** The tarn is still, not glass: the long slow swell that bends what stands in it. The slope it gives the water at a place. */
vec2 tarnSwell(vec2 p) {
  return vec2(sin(p.y * 0.052 + p.x * 0.013 + uTime * 0.5) + 0.6 * sin(p.y * 0.117 - p.x * 0.031 - uTime * 0.72), 0.5 * sin(p.x * 0.043 + p.y * 0.021 + uTime * 0.4)) * 0.0085;
}
// A shard is a piece of the glacier that stands on end: five leaning faces that draw together, two shoulders broken away
// below the point, the point itself snapped off aslant, and a chip or two out of its arrises. A convex solid, cut by planes.
// How far behind the face the ray meets, along the ray, the next face would have been met: small at an arris.
float gShardEdge = 1e3;
float shardHit(vec3 ro, vec3 rd, vec4 s, float turn, out vec3 n, out float tF) {
  float tN = 0.0;
  float tN2 = -1e3;
  tF = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  vec3 o = ro - vec3(s.xy, -FREEBOARD - 6.0);
  // (Most rays pass nowhere near it: a ball that holds all of it is asked first.)
  vec3 oc = o - vec3(0.0, 0.0, s.z * 0.45);
  float bq = dot(oc, rd);
  if (bq * bq - dot(oc, oc) + s.z * s.z * 0.4 < 0.0) return -1.0;
  for (int k = 0; k < 13; k++) {
    vec3 pn = vec3(0.0, 0.0, -1.0);
    float d = 30.0;
    float fk = float(k);
    if (k == 8) {
      // The point, snapped off: one slanting facet where the needle was.
      float a = turn * 3.0 + 1.0;
      pn = normalize(vec3(cos(a) * 0.9, sin(a) * 0.9, 1.0));
      d = pn.z * s.z * 0.8;
    } else if (k > 8) {
      // A chip out of it: a small face of its own, at its own height, looking a little up.
      float ck = fk - 8.0;
      float a = turn * 2.0 + ck * 1.9 + 0.7 * sin(ck * 3.3 + turn * 9.0);
      float z0 = s.z * (0.1 + 0.15 * ck + 0.05 * sin(ck * 5.1 + turn * 4.0));
      float r0 = s.w * (1.0 - z0 / s.z) * 0.8;
      pn = normalize(vec3(cos(a), sin(a), 0.2 + 0.5 * fract(sin(ck * 7.7 + turn * 13.0) * 43.7)));
      d = dot(pn, vec3(cos(a) * r0, sin(a) * r0, z0));
    } else if (k != 5) {
      bool sh = k > 5;
      float a = sh ? turn + 0.63 + (fk - 6.0) * 2.6 : turn + fk * 1.2566 + 0.34 * sin(fk * 2.7 + turn * 5.0);
      float rr = s.w * (sh ? 0.9 + 0.12 * (fk - 6.0) : 0.78 + 0.5 * fract(sin(fk * 12.9 + turn * 7.0) * 43.7));
      float hk = s.z * (sh ? 0.56 + 0.2 * (fk - 6.0) : 0.72 + 0.28 * fract(sin(fk * 5.3 + turn * 3.0) * 91.3));
      float len = sqrt(hk * hk + rr * rr);
      pn = vec3(cos(a) * hk, sin(a) * hk, rr) / len;
      d = rr * hk / len;
    }
    float den = dot(rd, pn);
    float num = d - dot(o, pn);
    if (den < -1e-5) { float t = num / den; if (t > tN) { tN2 = tN; tN = t; n = pn; } else if (t > tN2) tN2 = t; }
    else if (den > 1e-5) tF = min(tF, num / den);
    else if (num < 0.0) return -1.0;
    // Reject empty intervals before testing the broken shoulders and chips.
    if (k == 5 && tN > tF) return -1.0;
  }
  gShardEdge = tN - tN2;
  return tN < tF && tN > 0.0 ? tN : -1.0;
}
/**
 * A shard's ice: the glacier's own, as the block's broken faces, the seracs
 * and the dam are. Strata at its own tilt, fracture planes, melt cups,
 * threads of meltwater; clear, so dark and blue through its thick foot and
 * pale where it is thin, with what stands behind it showing through its
 * edges; snow on the facet where its point broke off, and a wet notch at
 * the water. Its light is in the ice, not on it: a fine thread up its
 * heart that each face bends its own way, and a blue glow in the ice round
 * that, brighter while a pulse rests in it.
 */
vec3 shardColor(vec3 ro, vec3 rd, float t, float tF, vec3 n, vec4 s, float glow) {
  float thick = max(tF - t, 0.0);
  vec3 p = ro + rd * t;
  vec3 hp = p - vec3(s.xy, -FREEBOARD);
  vec3 tu = abs(n.z) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(-n.y, n.x, 0.0));
  float foot = t * uPxAng;
  float faceId = fract(n.x * 7.31 + n.y * 3.17);
  // (Drawn as its image in the water, its fine inner work is not looked for.)
  float soft = gSlabSoft;
  float wasM = gMirror;
  gMirror = soft;
  vec3 axis = normalize(vec3(0.32 * sin(s.x), 0.32 * cos(s.x * 1.3), 1.0));
  float along = dot(hp, tu);
  vec2 q = vec2(along + faceId * 170.0, dot(hp, axis));
  vec3 col = iceGlacier(p, n, rd, t, q, thick, 1.0, 1.0, 0.8, gShardEdge * 1.6, s.x * 0.013 + floor(faceId * 3.0));
  gMirror = wasM;
  bool top = n.z > 0.62;
  // Snow on what looks up; under its edge a hand of it hangs over the face below.
  if (top) col = snowOn(n, 0.2 * sin(hp.x * 0.13 + s.x) * sin(hp.y * 0.11));
  // The light inside. The ray's nearest approach to the heart's line says how much of the glow it crosses.
  vec3 mp = ro + rd * (t + tF) * 0.5 - vec3(s.xy, -FREEBOARD);
  float up = clamp(mp.z / s.z, 0.0, 1.0);
  float rise = smoothstep(-0.04, 0.1, mp.z / s.z) * (1.0 - smoothstep(0.34, 0.6, up));
  // (Each face bends the thread a little its own way: it wavers as it climbs, and is never a ruled tube.)
  vec2 bent = mp.xy + (tu.xy * (faceId - 0.5) * 0.12 + n.xy * 0.05 * sin(mp.z * 0.045 + faceId * 9.0)) * s.w;
  float axisD = length(bent) / s.w;
  float axis0 = length(mp.xy) / s.w;
  // (It is not even: brighter lengths climb it slowly.)
  float lengths = 0.7 + 0.3 * smoothstep(0.25, 0.75, n1(mp.z / 23.0 - uTime * 0.35 + s.x));
  float thread = exp(-axisD * axisD / 0.004) * rise * lengths * (1.0 - 0.8 * soft);
  // (Before dawn the glow keeps close to the thread: it lights the ice near it, and the rest of the shard is the night's.)
  float halo = exp(-axis0 / mix(0.34, 0.2, uNight)) * rise;
  float lamp = glow * mix(0.9, 1.0, uNight);
  if (!top) col += (vec3(0.6, 0.95, 1.0) * thread * mix(0.5, 0.42, uNight) + vec3(0.2, 0.72, 0.95) * halo * mix(0.3, 0.55, uNight)) * lamp;
  // Where it stands in the water.
  if (!top) col = waterlineOn(col, hp.z, 0.5 + 0.5 * sin(along * 0.07 + s.x));
  // (Its image in the water is the water's: darker than the ice that throws it, and bluer.)
  if (soft > 0.5) col *= mix(vec3(0.58, 0.72, 0.84), vec3(0.7, 0.8, 0.9), uNight);
  // (Seen from far off it stands in the valley's air, as the land round it does.)
  vec3 air = airAt(rd.xy);
  return mix(col, mix(air, mix(S.hor, air, 0.45), uNight), (airLoss(t)) * (1.0 - soft));
}`;
