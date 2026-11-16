'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { haptic } from '@/lib/haptics';
import './home.css';
import './pages.css';

/** A real error: say what happened and what to do next. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    haptic('error');
  }, [error]);
  return (
    <main id="main" className="state wrap">
      <p className="label">Error</p>
      <h1 className="display">That did not load</h1>
      <p className="lead">Something failed while building this page. Trying again usually fixes it.</p>
      <div className="state-actions">
        <button type="button" className="btn" onClick={() => reset()}>
          Try again
        </button>
        <Link className="btn btn-quiet" href="/">
          Go home
        </Link>
      </div>
    </main>
  );
}
