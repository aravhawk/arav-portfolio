import type { Scene, ShapeName, GroundName } from '@/stage/stage';

/**
 * Every number here was read from its public source on 2026-11-14 (America/Chicago).
 * Sources and retrieval times: docs/redesign-v3/content-sources.md.
 */
export const RETRIEVED = '2026-11-14';

export const metrics = {
  ollamaPulls: 18284,
  ollamaModels: [
    { name: 'qwen3.5-opus-4.6', pulls: 9441, uploaded: 'Apr 1, 2026' },
    { name: 'llama4', pulls: 7363, uploaded: 'Apr 11, 2025' },
    { name: 'gemma4', pulls: 1282, uploaded: 'Apr 14, 2026' },
    { name: 'qwen3.6', pulls: 198, uploaded: 'Apr 25, 2026' },
  ],
  npmDownloads: 9819,
  npmLastMonth: 457,
  contributions2026: 2597,
  mergedUpstream: 20,
  upstreamRepos: 7,
  t3Merged: 8,
};

export const contact = {
  github: 'https://github.com/aravhawk',
  x: 'https://x.com/aravhawk',
  linkedin: 'https://www.linkedin.com/in/aravjainml',
  email: 'aravhawk@gmail.com',
};

export type LinkItem = { label: string; href: string };
export type Fact = { k: string; v: string };

export type Project = {
  slug: string;
  name: string;
  /** Display lines for the poster-size word. */
  lines: string[];
  linesNarrow?: string[];
  /** Width of the widest line in em, measured with Archivo 800 at 125% width. */
  w: number;
  wNarrow?: number;
  shape: ShapeName;
  ground: GroundName;
  kicker: string;
  /** One line for lists. */
  line: string;
  body: string[];
  quote?: string;
  facts: Fact[];
  links: LinkItem[];
  stats?: { value: number; label: string }[];
  video?: boolean;
};

export const projects: Project[] = [
  {
    slug: 'infiniview',
    name: 'Infiniview',
    lines: ['Infiniview'],
    linesNarrow: ['Infini', 'view'],
    w: 5.48,
    wNarrow: 2.76,
    shape: 'lens',
    ground: 'signal',
    kicker: 'Security',
    line: 'AI code review, auditing and stress testing. It attacks your app in a sandbox and hands you the proof.',
    body: [
      'Infiniview is AI code review, auditing and stress testing. It connects to your GitHub, deploys your app in a sandbox, and runs real attacks against it. You get replayable proof of what broke.',
      'It began as Docksmith in March 2026 and became Infiniview in April. I cofounded Infiniflop Labs that March to build it. The security agent underneath is the agent system I’m building.',
    ],
    facts: [
      { k: 'Status', v: 'Early access' },
      { k: 'Company', v: 'Infiniflop Labs, cofounded Mar 2026' },
      { k: 'Mar 2026', v: 'Started as Docksmith' },
      { k: 'Apr 2026', v: 'Renamed Infiniview' },
      { k: 'Apr 9, 2026', v: 'Accepted into Daytona Startup Grid' },
      { k: 'Sep 29, 2026', v: 'Infiniflop Labs selected for OpenAI DevDay 2026, San Francisco' },
    ],
    links: [
      { label: 'infiniview.dev', href: 'https://infiniview.dev' },
      { label: 'Docs', href: 'https://docs.infiniview.dev' },
      { label: 'Infiniflop Labs', href: 'https://infiniflop.com' },
    ],
  },
  {
    slug: 'open-source',
    name: 'Open source',
    lines: ['Open', 'source'],
    w: 4.04,
    shape: 'merge',
    ground: 'ink',
    kicker: 'T3 Code and others',
    line: '20 merged pull requests across 7 public upstream repos. 8 of them in T3 Code.',
    body: [
      'I fix things in the tools I use. Most of it lands in T3 Code: linking new pull requests and merge requests to their thread, keeping Cursor MCP servers intact, remembering Composer Fast mode.',
      'The rest is spread across tokscale, Kilo Code, XcodeBenchmark, openbridge and two other sites.',
    ],
    facts: [
      { k: 'pingdotgg/t3code', v: '8 merged' },
      { k: 'AvinashDevineni/ThrasherAndChambersWebsite', v: '5 merged' },
      { k: 'junhoyeo/tokscale', v: '3 merged' },
      { k: 'Kilo-Org/kilocode', v: '1 merged' },
      { k: 'devMEremenko/XcodeBenchmark', v: '1 merged' },
      { k: 'fakerybakery/openbridge', v: '1 merged' },
      { k: 'Kanishksasi/Investo', v: '1 merged' },
    ],
    links: [
      { label: 'Merged pull requests', href: 'https://github.com/pulls?q=author%3Aaravhawk+is%3Apr+is%3Amerged+-user%3Aaravhawk' },
      { label: 'T3 Code', href: 'https://github.com/pingdotgg/t3code/pulls?q=is%3Apr+author%3Aaravhawk+is%3Amerged' },
    ],
    stats: [
      { value: metrics.mergedUpstream, label: 'merged upstream' },
      { value: metrics.contributions2026, label: 'contributions in 2026' },
    ],
  },
  {
    slug: 'kilo-bench',
    name: 'Kilo Bench',
    lines: ['Kilo', 'Bench'],
    w: 4.64,
    shape: 'bars',
    ground: 'cloud',
    kicker: 'Evaluation',
    line: 'Native model benchmarking in Kilo Code. Won “Kilo - For Devs, By Devs” at the DeveloperWeek 2026 Hackathon.',
    body: [
      'Kilo Bench is native model benchmarking inside Kilo Code. It builds coding challenges from your own codebase, runs models across all five Kilo modes, and ranks them in a dashboard.',
      'It won the “Kilo - For Devs, By Devs” prize category at the DeveloperWeek 2026 Hackathon.',
    ],
    facts: [
      { k: 'Award', v: 'Winner, “Kilo - For Devs, By Devs”' },
      { k: 'Event', v: 'DeveloperWeek 2026 Hackathon' },
      { k: 'Built in', v: 'A fork of Kilo Code, TypeScript' },
      { k: 'License', v: 'MIT' },
    ],
    links: [
      { label: 'Devpost', href: 'https://devpost.com/software/kilo-bench-native-model-benchmarking-in-kilo-code' },
      { label: 'GitHub', href: 'https://github.com/aravhawk/kilobench' },
    ],
  },
  {
    slug: 'agent-bridge',
    name: 'Agent Bridge',
    lines: ['Agent', 'Bridge'],
    w: 3.8,
    shape: 'bridge',
    ground: 'cobalt',
    kicker: 'Agents',
    line: 'Connects an OpenAI Dot to a Grok Bot through a self-hosted MCP inbox.',
    body: [
      'Agent Bridge connects an OpenAI Dot to a Grok Bot. It is a self-hosted MCP inbox for handoffs and status updates in both directions, with queued delivery through QStash, private large-file transfer on Vercel Blob, and batching.',
      'A message cannot grant approval, run a tool or change access. The receiving assistant treats it as inbox content.',
    ],
    quote: 'Messages are data, never permission.',
    facts: [
      { k: 'License', v: 'Apache-2.0' },
      { k: 'Protocol', v: 'MCP, OAuth per peer' },
      { k: 'Delivery', v: 'Queue and QStash, batched' },
      { k: 'Files', v: 'Private Vercel Blob transfer' },
    ],
    links: [
      { label: 'GitHub', href: 'https://github.com/aravhawk/agent-bridge' },
      { label: 'Launch post', href: 'https://x.com/aravhawk/status/2117458115134472437' },
    ],
    video: true,
  },
  {
    slug: 'open-models',
    name: 'Open models',
    lines: ['18,284'],
    w: 4.0,
    shape: 'stack',
    ground: 'ink',
    kicker: 'Ollama',
    line: 'GGUF builds of open models on Ollama. 18,284 pulls across 4 public models.',
    body: ['I package open models as GGUF builds and publish them on Ollama. Four are public.'],
    facts: metrics.ollamaModels.map((m) => ({ k: m.name, v: `${m.pulls.toLocaleString('en-US')} pulls, uploaded ${m.uploaded}` })),
    links: [{ label: 'ollama.com/aravhawk', href: 'https://ollama.com/aravhawk' }],
    stats: [{ value: metrics.ollamaPulls, label: 'pulls across 4 models' }],
  },
  {
    slug: 'cc-switch',
    name: 'cc-switch',
    lines: ['cc-', 'switch'],
    w: 5.15,
    shape: 'switch',
    ground: 'signal',
    kicker: 'Tools',
    line: 'A profile manager for Claude Code across Anthropic and open-model providers, in one command.',
    body: ['cc-switch is a profile manager for Claude Code. One command switches between Anthropic, open-model providers, gateways and local models.'],
    facts: [
      { k: 'Package', v: '@aravhawk/cc-switch' },
      { k: 'Version', v: '4.0.0' },
      { k: 'License', v: 'MIT' },
      { k: 'First published', v: 'Feb 1, 2026' },
    ],
    links: [
      { label: 'GitHub', href: 'https://github.com/aravhawk/cc-switch' },
      { label: 'npm', href: 'https://www.npmjs.com/package/@aravhawk/cc-switch' },
    ],
    stats: [
      { value: metrics.npmDownloads, label: 'npm downloads, all time' },
      { value: metrics.npmLastMonth, label: 'in the last month' },
    ],
  },
  {
    slug: 'tensorpow',
    name: 'TensorPoW',
    lines: ['TensorPoW'],
    linesNarrow: ['Tensor', 'PoW'],
    w: 6.78,
    wNarrow: 4.04,
    shape: 'tensor',
    ground: 'cloud',
    kicker: 'Research',
    line: 'A reference implementation of a GPU-native proof-of-work protocol. Becoming a research paper.',
    body: [
      'TensorPoW is a reference implementation of a GPU-native proof-of-work protocol. It is built on deterministic INT8 tensor computation, with fruit and anchor blocks arranged in a BlockDAG, so different backends can verify the same result.',
      'The idea and the first code are from October 2024. The new version is from June 2026, and it is turning into a full research paper.',
    ],
    facts: [
      { k: 'Oct 2024', v: 'Idea and basic code' },
      { k: 'Jun 2026', v: 'New version' },
      { k: 'License', v: 'Apache 2.0, historic MIT notice preserved' },
      { k: 'Language', v: 'Python' },
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/TensorPoW' }],
  },
  {
    slug: 'merlin-control',
    name: 'merlin-control',
    lines: ['Merlin'],
    w: 3.57,
    shape: 'engine',
    ground: 'ink',
    kicker: 'Spaceflight',
    line: 'A wireframe Merlin 1D engine you control with your bare hands through a webcam.',
    body: [
      'A wireframe SpaceX Merlin 1D engine floating in space, driven by your bare hands through a webcam. Grab it, rotate it, zoom and pan with two hands, flick it into a free spin, then catch it.',
      'It is a browser riff on SpaceX’s 2013 “The Future of Design” demo, built with TypeScript, Three.js and MediaPipe Hand Landmarker.',
    ],
    facts: [
      { k: 'Stack', v: 'TypeScript, Three.js, MediaPipe' },
      { k: 'Input', v: 'Webcam hand tracking' },
    ],
    links: [
      { label: 'merlin.aravhawk.com', href: 'https://merlin.aravhawk.com' },
      { label: 'GitHub', href: 'https://github.com/aravhawk/merlin-control' },
    ],
  },
  {
    slug: 'rydar',
    name: 'RydAR',
    lines: ['RydAR'],
    w: 3.5,
    shape: 'orbit',
    ground: 'cobalt',
    kicker: 'Road safety',
    line: 'An iPhone co-pilot for tight bends in Arkansas, plus a public curve map.',
    body: [
      'RydAR is an iPhone co-pilot for tight bends in Arkansas, and a public map of those bends. It speaks advisories before the curve arrives. I built it with collaborators.',
    ],
    quote: 'Slow to 25 mph for the curve ahead.',
    facts: [
      { k: 'Platform', v: 'iPhone, plus a web map' },
      { k: 'Team', v: 'Built with collaborators' },
    ],
    links: [
      { label: 'rydar.org', href: 'https://rydar.org' },
      { label: 'GitHub', href: 'https://github.com/aravhawk/RydAR' },
    ],
  },
];

/** The eight flagships on the home stage, in order. RydAR lives on /work. */
export const flagships = projects.filter((p) => p.slug !== 'rydar');

export const t3Titles = [
  { n: 33474, pre: '', code: 'gh pr new', post: ' links the new pull request to the thread' },
  { n: 33475, pre: '', code: 'glab mr new', post: ' links the new merge request to the thread' },
  { n: 15875, pre: 'preserve ambient Cursor MCP servers', code: '', post: '' },
  { n: 2981, pre: 'remember Composer Fast mode across new chats', code: '', post: '' },
];

export type Highlight = { name: string; text: string; note?: string; links: LinkItem[] };
export const highlights: Highlight[] = [
  {
    name: 'Ask Around',
    text: 'Governance for agents that ask people: who may answer, how many must agree, and what silence means. Quorum and veto are enforced, and silence is never a yes.',
    note: 'Won Belweave’s Notify Weekend 01 hackathon, Nov 2026.',
    links: [
      { label: 'GitHub', href: 'https://github.com/aravhawk/ask-around' },
      { label: 'Announcement', href: 'https://x.com/pkyanam/status/2120163766713430040' },
    ],
  },
  {
    name: 'ClarifAI',
    text: 'AI-assisted relationship mediation for couples and roommates.',
    links: [
      { label: 'GitHub', href: 'https://github.com/aravhawk/ClarifAI' },
      { label: 'Devpost', href: 'https://devpost.com/software/clarifai-6pg03u' },
    ],
  },
  {
    name: 'fix-it-bot',
    text: 'A React component that turns bug reports into agent-generated pull requests.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/fix-it-bot' }],
  },
  {
    name: 'OxyDrop',
    text: 'A phone-camera check for a drop in blood oxygen from your own baseline.',
    note: 'Research prototype: not medical advice, not a medical device, validated on only 6 people.',
    links: [
      { label: 'GitHub', href: 'https://github.com/aravhawk/oxydrop' },
      { label: 'Demo', href: 'https://aravhawk.github.io/oxydrop/' },
    ],
  },
  {
    name: 'VELOCITY',
    text: 'Flight-computer PCBs for model rocketry under JRLS. R1 in Dec 2023, PICO R1 in Sep 2024, then FLEX 2350.',
    links: [],
  },
  {
    name: 'VEX robotics',
    text: 'Robot code for teams 99719T and 3400Z: drivetrain, autonomous routines and PID autotune.',
    note: 'VEX Design Award, Nov 2025.',
    links: [
      { label: '99719T', href: 'https://github.com/aravhawk/99719T' },
      { label: '3400Z', href: 'https://github.com/aravhawk/3400Z' },
    ],
  },
  {
    name: 'goFoundr',
    text: 'An AI founder agent.',
    links: [{ label: 'GitHub', href: 'https://github.com/2ALabz/goFoundr' }],
  },
];

export const press = {
  outlet: 'Business Insider',
  date: 'May 2026',
  href: 'https://www.businessinsider.com/coders-keep-laptops-open-in-public-ai-agent-2026-5',
  quotes: ['I got agents running.', 'I’ve got to keep shipping software.'],
};

export const essay = {
  title: 'Three AI Agents Built Me Five SaaS Products. I Wouldn’t Ship Any of Them.',
  href: '/blog/three-ai-agents-five-saas-products',
};

export type ArchiveKind = 'Earlier work' | 'Tools' | 'Small';
export type ArchiveItem = { name: string; kind: ArchiveKind; year: number; text: string; href?: string; live?: string };
const gh = (r: string) => `https://github.com/aravhawk/${r}`;
export const archive: ArchiveItem[] = [
  { name: 'neuralbytes.net', kind: 'Earlier work', year: 2024, text: 'Source for the NeuralBytes website. TypeScript.', href: gh('neuralbytes.net'), live: 'https://neuralbytes.net' },
  { name: 'SumQuick', kind: 'Earlier work', year: 2024, text: 'Open-source AI summarization that runs locally on Ollama. Python.', href: gh('SumQuick') },
  { name: 'ChatGPT-3.5-with-Vision', kind: 'Earlier work', year: 2024, text: 'Python.', href: gh('ChatGPT-3.5-with-Vision') },
  { name: 'IntergalacticPro', kind: 'Earlier work', year: 2024, text: 'A space and rockets expert that is clear, concise and friendly. Python.', href: gh('IntergalacticPro') },
  { name: 'Weather-Station-BMP280', kind: 'Earlier work', year: 2023, text: 'Raspberry Pi and BMP280 weather station that records its data in an Excel workbook. Python.', href: gh('Weather-Station-BMP280') },
  { name: 'Master Coders', kind: 'Earlier work', year: 2020, text: 'A coding project from 2020. No public repo.' },
  { name: 'passportphoto', kind: 'Tools', year: 2026, text: 'Local-use US passport photo (2x2in) studio. TypeScript.', href: gh('passportphoto') },
  { name: 'envfetch', kind: 'Tools', year: 2026, text: 'Environment variable manager with Touch ID. Swift.', href: gh('envfetch') },
  { name: 'claude-code-utils', kind: 'Tools', year: 2026, text: 'Claude Code plugins and config I use daily. Shell.', href: gh('claude-code-utils') },
  { name: 'typing-game', kind: 'Tools', year: 2026, text: 'A minimalist typing game. TypeScript.', href: gh('typing-game') },
  { name: 'lite-stats', kind: 'Tools', year: 2025, text: 'Lightweight macOS monitor in your menu bar. Swift. Credit to exelban/stats.', href: gh('lite-stats') },
  { name: 'CryptoLab', kind: 'Small', year: 2025, text: 'Swift Student Challenge 2025 entry. Swift.', href: gh('CryptoLab.swiftpm') },
  { name: 'escaperoom', kind: 'Small', year: 2022, text: 'HTML.', href: gh('escaperoom') },
  { name: 'workjet', kind: 'Small', year: 2022, text: 'HTML.', href: gh('workjet-google') },
  { name: 'who-wants-to-be-a-billionaire', kind: 'Small', year: 2022, text: 'HTML.', href: gh('who-wants-to-be-a-billionaire') },
  { name: 'teamastros', kind: 'Small', year: 2022, text: 'HTML.', href: gh('teamastros') },
  { name: 'top10tipsforsurvival', kind: 'Small', year: 2021, text: 'HTML.', href: gh('top10tipsforsurvival') },
];

/* ---------- Scenes: where the drop sits and what it is ---------- */
const P = (x: number, y: number, size: number) => ({ x, y, size });

export const scenes = {
  hero: { shape: 'drop', ground: 'cloud', d: P(0.53, 0.46, 0.33), m: P(0.6, 0.3, 0.3), pitch: 0.1 },
  infiniview: { shape: 'lens', ground: 'signal', d: P(0.7, 0.5, 0.27), m: P(0.5, 0.5, 0.25), pitch: 0.12, yaw: -0.55 },
  'open-source': { shape: 'merge', ground: 'ink', d: P(0.76, 0.42, 0.25), m: P(0.5, 0.5, 0.25), yaw: 0.35, pitch: 0.05 },
  'kilo-bench': { shape: 'bars', ground: 'cloud', d: P(0.72, 0.52, 0.26), m: P(0.5, 0.5, 0.25), yaw: -0.5, pitch: 0.2 },
  'agent-bridge': { shape: 'bridge', ground: 'cobalt', d: P(0.46, 0.66, 0.23), m: P(0.5, 0.5, 0.25), yaw: 0.3, pitch: 0.16 },
  'open-models': { shape: 'stack', ground: 'ink', d: P(0.74, 0.68, 0.24), m: P(0.5, 0.5, 0.25), pitch: 0.42, spin: 0.25 },
  'cc-switch': { shape: 'switch', ground: 'signal', d: P(0.46, 0.52, 0.24), m: P(0.5, 0.5, 0.25), yaw: -0.3, pitch: 0.2 },
  tensorpow: { shape: 'tensor', ground: 'cloud', d: P(0.72, 0.54, 0.25), m: P(0.5, 0.5, 0.25), pitch: 0.5, yaw: 0.6, spin: 0.18 },
  'merlin-control': { shape: 'engine', ground: 'ink', d: P(0.7, 0.48, 0.34), m: P(0.5, 0.5, 0.25), pitch: 0.18, spin: 0.3 },
  rydar: { shape: 'orbit', ground: 'cobalt', d: P(0.76, 0.42, 0.24), m: P(0.78, 0.2, 0.2), pitch: 0.5, spin: 0.1 },
  more: { shape: 'orbit', ground: 'cobalt', d: P(0.74, 0.38, 0.28), m: P(0.5, 0.42, 0.3), pitch: 0.55, spin: 0.12 },
  contact: { shape: 'drop', ground: 'cloud', d: P(0.84, 0.6, 0.2), m: P(0.5, 0.6, 0.3), pitch: 0.1 },
  work: { shape: 'slab', ground: 'cloud', d: P(0.72, 0.21, 0.19), m: P(0.74, 0.19, 0.2), yaw: -0.5, pitch: 0.25 },
  blog: { shape: 'slab', ground: 'cloud', d: P(0.32, 0.22, 0.17), m: P(0.78, 0.2, 0.2), yaw: 0.45, pitch: -0.2 },
  post: { shape: 'drop', ground: 'cloud', d: P(0.9, 0.2, 0.1), m: P(0.84, 0.14, 0.12), pitch: 0.1 },
  lost: { shape: 'split', ground: 'ink', d: P(0.82, 0.28, 0.22), m: P(0.5, 0.5, 0.25), yaw: 0.2 },
} satisfies Record<string, Scene>;

/** Scene for a project page: the same form, parked beside the title. */
export function projectScene(slug: string): Scene {
  const s = (scenes as Record<string, Scene>)[slug] ?? scenes.work;
  return { ...s, d: { x: 0.86, y: 0.22, size: 0.15 }, m: { x: 0.8, y: 0.17, size: 0.16 } };
}
