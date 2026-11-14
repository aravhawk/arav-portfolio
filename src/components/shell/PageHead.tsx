/** Yellow page head for inner pages. The band from the home page hangs in it, posed differently per page. */
export default function PageHead({ title, lead, meta, pose }: { title: string; lead: string; meta: string; pose: 'work' | 'blog' }) {
  return (
    <header className="head wrap g-yellow" data-chapter={`head-${pose}`} data-ground="#ffd60a">
      <h1 className="head-title behind">{title}</h1>
      <div className="head-row front">
        <p className="head-lead">{lead}</p>
        <span className="mono">{meta}</span>
      </div>
    </header>
  );
}
