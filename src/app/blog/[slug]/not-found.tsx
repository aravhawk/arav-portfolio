import Missing from '@/components/shell/Missing';

export default function PostNotFound() {
  return <Missing title="No post" lead="That post is not here. It may have been renamed or unpublished." href="/blog" action="Go to all writing" />;
}
