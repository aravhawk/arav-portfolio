import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/bits';
import { PageShell } from '@/components/PageShell';
import { ArchiveList } from '@/components/work/ArchiveList';
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

export default async function Work() {
  const m = await getMetrics();
  const stat: Record<string, string> = {
    'open-source': `${formatCount(m.mergedPrs.upstream.value)} merged pull requests across ${m.mergedPrs.upstreamRepoCount} repositories`,
    ollama: `${formatCount(m.ollama.total.value)} pulls`,
    'cc-switch': `${formatCount(m.npm.allTime.value)} npm downloads`,
  };

  return (
    <PageShell
      head={{
        label: 'Work',
        title: 'Everything I have built',
        lead: 'Eight things I would point you to first, then the rest, one line each.',
      }}
      note={`Numbers read ${formatAsOf(m.retrievedAt)}`}
    >
      <section className="block" aria-labelledby="w-featured">
        <div className="block-head">
          <h2 className="label" id="w-featured">
            Featured
          </h2>
        </div>
        <ul className="rows">
          {PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link className="row" href={`/work/${p.slug}`}>
                <span className="label">{p.n}</span>
                <span className="row-name">{p.name}</span>
                <span className="row-line">
                  {p.line}
                  {stat[p.slug] ? <small>{stat[p.slug]}</small> : null}
                </span>
                <span className="row-go" aria-hidden="true">
                  <Arrow />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" aria-labelledby="w-more">
        <div className="block-head">
          <h2 className="label" id="w-more">
            Also
          </h2>
        </div>
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

      <section className="block" aria-labelledby="w-archive">
        <div className="block-head">
          <h2 className="label" id="w-archive">
            Archive
          </h2>
        </div>
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
