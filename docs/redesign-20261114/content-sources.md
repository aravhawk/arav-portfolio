# Content sources (gathered Nov 14 2026)

Every statement about Arav on the new site comes from a public page read on Nov 14 2026. Raw captures (page text, screenshots, READMEs) are saved in `~/.t3/portfolio-redesign-20261114/sources/`. Site copy lives in one file, `src/lib/content.ts`, so each line below can be checked against it.

## Where the facts came from

| Source | How it was read | What it gave |
| --- | --- | --- |
| [github.com/aravhawk](https://github.com/aravhawk) | GitHub API (`users/aravhawk`, repo list, READMEs, pull request search) | Name; bio "Co-Founder @infiniflop Labs"; profile README: "building AI app review agents", "I love to build dev tools and AI agents, along with some blockchain stuff"; 45 public repos; every project fact below |
| [infiniflop.com](https://infiniflop.com) | Loaded in Chrome, text saved | "we're building Infiniview." and "AI-powered code review and security testing. Agents that review, probe, and stress-test your code in cloud sandboxes." Footer "© 2026 Infiniflop Labs". Links to infiniview.dev, X and GitHub |
| [aravjain.dev](https://aravjain.dev) (live site, commit 9a487fb) | Loaded in Chrome, plus `src/lib/data.ts` at 9a487fb | Ventures and years: Infiniflop Labs (2026, building), NeuralBytes (2024, archived), Master Coders (2020, archived, "Free live coding lessons teaching students to build real projects from scratch"); email aravhawk@gmail.com; the three social links |
| [aravjain.dev/blog](https://aravjain.dev/blog) and `content/posts/` | Read in the repo | One post, "Three AI Agents Built Me Five SaaS Products. I Wouldn't Ship Any of Them." (dated 2026-04-18 in front matter). Two of the four rules are quoted from it |
| [x.com/aravhawk](https://x.com/aravhawk) | Logged-out view in Chrome | Bio "Co-Founder @infiniflop Labs", link infiniview.dev, joined May 2021, five recent posts. Used for voice only (short, lower case, direct). No post is quoted or paraphrased on the site |
| [linkedin.com/in/aravjainml](https://linkedin.com/in/aravjainml) | Blocked by LinkedIn's auth wall (HTTP 999) | Nothing. The site only links to it |
| [neuralbytes.net](https://neuralbytes.net) | Loaded in Chrome | "Building AI-integrated experiences and experiments"; products listed: IntergalacticPro, AlphaPredict; "© 2024-2025 NeuralBytes, Inc." |
| [rydar.org](https://rydar.org), [merlin.aravhawk.com](https://merlin.aravhawk.com) | Loaded in Chrome | Both live. RydAR: "Arkansas curve map & iPhone curve warnings". Merlin: wireframe viewer with hand tracking |
| [npmjs.com/package/@aravhawk/cc-switch](https://www.npmjs.com/package/@aravhawk/cc-switch) | npm blocked the headless request (403); package name confirmed from the cc-switch README install line | Package name only |

## Claim by claim

| On the site | Source |
| --- | --- |
| "Co-founder of Infiniflop Labs, est. 2026" | GitHub bio; aravjain.dev ("EST. 2026"); infiniflop.com footer |
| "I build AI agents and dev tools" | GitHub profile README |
| Statement: "Most of what I make checks other software: it reviews code, probes it, and tries to break it before a user does." | infiniflop.com (review, probe, stress-test); aravjain.dev tagline ("find issues in your apps before users do"); ask-around and agent-bridge READMEs (guardrails for agents) |
| "We're building Infiniview." plus the description line | infiniflop.com, verbatim. Nothing about Infiniview beyond that sentence appears anywhere |
| Rule: "Silence is never a yes." | ask-around README: "quorum and veto are enforced, and silence is never a yes" |
| Rule: "Messages are data, never permission." | agent-bridge README, bold line of the same words |
| Rule: "Someone has to read the code." | Blog post, last line: "The clearest lesson is still that someone has to read the code." |
| Rule: "If your eval is throughput, you're measuring the wrong thing." | Blog post: "If your eval for coding agents is throughput, you're measuring the wrong thing." Shortened by three words |
| Rule notes (escalate then block; cannot grant approval; three agents, five products) | Same README sections and post paragraphs, paraphrased closely. "Three outputs isn't better than one good output." is the post's own sentence |
| Ventures: Master Coders 2020, NeuralBytes 2024, Infiniflop Labs 2026 and their one-line descriptions ("Co-founded in 2026. We're building Infiniview.") | aravjain.dev live site; neuralbytes.net for IntergalacticPro; infiniflop.com |
| cc-switch: providers, "40+ providers", npm name | cc-switch README |
| agent-bridge: shared inbox between "your OpenAI Dot and Grok Bot" (the README writes "dot"; Arav confirmed the name is OpenAI Dot), self-hosted MCP server, one owner, own OAuth token each | agent-bridge README |
| ask-around: governance, quorum, veto, receipts, one tool call | ask-around README |
| RydAR: iPhone co-pilot for tight bends in Arkansas, spoken advisory from a bundled database, public map at rydar.org | RydAR README; rydar.org |
| merlin-control: wireframe Merlin 1D driven by bare hands through a webcam, after SpaceX's 2013 "The Future of Design" demo, Three.js and MediaPipe | merlin-control README; merlin.aravhawk.com |
| TensorPoW: reference implementation for Tensorcoin, GPU proof of work, deterministic INT8 tensor computation, Python and PyTorch | TensorPoW README; repo description "The Fastest Blockchain, Powered by GPUs" |
| vampire-hunter: standby power from hourly smart-meter data, unplug experiment, runs in the browser, Kiroween 2026 entry | vampire-hunter README |
| passportphoto: local US passport photo studio, 2 by 2 inch, 300 DPI | passportphoto README |
| lite-stats: trimmed Apple Silicon-only fork of exelban/stats | lite-stats README |
| envfetch: env vars in an encrypted local vault, Secure Enclave key, Touch ID, zsh/bash/fish; archived | envfetch README; repo `archived: true` |
| T3 Code: 8 merged pull requests, September to November 2026 | `gh search prs --author aravhawk --merged` on Nov 14 2026: #2981, #15875, #15876, #15886, #19737, #19791, #33474, #33475 |
| Project years | GitHub `created_at` per repo (lite-stats: Dec 2025; the rest 2026) |
| "Six things I built this year. All of them are open source" | The six featured repos are public and were all created in 2026 |
| "Into" row under the statement (AI agents, dev tools, rockets, GPUs and chains) | The repos named beside each one, plus the GitHub README line about dev tools, agents and "some blockchain stuff" |

## Checked and changed since the Nov 9 fact sheet
- New repo: vampire-hunter (created Nov 13 2026). Added to the work index.
- t3code: seven merged PRs now (the latest merged Nov 11). One more is open (#33475) and is not counted.
- The live demo for passportphoto (passportphoto-us.vercel.app) returns 404, so the site links only to its repository.
- mastercoders.dev does not resolve, so Master Coders has no link.
- The agent-bridge homepage URL returns a JSON health check, not a page, so the site links to the repository.
- claudeclaw and fix-it-bot are on the live site's "current projects" list. fix-it-bot is archived on GitHub and claudeclaw is not a public repo, so neither is on the new site.

## Added back on Arav's instruction (Nov 14, afternoon)
Arav asked for every piece of work to be on the site, with the live site accepted as a source. Each line below is only what its source says.

| On the site | Source |
| --- | --- |
| DeveloperWeek 2026: first place out of 74 submissions | aravjain.dev live site ("Won 1st place out of 74 submissions"). The live site does not name the project, so the site does not either |
| Trading: autonomous equities and options bot on Claude Code CLI and Alpaca's API over MCP, 14 strategies, own memory, trap orders | Trading README |
| AlphaPredict: stock market predictor with charts and company details, a NeuralBytes app with a signup page | Repo descriptions of AlphaPredict and AlphaPredict-Signup; neuralbytes.net lists it |
| 99719T and 3400Z: source code for VEX Robotics teams, 2025 to 2026 and 2024 to 2025 | Repo descriptions. No school is named in either repo or on the site |
| Weather-Station-BMP280 | Repo description |
| claude-code-utils, kilobench | Repo descriptions; kilobench README is the Kilo Code README |
| fix-it-bot | README (the package is fix-it-bot-react) |
| claudeclaw: multi-platform AI assistant on the Claude Agents SDK | aravjain.dev live site. No public repo, so no link |
| tempify, ClarifAI, typing-game (anytype) | Their READMEs |
| CryptoLab: submitted to Apple's 2025 Swift Student Challenge; needs AR and a Secure Enclave | README |
| askrosie: local study clone of a museum's AI companion, not for redeploy | README. The museum is not named on the site because it would point at a city |
| "Earlier" shelf: Macro-Guru, neuralbytes.net, IntergalacticPro, SumQuick, ChatGPT-3.5-with-Vision, escaperoom, workjet-ms, workjet-google, wordle-clone, who-wants-to-be-a-billionaire, teamastros, top10tipsforsurvival | GitHub name, creation year, language and description. Seven have no README or description, so they carry nothing else |
| Upstream: 36 merged pull requests in 10 public repositories (t3code 8, tokscale 3, kilocode 1, Investo 1, openbridge 1, ThrasherAndChambersWebsite 5, XcodeBenchmark 1, infiniview-web-frontend 6, infiniflop.com 5, infiniview-docs 5) | `gh search prs --author aravhawk --merged`, Nov 14 2026. Each row links to the filtered pull request list |
| "2 entries": Kiroween 2026 and the Swift Student Challenge | vampire-hunter and CryptoLab READMEs |

Still not on the site, and why:
- Merged pull requests in private repositories (infiniflop/infiniview 7, pkyanam/agentsocket 2, 2ALabz/2alabz-site 5) and the private repo 99719X. Their titles are not public, so they are not listed.
- aravhawk.github.io and IntergalacticPro-Signup: an empty Pages repo and a signup page for an app already listed.
- Forks with no merged work of his own in them (excalidraw-cli, open-design).

## Left out, Arav can opt in
- Age (shown in the X bio).
- City (shown on the X profile). The RydAR line names Arkansas only because the project is about Arkansas roads.
- School or program details.
- Scholarships.
- Income.
- A portrait. The site has no photo of Arav.
- Follower and star counts, and any usage numbers.
- Recent X posts. None are quoted.
- infiniview.dev content beyond what infiniflop.com says.
