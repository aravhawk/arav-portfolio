import { NextResponse } from 'next/server';
import { getAllPosts, createPost } from '@/lib/posts';
import type { PostFrontmatter } from '@/lib/posts';

export async function GET() {
  const posts = getAllPosts();
  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { slug, frontmatter, content } = body as {
    slug: string;
    frontmatter: PostFrontmatter;
    content: string;
  };

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Invalid slug. Use lowercase letters, numbers, and hyphens only.' },
      { status: 400 }
    );
  }

  if (!frontmatter?.title) {
    return NextResponse.json(
      { error: 'Title is required.' },
      { status: 400 }
    );
  }

  const created = createPost(slug, frontmatter, content || '');
  if (!created) {
    return NextResponse.json(
      { error: 'A post with this slug already exists.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ slug, success: true }, { status: 201 });
}
