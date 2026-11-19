'use client';

import { useCallback, useRef, useState } from 'react';
import { haptic } from '@/lib/haptics';
import { emit } from '@/lib/signals';

const PROFILES = ['claude', 'kimi', 'ollama'];

/**
 * cc-switch, as a thing you can do: pick a profile and the stream is
 * rerouted through that branch. The gates are real: the bed is re-carved
 * with the chosen branch open and the others dammed.
 */
export function ProfileSwitch() {
  const [active, setActive] = useState(0);
  const host = useRef<HTMLDivElement>(null);

  const pick = useCallback((i: number) => {
    const feat = host.current?.closest<HTMLElement>('[data-bed^="feat:fork"]');
    if (!feat || feat.dataset.active === String(i)) return;
    // Haptic, state and water all change in this one handler.
    haptic('selection');
    emit('switch', i);
    setActive(i);
    feat.dataset.active = String(i);
    const w = window.__water;
    if (w) {
      const r = feat.getBoundingClientRect();
      w.engine.splash(r.left + r.width / 2 + window.scrollX, r.top + r.height * 0.2 + window.scrollY, 26, 0.8);
      w.rebuild();
    }
  }, []);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + PROFILES.length) % PROFILES.length;
    pick(n);
    host.current?.querySelectorAll<HTMLButtonElement>('button')[n]?.focus();
  };

  return (
    <div ref={host} className="switch plate" role="radiogroup" aria-label="Active Claude Code profile" data-dry>
      <span className="switch-thumb" style={{ transform: `translate3d(${active * 100}%,0,0)` }} aria-hidden="true" />
      {PROFILES.map((p, i) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={active === i}
          tabIndex={active === i ? 0 : -1}
          className="switch-opt mono"
          data-bed={`branch:${i}`}
          onClick={() => pick(i)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
