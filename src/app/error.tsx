'use client';

import Link from 'next/link';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="lost">
      <div className="layer-ui" style={{ display: 'grid', gap: 24 }}>
        <span className="kicker mono">Error</span>
        <h1 className="article-title">Something failed to load.</h1>
        <p>The page hit an error while rendering. Trying again usually fixes it.</p>
        <div className="lost-actions">
          <button type="button" className="btn btn--solid" onClick={reset}>
            Try again
          </button>
          <Link className="btn" href="/">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
