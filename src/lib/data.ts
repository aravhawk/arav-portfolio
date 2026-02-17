import type { Venture, Investment, AdvisoryRole, SocialLink, NavItem, FooterColumn, AboutHighlight } from '@/types';

export const ventures: Venture[] = [
  {
    id: 1,
    name: "Infiniflop",
    description: "Pay-per-FLOP GPU compute with 1-line deployment.",
    industry: "GPUs / AI",
    founded: "2025",
    stage: "Pre-seed",
    website: "infiniflop.com",
    logo: "I"
  },
  {
    id: 2,
    name: "NeuralBytes",
    description: "Integrating AI to create unique tools and experiences.",
    industry: "SaaS / AI",
    founded: "2024",
    stage: "Pre-seed",
    website: "neuralbytes.net",
    logo: "N"
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
  { name: "Infiniflop", description: "Pay-per-FLOP GPU compute platform" },
  { name: "NeuralBytes", description: "AI tools and experiences" },
  { name: "Tensorcoin", description: "GPU-powered blockchain infrastructure" },
  { name: "Open Source", description: "AI/ML tools and research" }
];

export const technicalExpertise = [
  "Machine Learning & Deep Learning (PyTorch)",
  "GPU Computing & CUDA",
  "Blockchain Development",
  "Python, JavaScript, Swift",
  "AI Infrastructure & Deployment"
];

export const focusAreas = [
  "Artificial Intelligence",
  "Machine Learning",
  "Generative AI",
  "Blockchain",
  "GPU Computing",
  "Cryptocurrency"
];

export const socialLinks: SocialLink[] = [
  { icon: 'mail', label: 'aravhawk@gmail.com', href: 'mailto:aravhawk@gmail.com' },
  { icon: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com/in/aravjainml' },
  { icon: 'twitter', label: 'Twitter', href: 'https://x.com/aravhawk' },
  { icon: 'github', label: 'GitHub', href: 'https://github.com/aravhawk' }
];

export const navItems: NavItem[] = [
  { label: 'Ventures', href: '#ventures' },
  { label: 'About', href: '#about' },
  { label: 'Blog', href: '/blog' }
];

export const footerColumns: FooterColumn[] = [
  {
    title: 'Navigation',
    links: [
      { label: 'Home', href: '#' },
      { label: 'Ventures', href: '#ventures' },
      { label: 'About', href: '#about' },
      { label: 'Contact', href: '#contact' }
    ]
  },
  {
    title: 'Ventures',
    links: [
      { label: 'Infiniflop', href: 'https://infiniflop.com', external: true },
      { label: 'NeuralBytes', href: 'https://neuralbytes.net', external: true }
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

export const aboutTagline = "Building the infrastructure for next-generation AI and blockchain systems.";

export const aboutHighlights: AboutHighlight[] = [
  {
    stat: "2",
    label: "Active Ventures",
    description: "Leading Infiniflop and NeuralBytes"
  },
  {
    stat: "GPU-First",
    label: "Computing Focus",
    description: "Pioneering pay-per-FLOP infrastructure"
  },
  {
    stat: "Open Source",
    label: "Contributor",
    description: "AI/ML tools and blockchain projects"
  }
];
