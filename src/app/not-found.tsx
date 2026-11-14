import Missing from '@/components/shell/Missing';

export default function NotFound() {
  return <Missing title="404" lead="This page is not on the loop. The address is wrong or the page moved." href="/" action="Go to the home page" />;
}
