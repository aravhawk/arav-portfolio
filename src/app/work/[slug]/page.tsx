import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ViewTransition } from 'react';
import SceneSetter from '@/components/SceneSetter';
import GroundInit from '@/components/GroundInit';
import Footer from '@/components/Footer';
import Glass from '@/components/Glass';
import Counter from '@/components/Counter';
import ProjectVideo from '@/components/work/ProjectVideo';
import { ArrowLeft, ArrowUpRight } from '@/components/Icons';
import { projects } from '@/lib/site';

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = projects.find((x) => x.slug === slug);
  if (!p) return { title: 'Not found' };
  return { title: p.name, description: p.line, alternates: { canonical: `/work/${p.slug}` }, openGraph: { title: `${p.name} · Arav Jain`, description: p.line } };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = projects.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const p = projects[i];
  const next = projects[(i + 1) % projects.length];

  return (
    <>
      <GroundInit ground={p.ground} />
      <SceneSetter name={`project:${p.slug}`} />
      <article className="page">
        <header className="page-head layer-type" style={{ pointerEvents: 'auto', userSelect: 'auto' }}>
          <Link className="back" href="/work">
            <ArrowLeft />
            Work
          </Link>
          <span className="kicker mono">
            {String(i + 1).padStart(2, '0')} · {p.kicker}
          </span>
          <ViewTransition name={`title-${p.slug}`} share="title" default="none">
            <h1 className="word page-title" style={{ '--w': Math.max(p.name.length * 0.62, 3.2), '--cap': '22svh' } as React.CSSProperties}>
              <span className="line">
                <span data-refract>{p.name}</span>
              </span>
            </h1>
          </ViewTransition>
          <p className="page-lede">{p.line}</p>
        </header>

        <div className="proj layer-ui">
          <Glass className="proj-body" refract>
            {p.video ? <ProjectVideo /> : null}
            {p.body.map((t) => (
              <p key={t}>{t}</p>
            ))}
            {p.quote ? <blockquote>“{p.quote}”</blockquote> : null}
            <div className="pane-links">
              {p.links.map((l, n) => (
                <a key={l.href} className={`btn ${n === 0 ? 'btn--solid' : ''}`} href={l.href} target="_blank" rel="noopener noreferrer" data-magnet>
                  {l.label}
                  <ArrowUpRight />
                </a>
              ))}
            </div>
          </Glass>

          <div className="proj-side">
            {p.stats ? (
              <div className="proj-stats">
                {p.stats.map((s) => (
                  <Glass className="readout" key={s.label} radius={20}>
                    <Counter value={s.value} />
                    <span>{s.label}</span>
                  </Glass>
                ))}
              </div>
            ) : null}
            <Glass className="proj-body" refract radius={28}>
              <dl className="facts">
                {p.facts.map((f) => (
                  <div key={f.k}>
                    <dt className="mono">{f.k}</dt>
                    <dd>{f.v}</dd>
                  </div>
                ))}
              </dl>
            </Glass>
          </div>
        </div>

        <Link className="proj-next layer-ui" href={`/work/${next.slug}`}>
          <span>
            <span className="kicker mono">Next</span>
            <ViewTransition name={`title-${next.slug}`} share="title" default="none">
              <span className="frow-t" style={{ display: 'block' }}>
                {next.name}
              </span>
            </ViewTransition>
          </span>
          <span className="frow-a" aria-hidden="true">
            <ArrowUpRight />
          </span>
        </Link>
      </article>
      <Footer />
    </>
  );
}
