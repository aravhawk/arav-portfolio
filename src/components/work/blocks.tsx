import Image from 'next/image';
import Link from 'next/link';
import { Arrow } from '@/components/bits';
import { VideoSlab } from '@/components/VideoSlab';
import type { Project, ProjectLink, ProjectMedia } from '@/content/projects';

/**
 * The pieces a project page is built from. A page is a sequence of these,
 * chosen for what the project has: plates of real media, short statements,
 * numbers at scale, the steps, the facts, the ways out.
 */

const PLATE_SIZES = '(max-width: 1720px) 96vw, 1640px';
const HALF_SIZES = '(max-width: 859px) 94vw, (max-width: 1720px) 48vw, 820px';

/** A piece of real media at full size, on the snow. */
export function Plate({ media, caption, sizes = PLATE_SIZES, priority = false, className = '' }: { media: ProjectMedia; caption?: string; sizes?: string; priority?: boolean; className?: string }) {
  if (media.kind === 'video') return <VideoSlab media={media} />;
  return (
    <figure className={`plate ${className}`}>
      <div className="plate-frame" data-dry>
        <Image className="plate-media" src={media.src} alt={media.alt} width={media.w} height={media.h} sizes={sizes} priority={priority} />
      </div>
      {caption ? <figcaption className="label plate-cap">{caption}</figcaption> : null}
    </figure>
  );
}

export function Sec({ children, className = '', label, id }: { children: React.ReactNode; className?: string; label?: string; id?: string }) {
  return (
    <section className={`sec wrap ${className}`} aria-labelledby={label && id ? id : undefined} aria-label={label && !id ? label : undefined}>
      {label && id ? (
        <h2 className="label sec-label" id={id}>
          {label}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** One plate across the page. */
export function PlateRow({ media, caption, priority }: { media: ProjectMedia; caption?: string; priority?: boolean }) {
  return (
    <Sec className="sec-plate" label={media.kind === 'video' ? 'Video' : 'Picture'}>
      <Plate media={media} caption={caption} priority={priority} />
    </Sec>
  );
}

/** Two plates side by side. `lean` gives the first one more of the width. */
export function Pair({ a, b, caption, lean = false }: { a: ProjectMedia; b: ProjectMedia; caption?: string; lean?: boolean }) {
  return (
    <Sec className={`sec-pair${lean ? ' sec-pair-lean' : ''}`} label="Pictures">
      <Plate media={a} sizes={HALF_SIZES} />
      <Plate media={b} sizes={HALF_SIZES} />
      {caption ? <p className="label plate-cap pair-cap">{caption}</p> : null}
    </Sec>
  );
}

/** The project's opening paragraph at reading scale, with its facts beside it. */
export function Intro({ p, children }: { p: Project; children?: React.ReactNode }) {
  return (
    <Sec className="intro" label="What it is">
      <p className="sum">{p.summary}</p>
      <div className="intro-side">
        <Facts facts={p.facts} />
        {children}
      </div>
    </Sec>
  );
}

export function Facts({ facts }: { facts: Project['facts'] }) {
  return (
    <dl className="facts">
      {facts.map((f) => (
        <div key={f.label} className="fact">
          <dt className="label">{f.label}</dt>
          <dd className={/^(npm |ollama |cc-switch )/.test(f.value) ? 'mono' : undefined}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A short statement in someone's own words, at scale, with where it is from. */
export function Quote({ text, source, wide = false }: { text: string; source: string; wide?: boolean }) {
  return (
    <figure className={`quote${wide ? ' quote-wide' : ''}`}>
      <blockquote className="quote-text">{text}</blockquote>
      <figcaption className="label">{source}</figcaption>
    </figure>
  );
}

/** How it works. `row`: across the page under large numerals. `list`: one step to a line. */
export function Steps({ p, variant = 'row', label = 'How it works' }: { p: Project; variant?: 'row' | 'list'; label?: string }) {
  return (
    <Sec className={`sec-steps sec-steps-${variant}`} label={label} id="p-how">
      <ol className="steps" style={{ '--n': p.how.length } as React.CSSProperties}>
        {p.how.map((h) => (
          <li key={h.title} className="step">
            <h3 className="step-title">{h.title}</h3>
            <p className="body">{h.body}</p>
          </li>
        ))}
      </ol>
    </Sec>
  );
}

/** Numbers at scale. `value` is text or a live readout. */
export function Figures({ items, label, id }: { items: { value: React.ReactNode; unit: string; key?: string }[]; label: string; id: string }) {
  return (
    <Sec className="sec-figs" label={label} id={id}>
      <ul className="figs" style={{ '--n': items.length } as React.CSSProperties}>
        {items.map((x) => (
          <li key={x.key ?? x.unit} className="fig">
            <span className="fig-value">{x.value}</span>
            <span className="fig-unit">{x.unit}</span>
          </li>
        ))}
      </ul>
    </Sec>
  );
}

export function Outs({ links }: { links: ProjectLink[] }) {
  return (
    <Sec className="sec-outs" label="Links">
      <div className="outs">
        {links.map((l, k) => (
          <a key={l.href} className={k === 0 ? 'btn btn-lg' : 'btn btn-lg btn-quiet'} href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label} <Arrow out />
          </a>
        ))}
      </div>
    </Sec>
  );
}

export function NextProject({ next }: { next: Project }) {
  return (
    <nav className="next wrap" aria-label="Next project">
      <Link className="next-link" href={`/work/${next.slug}`}>
        <span className="label">Next</span>
        <span className="display next-name">
          {next.name} <Arrow />
        </span>
        <span className="next-line">{next.line}</span>
      </Link>
    </nav>
  );
}
