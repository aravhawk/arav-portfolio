export function Arrow({ out = false }: { out?: boolean }) {
  return (
    <svg className="arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={out ? { transform: 'rotate(-45deg)' } : undefined}>
      <path d="M1 6h10M6.5 1.5 11 6l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
