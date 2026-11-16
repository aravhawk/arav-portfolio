import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow, Slab } from '@/components/bits';
import { Ending } from '@/components/ending/Ending';
import { FlightStage } from '@/components/FlightStage';
import { PROJECTS, type ProjectMedia } from '@/content/projects';
import { SECTIONS } from '@/water/camera';
import '../home.css';
import './flight.css';

// A prototype: reachable by address only.
export const metadata: Metadata = {
  title: 'Flight',
  robots: { index: false, follow: false },
};

const INFINIVIEW = PROJECTS.find((p) => p.slug === 'infiniview')!;

const INFINIVIEW_HOME: ProjectMedia = {
  kind: 'image',
  src: '/media/infiniview-hero.webp',
  alt: 'The Infiniview site: the headline Attack your code before anyone else does, and a sample run that ends with one critical and one high finding posted to a pull request.',
  w: 2200,
  h: 1376,
};

// Where each section begins, in screens of scroll, and when its words show.
const SAY = SECTIONS.hero;
const VIEW = SAY + SECTIONS.say;
const OUT = VIEW + SECTIONS.infiniview;

const len = (screens: number, last = false) => ({ '--len': last ? screens : screens + 1 }) as React.CSSProperties;

export default function Flight() {
  return (
    <>
      <main id="main" className="fl">
        <FlightStage slab={INFINIVIEW_HOME.src} />

        {/* ---------- the frozen lake ---------- */}
        <section className="fl-sec fl-hero" data-fl style={len(SECTIONS.hero)} aria-labelledby="name">
          <div className="fl-pin">
            <div className="fl-lake" data-basin>
              <h1 id="name" className="ice fl-name" data-ice>
                <span data-ice-line>Arav</span> <span data-ice-line>Jain</span>
              </h1>
            </div>
            <div className="fl-words fl-hero-words" data-fl-from={-1} data-fl-to={0.2} data-on>
              <p className="statement fl-role">AI and developer tooling builder.</p>
              <p className="lead fl-intro">I co-founded Infiniflop Labs and build Infiniview: agents that attack your app to prove what breaks.</p>
            </div>
          </div>
        </section>

        {/* ---------- the statement ---------- */}
        <section className="fl-sec fl-say" data-fl style={len(SECTIONS.say)} aria-label="What I do">
          <div className="fl-pin">
            <div className="fl-words fl-say-words" data-fl-from={SAY + 0.45} data-fl-to={VIEW - 0.3}>
              <p className="say-text fl-say-text">Agents that break software before attackers do. Tools developers run daily.</p>
            </div>
          </div>
        </section>

        {/* ---------- 01 Infiniview ---------- */}
        <section className="fl-sec fl-view" data-fl style={len(SECTIONS.infiniview)} aria-label="Infiniview">
          <div className="fl-pin">
            <div className="fl-words fl-view-words" data-fl-from={VIEW + 0.8} data-fl-to={OUT - 0.85}>
              {INFINIVIEW.kicker ? <p className="label fl-label">{INFINIVIEW.kicker}</p> : null}
              <h2 className="display fl-view-name">
                <Link className="beat-link" href={`/work/${INFINIVIEW.slug}`}>
                  {INFINIVIEW.name}
                  <Arrow />
                </Link>
              </h2>
              <p className="lead fl-view-line">{INFINIVIEW.line}</p>
            </div>
            {/* Without the canvas the product stands here as a plain image. */}
            <div className="fl-still feat feat-sandbox" data-basin>
              <Slab media={INFINIVIEW_HOME} sizes="(max-width: 860px) 78vw, 40vw" />
            </div>
          </div>
        </section>

        {/* ---------- the run-out: open water, then the ending ---------- */}
        <section className="fl-sec fl-out" data-fl style={len(SECTIONS.runout, true)} aria-hidden="true">
          <div className="fl-pin" />
        </section>
      </main>
      <Ending />
    </>
  );
}
