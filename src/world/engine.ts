import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as F from './formations';
import type { Formation, V3 } from './formations';
import { BEATS, SITES, HOLD, LAST, CALM } from './beats';
import { SKY_VERT, SKY_FRAG, WATER_VERT, WATER_FRAG, SWARM_VERT, SWARM_FRAG, RIDGE_VERT, RIDGE_FRAG, FINAL_FRAG, FINAL_VERT } from './shaders';

export type Mode = 'story' | 'calm';
export type Engine = {
  setQ(q: number): void;
  setMode(mode: Mode, opts?: { intro?: boolean }): void;
  setPointer(x: number, y: number, active: boolean): void;
  setCalmScroll(v: number): void;
  spin(dx: number, dy: number): void;
  project(world: V3, out: { x: number; y: number; on: boolean }): void;
  resize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
  readonly q: number;
  readonly count: number;
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/* Sky palette keyed to time of day. Linear-ish colours, tuned by eye. No violet anywhere. */
type Key = { t: number; zen: number[]; mid: number[]; hor: number[]; band: number[]; sunEl: number; exp: number; stars: number };
const KEYS: Key[] = [
  { t: 0.0, zen: [0.0006, 0.0015, 0.004], mid: [0.001, 0.003, 0.008], hor: [0.003, 0.008, 0.018], band: [0, 0, 0], sunEl: -0.3, exp: 1.25, stars: 1 },
  { t: 0.3, zen: [0.001, 0.004, 0.012], mid: [0.003, 0.011, 0.026], hor: [0.008, 0.026, 0.055], band: [0.02, 0.03, 0.04], sunEl: -0.2, exp: 1.2, stars: 0.95 },
  { t: 0.5, zen: [0.003, 0.011, 0.03], mid: [0.01, 0.034, 0.066], hor: [0.03, 0.075, 0.12], band: [0.25, 0.17, 0.08], sunEl: -0.13, exp: 1.12, stars: 0.6 },
  { t: 0.7, zen: [0.005, 0.018, 0.048], mid: [0.014, 0.045, 0.08], hor: [0.05, 0.075, 0.095], band: [0.75, 0.34, 0.06], sunEl: -0.07, exp: 1.08, stars: 0.3 },
  { t: 0.86, zen: [0.007, 0.027, 0.07], mid: [0.026, 0.066, 0.1], hor: [0.14, 0.11, 0.08], band: [1.35, 0.6, 0.1], sunEl: -0.03, exp: 1.04, stars: 0.1 },
  { t: 1.0, zen: [0.011, 0.04, 0.1], mid: [0.045, 0.095, 0.125], hor: [0.3, 0.17, 0.07], band: [2.3, 1.05, 0.22], sunEl: 0.022, exp: 1.0, stars: 0 },
];
function sky(t: number) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1]; const k = clamp01((t - a.t) / (b.t - a.t));
  const mix = (x: number[], y: number[]) => [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
  return { zen: mix(a.zen, b.zen), mid: mix(a.mid, b.mid), hor: mix(a.hor, b.hor), band: mix(a.band, b.band), sunEl: a.sunEl + (b.sunEl - a.sunEl) * k, exp: a.exp + (b.exp - a.exp) * k, stars: a.stars + (b.stars - a.stars) * k };
}

export async function createEngine(canvas: HTMLCanvasElement, opts: { count: number; family: string; mobile: boolean; onProgress: (done: number, total: number) => void }): Promise<Engine> {
  const { mobile } = opts;
  const side = Math.round(Math.sqrt(opts.count));
  const N = side * side;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
  renderer.setClearColor(0x04070c, 1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const maxDpr = mobile ? 1.6 : 1.5;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 30000);

  const U = {
    uTime: { value: 0 },
    uZen: { value: new THREE.Vector3() }, uMid: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() }, uBand: { value: new THREE.Vector3() },
    uSun: { value: new THREE.Vector3(0.18, 0, -1).normalize() }, uStars: { value: 1 }, uTod: { value: 0 },
  };

  /* Sky */
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(20000, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false }));
  skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; scene.add(skyMesh);

  /* Ridges: three rings of far mountains */
  const ridgeGroup = new THREE.Group(); scene.add(ridgeGroup);
  const hash1 = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const noise1 = (x: number) => { const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return hash1(i) * (1 - u) + hash1(i + 1) * u; };
  const sunAz = Math.atan2(U.uSun.value.x, -U.uSun.value.z);
  [{ r: 9000, h: 950, f: 14, d: 0.5, s: 3 }, { r: 6800, h: 620, f: 22, d: 0.72, s: 17 }, { r: 5000, h: 330, f: 34, d: 0.9, s: 41 }].forEach((L, li) => {
    const M = 720; const pos = new Float32Array((M + 1) * 2 * 3);
    for (let i = 0; i <= M; i++) {
      const th = (i / M) * Math.PI * 2 + Math.PI; const u = (i / M) * L.f; // seam sits behind the camera
      let h = 0; let amp = 1; let fr = 1; for (let o = 0; o < 5; o++) { h += (1 - Math.abs(noise1(u * fr + L.s + (i === M ? 0 : 0)) * 2 - 1)) * amp; amp *= 0.5; fr *= 2.03; }
      // keep the ring seamless and open a low pass where the sun comes up
      const az = Math.atan2(Math.sin(th), -Math.cos(th));
      let da = Math.abs(az - sunAz); if (da > Math.PI) da = Math.PI * 2 - da;
      const pass = 0.22 + 0.78 * clamp01((da - 0.05) / 0.5);
      const seam = Math.min(1, Math.min(i, M - i) / 20);
      const y = Math.pow(h / 1.94, 1.7) * L.h * pass * (0.4 + 0.6 * seam) + 12;
      const x = Math.sin(th) * L.r, z = -Math.cos(th) * L.r - 900;
      pos.set([x, -2, z, x, y, z], i * 6);
    }
    const idx: number[] = []; for (let i = 0; i < M; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: RIDGE_VERT, fragmentShader: RIDGE_FRAG, uniforms: { ...U, uDark: { value: L.d }, uTop: { value: L.h } }, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.renderOrder = -5 + li; ridgeGroup.add(m);
  });

  /* Water: planar mirror with ripples */
  const water = new Reflector(new THREE.PlaneGeometry(60000, 60000), {
    textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0,
    shader: { name: 'Water', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, ...U, uCam: { value: new THREE.Vector3() } }, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG },
  });
  water.rotation.x = -Math.PI / 2; water.frustumCulled = false; scene.add(water);
  const waterMat = water.material as THREE.ShaderMaterial;
  Object.assign(waterMat.uniforms, { uTime: U.uTime, uZen: U.uZen, uMid: U.uMid, uHor: U.uHor, uBand: U.uBand, uSun: U.uSun, uTod: U.uTod });

  /* Swarm */
  const refs = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { refs[i * 2] = ((i % side) + 0.5) / side; refs[i * 2 + 1] = (Math.floor(i / side) + 0.5) / side; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('ref', new THREE.BufferAttribute(refs, 2));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const SU = {
    ...U,
    tPosA: { value: null as THREE.Texture | null }, tPosB: { value: null as THREE.Texture | null },
    tAuxA: { value: null as THREE.Texture | null }, tAuxB: { value: null as THREE.Texture | null },
    tColA: { value: null as THREE.Texture | null }, tColB: { value: null as THREE.Texture | null },
    uMix: { value: 0 }, uPx: { value: 300 }, uFocus: { value: 100 }, uAperture: { value: 1 }, uSize: { value: mobile ? 1.45 : 1 },
    uRayO: { value: new THREE.Vector3() }, uRayD: { value: new THREE.Vector3(0, 0, -1) }, uPush: { value: 0 },
    uSpinA: { value: 0 }, uSpinB: { value: 0 }, uSpinPivot: { value: new THREE.Vector3() }, uSpinMat: { value: new THREE.Matrix3() },
    uGain: { value: 1 }, uFog: { value: 0.0011 },
  };
  const swarmMat = new THREE.ShaderMaterial({ vertexShader: SWARM_VERT, fragmentShader: SWARM_FRAG, uniforms: SU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const swarm = new THREE.Points(geo, swarmMat); swarm.frustumCulled = false; swarm.renderOrder = 10; scene.add(swarm);
  const rtSize = new THREE.Vector2();
  swarm.onBeforeRender = (r) => {
    const rt = r.getRenderTarget();
    const h = rt ? rt.height : r.getDrawingBufferSize(rtSize).y;
    SU.uPx.value = h; swarmMat.uniformsNeedUpdate = true;
  };

  /* Formations: built one per frame so the loader can count */
  const gens: ((n: number, o: V3) => Formation)[] = [F.drift, (n, o) => F.name(n, o, opts.family), F.sandbox, F.one, F.bridge, F.merge, F.market, F.engine, F.launch, F.calm];
  type Tex = { pos: THREE.DataTexture; aux: THREE.DataTexture; col: THREE.DataTexture };
  const tex: Tex[] = [];
  const mk = (a: Float32Array) => { const t = new THREE.DataTexture(a, side, side, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
  for (let i = 0; i < gens.length; i++) {
    const f = gens[i](N, SITES[i]);
    tex.push({ pos: mk(f.pos), aux: mk(f.aux), col: mk(f.col) });
    opts.onProgress(i + 1, gens.length);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }

  /* Post */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 0.95);
  composer.addPass(bloom);
  const final = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uMove: { value: 0 }, uExp: { value: 1 }, uFade: { value: 0 } }, vertexShader: FINAL_VERT, fragmentShader: FINAL_FRAG });
  composer.addPass(final);

  /* State */
  let qTarget = 1, q = 0, mode: Mode = 'story', calmScroll = 0;
  let running = false, raf = 0, last = performance.now(), time = 0, fade = 0;
  let over: null | { from: number; to: number; t: number; dur: number; camP: THREE.Vector3; camL: THREE.Vector3; tod0: number } = null;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, active: false, push: 0 };
  const spinQ = new THREE.Quaternion(); const spinV = { x: 0.18, y: 0 }; let spinIdle = 1;
  const camP = new THREE.Vector3(0, 46, 300), camL = new THREE.Vector3(0, 6, -300), prevP = new THREE.Vector3();
  const shift = { x: 0, y: 0 }; let tod = 0; let fovK = 1; let move = 0;
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const m4 = new THREE.Matrix4(); const qTmp = new THREE.Quaternion();
  let W = 1, H = 1, aspect = 1;

  const site = (i: number, p: V3, out: THREE.Vector3) => out.set(SITES[i][0] + p[0], SITES[i][1] + p[1], SITES[i][2] + p[2]);
  /** Camera pose for a beat. Portrait screens pull the camera back along its own line of sight. */
  const pose = (i: number, hold: number, outP: THREE.Vector3, outL: THREE.Vector3) => {
    const b = BEATS[i];
    site(i, b.a.p, v0); site(i, b.b.p, v1); outP.copy(v0).lerp(v1, hold);
    site(i, b.a.l, v0); site(i, b.b.l, v1); outL.copy(v0).lerp(v1, hold);
    if (aspect < 1.3) { const k = 1 + (Math.min(2.5, 1.3 / aspect) - 1) * b.tall; outP.sub(outL).multiplyScalar(k).add(outL); outP.y = Math.max(outP.y * (1 / Math.sqrt(k)), 2.2); }
  };

  function setPair(a: number, b: number, mix: number) {
    SU.tPosA.value = tex[a].pos; SU.tAuxA.value = tex[a].aux; SU.tColA.value = tex[a].col;
    SU.tPosB.value = tex[b].pos; SU.tAuxB.value = tex[b].aux; SU.tColB.value = tex[b].col;
    SU.uMix.value = mix; SU.uSpinA.value = a === 7 ? 1 : 0; SU.uSpinB.value = b === 7 ? 1 : 0;
  }
  setPair(0, 0, 0);
  SU.uSpinPivot.value.set(SITES[7][0] + F.ENGINE_PIVOT[0], F.ENGINE_PIVOT[1], SITES[7][2] + F.ENGINE_PIVOT[2]);

  /** Scroll position q to formation pair, camera pose, sky and lens. */
  const tP = new THREE.Vector3(), tL = new THREE.Vector3(); let tTod = 0, tAp = 1, tSx = 0, tSy = 0, pa = 0, pb = 0, pm = 0;
  function evalStory(qq: number) {
    const seg = Math.min(Math.max(Math.floor(qq), 0), LAST); const f = qq - seg;
    if (seg >= LAST) { pose(LAST, clamp01(f / HOLD), tP, tL); const b = BEATS[LAST]; tTod = b.tod; tAp = b.ap; tSx = b.shift[0]; tSy = b.shift[1]; pa = pb = LAST; pm = 0; return; }
    const A = BEATS[seg], B = BEATS[seg + 1];
    if (f < HOLD) { pose(seg, f / HOLD, tP, tL); tTod = A.tod; tAp = A.ap; tSx = A.shift[0]; tSy = A.shift[1]; pa = seg; pb = seg + 1; pm = 0; return; }
    const t = (f - HOLD) / (1 - HOLD); const e = ease(t);
    pose(seg, 1, v2, v3); pose(seg + 1, 0, tP, tL);
    const lift = Math.sin(Math.PI * e) * (seg === 0 ? 0 : 16);
    tP.lerpVectors(v2, tP, e); tP.y += lift;
    tL.lerpVectors(v3, tL, ease(clamp01(t * 1.12)));
    tTod = A.tod + (B.tod - A.tod) * e; tAp = (A.ap + (B.ap - A.ap) * e) * (1 - Math.sin(Math.PI * e) * 0.45);
    tSx = A.shift[0] + (B.shift[0] - A.shift[0]) * e; tSy = A.shift[1] + (B.shift[1] - A.shift[1]) * e;
    pa = seg; pb = seg + 1; pm = t;
  }

  function frame(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    const k = 1 - Math.pow(0.0015, dt);
    q += (qTarget - q) * k;
    fade += (1 - fade) * (1 - Math.pow(0.02, dt));

    if (mode === 'story') evalStory(q);
    else { pose(CALM, 0, tP, tL); tP.y += calmScroll * -8; tL.y += calmScroll * -14; const b = BEATS[CALM]; tTod = b.tod; tAp = b.ap; tSx = b.shift[0]; tSy = b.shift[1]; pa = pb = CALM; pm = 0; }

    if (over) {
      over.t = Math.min(1, over.t + dt / over.dur); const e = ease(over.t);
      setPair(over.from, over.to, over.t);
      camP.lerpVectors(over.camP, tP, e); camL.lerpVectors(over.camL, tL, ease(clamp01(over.t * 1.1)));
      tod = over.tod0 + (tTod - over.tod0) * e;
      if (over.t >= 1) over = null;
    } else { setPair(pa, pb, pm); camP.copy(tP); camL.copy(tL); tod = tTod; }
    shift.x += (tSx - shift.x) * k; shift.y += (tSy - shift.y) * k;

    // pointer: a little parallax, and a ray that parts the swarm
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.pow(0.004, dt)); pointer.sy += (pointer.y - pointer.sy) * (1 - Math.pow(0.004, dt));
    pointer.push += ((pointer.active ? 1 : 0) - pointer.push) * (1 - Math.pow(0.01, dt));
    camera.position.copy(camP); camera.up.set(0, 1, 0); camera.lookAt(camL);
    const dist = camP.distanceTo(camL);
    camera.translateX(pointer.sx * dist * 0.022); camera.translateY(Math.max(-camP.y * 0.4, pointer.sy * dist * 0.012)); camera.lookAt(camL);
    camera.fov = 32 * fovK;
    const portrait = aspect < 1;
    const sx = portrait ? 0 : shift.x; const sy = portrait ? 0.13 : shift.y;
    camera.setViewOffset(W, H, -sx * W, sy * H, W, H);
    camera.updateMatrixWorld();

    // sky
    const s = sky(tod);
    U.uZen.value.fromArray(s.zen); U.uMid.value.fromArray(s.mid); U.uHor.value.fromArray(s.hor); U.uBand.value.fromArray(s.band); U.uStars.value = s.stars; U.uTod.value = tod; U.uTime.value = time;
    const el = s.sunEl; U.uSun.value.set(0.18 * Math.cos(el), Math.sin(el), -Math.cos(el)).normalize();
    skyMesh.position.copy(camera.position);
    water.position.set(camera.position.x, 0, camera.position.z);
    (waterMat.uniforms.uCam.value as THREE.Vector3).copy(camera.position);

    // lens
    SU.uFocus.value = dist; SU.uAperture.value = tAp; SU.uGain.value = 0.5;
    v0.set(pointer.sx, pointer.sy, 0.5).unproject(camera).sub(camera.position).normalize();
    SU.uRayO.value.copy(camera.position); SU.uRayD.value.copy(v0); SU.uPush.value = pointer.push * (mobile ? 0 : 1);

    // engine spin: idle turn plus whatever the hand gave it
    spinV.x += ((spinIdle ? 0.16 : 0) - spinV.x) * (1 - Math.pow(0.35, dt)); spinV.y += (0 - spinV.y) * (1 - Math.pow(0.2, dt));
    qTmp.setFromAxisAngle(v1.set(0, 1, 0), spinV.x * dt); spinQ.premultiply(qTmp);
    qTmp.setFromAxisAngle(v1.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize(), spinV.y * dt); spinQ.premultiply(qTmp);
    SU.uSpinMat.value.setFromMatrix4(m4.makeRotationFromQuaternion(spinQ));

    move += (Math.min(1, prevP.distanceTo(camP) / Math.max(dt, 0.001) / 160) - move) * 0.2; prevP.copy(camP);
    final.uniforms.uTime.value = time; final.uniforms.uMove.value = move; final.uniforms.uExp.value = s.exp; final.uniforms.uFade.value = fade;
    bloom.strength = 0.48 - tod * 0.1;
    composer.render(dt);
  }

  const api: Engine = {
    get q() { return q; },
    count: N,
    setQ(v) { qTarget = v; },
    setMode(m, o) {
      const toIdx = m === 'calm' ? CALM : Math.min(Math.max(Math.round(qTarget), 1), LAST);
      const fromIdx = o?.intro ? 0 : SU.uMix.value > 0.5 ? pb : pa;
      mode = m; if (m === 'story') q = qTarget;
      if (o?.intro) { pose(0, 0, camP, camL); tod = 0; fade = 0; }
      over = { from: o?.intro ? 0 : fromIdx, to: toIdx, t: 0, dur: o?.intro ? 4.2 : 2.2, camP: camP.clone(), camL: camL.clone(), tod0: tod };
      if (over.from === over.to) over = null;
    },
    setPointer(x, y, active) { pointer.x = x; pointer.y = y; pointer.active = active; },
    setCalmScroll(v) { calmScroll = v; },
    spin(dx, dy) { spinIdle = 0; spinV.x += dx * 0.012; spinV.y += dy * 0.008; window.clearTimeout(spinTimer); spinTimer = window.setTimeout(() => { spinIdle = 1; }, 6000); },
    project(w, out) {
      v0.set(w[0], w[1], w[2]).project(camera);
      out.x = (v0.x * 0.5 + 0.5) * W; out.y = (-v0.y * 0.5 + 0.5) * H; out.on = v0.z < 1 && v0.x > -1.1 && v0.x < 1.1 && v0.y > -1.1 && v0.y < 1.1;
    },
    resize() {
      const r = canvas.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height)); aspect = W / H;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr, 2600 / Math.max(W, H));
      renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); composer.setPixelRatio(dpr); composer.setSize(W, H);
      camera.aspect = aspect; fovK = aspect < 1 ? 1.22 : 1; camera.updateProjectionMatrix();
      const rw = Math.round(W * dpr * (mobile ? 0.5 : 0.6)), rh = Math.round(H * dpr * (mobile ? 0.5 : 0.6));
      water.getRenderTarget().setSize(rw, rh);
    },
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    dispose() {
      api.stop(); tex.forEach((t) => { t.pos.dispose(); t.aux.dispose(); t.col.dispose(); });
      geo.dispose(); swarmMat.dispose(); water.dispose(); composer.dispose(); renderer.dispose();
    },
  };
  let spinTimer = 0;
  api.resize();
  return api;
}
