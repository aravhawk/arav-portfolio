import type { Basis, V3 } from './camera';
export type Box = [V3, V3];

/** The slab's four corners on screen (0..1), for the bounds its work is kept inside. */
export function projectPoint(b: Basis, p: V3, aspect: number): [number, number, number] {
  const dx = p[0] - b.pos[0];
  const dy = p[1] - b.pos[1];
  const dz = p[2] - b.pos[2];
  const z = dx * b.f[0] + dy * b.f[1] + dz * b.f[2];
  const x = dx * b.r[0] + dy * b.r[1] + dz * b.r[2];
  const y = dx * b.u[0] + dy * b.u[1] + dz * b.u[2];
  const zz = Math.max(z, 1e-3);
  return [0.5 + x / (zz * b.tan * aspect) / 2, 0.5 - y / (zz * b.tan) / 2, z];
}

/**
 * Whether any of a box of the world can be in the frame. It errs toward
 * yes: a box is ruled out only when all of it lies behind the eye or beyond
 * one side of the frame (with a little room, for the four rays a pixel may
 * be looked at through).
 */
export function boxInView(cam: Basis, aspect: number, lo: V3, hi: V3): boolean {
  const tx = cam.tan * aspect * 1.03 + 0.002;
  const ty = cam.tan * 1.03 + 0.002;
  let behind = 0;
  let left = 0;
  let right = 0;
  let below = 0;
  let above = 0;
  for (let i = 0; i < 8; i++) {
    const dx = (i & 1 ? hi[0] : lo[0]) - cam.pos[0];
    const dy = (i & 2 ? hi[1] : lo[1]) - cam.pos[1];
    const dz = (i & 4 ? hi[2] : lo[2]) - cam.pos[2];
    const z = dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2];
    const x = dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2];
    const y = dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2];
    if (z <= 0) behind++;
    if (x < -z * tx) left++;
    if (x > z * tx) right++;
    if (y < -z * ty) below++;
    if (y > z * ty) above++;
  }
  return !(behind === 8 || left === 8 || right === 8 || below === 8 || above === 8);
}

/** A part of the frame, in the pass's own vUv (u right, v up): x0, y0, x1, y1. */
export type Rect = [number, number, number, number];
/**
 * The part of the frame a box of the world can be seen in, with a little
 * room; null when any of it is behind the eye (then it is not known).
 */
export function boxRect(cam: Basis, aspect: number, [lo, hi]: Box): Rect | null {
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;
  for (let i = 0; i < 8; i++) {
    const pr = projectPoint(cam, [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]], aspect);
    if (pr[2] < 1) return null;
    x0 = Math.min(x0, pr[0]);
    x1 = Math.max(x1, pr[0]);
    y0 = Math.min(y0, 1 - pr[1]);
    y1 = Math.max(y1, 1 - pr[1]);
  }
  return [x0 - 0.004, y0 - 0.004, x1 + 0.004, y1 + 0.004];
}

/**
 * The part of the frame a box of the world can be seen in, whatever of it is behind the eye: the box is cut at the
 * eye's own plane first, so what is left of it is all in front and its corners can be projected. null: none of it is
 * in front of the eye. (It errs wide: where the box runs past the eye the rectangle runs off the frame on that side.)
 */
export function boxRectCut(cam: Basis, aspect: number, [lo, hi]: Box): Rect | null {
  const NEAR = 0.5;
  const tx = cam.tan * aspect;
  const ty = cam.tan;
  // The corners, in the eye's frame: across, up, forward.
  const c: V3[] = [];
  for (let i = 0; i < 8; i++) {
    const dx = (i & 1 ? hi[0] : lo[0]) - cam.pos[0];
    const dy = (i & 2 ? hi[1] : lo[1]) - cam.pos[1];
    const dz = (i & 4 ? hi[2] : lo[2]) - cam.pos[2];
    c.push([dx * cam.r[0] + dy * cam.r[1] + dz * cam.r[2], dx * cam.u[0] + dy * cam.u[1] + dz * cam.u[2], dx * cam.f[0] + dy * cam.f[1] + dz * cam.f[2]]);
  }
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;
  let any = false;
  const put = (x: number, y: number, z: number) => {
    const u = 0.5 + x / (z * tx) / 2;
    const v = 0.5 + y / (z * ty) / 2;
    x0 = Math.min(x0, u);
    x1 = Math.max(x1, u);
    y0 = Math.min(y0, v);
    y1 = Math.max(y1, v);
    any = true;
  };
  for (let i = 0; i < 8; i++) {
    const a = c[i];
    if (a[2] >= NEAR) put(a[0], a[1], a[2]);
    // Each of the box's twelve edges that crosses the eye's plane is cut there.
    for (let k = 1; k < 8; k <<= 1) {
      if (i & k) continue;
      const b = c[i | k];
      if (a[2] >= NEAR === b[2] >= NEAR) continue;
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      put(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR);
    }
  }
  return any ? [x0 - 0.004, y0 - 0.004, x1 + 0.004, y1 + 0.004] : null;
}

