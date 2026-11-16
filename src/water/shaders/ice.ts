/**
 * The frozen lake, as one field that both the simulation and the shading
 * pass read, so the water moves exactly where the picture shows open water.
 *
 * The lake is covered by one sheet of ice. The name is cut through it: the
 * letters are openings. As the page scrolls the sheet melts: the openings
 * grow from their edges, leads of water open along the pressure cracks, the
 * sheet lets go of the banks, and what is left is a few large floes that
 * shrink, round off and gather toward the lake's outlet until none is left.
 * Every term is a function of the melt alone, so it reverses exactly.
 *
 * Needs: uIce, uIceA, uIceB, uIceC, uIceK, uIceL, uIceW, uIceBox, uLake, uIceSdf, uDetail, uSnow, and
 * the bed (uBedA, bedUv) declared before this block.
 */
export const ICE_FIELD = `
uniform vec4 uIce;         // the name's raster in world px: x, y, w, h (w = 0: no ice left)
uniform vec4 uIceA;        // x: how far the opening has grown px, y: lead width as a share of a floe, z: melt 0..1, w: gap at the bank px
uniform vec4 uIceB;        // xy: the lake's outlet, z: how far the floes have gathered toward it (1 = not at all), w: floe size px
uniform vec4 uIceC;        // x: the lead along the north shore px, y: 0..1 the floes have become islands, z: 0..1 the letters have run together into one pool, w: how uneven that pool's edge is px
uniform vec4 uIceL;        // the floes' lattice: x: a cell's height over its width, y: how far a floe may sit off its row, in cells, zw: its phase, so a row of floes lies in the open band between the north shore and the name
uniform float uIceK;       // the pressure cracks' cell px
uniform float uIceW;       // the lake's width px: the page's
uniform vec4 uIceBox;      // the letters' own box in the sheet's frame: centre xy, half size zw, px
uniform vec4 uIceP;        // the camera the name is cut for: its y, its height, the cosine and sine of its pitch (all 0: the name lies flat and true)
uniform float uIceLean;    // the flight's governor: at 2 the cracks are let go while they are only hairlines (0 everywhere else)
uniform vec4 uLake;        // x: lake top, y: lake bottom, z: how wet the sheet is 0..1, w: 1 while the sheet is whole, 0 once it is gone
uniform sampler2D uIceSdf; // signed distance to the letters px (negative inside), _, gradient
uniform sampler2D uDetail;
uniform sampler2D uSnow;   // three draws of one smooth field, in half floats: about -0.7..0.7

vec2 ih2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

/**
 * A union of two stretches of open water whose meeting is a curve of radius
 * about k, not a corner: where a lead runs into the pool, or two leads meet,
 * the ice between them ends in a round, as melting ice does.
 */
float smax(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

/**
 * Where a floe's middle lies in its cell of the lattice. Rows are offset
 * against each other and no floe sits square in its cell, so the floes
 * never read as a grid.
 */
vec2 icePt(vec2 c) {
  vec2 h = ih2(c);
  return vec2(0.25 + 0.5 * mod(c.y, 2.0) + 0.3 * (h.x - 0.5), 0.5 + uIceL.y * (h.y - 0.5));
}

/** Distance to the one rounded pool the letters run together into. */
float poolSd(vec2 q) {
  float r = min(uIceBox.z, uIceBox.w) * 0.92;
  vec2 d = abs(q - uIceBox.xy) - uIceBox.zw + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

/**
 * The plate the name stands in: the letters' box with room round it and
 * round corners. No crack and no lead comes inside it while the name is
 * there to be read. x: distance to its edge px (negative inside), yz: which
 * way that distance grows.
 */
vec3 plateSd(vec2 q) {
  vec2 v = q - uIceBox.xy;
  float r = min(uIceBox.z, uIceBox.w) * 0.9;
  vec2 d = abs(v) - uIceBox.zw - min(uIceBox.w * 0.55, 36.0) + r;
  vec2 sg = vec2(v.x < 0.0 ? -1.0 : 1.0, v.y < 0.0 ? -1.0 : 1.0);
  vec2 g = max(d.x, d.y) > 0.0 ? normalize(max(d, 0.0)) * sg : (d.x > d.y ? vec2(sg.x, 0.0) : vec2(0.0, sg.y));
  return vec3(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r, g);
}

/**
 * Signed distance, in world px, to the edge of the ice at a world point:
 * negative on ice, positive over open water.
 * shore: the bed's distance field there (negative in water).
 * cr: x distance to the nearest pressure crack px, y a random number for
 * the floe, z distance to the floe's middle px.
 * il: the point in the sheet's own frame, for its surface.
 */
float iceF(vec2 w, float shore, out vec3 cr, out vec2 il) {
  // The sheet's own frame: it rides with the name, and late in the melt
  // everything in it gathers toward the outlet.
  vec2 u = uIceB.xy + (w - uIceB.xy) * uIceB.z;
  il = u - uIce.xy;
  // Lettering painted on a road is drawn for one eye. Where that eye is
  // given, each point of the ice is looked up where that camera sees it,
  // so from there the name stands square-on and true.
  vec2 nl = il;
  float nk = 1.0;
  if (uIceP.y > 0.0) {
    vec2 mid = uIce.xy + uIce.zw * 0.5;
    float dy0 = mid.y - uIceP.x;
    float z0 = dy0 * uIceP.z + uIceP.y * uIceP.w;
    float dy = u.y - uIceP.x;
    float zc = max(dy * uIceP.z + uIceP.y * uIceP.w, 1.0);
    nl = uIce.zw * 0.5 + vec2((u.x - mid.x) * z0 / zc, ((dy * uIceP.w - uIceP.y * uIceP.z) / zc - (dy0 * uIceP.w - uIceP.y * uIceP.z) / z0) * z0 * z0 / uIceP.y);
    nk = zc / z0;
  }
  vec2 iuv = nl / uIce.zw;
  // The raster's distances stop at a ceiling; past it the distance to the
  // letters' own box carries on, so no opening ever ends on the raster's edge.
  vec2 bq = abs(nl - uIceBox.xy) - uIceBox.zw;
  float boxD = length(max(bq, 0.0)) + min(max(bq.x, bq.y), 0.0);
  float lsd = boxD;
  // (Seen from the ground most of the lake is far from the name: there the
  // box's distance is the whole answer and the raster is not read.)
  bool nearName = uIceP.y <= 0.0 || boxD < 420.0;
  if (nearName) {
    vec2 cl = clamp(iuv, 0.002, 0.998);
    lsd = (texture(uIceSdf, cl).r + length((iuv - cl) * uIce.zw)) * nk;
    if (lsd > 0.0) lsd = max(lsd, boxD);
  }
  float cell = uIceB.w;
  // Half way through, the letters stop being letters: their openings run
  // together into one pool with an uneven, rounded edge. Nothing of their
  // outlines is left to notch the floes around them.
  float open = lsd;
  if (uIceC.z > 0.0) {
    float pn = textureLod(uDetail, il / (cell * 0.9) + 0.17, 0.0).r - 0.5
             + 0.5 * (textureLod(uDetail, il / (cell * 0.31) + 0.58, 0.0).g - 0.5);
    open = mix(lsd, poolSd(il) + pn * uIceC.w, uIceC.z);
  }
  float f = uIceA.x - open;

  // Pressure cracks: the walls of a few large, irregular cells. Early in the
  // melt they are where leads of water open.
  float cellA = uIceK;
  cr = vec3(1e3, 0.5, 0.0);
  // (Seen from the ground: once the sheet is plates no crack is left to
  // draw or to open, and a lean frame lets the hairlines go before the melt
  // needs them. Then the cells are not looked for at all.)
  bool cracks = uIceP.y <= 0.0 || (uIceC.y < 1.0 && !(uIceLean >= 2.0 && uIceA.y <= 0.0));
  if (cracks) {
  vec2 wob = textureLod(uSnow, il / (cellA * 5.0), 0.0).rg * cellA * 0.12;
  vec2 x = (il + wob) / cellA + vec2(3.37, 1.83);
  vec2 n = floor(x);
  vec2 fr = fract(x);
  vec2 pts[9];
  // (Only cells within reach of the name's plate can be claimed by it.)
  vec2 pq = abs(il - uIceBox.xy) - uIceBox.zw;
  bool nearPlate = uIceP.y <= 0.0 || max(pq.x, pq.y) < cellA * 2.6 + 40.0;
  float md = 64.0;
  vec2 mr = vec2(0.0);
  vec2 mg = vec2(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      vec2 g = vec2(float(i - 1), float(j - 1));
      vec2 r = g + 0.14 + 0.72 * ih2(n + g) - fr;
      // A cell whose middle would lie in or by the name's plate is not
      // there: the plate has that ground.
      if (nearPlate && plateSd(il + r * cellA).x < cellA * 0.12) r = vec2(40.0);
      pts[j * 3 + i] = r;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  float bd = 8.0;
  for (int k = 0; k < 9; k++) {
    vec2 dr = pts[k] - mr;
    if (dot(dr, dr) > 1e-5) bd = min(bd, dot(0.5 * (mr + pts[k]), normalize(dr)));
  }
  cr = vec3(bd * cellA, ih2(n + mg + 7.7).x, 0.0);
  // The name's plate is one more cell among them, and it is the name's own:
  // every point nearer the plate than any cell's middle belongs to it. So
  // the cracks, and the leads that open along them, run round the name and
  // never through a letter or between two.
  if (nearPlate) {
    vec3 pl = plateSd(il);
    float d1 = sqrt(md) * cellA;
    float turnK = max(length(-mr / max(sqrt(md), 1e-3) - pl.yz), 0.35);
    if (pl.x < d1) cr = vec3((d1 - pl.x) / turnK, 0.3, 0.0);
    else cr.x = min(cr.x, (pl.x - d1) / turnK);
  }

  }

  // The bank lets go unevenly: more here, less there.
  // (Looked up only where the sheet has a bank to let go of.)
  float north = 1.0 - smoothstep(70.0, 150.0, w.y - uLake.x);
  float along = 0.5;
  if (uIceA.w > 0.0 || north > 0.0) {
    along = 0.5 * textureLod(uDetail, vec2(w.x / 760.0, 0.37), 0.0).r + 0.5 * textureLod(uDetail, vec2(w.x / 210.0, 0.71), 0.0).r;
  }
  float gap = uIceA.w * (0.5 + along);

  if (uIceA.y > 0.0) {
    float kS = cell * 0.07 * smoothstep(0.25, 0.6, uIceA.z) + 0.01;
    // Leads open unevenly along a crack, as they do. Across the name they
    // stay hairlines. Once the sheet is islands there are no leads: all the
    // water between the floes is open.
    float un = clamp(0.5 + 0.8 * textureLod(uSnow, il / (cellA * 1.4) + 0.31, 0.0).b, 0.0, 1.0);
    float clearOf = smoothstep(8.0, 130.0, lsd);
    f = smax(f, cellA * uIceA.y * (0.45 + 1.1 * un) * clearOf * (1.0 - uIceC.y) - cr.x, kS);
  }
  if (uIceC.y > 0.0) {
    // What is left is floes: whole rounded islands, one to a cell of a
    // lattice laid out for this lake, each measured from its own middle.
    vec2 asp = vec2(1.0, uIceL.x);
    vec2 wobL = (textureLod(uDetail, il / (cell * 5.0), 0.0).gb - 0.5) * cell * 0.1;
    vec2 y = (il + wobL + (textureLod(uDetail, il / (cell * 1.3) + 0.43, 0.0).gb - 0.5) * cell * 0.09) / (cell * asp) + uIceL.zw;
    vec2 m = floor(y);
    vec2 fy = fract(y);
    float d1 = 64.0;
    vec2 c1 = vec2(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 3; i++) {
        vec2 g = vec2(float(i - 1), float(j - 1));
        vec2 r = (g + icePt(m + g) - fy) * asp;
        float d = dot(r, r);
        if (d < d1) { d1 = d; c1 = m + g; }
      }
    }
    // The largest round that surely fits in this cell about its middle.
    float inr = 8.0;
    float edge = 8.0;
    vec2 p1 = icePt(c1);
    vec2 at = (y - c1 - p1) * asp;
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 3; i++) {
        vec2 g = vec2(float(i - 1), float(j - 1));
        if (i != 1 || j != 1) {
          vec2 rg = (g + icePt(c1 + g) - p1) * asp;
          float lg = length(rg);
          inr = min(inr, 0.5 * lg);
          // (How far inside its own cell of the lattice the point lies: the plate's straight sides.)
          edge = min(edge, 0.5 * lg - dot(at, rg) / lg);
        }
      }
    }
    vec2 site = (c1 + p1 - uIceL.zw) * cell * asp;
    site -= (textureLod(uDetail, site / (cell * 5.0), 0.0).gb - 0.5) * cell * 0.1;
    // Its rim keeps clear of the bank, of the lake's south end, of the side
    // of the page, of the pool and of its neighbours, so none of them can
    // ever cut it along a line: a floe is a whole island or it is not there.
    vec2 ws = uIceB.xy + (site + uIce.xy - uIceB.xy) / uIceB.z;
    float bank = min(-textureLod(uBedA, bedUv(ws), 0.0).r, uLake.y - ws.y) - uIceA.w * 1.6 - 8.0;
    // (A lake wider than the frame has no side to keep clear of.)
    if (uIceP.y <= 0.0) bank = min(bank, min(ws.x, uIceW - ws.x) - 10.0);
    float pool = poolSd(site) - uIceA.x - 0.8 * uIceC.w - 12.0;
    float room = cell * inr - 4.0;
    // No two are one size.
    float fit = (min(min(bank * uIceB.z, pool), room) - cell * 0.035) * (0.66 + 0.34 * ih2(c1 + 3.1).y);
    // A floe melts from its rim inward: slowly, then all at once. All of
    // them lose the same share of themselves, so they go in order of size,
    // the largest last.
    float s = clamp((uIceA.z - 0.6) / 0.27, 0.0, 1.0);
    float R = mix(cell * 1.3, fit, uIceC.y) * sqrt(1.0 - s * s);
    // The last of a floe is still a large rounded piece: below that size it
    // goes at once, so no small piece is ever left on the water.
    // (The size is the one seen: the gathering draws everything smaller.)
    float small = cell * 0.18 * uIceB.z;
    R *= step(small, R);
    float rim = (textureLod(uDetail, il / (cell * 0.7) + 0.6, 0.0).r - 0.5) * cell * 0.07 * min(1.0, R / (cell * 0.3));
    float fl = sqrt(d1) * cell + rim - R;
    // Seen from the ground the sheet breaks as lake ice does, into angular
    // plates: each is its cell of the lattice with straight sides, drawn in
    // from them by as much as the round floe would have lost.
    if (uIceP.y > 0.0) fl = max(cell * inr - R, cell * 0.035) - edge * cell + rim * 0.35;
    f = smax(f, fl + step(R, 1.0) * 1e3, cell * (uIceP.y > 0.0 ? 0.02 : 0.07));
  }
  f /= uIceB.z;
  // The bank, with a lead of open water along the north shore, and the
  // lake's south end, where the stream leaves.
  f = max(f, shore + gap + uIceC.x * (0.35 + 1.3 * along) * north);
  f = max(f, w.y - uLake.y + gap);
  return f;
}
`;
