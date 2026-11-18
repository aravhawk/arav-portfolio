import type { Viewport } from 'next';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { Arrow, Slab } from '@/components/bits';
import { Contact } from '@/components/ending/Ending';
import { Callout } from '@/components/flight/Callout';
import { Film } from '@/components/flight/Film';
import { ProfileSwitch } from '@/components/home/ProfileSwitch';
import { FlightStage } from '@/components/FlightStage';
import { LiveNumber } from '@/components/LiveNumber';
import { INTERESTS, PROJECTS, type Project, type ProjectMedia } from '@/content/projects';
import { formatAsOf, getMetrics } from '@/lib/metrics';
import { THEME_COLOR } from '@/lib/site';
import { SECTIONS, SETTLE_AT, sectionStarts, stillStops } from '@/water/camera';
import { streamAnchors } from '@/water/words';
import { COLS, TRIBS, colHeights, colApex } from '@/water/world';
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
/** The first frame's first line stands through the melt, until the camera leaves the name's water; its second line goes with the first frame. */
const ROLE_TO = 1.2;
/** His sentence comes in as the camera comes down to the outlet: the bank it stands on is in the frame from there. */
const SAY_FROM = 1.9;
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

/**
 * When a block of words shows. It is on from `from` to `to` (screens of
 * scroll): from the moment its station is in view until the camera has left
 * it. With `at` and `until` it travels: it stands composed between those two
 * and is a small tag in a corner of the frame either side of them.
 */
const win = (from: number, to: number, at?: number, until?: number) => ({
  'data-fl-from': +from.toFixed(3),
  'data-fl-to': +to.toFixed(3),
  ...(at === undefined ? {} : { 'data-fl-in': +at.toFixed(3), 'data-fl-out': +(until ?? to).toFixed(3) }),
});

/** The label over each station says one kind of thing: what it is. */
const KIND: Record<string, string> = {
  infiniview: 'Security agents',
  'kilo-bench': 'Benchmark',
  'agent-bridge': 'MCP server',
  'cc-switch': 'CLI',
  tensorpow: 'Protocol',
  rydar: 'iOS app',
};

/** Where each stream's caption lands: on the stream itself. */
const STREAMS = streamAnchors();

/** The rail: one tick to a section, in the page's order. Each takes the page to that section's composed frame. */
const RAIL = ['Arav Jain', 'What I do', 'Infiniview', 'Open source', 'Kilo Bench', 'Agent Bridge', 'Open models', 'cc-switch', 'TensorPoW', 'RydAR', 'Interests', 'Contact'];

/** A project's name is the way in, and it travels to the page it opens. */
function Name({ p }: { p: Project }) {
  return (
    <ViewTransition name={`title-${p.slug}`} share="title" default="none">
      <h2 className="display fl-view-name" data-w="name">
        <Link className="beat-link" href={`/work/${p.slug}`}>
          {p.name}
          <Arrow />
        </Link>
      </h2>
    </ViewTransition>
  );
}

function Kind({ p }: { p: Project }) {
  return (
    <p className="label fl-label" data-w="label">
      {KIND[p.slug]}
    </p>
  );
}

export default async function Home() {
  const m = await getMetrics();
  const repos = m.mergedPrs.byRepo.slice(0, TRIBS.length);
  const models = m.ollama.models.slice(0, COLS.xs.length);
  const colH = colHeights(models.map((x) => x.pulls));
  const rydar = RYDAR_P.media[0];
  const starts = sectionStarts();
  const stops = stillStops();
  return (
    <>
      {/* ---------- the rail: where in the flight this is, and a way to any part of it (before the page's content, so the skip link passes it) ---------- */}
      <nav className="fl-rail" aria-label="Sections of this page">
        {RAIL.map((name, i) => (
          <a key={name} href="#main" aria-label={name} data-from={+(starts[i] - (i ? 0.25 : 0)).toFixed(2)} data-at={+stops[i].toFixed(2)}>
            <span aria-hidden="true" />
          </a>
        ))}
      </nav>
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
            <div className="fl-words fl-hero-words" {...win(-1, ROLE_TO)} data-on>
              <p className="statement fl-role">AI and developer tooling builder.</p>
              <p className="lead fl-intro" data-fl-until={0.25}>
                I co-founded Infiniflop Labs and build Infiniview: agents that attack your app to prove what breaks.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- the statement ---------- */}
        <section className="fl-sec fl-say" data-fl style={len(SECTIONS.say)} aria-label="What I do">
          <div className="fl-pin">
            <div className="fl-words fl-say-words" {...win(SAY_FROM, VIEW - 0.05)}>
              <p className="say-text fl-say-text">Agents that break software before attackers do. Tools developers run daily.</p>
            </div>
          </div>
        </section>

        {/* ---------- 01 Infiniview ---------- */}
        <section className="fl-sec fl-view" data-fl style={len(SECTIONS.infiniview)} aria-label="Infiniview">
          <div className="fl-pin">
            <div className="fl-words fl-view-words" {...win(VIEW - 0.05, OUT - 0.2, VIEW + 0.9, OUT - 0.55)}>
              <Kind p={INFINIVIEW} />
              <Name p={INFINIVIEW} />
              <p className="lead fl-view-line" data-w="line">
                {INFINIVIEW.line}
              </p>
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
                  at={STREAMS[i]}
                  href={r.url}
                  label={`${r.repo}: ${r.count} merged pull request${r.count === 1 ? '' : 's'}`}
                  from={OUT + 0.95}
                  to={BENCH - 0.5}
                  lift={i % 2 ? 78 : 44}
                >
                  {r.repo.split('/')[1]}
                </Callout>
              ))}
            </div>
            <div className="fl-words fl-up-words fl-out-words" {...win(OUT - 0.05, BENCH, OUT + 1.1, BENCH - 0.55)}>
              <p className="label fl-label" data-w="label">
                Open source
              </p>
              <h2 className="beat-figure fl-figure">
                <span className="number fl-fig" data-w="fig">
                <LiveNumber
                  value={m.mergedPrs.upstream.value}
                  from={m.mergedPrs.upstream.snapshotValue}
                  source={m.mergedPrs.upstream.source}
                  asOf={formatAsOf(m.mergedPrs.upstream.asOf)}
                  what="merged pull requests in repositories I do not own"
                />
                </span>
                <span className="title beat-unit" data-w="unit">
                  merged pull requests in other people&apos;s projects
                </span>
              </h2>
              <p className="small beat-sub fl-sub" data-x>
                <LiveNumber
                  className="fl-count"
                  value={m.mergedPrs.total.value}
                  from={m.mergedPrs.total.snapshotValue}
                  source={m.mergedPrs.total.source}
                  asOf={formatAsOf(m.mergedPrs.total.asOf)}
                  what="merged pull requests in total"
                />{' '}
                in all.{' '}
                <LiveNumber
                  className="fl-count"
                  value={m.contributions.total.value}
                  from={m.contributions.total.snapshotValue}
                  source={m.contributions.total.source}
                  asOf={formatAsOf(m.contributions.total.asOf)}
                  what={m.contributions.label}
                />{' '}
                contributions.
              </p>
              <Link className="link beat-more fl-more" href="/work/open-source" data-x>
                Upstream <Arrow />
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- 03 Kilo Bench ---------- */}
        <section className="fl-sec fl-bench" data-fl style={len(SECTIONS.bench)} aria-label="Kilo Bench">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-bench-words" {...win(BENCH + 0.3, BRIDGE - 0.1, BENCH + 1.05, BRIDGE - 0.55)}>
              <Kind p={BENCH_P} />
              <Name p={BENCH_P} />
              <p className="lead fl-view-line" data-w="line">
                {BENCH_P.line}
              </p>
            </div>
            <div className="fl-still">
              <Slab media={BENCH_P.media[0]} sizes="(max-width: 860px) 80vw, 40vw" />
            </div>
          </div>
        </section>

        {/* ---------- 04 Agent Bridge ---------- */}
        <section className="fl-sec fl-bridge" data-fl style={len(SECTIONS.bridge)} aria-label="Agent Bridge">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-bridge-words" {...win(BRIDGE - 0.1, MODELS - 0.05, BRIDGE + 1.1, MODELS - 0.55)}>
              <Kind p={BRIDGE_P} />
              <Name p={BRIDGE_P} />
              <p className="lead fl-view-line" data-w="line">
                {BRIDGE_P.line}
              </p>
              {/* The launch film: one control here, the film itself at a size it can be read at. */}
              <div className="fl-film" data-x>
                <Film media={BRIDGE_P.media[0]} />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 05 Open models ---------- */}
        <section className="fl-sec fl-models" data-fl style={len(SECTIONS.models)} aria-label="Open models">
          <div className="fl-pin">
            <div className="fl-calls">
              {models.map((x, i) => (
                <Callout
                  key={x.name}
                  at={[COLS.xs[i] + colApex(i)[0] * COLS.r * (colH[i] / COLS.hMax), COLS.y + 26 * Math.sin(i * 2.3) + colApex(i)[1] * COLS.r * (colH[i] / COLS.hMax), colH[i] - 24]}
                  href={x.url}
                  from={MODELS + 0.85}
                  to={FORK - 0.85}
                  lift={i % 2 ? 40 : 64}
                  // (On a wide frame the figure stands in the sky over the columns: each name is set at its column's foot.)
                  wide={{ at: [COLS.xs[i], COLS.y + 26 * Math.sin(i * 2.3), 6], lift: -30 }}
                >
                  {x.name}
                </Callout>
              ))}
            </div>
            <div className="fl-words fl-up-words fl-models-words" {...win(MODELS - 0.05, FORK - 0.05, MODELS + 1.1, FORK - 0.55)}>
              <p className="label fl-label" data-w="label">
                Models
              </p>
              <h2 className="beat-figure fl-figure">
                <span className="number number-sm fl-fig" data-w="fig">
                <LiveNumber
                  value={m.ollama.total.value}
                  from={m.ollama.total.snapshotValue}
                  source={m.ollama.total.source}
                  asOf={formatAsOf(m.ollama.total.asOf)}
                  what="pulls of my open models on Ollama"
                />
                </span>
                <span className="title beat-unit" data-w="unit">
                  pulls, four open models
                </span>
              </h2>
              <Link className="link beat-more fl-more" href="/work/ollama" data-x>
                Open models <Arrow />
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- 06 cc-switch ---------- */}
        <section className="fl-sec fl-forks" data-fl style={len(SECTIONS.fork)} aria-label="cc-switch">
          <div className="fl-pin">
            <div className="fl-words fl-up-words fl-fork-words" {...win(FORK + 0.1, LATTICE - 0.15, FORK + 1.1, LATTICE - 0.55)}>
              <Kind p={SWITCH_P} />
              <Name p={SWITCH_P} />
              <p className="lead fl-view-line" data-w="line">
                {SWITCH_P.line}
              </p>
              <p className="small beat-sub fl-sub" data-x>
                <LiveNumber
                  className="fl-count"
                  value={m.npm.allTime.value}
                  from={m.npm.allTime.snapshotValue}
                  source={m.npm.allTime.source}
                  asOf={formatAsOf(m.npm.allTime.asOf)}
                  what="npm downloads of cc-switch, all time"
                />{' '}
                npm downloads.
              </p>
              {/* One stream in, three channels out, the chosen one running: the switch is drawn as what it does. */}
              <div className="fl-fork" data-bed="feat:fork" data-active="0" data-x>
                <svg className="fl-gates" viewBox="0 0 284 40" preserveAspectRatio="none" aria-hidden="true">
                  <path className="fl-gate-in" d="M142 0v12" />
                  <path className="fl-gate" data-g="0" d="M142 12C142 30 50 20 50 40" />
                  <path className="fl-gate" data-g="1" d="M142 12V40" />
                  <path className="fl-gate" data-g="2" d="M142 12C142 30 234 20 234 40" />
                </svg>
                <ProfileSwitch />
              </div>
            </div>
            <div className="fl-still fl-pool" aria-hidden="true" />
          </div>
        </section>

        {/* ---------- 07 TensorPoW ---------- */}
        <section className="fl-sec fl-tensor" data-fl style={len(SECTIONS.lattice)} aria-label="TensorPoW">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-tensor-words" {...win(LATTICE - 0.1, CANYON - 0.1, LATTICE + 1.05, CANYON - 0.55)}>
              <Kind p={TENSOR_P} />
              <Name p={TENSOR_P} />
              <p className="lead fl-view-line" data-w="line">
                {TENSOR_P.line}
              </p>
            </div>
            <div className="fl-still fl-pool" aria-hidden="true" />
          </div>
        </section>

        {/* ---------- 08 RydAR ---------- */}
        <section className="fl-sec fl-rydar" data-fl style={len(SECTIONS.canyon)} aria-label="RydAR">
          <div className="fl-pin">
            <div className="fl-words fl-view-words fl-rydar-words" {...win(CANYON - 0.1, DELTA - 0.07, CANYON + 1.75, CANYON + 2.7)}>
              <Kind p={RYDAR_P} />
              <Name p={RYDAR_P} />
              <p className="lead fl-view-line" data-w="line">
                {RYDAR_P.line}
              </p>
            </div>
            <div className="fl-still">
              <Slab media={rydar} sizes="(max-width: 860px) 60vw, 30vw" />
            </div>
          </div>
        </section>

        {/* ---------- the delta: what he is into ---------- */}
        <section className="fl-sec fl-delta" data-fl style={len(SECTIONS.delta)} aria-labelledby="into">
          <div className="fl-pin">
            <div className="fl-words fl-into-words" {...win(DELTA - 0.07, SEA, DELTA + 1.0, SEA - 0.5)}>
              <p className="label fl-label" id="into" data-w="label">
                Interests
              </p>
              <ul className="into-list title fl-into-list" data-w="list">
                {INTERESTS.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p className="lead fl-into-next" data-x>
                Next: a company, a research paper, and code in tools you open daily.
              </p>
              <Link className="btn fl-into-btn" href="/work" data-x>
                All work <Arrow />
              </Link>
            </div>
            <div className="fl-still fl-pool" aria-hidden="true" />
          </div>
        </section>

        {/* ---------- the sea: the ending, the last frame of the same flight ---------- */}
        <section className="fl-sec fl-sea ending" data-fl style={len(SECTIONS.sea, true)} aria-label="Contact">
          <div className="fl-pin">
            <div className="fl-words fl-end-words" {...win(SETTLE_AT - 0.04, 1e6)}>
              <div className="fl-end-block">
                <h2 className="ending-head">
                  <span className="ending-line">It&apos;s still early.</span>
                </h2>
                <p className="label ending-kicker">Selected for OpenAI DevDay 2026</p>
                {/* One row: the ways to reach him, the feed among them, and the haptics switch as the row's last small control. */}
                <div className="fl-end-row">
                  <Contact feed />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
