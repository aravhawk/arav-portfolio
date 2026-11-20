# Copy

The rules for every word on the site. They are the owner's.

## How the site speaks

- Plain, specific sentences about what the thing does. Say what
  happens and who does it. If a sentence would fit any AI product,
  rewrite it.
- No slogans. No "X, not Y". No aphorisms about evidence or proof.
  No buzzword triads, no "revolutionize", "supercharge",
  "seamless". No captions that explain the design.
- No em dashes or en dashes in visible text.
- **Move a sentence, do not invent one.** Every statement needs a
  public source. The sources are in
  `docs/redesign-v4/content-sources.md`.
- **The home page holds 200 visible words.** Adding a word means
  removing one.
- Every number is real and sourced. Numbers that change are read
  live (`src/lib/metrics`) and shown through `Live`
  (`src/components/inner/bits.tsx`), which links to the source and
  says when it was read. Merged pull requests count only
  repositories he does not own (`EXCLUDED_OWNERS` in
  `src/lib/metrics/config.ts`).
- "Selected for OpenAI DevDay 2026" is about him, not the company.
- The names of his bots never appear on the public site ("Jarvis",
  "Friday", "Grok Bot"). No photo of him. (The Agent Bridge film is
  the owner's own video and shows one of those names inside it. It
  was kept and flagged to him; do not add another.)

## What may appear

- Public or open-source work only, except Infiniview and his
  business work. Never AlphaPredict or the trading bot. Never link
  the private repository `infiniflop/infiniview`.
- Only true focus work and real metrics are featured. Small demos
  do not go on the main stage.
- The first screen says what he is in five seconds: "AI and
  developer tooling builder."

## Fixed lines

Change these only on the owner's word:

- The hero: "AI and developer tooling builder." and the sentence
  under it.
- The statement: "Agents that break software before attackers do.
  Tools developers run daily."
- The ending: exactly "This was the warm-up." with "The next
  station isn't built yet." under it. Email is the one action; the
  other links are a quiet row.

## Where copy lives

| What | File |
| --- | --- |
| Each project's name, one line, summary, facts, links, media and alt text; the "Also" rows; the archive; interests; contact | `src/content/projects.ts` |
| The small label over each project | `src/content/kinds.ts` |
| Facts set into the project pages' bodies | `src/components/work/case-data.ts` |
| The hero, the statement, the ending, section names for assistive technology | `src/app/page.tsx` |
| The two ways on ("Everything I have built", "Notes from the work") and the footer | `src/components/inner/Page.tsx` |
| The not found page | `src/app/not-found.tsx` |
| Site name, tagline, description | `src/lib/site.ts` |
| Alt text of header stills and share cards | `src/components/inner/stills.ts`, `src/lib/og.tsx` |

The posts in `content/posts/` are the owner's own writing and are
never edited.

## Words and the picture

On the home page a line stands on a scene. A longer line can run
off its calm ground. After any change to a station's name or line,
look at that scene at both ends of its push, wide and tall, in both
themes.

## Check

With a production build running:

```sh
NODE_PATH="$HOME/.t3/portfolio-redesign-v4/tools/node_modules" \
  node docs/site-system/measure/words.cjs http://localhost:3189
```

It counts the home page's visible words, and on every page in the
sitemap looks for dashes and for the names that never appear. A
post's own text is not checked.

Change log: 2026-11-18 first version; 2026-11-19 revised for the
rebuilt site (M1).
