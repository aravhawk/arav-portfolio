import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/inner/bits';
import { InnerPage, WAY_TO_WORK, WAY_TO_WRITING } from '@/components/inner/Page';
import { ArchiveList } from '@/components/work/ArchiveList';
import { KIND } from '@/content/kinds';
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
 * The work index, set as an index: the eight featured projects (number,
 * name, one line, what kind of thing it is), then the rest, one line each,
 * then the archive with its search.
 */
export default async function Work() {
  const m = await getMetrics();
  const stat: Record<string, string> = {
    'open-source': `${formatCount(m.mergedPrs.upstream.value)} merged pull requests across ${m.mergedPrs.upstreamRepoCount} repositories`,
    ollama: `${formatCount(m.ollama.total.value)} pulls`,
    'cc-switch': `${formatCount(m.npm.allTime.value)} npm downloads`,
  };

  return (
    <InnerPage head={{ title: WAY_TO_WORK.title, lead: WAY_TO_WORK.line }} note={`Numbers read ${formatAsOf(m.retrievedAt)}`} next={WAY_TO_WRITING}>
      <section className="sec wrap" aria-label="Featured">
        <ol className="index">
          {PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link className="row index-row" href={`/work/${p.slug}`}>
                <span className="label index-n">{p.n}</span>
                <span className="index-name">{p.name}</span>
                <span className="index-line">
                  {p.line}
                  {stat[p.slug] ? <strong>{stat[p.slug]}</strong> : null}
                </span>
                <span className="label index-kind">{KIND[p.slug]}</span>
                <span className="index-go" aria-hidden="true">
                  <Arrow />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="sec wrap" aria-labelledby="w-more">
        <h2 className="sec-h" id="w-more">
          Also
        </h2>
        <ul className="rows">
          {MORE.map((x) => (
            <li key={x.name} className="line-row">
              <span className="label">{x.tag}</span>
              <span className="line-name">{x.name}</span>
              <span className="line-what">
                {x.line}
                {x.note ? <small>{x.note}</small> : null}
              </span>
              <span className="line-links">
                <a className="tl" href={x.href} target="_blank" rel="noopener noreferrer">
                  {x.hrefLabel ?? 'Source'} <Arrow out />
                </a>
                {x.also?.map((l) => (
                  <a key={l.href} className="tl" href={l.href} target="_blank" rel="noopener noreferrer">
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
        <p className="cap footnote">
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
    </InnerPage>
  );
}
