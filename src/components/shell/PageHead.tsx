/** Yellow page head for inner pages. The band from the home page hangs in it. */
export default function PageHead({ title, lead, meta }: { title: string; lead: string; meta: string }) {
  return (
    <header className="head wrap" data-chapter="head" data-ground="#ffd60a">
      <h1 className="head-title behind">{title}</h1>
      <div className="head-row front">
        <p className="head-lead">{lead}</p>
        <span className="mono">{meta}</span>
      </div>
    </header>
  );
}
