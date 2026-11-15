/** Blog dates render in America/Chicago, wherever the server or the reader is. */
export function formatPostDate(iso: string, month: 'long' | 'short' = 'long') {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month, day: 'numeric' }).format(new Date(iso));
}
