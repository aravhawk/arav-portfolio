'use client';

import { useEffect, useRef } from 'react';
import { beats, person } from '@/lib/facts';
import { world } from '@/world/store';
import { SITES, HOLD } from '@/world/beats';
import { TLink } from '@/components/shell/Shell';

const SEG = 2; // screens of scroll per beat
const Arrow = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M1 10 10 1M3 1h7v7" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
);
const pad2 = (n: number) => String(n).padStart(2, '0');

export default function Story() {
  const root = useRef<HTMLElement>(null);
  const hudN = useRef<HTMLElement>(null); const hudL = useRef<HTMLSpanElement>(null); const hudT = useRef<HTMLElement>(null); const bar = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!;
    if (document.documentElement.dataset.world !== 'live') return;
    const sections = Array.from(el.querySelectorAll<HTMLElement>('.beat'));
    const callouts = Array.from(el.querySelectorAll<HTMLElement>('.callout'));
    const out = { x: 0, y: 0, on: false };
    let raf = 0; let active = -1; let lastT = '';
    const last = beats.length;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.documentElement.dataset.world !== 'live') { cancelAnimationFrame(raf); return; }
      const eng = world.get().engine;
      const seg = innerHeight * SEG;
      const qs = Math.min(last + 0.36, 1 + scrollY / seg);
      eng?.setQ(qs);
      const q = eng ? Math.max(eng.q, 1) : qs;
      let now = -1;
      for (let k = 1; k <= last; k++) {
        const lo = k === 1 ? -1 : k - 0.075; const hi = k === last ? 99 : k + HOLD + 0.04;
        if (q > lo && q < hi) now = k;
      }
      if (now !== active) {
        active = now;
        sections.forEach((s) => { const on = Number(s.dataset.beat) === now; if (on) s.dataset.on = ''; else delete s.dataset.on; });
        callouts.forEach((c) => { if (Number(c.dataset.beat) === now) c.dataset.on = ''; else delete c.dataset.on; });
        if (cue.current) { if (now === 1) cue.current.dataset.on = ''; else delete cue.current.dataset.on; }
      }
      const near = Math.min(last, Math.max(1, Math.round(q - 0.18)));
      if (hudN.current) hudN.current.textContent = pad2(near);
      if (hudL.current) hudL.current.textContent = beats[near - 1].label;
      // minutes to first light: the scroll is the clock
      const left = Math.max(0, 1 - (q - 1) / (last - 1)); const secs = Math.round(left * 47 * 60);
      const t = secs <= 0 ? 'First light' : `${pad2(Math.floor(secs / 60))}:${pad2(secs % 60)}`;
      if (t !== lastT && hudT.current) { hudT.current.textContent = t; lastT = t; }
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, (q - 1) / (last - 1))})`;
      if (eng && innerWidth > 720) {
        for (const c of callouts) {
          if (Number(c.dataset.beat) !== now) continue;
          const k = Number(c.dataset.beat); const s = SITES[k];
          eng.project([s[0] + Number(c.dataset.x), s[1] + Number(c.dataset.y), s[2] + Number(c.dataset.z)], out);
          c.style.transform = `translate3d(${out.x.toFixed(1)}px, ${out.y.toFixed(1)}px, 0)`;
          c.style.visibility = out.on ? 'visible' : 'hidden';
        }
      }
    };
    raf = requestAnimationFrame(loop);

    // The Merlin beat: your hand turns the engine.
    const padEl = el.querySelector<HTMLElement>('.spin-pad');
    let drag: { id: number; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; padEl?.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!drag || e.pointerId !== drag.id) return; world.get().engine?.spin(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; };
    const up = (e: PointerEvent) => { if (drag?.id === e.pointerId) drag = null; };
    padEl?.addEventListener('pointerdown', down); padEl?.addEventListener('pointermove', move); padEl?.addEventListener('pointerup', up); padEl?.addEventListener('pointercancel', up);

    // Keyboard: focusing a link inside a beat brings that beat on screen.
    const onFocus = (e: FocusEvent) => {
      const s = (e.target as HTMLElement).closest<HTMLElement>('.beat'); if (!s || 'on' in s.dataset) return;
      window.scrollTo({ top: (Number(s.dataset.beat) - 1) * innerHeight * SEG + 2 });
    };
    el.addEventListener('focusin', onFocus);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('focusin', onFocus); padEl?.removeEventListener('pointerdown', down); padEl?.removeEventListener('pointermove', move); padEl?.removeEventListener('pointerup', up); padEl?.removeEventListener('pointercancel', up); };
  }, []);

  return (
    <main id="main" className="story" ref={root} style={{ '--beats': beats.length - 1 + 0.36 } as React.CSSProperties}>
      <h1 className="sr">Arav Jain. Co-founder, Infiniflop Labs.</h1>
      {beats.map((b) => {
        const longest = Math.max(0, ...b.head.map((l) => l.reduce((n, p) => n + p.t.length * (p.w === 'black' ? 1.9 : 1), 0)));
        const size = longest > 26 ? 'md' : longest > 15 ? 'lg' : 'xl';
        return (
          <section key={b.id} className="beat" data-beat={b.n} data-place={b.place} data-on={b.n === 1 ? '' : undefined} aria-label={b.label} style={{ '--still': `url(/stills/${b.n}.webp)` } as React.CSSProperties}>
            <div className="beat-still" aria-hidden="true" />
            {b.id === 'merlin' && <div className="spin-pad" aria-hidden="true" />}
            <div className="copy">
              {b.kicker && <p className="kicker mono">{b.kicker}</p>}
              {b.head.length > 0 && (
                <h2 className="head" data-size={size}>
                  {b.head.map((ln, i) => (
                    <span className="ln" key={i} style={{ '--l': i } as React.CSSProperties}>
                      {ln.map((p, j) => <span key={j} className={p.w}>{p.t}</span>)}
                    </span>
                  ))}
                </h2>
              )}
              {b.n === 1 ? (
                <p className="line hero-line thin">I build AI agents <span className="black">and the tools around them.</span></p>
              ) : b.line ? <p className="line">{b.line}</p> : null}
              {b.link && <a className="go mono" href={b.link.href} target="_blank" rel="noopener noreferrer">{b.link.label}<Arrow /></a>}
              {b.id === 'early' && (
                <div className="ends">
                  <ul className="contact black">
                    {person.links.map((l) => <li key={l.href}><a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></li>)}
                    <li><a href={`mailto:${person.email}`}>Email</a></li>
                  </ul>
                  <p className="more mono"><TLink href="/work">Everything I have built</TLink><TLink href="/blog">Writing</TLink></p>
                </div>
              )}
            </div>
          </section>
        );
      })}
      {beats.flatMap((b) => (b.callouts ?? []).map((c, i) => (
        <div key={`${b.id}-${i}`} className="callout mono" data-beat={b.n} data-side={c.side ?? 'r'} data-x={c.at[0]} data-y={c.at[1]} data-z={c.at[2]} aria-hidden="true"><i /><s /><span>{c.text}</span></div>
      )))}
      <div className="scroll-cue mono" ref={cue} data-on="" aria-hidden="true">Scroll</div>
      <div className="hud mono" aria-hidden="true">
        <div><b ref={hudN}>01</b> / {pad2(beats.length)}&nbsp;&nbsp;<span ref={hudL}>{beats[0].label}</span></div>
        <div className="hud-r"><span>First light in </span><b ref={hudT}>47:00</b></div>
      </div>
      <div className="hud-bar" ref={bar} aria-hidden="true" />
    </main>
  );
}
