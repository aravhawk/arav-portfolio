import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/inner/bits';
import { InnerPage } from '@/components/inner/Page';

export const metadata: Metadata = { title: 'Not found' };

/** 404: one line and two ways out. */
export default function NotFound() {
  return (
    <InnerPage
      bare
      head={{
        label: '404',
        title: 'Dry land',
        lead: 'Nothing flows to this address. It may have moved, or it never existed.',
        children: (
          <div className="ways-out">
            <Link className="tl" href="/" prefetch={false}>
              Go home <Arrow />
            </Link>
            <Link className="tl" href="/work">
              See the work <Arrow />
            </Link>
          </div>
        ),
      }}
    />
  );
}
