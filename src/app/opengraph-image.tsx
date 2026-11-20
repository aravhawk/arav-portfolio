import { OG_SIZE, OG_TYPE, ogAlt, renderOg } from '@/lib/og';

export const alt = ogAlt('Arav Jain, AI and developer tooling builder', 'lake');
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ kicker: 'Arav Jain', title: 'Arav Jain', line: 'AI and developer tooling builder.', picture: 'lake' });
}
