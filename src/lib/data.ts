import type { Venture, Investment, AdvisoryRole, SocialLink, NavItem, FooterColumn, AboutHighlight } from '@/types';

export const ventures: Venture[] = [
  {
    id: 1,
    name: "Infiniflop Labs",
    description: "Building AI agents that find issues in your apps before users do.",
    industry: "AI Agents / Security",
    founded: "2026",
    stage: "Building",
    website: "infiniflop.com",
    logo: "I"
  },
  {
    id: 2,
    name: "NeuralBytes",
    description: "AI-powered tools and experiences. Integrating intelligence into everyday workflows.",
    industry: "SaaS / AI",
    founded: "2024",
    stage: "Archived",
    website: "neuralbytes.net",
    logo: "N"
  },
  {
    id: 3,
    name: "Master Coders",
    description: "Free live coding lessons teaching students to build real projects from scratch.",
    industry: "Education",
    founded: "2020",
    stage: "Archived",
    website: "mastercoders.dev",
    logo: "M"
  }
];

// Commented out for future use
export const investments: Investment[] = [
  // {
  //   id: 1,
  //   company: "Example Company",
  //   description: "Description of the investment.",
  //   year: "2025",
  //   type: "Angel"
  // }
];

// Commented out for future use
export const advisoryRoles: AdvisoryRole[] = [
  // {
  //   id: 1,
  //   company: "Example Company",
  //   role: "Technical Advisor",
  //   industry: "AI/ML",
  //   period: "2024-Present"
  // }
];

export const currentProjects = [
  { name: "Infiniflop Labs", description: "AI agents that find issues before users do" },
  { name: "claudeclaw", description: "Multi-platform AI assistant via Claude Agents SDK" },
  { name: "fix-it-bot", description: "Drop-in React component — bug reports become PRs automatically" },
  { name: "TensorPoW", description: "GPU-accelerated blockchain powered by PyTorch" }
];

export const technicalExpertise = [
  "AI Agents & LLM Engineering (Claude SDK, OpenAI)",
  "Full-Stack Development (Next.js, React, TypeScript)",
  "Machine Learning & Deep Learning (PyTorch)",
  "Python, TypeScript, Swift",
  "AI Security & Red Teaming"
];

export const focusAreas = [
  "AI Agents",
  "Security & Pentesting",
  "Full-Stack Engineering",
  "Machine Learning",
  "Developer Tools",
  "Open Source"
];

export const socialLinks: SocialLink[] = [
  { icon: 'mail', label: 'aravhawk@gmail.com', href: 'mailto:aravhawk@gmail.com' },
  { icon: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com/in/aravjainml' },
  { icon: 'twitter', label: 'Twitter', href: 'https://x.com/aravhawk' },
  { icon: 'github', label: 'GitHub', href: 'https://github.com/aravhawk' }
];

export const navItems: NavItem[] = [
  { label: 'Work', href: '#ventures' },
  { label: 'About', href: '#about' },
  { label: 'Blog', href: '/blog' }
];

export const footerColumns: FooterColumn[] = [
  {
    title: 'Navigation',
    links: [
      { label: 'Home', href: '#' },
      { label: 'Work', href: '#ventures' },
      { label: 'About', href: '#about' },
      { label: 'Contact', href: '#contact' }
    ]
  },
  {
    title: 'Work',
    links: [
      { label: 'Infiniflop Labs', href: 'https://infiniflop.com', external: true },
      { label: 'NeuralBytes', href: 'https://neuralbytes.net', external: true },
      { label: 'Master Coders', href: 'https://mastercoders.dev', external: true }
    ]
  },
  {
    title: 'Connect',
    links: [
      { label: 'Email', href: 'mailto:aravhawk@gmail.com' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/aravjainml', external: true },
      { label: 'Twitter', href: 'https://x.com/aravhawk', external: true }
    ]
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'GitHub', href: 'https://github.com/aravhawk', external: true }
    ]
  }
];

export const aboutTagline = "Building AI agents that find issues in your apps before your users do.";

export const aboutHighlights: AboutHighlight[] = [
  {
    stat: "Infiniview",
    label: "Current Focus",
    description: "Something big. Stay tuned."
  },
  {
    stat: "3",
    label: "Ventures",
    description: "Infiniflop Labs, NeuralBytes, Master Coders"
  },
  {
    stat: "1st",
    label: "DeveloperWeek 2026",
    description: "Won 1st place out of 74 submissions"
  }
];
