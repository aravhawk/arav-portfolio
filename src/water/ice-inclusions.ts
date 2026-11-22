/** A periodic optical map. Red is the broad interior of a fracture, green
 * its reflecting lip, blue pockets of air frozen at successive depths. */
export function iceInclusions(gl: WebGL2RenderingContext) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 512;
  const ctx = tile.getContext('2d')!;
  const angles = document.createElement('canvas');
  angles.width = angles.height = tile.width;
  const planes = angles.getContext('2d')!;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 512, 512);
  ctx.globalCompositeOperation = 'lighter';
  let seed = 93257;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 42; i++) {
    const x = random() * 512, y = random() * 512;
    const angle = random() * Math.PI, length = 16 + 112 * random() ** 2;
    const width = length * (0.035 + 0.22 * random());
    const strength = Math.round(45 + 150 * random());
    const facetPath = new Path2D();
    facetPath.moveTo(-length, 0);
    facetPath.lineTo(0, -0.06 * width);
    facetPath.lineTo(length * 0.54, width * 0.15);
    facetPath.lineTo(length * 0.14, width);
    facetPath.closePath();
    const azimuth = Math.round(angle / Math.PI * 255);
    planes.fillStyle = `rgb(${azimuth},0,0)`;
    for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(angle);
      const facet = ctx.createLinearGradient(0, 0, 0, width);
      facet.addColorStop(0, `rgb(${strength},0,0)`);
      facet.addColorStop(1, 'black');
      ctx.fillStyle = facet;
      ctx.fill(facetPath);
      // Keep one orientation across the face, independent of its bright lip.
      planes.setTransform(ctx.getTransform());
      planes.fill(facetPath);
      ctx.strokeStyle = `rgb(0,${strength},0)`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.lineTo(0, -0.06 * width);
      ctx.lineTo(length * 0.54, width * 0.15);
      ctx.stroke();
      ctx.restore();
    }
  }
  for (let i = 0; i < 20; i++) {
    const x = random() * 512, y = random() * 512, lean = random() - 0.5;
    for (let j = 0; j < 42; j++) {
      const depth = random() * 65;
      const bx = x + depth * lean + 18 * (random() - random());
      const by = y + depth;
      const radius = 0.5 + 1.8 * random() ** 3;
      ctx.fillStyle = `rgb(0,0,${Math.round(40 + 130 * random())})`;
      const x0 = (bx % 512 + 512) % 512;
      const y0 = (by % 512 + 512) % 512;
      const xs = x0 < radius ? [x0,x0+512] : x0 > 512-radius ? [x0,x0-512] : [x0];
      const ys = y0 < radius ? [y0,y0+512] : y0 > 512-radius ? [y0,y0-512] : [y0];
      for (const cx of xs) for (const cy of ys) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // The other half stores the slopes of overlapping shell-shaped breaks.
  // Bake directly to bytes so the normal and cavity channels mip together.
  const pixels = new Uint8Array(512 * 1024 * 4);
  pixels.set(ctx.getImageData(0, 0, 512, 512).data);
  const orientation = planes.getImageData(0, 0, 512, 512).data;
  const surface = 512 * 512 * 4;
  for (let i = 0; i < surface; i += 4) pixels[i+3] = orientation[i];
  pixels.fill(128, surface);
  for (let i = 0; i < 175; i++) {
    const x = random() * 512, y = random() * 512;
    const radius = 4 + 65 * random() ** 2;
    const angle = random() * Math.PI;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const aspect = 1.1 + 1.8 * random();
    for (let dy = -Math.ceil(radius); dy <= radius; dy++) {
      for (let dx = -Math.ceil(radius); dx <= radius; dx++) {
        const u = (dx*cos + dy*sin) / radius;
        const v = (dy*cos - dx*sin) * aspect / radius;
        // Conchoidal chips fan away from an impact. One steep lip
        // catches the key; the shallow trailing shell tapers into the face.
        const bend = v + 0.16*u*u + 0.065*Math.sin(4*u + angle);
        const r2 = u*u + bend*bend;
        if (r2 >= 1) continue;
        const address = surface + (((Math.floor(y+dy) & 511) * 512 + (Math.floor(x+dx) & 511)) * 4);
        const lip = Math.max(0, -bend + 0.22*u);
        const curl = (0.24 + lip) * (0.8 + 0.2*Math.cos(23*r2 + u*3));
        pixels[address] = 128 + 88 * (u*cos - v*sin) * curl;
        pixels[address+1] = 128 + 88 * (v*cos + u*sin) * curl;
        pixels[address+2] = 102 + 65 * (1-r2) - 48 * lip;
      }
    }
  }
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 1024, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  return tex;
}
