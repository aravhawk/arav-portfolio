import Link from 'next/link';
import { ViewTransition } from 'react';
import { Footer } from '@/components/ending/Ending';
import { SceneBand } from '@/components/SceneBand';
import { stationData } from '@/components/work/stations';
import { getMetrics } from '@/lib/metrics';
import type { SceneId } from '@/water/scene-band';
import '@/app/home.css';
import '@/app/pages.css';

interface HeadProps {
  /** A small line above the title: where the page belongs, or when it was written. */
  label?: React.ReactNode;
  title: string;
  /** Shared-element name: the title travels from the link that opened it. */
  vt?: string;
  /** A sentence-length title (a post) set smaller than a name. */
  titleLong?: boolean;
  lead?: React.ReactNode;
  back?: { href: string; label: string };
  /** A control that belongs to the scene (the switch on the cc-switch page). */
  children?: React.ReactNode;
}

/** The words that stand in a scene: the way back, the label, the title, one line. */
export function BandWords({ head }: { head: HeadProps }) {
  const title = <h1 className={`display band-title${head.titleLong ? ' band-title-long' : ''}`}>{head.title}</h1>;
  return (
    <>
      {head.back ? (
        <Link className="back label" href={head.back.href}>
          <span aria-hidden="true">&larr;</span> {head.back.label}
        </Link>
      ) : null}
      {head.label ? <p className="label band-label">{head.label}</p> : null}
      {head.vt ? (
        <ViewTransition name={head.vt} share="title" default="none">
          {title}
        </ViewTransition>
      ) : (
        title
      )}
      {head.lead ? <p className="lead band-lead">{head.lead}</p> : null}
      {head.children}
    </>
  );
}

/**
 * Inner pages share the home page's world. Each opens on a live frame of it
 * (the page's own station, the delta, the lake, the snowfield) with its
 * title standing in the frame; the content follows on the snow the frame
 * ends in, and the footer closes it.
 */
export async function PageShell({
  scene,
  short,
  index,
  head,
  children,
  note,
}: {
  scene: SceneId;
  /** A shorter scene: a post is for reading. */
  short?: boolean;
  /** An index: the scene is a little lower and the list begins in the first screen. */
  index?: boolean;
  head: HeadProps;
  children: React.ReactNode;
  note?: string;
}) {
  const m = await getMetrics();
  return (
    <div className="pg-ground">
      <main id="main" className="pg" data-scene="page">
        <SceneBand scene={scene} short={short} index={index} {...stationData(m)}>
          <BandWords head={head} />
        </SceneBand>
        <div className={`pg-body${index ? ' pg-index' : ''}`}>{children}</div>
      </main>
      <Footer note={note} />
    </div>
  );
}
