/**
 * The picture between two rendered frames.
 *
 * The flight is rendered a frame every thirtieth of a screen, and between
 * two stations the camera travels fast: neighbouring frames can be hundreds
 * of pixels apart. Shown one after the other they step; laid one over the
 * other they are a double image. But the camera of every frame is known
 * (the renderer writes it down), and nearly all of the picture is the
 * ground, the water lying on it, and the far ranges and sky. So the place
 * between two frames is drawn as that place really looks: each pixel's ray
 * from the camera that stands between the two is followed to the ground
 * (or, above the horizon, out to the far distance), and that point is
 * looked up in each of the two frames through the camera that frame was
 * rendered from. The two then agree on the ground exactly, wherever the
 * reader is between them, and are mixed by how far along the reader is. On
 * a rendered frame's own place the picture is that frame, untouched.
 *
 * What stands up from the ground (the block of ice, a canyon wall) is not
 * on that plane, and the two frames disagree about it by its height's
 * parallax over one frame's travel. So the two are not mixed evenly all the
 * way across: the nearer frame draws nearly alone, and gives way to the
 * other in a short dissolve about half way. Where the camera is slow, as it
 * is at every station, the disagreement is a pixel or two.
 *
 * One small program, compiled in a few milliseconds. Where there is no
 * WebGL at all the player draws whole frames with a 2D canvas instead.
 */

const VERT = `
attribute vec2 p;
varying vec2 v;
void main() {
  v = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D uA;
uniform sampler2D uB;
// The camera between the two: where it is, and its forward, right and up (right and up scaled to the frame's half size).
uniform vec3 uP[4];
// Each frame's camera: where it is, its forward, and its right and up scaled so a dot product gives a frame coordinate.
uniform vec3 uCa[4];
uniform vec3 uCb[4];
// How much of the second frame is in the mix; and 1 where the frames are to be laid over each other as they are.
uniform float uMix;
uniform float uFlat;

vec3 seen(vec3 x, vec3 c[4]) {
  vec3 a = x - c[0];
  float z = dot(a, c[1]);
  return vec3(0.5 + 0.5 * dot(a, c[2]) / z, 0.5 - 0.5 * dot(a, c[3]) / z, z);
}
float inside(vec3 s) {
  vec2 e = min(s.xy, 1.0 - s.xy);
  return step(0.0, s.z) * smoothstep(0.0, 0.012, min(e.x, e.y));
}
void main() {
  if (uFlat > 0.5) {
    gl_FragColor = vec4(mix(texture2D(uA, v).rgb, texture2D(uB, v).rgb, uMix), 1.0);
    return;
  }
  vec3 d = uP[1] + uP[2] * (v.x * 2.0 - 1.0) + uP[3] * (1.0 - v.y * 2.0);
  // Down to the ground; above the horizon, and for the far ground, out to the distance.
  float t = d.z < -1e-5 ? min(-uP[0].z / d.z, 2.0e6) : 2.0e6;
  vec3 x = uP[0] + d * t;
  vec3 a = seen(x, uCa);
  vec3 b = seen(x, uCb);
  vec3 ca = texture2D(uA, clamp(a.xy, 0.0, 1.0)).rgb;
  vec3 cb = texture2D(uB, clamp(b.xy, 0.0, 1.0)).rgb;
  // (Where a frame does not reach, at the picture's edge, the other draws alone.)
  float wa = (1.0 - uMix) * inside(a);
  float wb = uMix * inside(b);
  float sum = wa + wb;
  gl_FragColor = vec4(sum > 1e-4 ? (ca * wa + cb * wb) / sum : mix(ca, cb, uMix), 1.0);
}`;

/** A camera as 13 floats: position, forward, right, up, and the tangent of half its field of view. */
export type Cam13 = ArrayLike<number>;

export interface Warp {
  /**
   * Draw the place between frame `a` and frame `b`. `mix`: how far from `a` to `b`. With cameras, the two are
   * brought to the camera `at`; without (or with `b` null), they are laid over each other as they are.
   */
  draw(a: { key: number; frame: VideoFrame }, b: { key: number; frame: VideoFrame } | null, mix: number, cams: { a: Cam13; b: Cam13; at: Cam13; aspect: number } | null): void;
  /** Let go of every frame's texture (a new stream). */
  clear(): void;
  destroy(): void;
}

export function makeWarp(canvas: HTMLCanvasElement): Warp | null {
  // (The drawing is kept after it is shown: a dissolve copies it, and a frame the page does not redraw stays up.)
  const opts: WebGLContextAttributes = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'default' };
  const gl = (canvas.getContext('webgl2', opts) ?? canvas.getContext('webgl', opts)) as WebGLRenderingContext | null;
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, 'p');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(prog, name);
  const loc = { a: u('uA'), b: u('uB'), p: u('uP'), ca: u('uCa'), cb: u('uCb'), mix: u('uMix'), flat: u('uFlat') };
  gl.uniform1i(loc.a, 0);
  gl.uniform1i(loc.b, 1);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  /** The frames now on the GPU, by key, and when each last drew. A few: the two in use and those just left. */
  const texs = new Map<number, { tex: WebGLTexture; used: number }>();
  let tick = 0;
  let broken = false;
  const texOf = (key: number, frame: VideoFrame, unit: number): boolean => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    const had = texs.get(key);
    if (had) {
      had.used = tick;
      gl.bindTexture(gl.TEXTURE_2D, had.tex);
      return true;
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame as unknown as TexImageSource);
    } catch {
      broken = true;
    }
    if (broken || gl.getError() !== gl.NO_ERROR) {
      broken = true;
      gl.deleteTexture(tex);
      return false;
    }
    texs.set(key, { tex, used: tick });
    if (texs.size > 5) {
      let old = -1;
      let at = Infinity;
      for (const [k, t] of texs) {
        if (t.used < at) {
          at = t.used;
          old = k;
        }
      }
      gl.deleteTexture(texs.get(old)!.tex);
      texs.delete(old);
    }
    return true;
  };
  const three = new Float32Array(12);
  /** A camera for looking a point up in its frame: right and up divided by the frame's half size. */
  const setSeen = (where: WebGLUniformLocation | null, c: Cam13, aspect: number) => {
    const tan = c[12];
    for (let k = 0; k < 3; k++) {
      three[k] = c[k];
      three[3 + k] = c[3 + k];
      three[6 + k] = c[6 + k] / (tan * aspect);
      three[9 + k] = c[9 + k] / tan;
    }
    gl.uniform3fv(where, three);
  };

  return {
    draw(a, b, mix, cams) {
      if (gl.isContextLost()) return;
      tick++;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (!texOf(a.key, a.frame, 0)) throw new Error('frame upload');
      const two = b && mix > 0 ? texOf(b.key, b.frame, 1) : false;
      if (!two) texOf(a.key, a.frame, 1);
      const m = two ? mix : 0;
      // Through the cameras the nearer frame draws nearly alone and hands over to the other in a short dissolve about
      // half way: what stands up from the ground is then a double image only for that moment, not all the way across.
      const k = Math.min(1, Math.max(0, (m - 0.3) / 0.4));
      gl.uniform1f(loc.mix, cams ? k * k * (3 - 2 * k) : m);
      if (!cams || m === 0) gl.uniform1f(loc.flat, 1);
      else {
        gl.uniform1f(loc.flat, 0);
        const c = cams.at;
        const tan = c[12];
        for (let k = 0; k < 3; k++) {
          three[k] = c[k];
          three[3 + k] = c[3 + k];
          three[6 + k] = c[6 + k] * tan * cams.aspect;
          three[9 + k] = c[9 + k] * tan;
        }
        gl.uniform3fv(loc.p, three);
        setSeen(loc.ca, cams.a, cams.aspect);
        setSeen(loc.cb, cams.b, cams.aspect);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    clear() {
      for (const t of texs.values()) gl.deleteTexture(t.tex);
      texs.clear();
    },
    destroy() {
      for (const t of texs.values()) gl.deleteTexture(t.tex);
      texs.clear();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
