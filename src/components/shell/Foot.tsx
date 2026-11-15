import { person } from '@/lib/facts';

export default function Foot() {
  return (
    <footer className="foot">
      <p className="head"><span className="ln"><span className="thin">It&apos;s still</span><span className="black">early.</span></span></p>
      <ul className="contact black">
        {person.links.map((l) => <li key={l.href}><a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></li>)}
        <li><a href={`mailto:${person.email}`}>Email</a></li>
      </ul>
    </footer>
  );
}
