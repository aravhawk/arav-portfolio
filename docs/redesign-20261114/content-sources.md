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
| Rule notes (escalate then block; cannot grant approval; three agents, five products; three outputs is not better than one) | Same README sections and post paragraphs, paraphrased closely |
| Ventures: Master Coders 2020, NeuralBytes 2024, Infiniflop Labs 2026 and their one-line descriptions | aravjain.dev live site; neuralbytes.net for IntergalacticPro |
| cc-switch: providers, "40+ providers", npm name | cc-switch README |
| agent-bridge: shared inbox between "your OpenAI dot and Grok Bot", self-hosted MCP server, one owner, own OAuth token each | agent-bridge README |
| ask-around: governance, quorum, veto, receipts, one tool call | ask-around README |
| RydAR: iPhone co-pilot for tight bends in Arkansas, spoken advisory from a bundled database, public map at rydar.org | RydAR README; rydar.org |
| merlin-control: wireframe Merlin 1D driven by bare hands through a webcam, after SpaceX's 2013 "The Future of Design" demo, Three.js and MediaPipe | merlin-control README; merlin.aravhawk.com |
| TensorPoW: reference implementation for Tensorcoin, GPU proof of work, deterministic INT8 tensor computation, Python and PyTorch | TensorPoW README; repo description "The Fastest Blockchain, Powered by GPUs" |
| vampire-hunter: standby power from hourly smart-meter data, unplug experiment, runs in the browser, Kiroween 2026 entry | vampire-hunter README |
| passportphoto: local US passport photo studio, 2 by 2 inch, 300 DPI | passportphoto README |
| lite-stats: trimmed Apple Silicon-only fork of exelban/stats | lite-stats README |
| envfetch: env vars in an encrypted local vault, Secure Enclave key, Touch ID, zsh/bash/fish; archived | envfetch README; repo `archived: true` |
| "Seven merged pull requests to T3 Code between September and November 2026" with titles and numbers | `gh pr list -R pingdotgg/t3code --author aravhawk --state merged` on Nov 14 2026: #2981, #15875, #15876, #15886, #19737, #19791, #33474 |
| Project years | GitHub `created_at` per repo (lite-stats: Dec 2025; the rest 2026) |
| "Six things I built this year. All of them are open source" | The six featured repos are public and were all created in 2026 |
| Interests listed in `content.ts` (agents, dev tools, rockets, GPUs and chains) | The repos named beside each one. This list is in the content file but is not rendered on any page yet |

## Checked and changed since the Nov 9 fact sheet
- New repo: vampire-hunter (created Nov 13 2026). Added to the work index.
- t3code: seven merged PRs now (the latest merged Nov 11). One more is open (#33475) and is not counted.
- The live demo for passportphoto (passportphoto-us.vercel.app) returns 404, so the site links only to its repository.
- mastercoders.dev does not resolve, so Master Coders has no link.
- The agent-bridge homepage URL returns a JSON health check, not a page, so the site links to the repository.
- claudeclaw and fix-it-bot are on the live site's "current projects" list. fix-it-bot is archived on GitHub and claudeclaw is not a public repo, so neither is on the new site.

## Left out, Arav can opt in
These are public in places but were excluded on purpose. Adding any of them is a one-line change in `src/lib/content.ts`.

- Age (shown in the X bio).
- City (shown on the X profile). The RydAR line names Arkansas only because the project is about Arkansas roads.
- School or program details, including the VEX Robotics team repos (99719T, 3400Z).
- Scholarships and internships.
- Income, and anything about trading: the `Trading` repo and NeuralBytes' AlphaPredict (a stock predictor) are not mentioned.
- "DeveloperWeek 2026: 1st place out of 74 submissions". It is on the live site, but the live site does not say which project won and I found no second public source, so it is not on the new one. Give me the project and a link and it goes in.
- A portrait. The site has no photo of Arav. The hero is built so one is not needed.
- Follower and star counts, and any usage numbers. None are claimed.
- Recent X posts. None are quoted.
- Other merged pull requests (pkyanam/agentsocket, Kanishksasi/Investo, the Infiniflop org repos). Only T3 Code is listed.
- infiniview.dev content. infiniflop.com links to it, but the brief limits Infiniview claims to what infiniflop.com says.
