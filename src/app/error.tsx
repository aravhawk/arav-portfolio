'use client';

import { Link } from '@/components/Link';
import { useEffect } from 'react';
import { Arrow } from '@/components/bits';
import { Footer } from '@/components/ending/Ending';
import { SceneBand } from '@/components/SceneBand';
import { BandStill } from '@/components/work/still-pictures';
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
        <SceneBand scene="snow" full still={<BandStill scene="snow" kind="full" />}>
          <p className="label band-label">Error</p>
          <h1 className="display band-title">That did not load</h1>
          <p className="lead band-lead">Something failed while building this page. Trying again usually fixes it.</p>
          <div className="state-actions">
            <button type="button" className="btn" onClick={() => reset()}>
              Try again
            </button>
            <Link className="way" href="/">
              Go home <Arrow />
            </Link>
          </div>
        </SceneBand>
      </main>
      <Footer />
    </div>
  );
}
