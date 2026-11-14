import {
  ACESFilmicToneMapping,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CatmullRomCurve3,
  DoubleSide,
  Group,
  LinearMipmapLinearFilter,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  NoColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { CHAPTERS, type Pose } from './poses';
import { story } from '@/lib/story';

/**
 * The loop: one closed band of brushed steel, engraved along its length.
 * The page scrolls a camera around it. Nothing else lives in the scene.
 */

const TAU = Math.PI * 2;
const BAND_W = 0.92;
const BAND_T = 0.085;
/** Where the three probe rings sit along the loop (0..1). */
const GATE_U = [0.07, 0.11, 0.15];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

function loopPoint(t: number, out: Vector3) {
  // A figure eight that also travels in depth, so the two lobes never touch.
  const x = Math.cos(t) * 6.4;
  const y = Math.sin(2 * t) * 2.7;
  const z = Math.sin(t) * 1.9 + Math.sin(3 * t) * 0.55;
  return out.set(x, y, z);
}

function buildCurve() {
  const pts: Vector3[] = [];
  const n = 220;
  for (let i = 0; i < n; i++) pts.push(loopPoint((i / n) * TAU, new Vector3()));
  return new CatmullRomCurve3(pts, true, 'centripetal');
}

/** Cross-section: a flat strip with fully rounded edges. Returns points, normals and v. */
function profile(edgeSteps: number) {
  const r = BAND_T / 2;
  const half = BAND_W / 2 - r;
  const pts: { x: number; y: number; nx: number; ny: number; d: number }[] = [];
  let d = 0;
  const push = (x: number, y: number, nx: number, ny: number, step: number) => {
    d += step;
    pts.push({ x, y, nx, ny, d });
  };
  // top face, left to right
  push(-half, r, 0, 1, 0);
  push(half, r, 0, 1, half * 2);
  // right edge
  for (let i = 1; i <= edgeSteps; i++) {
    const a = Math.PI / 2 - (i / edgeSteps) * Math.PI;
    push(half + Math.cos(a) * r, Math.sin(a) * r, Math.cos(a), Math.sin(a), (Math.PI * r) / edgeSteps);
  }
  // bottom face, right to left
  push(-half, -r, 0, -1, half * 2);
  // left edge
  for (let i = 1; i <= edgeSteps; i++) {
    const a = -Math.PI / 2 - (i / edgeSteps) * Math.PI;
    push(-half + Math.cos(a) * r, Math.sin(a) * r, Math.cos(a), Math.sin(a), (Math.PI * r) / edgeSteps);
  }
  const total = d;
  return { pts: pts.map((p) => ({ ...p, v: p.d / total })), perimeter: total };
}

function buildBand(curve: CatmullRomCurve3, segments: number, edgeSteps: number) {
  const { pts, perimeter } = profile(edgeSteps);
  const frames = curve.computeFrenetFrames(segments, true);
  const ring = pts.length;
  const pos = new Float32Array((segments + 1) * ring * 3);
  const nor = new Float32Array((segments + 1) * ring * 3);
  const uv = new Float32Array((segments + 1) * ring * 2);
  const p = new Vector3();
  const N = new Vector3();
  const B = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const k = i % segments;
    curve.getPointAt(u % 1, p);
    // one full twist around the loop, plus a slow breathing twist so faces catch the light
    const twist = u * TAU + Math.sin(u * TAU * 2) * 0.55;
    const c = Math.cos(twist);
    const s = Math.sin(twist);
    N.copy(frames.normals[k]).multiplyScalar(c).addScaledVector(frames.binormals[k], s);
    B.copy(frames.binormals[k]).multiplyScalar(c).addScaledVector(frames.normals[k], -s);
    for (let j = 0; j < ring; j++) {
      const q = pts[j];
      const o = (i * ring + j) * 3;
      pos[o] = p.x + B.x * q.x + N.x * q.y;
      pos[o + 1] = p.y + B.y * q.x + N.y * q.y;
      pos[o + 2] = p.z + B.z * q.x + N.z * q.y;
      nor[o] = B.x * q.nx + N.x * q.ny;
      nor[o + 1] = B.y * q.nx + N.y * q.ny;
      nor[o + 2] = B.z * q.nx + N.z * q.ny;
      const t = (i * ring + j) * 2;
      uv[t] = u;
      uv[t + 1] = q.v;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < ring; j++) {
      const j2 = (j + 1) % ring;
      // the profile is closed: the last point connects back to the first (same position, v wraps)
      if (j2 === 0) continue;
      const a = i * ring + j;
      const b = (i + 1) * ring + j;
      const c2 = (i + 1) * ring + j2;
      const d2 = i * ring + j2;
      idx.push(a, b, d2, b, c2, d2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  return { geometry: g, perimeter, length: curve.getLength() };
}

/** Engraving: drawn once into a canvas, repeated along the loop. */
function buildEngraving(width: number, height: number, fonts: { display: string; mono: string }) {
  const color = document.createElement('canvas');
  color.width = width;
  color.height = height;
  const rough = document.createElement('canvas');
  rough.width = width;
  rough.height = height;
  const c = color.getContext('2d')!;
  const r = rough.getContext('2d')!;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, width, height);
  // base roughness: mid grey, then brushed streaks along the length
  r.fillStyle = 'rgb(86,86,86)';
  r.fillRect(0, 0, width, height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < height * 9; i++) {
    const y = rnd() * height;
    const x = rnd() * width;
    const len = (0.04 + rnd() * 0.3) * width;
    const g = 50 + Math.floor(rnd() * 90);
    r.fillStyle = `rgba(${g},${g},${g},${0.1 + rnd() * 0.22})`;
    r.fillRect(x, y, len, 1 + rnd() * 1.2);
    if (x + len > width) r.fillRect(0, y, x + len - width, 1);
  }

  // Face rows. v: top face 0..0.4336, bottom face 0.5..0.9336 (see profile()).
  const faceH = height * 0.4336;
  const rows = [
    { y0: 0, flip: false },
    // No flip: the profile already runs the bottom face right to left, so seen from below it reads true.
    { y0: height * 0.5, flip: false },
  ];
  const ink = '#111214';
  const mark = (fn: (ctx: CanvasRenderingContext2D, isRough: boolean) => void) => {
    fn(c, false);
    fn(r, true);
  };

  rows.forEach((row, ri) => {
    mark((ctx, isRough) => {
      ctx.save();
      ctx.translate(0, row.y0);
      if (row.flip) {
        ctx.translate(0, faceH);
        ctx.scale(1, -1);
      }
      ctx.fillStyle = isRough ? 'rgb(215,215,215)' : ink;
      ctx.strokeStyle = ctx.fillStyle;
      const pad = faceH * 0.1;
      // ruler along the upper edge
      const step = width / 256;
      for (let i = 0; i < 256; i++) {
        const major = i % 16 === 0;
        const mid = i % 8 === 0;
        const h = major ? faceH * 0.2 : mid ? faceH * 0.12 : faceH * 0.065;
        ctx.fillRect(i * step, pad, Math.max(2, width / 4096), h);
      }
      for (let i = 0; i < 128; i++) {
        if (i % 4 === 3) continue;
        ctx.fillRect(i * step * 2 + step * 0.3, faceH * 0.46, step * 1.1, Math.max(1.5, height / 512));
      }
      ctx.textBaseline = 'alphabetic';
      const big = faceH * 0.3;
      const small = faceH * 0.075;
      const baseline = faceH - pad * 1.15;
      const words =
        ri === 0
          ? ['ARAV JAIN', 'AGENTS', 'DEV TOOLS', 'INFINIFLOP LABS']
          : ['BUILD', 'PROBE', 'BREAK', 'FIX', 'AGAIN'];
      const labels =
        ri === 0
          ? ['LOOP 01', '2020 TO NOW', 'OPEN SOURCE', 'EST 2026']
          : ['RUN 0001', 'RUN 0002', 'RUN 0003', 'RUN 0004', 'RUN 0005'];
      const slot = width / words.length;
      words.forEach((w, i) => {
        const x = i * slot + slot * 0.06;
        ctx.font = `600 ${big}px ${fonts.display}`;
        // tighten tracking by hand: canvas letterSpacing is not everywhere
        (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${-big * 0.045}px`;
        ctx.fillText(w, x, baseline);
        const wide = ctx.measureText(w).width;
        (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${small * 0.08}px`;
        ctx.font = `500 ${small}px ${fonts.mono}`;
        ctx.fillText(labels[i], x + wide + small * 1.6, baseline);
        ctx.fillText(String(i + 1).padStart(2, '0') + ' / ' + String(words.length).padStart(2, '0'), x + wide + small * 1.6, baseline - small * 1.7);
        // a registration cross between slots
        const cx = x + slot * 0.9;
        const cy = faceH * 0.62;
        const arm = faceH * 0.07;
        ctx.fillRect(cx - arm, cy - 1.5, arm * 2, 3);
        ctx.fillRect(cx - 1.5, cy - arm, 3, arm * 2);
      });
      ctx.restore();
    });
  });
  return { color, rough };
}

export type EngineOptions = {
  /** Called once if a shader fails to compile, so the page can fall back to the still image. */
  onFail?: () => void;
  canvas: HTMLCanvasElement;
  fonts: { display: string; mono: string };
  lowPower: boolean;
};

export class Engine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(32, 1, 0.1, 80);
  private group = new Group();
  private band: Mesh;
  private material: MeshPhysicalMaterial;
  private maps: CanvasTexture[] = [];
  private gates: Mesh[] = [];
  private gateMats: MeshBasicMaterial[] = [];
  private pmrem: PMREMGenerator;
  private envScene = new Scene();
  private envFloor: MeshBasicMaterial;
  private envTarget: WebGLRenderTarget | null = null;
  private envColor = new Color('#ffd60a');
  private envApplied = new Color(-1, -1, -1);
  private envGoal = new Color('#ffd60a');
  private envStamp = 0;
  private cur: Pose | null = null;
  private target: Pose = CHAPTERS.hero[0];
  private pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  private flow = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private fogUniforms = { uNear: { value: 8 }, uFar: { value: 20 } };
  private look = new Vector3();
  private tmp = new Vector3();
  private intro = 0;
  private introTarget = 0;
  ready = false;
  failed = false;

  /** Builds the scene in three tasks so no single one blocks the main thread for long. */
  static async create(opts: EngineOptions) {
    const pause = () => new Promise<void>((r) => setTimeout(r, 0));
    const maxSide = opts.lowPower ? 4096 : 8192;
    const art = buildEngraving(maxSide, maxSide / 8, opts.fonts);
    await pause();
    const curve = buildCurve();
    const band = buildBand(curve, opts.lowPower ? 520 : 900, opts.lowPower ? 4 : 6);
    await pause();
    return new Engine(opts, art, curve, band);
  }

  private constructor(
    private opts: EngineOptions,
    art: ReturnType<typeof buildEngraving>,
    curve: CatmullRomCurve3,
    built: ReturnType<typeof buildBand>,
  ) {
    const { canvas } = opts;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.debug.onShaderError = () => {
      if (this.failed) return;
      this.failed = true;
      opts.onFail?.();
    };
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = SRGBColorSpace;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'A loop of engraved steel band turning slowly in space.');

    // Environment: a dark studio with softboxes and a floor that takes the page colour.
    const wall = new Mesh(new SphereGeometry(30, 24, 16), new MeshBasicMaterial({ color: 0x101012, side: BackSide }));
    this.envScene.add(wall);
    const box = (w: number, h: number, intensity: number, pos: [number, number, number], rot: [number, number, number]) => {
      const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(intensity, intensity, intensity), side: DoubleSide }));
      m.position.set(...pos);
      m.rotation.set(...rot);
      this.envScene.add(m);
    };
    box(16, 9, 5.5, [0, 13, 2], [Math.PI / 2, 0, 0]); // overhead
    box(3, 18, 9, [-15, 3, 4], [0, Math.PI / 2, 0]); // left strip
    box(2, 14, 7, [15, 2, -3], [0, -Math.PI / 2, 0]); // right strip
    box(12, 2.2, 6, [0, 4, 15], [0, Math.PI, 0]); // front bar, behind camera
    box(7, 1.2, 4, [3, -2, -15], [0, 0, 0]); // back kicker
    box(14, 1.6, 5, [-2, -6.6, 6], [-Math.PI / 2, 0, 0.5]); // floor strip, so undersides get a highlight too
    box(1.2, 10, 4, [9, -6.6, -4], [-Math.PI / 2, 0, -0.3]);
    this.envFloor = new MeshBasicMaterial({ color: this.envColor.clone(), side: DoubleSide });
    const floor = new Mesh(new PlaneGeometry(80, 80), this.envFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -7;
    this.envScene.add(floor);
    this.pmrem = new PMREMGenerator(this.renderer);

    // The band.
    const { geometry, perimeter, length } = built;
    const { color, rough } = art;
    const unitsPerRepeat = (color.width / color.height) * perimeter;
    const repeat = Math.max(1, Math.round(length / unitsPerRepeat));
    const mk = (src: HTMLCanvasElement, srgb: boolean) => {
      const t = new CanvasTexture(src);
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(repeat, 1);
      t.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
      t.minFilter = LinearMipmapLinearFilter;
      t.magFilter = LinearFilter;
      t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
      this.maps.push(t);
      return t;
    };
    const map = mk(color, true);
    const roughnessMap = mk(rough, false);
    this.material = new MeshPhysicalMaterial({
      color: 0xd9dbde,
      metalness: 1,
      roughness: 1,
      map,
      roughnessMap,
      anisotropy: 0.55,
      envMapIntensity: 1.15,
      transparent: true,
    });
    // Distance fades to transparent instead of to a fog colour, so the page ground shows through exactly.
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uNear = this.fogUniforms.uNear;
      shader.uniforms.uFar = this.fogUniforms.uFar;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vDepthFade;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvDepthFade = -mvPosition.z;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNear;\nuniform float uFar;\nvarying float vDepthFade;')
        .replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\nfloat fade = 1.0 - smoothstep(uNear, uFar, vDepthFade);\ngl_FragColor.rgb *= fade;\ngl_FragColor.a *= fade;',
        );
    };
    this.material.premultipliedAlpha = true;
    this.band = new Mesh(geometry, this.material);
    this.band.frustumCulled = false;
    this.group.add(this.band);

    // Probe gates: three rings the band runs through, one per verb (review, probe, stress-test).
    const ringGeo = new TorusGeometry(0.78, 0.011, 8, 128);
    const tan = new Vector3();
    const at = new Vector3();
    for (const u of GATE_U) {
      const mat = new MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0, depthWrite: false });
      const ring = new Mesh(ringGeo, mat);
      curve.getPointAt(u, at);
      curve.getTangentAt(u, tan);
      ring.position.copy(at);
      ring.lookAt(at.clone().add(tan));
      ring.visible = false;
      this.gates.push(ring);
      this.gateMats.push(mat);
      this.group.add(ring);
    }
    this.scene.add(this.group);
    this.resize();
  }

  setPointer(x: number, y: number) {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  /** 0 hides the band in the distance, 1 is the settled scene. Used by the loading moment. */
  setIntro(v: number) {
    this.introTarget = v;
  }

  resize() {
    const c = this.opts.canvas;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.lowPower ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private updateEnv(now: number) {
    if (now - this.envStamp < 90 && this.envTarget) return;
    const d =
      Math.abs(this.envApplied.r - this.envColor.r) + Math.abs(this.envApplied.g - this.envColor.g) + Math.abs(this.envApplied.b - this.envColor.b);
    if (d < 0.012 && this.envTarget) return;
    this.envStamp = now;
    this.envApplied.copy(this.envColor);
    this.envFloor.color.copy(this.envColor).multiplyScalar(0.3);
    const next = this.pmrem.fromScene(this.envScene, 0.035, 0.1, 100);
    this.scene.environment = next.texture;
    this.envTarget?.dispose();
    this.envTarget = next;
  }

  private poseAt(): Pose {
    if (process.env.NODE_ENV !== 'production') {
      const dbg = (window as unknown as { __pose?: Partial<Pose> }).__pose;
      if (dbg) return { ...CHAPTERS.hero[0], ...dbg };
    }
    const list = CHAPTERS[story.chapter] ?? CHAPTERS.hero;
    // Reduced motion: one resting pose per chapter, no travel between them.
    if (story.reduced) {
      const rest = list[story.chapter === 'hero' || story.chapter.startsWith('head') ? 0 : Math.min(1, list.length - 1)];
      // long static lists scroll over the canvas under reduced motion, so the band steps out for them
      return story.chapter === 'rules' || story.chapter === 'timeline' ? { ...rest, near: 0, far: 0.02 } : rest;
    }
    const f = clamp(story.local) * (list.length - 1);
    const i = Math.min(list.length - 2, Math.floor(f));
    if (list.length === 1) return list[0];
    return mixPose(list[i], list[i + 1], ease(f - i));
  }

  render(now: number, still = false) {
    if (this.failed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.target = this.poseAt();
    // Phones show the ventures as a plain column with nowhere for the band to stand clear, so it steps out.
    if (this.camera.aspect < 0.8 && story.chapter === 'timeline') this.target = { ...this.target, near: 0, far: 0.02 };
    if (!this.cur) this.cur = clonePose(this.target);
    // Critically damped follow: always from the presentation value, so scroll and pointer can interrupt.
    const k = still ? 1 : 1 - Math.exp(-dt * 5.2);
    this.cur = mixPose(this.cur, this.target, k);
    const p = this.cur;
    this.intro = still ? this.introTarget : lerp(this.intro, this.introTarget, 1 - Math.exp(-dt * 2.6));

    const portrait = this.camera.aspect < 0.8;
    const pk = still ? 1 : 1 - Math.exp(-dt * 3.2);
    this.pointer.sx = lerp(this.pointer.sx, this.pointer.x, pk);
    this.pointer.sy = lerp(this.pointer.sy, this.pointer.y, pk);
    const back = (portrait ? p.portraitBack : 0) + (1 - ease(this.intro)) * 9;
    const dir = new Vector3(p.cam[0] - p.look[0], p.cam[1] - p.look[1], p.cam[2] - p.look[2]);
    const dist = dir.length();
    dir.normalize();
    this.camera.position.set(p.cam[0], p.cam[1], p.cam[2]).addScaledVector(dir, back);
    // pointer parallax: slide the camera on its own right and up axes
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), dir).normalize();
    const up = new Vector3().crossVectors(dir, right);
    const par = still ? 0 : dist * 0.045;
    this.camera.position.addScaledVector(right, this.pointer.sx * par).addScaledVector(up, -this.pointer.sy * par * 0.7);
    this.look.set(p.look[0], p.look[1], p.look[2]);
    const roll = portrait ? p.proll : p.roll;
    this.camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    this.camera.lookAt(this.look);
    this.camera.fov = portrait ? p.fov * 1.25 : p.fov;
    const sh = portrait ? p.pshift : p.shift;
    // setViewOffset also rebuilds the projection matrix
    this.camera.setViewOffset(this.w, this.h, -sh[0] * this.w, sh[1] * this.h, this.w, this.h);

    if (!still) this.flow += dt * p.flow;
    for (const t of this.maps) t.offset.x = this.flow;
    this.group.rotation.set(p.rot[0], p.rot[1] + (still ? 0 : Math.sin(now / 5200) * 0.035), p.rot[2] + (1 - ease(this.intro)) * 0.9);

    this.fogUniforms.uNear.value = p.near + back;
    this.fogUniforms.uFar.value = p.far + back;
    // one bright ring travels down the line, the rest idle dim: a probe pass
    const head = still ? 1 : ((now / 620) % (this.gates.length + 2)) - 1;
    for (let i = 0; i < this.gates.length; i++) {
      const d = Math.abs(i - head);
      this.gateMats[i].opacity = p.gates * (0.55 + 0.45 * Math.max(0, 1 - d));
      this.gates[i].visible = p.gates > 0.01;
      // each ring breathes a little as the scan passes it
      const sc = 1 + 0.05 * Math.max(0, 1 - d);
      this.gates[i].scale.setScalar(sc);
    }
    this.material.envMapIntensity = p.env;

    // the floor bounce eases toward the chapter colour instead of cutting with it
    this.envColor.lerp(this.envGoal.set(story.ground), still ? 1 : 1 - Math.exp(-dt * 3.5));
    this.updateEnv(now);
    this.renderer.render(this.scene, this.camera);
    // screen anchors for the DOM labels that hang off the probe rings
    for (let i = 0; i < this.gates.length; i++) {
      // anchor on the ring's upper rim rather than its centre, so the leader starts on the ring
      const v = this.tmp.set(0, 0.78, 0).applyMatrix4(this.gates[i].matrixWorld).project(this.camera);
      const a = story.anchors[i];
      a.x = (v.x * 0.5 + 0.5) * this.w;
      a.y = (-v.y * 0.5 + 0.5) * this.h;
      a.on = v.z < 1 && p.gates > 0.5 ? 1 : 0;
    }
    this.ready = true;
  }

  dispose() {
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.band.geometry.dispose();
    this.material.dispose();
    for (const t of this.maps) t.dispose();
    for (const m of this.gateMats) m.dispose();
    this.renderer.dispose();
  }
}

function clonePose(p: Pose): Pose {
  return { ...p, cam: [...p.cam], look: [...p.look], rot: [...p.rot], shift: [...p.shift], pshift: [...p.pshift] };
}

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const v3 = (x: [number, number, number], y: [number, number, number]): [number, number, number] => [
    lerp(x[0], y[0], t),
    lerp(x[1], y[1], t),
    lerp(x[2], y[2], t),
  ];
  return {
    cam: v3(a.cam, b.cam),
    look: v3(a.look, b.look),
    rot: v3(a.rot, b.rot),
    roll: lerp(a.roll, b.roll, t),
    proll: lerp(a.proll, b.proll, t),
    fov: lerp(a.fov, b.fov, t),
    flow: lerp(a.flow, b.flow, t),
    near: lerp(a.near, b.near, t),
    far: lerp(a.far, b.far, t),
    gates: lerp(a.gates, b.gates, t),
    env: lerp(a.env, b.env, t),
    portraitBack: lerp(a.portraitBack, b.portraitBack, t),
    shift: [lerp(a.shift[0], b.shift[0], t), lerp(a.shift[1], b.shift[1], t)],
    pshift: [lerp(a.pshift[0], b.pshift[0], t), lerp(a.pshift[1], b.pshift[1], t)],
  };
}
