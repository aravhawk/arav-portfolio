import {
  bloomFragment,
  driftFragment,
  driftVertex,
  fullVertex,
  groundFragment,
  iceFragment,
  meshVertex,
  postFragment,
} from './shaders';

export type DrawInfo = { indices: number; vertices: number; low: number[]; span: number[] };
type Meta = { plane: number[]; crop: number[]; size: number[]; half: number[] };
type MeshMessage = {
  kind: 'mesh';
  draws: { info: DrawInfo; vertices: Uint8Array<ArrayBuffer>; indices: Uint8Array<ArrayBuffer> }[];
  metadata: Meta;
  grade: ArrayBuffer;
};
type TextureMessage = {
  kind: 'texture';
  index: number;
  format: number;
  width: number;
  height: number;
  mips: Uint8Array<ArrayBuffer>[];
};
type Message =
  | MeshMessage
  | TextureMessage
  | { kind: 'done'; resources: { name: string; start: number; end: number; bytes: number }[] }
  | { kind: 'error'; message: string };
type Program = { id: WebGLProgram; u: Record<string, WebGLUniformLocation> };
export type Pose = { x: number; y: number; z: number; t: number };
// The portrait camera pushes the name into the upper middle of the gate.
function horizontalLens(half: number, ratio: number) {
  return half * (ratio <= 1 ? 0.81 * Math.min(1, ratio / 0.43) : Math.min(1, ratio / 1.2));
}

function verticalAim(pose: Pose, ratio: number) {
  return pose.y * 0.19 + (ratio <= 1 ? 0.18 : 0);
}

export const rest: Pose = { x: 0, y: 0, z: 0, t: 0 };
export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
export const stages = ['refraction', 'bloom', 'ground', 'slab', 'drift', 'grade'] as const;
type Target = {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
  depth: WebGLRenderbuffer | null;
};
type Draw = { vao: WebGLVertexArrayObject; info: DrawInfo };

export class LakeGPU {
  readonly gl: WebGL2RenderingContext;
  readonly decoder: Worker;
  private readonly programs: Record<string, Program> = {};
  private readonly buffers: WebGLBuffer[] = [];
  private readonly draws: Draw[] = [];
  private readonly textures: WebGLTexture[] = [];
  private lut!: WebGLTexture;
  private meta!: Meta;
  private targets: Target[] = [];
  private empty: WebGLVertexArrayObject;
  assetMemory = 0;
  targetMemory = 0;
  disposed = false;
  private cancelLoad?: () => void;
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl || !gl.getExtension('EXT_color_buffer_float'))
      throw Error('A floating-point WebGL2 target is required');
    this.gl = gl;
    this.empty = gl.createVertexArray()!;
    this.decoder = new Worker('/scene/lake/decode.worker.js');
  }
  private async compile() {
    const gl = this.gl;
    const sources = {
      ground: [meshVertex, groundFragment],
      ice: [meshVertex, iceFragment],
      bloom: [fullVertex, bloomFragment],
      post: [fullVertex, postFragment],
      drift: [driftVertex, driftFragment],
    };
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    for (const [name, pair] of Object.entries(sources)) {
      const program = gl.createProgram()!;
      for (const [i, src] of pair.entries()) {
        const shader = gl.createShader(i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER)!;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
        gl.deleteShader(shader);
      }
      gl.linkProgram(program);
      this.programs[name] = { id: program, u: {} };
    }
    for (const prog of Object.values(this.programs)) {
      while (
        parallel &&
        !this.disposed &&
        !gl.getProgramParameter(prog.id, parallel.COMPLETION_STATUS_KHR)
      )
        await nextFrame();
      if (this.disposed) return;
      if (!gl.getProgramParameter(prog.id, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(prog.id) || 'Shader link');
      const count = gl.getProgramParameter(prog.id, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniform(prog.id, i)!.name;
        prog.u[name] = gl.getUniformLocation(prog.id, name)!;
      }
    }
    performance.mark('lake:programs-ready');
  }
  async load(theme: string) {
    const gl = this.gl;
    const etc = gl.getExtension('WEBGL_compressed_texture_etc');
    const s3 = gl.getExtension('WEBGL_compressed_texture_s3tc');
    const astc = gl.getExtension('WEBGL_compressed_texture_astc');
    const rgb = astc
      ? [10, astc.COMPRESSED_RGBA_ASTC_4x4_KHR]
      : etc
        ? [0, etc.COMPRESSED_RGB8_ETC2]
        : s3
          ? [2, s3.COMPRESSED_RGB_S3TC_DXT1_EXT]
          : [13, 0];
    const rgba = astc
      ? [10, astc.COMPRESSED_RGBA_ASTC_4x4_KHR]
      : etc
        ? [1, etc.COMPRESSED_RGBA8_ETC2_EAC]
        : s3
          ? [3, s3.COMPRESSED_RGBA_S3TC_DXT5_EXT]
          : [13, 0];
    const load = new Promise<void>((resolve, reject) => {
      let uploads = Promise.resolve();
      this.cancelLoad = () => reject(Error('Lake disposed'));
      this.decoder.onerror = (e) => reject(Error(e.message));
      this.decoder.onmessage = ({ data }: { data: Message }) => {
        if (data.kind === 'error') {
          reject(Error(data.message));
          return;
        }
        uploads = uploads
          .then(async () => {
            if (this.disposed) return;
            if (data.kind === 'mesh') this.uploadMesh(data);
            if (data.kind === 'texture') await this.uploadTexture(data);
            if (data.kind === 'done') {
              for (const r of data.resources)
                performance.measure('lake:fetch:' + r.name.split('/').at(-1), {
                  start: Math.max(0, r.start - performance.timeOrigin),
                  end: Math.max(0, r.end - performance.timeOrigin),
                  detail: r.bytes,
                });
              this.decoder.terminate();
              resolve();
            }
          })
          .catch(reject);
      };
      this.decoder.postMessage({ theme, rgb, rgba, portrait: true });
    });
    await Promise.all([this.compile(), load]);
    performance.mark('lake:uploaded');
  }
  private uploadMesh(data: MeshMessage) {
    const gl = this.gl;
    this.meta = data.metadata;
    for (const d of data.draws) {
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      for (const [target, bytes] of [
        [gl.ARRAY_BUFFER, d.vertices],
        [gl.ELEMENT_ARRAY_BUFFER, d.indices],
      ] as const) {
        const buf = gl.createBuffer()!;
        this.buffers.push(buf);
        gl.bindBuffer(target, buf);
        gl.bufferData(target, bytes, gl.STATIC_DRAW);
      }
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, true, 8, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.UNSIGNED_BYTE, true, 8, 6);
      this.draws.push({ vao, info: d.info });
    }
    this.lut = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, this.lut);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGB8,
      32,
      32,
      32,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      new Uint8Array(data.grade),
    );
    this.filter(gl.TEXTURE_3D, false);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    this.assetMemory += data.grade.byteLength;
  }
  private filter(target: number, mips: boolean) {
    const gl = this.gl;
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  private async uploadTexture(data: TextureMessage) {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    this.textures[data.index] = tex;
    for (let k = 0; k < data.mips.length; k++) {
      if (this.disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const w = Math.max(1, data.width >> k),
        h = Math.max(1, data.height >> k),
        bytes = data.mips[k];
      if (data.format) gl.compressedTexImage2D(gl.TEXTURE_2D, k, data.format, w, h, 0, bytes);
      else gl.texImage2D(gl.TEXTURE_2D, k, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      this.assetMemory += bytes.byteLength;
      if (k < 2) await nextFrame();
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this.filter(gl.TEXTURE_2D, true);
    performance.mark('lake:texture-' + data.index);
  }
  private target(w: number, h: number, hdr: boolean, depth: boolean, mips = false): Target {
    const gl = this.gl,
      fbo = gl.createFramebuffer()!,
      tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(
      gl.TEXTURE_2D,
      mips ? 1 + Math.floor(Math.log2(Math.max(w, h))) : 1,
      hdr ? gl.RGBA16F : gl.RGBA8,
      w,
      h,
    );
    this.filter(gl.TEXTURE_2D, mips);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const z = depth ? gl.createRenderbuffer() : null;
    if (z) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, z);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, z);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw Error('Incomplete lake target');
    this.targetMemory += w * h * ((hdr ? 8 : 4) * (mips ? 4 / 3 : 1) + (depth ? 2 : 0));
    return { fbo, tex, w, h, depth: z };
  }
  private release(t: Target) {
    const g = this.gl;
    g.deleteTexture(t.tex);
    g.deleteFramebuffer(t.fbo);
    g.deleteRenderbuffer(t.depth);
  }
  resize(w: number, h: number) {
    if (this.targets[0]?.w === w && this.targets[0]?.h === h) return;
    this.targets.forEach((t) => this.release(t));
    this.targetMemory = 0;
    this.canvas.width = w;
    this.canvas.height = h;
    const rw = Math.max(4, Math.ceil(w / 6)),
      rh = Math.max(4, Math.ceil(h / 6));
    this.targets = [
      this.target(w, h, true, true),
      this.target(rw, rh, true, false, true),
      this.target(Math.max(4, w >> 5), Math.max(4, h >> 5), true, false, true),
    ];
  }
  private texture(u: WebGLUniformLocation, unit: number, tex: WebGLTexture, volume = false) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(volume ? gl.TEXTURE_3D : gl.TEXTURE_2D, tex);
    gl.uniform1i(u, unit);
  }
  private mesh(program: Program, draw: Draw, pose: Pose, w: number, h: number) {
    const gl = this.gl,
      u = program.u,
      half = this.meta.half;
    gl.uniform3fv(u.low, draw.info.low);
    gl.uniform3fv(u.span, draw.info.span);
    gl.uniform3f(u.eye, pose.x, pose.y, pose.z);
    gl.uniform2f(u.restLens, half[0], half[1]);
    const ratio = w / h;
    const lens = horizontalLens(half[0], ratio);
    gl.uniform2f(u.lens, lens, (lens * h) / w);
    gl.uniform2f(u.aim, pose.x * 0.12, verticalAim(pose, ratio));
    gl.bindVertexArray(draw.vao);
    gl.drawElements(gl.TRIANGLES, draw.info.indices, gl.UNSIGNED_SHORT, 0);
  }
  draw(travel: Pose, output: WebGLFramebuffer | null = null, last = 6, showSlab = true) {
    const gl = this.gl,
      [scene, copy, a] = this.targets,
      { w, h } = scene;
    const pose =
      w <= h ? { x: travel.x - 0.28, y: travel.y + 0.1, z: travel.z + 0.55, t: travel.t } : travel;
    const bind = (t: Target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.viewport(0, 0, t.w, t.h);
    };
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    const gp = this.programs.ground;
    const ground = (target: Target) => {
      bind(target);
      if (target === scene) gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(gp.id);
      gl.uniform1i(gp.u.tall, this.textures[5] ? 1 : 0);
      this.texture(gp.u.extension, 5, this.textures[5] || this.textures[4]);
      this.texture(gp.u.atlas, 0, this.textures[0]);
      this.texture(gp.u.baseMap, 1, this.textures[4]);
      this.mesh(gp, this.draws[0], pose, w, h);
    };
    // Draw the same backdrop into the refraction pyramid before the main
    // scene. This keeps the full-size colour attachment resident on tile GPUs.
    ground(copy);
    gl.bindTexture(gl.TEXTURE_2D, copy.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (last === 1) return;
    const bloom = this.programs.bloom;
    bind(a);
    gl.useProgram(bloom.id);
    gl.bindVertexArray(this.empty);
    this.texture(bloom.u.field, 0, this.textures[4]);
    this.texture(bloom.u.mat, 1, this.textures[2]);
    const [x, y, r, d] = this.meta.crop,
      [bw, bh] = this.meta.size;
    const ratio = w / h,
      half = this.meta.half;
    const lens = horizontalLens(half[0], ratio);
    gl.uniform4f(bloom.u.crop, x / bw, y / bh, (r - x) / bw, (d - y) / bh);
    gl.uniform2f(bloom.u.lens, lens, (lens * h) / w);
    gl.uniform2fv(bloom.u.restLens, half);
    gl.uniform3f(bloom.u.eye, pose.x, pose.y, pose.z);
    gl.uniform1f(bloom.u.time, pose.t);
    gl.uniform2f(bloom.u.aim, pose.x * 0.12, verticalAim(pose, ratio));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (last === 2) return;
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    ground(scene);
    if (last === 3) return;
    const ice = this.programs.ice;
    gl.useProgram(ice.id);
    gl.uniform4fv(ice.u.waterPlane, this.meta.plane);
    this.texture(ice.u.baseMap, 4, this.textures[4]);
    this.texture(ice.u.body, 0, this.textures[1]);
    this.texture(ice.u.material, 1, this.textures[2]);
    this.texture(ice.u.behind, 2, copy.tex);
    this.texture(ice.u.environment, 3, this.textures[3]);
    gl.uniform4f(ice.u.crop, x / bw, y / bh, (r - x) / bw, (d - y) / bh);
    gl.uniform2f(ice.u.resolution, w, h);
    gl.uniform1f(ice.u.time, pose.t);
    if (showSlab) this.mesh(ice, this.draws[1], pose, w, h);
    if (last === 4) return;
    gl.bindVertexArray(this.empty);
    const drift = this.programs.drift;
    gl.useProgram(drift.id);
    gl.uniform1f(drift.u.time, pose.t);
    gl.uniform1f(drift.u.dpr, Math.min(2, devicePixelRatio));
    gl.uniform3f(drift.u.eye, pose.x, pose.y, pose.z);
    gl.uniform4fv(drift.u.waterPlane, this.meta.plane);
    gl.uniform2f(drift.u.lens, lens, lens / ratio);
    gl.uniform2f(drift.u.aim, pose.x * 0.12, verticalAim(pose, ratio));
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, 540);
    gl.depthMask(true);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.DEPTH_ATTACHMENT]);
    if (last === 5) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, output);
    gl.viewport(0, 0, w, h);
    const post = this.programs.post;
    gl.useProgram(post.id);
    this.texture(post.u.scene, 0, scene.tex);
    this.texture(post.u.bloom, 1, a.tex);
    this.texture(post.u.grade, 2, this.lut, true);
    // Project a conservative box around the slab into this camera's gate.
    const dist = 17,
      zoom = dist / (dist - pose.z);
    const sx = (half[0] / lens) * zoom,
      sy = (half[1] / ((lens * h) / w)) * zoom;
    const cx = 0.5 + pose.x * (0.06 - 0.5 / ((dist - pose.z) * lens));
    const cy = 0.5 + verticalAim(pose, ratio) * 0.5 - (pose.y * 0.5) / (((dist - pose.z) * lens * h) / w);
    gl.uniform4f(
      post.u.slabBounds,
      cx + (x / bw - 0.5) * sx - 0.02,
      cy + (0.5 - d / bh) * sy - 0.02,
      cx + (r / bw - 0.5) * sx + 0.02,
      cy + (0.5 - y / bh) * sy + 0.02,
    );
    gl.uniform2f(post.u.invResolution, 1 / w, 1 / h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  get triangles() {
    return this.draws.reduce((n, d) => n + d.info.indices / 3, 0) + this.draws[0].info.indices / 3 + 2;
  }
  async measure(w: number, h: number, breakdown: boolean, pose: Pose = rest) {
    const gl = this.gl;
    this.resize(w, h);
    const memory = this.assetMemory + this.targetMemory;
    const alt = [this.target(w, h, false, false), this.target(w, h, false, false)];
    const pixel = new Uint8Array(4);
    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const flush = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, alt[0].fbo);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    };
    const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1];
    const results: number[] = [],
      cpu: number[] = [];
    try {
      for (let i = 0; i < 5; i++) this.draw(pose, alt[i % 2].fbo);
      flush();
      for (const stage of breakdown ? [1, 2, 3, 4, 5, 6] : [6]) {
        const times: number[] = [];
        for (let rep = 0; rep < 7; rep++) {
          await nextFrame();
          const n = 6;
          if (timer) {
            const q = gl.createQuery()!;
            gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
            const start = performance.now();
            for (let j = 0; j < n; j++) this.draw(pose, alt[j % 2].fbo, stage);
            if (stage === 6) cpu.push((performance.now() - start) / n);
            gl.endQuery(timer.TIME_ELAPSED_EXT);
            gl.flush();
            while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) await nextFrame();
            if (!gl.getParameter(timer.GPU_DISJOINT_EXT))
              times.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 / n);
            gl.deleteQuery(q);
          } else {
            gl.finish();
            const base = performance.now();
            gl.finish();
            const overhead = performance.now() - base;
            const start = performance.now();
            for (let j = 0; j < n; j++) this.draw(pose, alt[j % 2].fbo, stage);
            const submitted = performance.now();
            // Complete intermediate passes as well as the alternating outputs.
            gl.finish();
            times.push((performance.now() - start - overhead) / n);
            if (stage === 6) cpu.push((submitted - start) / n);
          }
        }
        if (!times.length) throw Error('Every GPU timer sample was disjoint');
        results.push(med(times));
      }
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        w,
        h,
        method: timer
          ? 'EXT_disjoint_timer_query_webgl2'
          : 'six draws alternating output targets, synchronized completion less empty synchronization',
        gpu: results.at(-1),
        main: med(cpu),
        cumulative: results,
        textureAndTargetBytes: memory,
        draws: 6,
        triangles: this.triangles,
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
      };
    } finally {
      alt.forEach((t) => this.release(t));
      this.targetMemory = memory - this.assetMemory;
    }
  }
  dispose() {
    this.disposed = true;
    this.cancelLoad?.();
    this.decoder.terminate();
    const g = this.gl;
    this.targets.forEach((t) => this.release(t));
    this.textures.forEach((t) => g.deleteTexture(t));
    g.deleteTexture(this.lut);
    this.buffers.forEach((b) => g.deleteBuffer(b));
    this.draws.forEach((d) => g.deleteVertexArray(d.vao));
    g.deleteVertexArray(this.empty);
    Object.values(this.programs).forEach((p) => g.deleteProgram(p.id));
  }
}
