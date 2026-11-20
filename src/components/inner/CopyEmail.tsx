'use client';

import { useEffect, useRef, useState } from 'react';

/** Copies the address. At rest the control is its mark; what happened is said in words when it happens. */
export function CopyEmail({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef(0);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button type="button" className="in-copy" onClick={copy} aria-label="Copy email address">
      {state === 'idle' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 3.2H4.4c-.9 0-1.6.7-1.6 1.6v6.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : null}
      <span aria-live="polite" className={state === 'idle' ? 'sr-only' : undefined}>
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed. Use the link.' : 'Copy'}
      </span>
    </button>
  );
}
