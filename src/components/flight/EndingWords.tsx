import { Contact } from '@/components/ending/Ending';

export function EndingWords() {
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
    </div>
  );
}
