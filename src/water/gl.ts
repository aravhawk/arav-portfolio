/**
 * Small WebGL2 helpers for the water engine. No dependencies.
 */

export type GL = WebGL2RenderingContext;

export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  // One oversized triangle covers the viewport.
  vUv = aPos;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * The one piece of geometry every pass draws: a triangle that covers the
 * viewport, bound to attribute 0 (drawing without attribute 0 enabled makes
 * some desktop drivers fall back to slow emulation).
 */
export function bindTriangle(gl: GL): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}

export function compile(gl: GL, frag: string, name: string): Program {
  return compileEnd(gl, compileBegin(gl, frag, name));
}

export interface Pending {
  prog: WebGLProgram;
  vs: WebGLShader;
  fs: WebGLShader;
  name: string;
}

/** Hand a program to the driver. Nothing here waits for it. */
export function compileBegin(gl: GL, frag: string, name: string): Pending {
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, VERT);
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, frag);
  gl.compileShader(fs);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  return { prog, vs, fs, name };
}

/** Whether the driver has finished with it (always true where it cannot be asked). */
export function compileDone(gl: GL, p: Pending): boolean {
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  return !ext || (gl.getProgramParameter(p.prog, ext.COMPLETION_STATUS_KHR) as boolean);
}

/** Take the linked program: this waits if the driver has not finished. */
export function compileEnd(gl: GL, p: Pending): Program {
  const { prog, vs, fs, name } = p;
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log =
      gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs) || gl.getProgramInfoLog(prog) || '';
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteProgram(prog);
    throw new Error(`water shader "${name}" failed: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    if (!info) continue;
    const base = info.name.replace(/\[0\]$/, '');
    u[base] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u };
}

export interface TexOpts {
  internal: number;
  format: number;
  type: number;
  filter?: number;
  wrap?: number;
  data?: ArrayBufferView | null;
}

export function makeTexture(gl: GL, w: number, h: number, o: TexOpts): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, o.internal, w, h, 0, o.format, o.type, o.data ?? null);
  const f = o.filter ?? gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  const wr = o.wrap ?? gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
  return tex;
}

export function makeTarget(gl: GL, w: number, h: number, o: TexOpts): Target {
  const tex = makeTexture(gl, w, h, o);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) throw new Error('water: framebuffer incomplete');
  return { tex, fbo, w, h };
}

export function freeTarget(gl: GL, t: Target | null | undefined) {
  if (!t) return;
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fbo);
}

/** A ping-pong pair. `read` is the current state, `write` the next. */
export class Swap {
  a: Target;
  b: Target;
  constructor(gl: GL, w: number, h: number, o: TexOpts) {
    this.a = makeTarget(gl, w, h, o);
    this.b = makeTarget(gl, w, h, o);
  }
  get read() {
    return this.a;
  }
  get write() {
    return this.b;
  }
  swap() {
    const t = this.a;
    this.a = this.b;
    this.b = t;
  }
  free(gl: GL) {
    freeTarget(gl, this.a);
    freeTarget(gl, this.b);
  }
}

export function bindTex(gl: GL, unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (loc) gl.uniform1i(loc, unit);
}

export function drawTo(gl: GL, t: Target | null, w?: number, h?: number) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
  gl.viewport(0, 0, t ? t.w : (w as number), t ? t.h : (h as number));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
