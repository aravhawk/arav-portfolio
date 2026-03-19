import { NextResponse } from 'next/server';
import { getPost, updatePost, deletePost } from '@/lib/posts';
import type { PostFrontmatter } from '@/lib/posts';

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }
  const post = getPost(slug);

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(post);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { frontmatter, content } = body as {
    frontmatter: PostFrontmatter;
    content: string;
  };

  if (!frontmatter?.title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const updated = updatePost(slug, frontmatter, content || '');
  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ slug, success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }
  const deleted = deletePost(slug);

  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ slug, deleted: true });
}
