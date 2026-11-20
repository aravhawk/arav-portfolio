import type { Metadata } from 'next';
import { LakeCanvas } from '../hero/LakeCanvas';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { Arrow } from '@/components/bits';
import { PROJECTS } from '@/content/projects';
import { KIND } from '@/content/kinds';
import { scenes, flightLength } from '@/scene/flight/scenes';
import '../../home.css';
import '../../flight.css';

export const metadata: Metadata = {
  title: 'Frozen river flight',
  robots: { index: false, follow: false },
  alternates: { canonical: '/lab/flight' },
};

export default function FlightLab() {
  return (
    <main id="main" className="fl" data-lake-lab data-flight-lab>
      <style>{`
      [data-lake-lab] .fl-lake .fl-poster {
        background: center / cover no-repeat url('/scene/lake/still-day.avif');
      }
      html[data-theme='dark'] [data-lake-lab] .fl-lake .fl-poster {background-image:url('/scene/lake/still-night.avif')}
      @media(max-aspect-ratio:1/1){
        [data-lake-lab] .fl-lake .fl-poster {background-image:url('/scene/lake/still-day-phone.avif')}
        html[data-theme='dark'] [data-lake-lab] .fl-lake .fl-poster {background-image:url('/scene/lake/still-night-phone.avif')}
      }
      #main[data-flight-lab] .fl-pin {position:sticky;top:0;height:100svh}
      #main[data-flight-lab] .fl-words:not([data-on]) {opacity:0;visibility:hidden}
      #main[data-flight-lab] .fl-view-words {position:absolute;justify-content:flex-end;align-items:flex-start;flex-direction:column;
        padding:0 var(--gutter) var(--fl-foot);inset:0}
      #main[data-flight-lab] [data-placement='lower-right'] {align-items:flex-end;text-align:right}
      #main[data-flight-lab] .fl-view-words .fl-line {max-width:32ch}
    `}</style>
      <section
        className="fl-sec fl-hero"
        data-fl
        style={{ height: (1 + flightLength) * 100 + 'svh' }}
        aria-labelledby="name"
        data-lenis-prevent
      >
        <div className="fl-pin">
          <div className="fl-lake" data-basin style={{ display: 'block' }}>
            <div className="fl-poster" aria-hidden="true" />
            <LakeCanvas flight />
            <h1 id="name" className="fl-name sr-only" data-ice>
              Arav Jain
            </h1>
          </div>
          <div
            className="fl-words fl-hero-words"
            data-fl-from={-1}
            data-fl-to={1.9}
            data-copy="lake"
            data-placement={scenes[0].words}
            data-hero
            data-on
          >
            <p className="statement fl-role">
              <span className="fl-rise" data-at={-1} data-in>
                <span className="fl-rise-in">AI and developer</span>
              </span>
              <span className="fl-rise" data-at={-1} data-in>
                <span className="fl-rise-in">tooling builder.</span>
              </span>
            </p>
            <p className="fl-line fl-intro" data-at={-1} data-fl-until={0.25} data-in>
              I co-founded Infiniflop Labs and build Infiniview: agents that attack your app to prove what
              breaks.
            </p>
          </div>
          {scenes.map((scene) => {
            if (scene.kind !== 'plate') return null;
            const p = PROJECTS.find((project) => project.slug === scene.project)!;
            return (
              <div
                key={scene.id}
                className="fl-words fl-block fl-view-words"
                data-copy={scene.id}
                data-placement={scene.words}
                aria-hidden="true"
                inert
              >
                <p className="fl-eyebrow" data-at="0" data-in>
                  {KIND[p.slug]}
                </p>
                <ViewTransition name={`title-${p.slug}`} share="title" default="none">
                  <h2 className="display fl-view-name fl-rise" data-at="0" data-in>
                    <span className="fl-rise-in">
                      <Link className="beat-link" href={`/work/${p.slug}`}>
                        {p.name}
                        <Arrow />
                      </Link>
                    </span>
                  </h2>
                </ViewTransition>
                <p className="fl-line" data-at="0" data-in>
                  {p.line}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
