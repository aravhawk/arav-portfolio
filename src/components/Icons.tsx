const base = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false };

export const ArrowUpRight = () => (
  <svg {...base}>
    <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
  </svg>
);
export const ArrowRight = () => (
  <svg {...base}>
    <path d="M2.5 8h11M9 3.5L13.5 8 9 12.5" />
  </svg>
);
export const ArrowLeft = () => (
  <svg {...base}>
    <path d="M13.5 8h-11M7 3.5L2.5 8 7 12.5" />
  </svg>
);
export const Search = () => (
  <svg {...base}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5l3 3" />
  </svg>
);
export const Play = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <path d="M4.5 2.8v10.4a.6.6 0 00.92.5l8-5.2a.6.6 0 000-1l-8-5.2a.6.6 0 00-.92.5z" />
  </svg>
);
export const Pause = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
  </svg>
);
