const SAY_LINES = ['Agents that break', 'software before', 'attackers do.', 'Tools developers', 'run daily.'];

export function Statement({ times, visible = false }: { times: number[]; visible?: boolean }) {
  return (
    <p className="say-text fl-say-text">
      {SAY_LINES.map((line, i) => (
        <span key={line} className="fl-rise" data-at={times[i]} data-in={visible || undefined}>
          <span className="fl-rise-in">{line} </span>
        </span>
      ))}
    </p>
  );
}
