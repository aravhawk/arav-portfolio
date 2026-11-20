const SAY_LINES = ['Agents that break', 'software before', 'attackers do.', 'Tools developers', 'run daily.'];

/** Why those two, said once the sentence has set: `why` is its place in the scroll. */
export const SAY_WHY = 'The tools began as fixes to the ones I use.';

export function Statement({ times, why, visible = false }: { times: number[]; why?: number; visible?: boolean }) {
  return (
    <div className="fl-say-block">
      <p className="say-text fl-say-text">
        {SAY_LINES.map((line, i) => (
          <span key={line} className="fl-rise" data-at={times[i]} data-in={visible || undefined}>
            <span className="fl-rise-in">{line} </span>
          </span>
        ))}
      </p>
      {why === undefined ? null : (
        <p className="fl-line fl-say-why" data-at={why} data-in={visible || undefined}>
          {SAY_WHY}
        </p>
      )}
    </div>
  );
}
