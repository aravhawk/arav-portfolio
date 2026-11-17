/**
 * What the designed pieces on the project pages are made of. Every line is
 * a public fact: from the product's own site, its README, its Devpost page,
 * npm or Ollama (the sources are listed in docs/redesign-v4/content-sources.md
 * and the project fact sheets). Nothing here is measured or claimed by this
 * site; where a number is the product's own published figure, the page says
 * whose it is.
 */

/** Infiniview: the three passes that run against the live app, with the counts infiniview.dev publishes. */
export const INFINIVIEW_PASSES = [
  { n: '4', what: 'parallel code review agents', pass: 'Code review' },
  { n: '12', what: 'runtime attack agents', pass: 'Runtime attack' },
  { n: '7', what: 'interaction test types', pass: 'Interaction' },
];

/** Merged in T3 Code: what each pull request changed, from its public description. */
export const T3_PRS: { n: number; title: string; merged: string; size: string; what: string }[] = [
  {
    n: 33475,
    title: 'glab mr new links the new merge request to the thread',
    merged: '2026-11-14',
    size: '+9 -1',
    what: 'The create-command pattern now matches glab’s alias new as well as create.',
  },
  {
    n: 33474,
    title: 'gh pr new links the new pull request to the thread',
    merged: '2026-11-11',
    size: '+11 -1',
    what: 'The GitHub create-command pattern only matched create. It now also matches gh’s documented alias new.',
  },
  {
    n: 19791,
    title: 'PR cache cleanup runs once per shared layer',
    merged: '2026-10-19',
    size: '+100 -8',
    what: 'The PR read cache started one cleanup fiber per consumer, six scans of the same directory. Cleanup is now acquired once through a memoized layer.',
  },
  {
    n: 15886,
    title: 'Load merge request diffs on older GitLab',
    merged: '2026-10-18',
    size: '+269 -8',
    what: 'GitLab before 15.7 returns 404 for the merge request diffs endpoint. On that failure it retries the changes endpoint, so the Code tab can load.',
  },
  {
    n: 19737,
    title: 'Reject unresolved explicit preview tabs',
    merged: '2026-10-18',
    size: '+122 -0',
    what: 'Opening a preview now returns an error when an explicit tab cannot resolve to a server tab, instead of silently creating a different tab and reporting success.',
  },
  {
    n: 15875,
    title: 'Preserve ambient Cursor MCP servers',
    merged: '2026-10-11',
    size: '+15 -1',
    what: 'Stops sending the server list on each Cursor send, which had replaced the workspace configuration and hidden user, project and plugin servers.',
  },
  {
    n: 15876,
    title: 'Reject invalid explicit Bitbucket repositories',
    merged: '2026-10-06',
    size: '+248 -23',
    what: 'An explicit repository name is validated before lookup, so a bare name no longer silently resolves to the working directory’s repository.',
  },
  {
    n: 2981,
    title: 'Remember Composer Fast mode across new chats',
    merged: '2026-09-07',
    size: '+183 -8',
    what: 'Defaults Cursor Composer to Normal unless the user chose Fast, and keeps that choice when switching models or opening a new chat.',
  },
];

/** Kilo Bench: the five Kilo modes it covers, what each run is judged on, and its dashboard's views (Devpost). */
export const KILO_MODES = ['Architect', 'Code', 'Debug', 'Ask', 'Orchestrator'];
export const KILO_MEASURES: { name: string; judged: boolean }[] = [
  { name: 'Quality', judged: true },
  { name: 'Relevance', judged: true },
  { name: 'Speed', judged: false },
  { name: 'Cost', judged: false },
];
export const KILO_VIEWS = ['Leaderboard', 'Mode Breakdown', 'Radar Chart', 'Head-to-Head', 'Cost Optimizer'];

/** Agent Bridge: the README's message flow, who sends each step to whom, and its limits. */
export type Peer = 'sender' | 'bridge' | 'recipient';
export const BRIDGE_PEERS: { id: Peer; name: string }[] = [
  { id: 'sender', name: 'Sender' },
  { id: 'bridge', name: 'Bridge' },
  { id: 'recipient', name: 'Recipient' },
];
export const BRIDGE_FLOW: { from: Peer; to: Peer; title: string; note: string; ack?: boolean }[] = [
  { from: 'sender', to: 'bridge', title: 'Calls one tool', note: 'bridge_message_send' },
  { from: 'bridge', to: 'bridge', title: 'Stores the message', note: 'and an outbox job, in one transaction' },
  { from: 'bridge', to: 'recipient', title: 'Queues a wake', note: 'it carries the message ID only' },
  { from: 'recipient', to: 'bridge', title: 'Signs in', note: 'reads, claims and handles the message' },
  { from: 'recipient', to: 'bridge', title: 'Completes the receipt', note: 'and one correlated ACK, atomically', ack: true },
  { from: 'bridge', to: 'sender', title: 'Receives the ACK', note: 'terminal: never acknowledged in turn', ack: true },
];
export const BRIDGE_LIMITS = ['Exactly two peers and one owner', 'At most 4 KiB of text in a message', 'A 60 s claim lease'];

/** Open models: what each build is, as its Ollama page says. */
export const MODEL_NOTES: Record<string, { what: string; sizes: string; run: string }> = {
  'qwen3.5-opus-4.6': { what: 'Qwen 3.5 distilled from Claude Opus 4.6', sizes: '9b 6.5GB, 27b 17GB', run: 'ollama run aravhawk/qwen3.5-opus-4.6' },
  llama4: { what: 'Meta Llama 4 Scout and Maverick', sizes: '109b 65GB, 400b 243GB', run: 'ollama run aravhawk/llama4' },
  gemma4: { what: 'Gemma 4 26B, quantised to fit 16GB of VRAM', sizes: '26b 13GB', run: 'ollama run aravhawk/gemma4:26b' },
  'qwen3.6': { what: '', sizes: '27b 12GB', run: 'ollama run aravhawk/qwen3.6:27b' },
};

/** cc-switch: its real commands (README), and the provider templates it ships. */
export const SWITCH_INSTALL = 'npm install -g @aravhawk/cc-switch';
export const SWITCH_MORE = ['cc-switch --list', 'cc-switch --current', 'cc-switch --providers'];
export const SWITCH_GROUPS: { n: number; name: string; who: string }[] = [
  { n: 2, name: 'Anthropic', who: '' },
  {
    n: 12,
    name: 'Model labs',
    who: 'Z.ai GLM, Moonshot Kimi, Kimi Code, MiniMax, DeepSeek, Alibaba Qwen, Xiaomi MiMo, StepFun, Volcengine, Tencent, Baidu Qianfan, Meituan LongCat',
  },
  { n: 6, name: 'Local', who: 'Ollama, LM Studio, llama.cpp, vLLM, SGLang, Docker Model Runner' },
  { n: 9, name: 'Gateways and routers', who: 'OpenRouter, Vercel AI Gateway, Hugging Face, ZenMux, AIHubMix, Requesty, OpenCode, LiteLLM, custom' },
  { n: 8, name: 'Inference hosts', who: '' },
  { n: 4, name: 'Cloud platforms', who: 'Amazon Bedrock, Vertex AI, Microsoft Foundry, Claude Platform on AWS' },
];
export const SWITCH_QUOTE = {
  text: 'Templates replace everything tied to the previous provider so settings never leak between providers.',
  source: 'cc-switch README',
};

/** TensorPoW: the parts of a node (README), and what stands between it and a live network. */
export const TENSOR_BACKENDS = ['CPU', 'Apple GPU', 'CUDA GPU'];
export const TENSOR_STACK: { name: string; does: string }[] = [
  { name: 'Python 3.12', does: 'the node' },
  { name: 'PyTorch', does: 'tensors' },
  { name: 'Cython', does: 'hot paths' },
  { name: 'BLAKE3', does: 'hashing' },
  { name: 'Ed25519', does: 'signatures' },
  { name: 'libp2p', does: 'networking' },
  { name: 'RocksDB', does: 'state' },
];
export const TENSOR_GATES = [
  'A six hour soak across CPU, Apple GPU and CUDA with matching consensus reports',
  'A public testnet: 30 days, 100 nodes',
  'Public genesis publication',
  'First fruit evidence',
];

/** RydAR: the numbers on rydar.org and in its README, and the prompt it speaks. */
export const RYDAR_CURVES = { value: '153,328', unit: 'curves mapped in Arkansas' };
export const RYDAR_MORE = ['75 county pages', 'A base warning lead of 12 s of travel'];
export const RYDAR_QUOTE = { text: 'Slow to 25 mph for the curve ahead.', source: 'RydAR, spoken' };
