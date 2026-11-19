# Copy

Status: **as built** (the rules); two lines on the home page are
being rewritten to meet them.

## How the site speaks

- Plain, specific sentences about what the thing does. Say what
  happens and who does it. If a sentence would fit any AI product,
  rewrite it.
- No slogans. No "X, not Y". No aphorisms about evidence or proof. No
  buzzword triads, no "revolutionize", "supercharge", "seamless". No
  captions that explain the design.
- No em dashes or en dashes in new copy.
- The home page holds about 200 visible words. `checks.js` in the
  capture tools counts them; adding a word means removing one.
- Every number is real and sourced
  (`docs/redesign-v4/content-sources.md`); numbers that change are
  read live (`src/lib/metrics`) and stamped with when they were read.
  Merged pull requests count only repositories he does not own.
- "Selected for OpenAI DevDay 2026" is about him, not the company.
- The names of his bots never appear on the public site ("Jarvis",
  "Friday", "Grok Bot"). No photo of him.

## What may appear

- Public or open-source work only, except Infiniview and his
  business work. Never AlphaPredict or the trading bot. Never link
  the private repository `infiniflop/infiniview`.
- Only true focus work and real metrics are featured. Small demos do
  not go on the main stage (Merlin is out).
- The first screen says what he is in five seconds: "AI and developer
  tooling builder".

## Where copy lives

`src/content/projects.ts` (every project's name, line, page copy and
links; the archive; contact), `src/content/kinds.ts` (the small
labels). The post in `content/posts/` is the owner's own writing and
is not edited.

Change log: 2026-11-18 first version (orchestrator).
