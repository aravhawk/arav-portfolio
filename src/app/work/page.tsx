import type { Metadata } from 'next';
import { Link } from '@/components/Link';
import { ViewTransition } from 'react';
import { Arrow } from '@/components/bits';
import { LiveNumber } from '@/components/LiveNumber';
import { WAY_TO_WORK, WAY_TO_WRITING } from '@/components/NextBand';
import { PageShell } from '@/components/PageShell';
import { sceneOf } from '@/water/registry';
import { FeatStill } from '@/components/work/still-pictures';
import { KIND } from '@/content/kinds';
import { INTERESTS_LINE, PROJECTS, RECOGNITION, TOOLS } from '@/content/projects';
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
 * each beside the picture of its own station, then his other tools as rows
 * of type (TOOLS: no picture, no page), then what he is recognised for and
 * what he is into, as lines.
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
                  {scene ? (
                    <span className="feat-pic" data-fill aria-hidden="true">
                      <FeatStill scene={scene} />
                    </span>
                  ) : null}
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

      {/* The other tools: the same rows in type alone. A tool has no page, so its row is not a link: its name, its
          line, what kind of thing it is, and the ways to its source and its release. */}
      <section className="sec wrap" aria-labelledby="w-tools">
        <h2 className="sec-h" id="w-tools">
          {TOOLS.length === 1 ? 'One more tool' : 'Other tools'}
        </h2>
        <ul className="tools">
          {TOOLS.map((t) => (
            <li key={t.slug} className="row tool-row">
              <span className="label">{KIND[t.slug]}</span>
              <h3 className="tool-name">{t.name}</h3>
              <p className="tool-line">{t.line}</p>
              <span className="tool-links">
                {t.links.map((l) => (
                  <a key={l.href} className="link" href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${t.name}: ${l.label === 'Source' ? 'source' : `release ${l.label}`}`}>
                    {l.label} <Arrow out />
                  </a>
                ))}
              </span>
            </li>
          ))}
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
      </section>

      <section className="sec wrap" aria-labelledby="w-interests">
        <h2 className="sec-h" id="w-interests">
          Interests
        </h2>
        <p className="recog">{INTERESTS_LINE.charAt(0).toUpperCase() + INTERESTS_LINE.slice(1)}</p>
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
