import { EndingWords } from '@/components/flight/EndingWords';
import { Interests } from '@/components/flight/Interests';
import { Statement } from '@/components/flight/Statement';
import Link from 'next/link';
import { Fragment, ViewTransition } from 'react';
import { Arrow, Slab } from '@/components/bits';
import { Callout } from '@/components/flight/Callout';
import { Film } from '@/components/flight/Film';
import { ProfileSwitch } from '@/components/home/ProfileSwitch';
import { FlightPlayer } from '@/components/FlightPlayer';
import { FlightStage } from '@/components/FlightStage';
import { LiveNumber } from '@/components/LiveNumber';
import { PROJECTS, RECOGNITION, type Project, type ProjectMedia } from '@/content/projects';
import { KIND } from '@/content/kinds';
import { formatAsOf, formatCount, getMetrics } from '@/lib/metrics';
import type { Plan } from '@/flight/types';
import { END_AT, MELT, MOVE, SECTIONS, SETTLE_AT, dayAt, sectionStarts, stillStops } from '@/water/camera';
import { DAWN, ENTER, GATE } from '@/water/moments';
import { byId, proximity, timeline } from '@/water/registry';
import { COLS, FACE, SHARDS, SLAB, TRIBS, colHeights, colApex, streamAnchors } from '@/water/world';
import '@/app/home.css';
import '@/app/flight.css';

/**
 * The flight's page: one glacial world seen through a camera that travels
 * as the page scrolls. The sections give the scroll its length and carry
 * the words; the picture is one fixed layer behind them.
 *
 * Two routes show it. The home page plays the picture from the frames the
 * engine rendered ahead of time (FlightPlayer, src/flight): no shader is
 * built on a visitor's machine. The renderer's own route (`live`, see
 * src/app/render and tools/flight) draws it with the engine (FlightStage):
 * that is where those frames are photographed. Both are this one
 * component, so the words, their thresholds and the lee the picture keeps
 * under them are the same in both. Without a picture the same sections
 * stack as a plain page.
 */

/**
 * What the player needs of the flight's timeline, as plain numbers: the client never loads the camera or the
 * registry (they carry the engine's shader source).
 */
const PLAN: Plan = {
  end: END_AT,
  settle: SETTLE_AT,
  hero: SECTIONS.hero,
  melt: [MELT.from, MELT.to],
  starts: sectionStarts(),
  stops: stillStops(),
  heroWords: ENTER.words,
  dawn: { lift: [...DAWN.lift], ray: [...DAWN.ray], rise: [...DAWN.rise], over: DAWN.over },
  gate: { up: GATE.up, down: GATE.down, surge: GATE.surge },
  // (The day's turn, sampled every quarter screen: the sound reads it.)
  day: Array.from({ length: Math.ceil(END_AT * 4) + 2 }, (_, i) => +dayAt(i / 4).toFixed(4)),
  near: proximity.map(({ lane, x, y, from, to }) => [lane, x, y, from, to]),
};

const BENCH_P = PROJECTS.find((p) => p.slug === 'kilo-bench')!;
const RYDAR_P = PROJECTS.find((p) => p.slug === 'rydar')!;
/** The one project the world has no place for yet: it stands as words alone, in the run after Kilo Bench's pool. */
const AROUND_P = PROJECTS.find((p) => p.slug === 'ask-around')!;

const INFINIVIEW_HOME: ProjectMedia = {
  kind: 'image',
  src: '/media/infiniview-hero.webp',
  alt: 'The Infiniview site: the headline Attack your code before anyone else does, and a sample run that ends with one critical and one high finding posted to a pull request.',
  w: 2200,
  h: 1376,
};

// Where each section begins, in screens of scroll, and when its words show.
/** His sentence begins as the camera comes down to the outlet: the bank it stands on is in the frame from there. The first frame's line stands until then, and the two never show together. */
const SAY_FROM = 1.9;
const VIEW = byId.say.end;

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
 * The repositories, as each one's own page names it (its README's
 * heading, or where it has none the repository's name as GitHub shows it):
 * read 18 November 2026.
 */
const REPO_NAME: Record<string, string> = {
  'pingdotgg/t3code': 'T3 Code',
  'junhoyeo/tokscale': 'Tokscale',
  'Kilo-Org/kilocode': 'Kilo Code',
  'devMEremenko/XcodeBenchmark': 'XcodeBenchmark',
  'fakerybakery/openbridge': 'OpenBridge',
};


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

/**
 * The first script of the page. The first frame's words are set in the first paint (what the page is for is read in
 * its first frame, not after the picture's entrance). And the page is laid out as the flight from that paint
 * (`data-flight`): said later, by the player, it would have every element's style worked out a second time in the
 * page's first second. (If the player cannot load, it says `off`, and the page is a plain page.)
 */
const HERO_BOOT = `(function(){var d=document.documentElement;d.setAttribute('data-hero-words','');d.setAttribute('data-flight','on')})()`;

/**
 * The ending's small line leads, as a station's eyebrow does: it stands alone at its place from this long before the
 * camera comes to rest (in screens), over the open sea the camera is coming down to, so the run out from the delta
 * is not a stretch without a word. The headline and the links set when the camera rests, as they always have.
 */
const END_LEAD = 0.15;
/**
 * The delta's first lines (its label and what he is recognised for) leave this much, in screens, before the rest of
 * the block. Through that last tenth the camera turns into the dawn, and on a phone at night the sun's road on the
 * water reaches those lines while they still stand: the legibility test measured them at 4.4, then 3.3, against the
 * 4.5 they need. The lines under them stand clear of it and stay to the block's own leaving, so the run to the
 * ending is no longer without a word than it was (the ending's line cannot lead sooner: its ground is not there).
 */
const RECOG_EARLY = 0.1;

/** His sentence, set a line at a time through the reach; then, once it stands whole, the line under it. */
const SAY_AT = [SAY_FROM, 2.2, 2.5, 2.78, 3.02];
const SAY_WHY_AT = 3.3;

/** A day as a label says it: "Nov 16". */
const day = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).format(new Date(iso));

/** The two shards of the tarn are the two ends of the bridge: each is named where it stands (low on its flank: its upper half stands under the nav on a wide frame). */
const PEERS = ['Grok Bot', 'OpenAI agent'];

export async function FlightPage({ live = false }: { live?: boolean }) {
  const m = await getMetrics();
  const repos = m.mergedPrs.byRepo.slice(0, TRIBS.length);
  const models = m.ollama.models.slice(0, COLS.xs.length);
  const colH = colHeights(models.map((x) => x.pulls));
  const rydar = RYDAR_P?.media[0];
  // The widest stream, said in the words beside it: how many of the count are its own, and between which days they were merged.
  const lead = repos[0];
  const leadDays = lead ? m.mergedPrs.ledger.filter((e) => e.repo === lead.repo).map((e) => e.mergedAt).sort() : [];
  const yearCount = m.contributions.byYear[RECOGNITION.year];

  type RenderBlock = (section: typeof timeline[number], steps: Build, project: Project) => React.ReactNode;
  const blocks: Record<NonNullable<(typeof timeline)[number]['layout']>, RenderBlock> = {
    opening: (section) => (
      <section className="fl-sec fl-hero" data-fl style={len(section.length)} aria-labelledby="name">
        <div className="fl-pin">
          {/* Where the picture cannot be shown (no scripts) the first frame's still stands in the first section. */}
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
              I co-founded Infiniflop Labs, where I build Infiniview.
            </p>
          </div>
        </div>
      </section>
    ),
    statement: (section) => (
      <section className="fl-sec fl-say" data-fl style={len(section.length)} aria-label="What I do">
        <div className="fl-pin">
          <div className="fl-words fl-say-words" data-fl-from={SAY_FROM} data-fl-to={+(VIEW - 0.3).toFixed(3)}>
            <Statement times={SAY_AT} why={SAY_WHY_AT} />
          </div>
        </div>
      </section>
    ),
    display: (section, view, p) => (
      <section className="fl-sec fl-view" data-fl style={len(section.length)} aria-label="Infiniview">
        <div className="fl-pin">
          {/* The block of ice carries the product's own site: it is named where it stands. */}
          <div className="fl-calls">
            <Callout at={[SLAB.x, SLAB.y, SLAB.lift + SLAB.h]} href={p.links[0].href} from={view.calls.from} to={view.calls.to} lift={46}>
              {p.links[0].label}
            </Callout>
          </div>
          <div className="fl-words fl-block fl-view-words" {...view.block}>
            <Kind p={p} b={view} />
            <Name p={p} b={view} />
            <p className="fl-line" {...view.line}>
              {p.line}
            </p>
          </div>
          {/* Without the canvas the product stands here as a plain image. */}
          <div className="fl-still">
            <Slab media={INFINIVIEW_HOME} sizes="(max-width: 860px) 78vw, 40vw" />
          </div>
        </div>
      </section>
    ),
    contributions: (section, up) => (
      <section className="fl-sec fl-up" data-fl style={len(section.length)} aria-label="Open source">
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
                {REPO_NAME[r.repo] ?? r.repo.split('/')[1]} <span className="fl-call-n">{r.count}</span>
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
              {/* Where a narrow frame sets the names, as a list beside the count (the flight puts them there). */}
              <span className="fl-calls-slot" data-calls-slot aria-hidden="true" />
            </h2>
            <p className="fl-meta" {...up.meta}>
              {m.mergedPrs.upstreamRepoCount} repositories.
              {lead && leadDays.length ? (
                <>
                  {' '}
                  {lead.count} in {REPO_NAME[lead.repo] ?? lead.repo.split('/')[1]}, {day(leadDays[0])} to {day(leadDays[leadDays.length - 1])}.
                </>
              ) : null}
            </p>
            <Link className="link fl-more" href="/work/open-source" {...up.act}>
              Upstream <Arrow />
            </Link>
          </div>
        </div>
      </section>
    ),
    table: (section, bench, p) => (
      <section className="fl-sec fl-bench" data-fl style={len(section.length)} aria-label="Kilo Bench">
        <div className="fl-pin">
          <div className="fl-words fl-block fl-view-words fl-bench-words" {...bench.block}>
            <Kind p={p} b={bench} />
            <Name p={p} b={bench} />
            <p className="fl-line" {...bench.line}>
              {p.line}
            </p>
          </div>
          <div className="fl-still">
            <Slab media={p.media[0]} sizes="(max-width: 860px) 80vw, 40vw" />
          </div>
        </div>
      </section>
    ),
    film: (section, bridge, p) => (
      <section className="fl-sec fl-bridge" data-fl style={len(section.length)} aria-label="Agent Bridge">
        <div className="fl-pin">
          <div className="fl-calls">
            {SHARDS.map((sh, i) => (
              <Callout key={PEERS[i]} at={[sh.x, sh.y, sh.h * 0.3]} from={bridge.calls.from} to={bridge.calls.to} lift={i ? 34 : 52} side={i ? 1 : -1}>
                {PEERS[i]}
              </Callout>
            ))}
          </div>
          <div className="fl-words fl-block fl-view-words fl-bridge-words" {...bridge.block}>
            <Kind p={p} b={bridge} />
            <Name p={p} b={bridge} />
            <p className="fl-line" {...bridge.line}>
              {p.line}
            </p>
            {/* The launch film: one control here, the film itself at a size it can be read at. */}
            <div className="fl-film" {...bridge.act}>
              <Film media={p.media[0]} />
            </div>
          </div>
        </div>
      </section>
    ),
    downloads: (section, mods) => (
      <section className="fl-sec fl-models" data-fl style={len(section.length)} aria-label="Open models">
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
                {x.name} <span className="fl-call-n">{formatCount(x.pulls)}</span>
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
                pulls, {models.length} open models
              </span>
            </h2>
            <Link className="link fl-more" href="/work/ollama" {...mods.act}>
              Ollama <Arrow />
            </Link>
          </div>
        </div>
      </section>
    ),
    switch: (section, fork, p) => (
      <section className="fl-sec fl-forks" data-fl style={len(section.length)} aria-label="cc-switch">
        <div className="fl-pin">
          <div className="fl-words fl-block fl-view-words fl-fork-words" {...fork.block}>
            <Kind p={p} b={fork} />
            <Name p={p} b={fork} />
            <p className="fl-line" {...fork.line}>
              {p.line}
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
              npm downloads.{' '}
              <LiveNumber
                className="fl-count"
                value={m.npm.lastMonth.value}
                from={m.npm.lastMonth.snapshotValue}
                source={m.npm.lastMonth.source}
                asOf={formatAsOf(m.npm.lastMonth.asOf)}
                what="npm downloads of cc-switch in the last 30 days"
              />{' '}
              in the last 30 days.
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
    ),
    pool: (section, tensor, p) => (
      <section className="fl-sec fl-tensor" data-fl style={len(section.length)} aria-label="TensorPoW">
        <div className="fl-pin">
          <div className="fl-words fl-block fl-view-words fl-tensor-words" {...tensor.block}>
            <Kind p={p} b={tensor} />
            <Name p={p} b={tensor} />
            <p className="fl-line" {...tensor.line}>
              {p.line}
            </p>
          </div>
          <div className="fl-still fl-pool" aria-hidden="true" />
        </div>
      </section>
    ),
    wall: (section, canyon, p) => (
      <section className="fl-sec fl-rydar" data-fl style={len(section.length)} aria-label="RydAR">
        <div className="fl-pin">
          {/* The pane in the canyon's wall shows the project's own site: named where it stands. */}
          <div className="fl-calls">
            <Callout at={[FACE.x, FACE.y, FACE.z + FACE.h]} href={p.links[0].href} from={canyon.calls.from} to={canyon.calls.to} lift={40}>
              {p.links[0].label}
            </Callout>
          </div>
          <div className="fl-words fl-block fl-view-words fl-rydar-words" {...canyon.block}>
            <Kind p={p} b={canyon} />
            <Name p={p} b={canyon} />
            <p className="fl-line" {...canyon.line}>
              {p.line}
            </p>
            <p className="fl-meta" {...canyon.meta}>
              On the App Store since November 11, 2026.
            </p>
          </div>
          <div className="fl-still">
            <Slab media={p.media[0]} sizes="(max-width: 860px) 60vw, 30vw" />
          </div>
        </div>
      </section>
    ),
    interests: (section, delta) => (
      <section className="fl-sec fl-delta" data-fl style={len(section.length)} aria-labelledby="into">
        <div className="fl-pin">
          <div className="fl-words fl-block fl-into-words" {...delta.block}>
            <Interests
              timing={delta}
              recogUntil={+(section.stop + (section.steps?.leave ?? STEPS.leave) - RECOG_EARLY).toFixed(3)}
              read={day(m.contributions.total.asOf)}
              year={
                yearCount ? (
                  <LiveNumber
                    className="fl-count"
                    value={yearCount}
                    from={yearCount}
                    source={m.contributions.total.source}
                    asOf={formatAsOf(m.contributions.total.asOf)}
                    what={`GitHub contributions in ${RECOGNITION.year}`}
                  />
                ) : null
              }
            />
          </div>
          <div className="fl-still fl-pool" aria-hidden="true" />
        </div>
      </section>
    ),
    // Ask Around: words alone, between the pool and the tarn. The picture is the flight's own run between the two.
    beat: (section, beat) => (
      <section className="fl-sec fl-view fl-beat" data-fl style={len(section.length)} aria-label={AROUND_P.name}>
        <div className="fl-pin">
          <div className="fl-words fl-block fl-view-words fl-beat-words" {...beat.block}>
            <Kind p={AROUND_P} b={beat} />
            <Name p={AROUND_P} b={beat} />
            <p className="fl-line" {...beat.line}>
              {AROUND_P.line}
            </p>
          </div>
        </div>
      </section>
    ),
    ending: (section) => (
      <section className="fl-sec fl-sea ending" data-fl style={len(section.length, true)} aria-label="Contact">
        <div className="fl-pin">
          <div className="fl-words fl-end-words" data-fl-from={+(SETTLE_AT - END_LEAD).toFixed(3)} data-fl-to={1e6} data-fl-set={+(SETTLE_AT - 0.04).toFixed(3)}>
            <EndingWords />
          </div>
        </div>
      </section>
    ),
  };
  return (
    <>
      {/* ---------- the rail: where in the flight this is, and a way to any part of it (before the page's content, so the skip link passes it) ---------- */}
      {/* (Out of the way until the flight's own loop says where the page is: the first frame has no rail.) */}
      <nav className="fl-rail" aria-label="Sections of this page" data-off="">
        {timeline.map(({ id, rail, start, stop }, i) => (
          <a key={id} href="#main" aria-label={rail} data-from={+(start - (i ? 0.25 : 0)).toFixed(2)} data-at={+stop.toFixed(2)}>
            <span aria-hidden="true" />
          </a>
        ))}
      </nav>
      <main id="main" className="fl">
        <script dangerouslySetInnerHTML={{ __html: HERO_BOOT }} />
        {live ? (
          <FlightStage slab={INFINIVIEW_HOME.src} sheet={BENCH_P?.media[0].kind === 'image' ? BENCH_P.media[0].src : ''} tribs={repos.map((r) => r.count).join(',')}
            cols={colH.map((h) => h.toFixed(1)).join(',')}
            face={rydar?.kind === 'image' ? rydar.src : ''}
          />
        ) : (
          <FlightPlayer plan={PLAN} />
        )}

        {timeline.map(section => {
          const block = section.layout && blocks[section.layout];
          const project = PROJECTS.find(entry => entry.slug === section.project);
          const steps = build(section.stop, section.steps);
          if (block) return <Fragment key={section.id}>{block(section, steps, project!)}</Fragment>;
          return (
            <section key={section.id} className="fl-sec fl-view" data-fl style={len(section.length)} aria-label={section.rail}>
              <div className="fl-pin">
                <div className="fl-words fl-block fl-view-words" {...steps.block}>
                  {project ? <><Kind p={project} b={steps} /><Name p={project} b={steps} /><p className="fl-line" {...steps.line}>{project.line}</p></> :
                    <h2 className="display fl-view-name" {...steps.title}>{section.rail}</h2>}
                </div>
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
