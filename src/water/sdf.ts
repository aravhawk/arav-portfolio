/**
 * Signed distance field from an anti-aliased coverage raster.
 *
 * Felzenszwalb and Huttenlocher's linear-time squared Euclidean distance
 * transform, seeded from coverage the way TinySDF does it, so the field is
 * accurate to a fraction of a texel even though the raster is coarse.
 *
 * Returns distance in texels: negative inside the shape, positive outside.
 */

const INF = 1e20;

function edt1d(
  grid: Float64Array,
  offset: number,
  stride: number,
  length: number,
  f: Float64Array,
  v: Uint32Array,
  z: Float64Array,
) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];
  let k = 0;
  for (let q = 1; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    let s: number;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}

function edt(data: Float64Array, w: number, h: number, f: Float64Array, v: Uint32Array, z: Float64Array) {
  for (let x = 0; x < w; x++) edt1d(data, x, w, h, f, v, z);
  for (let y = 0; y < h; y++) edt1d(data, y * w, 1, w, f, v, z);
}

/**
 * @param alpha coverage 0..255, one byte per texel (stride lets you pass RGBA)
 * @param clamp distances are clamped to +/- this many texels
 */
export function signedDistance(
  alpha: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  stride = 1,
  channel = 0,
  clamp = 32,
): Float32Array {
  const n = w * h;
  const outer = new Float64Array(n);
  const inner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = alpha[i * stride + channel] / 255;
    if (a <= 0) {
      outer[i] = INF;
      inner[i] = 0;
    } else if (a >= 1) {
      outer[i] = 0;
      inner[i] = INF;
    } else {
      const d = 0.5 - a;
      outer[i] = d > 0 ? d * d : 0;
      inner[i] = d < 0 ? d * d : 0;
    }
  }
  const m = Math.max(w, h);
  const f = new Float64Array(m);
  const z = new Float64Array(m + 1);
  const v = new Uint32Array(m);
  edt(outer, w, h, f, v, z);
  edt(inner, w, h, f, v, z);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    out[i] = d > clamp ? clamp : d < -clamp ? -clamp : d;
  }
  return out;
}
