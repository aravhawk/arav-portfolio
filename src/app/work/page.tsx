import type { Metadata } from 'next';
import SceneSetter from '@/components/SceneSetter';
import Footer from '@/components/Footer';
import WorkIndex from '@/components/work/WorkIndex';

export const metadata: Metadata = {
  title: 'Work',
  description: 'Everything Arav Jain has shipped in public: Infiniview, open source, Kilo Bench, Agent Bridge, open models, tools and an archive.',
  alternates: { canonical: '/work' },
};

export default function WorkPage() {
  return (
    <>
      <SceneSetter name="work" />
      <div className="page">
        <header className="page-head layer-type" style={{ pointerEvents: 'auto', userSelect: 'auto' }}>
          <h1 className="word page-title" style={{ '--w': 2.9 } as React.CSSProperties}>
            <span className="line">
              <span data-refract>Work</span>
            </span>
          </h1>
          <p className="page-lede">What I have shipped in public.</p>
        </header>
        <div className="layer-ui" style={{ display: 'grid', gap: 64 }}>
          <WorkIndex />
        </div>
      </div>
      <Footer />
    </>
  );
}
