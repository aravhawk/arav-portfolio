import TLink from './TLink';
import { Arrow } from '@/components/home/Arrow';

type Props = { title: string; lead: string; href: string; action: string; onRetry?: () => void };

export default function Missing({ title, lead, href, action, onRetry }: Props) {
  return (
    <main>
      <section className="head wrap" data-chapter="head" data-ground="#ffd60a" style={{ minHeight: '100svh' }}>
        <h1 className="head-title behind">{title}</h1>
        <div className="head-row front">
          <p className="head-lead">{lead}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {onRetry ? (
              <button type="button" className="btn" onClick={onRetry}>
                Try again
              </button>
            ) : null}
            <TLink className="btn" href={href}>
              {action} <Arrow />
            </TLink>
          </div>
        </div>
      </section>
    </main>
  );
}
