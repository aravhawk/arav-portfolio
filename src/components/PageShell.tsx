import Link from 'next/link';
import { Ending } from '@/components/ending/Ending';
import '@/app/home.css';
import '@/app/pages.css';

interface HeadProps {
  label: React.ReactNode;
  title: string;
  /** A sentence-length title (a post) set smaller than a name. */
  titleLong?: boolean;
  lead?: React.ReactNode;
  back?: { href: string; label: string };
  /** What sits in the head pool: usually nothing, sometimes a slab. */
  children?: React.ReactNode;
}

/**
 * Inner pages share the home page's world: a head pool, a stream down a
 * lane beside the content, and the same ending as a band.
 */
export function PageShell({ head, children, note }: { head: HeadProps; children: React.ReactNode; note?: string }) {
  return (
    <>
      <main id="main" data-scene="page">
        <header className="page-head wrap">
          <div className="page-head-copy">
            {head.back ? (
              <Link className="back label" href={head.back.href}>
                <span aria-hidden="true">&larr;</span> {head.back.label}
              </Link>
            ) : null}
            <p className="label page-label">{head.label}</p>
            <h1 className={`display page-title${head.titleLong ? ' page-title-long' : ''}`}>{head.title}</h1>
            {head.lead ? <p className="lead page-lead">{head.lead}</p> : null}
          </div>
          <div className="page-head-pool" data-bed="head" data-basin>
            {head.children}
          </div>
        </header>
        <div className="page-body wrap">
          <div className="page-main">{children}</div>
          <div className="page-lane" data-bed="feat:pass" aria-hidden="true" />
        </div>
        <div className="delta" data-bed="delta" aria-hidden="true" />
      </main>
      <Ending variant="band" note={note} />
    </>
  );
}
