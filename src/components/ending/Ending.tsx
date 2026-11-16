'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CONTACT } from '@/content/projects';
import { onFrame } from '@/lib/frame';
import { haptic, hapticsAvailable, hapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { bindTriangle, compile, type Program } from '@/water/gl';
import { Arrow } from '../bits';
import { ENDING_FRAG } from './shader';
import './ending.css';

/* The page's open water where it meets the ending, per theme: the colour
   measured on screen just above the picture, so the handover has no seam.
   (The shader encodes with a 2.2 power; this is its inverse.) */
const g22 = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2));
};
const SHALLOW = { light: g22('#408d99'), dark: g22('#203a41') };
/* How strongly the net of light shows on that water by day, and the light
   it gives the water by night: set so this water and the page's measure
   the same on screen. */
const NET_DAY = 0.38;
const GLOW = [0.25, 1.0, 1.15].map((v) => v * 0.38);
const DEEP = { light: [0.005, 0.034, 0.085], dark: [0.004, 0.028, 0.05] };

interface Props {
  /** e.g. "Numbers read Nov 15, 2026, 4:40 AM CT" */
  note?: string;
}

function CopyEmail() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef(0);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      haptic('success');
      setState('copied');
    } catch {
      haptic('error');
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <span className="end-email">
      <a className="end-link" href={`mailto:${CONTACT.email}`}>
        Email
      </a>
      <button type="button" className="end-copy label" onClick={copy} aria-label="Copy email address">
        <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed. Use the link.' : 'Copy'}</span>
      </button>
    </span>
  );
}

/** The user's own switch for haptics. Shown only where a device can buzz. */
type HapticsState = 'hidden' | 'on' | 'off';
const subscribeHaptics = (cb: () => void) => {
  window.addEventListener('hapticschange', cb);
  return () => window.removeEventListener('hapticschange', cb);
};
const readHaptics = (): HapticsState => (hapticsAvailable() ? (hapticsEnabled() ? 'on' : 'off') : 'hidden');
const readHapticsServer = (): HapticsState => 'hidden';

function HapticsSetting() {
  const state = useSyncExternalStore(subscribeHaptics, readHaptics, readHapticsServer);
  if (state === 'hidden') return null;
  const toggle = () => {
    const on = state !== 'on';
    setHapticsEnabled(on);
    window.dispatchEvent(new Event('hapticschange'));
    // Turning it on answers with the thing itself.
    if (on) haptic('light');
  };
  return (
    <button type="button" className="end-haptics" role="switch" aria-checked={state === 'on'} onClick={toggle}>
      Haptics {state}
    </button>
  );
}

function Contact() {
  return (
    <ul className="ending-links">
      <li>
        <a className="end-link" href={CONTACT.github} target="_blank" rel="noopener noreferrer" onClick={() => haptic('medium')}>
          GitHub <Arrow out />
        </a>
      </li>
      <li>
        <a className="end-link" href={CONTACT.x} target="_blank" rel="noopener noreferrer" onClick={() => haptic('medium')}>
          X <Arrow out />
        </a>
      </li>
      <li>
        <a className="end-link" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer" onClick={() => haptic('medium')}>
          LinkedIn <Arrow out />
        </a>
      </li>
      <li>
        <CopyEmail />
      </li>
    </ul>
  );
}

/** Inner pages end quietly: the same contact row, on dry land beside the stream. */
export function Footer({ note }: Props) {
  return (
    <footer className="foot wrap" aria-label="Contact">
      <Contact />
      <div className="foot-meta label">
        <span>
          <Link href="/">Home</Link>
          <Link href="/work">Work</Link>
          <Link href="/blog">Writing</Link>
          <a href="/feed.xml">RSS</a>
          <HapticsSetting />
        </span>
        {note ? <span className="ending-note">{note}</span> : null}
      </div>
    </footer>
  );
}

/** The home page finale, scrubbed by scroll. */
export function Ending({ note }: Props) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const block = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sec = section.current;
    const cv = canvas.current;
    if (!sec || !cv) return;
    const html = document.documentElement;
    const gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'high-performance' });
    if (!gl) {
      sec.dataset.gl = 'off';
      sec.setAttribute('data-arrived', '');
      return;
    }
    let prog: Program;
    try {
      prog = compile(gl, ENDING_FRAG, 'ending');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn(err);
      sec.dataset.gl = 'off';
      sec.setAttribute('data-arrived', '');
      return;
    }
    bindTriangle(gl);
    sec.dataset.gl = 'on';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let top = 0;
    let span = 1;
    let theme = html.dataset.theme === 'dark' ? 1 : 0;
    let themeTo = theme;
    let time = 0;
    let last = 0;
    let sunUp = 0;
    let arrived = false;
    let buzzed = false;
    let dirty = true;
    let lastP = -1;
    let narrow = false;
    let calm = 0.6;
    let near = 0;
    let aspect = 1.6;
    let feather = -1;

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      cv.width = Math.max(2, Math.round(w * dpr));
      cv.height = Math.max(2, Math.round(h * dpr));
      const r = sec.getBoundingClientRect();
      top = r.top + window.scrollY;
      span = Math.max(1, r.height - window.innerHeight);
      narrow = w < 720;
      aspect = w / Math.max(h, 1);
      // The words keep to the left; the water there is kept calm for them.
      const b = block.current?.getBoundingClientRect();
      calm = b && w > 0 ? Math.min(0.9, (b.right - cv.getBoundingClientRect().left) / w + 0.03) : 0.6;
      near = narrow && b && h > 0 ? Math.min(0.6, 1 - (b.top - cv.getBoundingClientRect().top) / h + 0.02) : 0;
      dirty = true;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sec);
    window.addEventListener('resize', measure);
    const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)), { rootMargin: '10% 0px' });
    io.observe(sec);
    const onTheme = () => {
      themeTo = html.dataset.theme === 'dark' ? 1 : 0;
      dirty = true;
    };
    window.addEventListener('themechange', onTheme);

    const off = onFrame((now) => {
      if (!visible || gl.isContextLost()) {
        last = 0;
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      const still = reduced.matches;
      const p = still ? 1 : Math.min(1, Math.max(0, (window.scrollY - top) / span));
      const pre = still ? 1 : Math.min(1, Math.max(0, (window.scrollY - (top - window.innerHeight)) / window.innerHeight));
      if (p + pre !== lastP) dirty = true;
      lastP = p + pre;
      // The top edge feathers into the page's water while the camera is
      // still coming down, and is a clean edge once it has arrived.
      // It is long while the picture is first coming in, when both are
      // the same shoal seen from above, so one runs into the other.
      const f = Math.round((9 + 22 * (1 - pre)) * (1 - Math.min(1, p / 0.45)) * 10) / 10;
      if (f !== feather) {
        feather = f;
        cv.style.setProperty('--feather', `${f}%`);
      }
      const here = p > 0.86;
      if (here !== arrived) {
        arrived = here;
        sec.toggleAttribute('data-arrived', here);
        // One light tick, once, when the horizon settles into place.
        if (here && !buzzed) {
          buzzed = true;
          haptic('light');
        }
      }
      if (theme !== themeTo) {
        theme += (themeTo - theme) * (1 - Math.exp(-dt * 9));
        if (Math.abs(theme - themeTo) < 0.002) theme = themeTo;
        dirty = true;
      }
      if (still) {
        if (!dirty) return;
      } else {
        time += dt;
        // The sun climbs for about a minute after arrival, then holds.
        if (arrived && sunUp < 1) sunUp = Math.min(1, sunUp + dt / 60);
      }
      dirty = false;
      const u = prog.u;
      gl.viewport(0, 0, cv.width, cv.height);
      gl.useProgram(prog.prog);
      gl.uniform2f(u.uRes, cv.width, cv.height);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uProg, p);
      gl.uniform1f(u.uPre, pre);
      gl.uniform1f(u.uTheme, theme);
      gl.uniform1f(u.uSunUp, still ? 1 : sunUp);
      const mixc = (a: number[], bb: number[], i: number) => a[i] + (bb[i] - a[i]) * theme;
      gl.uniform3f(u.uShallow, mixc(SHALLOW.light, SHALLOW.dark, 0), mixc(SHALLOW.light, SHALLOW.dark, 1), mixc(SHALLOW.light, SHALLOW.dark, 2));
      gl.uniform3f(u.uDeep, mixc(DEEP.light, DEEP.dark, 0), mixc(DEEP.light, DEEP.dark, 1), mixc(DEEP.light, DEEP.dark, 2));
      // The horizon rests above the middle; the words stand in the water's
      // near, dark reach below it. The sun keeps to the right of them.
      gl.uniform1f(u.uHorizon, narrow ? 0.3 : 0.24);
      gl.uniform1f(u.uSunAz, Math.atan((narrow ? 0.7 : 0.46) * aspect * 0.3249));
      gl.uniform2f(u.uNet, NET_DAY, 0);
      gl.uniform3f(u.uGlow, GLOW[0], GLOW[1], GLOW[2]);
      gl.uniform1f(u.uCalm, calm);
      gl.uniform1f(u.uNear, near);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }, 40);

    return () => {
      off();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('themechange', onTheme);
      // The context belongs to this canvas element for its whole life, so
      // it is not thrown away here: an effect that re-runs gets it back.
      gl.deleteProgram(prog.prog);
    };
  }, []);

  return (
    <footer ref={section} className="ending ending-full" aria-label="Contact">
      <div className="ending-pin">
        <canvas ref={canvas} className="ending-canvas" aria-hidden="true" />
        <div className="ending-copy wrap" data-chrome>
          <div className="ending-block" ref={block}>
            <h2 className="ending-head">
              <span className="ending-line">It&apos;s still early.</span>
            </h2>
            <p className="label ending-kicker">Selected for OpenAI DevDay 2026</p>
            <Contact />
          </div>
          <div className="ending-foot label">
            <span>
              <a href="/feed.xml">RSS</a>
              <HapticsSetting />
            </span>
            {note ? <span className="ending-note">{note}</span> : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
