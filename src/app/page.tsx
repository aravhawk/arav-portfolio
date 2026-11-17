import type { Viewport } from 'next';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { Arrow, Slab } from '@/components/bits';
import { Contact, HapticsSetting } from '@/components/ending/Ending';
import { Callout } from '@/components/flight/Callout';
import { ProfileSwitch } from '@/components/home/ProfileSwitch';
import { FlightStage } from '@/components/FlightStage';
import { LiveNumber } from '@/components/LiveNumber';
import { INTERESTS, PROJECTS, type Project, type ProjectMedia } from '@/content/projects';
import { formatAsOf, getMetrics } from '@/lib/metrics';
import { THEME_COLOR } from '@/lib/site';
import { SECTIONS, SETTLE_AT } from '@/water/camera';
import { COLS, TRIBS, colHeights } from '@/water/world';
import './home.css';
import './flight.css';

/**
 * The home page: one glacial world seen through a camera that travels as
 * the page scrolls. The sections give the scroll its length and carry the
 * words; the picture is one fixed canvas behind them (FlightStage). Without
 * it the same sections stack as a plain page.
 */

// Live numbers are read on the server and cached for an hour. A visitor's
// page view never reaches GitHub, npm or Ollama.
export const revalidate = 3600;

// The browser's chrome takes the colour of the first frame's sky.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.home.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.home.dark },
  ],
};

const INFINIVIEW = PROJECTS.find((p) => p.slug === 'infiniview')!;
const BENCH_P = PROJECTS.find((p) => p.slug === 'kilo-bench')!;
const BRIDGE_P = PROJECTS.find((p) => p.slug === 'agent-bridge')!;
const SWITCH_P = PROJECTS.find((p) => p.slug === 'cc-switch')!;
const TENSOR_P = PROJECTS.find((p) => p.slug === 'tensorpow')!;
const RYDAR_P = PROJECTS.find((p) => p.slug === 'rydar')!;

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
const MODELS = BRIDGE + SECTIONS.bridge;
const FORK = MODELS + SECTIONS.models;
const LATTICE = FORK + SECTIONS.fork;
const CANYON = LATTICE + SECTIONS.lattice;
const DELTA = CANYON + SECTIONS.canyon;
const SEA = DELTA + SECTIONS.delta;

const len = (screens: number, last = false) => ({ '--len': last ? screens : screens + 1 }) as React.CSSProperties;

/** A project's name is the way in, and it travels to the page it opens. */
function Name({ p }: { p: Project }) {
  return (
    <ViewTransition name={`title-${p.slug}`} share="title" default="none">
      <h2 className="display fl-view-name">
        <Link className="beat-link" href={`/work/${p.slug}`}>
          {p.name}
          <Arrow />
        </Link>
      </h2>
    </ViewTransition>
  );
}

export default async function Home() {
  const m = await getMetrics();
  const repos = m.mergedPrs.byRepo.slice(0, TRIBS.length);
  const models = m.ollama.models.slice(0, COLS.xs.length);
  const colH = colHeights(models.map((x) => x.pulls));
  const rydar = RYDAR_P.media[0];
  return (
    <>
      <main id="main" className="fl">
        <FlightStage slab={INFINIVIEW_HOME.src} sheet={BENCH_P.media[0].kind === 'image' ? BENCH_P.media[0].src : ''} tribs={repos.map((r) => r.count).join(',')}
          cols={colH.map((h) => h.toFixed(1)).join(',')}
          face={rydar.kind === 'image' ? rydar.src : ''}
        />

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
              <Name p={INFINIVIEW} />
              <p className="lead fl-view-line">{INFINIVIEW.line}</p>
            </div>
            {/* Without the canvas the product stands here as a plain image. */}
            <div className="fl-still">
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
                  from={OUT + 1.2}
                  to={BENCH - 1.05}
                  lift={i % 2 ? 78 : 44}
                >
                  {r.repo.split('/')[1]}
                </Callout>
              ))}
            </div>
            <div className="fl-words fl-up-words" data-fl-from={OUT + 1.2} data-fl-to={BENCH - 1.05}>
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
              <Name p={BENCH_P} />
              <p className="lead fl-view-line">{BENCH_P.line}</p>
            </div>
            <div className="fl-still">
              <Slab media={BENCH_P.media[0]} sizes="(max-width: 860px) 80vw, 40vw" />
            </div>
          </div>
        </section>

        {/* ---------- 04 Agent Bridge ---------- */}
        <section className="fl-sec fl-bridge" data-fl style={len(SECTIONS.bridge)} aria-label="Agent Bridge">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-bridge-words" data-fl-from={BRIDGE + 1.1} data-fl-to={MODELS - 0.85}>
              {BRIDGE_P.kicker ? <p className="label fl-label">{BRIDGE_P.kicker}</p> : null}
              <Name p={BRIDGE_P} />
              <p className="lead fl-view-line">{BRIDGE_P.line}</p>
              <div className="fl-film">
                <Slab media={BRIDGE_P.media[0]} sizes="(max-width: 860px) 70vw, 30vw" />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 05 Open models ---------- */}
        <section className="fl-sec fl-models" data-fl style={len(SECTIONS.models)} aria-label="Open models">
          <div className="fl-pin">
            <div className="fl-calls">
              {models.map((x, i) => (
                <Callout key={x.name} at={[COLS.xs[i], COLS.y, colH[i] - 22]} href={x.url} from={MODELS + 0.9} to={FORK - 0.85} lift={i % 2 ? 40 : 64}>
                  {x.name}
                </Callout>
              ))}
            </div>
            <div className="fl-words fl-up-words fl-models-words" data-fl-from={MODELS + 0.9} data-fl-to={FORK - 0.85}>
              <p className="label fl-label">Ollama</p>
              <h2 className="beat-figure fl-figure">
                <LiveNumber
                  className="number number-sm"
                  value={m.ollama.total.value}
                  from={m.ollama.total.snapshotValue}
                  source={m.ollama.total.source}
                  asOf={formatAsOf(m.ollama.total.asOf)}
                  what="pulls of my open models on Ollama"
                />
                <span className="title beat-unit">pulls, four open models</span>
              </h2>
              <Link className="link beat-more fl-more" href="/work/ollama">
                Open models <Arrow />
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- 06 cc-switch ---------- */}
        <section className="fl-sec fl-forks" data-fl style={len(SECTIONS.fork)} aria-label="cc-switch">
          <div className="fl-pin">
            <div className="fl-words fl-up-words fl-fork-words" data-fl-from={FORK + 1.05} data-fl-to={LATTICE - 0.85}>
              <Name p={SWITCH_P} />
              <p className="lead fl-view-line">{SWITCH_P.line}</p>
              <p className="small beat-sub fl-sub">
                <LiveNumber
                  className="mono"
                  value={m.npm.allTime.value}
                  from={m.npm.allTime.snapshotValue}
                  source={m.npm.allTime.source}
                  asOf={formatAsOf(m.npm.allTime.asOf)}
                  what="npm downloads of cc-switch, all time"
                />{' '}
                npm downloads.
              </p>
              <div className="fl-fork" data-bed="feat:fork" data-active="0">
                <ProfileSwitch />
              </div>
            </div>
            <div className="fl-still fl-pool" aria-hidden="true" />
          </div>
        </section>

        {/* ---------- 07 TensorPoW ---------- */}
        <section className="fl-sec fl-tensor" data-fl style={len(SECTIONS.lattice)} aria-label="TensorPoW">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-tensor-words" data-fl-from={LATTICE + 1.0} data-fl-to={CANYON - 0.85}>
              {TENSOR_P.kicker ? <p className="label fl-label">{TENSOR_P.kicker}</p> : null}
              <Name p={TENSOR_P} />
              <p className="lead fl-view-line">{TENSOR_P.line}</p>
            </div>
            <div className="fl-still fl-pool" aria-hidden="true" />
          </div>
        </section>

        {/* ---------- 08 RydAR ---------- */}
        <section className="fl-sec fl-rydar" data-fl style={len(SECTIONS.canyon)} aria-label="RydAR">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-rydar-words" data-fl-from={CANYON + 1.9} data-fl-to={CANYON + 2.7}>
              <Name p={RYDAR_P} />
              <p className="lead fl-view-line">{RYDAR_P.line}</p>
            </div>
            <div className="fl-still">
              <Slab media={rydar} sizes="(max-width: 860px) 60vw, 30vw" />
            </div>
          </div>
        </section>

        {/* ---------- the delta: what he is into ---------- */}
        <section className="fl-sec fl-delta" data-fl style={len(SECTIONS.delta)} aria-labelledby="into">
          <div className="fl-pin">
            <div className="fl-words fl-into-words" data-fl-from={DELTA + 0.95} data-fl-to={SEA - 0.5}>
              <p className="label fl-label" id="into">
                Into
              </p>
              <ul className="into-list title fl-into-list">
                {INTERESTS.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p className="lead fl-into-next">Next: a company, a research paper, and code in tools you open daily.</p>
              <Link className="btn fl-into-btn" href="/work">
                All work <Arrow />
              </Link>
            </div>
            <div className="fl-still fl-pool" aria-hidden="true" />
          </div>
        </section>

        {/* ---------- the sea: the ending, the last frame of the same flight ---------- */}
        <section className="fl-sec fl-sea ending" data-fl style={len(SECTIONS.sea, true)} aria-label="Contact">
          <div className="fl-pin">
            <div className="fl-words fl-end-words" data-fl-from={SETTLE_AT - 0.04} data-fl-to={1e6}>
              <div className="fl-end-block">
                <h2 className="ending-head">
                  <span className="ending-line">It&apos;s still early.</span>
                </h2>
                <p className="label ending-kicker">Selected for OpenAI DevDay 2026</p>
                <Contact />
              </div>
              <div className="ending-foot label fl-end-foot">
                <a href="/feed.xml">RSS</a>
                <HapticsSetting />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
