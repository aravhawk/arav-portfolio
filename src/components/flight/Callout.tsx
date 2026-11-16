/**
 * A caption tied to a point in the flight's world: a mono label, a thin
 * leader line and a ring at the point. The flight projects the point through
 * its camera every frame and places the three parts (transform and opacity
 * only). Without the canvas it is a plain label in the page's flow.
 */
export function Callout({
  at,
  href,
  label,
  from,
  to,
  lift = 56,
  side = 1,
  children,
}: {
  /** the point in the world: x, y, z */
  at: [number, number, number];
  href?: string;
  /** what assistive tech reads, when the visible text is not enough */
  label?: string;
  /** the stretch of scroll, in screens, over which it shows */
  from: number;
  to: number;
  /** how far above its point the label sits, px */
  lift?: number;
  /** 1: the label runs to the right of its point, -1: to the left */
  side?: 1 | -1;
  children: React.ReactNode;
}) {
  const text = href ? (
    <a className="fl-call-label mono" href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
      {children}
    </a>
  ) : (
    <span className="fl-call-label mono">{children}</span>
  );
  return (
    <div className="fl-call" data-call={at.join(',')} data-call-from={from} data-call-to={to} data-call-lift={lift} data-call-side={side}>
      <span className="fl-call-ring" aria-hidden="true" />
      <span className="fl-call-line" aria-hidden="true" />
      {text}
    </div>
  );
}
