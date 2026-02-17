export interface Venture {
  id: number;
  name: string;
  description: string;
  industry: string;
  founded: string;
  stage: string;
  website: string;
  logo: string;
}

export interface Investment {
  id: number;
  company: string;
  description: string;
  year: string;
  type: string;
}

export interface AdvisoryRole {
  id: number;
  company: string;
  role: string;
  industry: string;
  period: string;
}

export interface Project {
  name: string;
  description: string;
}

export interface SocialLink {
  icon: 'mail' | 'linkedin' | 'twitter' | 'github';
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterColumn {
  title: string;
  links: {
    label: string;
    href: string;
    external?: boolean;
  }[];
}

export interface AboutHighlight {
  stat: string;
  label: string;
  description: string;
}

export interface BlogFrontmatter {
  title: string;
  date: string;
  description: string;
  tags: string[];
  published: boolean;
  image?: string;
}

export interface BlogPost {
  slug: string;
  frontmatter: BlogFrontmatter;
  readingTime: string;
  content: string;
}
