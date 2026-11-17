import type { Metadata } from 'next';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { Arrow } from '@/components/bits';
import { PageShell } from '@/components/PageShell';
import { ArchiveList } from '@/components/work/ArchiveList';
import { SCENE_OF } from '@/components/work/stations';
import { stillVars } from '@/components/work/stills';
import { ARCHIVE, MORE, PROJECTS } from '@/content/projects';
import { pageMeta } from '@/lib/meta';
import { formatAsOf, formatCount, getMetrics } from '@/lib/metrics';

export const revalidate = 3600;

export const metadata: Metadata = pageMeta({
  title: 'Work',
  description:
    'Everything Arav Jain has built: Infiniview, upstream open source, Kilo Bench, Agent Bridge, open models on Ollama, cc-switch, TensorPoW, RydAR and an archive.',
  path: '/work',
});

/**
 * The work index: the delta, then the eight featured projects, each beside
 * the picture of its own station, then the rest, one line each.
 */
export default async function Work() {
  const m = await getMetrics();
  const stat: Record<string, string> = {
    'open-source': `${formatCount(m.mergedPrs.upstream.value)} merged pull requests across ${m.mergedPrs.upstreamRepoCount} repositories`,
    ollama: `${formatCount(m.ollama.total.value)} pulls`,
    'cc-switch': `${formatCount(m.npm.allTime.value)} npm downloads`,
  };

  return (
    <PageShell
      scene="delta"
      index
      head={{
        title: 'Everything I have built',
        lead: 'Eight things I would point you to first, then the rest, one line each.',
      }}
      note={`Numbers read ${formatAsOf(m.retrievedAt)}`}
    >
      <section className="sec wrap" aria-label="Featured">
        <ul className="feats">
          {PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link className="row feat-row" href={`/work/${p.slug}`}>
                <span className="label feat-n">{p.n}</span>
                <span className="feat-pic" style={stillVars(SCENE_OF[p.slug])} aria-hidden="true" />
                <span className="feat-copy">
                  <ViewTransition name={`title-${p.slug}`} share="title" default="none">
                    <span className="feat-name">{p.name}</span>
                  </ViewTransition>
                  <span className="feat-line">
                    {p.line}
                    {stat[p.slug] ? <strong>{stat[p.slug]}</strong> : null}
                  </span>
                </span>
                <span className="row-go" aria-hidden="true">
                  <Arrow />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="sec wrap" aria-labelledby="w-more">
        <h2 className="sec-h" id="w-more">
          Also
        </h2>
        <ul className="rows">
          {MORE.map((x) => (
            <li key={x.name} className="row">
              <span className="label">{x.tag}</span>
              <span className="row-name">{x.name}</span>
              <span className="row-line">
                {x.line}
                {x.note ? <small>{x.note}</small> : null}
              </span>
              <span className="row-links">
                <a className="link" href={x.href} target="_blank" rel="noopener noreferrer">
                  {x.hrefLabel ?? 'Source'} <Arrow out />
                </a>
                {x.also?.map((l) => (
                  <a key={l.href} className="link" href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.label} <Arrow out />
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sec wrap" aria-labelledby="w-archive">
        <h2 className="sec-h" id="w-archive">
          Archive
        </h2>
        <ArchiveList entries={ARCHIVE} />
        <p className="small footnote">
          Live numbers on this site are read from{' '}
          <a href={m.mergedPrs.upstream.source} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          ,{' '}
          <a href={m.npm.allTime.source} target="_blank" rel="noopener noreferrer">
            npm
          </a>{' '}
          and{' '}
          <a href={m.ollama.total.source} target="_blank" rel="noopener noreferrer">
            Ollama
          </a>{' '}
          about once an hour. Last read {formatAsOf(m.retrievedAt)}.
        </p>
      </section>
    </PageShell>
  );
}
