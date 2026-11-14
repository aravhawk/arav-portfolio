'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { smooth, span, story } from '@/lib/story';
import { now } from '@/lib/content';
import { Arrow } from './Arrow';

// The three verbs are Infiniflop's own: "Agents that review, probe, and stress-test your code".
const probes = ['Review', 'Probe', 'Stress-test'];

export default function Now() {
  const tags = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  // Labels hang off three of the probe rings in the 3D scene.
  useFrame(() => {
    const el = tags.current;
    if (!el) return;
    // The copy leaves before the next chapter's first rule arrives, so the two never share the screen.
    if (root.current && grid.current && !story.reduced) {
      const r = root.current.getBoundingClientRect();
      // in only once the chapter is pinned and the camera has settled on the rings
      const enter = smooth(span(r.top, story.vh * 0.22, 0));
      const out = smooth(span(-r.top / Math.max(1, r.height - story.vh), 0.78, 0.94));
      grid.current.style.opacity = (enter * (1 - out)).toFixed(3);
      grid.current.style.transform = `translate3d(0, ${((1 - enter) * 32 - out * 40).toFixed(1)}px, 0)`;
    }
    const show = story.chapter === 'now';
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i] as HTMLElement;
      const a = story.anchors[i];
      // a label that would run off the right edge or under the nav stays hidden
      const on = show && a.on && a.x < story.vw - 190 && a.x > 8 && a.y > 76 ? '1' : '0';
      if (c.style.opacity !== on) c.style.opacity = on;
      if (on === '1') c.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
    }
  });

  return (
    <section ref={root} className="now g-black" data-chapter="now" data-ground="#0a0a0a" aria-labelledby="now-title">
      <div className="probe-tags mono" ref={tags} aria-hidden="true">
        {probes.map((p, i) => (
          <span className="probe-tag" key={p}>
            <i />
            <b>
              {String(i + 1).padStart(2, '0')} {p}
            </b>
          </span>
        ))}
      </div>
      <div className="pin front now-pin wrap">
        <div className="now-grid" ref={grid}>
          <p className="label mono" data-live>
            Now / {now.company}, est. {now.founded}
          </p>
          <h2 id="now-title" className="now-title">
            We&apos;re building <em>{now.product}</em>.
          </h2>
          <p className="now-line">{now.line}</p>
          <div>
            <a className="btn" data-tone="yellow" href={now.href} target="_blank" rel="noopener noreferrer">
              Visit {now.hrefLabel} <Arrow out />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
