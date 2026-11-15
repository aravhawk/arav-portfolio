'use client';

import { TLink } from '@/components/shell/Shell';

export default function BlogPostError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="lost enter">
      <p className="mono" style={{ color: 'var(--steel)' }}>Error</p>
      <h1 className="head" data-size="lg"><span className="ln"><span className="thin">That post</span><span className="black">broke.</span></span></h1>
      <p className="line">It failed to load. Try once more.</p>
      <p className="more mono"><button className="go mono" onClick={reset}>Try again</button><TLink className="go mono" href="/blog">Writing</TLink></p>
    </main>
  );
}
