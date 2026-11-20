import Link from 'next/link';
import { Arrow } from '@/components/inner/bits';
import { PROJECTS, type Project } from '@/content/projects';

/**
 * The few pieces every project page shares. Each page is otherwise its own
 * composition (cases.tsx): these are only the section, the quiet list of
 * facts, the run-in note, and the foot (the ways out and the way round the
 * set). There are no eyebrows here: a section that needs a name gets a
 * heading, and where a thing comes from is said in a sentence under it.
 */

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
        <div key={f.label} className="spec-row">
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

/**
 * The foot of a project's page: the ways out (links, set as links) and the
 * way round the set (the eight projects by name, this one marked). The one
 * after this is offered under it: see nextOf.
 */
export function Ways({ current }: { current: Project }) {
  return (
    <div className="sec wrap ways">
      <ul className="outs" aria-label="Links">
        {current.links.map((l) => (
          <li key={l.href}>
            <a className="tl" href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label} <Arrow out />
            </a>
          </li>
        ))}
      </ul>
      <nav className="strip" aria-label="Projects">
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
                  {p.name}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>
    </div>
  );
}

/** The project after this one, round the set. */
export function nextOf(current: Project): Project {
  return PROJECTS[(PROJECTS.indexOf(current) + 1) % PROJECTS.length];
}
