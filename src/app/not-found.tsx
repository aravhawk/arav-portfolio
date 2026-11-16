import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow } from '@/components/bits';
import './home.css';
import './pages.css';

export const metadata: Metadata = { title: 'Not found' };

/** 404: the stream runs past, not to, this address. Two ways back. */
export default function NotFound() {
  return (
    <main id="main" data-scene="page" className="state wrap">
      <p className="label">404</p>
      <h1 className="display">Dry land</h1>
      <p className="lead">Nothing flows to this address. It may have moved, or it never existed.</p>
      <div className="state-actions">
        <Link className="btn" href="/">
          Go home <Arrow />
        </Link>
        <Link className="btn btn-quiet" href="/work">
          See the work <Arrow />
        </Link>
      </div>
      <div className="state-lane" data-bed="spring" aria-hidden="true" />
    </main>
  );
}
