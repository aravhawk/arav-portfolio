'use client';

import Link from 'next/link';
import { Arrow } from '@/components/inner/bits';
import { InnerPage } from '@/components/inner/Page';

/** A real error: say what happened and what to do next. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <InnerPage
      bare
      head={{
        label: 'Error',
        title: 'That did not load',
        lead: 'Something failed while building this page. Trying again usually fixes it.',
        children: (
          <div className="ways-out">
            <button type="button" className="tl" onClick={() => reset()}>
              Try again
            </button>
            <Link className="tl" href="/" prefetch={false}>
              Go home <Arrow />
            </Link>
          </div>
        ),
      }}
    />
  );
}
