import type { Project } from '@/lib/content';
import { Arrow } from './Arrow';

export default function ProjectRows({ items, detail = false }: { items: Project[]; detail?: boolean }) {
  return (
    <ol className="rows">
      {items.map((p, i) => (
        <li className="row" key={p.slug} data-cursor={p.links[0] ? 'Open' : undefined}>
          <span className="row-n mono" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <h3 className="row-name">
            {p.links[0] ? (
              <a href={p.links[0].href} target="_blank" rel="noopener noreferrer">
                {p.name}
              </a>
            ) : (
              p.name
            )}
          </h3>
          <div className="row-body">
            <p className="row-line">{p.line}</p>
            {detail ? <p className="row-detail">{p.detail}</p> : null}
            {detail && p.links.length ? (
              <div className="row-links mono">
                {p.links.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                    <span className="link">{l.label}</span> <Arrow out />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="row-side row-meta mono">
            <span>{p.kind}</span>
            <span>{p.stack}</span>
            <span>
              {[p.year, p.archived ? 'Archived' : ''].filter(Boolean).join(' / ') || 'Private'}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
