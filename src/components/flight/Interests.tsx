import Link from 'next/link';
import { Arrow } from '@/components/bits';
import { INTERESTS } from '@/content/projects';

type Attributes = { 'data-at': number; 'data-in'?: boolean };
type Timing = { eyebrow: Attributes; title: Attributes; line: Attributes; act: Attributes };

export function Interests({ timing: delta }: { timing: Timing }) {
  return (
    <>
      <p className="fl-eyebrow" id="into" {...delta.eyebrow}>
        Interests
      </p>
      <ul className="into-list title fl-into-list" {...delta.title}>
        {INTERESTS.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <p className="fl-line fl-into-next" {...delta.line}>
        Next: a company, a research paper, and code in tools you open daily.
      </p>
      <Link className="btn fl-into-btn" href="/work" {...delta.act}>
        All work <Arrow />
      </Link>
    </>
  );
}
