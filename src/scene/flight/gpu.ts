import { LakeGPU, nextFrame, rest, type Pose } from '../lake/gpu';
import { mount } from '../lake/live';
import { fullVertex } from '../lake/shaders';
import { ridgeFragment, ridgeVertex } from './ridge';
import { plateFragment } from './plate';
import { see } from '../observe';
import { flightLength, position, scenes, starts, type Gate, type Plate, type Theme } from './scenes';

type Transfer =
  | {
      kind: 'size';
      slot: number;
      width: number;
      height: number;
      start: number;
      end: number;
      url: string;
      bytes: number;
    }
  | { kind: 'strip'; slot: number; y: number; strip: ImageBitmap }
  | { kind: 'error'; message: string }
  | { kind: 'done' };
type Resident = {
  textures: WebGLTexture[];
  bytes: number;
  ready: boolean;
  queue: Transfer[];
  worker: Worker;
};
class FlightGPU extends LakeGPU {
  private readonly resident = new Map<number, Resident>();
  private readonly failed = new Map<number, number>();
  private lakeReady = false;
  private lakePending = false;
  private lakeBytes = 0;
  private primed = false;
  private cursor = 0;
  private readonly tiny: WebGLFramebuffer;
  private readonly pixel: WebGLRenderbuffer;
  private shown = -2;
  /** A cut across scenes that are not neighbours: one whiteout from where the picture is to where the reader is. */
  private jump: { from: number; to: number; at: number; t: number } | null = null;
  private fence: { index: number; sync: WebGLSync | null } | null = null;
  constructor(
    canvas: HTMLCanvasElement,
    private readonly theme: Theme,
    private readonly gate: Gate,
    readonly reduced: boolean,
    /** Told which scene's words belong on the picture now (-1: none, a whiteout is passing). */
    private readonly show: (index: number) => void,
  ) {
    super(canvas);
    const gl = this.gl;
    this.tiny = gl.createFramebuffer()!;
    this.pixel = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.pixel);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA16F, 2, 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tiny);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.pixel);
    document.addEventListener('visibilitychange', this.visibility);
  }
  private readonly visibility = () => {
    for (const r of this.resident.values()) if (!r.ready) r.worker.postMessage({ paused: document.hidden });
  };
  protected extraPrograms() {
    return { plate: [fullVertex, plateFragment], ridge: [ridgeVertex, ridgeFragment] };
  }
  async load() {
    this.lakePending = true;
    const before = this.assetMemory - this.lakeBytes;
    if (this.lut) this.assetMemory -= 98304;
    try {
      const opening = scenes[0];
      if (opening.kind !== 'lake') throw Error('The opening scene requires a lake survey');
      await super.load(this.theme, this.gate, opening.root, opening.cameras);
      this.lakeBytes = this.assetMemory - before;
      if (this.primed && !this.disposed) {
        super.draw({ ...rest, progress: 1 }, this.tiny);
        const gl = this.gl,
          sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        while (!this.disposed && sync && gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED)
          await nextFrame();
        gl.deleteSync(sync);
      }
      this.lakeReady = true;
    } finally {
      this.lakePending = false;
    }
  }
  private ready(index: number) {
    return index === 0 ? this.lakeReady : !!this.resident.get(index)?.ready;
  }
  private request(index: number) {
    if (
      index < 0 ||
      index >= scenes.length ||
      this.ready(index) ||
      performance.now() < (this.failed.get(index) ?? 0)
    )
      return;
    if (index === 0) {
      if (!this.lakePending) void this.load().catch(() => this.failed.set(0, performance.now() + 1500));
      return;
    }
    const scene = scenes[index];
    if (scene.kind !== 'plate' || this.resident.has(index)) return;
    const worker = new Worker('/scene/plate.worker.js');
    const entry: Resident = { textures: [], bytes: 0, ready: false, queue: [], worker };
    this.failed.delete(index);
    this.resident.set(index, entry);
    worker.onmessage = ({ data }: { data: Transfer }) => entry.queue.push(data);
    worker.onerror = (e) => entry.queue.push({ kind: 'error', message: e.message });
    const field = scene.fields[this.gate];
    performance.mark(scene.id + ':request');
    const files = [...field[this.theme]];
    if (scene.layerFields) files.push(scene.layerFields.wind, scene.layerFields.silhouettes[this.gate]);
    worker.postMessage({ urls: files.map((path) => scene.root + path) });
  }
  private releaseScene(index: number) {
    if (index === 0) {
      if (this.lakeReady) {
        this.releaseLake();
        this.lakeReady = false;
        this.assetMemory -= this.lakeBytes - 98304; // The shared 32-cubed LUT remains.
        this.lakeBytes = 98304;
      }
      return;
    }
    const scene = this.resident.get(index);
    if (!scene) return;
    scene.worker.terminate();
    for (const msg of scene.queue) if (msg.kind === 'strip') msg.strip.close();
    scene.textures.forEach((t) => this.gl.deleteTexture(t));
    this.assetMemory -= scene.bytes;
    this.resident.delete(index);
  }
  private upload() {
    const gl = this.gl;
    if (this.fence) {
      const { index, sync } = this.fence;
      if (sync && gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return;
      gl.deleteSync(sync);
      this.fence = null;
      const r = this.resident.get(index);
      if (r) {
        r.ready = true;
        performance.mark(scenes[index].id + ':ready');
      }
    }
    for (const [index, r] of this.resident) {
      const msg = r.queue.shift();
      if (!msg) continue;
      const scene = scenes[index] as Plate;
      if (msg.kind === 'error') {
        console.error(scene.id, msg.message);
        this.releaseScene(index);
        this.failed.set(index, performance.now() + 1500);
      } else if (msg.kind === 'size') {
        performance.measure(scene.id + ':fetch:' + msg.url.split('/').at(-1), {
          start: Math.max(0, msg.start - performance.timeOrigin),
          end: Math.max(0, msg.end - performance.timeOrigin),
          detail: msg.bytes,
        });
        const tex = gl.createTexture()!;
        r.textures[msg.slot] = tex;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texStorage2D(gl.TEXTURE_2D, 1, msg.slot === 1 ? gl.RGBA8 : gl.R8, msg.width, msg.height);
        this.filter(gl.TEXTURE_2D, false);
        r.bytes += msg.width * msg.height * (msg.slot === 1 ? 4 : 1);
        this.assetMemory += msg.width * msg.height * (msg.slot === 1 ? 4 : 1);
      } else if (msg.kind === 'strip') {
        gl.bindTexture(gl.TEXTURE_2D, r.textures[msg.slot]);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          msg.y,
          msg.slot === 1 ? gl.RGBA : gl.RED,
          gl.UNSIGNED_BYTE,
          msg.strip,
        );
        msg.strip.close();
        performance.mark(scene.id + ':upload:' + msg.slot + ':' + msg.y);
      } else {
        r.worker.terminate();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.tiny);
        gl.viewport(0, 0, 2, 2);
        this.plate(index, rest, 1);
        this.plate(index, rest, 0.5);
        this.fence = { index, sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) };
        gl.flush();
        performance.mark(scene.id + ':warm');
      }
      break;
    }
  }
  /** Where a position rests inside its own scene: never in a whiteout. */
  private settle(wanted: number, index: number) {
    return Math.min(starts[index] + scenes[index].screens, Math.max(starts[index], wanted));
  }
  /**
   * Before the canvas is shown: start at the reader's own scene (a reload or
   * a way back deep in the page), not at the lake with eleven scenes to cross.
   */
  async place(wanted: number) {
    const index = position(wanted).index;
    if (index > 0) {
      while (!this.disposed && !this.ready(index)) {
        this.request(index);
        this.upload();
        await nextFrame();
      }
    }
    this.cursor = this.settle(wanted, index);
    see(index, index, 0, position(this.cursor).progress);
    return this.cursor;
  }
  private tell(show: number) {
    if (show === this.shown) return;
    this.shown = show;
    this.show(show);
  }
  /** Advance only over contiguous, warmed scenes, in either direction. */
  advance(wanted: number, dt: number) {
    this.upload();
    const old = position(this.cursor);
    const want = position(wanted);
    if (!this.jump && old.mix === 0 && Math.abs(want.index - old.index) > 1)
      this.jump = { from: old.index, to: want.index, at: this.settle(wanted, want.index), t: 0 };
    const jump = this.jump;
    if (jump) {
      if (want.index === jump.to) jump.at = this.settle(wanted, jump.to);
      else if (jump.t === 0 && Math.abs(want.index - jump.from) <= 1) {
        // The reader came back before the cut began.
        if (want.index !== jump.to) this.releaseScene(jump.to);
        this.jump = null;
        return this.cursor;
      }
      this.request(jump.to);
      for (let i = 0; i < scenes.length; i++) if (i !== jump.from && i !== jump.to) this.releaseScene(i);
      if (this.ready(jump.to)) jump.t = Math.min(1, jump.t + dt / 0.72);
      this.tell(jump.t < 0.08 ? jump.from : jump.t > 0.92 ? jump.to : -1);
      see(jump.from, jump.to, jump.t, old.progress);
      if (jump.t >= 1) {
        this.cursor = jump.at;
        this.jump = null;
        this.releaseScene(jump.from);
      }
      return this.cursor;
    }
    let target = wanted;
    if (wanted >= this.cursor) {
      if (old.index + 1 < scenes.length && wanted > starts[old.index] + 0.18) {
        this.releaseScene(old.index - 1);
        this.request(old.index + 1);
      }
      if (!this.ready(old.index + 1))
        target = Math.min(target, starts[old.index] + scenes[old.index].screens);
    } else {
      if (old.index > 0 && old.mix === 0) {
        this.releaseScene(old.index + 1);
        this.request(old.index - 1);
      }
      if (!this.ready(old.index - 1)) target = Math.max(target, starts[old.index]);
    }
    this.cursor += Math.sign(target - this.cursor) * Math.min(Math.abs(target - this.cursor), dt * 5.5);
    const now = position(this.cursor);
    for (let i = 0; i < scenes.length; i++) if (Math.abs(i - now.index) > 1) this.releaseScene(i);
    this.tell(now.mix > 0.08 && now.mix < 0.92 ? -1 : now.index + Number(now.mix >= 0.92));
    see(now.index, Math.min(now.index + 1, scenes.length - 1), now.mix, now.progress);
    return this.cursor;
  }
  private plate(index: number, pose: Pose, blend: number, textures = this.resident.get(index)!.textures) {
    const gl = this.gl;
    const scene = scenes[index] as Plate,
      cam = scene.cameras[this.gate];
    const ratio = this.canvas.width / this.canvas.height;
    const projection = cam.projection;
    const program = projection ? this.programs.ridge : this.programs.plate,
      u = program.u;
    gl.useProgram(program.id);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    if (blend < 1) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.bindVertexArray(this.empty);
    this.texture(u.plate, 0, textures[0]);
    this.texture(u.survey, 1, textures[1]);
    if (projection) {
      gl.uniform3f(u.track, cam.aimPerMetre[0], cam.aimPerMetre[1], cam.sidestep);
      this.texture(u.wind, 2, textures[2]);
      this.texture(u.silhouettes, 3, textures[3]);
      gl.uniform2fv(u.atlasScale, projection.scale);
      gl.uniform3fv(u.floorPlane, projection.ground);
      gl.uniform3fv(u.nearPlane, projection.near.plane);
      gl.uniform3fv(u.jawPlane, projection.jaw.plane);
      gl.uniform4fv(u.nearBounds, projection.near.bounds);
      gl.uniform4fv(u.jawBounds, projection.jaw.bounds);
      gl.uniform2fv(u.nearOffset, projection.near.offset);
      gl.uniform2fv(u.jawOffset, projection.jaw.offset);
    }
    gl.uniform2f(u.cover, 0.987 * Math.min(1, ratio / cam.aspect), 0.987 * Math.min(1, cam.aspect / ratio));
    gl.uniform2fv(u.focus, cam.focus);
    const lean = projection ? 0.22 : 0.025;
    gl.uniform2f(u.lean, pose.x * lean, pose.y * lean * 1.04);
    gl.uniform1f(u.push, this.reduced ? 0 : pose.progress * cam.push);
    gl.uniform1f(u.time, pose.t);
    gl.uniform1f(u.transition, blend);
    gl.uniform1f(u.night, Number(this.theme === 'night'));
    gl.uniform1f(u.reduce, Number(this.reduced));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }
  draw(pose: Pose, output: WebGLFramebuffer | null = null, last = 6, slab = true) {
    if (!this.primed && scenes.length > 1) {
      // Trigger Metal pipeline specialization with both blending states while
      // the opening poster still covers the canvas. No station bytes requested.
      const gl = this.gl,
        stub = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, stub);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1, 1);
      this.filter(gl.TEXTURE_2D, false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.tiny);
      gl.viewport(0, 0, 2, 2);
      this.plate(1, rest, 1, [stub, stub, stub, stub]);
      this.plate(1, rest, 0.5, [stub, stub, stub, stub]);
      gl.deleteTexture(stub);
      this.primed = true;
    }
    const { index, mix, progress } = position(pose.progress);
    const camera = { ...pose, progress: this.reduced ? 0 : progress };
    const jump = this.jump;
    if (jump && jump.t > 0) {
      // One scene under, the other brought in (or taken away) through the whiteout.
      const there = { ...pose, progress: this.reduced ? 0 : position(jump.at).progress };
      const gl = this.gl,
        target = this.targets[0];
      const lake = jump.to === 0 ? there : jump.from === 0 ? camera : null;
      if (lake) super.draw(lake, output, 5, slab);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      if (jump.to === 0) this.plate(jump.from, camera, 1 - jump.t);
      else {
        if (jump.from > 0) this.plate(jump.from, camera, 1);
        this.plate(jump.to, there, jump.t);
      }
      this.finishComposition(output);
      return;
    }
    if (index === 0 && !mix) {
      super.draw(camera, output, last, slab);
      return;
    }
    const target = this.targets[0],
      gl = this.gl;
    if (index === 0) super.draw(camera, output, 5, slab);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.w, target.h);
    if (index > 0) this.plate(index, camera, 1);
    if (mix) this.plate(index + 1, { ...camera, progress: 0 }, mix);
    this.finishComposition(output);
  }
  protected drawCounts(portrait: boolean, pose: Pose) {
    const { index, mix } = position(pose.progress);
    if (index > 0) return { draws: mix ? 4 : 3, triangles: mix ? 4 : 3 };
    const lake = super.drawCounts(portrait, pose);
    return { draws: lake.draws + (mix ? 2 : 0), triangles: lake.triangles + (mix ? 2 : 0) };
  }
  async prepareMeasurement(s: number) {
    const p = position(s);
    const indices = p.mix ? [p.index, p.index + 1] : [p.index];
    for (const i of indices) this.request(i);
    while (!this.disposed && indices.some((i) => !this.ready(i))) {
      if (indices.some((i) => this.failed.has(i))) throw Error('Scene could not be prepared');
      this.upload();
      await nextFrame();
    }
  }
  stats() {
    return {
      screens: this.cursor,
      bytes: this.assetMemory + this.targetMemory,
      ready: scenes.filter((_, i) => this.ready(i)).map((s) => s.id),
    };
  }
  dispose() {
    document.removeEventListener('visibilitychange', this.visibility);
    for (const index of this.resident.keys()) this.releaseScene(index);
    if (this.fence) this.gl.deleteSync(this.fence.sync);
    this.gl.deleteFramebuffer(this.tiny);
    this.gl.deleteRenderbuffer(this.pixel);
    super.dispose();
  }
}

export function mountFlight(
  canvas: HTMLCanvasElement,
  theme: Theme,
  signal: AbortSignal,
  gate: Gate,
  reduced: boolean,
  /** One screen of scroll, in pixels: the page's sections are laid out in these. */
  unit: () => number,
  show: (index: number) => void,
) {
  return mount(canvas, theme, signal, new FlightGPU(canvas, theme, gate, reduced, show), flightLength, unit);
}
