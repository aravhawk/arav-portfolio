/**
 * Post dates render in America/Chicago.
 *
 * A date saved without a time (the editor stores those as midnight UTC) is a
 * calendar day, not an instant, so it is shown as that day. Anything with a
 * real time is converted to Central time.
 */
export function formatPostDate(iso: string, style: 'long' | 'short' = 'long'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    timeZone: dateOnly ? 'UTC' : 'America/Chicago',
  }).format(d);
}
