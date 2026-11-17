'use client';

import { useMemo, useState } from 'react';
import type { ArchiveEntry } from '@/content/projects';
import { haptic } from '@/lib/haptics';
import { Arrow } from '../bits';

const GROUPS = ['All', 'Tools', 'Earlier', 'Small'] as const;
type Group = (typeof GROUPS)[number];

/**
 * The order the archive is read in: the tools in daily use lead, then the
 * earlier work, then the small things. The data's own order is left alone;
 * a name that is not listed here falls in after the ones that are.
 */
const ORDER = [
  'envfetch',
  'lite-stats',
  'claude-code-utils',
  'passportphoto',
  'CryptoLab',
  'SumQuick',
  'ChatGPT-3.5-with-Vision',
  'IntergalacticPro',
  'Weather-Station-BMP280',
  'neuralbytes.net',
  'Master Coders',
  'typing-game',
  'teamastros',
  'merlin-control',
  'who-wants-to-be-a-billionaire',
  'escaperoom',
  'workjet',
  'top10tipsforsurvival',
];
const rank = (name: string) => {
  const i = ORDER.indexOf(name);
  return i < 0 ? ORDER.length : i;
};

/** The archive: every other thing, one line each, searchable. */
export function ArchiveList({ entries }: { entries: ArchiveEntry[] }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<Group>('All');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const ordered = [...entries].sort((a, b) => rank(a.name) - rank(b.name));
    return ordered.filter(
      (e) =>
        (group === 'All' || e.group === group) &&
        (!needle || `${e.name} ${e.line} ${e.year} ${e.group}`.toLowerCase().includes(needle)),
    );
  }, [entries, q, group]);

  const clear = () => {
    setQ('');
    setGroup('All');
  };

  return (
    <div>
      <div className="archive-tools">
        <input
          className="search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the archive"
          aria-label="Search the archive"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="chips" role="group" aria-label="Filter by kind">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className="chip"
              aria-pressed={group === g}
              onClick={() => {
                if (g === group) return;
                haptic('selection');
                setGroup(g);
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <p className="archive-count" aria-live="polite">
        {shown.length} of {entries.length}
      </p>
      {shown.length ? (
        <ul className="rows">
          {shown.map((e) => (
            <li key={e.name} className="row">
              <span className="label">{e.year}</span>
              <span className="row-name">{e.name}</span>
              <span className="row-line">{e.line}</span>
              <span className="row-links">
                {e.href ? (
                  <a className="link" href={e.href} target="_blank" rel="noopener noreferrer">
                    Source <Arrow out />
                  </a>
                ) : null}
                {e.also?.map((l) => (
                  <a key={l.href} className="link" href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.label} <Arrow out />
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          Nothing in the archive matches that.{' '}
          <button type="button" onClick={clear}>
            Clear the search
          </button>
        </p>
      )}
    </div>
  );
}
