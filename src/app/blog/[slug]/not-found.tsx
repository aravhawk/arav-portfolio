import Link from 'next/link';
import SceneSetter from '@/components/SceneSetter';
import GroundInit from '@/components/GroundInit';
import { ArrowRight } from '@/components/Icons';

export default function PostNotFound() {
  return (
    <>
      <GroundInit ground="ink" />
      <SceneSetter name="lost" />
      <div className="lost">
        <div className="layer-ui" style={{ display: 'grid', gap: 24 }}>
          <span className="kicker mono">404</span>
          <h1 className="article-title">That post does not exist.</h1>
          <p>It may have been renamed or unpublished.</p>
          <div className="lost-actions">
            <Link className="btn btn--solid" href="/blog" data-magnet>
              All posts
              <ArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
