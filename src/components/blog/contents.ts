/**
 * A post's contents: its own second-level headings, each with the id the
 * page gives it (rehype-slug, which uses GitHub's rule: lower case, the
 * marks of punctuation dropped, each space a hyphen, a repeat numbered).
 * Read from the post's source so the margin can list them without the post's
 * words being touched.
 */

export interface PostHeading {
  id: string;
  text: string;
}

/** The text of a heading as it is read: emphasis marks, code ticks and link targets dropped. */
function plain(md: string): string {
  return md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function slug(text: string, seen: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

export function postContents(source: string): PostHeading[] {
  const out: PostHeading[] = [];
  const seen = new Map<string, number>();
  let fence: string | null = null;
  for (const line of source.split('\n')) {
    const f = /^\s*(```+|~~~+)/.exec(line);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!h) continue;
    // Every heading takes its id in order (a repeat is numbered across levels); only the second level is listed.
    const text = plain(h[2]);
    const id = slug(text, seen);
    if (h[1].length === 2) out.push({ id, text });
  }
  return out;
}
