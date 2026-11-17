import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/bits';
import { Footer } from '@/components/ending/Ending';
import { SceneBand } from '@/components/SceneBand';
import './home.css';
import './pages.css';

export const metadata: Metadata = { title: 'Not found' };

/** 404: the snowfield, with no water in sight. Two ways back. */
export default function NotFound() {
  return (
    <div className="pg-ground">
      <main id="main" className="pg" data-scene="page">
        <SceneBand scene="snow" full>
          <p className="label band-label">404</p>
          <h1 className="display band-title">Dry land</h1>
          <p className="lead band-lead">Nothing flows to this address. It may have moved, or it never existed.</p>
          <div className="state-actions">
            <Link className="btn" href="/">
              Go home <Arrow />
            </Link>
            <Link className="btn btn-quiet" href="/work">
              See the work <Arrow />
            </Link>
          </div>
        </SceneBand>
      </main>
      <Footer />
    </div>
  );
}
