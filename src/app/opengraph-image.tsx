import { OG_SIZE, OG_TYPE, renderOg } from '@/lib/og';

export const alt = 'Arav Jain, AI and developer tooling builder. The name is cut through a pale sheet of lake ice, with deep teal water showing in the letters.';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ kicker: 'arav.pro', title: 'Arav Jain', line: 'AI and developer tooling builder.', variant: 'home' });
}
