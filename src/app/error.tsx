'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Footer } from '@/components/ending/Ending';
import { SceneBand } from '@/components/SceneBand';
import { haptic } from '@/lib/haptics';
import './home.css';
import './pages.css';

/** A real error: say what happened and what to do next. It stands on the same snowfield as the 404. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    haptic('error');
  }, [error]);
  return (
    <div className="pg-ground">
      <main id="main" className="pg" data-scene="page">
        <SceneBand scene="snow" full>
          <p className="label band-label">Error</p>
          <h1 className="display band-title">That did not load</h1>
          <p className="lead band-lead">Something failed while building this page. Trying again usually fixes it.</p>
          <div className="state-actions">
            <button type="button" className="btn" onClick={() => reset()}>
              Try again
            </button>
            <Link className="btn btn-quiet" href="/">
              Go home
            </Link>
          </div>
        </SceneBand>
      </main>
      <Footer />
    </div>
  );
}
