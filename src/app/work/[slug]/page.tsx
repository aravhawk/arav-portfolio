import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Arrow, Slab } from '@/components/bits';
import { Basins, Fork, Tributaries } from '@/components/features';
import { LiveNumber } from '@/components/LiveNumber';
import { PageShell } from '@/components/PageShell';
import { PROJECTS, projectBySlug } from '@/content/projects';
import { formatPostDate } from '@/lib/dates';
import { pageMeta } from '@/lib/meta';
import { formatAsOf, formatCount, getMetrics, type Metric } from '@/lib/metrics';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) return { title: 'Not found' };
  const name = p.name.replace('\u2011', '-');
  return pageMeta({ title: name, description: p.line, path: `/work/${p.slug}`, type: 'article' });
}

function Readout({ metric, what, unit }: { metric: Metric; what: string; unit: string }) {
  return (
    <div className="readout">
      <LiveNumber className="number" value={metric.value} from={metric.snapshotValue} source={metric.source} asOf={formatAsOf(metric.asOf)} what={what} />
      <span className="label">{unit}</span>
    </div>
  );
}

const HIDDEN_MEDIA = new Set(['/media/kilo-bench-generation.webp']);

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p) notFound();
  const m = await getMetrics();
  const i = PROJECTS.indexOf(p);
  const next = PROJECTS[(i + 1) % PROJECTS.length];
  // One capture is left off the page: it is a nearly empty panel with a
  // spinner in it, and shows nothing of the project.
  const [lead, ...rest] = p.media.filter((x) => !HIDDEN_MEDIA.has(x.src));

  return (
    <PageShell
      head={{
        back: { href: '/work', label: 'Work' },
        label: p.kicker || 'Work',
        title: p.name,
        vt: `title-${p.slug}`,
        lead: p.summary,
        children: lead && lead.kind === 'image' ? <Slab media={lead} priority sizes="(max-width: 860px) 70vw, 26vw" /> : null,
      }}
      note={`Numbers read ${formatAsOf(m.retrievedAt)}`}
      feature={
        p.slug === 'open-source' ? (
          <Tributaries repos={m.mergedPrs.byRepo} counts />
        ) : p.slug === 'ollama' ? (
          <Basins models={m.ollama.models} />
        ) : p.slug === 'cc-switch' ? (
          <Fork />
        ) : p.slug === 'kilo-bench' ? (
          <div className="feat feat-lanes" data-bed="feat:lanes" />
        ) : p.slug === 'tensorpow' ? (
          <div className="feat feat-grid" data-bed="feat:grid" />
        ) : p.slug === 'rydar' ? (
          <div className="feat feat-bends" data-bed="feat:bends" />
        ) : p.slug === 'agent-bridge' && lead ? (
          <div className="feat feat-bridge" data-bed="feat:bridge">
            <div className="peer peer-a" data-bed="peer:a" data-pulse data-basin />
            <div className="peer peer-b" data-bed="peer:b" data-pulse data-basin />
            <Slab media={lead} sizes="(max-width: 860px) 70vw, 34vw" />
          </div>
        ) : null
      }
    >
      {/* Live numbers, where the project has them. */}
      {p.slug === 'open-source' ? (
        <section className="block" aria-label="Numbers">
          <div className="readouts">
            <Readout metric={m.mergedPrs.upstream} what="merged pull requests in repositories I do not own" unit={`merged upstream, ${m.mergedPrs.upstreamRepoCount} repositories`} />
            <Readout metric={m.mergedPrs.total} what="merged pull requests in total" unit="merged in all, public" />
            <Readout metric={m.contributions.total} what={m.contributions.label} unit={m.contributions.label} />
          </div>
        </section>
      ) : null}
      {p.slug === 'ollama' ? (
        <section className="block" aria-label="Numbers">
          <div className="readouts">
            <Readout metric={m.ollama.total} what="pulls of my open models on Ollama" unit={`pulls, ${m.ollama.models.length} models`} />
          </div>
        </section>
      ) : null}
      {p.slug === 'cc-switch' ? (
        <section className="block" aria-label="Numbers">
          <div className="readouts">
            <Readout metric={m.npm.allTime} what="npm downloads of cc-switch, all time" unit="npm downloads, all time" />
            <Readout metric={m.npm.lastMonth} what="npm downloads of cc-switch in the last month" unit="in the last month" />
          </div>
        </section>
      ) : null}

      <section className="block" aria-labelledby="p-how">
        <div className="block-head">
          <h2 className="label" id="p-how">
            How it works
          </h2>
        </div>
        <ol className="steps">
          {p.how.map((h) => (
            <li key={h.title} className="step">
              <h3 className="title">{h.title}</h3>
              <p className="body">{h.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {lead && lead.kind === 'video' && p.slug !== 'agent-bridge' ? (
        <section className="block" aria-label="Video">
          <Slab media={lead} sizes="(max-width: 860px) 80vw, 60vw" />
        </section>
      ) : null}
      {rest.length ? (
        <section className="block" aria-label="More media">
          <div className="media-stack">
            {rest.map((x) => (
              <Slab key={x.src} media={x} sizes="(max-width: 860px) 80vw, 60vw" />
            ))}
          </div>
        </section>
      ) : null}

      {p.quote ? (
        <section className="block" aria-label="In its own words">
          <blockquote className="quote">{p.quote.text}</blockquote>
          <p className="label">{p.quote.source}</p>
        </section>
      ) : null}

      {p.slug === 'open-source' ? (
        <section className="block" aria-labelledby="p-ledger">
          <div className="block-head">
            <h2 className="label" id="p-ledger">
              Every merged pull request
            </h2>
          </div>
          <div className="table-scroll">
            <table className="ledger">
              <thead>
                <tr className="label">
                  <th scope="col">Repository</th>
                  <th scope="col">Change</th>
                  <th scope="col">Merged</th>
                </tr>
              </thead>
              <tbody>
                {m.mergedPrs.ledger.map((e) => (
                  <tr key={e.url}>
                    <td className="mono">{e.repo.split('/')[1]}</td>
                    <td>
                      <a href={e.url} target="_blank" rel="noopener noreferrer">
                        {e.title}
                      </a>
                    </td>
                    <td className="mono">{formatPostDate(e.mergedAt, 'short')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {p.slug === 'ollama' ? (
        <section className="block" aria-labelledby="p-models">
          <div className="block-head">
            <h2 className="label" id="p-models">
              Models
            </h2>
          </div>
          <div className="table-scroll">
            <table className="ledger">
              <thead>
                <tr className="label">
                  <th scope="col">Model</th>
                  <th scope="col">Run it</th>
                  <th scope="col">Pulls</th>
                </tr>
              </thead>
              <tbody>
                {m.ollama.models.map((x) => (
                  <tr key={x.name}>
                    <td>
                      <a href={x.url} target="_blank" rel="noopener noreferrer">
                        {x.name}
                      </a>
                    </td>
                    <td className="mono">ollama run aravhawk/{x.name}</td>
                    <td className="mono">{formatCount(x.pulls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="block" aria-labelledby="p-facts">
        <div className="block-head">
          <h2 className="label" id="p-facts">
            Facts
          </h2>
        </div>
        <dl className="facts">
          {p.facts.map((f) => (
            <div key={f.label} className="fact">
              <dt className="label">{f.label}</dt>
              <dd className={/^(npm |ollama |cc-switch )/.test(f.value) ? 'mono' : undefined}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="block" aria-label="Links">
        <div className="outs">
          {p.links.map((l, k) => (
            <a key={l.href} className={k === 0 ? 'btn' : 'btn btn-quiet'} href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label} <Arrow out />
            </a>
          ))}
        </div>
      </section>

      <nav className="next" aria-label="Next project">
        <span className="label">Next</span>
        <Link className="display next-link" href={`/work/${next.slug}`}>
          {next.name} <Arrow />
        </Link>
      </nav>
    </PageShell>
  );
}
