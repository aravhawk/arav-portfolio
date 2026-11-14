import type { Metadata } from 'next';
import { contributions, projects } from '@/lib/content';
import PageHead from '@/components/shell/PageHead';
import Footer from '@/components/shell/Footer';
import ProjectRows from '@/components/home/ProjectRows';
import { Arrow } from '@/components/home/Arrow';

const description = 'Open source projects by Arav Jain: agent tooling, dev tools, a GPU blockchain, an iPhone app, and pull requests to T3 Code.';

export const metadata: Metadata = {
  title: 'Work. Arav Jain',
  description,
  alternates: { canonical: '/work' },
  openGraph: { title: 'Work. Arav Jain', description, type: 'website', url: 'https://aravjain.dev/work' },
};

export default function WorkPage() {
  return (
    <main>
      <PageHead pose="work" title="Work" lead="Everything here is public. Read the source, run it, tell me where it breaks." meta={`${projects.length} projects / 2025 to 2026`} />
      <div className="sheet" data-chapter="sheet" data-ground="#f2f2f2" data-sheet>
        <section className="block wrap" aria-labelledby="index-title">
          <div className="block-head">
            <h2 id="index-title" className="block-title">
              Index
            </h2>
          </div>
          <p className="block-lead">Agent tooling first, then the things I built because I wanted them to exist.</p>
          <ProjectRows items={projects} detail />
        </section>
        <section className="block wrap" aria-labelledby="pr-title" style={{ paddingTop: 0 }}>
          <div className="block-head">
            <h2 id="pr-title" className="block-title">
              Upstream
            </h2>
          </div>
          <p className="block-lead">{contributions.line}</p>
          <ol className="rows">
            {contributions.items.map((c) => (
              <li className="row" key={c.n} data-cursor="Open">
                <span className="row-n mono" aria-hidden="true">
                  #{c.n}
                </span>
                <h3 className="row-name" style={{ fontSize: 'clamp(20px, 2vw, 30px)', lineHeight: 1.2, letterSpacing: '-0.03em' }}>
                  <a href={`https://github.com/${contributions.repo}/pull/${c.n}`} target="_blank" rel="noopener noreferrer">
                    {c.title}
                  </a>
                </h3>
                <div className="row-body">
                  <p className="row-detail">{contributions.repo}</p>
                </div>
                <div className="row-side row-meta mono">
                  <span>Merged</span>
                  <span>{c.date}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="block-foot">
            <span className="mono">Source: GitHub, checked Nov 14 2026</span>
            <a className="btn" href={contributions.href} target="_blank" rel="noopener noreferrer">
              See the pull requests <Arrow out />
            </a>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
