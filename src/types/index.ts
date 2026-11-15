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
