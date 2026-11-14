type Item = { big: string; of: string; what: string; note: string };

/** Three figures set in the display cut, each with what it counts. */
export default function Ledger({ items }: { items: Item[] }) {
  return (
    <dl className="ledger">
      {items.map((it) => (
        <div key={it.what}>
          <dt className="mono">{it.what}</dt>
          <dd>
            <span className="ledger-big">{it.big}</span>
            <span className="ledger-of mono">{it.of}</span>
            <span className="ledger-note">{it.note}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
