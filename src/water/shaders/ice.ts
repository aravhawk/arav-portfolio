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
 * Needs: uIce, uIceA, uIceB, uLake, uIceSdf, uDetail.
 */
export const ICE_FIELD = `
uniform vec4 uIce;         // the name's raster in world px: x, y, w, h (w = 0: no ice left)
uniform vec4 uIceA;        // x: how far the letters have opened px, y: lead width as a share of a floe, z: melt 0..1, w: gap at the bank px
uniform vec4 uIceB;        // xy: the lake's outlet, z: how far the floes have gathered toward it (1 = not at all), w: floe size px
uniform vec4 uLake;        // x: lake top, y: lake bottom, z: how wet the sheet is 0..1, w: 1 while the sheet is whole, 0 once it is gone
uniform sampler2D uIceSdf; // signed distance to the letters px (negative inside), _, gradient
uniform sampler2D uDetail;

vec2 ih2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
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
  vec2 iuv = il / uIce.zw;
  vec2 cl = clamp(iuv, 0.002, 0.998);
  float lsd = texture(uIceSdf, cl).r + length((iuv - cl) * uIce.zw);
  float f = uIceA.x - lsd;

  // Pressure cracks: the walls of a few large cells. They are where the
  // sheet will part, so they are found once and used for both.
  float cell = uIceB.w;
  vec2 wob = (textureLod(uDetail, il / (cell * 5.0), 0.0).gb - 0.5) * cell * 0.16;
  vec2 x = (il + wob) / cell + vec2(3.37, 1.83);
  vec2 n = floor(x);
  vec2 fr = fract(x);
  vec2 pts[9];
  float md = 64.0;
  vec2 mr = vec2(0.0);
  vec2 mg = vec2(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      vec2 g = vec2(float(i - 1), float(j - 1));
      vec2 r = g + 0.14 + 0.72 * ih2(n + g) - fr;
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
  float rnd = ih2(n + mg + 7.7).x;
  cr = vec3(bd * cell, rnd, sqrt(md) * cell);

  if (uIceA.y > 0.0) {
    // Leads open unevenly along a crack, as they do.
    float un = textureLod(uDetail, il / (cell * 1.4) + 0.31, 0.0).r;
    // Across the name they stay hairlines until the name itself has gone.
    float clearOf = mix(smoothstep(8.0, 130.0, lsd), 1.0, smoothstep(0.5, 0.62, uIceA.z));
    f = max(f, cell * uIceA.y * (0.45 + 1.1 * un) * clearOf - cr.x);
    // A floe melts from its rim inward: slowly, then all at once, and each
    // in its own time. Those far from the outlet go first, so the last ice
    // on the lake is the ice the current has carried to its mouth. The last
    // of a floe is a rounded piece, never a sliver, and it does not linger
    // as a speck.
    float far = clamp(length(u + mr * cell - uIceB.xy) / (cell * 2.4), 0.0, 1.0);
    float late = mix(rnd, 1.0 - far, 0.7);
    // The floes that held the name go first: the melt spreads from it.
    late *= smoothstep(cell * 0.1, cell * 0.42, abs(il.y + mr.y * cell - uIce.w * 0.5));
    float t = smoothstep(0.52 + 0.2 * late, 0.75 + 0.14 * late, uIceA.z);
    f = max(f, cr.z - cell * 0.95 * sqrt(max(1.0 - t, 0.0)) + step(0.985, t) * 1e3);
  }
  f /= uIceB.z;
  // The bank and the lake's south end, where the stream leaves.
  f = max(f, shore + uIceA.w);
  f = max(f, w.y - uLake.y + uIceA.w);
  return f;
}
`;
