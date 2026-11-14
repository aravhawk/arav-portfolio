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
    note: 'Three outputs is not better than one good output.',
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
    line: "We're building Infiniview: agents that review, probe, and stress-test your code in cloud sandboxes.",
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
};

export const projects: Project[] = [
  {
    slug: 'cc-switch',
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
    name: 'agent-bridge',
    year: '2026',
    kind: 'MCP server',
    stack: 'TypeScript',
    line: 'A shared inbox between your OpenAI dot and Grok Bot.',
    detail: 'Self-hosted, for one owner. The two assistants exchange messages, status updates and handoff requests without you copying context between chats. Each signs in with its own OAuth token.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/agent-bridge' }],
    featured: true,
  },
  {
    slug: 'ask-around',
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
    name: 'envfetch',
    year: '2026',
    kind: 'macOS CLI',
    stack: 'Swift',
    line: 'Environment variables behind Touch ID.',
    detail: 'Stores profiles in an encrypted local vault with a Secure Enclave key, and activates them in zsh, bash or fish.',
    links: [{ label: 'GitHub', href: 'https://github.com/aravhawk/envfetch' }],
    archived: true,
  },
];

export const contributions = {
  repo: 'pingdotgg/t3code',
  href: 'https://github.com/pingdotgg/t3code/pulls?q=is%3Apr+author%3Aaravhawk+is%3Amerged',
  line: 'Seven merged pull requests to T3 Code between September and November 2026.',
  items: [
    { n: 33474, title: 'gh pr new links the new pull request to the thread', date: 'Nov 2026' },
    { n: 19791, title: 'PR cache cleanup runs once per shared layer', date: 'Oct 2026' },
    { n: 19737, title: 'Reject unresolved explicit preview tabs', date: 'Oct 2026' },
    { n: 15886, title: 'Load merge request diffs on older GitLab', date: 'Oct 2026' },
    { n: 15875, title: 'Preserve ambient Cursor MCP servers', date: 'Oct 2026' },
    { n: 15876, title: 'Reject invalid explicit Bitbucket repositories', date: 'Oct 2026' },
    { n: 2981, title: 'Remember Composer Fast mode across new chats', date: 'Sep 2026' },
  ],
};

/** What I'm into, each one visible in public work. */
export const interests = [
  { label: 'AI agents', proof: 'Infiniview, ask-around, agent-bridge' },
  { label: 'Dev tools', proof: 'cc-switch, envfetch, T3 Code' },
  { label: 'Rockets', proof: 'merlin-control, IntergalacticPro' },
  { label: 'GPUs and chains', proof: 'TensorPoW' },
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
