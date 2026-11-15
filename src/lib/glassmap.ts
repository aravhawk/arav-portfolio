/**
 * Displacement map for a rounded pane. Inside a bezel band the map points
 * toward the centre, so the edge shows what is further in, the way a convex
 * glass edge does. Red carries x, green carries y, 128 is neutral.
 */
export function buildGlassMap(w: number, h: number, radius: number, bezel: number) {
  const s = Math.min(1, 360 / Math.max(w, h));
  const cw = Math.max(8, Math.round(w * s));
  const ch = Math.max(8, Math.round(h * s));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(cw, ch);
  const hx = w / 2;
  const hy = h / 2;
  const r = Math.min(radius, hx, hy);
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const px = (i + 0.5) / s - hx;
      const py = (j + 0.5) / s - hy;
      const qx = Math.abs(px) - (hx - r);
      const qy = Math.abs(py) - (hy - r);
      let nx = 0;
      let ny = 0;
      let dist: number;
      if (qx > 0 && qy > 0) {
        const l = Math.hypot(qx, qy) || 1;
        dist = r - l;
        nx = (qx / l) * Math.sign(px);
        ny = (qy / l) * Math.sign(py);
      } else if (qx > qy) {
        dist = r - qx;
        nx = Math.sign(px);
      } else {
        dist = r - qy;
        ny = Math.sign(py);
      }
      let mag = 0;
      if (dist < bezel) {
        const t = 1 - Math.max(0, dist) / bezel;
        // Convex squircle profile: flat in the middle of the band, steep at the rim.
        mag = 1 - Math.pow(1 - Math.pow(t, 2.4), 0.5);
      }
      const o = (j * cw + i) * 4;
      img.data[o] = 128 - nx * mag * 127;
      img.data[o + 1] = 128 - ny * mag * 127;
      img.data[o + 2] = 128;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Only Blink renders SVG filters inside backdrop-filter. CSS.supports answers
 * yes in every engine, so the engine is identified by a Blink-only API.
 */
export function isBlink() {
  if (typeof window === 'undefined') return false;
  return 'userAgentData' in navigator || ('chrome' in window && !('InstallTrigger' in window) && !('safari' in window) && !('webkitConvertPointFromNodeToPage' in window));
}
