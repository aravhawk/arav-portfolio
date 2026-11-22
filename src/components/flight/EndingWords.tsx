import { Contact, SubscribeForm } from '@/components/ending/Ending';

/**
 * The ending's words: the headline, the line under it, and the foot. The foot is one block at one width: the ways
 * to reach him, the newsletter's field under them from the row's first letter to its last, and one line of small
 * print in the margin under both (when the numbers were read, and the feed).
 *
 * `note`: when the page's numbers were read, e.g. "Numbers read Nov 15, 2026, 4:40 AM CT". The one place the home
 * page says it.
 */
export function EndingWords({ note }: { note?: string }) {
  return (
    <div className="fl-end-block">
      <h2 className="ending-head">
        <span className="ending-line">This was the warm-up.</span>
      </h2>
      <p className="label ending-kicker">The next station isn&apos;t built yet.</p>
      <div className="fl-end-foot">
        <div className="fl-end-row">
          <Contact />
        </div>
        {/* New posts by email. (One visible word, the button's: the page's count holds.) */}
        <div className="fl-end-sub">
          <SubscribeForm source="home" compact />
        </div>
        {/* The small print hangs under the block, clear of it: nothing over it moves to make room. The feed stands at
            its right end, under the button: the other way to follow the writing. */}
        <div className="fl-end-print">
          {note ? <p className="fl-end-note">{note}</p> : <span />}
          <a className="end-link end-feed" href="/feed.xml">
            RSS
          </a>
        </div>
      </div>
    </div>
  );
}
