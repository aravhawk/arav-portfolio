'use client';

import Link from 'next/link';
import { ViewTransition, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Glass from '@/components/Glass';
import Counter from '@/components/Counter';
import { ArrowRight, ArrowUpRight, Pause, Play } from '@/components/Icons';
import { stage, type Scene } from '@/stage/stage';
import { smooth } from '@/lib/motion';
import { contact, flagships, metrics, press, scenes, t3Titles, type Project } from '@/lib/site';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Beat = { k: string; scene: Scene; lines: string[]; linesNarrow?: string[]; w: number; wNarrow?: number; cap?: string; pos: string; enter: string; side: string; slug?: string };

const layout: Record<string, { pos: string; enter: string; side: string; cap?: string }> = {
  infiniview: { pos: 'tl', enter: 'rise', side: 'left', cap: '40svh' },
  'open-source': { pos: 'tl', enter: 'left', side: 'right' },
  'kilo-bench': { pos: 'bl', enter: 'zoom', side: 'tr' },
  'agent-bridge': { pos: 'tl', enter: 'split', side: 'right', cap: '30svh' },
  'open-models': { pos: 'tl', enter: 'rise', side: 'left', cap: '44svh' },
  'cc-switch': { pos: 'bl', enter: 'wide', side: 'tr', cap: '40svh' },
  tensorpow: { pos: 'tl', enter: 'rise', side: 'right', cap: '40svh' },
  'merlin-control': { pos: 'bl', enter: 'fall', side: 'tr', cap: '44svh' },
};

const beats: Beat[] = [
  { k: 'hero', scene: scenes.hero, lines: ['Arav', 'Jain'], w: 2.74, pos: 'tl', enter: 'fill', side: 'bottom' },
  ...flagships.map((p) => ({ k: p.slug, slug: p.slug, scene: (scenes as Record<string, Scene>)[p.slug], lines: p.lines, linesNarrow: p.linesNarrow, w: p.w, wNarrow: p.wNarrow, ...layout[p.slug] })),
  { k: 'more', scene: scenes.more, lines: ['More'], w: 3.04, pos: 'tl', enter: 'left', side: 'bottom', cap: '30svh' },
  { k: 'contact', scene: scenes.contact, lines: [], w: 1, pos: 'tl', enter: 'none', side: 'bottom' },
];

const closing = press.quotes[1].split(' ');

function Word({ beat }: { beat: Beat }) {
  const render = (lines: string[], w: number, cls: string) => (
    <div className={`word ${cls}`} data-enter={beat.enter} style={{ '--w': w, ...(beat.cap ? { '--cap': beat.cap } : {}) } as CSSProperties}>
      {lines.map((l, i) => (
        <span className="line" key={l} style={{ '--i': i } as CSSProperties}>
          <span data-refract>{l}</span>
        </span>
      ))}
    </div>
  );
  const wide = render(beat.lines, beat.w, beat.linesNarrow ? 'only-wide' : '');
  return (
    <>
      {beat.slug ? (
        <ViewTransition name={`title-${beat.slug}`} share="title" default="none">
          {wide}
        </ViewTransition>
      ) : (
        wide
      )}
      {beat.linesNarrow ? render(beat.linesNarrow, beat.wNarrow ?? beat.w, 'only-narrow') : null}
    </>
  );
}

function PaneShell({ p, children }: { p: Project; children: ReactNode }) {
  return (
    <Glass className="pane" refract>
      <h2 className="sr-only">{p.name}</h2>
      {children}
    </Glass>
  );
}

function Links({ p, primary }: { p: Project; primary: { label: string; href: string } }) {
  return (
    <div className="pane-links">
      <a className="btn btn--solid" href={primary.href} target="_blank" rel="noopener noreferrer" data-magnet>
        {primary.label}
        <ArrowUpRight />
      </a>
      <Link className="btn btn--icon" href={`/work/${p.slug}`} aria-label={`${p.name}: details`} data-magnet>
        <ArrowRight />
      </Link>
    </div>
  );
}

function PrTitle() {
  const t = t3Titles[0];
  return (
    <p className="pr">
      <span>
        <code>{t.code}</code>
        {t.post} <span className="mono">#{t.n}</span>
      </span>
    </p>
  );
}

function BridgeVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(rm);
    if (rm) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!v.src) v.src = '/media/agent-bridge-demo.mp4';
          v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        } else {
          v.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (!v.src) v.src = '/media/agent-bridge-demo.mp4';
    if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {});
    else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="video">
      <video ref={ref} muted loop playsInline preload="none" poster="/media/agent-bridge-poster.jpg" controls={reduced} aria-label="Agent Bridge launch video, no sound" width={1920} height={1080} />
      {!reduced ? (
        <button type="button" className="btn btn--icon video-play" onClick={toggle} aria-label={playing ? 'Pause video' : 'Play video'}>
          {playing ? <Pause /> : <Play />}
        </button>
      ) : null}
    </div>
  );
}

function Pane({ p }: { p: Project }) {
  switch (p.slug) {
    case 'infiniview':
      return (
        <PaneShell p={p}>
          <p className="pane-say">It attacks your app in a sandbox. You get replayable proof of what broke.</p>
          <ul className="chips">
            <li className="chip">Early access</li>
            <li className="chip">Selected for OpenAI DevDay 2026</li>
          </ul>
          <Links p={p} primary={p.links[0]} />
        </PaneShell>
      );
    case 'open-source':
      return (
        <PaneShell p={p}>
          <div className="stat">
            <Counter value={metrics.mergedUpstream} />
            <span>PRs merged upstream</span>
          </div>
          <div className="stat">
            <Counter value={metrics.t3Merged} />
            <span>in T3 Code</span>
          </div>
          <PrTitle />
          <Links p={p} primary={{ label: 'GitHub', href: p.links[0].href }} />
        </PaneShell>
      );
    case 'kilo-bench':
      return (
        <PaneShell p={p}>
          <p className="pane-say">Native model benchmarking in Kilo Code.</p>
          <ul className="chips">
            <li className="chip">Won “Kilo - For Devs, By Devs”</li>
            <li className="chip">DeveloperWeek 2026</li>
          </ul>
          <Links p={p} primary={p.links[0]} />
        </PaneShell>
      );
    case 'agent-bridge':
      return (
        <PaneShell p={p}>
          <BridgeVideo />
          <p className="pane-say">An OpenAI Dot and a Grok Bot share one inbox. Messages are data, never permission.</p>
          <Links p={p} primary={p.links[0]} />
        </PaneShell>
      );
    case 'open-models':
      return (
        <PaneShell p={p}>
          <p className="pane-say">My GGUF builds on Ollama.</p>
          <ul className="rows">
            {metrics.ollamaModels.map((m) => (
              <li key={m.name}>
                <span className="mono">{m.name}</span>
                <b>{m.pulls.toLocaleString('en-US')}</b>
              </li>
            ))}
          </ul>
          <Links p={p} primary={{ label: 'Ollama', href: p.links[0].href }} />
        </PaneShell>
      );
    case 'cc-switch':
      return (
        <PaneShell p={p}>
          <p className="pane-say">Claude Code profiles across Anthropic and open models. One command.</p>
          <div className="stat">
            <Counter value={metrics.npmDownloads} />
            <span>npm downloads</span>
          </div>
          <Links p={p} primary={p.links[0]} />
        </PaneShell>
      );
    case 'tensorpow':
      return (
        <PaneShell p={p}>
          <p className="pane-say">GPU-native proof of work on INT8 tensors. Becoming a research paper.</p>
          <Links p={p} primary={p.links[0]} />
        </PaneShell>
      );
    default:
      return (
        <PaneShell p={p}>
          <p className="pane-say">A wireframe Merlin 1D you fly with bare hands, through a webcam.</p>
          <Links p={p} primary={p.links[0]} />
        </PaneShell>
      );
  }
}

export default function Home() {
  const typeLayer = useRef<HTMLDivElement>(null);
  const uiLayer = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Loading moment: the counter runs on real readiness (fonts, then the shader), droplets merge as it finishes.
  useIsoLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem('seen') === '1';
    } catch {}
    if (reduced || seen) {
      setLoad(100);
      setRevealed(true);
      return;
    }
    window.__intro = true;
    let fonts = false;
    let gl = Boolean(window.__dropReady);
    let shown = 0;
    let raf = 0;
    const t0 = performance.now();
    document.fonts.ready.then(() => (fonts = true));
    const onReady = () => (gl = true);
    window.addEventListener('drop:ready', onReady);
    const tick = (now: number) => {
      const el = now - t0;
      const target = el > 2600 ? 100 : (fonts ? 40 : 12) + (gl ? 60 : Math.min(30, el / 40));
      shown += (target - shown) * 0.12 + 0.4;
      shown = Math.min(shown, target);
      setLoad(Math.round(shown));
      if (shown >= 99.5 && el > 700) {
        setLoad(100);
        setRevealed(true);
        window.__intro = false;
        try {
          sessionStorage.setItem('seen', '1');
        } catch {}
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('drop:ready', onReady);
      window.__intro = false;
    };
  }, []);

  // The conductor: one loop reads scroll, blends neighbouring scenes, and moves the depth layers.
  useEffect(() => {
    const ui = uiLayer.current;
    const ty = typeLayer.current;
    if (!ui || !ty) return;
    const secs = Array.from(ui.querySelectorAll<HTMLElement>('.beat'));
    const pars = Array.from(ty.querySelectorAll<HTMLElement>('.tbeat')).map((s) => ({ par: s.querySelector<HTMLElement>('.par'), words: Array.from(s.querySelectorAll<HTMLElement>('.word')) }));
    const panes = secs.map((s) => ({ ppar: s.querySelector<HTMLElement>('.ppar'), wrap: s.querySelector<HTMLElement>('.pane-wrap') }));
    const sayWords = Array.from(ty.querySelectorAll<HTMLElement>('.say-big span'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = secs.map(() => false);
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vh = window.innerHeight;
      const c = vh / 2;
      const rects = secs.map((s) => s.getBoundingClientRect());
      let i = rects.findIndex((r) => r.top <= c && r.bottom > c);
      if (i < 0) i = rects[0].top > c ? 0 : secs.length - 1;
      const r = rects[i];
      const win = vh * 0.8;
      let a = i;
      let b = i;
      let m = 0;
      const toEnd = r.bottom - c;
      const fromStart = c - r.top;
      if (toEnd < win / 2 && i < secs.length - 1) {
        b = i + 1;
        m = 0.5 - toEnd / win;
      } else if (fromStart < win / 2 && i > 0) {
        a = i - 1;
        m = 0.5 + fromStart / win;
      }
      m = smooth(m);
      if (reduced) m = m < 0.5 ? 0 : 1;
      stage.setBlend(beats[a].scene, beats[b].scene, m);

      const lean = stage.vel.x * -3.5;
      for (let j = 0; j < secs.length; j++) {
        const rr = rects[j];
        if (rr.bottom < -vh || rr.top > vh * 2) continue;
        const on = j === 0 ? rr.bottom > vh * 0.75 : rr.top < vh * 0.42 && rr.bottom > vh * 0.62;
        if (on !== state[j]) {
          state[j] = on;
          const v = String(on);
          if (j > 0) pars[j].words.forEach((w) => (w.dataset.in = v));
          if (panes[j].wrap && j > 0) panes[j].wrap!.dataset.in = v;
        }
        if (reduced) continue;
        const p = (c - rr.top) / rr.height - 0.5;
        const par = pars[j].par;
        if (par) par.style.transform = `translate3d(0,${(-p * vh * 0.16).toFixed(1)}px,0) skewX(${lean.toFixed(2)}deg)`;
        const pp = panes[j].ppar;
        if (pp) pp.style.transform = `translate3d(0,${(p * vh * 0.07).toFixed(1)}px,0)`;
      }
      const k = beats[i].k;
      stage.grow.target = k === 'kilo-bench' || k === 'open-models' ? (state[i] ? 1 : 0) : 1;

      // Closing statement: words light up one at a time as the section passes.
      const last = rects[rects.length - 1];
      const prog = (vh * 0.9 - last.top) / (vh * 0.7);
      const lit = Math.floor(Math.max(0, Math.min(1, prog)) * (sayWords.length + 0.999));
      sayWords.forEach((w, n) => {
        const v = String(n < lit);
        if (w.dataset.on !== v) w.dataset.on = v;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="home">
      <div className="layer-type" ref={typeLayer} aria-hidden="true">
        {beats.map((b) => (
          <div className="tbeat" data-k={b.k} key={b.k}>
            <div className="tpin">
              <div className="par" data-pos={b.pos}>
                {b.k === 'hero' ? (
                  <div className="word" data-enter="fill" data-in={revealed} style={{ '--w': b.w } as CSSProperties}>
                    {b.lines.map((l, i) => (
                      <span className="line" key={l} style={{ '--i': i } as CSSProperties}>
                        <span data-refract>{l}</span>
                      </span>
                    ))}
                  </div>
                ) : b.k === 'contact' ? (
                  <p className="say-big">
                    {closing.map((w, i) => (
                      <span key={i}>{w} </span>
                    ))}
                  </p>
                ) : (
                  <Word beat={b} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="layer-ui" ref={uiLayer}>
        <section className="beat" data-k="hero" aria-labelledby="hero-h">
          <div className="pin">
            {revealed && load >= 100 ? null : (
              <span className="load mono" aria-hidden="true">
                {String(load).padStart(3, '0')}
              </span>
            )}
            <div className="hero-foot" data-in={revealed}>
              <div>
                <h1 id="hero-h" className="sr-only">
                  Arav Jain
                </h1>
                <p className="hero-say rise">I build agents that break software before someone else does.</p>
              </div>
              <ul className="readouts" aria-label="Numbers, read on November 14, 2026">
                {[
                  { v: metrics.ollamaPulls, l: 'Ollama pulls' },
                  { v: metrics.npmDownloads, l: 'npm downloads' },
                  { v: metrics.contributions2026, l: 'contributions 2026' },
                  { v: metrics.mergedUpstream, l: 'PRs merged' },
                ].map((r, i) => (
                  <Glass as="li" className="readout rise" key={r.l} style={{ '--i': i + 1 } as CSSProperties}>
                    <Counter value={r.v} />
                    <span>{r.l}</span>
                  </Glass>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {flagships.map((p) => (
          <section className="beat" data-k={p.slug} key={p.slug} id={p.slug}>
            <div className="pin">
              <div className="ppar" data-side={layout[p.slug].side}>
                <div className="pane-wrap">
                  <Pane p={p} />
                </div>
              </div>
            </div>
          </section>
        ))}

        <section className="beat" data-k="more" aria-labelledby="more-h">
          <div className="pin">
            <div className="ppar" data-side="bottom" style={{ justifySelf: 'stretch' }}>
              <div className="pane-wrap more">
                <h2 id="more-h" className="sr-only">
                  More work
                </h2>
                <ul className="more-chips">
                  {['RydAR', 'Ask Around', 'ClarifAI', 'fix-it-bot', 'VEX robotics'].map((n) => (
                    <li key={n}>
                      <Glass as="a" className="btn" href={n === 'RydAR' ? '/work/rydar' : '/work#highlights'} radius={999}>
                        {n}
                      </Glass>
                    </li>
                  ))}
                  <li>
                    <Link className="btn btn--solid" href="/work" data-magnet>
                      All work
                      <ArrowRight />
                    </Link>
                  </li>
                </ul>
                <figure className="press">
                  <blockquote>
                    <p>“{press.quotes[0]}”</p>
                  </blockquote>
                  <figcaption>
                    <cite>
                      <a href={press.href} target="_blank" rel="noopener noreferrer">
                        {press.outlet}
                      </a>
                      , {press.date}
                    </cite>
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        <section className="beat" data-k="contact" id="contact" aria-labelledby="contact-h">
          <div className="pin">
            <div className="ppar" data-side="bottom" style={{ justifySelf: 'stretch' }}>
              <div className="pane-wrap contact">
                <h2 id="contact-h" className="sr-only">
                  Contact
                </h2>
                <p className="sr-only">
                  “{press.quotes[1]}” {press.outlet}, {press.date}.
                </p>
                <ul>
                  <li>
                    <a className="btn btn--solid" href={`mailto:${contact.email}`} data-magnet>
                      Email
                      <ArrowUpRight />
                    </a>
                  </li>
                  {[
                    ['GitHub', contact.github],
                    ['X', contact.x],
                    ['LinkedIn', contact.linkedin],
                  ].map(([l, h]) => (
                    <li key={l}>
                      <Glass as="a" className="btn" href={h} target="_blank" rel="noopener noreferrer" radius={999}>
                        {l}
                        <ArrowUpRight />
                      </Glass>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
