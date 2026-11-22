export function Arrow({ out = false }: { out?: boolean }) {
  return (
    <svg className="arrow" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      {out ? (
        <path d="M4 11 11 4M5.2 4H11v5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M2.5 7.5h10M8.4 3.4l4.1 4.1-4.1 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
