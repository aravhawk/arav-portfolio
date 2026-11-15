# Content sources (read Nov 14 2026)

Raw captures are in `~/.t3/portfolio-redesign-v2/sources/` (API JSON, READMEs, page text, screenshots). All site copy lives in `src/lib/facts.ts`.

| Source | How | Result |
| --- | --- | --- |
| github.com/aravhawk | GitHub API: profile, 45 public repos, READMEs, `gh search prs --author aravhawk --merged` | Bio "Co-Founder @infiniflop Labs". Profile README: "building AI app review agents", "I love to build dev tools and AI agents, along with some blockchain stuff." Every project line below. |
| infiniflop.com | Chrome | "we're building Infiniview." and "AI-powered code review and security testing. Agents that review, probe, and stress-test your code in cloud sandboxes." Nothing else about Infiniview is claimed. |
| aravjain.dev (live) | Chrome | Ventures and years (Infiniflop Labs 2026, NeuralBytes 2024, Master Coders 2020), "Won 1st place out of 74 submissions" at DeveloperWeek 2026, claudeclaw. |
| x.com/aravhawk | Chrome, logged out | Bio and recent posts, used for voice only (short, plain, lower-key). Nothing quoted. Age, city and follower count are visible there and are left off the site. |
| linkedin.com/in/aravjainml | Chrome | Auth wall (HTTP 999). Nothing read. The site only links to it. |
| Live links | curl | 200: merlin.aravhawk.com, rydar.org, neuralbytes.net, aravhawk.github.io/oxydrop. Dead: macroguru.aravhawk.com (so Macro-Guru links to its repo). |
| PR #18 content file | `git show origin/redesign/fable-20261114:src/lib/content.ts` | Facts only, each re-checked above. No design, layout or copy reused. |

## Claims on the home page
| Line | Source |
| --- | --- |
| "I build AI agents and the tools around them." | GitHub profile README (dev tools and AI agents) |
| "Co-founder, Infiniflop Labs"; "Agents that review, probe and stress-test your code in cloud sandboxes." | GitHub bio; infiniflop.com, near verbatim |
| "DeveloperWeek 2026. 1st of 74." | aravjain.dev live site. It does not name the project, so neither does this one |
| "Messages are data. Never permission." "A shared inbox between your OpenAI Dot and Grok Bot." | agent-bridge README (README writes "dot"; brand spelling is OpenAI Dot) |
| "20 merged upstream. Pull requests in other people's repos. 8 in T3 Code." | PR search: pingdotgg/t3code 8, junhoyeo/tokscale 3, Kilo-Org/kilocode 1, Kanishksasi/Investo 1, fakerybakery/openbridge 1, AvinashDevineni/ThrasherAndChambersWebsite 5, devMEremenko/XcodeBenchmark 1. Total 20. The 16 merged in public Infiniflop repos are listed in the index, not counted here, because those are his own company's |
| "The bot trades. Equities and options, on its own." callout "14 strategies" | Trading README: "fully autonomous equities + options trading system", "trades 14 strategies" |
| callout "AlphaPredict, 2024" | AlphaPredict repo (created 2024, "stock market predictor") |
| "Merlin 1D. Bare hands. A SpaceX engine you spin through a webcam." | merlin-control README |
| "65,536" in the loader | The real number of lights in the desktop swarm |
| "First light in 47:00" | A device of the site, not a fact about Arav |

## What changed since PR #18's fact sheet
- New repo: oxydrop (created Nov 14). In the index as a prototype. Its README names a high-school hackathon; the site does not.
- vampire-hunter now returns 404 on GitHub, so it is gone from the index.
- T3 Code: still 8 merged (latest merged Nov 14).

## Left out on purpose
Age, city, school or program, scholarships, internships, follower and star counts, income, trading results, a portrait, the museum behind askrosie, private-repo pull requests (infiniflop/infiniview 7, pkyanam/agentsocket 2, 2ALabz/2alabz-site 5, 99719X 1), and forks with no merged work (excalidraw-cli, open-design).

## Main stage and archive
- Main stage (6 beats after the name): Infiniview, DeveloperWeek 2026, agent-bridge, upstream pull requests, trading (Trading bot and AlphaPredict), merlin-control.
- Everything else, 48 entries in total, is one line each in `/work`: companies, agents and tools (cc-switch, ask-around, claudeclaw, fix-it-bot, kilobench, claude-code-utils, envfetch, lite-stats), apps (RydAR, OxyDrop, passportphoto, tempify, ClarifAI, typing-game, askrosie, CryptoLab, Macro-Guru), TensorPoW, VEX robot code for 99719T and 3400Z, the weather station, per-repo upstream rows, and the 2021 to 2024 repos.

## Assets and licences
- No third-party models, textures or images. Geometry, shaders and formations are written in `src/world/`.
- three.js (MIT), lenis (MIT).
- Fonts through `next/font/google`: Archivo (SIL OFL 1.1), Geist Mono (SIL OFL 1.1).
