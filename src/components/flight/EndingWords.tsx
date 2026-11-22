import { Contact } from '@/components/ending/Ending';

/** `note`: when the page's numbers were read, e.g. "Numbers read Nov 15, 2026, 4:40 AM CT". The one place the home page says it. */
export function EndingWords({ note }: { note?: string }) {
  return (
    <div className="fl-end-block">
      <h2 className="ending-head">
        <span className="ending-line">This was the warm-up.</span>
      </h2>
      <p className="label ending-kicker">The next station isn&apos;t built yet.</p>
      {/* One row: the ways to reach him, the feed among them. (The haptics switch is a setting: it stands by the sound control, in the nav.) */}
      <div className="fl-end-row">
        <Contact feed />
      </div>
      {/* The foot's small print, under the block and clear of it: nothing over it moves to make room. */}
      {note ? <p className="fl-end-note">{note}</p> : null}
    </div>
  );
}
