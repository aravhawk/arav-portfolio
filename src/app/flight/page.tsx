import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow, Slab } from '@/components/bits';
import { Ending } from '@/components/ending/Ending';
import { Callout } from '@/components/flight/Callout';
import { FlightStage } from '@/components/FlightStage';
import { LiveNumber } from '@/components/LiveNumber';
import { PROJECTS, type ProjectMedia } from '@/content/projects';
import { formatAsOf, getMetrics } from '@/lib/metrics';
import { SECTIONS } from '@/water/camera';
import { TRIBS } from '@/water/world';
import '../home.css';
import './flight.css';

// A prototype: reachable by address only.
export const metadata: Metadata = {
  title: 'Flight',
  robots: { index: false, follow: false },
};

// Live numbers are read on the server and cached for an hour, as on the home page.
export const revalidate = 3600;

const INFINIVIEW = PROJECTS.find((p) => p.slug === 'infiniview')!;
const BENCH_P = PROJECTS.find((p) => p.slug === 'kilo-bench')!;
const BRIDGE_P = PROJECTS.find((p) => p.slug === 'agent-bridge')!;

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
const BENCH = OUT + SECTIONS.upstream;
const BRIDGE = BENCH + SECTIONS.bench;
const END = BRIDGE + SECTIONS.bridge;

const len = (screens: number, last = false) => ({ '--len': last ? screens : screens + 1 }) as React.CSSProperties;

export default async function Flight() {
  const m = await getMetrics();
  const repos = m.mergedPrs.byRepo.slice(0, TRIBS.length);
  return (
    <>
      <main id="main" className="fl">
        <FlightStage slab={INFINIVIEW_HOME.src} sheet={BENCH_P.media[0].kind === 'image' ? BENCH_P.media[0].src : ''} tribs={repos.map((r) => r.count).join(',')} />

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

        {/* ---------- 02 Upstream ---------- */}
        <section className="fl-sec fl-up" data-fl style={len(SECTIONS.upstream)} aria-label="Open source">
          <div className="fl-pin">
            <div className="fl-calls">
              {repos.map((r, i) => (
                <Callout
                  key={r.repo}
                  at={[TRIBS[i].head.x, TRIBS[i].head.y, 0]}
                  href={r.url}
                  label={`${r.repo}: ${r.count} merged pull request${r.count === 1 ? '' : 's'}`}
                  from={OUT + 1.3}
                  to={BENCH - 1.05}
                  lift={i % 2 ? 78 : 44}
                >
                  {r.repo.split('/')[1]}
                </Callout>
              ))}
            </div>
            <div className="fl-words fl-up-words" data-fl-from={OUT + 1.3} data-fl-to={BENCH - 1.05}>
              <p className="label fl-label">Open source</p>
              <h2 className="beat-figure fl-figure">
                <LiveNumber
                  className="number"
                  value={m.mergedPrs.upstream.value}
                  from={m.mergedPrs.upstream.snapshotValue}
                  source={m.mergedPrs.upstream.source}
                  asOf={formatAsOf(m.mergedPrs.upstream.asOf)}
                  what="merged pull requests in repositories I do not own"
                />
                <span className="title beat-unit">merged pull requests in other people&apos;s projects</span>
              </h2>
              <p className="small beat-sub fl-sub">
                <LiveNumber
                  className="mono"
                  value={m.mergedPrs.total.value}
                  from={m.mergedPrs.total.snapshotValue}
                  source={m.mergedPrs.total.source}
                  asOf={formatAsOf(m.mergedPrs.total.asOf)}
                  what="merged pull requests in total"
                />{' '}
                in all.{' '}
                <LiveNumber
                  className="mono"
                  value={m.contributions.total.value}
                  from={m.contributions.total.snapshotValue}
                  source={m.contributions.total.source}
                  asOf={formatAsOf(m.contributions.total.asOf)}
                  what={m.contributions.label}
                />{' '}
                contributions.
              </p>
              <Link className="link beat-more fl-more" href="/work/open-source">
                Upstream <Arrow />
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- 03 Kilo Bench ---------- */}
        <section className="fl-sec fl-bench" data-fl style={len(SECTIONS.bench)} aria-label="Kilo Bench">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-bench-words" data-fl-from={BENCH + 0.9} data-fl-to={BRIDGE - 0.85}>
              {BENCH_P.kicker ? <p className="label fl-label">{BENCH_P.kicker}</p> : null}
              <h2 className="display fl-view-name">
                <Link className="beat-link" href={`/work/${BENCH_P.slug}`}>
                  {BENCH_P.name}
                  <Arrow />
                </Link>
              </h2>
              <p className="lead fl-view-line">{BENCH_P.line}</p>
            </div>
            <div className="fl-still feat">
              <Slab media={BENCH_P.media[0]} sizes="(max-width: 860px) 80vw, 40vw" />
            </div>
          </div>
        </section>

        {/* ---------- 04 Agent Bridge ---------- */}
        <section className="fl-sec fl-bridge" data-fl style={len(SECTIONS.bridge)} aria-label="Agent Bridge">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-bridge-words" data-fl-from={BRIDGE + 0.95} data-fl-to={END - 0.85}>
              {BRIDGE_P.kicker ? <p className="label fl-label">{BRIDGE_P.kicker}</p> : null}
              <h2 className="display fl-view-name">
                <Link className="beat-link" href={`/work/${BRIDGE_P.slug}`}>
                  {BRIDGE_P.name}
                  <Arrow />
                </Link>
              </h2>
              <p className="lead fl-view-line">{BRIDGE_P.line}</p>
              <div className="fl-film">
                <Slab media={BRIDGE_P.media[0]} sizes="(max-width: 860px) 70vw, 30vw" />
              </div>
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
