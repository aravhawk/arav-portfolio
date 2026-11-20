import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/inner/bits';
import { InnerPage } from '@/components/inner/Page';

export const metadata: Metadata = { title: 'Post not found' };

export default function PostNotFound() {
  return (
    <InnerPage
      bare
      head={{
        label: '404',
        title: 'No such post',
        lead: 'That post does not exist, or it is not published.',
        children: (
          <div className="ways-out">
            <Link className="tl" href="/blog">
              All writing <Arrow />
            </Link>
          </div>
        ),
      }}
    />
  );
}
