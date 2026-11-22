/**
 * How a post opens, for the index: one paragraph from before its first
 * heading, in the author's own words, unchanged. The site sets no em or en
 * dash outside a post's own page, so this takes the first opening paragraph
 * that has none; if every one has, the index shows the description alone.
 */
export function openingLines(content: string, maxWords = 80): string | null {
  const head = content.split(/\n#{1,6}\s/)[0] ?? '';
  const paragraphs = head
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p && !/^(import |export |<|```|[-*+] |\d+\. |>|\|)/.test(p))
    .map((p) =>
      p
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__|\*|_|`)/g, '')
        .trim(),
    );
  const pick = paragraphs.find((p) => p && !/[–—]/.test(p));
  if (!pick) return null;
  const words = pick.split(' ');
  if (words.length <= maxWords) return pick;
  // Too long for the index: keep whole sentences only.
  const sentences = pick.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [pick];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().split(' ').length > maxWords) break;
    out += s;
  }
  return out.trim() || null;
}
