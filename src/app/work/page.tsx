import type { Metadata } from 'next';
import Index from '@/components/work/Index';
import Foot from '@/components/shell/Foot';
import { entries } from '@/lib/facts';

export const metadata: Metadata = {
  title: 'Index',
  description: 'Everything Arav Jain has built: companies, agents, tools, apps, trading, robots and merged pull requests.',
  alternates: { canonical: '/work' },
};

export default function Work() {
  return (
    <main id="main" className="enter">
      <header className="top">
        <div>
          <h1 className="head"><span className="ln"><span className="thin">The</span><span className="black">index</span></span></h1>
          <p className="top-meta mono"><span>{entries.length} entries</span><span>2020 to now</span><span>Dot marks the main stage</span></p>
        </div>
      </header>
      <div className="sheet" style={{ '--i': 1 } as React.CSSProperties}>
        <Index />
        <Foot />
      </div>
    </main>
  );
}
