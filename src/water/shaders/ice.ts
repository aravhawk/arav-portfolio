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
 * Needs: uIce, uIceA, uIceB, uIceC, uIceK, uIceL, uIceN, uIceW, uIceBox, uLake, uIceSdf, uDetail, uSnow, and
 * the bed (uBedA, bedUv) declared before this block.
 */
export const CELL_HASH = `vec2 ih2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}`;

/** The snow bake stores exact crack-neighbour indices in its spare half-float channel. */
export const CRACK_GRID = `
const float CRACK_SUB = 16.0;
const vec2 CRACK_ORIGIN = vec2(-12.0);
vec2 cellOffset(int k) { return vec2(k % 3 - 1, k / 3 - 1); }
vec2 crackSite(vec2 cell, vec2 offset) {
  return offset + (0.5 - 0.5 * 0.94) + 0.94 * ih2(cell + offset);
}
`;

export const ICE_FIELD = `
uniform vec4 uIce;         // the name's raster in world px: x, y, w, h (w = 0: no ice left)
uniform vec4 uIceA;        // x: how far the opening has grown px, y: lead width as a share of a floe, z: melt 0..1, w: gap at the bank px
uniform vec4 uIceB;        // xy: the lake's outlet, z: how far the floes have gathered toward it (1 = not at all), w: floe size px
uniform vec4 uIceC;        // x: the lead along the north shore px, y: 0..1 the floes have become islands, z: 0..1 the letters have run together into one pool, w: how uneven that pool's edge is px
uniform vec4 uIceL;        // the floes' lattice: x: a cell's height over its width, y: how far a floe may sit off its row, in cells, zw: its phase, so a row of floes lies in the open band between the north shore and the name
uniform float uIceK;       // the pressure cracks' cell px
uniform float uIceW;       // the lake's width px: the page's
uniform vec4 uIceBox;      // the letters' own box in the sheet's frame: centre xy, half size zw, px
uniform vec4 uIceP;        // the camera the name's blocks are laid for: its y, its height, the cosine and sine of its pitch (all 0: the page's own sheet, seen from above, with the name cut through it)
uniform float uIceLean;    // the flight's governor: at 2 the cracks are let go while they are only hairlines (0 everywhere else)
uniform vec4 uIceN;        // the name as a melt pond (the flight): x: half its broadest stroke px, y: 0..1 how much of a pond it still is, z: how far each letter's pond has spread past its outline px, w: the even growth the page's pool would add px (left out here)
uniform vec4 uLake;        // x: lake top, y: lake bottom, z: how wet the sheet is 0..1, w: 1 while the sheet is whole, 0 once it is gone
uniform vec4 uNameG;       // the standing name. x: the line on the lake the far row's faces stand on (world y), y: the near row's (the same when there is one row), z: 1 when there are two rows (far below 0 when there is one), w: 1 when the letters stand on the sheet as plates (0: they are cut through it)
uniform vec4 uNameB;       // xy: where the lead that carries the lake's water off leaves the name (y behind the far row, x), z: the near row's capitals' height, w: a plate's depth front to back
uniform vec4 uNameM;       // x: how high the tallest plate stands, y: a plate's depth, z: 1 once anything of a plate can stand under the water, w: 0..1 how much of the name still stands, of all eight plates
uniform vec4 uNameV;       // the name's box in the first camera's picture, as tangents: x: the height of its middle, y: its half width, z: its half height
uniform vec4 uRowA;        // the far row as a strip of the lake: xy its middle, zw its half size (across, and front to back)
uniform vec4 uRowB;        // the near row (the same strip when there is one row)
#define PLATES 8
uniform vec4 uLtF[PLATES]; // each plate's footing on the lake, standing or afloat: xy its middle, zw its half size (across, and front to back)
uniform vec4 uLtR[PLATES]; // xy: the cosine and sine of its turn on the lake, z: how far the sheet has opened round its footing px (negative: whole), w: 1 while it stands, 0 once it lies afloat
uniform float uNameS;      // how far the water the standing letters stand in has spread from their feet px (0: not at all)
uniform vec3 uNameW;       // where the first frame's words stand, in the frame: x: the right end of the left block, y: the left end of the right one (both 1 when they are stacked), z: how far up the frame their top is
uniform float uNameT;      // the tangent of half the first camera's field of view: where a place on the lake stood in the first frame
uniform vec2 uNameL;       // the lead that water leaves by, from the name down the lake to the outlet. x: 0..1 how far down the lake it has opened, y: its width px
uniform sampler2D uIceSdf; // signed distance to the letters px (negative inside), _, gradient
uniform sampler2D uDetail;
uniform sampler2D uSnow;   // three draws of one smooth field, in half floats: about -0.7..0.7

// How far the last place asked about lies from the letters' own box, in the name's frame px (the first camera's picture).
float gIceBoxD = 1e4;
// The last place on the lake the field asked how far the standing letters' feet are, and the answer (nameFoot): the
// name's own shader asks the same of the same place, and takes it from here.
vec2 gFootAt = vec2(-1e9);
float gFootD = 1e3;
// How far inside the water that has opened round a plate the last place asked about lies (negative: on ice), and how
// far it lies from the nearest pressure crack: the name's own shader draws the sheet's fractures on its swept ice.
float gFootOpen = -1e3;
float gIceCr = 1e3;

#ifndef NO_ICE_FIELD
${CELL_HASH}
${CRACK_GRID}

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

/**
 * How far a place on the lake is from the nearest plate's footing (negative
 * under one): standing, the strip its foot covers; afloat, the plate itself.
 * Meltwater gathers from here, and the sheet opens from here (gFootOpen):
 * round each plate at its own moment, and with it wherever it rides.
 */
float nameFoot(vec2 u) {
  float d = 1e4;
  float op = -1e4;
  for (int i = 0; i < PLATES; i++) {
    vec4 f = uLtF[i];
    vec4 r = uLtR[i];
    vec2 q = u - f.xy;
    q = abs(vec2(q.x * r.x + q.y * r.y, q.y * r.x - q.x * r.y)) - f.zw;
    float di = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    d = min(d, di);
    // (Under a plate the sheet is as whole as at its edge: the water opens round a footing, not from its middle.)
    op = max(op, r.z - max(di, 0.0));
  }
  gFootOpen = op;
  return d;
}

/** How far a place on the lake is from the strips the name's rows stand on (negative on one). */
float nameRows(vec2 u) {
  vec2 a = abs(u - uRowA.xy) - uRowA.zw;
  vec2 b = abs(u - uRowB.xy) - uRowB.zw;
  return min(length(max(a, 0.0)) + min(max(a.x, a.y), 0.0), length(max(b, 0.0)) + min(max(b.x, b.y), 0.0));
}

/**
 * Where a place on the lake stands in the first camera's picture of the
 * name. x: across it, -1 and 1 at the letters' two sides; y: up it, -1 at
 * the near row's feet and 1 at the far row's tops.
 */
vec2 nameSeat(vec2 u) {
  float dyc = u.y - uIceP.x;
  float zc = max(dyc * uIceP.z + uIceP.y * uIceP.w, 1.0);
  float tv = (dyc * uIceP.w - uIceP.y * uIceP.z) / zc;
  return vec2((u.x - uIce.x - uIce.z * 0.5) / zc / max(uNameV.y, 1e-5), (tv - uNameV.x) / max(uNameV.z, 1e-5));
}

/**
 * The stretch of the lake the name stands on: the wind has swept it clear
 * of snow, so it is bare black ice, and it is the thinnest ice on the lake.
 * Broad, wider than the name, it runs from behind the letters toward the
 * eye and stops short of the first frame's words. Returns how far out a
 * place is: 0 at the field's heart, 1 at its edge, more beyond.
 * il: the place in the sheet's own frame.
 */
float nameSwept(vec2 u) {
  vec2 s = nameSeat(u);
  // (Most of the lake is nowhere near it: that is settled before anything is read.)
  if (abs(s.x) > 5.2 || s.y > 5.4 || s.y < -6.6) return 9.0;
  // (Two rows stand taller in the picture than one: the field is measured in the name's own heights, and keeps the same reach.)
  bool two = uNameG.z > 0.0;
  float up = two ? 1.5 : 2.45;
  // (Toward the eye it runs on until the first frame's words stop it: see the name's own shader.)
  float dn = two ? 1.6 : 2.6;
  float y = s.y - 0.1;
  vec2 e = vec2(s.x / (two ? 2.4 : 2.5), y / (y > 0.0 ? up : dn));
  // (Squarer than a round: its long sides run with the wind.)
  vec2 e2 = e * e;
  float d = sqrt(sqrt(e2.x * e2.x + e2.y * e2.y) * 0.4 + 0.6 * (e2.x + e2.y));
  // (No ruled outline: it bulges and narrows as the wind has left it.)
  return d * (0.96 + 0.16 * textureLod(uSnow, (u - uIce.xy) / vec2(4300.0, 2900.0) + 0.27, 0.0).r) + 0.08 * textureLod(uSnow, (u - uIce.xy) / vec2(1900.0, 800.0) + 0.6, 0.0).g;
}

/**
 * How far above the first frame's words a place on the lake stood in the
 * first frame, as a share of the frame's height (negative under them). While
 * a line of those words still stands, the ice under it stays whole: no lead
 * opens there and the name's water stops short of it.
 */
float wordsClear(vec2 u) {
  float dyc = u.y - uIceP.x;
  float zc = max(dyc * uIceP.z + uIceP.y * uIceP.w, 1.0);
  return 0.5 + 0.5 * (dyc * uIceP.w - uIceP.y * uIceP.z) / zc / max(uNameT, 0.05) - uNameW.z;
}

#endif
/**
 * The lead the name's meltwater leaves by: one long wandering fracture from
 * behind the letters down the lake to the outlet, which the water finds and
 * widens. x: where its middle lies at a place down the lake (the sheet's own
 * frame), y: how far along it that is (0 behind the name, 1 at the outlet).
 */
vec2 leadAt(float y) {
  float y0 = uNameB.x;
  float t = clamp((y - y0) / max(uLake.y - y0, 1.0), 0.0, 1.0);
  // (It leaves between the two words where they stand side by side.)
  float x0 = uNameB.y;
  float x = mix(x0, uIceB.x, t * t * (3.0 - 2.0 * t));
  x += (150.0 * sin(t * 6.1 + 0.8) + 56.0 * sin(t * 17.0 + 2.3) + 20.0 * sin(t * 43.0 + 1.1)) * smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.86, 1.0, t));
  return vec2(x, t);
}

#ifndef NO_ICE_FIELD
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
  // (Where the letters stand on the sheet as blocks nothing is cut through it for one eye: the raster lies flat and true.)
  vec2 nl = il;
  float nk = 1.0;
  vec2 iuv = nl / uIce.zw;
  // The raster's distances stop at a ceiling; past it the distance to the
  // letters' own box carries on, so no opening ever ends on the raster's edge.
  vec2 bq = abs(nl - uIceBox.xy) - uIceBox.zw;
  float boxD = length(max(bq, 0.0)) + min(max(bq.x, bq.y), 0.0);
  gIceBoxD = boxD;
  float lsd = boxD;
  // (Seen from the ground most of the lake is far from the name: there the
  // box's distance is the whole answer and the raster is not read.)
  bool nearName = uIceP.y <= 0.0 || boxD < 420.0;
  float rowD = boxD;
  if (uNameG.w > 0.5) {
    // The plates stand on the sheet: it opens from under each one's foot, and then under the rows.
    // (Asked of the place on the lake itself, not of the sheet's own frame: late in the melt the sheet gathers toward
    // the outlet, and the plates and the water they ride in do not gather with it.)
    lsd = nameFoot(w);
    rowD = nameRows(w);
    // (The first place asked of a pixel is the pixel's own: that answer is the one kept.)
    if (gFootAt.x < -1e8) { gFootAt = w; gFootD = lsd; }
    gIceBoxD = min(boxD, rowD);
  } else if (nearName) {
    vec2 cl = clamp(iuv, 0.002, 0.998);
    lsd = (texture(uIceSdf, cl).r + length((iuv - cl) * uIce.zw)) * nk;
    if (lsd > 0.0) lsd = max(lsd, boxD);
  }
  float cell = uIceB.w;
  // Half way through, the letters stop being letters: their openings run
  // together into one pool with an uneven, rounded edge. Nothing of their
  // outlines is left to notch the floes around them.
  // (Under a row itself the sheet is as whole as beside it: the water opens round the rows, not along their middle.)
  float open = uNameG.w > 0.5 ? max(rowD, 0.0) : lsd;
  if (uNameG.w > 0.5) {
    // (The water under the rows is not ruled either: it has gone further here than there.)
    open += 26.0 * textureLod(uSnow, il / vec2(520.0, 300.0) + 0.23, 0.0).r;
  } else if (uIceP.y > 0.0) {
    // Seen from the ground the letters are melt ponds, and a pond does not
    // spread evenly: it eats the ice quickly here and slowly there. So each
    // letter's pond widens at its own pace, the bridges of ice between two
    // letters thin and break one after another, and the opening they make
    // together has no ruled side anywhere.
    if (uIceN.z > 0.0) {
      float un = textureLod(uSnow, il / vec2(760.0, 1650.0) + 0.23, 0.0).r + 0.4 * textureLod(uSnow, il / vec2(420.0, 900.0) + 0.61, 0.0).g;
      open = lsd - uIceN.z * clamp(0.8 + 3.4 * un, 0.05, 2.4) + uIceN.w;
    }
  } else if (uIceC.z > 0.0) {
    float pn = textureLod(uDetail, il / (cell * 0.9) + 0.17, 0.0).r - 0.5
             + 0.5 * (textureLod(uDetail, il / (cell * 0.31) + 0.58, 0.0).g - 0.5);
    float wide = uIceC.w;
    if (uNameG.w > 0.5) {
      // (The pool the standing letters leave is not a ruled lozenge: the sheet has gone further in some places than others.)
      pn += 1.5 * (textureLod(uDetail, il / (cell * 2.3) + 0.71, 0.0).b - 0.5);
      wide *= 1.7;
    }
    open = mix(lsd, poolSd(il) + pn * wide, uIceC.z);
  }
  float f = uIceA.x - open;
  if (uNameG.w > 0.5) {
    // Round each plate the sheet goes at that plate's own moment: a hole it founders into, and room to ride in after.
    // (Its shore wanders: the ice has gone further here than there.)
    if (gFootOpen > -70.0) f = max(f, gFootOpen + (14.0 + 0.16 * max(gFootOpen, 0.0)) * textureLod(uSnow, il / vec2(260.0, 190.0) + 0.61, 0.0).g);
    // (The water that opens from the standing letters' feet stops short of the first frame's words while a line of them stands.)
    if (uIceP.y > 0.0) f = min(f, mix((wordsClear(u) - 0.026) * 2600.0, 1e4, smoothstep(0.57, 0.66, uIceA.z)));
  }

  // Pressure cracks: the walls of a few large, irregular cells. Early in the
  // melt they are where leads of water open.
  float cellA = uIceK;
  cr = vec3(1e3, 0.5, 0.0);
  // (Seen from the ground: once the sheet is plates no crack is left to
  // draw or to open, and a lean frame lets the hairlines go before the melt
  // needs them. Then the cells are not looked for at all.)
  // (Seen from the ground the fractures are the whole of the break-up: the
  // plates the sheet becomes are the pieces between them, to the last one.)
  bool cracks = uIceP.y <= 0.0 || !(uIceLean >= 2.0 && uIceA.y <= 0.0);
  if (cracks) {
  vec2 wob = textureLod(uSnow, il / (cellA * 5.0), 0.0).rg * cellA * 0.12;
  // (Seen from the ground the sheet breaks as lake ice does: the field the
  // cells are found in is bent, broadly and then finely, so each fracture
  // wanders and the plates between them are of very different sizes.)
  float jit = 0.72;
  if (uIceP.y > 0.0) {
    vec2 q = il / cellA;
    wob += cellA * (0.5 * vec2(sin(q.y * 1.13 + 0.7) + 0.6 * sin(q.x * 0.71 + q.y * 0.4 + 2.1), sin(q.x * 0.93 + 1.9) + 0.6 * sin(q.y * 0.63 - q.x * 0.5 + 0.3))
         + 0.075 * vec2(sin(q.y * 5.3 + q.x * 2.1 + 1.0) + sin(q.y * 9.7 + 0.4) * 0.5, sin(q.x * 4.7 - q.y * 1.9 + 2.6) + sin(q.x * 11.3 + 1.7) * 0.5));
    jit = 0.94;
  }
  vec2 x = (il + wob) / cellA + vec2(3.37, 1.83);
  vec2 n = floor(x);
  vec2 fr = fract(x);
  vec2 pts[9];
  // (Only cells within reach of the name's plate can be claimed by it.)
  vec2 pq = abs(il - uIceBox.xy) - uIceBox.zw;
  // (Where the name stands as plates there is no such plate: the sheet's fractures run where they will, under the
  // letters too, and only stay hairlines there until the plates have gone.)
  bool nearPlate = uNameG.w < 0.5 && (uIceP.y <= 0.0 || max(pq.x, pq.y) < cellA * 2.6 + 40.0);
  float md = 64.0;
  vec2 mr = vec2(0.0), mg = vec2(0.0);
  float bd = 8.0;
  ivec2 grid = ivec2(floor((x - CRACK_ORIGIN) * CRACK_SUB));
  int pair = 0;
  if (!nearPlate && jit == 0.94 && all(greaterThanEqual(grid, ivec2(0))) && all(lessThan(grid, textureSize(uSnow, 0))))
    pair = int(texelFetch(uSnow, grid, 0).a);
  if (pair > 0) {
    // Across this entire subcell the same two sites define the nearest edge.
    // Evaluate their true bisector at x, including the wandering of the cracks.
    mg = cellOffset((pair - 1) / 9);
    mr = crackSite(n, mg) - fr;
    vec2 other = crackSite(n, cellOffset((pair - 1) % 9)) - fr;
    bd = dot(0.5 * (mr + other), normalize(other - mr));
  } else {
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 3; i++) {
        vec2 g = vec2(float(i - 1), float(j - 1));
        vec2 r = g + 0.5 - 0.5 * jit + jit * ih2(n + g) - fr;
        // A cell whose middle would lie in or by the name's plate is not
        // there: the plate has that ground.
        if (nearPlate && plateSd(il + r * cellA).x < cellA * 0.12) r = vec2(40.0);
        pts[j * 3 + i] = r;
        float d = dot(r, r);
        if (d < md) { md = d; mr = r; mg = g; }
      }
    }
    for (int k = 0; k < 9; k++) {
      vec2 dr = pts[k] - mr;
      if (dot(dr, dr) > 1e-5) bd = min(bd, dot(0.5 * (mr + pts[k]), normalize(dr)));
    }
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
  gIceCr = cr.x;

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
    float lead = cellA * uIceA.y * (0.45 + 1.1 * un) * clearOf;
    if (uIceP.y > 0.0) {
      // Seen from the ground the sheet goes as lake ice goes. The leads
      // along its fractures keep widening, so the pieces between them come
      // apart as angular plates of whatever size and shape the fractures
      // left; each melts back from its edges at its own rate, so some are
      // gone while their neighbours still ride, and the last few are the
      // largest. (They gather toward the outlet with the sheet's frame.)
      float g = smoothstep(0.5, 0.9, uIceA.z);
      // (The big plates ride on almost to the end: there is ice afloat in every frame until the last sweep.)
      lead += cellA * (g * g * (0.06 + 0.52 * cr.y * cr.y) + 1.5 * smoothstep(0.84, 0.9, uIceA.z) * smoothstep(0.84, 0.9, uIceA.z));
      // (A melting edge is not ruled.)
      lead += (textureLod(uDetail, il / 150.0 + 0.6, 0.0).r - 0.5) * 16.0 * g;
      kS *= 0.35;
      // The name's own plate breaks too, once its ponds have begun to run
      // together: a few fractures wander out from that water to the leads
      // round it and widen as the others do, so the opening the name leaves
      // has bays and points, and the ice beside it goes as plates.
      // (Not where the letters stand as blocks: their water leaves by one lead of its own, further on.)
      if (uIceN.z > 0.0 && gIceBoxD < cellA && uNameG.w < 0.5) {
        vec2 q2 = nl - uIceBox.xy + textureLod(uSnow, il / vec2(900.0, 2000.0) + 0.37, 0.0).rg * 110.0;
        float sp = 1e4;
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          float hx = ih2(vec2(fi * 3.7 + 1.3, 9.1)).x;
          vec2 a = vec2((fi / 5.0 * 2.0 - 1.0) * uIceBox.z * 0.84, 0.0);
          float ang = (fi / 5.0 * 2.0 - 1.0) * 0.8 + (hx - 0.5) * 0.9;
          vec2 d = vec2(sin(ang), (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0) * cos(ang));
          float t = clamp(dot(q2 - a, d), 0.0, cellA * 0.75);
          sp = min(sp, length(q2 - a - d * t) + t * 0.02);
        }
        float sw = (18.0 + 52.0 * un) * smoothstep(0.0, 1.0, uIceN.z / (uIceN.x * 1.6)) + cellA * g * g * 0.16;
        f = smax(f, sw - sp, kS + 6.0);
      }
    } else {
      lead *= 1.0 - uIceC.y;
    }
    // (Under the first frame's words no lead opens while a line of them stands; and none runs on through the snow
    // that lies before them, which is the lake's near shore to the eye: a lead comes down to that snow and ends
    // there, as at a bank, until the eye has risen off it. A ribbon of dark water drawn through a snowfield was a
    // stroke, not a lead.)
    if (uNameG.w > 0.5 && uIceP.y > 0.0) lead *= mix(smoothstep(0.1, 0.2, wordsClear(u)), 1.0, smoothstep(0.74, 0.84, uIceA.z));
    f = smax(f, lead - cr.x, kS);
  }
  if (uNameG.w > 0.5 && uNameS > 0.0) {
    // The water the letters stand in spreads from their own feet: a puddle to each, wider at one than at the next,
    // then one pool as they join. It goes furthest toward the eye, where the swept ice is thinnest, and along the
    // fractures it meets, so its shore has bays and points and runs out into the leads round it.
    if (rowD < uNameS * 2.4 + 140.0) {
      float un1 = textureLod(uSnow, il / vec2(1300.0, 700.0) + 0.41, 0.0).r;
      float un2 = textureLod(uSnow, il / vec2(560.0, 340.0) + 0.17, 0.0).g;
      float toEye = max(min(uNameG.x, uNameG.y) - u.y, 0.0);
      float dE = rowD - 0.32 * min(toEye, rowD);
      float R = uNameS * (0.8 + 0.6 * un1 + 0.24 * un2) + 40.0 * exp(-cr.x / 46.0) * smoothstep(50.0, 170.0, uNameS);
      // (It stops short of the first frame's words while a line of them stands, along a shore that wanders as the rest does.)
      float short_ = (wordsClear(u) - 0.036 - 0.024 * un2 - 0.01 * un1) * 2600.0;
      f = smax(f, mix(min(R - dE, short_), R - dE, smoothstep(0.57, 0.66, uIceA.z)), 22.0);
    }
    // And it leaves: one lead opens from behind the letters down the lake, its head running on ahead of the melt
    // until it reaches the outlet; then it widens, and the sheet either side of it goes as plates.
    if (uNameL.x > 0.0 && uIceP.y > 0.0) {
      vec2 ld = leadAt(u.y);
      float y0 = uNameB.x;
      float wide = uNameL.y * (0.62 + 0.38 * sin(ld.y * 29.0 + 1.0) * sin(ld.y * 11.0 + 0.3) + 0.3 * textureLod(uSnow, il / vec2(300.0, 900.0) + 0.77, 0.0).b);
      // (It leaves the pool by a broad mouth and narrows to its own width.)
      wide *= (1.0 - smoothstep(uNameL.x - 0.12, uNameL.x, ld.y)) * smoothstep(y0 - 60.0, y0 + 20.0, u.y) * (1.0 + 1.1 * (1.0 - smoothstep(0.0, 0.09, ld.y)));
      if (wide > 0.0) f = smax(f, wide - abs(u.x - ld.x), 30.0);
    }
  }
  if (uIceC.y > 0.0 && uIceP.y <= 0.0) {
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
  if (uIceP.y > 0.0) {
    // Seen from the ground: the river draws the lake's water out, so the ice
    // goes first round the outlet, in a bay that widens with the melt and has
    // no ruled side. No plate is ever left cut square along the lake's end.
    float on = textureLod(uSnow, w / 900.0 + 0.7, 0.0).b + 0.4 * (textureLod(uDetail, w / 330.0 + 0.15, 0.0).r - 0.5);
    f = max(f, 420.0 * smoothstep(0.3, 0.8, uIceA.z) * (0.8 + 0.8 * on) - length((w - vec2(uIceB.x, uLake.y)) * vec2(0.8, 1.0)));
    f = max(f, w.y - uLake.y + gap + 90.0 * on);
  } else {
    f = max(f, w.y - uLake.y + gap);
  }
  return f;
}
#endif
`;
