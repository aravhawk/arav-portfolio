import Missing from '@/components/shell/Missing';

export default function NotFound() {
  return <Missing title="404" lead="Nothing lives at this address. It is wrong, or the page moved." href="/" action="Go to the home page" />;
}
