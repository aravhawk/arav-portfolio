import { TLink } from '@/components/shell/Shell';

export default function Lost({ what = 'This page' }: { what?: string }) {
  return (
    <main id="main" className="lost enter">
      <p className="mono" style={{ color: 'var(--steel)' }}>404</p>
      <h1 className="head" data-size="lg"><span className="ln"><span className="thin">Nothing</span><span className="black">out here.</span></span></h1>
      <p className="line">{what} does not exist.</p>
      <TLink className="go mono" href="/">Back to the start</TLink>
    </main>
  );
}
