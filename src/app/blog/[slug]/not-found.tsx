import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/bits';
import { Footer } from '@/components/ending/Ending';
import { SceneBand } from '@/components/SceneBand';
import '@/app/home.css';
import '@/app/pages.css';

export const metadata: Metadata = { title: 'Post not found' };

export default function PostNotFound() {
  return (
    <div className="pg-ground">
      <main id="main" className="pg" data-scene="page">
        <SceneBand scene="snow" full>
          <p className="label band-label">404</p>
          <h1 className="display band-title">No such post</h1>
          <p className="lead band-lead">That post does not exist, or it is not published.</p>
          <div className="state-actions">
            <Link className="btn" href="/blog">
              All writing <Arrow />
            </Link>
          </div>
        </SceneBand>
      </main>
      <Footer />
    </div>
  );
}
