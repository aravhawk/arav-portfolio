import Image from 'next/image';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { Arrow } from '@/components/bits';
import { VideoSlab } from '@/components/VideoSlab';
import { PROJECTS, type Project, type ProjectLink, type ProjectMedia } from '@/content/projects';

/**
 * The few pieces every project page shares. Each page is otherwise its own
 * composition (cases.tsx): these are only the picture, the section, the
 * quiet list of facts, the run-in note, the ways out and the way round the
 * set. There are no eyebrows here: a section that needs a name gets a
 * heading, and where a thing comes from is said in a sentence under it.
 */

export const PLATE_SIZES = '(max-width: 1720px) 96vw, 1640px';
export const HALF_SIZES = '(max-width: 859px) 94vw, (max-width: 1720px) 48vw, 820px';

/** A piece of real media. A light capture is mounted, and dimmed on the dark theme. */
export function Plate({ media, caption, sizes = PLATE_SIZES, priority = false, className = '' }: { media: ProjectMedia; caption?: React.ReactNode; sizes?: string; priority?: boolean; className?: string }) {
  if (media.kind === 'video') return <VideoSlab media={media} />;
  return (
    <figure className={`plate${media.tone === 'light' ? ' plate-light' : ''} ${className}`}>
      <div className="plate-frame" data-dry>
        <Image className="plate-media" src={media.src} alt={media.alt} width={media.w} height={media.h} sizes={sizes} priority={priority} />
      </div>
      {caption ? <figcaption className="cap">{caption}</figcaption> : null}
    </figure>
  );
}

/** A section of a page. `title` is a real heading; most sections have none. */
export function Sec({ children, className = '', title, id, label }: { children: React.ReactNode; className?: string; title?: string; id?: string; label?: string }) {
  return (
    <section className={`sec wrap ${className}`} aria-labelledby={title && id ? id : undefined} aria-label={!title ? label : undefined}>
      {title && id ? (
        <h2 className="sec-h" id={id}>
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** The project's facts, as a quiet two column list in the text face. */
export function Spec({ facts, className = '' }: { facts: Project['facts']; className?: string }) {
  return (
    <dl className={`spec ${className}`}>
      {facts.map((f) => (
        <div key={f.label} className="spec-row" data-row>
          <dt>{f.label}</dt>
          <dd className={/^(npm |ollama |cc-switch )/.test(f.value) ? 'mono' : undefined}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A point made in a paragraph that opens with its own name. Not a numbered step. */
export function Note({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`note ${className}`}>
      <strong>{title}.</strong> {children}
    </p>
  );
}

/** The ways out: links, set as links. */
export function Outs({ links }: { links: ProjectLink[] }) {
  return (
    <Sec className="sec-outs" label="Links">
      <ul className="outs">
        {links.map((l) => (
          <li key={l.href}>
            <a className="out" href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label} <Arrow out />
            </a>
          </li>
        ))}
      </ul>
    </Sec>
  );
}

/**
 * The way round the set: the eight projects by name, this one marked, the
 * one after it offered. Each name travels into the title of the page it opens.
 */
export function WorkStrip({ current }: { current: Project }) {
  const next = PROJECTS[(PROJECTS.indexOf(current) + 1) % PROJECTS.length];
  return (
    <nav className="strip wrap" aria-label="Projects">
      <ul className="strip-names">
        {PROJECTS.map((p) =>
          p.slug === current.slug ? (
            <li key={p.slug}>
              <span className="strip-name" aria-current="page">
                {p.name}
              </span>
            </li>
          ) : (
            <li key={p.slug}>
              <Link className="strip-name" href={`/work/${p.slug}`}>
                {p.slug === next.slug ? (
                  p.name
                ) : (
                  <ViewTransition name={`title-${p.slug}`} share="title" default="none">
                    <span>{p.name}</span>
                  </ViewTransition>
                )}
              </Link>
            </li>
          ),
        )}
      </ul>
      <Link className="strip-next" href={`/work/${next.slug}`}>
        <span className="strip-next-copy">
          <ViewTransition name={`title-${next.slug}`} share="title" default="none">
            <span className="strip-next-name">{next.name}</span>
          </ViewTransition>
          <span className="strip-next-line">{next.line}</span>
        </span>
        <span className="row-go" aria-hidden="true">
          <Arrow />
        </span>
      </Link>
    </nav>
  );
}
