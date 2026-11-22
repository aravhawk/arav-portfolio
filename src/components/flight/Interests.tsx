import Link from 'next/link';
import { Arrow } from '@/components/bits';
import { RECOGNITION } from '@/content/projects';

type Attributes = { 'data-at': number; 'data-in'?: boolean };
type Timing = { eyebrow: Attributes; title: Attributes; line: Attributes; meta?: Attributes; act: Attributes };

/**
 * The delta's block: what he is recognised for (lines, never cards) and what
 * comes next. (The sentence of interests was cut at the owner's word, 22
 * November 2026: it comes back only as a designed piece, never as a list.) `year` is the live count of the year's
 * contributions (already a readout). When it was read is not said here: that
 * is said once, in the small line at the ending's foot.
 */
export function Interests({ timing: delta, year, recogUntil }: { timing: Timing; year?: React.ReactNode; /** Where, in screens, the label and the recognition lines leave, when that is before the block does. */ recogUntil?: number }) {
  const until = recogUntil == null ? {} : { 'data-fl-until': recogUntil };
  return (
    <>
      <p className="fl-eyebrow" id="into" {...delta.eyebrow} {...until}>
        Recognition
      </p>
      <ul className="fl-unit fl-recog" {...delta.title} {...until}>
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
            {year} GitHub contributions in {RECOGNITION.year}.
          </li>
        ) : null}
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
