# v4 content sources

Every fact, number and link for the v4 site, re-verified from public sources on Sunday 2026-11-15 between 11:40 and 14:40 CT (America/Chicago). Nothing was invented. All requests were anonymous (logged-out curl or a fresh Playwright browser), so every row is what a visitor can see.

Status key: **OK** = matches the reference. **CHANGED** = verified, but the value or wording differs from the reference; use the value in this file. **DROP** = dead, private or not verifiable; do not ship.

Raw evidence (HTML, JSON, page text, screenshots) is outside git in `~/.t3/portfolio-redesign-v4/sources/` (`raw/`, `links/`, `assets/`). Project fact sheets are in `~/.t3/portfolio-redesign-v4/sources/project-facts.md`.

## Summary of what changed

| Item | Reference | Today | Status |
|---|---|---|---|
| Ollama gemma4 pulls | 1,282 | 1,283 | CHANGED |
| Ollama total pulls | 18,284 | 18,285 | CHANGED |
| GitHub contributions 2026 | 2,612 | 2,689 | CHANGED |
| GitHub contributions lifetime (2021 to 2026) | 2,989 | 3,066 | CHANGED |
| GitHub contributions "last year" | 2,652 | 2,729 | CHANGED |
| Total public merged PRs | 105 | 108 | CHANGED |
| Infiniview one-line description | quoted as site copy | not on the site verbatim | CHANGED (see 3.1) |
| Infiniview stage | early access | marketing site says early access, docs say public beta | CHANGED (see 3.1) |
| Ask Around "won Belweave's Notify Weekend 01" | one claim | true only as a combination of two sources | CHANGED (see 3.9) |
| flux.ai/aravhawk/velocity-flex-2350 | live | "Project not found" | DROP |
| linkedin.com/in/aravjainml | live | login wall, cannot be verified anonymously | DROP (see 2.9) |

## 1. Live metrics

### 1.1 Ollama pulls

| Fact | Value today | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| qwen3.5-opus-4.6 pulls | 9,441 | https://ollama.com/aravhawk | 2026-11-15 11:40 | OK |
| llama4 pulls | 7,363 | https://ollama.com/aravhawk | 2026-11-15 11:40 | OK |
| gemma4 pulls | 1,283 | https://ollama.com/aravhawk | 2026-11-15 11:40 | CHANGED (was 1,282) |
| qwen3.6 pulls | 198 | https://ollama.com/aravhawk | 2026-11-15 11:40 | OK |
| Total pulls, 4 models | 18,285 | sum of the four rows | 2026-11-15 11:40 | CHANGED (was 18,284) |
| llama4 upload date | Apr 11, 2025 2:23 AM UTC as shown in the page tooltip (Apr 10, 2025 9:23 PM CT) | https://ollama.com/aravhawk/llama4 | 2026-11-15 11:40 | OK (the page shows the UTC date, Apr 11 2025) |
| Number of models on the profile | 4 | https://ollama.com/aravhawk | 2026-11-15 11:40 | OK |

### 1.2 npm @aravhawk/cc-switch

| Fact | Value today | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| All-time downloads | 9,840 (2026-02-01 to 2026-11-14; the 2024-08-01 to 2026-01-31 chunk returns 0; 2026-11-15 not yet counted) | https://api.npmjs.org/downloads/range/2026-02-01:2026-11-15/@aravhawk/cc-switch | 2026-11-15 11:41 | OK |
| Last-month downloads | 478 (2026-10-16 to 2026-11-14) | https://api.npmjs.org/downloads/point/last-month/@aravhawk/cc-switch | 2026-11-15 11:41 | OK |
| Last-week downloads | 158 (2026-11-08 to 2026-11-14) | https://api.npmjs.org/downloads/point/last-week/@aravhawk/cc-switch | 2026-11-15 11:41 | OK (new, optional) |
| Current version | 4.0.0, published 2026-11-02 9:24 AM CT | https://registry.npmjs.org/@aravhawk/cc-switch | 2026-11-15 11:41 | OK |
| First publish | 1.0.1 on 2026-02-01 3:36 AM CT; 11 versions on npm | https://registry.npmjs.org/@aravhawk/cc-switch | 2026-11-15 11:41 | OK |

### 1.3 GitHub contributions (public profile, logged out)

Source pattern: `https://github.com/users/aravhawk/contributions?from=YYYY-01-01&to=YYYY-12-31`. Retrieved 2026-11-15 11:41 CT.

| Year | Value today | Status |
|---|---|---|
| 2021 | 11 | OK |
| 2022 | 16 | OK |
| 2023 | 2 | OK |
| 2024 | 162 | OK |
| 2025 | 186 | OK |
| 2026 | 2,689 | CHANGED (was 2,612) |
| Lifetime, 2021 to 2026 | 3,066 | CHANGED (was 2,989) |
| "contributions in the last year" (https://github.com/users/aravhawk/contributions) | 2,729 | CHANGED (was 2,652) |

2020 returns 0 (the account was created 2021-01-20). These counts move daily; re-pull before launch or word them as "as of Nov 15, 2026".

### 1.4 Merged pull requests

Unauthenticated search: `https://api.github.com/search/issues?q=is:pr+is:merged+author:aravhawk+-user:aravhawk+-user:infiniflop+-user:2ALabz+-user:nextup-inspired+-user:navkarcaterers`. Retrieved 2026-11-15 11:41 CT.

| Fact | Value today | Status |
|---|---|---|
| Merged PRs to other people's repos | 21 across 7 repos | OK |
| pingdotgg/t3code | 8 | OK |
| AvinashDevineni/ThrasherAndChambersWebsite | 5 | OK |
| junhoyeo/tokscale | 3 | OK |
| Kanishksasi/Investo | 2 | OK |
| Kilo-Org/kilocode | 1 | OK |
| devMEremenko/XcodeBenchmark | 1 | OK |
| fakerybakery/openbridge | 1 | OK |
| Total public merged PRs (`is:pr is:merged author:aravhawk`) | 108 | CHANGED (was 105) |

Each PR (merged dates in CT; all links returned 200 logged out):

| Repo | PR | Title | Merged (CT) |
|---|---|---|---|
| pingdotgg/t3code | [#2981](https://github.com/pingdotgg/t3code/pull/2981) | fix(web): remember Composer Fast mode across new chats | 2026-09-07 |
| pingdotgg/t3code | [#15876](https://github.com/pingdotgg/t3code/pull/15876) | fix(server): reject invalid explicit Bitbucket repositories | 2026-10-06 |
| pingdotgg/t3code | [#15875](https://github.com/pingdotgg/t3code/pull/15875) | fix(server): preserve ambient Cursor MCP servers | 2026-10-11 |
| pingdotgg/t3code | [#19737](https://github.com/pingdotgg/t3code/pull/19737) | fix(server): reject unresolved explicit preview tabs | 2026-10-18 |
| pingdotgg/t3code | [#15886](https://github.com/pingdotgg/t3code/pull/15886) | fix(server): load merge request diffs on older GitLab | 2026-10-18 |
| pingdotgg/t3code | [#19791](https://github.com/pingdotgg/t3code/pull/19791) | fix(server): PR cache cleanup runs once per shared layer | 2026-10-19 (2026-10-20 UTC) |
| pingdotgg/t3code | [#33474](https://github.com/pingdotgg/t3code/pull/33474) | fix(github): `gh pr new` links the new pull request to the thread | 2026-11-11 |
| pingdotgg/t3code | [#33475](https://github.com/pingdotgg/t3code/pull/33475) | fix(gitlab): `glab mr new` links the new merge request to the thread | 2026-11-14 |
| junhoyeo/tokscale | [#1140](https://github.com/junhoyeo/tokscale/pull/1140) | fix(pricing): resolve OpenAI Daybreak Blue alias | 2026-08-18 |
| junhoyeo/tokscale | [#1430](https://github.com/junhoyeo/tokscale/pull/1430) | fix(cursor): sync incrementally with isolated account caches | 2026-10-15 |
| junhoyeo/tokscale | [#1397](https://github.com/junhoyeo/tokscale/pull/1397) | fix(cursor): sync a signed-in desktop session into usage reports | 2026-10-17 |
| Kilo-Org/kilocode | [#6458](https://github.com/Kilo-Org/kilocode/pull/6458) | fix: add flexShrink={0} to prompt border box to prevent shrinking | 2026-04-08 |
| devMEremenko/XcodeBenchmark | [#575](https://github.com/devMEremenko/XcodeBenchmark/pull/575) | Add M3 Pro 12-core MacBook Pro 14" | 2025-03-29 |
| fakerybakery/openbridge | [#9](https://github.com/fakerybakery/openbridge/pull/9) | Add a proper license | 2025-07-16 (2025-07-17 UTC) |
| AvinashDevineni/ThrasherAndChambersWebsite | [#1](https://github.com/AvinashDevineni/ThrasherAndChambersWebsite/pull/1) | Add compound interest calculator with input validation | 2025-04-01 (2025-04-02 UTC) |
| AvinashDevineni/ThrasherAndChambersWebsite | [#5](https://github.com/AvinashDevineni/ThrasherAndChambersWebsite/pull/5) | Easier to follow README with more detailed instructions | 2025-04-16 |
| AvinashDevineni/ThrasherAndChambersWebsite | [#6](https://github.com/AvinashDevineni/ThrasherAndChambersWebsite/pull/6) | Fix image rendering issue | 2025-04-17 |
| AvinashDevineni/ThrasherAndChambersWebsite | [#7](https://github.com/AvinashDevineni/ThrasherAndChambersWebsite/pull/7) | Modernize UI with fluid design and animations | 2025-04-20 |
| AvinashDevineni/ThrasherAndChambersWebsite | [#10](https://github.com/AvinashDevineni/ThrasherAndChambersWebsite/pull/10) | Hamburger menu for mobile + sitewide footer | 2025-05-05 |
| Kanishksasi/Investo | [#4](https://github.com/Kanishksasi/Investo/pull/4) | Redesign the site: sharper hero, cleaner sections, unified pages | 2026-11-13 |
| Kanishksasi/Investo | [#5](https://github.com/Kanishksasi/Investo/pull/5) | Hero spacing, word-reveal fix, new Open Graph image | 2026-11-15 |

## 2. Links

Method: `curl -sIL` (HEAD, follow redirects), logged out, 2026-11-15 11:42 to 11:45 CT. Where HEAD was refused or the site blocks curl, the URL was retried in Playwright (noted). Evidence: `~/.t3/portfolio-redesign-v4/sources/links/`.

### 2.1 Infiniview and Infiniflop

| Link | Final status | Status |
|---|---|---|
| https://infiniview.dev | 200 | OK |
| https://docs.infiniview.dev | 200 | OK |
| https://infiniflop.com | 200 | OK |
| https://github.com/infiniflop | 200 (3 public repos: infiniflop.com, infiniview-web-frontend, infiniview-docs) | OK |
| https://infiniview.dev/preview (interactive demo, extra) | 200 | OK |

### 2.2 Contribution PRs

| Link | Final status | Status |
|---|---|---|
| https://github.com/pingdotgg/t3code/pulls?q=is%3Apr+author%3Aaravhawk+is%3Amerged | 200 | OK |
| pingdotgg/t3code #33474 #33475 #15875 #2981 #15876 #15886 #19737 #19791 | 200 each | OK |
| junhoyeo/tokscale #1140 #1397 #1430 | 200 each | OK |
| Kilo-Org/kilocode #6458 | 200 | OK |
| devMEremenko/XcodeBenchmark #575 | 200 | OK |
| fakerybakery/openbridge #9 | 200 | OK |
| AvinashDevineni/ThrasherAndChambersWebsite #1 #5 #6 #7 #10 | 200 each | OK |
| Kanishksasi/Investo #4 #5 | 200 each | OK |

### 2.3 Ollama and cc-switch

| Link | Final status | Status |
|---|---|---|
| https://ollama.com/aravhawk | HEAD 405 (method not allowed); GET 200 with curl and in headless Chromium | OK |
| https://ollama.com/aravhawk/qwen3.5-opus-4.6 | HEAD 405; GET 200 | OK |
| https://ollama.com/aravhawk/llama4 | HEAD 405; GET 200 | OK |
| https://ollama.com/aravhawk/gemma4 | HEAD 405; GET 200 | OK |
| https://ollama.com/aravhawk/qwen3.6 | HEAD 405; GET 200 | OK |
| https://github.com/aravhawk/cc-switch | 200 | OK |
| https://www.npmjs.com/package/@aravhawk/cc-switch | curl 403 (Cloudflare bot check); headed Firefox via Playwright 200, page shows "4.0.0 • Public • Published 13 days ago" | OK |

### 2.4 Projects

| Link | Final status | Status |
|---|---|---|
| https://devpost.com/software/kilo-bench-native-model-benchmarking-in-kilo-code | 200 (headless Chromium gets 403; curl GET with a browser UA returns the page) | OK |
| https://github.com/aravhawk/kilobench | 200 | OK |
| https://github.com/aravhawk/agent-bridge | 200 | OK |
| https://x.com/aravhawk/status/2117458115134472437 | curl 200 is only the app shell; confirmed in headed Chromium via Playwright (post by @aravhawk, Nov 2, 2026 9:25 PM CT, with video) and via the public syndication API | OK |
| https://github.com/aravhawk/TensorPoW | 200 | OK |
| https://rydar.org | 200 | OK |
| https://github.com/aravhawk/RydAR | 200 | OK |
| https://github.com/aravhawk/ClarifAI | 200 | OK |
| https://devpost.com/software/clarifai-6pg03u | 200 | OK |
| https://github.com/aravhawk/ask-around | 200 | OK |
| https://x.com/pkyanam/status/2120163766713430040 | confirmed in headed Chromium via Playwright (post by @pkyanam, Nov 10, 2026 8:36 AM CT) | OK |
| https://github.com/aravhawk/fix-it-bot | 200 | OK |
| https://github.com/aravhawk/oxydrop | 200 | OK |
| https://aravhawk.github.io/oxydrop | 301 to https://aravhawk.github.io/oxydrop/ then 200 | OK (link the trailing-slash form) |
| https://flux.ai/aravhawk/velocity-flex-2350 | 301 to www.flux.ai then HTTP 200, but the rendered page (Playwright) is titled "Project not found · Flux": "The project you're looking for doesn't exist or you don't have permission to view it." | **DROP** (soft 404; project is private or deleted) |
| https://github.com/aravhawk/99719T | 200 | OK |
| https://github.com/aravhawk/3400Z | 200 | OK |
| https://www.businessinsider.com/coders-keep-laptops-open-in-public-ai-agent-2026-5 | 200 | OK |
| https://aravjain.dev/blog/three-ai-agents-five-saas-products | 200 (dated April 18, 2026, 7 min read) | OK |
| https://github.com/2ALabz/goFoundr | 200 | OK |
| https://merlin.aravhawk.com | 200 (page title names it Merlin 1D, a hand-controlled 3D visualizer) | OK |
| https://github.com/aravhawk/merlin-control | 200 | OK |

Not on the list but found dead while reading sources: https://clarifai-now.vercel.app (the ClarifAI live app linked from its repo and Devpost) returns 404. Do not link it.

### 2.5 Archive repos

All returned 200 logged out: https://github.com/aravhawk/Weather-Station-BMP280, /IntergalacticPro, /SumQuick, /neuralbytes.net, /ChatGPT-3.5-with-Vision, /lite-stats, /envfetch, /claude-code-utils, /passportphoto, /typing-game, /CryptoLab.swiftpm, /teamastros, /who-wants-to-be-a-billionaire, /escaperoom, /workjet-ms, /workjet-google, /top10tipsforsurvival. Status: OK for all 17.

| Link | Final status | Status |
|---|---|---|
| https://neuralbytes.net | 200 (title "NeuralBytes") | OK |
| https://github.com/exelban/stats | 200 | OK |
| https://github.com/nextup-inspired/nextup-site | 200 | OK |

### 2.9 Contact

| Link | Final status | Status |
|---|---|---|
| https://github.com/aravhawk | 200 | OK |
| https://x.com/aravhawk | confirmed in headed Chromium via Playwright (profile "Arav Jain @aravhawk", links infiniview.dev) | OK |
| https://www.linkedin.com/in/aravjainml | curl HTTP 999; headless Chromium and headed Firefox both redirect to linkedin.com/authwall (sign-up page) | **DROP** under the "public 200 only" rule. Reason: LinkedIn blocks all anonymous automated access, so the profile could not be confirmed either way. This is very likely a bot wall and not a dead profile; the owner can confirm by hand in a private window and overrule this. |

## 3. Claims

### 3.1 Infiniview

| Claim | What the public pages say | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| One-liner: "Infiniview connects to your GitHub, deploys your app in a sandbox, and runs real attacks against it. You get replayable proof of what broke." | That sentence is not on infiniview.dev, docs.infiniview.dev or infiniflop.com. Each part is supported, so it can run as the site's own summary, but not inside quotation marks or attributed as Infiniview copy. Supporting text: "Connect your repo and Infiniview runs a full security audit, code review, and interaction stress test on every pull request and on demand, inside isolated cloud sandboxes." / "Your repo is cloned, built, and deployed in a secure sandbox, fully isolated from production." / "AI agents deploy your app in a sandbox and attempt real attacks: SQL injection, auth bypass, SSRF, session hijacking." / "Proof bundles you can replay, export, and compare across runs." | https://infiniview.dev | 2026-11-15 11:57 | CHANGED (paraphrase only; not verbatim) |
| Official headline and description | "Attack your code before anyone else does." Meta description: "AI-powered code review, SAST, DAST, and penetration testing [dash in original] fully automated in cloud sandboxes. Proof-backed security findings for every vulnerability." (the original uses a long dash where marked; reword if reused) | https://infiniview.dev | 2026-11-15 11:57 | OK |
| Infiniflop's description | "we're building Infiniview. AI-powered code review and security testing. Agents that review, probe, and stress-test your code in cloud sandboxes." | https://infiniflop.com | 2026-11-15 11:57 | OK |
| In early access | infiniview.dev: nav button "Early access", form button "Get early access", FAQ item "How do I get access?". The docs disagree: "Infiniview is currently in public beta." | https://infiniview.dev and https://docs.infiniview.dev | 2026-11-15 11:57 | CHANGED: "early access" is supported by the marketing site; the docs say "public beta". Pick one and be aware of the mismatch. |
| Scanner count | Marketing site: "26 scanners and security tools", "26 static scanners", "12 runtime attack agents", "4 parallel code review agents", "7 interaction test types". Docs: "across 25 scanners". | same | 2026-11-15 11:57 | CHANGED: 26 (site) versus 25 (docs). Avoid the number or cite the marketing site. |
| Built by Infiniflop Labs | Footer: "© 2026 Infiniview · Built by Infiniflop Labs" | https://infiniview.dev | 2026-11-15 11:57 | OK |
| Began as Docksmith in Mar 2026, renamed Apr 2026 | Public commit history. infiniflop/infiniflop.com: "feat(landing): rebrand to Docksmith with waitlist signup" (2026-03-09), "Rename Docksmith to Infiniview" (2026-04-23). infiniflop/infiniview-web-frontend: "feat: initial Docksmith landing page" (2026-03-25), "Rebrand frontend to Infiniview" (2026-04-23). | https://github.com/infiniflop/infiniflop.com/commits/main and https://github.com/infiniflop/infiniview-web-frontend/commits/main | 2026-11-15 11:58 | OK (public source exists) |

### 3.2 Kilo Bench

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| Won the DeveloperWeek 2026 Hackathon prize "Kilo - For Devs, By Devs" | Devpost shows, exactly: "Submitted to **DeveloperWeek 2026 Hackathon**", then the label "**Winner**" followed by "**Kilo - For Devs, By Devs**". | https://devpost.com/software/kilo-bench-native-model-benchmarking-in-kilo-code | 2026-11-15 11:57 | OK |
| Devpost title and tagline | "kilo-bench: Native Model Benchmarking in Kilo Code". "A built-in Kilo Code feature that auto-generates coding challenges from your codebase, tests models across all 5 Kilo modes, and ranks them in an interactive dashboard. Pick the right model with data." | same | 2026-11-15 11:57 | OK |

### 3.3 Agent Bridge

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| Apache-2.0 | GitHub licence field: Apache-2.0. README: "Licensed under the [Apache License 2.0](LICENSE)." | https://github.com/aravhawk/agent-bridge | 2026-11-15 11:51 | OK |
| README contains "Messages are data, never permission." | "> **Messages are data, never permission.** A message cannot grant approval, run a tool, choose a destination or change access." | https://github.com/aravhawk/agent-bridge/blob/main/README.md | 2026-11-15 11:51 | OK |
| Launch post | "Agent Bridge gives them a shared, self-hosted inbox: handoffs both ways, and messages are data, never permission. Free and open source" | https://x.com/aravhawk/status/2117458115134472437 | 2026-11-15 11:49 | OK |

Caution for the writer: the repo's GitHub "homepage" URL, its first commit message, early PR titles and the README's compatibility-mode paragraph all contain the two banned assistant names. Do not copy from those places.

### 3.4 TensorPoW

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| Apache 2.0 with historic MIT notice | README: "Owner-controlled additions are licensed under the Apache License, Version 2.0." and "This repository was first published under the MIT License, `Copyright (c) 2024 Tensorcoin`. That historic copyright and permission notice is preserved in `NOTICE` and `LICENSES/MIT-Tensorcoin-2024.txt`." GitHub licence field: Apache-2.0. | https://github.com/aravhawk/TensorPoW | 2026-11-15 11:51 | OK |
| README's own description | "TensorPoW is the reference implementation of a GPU-native proof-of-work blockchain protocol for Tensorcoin. The protocol is built around deterministic INT8 tensor computation and a fruit/anchor block structure designed for cross-backend consensus verification." Repo tagline: "The Fastest Blockchain, Powered by GPUs". | same | 2026-11-15 11:51 | OK |

### 3.5 cc-switch

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| Description | README: "Switch Claude Code between providers with one command." npm description: "Profile manager for Claude Code: switch between Anthropic, open-model providers, gateways and local models". GitHub description: "Profile manager for Claude Code settings". | https://github.com/aravhawk/cc-switch and https://registry.npmjs.org/@aravhawk/cc-switch | 2026-11-15 11:51 | OK |
| Licence | MIT (GitHub licence field, npm `license`, README) | same | 2026-11-15 11:51 | OK |
| Providers | "Supports 40+ providers: Anthropic, open-model labs (Z.ai GLM, Kimi, DeepSeek, MiniMax, Qwen, ...), gateways (OpenRouter, LiteLLM, ...), local servers (Ollama, LM Studio, vLLM, ...) and cloud platforms (Bedrock, Google Cloud, Foundry)." The README tables list 41 templates. | README | 2026-11-15 11:51 | OK |
| Main commands | `cc-switch` (interactive menu), `cc-switch <name>` (switch), `cc-switch --create <name> --template <provider>`, `--list`, `--current`, `--show`, `--test`, `--set-key`, `--refresh`, `--rename`, `--delete`, `--providers`. Install: `npm install -g @aravhawk/cc-switch`. | README | 2026-11-15 11:51 | OK |

### 3.6 RydAR

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| Spoken advisory "Slow to 25 mph for the curve ahead" | README: "A single-curve prompt says, for example, \"Slow to 25 mph for the curve ahead,\" using the low end of the computed range, rounded down." rydar.org/iphone-app: "Spoken warnings" / "“Slow to 25 mph for the curve ahead.”" | https://github.com/aravhawk/RydAR and https://rydar.org/iphone-app | 2026-11-15 14:35 | OK |
| On-device paved/unpaved check | README: "the drive screen shows a small live thumbnail of what the camera sees and a live Paved or Unpaved label for the road under the car... Frames are displayed, never saved." and "The bundled model is MobileNetV4-Conv-Small with three heads, trained on RSCD and converted to Core ML." rydar.org: "Camera stays on the phone" / "Frames are checked on the phone. Never saved or uploaded." | same, plus https://rydar.org/data-and-privacy | 2026-11-15 14:35 | OK |
| App Attest | README: "Each install makes one App Attest key, which Apple attests once through `/api/attest`; every trip's batch is then signed on the phone with an assertion". rydar.org: "it makes a signing key inside your iPhone’s Secure Enclave, and Apple’s App Attest confirms the key belongs to the genuine RydAR app on a real iPhone." | same | 2026-11-15 14:35 | OK |
| Site wording and curve count | "Arkansas curve map & iPhone curve warnings"; "Showing 153,328 curves in Arkansas"; meta: "RydAR maps 153,328 curves on Arkansas roads, with a suggested speed for each." App Store link on the site returns 200: https://apps.apple.com/us/app/rydar-safe-driving/id6827042655 | https://rydar.org | 2026-11-15 14:35 | OK |

### 3.7 OxyDrop

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| Caveat | README, exact: "**This project is a prototype and is not medical advice.** It does not measure SpO2, is not a medical device, and the key low-oxygen result rests on only six people. Never use it instead of a pulse oximeter or a clinician." Live app, exact: "This project is a prototype and is not medical advice. It is a research demo validated on only 6 people. It does not measure SpO₂, it is not a medical device, and it must never replace a pulse oximeter or a clinician." | https://github.com/aravhawk/oxydrop and https://aravhawk.github.io/oxydrop/ | 2026-11-15 11:57 | OK (use one of these exact wordings; "validated on only 6 people" is the app's phrase, "rests on only six people" is the README's) |

### 3.8 ClarifAI and fix-it-bot

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| ClarifAI Devpost description | "ClarifAI uses AI to guide healthier conversations between couples and roommates during conflict." Submitted to United Hacks V6 (no winner label shown). Four creators are listed; it was a team project. | https://devpost.com/software/clarifai-6pg03u | 2026-11-15 11:57 | OK |
| fix-it-bot README description | "Drop-in React component for submitting bug reports to [Kilo](https://kilo.ai) AI agents. Submit a bug report, Kilo analyzes the repo and creates a pull request automatically." | https://github.com/aravhawk/fix-it-bot | 2026-11-15 11:51 | OK |

### 3.9 Ask Around

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| Quorum, veto, "silence is never a yes" | README: "Each question goes only to its owner, quorum and veto are enforced, and silence is never a yes." Also "N-of-M quorum, and any deny vetoes" and "**A timeout is never approval.**" | https://github.com/aravhawk/ask-around | 2026-11-15 11:51 | OK |
| Won Belweave's Notify Weekend 01 | No single public source says this sentence. Two sources together support it. README: "Built at **Notify Weekend 01** with [Notify](https://notify.belweave.ai) for delivery and Belweave **Kai-4** for planning." Post by @pkyanam (bio: "owner of @belweave"): "@aravhawk is our winner! Congratulations Arav! You built the coolest demo for Notify that directly helps influences the upcoming A2A system! Enjoy your $1,000 in tokens towards @deepseek_ai V4.1 Flash 1017." | README and https://x.com/pkyanam/status/2120163766713430040 | 2026-11-15 11:58 | CHANGED: usable, but the post does not name "Notify Weekend 01". Safest wording: "Built at Notify Weekend 01; named the winner by Belweave's owner", with the post linked. |

### 3.10 goFoundr, lite-stats, Business Insider

| Claim | Supporting text | Source | Retrieved (CT) | Status |
|---|---|---|---|---|
| goFoundr commit share | 25 of 26 commits on the default branch are by aravhawk (the other 1 by GamerXVerse). | https://api.github.com/repos/2ALabz/goFoundr/contributors | 2026-11-15 11:55 | OK |
| lite-stats credits exelban/stats | README: "Lite Stats is a trimmed, Apple Silicon-only fork of https://github.com/exelban/stats focused on low-overhead system monitoring from the macOS menu bar." | https://github.com/aravhawk/lite-stats | 2026-11-15 11:51 | OK |
| Business Insider quote "I got agents running." | The article reads: "\"I'm like, 'I got agents running,'\" Jain said. \"I've got to keep shipping software.\"" Note the first quote sits inside "I'm like, '...'" and ends with a comma in the original. | https://www.businessinsider.com/coders-keep-laptops-open-in-public-ai-agent-2026-5 | 2026-11-15 11:57 | OK |
| Business Insider quote "I've got to keep shipping software." | Same sentence as above, verbatim. | same | 2026-11-15 11:57 | OK |
| Article details | Headline: "AI coders are carrying half-open laptops through airports, offices, and ice rinks". By Henry Chandonnet. Published 2026-05-12. | same | 2026-11-15 14:36 | OK |

Personal details in that article (age, city, school, grade) were deliberately not recorded here and must not appear on the site.
