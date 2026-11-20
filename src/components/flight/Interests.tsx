import Link from 'next/link';
import { Arrow } from '@/components/bits';
import { INTERESTS, RECOGNITION } from '@/content/projects';

type Attributes = { 'data-at': number; 'data-in'?: boolean };
type Timing = { eyebrow: Attributes; title: Attributes; line: Attributes; meta?: Attributes; act: Attributes };

/** An interest inside a sentence: a name keeps its capitals (ML, GPUs), a plain word does not. */
const inline = (x: string) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x);

/**
 * The delta's block: what he is recognised for (lines, never cards), what he
 * is into, and what comes next. `year` is the live count of the year's
 * contributions (already a readout), `read` the day it was read.
 */
export function Interests({ timing: delta, year, read }: { timing: Timing; year?: React.ReactNode; read?: string }) {
  return (
    <>
      <p className="fl-eyebrow" id="into" {...delta.eyebrow}>
        Recognition
      </p>
      <ul className="fl-unit fl-recog" {...delta.title}>
        <li>{RECOGNITION.devday}.</li>
        <li>
          In a{' '}
          <a className="fl-recog-link" href={RECOGNITION.press.href} target="_blank" rel="noopener noreferrer">
            Business Insider story
          </a>
          , May 2026.
        </li>
        {year ? (
          <li>
            {year} GitHub contributions in {RECOGNITION.year}, read {read}.
          </li>
        ) : null}
      </ul>
      <p className="fl-line fl-into-line" {...delta.line}>
        Interests: {INTERESTS.map(inline).join(', ')}.
      </p>
      <p className="fl-line fl-into-next" {...(delta.meta ?? delta.line)}>
        Next: a company, a research paper, and code in tools you open daily.
      </p>
      <Link className="btn fl-into-btn" href="/work" {...delta.act}>
        All work <Arrow />
      </Link>
    </>
  );
}
