import { FRAG, VERT } from './shader';
import { stage } from '@/stage/stage';

type Els = { canvas: HTMLCanvasElement; ground: HTMLElement; orbs: HTMLElement[] };

const TIERS = [
  { scale: 1, steps: 64, inner: 22 },
  { scale: 0.8, steps: 56, inner: 18 },
  { scale: 0.62, steps: 48, inner: 14 },
  { scale: 0.48, steps: 40, inner: 10 },
];

const rgb = (s: { x: number }[]) => `rgb(${s.map((c) => Math.round(Math.min(1, Math.max(0, c.x)) * 255)).join(' ')})`;

export class GlassEngine {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private maskTex: WebGLTexture;
  private maskCanvas = document.createElement('canvas');
  private maskCtx: CanvasRenderingContext2D;
  private maskSig = '';
  private maskOn = 0;
  private refract: HTMLElement[] = [];
  private fontCache = new WeakMap<HTMLElement, { font: string; stretch: string; spacing: string; text: string }>();
  private raf = 0;
  private last = 0;
  private time = 0;
  private tier = 0;
  private slow = 0;
  private frames = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private lastBg = '';
  private lastOrb = '';
  private lastTop = 0;
  private drag = { id: -1, x: 0, y: 0, t: 0, moved: 0, vx: 0 };
  private cleanup: (() => void)[] = [];
  ready: Promise<void>;

  constructor(private els: Els) {
    const gl = els.canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance', depth: false, stencil: false });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const vs = mk(gl.VERTEX_SHADER, VERT);
    const fs = mk(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    this.prog = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.maskTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: false })!;

    // Wait for the link without blocking the main thread where the driver allows it.
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    this.ready = new Promise<void>((resolve, reject) => {
      const done = () => {
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          reject(new Error(gl.getProgramInfoLog(prog) || gl.getShaderInfoLog(fs) || 'link failed'));
          return;
        }
        gl.useProgram(prog);
        const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
        for (let i = 0; i < n; i++) {
          const info = gl.getActiveUniform(prog, i)!;
          const name = info.name.replace(/\[0\]$/, '');
          this.u[name] = gl.getUniformLocation(prog, name);
        }
        resolve();
      };
      if (!ext) return done();
      const poll = () => (gl.getProgramParameter(prog, ext.COMPLETION_STATUS_KHR) ? done() : requestAnimationFrame(poll));
      poll();
    });

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.bind();
  }

  private bind() {
    const on = <K extends keyof WindowEventMap>(t: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      window.addEventListener(t, fn, opts);
      this.cleanup.push(() => window.removeEventListener(t, fn));
    };
    on('resize', this.resize);
    on('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      const d = this.drag;
      if (d.id === e.pointerId) {
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        const now = performance.now();
        const dt = Math.max(1, now - d.t) / 1000;
        d.moved += Math.abs(dx) + Math.abs(dy);
        stage.dragYaw += dx * 0.008;
        // Rubber band on pitch: the further it is pulled, the less it follows.
        const p = stage.dragPitch.x + dy * 0.008;
        stage.dragPitch.snap(p / (1 + Math.abs(p) * 0.35));
        d.vx = d.vx * 0.6 + ((dx * 0.008) / dt) * 0.4;
        d.x = e.clientX;
        d.y = e.clientY;
        d.t = now;
        stage.dirty = true;
      } else if (!stage.reduced) {
        const interactive = (e.target as Element | null)?.closest?.('a,button,input,textarea,select,video,[data-glass]');
        document.documentElement.classList.toggle('on-drop', !interactive && stage.hits(e.clientX, e.clientY));
      }
    });
    on('pointerdown', (e) => {
      const t = e.target as Element | null;
      if (t?.closest?.('a,button,input,textarea,select,video,[data-glass]')) return;
      if (!stage.hits(e.clientX, e.clientY)) return;
      if (e.pointerType === 'touch' || stage.reduced) {
        stage.tap();
        return;
      }
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, vx: 0 };
      stage.dragging = true;
      stage.dragVelYaw = 0;
      document.documentElement.classList.add('dragging-drop');
      e.preventDefault();
    });
    const end = (e: PointerEvent) => {
      if (this.drag.id !== e.pointerId) return;
      this.drag.id = -1;
      stage.dragging = false;
      document.documentElement.classList.remove('dragging-drop');
      if (this.drag.moved < 5) stage.tap();
      // Hand the release velocity to the inertia, then let pitch spring home.
      stage.dragVelYaw = performance.now() - this.drag.t < 80 ? this.drag.vx : 0;
      stage.dragPitch.target = 0;
    };
    on('pointerup', end);
    on('pointercancel', end);
    const vis = () => {
      if (!document.hidden) {
        this.last = 0;
        stage.dirty = true;
      }
    };
    document.addEventListener('visibilitychange', vis);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', vis));
  }

  /** Re-read which elements the drop should refract. Call after route changes. */
  collect() {
    this.refract = Array.from(document.querySelectorAll<HTMLElement>('[data-refract]'));
    this.maskSig = '';
    stage.dirty = true;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cap = w < 768 ? 1.25 : 1.5;
    this.dpr = Math.min(window.devicePixelRatio || 1, cap) * TIERS[this.tier].scale;
    this.w = w;
    this.h = h;
    const c = this.els.canvas;
    c.width = Math.max(2, Math.round(w * this.dpr));
    c.height = Math.max(2, Math.round(h * this.dpr));
    this.gl.viewport(0, 0, c.width, c.height);
    const ms = Math.min(1, 1500 / w);
    this.maskCanvas.width = Math.max(2, Math.round(w * ms));
    this.maskCanvas.height = Math.max(2, Math.round(h * ms));
    this.fontCache = new WeakMap();
    this.maskSig = '';
    stage.dirty = true;
  }

  private drawMask() {
    const items: { el: HTMLElement; r: DOMRect }[] = [];
    let sig = '';
    for (const el of this.refract) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > this.h || r.width < 2) continue;
      items.push({ el, r });
      sig += `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)};`;
    }
    if (sig === this.maskSig) return;
    this.maskSig = sig;
    const ctx = this.maskCtx;
    const s = this.maskCanvas.width / this.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    for (const { el, r } of items) {
      let f = this.fontCache.get(el);
      if (!f) {
        const cs = getComputedStyle(el);
        f = { font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, stretch: cs.fontStretch, spacing: cs.letterSpacing, text: el.textContent || '' };
        this.fontCache.set(el, f);
      }
      ctx.font = f.font;
      const cx = ctx as CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };
      if ('fontStretch' in cx) cx.fontStretch = parseFloat(f.stretch) >= 125 ? 'expanded' : 'normal';
      if ('letterSpacing' in cx) cx.letterSpacing = f.spacing === 'normal' ? '0px' : f.spacing;
      const m = ctx.measureText(f.text);
      const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
      const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
      const base = r.top + (r.height - (asc + desc)) / 2 + asc;
      ctx.setTransform(s * (r.width / Math.max(1, m.width)), 0, 0, s, r.left * s, base * s);
      ctx.fillText(f.text, 0, 0);
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, this.maskCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.maskOn = items.length ? 1 : 0;
    stage.dirty = true;
  }

  start() {
    this.resize();
    this.collect();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame(now: number) {
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 1 / 60;
    this.last = now;
    stage.step(dt);
    if (!stage.reduced) this.time += dt;
    if (++this.frames % 45 === 0) {
      const live = document.querySelectorAll('[data-refract]').length;
      if (live !== this.refract.length || this.refract.some((e) => !e.isConnected)) this.collect();
    }
    if (stage.reduced) {
      // Reduced motion: forms change with a short cross-fade, never a morph.
      const top = stage.top3().idx[0];
      if (top !== this.lastTop) {
        this.lastTop = top;
        this.els.canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear' });
      }
    }
    this.drawMask();
    this.writeDom();
    if (stage.reduced && !stage.dirty) return;
    stage.dirty = false;
    this.draw();

    // Adaptive quality: step down a tier when frames stay long.
    if (dt > 0.026) this.slow++;
    else this.slow = Math.max(0, this.slow - 0.25);
    if (this.slow > 24 && this.tier < TIERS.length - 1) {
      this.tier++;
      this.slow = 0;
      this.resize();
    }
  }

  private writeDom() {
    const bg = rgb(stage.bg);
    if (bg !== this.lastBg) {
      this.lastBg = bg;
      this.els.ground.style.backgroundColor = bg;
    }
    const oc = stage.orbCol.map(rgb).join('|') + stage.orbA.x.toFixed(2);
    if (oc !== this.lastOrb) {
      this.lastOrb = oc;
      this.els.orbs.forEach((el, i) => {
        el.style.color = rgb(stage.orbCol[i]);
        el.style.opacity = String(stage.orbA.x * (i === 2 ? 0.7 : 1));
      });
    }
    const o = this.orbs();
    this.els.orbs.forEach((el, i) => {
      el.style.transform = `translate3d(${(o[i][0] - o[i][2]).toFixed(1)}px,${(o[i][1] - o[i][2]).toFixed(1)}px,0)`;
      const d = `${(o[i][2] * 2).toFixed(0)}px`;
      if (el.style.width !== d) {
        el.style.width = d;
        el.style.height = d;
      }
    });
  }

  /** Three soft colour fields behind everything. Shared by CSS and the shader. */
  private orbs() {
    const t = this.time;
    const { w, h } = this;
    const sy = (typeof window !== 'undefined' ? window.scrollY : 0) / Math.max(1, h);
    const r = Math.max(w, h) * 0.42;
    return [
      [w * (0.18 + 0.1 * Math.sin(t * 0.13 + sy * 0.9)), h * (0.24 + 0.12 * Math.cos(t * 0.11 + sy * 0.7)), r],
      [w * (0.84 + 0.08 * Math.cos(t * 0.1 + sy * 0.6)), h * (0.7 + 0.14 * Math.sin(t * 0.14 - sy * 0.8)), r * 1.1],
      [w * (0.55 + 0.2 * Math.sin(t * 0.07 - sy * 0.5)), h * (0.05 + 0.1 * Math.cos(t * 0.09)), r * 0.8],
    ];
  }

  private draw() {
    const gl = this.gl;
    const u = this.u;
    const s = this.dpr;
    const { w, h } = this;
    const { idx, w: wt } = stage.top3();
    const short = Math.min(w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uRes, w * s, h * s);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform2f(u.uCenter, stage.x.x * w * s, (1 - stage.y.x) * h * s);
    gl.uniform1f(u.uRadius, Math.max(1, stage.size.x * short * s));
    const g = Math.min(1, Math.max(0, stage.gather.x));
    gl.uniform1f(u.uBound, 1.75 + (1 - g) * 6);
    gl.uniform1f(u.uGather, g);
    gl.uniformMatrix3fv(u.uRot, false, stage.rotation());
    gl.uniform3i(u.uShape, idx[0], idx[1], idx[2]);
    gl.uniform3f(u.uW, wt[0], wt[1], wt[2]);
    gl.uniform3f(u.uGround, stage.bg[0].x, stage.bg[1].x, stage.bg[2].x);
    gl.uniform3f(u.uInk, stage.ink[0].x, stage.ink[1].x, stage.ink[2].x);
    gl.uniform3f(u.uTintA, stage.tintA[0].x, stage.tintA[1].x, stage.tintA[2].x);
    gl.uniform3f(u.uTintB, stage.tintB[0].x, stage.tintB[1].x, stage.tintB[2].x);
    gl.uniform1f(u.uMaskAmt, this.maskOn);
    const lx = -0.5 + stage.ptrX.x * 0.35;
    const ly = 0.75 - stage.ptrY.x * 0.25;
    const ll = Math.hypot(lx, ly, 0.6);
    gl.uniform3f(u.uLight, lx / ll, ly / ll, 0.6 / ll);
    gl.uniform1f(u.uVel, stage.vel.x);
    gl.uniform4f(u.uP, stage.flip.x, Math.min(1, Math.max(0, stage.grow.x)), stage.reduced ? 0 : stage.pulse.x, stage.reduced ? 0 : stage.wobble.x);
    gl.uniform1f(u.uGlow, stage.glow.x);
    gl.uniform1f(u.uShadow, stage.shadow.x);
    const o = this.orbs();
    const of = new Float32Array(12);
    const oc = new Float32Array(9);
    for (let i = 0; i < 3; i++) {
      of.set([o[i][0] * s, o[i][1] * s, o[i][2] * s, stage.orbA.x * (i === 2 ? 0.7 : 1)], i * 4);
      oc.set([stage.orbCol[i][0].x, stage.orbCol[i][1].x, stage.orbCol[i][2].x], i * 3);
    }
    gl.uniform4fv(u.uOrb, of);
    gl.uniform3fv(u.uOrbCol, oc);
    const tier = TIERS[this.tier];
    const small = w < 768;
    gl.uniform1i(u.uSteps, small ? Math.min(tier.steps, 52) : tier.steps);
    gl.uniform1i(u.uInner, small ? Math.min(tier.inner, 16) : tier.inner);
    gl.uniform1f(u.uEngine, Math.max(0, stage.weights[8].x));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.uniform1i(u.uMask, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((fn) => fn());
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
