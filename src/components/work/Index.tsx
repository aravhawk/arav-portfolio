'use client';

import { useMemo, useState } from 'react';
import { entries, groups } from '@/lib/facts';

const Arrow = () => (
  <svg className="ar" width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M1 10 10 1M3 1h7v7" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
);

export default function Index() {
  const [q, setQ] = useState('');
  const [g, setG] = useState<string>('All');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return entries.filter((e) => (g === 'All' || e.group === g) && (!s || `${e.name} ${e.line} ${e.kind} ${e.year} ${e.group}`.toLowerCase().includes(s)));
  }, [q, g]);
  return (
    <>
      <div className="tools">
        <label className="search">
          <span className="sr">Search the index</span>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="m9.5 9.5 3.5 3.5" stroke="currentColor" strokeWidth="1.3" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          <span className="count mono" aria-live="polite">{list.length} of {entries.length}</span>
        </label>
        <div className="chips" role="group" aria-label="Filter by kind">
          {['All', ...groups].map((name) => (
            <button key={name} className="chip mono" aria-pressed={g === name} onClick={() => setG(name)}>{name}</button>
          ))}
        </div>
      </div>
      <ul className="rows">
        {list.map((e) => {
          const inner = (
            <>
              <span className="yr mono">{e.year}</span>
              <span className="nm">{e.name}</span>
              <span className="ln2">{e.line}</span>
              <span className="kd mono">{e.kind}</span>
              {e.href ? <Arrow /> : <span />}
            </>
          );
          return (
            <li key={e.name}>
              {e.href ? <a className="row" data-stage={e.stage ? '' : undefined} href={e.href} target="_blank" rel="noopener noreferrer">{inner}</a> : <div className="row" data-stage={e.stage ? '' : undefined}>{inner}</div>}
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="none">Nothing matches. Clear the search to see all {entries.length}.</p>}
    </>
  );
}
