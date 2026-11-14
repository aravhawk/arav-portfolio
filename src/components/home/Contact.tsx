import { person } from '@/lib/content';
import { Arrow } from './Arrow';

export default function Contact() {
  return (
    <section className="contact" id="contact" data-chapter="contact" data-ground="#ffd60a" aria-labelledby="contact-title">
      <div className="pin front contact-pin">
        <div className="contact-top">
          <h2 id="contact-title" className="label mono">
            Contact
          </h2>
          <span className="mono">One closed loop</span>
        </div>
        <div className="contact-bottom">
          <p className="contact-lead">Building with agents, or breaking them? Write to me.</p>
          <a className="contact-mail" href={`mailto:${person.email}`} data-cursor="Write">
            {person.email}
          </a>
          <div className="contact-foot">
            <ul className="contact-links mono">
              {person.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer">
                    <span className="link">{l.label}</span> <Arrow out />
                  </a>
                </li>
              ))}
            </ul>
            <span className="mono">© 2026 Arav Jain</span>
          </div>
        </div>
      </div>
    </section>
  );
}
