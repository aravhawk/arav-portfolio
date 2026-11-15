import Link from 'next/link';
import type { Metadata } from 'next';
import SceneSetter from '@/components/SceneSetter';
import GroundInit from '@/components/GroundInit';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <>
      <GroundInit ground="ink" />
      <SceneSetter name="lost" />
      <div className="lost">
        <div className="layer-type" aria-hidden="true">
          <div className="word">
            <span className="line">
              <span data-refract>404</span>
            </span>
          </div>
        </div>
        <div className="layer-ui" style={{ display: 'grid', gap: 24 }}>
          <h1 className="sr-only">Page not found</h1>
          <p>This page broke before anyone could attack it. Nothing lives at this address.</p>
          <div className="lost-actions">
            <Link className="btn btn--solid" href="/" data-magnet>
              Back home
              <ArrowRight />
            </Link>
            <Link className="btn" href="/work" data-magnet>
              See the work
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
