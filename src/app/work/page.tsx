import type { Metadata } from 'next';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { Arrow } from '@/components/bits';
import { LiveNumber } from '@/components/LiveNumber';
import { WAY_TO_WORK, WAY_TO_WRITING } from '@/components/NextBand';
import { PageShell } from '@/components/PageShell';
import { sceneOf } from '@/water/registry';
import { stillVars } from '@/components/work/stills';
import { PROJECTS, RECOGNITION } from '@/content/projects';
import { formatPostDate } from '@/lib/dates';
import { pageMeta } from '@/lib/meta';
import { formatAsOf, formatCount, getMetrics } from '@/lib/metrics';

export const revalidate = 3600;

export const metadata: Metadata = pageMeta({
  title: 'Work',
  description:
    'What Arav Jain has built: Infiniview, upstream open source, open models on Ollama, cc-switch, Kilo Bench, Ask Around, RydAR, Agent Bridge and TensorPoW.',
  path: '/work',
});

/**
 * The work index: the delta, then the nine projects in the owner's order,
 * each beside the picture of its own station (one the world has no place
 * for yet is its name and line alone), then what he is recognised for, as
 * lines.
 */
export default async function Work() {
  const m = await getMetrics();
  const stat: Record<string, string> = {
    'open-source': `${formatCount(m.mergedPrs.upstream.value)} merged pull requests across ${m.mergedPrs.upstreamRepoCount} repositories`,
    ollama: `${formatCount(m.ollama.total.value)} pulls across ${m.ollama.models.length} models`,
    'cc-switch': `${formatCount(m.npm.allTime.value)} npm downloads since February 1, 2026`,
  };
  const year = m.contributions.byYear[RECOGNITION.year];

  return (
    <PageShell
      scene="delta"
      index
      head={{ title: WAY_TO_WORK.title, lead: WAY_TO_WORK.line }}
      note={`Numbers read ${formatAsOf(m.retrievedAt)}`}
      next={WAY_TO_WRITING}
    >
      <section className="sec wrap" aria-label="Projects">
        <ul className="feats">
          {PROJECTS.map((p) => {
            const scene = sceneOf(p.slug);
            return (
              <li key={p.slug}>
                <Link className={`row feat-row${scene ? '' : ' feat-row-type'}`} data-row href={`/work/${p.slug}`}>
                  <span className="label feat-n">{p.n}</span>
                  {scene ? <span className="feat-pic" data-fill style={stillVars(scene)} aria-hidden="true" /> : null}
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
            );
          })}
        </ul>
      </section>

      <section className="sec wrap" aria-labelledby="w-recognition">
        <h2 className="sec-h" id="w-recognition">
          Recognition
        </h2>
        <ul className="recog">
          <li>{RECOGNITION.devday}.</li>
          <li>
            {RECOGNITION.press.text}.{' '}
            <a className="link" href={RECOGNITION.press.href} target="_blank" rel="noopener noreferrer">
              Article <Arrow out />
            </a>
          </li>
          {year ? (
            <li>
              <LiveNumber
                value={year}
                from={year}
                source={m.contributions.total.source}
                asOf={formatAsOf(m.contributions.total.asOf)}
                what={`GitHub contributions in ${RECOGNITION.year}`}
              />{' '}
              GitHub contributions in {RECOGNITION.year}, read {formatPostDate(m.contributions.total.asOf, 'short')}.
            </li>
          ) : null}
        </ul>
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
