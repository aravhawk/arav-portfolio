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
import { KIND } from '@/content/kinds';
import { formatAsOf, getMetrics } from '@/lib/metrics';
import { THEME_COLOR } from '@/lib/site';
import { MOVE, SECTIONS, SETTLE_AT, sectionStarts, stillStops } from '@/water/camera';
import { posterBoot } from '@/water/poster';
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
/** His sentence begins as the camera comes down to the outlet: the bank it stands on is in the frame from there. The first frame's line stands until then, and the two never show together. */
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

const len = (screens: number, last = false) => ({ '--len': last ? screens : screens + 1 }) as React.CSSProperties;
const at = (s: number) => ({ 'data-at': +s.toFixed(3) });

/**
 * How a station's block of words builds. Nothing of it is ever shown at any
 * size but its own. Its eyebrow leads, alone, as the station comes into
 * view; then, through the camera's move (see MOVE in camera.ts), its title
 * rises through a mask, the line under it sets, then its figure or meta,
 * then its action and its captions. Each is a step with a scroll position
 * of its own, in screens from the station's composed frame: past it the step
 * sets, back past it the step is undone. By the composed frame the block
 * stands whole. It leaves as one.
 */
const STEPS = { eyebrow: -1.2, title: -MOVE.before, line: -0.38, meta: -0.22, act: -0.08, leave: 0.95 };
function build(stop: number, over: Partial<typeof STEPS> = {}) {
  const b = { ...STEPS, ...over };
  return {
    /** the block: on from its eyebrow to its leaving; composed (its title in) from `data-fl-in` to `data-fl-out` */
    block: { 'data-fl-from': +(stop + b.eyebrow).toFixed(3), 'data-fl-to': +(stop + b.leave).toFixed(3), 'data-fl-in': +(stop + b.title).toFixed(3), 'data-fl-out': +(stop + b.leave).toFixed(3) },
    eyebrow: at(stop + b.eyebrow),
    title: at(stop + b.title),
    line: at(stop + b.line),
    meta: at(stop + b.meta),
    act: at(stop + b.act),
    /** the captions tied to points of the scene: with the action, to the block's leaving */
    calls: { from: stop + b.act, to: stop + b.leave },
  };
}
type Build = ReturnType<typeof build>;

/** Where each stream's caption lands: on the stream itself. */
const STREAMS = streamAnchors();

/**
 * The seven repositories, as each one's own page names it (its README's
 * heading, or where it has none the repository's name as GitHub shows it):
 * read 18 November 2026.
 */
const REPO_NAME: Record<string, string> = {
  'pingdotgg/t3code': 'T3 Code',
  'AvinashDevineni/ThrasherAndChambersWebsite': 'Thrasher & Chambers Website',
  'junhoyeo/tokscale': 'Tokscale',
  'Kanishksasi/Investo': 'Investo',
  'Kilo-Org/kilocode': 'Kilo Code',
  'devMEremenko/XcodeBenchmark': 'XcodeBenchmark',
  'fakerybakery/openbridge': 'OpenBridge',
};

/** The rail: one tick to a section, in the page's order. Each takes the page to that section's composed frame. */
const RAIL = ['Arav Jain', 'What I do', 'Infiniview', 'Open source', 'Kilo Bench', 'Agent Bridge', 'Open models', 'cc-switch', 'TensorPoW', 'RydAR', 'Interests', 'Contact'];

/** A project's name is the way in, and it travels to the page it opens. It rises through a mask, at its own size. */
function Name({ p, b }: { p: Project; b: Build }) {
  return (
    <ViewTransition name={`title-${p.slug}`} share="title" default="none">
      <h2 className="display fl-view-name fl-rise" {...b.title}>
        <span className="fl-rise-in">
          <Link className="beat-link" href={`/work/${p.slug}`}>
            {p.name}
            <Arrow />
          </Link>
        </span>
      </h2>
    </ViewTransition>
  );
}

function Kind({ p, b }: { p: Project; b: Build }) {
  return (
    <p className="fl-eyebrow" {...b.eyebrow}>
      {KIND[p.slug]}
    </p>
  );
}

/** The first script of the page: the still for this window, and the latest the first frame's words set (ms after it runs). */
const POSTER_BOOT = posterBoot(2600);

/**
 * The ending's small line leads, as a station's eyebrow does: it stands alone at its place from this long before the
 * camera comes to rest (in screens), over the open sea the camera is coming down to, so the run out from the delta
 * is not a stretch without a word. The headline and the links set when the camera rests, as they always have.
 */
const END_LEAD = 0.4;

/** His sentence, set a line at a time through the reach. */
const SAY_LINES = ['Agents that break', 'software before', 'attackers do.', 'Tools developers', 'run daily.'];
const SAY_AT = [SAY_FROM, 2.2, 2.5, 2.78, 3.02];

export default async function Home() {
  const m = await getMetrics();
  const repos = m.mergedPrs.byRepo.slice(0, TRIBS.length);
  const models = m.ollama.models.slice(0, COLS.xs.length);
  const colH = colHeights(models.map((x) => x.pulls));
  const rydar = RYDAR_P.media[0];
  const starts = sectionStarts();
  const stops = stillStops();
  // Each station's steps, from its composed frame (see stillStops in camera.ts).
  const view = build(stops[2]);
  // (A station that follows a long stretch of flight shows its eyebrow sooner, so no stretch of scroll is without a word.)
  const up = build(stops[3], { eyebrow: -1.3 });
  const bench = build(stops[4]);
  const bridge = build(stops[5]);
  const mods = build(stops[6], { eyebrow: -1.3 });
  // (The dam is come at round its end: its move, and so its title, begins a little later.)
  const fork = build(stops[7], { eyebrow: -1.3, title: -0.45, line: -0.32, meta: -0.2 });
  const tensor = build(stops[8]);
  // (The canyon is this station from its mouth: its eyebrow stands through the bends, its block sets in the hall.)
  const canyon = build(stops[9], { eyebrow: CANYON + 0.05 - stops[9], leave: 0.75 });
  // (The delta's bank stays under its words a while after the eye has begun to leave for the sea: they stay with it.)
  const delta = build(stops[10], { leave: 1.5 });
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
        {/* The page's first script: it chooses the first paint's still for this window (see poster.ts). */}
        <script dangerouslySetInnerHTML={{ __html: POSTER_BOOT }} />
        <FlightStage slab={INFINIVIEW_HOME.src} sheet={BENCH_P.media[0].kind === 'image' ? BENCH_P.media[0].src : ''} tribs={repos.map((r) => r.count).join(',')}
          cols={colH.map((h) => h.toFixed(1)).join(',')}
          face={rydar.kind === 'image' ? rydar.src : ''}
        />

        {/* ---------- the frozen lake ---------- */}
        <section className="fl-sec fl-hero" data-fl style={len(SECTIONS.hero)} aria-labelledby="name">
          <div className="fl-pin">
            {/* The first paint is the scene's own first frame, a still (see scripts/capture-poster.mjs); the live picture comes up over it. */}
            <div className="fl-lake" data-basin>
              <div className="fl-poster" aria-hidden="true" />
              {/* The name is the picture's. It stays here for readers and for search. */}
              <h1 id="name" className="fl-name sr-only" data-ice>
                Arav Jain
              </h1>
            </div>
            <div className="fl-words fl-hero-words" data-fl-from={-1} data-fl-to={SAY_FROM} data-hero data-on>
              <p className="statement fl-role">
                <span className="fl-rise" data-at={-1}>
                  <span className="fl-rise-in">AI and developer</span>
                </span>
                <span className="fl-rise" data-at={-1}>
                  <span className="fl-rise-in">tooling builder.</span>
                </span>
              </p>
              <p className="fl-line fl-intro" data-at={-1} data-fl-until={0.25}>
                I co-founded Infiniflop Labs and build Infiniview: agents that attack your app to prove what breaks.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- the statement ---------- */}
        <section className="fl-sec fl-say" data-fl style={len(SECTIONS.say)} aria-label="What I do">
          <div className="fl-pin">
            <div className="fl-words fl-say-words" data-fl-from={SAY_FROM} data-fl-to={+(VIEW - 0.3).toFixed(3)}>
              <p className="say-text fl-say-text">
                {SAY_LINES.map((line, i) => (
                  <span key={line} className="fl-rise" {...at(SAY_AT[i])}>
                    <span className="fl-rise-in">{line} </span>
                  </span>
                ))}
              </p>
            </div>
          </div>
        </section>

        {/* ---------- 01 Infiniview ---------- */}
        <section className="fl-sec fl-view" data-fl style={len(SECTIONS.infiniview)} aria-label="Infiniview">
          <div className="fl-pin">
            <div className="fl-words fl-block fl-view-words" {...view.block}>
              <Kind p={INFINIVIEW} b={view} />
              <Name p={INFINIVIEW} b={view} />
              <p className="fl-line" {...view.line}>
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
                  from={up.calls.from}
                  to={up.calls.to}
                  lift={i % 2 ? 78 : 44}
                >
                  {REPO_NAME[r.repo] ?? r.repo.split('/')[1]}
                </Callout>
              ))}
            </div>
            <div className="fl-words fl-block fl-count-words fl-out-words" {...up.block}>
              <p className="fl-eyebrow" {...up.eyebrow}>
                Open source
              </p>
              <h2 className="beat-figure fl-figure">
                <span className="number fl-fig fl-rise" {...up.title}>
                  <span className="fl-rise-in">
                    <LiveNumber
                      value={m.mergedPrs.upstream.value}
                      from={m.mergedPrs.upstream.snapshotValue}
                      source={m.mergedPrs.upstream.source}
                      asOf={formatAsOf(m.mergedPrs.upstream.asOf)}
                      what="merged pull requests in repositories I do not own"
                    />
                  </span>
                </span>
                <span className="fl-line fl-unit" {...up.line}>
                  merged pull requests in other people&apos;s projects
                </span>
                {/* Where a narrow frame sets the seven names, as a list beside the count (the flight puts them there). */}
                <span className="fl-calls-slot" data-calls-slot aria-hidden="true" />
              </h2>
              <p className="fl-meta" {...up.meta}>
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
              <Link className="link fl-more" href="/work/open-source" {...up.act}>
                Upstream <Arrow />
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- 03 Kilo Bench ---------- */}
        <section className="fl-sec fl-bench" data-fl style={len(SECTIONS.bench)} aria-label="Kilo Bench">
          <div className="fl-pin">
            <div className="fl-words fl-block fl-view-words fl-bench-words" {...bench.block}>
              <Kind p={BENCH_P} b={bench} />
              <Name p={BENCH_P} b={bench} />
              <p className="fl-line" {...bench.line}>
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
            <div className="fl-words fl-block fl-view-words fl-bridge-words" {...bridge.block}>
              <Kind p={BRIDGE_P} b={bridge} />
              <Name p={BRIDGE_P} b={bridge} />
              <p className="fl-line" {...bridge.line}>
                {BRIDGE_P.line}
              </p>
              {/* The launch film: one control here, the film itself at a size it can be read at. */}
              <div className="fl-film" {...bridge.act}>
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
                  from={mods.calls.from}
                  to={mods.calls.to}
                  lift={i % 2 ? 40 : 64}
                >
                  {x.name}
                </Callout>
              ))}
            </div>
            <div className="fl-words fl-block fl-count-words fl-models-words" {...mods.block}>
              <p className="fl-eyebrow" {...mods.eyebrow}>
                Models
              </p>
              <h2 className="beat-figure fl-figure">
                <span className="number number-sm fl-fig fl-rise" {...mods.title}>
                  <span className="fl-rise-in">
                    <LiveNumber
                      value={m.ollama.total.value}
                      from={m.ollama.total.snapshotValue}
                      source={m.ollama.total.source}
                      asOf={formatAsOf(m.ollama.total.asOf)}
                      what="pulls of my open models on Ollama"
                    />
                  </span>
                </span>
                <span className="fl-line fl-unit" {...mods.line}>
                  pulls, four open models
                </span>
              </h2>
              <Link className="link fl-more" href="/work/ollama" {...mods.act}>
                Ollama <Arrow />
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- 06 cc-switch ---------- */}
        <section className="fl-sec fl-forks" data-fl style={len(SECTIONS.fork)} aria-label="cc-switch">
          <div className="fl-pin">
            <div className="fl-words fl-block fl-view-words fl-fork-words" {...fork.block}>
              <Kind p={SWITCH_P} b={fork} />
              <Name p={SWITCH_P} b={fork} />
              <p className="fl-line" {...fork.line}>
                {SWITCH_P.line}
              </p>
              <p className="fl-meta" {...fork.meta}>
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
              <div className="fl-fork" data-bed="feat:fork" data-active="0" {...fork.act}>
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
            <div className="fl-words fl-block fl-view-words fl-tensor-words" {...tensor.block}>
              <Kind p={TENSOR_P} b={tensor} />
              <Name p={TENSOR_P} b={tensor} />
              <p className="fl-line" {...tensor.line}>
                {TENSOR_P.line}
              </p>
            </div>
            <div className="fl-still fl-pool" aria-hidden="true" />
          </div>
        </section>

        {/* ---------- 08 RydAR ---------- */}
        <section className="fl-sec fl-rydar" data-fl style={len(SECTIONS.canyon)} aria-label="RydAR">
          <div className="fl-pin">
            <div className="fl-words fl-block fl-view-words fl-rydar-words" {...canyon.block}>
              <Kind p={RYDAR_P} b={canyon} />
              <Name p={RYDAR_P} b={canyon} />
              <p className="fl-line" {...canyon.line}>
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
            <div className="fl-words fl-block fl-into-words" {...delta.block}>
              <p className="fl-eyebrow" id="into" {...delta.eyebrow}>
                Interests
              </p>
              <ul className="into-list title fl-into-list" {...delta.title}>
                {INTERESTS.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p className="fl-line fl-into-next" {...delta.line}>
                Next: a company, a research paper, and code in tools you open daily.
              </p>
              <Link className="btn fl-into-btn" href="/work" {...delta.act}>
                All work <Arrow />
              </Link>
            </div>
            <div className="fl-still fl-pool" aria-hidden="true" />
          </div>
        </section>

        {/* ---------- the sea: the ending, the last frame of the same flight ---------- */}
        <section className="fl-sec fl-sea ending" data-fl style={len(SECTIONS.sea, true)} aria-label="Contact">
          <div className="fl-pin">
            <div className="fl-words fl-end-words" data-fl-from={+(SETTLE_AT - END_LEAD).toFixed(3)} data-fl-to={1e6} data-fl-set={+(SETTLE_AT - 0.04).toFixed(3)}>
              <div className="fl-end-block">
                <h2 className="ending-head">
                  <span className="ending-line">It&apos;s still early.</span>
                </h2>
                <p className="label ending-kicker">Selected for OpenAI DevDay 2026</p>
                {/* One row: the ways to reach him, the feed among them. (The haptics switch is a setting: it stands by the sound control, in the nav.) */}
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
