import { earlier, projects, recognition } from '@/lib/content';
import Ledger from './Ledger';
import TLink from '@/components/shell/TLink';
import ProjectRows from './ProjectRows';
import { Arrow } from './Arrow';

export default function Work() {
  const featured = projects.filter((p) => p.featured);
  return (
    <section className="block g-paper" data-chapter="work" data-ground="#f2f2f2" aria-labelledby="work-title">
      <div className="wrap">
        <div className="block-head">
          <h2 id="work-title" className="block-title behind">
            Selected work
          </h2>
        </div>
        <div className="block-sheet">
          <p className="block-lead">Six things I built this year. All of them are open source, and most of them exist because an agent needed a guardrail.</p>
          <Ledger items={recognition} />
          <ProjectRows items={featured} />
          <div className="block-foot">
            <span className="mono">{projects.length + earlier.length} projects in the full index</span>
            <TLink className="btn" href="/work">
              See all work <Arrow />
            </TLink>
          </div>
        </div>
      </div>
    </section>
  );
}
