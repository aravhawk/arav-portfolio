import './home.css';
import './pages.css';

/** Route loading: the shape of a page head, so nothing jumps when it lands. */
export default function Loading() {
  return (
    <main id="main" className="page-head wrap" aria-busy="true" aria-label="Loading">
      <div className="page-head-copy">
        <span className="skeleton" style={{ width: '7rem', height: '0.8rem' }} />
        <span className="skeleton" style={{ width: 'min(30rem, 80%)', height: 'clamp(2.9rem, 6.6vw, 7.5rem)' }} />
        <span className="skeleton" style={{ width: 'min(26rem, 70%)', height: '1.2rem' }} />
      </div>
    </main>
  );
}
