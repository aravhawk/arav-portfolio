import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/bits';
import '@/app/home.css';
import '@/app/pages.css';

export const metadata: Metadata = { title: 'Post not found' };

export default function PostNotFound() {
  return (
    <main id="main" data-scene="page" className="state wrap">
      <p className="label">404</p>
      <h1 className="display">No such post</h1>
      <p className="lead">That post does not exist, or it is not published.</p>
      <div className="state-actions">
        <Link className="btn" href="/blog">
          All writing <Arrow />
        </Link>
      </div>
      <div className="state-lane" data-bed="spring" aria-hidden="true" />
    </main>
  );
}
