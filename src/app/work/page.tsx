import type { Metadata } from 'next';
import { earlier, groups, projects, recognition, upstream, upstreamTotal } from '@/lib/content';
import PageHead from '@/components/shell/PageHead';
import Footer from '@/components/shell/Footer';
import ProjectRows from '@/components/home/ProjectRows';
import Ledger from '@/components/home/Ledger';
import { Arrow } from '@/components/home/Arrow';

const description = 'Everything Arav Jain has built in public: agent tooling, dev tools, apps, a GPU blockchain, a trading bot, robot code, and pull requests to other projects.';

export const metadata: Metadata = {
  title: 'Work. Arav Jain',
  description,
  alternates: { canonical: '/work' },
  openGraph: { title: 'Work. Arav Jain', description, type: 'website', url: 'https://aravjain.dev/work' },
};

const total = projects.length + earlier.length;

export default function WorkPage() {
  return (
    <main>
      <PageHead pose="work" title="Work" lead="Everything here is public. Read the source, run it, tell me where it breaks." meta={`${total} projects / 2021 to 2026`} />
      <div className="sheet" data-chapter="sheet" data-ground="#f2f2f2" data-sheet>
        <nav className="work-nav wrap mono" aria-label="Sections on this page">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.title} <span>{String(projects.filter((p) => p.group === g.id).length).padStart(2, '0')}</span>
            </a>
          ))}
          <a href="#earlier">
            Earlier <span>{String(earlier.length).padStart(2, '0')}</span>
          </a>
          <a href="#upstream">
            Upstream <span>{String(upstreamTotal).padStart(2, '0')}</span>
          </a>
        </nav>
        <section className="block block-tight wrap" aria-label="Recognition">
          <Ledger items={recognition} />
        </section>
        {groups.map((g) => (
          <section className="block wrap" id={g.id} key={g.id} aria-labelledby={`${g.id}-title`} style={{ paddingTop: 0 }}>
            <div className="block-head">
              <h2 id={`${g.id}-title`} className="block-title">
                {g.title}
              </h2>
            </div>
            <p className="block-lead">{g.lead}</p>
            <ProjectRows items={projects.filter((p) => p.group === g.id)} detail />
          </section>
        ))}
        <section className="block wrap" id="earlier" aria-labelledby="earlier-title" style={{ paddingTop: 0 }}>
          <div className="block-head">
            <h2 id="earlier-title" className="block-title">
              Earlier
            </h2>
          </div>
          <p className="block-lead">The rest of the shelf, back to 2021. Most have no README, so they get a name, a year and a language.</p>
          <ul className="shelf">
            {earlier.map((e) => (
              <li key={e.name}>
                <a href={`https://github.com/aravhawk/${e.name}`} target="_blank" rel="noopener noreferrer" data-cursor="Open">
                  <span className="shelf-name">{e.name}</span>
                  {e.note ? <span className="shelf-note">{e.note}</span> : null}
                  <span className="shelf-meta mono">
                    {e.year} / {e.lang}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section className="block wrap" id="upstream" aria-labelledby="pr-title" style={{ paddingTop: 0 }}>
          <div className="block-head">
            <h2 id="pr-title" className="block-title">
              Upstream
            </h2>
          </div>
          <p className="block-lead">
            {upstreamTotal} merged pull requests in {upstream.length} public repositories outside my own account.
          </p>
          <ol className="rows">
            {upstream.map((u) => (
              <li className="row" key={u.repo} data-cursor="Open">
                <span className="row-n mono" aria-hidden="true">
                  {String(u.count).padStart(2, '0')}
                </span>
                <h3 className="row-name row-name-sm">
                  <a href={`https://github.com/${u.repo}/pulls?q=is%3Apr+author%3Aaravhawk+is%3Amerged`} target="_blank" rel="noopener noreferrer">
                    {u.repo}
                  </a>
                </h3>
                <div className="row-body">
                  <p className="row-line">{u.latest}</p>
                </div>
                <div className="row-side row-meta mono">
                  <span>
                    {u.count} merged
                  </span>
                  <span>{u.span}</span>
                  {u.label ? <span>{u.label}</span> : null}
                </div>
              </li>
            ))}
          </ol>
          <div className="block-foot">
            <span className="mono">Source: GitHub, checked Nov 14 2026</span>
            <a className="btn" href="https://github.com/aravhawk" target="_blank" rel="noopener noreferrer">
              Open the GitHub profile <Arrow out />
            </a>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
