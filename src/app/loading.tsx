import './home.css';
import './pages.css';

/** Route loading: the shape of a scene with its words in the corner, on the page's own ground, so nothing jumps when it lands. */
export default function Loading() {
  return (
    <div className="pg-ground">
      <main id="main" className="pg" aria-busy="true" aria-label="Loading">
        <div className="band">
          <div className="band-words wrap">
            <span className="skeleton" style={{ width: '7rem', height: '0.8rem' }} />
            <span className="skeleton" style={{ width: 'min(30rem, 80%)', height: 'clamp(2.9rem, 6.6vw, 7.5rem)' }} />
            <span className="skeleton" style={{ width: 'min(22rem, 70%)', height: '1.2rem' }} />
          </div>
        </div>
      </main>
    </div>
  );
}
