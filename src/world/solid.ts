import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKY_FN } from './shaders';

/** Radius of the engine at height y (y = -19 nozzle exit, +8 top of the injector dome). Shared with the wire formation. */
export function engineProfile(y: number) {
  if (y < -3) { const t = (y + 19) / 16; return 2.3 + (11.5 - 2.3) * Math.pow(1 - t, 0.62); }
  if (y < -1) { const t = (y + 3) / 2; return 2.3 + t * 1.9; }
  if (y < 5) return 4.2;
  if (y < 8) { const t = (y - 5) / 3; return 4.2 * Math.sqrt(Math.max(0, 1 - t * t * 0.86)); }
  return 1.5;
}

const METAL_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){ vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }
`;
const METAL_FRAG = /* glsl */ `
precision highp float; varying vec3 vN; varying vec3 vW; varying vec3 vL;
uniform float uBuild; uniform float uFire;
${SKY_FN}
void main(){
  // the swarm lays the engine down from the nozzle up
  float g = (vL.y + 19.0) / 34.0; float n = vnoise(vec2(atan(vL.z, vL.x) * 3.0, vL.y * 0.6)) * 0.3;
  float d = uBuild * 1.45 - g - n; if (d < 0.0) discard;
  vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); bool back = !gl_FrontFacing; if (back) N = -N;
  vec3 R = reflect(-V, N);
  vec3 env = skyColor(vec3(R.x, abs(R.y), R.z)) * (R.y < 0.0 ? 0.55 : 1.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  float brush = 0.82 + 0.18 * vnoise(vec2(atan(vL.z, vL.x) * 46.0, vL.y * 1.3));
  float up = 0.5 + 0.5 * N.y;
  vec3 col = (uHor * 0.5 + uZen * 0.6) * vec3(0.5, 0.52, 0.56) * (0.35 + 0.9 * up) * brush;      // the metal itself, lit by the sky
  col += env * vec3(0.72, 0.76, 0.84) * 0.9 * brush;                                         // what it mirrors
  col += (uBand * 0.5 + uHor * 0.8) * fres * 1.1;                                            // backlight from the horizon
  vec3 Hh = normalize(V + normalize(vec3(-0.5, 0.75, 0.6))); col += vec3(0.6, 0.8, 1.0) * pow(max(dot(N, Hh), 0.0), 60.0) * 0.5;  // the swarm's glint
  // heat inside the bell and on its lip while it fires
  float lip = smoothstep(-13.0, -19.0, vL.y);
  col += vec3(1.0, 0.32, 0.06) * uFire * (back ? 1.6 * lip + 0.25 : 0.22 * lip * lip);
  col += vec3(1.3, 0.95, 0.6) * smoothstep(0.07, 0.0, d) * 2.5;
  gl_FragColor = vec4(col, 1.0);
}
`;
const PLUME_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }
`;
const PLUME_FRAG = /* glsl */ `
precision highp float; varying vec2 vUv; varying vec3 vN; varying vec3 vW; uniform float uFire; uniform float uTime;
float h1(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h1(i), h1(i+vec2(1,0)), u.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), u.x), u.y); }
void main(){
  vec3 V = normalize(cameraPosition - vW); float facing = abs(dot(normalize(vN), V));
  float v = 1.0 - vUv.y;                      // 0 at the nozzle, 1 at the water
  float core = pow(facing, 1.5);
  float streak = 0.6 + 0.4 * vn(vec2(vUv.x * 40.0, v * 5.0 - uTime * 9.0));
  float diamonds = 0.55 + 0.45 * pow(abs(sin(v * 9.5 - 0.6)), 3.0);
  float flick = 0.86 + 0.14 * vn(vec2(uTime * 13.0, 3.0));
  vec3 hot = mix(vec3(1.0, 0.36, 0.08), vec3(1.0, 0.86, 0.66), core * diamonds);
  float a = core * streak * flick * (0.35 + 0.65 * diamonds) * smoothstep(0.0, 0.06, v) * (1.0 - 0.35 * v);
  gl_FragColor = vec4(hot * a * uFire * 7.0, 1.0);
}
`;
const SPLASH_FRAG = /* glsl */ `
precision highp float; varying vec2 vUv; uniform float uFire; uniform float uTime;
float h1(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h1(i), h1(i+vec2(1,0)), u.x), mix(h1(i+vec2(0,1)), h1(i+vec2(1,1)), u.x), u.y); }
void main(){
  vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = atan(c.y, c.x);
  float roll = vn(vec2(a * 5.0, r * 7.0 - uTime * 2.4));
  float g = exp(-r * 4.2) * 4.0 + smoothstep(1.0, 0.1, r) * roll * 0.5;
  gl_FragColor = vec4(mix(vec3(1.0, 0.3, 0.06), vec3(1.0, 0.8, 0.55), exp(-r * 7.0)) * g * uFire * smoothstep(1.0, 0.8, r), 1.0);
}
`;

/** A solid Merlin-class engine in brushed metal that mirrors the sky, with a plume. Built in code, no assets. */
export function createEngineModel(U: Record<string, THREE.IUniform>, pivot: THREE.Vector3) {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, m?: THREE.Matrix4) => { if (m) g.applyMatrix4(m); parts.push(g.index ? g.toNonIndexed() : g); };
  const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
  // bell, throat, chamber, dome
  const pts: THREE.Vector2[] = []; for (let y = -19; y <= 8.01; y += 0.25) pts.push(new THREE.Vector2(engineProfile(y), y));
  pts.push(new THREE.Vector2(0.01, 8.4));
  add(new THREE.LatheGeometry(pts, 96));
  // stiffener hoops and the manifold
  for (const y of [-15, -11, -7]) add(new THREE.TorusGeometry(engineProfile(y) + 0.3, 0.22, 10, 96), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(T(0, y, 0)));
  add(new THREE.TorusGeometry(engineProfile(-19) + 0.1, 0.34, 10, 96), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(T(0, -19, 0)));
  add(new THREE.TorusGeometry(4.9, 0.72, 14, 72), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(T(0, -2.2, 0)));
  // turbopump and its exhaust duct
  const tp = new THREE.Vector3(7.6, 3.5, 1);
  add(new THREE.CylinderGeometry(2.3, 2.3, 7, 40), T(tp.x, tp.y, tp.z));
  add(new THREE.SphereGeometry(2.3, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), T(tp.x, tp.y + 3.5, tp.z));
  const duct = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => { const t = i / 11; return new THREE.Vector3(tp.x + 1.6 + Math.sin(t * Math.PI) * 4.6, tp.y - 3.5 - t * 17, tp.z + t * 2); }));
  add(new THREE.TubeGeometry(duct, 48, 1.05, 16));
  for (let k = 0; k < 3; k++) {
    const c = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => { const t = i / 8; return new THREE.Vector3(tp.x - tp.x * t, 6 + Math.sin(t * Math.PI) * (4 + k * 1.1), tp.z + (k - 1) * 1.6 * (1 - t)); }));
    add(new THREE.TubeGeometry(c, 32, 0.34, 10));
  }
  // gimbal mount and thrust frame
  const top = 14;
  add(new THREE.TorusGeometry(5.4, 0.3, 10, 64), new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(T(0, top, 0)));
  add(new THREE.CylinderGeometry(0.5, 0.5, 6, 16), T(0, 11, 0));
  for (let k = 0; k < 6; k++) for (const off of [0, 1.047]) {
    const a = (k / 6) * Math.PI * 2 + off, a2 = ((k + 0.5) / 6) * Math.PI * 2;
    const c = new THREE.LineCurve3(new THREE.Vector3(Math.cos(a) * 5.4, top, Math.sin(a) * 5.4), new THREE.Vector3(Math.cos(a2) * 3.4, 6.5, Math.sin(a2) * 3.4));
    add(new THREE.TubeGeometry(c, 2, 0.2, 8));
  }
  const geo = mergeGeometries(parts.map((g) => { const o = new THREE.BufferGeometry(); o.setAttribute('position', g.getAttribute('position')); o.setAttribute('normal', g.getAttribute('normal')); return o; }))!;
  const mu = { ...U, uBuild: { value: 0 }, uFire: { value: 0 } };
  const metal = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: METAL_VERT, fragmentShader: METAL_FRAG, uniforms: mu, side: THREE.DoubleSide }));
  metal.frustumCulled = false; metal.renderOrder = 2;

  const len = pivot.y - 19 - 0.4; // nozzle exit down to the water
  const pu = { uFire: mu.uFire, uTime: U.uTime };
  const plume = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 7.2, len, 48, 1, true), new THREE.ShaderMaterial({ vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG, uniforms: pu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  plume.position.y = -19 - len / 2; plume.renderOrder = 6; plume.frustumCulled = false;
  const splash = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.ShaderMaterial({ vertexShader: PLUME_VERT, fragmentShader: SPLASH_FRAG, uniforms: pu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  splash.rotation.x = -Math.PI / 2; splash.position.set(pivot.x, 0.25, pivot.z); splash.renderOrder = 5; splash.frustumCulled = false;

  const group = new THREE.Group(); group.position.copy(pivot); group.add(metal, plume);
  return {
    group, splash,
    set(build: number, fire: number) { mu.uBuild.value = build; mu.uFire.value = fire; const on = build > 0.001; group.visible = on; splash.visible = on && fire > 0.01; },
    dispose() { geo.dispose(); (metal.material as THREE.Material).dispose(); plume.geometry.dispose(); (plume.material as THREE.Material).dispose(); splash.geometry.dispose(); (splash.material as THREE.Material).dispose(); },
  };
}
