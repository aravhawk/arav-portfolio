import type { Metadata } from 'next';
import { Link } from '@/components/Link';
import { Arrow } from '@/components/bits';
import { Footer } from '@/components/ending/Ending';
import { SceneBand } from '@/components/SceneBand';
import './home.css';
import './pages.css';

export const metadata: Metadata = { title: 'Not found' };

/** 404: the snowfield, with no water in sight. Two ways back. */
export default function NotFound() {
  return (
    <div className="pg-ground">
      <main id="main" className="pg" data-scene="page">
        {/* The snowfield is this band's ground, set from CSS (`band-ground`), not a picture in the HTML: this page is
            carried in the data of every page on the site (it is the root's not-found), and its picture's four lists
            of addresses were half a kilobyte of each of them. Nobody waits on a 404's largest paint. */}
        <SceneBand scene="snow" full still={null}>
          <p className="label band-label">404</p>
          <h1 className="display band-title">Dry land</h1>
          <p className="lead band-lead">Nothing flows to this address. It may have moved, or it never existed.</p>
          <div className="state-actions">
            <Link className="way" href="/">
              Go home <Arrow />
            </Link>
            <Link className="way" href="/work">
              See the work <Arrow />
            </Link>
          </div>
        </SceneBand>
      </main>
      <Footer />
    </div>
  );
}
