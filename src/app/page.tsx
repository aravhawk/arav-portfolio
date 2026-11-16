import Link from 'next/link';
import { Arrow, Slab } from '@/components/bits';
import { Ending } from '@/components/ending/Ending';
import { Basins, Fork, Tributaries } from '@/components/features';
import { LiveNumber } from '@/components/LiveNumber';
import { INTERESTS, PROJECTS, type Project } from '@/content/projects';
import { formatAsOf, getMetrics } from '@/lib/metrics';
import './home.css';

// Live numbers are read on the server and cached for an hour. A visitor's
// page view never reaches GitHub, npm or Ollama.
export const revalidate = 3600;

const P = Object.fromEntries(PROJECTS.map((p) => [p.slug, p])) as Record<string, Project>;

function Copy({ p, children }: { p: Project; children?: React.ReactNode }) {
  return (
    <div className="beat-copy">
      {p.kicker ? (
        <p className="label beat-label" data-reveal="fade">
          {p.kicker}
        </p>
      ) : null}
      {/* The name is the way in: one link, no separate button. */}
      <h2
        className="display beat-name"
        data-reveal="lead"
        style={{ '--len': Math.max(...p.name.split(' ').map((w) => w.length)) } as React.CSSProperties}
      >
        <Link className="beat-link" href={`/work/${p.slug}`}>
          {p.name}
          <Arrow />
        </Link>
      </h2>
      <p className="lead beat-line" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
        {p.line}
      </p>
      {children}
    </div>
  );
}

export default async function Home() {
  const m = await getMetrics();
  const repos = m.mergedPrs.byRepo;

  return (
    <>
      <main id="main" data-scene="home">
        {/* ---------- hero ---------- */}
        <section className="hero" aria-labelledby="name">
          <div className="hero-top wrap">
            <p className="hero-role statement">AI and developer tooling builder.</p>
            <p className="hero-intro lead">
              I co-founded Infiniflop Labs and build Infiniview: agents that attack your app to prove what breaks.
            </p>
          </div>
          <div className="hero-lake" data-bed="lake" data-basin>
            <h1 id="name" className="ice" data-ice>
              <span data-ice-line>Arav</span> <span data-ice-line>Jain</span>
            </h1>
          </div>
        </section>

        {/* ---------- statement ---------- */}
        <section className="say wrap" aria-label="What I do">
          <p className="say-text" data-reveal="lead">
            Agents that break software before attackers do. Tools developers run daily.
          </p>
        </section>

        {/* ---------- 01 Infiniview ---------- */}
        <section className="beat wrap" data-side="right" aria-label="Infiniview">
          <Copy p={P.infiniview} />
          <div className="feat feat-sandbox" data-bed="feat:sandbox" data-basin>
            <Slab media={P.infiniview.media[0]} sizes="(max-width: 860px) 78vw, 40vw" />
          </div>
        </section>

        {/* ---------- 02 Upstream ---------- */}
        <section className="beat wrap" data-side="left" aria-label="Open source">
          <div className="beat-copy">
            <p className="label beat-label" data-reveal="fade">
              Open source
            </p>
            <h2 className="beat-figure" data-reveal="lead">
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
            <p className="small beat-sub" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
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
            <Link className="link beat-more" href="/work/open-source" data-reveal style={{ '--i': 2 } as React.CSSProperties}>
              Upstream <Arrow />
            </Link>
          </div>
          <Tributaries repos={repos} />
        </section>

        {/* ---------- 03 Kilo Bench ---------- */}
        <section className="beat wrap" data-side="right" aria-label="Kilo Bench">
          <Copy p={P['kilo-bench']} />
          <div className="feat feat-lanes" data-bed="feat:lanes" />
        </section>

        {/* ---------- 04 Agent Bridge ---------- */}
        <section className="beat wrap" data-side="left" aria-label="Agent Bridge">
          <Copy p={P['agent-bridge']} />
          <div className="feat feat-bridge" data-bed="feat:bridge">
            <div className="peer peer-a" data-bed="peer:a" data-pulse data-basin />
            <div className="peer peer-b" data-bed="peer:b" data-pulse data-basin />
            <Slab media={P['agent-bridge'].media[0]} sizes="(max-width: 860px) 70vw, 30vw" />
          </div>
        </section>

        {/* ---------- 05 Open models ---------- */}
        <section className="beat wrap" data-side="right" aria-label="Open models">
          <div className="beat-copy">
            <p className="label beat-label" data-reveal="fade">
              Ollama
            </p>
            <h2 className="beat-figure" data-reveal="lead">
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
            <Link className="link beat-more" href="/work/ollama" data-reveal style={{ '--i': 2 } as React.CSSProperties}>
              Open models <Arrow />
            </Link>
          </div>
          <Basins models={m.ollama.models} />
        </section>

        {/* ---------- 06 cc-switch ---------- */}
        <section className="beat wrap" data-side="left" aria-label="cc-switch">
          <Copy p={P['cc-switch']}>
            <p className="small beat-sub" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
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
          </Copy>
          <Fork />
        </section>

        {/* ---------- 07 TensorPoW ---------- */}
        <section className="beat wrap" data-side="right" aria-label="TensorPoW">
          <Copy p={P.tensorpow} />
          <div className="feat feat-grid" data-bed="feat:grid" />
        </section>

        {/* ---------- 08 RydAR ---------- */}
        <section className="beat wrap" data-side="left" aria-label="RydAR">
          <Copy p={P.rydar} />
          <div className="feat feat-bends" data-bed="feat:bends" />
        </section>

        {/* ---------- interests and what is next ---------- */}
        <section className="into wrap" aria-labelledby="into">
          <div className="into-copy">
            <p className="label" id="into" data-reveal="fade">
              Into
            </p>
            <ul className="into-list title">
              {INTERESTS.map((x, i) => (
                <li key={x} data-reveal style={{ '--i': i } as React.CSSProperties}>
                  {x}
                </li>
              ))}
            </ul>
            <p className="lead into-next" data-reveal>
              Next: a company, a research paper, and code in tools you open daily.
            </p>
            <Link className="btn" href="/work" data-reveal>
              All work <Arrow />
            </Link>
          </div>
          <div className="into-lane" data-bed="feat:pass" />
        </section>
        <div className="delta" data-bed="delta" aria-hidden="true" />
      </main>
      <Ending />
    </>
  );
}
