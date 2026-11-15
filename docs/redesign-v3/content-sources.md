# Content sources

Every number and claim on the site, with where it was read and when. All retrievals: 2026-11-14, 22:48 to 23:05 America/Chicago, unless noted. Raw responses are kept outside the repo in `~/.t3/portfolio-redesign-v3/sources/`. Values are static in `src/lib/site.ts`; nothing is fetched at build or run time.

## Metrics shown

| Shown as | Value | Source | Notes |
|---|---|---|---|
| Ollama pulls (home hero, home beat 5 headline, /work, /work/open-models) | 18,284 | https://ollama.com/aravhawk | Sum of the four public models below. Counts are exact integers on the page. |
| qwen3.5-opus-4.6 pulls | 9,441 | https://ollama.com/aravhawk/qwen3.5-opus-4.6 | Uploaded Apr 1, 2026 (UTC, from the page's title attribute). |
| llama4 pulls | 7,363 | https://ollama.com/aravhawk/llama4 | Uploaded Apr 11, 2025 (UTC). Shown as an upload date, no "first" claim. |
| gemma4 pulls | 1,282 | https://ollama.com/aravhawk/gemma4 | Uploaded Apr 14, 2026 (UTC). |
| qwen3.6 pulls | 198 | https://ollama.com/aravhawk/qwen3.6 | Uploaded Apr 25, 2026 (UTC). |
| npm downloads, all time (home hero, beat 6, /work/cc-switch) | 9,819 | https://api.npmjs.org/downloads/range/2026-01-01:2026-11-14/@aravhawk/cc-switch | Yearly windows 2020 to 2025 each return 0; first non-zero day is 2026-02-01. |
| npm downloads, last month (/work/cc-switch) | 457 | https://api.npmjs.org/downloads/point/last-month/@aravhawk/cc-switch | Window 2026-10-15 to 2026-11-13. |
| cc-switch version, license, first publish (/work/cc-switch) | 4.0.0, MIT, Feb 1, 2026 | https://registry.npmjs.org/@aravhawk/cc-switch | |
| GitHub contributions in 2026 (home hero, /work/open-source) | 2,597 | https://github.com/users/aravhawk/contributions?from=2026-01-01&to=2026-12-31 | The brief recorded 2,591 earlier the same day; the re-pulled value is used. |
| Pull requests merged upstream (home hero, beat 2, /work) | 20 across 7 public repos | GitHub search `author:aravhawk is:pr is:merged -user:aravhawk` | 50 results; excluded infiniflop/* (23), pkyanam/agentsocket (2) and 2ALabz/2alabz-site (5, returns 404 unauthenticated). Each counted repo returns 200 unauthenticated. |
| Merged in T3 Code | 8 (of 12 authored) | https://github.com/pingdotgg/t3code/pulls?q=is%3Apr+author%3Aaravhawk | Only "8" is shown. |
| Per-repo merged counts (/work/open-source) | t3code 8, ThrasherAndChambersWebsite 5, tokscale 3, kilocode 1, XcodeBenchmark 1, openbridge 1, Investo 1 | same search | |
| PR title on home | "`gh pr new` links the new pull request to the thread" #33474 | https://api.github.com/repos/pingdotgg/t3code/pulls/33474 | merged 2026-11-11. The `fix(github):` prefix is omitted. |

## Claims shown

| Claim | Source | Status |
|---|---|---|
| Infiniview: AI code review, auditing and stress testing; sandbox deploy, real attacks, replayable proof; early access | Brief (verified by Arav, 2026-11-14); https://infiniview.dev | Homepage confirms "Early access", sandbox deployment and real attacks. The exact sentence in the brief is not on the homepage; it is used as Arav's own first-person description, not as a quotation of the site. |
| Began as Docksmith (Mar 2026), renamed Apr 2026; Infiniflop Labs cofounded Mar 2026 | Brief | Not independently re-verifiable from a public page today. |
| Daytona Startup Grid acceptance, Apr 9, 2026 | Brief | No dollar figure, no "funding" wording. |
| Infiniflop Labs selected for OpenAI DevDay 2026 (Sep 29, San Francisco) | Brief | Wording is "selected". |
| Kilo Bench won "Kilo - For Devs, By Devs", DeveloperWeek 2026 Hackathon | https://devpost.com/software/kilo-bench-native-model-benchmarking-in-kilo-code | Read in a real browser (Devpost blocks curl): "SUBMITTED TO DeveloperWeek 2026 Hackathon / WINNER Kilo - For Devs, By Devs". Product description also from this page. |
| Agent Bridge description and "Messages are data, never permission." | https://raw.githubusercontent.com/aravhawk/agent-bridge/HEAD/README.md | Quote is verbatim (README line 19). Apache-2.0. The repo's homepage field points at a URL on the never-list, so only the repo and the X launch post are linked. |
| Agent Bridge launch post | https://x.com/aravhawk/status/2117458115134472437 | 200. |
| TensorPoW description, Apache 2.0 with historic MIT notice | https://raw.githubusercontent.com/aravhawk/TensorPoW/HEAD/README.md | "Oct 2024" and "Jun 2026" and "becoming a research paper" are from the brief. No adoption or testnet claims. |
| merlin-control description | https://raw.githubusercontent.com/aravhawk/merlin-control/HEAD/README.md ; https://merlin.aravhawk.com (200) | No SpaceX marks are used. The glass engine bell is an authored shape. |
| RydAR description and advisory "Slow to 25 mph for the curve ahead." | https://raw.githubusercontent.com/aravhawk/RydAR/HEAD/README.md ; https://rydar.org (200) | "Built with collaborators" from the brief. No competition result. |
| Ask Around tagline, "silence is never a yes" | https://raw.githubusercontent.com/aravhawk/ask-around/HEAD/README.md | Verbatim phrases. |
| Ask Around won Belweave's Notify Weekend 01 hackathon, Nov 2026 | https://x.com/pkyanam/status/2120163766713430040 | Post says "@aravhawk is our winner". No prize amount shown. |
| ClarifAI: AI-assisted relationship mediation for couples and roommates | https://devpost.com/software/clarifai-6pg03u (read in a real browser) | No result claim. |
| fix-it-bot | https://github.com/aravhawk/fix-it-bot | Repo description. |
| OxyDrop and its disclaimer | https://raw.githubusercontent.com/aravhawk/oxydrop/HEAD/README.md ; https://aravhawk.github.io/oxydrop/ (200) | Disclaimer shown with it on /work: "not medical advice, not a medical device, validated on only 6 people". |
| VELOCITY flight computers: R1 Dec 2023, PICO R1 Sep 2024, FLEX 2350; JRLS | Brief | See gaps below. Shown without links. |
| VEX robotics repos 99719T and 3400Z; VEX Design Award Nov 2025 | https://github.com/aravhawk/99719T , https://github.com/aravhawk/3400Z ; award from the brief (LinkedIn) | School not named. |
| goFoundr: an AI founder agent | https://github.com/2ALabz/goFoundr | Repo description "The original AI founder agent". |
| Business Insider quotes "I got agents running." and "I've got to keep shipping software." (May 2026) | https://www.businessinsider.com/coders-keep-laptops-open-in-public-ai-agent-2026-5 (200) | Quotes as given in the brief. Nothing else from the article is used. |
| Essay title | `content/posts/three-ai-agents-five-saas-products.mdx` | Untouched. |
| Archive rows | https://api.github.com/users/aravhawk/repos (45 public repos) | Each linked repo returned 200 unauthenticated. Descriptions and languages are from the repo metadata; years are `created_at`. |

## Dropped or changed against the brief

- **jrls.space:** does not resolve (NXDOMAIN on the system resolver, 1.1.1.1 and 8.8.8.8). Not linked.
- **Flux project** `flux.ai/aravhawk/velocity-flex-2350`: the page renders "Project not found" in a real browser. Not linked.
- **No public VELOCITY repos** exist in the 45 public repos, so the hardware card has no links.
- **aravhawk/nextup-site:** 404 and not in the public repo list. Dropped from the archive.
- **CryptoLab** links to `aravhawk/CryptoLab.swiftpm` (the real name). **workjet** links to `aravhawk/workjet-google`.
- **Master Coders:** listed without a link, as the brief says.
- **Live links** `intergalacticpro.neuralbytes.net` and `passportphoto-us.vercel.app` were not checked, so only the repos are linked. `neuralbytes.net` returned 200 and is linked.
- **linkedin.com/in/aravjainml** returns LinkedIn's bot status 999 to automation; the link is kept as given in the brief.

## Assets and licenses

| Asset | Origin | License |
|---|---|---|
| `public/media/agent-bridge-demo.mp4` (5,289,508 bytes) | `docs/media/demo.mp4` in github.com/aravhawk/agent-bridge (7,942,865 bytes, 43.3s, 1920x1080, no audio), re-encoded with libx264 two-pass, faststart | Apache-2.0 (Arav's own repo) |
| `public/media/agent-bridge-poster.jpg` (42,110 bytes) | Frame at 10.8s of the same video | Apache-2.0 |
| Archivo (variable, width and weight axes) | Google Fonts through `next/font` | SIL Open Font License 1.1 |
| Geist Mono | Google Fonts through `next/font` | SIL Open Font License 1.1 |
| Shaders, signed distance forms, icons, favicon | Authored for this site | Repo license |

No third-party 3D models, textures, images or icon sets are used. `lenis` (MIT) is the only dependency added.
