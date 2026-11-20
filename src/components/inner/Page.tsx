import Link from 'next/link';
import { CONTACT } from '@/content/projects';
import { Arrow } from './bits';
import { CopyEmail } from './CopyEmail';
import { type Still, stillSet } from './stills';
import '@/app/inner.css';

export interface Head {
  /** The way back to where the page belongs. */
  back?: { href: string; label: string };
  /** A small line over the title: a number, a date, a status. */
  label?: React.ReactNode;
  title: string;
  /** A sentence-length title (a post) is set a step smaller than a name. */
  long?: boolean;
  lead?: React.ReactNode;
  /** A small line under the lead. */
  meta?: React.ReactNode;
  /** The header picture, where the page has one. */
  still?: Still;
  /** A control that belongs to the head of the page. */
  children?: React.ReactNode;
}

export interface Way {
  href: string;
  /** The small word over the name: "Next", or the part of the site it opens. */
  label: string;
  title: string;
  line: string;
  aria: string;
}

/** The two ways on that are not a project. */
export const WAY_TO_WRITING: Way = {
  href: '/blog',
  label: 'Writing',
  title: 'Notes from the work',
  line: 'What I learn building agents and the tools around them.',
  aria: 'Writing',
};
export const WAY_TO_WORK: Way = {
  href: '/work',
  label: 'Work',
  title: 'Everything I have built',
  line: 'Eight things I would point you to first, then the rest, one line each.',
  aria: 'Work',
};

const STILL_SIZES = '(max-width: 1328px) 92vw, 1216px';
/** Where a project's page opens on its scene's tall frame (the same width in inner.css). */
const PHONE = '(max-width: 640px)';

/** The head of a page: the way back, a label, the title, one line, and its picture if it has one. */
export function PageHead({ head }: { head: Head }) {
  const s = head.still;
  return (
    <header className={`head wrap${s ? ' head-pic' : ''}`}>
      {head.back ? (
        <Link className="back" href={head.back.href}>
          <span aria-hidden="true">&larr;</span> {head.back.label}
        </Link>
      ) : null}
      {head.label ? <p className="label head-label">{head.label}</p> : null}
      <h1 className={`head-title${head.long ? ' head-title-long' : ''}`}>{head.title}</h1>
      {head.lead ? <p className="head-lead">{head.lead}</p> : null}
      {head.meta ? <div className="head-meta">{head.meta}</div> : null}
      {head.children}
      {s ? (
        <div className="head-still">
          {/* The day on the light theme, the night on the dark. The theme is the system's unless the reader has
              switched it, so the picture that is fetched ahead is the system's; the other is fetched only by a
              reader whose theme differs from their system (see .still-* in inner.css). On a phone it is the
              scene's tall frame, behind the whole first screen. */}
          <picture className="still-sys">
            <source media={`${PHONE} and (prefers-color-scheme: dark)`} srcSet={s.tallNight} />
            <source media={PHONE} srcSet={s.tallDay} />
            <source media="(prefers-color-scheme: dark)" srcSet={stillSet(s.night, s.w)} sizes={STILL_SIZES} />
            <img src={s.day} srcSet={stillSet(s.day, s.w)} sizes={STILL_SIZES} width={s.w} height={s.h} alt={s.alt} fetchPriority="high" decoding="sync" />
          </picture>
          <picture className="still-alt still-alt-day">
            <source media={PHONE} srcSet={s.tallDay} />
            <img src={s.day} srcSet={stillSet(s.day, s.w)} sizes={STILL_SIZES} width={s.w} height={s.h} alt={s.alt} loading="lazy" decoding="async" />
          </picture>
          <picture className="still-alt still-alt-night">
            <source media={PHONE} srcSet={s.tallNight} />
            <img src={s.night} srcSet={stillSet(s.night, s.w)} sizes={STILL_SIZES} width={s.w} height={s.h} alt={s.alt} loading="lazy" decoding="async" />
          </picture>
        </div>
      ) : null}
    </header>
  );
}

/** The way on from a page: one link, set as a line of the index it leads to. */
export function WayOn({ way }: { way: Way }) {
  return (
    <nav className="way-on wrap" aria-label={way.aria}>
      <Link className="way-link" href={way.href}>
        <span className="label way-label">
          {way.label} <Arrow />
        </span>
        <span className="way-title">{way.title}</span>
        <span className="way-line">{way.line}</span>
      </Link>
    </nav>
  );
}

/** Every inner page ends on one row: his name and when the numbers were read, the ways to reach him, the ways round the site. */
export function Footer({ note }: { note?: string }) {
  return (
    <footer className="in-foot wrap" aria-label="Contact">
      <div className="in-foot-brand">
        <Link className="in-foot-mark" href="/" prefetch={false} aria-label="Arav Jain, home">
          Arav Jain
        </Link>
        {note ? <p className="in-foot-note">{note}</p> : null}
      </div>
      <ul className="in-foot-links">
        <li className="in-foot-email">
          <a className="tl" href={`mailto:${CONTACT.email}`}>
            Email
          </a>
          <CopyEmail email={CONTACT.email} />
        </li>
        <li>
          <a className="tl" href={CONTACT.github} target="_blank" rel="noopener noreferrer">
            GitHub <Arrow out />
          </a>
        </li>
        <li>
          <a className="tl" href={CONTACT.x} target="_blank" rel="noopener noreferrer">
            X <Arrow out />
          </a>
        </li>
        <li>
          <a className="tl" href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn <Arrow out />
          </a>
        </li>
      </ul>
      <nav className="in-foot-site label" aria-label="Site">
        <Link href="/work">Work</Link>
        <Link href="/blog">Writing</Link>
        <a href="/feed.xml">RSS</a>
      </nav>
    </footer>
  );
}

/**
 * An inner page: its head, its content on one grid, the way on, the footer.
 * No scene, no runtime: the page is its words and its pictures.
 */
export function InnerPage({ head, children, note, next, bare }: { head: Head; children?: React.ReactNode; note?: string; next?: Way; /** A page that is its head alone (not found, an error). */ bare?: boolean }) {
  return (
    <div className={`in${bare ? ' in-bare' : ''}`}>
      <main id="main" className="in-main">
        <PageHead head={head} />
        {children}
        {next ? <WayOn way={next} /> : null}
      </main>
      <Footer note={note} />
    </div>
  );
}
