'use client';

import Link from 'next/link';
import { ViewTransition, useMemo, useState } from 'react';
import Glass from '@/components/Glass';
import { ArrowRight, ArrowUpRight, Search } from '@/components/Icons';
import { stage } from '@/stage/stage';
import { archive, highlights, projects, type ArchiveKind } from '@/lib/site';

const kinds: (ArchiveKind | 'All')[] = ['All', 'Earlier work', 'Tools', 'Small'];

export default function WorkIndex() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ArchiveKind | 'All'>('All');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return archive.filter((a) => (kind === 'All' || a.kind === kind) && (!s || `${a.name} ${a.text} ${a.kind} ${a.year}`.toLowerCase().includes(s)));
  }, [q, kind]);

  return (
    <>
      <section aria-labelledby="featured-h">
        <h2 id="featured-h" className="section-h">
          <span>Featured</span>
          <span className="mono">{String(projects.length).padStart(2, '0')}</span>
        </h2>
        <ul className="frows" onPointerLeave={() => stage.setPreview(null)}>
          {projects.map((p, i) => (
            <li className="frow" key={p.slug} onPointerEnter={(e) => e.pointerType !== 'touch' && stage.setPreview(p.shape)} onFocus={() => stage.setPreview(p.shape)} onBlur={() => stage.setPreview(null)}>
              <span className="frow-n mono">{String(i + 1).padStart(2, '0')}</span>
              <ViewTransition name={`title-${p.slug}`} share="title" default="none">
                <span className="frow-t">{p.name}</span>
              </ViewTransition>
              <span className="frow-d">{p.line}</span>
              <span className="frow-a" aria-hidden="true">
                <ArrowUpRight />
              </span>
              <Link className="cover" href={`/work/${p.slug}`} aria-label={`${p.name}: ${p.line}`} onClick={() => stage.setPreview(null)} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="highlights-h" id="highlights">
        <h2 id="highlights-h" className="section-h">
          <span>Also</span>
          <span className="mono">{String(highlights.length).padStart(2, '0')}</span>
        </h2>
        <div className="cards">
          {highlights.map((h) => (
            <Glass as="article" className="card" key={h.name} refract radius={20}>
              <h3>{h.name}</h3>
              <p>{h.text}</p>
              {h.note ? <p className="note">{h.note}</p> : null}
              {h.links.length ? (
                <div className="card-links">
                  {h.links.map((l) => (
                    <a key={l.href} className="btn" href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${h.name}: ${l.label}`}>
                      {l.label}
                      <ArrowUpRight />
                    </a>
                  ))}
                </div>
              ) : null}
            </Glass>
          ))}
        </div>
      </section>

      <section aria-labelledby="archive-h" id="archive">
        <h2 id="archive-h" className="section-h">
          <span>Archive</span>
          <span className="mono" aria-live="polite">
            {String(rows.length).padStart(2, '0')} / {String(archive.length).padStart(2, '0')}
          </span>
        </h2>
        <div className="tools">
          <Glass as="label" className="search" radius={999}>
            <Search />
            <span className="sr-only">Search the archive</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the archive" autoComplete="off" spellCheck={false} />
          </Glass>
          <div className="filters" role="group" aria-label="Filter by kind">
            {kinds.map((k) => (
              <button type="button" key={k} className="filter" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {k}
              </button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <ul className="arows">
            {rows.map((a) => (
              <li className="arow" key={a.name}>
                <span className="arow-n">
                  {a.href ? (
                    <a href={a.href} target="_blank" rel="noopener noreferrer">
                      {a.name}
                    </a>
                  ) : (
                    a.name
                  )}
                </span>
                <span className="arow-d">
                  {a.text}
                  {a.live ? (
                    <>
                      {' '}
                      <a href={a.live} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                        Live
                      </a>
                    </>
                  ) : null}
                </span>
                <span className="arow-y mono">{a.year}</span>
                <span className="arow-k mono">{a.kind}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty" role="status">
            <p>Nothing in the archive matches “{q}”.</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQ('');
                setKind('All');
              }}
            >
              Clear search
              <ArrowRight />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
