'use client';

import Missing from '@/components/shell/Missing';

export default function PostError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <Missing title="Error" lead="This post failed to render. Try it again, or go back to the list." href="/blog" action="Go to all writing" onRetry={reset} />;
}
