'use client';

import { useRef } from 'react';
import { useFrame } from '@/lib/useFrame';
import { story } from '@/lib/story';
import { now } from '@/lib/content';
import { Arrow } from './Arrow';

// The three verbs are Infiniflop's own: "Agents that review, probe, and stress-test your code".
const probes = ['Review', 'Probe', 'Stress-test'];

export default function Now() {
  const tags = useRef<HTMLDivElement>(null);

  // Labels hang off three of the probe rings in the 3D scene.
  useFrame(() => {
    const el = tags.current;
    if (!el) return;
    const show = story.chapter === 'now' && story.vw >= 900;
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i] as HTMLElement;
      const a = story.anchors[i];
      // a label that would run off the right edge or under the nav stays hidden
      const on = show && a.on && a.x < story.vw - 260 && a.y > 130 ? '1' : '0';
      if (c.style.opacity !== on) c.style.opacity = on;
      if (on === '1') c.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
    }
  });

  return (
    <section className="now" data-chapter="now" data-ground="#0a0a0a" aria-labelledby="now-title">
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
        <div className="now-grid">
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
