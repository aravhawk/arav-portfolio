'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CONTACT } from '@/content/projects';
import { onFrame } from '@/lib/frame';
import { haptic } from '@/lib/haptics';
import { compile, type Program } from '@/water/gl';
import { Arrow } from '../bits';
import { ENDING_FRAG } from './shader';
import './ending.css';

const lin = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
};
const LAND = { light: lin('#E4E7E8'), dark: lin('#15181B') };
const DEEP = { light: [0.012, 0.11, 0.15], dark: [0.004, 0.03, 0.05] };

interface Props {
  /** `full`: the home page finale, scrubbed by scroll. `band`: inner pages. */
  variant?: 'full' | 'band';
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

export function Ending({ variant = 'full', note }: Props) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

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
    gl.bindVertexArray(gl.createVertexArray());
    sec.dataset.gl = 'on';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scrub = variant === 'full';
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
      const p = !scrub || still ? 1 : Math.min(1, Math.max(0, (window.scrollY - top) / span));
      if (p !== lastP) dirty = true;
      lastP = p;
      const here = p > 0.86;
      if (here !== arrived) {
        arrived = here;
        sec.toggleAttribute('data-arrived', here);
        // One light tick, once, when the horizon settles into place.
        if (here && !buzzed && scrub) {
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
      gl.uniform1f(u.uTheme, theme);
      gl.uniform1f(u.uSunUp, still ? 1 : sunUp);
      gl.uniform3f(u.uLand, LAND.light[0] + (LAND.dark[0] - LAND.light[0]) * theme, LAND.light[1] + (LAND.dark[1] - LAND.light[1]) * theme, LAND.light[2] + (LAND.dark[2] - LAND.light[2]) * theme);
      gl.uniform3f(u.uDeep, DEEP.light[0] + (DEEP.dark[0] - DEEP.light[0]) * theme, DEEP.light[1] + (DEEP.dark[1] - DEEP.light[1]) * theme, DEEP.light[2] + (DEEP.dark[2] - DEEP.light[2]) * theme);
      // Wide screens: horizon low, words on the land below it. Tall
      // screens: horizon lower still, words up in the calm of the sky.
      gl.uniform1f(u.uHorizon, variant === 'band' ? -0.08 : narrow ? -0.34 : -0.16);
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
  }, [variant]);

  return (
    <footer ref={section} className={`ending ending-${variant}`} aria-label="Contact">
      <div className="ending-pin">
        <canvas ref={canvas} className="ending-canvas" aria-hidden="true" />
        <div className="ending-copy wrap" data-chrome>
          <div className="ending-block">
            {variant === 'full' ? (
              <p className="label ending-kicker">Selected for OpenAI DevDay 2026</p>
            ) : null}
            <h2 className="ending-head display">
              <span className="ending-line">It&apos;s still early.</span>
            </h2>
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
          </div>
          <div className="ending-foot label">
            <span>
              <Link href="/work">Work</Link>
              <Link href="/blog">Writing</Link>
              <a href="/feed.xml">RSS</a>
            </span>
            {note ? <span className="ending-note">{note}</span> : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
