import Link from 'next/link';
import { ViewTransition } from 'react';
import { Footer } from '@/components/ending/Ending';
import '@/app/home.css';
import '@/app/pages.css';

interface HeadProps {
  label: React.ReactNode;
  title: string;
  /** Shared-element name: the title travels from the link that opened it. */
  vt?: string;
  /** A sentence-length title (a post) set smaller than a name. */
  titleLong?: boolean;
  lead?: React.ReactNode;
  back?: { href: string; label: string };
  /** What sits in the head pool: usually nothing, sometimes a slab. */
  children?: React.ReactNode;
}

/**
 * Inner pages share the home page's world: the stream runs in from the top
 * (through a pool, where the page has media to stand in one), down a lane
 * beside the content, and off the bottom past a plain footer.
 */
export function PageShell({ head, children, note, feature }: { head: HeadProps; children: React.ReactNode; note?: string; feature?: React.ReactNode }) {
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
            {head.vt ? (
              <ViewTransition name={head.vt} share="title" default="none">
                <h1 className={`display page-title${head.titleLong ? ' page-title-long' : ''}`}>{head.title}</h1>
              </ViewTransition>
            ) : (
              <h1 className={`display page-title${head.titleLong ? ' page-title-long' : ''}`}>{head.title}</h1>
            )}
            {head.lead ? <p className="lead page-lead">{head.lead}</p> : null}
          </div>
          {head.children ? (
            <div className="page-head-pool" data-bed="head" data-basin>
              {head.children}
            </div>
          ) : (
            <div className="page-head-spring" data-bed="spring" aria-hidden="true" />
          )}
        </header>
        {/* A project's own bed gets a row to itself, so the stream can cross
            to it and back to the lane without passing through copy. */}
        {feature ? <div className="page-feature wrap">{feature}</div> : null}
        <div className="page-body wrap">
          <div className="page-main">{children}</div>
          <div className="page-lane" data-bed="feat:pass" aria-hidden="true" />
        </div>
      </main>
      <Footer note={note} />
    </>
  );
}
