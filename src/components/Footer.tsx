import { contact } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="foot">
      <span>© 2026 Arav Jain</span>
      <ul>
        <li>
          <a href={contact.github} target="_blank" rel="noopener noreferrer">GitHub</a>
        </li>
        <li>
          <a href={contact.x} target="_blank" rel="noopener noreferrer">X</a>
        </li>
        <li>
          <a href={contact.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </li>
        <li>
          <a href={`mailto:${contact.email}`}>Email</a>
        </li>
        <li>
          <a href="/feed.xml">RSS</a>
        </li>
      </ul>
    </footer>
  );
}
