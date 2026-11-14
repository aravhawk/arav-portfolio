import { person } from '@/lib/content';
import { Arrow } from '@/components/home/Arrow';

/** Closing band for inner pages. The home page ends on its own contact chapter instead. */
export default function Footer() {
  return (
    <footer className="footer" data-chapter="sheet" data-ground="#0a0a0a" data-sheet>
      <div className="wrap">
        <p className="label mono" data-live>
          Contact
        </p>
        <a className="footer-mail" href={`mailto:${person.email}`} data-cursor="Write">
          {person.email}
        </a>
        <div className="footer-foot mono">
          <ul className="contact-links">
            {person.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  <span className="link">{l.label}</span> <Arrow out />
                </a>
              </li>
            ))}
            <li>
              <a href="/feed.xml">
                <span className="link">RSS</span>
              </a>
            </li>
          </ul>
          <span>© 2026 Arav Jain</span>
        </div>
      </div>
    </footer>
  );
}
