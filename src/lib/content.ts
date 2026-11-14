/**
 * Every fact on the site lives here, and every one traces to a public source.
 * Sources and fetch dates: docs/redesign-20261114/content-sources.md
 */

export const person = {
  name: 'Arav Jain',
  handle: 'aravhawk',
  role: 'Co-founder, Infiniflop Labs',
  email: 'aravhawk@gmail.com',
  links: [
    { label: 'GitHub', handle: 'aravhawk', href: 'https://github.com/aravhawk' },
    { label: 'X', handle: '@aravhawk', href: 'https://x.com/aravhawk' },
    { label: 'LinkedIn', handle: 'aravjainml', href: 'https://linkedin.com/in/aravjainml' },
  ],
};

/** The statement after the hero. Read one word at a time. */
export const statement =
  "I'm Arav. I build AI agents and the dev tools around them. Most of what I make checks other software: it reviews code, probes it, and tries to break it before a user does.";

export const now = {
  company: 'Infiniflop Labs',
  founded: '2026',
  product: 'Infiniview',
  // Verbatim from infiniflop.com, Nov 14 2026.
  line: 'AI-powered code review and security testing. Agents that review, probe, and stress-test your code in cloud sandboxes.',
  href: 'https://infiniflop.com',
  hrefLabel: 'infiniflop.com',
};

export type Rule = { text: string; from: string; href: string; note: string };

/** How I think, in my own words. Each line is quoted from something I shipped or wrote. */
export const rules: Rule[] = [
  {
    text: 'Silence is never a yes.',
    from: 'ask-around, README',
    href: 'https://github.com/aravhawk/ask-around',
    note: 'When an agent asks people to decide, a missing answer escalates to a backup and then blocks. It never approves.',
  },
  {
    text: 'Messages are data, never permission.',
    from: 'agent-bridge, README',
    href: 'https://github.com/aravhawk/agent-bridge',
    note: 'One assistant can hand work to another. It cannot grant approval, run a tool or change access by saying so.',
  },
  {
    text: 'Someone has to read the code.',
    from: 'Blog, April 2026',
    href: '/blog/three-ai-agents-five-saas-products',
    note: 'I let three coding agents ship five products with nobody watching. I would not ship any of them.',
  },
  {
    text: "If your eval is throughput, you're measuring the wrong thing.",
    from: 'Blog, April 2026',
    href: '/blog/three-ai-agents-five-saas-products',
    note: "Three outputs isn't better than one good output.",
  },
];

export type Venture = { year: string; name: string; state: string; line: string; href?: string; hrefLabel?: string };

export const ventures: Venture[] = [
  {
    year: '2020',
    name: 'Master Coders',
    state: 'Archived',
    line: 'Free live coding lessons. Students built real projects from scratch.',
  },
  {
    year: '2024',
    name: 'NeuralBytes',
    state: 'Archived',
    line: 'AI tools and experiments, including IntergalacticPro, a space and rockets expert.',
    href: 'https://neuralbytes.net',
    hrefLabel: 'neuralbytes.net',
  },
  {
    year: '2026',
    name: 'Infiniflop Labs',
    state: 'Building',
    line: "Co-founded in 2026. We're building Infiniview.",
    href: 'https://infiniflop.com',
    hrefLabel: 'infiniflop.com',
  },
];

export type Project = {
  slug: string;
  name: string;
  year: string;
  kind: string;
  stack: string;
  line: string;
  detail: string;
  links: { label: string; href: string }[];
  featured?: boolean;
  archived?: boolean;
  group: Group;
};

export type Group = 'agents' | 'apps' | 'markets' | 'robots';

export const groups: { id: Group; title: string; lead: string }[] = [
  { id: 'agents', title: 'Agents and tools', lead: 'Agent tooling and the dev tools I use every day.' },
  { id: 'apps', title: 'Apps', lead: 'Things I built because I wanted them to exist.' },
  { id: 'markets', title: 'Markets and chains', lead: 'A blockchain that mines on GPUs, a trading bot and a stock predictor.' },
  { id: 'robots', title: 'Robots and hardware', lead: 'Competition robot code and a weather station.' },
];

export const projects: Project[] = [
  {
    slug: 'cc-switch',
    group: 'agents',
    name: 'cc-switch',
    year: '2026',
    kind: 'CLI',
    stack: 'TypeScript',
    line: 'Switch Claude Code between providers with one command.',
    detail: 'A profile for your Claude subscription, one for Kimi, one for a local Ollama model, one for work on Bedrock. Templates for 40+ providers. On npm as @aravhawk/cc-switch.',
    links: [
      { label: 'GitHub', href: 'https://github.com/aravhawk/cc-switch' },
      { label: 'npm', href: 'https://www.npmjs.com/package/@aravhawk/cc-switch' },
    ],
    featured: true,
  },
  {
    slug: 'agent-bridge',
    group: 'agents',
    name: 'agent-bridge',
    year: '2026',
    kind: 'MCP server',
    stack: 'TypeScript',
    line: 'A shared inbox between your OpenAI Dot and Grok Bot.',
    detail: 'Self-hosted, for one owner. The two assistants exchange messages, status updates and handoff requests without you copying context between chats. Each signs in with its own OAuth token.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/agent-bridge' }],
    featured: true,
  },
  {
    slug: 'ask-around',
    group: 'agents',
    name: 'ask-around',
    year: '2026',
    kind: 'Agent tool',
    stack: 'Python',
    line: 'Governance for agents that ask people.',
    detail: 'Who may answer, how many must agree, and what silence means. One tool call. Quorum and veto are enforced, and every ask and answer lands in a receipt.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/ask-around' }],
    featured: true,
  },
  {
    slug: 'rydar',
    group: 'apps',
    name: 'RydAR',
    year: '2026',
    kind: 'iPhone app',
    stack: 'Swift',
    line: 'An iPhone co-pilot for tight bends in Arkansas.',
    detail: 'It speaks a speed advisory before each curve from a database bundled in the app, and it publishes a public map of those bends at rydar.org.',
    links: [
      { label: 'rydar.org', href: 'https://rydar.org' },
      { label: 'GitHub', href: 'https://github.com/aravhawk/RydAR' },
    ],
    featured: true,
  },
  {
    slug: 'merlin-control',
    group: 'apps',
    name: 'merlin-control',
    year: '2026',
    kind: 'Web toy',
    stack: 'Three.js, MediaPipe',
    line: 'A SpaceX Merlin 1D you spin with your bare hands.',
    detail: "A wireframe engine floating in space, driven through a webcam. Grab it, rotate it, flick it into a free spin, then catch it. A browser take on SpaceX's 2013 The Future of Design demo.",
    links: [
      { label: 'merlin.aravhawk.com', href: 'https://merlin.aravhawk.com' },
      { label: 'GitHub', href: 'https://github.com/aravhawk/merlin-control' },
    ],
    featured: true,
  },
  {
    slug: 'tensorpow',
    group: 'markets',
    name: 'TensorPoW',
    year: '2026',
    kind: 'Protocol',
    stack: 'Python, PyTorch',
    line: 'A proof-of-work blockchain that mines on GPUs.',
    detail: 'The reference implementation for Tensorcoin. Deterministic INT8 tensor computation, so different backends can verify the same work.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/TensorPoW' }],
    featured: true,
  },
  {
    slug: 'vampire-hunter',
    group: 'apps',
    name: 'vampire-hunter',
    year: '2026',
    kind: 'Hackathon entry',
    stack: 'Python',
    line: 'Find the power your home bleeds at night.',
    detail: 'Reads the hourly smart-meter file from your utility, ranks the loads that never switch off, then checks the saving with an unplug experiment. Runs in your browser. Built for Kiroween 2026.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/vampire-hunter' }],
  },
  {
    slug: 'passportphoto',
    group: 'apps',
    name: 'passportphoto',
    year: '2026',
    kind: 'Web app',
    stack: 'TypeScript',
    line: 'A US passport photo studio that runs locally.',
    detail: 'Capture or upload, frame against the official guides, whiten the background, export a print-ready 2 by 2 inch file at 300 DPI.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/passportphoto' }],
  },
  {
    slug: 'lite-stats',
    group: 'agents',
    name: 'lite-stats',
    year: '2025',
    kind: 'macOS app',
    stack: 'Swift',
    line: 'A lightweight system monitor for the menu bar.',
    detail: 'A trimmed, Apple Silicon-only fork of exelban/stats. CPU, GPU, RAM, disk and sensors with low overhead.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/lite-stats' }],
  },
  {
    slug: 'envfetch',
    group: 'agents',
    name: 'envfetch',
    year: '2026',
    kind: 'macOS CLI',
    stack: 'Swift',
    line: 'Environment variables behind Touch ID.',
    detail: 'Stores profiles in an encrypted local vault with a Secure Enclave key, and activates them in zsh, bash or fish.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/envfetch' }],
    archived: true,
  },
  {
    slug: 'claude-code-utils',
    group: 'agents',
    name: 'claude-code-utils',
    year: '2026',
    kind: 'Config',
    stack: 'Shell',
    line: 'Claude Code plugins and config I use daily.',
    detail: 'Shell scripts and settings.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/claude-code-utils' }],
    archived: true,
  },
  {
    slug: 'fix-it-bot',
    group: 'agents',
    name: 'fix-it-bot',
    year: '2026',
    kind: 'React component',
    stack: 'TypeScript',
    line: 'Bug reports that become pull requests.',
    detail: 'A drop-in React component. Someone submits a bug report, a Kilo AI agent analyzes the repo and opens a pull request.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/fix-it-bot' }],
    archived: true,
  },
  {
    slug: 'kilobench',
    group: 'agents',
    name: 'kilobench',
    year: '2026',
    kind: 'Benchmark',
    stack: 'TypeScript',
    line: 'A model benchmarking feature for Kilo Code.',
    detail: 'The repository carries the Kilo Code source with the benchmark added.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/kilobench' }],
    archived: true,
  },
  {
    slug: 'claudeclaw',
    group: 'agents',
    name: 'claudeclaw',
    year: '',
    kind: 'Assistant',
    stack: 'Claude Agents SDK',
    line: 'A multi-platform AI assistant.',
    detail: 'Built on the Claude Agents SDK. The repository is not public.',
    links: [],
  },
  {
    slug: 'tempify',
    group: 'apps',
    name: 'tempify',
    year: '2026',
    kind: 'Web app',
    stack: 'TypeScript',
    line: 'Study music that follows what you are working on.',
    detail: 'It captures your screen every 10 seconds, reads the activity with a vision model, and generates instrumental music to match. Built for students with ADHD, anxiety, dyslexia and chronic fatigue.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/tempify' }],
    archived: true,
  },
  {
    slug: 'clarifai',
    group: 'apps',
    name: 'ClarifAI',
    year: '2026',
    kind: 'Web app',
    stack: 'TypeScript',
    line: 'Conflict mediation for couples and roommates.',
    detail: 'Both people give their side in a private room, get AI analysis and suggested compromises, then move into a guided, turn-based chat.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/ClarifAI' }],
    archived: true,
  },
  {
    slug: 'typing-game',
    group: 'apps',
    name: 'typing-game',
    year: '2026',
    kind: 'Web game',
    stack: 'TypeScript',
    line: 'A minimal typing test with live WPM and a race mode.',
    detail: 'Called anytype in its README. 15 or 30 second tests, leaderboards, shareable results, and a ghost cursor to race anyone on the board.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/typing-game' }],
    archived: true,
  },
  {
    slug: 'cryptolab',
    group: 'apps',
    name: 'CryptoLab',
    year: '2025',
    kind: 'iPad app',
    stack: 'Swift',
    line: "Submitted to Apple's 2025 Swift Student Challenge.",
    detail: 'A Swift Playgrounds app. It needs an iPad with AR support and a Secure Enclave.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/CryptoLab.swiftpm' }],
    archived: true,
  },
  {
    slug: 'askrosie',
    group: 'apps',
    name: 'askrosie',
    year: '2026',
    kind: 'Study clone',
    stack: 'TypeScript',
    line: "A local study clone of a museum's AI companion.",
    detail: 'Rebuilt in the Next.js App Router to learn how it works. The brand and photography belong to the museum, so it is not for redeploy.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/askrosie' }],
    archived: true,
  },
  {
    slug: 'trading',
    group: 'markets',
    name: 'Trading',
    year: '2026',
    kind: 'Trading bot',
    stack: 'Shell, Claude Code',
    line: 'An autonomous equities and options trading bot.',
    detail: "Runs on the Claude Code CLI and Alpaca's trading API over MCP. It trades 14 strategies, keeps its own memory across sessions, and sets trap orders to catch moves between runs.",
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/Trading' }],
    archived: true,
  },
  {
    slug: 'alphapredict',
    group: 'markets',
    name: 'AlphaPredict',
    year: '2024',
    kind: 'NeuralBytes app',
    stack: 'Python',
    line: 'A stock market predictor with charts and company details.',
    detail: 'One of the two NeuralBytes apps, with its own signup page.',
    links: [
      { label: 'GitHub', href: 'https://github.com/aravhawk/AlphaPredict' },
      { label: 'Signup page source', href: 'https://github.com/aravhawk/AlphaPredict-Signup' },
    ],
    archived: true,
  },
  {
    slug: '99719t',
    group: 'robots',
    name: '99719T',
    year: '2025',
    kind: 'Robot code',
    stack: 'Python',
    line: 'Source code for VEX Robotics Team 99719T.',
    detail: 'The 2025 to 2026 season.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/99719T' }],
    archived: true,
  },
  {
    slug: '3400z',
    group: 'robots',
    name: '3400Z',
    year: '2025',
    kind: 'Robot code',
    stack: 'VEX',
    line: 'Source code for VEX Robotics Team 3400Z.',
    detail: 'The 2024 to 2025 season.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/3400Z' }],
    archived: true,
  },
  {
    slug: 'weather-station',
    group: 'robots',
    name: 'Weather-Station-BMP280',
    year: '2023',
    kind: 'Hardware',
    stack: 'Python, Raspberry Pi',
    line: 'A Raspberry Pi weather station.',
    detail: 'Reads a BMP280 sensor and records everything in an Excel workbook.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/Weather-Station-BMP280' }],
    archived: true,
  },
];

/** Older and smaller repos. Only what GitHub itself says about each: name, year, language, description. */
export const earlier: { name: string; year: string; lang: string; note?: string }[] = [
  { name: 'Macro-Guru', year: '2025', lang: 'TypeScript' },
  { name: 'neuralbytes.net', year: '2024', lang: 'TypeScript', note: 'Source for the NeuralBytes website' },
  { name: 'IntergalacticPro', year: '2024', lang: 'Python', note: 'A space and rockets expert. NeuralBytes app' },
  { name: 'SumQuick', year: '2024', lang: 'Python', note: 'Local AI summarization with Ollama' },
  { name: 'ChatGPT-3.5-with-Vision', year: '2024', lang: 'Python', note: 'GPT-3.5 reading documents, PDFs and code' },
  { name: 'escaperoom', year: '2022', lang: 'HTML' },
  { name: 'workjet-ms', year: '2022', lang: 'HTML' },
  { name: 'workjet-google', year: '2022', lang: 'HTML' },
  { name: 'wordle-clone', year: '2022', lang: 'JavaScript', note: 'Built from a freeCodeCamp article' },
  { name: 'who-wants-to-be-a-billionaire', year: '2022', lang: 'HTML' },
  { name: 'teamastros', year: '2022', lang: 'HTML' },
  { name: 'top10tipsforsurvival', year: '2021', lang: 'HTML' },
];

export type Upstream = { repo: string; label?: string; count: number; span: string; latest: string };

/** Merged pull requests to public repositories outside my own account. GitHub search, Nov 14 2026. */
export const upstream: Upstream[] = [
  { repo: 'pingdotgg/t3code', count: 8, span: 'Sep to Nov 2026', latest: 'glab mr new links the new merge request to the thread' },
  { repo: 'junhoyeo/tokscale', count: 3, span: 'Aug to Oct 2026', latest: 'Cursor: sync incrementally with isolated account caches' },
  { repo: 'Kilo-Org/kilocode', count: 1, span: 'Apr 2026', latest: 'Stop the prompt border box from shrinking' },
  { repo: 'Kanishksasi/Investo', count: 1, span: 'Nov 2026', latest: 'Redesign the site: sharper hero, cleaner sections, unified pages' },
  { repo: 'fakerybakery/openbridge', count: 1, span: 'Jul 2025', latest: 'Add a proper license' },
  { repo: 'AvinashDevineni/ThrasherAndChambersWebsite', count: 5, span: 'Apr to May 2025', latest: 'Hamburger menu for mobile and a sitewide footer' },
  { repo: 'devMEremenko/XcodeBenchmark', count: 1, span: 'Mar 2025', latest: 'Add M3 Pro 12-core MacBook Pro 14 inch' },
  { repo: 'infiniflop/infiniview-web-frontend', label: 'Infiniflop Labs', count: 6, span: 'Aug to Nov 2026', latest: 'Redesign marketing site: a corridor of glass frames' },
  { repo: 'infiniflop/infiniflop.com', label: 'Infiniflop Labs', count: 5, span: 'Nov 2025 to Nov 2026', latest: 'Bump Next.js to 16.4.5 for a security patch' },
  { repo: 'infiniflop/infiniview-docs', label: 'Infiniflop Labs', count: 5, span: 'May to Nov 2026', latest: 'Round out the reference: troubleshooting, billing, glossary' },
];

export const upstreamTotal = upstream.reduce((n, u) => n + u.count, 0);

/** Recognition, each with where it is stated. */
export const recognition = [
  { big: '1st', of: 'of 74', what: 'DeveloperWeek 2026', note: 'First place out of 74 submissions.' },
  { big: String(upstreamTotal), of: 'merged', what: 'Pull requests upstream', note: `Across ${upstream.length} public repositories outside my own account.` },
  { big: '2', of: 'entries', what: 'Hackathons and challenges', note: "Kiroween 2026 (vampire-hunter) and Apple's 2025 Swift Student Challenge (CryptoLab)." },
];

/** What I'm into, each one visible in public work. */
export const interests = [
  { label: 'AI agents', proof: 'Infiniview, ask-around, agent-bridge' },
  { label: 'Dev tools', proof: 'cc-switch, envfetch, T3 Code' },
  { label: 'Rockets and robots', proof: 'merlin-control, IntergalacticPro, VEX teams' },
  { label: 'Markets and chains', proof: 'TensorPoW, a trading bot' },
];

export const chapters = [
  { id: 'hero', label: 'Arav Jain' },
  { id: 'statement', label: 'Intro' },
  { id: 'now', label: 'Now' },
  { id: 'rules', label: 'Rules' },
  { id: 'timeline', label: 'Ventures' },
  { id: 'work', label: 'Work' },
  { id: 'writing', label: 'Writing' },
  { id: 'contact', label: 'Contact' },
];
